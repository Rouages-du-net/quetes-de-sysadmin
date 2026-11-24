// Story "The Mapping Party": what its chapters share. Wayfinders (the
// same name in every language) is a volunteer collective that maps the
// town's step-free routes for wheelchairs, prams and walking frames, and
// holds a mapping party every month. Its zone, wayfinders.example, is
// served by named on cairn (hito in Spanish, the story's machine,
// 192.0.2.176, RFC 5737), and kept as code: Yusra wrote an OpenTofu
// configuration in /srv/dns (the hashicorp/dns provider, dynamic updates
// signed with the TSIG key tofu-key), shared by the volunteers of the
// dnsadmins group, its state in /srv/dns/terraform.tfstate. Andile
// coordinates the collective, Dilnoza runs the tile server, Femi is on
// call.
// Chapter 1: a record for the mapping party's tile server, added by Andile
// with a typo and without its value: init, fmt, validate, a variable in
// terraform.tfvars, plan, apply, dig. Chapter 2: the old web host died one
// evening; Femi moved the site by hand (nsupdate), added a status page and
// left a `tofu apply` waiting for its "yes", which holds the state lock;
// the lock, the drift (update the code, don't revert the site) and an
// import.
// Sources: https://opentofu.org/docs/cli/commands/,
// https://opentofu.org/docs/language/state/locking/,
// https://opentofu.org/docs/cli/import/,
// https://search.opentofu.org/provider/hashicorp/dns/latest,
// https://bind9.readthedocs.io/en/stable/reference.html#dynamic-update-policies.

import { accountsFiles, d, f, type Accounts, type Directory, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd } from '../systemd';
import { machineName } from '../machines';
import { dns, reloadZones, type DnsState, type Rr } from '../dns';
import { DNS_VERSION, VERSION, dynamicUpdate, lockFileText, readRecord, readState, stateText, tofuOf, uuidOf, type Instance, type StateFile } from '../tofu';
import type { Process } from '../commands/system';

export const HOME = '/home/you';
export const PASSWORD = 'step-free-32';
export const DIR = '/srv/dns';
export const STATE = `${DIR}/terraform.tfstate`;
export const ZONE = 'wayfinders.example';
export const ZONE_FILE = `/var/lib/bind/db.${ZONE}`;
export const IP = '192.0.2.176';
export const TILES = '192.0.2.180';
export const OLD_WWW = '198.51.100.40';
export const NEW_WWW = '198.51.100.41';
export const STATUS = '198.51.100.42';
export const TSIG = 'd2F5ZmluZGVycy10b2Z1LWtleS0yMDMx';
// Femi's tofu apply (chapter 2), still waiting for its "yes", and its provider plugin.
export const FEMI_PID = 23817;
export const PLUGIN_PID = 23824;

export type ChapterNo = 1 | 2;
// Local time read as UTC (systemd's clock): Thursday 10 June 2032, 18:30; Friday 25 June, 9:10.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2032, 5, 10, 18, 30, 0), 2: Date.UTC(2032, 5, 25, 9, 10, 0) };
const BOOT: Record<ChapterNo, number> = { 1: Date.UTC(2032, 4, 28, 7, 12, 0), 2: Date.UTC(2032, 4, 28, 7, 12, 0) };
// Thursday 24 June: Femi's evening (local time).
export const FEMI_APPLY = Date.UTC(2032, 5, 24, 21, 41, 8);
export const FEMI_UPDATE = Date.UTC(2032, 5, 24, 21, 47, 30);

// ——— Helpers for the chapters ———

export const typed = (j: Game) => (j as Shell).last.line ?? '';
/** The last command's output contains this; reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b|-help\b/.test(typed(j))) return false;
  const last = (j as Shell).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const zone = (j: Game) => dns(j)!.primary[ZONE];
/** The records named NAME.wayfinders.example. of a type, as named serves them. */
export const served = (j: Game, name: string, type = 'A') => zone(j).rrs.filter((r) => r.name === `${name}.${ZONE}.` && r.type === type);
export const addressesOf = (j: Game, name: string) => served(j, name).map((r) => r.data).sort();
export const runs = (j: Game) => tofuOf(j as Shell).runs;
export const stateNow = (j: Game): StateFile | null => readState(j.read(STATE)).state;
/** The state's instance for a record name (whatever its resource name). */
export const managed = (j: Game, name: string, type = 'dns_a_record_set'): Instance | undefined => stateNow(j)?.resources.find((r) => r.type === type && r.attributes.name === name && r.attributes.zone === `${ZONE}.`);
/** A dig (or host) of that name that got this answer. */
export const looked = (j: Game, name: string, data: string) =>
  ((j.state.dnsQueries ?? []) as { name: string; data: string[] }[]).some((q) => q.name.replace(/\.?$/, '.') === `${name}.${ZONE}.` && q.data.includes(data));
