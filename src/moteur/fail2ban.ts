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

import type { Jeu } from './shell';
import { systemd } from './systemd';

export const DOSSIER = '/etc/fail2ban';
const CLES = ['enabled', 'bantime.increment', 'bantime', 'findtime', 'maxretry', 'ignoreip', 'ignoreself', 'port', 'logpath', 'backend', 'banaction', 'mode', 'filter'];

export interface Prison {
  nom: string;
  enabled: boolean;
  bantime: number;
  findtime: number;
  maxretry: number;
  ignoreip: string[];
  // Les ports bloqués pour une adresse bannie (vide : tous).
  ports: number[];
  // Le fichier lu par la prison (null : le journal de systemd).
  journal: string | null;
}

const NOMS_DE_PORTS: Record<string, number> = { ssh: 22, http: 80, https: 443, ftp: 21, smtp: 25, submission: 587, imap: 143, imaps: 993 };

/** « ssh,2222 » → [22, 2222] ; « 0:65535 » → [] (tous) ; null si un nom est inconnu. */
export function lirePorts(valeur: string): number[] | null {
  const ports: number[] = [];
  for (const mot of valeur.split(/[\s,]+/).filter(Boolean)) {
    const plage = /^(\d+):(\d+)$/.exec(mot);
    if (plage) {
      if (Number(plage[1]) === 0 && Number(plage[2]) >= 65535) return [];
      for (let p = Number(plage[1]); p <= Number(plage[2]) && ports.length < 1024; p++) ports.push(p);
    } else if (/^\d+$/.test(mot)) ports.push(Number(mot));
    else if (NOMS_DE_PORTS[mot] !== undefined) ports.push(NOMS_DE_PORTS[mot]);
    else return null;
  }
  return ports;
}

/** La prison bloque-t-elle ce port pour les adresses bannies ? */
export const bloquePort = (p: Prison | null | undefined, port: number) => !p || !p.ports.length || p.ports.includes(port);

export interface EtatFail2ban {
  // La prison sshd chargée, et ses adresses bannies.
  charge: Prison | null;
  bannis: string[];
  // Toutes les prisons actives chargées (sshd comprise), et les bannis des autres.
  prisons?: Prison[];
  autres?: Record<string, { bannis: string[]; total: number }>;
  totalBannis: number;
  // Lignes ajoutées à /var/log/fail2ban.log pendant la partie.
  journal: string[];
  chargements: number;
  // Vrai si l'on a consulté l'état de la prison depuis le dernier chargement.
  consulte: boolean;
}

/** « 10m » → 600, « 1h » → 3600, « -1 » → -1 ; null si le format est faux. */
export function secondes(valeur: string): number | null {
  const v = valeur.trim();
  if (/^-?\d+$/.test(v)) return Number(v);
  const m = /^(\d+)\s*(s|m|h|d|w)$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2] as 's' | 'm' | 'h' | 'd' | 'w'];
}

/** L'adresse est-elle couverte par cette entrée d'ignoreip (adresse ou CIDR) ? */
export function couvre(entree: string, adresse: string): boolean {
  const [reseau, bits] = entree.split('/');
  const nombre = (ip: string) => ip.split('.').reduce((n, o) => n * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(reseau) || !/^\d+\.\d+\.\d+\.\d+$/.test(adresse)) return entree === adresse;
  const masque = bits === undefined ? 32 : Number(bits);
  const decalage = 2 ** (32 - masque);
  return Math.floor(nombre(reseau) / decalage) === Math.floor(nombre(adresse) / decalage);
}

const fichiers = (jeu: Jeu): string[] => {
  const dans = (dossier: string, ext: string) => {
    const n = jeu.trouver(dossier);
    return n?.type === 'dossier' ? Object.keys(n.enfants).filter((f) => f.endsWith(ext)).sort().map((f) => `${dossier}/${f}`) : [];
  };
  return [`${DOSSIER}/jail.conf`, ...dans(`${DOSSIER}/jail.d`, '.conf'), `${DOSSIER}/jail.local`, ...dans(`${DOSSIER}/jail.d`, '.local')].filter((f) =>
    jeu.existe(f),
  );
};

