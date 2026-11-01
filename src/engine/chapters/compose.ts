// Story "The Workshop", chapter "The Composition": Docker Compose. The
// fablab wants a site for booking its machines (laser cutter, 3D printers):
// an app and its PostgreSQL database, described in a compose.yaml copied
// from a tutorial. It has four flaws: the app looks for the database on
// "localhost" (in a container, that is itself), the database has no volume,
// the password is written in clear in the file (which Yasmine wants to
// publish on the fablab's git repository), and nothing restarts.
// Objective checked on the state: both services run and the app is
// connected to the database, the database's data is in a volume, the
// password is only in .env (readable by root only), and both services have
// a restart policy.
// Sources: https://docs.docker.com/compose/how-tos/networking/,
// https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/,
// https://hub.docker.com/_/postgres (POSTGRES_PASSWORD, initialisation)

import { password, name, d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { APPS, startDocker, docker, writeIn, identifier, readIn, imageName, type Container, type DockerState, type Image } from '../docker';
import { projectContainers, fingerprint, reach, readEnv, readProject, type ComposeContainer } from '../compose';
import type { Shell } from '../shell';
import { toolshedImage } from './update';

const M = '/home/you';
const PROJECT = '/srv/reservations';
const DATA = '/var/lib/postgresql/data';
const AUTH = `${DATA}/pg_hba_qds.json`;

const log = (game: Game, c: Container, text: string) => c.log.push({ time: systemd(game)?.clock ?? 0, text });

// PostgreSQL (official image): the database is only created once, when the
// data directory is empty; POSTGRES_PASSWORD is only used at that moment.
APPS.postgres = {
  accounts: { postgres: 999 },
  start: (game, c) => {
    if (readIn(game, c, `${DATA}/PG_VERSION`)) {
      log(game, c, '');
      log(game, c, 'PostgreSQL Database directory appears to contain a database; Skipping initialization');
      log(game, c, '');
    } else {
      const password = c.env.POSTGRES_PASSWORD ?? '';
      if (!password && c.env.POSTGRES_HOST_AUTH_METHOD !== 'trust') {
        for (const l of [
          'Error: Database is uninitialized and superuser password is not specified.',
          '       You must specify POSTGRES_PASSWORD to a non-empty value for the',
          '       superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".',
        ])
          log(game, c, l);
        return 1;
      }
      const user = c.env.POSTGRES_USER || 'postgres';
      log(game, c, `The files belonging to this database system will be owned by user "postgres".`);
      log(game, c, `fixing permissions on existing directory ${DATA} ... ok`);
      log(game, c, 'PostgreSQL init process complete; ready for start up.');
      writeIn(game, c, `${DATA}/PG_VERSION`, '17');
      writeIn(game, c, AUTH, JSON.stringify({ user, password, base: c.env.POSTGRES_DB || user }));
    }
    log(
      game,
      c,
      `${new Date(systemd(game)?.clock ?? 0).toISOString().slice(0, 19).replace('T', ' ')}.000 UTC [1] LOG:  database system is ready to accept connections`,
    );
    return null;
  },
  // PostgreSQL doesn't speak HTTP: a web request gets an empty reply.
  answer: () => ({ code: 0, body: '' }),
};

// The app's connection to its database, from DATABASE_URL.
export function connect(game: Game, c: Container): string | null {
  const url = c.env.DATABASE_URL;
  if (!url) return 'Error: DATABASE_URL is not set';
  const m = /^postgres(?:ql)?:\/\/([^:@/]*)(?::([^@/]*))?@([^:/]+)(?::(\d+))?\/([^?]+)/.exec(url);
  if (!m) return `TypeError: Invalid URL: ${url}`;
  const [, user, password = '', host, port = '5432', base] = m;
  // In a container, localhost is the container itself.
  if (['localhost', '127.0.0.1'].includes(host)) return `Error: connect ECONNREFUSED 127.0.0.1:${port}`;
  const db = reach(game, c, host);
  if (!db) return `Error: getaddrinfo ENOTFOUND ${host}`;
  if (db.state !== 'running' || port !== '5432') return `Error: connect ECONNREFUSED ${db.ip}:${port}`;
  const auth = JSON.parse(readIn(game, db, AUTH) ?? '{}');
  if (user !== auth.user || password !== auth.password) return `error: password authentication failed for user "${user}"`;
  if (base !== auth.base) return `error: database "${base}" does not exist`;
  return null;
}

APPS.reservations = {
  // Built on the node image, which has a node account (uid 1000)… but doesn't use it.
  accounts: { node: 1000 },
  start: (game, c) => {
    log(game, c, '> reservations@2.1.0 start');
    log(game, c, '> node server.js');
    const error = connect(game, c);
    if (error) {
      log(game, c, error);
      return 1;
    }
    log(game, c, 'Connected to PostgreSQL 17');
    log(game, c, 'Migrations applied (3)');
    log(game, c, 'Listening on http://0.0.0.0:3000');
    return null;
  },
  answer: (game, c, path) => {
    const error = connect(game, c);
    if (error) return { code: 500, body: `Internal Server Error: ${error}` };
    if (path === '/' || path === '') return { code: 200, body: game.t('compose-app-welcome') };
    return { code: 404, body: `Cannot GET ${path}` };
  },
};

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

// The tutorial's file, as Yasmine copied it (webapp: appli in French).
const COMPOSE = (t: Game['t']) => `version: "3.8"

services:
  ${name(t, 'webapp')}:
    image: registry.example/reservations:2.1
    ports:
      - "8081:3000"
    environment:
      - DATABASE_URL=postgres://fablab:${password(t, 'workshop2027')}@localhost:5432/reservations
    depends_on:
      - db

  db:
    image: postgres:17
    environment:
      - POSTGRES_USER=fablab
      - POSTGRES_PASSWORD=${password(t, 'workshop2027')}
      - POSTGRES_DB=reservations`;

const image = (repo: string, tag: string, app: string, port: number, command: string, size: number, created: number): Image => ({
  repo,
  tag,
  id: identifier(`${repo}:${tag}`),
  size,
  created,
  app,
  port,
  command,
});

function dockerState(t: Game['t']): DockerState {
  const tool = toolshedImage(t, '1.5', Date.UTC(2027, 3, 1, 9, 0, 0), 151_600_000);
  const reservations = image(
    'registry.example/reservations',
    '2.1',
    'reservations',
    3000,
    'docker-entrypoint.sh node server.js',
    212_400_000,
    Date.UTC(2027, 3, 8, 16, 0, 0),
  );
  const postgres = image('postgres', '17', 'postgres', 5432, 'docker-entrypoint.sh postgres', 438_900_000, Date.UTC(2027, 3, 2, 3, 0, 0));
  const registry = Object.fromEntries([tool, reservations, postgres].map((i) => [imageName(i), i]));
  return { images: { [imageName(tool)]: tool }, registry, containers: [], volumes: {}, next: 1 };
}

const state = (j: Game) => docker(j)!;
const project = (j: Game) => projectContainers(state(j), 'reservations');
const service = (j: Game, id: string) => project(j).find((c) => c.service === name(j.t, id));
const restart = (c?: Container) => !!c && ['always', 'unless-stopped'].includes(c.reboot);
// The database password, as .env gives it.
const envPassword = (j: Game) => readEnv(j.read(`${PROJECT}/.env`)).POSTGRES_PASSWORD ?? '';
const inClear = (j: Game) => {
  const mdp = service(j, 'db')?.env.POSTGRES_PASSWORD;
  return !!mdp && (j.read(`${PROJECT}/compose.yaml`) ?? '').includes(mdp);
};
const protectedEnv = (j: Game) => {
  const n = j.find(`${PROJECT}/.env`);
  return !!n && !j.can(n, 'r', 'yasmine');
};
const connected = (j: Game) => {
  const a = service(j, 'webapp');
  return a?.state === 'running' && connect(j, a) === null;
};
// Do the containers match the current compose.yaml and .env (no forgotten up)?
const dayA = (j: Game) => {
  try {
    const p = readProject(j as Shell, PROJECT);
    return p.services.every((s) => (service(j, s.name) as ComposeContainer | undefined)?.fingerprint === fingerprint(s));
  } catch {
    return false;
  }
};
const onVolume = (j: Game) => service(j, 'db')?.mounts.some((m) => m.type === 'volume' && m.target.replace(/\/$/, '') === DATA) ?? false;

export const composition: Chapter = {
  id: 'compose',
  number: 2,
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
    'echo',
    'tee',
    'id',
    'whoami',
    'sudo',
    'nano',
    'curl',
    'docker',
    'systemctl',
    'journalctl',
    'reboot',
  ],
  home: M,
  welcome: 'message_from_yasmine.txt',
  names: true,
  final: 'end',
  password: 'fablab-2027',
  accounts,
  state: (t) => ({
    systemd: newSystemd('workshop', Date.UTC(2027, 3, 3, 10, 30, 0), Date.UTC(2027, 3, 10, 14, 0, 0), {
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
    docker: { ...dockerState(t), names: ['workshop', 'workshop.internal', '192.0.2.15'] },
  }),
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    return place({
      etc: place({ ...accountsFiles(), hostname: f('workshop', { lines: true, owner: 'root' }) }),
      home: place({
        you: d({ 'message_from_yasmine.txt': f(t('compose-message-yasmine')), 'help_compose.txt': f(t('compose-help-compose')) }),
      }),
      srv: place({ reservations: place({ 'compose.yaml': f(COMPOSE(t), { lines: true, owner: 'root' }) }) }),
    });
  },
  events: [
    {
      id: 'localhost',
      condition: (j) =>
        (service(j, 'webapp')?.log ?? []).some((l) => l.text.includes('ECONNREFUSED 127.0.0.1')) && j.last.line.includes('docker'),
      message: (j) => j.t('compose-event-localhost'),
    },
    {
      id: 'without-password',
      condition: (j) => (service(j, 'db')?.log ?? []).some((l) => l.text.includes('superuser password is not specified')),
      message: (j) => j.t('compose-event-without-password'),
    },
    {
      id: 'authentication',
      condition: (j) => (service(j, 'webapp')?.log ?? []).some((l) => l.text.includes('password authentication failed')),
      message: (j) => j.t('compose-event-authentication'),
    },
    {
      id: 'connected',
      condition: connected,
      message: (j) => j.t('compose-event-connected'),
    },
    {
      id: 'volumes-erased',
      condition: (j) => j.state.composeVolumesErased === true,
      message: (j) => j.t('compose-event-volumes-erased'),
    },
    {
      id: 'in-clear',
      condition: (j) => connected(j) && onVolume(j) && inClear(j),
      message: (j) => j.t('compose-event-in-clear'),
    },
    {
      id: 'env-readable',
      condition: (j) => connected(j) && onVolume(j) && !inClear(j) && envPassword(j) !== '' && !protectedEnv(j),
      message: (j) => j.t('compose-event-env-readable'),
    },
    {
      id: 'without-reboot',
      condition: (j) => connected(j) && onVolume(j) && !inClear(j) && protectedEnv(j) && !(restart(service(j, 'webapp')) && restart(service(j, 'db'))),
      message: (j) => j.t('compose-event-without-reboot'),
    },
    {
      id: 'end',
      condition: (j) =>
        connected(j) &&
        dayA(j) &&
        onVolume(j) &&
        !inClear(j) &&
        envPassword(j) !== '' &&
        protectedEnv(j) &&
        restart(service(j, 'webapp')) &&
        restart(service(j, 'db')),
      message: (j) => j.t('compose-event-end'),
    },
  ],
};
