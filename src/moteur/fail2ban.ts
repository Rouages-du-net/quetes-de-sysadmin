// fail2ban sur une machine : lecture de la configuration comme fail2ban
// (https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html) :
//   - fichiers lus dans l'ordre jail.conf, jail.d/*.conf, jail.local,
//     jail.d/*.local : une valeur lue plus tard REMPLACE la précédente ;
//   - [sshd] l'emporte sur [DEFAULT], quel que soit le fichier : un port mis
//     dans le [DEFAULT] de jail.local ne remplace pas le « port = ssh » du
//     [sshd] de jail.conf ;
//   - durées : 600, 10m, 1h, 1d, 1w ; -1 = pour toujours.
// Les échecs viennent du journal du service ssh ; une adresse est bannie
// quand elle atteint maxretry échecs, sauf si ignoreip la couvre. Les
// bannissements survivent à un rechargement (comme avec la base de données
// de fail2ban) : seul unbanip les lève.
// L'action bloque les ports de la prison (port = ssh, 2222, http,https,
// 1000:2000) : une adresse bannie peut encore joindre les autres ports.
// Écarts : une seule prison (sshd), findtime non appliqué (tous les échecs
// du journal comptent), filtre réduit à « Failed password », « Invalid user »
// et « Failed publickey ».

import type { Jeu } from './shell';
import { systemd } from './systemd';

export const DOSSIER = '/etc/fail2ban';
const CLES = ['enabled', 'bantime', 'findtime', 'maxretry', 'ignoreip', 'ignoreself', 'port', 'logpath', 'backend', 'banaction', 'mode', 'filter'];

export interface Prison {
  enabled: boolean;
  bantime: number;
  findtime: number;
  maxretry: number;
  ignoreip: string[];
  // Les ports bloqués pour une adresse bannie (vide : tous).
  ports: number[];
}

const NOMS_DE_PORTS: Record<string, number> = { ssh: 22, http: 80, https: 443, ftp: 21, smtp: 25, imap: 143, imaps: 993 };

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
  charge: Prison | null;
  bannis: string[];
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

/** La prison sshd telle que fail2ban la chargerait, ou les erreurs (comme fail2ban-client -t). */
export function lireConfig(jeu: Jeu): { prison: Prison | null; erreurs: string[] } {
  const defauts: Record<string, string> = {};
  const sshd: Record<string, string> = {};
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
      const m = /^([A-Za-z_]+)\s*[=:]\s*(.*)$/.exec(ligne.trim());
      // Une ligne qui n'est ni [section] ni « clé = valeur » : le message de configparser.
      if (!m || section === null)
        return {
          prison: null,
          erreurs: [`ERROR  Failed during configuration: Source contains parsing errors: '${fichier}'`, `\t[line ${String(i + 1).padStart(2)}]: '${lignes[i]}\\n'`],
        };
      if (CLES.includes(m[1].toLowerCase())) sections[section][m[1].toLowerCase()] = m[2].trim();
    }
    Object.assign(defauts, sections.DEFAULT ?? {});
    Object.assign(sshd, sections.sshd ?? {});
  }
  const valeurs = { ...defauts, ...sshd };
  const erreurs: string[] = [];
  const temps = (cle: string, defaut: string) => {
    const s = secondes(valeurs[cle] ?? defaut);
    if (s === null) erreurs.push(`ERROR  Failed during configuration: Wrong value for '${cle}' in 'sshd': '${valeurs[cle]}'`);
    return s ?? 0;
  };
  const maxretry = Number(valeurs.maxretry ?? '5');
  if (!Number.isInteger(maxretry) || maxretry < 1) erreurs.push(`ERROR  Failed during configuration: Wrong value for 'maxretry' in 'sshd': '${valeurs.maxretry}'`);
  const ports = lirePorts(valeurs.port ?? '0:65535');
  if (ports === null) erreurs.push(`ERROR  Failed during configuration: Wrong value for 'port' in 'sshd': '${valeurs.port}'`);
  const prison: Prison = {
    enabled: /^(true|yes|1|on)$/i.test(valeurs.enabled ?? 'false'),
    bantime: temps('bantime', '10m'),
    findtime: temps('findtime', '10m'),
    maxretry,
    ignoreip: ['127.0.0.1/8', '::1', ...(valeurs.ignoreip ?? '').split(/[\s,]+/).filter(Boolean)],
    ports: ports ?? [],
  };
  return erreurs.length ? { prison: null, erreurs } : { prison, erreurs };
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

export const noter = (jeu: Jeu, f2b: EtatFail2ban, message: string) =>
  f2b.journal.push(`${horodatage(jeu)} fail2ban.actions        [701]: NOTICE  [sshd] ${message}`);

/** Applique la prison chargée : bannit les adresses qui ont assez d'échecs. */
export function appliquer(jeu: Jeu, f2b: EtatFail2ban) {
  const p = f2b.charge;
  if (!p?.enabled) return;
  for (const [ip, n] of echecs(jeu)) {
    if (n < p.maxretry || f2b.bannis.includes(ip)) continue;
    if (p.ignoreip.some((e) => couvre(e, ip))) continue;
    f2b.bannis.push(ip);
    f2b.totalBannis++;
    noter(jeu, f2b, `Ban ${ip}`);
  }
}