// Où les prisons lisent leurs journaux (paths-debian.conf), quand le backend n'est pas systemd.
const CHEMINS: Record<string, string> = {
  nginx_error_log: '/var/log/nginx/*error.log',
  nginx_access_log: '/var/log/nginx/access.log',
  apache_error_log: '/var/log/apache2/*error.log',
  postfix_log: '/var/log/mail.log',
};

// Un journal existe-t-il pour ce motif (chemin, avec un joker * possible) ?
function journalExiste(jeu: Jeu, motif: string): boolean {
  const k = motif.lastIndexOf('/');
  const dossier = jeu.trouver(motif.slice(0, k));
  const re = new RegExp(`^${motif.slice(k + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`);
  return dossier?.type === 'dossier' && Object.keys(dossier.enfants).some((n) => re.test(n));
}

/**
 * Les prisons telles que fail2ban les chargerait, ou les erreurs (comme
 * fail2ban-client -t). prison : la prison sshd (même désactivée) ;
 * prisons : toutes celles qui sont actives.
 */
export function lireConfig(jeu: Jeu): { prison: Prison | null; prisons: Prison[]; erreurs: string[] } {
  const defauts: Record<string, string> = {};
  const parPrison: Record<string, Record<string, string>> = {};
  for (const fichier of fichiers(jeu)) {
    const sections: Record<string, Record<string, string>> = {};
    let section: string | null = null;
    const lignes = (jeu.lire(fichier) ?? '').split('\n');
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i].replace(/^\s*[#;].*/, '');
      if (!ligne.trim()) continue;
      const titre = /^\[([^\]]+)\]\s*$/.exec(ligne.trim());
      if (titre) {
        section = titre[1];
        sections[section] ??= {};
        continue;
      }
      const m = /^([A-Za-z_.]+)\s*[=:]\s*(.*)$/.exec(ligne.trim());
      // Une ligne qui n'est ni [section] ni « clé = valeur » : le message de configparser.
      if (!m || section === null)
        return {
          prison: null,
          prisons: [],
          erreurs: [`ERROR  Failed during configuration: Source contains parsing errors: '${fichier}'`, `\t[line ${String(i + 1).padStart(2)}]: '${lignes[i]}\\n'`],
        };
      if (CLES.includes(m[1].toLowerCase())) sections[section][m[1].toLowerCase()] = m[2].trim();
    }
    for (const [nom, valeurs] of Object.entries(sections)) {
      if (nom === 'DEFAULT') Object.assign(defauts, valeurs);
      else if (nom !== 'INCLUDES') Object.assign((parPrison[nom] ??= {}), valeurs);
    }
  }
  const erreurs: string[] = [];
  const lire = (nom: string): Prison => {
    const valeurs = { ...defauts, ...(parPrison[nom] ?? {}) };
    const faux = (cle: string) => erreurs.push(`ERROR  Failed during configuration: Wrong value for '${cle}' in '${nom}': '${valeurs[cle]}'`);
    const temps = (cle: string, defaut: string) => {
      const s = secondes(valeurs[cle] ?? defaut);
      if (s === null) faux(cle);
      return s ?? 0;
    };
    const maxretry = Number(valeurs.maxretry ?? '5');
    if (!Number.isInteger(maxretry) || maxretry < 1) faux('maxretry');
    // banaction_allports (recidive) : l'adresse bannie perd tous les ports.
    const tousLesPorts = /allports/.test(valeurs.banaction ?? '');
    const ports = tousLesPorts ? [] : lirePorts(valeurs.port ?? '0:65535');
    if (ports === null) faux('port');
    const chemin = valeurs.logpath?.replace(/%\((\w+)\)s/g, (tout, v: string) => CHEMINS[v] ?? tout) ?? null;
    return {
      nom,
      enabled: /^(true|yes|1|on)$/i.test(valeurs.enabled ?? 'false'),
      bantime: temps('bantime', '10m'),
      findtime: temps('findtime', '10m'),
      maxretry,
      ignoreip: ['127.0.0.1/8', '::1', ...(valeurs.ignoreip ?? '').split(/[\s,]+/).filter(Boolean)],
      ports: ports ?? [],
      // sshd lit le journal de systemd ; les autres, un fichier.
      journal: nom === 'sshd' || !chemin || chemin.includes('%(') ? null : chemin,
    };
  };
  const prisons = Object.keys(parPrison)
    .map(lire)
    .filter((p) => p.enabled);
  // Une prison active sans journal à lire : fail2ban refuse de démarrer.
  for (const p of prisons) if (p.journal && !journalExiste(jeu, p.journal)) erreurs.push(`ERROR  Failed during configuration: Have not found any log file for ${p.nom} jail`);
  const prison = lire('sshd');
  return erreurs.length ? { prison: null, prisons: [], erreurs } : { prison, prisons, erreurs };
}

