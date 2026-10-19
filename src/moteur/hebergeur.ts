// Un hébergement mutualisé, sur internet : un serveur FTP (Pure-FTPd, comme
// sur cPanel) qui n'accepte plus que les connexions chiffrées (FTPS
// explicite : AUTH TLS sur le port 21), avec un certificat au nom de
// l'hébergeur (*.hebergeur.example), un compte, et son dossier (public_html :
// le site publié). lftp s'y connecte (commandes/lftp.ts).
// L'état d'un hébergement vit sur le poste (etat.hebergements), créé à la
// première connexion depuis sa définition, que déclare l'histoire qui s'en
// sert (HEBERGEMENTS).
// Sources : https://lftp.yar.ru/lftp-man.html, https://www.pureftpd.org/project/pure-ftpd/doc/,
// https://www.rfc-editor.org/rfc/rfc4217 (FTP sur TLS)

import type { Dossier, Noeud } from './monde';
import type { Jeu } from './shell';
import type { Traduire } from '../textes';

export interface DefHebergement {
  // Les noms qui mènent au serveur (le nom de l'hébergeur, et ceux des clients qui pointent dessus).
  noms: string[];
  adresse: string;
  // Les noms couverts par son certificat (*.hebergeur.example).
  certificat: string[];
  comptes: Record<string, string>;
  // Le dossier de chaque compte, au départ.
  fichiers: (t: Traduire) => Record<string, Dossier>;
}

export interface Hebergement {
  def: string;
  racines: Record<string, Dossier>;
  // Chaque connexion réussie : le compte, chiffrée ou non, le certificat vérifié ou non.
  journal: { compte: string; tls: boolean; verifie: boolean; envoi: boolean }[];
}

/** Les hébergements que déclarent les histoires (par nom de serveur). */
export const HEBERGEMENTS: Record<string, DefHebergement> = {};

export const definition = (nom: string): [string, DefHebergement] | null => {
  const n = nom.toLowerCase();
  const e = Object.entries(HEBERGEMENTS).find(([, d]) => d.noms.includes(n) || d.adresse === n);
  return e ?? null;
};

/** L'état de l'hébergement (créé à la première connexion). */
export function hebergement(j: Jeu, cle: string): Hebergement {
  const tous = (j.etat.hebergements ??= {}) as Record<string, Hebergement>;
  return (tous[cle] ??= { def: cle, racines: HEBERGEMENTS[cle].fichiers(j.t), journal: [] });
}

/** Un certificat couvre-t-il ce nom ? (* : un seul niveau) */
export const couvre = (certificat: string[], nom: string) =>
  certificat.some((c) => (c.startsWith('*.') ? nom.endsWith(c.slice(1)) && !nom.slice(0, -c.length + 1).includes('.') : c === nom));

// ——— Les chemins du dossier distant ———

export const normaliser = (cwd: string, chemin: string) => {
  const parties = (chemin.startsWith('/') ? chemin : `${cwd}/${chemin}`).split('/');
  const res: string[] = [];
  for (const p of parties) {
    if (!p || p === '.' || p === '~') continue;
    if (p === '..') res.pop();
    else res.push(p);
  }
  return '/' + res.join('/');
};

export function noeud(racine: Dossier, chemin: string): Noeud | null {
  let n: Noeud = racine;
  for (const p of chemin.split('/').filter(Boolean)) {
    if (n.type !== 'dossier') return null;
    const e: Noeud | undefined = n.enfants[p];
    if (!e) return null;
    n = e;
  }
  return n;
}

/** Tous les fichiers d'un dossier distant, par chemin relatif, avec leur contenu. */
export function fichiersDe(racine: Dossier, chemin: string): Record<string, string> | null {
  const n = noeud(racine, chemin);
  if (n?.type !== 'dossier') return null;
  const res: Record<string, string> = {};
  const parcourir = (d: Noeud, rel: string) => {
    if (d.type === 'dossier') for (const [k, e] of Object.entries(d.enfants)) parcourir(e, rel ? `${rel}/${k}` : k);
    else res[rel] = typeof d.contenu === 'string' ? d.contenu : '';
  };
  parcourir(n, '');
  return res;
}
