// Story "The Workshop" — chapter "The hole in the firewall": Docker
// and ufw, and the space Docker takes. Rania (from The Neighbourhood Letters)
// tested the fablab's server from outside: PostgreSQL answers on
// port 5432, although ufw doesn't allow it. Yasmine had added
// 'ports: - "5432:5432"' to the database to connect to it from her laptop.
// Docker publishes this port with its own iptables rules, consulted before
// ufw's: the database is open to the whole world. On top of that, the disk is
// 91 % full: useless images, a 9.6 GB image, stopped
// containers… and a volume that must not be thrown away.
// Objective checked on the state: port 5432 no longer answers from
// outside, both apps still answer, the disk is below 75 %,
// and no useful volume has disappeared.
// Sources: https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw,
// https://docs.docker.com/engine/network/#published-ports,
// https://docs.docker.com/engine/manage-resources/pruning/

import { password, name, d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd, systemd } from '../systemd';
import {
  startDocker,
  docker,
  writeIn,
  identifier,
  diskUpdate,
  imageName,
  dockerRequest,
  type Container,
  type DockerState,
  type Image,
} from '../docker';
import { readProject, mount, projectContainers } from '../compose';
import { newFirewall, type Firewall } from '../firewall';
import { portState } from '../ports';
import { WORKSTATION } from '../machines';
import { connect } from './compose';
import { writeBase, toolshed, toolshedBase, toolshedDirectory, toolshedImage } from './update';

const M = '/home/you';
const PROJECT = '/srv/reservations';
const Go = 1_000_000_000;
const DISK = 20 * Go;
// The volumes to keep, in the language.
const usefulVolumes = (t: Game['t']) => [name(t, 'toolshed-data'), `reservations_${name(t, 'pgdata')}`, name(t, 'old-wiki')];

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

// The compose.yaml from the end of chapter 2… plus the database port, added by Yasmine.
const COMPOSE = (t: Game['t']) => `services:
  ${name(t, 'webapp')}:
    image: registry.example/reservations:2.1
    ports:
      - "8081:3000"
    environment:
      - DATABASE_URL=postgres://fablab:\${POSTGRES_PASSWORD}@db:5432/reservations
    restart: unless-stopped
    depends_on:
      - db

  db:
    image: postgres:17
    environment:
      - POSTGRES_USER=fablab
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=reservations
    # ${t('firewall-hole-compose-comment')}
    ports:
      - "5432:5432"
    volumes:
      - ${name(t, 'pgdata')}:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  ${name(t, 'pgdata')}:`;

const image = (repo: string, tag: string, app: string, port: number, command: string, size: number, daysBefore: number): Image => ({
  repo,
  tag,
  id: identifier(`${repo}:${tag}:${size}`),
  size,
  created: Date.UTC(2027, 3, 24, 10, 0, 0) - daysBefore * 86_400_000,
  app,
  port,
  command,
});

const days = (n: number) => Date.UTC(2027, 3, 24, 10, 0, 0) - n * 86_400_000;

