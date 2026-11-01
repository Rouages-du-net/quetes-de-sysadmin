// Histoire « La Fabrique » — chapitre « Les pleins pouvoirs » : ne pas
// faire tourner un conteneur en root. La galerie photo du fablab reçoit des
// photos envoyées par les visiteur·ses ; elle tourne en root (son image n'a
// pas de USER, et compose.yaml pas de user:). Ses fichiers, dans le dossier
// monté /srv/galerie/photos, appartiennent donc à root sur la machine :
// Yasmine ne peut plus les gérer sans sudo. Et une faille dans la galerie
// donnerait root sur tout ce qui est monté.
// Objectif vérifié sur l'état : la galerie tourne sous un autre uid que 0 et
// répond, les 14 photos sont là, Yasmine peut écrire dans le dossier, et
// celui-ci n'est pas ouvert en écriture à tout le monde (pas de chmod 777).
// Sources : https://docs.docker.com/reference/cli/docker/container/run/#user,
// https://docs.docker.com/reference/compose-file/services/#user,
// https://docs.docker.com/engine/security/#linux-kernel-capabilities,
// https://docs.docker.com/engine/security/userns-remap/,
// https://docs.docker.com/build/building/best-practices/#user

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights, type Node } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd, systemd } from '../systemd';
import {
  APPS,
  createDirectoryIn,
  startDocker,
  docker,
  writeIn,
  identifier,
  identity,
  imageOfContainer,
  log,
  diskUpdate,
  imageName,
  restartInLoop,
  dockerRequest,
  type Container,
  type DockerState,
  type Image,
} from '../docker';
import { readProject, mount } from '../compose';
import { newFirewall } from '../firewall';
import { writeBase } from './update';

const M = '/home/you';
const PROJECT = '/srv/galerie';
const PHOTOS = `${PROJECT}/photos`;
const THUMBNAILS = '/app/photos/.miniatures';
const PHOTOS_NAMES = [
  'benchy-premier-essai.jpg',
  'benchy-reussi.jpg',
  'lampe-decoupe-laser.jpg',
  'horloge-en-bois.jpg',
  'robot-suiveur-de-ligne.jpg',
  'atelier-soudure-enfants.jpg',
  'velo-repare.jpg',
  'grille-pain-ressuscite.jpg',
  'enseigne-led.jpg',
  'boite-a-outils-partagee.jpg',
  'brodeuse-numerique.jpg',
  'drone-maison.jpg',
  'clavier-sur-mesure.jpg',
  'fete-du-fablab.jpg',
];

const accounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, yasmine: { uid: 1001, group: 'yasmine' } },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you', 'yasmine'] },
    docker: { gid: 999, members: ['yasmine'] },
    you: { gid: 1000, members: [] },
    yasmine: { gid: 1001, members: [] },
  },
});

const COMPOSE = `services:
  galerie:
    image: registry.example/galerie:3.2
    ports:
      - "8082:3000"
    volumes:
      - ./photos:/app/photos
    restart: unless-stopped`;

// La galerie : au démarrage, elle (re)fait l'index de ses miniatures dans
// le dossier monté ; si elle ne peut pas y écrire, elle s'arrête, comme un
// programme Node.js qui reçoit EACCES.
function nodeError(game: Game, c: Container, code: 'EACCES' | 'EROFS', call: 'mkdir' | 'open', path: string) {
  const message = code === 'EACCES' ? 'permission denied' : 'read-only file system';
  for (const l of [
    `Error: ${code}: ${message}, ${call} '${path}'`,
    '    at async buildThumbnails (/app/serveur.js:42:3) {',
    `  errno: ${code === 'EACCES' ? -13 : -30},`,
    `  code: '${code}',`,
    `  syscall: '${call}',`,
    `  path: '${path}'`,
    '}',
    '',
    'Node.js v22.12.0',
  ])
    log(game, c, l);
}

const presentPhotos = (j: Game) => {
  const n = j.find(PHOTOS);
  return n?.type === 'dossier' ? PHOTOS_NAMES.filter((p) => n.children[p]?.type === 'fichier') : [];
};

