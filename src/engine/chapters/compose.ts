// Histoire « La Fabrique » — chapitre « La composition » : Docker Compose.
// Le fablab veut un site de réservation des machines (découpe laser,
// imprimantes 3D) : une appli et sa base PostgreSQL, décrites dans un
// compose.yaml copié d'un tutoriel. Il a quatre défauts : l'appli cherche la
// base sur « localhost » (dans un conteneur, c'est lui-même), la base n'a pas
// de volume, le mot de passe est écrit en clair dans le fichier (que Yasmine
// veut publier sur le dépôt git du fablab), et rien ne redémarre.
// Objectif vérifié sur l'état : les deux services tournent et l'appli est
// connectée à la base, les données de la base sont dans un volume, le mot de
// passe n'est que dans .env (lisible par root seulement), et les deux
// services ont une politique de redémarrage.
// Sources : https://docs.docker.com/compose/how-tos/networking/,
// https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/,
// https://hub.docker.com/_/postgres (POSTGRES_PASSWORD, initialisation)

import { password, d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { APPS, startDocker, docker, writeIn, identifier, readIn, imageName, type Container, type DockerState, type Image } from '../docker';
import { projectContainers, fingerprint, reach, readEnv, readProject, type ComposeContainer } from '../compose';
import type { Shell } from '../shell';

const M = '/home/you';
const PROJECT = '/srv/reservations';
const DATA = '/var/lib/postgresql/data';
const AUTH = `${DATA}/pg_hba_qds.json`;

const log = (game: Game, c: Container, text: string) => c.log.push({ time: systemd(game)?.clock ?? 0, text });

// PostgreSQL (image officielle) : la base n'est créée qu'une fois, quand le
// dossier des données est vide ; POSTGRES_PASSWORD ne sert qu'à ce moment-là.
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
  // PostgreSQL ne parle pas HTTP : une requête web reçoit une réponse vide.
  answer: () => ({ code: 0, body: '' }),
};

