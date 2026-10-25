// Docker simulé : images, conteneurs, volumes, ports publiés. D'après la
// documentation de Docker (https://docs.docker.com/reference/cli/docker/,
// https://docs.docker.com/engine/storage/volumes/) : un conteneur écrit dans
// sa propre couche, qui disparaît avec lui (docker rm) ; un volume ou un
// dossier monté (bind mount) survit au conteneur ; un port publié (-p) relie
// un port de la machine à celui du conteneur.
//
//   etat.docker = { images, registre, conteneurs, volumes, prochain }
//
// Les applications des images sont simulées (APPLIS) : elles écrivent leur
// journal, lisent et écrivent leurs fichiers, et répondent en HTTP.
// Écarts : pas de vraie couche d'image (les fichiers de l'appli sont
// décrits par elle), pas de réseau entre conteneurs dans ce fichier
// (voir docker compose), une seule plateforme.

import type { Noeud } from './monde';
import type { Jeu } from './shell';
import { journaliser, systemd, versUtc } from './systemd';

export interface Image {
  depot: string;
  tag: string;
  id: string;
  taille: number;
  cree: number;
  // L'application qu'elle contient (APPLIS), et son port.
  appli: string;
  port: number;
  commande: string;
  // USER de l'image (vide : root), et les comptes de son /etc/passwd (nom → uid,
  // le groupe principal porte le même numéro).
  utilisateur?: string;
  comptes?: Record<string, number>;
}

export interface Montage {
  type: 'volume' | 'bind';
  source: string;
  cible: string;
  lectureSeule: boolean;
}

export interface Port {
  ip: string;
  hote: number;
  conteneur: number;
}

export interface Conteneur {
  id: string;
  nom: string;
  image: string;
  etat: 'created' | 'running' | 'exited';
  code: number;
  ports: Port[];
  montages: Montage[];
  env: Record<string, string>;
  redemarrage: string;
  cree: number;
  debut: number;
  fin: number;
  // La couche du conteneur : les fichiers qu'il a écrits (chemin → contenu).
  couche: Record<string, string>;
  journal: { temps: number; texte: string }[];
  ip: string;
  // Arrêté à la main (docker stop) : unless-stopped ne le relance pas.
  arreteALaMain?: boolean;
  // --user (vide : celui de l'image), --read-only, --cap-drop, --security-opt.
  utilisateur?: string;
  lectureSeule?: boolean;
  capDrop?: string[];
  securite?: string[];
}

export interface EtatDocker {
  images: Record<string, Image>;
  registre: Record<string, Image>;
  conteneurs: Conteneur[];
  // taille : ce que le volume occupe en plus de ses fichiers simulés (une vraie base, par exemple).
  volumes: Record<string, { cree: number; donnees: Record<string, string>; taille?: number }>;
  prochain: number;
}

export const docker = (jeu: Jeu): EtatDocker | undefined => jeu.etat.docker;
export const horloge = (jeu: Jeu) => systemd(jeu)?.horloge ?? 0;

/** Un identifiant de 64 caractères hexadécimaux, toujours le même pour une graine. */
export function identifiant(graine: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < graine.length; i++) h = Math.imul(h ^ graine.charCodeAt(i), 0x01000193) >>> 0;
  let s = '';
  while (s.length < 64) {
    h = Math.imul(h ^ s.length, 0x01000193) >>> 0;
    s += (h >>> 4).toString(16).padStart(7, '0');
  }
  return s.slice(0, 64);
}

export const nomImage = (i: Image) => `${i.depot}:${i.tag}`;
/** « registry.example/outiltheque » → « registry.example/outiltheque:latest ». */
export const complet = (nom: string) => (/:[^/]+$/.test(nom) ? nom : `${nom}:latest`);

/** Un conteneur par son nom ou le début de son identifiant. */
export function trouverConteneur(d: EtatDocker, cle: string): Conteneur | null {
  return d.conteneurs.find((c) => c.nom === cle) ?? d.conteneurs.find((c) => cle.length >= 3 && c.id.startsWith(cle)) ?? null;
}

