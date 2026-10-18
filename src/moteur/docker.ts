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
}

export interface EtatDocker {
  images: Record<string, Image>;
  registre: Record<string, Image>;
  conteneurs: Conteneur[];
  volumes: Record<string, { cree: number; donnees: Record<string, string> }>;
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
/** « registre.example/outiltheque » → « registre.example/outiltheque:latest ». */
export const complet = (nom: string) => (/:[^/]+$/.test(nom) ? nom : `${nom}:latest`);

/** Un conteneur par son nom ou le début de son identifiant. */
export function trouverConteneur(d: EtatDocker, cle: string): Conteneur | null {
  return d.conteneurs.find((c) => c.nom === cle) ?? d.conteneurs.find((c) => cle.length >= 3 && c.id.startsWith(cle)) ?? null;
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

/** Écrit un fichier vu depuis le conteneur ; renvoie une erreur si le montage est en lecture seule. */
export function ecrireDans(jeu: Jeu, c: Conteneur, chemin: string, contenu: string): string | null {
  const d = docker(jeu)!;
  const trouve = montage(c, chemin);
  if (trouve?.m.lectureSeule) return 'read-only file system';
  if (trouve?.m.type === 'volume') (d.volumes[trouve.m.source] ??= { cree: horloge(jeu), donnees: {} }).donnees[trouve.relatif] = contenu;
  else if (trouve?.m.type === 'bind') {
    const n = jeu.trouver(`${trouve.m.source.replace(/\/$/, '')}/${trouve.relatif}`);
    if (n?.type === 'fichier') n.contenu = contenu;
    else {
      const parent = jeu.trouver(trouve.m.source);
      if (parent?.type === 'dossier' && !trouve.relatif.includes('/'))
        parent.enfants[trouve.relatif] = { type: 'fichier', contenu, lignes: true, proprio: 'root' };
    }
  } else c.couche[chemin] = contenu;
  return null;
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
}

// Les applications des images, déclarées par les chapitres.
export const APPLIS: Record<string, Appli> = {};

/** Une ligne du journal d'un conteneur (docker logs). */
export function journal(jeu: Jeu, c: Conteneur, texte: string) {
  c.journal.push({ temps: horloge(jeu), texte });
}

/** Démarre un conteneur : son appli prépare ses fichiers et écrit son journal. */
export function lancer(jeu: Jeu, c: Conteneur): void {
  const d = docker(jeu)!;
  const image = Object.values(d.images).find((i) => nomImage(i) === c.image)!;
  c.etat = 'running';
  c.debut = horloge(jeu);
  c.arreteALaMain = false;
  const code = APPLIS[image.appli]?.demarrer(jeu, c, image) ?? null;
  if (code !== null) {
    c.etat = 'exited';
    c.code = code;
    c.fin = horloge(jeu);
  }
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