/** Les échecs de connexion par adresse, d'après le journal de ssh. */
export function echecs(jeu: Jeu): Map<string, number> {
  const compte = new Map<string, number>();
  for (const e of systemd(jeu)?.journal ?? []) {
    if (e.unite !== 'ssh.service') continue;
    const m = /(?:Failed password|Invalid user|Failed publickey) .*?from (\d+\.\d+\.\d+\.\d+)/.exec(e.message);
    if (m) compte.set(m[1], (compte.get(m[1]) ?? 0) + 1);
  }
  return compte;
}

const horodatage = (jeu: Jeu) => {
  const ms = systemd(jeu)?.horloge ?? 0;
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ',' + String(ms % 1000).padStart(3, '0');
};

export const noter = (jeu: Jeu, f2b: EtatFail2ban, message: string, prison = 'sshd') =>
  f2b.journal.push(`${horodatage(jeu)} fail2ban.actions        [701]: NOTICE  [${prison}] ${message}`);

/** Les prisons actives chargées (les anciens états n'ont que charge). */
export const actives = (f2b: EtatFail2ban): Prison[] => f2b.prisons ?? (f2b.charge?.enabled ? [f2b.charge] : []);

/** Les adresses bannies par une prison. */
export function bannisDe(f2b: EtatFail2ban, prison: string): string[] {
  if (prison === 'sshd') return f2b.bannis;
  return ((f2b.autres ??= {})[prison] ??= { bannis: [], total: 0 }).bannis;
}

// Les filtres que le jeu connaît (filter.d/*.conf), réduits à leur motif principal.
const FILTRES: Record<string, RegExp> = {
  'nginx-limit-req': /limiting requests, excess: [\d.]+ by zone "[^"]+", client: (\d+\.\d+\.\d+\.\d+)/,
  // recidive : les bannissements des autres prisons, dans fail2ban.log.
  recidive: /fail2ban\.actions\s+\[\d+\]: NOTICE\s+\[(?!recidive\])[^\]]+\]\s+Ban (\d+\.\d+\.\d+\.\d+)/,
};

/** Les échecs par adresse vus par une prison. */
export function echecsDe(jeu: Jeu, p: Prison): Map<string, number> {
  if (p.nom === 'sshd') return echecs(jeu);
  const compte = new Map<string, number>();
  const motif = FILTRES[p.nom];
  if (!motif || !p.journal) return compte;
  for (const ligne of (jeu.lire(p.journal.replace('*', '')) ?? '').split('\n')) {
    const m = motif.exec(ligne);
    if (m) compte.set(m[1], (compte.get(m[1]) ?? 0) + 1);
  }
  return compte;
}

/** Applique les prisons chargées : bannit les adresses qui ont assez d'échecs (recidive en dernier). */
export function appliquer(jeu: Jeu, f2b: EtatFail2ban) {
  const ordre = [...actives(f2b)].sort((a, b) => Number(a.nom === 'recidive') - Number(b.nom === 'recidive'));
  for (const p of ordre) {
    const bannis = bannisDe(f2b, p.nom);
    for (const [ip, n] of echecsDe(jeu, p)) {
      if (n < p.maxretry || bannis.includes(ip)) continue;
      if (p.ignoreip.some((e) => couvre(e, ip))) continue;
      bannis.push(ip);
      if (p.nom === 'sshd') f2b.totalBannis++;
      else f2b.autres![p.nom].total++;
      noter(jeu, f2b, `Ban ${ip}`, p.nom);
    }
  }
}

/** Les adresses qu'une prison au moins empêche de joindre ce port. */
export const bannisPour = (f2b: EtatFail2ban, port: number): string[] =>
  [...new Set(actives(f2b).filter((p) => bloquePort(p, port)).flatMap((p) => bannisDe(f2b, p.nom)))];