// ——— L'utilisateur d'un conteneur ———
// Sans --user ni USER dans l'image, le processus tourne en root (uid 0). Sans
// espace de noms utilisateur (userns-remap, désactivé par défaut), l'uid du
// conteneur est le MÊME uid sur la machine : root dedans, c'est root sur les
// fichiers montés ; l'uid 1000 dedans, c'est le compte 1000 de la machine.
// https://docs.docker.com/reference/cli/docker/container/run/#user,
// https://docs.docker.com/engine/security/userns-remap/

export interface Identite {
  uid: number;
  gid: number;
  // Les noms dans le /etc/passwd de l'image (null : inconnus).
  nom: string | null;
  groupe: string | null;
}

export const imageDu = (jeu: Jeu, c: Conteneur): Image | undefined => Object.values(docker(jeu)!.images).find((i) => nomImage(i) === c.image);

/** Les comptes du /etc/passwd d'une image (ceux de son appli, et root). */
export const comptesImage = (image: Image | undefined): Record<string, number> => ({
  root: 0,
  ...(image ? (APPLIS[image.appli]?.comptes ?? {}) : {}),
  ...(image?.comptes ?? {}),
});
/** L'utilisateur par défaut d'une image (USER du Dockerfile ; root s'il n'y en a pas). */
export const utilisateurImage = (image: Image | undefined) => image?.utilisateur || (image && APPLIS[image.appli]?.utilisateur) || 'root';

/** L'identité du processus : --user, sinon USER de l'image, sinon root ; ou l'erreur de runc. */
export function identite(image: Image | undefined, c: Conteneur, demande?: string): Identite | { erreur: string } {
  const comptes = comptesImage(image);
  const nomDe = (n: number) => Object.entries(comptes).find(([, x]) => x === n)?.[0] ?? null;
  const [u, g] = (demande || c.utilisateur || utilisateurImage(image)).split(':');
  let uid: number;
  if (/^\d+$/.test(u)) uid = Number(u);
  else if (u in comptes) uid = comptes[u];
  else return { erreur: `unable to find user ${u}: no matching entries in passwd file` };
  // Sans groupe : celui du compte dans l'image ; un uid inconnu de l'image prend le groupe 0.
  let gid = nomDe(uid) === null ? 0 : uid;
  if (g !== undefined) {
    if (/^\d+$/.test(g)) gid = Number(g);
    else if (g in comptes) gid = comptes[g];
    else return { erreur: `unable to find group ${g}: no matching entries in group file` };
  }
  return { uid, gid, nom: nomDe(uid), groupe: nomDe(gid) };
}

/** Le nom, sur la machine, du compte qui porte cet uid (sinon le numéro). */
export const compteMachine = (jeu: Jeu, uid: number) => Object.entries(jeu.comptes.utilisateurs).find(([, u]) => u.uid === uid)?.[0] ?? String(uid);
export const groupeMachine = (jeu: Jeu, gid: number) => Object.entries(jeu.comptes.groupes).find(([, g]) => g.gid === gid)?.[0] ?? String(gid);

/** Les droits d'un uid et d'un gid sur un fichier de la machine (comme le noyau : par numéro). */
export function accesNumerique(jeu: Jeu, n: Noeud, droit: 'r' | 'w' | 'x', uid: number, gid: number): boolean {
  if (uid === 0) return true;
  const mode = n.mode ?? (n.type === 'dossier' ? 'rwxr-xr-x' : 'rw-r--r--');
  const proprio = n.proprio ?? jeu.joueur;
  const groupe = n.groupe ?? proprio;
  const numUid = jeu.comptes.utilisateurs[proprio]?.uid ?? (/^\d+$/.test(proprio) ? Number(proprio) : -1);
  const numGid = jeu.comptes.groupes[groupe]?.gid ?? (/^\d+$/.test(groupe) ? Number(groupe) : -1);
  const triplet = numUid === uid ? mode.slice(0, 3) : numGid === gid ? mode.slice(3, 6) : mode.slice(6, 9);
  return triplet.includes(droit);
}

