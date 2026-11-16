// Story "The Old Sun": what its chapters share. The neighbourhood seed
// library has kept its catalogue (varieties, members, lendings) since 2009
// on a Sun Fire V240 in a cupboard: herbarium, Solaris 10 on SPARC,
// PostgreSQL 8.4 in LATIN1, set up by Odette, who has since retired. Inaya,
// who coordinates the volunteers, bought a new server: greenhouse, Debian
// with PostgreSQL 16, on the library's network (reached over ssh from
// herbarium). Moving off an old system is a real job: read it before
// touching it, take a consistent copy that travels (a dump, not the data
// files: other version, other byte order), mind the character set, check,
// and keep the old box until the new one is trusted.
// Sources: Solaris 10 documentation (https://docs.oracle.com/cd/E26505_01/),
// PostgreSQL's documentation on upgrading and dumps
// (https://www.postgresql.org/docs/16/upgrading.html) and on character sets
// (https://www.postgresql.org/docs/16/multibyte.html).

import { accountsFiles, d, f, type Accounts, type Directory, type File, type InternalHost, type Node } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { generateKey } from '../access';
import { publicKey, storyMachine, machineName } from '../machines';
import { newSystemd } from '../systemd';
import type { Process } from '../commands/system';
import type { Listening } from '../commands/ss';
import type { PostgresState, Table } from '../postgres';
import { smf, type SmfService, type ZfsState } from '../solaris';

export const HOME = '/export/home/you';
// semence-2029 in French (passwords.ftl).
export const PASSWORD = 'seed-2029';
export const ADDRESS = '192.0.2.35';
export const GREENHOUSE = '192.0.2.36';
// Wednesday 20 November 2029, 14:00.
export const NOW = Date.UTC(2029, 10, 20, 14, 0, 0);
const BOOT = Date.UTC(2025, 2, 3, 6, 12, 0);

/** Your key on herbarium, authorised on greenhouse (Inaya's nephew installed it). */
export const KEY = generateKey('old-sun-herbarium', 'you@herbarium');

export const PG_FMRI = 'svc:/application/database/postgresql_84:default_64bit';
export const APP_FMRI = 'svc:/site/seed-catalogue:default';
export const DATA_DIR = '/var/postgres/8.4/data_64';
export const DATASET = 'data/postgres';
export const APP_CONF = '/etc/opt/seed-catalogue/catalogue.ini';

export const proc = (pid: number, user: string, command: string, more: Partial<Process> = {}): Process => ({ pid, user, cpu: 0, mem: 0.2, command, ...more });

// ——— the catalogue: names with accents, all in LATIN1 ———

export const VARIETIES: string[][] = [
  ['1', "Tomato 'Noire de Crim\u00e9e'", 'Solanaceae', '2009'],
  ['2', "Bean 'M\u00e8re H\u00e9l\u00e8ne'", 'Fabaceae', '2009'],
  ['3', "Pea 'Petit Proven\u00e7al'", 'Fabaceae', '2010'],
  ['4', "Squash 'Musqu\u00e9e de Provence'", 'Cucurbitaceae', '2010'],
  ['5', "Lettuce 'Rougette du Midi'", 'Asteraceae', '2011'],
  ['6', "Pepper 'Doux d'Espagne'", 'Solanaceae', '2012'],
  ['7', "Turnip 'Boule d'Or'", 'Brassicaceae', '2013'],
  ['8', "Bean 'Neckark\u00f6nigin'", 'Fabaceae', '2014'],
  ['9', "Melon 'Petit Gris de Rennes'", 'Cucurbitaceae', '2016'],
  ['10', "Carrot 'Rouge Sang Violette'", 'Apiaceae', '2018'],
];
const MEMBERS: string[][] = [
  ['1', 'Odette', '2009'],
  ['2', 'Inaya', '2014'],
  ['3', 'Ga\u00ebl', '2016'],
  ['4', 'Zo\u00eb', '2019'],
  ['5', 'J\u00e9r\u00f4me', '2021'],
];
const LENDINGS: string[][] = Array.from({ length: 14 }, (_, i) => [String(i + 1), String((i % 10) + 1), String((i % 5) + 1), `2029-${String(3 + Math.floor(i / 3)).padStart(2, '0')}-${String(2 + (i * 5) % 26).padStart(2, '0')}`]);

