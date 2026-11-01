// Story "The Workshop", chapter "The Update": Docker. The fablab lends tools
// through the tool library (outiltheque), an app started two weeks ago with
// a plain docker run, without a volume: its database lives in the
// container's layer. Version 1.5 is out; updating means removing the
// container and creating a new one… and without care, the 37 current loans
// disappear with it.
// Commands: docker ps, logs, exec, inspect, cp, stop, rm, pull, run (-d,
// --name, -p, -v, --restart), volume, curl.
// Objective checked on the state: a version 1.5 container runs, publishes
// port 8080, keeps its database in a volume or a directory of the machine
// (no longer in its layer), finds the 37 loans there, and will start again
// with the machine.
// Sources: https://docs.docker.com/engine/storage/volumes/,
// https://docs.docker.com/reference/cli/docker/container/cp/,
// https://docs.docker.com/engine/containers/start-containers-automatically/

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { APPS, startDocker, docker, writeIn, identifier, readIn, imageName, type Container, type DockerState, type Image } from '../docker';

const M = '/home/you';
const REPO = 'registry.example/outiltheque';
const BASE = '/var/lib/outiltheque/outiltheque.db';
const SCHEMAS: Record<string, number> = { '1.4': 3, '1.5': 4 };
const LOANS = 37;

// The tool library's database: an SQLite file (its contents are simulated:
// SQLite's header, then data the game can read).
interface Base {
  schema: number;
  loans: { tool: string; person: string; until: string }[];
}
const HEADER = 'SQLite format 3';
export const writeBase = (b: Base) => `${HEADER}\u0000${JSON.stringify(b)}`;
export function readBase(content: string | null): Base | null {
  if (!content?.startsWith(HEADER)) return null;
  try {
    return JSON.parse(content.slice(HEADER.length + 1)) as Base;
  } catch {
    return null;
  }
}

function loans(tools: string[], people: string[]): Base['loans'] {
  return Array.from({ length: LOANS }, (_, i) => ({
    tool: tools[(i * 5) % tools.length],
    person: people[(i * 7) % people.length],
    until: `2027-04-${String(5 + (i % 20)).padStart(2, '0')}`,
  }));
}