// L'identité d'un conteneur qui tourne (root si elle n'a pas pu être lue).
function qui(jeu: Jeu, c: Conteneur): Identite {
  const id = identite(imageDu(jeu, c), c);
  return 'erreur' in id ? { uid: 0, gid: 0, nom: 'root', groupe: 'root' } : id;
}

// ——— Fichiers d'un conteneur ———

// Le montage qui contient ce chemin (le plus long), et le chemin relatif.
function montage(c: Conteneur, chemin: string): { m: Montage; relatif: string } | null {
  const m = c.montages
    .filter((x) => chemin === x.cible || chemin.startsWith(x.cible.replace(/\/$/, '') + '/'))
    .sort((a, b) => b.cible.length - a.cible.length)[0];
  return m ? { m, relatif: chemin.slice(m.cible.replace(/\/$/, '').length).replace(/^\//, '') } : null;
}

/** Lit un fichier vu depuis le conteneur : volume, dossier monté, ou sa couche. */
export function lireDans(jeu: Jeu, c: Conteneur, chemin: string): string | null {
  const d = docker(jeu)!;
  const trouve = montage(c, chemin);
  if (trouve?.m.type === 'volume') return d.volumes[trouve.m.source]?.donnees[trouve.relatif] ?? null;
  if (trouve?.m.type === 'bind') return jeu.lire(`${trouve.m.source.replace(/\/$/, '')}/${trouve.relatif}`);
  return c.couche[chemin] ?? null;
}

/**
 * Écrit un fichier vu depuis le conteneur ; renvoie une erreur si le montage
 * est en lecture seule, ou si l'utilisateur du conteneur n'a pas le droit
 * d'écrire dans le dossier monté (il est soumis aux droits de la machine).
 */
export function ecrireDans(jeu: Jeu, c: Conteneur, chemin: string, contenu: string): string | null {
  const d = docker(jeu)!;
  const trouve = montage(c, chemin);
  if (trouve?.m.lectureSeule || (!trouve && c.lectureSeule)) return 'read-only file system';
  if (trouve?.m.type === 'volume') (d.volumes[trouve.m.source] ??= { cree: horloge(jeu), donnees: {} }).donnees[trouve.relatif] = contenu;
  else if (trouve?.m.type === 'bind') {
    const id = qui(jeu, c);
    const lieu = `${trouve.m.source.replace(/\/$/, '')}/${trouve.relatif}`;
    const n = jeu.trouver(lieu);
    if (n?.type === 'fichier') {
      if (!accesNumerique(jeu, n, 'w', id.uid, id.gid)) return 'permission denied';
      n.contenu = contenu;
    } else {
      const parent = jeu.trouver(lieu.replace(/\/[^/]+$/, ''));
      if (parent?.type !== 'dossier') return 'no such file or directory';
      if (!accesNumerique(jeu, parent, 'w', id.uid, id.gid) || !accesNumerique(jeu, parent, 'x', id.uid, id.gid)) return 'permission denied';
      // Le fichier créé appartient, sur la machine, à l'uid du conteneur.
      parent.enfants[lieu.split('/').at(-1)!] = {
        type: 'fichier',
        contenu,
        lignes: true,
        proprio: compteMachine(jeu, id.uid),
        groupe: groupeMachine(jeu, id.gid),
      };
    }
  } else c.couche[chemin] = contenu;
  return null;
}

/** Crée un dossier vu depuis le conteneur (mkdir) ; mêmes règles qu'ecrireDans. */
export function creerDossierDans(jeu: Jeu, c: Conteneur, chemin: string): string | null {
  const trouve = montage(c, chemin);
  if (trouve?.m.type !== 'bind') return null;
  const lieu = `${trouve.m.source.replace(/\/$/, '')}/${trouve.relatif}`;
  if (jeu.trouver(lieu)?.type === 'dossier') return null;
  if (trouve.m.lectureSeule) return 'read-only file system';
  const parent = jeu.trouver(lieu.replace(/\/[^/]+$/, ''));
  const id = qui(jeu, c);
  if (parent?.type !== 'dossier') return 'no such file or directory';
  if (!accesNumerique(jeu, parent, 'w', id.uid, id.gid)) return 'permission denied';
  parent.enfants[lieu.split('/').at(-1)!] = { type: 'dossier', enfants: {}, proprio: compteMachine(jeu, id.uid), groupe: groupeMachine(jeu, id.gid) };
  return null;
}

/** Le fichier de la machine derrière un chemin du conteneur (dossier monté), s'il y en a un. */
export function noeudDans(jeu: Jeu, c: Conteneur, chemin: string): Noeud | null {
  const trouve = montage(c, chemin);
  if (trouve?.m.type !== 'bind') return null;
  return jeu.trouver(`${trouve.m.source.replace(/\/$/, '')}/${trouve.relatif}`.replace(/\/$/, '')) ?? null;
}

/** L'utilisateur du conteneur peut-il faire cela sur ce chemin (dossier monté) ? */
export function peutDans(jeu: Jeu, c: Conteneur, chemin: string, droit: 'r' | 'w' | 'x'): boolean {
  const n = noeudDans(jeu, c, chemin);
  const id = qui(jeu, c);
  return !n || accesNumerique(jeu, n, droit, id.uid, id.gid);
}

/** Les fichiers visibles sous un lieu du conteneur (chemins absolus). */
export function listerDans(jeu: Jeu, c: Conteneur, lieu: string): string[] {
  const d = docker(jeu)!;
  const base = lieu.replace(/\/$/, '');
  const trouve = montage(c, base);
  if (trouve?.m.type === 'volume')
    return Object.keys(d.volumes[trouve.m.source]?.donnees ?? {}).map((r) => `${trouve.m.cible.replace(/\/$/, '')}/${r}`);
  if (trouve?.m.type === 'bind') {
    const n = jeu.trouver(trouve.m.source);
    return n?.type === 'dossier' ? Object.keys(n.enfants).map((k) => `${trouve.m.cible.replace(/\/$/, '')}/${k}`) : [];
  }
  return Object.keys(c.couche).filter((p) => p.startsWith(base + '/'));
}

// ——— Les applications ———

export interface Appli {
  // Au démarrage : écrit son journal, prépare ses fichiers ; renvoie le code
  // de sortie si elle s'arrête aussitôt (sinon null : elle tourne).
  demarrer(jeu: Jeu, c: Conteneur, image: Image): number | null;
  // Une requête HTTP sur son port.
  repondre(jeu: Jeu, c: Conteneur, chemin: string): { code: number; corps: string };
  // Les fichiers de l'image (ce que contient un conteneur neuf).
  fichiers?: (image: Image) => Record<string, string>;
  // USER de l'image (absent : root) et les comptes de son /etc/passwd.
  utilisateur?: string;
  comptes?: Record<string, number>;
}

// Les applications des images, déclarées par les chapitres.
export const APPLIS: Record<string, Appli> = {};

/** Une ligne du journal d'un conteneur (docker logs). */
export function journal(jeu: Jeu, c: Conteneur, texte: string) {
  c.journal.push({ temps: horloge(jeu), texte });
}

/**
 * Démarre un conteneur : son appli prépare ses fichiers et écrit son journal.
 * Renvoie l'erreur de runc si le processus n'a pas pu être créé (utilisateur
 * inconnu de l'image) : le conteneur reste alors « Created ».
 */
export function lancer(jeu: Jeu, c: Conteneur): string | null {
  const d = docker(jeu)!;
  const image = Object.values(d.images).find((i) => nomImage(i) === c.image)!;
  const id = identite(image, c);
  if ('erreur' in id) {
    c.etat = c.etat === 'running' ? 'exited' : c.etat;
    if (c.etat === 'exited') c.code = 127;
    return `failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: ${id.erreur}: unknown`;
  }
  c.etat = 'running';
  c.debut = horloge(jeu);
  c.arreteALaMain = false;
  const code = APPLIS[image.appli]?.demarrer(jeu, c, image) ?? null;
  if (code !== null) {
    c.etat = 'exited';
    c.code = code;
    c.fin = horloge(jeu);
  }
  return null;
}

/**
 * Docker relance de lui-même un conteneur tombé en erreur, avec une attente
 * qui double à chaque échec, si sa politique --restart le permet (always,
 * unless-stopped, on-failure) : appelé après chaque commande par les
 * chapitres qui en ont besoin (une tentative par commande).
 */
export function relancerEnBoucle(jeu: Jeu) {
  const d = docker(jeu);
  const service = systemd(jeu)?.services.docker;
  if (!d || (service && service.etat !== 'active')) return;
  for (const c of d.conteneurs)
    if (c.etat === 'exited' && c.code !== 0 && !c.arreteALaMain && ['always', 'unless-stopped', 'on-failure'].includes(c.redemarrage.split(':')[0]))
      lancer(jeu, c);
}

export function stopper(jeu: Jeu, c: Conteneur, aLaMain = true) {
  if (c.etat !== 'running') return;
  c.etat = 'exited';
  // SIGTERM : l'appli s'arrête proprement (code 0 ici).
  c.code = 0;
  c.fin = horloge(jeu);
  if (aLaMain) c.arreteALaMain = true;
}

/**
 * Au démarrage du service docker (après un redémarrage de la machine) : les
 * conteneurs arrêtés par l'arrêt du démon repartent selon leur politique
 * --restart (always, unless-stopped s'ils n'ont pas été arrêtés à la main).
 */
export function demarrerDocker(jeu: Jeu) {
  const d = docker(jeu);
  if (!d) return;
  for (const c of d.conteneurs) {
    const avant = c.etat === 'running';
    if (avant) stopper(jeu, c, false);
    const repart =
      c.redemarrage === 'always' ||
      (c.redemarrage === 'unless-stopped' && !c.arreteALaMain) ||
      (c.redemarrage.startsWith('on-failure') && c.code !== 0);
    if (repart) lancer(jeu, c);
  }
  const sd = systemd(jeu);
  if (sd) journaliser(sd, 'docker.service', 'dockerd', 702, 'Daemon has completed initialization');
}

/**
 * Une requête HTTP vers un port de la machine : le conteneur qui le publie
 * répond (undefined : aucun conteneur ne publie ce port ; null : il ne
 * répond pas, arrêté).
 */
export function requeteDocker(jeu: Jeu, adresse: string, port: number, chemin: string): { code: number; corps: string } | null | undefined {
  const d = docker(jeu);
  if (!d) return undefined;
  const local = ['127.0.0.1', 'localhost'].includes(adresse);
  // Depuis la machine, l'adresse du conteneur (réseau bridge) répond aussi sur son port.
  const direct = d.conteneurs.find((c) => c.ip === adresse && c.etat === 'running');
  const publie = (x: Conteneur) => x.ports.some((p) => p.hote === port && (p.ip === '0.0.0.0' || (p.ip === '127.0.0.1' && local)));
  // Le conteneur qui tourne d'abord ; un conteneur arrêté ne répond plus (le port n'est plus relayé).
  const c = direct ?? d.conteneurs.find((x) => x.etat === 'running' && publie(x)) ?? d.conteneurs.find((x) => x.etat === 'exited' && publie(x));
  if (!c) return undefined;
  if (c.etat !== 'running') return null;
  const image = Object.values(d.images).find((i) => nomImage(i) === c.image)!;
  if (direct && port !== image.port) return null;
  return APPLIS[image.appli]?.repondre(jeu, c, chemin) ?? null;
}

// ——— Affichage ———

/** « 2 weeks ago », « 3 minutes ago », comme docker. */
export function ilYa(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const unites: [number, string][] = [
    [365 * 86400, 'year'],
    [30 * 86400, 'month'],
    [7 * 86400, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ];
  if (s < 1) return 'Less than a second';
  for (const [n, u] of unites)
    if (s >= n) {
      const k = Math.floor(s / n);
      if (u === 'hour' && k === 1) return 'About an hour';
      return k === 1 ? `${u === 'hour' ? 'An' : 'A'} ${u}` : `${k} ${u}s`;
    }
  return `${s} seconds`;
}

/** « 148MB », comme docker images. */
export function tailleDocker(octets: number): string {
  if (octets >= 1e9) return `${(octets / 1e9).toFixed(2).replace(/\.?0+$/, '')}GB`;
  if (octets >= 1e6) return `${Math.round(octets / 1e5) / 10}MB`.replace(/\.0MB$/, 'MB');
  if (octets >= 1e3) return `${Math.round(octets / 100) / 10}kB`;
  return `${octets}B`;
}

/** L'heure UTC d'un instant local, au format RFC 3339 (docker logs -t, inspect). */
export const rfc3339 = (local: number) => new Date(versUtc(local)).toISOString().replace(/\.\d+Z$/, '.000000000Z');

// ——— Le réseau et le disque vus de la machine ———

/** Les sockets de docker-proxy pour les ports publiés (pour ss). */
export function ecoutesDocker(jeu: Jeu): { proto: 'tcp'; adresse: string; port: number; processus: string; pid: number }[] {
  const d = docker(jeu);
  if (!d) return [];
  return d.conteneurs
    .filter((c) => c.etat === 'running')
    .flatMap((c, i) =>
      c.ports.flatMap((p) => {
        const pid = 3100 + i * 10 + (p.hote % 7);
        const v4 = { proto: 'tcp' as const, adresse: p.ip, port: p.hote, processus: 'docker-proxy', pid };
        return p.ip === '0.0.0.0' ? [v4, { ...v4, adresse: '[::]', pid: pid + 1 }] : [v4];
      }),
    );
}

/**
 * Un port publié vers l'extérieur sur toutes les adresses (0.0.0.0) : Docker
 * écrit ses propres règles iptables (chaîne DOCKER, table nat), consultées
 * AVANT celles d'ufw. Le paquet est redirigé vers le conteneur sans jamais
 * passer par les règles d'ufw : il entre, quoi qu'en dise ufw status.
 * https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw
 */
export function publieAuMonde(jeu: Jeu, port: number): boolean {
  const d = docker(jeu);
  return !!d?.conteneurs.some((c) => c.etat === 'running' && c.ports.some((p) => p.hote === port && p.ip === '0.0.0.0'));
}

/**
 * Les processus des conteneurs, vus de la machine (ps aux) : ils y sont des
 * processus comme les autres, au nom du compte qui porte leur uid.
 */
export function processusDocker(jeu: Jeu): { pid: number; utilisateur: string; cpu: number; mem: number; commande: string }[] {
  const d = docker(jeu);
  if (!d) return [];
  return d.conteneurs
    .filter((c) => c.etat === 'running')
    .map((c, i) => ({
      pid: 3400 + i * 37,
      utilisateur: compteMachine(jeu, qui(jeu, c).uid),
      cpu: 0.3,
      mem: 1.8,
      commande: imageDu(jeu, c)?.commande ?? '',
    }));
}

/** La place prise par Docker sur le disque (images, conteneurs, volumes), en octets. */
export function placeDocker(d: EtatDocker): { images: number; conteneurs: number; volumes: number } {
  const volumes = Object.values(d.volumes).reduce((t, v) => t + Object.values(v.donnees).reduce((a, x) => a + x.length, 0) + (v.taille ?? 0), 0);
  return { images: Object.values(d.images).reduce((t, i) => t + i.taille, 0), conteneurs: d.conteneurs.length * 4096, volumes };
}

/** Met à jour /var/lib/docker sur le disque simulé (pour df et du). */
export function majDisque(jeu: Jeu) {
  const d = docker(jeu);
  const n = jeu.trouver('/var/lib/docker');
  if (!d || n?.type !== 'dossier') return;
  const p = placeDocker(d);
  n.enfants = {
    overlay2: {
      type: 'dossier',
      proprio: 'root',
      mode: 'rwx--x---',
      enfants: { couches: { type: 'fichier', contenu: '', taille: p.images + p.conteneurs, proprio: 'root' } },
    },
    volumes: {
      type: 'dossier',
      proprio: 'root',
      mode: 'rwx------',
      enfants: { donnees: { type: 'fichier', contenu: '', taille: p.volumes, proprio: 'root' } },
    },
  };
}
