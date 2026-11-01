// Story "The Workshop" — chapter "Full powers": don't run a container as
// root. The fablab's photo gallery receives photos sent by visitors; it
// runs as root (its image has no USER, and compose.yaml no user:). Its
// files, in the mounted directory /srv/gallery/photos, therefore belong to
// root on the machine: Yasmine can no longer manage them without sudo. And a
// flaw in the gallery would give root over everything mounted.
// Objective checked on the state: the gallery runs under a uid other than 0
// and answers, the 14 photos are there, Yasmine can write in the directory,
// and it isn't open for writing to everyone (no chmod 777).
// Sources: https://docs.docker.com/reference/cli/docker/container/run/#user,
// https://docs.docker.com/reference/compose-file/services/#user,
// https://docs.docker.com/engine/security/#linux-kernel-capabilities,
// https://docs.docker.com/engine/security/userns-remap/,
// https://docs.docker.com/build/building/best-practices/#user

import { d, f, name, path, accountsFiles, type Chapter, type Accounts, type Rights, type Node } from '../world';
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
import { writeBase, toolshed, toolshedBase, toolshedDirectory, toolshedImage } from './update';

const M = '/home/you';
type T = Game['t'];
// The gallery's names in the language (galerie in French): its directory,
// image, service and photos.
const gallery = (t: T) => name(t, 'gallery');
const PROJECT = '/srv/gallery';
const PHOTOS = `${PROJECT}/photos`;
const thumbnails = (t: T) => `/app/photos/${name(t, '.thumbnails')}`;
const PHOTOS_NAMES = [
  'benchy-first-try.jpg',
  'benchy-success.jpg',
  'laser-cut-lamp.jpg',
  'wooden-clock.jpg',
  'line-following-robot.jpg',
  'kids-soldering-workshop.jpg',
  'repaired-bike.jpg',
  'revived-toaster.jpg',
  'led-sign.jpg',
  'shared-toolbox.jpg',
  'digital-embroidery.jpg',
  'homemade-drone.jpg',
  'custom-keyboard.jpg',
  'fablab-party.jpg',
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

const COMPOSE = (t: T) => `services:
  ${gallery(t)}:
    image: registry.example/${gallery(t)}:3.2
    ports:
      - "8082:3000"
    volumes:
      - ./photos:/app/photos
    restart: unless-stopped`;

// The gallery: at start, it (re)builds the index of its thumbnails in the
// mounted directory; if it can't write there, it stops, like a Node.js
// program receiving EACCES.
function nodeError(game: Game, c: Container, code: 'EACCES' | 'EROFS', call: 'mkdir' | 'open', path: string) {
  const message = code === 'EACCES' ? 'permission denied' : 'read-only file system';
  for (const l of [
    `Error: ${code}: ${message}, ${call} '${path}'`,
    '    at async buildThumbnails (/app/server.js:42:3) {',
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
  const n = j.find(path(j.t, PHOTOS));
  return n?.type === 'directory' ? PHOTOS_NAMES.map((p) => name(j.t, p)).filter((p) => n.children[p]?.type === 'file') : [];
};

APPS.gallery = {
  // Built on the node image: a node account (uid 1000) exists, but
  // the image doesn't use it (no USER in its Dockerfile).
  accounts: { node: 1000 },
  start: (game, c) => {
    log(game, c, '> gallery@3.2.0 start');
    log(game, c, '> node server.js');
    const THUMBNAILS = thumbnails(game.t);
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
      return { code: 200, body: game.t('full-powers-gallery-welcome', { count: presentPhotos(game).length }) };
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

function dockerState(t: T): DockerState {
  const listing = [
    toolshedImage(t, '1.5', Date.UTC(2027, 4, 2, 10, 0, 0) - 31 * 86_400_000, 151_600_000, identifier('registry.example/toolshed:1.5:151600000')),
    {
      ...image(`registry.example/${gallery(t)}`, '3.2', 'gallery', 3000, 'docker-entrypoint.sh node server.js', 236_800_000, 12),
      id: identifier('registry.example/gallery:3.2:236800000'),
    },
  ];
  return {
    images: Object.fromEntries(listing.map((i) => [imageName(i), i])),
    registry: Object.fromEntries(listing.map((i) => [imageName(i), i])),
    containers: [],
    volumes: { [name(t, 'toolshed-data')]: { created: Date.UTC(2027, 3, 3, 10, 12, 0), data: {}, size: 2_400_000 } },
    next: 20,
  };
}

const state = (j: Game) => docker(j)!;
const sd = (j: Game) => systemd(j)!;

// The gallery container that counts: the running one, otherwise the most recent.
const galleries = (j: Game) => state(j).containers.filter((c) => imageOfContainer(j, c)?.app === 'gallery');
const galleryContainer = (j: Game) => galleries(j).find((c) => c.state === 'running') ?? galleries(j).at(-1);
const uid = (j: Game, c: Container | undefined) => {
  if (!c) return null;
  const id = identity(imageOfContainer(j, c), c);
  return 'error' in id ? null : id.uid;
};
const running = (j: Game) => galleryContainer(j)?.state === 'running';
const inRoot = (j: Game) => running(j) && uid(j, galleryContainer(j)) === 0;
const answers = (j: Game) => dockerRequest(j, '127.0.0.1', 8082, '/')?.code === 200;
const photosAll = (j: Game) => presentPhotos(j).length === PHOTOS_NAMES.length;
const directory = (j: Game, place: string) => j.find(path(j.t, place)) as Node | undefined;
const canYasmine = (j: Game) => {
  const n = directory(j, PHOTOS);
  return !!n && j.can(n, 'w', 'yasmine') && j.can(n, 'x', 'yasmine');
};
// Writable by "others" (chmod 777, o+w): any account on the machine.
const allAOpen = (j: Game) => [PHOTOS, `${PHOTOS}/.thumbnails`].some((p) => directory(j, p)?.mode?.[7] === 'w');
const inError = (j: Game) => {
  const c = galleryContainer(j);
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
  final: 'end',
  password: 'fablab-2027',
  accounts,
  state: (t) => {
    // The firewall from the end of chapter 3, plus the gallery's port.
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
      process: [
        { pid: 1, user: 'root', cpu: 0, mem: 0.3, command: '/sbin/init' },
        { pid: 610, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
        { pid: 702, user: 'root', cpu: 0.4, mem: 2.1, command: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
      ],
      mounts: [{ path: '/', capacity: 20_000_000_000, name: '/dev/vda1' }],
      docker: { ...dockerState(t), names: ['workshop', 'workshop.internal', '192.0.2.15'] },
    };
  },
  initialise: (j) => {
    const e = state(j);
    // The tool library, done right: its image has its own account (USER toolshed).
    const tool: Container = {
      id: identifier('container-toolshed-4'),
      name: toolshed(j.t),
      image: `registry.example/${toolshed(j.t)}:1.5`,
      state: 'created',
      code: 0,
      ports: [{ ip: '0.0.0.0', host: 8080, container: 8080 }],
      mounts: [{ type: 'volume', source: name(j.t, 'toolshed-data'), target: toolshedDirectory(j.t), onlyRead: false }],
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
    writeIn(j, tool, toolshedBase(j.t), writeBase({ schema: 4, loans: [] }));
    startDocker(j);
    // The gallery, started by Yasmine with docker compose up -d (as root).
    mount(j as Shell, readProject(j, path(j.t, PROJECT)), () => true);
    diskUpdate(j);
    sd(j).log = sd(j).log.filter((x) => x.unit !== 'docker.service');
  },
  // Docker restarts the gallery when it goes down (restart: unless-stopped).
  afterCommand: (j) => restartInLoop(j),
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const photo = (size: number) => f('JFIF', { lines: true, owner: 'root', size });
    return place({
      etc: place({ ...accountsFiles(), hostname: f('workshop', { lines: true, owner: 'root' }) }),
      home: place({
        you: d({ 'message_from_yasmine.txt': f(t('full-powers-message-yasmine')), 'note_from_rania.txt': f(t('full-powers-word-rania')) }),
        yasmine: d({}, undefined, { owner: 'yasmine', mode: 'rwxr-x---' }),
      }),
      srv: place({
        gallery: place({
          'compose.yaml': f(COMPOSE(t), { lines: true, owner: 'root' }),
          'README.txt': f(t('full-powers-readme'), { owner: 'root' }),
          // Created by Docker on first start (the directory didn't exist): owned by root.
          photos: place(Object.fromEntries(PHOTOS_NAMES.map((p, i) => [p, photo(1_800_000 + i * 137_000)]))),
        }),
      }),
      var: place({ lib: place({ docker: place({}, { owner: 'root', mode: 'rwx--x---' }) }) }),
    });
  },
  events: [
    {
      id: 'root',
      condition: (j) => inRoot(j) && (j.last.output.includes('uid=0(root)') || /^root\s+\d+.*node server\.js/m.test(j.last.output)),
      message: (j) => j.t('full-powers-event-root'),
    },
    {
      id: 'unknown',
      condition: (j) => [j.last.output, ...j.last.errors].some((x) => x.includes('no matching entries in passwd file')),
      message: (j) => j.t('full-powers-event-unknown'),
    },
    { id: 'eacces', condition: (j) => inError(j), message: (j) => j.t('full-powers-event-eacces') },
    {
      id: 'uid-1000',
      condition: (j) => running(j) && uid(j, galleryContainer(j)) === 1000 && !canYasmine(j),
      message: (j) => j.t('full-powers-event-uid-1000'),
    },
    { id: 'open-to-all', condition: (j) => allAOpen(j), message: (j) => j.t('full-powers-event-open-to-all') },
    {
      id: 'photos-lost',
      condition: (j) => !photosAll(j),
      message: (j) => j.t('full-powers-event-photos-lost', { count: PHOTOS_NAMES.length - presentPhotos(j).length }),
    },
    {
      id: 'end',
      condition: (j) => running(j) && !inRoot(j) && answers(j) && photosAll(j) && canYasmine(j) && !allAOpen(j),
      message: (j) => j.t('full-powers-event-end'),
    },
  ],
};