APPS.galerie = {
  // Construite sur l'image node : un compte node (uid 1000) existe, mais
  // l'image ne s'en sert pas (pas de USER dans son Dockerfile).
  accounts: { node: 1000 },
  start: (game, c) => {
    log(game, c, '> galerie@3.2.0 start');
    log(game, c, '> node serveur.js');
    const directory = createDirectoryIn(game, c, THUMBNAILS);
    if (directory) {
      nodeError(game, c, directory === 'permission denied' ? 'EACCES' : 'EROFS', 'mkdir', THUMBNAILS);
      return 1;
    }
    const index = writeIn(game, c, `${THUMBNAILS}/index.json`, JSON.stringify(presentPhotos(game)));
    if (index) {
      nodeError(game, c, index === 'permission denied' ? 'EACCES' : 'EROFS', 'open', `${THUMBNAILS}/index.json`);
      return 1;
    }
    log(game, c, `Gallery: ${presentPhotos(game).length} photos, thumbnails up to date`);
    log(game, c, 'Listening on http://0.0.0.0:3000');
    return null;
  },
  answer: (game, _c, path) => {
    if (path === '/' || path === '')
      return { code: 200, body: game.t('full-powers-galerie-accueil', { nombre: presentPhotos(game).length }) };
    return { code: 404, body: `Cannot GET ${path}` };
  },
};

const image = (repo: string, tag: string, app: string, port: number, command: string, size: number, daysBefore: number): Image => ({
  repo,
  tag,
  id: identifier(`${repo}:${tag}:${size}`),
  size,
  created: Date.UTC(2027, 4, 2, 10, 0, 0) - daysBefore * 86_400_000,
  app,
  port,
  command,
});

function dockerState(): DockerState {
  const listing = [
    image('registry.example/outiltheque', '1.5', 'outiltheque', 8080, '/usr/local/bin/outiltheque serve', 151_600_000, 31),
    image('registry.example/galerie', '3.2', 'galerie', 3000, 'docker-entrypoint.sh node serveur.js', 236_800_000, 12),
  ];
  return {
    images: Object.fromEntries(listing.map((i) => [imageName(i), i])),
    registry: Object.fromEntries(listing.map((i) => [imageName(i), i])),
    containers: [],
    volumes: { 'outiltheque-donnees': { created: Date.UTC(2027, 3, 3, 10, 12, 0), data: {}, size: 2_400_000 } },
    next: 20,
  };
}

const state = (j: Game) => docker(j)!;
const sd = (j: Game) => systemd(j)!;

// Le conteneur de la galerie qui compte : celui qui tourne, sinon le plus récent.
const galleries = (j: Game) => state(j).containers.filter((c) => imageOfContainer(j, c)?.app === 'galerie');
const gallery = (j: Game) => galleries(j).find((c) => c.state === 'running') ?? galleries(j).at(-1);
const uid = (j: Game, c: Container | undefined) => {
  if (!c) return null;
  const id = identity(imageOfContainer(j, c), c);
  return 'error' in id ? null : id.uid;
};
const running = (j: Game) => gallery(j)?.state === 'running';
const inRoot = (j: Game) => running(j) && uid(j, gallery(j)) === 0;
const answers = (j: Game) => dockerRequest(j, '127.0.0.1', 8082, '/')?.code === 200;
const photosAll = (j: Game) => presentPhotos(j).length === PHOTOS_NAMES.length;
const directory = (j: Game, path: string) => j.find(path) as Node | undefined;
const canYasmine = (j: Game) => {
  const n = directory(j, PHOTOS);
  return !!n && j.can(n, 'w', 'yasmine') && j.can(n, 'x', 'yasmine');
};
// Écrire pour « les autres » (chmod 777, o+w) : n'importe quel compte de la machine.
const allAOpen = (j: Game) => [PHOTOS, `${PHOTOS}/.miniatures`].some((p) => directory(j, p)?.mode?.[7] === 'w');
const inError = (j: Game) => {
  const c = gallery(j);
  return !!c && c.state !== 'running' && c.log.some((l) => l.text.includes('EACCES'));
};