export const catalogue = (): Record<string, Table> => ({
  varieties: { columns: ['id', 'name', 'family', 'since'], lines: VARIETIES.map((l) => [...l]) },
  members: { columns: ['id', 'name', 'joined'], lines: MEMBERS.map((l) => [...l]) },
  lendings: { columns: ['id', 'variety_id', 'member_id', 'lent_on'], lines: LENDINGS.map((l) => [...l]) },
});

// ——— herbarium: Solaris 10 ———

export const herbariumAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/', shell: '/sbin/sh' },
    you: { uid: 100, group: 'staff', home: HOME, shell: '/usr/bin/bash' },
    postgres: { uid: 90, group: 'postgres', home: '/var/postgres', shell: '/usr/bin/pfksh' },
    webservd: { uid: 80, group: 'webservd', home: '/', shell: '/bin/sh' },
  },
  groups: {
    root: { gid: 0, members: [] },
    staff: { gid: 10, members: ['you'] },
    postgres: { gid: 90, members: [] },
    webservd: { gid: 80, members: [] },
  },
});

const PG_PID = 812;
const APP_PID = 931;

/** The catalogue's application reads its database host from catalogue.ini when it starts. */
const readAppConf = (j: Game) => /^\s*db_host\s*=\s*(\S+)/m.exec(j.read(APP_CONF) ?? '')?.[1] ?? 'localhost';

export function herbariumSmf(o: { pgOnline: boolean; appOnline: boolean }): Record<string, SmfService> {
  const service = (state: SmfService['state'], description: string, more: Partial<SmfService> = {}): SmfService => ({ state, stime: 'Mon Mar 03 06:12:44 2025', description, ...more });
  return {
    'lrc:/etc/rc2_d/S20sysetup': service('legacy_run', 'legacy rc script'),
    'svc:/system/svc/restarter:default': service('online', 'master restarter'),
    'svc:/system/filesystem/local:default': service('online', 'local file system mounts'),
    'svc:/network/ssh:default': service('online', 'SSH server', { pids: [598], contract: 61 }),
    'svc:/system/zones:default': service('online', 'Zones autoboot'),
    // Unrelated, and broken for years: svcs -x shows it first.
    'svc:/network/smtp:sendmail': service('maintenance', 'sendmail SMTP mail transfer agent', {
      reason: 'Start method exited with $SMF_EXIT_ERR_CONFIG.',
    }),
    'svc:/application/database/postgresql_84:default_32bit': service('disabled', 'PostgreSQL RDBMS'),
    [PG_FMRI]: service(o.pgOnline ? 'online' : 'disabled', 'PostgreSQL RDBMS', {
      pids: [PG_PID],
      contract: 98,
      props: {
        'postgresql_84/bin': '/usr/postgres/8.4/bin/64',
        'postgresql_84/data': DATA_DIR,
        'postgresql_84/log': 'server.log',
        'postgresql_84/value_authorization': 'solaris.smf.value.postgres',
      },
      onDisable: (j) => (j.state.process = (j.state.process as Process[]).filter((p) => p.user !== 'postgres')),
      onEnable: (j) => (j.state.process as Process[]).push(proc(PG_PID, 'postgres', `/usr/postgres/8.4/bin/64/postgres -D ${DATA_DIR}`, { mem: 1.4 })),
    }),
    [APP_FMRI]: service(o.appOnline ? 'online' : 'disabled', 'Seed library catalogue (PHP, Apache 2.2)', {
      pids: [APP_PID],
      contract: 104,
      props: { 'config/file': APP_CONF, 'start/exec': '/usr/apache2/2.2/bin/apachectl -k start' },
      onDisable: (j) => (j.state.process = (j.state.process as Process[]).filter((p) => p.user !== 'webservd')),
      onEnable: (j) => {
        (j.state.process as Process[]).push(proc(APP_PID, 'webservd', '/usr/apache2/2.2/bin/httpd -k start', { mem: 0.9 }));
        j.state.catalogueDb = readAppConf(j);
      },
    }),
  };
}

