// Story "The Hostel": what its chapters share. A cooperative youth hostel
// keeps the secrets of its booking site, Bunks, in OpenBao on padlock
// (cadenas in French, candado in Spanish; 192.0.2.226, RFC 5737), a Debian
// 13 server: the database password and the payment provider's API key in
// the KV store secret/, read by Bunks when it starts with the token of
// /etc/bunks/bunks.env. Ruslan, the volunteer who installed it, initialised
// the server with five key shares and a threshold of three (Desta, Ruslan,
// Hiroko, Nnamdi and you each hold one) and is away; Desta runs the hostel.
// Chapter 1: a power cut at night; OpenBao came back sealed and Bunks gave
// up: status, three shares (one of them blurred), Bunks restarted, its
// health checked. Chapter 2: Bunks reads its secrets with the root token
// (in bunks.env since the install): a policy for Bunks alone, a token with
// that policy and a TTL, the app restarted with it, the root token revoked.
// Chapter 3: Bunks's token was pasted in a public forum post: lookup, the
// audit log (what it read, and from where), revoke, a new token, the
// payment key rotated without losing the other field.
// Sources: https://openbao.org/docs/concepts/seal/,
// https://openbao.org/docs/concepts/tokens/,
// https://openbao.org/docs/concepts/policies/,
// https://openbao.org/docs/secrets/kv/kv-v2/,
// https://openbao.org/docs/audit/, https://openbao.org/docs/commands/.

import { accountsFiles, d, f, type Accounts, type Directory, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, writeLog } from '../systemd';
import { machineName } from '../machines';
import type { Process } from '../commands/system';
import { sha256 } from '../commands/checksums';
import { VERSION, bao, base62, capabilitiesOf, lookupToken, mint, newBao, request, seal, type BaoToken } from '../openbao';

export const HOME = '/home/you';
export const PASSWORD = 'bunk-bed-42';
export const IP = '192.0.2.226';
export const ENV = '/etc/bunks/bunks.env';
export const AUDIT = '/var/log/openbao/audit.log';
export const SITE = 'book.hostel.example';
export const APP_PORT = 8080;
// The secrets Bunks reads, and the paths a narrow policy must refuse.
export const DB_PATH = 'secret/data/bunks/db';
export const PAY_PATH = 'secret/data/bunks/payments';
export const OTHERS = ['secret/data/treasurer/bank', 'secret/data/wifi/guests', 'secret/metadata/', 'sys/policies/acl/bunks', 'auth/token/create'];
// The real database password, and the payment provider's keys (the old one stays valid until revoked).
export const DB_PASSWORD = 'Cobble-Lane-db-7731';
export const OLD_API_KEY = 'pk_hostel_4Qm8Zt2Lw9Xc';
export const NEW_API_KEY = 'pk_hostel_7Rk3Vn6Hy1Bd';
export const ACCOUNT = 'HOSTEL-0412';
// The attacker of chapter 3 (RFC 5737's TEST-NET-3), and Hiroko's laptop.
export const ATTACKER = '203.0.113.77';
export const HIROKO_LAPTOP = '192.0.2.231';

export type ChapterNo = 1 | 2 | 3;
// Local time read as UTC: Saturday 6 March 2027 07:40 (after a cut at 03:12); Tuesday 9 March 10:15; Monday 22 March 16:45.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2027, 2, 6, 7, 40, 0), 2: Date.UTC(2027, 2, 9, 10, 15, 0), 3: Date.UTC(2027, 2, 22, 16, 45, 0) };
const BOOT: Record<ChapterNo, number> = { 1: Date.UTC(2027, 2, 6, 3, 58, 12), 2: Date.UTC(2027, 2, 6, 3, 58, 12), 3: Date.UTC(2027, 2, 14, 6, 2, 41) };
const INIT = Date.UTC(2027, 1, 14, 16, 20, 5);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ——— The shares (base64 of 33 bytes, like Shamir's shares of a 32-byte key) ———

const b64 = (hex: string) => {
  const bytes = new Uint8Array(33);
  for (let i = 0; i < 33; i++) bytes[i] = parseInt(hex.slice((i * 2) % 64, ((i * 2) % 64) + 2), 16);
  let s = '';
  bytes.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s);
};
const share = (n: number) => b64(sha256(new TextEncoder().encode(`hostel:share:${n}`)));
/** The five shares: 1 Desta, 2 Ruslan, 3 you, 4 Hiroko, 5 Nnamdi. */
export const SHARES = [1, 2, 3, 4, 5].map(share);
/** Desta's share as she read it from a blurred photo: one character wrong. */
export const BLURRED = (() => {
  const s = SHARES[0];
  const i = 17;
  return s.slice(0, i) + (s[i] === 'Q' ? 'O' : 'Q') + s.slice(i + 1);
})();

