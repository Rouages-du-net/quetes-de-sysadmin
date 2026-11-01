// Un hébergement mutualisé, sur internet : un serveur FTP (Pure-FTPd, comme
// sur cPanel) qui n'accepte plus que les connexions chiffrées (FTPS
// explicite : AUTH TLS sur le port 21), avec un certificat au nom de
// l'hébergeur (*.hosting.example), un compte, et son dossier (public_html :
// le site publié). lftp s'y connecte (commands/lftp.ts).
// L'état d'un hébergement vit sur le poste (etat.hebergements), créé à la
// première connexion depuis sa définition, que déclare l'histoire qui s'en
// sert (HEBERGEMENTS).
// Sources : https://lftp.yar.ru/lftp-man.html, https://www.pureftpd.org/project/pure-ftpd/doc/,
// https://www.rfc-editor.org/rfc/rfc4217 (FTP sur TLS)

import type { Directory, Node } from './world';
import type { Game } from './shell';
import type { Translate } from '../texts';

export interface HostingDef {
  // Les noms qui mènent au serveur (le nom de l'hébergeur, et ceux des clients qui pointent dessus).
  names: string[];
  address: string;
  // Les noms couverts par son certificat (*.hosting.example).
  certificate: string[];
  accounts: Record<string, string>;
  // Le dossier de chaque compte, au départ.
  files: (t: Translate) => Record<string, Directory>;
}

export interface Hosting {
  def: string;
  roots: Record<string, Directory>;
  // Chaque connexion réussie : le compte, chiffrée ou non, le certificat vérifié ou non.
  log: { account: string; tls: boolean; checked: boolean; send: boolean }[];
}

/** Les hébergements que déclarent les histoires (par nom de serveur). */
export const HOSTINGS: Record<string, HostingDef> = {};

export const definition = (name: string): [string, HostingDef] | null => {
  const n = name.toLowerCase();
  const e = Object.entries(HOSTINGS).find(([, d]) => d.names.includes(n) || d.address === n);
  return e ?? null;
};

/** L'état de l'hébergement (créé à la première connexion). */
export function hosting(j: Game, key: string): Hosting {
  const all = (j.state.hostings ??= {}) as Record<string, Hosting>;
  return (all[key] ??= { def: key, roots: HOSTINGS[key].files(j.t), log: [] });
}

/** Un certificat couvre-t-il ce nom ? (* : un seul niveau) */
export const covers = (certificate: string[], name: string) =>
  certificate.some((c) => (c.startsWith('*.') ? name.endsWith(c.slice(1)) && !name.slice(0, -c.length + 1).includes('.') : c === name));

// ——— Les chemins du dossier distant ———

export const normalise = (cwd: string, path: string) => {
  const parts = (path.startsWith('/') ? path : `${cwd}/${path}`).split('/');
  const res: string[] = [];
  for (const p of parts) {
    if (!p || p === '.' || p === '~') continue;
    if (p === '..') res.pop();
    else res.push(p);
  }
  return '/' + res.join('/');
};

export function node(root: Directory, path: string): Node | null {
  let n: Node = root;
  for (const p of path.split('/').filter(Boolean)) {
    if (n.type !== 'dossier') return null;
    const e: Node | undefined = n.children[p];
    if (!e) return null;
    n = e;
  }
  return n;
}

/** Tous les fichiers d'un dossier distant, par chemin relatif, avec leur contenu. */
export function filesFor(root: Directory, path: string): Record<string, string> | null {
  const n = node(root, path);
  if (n?.type !== 'dossier') return null;
  const res: Record<string, string> = {};
  const walk = (d: Node, rel: string) => {
    if (d.type === 'dossier') for (const [k, e] of Object.entries(d.children)) walk(e, rel ? `${rel}/${k}` : k);
    else res[rel] = typeof d.content === 'string' ? d.content : '';
  };
  walk(n, '');
  return res;
}
