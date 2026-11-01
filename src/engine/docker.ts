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

import type { Node } from './world';
import type { Game } from './shell';
import { writeLog, systemd, toUtc } from './systemd';

export interface Image {
  repo: string;
  tag: string;
  id: string;
  size: number;
  created: number;
  // L'application qu'elle contient (APPLIS), et son port.
  app: string;
  port: number;
  command: string;
  // USER de l'image (vide : root), et les comptes de son /etc/passwd (nom → uid,
  // le groupe principal porte le même numéro).
  user?: string;
  accounts?: Record<string, number>;
}

export interface Mount {
  type: 'volume' | 'bind';
  source: string;
  target: string;
  onlyRead: boolean;
}

export interface Port {
  ip: string;
  host: number;
  container: number;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  state: 'created' | 'running' | 'exited';
  code: number;
  ports: Port[];
  mounts: Mount[];
  env: Record<string, string>;
  reboot: string;
  created: number;
  start: number;
  end: number;
  // La couche du conteneur : les fichiers qu'il a écrits (chemin → contenu).
  layer: Record<string, string>;
  log: { time: number; text: string }[];
  ip: string;
  // Arrêté à la main (docker stop) : unless-stopped ne le relance pas.
  mainAStopped?: boolean;
  // --user (vide : celui de l'image), --read-only, --cap-drop, --security-opt.
  user?: string;
  onlyRead?: boolean;
  capDrop?: string[];
  security?: string[];
}

export interface DockerState {
  images: Record<string, Image>;
  registry: Record<string, Image>;
  containers: Container[];
  // taille : ce que le volume occupe en plus de ses fichiers simulés (une vraie base, par exemple).
  volumes: Record<string, { created: number; data: Record<string, string>; size?: number }>;
  next: number;
}

export const docker = (game: Game): DockerState | undefined => game.state.docker;
export const clock = (game: Game) => systemd(game)?.clock ?? 0;

/** Un identifiant de 64 caractères hexadécimaux, toujours le même pour une graine. */
export function identifier(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  let s = '';
  while (s.length < 64) {
    h = Math.imul(h ^ s.length, 0x01000193) >>> 0;
    s += (h >>> 4).toString(16).padStart(7, '0');
  }
  return s.slice(0, 64);
}

export const imageName = (i: Image) => `${i.repo}:${i.tag}`;
/** « registry.example/outiltheque » → « registry.example/outiltheque:latest ». */
export const complete = (name: string) => (/:[^/]+$/.test(name) ? name : `${name}:latest`);

/** Un conteneur par son nom ou le début de son identifiant. */
export function findContainer(d: DockerState, key: string): Container | null {
  return d.containers.find((c) => c.name === key) ?? d.containers.find((c) => key.length >= 3 && c.id.startsWith(key)) ?? null;
}

// ——— L'utilisateur d'un conteneur ———
// Sans --user ni USER dans l'image, le processus tourne en root (uid 0). Sans
// espace de noms utilisateur (userns-remap, désactivé par défaut), l'uid du
// conteneur est le MÊME uid sur la machine : root dedans, c'est root sur les
// fichiers montés ; l'uid 1000 dedans, c'est le compte 1000 de la machine.
// https://docs.docker.com/reference/cli/docker/container/run/#user,
// https://docs.docker.com/engine/security/userns-remap/

export interface Identity {
  uid: number;
  gid: number;
  // Les noms dans le /etc/passwd de l'image (null : inconnus).
  name: string | null;
  group: string | null;
}

export const imageOfContainer = (game: Game, c: Container): Image | undefined => Object.values(docker(game)!.images).find((i) => imageName(i) === c.image);

/** Les comptes du /etc/passwd d'une image (ceux de son appli, et root). */
export const imageAccounts = (image: Image | undefined): Record<string, number> => ({
  root: 0,
  ...(image ? (APPS[image.app]?.accounts ?? {}) : {}),
  ...(image?.accounts ?? {}),
});
/** L'utilisateur par défaut d'une image (USER du Dockerfile ; root s'il n'y en a pas). */
export const imageUser = (image: Image | undefined) => image?.user || (image && APPS[image.app]?.user) || 'root';