// ——— Tokens and policies ———

const seed = (s: string) => `hostel:${s}`;
// The same derivation as openbao.ts's mint().
const tokenId = (name: string) => `s.${base62(`token:${seed(name)}`)}`;
export const ROOT_TOKEN = tokenId('root');
export const ADMIN_TOKEN = tokenId('admin-you');
export const LEAKED_TOKEN = tokenId('bunks-0309');

export const ADMIN_POLICY = `# The hostel's administrators: one orphan token each (Ruslan, February 2027).
# Everything on the KV store, the policies, the tokens, the audit device.
path "secret/*" {
  capabilities = ["create", "read", "update", "patch", "delete", "list"]
}
path "sys/policies/acl" {
  capabilities = ["list"]
}
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "auth/token/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
path "sys/capabilities" {
  capabilities = ["update"]
}
path "sys/audit" {
  capabilities = ["read", "sudo"]
}
path "sys/audit-hash/*" {
  capabilities = ["update"]
}
path "sys/mounts" {
  capabilities = ["read"]
}
`;
export const TREASURER_POLICY = `# Hiroko, the treasurer: the bank's details, nothing else.
path "secret/data/treasurer/*" {
  capabilities = ["create", "read", "update", "patch"]
}
path "secret/metadata/treasurer/*" {
  capabilities = ["read", "list"]
}
`;
/** The policy you wrote in chapter 2 (as the next chapters find it). */
export const BUNKS_POLICY = `# Bunks, the booking site: read its own secrets, nothing else.
path "secret/data/bunks/*" {
  capabilities = ["read"]
}
`;

// ——— Accounts and files ———

export const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    openbao: { uid: 997, group: 'openbao', home: '/home/openbao', shell: '/bin/false' },
    bunks: { uid: 996, group: 'bunks', home: '/opt/bunks', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    desta: { uid: 1001, group: 'desta' },
    ruslan: { uid: 1002, group: 'ruslan' },
    nnamdi: { uid: 1003, group: 'nnamdi' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'desta'] },
    sudo: { gid: 27, members: ['you', 'desta', 'ruslan'] },
    openbao: { gid: 997, members: [] },
    bunks: { gid: 996, members: [] },
    you: { gid: 1000, members: [] },
    desta: { gid: 1001, members: [] },
    ruslan: { gid: 1002, members: [] },
    nnamdi: { gid: 1003, members: [] },
  },
});

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
const bin = (size: number, owner = 'root') => f('', { owner, mode: 'rwxr-xr-x', size, charset: 'binary' });

// The package's own files (OpenBao's .deb, .release/linux/package).
const OPENBAO_HCL = `# Full configuration options can be found at https://openbao.org/docs/configuration.

ui = true

# Read about other storage backends at https://openbao.org/docs/configuration/storage.
storage "pebbledb" {
  path = "/opt/openbao/data"
}

# HTTPS listener:
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/opt/openbao/tls/tls.crt"
  tls_key_file  = "/opt/openbao/tls/tls.key"
}

# Ruslan, February 2027: every request and response, one JSON object per
# line, secrets HMAC'd (bao write sys/audit-hash/file input=...).
audit "file" "file" {
  options {
    file_path = "${AUDIT}"
  }
}
`;
const OPENBAO_SERVICE = `[Unit]
Description="OpenBao - A tool for managing secrets"
Documentation=https://github.com/openbao/openbao/tree/main/website/content/docs
Requires=network-online.target
After=network-online.target
ConditionFileNotEmpty=/etc/openbao/openbao.hcl
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=notify
EnvironmentFile=/etc/openbao/openbao.env
User=openbao
Group=openbao
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=yes
PrivateDevices=yes
SecureBits=keep-caps
CapabilityBoundingSet=CAP_SYSLOG
NoNewPrivileges=yes
ExecStart=/usr/bin/bao server -config=/etc/openbao/openbao.hcl
ExecReload=/bin/kill --signal HUP $MAINPID
KillMode=process
KillSignal=SIGINT
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
MemorySwapMax=0

[Install]
WantedBy=multi-user.target`;
const BUNKS_SERVICE = `[Unit]
Description=Bunks, the hostel's booking site
Wants=network-online.target
After=network-online.target openbao.service

[Service]
User=bunks
Group=bunks
# The OpenBao address and token, and where the secrets are (read at start).
EnvironmentFile=${ENV}
ExecStart=/opt/bunks/bin/bunks
Restart=on-failure
RestartSec=30
StartLimitBurst=5

[Install]
WantedBy=multi-user.target`;