export const herbariumZfs = (snapshot = false): ZfsState => ({
  pools: {
    rpool: { size: '68G', alloc: '22.8G', free: '45.2G', health: 'ONLINE', devices: ['c1t0d0s0', 'c1t1d0s0'] },
    data: { size: '68G', alloc: '2.31G', free: '65.7G', health: 'ONLINE', devices: ['c1t2d0', 'c1t3d0'] },
  },
  datasets: {
    rpool: { used: '21.4G', avail: '45.2G', refer: '97K', mountpoint: '/rpool' },
    'rpool/ROOT': { used: '9.12G', avail: '45.2G', refer: '31K', mountpoint: 'legacy' },
    'rpool/ROOT/s10s_u11': { used: '9.12G', avail: '45.2G', refer: '9.12G', mountpoint: '/' },
    'rpool/export': { used: '412M', avail: '45.2G', refer: '32K', mountpoint: '/export' },
    'rpool/export/home': { used: '411M', avail: '45.2G', refer: '411M', mountpoint: '/export/home' },
    data: { used: '2.31G', avail: '64.6G', refer: '31K', mountpoint: '/data' },
    [DATASET]: { used: '2.30G', avail: '64.6G', refer: '2.30G', mountpoint: '/var/postgres' },
  },
  snapshots: snapshot ? { [`${DATASET}@before-migration`]: { used: '1.2M', refer: '2.30G', creation: 'Wed Nov 20 14:05 2029' } } : {},
});

export function herbariumState(o: { pgOnline?: boolean; appOnline?: boolean; snapshot?: boolean; tables?: Record<string, Table>; readOnly?: boolean } = {}) {
  const pgOnline = o.pgOnline ?? true;
  const appOnline = o.appOnline ?? true;
  const process: Process[] = [
    proc(0, 'root', 'sched'),
    proc(1, 'root', '/sbin/init'),
    proc(9, 'root', '/lib/svc/bin/svc.startd'),
    proc(11, 'root', '/lib/svc/bin/svc.configd'),
    proc(598, 'root', '/usr/lib/ssh/sshd'),
    ...(pgOnline ? [proc(PG_PID, 'postgres', `/usr/postgres/8.4/bin/64/postgres -D ${DATA_DIR}`, { mem: 1.4 })] : []),
    ...(appOnline ? [proc(APP_PID, 'webservd', '/usr/apache2/2.2/bin/httpd -k start', { mem: 0.9 })] : []),
  ];
  const listening: Listening[] = [
    { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 598 },
    { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'httpd', pid: APP_PID },
    { proto: 'tcp', address: '127.0.0.1', port: 5432, process: 'postgres', pid: PG_PID },
  ];
  return {
    os: 'solaris',
    // No systemd on Solaris: this one only keeps the machine's clock.
    systemd: newSystemd('herbarium', BOOT, NOW, {}),
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    smf: { services: herbariumSmf({ pgOnline, appOnline }) },
    zfs: herbariumZfs(o.snapshot),
    process,
    listening,
    catalogueDb: 'localhost',
    postgres: {
      version: '8.4.22',
      platform: 'sparc-sun-solaris2.10',
      socketDir: '/tmp',
      roles: ['postgres', 'catalogue'],
      archives: {},
      bases: {
        postgres: { owner: 'postgres', tables: {}, encoding: 'LATIN1' },
        seeds: { owner: 'catalogue', tables: o.tables ?? catalogue(), encoding: 'LATIN1', ...(o.readOnly ? { readOnly: true } : {}) },
      },
    } satisfies PostgresState,
  };
}

/**
 * While the catalogue is online, the library's volunteers record lendings: a
 * new row every third command (in the database it points to). A dump taken
 * meanwhile misses what comes after it.
 */