function dockerState(t: Game['t']): DockerState {
  const tool = (tag: string, size: number, n: number) => toolshedImage(t, tag, days(n), size, identifier(`registry.example/toolshed:${tag}:${size}`));
  const listing = [
    tool('1.4', 148_200_000, 140),
    tool('1.5', 151_600_000, 23),
    image('registry.example/reservations', '2.0', 'reservations', 3000, 'docker-entrypoint.sh node server.js', 205_100_000, 40),
    image('registry.example/reservations', '2.1', 'reservations', 3000, 'docker-entrypoint.sh node server.js', 212_400_000, 16),
    image('postgres', '16', 'postgres', 5432, 'docker-entrypoint.sh postgres', 431_700_000, 60),
    image('postgres', '17', 'postgres', 5432, 'docker-entrypoint.sh postgres', 438_900_000, 22),
    // A local AI model trial, forgotten there.
    { ...image(`registry.example/${name(t, 'local-ai')}`, 'latest', 'none', 8000, 'python -m server', 9_600_000_000, 31), id: identifier('registry.example/local-ai:latest:9600000000') },
    image('node', '22', 'none', 0, 'docker-entrypoint.sh node', 1_120_000_000, 45),
    ...[0, 1, 2].map((k) => image('<none>', '<none>', 'none', 0, '', 410_000_000 + k * 7_000_000, 50 + k * 9)),
  ];
  const images = Object.fromEntries(listing.map((i) => [i.repo === '<none>' ? `<none>@${i.id}` : imageName(i), i]));
  return {
    images,
    registry: Object.fromEntries(listing.filter((i) => i.repo !== '<none>').map((i) => [imageName(i), i])),
    containers: [],
    volumes: {
      [name(t, 'toolshed-data')]: { created: Date.UTC(2027, 3, 3, 10, 12, 0), data: {}, size: 2_400_000 },
      [`reservations_${name(t, 'pgdata')}`]: { created: Date.UTC(2027, 3, 10, 14, 30, 0), data: {}, size: 162_000_000 },
      // The pages of the fablab's old wiki, kept to extract them some day.
      [name(t, 'old-wiki')]: { created: Date.UTC(2026, 10, 2, 9, 0, 0), data: { 'wiki.sqlite': 'SQLite format 3' }, size: 48_100_000 },
    },
    next: 10,
  };
}

const container = (
  j: Game,
  name: string,
  image: string,
  ports: Container['ports'],
  volume: string | null,
  reboot: string,
  state: Container['state'],
): Container => ({
  id: identifier(`container-${name}`),
  name,
  image,
  state,
  code: 0,
  ports,
  mounts: volume ? [{ type: 'volume', source: volume, target: toolshedDirectory(j.t), onlyRead: false }] : [],
  env: {},
  reboot,
  created: Date.UTC(2027, 3, 3, 10, 20, 0),
  start: systemd(j)?.clock ?? 0,
  end: Date.UTC(2027, 3, 3, 10, 18, 0),
  layer: {},
  log: [],
  ip: `172.17.0.${state === 'running' ? 2 : 3}`,
});

const sd = (j: Game) => systemd(j)!;
const state = (j: Game) => docker(j)!;
const shell = (j: Game) => j as Shell;
const openToWorld = (j: Game) => portState(j, 5432, false, WORKSTATION.address) === 'open';
const occupation = (j: Game) => shell(j).size(j.find('/')!) / DISK;
const lostVolumes = (j: Game) => usefulVolumes(j.t).filter((v) => !state(j).volumes[v]);
const okApp = (j: Game) => {
  const a = projectContainers(state(j), 'reservations').find((c) => c.service === name(j.t, 'webapp'));
  return a?.state === 'running' && connect(j, a) === null;
};
const okTool = (j: Game) => dockerRequest(j, '127.0.0.1', 8080, '/')?.code === 200;
const ufw = (j: Game) => j.state.ufw as Firewall;