/** The state file as tofu last wrote it (not edited by hand since). */
export const stateUntouched = (j: Game) => {
  const t = tofuOf(j as Shell);
  return t.written[STATE] === undefined || t.written[STATE] === j.read(STATE);
};

// ——— The configuration ———

const VERSIONS_TF = `terraform {
  required_version = ">= 1.10"

  required_providers {
    dns = {
      source  = "hashicorp/dns"
      version = "~> 3.6"
    }
  }
}
`;

const PROVIDER_TF = `# Dynamic updates (RFC 2136) to our own named, signed with the TSIG key
# tofu-key (see /etc/bind/tofu-key.key). The secret comes from
# secrets.auto.tfvars, which is never committed.
provider "dns" {
  update {
    server        = var.dns_server
    key_name      = "tofu-key."
    key_algorithm = "hmac-sha256"
    key_secret    = var.tsig_secret
  }
}
`;

const VARIABLES_TF = (n: ChapterNo) => `variable "zone" {
  description = "Our zone, with its final dot."
  type        = string
  default     = "${ZONE}."
}

variable "dns_server" {
  description = "Where the updates go: named, on this machine."
  type        = string
  default     = "127.0.0.1"
}

variable "tsig_secret" {
  description = "The secret of the TSIG key tofu-key."
  type        = string
  sensitive   = true
}

variable "tiles_address" {
  description = "${n === 1 ? "The address of Dilnoza's tile server (she will tell us)." : "The address of Dilnoza's tile server."}"
  type        = string
}
`;

const RECORDS_WWW_WIKI = `resource "dns_a_record_set" "www" {
  zone      = var.zone
  name      = "www"
  addresses = ["${OLD_WWW}"]
  ttl       = 300
}

resource "dns_cname_record" "wiki" {
  zone  = var.zone
  name  = "wiki"
  cname = "www.${ZONE}."
}
`;

// Chapter 1: Andile's block, a typo and no formatting.
const TILES_ANDILE = `
# Added by Andile for the mapping party: Dilnoza's tile server.
resource "dns_a_record_set" "tiles" {
zone = var.zone
    name = "tiles"
  adresses = [var.tiles_address]
  ttl= 300
}
`;
const TILES_DONE = `
# Dilnoza's tile server (the mapping parties).
resource "dns_a_record_set" "tiles" {
  zone      = var.zone
  name      = "tiles"
  addresses = [var.tiles_address]
  ttl       = 300
}
`;

const OUTPUTS_TF = `output "nameserver" {
  description = "The zone's name server."
  value       = "ns1.\${var.zone}"
}
`;

const TFVARS = (n: ChapterNo) =>
  n === 1
    ? `# Values for this configuration. The TSIG secret is in secrets.auto.tfvars
# (not committed).
dns_server = "127.0.0.1"
`
    : `# Values for this configuration. The TSIG secret is in secrets.auto.tfvars
# (not committed).
dns_server    = "127.0.0.1"
tiles_address = "${TILES}"
`;

const GITIGNORE = `.terraform/
*.tfstate
*.tfstate.*
secrets.auto.tfvars
`;

const NAMED_CONF_LOCAL = `//
// Do any local configuration here
//

// Our zone. Its changes come as dynamic updates signed with tofu-key
// (OpenTofu, /srv/dns): named keeps them in a journal (db.${ZONE}.jnl).
zone "${ZONE}" {
    type primary;
    file "${ZONE_FILE}";
    update-policy {
        grant tofu-key. zonesub ANY;
    };
};`;

const TSIG_KEY = `key "tofu-key." {
    algorithm hmac-sha256;
    secret "${TSIG}";
};`;

const ZONE_TEXT = `; wayfinders.example, loaded by named on cairn. A dynamic zone: its
; changes come from OpenTofu (/srv/dns) as signed updates, never by hand.
$TTL 3600
@       IN  SOA ns1.${ZONE}. hostmaster.${ZONE}. (
            2032052801 ; serial
            3600       ; refresh
            900        ; retry
            1209600    ; expire
            300 )      ; negative cache TTL
        IN  NS  ns1.${ZONE}.
ns1     IN  A   ${IP}
www 300 IN  A   ${OLD_WWW}
wiki    IN  CNAME www.${ZONE}.`;