export function envText(token: string): string {
  return `# Bunks's settings, read when the service starts (Ruslan, February 2027).
BAO_ADDR=https://127.0.0.1:8200
BAO_TOKEN=${token}
BUNKS_SECRET_DB=${DB_PATH}
BUNKS_SECRET_PAYMENTS=${PAY_PATH}
BUNKS_LISTEN=127.0.0.1:${APP_PORT}`;
}

export interface WorldOptions {
  home: Record<string, Node>;
  // /media/usb, the player's key (chapter 1).
  usb?: Record<string, Node>;
}

export function padlockWorld(t: Translate, n: ChapterNo, o: WorldOptions): Directory {
  const host = machineName(t, 'padlock');
  const you: Rights = { owner: 'you', group: 'you' };
  const appToken = n === 3 ? LEAKED_TOKEN : ROOT_TOKEN;
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(host),
      hosts: file(`127.0.0.1\tlocalhost\n${IP}\t${host}.internal ${host}\n\n::1\tlocalhost ip6-localhost ip6-loopback`),
      openbao: dir(
        {
          'openbao.hcl': file(OPENBAO_HCL, { owner: 'openbao', group: 'openbao', mode: 'rw-r--r--' }),
          'openbao.env': file('# Environment variables for the OpenBao server (see openbao.service).', { owner: 'openbao', group: 'openbao', mode: 'rw-r--r--' }),
        },
        { owner: 'openbao', group: 'openbao', mode: 'rwxr-xr-x' },
      ),
      bunks: dir({ 'bunks.env': file(envText(appToken), { owner: 'root', group: 'bunks', mode: 'rw-r-----' }) }, { owner: 'root', group: 'bunks', mode: 'rwxr-x---' }),
      systemd: dir({ system: dir({ 'bunks.service': file(BUNKS_SERVICE) }) }),
    }),
    home: dir({
      you: d({ ...o.home, '.vault-token': f(ADMIN_TOKEN, { lines: true, owner: 'you', group: 'you', mode: 'rw-------' }) }, undefined, you),
      desta: dir({}, { owner: 'desta', group: 'desta', mode: 'rwx------' }),
      ruslan: dir({}, { owner: 'ruslan', group: 'ruslan', mode: 'rwx------' }),
      nnamdi: dir({}, { owner: 'nnamdi', group: 'nnamdi', mode: 'rwx------' }),
    }),
    media: dir(o.usb ? { usb: dir(o.usb, { owner: 'you', group: 'you', mode: 'rwx------' }) } : {}),
    opt: dir({
      openbao: dir(
        {
          data: dir({ 'pebble.db': f('', { owner: 'openbao', group: 'openbao', mode: 'rw-------', size: 3_211_264, charset: 'binary' }) }, { owner: 'openbao', group: 'openbao', mode: 'rwx------' }),
          tls: dir(
            { 'tls.crt': f('', { owner: 'openbao', group: 'openbao', mode: 'rw-------', size: 1972 }), 'tls.key': f('', { owner: 'openbao', group: 'openbao', mode: 'rw-------', size: 3272 }) },
            { owner: 'openbao', group: 'openbao', mode: 'rwx------' },
          ),
        },
        { owner: 'openbao', group: 'openbao', mode: 'rwxr-xr-x' },
      ),
      bunks: dir({ bin: dir({ bunks: bin(18_403_328) }) }, { owner: 'root', group: 'bunks', mode: 'rwxr-x---' }),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: dir({
      bin: dir({ bao: bin(176_455_832) }),
      lib: dir({ systemd: dir({ system: dir({ 'openbao.service': file(OPENBAO_SERVICE) }) }) }),
      share: dir({ doc: dir({ openbao: dir({ copyright: file('Mozilla Public License, version 2.0') }) }) }),
    }),
    var: dir({
      log: dir({ openbao: dir({ 'audit.log': f((g) => auditOf(g), { lines: true, owner: 'openbao', group: 'openbao', mode: 'rw-------' }) }, { owner: 'openbao', group: 'openbao', mode: 'rwx------' }) }),
    }),
  });
}
const auditOf = (g: Game) => bao(g)?.auditLines.join('\n') ?? '';

