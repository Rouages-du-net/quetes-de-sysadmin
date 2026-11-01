// fail2ban on a machine: the configuration read like fail2ban does
// (https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html):
//   - files read in the order jail.conf, jail.d/*.conf, jail.local,
//     jail.d/*.local: a value read later REPLACES the earlier one;
//   - a jail's section wins over [DEFAULT], whatever the file: a port set
//     in jail.local's [DEFAULT] doesn't replace the "port = ssh" of
//     jail.conf's [sshd];
//   - every [name] section is a jail; when enabled (enabled = true), it
//     needs its log, otherwise fail2ban doesn't start;
//   - durations: 600, 10m, 1h, 1d, 1w; -1 = forever.
// Failures come from the ssh service's journal (sshd), from nginx's error.log
// (nginx-limit-req) or from fail2ban.log (recidive: the bans of the other
// jails); an address is banned
// when it reaches maxretry failures, unless ignoreip covers it. Bans
// survive a reload (as with fail2ban's database): only unbanip lifts them.
// The action blocks the jail's ports (port = ssh, 2222, http,https,
// 1000:2000): a banned address can still reach the other ports.
// Differences: filters known for sshd, nginx-limit-req and recidive only
// (the other jails load without banning anything), findtime not applied (all
// the failures in the log count), filter reduced to "Failed password",
// "Invalid user" and "Failed publickey".

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
  // The ports blocked for a banned address (empty: all).
  ports: number[];
  // The file read by the jail (null: systemd's journal).
  log: string | null;
}

const PORTS_NAMES: Record<string, number> = { ssh: 22, http: 80, https: 443, ftp: 21, smtp: 25, submission: 587, imap: 143, imaps: 993 };

/** "ssh,2222" → [22, 2222]; "0:65535" → [] (all); null if a name is unknown. */
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

/** Does the jail block this port for banned addresses? */
export const portBlocked = (p: Jail | null | undefined, port: number) => !p || !p.ports.length || p.ports.includes(port);

export interface Fail2banState {
  // The loaded sshd jail, and its banned addresses.
  load: Jail | null;
  banned: string[];
  // All the loaded active jails (sshd included), and the others' banned addresses.
  jails?: Jail[];
  other?: Record<string, { banned: string[]; total: number }>;
  bannedTotal: number;
  // Lines added to /var/log/fail2ban.log during the game.
  log: string[];
  loads: number;
  // True if the jail's status was looked at since the last load.
  consulted: boolean;
  // When an address was unbanned (end of bantime): only its later failures count.
  restored?: Record<string, number>;
}

/** "10m" → 600, "1h" → 3600, "-1" → -1; null if the format is wrong. */
export function seconds(value: string): number | null {
  const v = value.trim();
  if (/^-?\d+$/.test(v)) return Number(v);
  const m = /^(\d+)\s*(s|m|h|d|w)$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2] as 's' | 'm' | 'h' | 'd' | 'w'];
}

/** Is the address covered by this ignoreip entry (address or CIDR)? */
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
    return n?.type === 'directory' ? Object.keys(n.children).filter((f) => f.endsWith(ext)).sort().map((f) => `${directory}/${f}`) : [];
  };
  return [`${DIRECTORY}/jail.conf`, ...inside(`${DIRECTORY}/jail.d`, '.conf'), `${DIRECTORY}/jail.local`, ...inside(`${DIRECTORY}/jail.d`, '.local')].filter((f) =>
    game.exists(f),
  );
};

// Where the jails read their logs (paths-debian.conf), when the backend isn't systemd.
const PATHS: Record<string, string> = {
  nginx_error_log: '/var/log/nginx/*error.log',
  nginx_access_log: '/var/log/nginx/access.log',
  apache_error_log: '/var/log/apache2/*error.log',
  postfix_log: '/var/log/mail.log',
};

// Does a log exist for this pattern (a path, possibly with a * wildcard)?
function existsLog(game: Game, pattern: string): boolean {
  const k = pattern.lastIndexOf('/');
  const directory = game.find(pattern.slice(0, k));
  const re = new RegExp(`^${pattern.slice(k + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`);
  return directory?.type === 'directory' && Object.keys(directory.children).some((n) => re.test(n));
}

/**
 * The jails as fail2ban would load them, or the errors (like
 * fail2ban-client -t). jail: the sshd jail (even disabled);
 * jails: all the active ones.
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
      // A line that is neither [section] nor "key = value": configparser's message.
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
    // banaction_allports (recidive): the banned address loses every port.
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
      // sshd reads systemd's journal; the others, a file.
      log: name === 'sshd' || !path || path.includes('%(') ? null : path,
    };
  };
  const jails = Object.keys(byJail)
    .map(read)
    .filter((p) => p.enabled);
  // An active jail with no log to read: fail2ban refuses to start.
  for (const p of jails) if (p.log && !existsLog(game, p.log)) errors.push(`ERROR  Failed during configuration: Have not found any log file for ${p.name} jail`);
  const jail = read('sshd');
  return errors.length ? { jail: null, jails: [], errors } : { jail, jails, errors };
}

/** Connection failures by address, from ssh's log. */
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

/** The loaded active jails (old states only have load). */
export const actives = (f2b: Fail2banState): Jail[] => f2b.jails ?? (f2b.load?.enabled ? [f2b.load] : []);

/** The addresses banned by a jail. */
export function bannedFor(f2b: Fail2banState, jail: string): string[] {
  if (jail === 'sshd') return f2b.banned;
  return ((f2b.other ??= {})[jail] ??= { banned: [], total: 0 }).banned;
}

// The filters the game knows (filter.d/*.conf), reduced to their main pattern.
const FILTERS: Record<string, RegExp> = {
  'nginx-limit-req': /limiting requests, excess: [\d.]+ by zone "[^"]+", client: (\d+\.\d+\.\d+\.\d+)/,
  // recidive: the bans of the other jails, in fail2ban.log.
  recidive: /fail2ban\.actions\s+\[\d+\]: NOTICE\s+\[(?!recidive\])[^\]]+\]\s+Ban (\d+\.\d+\.\d+\.\d+)/,
};

/** The failures by address seen by a jail. */
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
 * Applies the loaded jails: bans the addresses that have enough failures
 * (recidive last). `only`: the address that just failed, like the real
 * fail2ban, which only reacts to new lines in the log.
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

/** The addresses that at least one jail prevents from reaching this port. */
export const bannedOnPort = (f2b: Fail2banState, port: number): string[] =>
  [...new Set(actives(f2b).filter((p) => portBlocked(p, port)).flatMap((p) => bannedFor(f2b, p.name)))];