// ——— The state of each chapter's start ———

const rec = (type: string, name: string, attributes: Record<string, string | number | string[]>): Instance => ({ type, name, attributes: { id: `${attributes.name}.${ZONE}.`, zone: `${ZONE}.`, ...attributes } });
export const LINEAGE = uuidOf('wayfinders:/srv/dns');

export function startState(n: ChapterNo): StateFile {
  const resources = [rec('dns_a_record_set', 'www', { name: 'www', addresses: [OLD_WWW], ttl: 300 }), rec('dns_cname_record', 'wiki', { name: 'wiki', cname: `www.${ZONE}.`, ttl: 3600 })];
  if (n === 2) resources.push(rec('dns_a_record_set', 'tiles', { name: 'tiles', addresses: [TILES], ttl: 300 }));
  return { serial: n === 1 ? 6 : 9, lineage: LINEAGE, outputs: { nameserver: { value: `ns1.${ZONE}.`, type: 'string' } }, resources };
}

// ——— Accounts and files ———

export const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    bind: { uid: 109, group: 'bind', home: '/var/cache/bind', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    andile: { uid: 1001, group: 'andile' },
    femi: { uid: 1002, group: 'femi' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'andile'] },
    bind: { gid: 109, members: [] },
    you: { gid: 1000, members: [] },
    andile: { gid: 1001, members: [] },
    femi: { gid: 1002, members: [] },
    dnsadmins: { gid: 1100, members: ['you', 'andile', 'femi'] },
  },
});

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
const shared = (text: string, owner = 'andile', mode = 'rw-rw-r--') => f(text, { lines: true, owner, group: 'dnsadmins', mode, mtime: Date.UTC(2032, 5, 9, 22, 4, 0) });

function srvDns(t: Translate, n: ChapterNo): Directory {
  const host = machineName(t, 'cairn');
  const children: Record<string, Node> = {
    '.gitignore': shared(GITIGNORE, 'andile'),
    'versions.tf': shared(VERSIONS_TF),
    'provider.tf': shared(PROVIDER_TF),
    'variables.tf': shared(VARIABLES_TF(n)),
    'records.tf': shared(RECORDS_WWW_WIKI + (n === 1 ? TILES_ANDILE : TILES_DONE)),
    'outputs.tf': shared(OUTPUTS_TF),
    'terraform.tfvars': shared(TFVARS(n)),
    'secrets.auto.tfvars': shared(`tsig_secret = "${TSIG}"`, 'andile', 'rw-rw----'),
    'terraform.tfstate': shared(stateText(startState(n)), n === 1 ? 'andile' : 'you', 'rw-rw-r--'),
    'terraform.tfstate.backup': shared(stateText({ ...startState(n), serial: startState(n).serial - 1 }), n === 1 ? 'andile' : 'you', 'rw-rw-r--'),
  };
  if (n === 2) {
    children['.terraform.lock.hcl'] = shared(lockFileText('~> 3.6'), 'you');
    const plugin = f('', { charset: 'binary', size: 22_417_560, owner: 'you', group: 'dnsadmins', mode: 'rwxr-xr-x' });
    const g: Rights = { owner: 'you', group: 'dnsadmins', mode: 'rwxrwsr-x' };
    children['.terraform'] = d({ providers: d({ 'registry.opentofu.org': d({ hashicorp: d({ dns: d({ [DNS_VERSION]: d({ linux_amd64: d({ [`terraform-provider-dns_v${DNS_VERSION}`]: plugin }, undefined, g) }, undefined, g) }, undefined, g) }, undefined, g) }, undefined, g) }, undefined, g) }, undefined, g);
    // Femi's apply holds the lock: its information next to the state.
    children['.terraform.tfstate.lock.info'] = f(
      JSON.stringify({ ID: uuidOf('femi:lock'), Operation: 'OperationTypeApply', Info: '', Who: `femi@${host}`, Version: VERSION, Created: lockCreated(), Path: 'terraform.tfstate' }),
      { lines: true, owner: 'femi', group: 'dnsadmins', mode: 'rw-r--r--' },
    );
  }
  return d(children, undefined, { owner: 'andile', group: 'dnsadmins', mode: 'rwxrwsr-x' });
}

// Created, as Go's time.Time prints in UTC (the local time is two hours ahead in June).
const lockCreated = () => new Date(FEMI_APPLY - 2 * 3_600_000).toISOString().replace(/\.\d+Z$/, '.448216035Z');
export const lockCreatedText = () => `${new Date(FEMI_APPLY - 2 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')}.448216035 +0000 UTC`;