export function lendingsGoOn(j: Game): void {
  const s = smf(j).services[APP_FMRI];
  if (s?.state !== 'online') return;
  j.state.ticks = ((j.state.ticks as number | undefined) ?? 0) + 1;
  if ((j.state.ticks as number) % 3 !== 0) return;
  const target = j.state.catalogueDb === 'localhost' ? j : (j as Shell).internal?.('greenhouse');
  const pg = target?.state.postgres as PostgresState | undefined;
  const t = pg?.bases.seeds?.tables.lendings;
  if (!t || pg?.bases.seeds.readOnly) return;
  if (target === j && smf(j).services[PG_FMRI]?.state !== 'online') return;
  const id = String(Math.max(0, ...t.lines.map((l) => Number(l[0]))) + 1);
  t.lines.push([id, String((Number(id) % 10) + 1), String((Number(id) % 5) + 1), '2029-11-20']);
}

const RELEASE = `                       Oracle Solaris 10 1/13 s10s_u11wos_24a SPARC
  Copyright (c) 1983, 2013, Oracle and/or its affiliates. All rights reserved.
                            Assembled 17 January 2013`;

const SUDOERS = `## sudo from sunfreeware.com (/usr/local/etc/sudoers), installed by Odette.
root ALL=(ALL) ALL
you ALL=(ALL) ALL`;

const APP_CONF_TEXT = `; Seed library catalogue - Odette, 2009
[database]
db_host = localhost
db_name = seeds
db_user = catalogue`;

/** Odette's weekly "backup": a tar of the data directory, taken while the server ran. */
const weeklyTar = (): File => ({
  type: 'file',
  content: '',
  size: 2_412_544_000,
  owner: 'root',
  mode: 'rw-r--r--',
  archive: {
    compressed: false,
    files: {
      'data_64/PG_VERSION': { type: 'file', content: '8.4', lines: true, owner: 'postgres' },
      'data_64/global/pg_control': { type: 'file', content: '(binary, big-endian)', owner: 'postgres', size: 8192 },
      'data_64/base/16384/2619': { type: 'file', content: '(binary)', owner: 'postgres', size: 106_496 },
      'data_64/postgresql.conf': { type: 'file', content: "listen_addresses = 'localhost'\nport = 5432", lines: true, owner: 'postgres' },
    },
  },
});

export function herbariumWorld(t: Translate, o: { home: Record<string, Node>; appConf?: string }): Directory {
  const herbarium = storyMachine('old-sun')!;
  const root = { owner: 'root', group: 'sys' };
  return d(
    {
      bin: d({ sh: f('(binary)', { owner: 'root', group: 'bin', mode: 'r-xr-xr-x' }) }, undefined, root),
      etc: d(
        {
          ...accountsFiles(),
          release: f(RELEASE, { lines: true, owner: 'root' }),
          nodename: f(machineName(t, 'herbarium'), { lines: true, owner: 'root' }),
          hosts: f(`127.0.0.1\tlocalhost\n${ADDRESS}\therbarium herbarium.internal loghost\n${GREENHOUSE}\tgreenhouse greenhouse.internal`, { lines: true, owner: 'root' }),
          opt: d({ 'seed-catalogue': d({ 'catalogue.ini': f(o.appConf ?? APP_CONF_TEXT, { lines: true, owner: 'root', group: 'webservd' }) }, undefined, root) }, undefined, root),
        },
        undefined,
        root,
      ),
      export: d(
        {
          home: d(
            {
              you: d({
                ...o.home,
                '.ssh': d(
                  {
                    authorized_keys: f(publicKey(herbarium, 'you'), { lines: true, mode: 'rw-------' }),
                    id_ed25519: f(KEY.isPrivate, { lines: true, mode: 'rw-------' }),
                    'id_ed25519.pub': f(KEY.isPublic, { lines: true }),
                  },
                  undefined,
                  { mode: 'rwx------' },
                ),
              }),
            },
            undefined,
            root,
          ),
          backup: d({ 'pgdata-weekly.tar': weeklyTar() }, undefined, root),
        },
        undefined,
        root,
      ),
      usr: d(
        {
          local: d({ etc: d({ sudoers: f(SUDOERS, { lines: true, owner: 'root', mode: 'r--r-----' }) }, undefined, root) }, undefined, root),
          xpg4: d({ bin: d({ grep: f('(binary)', { owner: 'root', mode: 'r-xr-xr-x' }) }, undefined, root) }, undefined, root),
          bin: d({ bash: f('(binary)', { owner: 'root', mode: 'r-xr-xr-x' }) }, undefined, root),
        },
        undefined,
        root,
      ),
      var: d(
        {
          postgres: d(
            { '8.4': d({ data_64: d({ PG_VERSION: f('8.4', { lines: true, owner: 'postgres' }) }, undefined, { owner: 'postgres', group: 'postgres', mode: 'rwx------' }) }, undefined, { owner: 'postgres', group: 'postgres' }) },
            undefined,
            { owner: 'postgres', group: 'postgres' },
          ),
        },
        undefined,
        root,
      ),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
    },
    undefined,
    root,
  );
}