// ——— The machine's state ———

const proc = (pid: number, user: string, command: string, more: Partial<Process> = {}): Process => ({ pid, user, cpu: 0, mem: 0.6, command, ...more });
export const BAO_PID = 701;
export const BUNKS_PID = 842;

export interface Story {
  chapter: ChapterNo;
  // Bunks as it runs: the token it started with, what it read.
  running: { token: string; at: number } | null;
  // The health checks (curl) made, and when.
  health: { ok: boolean; at: number; path: string }[];
  // The player's admin token was given again (after revoking it).
  adminGiven?: number;
  // OpenBao was restarted (chapters 2 and 3): the share holders came to unseal it.
  resealed?: number;
}
export const story = (g: Game) => (g as Shell).principal.state.hostel as Story;

export function padlockState(t: Translate, n: ChapterNo) {
  const host = machineName(t, 'padlock');
  return {
    systemd: newSystemd(host, BOOT[n], NOW[n], {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(612, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
      openbao: {
        description: '"OpenBao - A tool for managing secrets"',
        active: true,
        executable: 'bao',
        process: [proc(BAO_PID, 'openbao', '/usr/bin/bao server -config=/etc/openbao/openbao.hcl', { mem: 2.1 })],
        unitFile: '/usr/lib/systemd/system/openbao.service',
        // A start (or restart) leaves the server sealed; a reload (SIGHUP) doesn't.
        check: (g) => {
          seal(g);
          return null;
        },
        load: (g) => writeLog(systemd(g)!, 'openbao.service', 'bao', BAO_PID, '[INFO]  core: vault is sealed', 6, false),
        stop: (g) => seal(g),
      },
      bunks: {
        description: "Bunks, the hostel's booking site",
        active: true,
        executable: 'bunks',
        process: [proc(BUNKS_PID, 'bunks', '/opt/bunks/bin/bunks', { mem: 1.2 })],
        // A unit written for the hostel (in /etc), modelled by the story.
        file: '/etc/systemd/system/bunks.service',
        modelled: true,
        check: (g) => bunksStart(g),
        load: (g) => bunksLoaded(g),
        stop: (g) => {
          story(g).running = null;
        },
        restartSec: 30_000,
        startLimitBurst: 5,
      },
    }),
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
      { proto: 'tcp', address: '0.0.0.0', port: 8200, process: 'bao', pid: BAO_PID },
      { proto: 'tcp', address: '0.0.0.0', port: 8201, process: 'bao', pid: BAO_PID },
      { proto: 'tcp', address: '127.0.0.1', port: APP_PORT, process: 'bunks', pid: BUNKS_PID },
    ],
    apt: { installed: { openbao: VERSION } },
    hostel: { chapter: n, running: null, health: [] } satisfies Story,
    storyCurl,
  };
}

// ——— Bunks: what it does when it starts ———

/** KEY=VALUE lines (systemd's EnvironmentFile=). */
export function readEnv(text: string | null): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of (text ?? '').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return env;
}