/** L'identité du processus : --user, sinon USER de l'image, sinon root ; ou l'erreur de runc. */
export function identity(image: Image | undefined, c: Container, request?: string): Identity | { error: string } {
  const accounts = imageAccounts(image);
  const nameFor = (n: number) => Object.entries(accounts).find(([, x]) => x === n)?.[0] ?? null;
  const [u, g] = (request || c.user || imageUser(image)).split(':');
  let uid: number;
  if (/^\d+$/.test(u)) uid = Number(u);
  else if (u in accounts) uid = accounts[u];
  else return { error: `unable to find user ${u}: no matching entries in passwd file` };
  // Sans groupe : celui du compte dans l'image ; un uid inconnu de l'image prend le groupe 0.
  let gid = nameFor(uid) === null ? 0 : uid;
  if (g !== undefined) {
    if (/^\d+$/.test(g)) gid = Number(g);
    else if (g in accounts) gid = accounts[g];
    else return { error: `unable to find group ${g}: no matching entries in group file` };
  }
  return { uid, gid, name: nameFor(uid), group: nameFor(gid) };
}

/** Le nom, sur la machine, du compte qui porte cet uid (sinon le numéro). */
export const machineAccount = (game: Game, uid: number) => Object.entries(game.accounts.users).find(([, u]) => u.uid === uid)?.[0] ?? String(uid);
export const machineGroup = (game: Game, gid: number) => Object.entries(game.accounts.groups).find(([, g]) => g.gid === gid)?.[0] ?? String(gid);

/** Les droits d'un uid et d'un gid sur un fichier de la machine (comme le noyau : par numéro). */
export function numericAccess(game: Game, n: Node, right: 'r' | 'w' | 'x', uid: number, gid: number): boolean {
  if (uid === 0) return true;
  const mode = n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
  const owner = n.owner ?? game.player;
  const group = n.group ?? owner;
  const numUid = game.accounts.users[owner]?.uid ?? (/^\d+$/.test(owner) ? Number(owner) : -1);
  const numGid = game.accounts.groups[group]?.gid ?? (/^\d+$/.test(group) ? Number(group) : -1);
  const triplet = numUid === uid ? mode.slice(0, 3) : numGid === gid ? mode.slice(3, 6) : mode.slice(6, 9);
  return triplet.includes(right);
}

// L'identité d'un conteneur qui tourne (root si elle n'a pas pu être lue).
function who(game: Game, c: Container): Identity {
  const id = identity(imageOfContainer(game, c), c);
  return 'error' in id ? { uid: 0, gid: 0, name: 'root', group: 'root' } : id;
}

// ——— Fichiers d'un conteneur ———

