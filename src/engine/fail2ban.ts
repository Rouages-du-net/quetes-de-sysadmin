// fail2ban sur une machine : lecture de la configuration comme fail2ban
// (https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html) :
//   - fichiers lus dans l'ordre jail.conf, jail.d/*.conf, jail.local,
//     jail.d/*.local : une valeur lue plus tard REMPLACE la précédente ;
//   - la section d'une prison l'emporte sur [DEFAULT], quel que soit le
//     fichier : un port mis dans le [DEFAULT] de jail.local ne remplace pas
//     le « port = ssh » du [sshd] de jail.conf ;
//   - toute section [nom] est une prison ; active (enabled = true), il lui
//     faut son journal, sinon fail2ban ne démarre pas ;
//   - durées : 600, 10m, 1h, 1d, 1w ; -1 = pour toujours.
// Les échecs viennent du journal du service ssh (sshd), de error.log de nginx
// (nginx-limit-req) ou de fail2ban.log (recidive : les bannissements des
// autres prisons) ; une adresse est bannie
// quand elle atteint maxretry échecs, sauf si ignoreip la couvre. Les
// bannissements survivent à un rechargement (comme avec la base de données
// de fail2ban) : seul unbanip les lève.
// L'action bloque les ports de la prison (port = ssh, 2222, http,https,
// 1000:2000) : une adresse bannie peut encore joindre les autres ports.
// Écarts : filtres connus pour sshd, nginx-limit-req et recidive seulement
// (les autres prisons se chargent sans rien bannir), findtime non appliqué (tous les échecs
// du journal comptent), filtre réduit à « Failed password », « Invalid user »
// et « Failed publickey ».

import type { Game } from './shell';
import { systemd } from './systemd';

export const DIRECTORY = '/etc/fail2ban';
const KEYS = ['enabled', 'bantime.increment', 'bantime', 'findtime', 'maxretry', 'ignoreip', 'ignoreself', 'port', 'logpath', 'backend', 'banaction', 'mode', 'filter'];

export interface Jail {
  name: string;
  enabled: boolean;
  bantime: number;
  findtime: number;
  maxretry: number;
  ignoreip: string[];
  // Les ports bloqués pour une adresse bannie (vide : tous).
  ports: number[];
  // Le fichier lu par la prison (null : le journal de systemd).
  log: string | null;
}

const PORTS_NAMES: Record<string, number> = { ssh: 22, http: 80, https: 443, ftp: 21, smtp: 25, submission: 587, imap: 143, imaps: 993 };

/** « ssh,2222 » → [22, 2222] ; « 0:65535 » → [] (tous) ; null si un nom est inconnu. */
export function readPorts(value: string): number[] | null {
  const ports: number[] = [];
  for (const word of value.split(/[\s,]+/).filter(Boolean)) {
    const range = /^(\d+):(\d+)$/.exec(word);
    if (range) {
      if (Number(range[1]) === 0 && Number(range[2]) >= 65535) return [];
      for (let p = Number(range[1]); p <= Number(range[2]) && ports.length < 1024; p++) ports.push(p);
    } else if (/^\d+$/.test(word)) ports.push(Number(word));
    else if (PORTS_NAMES[word] !== undefined) ports.push(PORTS_NAMES[word]);
    else return null;
  }
  return ports;
}

/** La prison bloque-t-elle ce port pour les adresses bannies ? */
export const portBlocked = (p: Jail | null | undefined, port: number) => !p || !p.ports.length || p.ports.includes(port);

export interface Fail2banState {
  // La prison sshd chargée, et ses adresses bannies.
  load: Jail | null;
  banned: string[];
  // Toutes les prisons actives chargées (sshd comprise), et les bannis des autres.
  jails?: Jail[];
  other?: Record<string, { banned: string[]; total: number }>;
  bannedTotal: number;
  // Lignes ajoutées à /var/log/fail2ban.log pendant la partie.
  log: string[];
  loads: number;
  // Vrai si l'on a consulté l'état de la prison depuis le dernier chargement.
  consulted: boolean;
  // Quand une adresse a été débannie (fin du bantime) : seuls ses échecs suivants comptent.
  restored?: Record<string, number>;
}

/** « 10m » → 600, « 1h » → 3600, « -1 » → -1 ; null si le format est faux. */
export function seconds(value: string): number | null {
  const v = value.trim();
  if (/^-?\d+$/.test(v)) return Number(v);
  const m = /^(\d+)\s*(s|m|h|d|w)$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2] as 's' | 'm' | 'h' | 'd' | 'w'];
}