/** Bunks reads its two secrets with its token; null if all is well, otherwise the lines it logs before exiting. */
export function bunksStart(g: Game): string[] | null {
  const p = (g as Shell).principal;
  const env = readEnv(p.read(ENV));
  const token = env.BAO_TOKEN;
  if (!token) return [`level=error msg="BAO_TOKEN is not set" file=${ENV}`];
  const read = (path: string): Record<string, string> | string => {
    const r = request(p, { method: 'GET', path, token, remote: '127.0.0.1' });
    if (r.refused) return `level=error msg="cannot read secret" path=${path} error="dial tcp 127.0.0.1:8200: connect: connection refused"`;
    if (r.status === 503) return `level=error msg="cannot read secret" path=${path} status=503 error="Vault is sealed"`;
    if (r.status === 403) return `level=error msg="cannot read secret" path=${path} status=403 error="permission denied"`;
    if (r.status === 404) return `level=error msg="cannot read secret" path=${path} status=404 error="no value found"`;
    return ((r.data ?? {}).data ?? {}) as Record<string, string>;
  };
  const db = read(env.BUNKS_SECRET_DB ?? DB_PATH);
  if (typeof db === 'string') return [db];
  const pay = read(env.BUNKS_SECRET_PAYMENTS ?? PAY_PATH);
  if (typeof pay === 'string') return [pay];
  if (db.password !== DB_PASSWORD) return [`level=error msg="database connection failed" error="pq: password authentication failed for user \\"bunks\\""`];
  if (!pay.account) return [`level=error msg="payments: missing field" path=${PAY_PATH} field=account`];
  if (!pay.api_key) return [`level=error msg="payments: missing field" path=${PAY_PATH} field=api_key`];
  if (![OLD_API_KEY, NEW_API_KEY].includes(pay.api_key)) return [`level=error msg="payments: provider refused the key" status=401 error="invalid API key"`];
  story(g).running = { token, at: systemd(p)!.clock };
  return null;
}
function bunksLoaded(g: Game) {
  const sd = systemd(g)!;
  const t = lookupToken(g, story(g).running?.token);
  writeLog(sd, 'bunks.service', 'bunks', BUNKS_PID, `level=info msg="secrets loaded from OpenBao" policies="${t?.policies.join(' ') ?? ''}"`, 6, false);
  writeLog(sd, 'bunks.service', 'bunks', BUNKS_PID, `level=info msg="listening" addr=127.0.0.1:${APP_PORT}`, 6, false);
}

export const bunksUp = (g: Game) => systemd((g as Shell).principal)!.services.bunks.state === 'active';
/** The token Bunks runs with, if it still exists. */
export const runningToken = (g: Game): BaoToken | null => {
  const r = story(g).running;
  return r ? lookupToken(g, r.token) : null;
};
/** A token that reads Bunks's secrets and nothing else: no write there, none of the other paths. */
export function narrow(g: Game, t: BaoToken | null): boolean {
  if (!t) return false;
  const b = bao(g)!;
  const caps = (path: string) => capabilitiesOf(b, t.policies, path);
  if (!caps(DB_PATH).includes('read') || !caps(PAY_PATH).includes('read')) return false;
  for (const p of [DB_PATH, PAY_PATH]) if (caps(p).some((c) => ['root', 'create', 'update', 'patch', 'delete', 'sudo'].includes(c))) return false;
  return OTHERS.every((p) => caps(p).join() === 'deny');
}
/** Does Bunks answer, healthy? */
export const healthy = (g: Game) => bunksUp(g) && !!runningToken(g);

// ——— curl towards Bunks ———

const CURL_WITH_VALUE = ['-H', '--header', '-o', '--output', '-w', '--write-out', '-X', '--request', '-A', '--user-agent', '-m', '--max-time', '--connect-timeout'];