export const bypass: Chapter = {
  id: 'firewall-hole',
  number: 3,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'du',
    'df',
    'mkdir',
    'cp',
    'mv',
    'rm',
    'chmod',
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
    'ss',
    'ufw',
    'nc',
  ],
  home: M,
  welcome: 'message_from_rania.txt',
  names: true,
  final: 'end',
  password: 'fablab-2027',
  accounts,
  state: (t) => {
    const pf = newFirewall();
    pf.enabled = true;
    pf.rules = [
      { action: 'allow', to: 'OpenSSH', ports: [22], forEachOf: null },
      { action: 'allow', to: '8080/tcp', ports: [8080], forEachOf: null },
      { action: 'allow', to: '8081/tcp', ports: [8081], forEachOf: null },
    ];
    return {
      systemd: newSystemd('workshop', Date.UTC(2027, 3, 20, 7, 10, 0), Date.UTC(2027, 3, 24, 10, 0, 0), {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          process: [{ pid: 610, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
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
      ufw: pf,
      listening: [
        { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 610 },
        { proto: 'tcp', address: '[::]', port: 22, process: 'sshd', pid: 610 },
      ],
      mounts: [{ path: '/', capacity: DISK, name: '/dev/vda1' }],
      docker: { ...dockerState(t), names: ['workshop', 'workshop.internal', '192.0.2.15'] },
    };
  },
  // The fablab's containers, as they have run since the last boot.
  initialise: (j) => {
    const e = state(j);
    const tool = container(
      j,
      toolshed(j.t),
      `registry.example/${toolshed(j.t)}:1.5`,
      [{ ip: '0.0.0.0', host: 8080, container: 8080 }],
      name(j.t, 'toolshed-data'),
      'unless-stopped',
      'running',
    );
    const old = container(
      j,
      name(j.t, 'toolshed-old'),
      `registry.example/${toolshed(j.t)}:1.4`,
      [{ ip: '0.0.0.0', host: 8080, container: 8080 }],
      null,
      'no',
      'exited',
    );
    e.containers.push(old, tool);
    writeIn(j, tool, toolshedBase(j.t), writeBase({ schema: 4, loans: [] }));
    // The bookings database already exists in its volume (password from .env).
    e.volumes[`reservations_${name(j.t, 'pgdata')}`].data = {
      PG_VERSION: '17',
      'pg_hba_qds.json': JSON.stringify({ user: 'fablab', password: password(j.t, 'workshop2027'), base: 'reservations' }),
    };
    mount(shell(j), readProject(j, PROJECT), () => true);
    diskUpdate(j);
    sd(j).log = sd(j).log.filter((x) => x.unit !== 'docker.service');
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    return place({
      etc: place({ ...accountsFiles(), hostname: f('workshop', { lines: true, owner: 'root' }) }),
      home: place({
        you: d({ 'message_from_rania.txt': f(t('firewall-hole-message-rania')), 'note_from_yasmine.txt': f(t('firewall-hole-word-yasmine')) }),
      }),
      srv: place({
        reservations: place({
          'compose.yaml': f(COMPOSE(t), { lines: true, owner: 'root' }),
          '.env': f(`POSTGRES_PASSWORD=${password(t, 'workshop2027')}`, { lines: true, owner: 'root', mode: 'rw-------' }),
        }),
      }),
      // The system and its logs: the space that isn't Docker's.
      usr: place({ 'base-system': f('', { size: 3_100_000_000, owner: 'root' }) }),
      var: place({
        lib: place({ docker: place({}, { owner: 'root', mode: 'rwx--x---' }) }),
        log: place({ journal: place({ 'system.journal': f('', { size: 1_600_000_000, owner: 'root' }) }) }),
      }),
    });
  },
  events: [
    {
      id: 'ss',
      condition: (j) => j.last.output.includes('docker-proxy') && j.last.output.includes(':5432'),
      message: (j) => j.t('firewall-hole-event-ss'),
    },
    {
      id: 'ufw-useless',
      condition: (j) => ufw(j).rules.some((r) => r.ports.includes(5432) && r.action !== 'allow') && openToWorld(j),
      message: (j) => j.t('firewall-hole-event-ufw-useless'),
    },
    {
      id: 'closed',
      condition: (j) => !openToWorld(j) && okApp(j),
      message: (j) => j.t('firewall-hole-event-closed'),
    },
    {
      id: 'volume-lost',
      condition: (j) => lostVolumes(j).length > 0,
      message: (j) => j.t('firewall-hole-event-volume-lost', { volumes: lostVolumes(j).join(', ') }),
    },
    {
      id: 'disk',
      condition: (j) => occupation(j) < 0.75,
      message: (j) => j.t('firewall-hole-event-disk', { percent: Math.round(occupation(j) * 100) }),
    },
    {
      id: 'end',
      condition: (j) => !openToWorld(j) && okApp(j) && okTool(j) && occupation(j) < 0.75 && lostVolumes(j).length === 0,
      message: (j) => j.t('firewall-hole-event-end'),
    },
  ],
};