// La connexion de l'appli à sa base, d'après DATABASE_URL.
export function connect(game: Game, c: Container): string | null {
  const url = c.env.DATABASE_URL;
  if (!url) return 'Error: DATABASE_URL is not set';
  const m = /^postgres(?:ql)?:\/\/([^:@/]*)(?::([^@/]*))?@([^:/]+)(?::(\d+))?\/([^?]+)/.exec(url);
  if (!m) return `TypeError: Invalid URL: ${url}`;
  const [, user, password = '', host, port = '5432', base] = m;
  // Dans un conteneur, localhost, c'est le conteneur lui-même.
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
  // Construite sur l'image node, qui a un compte node (uid 1000)… mais ne s'en sert pas.
  accounts: { node: 1000 },
  start: (game, c) => {
    log(game, c, '> reservations@2.1.0 start');
    log(game, c, '> node serveur.js');
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
    if (path === '/' || path === '') return { code: 200, body: game.t('compose-appli-accueil') };
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

// Le fichier du tutoriel, tel que Yasmine l'a copié.
const COMPOSE = `version: "3.8"

services:
  appli:
    image: registry.example/reservations:2.1
    ports:
      - "8081:3000"
    environment:
      - DATABASE_URL=postgres://fablab:workshop2027@localhost:5432/reservations
    depends_on:
      - db

  db:
    image: postgres:17
    environment:
      - POSTGRES_USER=fablab
      - POSTGRES_PASSWORD=workshop2027
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

function dockerState(): DockerState {
  const tool = image(
    'registry.example/outiltheque',
    '1.5',
    'outiltheque',
    8080,
    '/usr/local/bin/outiltheque serve',
    151_600_000,
    Date.UTC(2027, 3, 1, 9, 0, 0),
  );
  const reservations = image(
    'registry.example/reservations',
    '2.1',
    'reservations',
    3000,
    'docker-entrypoint.sh node serveur.js',
    212_400_000,
    Date.UTC(2027, 3, 8, 16, 0, 0),
  );
  const postgres = image('postgres', '17', 'postgres', 5432, 'docker-entrypoint.sh postgres', 438_900_000, Date.UTC(2027, 3, 2, 3, 0, 0));
  const registry = Object.fromEntries([tool, reservations, postgres].map((i) => [imageName(i), i]));
  return { images: { [imageName(tool)]: tool }, registry, containers: [], volumes: {}, next: 1 };
}

const state = (j: Game) => docker(j)!;
const project = (j: Game) => projectContainers(state(j), 'reservations');
const service = (j: Game, name: string) => project(j).find((c) => c.service === name);
const restart = (c?: Container) => !!c && ['always', 'unless-stopped'].includes(c.reboot);
// Le mot de passe de la base, tel que .env le donne.
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
  const a = service(j, 'appli');
  return a?.state === 'running' && connect(j, a) === null;
};
// Les conteneurs correspondent-ils au compose.yaml et au .env actuels (pas de up oublié) ?
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
  final: 'fin',
  password: 'fablab-2027',
  accounts,
  state: () => ({
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
    docker: { ...dockerState(), names: ['workshop', 'workshop.internal', '192.0.2.15'] },
  }),
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    return place({
      etc: place({ ...accountsFiles(), hostname: f('workshop', { lines: true, owner: 'root' }) }),
      home: place({
        you: d({ 'message_from_yasmine.txt': f(t('compose-message-de-yasmine')), 'help_compose.txt': f(t('compose-aide-compose')) }),
      }),
      srv: place({ reservations: place({ 'compose.yaml': f(COMPOSE.replaceAll('workshop2027', password(t, 'workshop2027')), { lines: true, owner: 'root' }) }) }),
    });
  },
  events: [
    {
      id: 'localhost',
      condition: (j) =>
        (service(j, 'appli')?.log ?? []).some((l) => l.text.includes('ECONNREFUSED 127.0.0.1')) && j.last.line.includes('docker'),
      message: (j) => j.t('compose-evenement-localhost'),
    },
    {
      id: 'sans-mot-de-passe',
      condition: (j) => (service(j, 'db')?.log ?? []).some((l) => l.text.includes('superuser password is not specified')),
      message: (j) => j.t('compose-evenement-sans-mot-de-passe'),
    },
    {
      id: 'authentification',
      condition: (j) => (service(j, 'appli')?.log ?? []).some((l) => l.text.includes('password authentication failed')),
      message: (j) => j.t('compose-evenement-authentification'),
    },
    {
      id: 'connectee',
      condition: connected,
      message: (j) => j.t('compose-evenement-connectee'),
    },
    {
      id: 'volumes-effaces',
      condition: (j) => j.state.composeVolumesEffaces === true,
      message: (j) => j.t('compose-evenement-volumes-effaces'),
    },
    {
      id: 'en-clair',
      condition: (j) => connected(j) && onVolume(j) && inClear(j),
      message: (j) => j.t('compose-evenement-en-clair'),
    },
    {
      id: 'env-lisible',
      condition: (j) => connected(j) && onVolume(j) && !inClear(j) && envPassword(j) !== '' && !protectedEnv(j),
      message: (j) => j.t('compose-evenement-env-lisible'),
    },
    {
      id: 'sans-redemarrage',
      condition: (j) => connected(j) && onVolume(j) && !inClear(j) && protectedEnv(j) && !(restart(service(j, 'appli')) && restart(service(j, 'db'))),
      message: (j) => j.t('compose-evenement-sans-redemarrage'),
    },
    {
      id: 'fin',
      condition: (j) =>
        connected(j) &&
        dayA(j) &&
        onVolume(j) &&
        !inClear(j) &&
        envPassword(j) !== '' &&
        protectedEnv(j) &&
        restart(service(j, 'appli')) &&
        restart(service(j, 'db')),
      message: (j) => j.t('compose-evenement-fin'),
    },
  ],
};