export function storyCurl(from: Shell, args: string[]): string | null {
  let writeOut: string | null = null;
  let output: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (CURL_WITH_VALUE.includes(args[i])) {
      const v = args[++i] ?? '';
      if (args[i - 1] === '-w' || args[i - 1] === '--write-out') writeOut = v;
      if (args[i - 1] === '-o' || args[i - 1] === '--output') output = v;
    } else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(.*)$/.exec(positional[0] ?? '');
  if (!m) return null;
  const target = m[2].toLowerCase();
  const host = from.principal.hostName;
  const port = Number(m[3] ?? (m[1] === 'https' ? 443 : 80));
  const names = ['localhost', '127.0.0.1', IP, host, `${host}.internal`, SITE];
  if (!names.includes(target)) return null;
  const path = m[4] || '/';
  const refused = () => from.error(`curl: (7) Failed to connect to ${target} port ${port} after 0 ms: Couldn't connect to server`, 7);
  // OpenBao's listener: the API's health, as curl sees it (the certificate is the package's self-signed one).
  if (port === 8200) {
    if (!args.includes('-k') && !args.includes('--insecure'))
      return from.error(`curl: (60) SSL certificate problem: self-signed certificate\nMore details here: https://curl.se/docs/sslcerts.html\n\ncurl failed to verify the legitimacy of the server and therefore could not\nestablish a secure connection to it. To learn more about this situation and\nhow to fix it, please visit the webpage mentioned above.`, 60);
    const r = request(from.principal, { method: 'GET', path: 'sys/seal-status' });
    if (r.refused) return refused();
    return JSON.stringify(r.data);
  }
  // Bunks listens on 127.0.0.1:8080 only.
  if (port !== APP_PORT || !['localhost', '127.0.0.1'].includes(target)) return refused();
  const s = story(from);
  if (!bunksUp(from)) {
    s.health.push({ ok: false, at: systemd(from.principal)!.clock, path });
    return refused();
  }
  const ok = !!runningToken(from);
  s.health.push({ ok, at: systemd(from.principal)!.clock, path });
  let code = 200;
  let body: string;
  if (path === '/health' || path === '/healthz') {
    body = ok ? '{"status":"ok","openbao":"ok","database":"ok","payments":"ok"}' : '{"status":"degraded","openbao":"token invalid","database":"ok","payments":"ok"}';
    if (!ok) code = 503;
  } else if (path === '/' || path === '/index.html') body = '<!doctype html><title>Bunks</title><h1>Book a bed</h1><p>14 beds free tonight.</p>';
  else {
    code = 404;
    body = '404 page not found';
  }
  const after = writeOut === null ? '' : writeOut.replace(/%\{(http_code|response_code)\}/g, String(code)).replace(/\\n/g, '\n');
  if (output === '/dev/null') return after;
  return `${body}${after}`;
}

// ——— Starting a chapter ———