const TOFURC = `# OpenTofu's CLI configuration: no registry from here, the providers
# come from the local mirror (Yusra, 2031).
provider_installation {
  filesystem_mirror {
    path    = "/usr/share/opentofu/providers"
    include = ["registry.opentofu.org/*/*"]
  }
  direct {
    exclude = ["registry.opentofu.org/*/*"]
  }
}`;

export interface WorldOptions {
  home: Record<string, Node>;
}

export function cairnWorld(t: Translate, n: ChapterNo, o: WorldOptions): Directory {
  const host = machineName(t, 'cairn');
  const you: Rights = { owner: 'you', group: 'you' };
  const bindDir: Rights = { owner: 'root', group: 'bind', mode: 'rwxr-sr-x' };
  const bindFile = (text: string, mode = 'rw-r--r--') => f(text, { lines: true, owner: 'root', group: 'bind', mode });
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(host),
      hosts: file(`127.0.0.1\tlocalhost\n${IP}\tns1.${ZONE} ${host}.internal ${host}\n\n::1\tlocalhost ip6-localhost ip6-loopback`),
      'resolv.conf': file('nameserver 127.0.0.1'),
      bind: dir(
        {
          'named.conf': bindFile('// This is the primary configuration file for the BIND DNS server named.\ninclude "/etc/bind/named.conf.options";\ninclude "/etc/bind/tofu-key.key";\ninclude "/etc/bind/named.conf.local";\ninclude "/etc/bind/named.conf.default-zones";'),
          'named.conf.options': bindFile('options {\n    directory "/var/cache/bind";\n    recursion no;\n    allow-transfer { none; };\n    listen-on { 127.0.0.1; ' + IP + '; };\n};'),
          'named.conf.local': bindFile(NAMED_CONF_LOCAL),
          'named.conf.default-zones': bindFile('// prime the server with knowledge of the root servers\nzone "." {\n    type hint;\n    file "/usr/share/dns/root.hints";\n};'),
          'tofu-key.key': f(TSIG_KEY, { lines: true, owner: 'root', group: 'bind', mode: 'rw-r-----' }),
          'rndc.key': f('key "rndc-key" {\n    algorithm hmac-sha256;\n    secret "q2V0b3VybmVyLWxlLWpldQ==";\n};', { lines: true, owner: 'bind', group: 'bind', mode: 'rw-r-----' }),
        },
        bindDir,
      ),
    }),
    home: dir({
      you: d({ ...o.home, '.tofurc': f(TOFURC, { lines: true, ...you }) }, undefined, you),
      andile: dir({}, { owner: 'andile', group: 'andile', mode: 'rwx------' }),
      femi: dir({}, { owner: 'femi', group: 'femi', mode: 'rwx------' }),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    srv: dir({ dns: srvDns(t, n) }),
    usr: dir({
      bin: dir({ tofu: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 94_208_152, charset: 'binary' }), nsupdate: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 117_592, charset: 'binary' }) }),
      sbin: dir({ named: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_201_664, charset: 'binary' }) }),
      share: dir({
        opentofu: dir({ providers: dir({ 'registry.opentofu.org': dir({ hashicorp: dir({ dns: dir({ [`terraform-provider-dns_${DNS_VERSION}_linux_amd64.zip`]: f('', { owner: 'root', size: 7_093_244, charset: 'binary' }) }) }) }) }) }),
        dns: dir({ 'root.hints': file('; root hints') }),
      }),
    }),
    var: dir({
      lib: dir({ bind: dir({ [`db.${ZONE}`]: f(ZONE_TEXT, { lines: true, owner: 'bind', group: 'bind', mode: 'rw-r--r--' }) }, { owner: 'bind', group: 'bind', mode: 'rwxrwxr-x' }) }),
      cache: dir({ bind: dir({}, { owner: 'root', group: 'bind', mode: 'rwxrwxr-x' }) }),
      log: dir({}),
    }),
  });
}

// ——— The machine's state ———

const proc = (pid: number, user: string, command: string, more: Partial<Process> = {}): Process => ({ pid, user, cpu: 0, mem: 0.6, command, ...more });