/** L'adresse est-elle couverte par cette entrée d'ignoreip (adresse ou CIDR) ? */
export function covers(input: string, address: string): boolean {
  const [network, bits] = input.split('/');
  const count = (ip: string) => ip.split('.').reduce((n, o) => n * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(network) || !/^\d+\.\d+\.\d+\.\d+$/.test(address)) return input === address;
  const mask = bits === undefined ? 32 : Number(bits);
  const offset = 2 ** (32 - mask);
  return Math.floor(count(network) / offset) === Math.floor(count(address) / offset);
}

const files = (game: Game): string[] => {
  const inside = (directory: string, ext: string) => {
    const n = game.find(directory);
    return n?.type === 'dossier' ? Object.keys(n.children).filter((f) => f.endsWith(ext)).sort().map((f) => `${directory}/${f}`) : [];
  };
  return [`${DIRECTORY}/jail.conf`, ...inside(`${DIRECTORY}/jail.d`, '.conf'), `${DIRECTORY}/jail.local`, ...inside(`${DIRECTORY}/jail.d`, '.local')].filter((f) =>
    game.exists(f),
  );
};

// Où les prisons lisent leurs journaux (paths-debian.conf), quand le backend n'est pas systemd.
const PATHS: Record<string, string> = {
  nginx_error_log: '/var/log/nginx/*error.log',
  nginx_access_log: '/var/log/nginx/access.log',
  apache_error_log: '/var/log/apache2/*error.log',
  postfix_log: '/var/log/mail.log',
};

// Un journal existe-t-il pour ce motif (chemin, avec un joker * possible) ?
function existsLog(game: Game, pattern: string): boolean {
  const k = pattern.lastIndexOf('/');
  const directory = game.find(pattern.slice(0, k));
  const re = new RegExp(`^${pattern.slice(k + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`);
  return directory?.type === 'dossier' && Object.keys(directory.children).some((n) => re.test(n));
}

/**
 * Les prisons telles que fail2ban les chargerait, ou les erreurs (comme
 * fail2ban-client -t). prison : la prison sshd (même désactivée) ;
 * prisons : toutes celles qui sont actives.
 */
export function readConfig(game: Game): { jail: Jail | null; jails: Jail[]; errors: string[] } {
  const defaults: Record<string, string> = {};
  const byJail: Record<string, Record<string, string>> = {};
  for (const file of files(game)) {
    const sections: Record<string, Record<string, string>> = {};
    let section: string | null = null;
    const lines = (game.read(file) ?? '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/^\s*[#;].*/, '');
      if (!line.trim()) continue;
      const title = /^\[([^\]]+)\]\s*$/.exec(line.trim());
      if (title) {
        section = title[1];
        sections[section] ??= {};
        continue;
      }
      const m = /^([A-Za-z_.]+)\s*[=:]\s*(.*)$/.exec(line.trim());
      // Une ligne qui n'est ni [section] ni « clé = valeur » : le message de configparser.
      if (!m || section === null)
        return {
          jail: null,
          jails: [],
          errors: [`ERROR  Failed during configuration: Source contains parsing errors: '${file}'`, `\t[line ${String(i + 1).padStart(2)}]: '${lines[i]}\\n'`],
        };
      if (KEYS.includes(m[1].toLowerCase())) sections[section][m[1].toLowerCase()] = m[2].trim();
    }
    for (const [name, values] of Object.entries(sections)) {
      if (name === 'DEFAULT') Object.assign(defaults, values);
      else if (name !== 'INCLUDES') Object.assign((byJail[name] ??= {}), values);
    }
  }
  const errors: string[] = [];
  const read = (name: string): Jail => {
    const values = { ...defaults, ...(byJail[name] ?? {}) };
    const no = (key: string) => errors.push(`ERROR  Failed during configuration: Wrong value for '${key}' in '${name}': '${values[key]}'`);
    const time = (key: string, fallback: string) => {
      const s = seconds(values[key] ?? fallback);
      if (s === null) no(key);
      return s ?? 0;
    };
    const maxretry = Number(values.maxretry ?? '5');
    if (!Number.isInteger(maxretry) || maxretry < 1) no('maxretry');
    // banaction_allports (recidive) : l'adresse bannie perd tous les ports.
    const portsAll = /allports/.test(values.banaction ?? '');
    const ports = portsAll ? [] : readPorts(values.port ?? '0:65535');
    if (ports === null) no('port');
    const path = values.logpath?.replace(/%\((\w+)\)s/g, (all, v: string) => PATHS[v] ?? all) ?? null;
    return {
      name,
      enabled: /^(true|yes|1|on)$/i.test(values.enabled ?? 'false'),
      bantime: time('bantime', '10m'),
      findtime: time('findtime', '10m'),
      maxretry,
      ignoreip: ['127.0.0.1/8', '::1', ...(values.ignoreip ?? '').split(/[\s,]+/).filter(Boolean)],
      ports: ports ?? [],
      // sshd lit le journal de systemd ; les autres, un fichier.
      log: name === 'sshd' || !path || path.includes('%(') ? null : path,
    };
  };
  const jails = Object.keys(byJail)
    .map(read)
    .filter((p) => p.enabled);
  // Une prison active sans journal à lire : fail2ban refuse de démarrer.
  for (const p of jails) if (p.log && !existsLog(game, p.log)) errors.push(`ERROR  Failed during configuration: Have not found any log file for ${p.name} jail`);
  const jail = read('sshd');
  return errors.length ? { jail: null, jails: [], errors } : { jail, jails, errors };
}