// Le montage qui contient ce chemin (le plus long), et le chemin relatif.
function mount(c: Container, path: string): { m: Mount; relative: string } | null {
  const m = c.mounts
    .filter((x) => path === x.target || path.startsWith(x.target.replace(/\/$/, '') + '/'))
    .sort((a, b) => b.target.length - a.target.length)[0];
  return m ? { m, relative: path.slice(m.target.replace(/\/$/, '').length).replace(/^\//, '') } : null;
}

/** Lit un fichier vu depuis le conteneur : volume, dossier monté, ou sa couche. */
export function readIn(game: Game, c: Container, path: string): string | null {
  const d = docker(game)!;
  const found = mount(c, path);
  if (found?.m.type === 'volume') return d.volumes[found.m.source]?.data[found.relative] ?? null;
  if (found?.m.type === 'bind') return game.read(`${found.m.source.replace(/\/$/, '')}/${found.relative}`);
  return c.layer[path] ?? null;
}

/**
 * Écrit un fichier vu depuis le conteneur ; renvoie une erreur si le montage
 * est en lecture seule, ou si l'utilisateur du conteneur n'a pas le droit
 * d'écrire dans le dossier monté (il est soumis aux droits de la machine).
 */
export function writeIn(game: Game, c: Container, path: string, content: string): string | null {
  const d = docker(game)!;
  const found = mount(c, path);
  if (found?.m.onlyRead || (!found && c.onlyRead)) return 'read-only file system';
  if (found?.m.type === 'volume') (d.volumes[found.m.source] ??= { created: clock(game), data: {} }).data[found.relative] = content;
  else if (found?.m.type === 'bind') {
    const id = who(game, c);
    const place = `${found.m.source.replace(/\/$/, '')}/${found.relative}`;
    const n = game.find(place);
    if (n?.type === 'file') {
      if (!numericAccess(game, n, 'w', id.uid, id.gid)) return 'permission denied';
      n.content = content;
    } else {
      const parent = game.find(place.replace(/\/[^/]+$/, ''));
      if (parent?.type !== 'directory') return 'no such file or directory';
      if (!numericAccess(game, parent, 'w', id.uid, id.gid) || !numericAccess(game, parent, 'x', id.uid, id.gid)) return 'permission denied';
      // Le fichier créé appartient, sur la machine, à l'uid du conteneur.
      parent.children[place.split('/').at(-1)!] = {
        type: 'file',
        content,
        lines: true,
        owner: machineAccount(game, id.uid),
        group: machineGroup(game, id.gid),
      };
    }
  } else c.layer[path] = content;
  return null;
}

/** Crée un dossier vu depuis le conteneur (mkdir) ; mêmes règles qu'ecrireDans. */
export function createDirectoryIn(game: Game, c: Container, path: string): string | null {
  const found = mount(c, path);
  if (found?.m.type !== 'bind') return null;
  const place = `${found.m.source.replace(/\/$/, '')}/${found.relative}`;
  if (game.find(place)?.type === 'directory') return null;
  if (found.m.onlyRead) return 'read-only file system';
  const parent = game.find(place.replace(/\/[^/]+$/, ''));
  const id = who(game, c);
  if (parent?.type !== 'directory') return 'no such file or directory';
  if (!numericAccess(game, parent, 'w', id.uid, id.gid)) return 'permission denied';
  parent.children[place.split('/').at(-1)!] = { type: 'directory', children: {}, owner: machineAccount(game, id.uid), group: machineGroup(game, id.gid) };
  return null;
}

/** Le fichier de la machine derrière un chemin du conteneur (dossier monté), s'il y en a un. */
export function nodeIn(game: Game, c: Container, path: string): Node | null {
  const found = mount(c, path);
  if (found?.m.type !== 'bind') return null;
  return game.find(`${found.m.source.replace(/\/$/, '')}/${found.relative}`.replace(/\/$/, '')) ?? null;
}

/** L'utilisateur du conteneur peut-il faire cela sur ce chemin (dossier monté) ? */
export function canIn(game: Game, c: Container, path: string, right: 'r' | 'w' | 'x'): boolean {
  const n = nodeIn(game, c, path);
  const id = who(game, c);
  return !n || numericAccess(game, n, right, id.uid, id.gid);
}

/** Les fichiers visibles sous un lieu du conteneur (chemins absolus). */
export function listIn(game: Game, c: Container, place: string): string[] {
  const d = docker(game)!;
  const base = place.replace(/\/$/, '');
  const found = mount(c, base);
  if (found?.m.type === 'volume')
    return Object.keys(d.volumes[found.m.source]?.data ?? {}).map((r) => `${found.m.target.replace(/\/$/, '')}/${r}`);
  if (found?.m.type === 'bind') {
    const n = game.find(found.m.source);
    return n?.type === 'directory' ? Object.keys(n.children).map((k) => `${found.m.target.replace(/\/$/, '')}/${k}`) : [];
  }
  return Object.keys(c.layer).filter((p) => p.startsWith(base + '/'));
}

// ——— Les applications ———

export interface App {
  // Au démarrage : écrit son journal, prépare ses fichiers ; renvoie le code
  // de sortie si elle s'arrête aussitôt (sinon null : elle tourne).
  start(game: Game, c: Container, image: Image): number | null;
  // Une requête HTTP sur son port.
  answer(game: Game, c: Container, path: string): { code: number; body: string };
  // Les fichiers de l'image (ce que contient un conteneur neuf).
  files?: (image: Image) => Record<string, string>;
  // USER de l'image (absent : root) et les comptes de son /etc/passwd.
  user?: string;
  accounts?: Record<string, number>;
}

// Les applications des images, déclarées par les chapitres.
export const APPS: Record<string, App> = {};

/** Une ligne du journal d'un conteneur (docker logs). */
export function log(game: Game, c: Container, text: string) {
  c.log.push({ time: clock(game), text });
}

/**
 * Démarre un conteneur : son appli prépare ses fichiers et écrit son journal.
 * Renvoie l'erreur de runc si le processus n'a pas pu être créé (utilisateur
 * inconnu de l'image) : le conteneur reste alors « Created ».
 */
export function launch(game: Game, c: Container): string | null {
  const d = docker(game)!;
  const image = Object.values(d.images).find((i) => imageName(i) === c.image)!;
  const id = identity(image, c);
  if ('error' in id) {
    c.state = c.state === 'running' ? 'exited' : c.state;
    if (c.state === 'exited') c.code = 127;
    return `failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: ${id.error}: unknown`;
  }
  c.state = 'running';
  c.start = clock(game);
  c.mainAStopped = false;
  const code = APPS[image.app]?.start(game, c, image) ?? null;
  if (code !== null) {
    c.state = 'exited';
    c.code = code;
    c.end = clock(game);
  }
  return null;
}

/**
 * Docker relance de lui-même un conteneur tombé en erreur, avec une attente
 * qui double à chaque échec, si sa politique --restart le permet (always,
 * unless-stopped, on-failure) : appelé après chaque commande par les
 * chapitres qui en ont besoin (une tentative par commande).
 */
export function restartInLoop(game: Game) {
  const d = docker(game);
  const service = systemd(game)?.services.docker;
  if (!d || (service && service.state !== 'active')) return;
  for (const c of d.containers)
    if (c.state === 'exited' && c.code !== 0 && !c.mainAStopped && ['always', 'unless-stopped', 'on-failure'].includes(c.reboot.split(':')[0]))
      launch(game, c);
}

export function stop(game: Game, c: Container, mainA = true) {
  if (c.state !== 'running') return;
  c.state = 'exited';
  // SIGTERM : l'appli s'arrête proprement (code 0 ici).
  c.code = 0;
  c.end = clock(game);
  if (mainA) c.mainAStopped = true;
}

/**
 * Au démarrage du service docker (après un redémarrage de la machine) : les
 * conteneurs arrêtés par l'arrêt du démon repartent selon leur politique
 * --restart (always, unless-stopped s'ils n'ont pas été arrêtés à la main).
 */
export function startDocker(game: Game) {
  const d = docker(game);
  if (!d) return;
  for (const c of d.containers) {
    const before = c.state === 'running';
    if (before) stop(game, c, false);
    const restarts =
      c.reboot === 'always' ||
      (c.reboot === 'unless-stopped' && !c.mainAStopped) ||
      (c.reboot.startsWith('on-failure') && c.code !== 0);
    if (restarts) launch(game, c);
  }
  const sd = systemd(game);
  if (sd) writeLog(sd, 'docker.service', 'dockerd', 702, 'Daemon has completed initialization');
}

/**
 * Une requête HTTP vers un port de la machine : le conteneur qui le publie
 * répond (undefined : aucun conteneur ne publie ce port ; null : il ne
 * répond pas, arrêté).
 */
export function dockerRequest(game: Game, address: string, port: number, path: string): { code: number; body: string } | null | undefined {
  const d = docker(game);
  if (!d) return undefined;
  const local = ['127.0.0.1', 'localhost'].includes(address);
  // Depuis la machine, l'adresse du conteneur (réseau bridge) répond aussi sur son port.
  const direct = d.containers.find((c) => c.ip === address && c.state === 'running');
  const published = (x: Container) => x.ports.some((p) => p.host === port && (p.ip === '0.0.0.0' || (p.ip === '127.0.0.1' && local)));
  // Le conteneur qui tourne d'abord ; un conteneur arrêté ne répond plus (le port n'est plus relayé).
  const c = direct ?? d.containers.find((x) => x.state === 'running' && published(x)) ?? d.containers.find((x) => x.state === 'exited' && published(x));
  if (!c) return undefined;
  if (c.state !== 'running') return null;
  const image = Object.values(d.images).find((i) => imageName(i) === c.image)!;
  if (direct && port !== image.port) return null;
  return APPS[image.app]?.answer(game, c, path) ?? null;
}

// ——— Affichage ———

/** « 2 weeks ago », « 3 minutes ago », comme docker. */
export function yaIt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const units: [number, string][] = [
    [365 * 86400, 'year'],
    [30 * 86400, 'month'],
    [7 * 86400, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ];
  if (s < 1) return 'Less than a second';
  for (const [n, u] of units)
    if (s >= n) {
      const k = Math.floor(s / n);
      if (u === 'hour' && k === 1) return 'About an hour';
      return k === 1 ? `${u === 'hour' ? 'An' : 'A'} ${u}` : `${k} ${u}s`;
    }
  return `${s} seconds`;
}

/** « 148MB », comme docker images. */
export function dockerSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2).replace(/\.?0+$/, '')}GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e5) / 10}MB`.replace(/\.0MB$/, 'MB');
  if (bytes >= 1e3) return `${Math.round(bytes / 100) / 10}kB`;
  return `${bytes}B`;
}

/** L'heure UTC d'un instant local, au format RFC 3339 (docker logs -t, inspect). */
export const rfc3339 = (local: number) => new Date(toUtc(local)).toISOString().replace(/\.\d+Z$/, '.000000000Z');

// ——— Le réseau et le disque vus de la machine ———

/** Les sockets de docker-proxy pour les ports publiés (pour ss). */
export function dockerListeners(game: Game): { proto: 'tcp'; address: string; port: number; process: string; pid: number }[] {
  const d = docker(game);
  if (!d) return [];
  return d.containers
    .filter((c) => c.state === 'running')
    .flatMap((c, i) =>
      c.ports.flatMap((p) => {
        const pid = 3100 + i * 10 + (p.host % 7);
        const v4 = { proto: 'tcp' as const, address: p.ip, port: p.host, process: 'docker-proxy', pid };
        return p.ip === '0.0.0.0' ? [v4, { ...v4, address: '[::]', pid: pid + 1 }] : [v4];
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
export function publishedToWorld(game: Game, port: number): boolean {
  const d = docker(game);
  return !!d?.containers.some((c) => c.state === 'running' && c.ports.some((p) => p.host === port && p.ip === '0.0.0.0'));
}

/**
 * Les processus des conteneurs, vus de la machine (ps aux) : ils y sont des
 * processus comme les autres, au nom du compte qui porte leur uid.
 */
export function dockerProcess(game: Game): { pid: number; user: string; cpu: number; mem: number; command: string }[] {
  const d = docker(game);
  if (!d) return [];
  return d.containers
    .filter((c) => c.state === 'running')
    .map((c, i) => ({
      pid: 3400 + i * 37,
      user: machineAccount(game, who(game, c).uid),
      cpu: 0.3,
      mem: 1.8,
      command: imageOfContainer(game, c)?.command ?? '',
    }));
}

/** La place prise par Docker sur le disque (images, conteneurs, volumes), en octets. */
export function placeDocker(d: DockerState): { images: number; containers: number; volumes: number } {
  const volumes = Object.values(d.volumes).reduce((t, v) => t + Object.values(v.data).reduce((a, x) => a + x.length, 0) + (v.size ?? 0), 0);
  return { images: Object.values(d.images).reduce((t, i) => t + i.size, 0), containers: d.containers.length * 4096, volumes };
}

/** Met à jour /var/lib/docker sur le disque simulé (pour df et du). */
export function diskUpdate(game: Game) {
  const d = docker(game);
  const n = game.find('/var/lib/docker');
  if (!d || n?.type !== 'directory') return;
  const p = placeDocker(d);
  n.children = {
    overlay2: {
      type: 'directory',
      owner: 'root',
      mode: 'rwx--x---',
      children: { couches: { type: 'file', content: '', size: p.images + p.containers, owner: 'root' } },
    },
    volumes: {
      type: 'directory',
      owner: 'root',
      mode: 'rwx------',
      children: { donnees: { type: 'file', content: '', size: p.volumes, owner: 'root' } },
    },
  };
}