/** The server's state at the start of a chapter: tokens, policies, the KV store, the past in the audit log. */
export function initialiseStory(j: Game, n: ChapterNo) {
  const p = j as Shell;
  const sd = systemd(p)!;
  // Unsealed while the past is replayed; chapter 1 starts sealed.
  const b = newBao({ shares: SHARES, threshold: 3, sealed: false, salt: 'hostel', auditFile: AUDIT, seed: 'hostel' });
  p.state.bao = b;
  b.policies = { admin: ADMIN_POLICY, treasurer: TREASURER_POLICY, ...(n === 3 ? { bunks: BUNKS_POLICY } : {}) };
  const at = (time: number, f: () => void) => {
    const clock = sd.clock;
    sd.clock = time;
    f();
    sd.clock = clock;
  };
  // The tokens: root from the init (revoked at the end of chapter 2), yours, Hiroko's.
  if (n < 3) mint(b, seed('root'), { policies: ['root'], displayName: 'root', path: 'auth/token/root', parent: null, created: INIT, ttl: 0 });
  mint(b, seed('admin-you'), { policies: ['admin', 'default'], displayName: 'token-you', path: 'auth/token/create-orphan', parent: null, created: NOW[n] - 2 * DAY, ttl: 768 * 3600 });
  const hiroko = mint(b, seed('treasurer-hiroko'), { policies: ['default', 'treasurer'], displayName: 'token-hiroko', path: 'auth/token/create-orphan', parent: null, created: NOW[n] - 3 * DAY, ttl: 768 * 3600 });
  if (n === 3) mint(b, seed('bunks-0309'), { policies: ['bunks', 'default'], displayName: 'token-bunks', path: 'auth/token/create', parent: ADMIN_TOKEN, created: Date.UTC(2027, 2, 9, 10, 52, 0), ttl: 768 * 3600 });
  // The KV store.
  const kv = (key: string, created: number, ...versions: Record<string, string>[]) => {
    b.kv[key] = { created, versions: versions.map((data, i) => ({ data, created: created + i * 3 * DAY })) };
  };
  kv('bunks/db', INIT + 20 * MINUTE, { username: 'bunks', password: DB_PASSWORD });
  kv('bunks/payments', INIT + 22 * MINUTE, { account: ACCOUNT, api_key: OLD_API_KEY });
  kv('treasurer/bank', INIT + 2 * DAY, { iban: 'XX00 0000 0000 0412', login: 'hostel-coop', password: 'Ledger-Pine-2207' });
  kv('wifi/guests', INIT + 25 * MINUTE, { ssid: 'Hostel-Guests', psk: 'bunkbeds-and-breakfast' });
  // The past, in the audit log: Bunks starting, Hiroko at work, and (chapter 3) the leak.
  const bunksRead = (time: number, token: string) =>
    at(time, () => {
      request(p, { method: 'GET', path: DB_PATH, token, remote: '127.0.0.1' });
      request(p, { method: 'GET', path: PAY_PATH, token, remote: '127.0.0.1' });
    });
  if (n < 3) {
    bunksRead(Date.UTC(2027, 1, 14, 17, 2, 11), ROOT_TOKEN);
    at(Date.UTC(2027, 1, 18, 9, 30, 2), () => request(p, { method: 'GET', path: 'secret/data/treasurer/bank', token: hiroko.id, remote: HIROKO_LAPTOP }));
    if (n === 2) bunksRead(BOOT[2] + 8 * HOUR, ROOT_TOKEN);
  } else {
    bunksRead(Date.UTC(2027, 2, 9, 10, 53, 4), LEAKED_TOKEN);
    bunksRead(BOOT[3] + 41_000, LEAKED_TOKEN);
    at(Date.UTC(2027, 2, 18, 9, 30, 2), () => request(p, { method: 'GET', path: 'secret/data/treasurer/bank', token: hiroko.id, remote: HIROKO_LAPTOP }));
    // 14:02 the forum post; 14:31 someone tries the token from the internet.
    const step = (minute: number, second: number, f: () => void) => at(Date.UTC(2027, 2, 22, 14, minute, second), f);
    step(31, 7, () => request(p, { method: 'GET', path: 'auth/token/lookup-self', token: LEAKED_TOKEN, remote: ATTACKER }));
    step(31, 40, () => request(p, { method: 'LIST', path: 'secret/metadata/', token: LEAKED_TOKEN, remote: ATTACKER }));
    step(32, 2, () => request(p, { method: 'GET', path: 'sys/internal/ui/mounts/secret/bunks/payments', token: LEAKED_TOKEN, remote: ATTACKER }));
    step(32, 3, () => request(p, { method: 'GET', path: PAY_PATH, token: LEAKED_TOKEN, remote: ATTACKER }));
    step(33, 15, () => request(p, { method: 'GET', path: 'secret/data/treasurer/bank', token: LEAKED_TOKEN, remote: ATTACKER }));
    step(34, 51, () => request(p, { method: 'LIST', path: 'sys/policies/acl', token: LEAKED_TOKEN, remote: ATTACKER }));
    step(35, 20, () => request(p, { method: 'POST', path: 'auth/token/create', token: LEAKED_TOKEN, remote: ATTACKER, data: { policies: ['admin'] } }));
  }
  b.runs = [];
  b.sealed = n === 1;
  // The unit file as systemd loaded it (no daemon-reload needed at the start).
  sd.services.bunks.overridesFingerprint = `/etc/systemd/system/bunks.service\n${p.read('/etc/systemd/system/bunks.service') ?? ''}`;
  // Bunks: running (chapters 2 and 3), or given up after the cut (chapter 1).
  const s = story(p);
  const bunks = sd.services.bunks;
  if (n === 1) {
    // The cut at 03:12, the boot at 03:58: OpenBao sealed, Bunks's five tries.
    let time = BOOT[1] + 9000;
    for (let k = 0; k < 5; k++) {
      sd.log.push({ time, boot: sd.boot, unit: 'bunks.service', ident: 'systemd', pid: 1, message: "Starting bunks.service - Bunks, the hostel's booking site...", priority: 6 });
      sd.log.push({ time: time + 400, boot: sd.boot, unit: 'bunks.service', ident: 'bunks', pid: BUNKS_PID + k * 11, message: `level=error msg="cannot read secret" path=${DB_PATH} status=503 error="Vault is sealed"`, priority: 3 });
      sd.log.push({ time: time + 400, boot: sd.boot, unit: 'bunks.service', ident: 'systemd', pid: 1, message: 'bunks.service: Main process exited, code=exited, status=1/FAILURE', priority: 4 });
      sd.log.push({ time: time + 400, boot: sd.boot, unit: 'bunks.service', ident: 'systemd', pid: 1, message: "bunks.service: Failed with result 'exit-code'.", priority: 4 });
      sd.log.push({ time: time + 400, boot: sd.boot, unit: 'bunks.service', ident: 'systemd', pid: 1, message: "Failed to start bunks.service - Bunks, the hostel's booking site.", priority: 3 });
      if (k < 4) sd.log.push({ time: time + 30_400, boot: sd.boot, unit: 'bunks.service', ident: 'systemd', pid: 1, message: `bunks.service: Scheduled restart job, restart counter is at ${k + 1}.`, priority: 6 });
      time += 30_400;
    }
    sd.log.push({ time, boot: sd.boot, unit: 'bunks.service', ident: 'systemd', pid: 1, message: 'bunks.service: Start request repeated too quickly.', priority: 4 });
    sd.log.push({ time, boot: sd.boot, unit: 'bunks.service', ident: 'systemd', pid: 1, message: "bunks.service: Failed with result 'start-limit-hit'.", priority: 4 });
    sd.log.push({ time, boot: sd.boot, unit: 'bunks.service', ident: 'systemd', pid: 1, message: "Failed to start bunks.service - Bunks, the hostel's booking site.", priority: 3 });
    sd.log.push({ time: BOOT[1] + 7000, boot: sd.boot, unit: 'openbao.service', ident: 'bao', pid: BAO_PID, message: '[INFO]  core: vault is sealed', priority: 6 });
    sd.log.push({ time: BOOT[1] + 1500, boot: sd.boot, unit: '', ident: 'kernel', pid: 0, message: 'ACPI: PM: Waking up after power failure', priority: 6 });
    sd.log.sort((a, b2) => a.time - b2.time);
    bunks.state = 'failed';
    bunks.result = 'start-limit-hit';
    bunks.since = time;
    p.state.process = ((p.state.process ?? []) as Process[]).filter((x) => x.pid !== BUNKS_PID);
    p.state.listening = (p.state.listening as { port: number }[]).filter((l) => l.port !== APP_PORT);
  } else {
    s.running = { token: n === 3 ? LEAKED_TOKEN : ROOT_TOKEN, at: BOOT[n] + 41_000 };
  }
}