// ——— greenhouse: Debian, PostgreSQL 16 ———

const greenhouseAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    postgres: { uid: 115, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
  },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you'] },
    you: { gid: 1000, members: [] },
    postgres: { gid: 122, members: [] },
  },
});

export const GREENHOUSE_COMMANDS = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'uname', 'file', 'iconv', 'tar', 'psql',
  'createdb', 'dropdb', 'pg_ctl', 'pg_lsclusters', 'systemctl', 'exit', 'ls', 'mv', 'cp', 'rm', 'sed', 'diff',
];

export function greenhouseHost(o: { seeds?: () => Record<string, Table>; commands: string[] }): InternalHost {
  return {
    address: GREENHOUSE,
    domain: 'greenhouse.internal',
    accounts: greenhouseAccounts,
    commands: o.commands,
    state: () => ({
      systemd: newSystemd('greenhouse', Date.UTC(2029, 10, 18, 9, 0, 0), NOW, {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(640, 'root', 'sshd: /usr/sbin/sshd -D')] },
        postgresql: { description: 'PostgreSQL RDBMS', active: true, executable: 'postgres', process: [proc(702, 'postgres', '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main')] },
      }),
      process: [proc(1, 'root', '/sbin/init'), proc(640, 'root', 'sshd: /usr/sbin/sshd -D'), proc(702, 'postgres', '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main')],
      postgres: {
        roles: ['postgres', 'catalogue'],
        archives: {},
        bases: { postgres: { owner: 'postgres', tables: {} }, ...(o.seeds ? { seeds: { owner: 'catalogue', tables: o.seeds() } } : {}) },
      } satisfies PostgresState,
    }),
    createWorld: () =>
      d(
        {
          etc: d(
            {
              ...accountsFiles(),
              hostname: f('greenhouse', { lines: true }),
              sudoers: f('root ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL', { lines: true, owner: 'root', mode: 'r--r-----' }),
            },
            undefined,
            { owner: 'root' },
          ),
          home: d({ you: d({ '.ssh': d({ authorized_keys: f(KEY.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }, undefined, { owner: 'root' }),
          var: d(
            {
              lib: d(
                { postgresql: d({ '16': d({ main: d({ PG_VERSION: f('16', { lines: true, owner: 'postgres' }) }, undefined, { owner: 'postgres', mode: 'rwx------' }) }, undefined, { owner: 'postgres' }) }, undefined, { owner: 'postgres' }) },
                undefined,
                { owner: 'root' },
              ),
            },
            undefined,
            { owner: 'root' },
          ),
          tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
        },
        undefined,
        { owner: 'root' },
      ),
  };
}

/** The greenhouse session, once you have been there. */
export const greenhouse = (j: Game): Shell | null => (j as Shell).internal('greenhouse');
export const seedsOn = (s: Game | null) => (s?.state.postgres as PostgresState | undefined)?.bases.seeds;
export type { Translate };