// The image's app: it reads and writes its database on each start and request.
APPS.outiltheque = {
  // The image creates its own account and uses it (USER outil in its Dockerfile).
  user: 'outil',
  accounts: { outil: 1000 },
  start: (game, c, image) => {
    const write = (text: string) => c.log.push({ time: systemd(game)?.clock ?? 0, text });
    const version = image.tag;
    const schema = SCHEMAS[version] ?? 4;
    write(`outiltheque ${version}.0 starting (pid 1)`);
    const base = readBase(readIn(game, c, BASE));
    if (!base) {
      write(`No database found at ${BASE}, creating a new one`);
      writeIn(game, c, BASE, writeBase({ schema, loans: [] }));
    } else if (base.schema > schema) {
      write(`FATAL: database schema ${base.schema} is newer than this version supports (${schema})`);
      return 1;
    } else if (base.schema < schema) {
      write(`Migrating database schema ${base.schema} -> ${schema}`);
      writeIn(game, c, BASE, writeBase({ ...base, schema }));
      write(`Migration done: ${base.loans.length} loans kept`);
    } else write(`Database ready: ${base.loans.length} loans`);
    write('Listening on http://0.0.0.0:8080');
    return null;
  },
  answer: (game, c, path) => {
    const base = readBase(readIn(game, c, BASE));
    const version = c.image.split(':').at(-1)!;
    if (!base) return { code: 500, body: 'Internal Server Error: database is missing' };
    if (path === '/' || path === '') return { code: 200, body: game.t('update-app-welcome', { version, loans: base.loans.length }) };
    if (path === '/prets')
      return {
        code: 200,
        body: [
          game.t('update-app-loans', { loans: base.loans.length }),
          ...base.loans.slice(0, 5).map((p) => `  ${p.tool} — ${p.person} — ${p.until}`),
        ].join('\n'),
      };
    return { code: 404, body: 'Not Found' };
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

const image = (tag: string, created: number): Image => ({
  repo: REPO,
  tag,
  id: identifier(`${REPO}:${tag}`),
  size: tag === '1.4' ? 148_200_000 : 151_600_000,
  created,
  app: 'outiltheque',
  port: 8080,
  command: '/usr/local/bin/outiltheque serve',
});

const dockerState = (t: (id: string) => string): DockerState => {
  const v14 = image('1.4', Date.UTC(2026, 11, 2, 10, 0, 0));
  const v15 = image('1.5', Date.UTC(2027, 3, 1, 9, 0, 0));
  const base = writeBase({ schema: 3, loans: loans(t('update-tools').split(', '), t('update-people').split(', ')) });
  // Started two weeks ago: docker run -d --name outiltheque -p 8080:8080 …:1.4
  const old: Container = {
    id: identifier('conteneur-outiltheque-1.4'),
    name: 'outiltheque',
    image: imageName(v14),
    state: 'running',
    code: 0,
    ports: [{ ip: '0.0.0.0', host: 8080, container: 8080 }],
    mounts: [],
    env: {},
    reboot: 'no',
    created: Date.UTC(2027, 2, 20, 14, 2, 0),
    start: Date.UTC(2027, 2, 31, 8, 40, 0),
    end: Date.UTC(2027, 2, 31, 8, 39, 0),
    layer: { [BASE]: base },
    log: [
      { time: Date.UTC(2027, 2, 20, 14, 2, 1), text: 'outiltheque 1.4.0 starting (pid 1)' },
      { time: Date.UTC(2027, 2, 20, 14, 2, 1), text: `No database found at ${BASE}, creating a new one` },
      { time: Date.UTC(2027, 2, 20, 14, 2, 2), text: 'Listening on http://0.0.0.0:8080' },
      { time: Date.UTC(2027, 2, 31, 8, 40, 1), text: 'outiltheque 1.4.0 starting (pid 1)' },
      { time: Date.UTC(2027, 2, 31, 8, 40, 1), text: `Database ready: ${LOANS} loans` },
      { time: Date.UTC(2027, 2, 31, 8, 40, 2), text: 'Listening on http://0.0.0.0:8080' },
    ],
    ip: '172.17.0.2',
  };
  return {
    images: { [imageName(v14)]: v14 },
    registry: { [imageName(v14)]: v14, [imageName(v15)]: v15, [`${REPO}:latest`]: { ...v15, tag: 'latest' } },
    containers: [old],
    volumes: {},
    next: 1,
  };
};

const state = (j: Game) => docker(j)!;
// Where the loans are: a database containing that many, anywhere.
const baseComplete = (content: string | null) => (readBase(content)?.loans.length ?? 0) === LOANS;

function somePart(j: Game): boolean {
  const e = state(j);
  if (e.containers.some((c) => baseComplete(readIn(j, c, BASE)))) return true;
  if (Object.values(e.volumes).some((v) => Object.values(v.data).some(baseComplete))) return true;
  const search = (path: string, depth: number): boolean => {
    const n = j.find(path);
    if (!n || depth > 8) return false;
    if (n.type === 'file') return baseComplete(j.read(path));
    return Object.keys(n.children).some((k) => search(`${path === '/' ? '' : path}/${k}`, depth + 1));
  };
  return search('/home', 0) || search('/srv', 0) || search('/tmp', 0) || search('/root', 0) || search('/opt', 0);
}

// The up-to-date container that runs and publishes 8080.
const fresh = (j: Game) =>
  state(j).containers.find((c) => c.state === 'running' && c.image.endsWith(':1.5') && c.ports.some((p) => p.host === 8080 && p.container === 8080));
const onMount = (c: Container) => c.mounts.some((m) => BASE.startsWith(m.target.replace(/\/$/, '') + '/'));

export const update: Chapter = {
  id: 'update',
  number: 1,
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
    systemd: newSystemd('workshop', Date.UTC(2027, 2, 31, 8, 39, 0), Date.UTC(2027, 3, 3, 10, 0, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        process: [{ pid: 610, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      containerd: {
        description: 'containerd container runtime',
        active: true,
        executable: 'containerd',
        process: [{ pid: 655, user: 'root', cpu: 0.3, mem: 1.2, command: '/usr/bin/containerd' }],
      },
      docker: {
        description: 'Docker Application Container Engine',
        active: true,
        executable: 'dockerd',
        process: [
          { pid: 702, user: 'root', cpu: 0.4, mem: 2.1, command: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
        ],
        // When the machine boots, docker restarts the containers according to --restart.
        load: (j) => startDocker(j),
      },
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 702, user: 'root', cpu: 0.4, mem: 2.1, command: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
      { pid: 1188, user: '1000', cpu: 0.8, mem: 3.4, command: '/usr/local/bin/outiltheque serve' },
    ],
    docker: { ...dockerState(t), names: ['workshop', 'workshop.internal', '192.0.2.15'] },
  }),
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    return place({
      etc: place({ ...accountsFiles(), hostname: f('workshop', { lines: true, owner: 'root' }) }),
      home: place({
        you: d({ 'message_from_yasmine.txt': f(t('update-message-yasmine')), 'notes_docker.txt': f(t('update-notes-docker')) }),
      }),
      srv: place({}),
      var: place({ lib: place({ docker: place({}, { owner: 'root', mode: 'rwx--x---' }) }) }),
    });
  },
  events: [
    {
      id: 'layer',
      // docker inspect shows a container with no volume or mounted directory.
      condition: (j) =>
        j.last.line.includes('docker') &&
        (j.last.output.includes('"Mounts": []') || (j.last.line.includes('Mounts') && j.last.output.trim() === '[]')),
      message: (j) => j.t('update-event-layer'),
    },
    {
      id: 'port-busy',
      condition: (j) => j.last.errors.some((e) => e.includes('port is already allocated')),
      message: (j) => j.t('update-event-port-busy'),
    },
    {
      id: 'lost',
      condition: (j) => !somePart(j),
      message: (j) => j.t('update-event-lost'),
    },
    {
      id: 'new-empty',
      condition: (j) => {
        const c = fresh(j);
        return !!c && (readBase(readIn(j, c, BASE))?.loans.length ?? 0) === 0;
      },
      message: (j) => j.t('update-event-new-empty'),
    },
    {
      id: 'without-reboot',
      condition: (j) => {
        const c = fresh(j);
        return !!c && onMount(c) && baseComplete(readIn(j, c, BASE)) && !['always', 'unless-stopped'].includes(c.reboot);
      },
      message: (j) => j.t('update-event-without-reboot'),
    },
    {
      id: 'end',
      condition: (j) => {
        const c = fresh(j);
        return !!c && onMount(c) && baseComplete(readIn(j, c, BASE)) && ['always', 'unless-stopped'].includes(c.reboot);
      },
      message: (j) => j.t('update-event-end'),
    },
  ],
};