/** Each command: twenty seconds; the player's admin token, if revoked, comes back from Desta. */
export function passTime(j: Game): string | void {
  const p = (j as Shell).principal;
  systemd(p)!.clock += 20_000;
  const b = bao(p);
  // After chapter 1, a restart of OpenBao isn't the lesson: the holders come and unseal it.
  if (b && b.sealed && story(p).chapter > 1 && systemd(p)!.services.openbao.state === 'active') {
    b.sealed = false;
    b.parts = [];
    story(p).resealed = systemd(p)!.clock;
  }
  if (b && !b.tokens[ADMIN_TOKEN] && b.revoked[ADMIN_TOKEN] && !story(p).adminGiven) {
    // Desta makes you a new admin token (orphan) and writes it to your token helper's file.
    const t = mint(b, seed('admin-you-again'), { policies: ['admin', 'default'], displayName: 'token-you', path: 'auth/token/create-orphan', parent: null, created: systemd(p)!.clock, ttl: 768 * 3600 });
    story(p).adminGiven = systemd(p)!.clock;
    const path = `${p.home}/.vault-token`;
    const node = p.find(path);
    if (node?.type === 'file') node.content = t.id;
    else p.place('bao', path, f(t.id, { lines: true, owner: p.player, group: p.player, mode: 'rw-------' }));
  }
}

// ——— Helpers for the chapters ———

export const typed = (j: Game) => (j as Shell).last.line ?? '';
/** The last command's output contains this; reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b|-help\b/.test(typed(j))) return false;
  const last = (j as Shell).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const runs = (j: Game) => bao(j)?.runs ?? [];
export const sealed = (j: Game) => !!bao(j)?.sealed;
/** A health check that answered ok after a moment (ms). */
export const checkedSince = (j: Game, since: number) => story(j).health.some((h) => h.ok && h.at >= since && (h.path === '/health' || h.path === '/healthz' || h.path === '/'));