/** Les échecs de connexion par adresse, d'après le journal de ssh. */
export function failures(game: Game): Map<string, number> {
  const account = new Map<string, number>();
  const restored = (game.state.fail2ban as Fail2banState | undefined)?.restored ?? {};
  for (const e of systemd(game)?.log ?? []) {
    if (e.unit !== 'ssh.service') continue;
    const m = /(?:Failed password|Invalid user|Failed publickey) .*?from (\d+\.\d+\.\d+\.\d+)/.exec(e.message);
    if (m && e.time > (restored[m[1]] ?? -Infinity)) account.set(m[1], (account.get(m[1]) ?? 0) + 1);
  }
  return account;
}

const timestamp = (game: Game) => {
  const ms = systemd(game)?.clock ?? 0;
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ',' + String(ms % 1000).padStart(3, '0');
};

export const note = (game: Game, f2b: Fail2banState, message: string, jail = 'sshd') =>
  f2b.log.push(`${timestamp(game)} fail2ban.actions        [701]: NOTICE  [${jail}] ${message}`);

/** Les prisons actives chargées (les anciens états n'ont que charge). */
export const actives = (f2b: Fail2banState): Jail[] => f2b.jails ?? (f2b.load?.enabled ? [f2b.load] : []);

/** Les adresses bannies par une prison. */
export function bannedFor(f2b: Fail2banState, jail: string): string[] {
  if (jail === 'sshd') return f2b.banned;
  return ((f2b.other ??= {})[jail] ??= { banned: [], total: 0 }).banned;
}

// Les filtres que le jeu connaît (filter.d/*.conf), réduits à leur motif principal.
const FILTERS: Record<string, RegExp> = {
  'nginx-limit-req': /limiting requests, excess: [\d.]+ by zone "[^"]+", client: (\d+\.\d+\.\d+\.\d+)/,
  // recidive : les bannissements des autres prisons, dans fail2ban.log.
  recidive: /fail2ban\.actions\s+\[\d+\]: NOTICE\s+\[(?!recidive\])[^\]]+\]\s+Ban (\d+\.\d+\.\d+\.\d+)/,
};

/** Les échecs par adresse vus par une prison. */
export function failuresFor(game: Game, p: Jail): Map<string, number> {
  if (p.name === 'sshd') return failures(game);
  const account = new Map<string, number>();
  const pattern = FILTERS[p.name];
  if (!pattern || !p.log) return account;
  for (const line of (game.read(p.log.replace('*', '')) ?? '').split('\n')) {
    const m = pattern.exec(line);
    if (m) account.set(m[1], (account.get(m[1]) ?? 0) + 1);
  }
  return account;
}

/**
 * Applique les prisons chargées : bannit les adresses qui ont assez d'échecs
 * (recidive en dernier). `seulement` : l'adresse qui vient d'échouer — comme
 * le vrai fail2ban, qui ne réagit qu'aux nouvelles lignes du journal.
 */
export function apply(game: Game, f2b: Fail2banState, only?: string) {
  const order = [...actives(f2b)].sort((a, b) => Number(a.name === 'recidive') - Number(b.name === 'recidive'));
  for (const p of order) {
    const banned = bannedFor(f2b, p.name);
    for (const [ip, n] of failuresFor(game, p)) {
      if (only !== undefined && ip !== only) continue;
      if (n < p.maxretry || banned.includes(ip)) continue;
      if (p.ignoreip.some((e) => covers(e, ip))) continue;
      banned.push(ip);
      if (p.name === 'sshd') f2b.bannedTotal++;
      else f2b.other![p.name].total++;
      note(game, f2b, `Ban ${ip}`, p.name);
    }
  }
}

/** Les adresses qu'une prison au moins empêche de joindre ce port. */
export const bannedOnPort = (f2b: Fail2banState, port: number): string[] =>
  [...new Set(actives(f2b).filter((p) => portBlocked(p, port)).flatMap((p) => bannedFor(f2b, p.name)))];