export const powersFull: Chapter = {
  id: 'full-powers',
  number: 4,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'mkdir',
    'cp',
    'mv',
    'rm',
    'chmod',
    'chown',
    'chgrp',
    'echo',
    'tee',
    'id',
    'whoami',
    'groups',
    'ps',
    'sudo',
    'nano',
    'curl',
    'docker',
    'systemctl',
    'journalctl',
  ],
  home: M,
  welcome: 'message_from_yasmine.txt',
  names: true,
  final: 'fin',
  password: 'fablab-2027',
  accounts,
  state: () => {
    // Le pare-feu de la fin du chapitre 3, plus le port de la galerie.
    const pf = newFirewall();
    pf.enabled = true;
    pf.rules = [22, 8080, 8081, 8082].map((p) => ({ action: 'allow', to: p === 22 ? 'OpenSSH' : `${p}/tcp`, ports: [p], forEachOf: null }));
    return {
      ufw: pf,
      systemd: newSystemd('workshop', Date.UTC(2027, 3, 28, 7, 5, 0), Date.UTC(2027, 4, 2, 9, 30, 0), {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          process: [{ pid: 610, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        docker: {
          description: 'Docker Application Container Engine',
          active: true,
          executable: 'dockerd',
          process: [
            { pid: 702, user: 'root', cpu: 0.4, mem: 2.1, command: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
          ],
          load: (j) => startDocker(j),
        },
      }),
      processus: [
        { pid: 1, user: 'root', cpu: 0, mem: 0.3, command: '/sbin/init' },
        { pid: 610, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
        { pid: 702, user: 'root', cpu: 0.4, mem: 2.1, command: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
      ],
      montages: [{ path: '/', capacity: 20_000_000_000, name: '/dev/vda1' }],
      docker: { ...dockerState(), names: ['workshop', 'workshop.internal', '192.0.2.15'] },
    };
  },
  initialise: (j) => {
    const e = state(j);
    // L'outilthèque, bien faite : son image a un compte à elle (USER outil).
    const tool: Container = {
      id: identifier('conteneur-outiltheque-4'),
      name: 'outiltheque',
      image: 'registry.example/outiltheque:1.5',
      state: 'created',
      code: 0,
      ports: [{ ip: '0.0.0.0', host: 8080, container: 8080 }],
      mounts: [{ type: 'volume', source: 'outiltheque-donnees', target: '/var/lib/outiltheque', onlyRead: false }],
      env: {},
      reboot: 'unless-stopped',
      created: Date.UTC(2027, 3, 3, 10, 20, 0),
      start: 0,
      end: 0,
      layer: {},
      log: [],
      ip: '172.17.0.2',
    };
    e.containers.push(tool);
    writeIn(j, tool, '/var/lib/outiltheque/outiltheque.db', writeBase({ schema: 4, loans: [] }));
    startDocker(j);
    // La galerie, lancée par Yasmine avec docker compose up -d (en root).
    mount(j as Shell, readProject(j, PROJECT), () => true);
    diskUpdate(j);
    sd(j).log = sd(j).log.filter((x) => x.unit !== 'docker.service');
  },
  // Docker relance la galerie quand elle tombe (restart: unless-stopped).
  afterCommand: (j) => restartInLoop(j),
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const photo = (size: number) => f('JFIF', { lines: true, owner: 'root', size });
    return place({
      etc: place({ ...accountsFiles(), hostname: f('workshop', { lines: true, owner: 'root' }) }),
      home: place({
        you: d({ 'message_from_yasmine.txt': f(t('full-powers-message-de-yasmine')), 'note_from_rania.txt': f(t('full-powers-mot-de-rania')) }),
        yasmine: d({}, undefined, { owner: 'yasmine', mode: 'rwxr-x---' }),
      }),
      srv: place({
        galerie: place({
          'compose.yaml': f(COMPOSE, { lines: true, owner: 'root' }),
          'README.txt': f(t('full-powers-lisezmoi'), { owner: 'root' }),
          // Créé par Docker au premier lancement (le dossier n'existait pas) : à root.
          photos: place(Object.fromEntries(PHOTOS_NAMES.map((p, i) => [p, photo(1_800_000 + i * 137_000)]))),
        }),
      }),
      var: place({ lib: place({ docker: place({}, { owner: 'root', mode: 'rwx--x---' }) }) }),
    });
  },
  events: [
    {
      id: 'root',
      condition: (j) => inRoot(j) && (j.last.output.includes('uid=0(root)') || /^root\s+\d+.*node serveur\.js/m.test(j.last.output)),
      message: (j) => j.t('full-powers-evenement-root'),
    },
    {
      id: 'inconnu',
      condition: (j) => [j.last.output, ...j.last.errors].some((x) => x.includes('no matching entries in passwd file')),
      message: (j) => j.t('full-powers-evenement-inconnu'),
    },
    { id: 'eacces', condition: (j) => inError(j), message: (j) => j.t('full-powers-evenement-eacces') },
    {
      id: 'uid-1000',
      condition: (j) => running(j) && uid(j, gallery(j)) === 1000 && !canYasmine(j),
      message: (j) => j.t('full-powers-evenement-uid-1000'),
    },
    { id: 'ouvert-a-tous', condition: (j) => allAOpen(j), message: (j) => j.t('full-powers-evenement-ouvert-a-tous') },
    {
      id: 'photos-perdues',
      condition: (j) => !photosAll(j),
      message: (j) => j.t('full-powers-evenement-photos-perdues', { nombre: PHOTOS_NAMES.length - presentPhotos(j).length }),
    },
    {
      id: 'fin',
      condition: (j) => running(j) && !inRoot(j) && answers(j) && photosAll(j) && canYasmine(j) && !allAOpen(j),
      message: (j) => j.t('full-powers-evenement-fin'),
    },
  ],
};