export function cairnState(t: Translate, n: ChapterNo) {
  const dnsState: DnsState = {
    conf: '/etc/bind/named.conf.local',
    primary: {},
    secondary: {},
    cache: {},
    servers: { primary: ['localhost', '127.0.0.1', `ns1.${ZONE}`, IP, 'cairn', machineName(t, 'cairn'), `${machineName(t, 'cairn')}.internal`], secondary: [], resolver: [] },
    charges: {},
  };
  return {
    systemd: newSystemd(machineName(t, 'cairn'), BOOT[n], NOW[n], {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(612, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
      named: { description: 'BIND Domain Name Server', active: true, executable: 'named', process: [proc(733, 'bind', '/usr/sbin/named -f -u bind', { mem: 1.4 })], load: (j) => void reloadZones(j) },
    }),
    dns: dnsState,
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
      { proto: 'udp', address: '127.0.0.1', port: 53, process: 'named', pid: 733 },
      { proto: 'udp', address: IP, port: 53, process: 'named', pid: 733 },
      { proto: 'tcp', address: '127.0.0.1', port: 53, process: 'named', pid: 733 },
      { proto: 'tcp', address: IP, port: 53, process: 'named', pid: 733 },
      { proto: 'tcp', address: '127.0.0.1', port: 953, process: 'named', pid: 733 },
    ],
    apt: { installed: { tofu: VERSION } },
  };
}

// ——— Starting a chapter ———

export function initialiseStory(j: Game, n: ChapterNo) {
  const p = j as Shell;
  reloadZones(p);
  const sd = systemd(p)!;
  // The zone's loading is from the boot, not from now.
  for (const e of sd.log.filter((x) => x.unit === 'named.service')) e.time = BOOT[n] + 2000;
  const t = tofuOf(p);
  t.written[STATE] = p.read(STATE) ?? '';
  if (n === 2) {
    // What OpenTofu did before (tiles, created on 11 June), then Femi's evening, by hand.
    const at = (time: number, f: () => void) => {
      const clock = sd.clock;
      sd.clock = time;
      f();
      sd.clock = clock;
    };
    const tilesRr: Rr = { name: `tiles.${ZONE}.`, ttl: 300, type: 'A', data: TILES };
    at(Date.UTC(2032, 5, 10, 18, 52, 0), () => dynamicUpdate(p, ZONE, () => false, [tilesRr], { address: '127.0.0.1', key: 'tofu-key', at: 0 }));
    at(FEMI_UPDATE, () =>
      dynamicUpdate(p, ZONE, (r) => r.name === `www.${ZONE}.` && r.type === 'A', [{ name: `www.${ZONE}.`, ttl: 60, type: 'A', data: NEW_WWW }], { address: '127.0.0.1', key: 'tofu-key', at: 0 }),
    );
    at(FEMI_UPDATE + 4 * 60_000, () => dynamicUpdate(p, ZONE, () => false, [{ name: `status.${ZONE}.`, ttl: 300, type: 'A', data: STATUS }], { address: '127.0.0.1', key: 'tofu-key', at: 0 }));
    sd.log.sort((a, b) => a.time - b.time);
    // Femi's tofu apply, waiting since Thursday evening, and its provider plugin.
    const list = (p.state.process ??= []) as Process[];
    list.push(
      proc(FEMI_PID, 'femi', 'tofu apply', { ppid: 23790 }),
      proc(PLUGIN_PID, 'femi', `.terraform/providers/registry.opentofu.org/hashicorp/dns/${DNS_VERSION}/linux_amd64/terraform-provider-dns_v${DNS_VERSION}`, { ppid: FEMI_PID }),
      proc(23790, 'femi', '-bash', { ppid: 23789, mem: 0.1 }),
    );
    list.sort((a, b) => a.pid - b.pid);
    t.locks[STATE] = {
      pid: FEMI_PID,
      info: { id: uuidOf('femi:lock'), path: 'terraform.tfstate', operation: 'OperationTypeApply', who: `femi@${machineName(p.t, 'cairn')}`, version: VERSION, created: lockCreatedText(), info: '' },
    };
    // The apply ends with a signal: its lock goes with it.
    p.state.onKill = (g: Game, q: Process, signal: string) => {
      const sh = g as Shell;
      if (q.pid === FEMI_PID) {
        const tt = tofuOf(sh);
        delete tt.locks[STATE];
        if (signal !== 'KILL') sh.erase(`${DIR}/.terraform.tfstate.lock.info`);
        sh.state.process = (sh.state.process as Process[]).filter((x) => x.pid !== PLUGIN_PID);
        sh.state.femiStopped = signal;
      }
      return undefined;
    };
  }
}

/** Each command: half a minute passes. */
export function passTime(j: Game) {
  systemd(j)!.clock += 30_000;
}

/** What named serves for a configured record (its provider's Read). */
export const realOf = (j: Game, type: string, attrs: Record<string, unknown>) => readRecord(dns(j)!, type, attrs as Record<string, string>);
