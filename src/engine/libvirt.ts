// A Debian hypervisor's KVM and libvirt: the domains (virtual machines)
// libvirtd keeps, their definition (the domain XML), their state, their
// disks as qcow2 images and backing chains, their snapshots (internal or
// external), the storage pool and the networks (the default NAT network
// virbr0, or the host's bridge br0 to the local network), and what the
// guests are seen as from the network (their leases, their addresses).
// Based on the libvirt documentation (https://libvirt.org/formatdomain.html,
// https://libvirt.org/formatsnapshot.html, https://libvirt.org/kbase/snapshots.html,
// https://libvirt.org/kbase/merging_disk_image_chains.html,
// https://libvirt.org/manpages/virsh.html) and QEMU's
// (https://www.qemu.org/docs/master/tools/qemu-img.html,
// https://www.qemu.org/docs/master/interop/qcow2.html).
//
//   state.libvirt = { domains, networks, pools, lan, hostMemory, … } (on the hypervisor)
//   File.disk = { format, virtual, backing, fresh, snapshots… }   (an image's metadata)
//
// An image's size on the host (File.size) is what qcow2 has allocated; its
// virtual size is what the guest sees. A running domain holds the files of
// its chain open (QEMU's file descriptors): a file removed meanwhile keeps
// its space until the domain stops (open-files.ts), and QEMU keeps reading it.
// A guest writing into a full file system pauses (QEMU's werror=enospc):
// "paused (I/O error)".
// Differences: one host, qemu:///system only; no live migration, no
// storage pools other than a directory, no guest agent; a domain boots in
// one command; a commit or a copy is instantaneous; the guests' content is
// not inside the images (a guest is an internal host of the story); a
// guest on the bridge gets its address from the office's DHCP at boot, by
// its client identifier (from /etc/machine-id, as systemd-networkd does).

import type { File, Node, Directory } from './world';
import type { Game, Shell } from './shell';
import { systemd } from './systemd';
import { openSet, type Open } from './open-files';
import { ghostPlace } from './open-files';

export const IMAGES = '/var/lib/libvirt/images';
export const QEMU_DIR = '/etc/libvirt/qemu';
export const SNAP_DIR = '/var/lib/libvirt/qemu/snapshot';
export const KiB = 1024;
export const MiB = 1024 ** 2;
export const GiB = 1024 ** 3;
// The account QEMU runs as on Debian (libvirt-qemu:kvm), as libvirt's errors write it.
export const QEMU_USER = 'libvirt-qemu';
export const QEMU_IDS = 'uid:64055, gid:64055';

// ——— Images ———

export interface InternalSnapshot {
  id: number;
  tag: string;
  // The memory state saved with it (0: disk only), bytes.
  vmSize: number;
  date: number;
  // The guest's clock when it was taken (ms since its boot).
  vmClock: number;
  // The virtual size at that moment (a revert brings it back).
  virtual: number;
}

export interface DiskImage {
  format: 'qcow2' | 'raw' | 'iso';
  virtual: number;
  backing?: string;
  // The data written in this image itself and not in its backing (what a commit adds to the base).
  fresh?: number;
  snapshots?: InternalSnapshot[];
  // Data beyond a shrunk end are lost (qemu-img resize --shrink).
  lost?: boolean;
}

/** An image: its file and its metadata. */
export interface Image {
  path: string;
  file: File;
  disk: DiskImage;
}

// ——— Domains ———

export interface DomDisk {
  target: string;
  source: string;
  format: 'qcow2' | 'raw';
  device: 'disk' | 'cdrom';
  bus: string;
}

export interface DomIface {
  type: 'network' | 'bridge';
  source: string;
  mac: string;
  model: string;
}

export interface DomConfig {
  name: string;
  uuid: string;
  // KiB.
  memory: number;
  currentMemory: number;
  vcpus: number;
  maxVcpus: number;
  osId: string;
  disks: DomDisk[];
  ifaces: DomIface[];
}

export type DomState = 'running' | 'paused' | 'shut off' | 'crashed' | 'in shutdown';

export interface Snapshot {
  name: string;
  description?: string;
  created: number;
  // running, paused, shutoff (internal, with or without memory) or disk-snapshot (external).
  state: 'running' | 'paused' | 'shutoff' | 'disk-snapshot';
  location: 'internal' | 'external';
  parent: string | null;
  // External: per disk, the overlay this snapshot created (it became the active layer) and the image it froze.
  overlay?: Record<string, string>;
  frozen?: Record<string, string>;
}

export interface Domain {
  config: DomConfig;
  // The running definition (null when shut off).
  live: DomConfig | null;
  state: DomState;
  reason: string;
  id: number | null;
  pid: number | null;
  autostart: boolean;
  persistent: boolean;
  snapshots: Snapshot[];
  current: string | null;
  // Commands left before the guest has booted (it answers on the network).
  booting: number;
  // Seconds of CPU time.
  cpuTime: number;
  // Paused with an I/O error: the disk and the error.
  ioError?: { target: string; error: string };
  // What the guest writes to its disk while it runs: bytes per command, for this many bytes in all.
  writes?: { rate: number; left: number; total: number };
  // The guest's console (boot messages, login prompt).
  console?: string[];
  // The LAN address the office's DHCP gave it at its last boot (bridge only).
  lanIp?: string | null;
  // The files of its chain, as QEMU opened them at start (path → node).
  held?: Record<string, File>;
  // What the guest's memory holds (KiB): used by programs, and page cache.
  guestUsed?: number;
  guestCache?: number;
  // The guest ignores the ACPI power button (no acpid, a stuck boot…).
  deaf?: boolean;
  // When it started (ms, the host's clock).
  started?: number;
  // How many times a full disk paused it.
  pauses?: number;
}

export interface VirtNet {
  name: string;
  uuid: string;
  bridge: string;
  active: boolean;
  autostart: boolean;
  forward: string;
  address: string;
  prefix: number;
  range: [string, string];
  mac: string;
  // dnsmasq's leases on this network.
  leases: { mac: string; ip: string; hostname: string; clientId: string; expiry: number }[];
}

export interface Pool {
  name: string;
  uuid: string;
  path: string;
  active: boolean;
  autostart: boolean;
}

// The office's network: its DHCP server (the router) and its leases, keyed by client identifier.
export interface LanLease {
  clientId: string;
  mac: string;
  ip: string;
  hostname: string;
  // Every name the clients holding this lease gave (dnsmasq answers for them).
  names?: string[];
}

export interface BlockJob {
  type: 'commit' | 'active-commit';
  domain: string;
  target: string;
  // The images merged (top first) and the base.
  top: string[];
  base: string;
  ready: boolean;
}

export interface LibvirtState {
  domains: Record<string, Domain>;
  networks: Record<string, VirtNet>;
  pools: Record<string, Pool>;
  lan: { leases: LanLease[]; next: number; router: string; prefix: string; bridge: string; uplink: string };
  // KiB of RAM, and what the host keeps for itself.
  hostMemory: number;
  hostReserve: number;
  hostSwap: number;
  hostCpus: number;
  nextId: number;
  nextPid: number;
  jobs: BlockJob[];
  // The domain XML files libvirtd wrote last (to notice an edit by hand).
  written: Record<string, string>;
  // A tick that alternates who answers when two guests claim the same address.
  flip: number;
  // A file under /var/lib/libvirt/images held by nobody that someone removed: noted for the stories.
  removed: string[];
  // A guest's identity (machine-id, hostname) when its session doesn't exist yet.
  guests: Record<string, { machineId: string; hostname: string; web?: string }>;
}

export const libvirt = (j: Game): LibvirtState => (j as Shell).principal.state.libvirt;
export const hasLibvirt = (j: Game): boolean => !!(j as Shell).principal.state.libvirt;
export const hostOf = (j: Game): Shell => (j as Shell).principal;
export const now = (j: Game): number => systemd(hostOf(j))?.clock ?? 0;
export const active = (d: Domain | undefined) => !!d && (d.state === 'running' || d.state === 'paused' || d.state === 'in shutdown');
export const domain = (j: Game, name: string): Domain | undefined => libvirt(j).domains[name];

// ——— Small helpers ———

/** A deterministic hash of a string (FNV-1a, 32 bits). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const hex = (n: number, w: number) => (n >>> 0).toString(16).padStart(w, '0').slice(-w);
/** A UUID derived from a seed. */
export const uuidOf = (seed: string) => {
  const h = [hash(seed), hash(seed + '1'), hash(seed + '2'), hash(seed + '3')].map((x) => hex(x, 8)).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
/** A MAC address in QEMU's range (52:54:00), derived from a seed. */
export const macOf = (seed: string) => {
  const h = hex(hash(seed), 6);
  return `52:54:00:${h.slice(0, 2)}:${h.slice(2, 4)}:${h.slice(4, 6)}`;
};
/** A machine-id (32 hexadecimal digits), derived from a seed. */
export const machineIdOf = (seed: string) => [hash(seed), hash(seed + 'a'), hash(seed + 'b'), hash(seed + 'c')].map((x) => hex(x, 8)).join('');

/** QEMU's size_to_str: three significant digits and a binary unit ("21.4 GiB", "196 KiB"). */
export function qemuSize(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Number(v.toPrecision(3))} ${units[i]}`;
}

/** A scaled integer as virsh reads it (default unit: KiB); returns KiB, or null. */
export function scaledKiB(text: string, defaultUnit = 1024): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const table: Record<string, number> = {
    '': defaultUnit, b: 1, byte: 1, bytes: 1,
    k: 1024, kib: 1024, kb: 1000, m: MiB, mib: MiB, mb: 1e6, g: GiB, gib: GiB, gb: 1e9, t: 1024 * GiB, tib: 1024 * GiB, tb: 1e12,
  };
  if (!(u in table)) return null;
  return Math.floor((n * table[u]) / 1024);
}

/** A size as qemu-img reads it (k, M, G, T in powers of 1024; bytes without a suffix). */
export function qemuBytes(text: string): number | null {
  const m = /^(\d+(?:\.\d+)?)([kKMGTb]?)$/.exec(text);
  if (!m) return null;
  const k = { '': 1, b: 1, k: 1024, K: 1024, M: MiB, G: GiB, T: 1024 * GiB }[m[2] as ''];
  return Math.round(Number(m[1]) * k);
}

// ——— Files of the host ———

function parentOf(j: Game, path: string): Directory | null {
  const p = j.find(path.replace(/\/[^/]+$/, '') || '/');
  return p?.type === 'directory' ? p : null;
}

/** Puts a node at a path (creating the missing places), as libvirtd or QEMU write. */
export function put(j: Game, path: string, node: Node) {
  const parts = path.split('/').filter(Boolean);
  let here = j.find('/') as Directory;
  for (const part of parts.slice(0, -1)) {
    let next = here.children[part];
    if (!next || next.type !== 'directory') {
      next = { type: 'directory', children: {}, owner: 'root' };
      here.children[part] = next;
    }
    here = next;
  }
  here.children[parts.at(-1)!] = node;
}

/** Removes a file the way unlink does (a process holding it keeps it). */
export function unlink(j: Game, path: string) {
  const p = parentOf(j, path);
  if (p) delete p.children[path.split('/').at(-1)!];
}

/** The image at a path (null: no such file, or not an image). */
export function imageAt(j: Game, path: string): Image | null {
  const n = hostOf(j).find(path);
  if (n?.type !== 'file' || !n.disk) return null;
  return { path, file: n, disk: n.disk };
}

/** Changes an image's metadata (a copy of the file shares the old object: never change it in place). */
export function setDisk(file: File, patch: Partial<DiskImage>) {
  file.disk = { ...file.disk!, ...patch };
}

/** A new image file. */
export function imageFile(disk: DiskImage, size: number, mtime?: number, owner = 'root'): File {
  return { type: 'file', content: '', size, disk, owner, group: owner === QEMU_USER ? 'kvm' : 'root', mode: 'rw-------', lines: true, ...(mtime ? { mtime } : {}) };
}

/** The bytes free on the file system holding a path (deleted files still open count as used, like df). */
export function freeBytes(j: Game, path: string): number {
  const h = hostOf(j);
  const mounts = (h.state.mounts ?? []) as { path: string; capacity: number; bytesBase?: number }[];
  const m = [...mounts].filter((x) => path === x.path || path.startsWith(x.path === '/' ? '/' : x.path + '/')).sort((a, b) => b.path.length - a.path.length)[0];
  if (!m) return Infinity;
  const place = h.find(m.path);
  const inside = mounts.filter((x) => x.path !== m.path && (m.path === '/' || x.path.startsWith(m.path + '/')));
  const other = inside.reduce((t, x) => t + ((d) => (d ? h.size(d) : 0))(h.find(x.path)), 0);
  const used = (place ? h.size(place) : 0) - other + (m.bytesBase ?? 0) + ghostPlace(h, m.path);
  return m.capacity - used;
}

/** The share of a file system in use (0 to 1). */
export function usedShare(j: Game, path: string): number {
  const h = hostOf(j);
  const m = ((h.state.mounts ?? []) as { path: string; capacity: number }[]).filter((x) => path === x.path || path.startsWith(x.path === '/' ? '/' : x.path + '/')).sort((a, b) => b.path.length - a.path.length)[0];
  return m ? 1 - freeBytes(j, path) / m.capacity : 0;
}

// ——— Chains ———

export interface ChainLink {
  path: string;
  file: File | null;
}

/**
 * A disk's backing chain, from its source down to its base. A running
 * domain reads what it opened (even removed since); a stopped one, what
 * the directories hold. `missing`: the first image that can't be opened,
 * with the image that names it as backing (null: the source itself).
 */
export function chainOf(j: Game, source: string, held?: Record<string, File>): { links: ChainLink[]; missing: { path: string; from: string | null } | null } {
  const links: ChainLink[] = [];
  let path: string | undefined = source;
  let from: string | null = null;
  const seen = new Set<string>();
  while (path && !seen.has(path)) {
    seen.add(path);
    const n: Node | null = held?.[path] ?? hostOf(j).find(path);
    const file: File | null = n?.type === 'file' ? n : null;
    if (!file) return { links, missing: { path, from } };
    links.push({ path, file });
    from = path;
    path = file.disk?.backing;
  }
  return { links, missing: null };
}

/** The chain's top image (the one the guest writes to) for a disk. */
export const topOf = (j: Game, d: Domain, target = 'vda'): ChainLink | null => {
  const disk = (d.live ?? d.config).disks.find((x) => x.target === target);
  if (!disk) return null;
  return chainOf(j, disk.source, active(d) ? d.held : undefined).links[0] ?? null;
};

/** Every path a domain's disks use, through their chains. */
export function pathsOf(j: Game, d: Domain): string[] {
  const conf = d.live ?? d.config;
  return conf.disks.flatMap((x) => (x.device === 'cdrom' ? [x.source] : chainOf(j, x.source, active(d) ? d.held : undefined).links.map((l) => l.path)));
}

// ——— The host's view of what runs ———

/** The QEMU process line of a running domain, as ps shows it. */
export const qemuCommand = (d: Domain) =>
  `/usr/bin/qemu-system-x86_64 -name guest=${d.config.name},debug-threads=on -S -object {"qom-type":"secret","id":"masterKey0"} -machine pc-q35-10.0,usb=off -accel kvm -cpu host -m size=${Math.round((d.live ?? d.config).memory / 1024)}M -smp ${(d.live ?? d.config).vcpus}`;

/** Files QEMU holds open: for lsof, and the space of a removed file still held (df). */
function syncOpenFiles(j: Game) {
  const h = hostOf(j);
  const lv = libvirt(j);
  const others = openSet(h).filter((o) => !o.service.startsWith('qemu:'));
  const mine: Open[] = [];
  for (const [name, d] of Object.entries(lv.domains)) {
    if (!active(d) || !d.held || d.pid === null) continue;
    let fd = 30;
    for (const [path, node] of Object.entries(d.held))
      mine.push({ service: `qemu:${name}`, pid: d.pid, user: QEMU_USER, command: 'qemu-system-x86_64', fd: fd++, path, node, mode: 'w', alive: (g: Game) => holds(g, name, path, node) });
  }
  h.state.openFiles = [...others, ...mine];
}

/** Does this domain still hold this file (it runs, and the file is in what it opened)? */
function holds(j: Game, name: string, path: string, node: File): boolean {
  const d = libvirt(j).domains[name];
  return active(d) && d.held?.[path] === node;
}

/** The processes of the running domains, in the host's process list (ps, top). */
function syncProcesses(j: Game) {
  const h = hostOf(j);
  const lv = libvirt(j);
  const list = ((h.state.process ?? []) as { pid: number; user: string; command: string; cpu: number; mem: number }[]).filter((p) => !p.command.startsWith('/usr/bin/qemu-system-x86_64'));
  for (const d of Object.values(lv.domains)) {
    if (!active(d) || d.pid === null) continue;
    const conf = d.live ?? d.config;
    list.push({ pid: d.pid, user: QEMU_USER, command: qemuCommand(d), cpu: d.state === 'running' ? 3.1 : 0, mem: Math.round((1000 * conf.currentMemory) / lv.hostMemory) / 10 });
  }
  h.state.process = list;
}

/** What a running guest occupies in the host's RAM (KiB): what its balloon gives it, its cache filling it, plus QEMU's overhead. */
export function guestRss(d: Domain): number {
  const conf = d.live ?? d.config;
  const inside = Math.min(conf.currentMemory, (d.guestUsed ?? conf.currentMemory / 4) + (d.guestCache ?? conf.currentMemory));
  return Math.round(inside + 180 * 1024);
}

/** The host's memory: QEMU processes, the host itself, and the swap the excess goes to. */
function syncMemory(j: Game) {
  const h = hostOf(j);
  const lv = libvirt(j);
  const rss: Record<number, number> = {};
  let demand = 0;
  for (const d of Object.values(lv.domains)) {
    if (!active(d) || d.pid === null) continue;
    const r = guestRss(d);
    demand += r;
    rss[d.pid] = r * 1024;
  }
  const total = lv.hostMemory * 1024;
  const kernel = lv.hostReserve * 1024;
  // What doesn't fit goes to swap (the kernel keeps a little free memory).
  const room = total - kernel - 256 * MiB;
  const swapped = Math.max(0, demand * 1024 - room);
  if (swapped) {
    // The QEMU processes give their excess to swap, in proportion.
    const k = room / (demand * 1024);
    for (const pid of Object.keys(rss)) rss[Number(pid)] = Math.floor(rss[Number(pid)] * k);
  }
  h.state.memory = { total, kernel, rss, swap: { total: lv.hostSwap * 1024, used: Math.min(lv.hostSwap * 1024, swapped) } };
}

/** The host swaps (what the domains want doesn't fit in its RAM). */
export const swapping = (j: Game) => ((hostOf(j).state.memory?.swap?.used as number | undefined) ?? 0) > 0;

// ——— Domain XML ———

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;');

const PCI = (slot: number) => `<address type='pci' domain='0x0000' bus='0x0${slot}' slot='0x00' function='0x0'/>`;

/** A domain's XML, as virsh dumpxml writes it (the running definition, or --inactive). */
export function domainXml(j: Game, name: string, inactive = false): string {
  const d = libvirt(j).domains[name];
  const liveView = !inactive && active(d) && d.live;
  const c = liveView ? d.live! : d.config;
  const lines: string[] = [];
  lines.push(liveView ? `<domain type='kvm' id='${d.id}'>` : `<domain type='kvm'>`);
  lines.push(`  <name>${esc(c.name)}</name>`, `  <uuid>${c.uuid}</uuid>`);
  lines.push(
    '  <metadata>',
    '    <libosinfo:libosinfo xmlns:libosinfo="http://libosinfo.org/xmlns/libvirt/domain/1.0">',
    `      <libosinfo:os id="${c.osId}"/>`,
    '    </libosinfo:libosinfo>',
    '  </metadata>',
    `  <memory unit='KiB'>${c.memory}</memory>`,
    `  <currentMemory unit='KiB'>${c.currentMemory}</currentMemory>`,
    c.vcpus === c.maxVcpus ? `  <vcpu placement='static'>${c.maxVcpus}</vcpu>` : `  <vcpu placement='static' current='${c.vcpus}'>${c.maxVcpus}</vcpu>`,
  );
  if (liveView) lines.push('  <resource>', '    <partition>/machine</partition>', '  </resource>');
  lines.push(
    '  <os>',
    "    <type arch='x86_64' machine='pc-q35-10.0'>hvm</type>",
    "    <boot dev='hd'/>",
    '  </os>',
    '  <features>',
    '    <acpi/>',
    '    <apic/>',
    "    <vmport state='off'/>",
    '  </features>',
    "  <cpu mode='host-passthrough' check='none' migratable='on'/>",
    "  <clock offset='utc'>",
    "    <timer name='rtc' tickpolicy='catchup'/>",
    "    <timer name='pit' tickpolicy='delay'/>",
    "    <timer name='hpet' present='no'/>",
    '  </clock>',
    '  <on_poweroff>destroy</on_poweroff>',
    '  <on_reboot>restart</on_reboot>',
    '  <on_crash>destroy</on_crash>',
    '  <devices>',
    '    <emulator>/usr/bin/qemu-system-x86_64</emulator>',
  );
  let slot = 4;
  for (const disk of c.disks) {
    lines.push(`    <disk type='file' device='${disk.device}'>`);
    lines.push(disk.device === 'cdrom' ? `      <driver name='qemu' type='raw'/>` : `      <driver name='qemu' type='${disk.format}' discard='unmap'/>`);
    if (disk.source) lines.push(`      <source file='${esc(disk.source)}'${liveView ? ` index='${slot - 2}'` : ''}/>`);
    // The running definition shows the chain QEMU opened.
    if (liveView && disk.device === 'disk') {
      const chain = chainOf(j, disk.source, d.held).links.slice(1);
      let indent = '      ';
      chain.forEach((l, i) => {
        lines.push(`${indent}<backingStore type='file' index='${slot - 1 + i}'>`, `${indent}  <format type='qcow2'/>`, `${indent}  <source file='${esc(l.path)}'/>`);
        indent += '  ';
      });
      lines.push(`${indent}<backingStore/>`);
      for (let i = chain.length - 1; i >= 0; i--) lines.push(`${'      ' + '  '.repeat(i)}</backingStore>`);
    }
    lines.push(`      <target dev='${disk.target}' bus='${disk.bus}'/>`);
    if (disk.device === 'cdrom') lines.push('      <readonly/>');
    lines.push(disk.bus === 'virtio' ? `      ${PCI(slot++)}` : "      <address type='drive' controller='0' bus='0' target='0' unit='0'/>", '    </disk>');
  }
  c.ifaces.forEach((i, k) => {
    lines.push(`    <interface type='${i.type}'>`, `      <mac address='${i.mac}'/>`);
    const dev = liveView ? vnetOf(j, name, k) : null;
    if (i.type === 'network') lines.push(liveView ? `      <source network='${esc(i.source)}' portid='${uuidOf(name + i.mac)}' bridge='${libvirt(j).networks[i.source]?.bridge ?? 'virbr0'}'/>` : `      <source network='${esc(i.source)}'/>`);
    else lines.push(`      <source bridge='${esc(i.source)}'/>`);
    if (dev) lines.push(`      <target dev='${dev}'/>`);
    lines.push(`      <model type='${i.model}'/>`);
    if (liveView) lines.push(`      <alias name='net${k}'/>`);
    lines.push(`      ${PCI(1)}`, '    </interface>');
  });
  lines.push(
    "    <serial type='pty'>",
    "      <target type='isa-serial' port='0'>",
    "        <model name='isa-serial'/>",
    '      </target>',
    '    </serial>',
    "    <console type='pty'>",
    "      <target type='serial' port='0'/>",
    '    </console>',
    "    <memballoon model='virtio'>",
    `      ${PCI(slot++)}`,
    '    </memballoon>',
    "    <rng model='virtio'>",
    "      <backend model='random'>/dev/urandom</backend>",
    `      ${PCI(slot++)}`,
    '    </rng>',
    '  </devices>',
  );
  if (liveView) lines.push("  <seclabel type='dynamic' model='apparmor' relabel='yes'>", `    <label>libvirt-${c.uuid}</label>`, `    <imagelabel>libvirt-${c.uuid}</imagelabel>`, '  </seclabel>');
  lines.push('</domain>');
  return lines.join('\n');
}

/** The tap device of a running domain's interface (vnet0, vnet1… in the order they started). */
export function vnetOf(j: Game, name: string, k: number): string | null {
  const lv = libvirt(j);
  const running = Object.entries(lv.domains)
    .filter(([, d]) => active(d) && d.id !== null)
    .sort(([, a], [, b]) => a.id! - b.id!);
  let n = 0;
  for (const [other, d] of running) {
    const count = (d.live ?? d.config).ifaces.length;
    if (other === name) return k < count ? `vnet${n + k}` : null;
    n += count;
  }
  return null;
}

// ——— Reading an XML document (a subset of XML 1.0, with libxml2's messages) ———

export interface XNode {
  tag: string;
  attrs: Record<string, string>;
  children: XNode[];
  text: string;
  line: number;
}

/** Parses an XML document; on an error, libxml2's message as libvirt reports it. */
export function parseXml(text: string, origin: string): XNode | { error: string } {
  const lines = text.split('\n');
  const lineAt = (i: number) => text.slice(0, i).split('\n').length;
  const context = (i: number) => {
    const n = lineAt(i);
    const l = lines[n - 1] ?? '';
    const col = i - text.slice(0, i).lastIndexOf('\n') - 1;
    return `${l}\n${'-'.repeat(Math.max(0, col))}^`;
  };
  const fail = (i: number, message: string) => ({ error: `(${origin}):${lineAt(i)}: ${message}\n${context(i)}` });
  const root: XNode = { tag: '#root', attrs: {}, children: [], text: '', line: 0 };
  const stack: XNode[] = [root];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('<!--', i)) {
      const e = text.indexOf('-->', i);
      if (e < 0) return fail(text.length, 'Comment not terminated');
      i = e + 3;
      continue;
    }
    if (text.startsWith('<?', i)) {
      const e = text.indexOf('?>', i);
      i = e < 0 ? text.length : e + 2;
      continue;
    }
    if (text[i] === '<') {
      const close = text[i + 1] === '/';
      const m = /^<\/?([A-Za-z_][\w:.-]*)/.exec(text.slice(i));
      if (!m) return fail(i + 1, 'StartTag: invalid element name');
      let k = i + m[0].length;
      const attrs: Record<string, string> = {};
      // Attributes: name='value' or name="value".
      for (;;) {
        while (/\s/.test(text[k] ?? '')) k++;
        if (k >= text.length) return fail(text.length, `Couldn't find end of Start Tag ${m[1]} line ${lineAt(i)}`);
        if (text[k] === '>' || text.startsWith('/>', k)) break;
        const a = /^([A-Za-z_][\w:.-]*)\s*=\s*/.exec(text.slice(k));
        if (!a) return fail(k, close ? `expected '>'` : `Couldn't find end of Start Tag ${m[1]} line ${lineAt(i)}`);
        k += a[0].length;
        const q = text[k];
        if (q !== "'" && q !== '"') return fail(k, `AttValue: " or ' expected`);
        const e = text.indexOf(q, k + 1);
        if (e < 0 || text.slice(k + 1, e).includes('<')) return fail(k + 1, `Unescaped '<' not allowed in attributes values`);
        if (a[1] in attrs) return fail(k, `Attribute ${a[1]} redefined`);
        attrs[a[1]] = text.slice(k + 1, e).replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        k = e + 1;
      }
      const selfClosing = text.startsWith('/>', k);
      const end = selfClosing ? k + 2 : k + 1;
      if (close) {
        const top = stack.at(-1)!;
        if (top.tag !== m[1]) {
          if (stack.length === 1) return fail(end, 'Extra content at the end of the document');
          return fail(end, `Opening and ending tag mismatch: ${top.tag} line ${top.line} and ${m[1]}`);
        }
        stack.pop();
      } else {
        const node: XNode = { tag: m[1], attrs, children: [], text: '', line: lineAt(i) };
        if (stack.length === 1 && root.children.length) return fail(i, 'Extra content at the end of the document');
        stack.at(-1)!.children.push(node);
        if (!selfClosing) stack.push(node);
      }
      i = end;
      continue;
    }
    const e = text.indexOf('<', i);
    const chunk = text.slice(i, e < 0 ? text.length : e);
    if (stack.length === 1 && chunk.trim()) return fail(i, root.children.length ? 'Extra content at the end of the document' : "Start tag expected, '<' not found");
    stack.at(-1)!.text += chunk;
    i = e < 0 ? text.length : e;
  }
  if (stack.length > 1) {
    const top = stack.at(-1)!;
    return fail(text.length, `Premature end of data in tag ${top.tag} line ${top.line}`);
  }
  if (!root.children.length) return fail(0, 'Document is empty');
  return root.children[0];
}

const child = (n: XNode, tag: string) => n.children.find((c) => c.tag === tag);
const children = (n: XNode, tag: string) => n.children.filter((c) => c.tag === tag);

// What virsh edit and virsh define print when the document doesn't follow libvirt's schema.
export const SCHEMA_ERROR = [
  'XML document failed to validate against schema: Unable to validate doc against /usr/share/libvirt/schemas/domain.rng',
  'Extra element devices in interleave',
  'Element domain failed to validate content',
].join('\n');

const UNITS: Record<string, number> = { b: 1, bytes: 1, k: 1024, kib: 1024, kb: 1000, m: MiB, mib: MiB, mb: 1e6, g: GiB, gib: GiB, gb: 1e9 };
const memoryOf = (n: XNode | undefined): number | null => {
  if (!n) return null;
  const v = Number(n.text.trim());
  const u = UNITS[(n.attrs.unit ?? 'KiB').toLowerCase()];
  return Number.isFinite(v) && n.text.trim() !== '' && u ? Math.floor((v * u) / 1024) : null;
};

/**
 * A domain's definition from its XML: the schema first (as virsh edit
 * validates), then libvirt's own checks. Returns the definition or the error
 * (without "error: ").
 */
export function configFromXml(doc: XNode, fallback?: DomConfig): DomConfig | { error: string } {
  if (doc.tag !== 'domain' || !['kvm', 'qemu'].includes(doc.attrs.type ?? '')) return { error: SCHEMA_ERROR };
  const name = child(doc, 'name')?.text.trim() ?? '';
  if (!name) return { error: SCHEMA_ERROR };
  const memory = memoryOf(child(doc, 'memory'));
  const current = child(doc, 'currentMemory') ? memoryOf(child(doc, 'currentMemory')) : memory;
  const vcpuNode = child(doc, 'vcpu');
  const maxVcpus = vcpuNode ? Number(vcpuNode.text.trim()) : 1;
  const vcpus = vcpuNode?.attrs.current ? Number(vcpuNode.attrs.current) : maxVcpus;
  if (memory === null || current === null || !Number.isInteger(maxVcpus) || maxVcpus < 1 || !Number.isInteger(vcpus)) return { error: SCHEMA_ERROR };
  const devices = child(doc, 'devices');
  const disks: DomDisk[] = [];
  const ifaces: DomIface[] = [];
  for (const x of devices ? children(devices, 'disk') : []) {
    const device = x.attrs.device ?? 'disk';
    if (!['file', 'block'].includes(x.attrs.type ?? '') || !['disk', 'cdrom'].includes(device)) return { error: SCHEMA_ERROR };
    const target = child(x, 'target');
    if (!target?.attrs.dev) return { error: SCHEMA_ERROR };
    const format = child(x, 'driver')?.attrs.type ?? 'raw';
    if (!['qcow2', 'raw'].includes(format)) return { error: SCHEMA_ERROR };
    disks.push({ target: target.attrs.dev, source: child(x, 'source')?.attrs.file ?? '', format: format as 'qcow2' | 'raw', device: device as 'disk' | 'cdrom', bus: target.attrs.bus ?? 'virtio' });
  }
  for (const x of devices ? children(devices, 'interface') : []) {
    const type = x.attrs.type ?? '';
    if (!['network', 'bridge'].includes(type)) return { error: SCHEMA_ERROR };
    const source = child(x, 'source');
    const mac = child(x, 'mac')?.attrs.address;
    if (mac !== undefined && !/^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}$/.test(mac)) return { error: SCHEMA_ERROR };
    if (mac && parseInt(mac.slice(0, 2), 16) & 1) return { error: `XML error: expected unicast mac address, found multicast '${mac}'` };
    const src = type === 'network' ? source?.attrs.network : source?.attrs.bridge;
    if (!src) return { error: SCHEMA_ERROR };
    ifaces.push({ type: type as 'network' | 'bridge', source: src, mac: (mac ?? '').toLowerCase(), model: child(x, 'model')?.attrs.type ?? 'virtio' });
  }
  const target = new Set<string>();
  for (const x of disks) {
    if (target.has(x.target)) return { error: `XML error: target '${x.target}' duplicated for disk sources '${x.source}' and '${x.source}'` };
    target.add(x.target);
  }
  return {
    name,
    uuid: child(doc, 'uuid')?.text.trim() ?? '',
    memory,
    currentMemory: Math.min(current, memory),
    vcpus,
    maxVcpus,
    osId: child(child(child(doc, 'metadata') ?? doc, 'libosinfo:libosinfo') ?? doc, 'libosinfo:os')?.attrs.id ?? fallback?.osId ?? 'http://debian.org/debian/13',
    disks,
    ifaces,
  };
}

/** A new MAC address for a domain's interface, unused on this host. */
export function freshMac(j: Game, seed: string): string {
  const used = new Set(Object.values(libvirt(j).domains).flatMap((d) => [...d.config.ifaces, ...(d.live?.ifaces ?? [])].map((i) => i.mac)));
  for (let k = 0; ; k++) {
    const m = macOf(`${seed}:${k}`);
    if (!used.has(m)) return m;
  }
}

/**
 * Defines (or redefines) a domain from a definition: what virsh define and
 * virsh edit do. Returns the domain's name, or libvirt's error.
 */
export function define(j: Game, conf: DomConfig, editing?: string): { name: string } | { error: string } {
  const lv = libvirt(j);
  const byUuid = conf.uuid ? Object.entries(lv.domains).find(([, d]) => d.config.uuid === conf.uuid) : undefined;
  const byName = lv.domains[conf.name];
  if (byUuid && byUuid[0] !== conf.name) return { error: `operation failed: domain '${byUuid[0]}' already exists with uuid ${conf.uuid}` };
  if (byName && conf.uuid && byName.config.uuid !== conf.uuid) return { error: `operation failed: domain '${conf.name}' is already defined with uuid ${byName.config.uuid}` };
  if (editing && conf.name !== editing && !byName) {
    // A new name in virsh edit: libvirt defines another domain (with a new uuid if none).
  }
  const c: DomConfig = { ...conf, uuid: conf.uuid || byName?.config.uuid || uuidOf(`${conf.name}:${now(j)}`) };
  c.ifaces = c.ifaces.map((i, k) => (i.mac ? i : { ...i, mac: freshMac(j, `${c.name}:${k}:${now(j)}`) }));
  if (byName) {
    byName.config = c;
    byName.persistent = true;
  } else
    lv.domains[c.name] = { config: c, live: null, state: 'shut off', reason: 'unknown', id: null, pid: null, autostart: false, persistent: true, snapshots: [], current: null, booting: 0, cpuTime: 0 };
  return { name: c.name };
}

// ——— Starting and stopping ———

/** Why a domain can't start (libvirt's error, without "error: "), or null. */
function startProblem(j: Game, name: string, d: Domain): string | null {
  const lv = libvirt(j);
  const c = d.config;
  for (const disk of c.disks) {
    if (disk.device === 'cdrom') continue;
    const { links, missing } = chainOf(j, disk.source);
    if (missing && missing.from === null) return `Cannot access storage file '${missing.path}' (as ${QEMU_IDS}): No such file or directory`;
    if (missing) return `Cannot access backing file '${missing.path}' of storage file '${missing.from}' (as ${QEMU_IDS}): No such file or directory`;
    // Another running domain already writes to one of these images: QEMU's lock.
    for (const [other, o] of Object.entries(lv.domains))
      if (other !== name && active(o) && links.some((l) => pathsOf(j, o).includes(l.path)))
        return `internal error: process exited while connecting to monitor: qemu-system-x86_64: -blockdev {"driver":"file","filename":"${disk.source}","node-name":"libvirt-1-storage"}: Failed to get "write" lock\nIs another process using the image [${disk.source}]?`;
  }
  for (const i of c.ifaces) {
    if (i.type === 'network') {
      const n = lv.networks[i.source];
      if (!n) return `Network not found: no network with matching name '${i.source}'`;
      if (!n.active) return `Requested operation is not valid: network '${i.source}' is not active`;
    } else if (i.source !== lv.lan.bridge) return `Cannot get interface MTU on '${i.source}': No such device`;
  }
  return null;
}

/** virsh start: returns libvirt's error, or null. */
export function startDomain(j: Game, name: string): string | null {
  const lv = libvirt(j);
  const d = lv.domains[name];
  if (active(d)) return 'Requested operation is not valid: domain is already running';
  const problem = startProblem(j, name, d);
  if (problem) return problem;
  d.live = structuredClone(d.config);
  d.state = 'running';
  d.reason = 'booted';
  d.id = lv.nextId++;
  d.pid = lv.nextPid;
  lv.nextPid += 37;
  d.booting = 1;
  d.started = now(j);
  d.held = {};
  for (const disk of d.live.disks) {
    if (disk.device === 'cdrom') continue;
    for (const l of chainOf(j, disk.source).links) {
      d.held[l.path] = l.file!;
      // libvirt gives the images to QEMU's account while it runs (dynamic_ownership).
      l.file!.owner = QEMU_USER;
      l.file!.group = 'kvm';
    }
  }
  if (d.writes) d.writes.left = d.writes.total;
  d.console = bootConsole(d.config.name, false);
  bootGuest(j, name);
  return null;
}

/** The domain stops (shutdown completed, destroy, or the guest powered off). */
export function stopDomain(j: Game, name: string, reason: string) {
  const d = libvirt(j).domains[name];
  if (!active(d)) return;
  for (const [path, file] of Object.entries(d.held ?? {}))
    if (hostOf(j).find(path) === file) {
      file.owner = 'root';
      file.group = 'root';
    }
  d.state = 'shut off';
  d.reason = reason;
  d.id = null;
  d.pid = null;
  d.live = null;
  d.held = undefined;
  d.ioError = undefined;
  d.lanIp = null;
  // A transient domain (undefined while it ran) disappears.
  if (!d.persistent) delete libvirt(j).domains[name];
  // The jobs on its disks end with it.
  libvirt(j).jobs = libvirt(j).jobs.filter((x) => x.domain !== name);
}

/** What the guest's console showed during its boot. */
export function bootConsole(name: string, failed: boolean): string[] {
  return [
    '[    0.000000] Linux version 6.12.48+deb13-amd64 (debian-kernel@lists.debian.org)',
    '[    1.204118] virtio_blk virtio2: 1/0/0 default/read/poll queues',
    '[    2.871002] EXT4-fs (vda1): mounted filesystem with ordered data mode. Quota mode: none.',
    '[  OK  ] Reached target local-fs.target - Local File Systems.',
    '[  OK  ] Started systemd-networkd.service - Network Configuration.',
    '[  OK  ] Started ssh.service - OpenBSD Secure Shell server.',
    ...(failed ? [] : ['', `Debian GNU/Linux 13 ${name} ttyS0`, '', `${name} login:`]),
  ];
}

/** At boot, the guest asks for its address: from virbr0's dnsmasq, or from the office's DHCP (by client identifier). */
export function bootGuest(j: Game, name: string) {
  const lv = libvirt(j);
  const d = lv.domains[name];
  const iface = d.live?.ifaces[0];
  d.lanIp = null;
  // An empty /etc/machine-id: systemd fills it at boot, from the VM's UUID (SMBIOS) under KVM.
  const s = hostOf(j).internals.get(name);
  if (s && !(s.read('/etc/machine-id') ?? '').trim()) put(s, '/etc/machine-id', { type: 'file', content: d.config.uuid.replace(/-/g, ''), lines: true, owner: 'root', mode: 'r--r--r--' });
  if (!iface) return;
  const id = guestIdentity(j, name);
  const clientId = clientIdOf(id.machineId);
  if (iface.type === 'network') {
    const n = lv.networks[iface.source];
    if (!n) return;
    const lease = n.leases.find((l) => l.clientId === clientId || l.mac === iface.mac);
    const base = n.address.split('.').slice(0, 3).join('.');
    const ip = lease?.ip ?? `${base}.${100 + n.leases.length}`;
    n.leases = [...n.leases.filter((l) => l !== lease), { mac: iface.mac, ip, hostname: id.hostname, clientId, expiry: now(j) + 3_600_000 }];
    return;
  }
  // dnsmasq on the office's router: a client is known by its client identifier.
  const known = lv.lan.leases.find((l) => l.clientId === clientId);
  if (known) {
    known.mac = iface.mac;
    known.names = [...new Set([...(known.names ?? [known.hostname]), id.hostname])];
    known.hostname = id.hostname;
    d.lanIp = known.ip;
    return;
  }
  const ip = `${lv.lan.prefix}.${lv.lan.next++}`;
  lv.lan.leases.push({ clientId, mac: iface.mac, ip, hostname: id.hostname });
  d.lanIp = ip;
}

/** systemd-networkd's DHCP client identifier: a DUID derived from /etc/machine-id. */
export const clientIdOf = (machineId: string) => `ff:${hex(hash(machineId), 8).match(/../g)!.join(':')}:00:04:${hex(hash(machineId + 'duid'), 8).match(/../g)!.join(':')}`;

/** A guest's machine-id and hostname: from its session if one exists, otherwise from what the story knows. */
export function guestIdentity(j: Game, name: string): { machineId: string; hostname: string } {
  const lv = libvirt(j);
  const s = hostOf(j).internals.get(name);
  const known = lv.guests[name] ?? { machineId: machineIdOf(name), hostname: name };
  if (!s) return known;
  return { machineId: (s.read('/etc/machine-id') ?? known.machineId).trim(), hostname: (s.read('/etc/hostname') ?? known.hostname).trim() };
}

/** The guest pauses: a full disk (werror=enospc), or virsh suspend. */
export function pauseDomain(j: Game, name: string, reason: string, ioError?: { target: string; error: string }) {
  const d = libvirt(j).domains[name];
  d.state = 'paused';
  d.reason = reason;
  d.ioError = ioError;
  if (ioError) d.pauses = (d.pauses ?? 0) + 1;
}

// ——— Time passing (each command on the host) ———

/** A command passes: guests boot, shut down, write to their disks (and pause when the file system is full). */
export function advance(j: Game) {
  const lv = libvirt(j);
  for (const [name, d] of Object.entries(lv.domains)) {
    if (d.state === 'in shutdown') {
      stopDomain(j, name, 'shutdown');
      continue;
    }
    if (d.state !== 'running') continue;
    d.cpuTime += 4.2;
    if (d.booting > 0) d.booting--;
    // The guest writes: its chain's top image grows, until the file system is full.
    if (d.writes && d.writes.left > 0) {
      const top = topOf(j, d);
      if (!top?.file) continue;
      const room = Math.max(0, Math.floor(freeBytes(j, top.path)));
      const want = Math.min(d.writes.rate, d.writes.left);
      const wrote = Math.min(want, room);
      top.file.size = (top.file.size ?? 0) + wrote;
      setDisk(top.file, { fresh: (top.file.disk!.fresh ?? 0) + wrote });
      d.writes.left -= wrote;
      if (wrote < want) {
        pauseDomain(j, name, 'I/O error', { target: 'vda', error: 'no space' });
        d.console = [...bootConsole(d.config.name, true), '[   41.902231] I/O error, dev vda, sector 81203712 op 0x1:(WRITE) flags 0x800 phys_seg 32 prio class 2'];
      }
    }
  }
  sync(j);
}

/** Keeps what the host shows in step with the model: open files, processes, memory, libvirt's files. */
export function sync(j: Game) {
  syncOpenFiles(j);
  syncProcesses(j);
  syncMemory(j);
  syncFiles(j);
}

// ——— libvirt's files: /etc/libvirt/qemu, autostart links, snapshot metadata ———

const HEADER = (name: string) => `<!--
WARNING: THIS IS AN AUTO-GENERATED FILE. CHANGES TO IT ARE LIKELY TO BE
OVERWRITTEN AND LOST. Changes to this xml configuration should be made using:
  virsh edit ${name}
or other application using the libvirt API.
-->
`;

/** The domain's file under /etc/libvirt/qemu, as libvirtd writes it. */
export const configFile = (j: Game, name: string) => HEADER(name) + domainXml(j, name, true);

/** Snapshot metadata, as libvirtd keeps it under /var/lib/libvirt/qemu/snapshot. */
export function snapshotXml(j: Game, name: string, s: Snapshot): string {
  const lines = ['<domainsnapshot>', `  <name>${esc(s.name)}</name>`];
  if (s.description) lines.push(`  <description>${esc(s.description)}</description>`);
  lines.push(`  <state>${s.state}</state>`);
  if (s.parent) lines.push('  <parent>', `    <name>${esc(s.parent)}</name>`, '  </parent>');
  lines.push(`  <creationTime>${Math.floor(s.created / 1000)}</creationTime>`, `  <memory snapshot='${s.state === 'running' && s.location === 'internal' ? 'internal' : 'no'}'/>`, '  <disks>');
  const d = libvirt(j).domains[name];
  for (const disk of d.config.disks)
    if (disk.device === 'disk')
      lines.push(
        s.location === 'external'
          ? `    <disk name='${disk.target}' snapshot='external' type='file'>\n      <driver type='qcow2'/>\n      <source file='${esc(s.overlay?.[disk.target] ?? '')}'/>\n    </disk>`
          : `    <disk name='${disk.target}' snapshot='internal'/>`,
      );
  lines.push('  </disks>', `  <domain type='kvm'>`, `    <name>${esc(name)}</name>`, `    <uuid>${d.config.uuid}</uuid>`, '  </domain>', '</domainsnapshot>');
  return lines.join('\n');
}

function syncFiles(j: Game) {
  const lv = libvirt(j);
  const h = hostOf(j);
  for (const name of Object.keys(lv.domains)) {
    const d = lv.domains[name];
    const path = `${QEMU_DIR}/${name}.xml`;
    if (!d.persistent) continue;
    const text = configFile(j, name);
    if (lv.written[name] !== text) {
      put(h, path, { type: 'file', content: text, lines: true, owner: 'root', mode: 'rw-------' });
      lv.written[name] = text;
    }
  }
  // Undefined domains: their file goes.
  const dir = h.find(QEMU_DIR);
  if (dir?.type === 'directory')
    for (const f of Object.keys(dir.children))
      if (f.endsWith('.xml') && !lv.domains[f.slice(0, -4)]?.persistent && lv.written[f.slice(0, -4)] !== undefined) {
        delete dir.children[f];
        delete lv.written[f.slice(0, -4)];
      }
  const links: Record<string, Node> = {};
  for (const [name, d] of Object.entries(lv.domains)) if (d.autostart && d.persistent) links[`${name}.xml`] = { type: 'file', content: '', link: `${QEMU_DIR}/${name}.xml`, owner: 'root' };
  put(h, `${QEMU_DIR}/autostart`, { type: 'directory', children: links, owner: 'root' });
  // Snapshot metadata: written once; a file removed by hand stays removed
  // (libvirtd keeps its list in memory and only writes a snapshot's file when it changes).
  for (const [name, d] of Object.entries(lv.domains))
    for (const s of d.snapshots) {
      const path = `${SNAP_DIR}/${name}/${s.name}.xml`;
      const key = `snapshot:${path}`;
      if (lv.written[key] === undefined) {
        put(h, path, { type: 'file', content: snapshotXml(j, name, s), lines: true, owner: 'root', mode: 'rw-------' });
        lv.written[key] = 'written';
      } else if (lv.written[key] === 'written' && !h.find(path)) {
        lv.written[key] = 'removed';
        lv.removed.push(path);
      }
    }
  // The files of snapshots that no longer exist go.
  for (const key of Object.keys(lv.written)) {
    if (!key.startsWith('snapshot:')) continue;
    const path = key.slice(9);
    const [name, file] = path.slice(SNAP_DIR.length + 1).split('/');
    if (!lv.domains[name]?.snapshots.some((s) => `${s.name}.xml` === file)) {
      unlink(h, path);
      delete lv.written[key];
    }
  }
}

// ——— Snapshots ———

/** The overlay name libvirt gives an external snapshot: the image's name, its extension replaced by the snapshot's. */
export const overlayPath = (source: string, snap: string) => source.replace(/\.[^./]*$/, '') + `.${snap}`;

/** virsh snapshot-create-as: returns libvirt's error, or null. */
export function createSnapshot(j: Game, name: string, snap: string, o: { description?: string; diskOnly?: boolean; noMetadata?: boolean }): string | null {
  const lv = libvirt(j);
  const d = lv.domains[name];
  if (d.snapshots.some((s) => s.name === snap)) return `invalid argument: snapshot '${snap}' already exists`;
  const conf = d.live ?? d.config;
  const disks = conf.disks.filter((x) => x.device === 'disk');
  if (o.diskOnly) {
    const overlay: Record<string, string> = {};
    const frozen: Record<string, string> = {};
    for (const disk of disks) {
      const top = chainOf(j, disk.source, active(d) ? d.held : undefined).links[0];
      if (!top?.file) return `Cannot access storage file '${disk.source}' (as ${QEMU_IDS}): No such file or directory`;
      const path = overlayPath(disk.source, snap);
      if (hostOf(j).find(path)) return `unsupported configuration: external snapshot file for disk ${disk.target} already exists and is not a block device: ${path}`;
      const file = imageFile({ format: 'qcow2', virtual: top.file.disk!.virtual, backing: disk.source, fresh: 0 }, 196 * KiB, now(j), active(d) ? QEMU_USER : 'root');
      put(hostOf(j), path, file);
      overlay[disk.target] = path;
      frozen[disk.target] = disk.source;
      disk.source = path;
      if (d.live) {
        const c = d.config.disks.find((x) => x.target === disk.target);
        if (c) c.source = path;
        d.held![path] = file;
      }
    }
    if (!o.noMetadata) {
      d.snapshots.push({ name: snap, description: o.description, created: now(j), state: 'disk-snapshot', location: 'external', parent: d.current, overlay, frozen });
      d.current = snap;
    }
    return null;
  }
  // Internal: every disk must be qcow2 (the snapshot lives inside it).
  for (const disk of disks) {
    const top = chainOf(j, disk.source, active(d) ? d.held : undefined).links[0];
    if (!top?.file || top.file.disk?.format !== 'qcow2') return `unsupported configuration: internal snapshot for disk ${disk.target} unsupported for storage type raw`;
  }
  const withMemory = d.state === 'running' || d.state === 'paused';
  for (const disk of disks) {
    const top = chainOf(j, disk.source, active(d) ? d.held : undefined).links[0]!;
    const snaps = top.file!.disk!.snapshots ?? [];
    const vmSize = withMemory ? Math.round(guestRss(d) * 1024 * 0.3) : 0;
    setDisk(top.file!, { snapshots: [...snaps, { id: (snaps.at(-1)?.id ?? 0) + 1, tag: snap, vmSize, date: now(j), vmClock: d.started ? now(j) - d.started : 0, virtual: top.file!.disk!.virtual }] });
    top.file!.size = (top.file!.size ?? 0) + vmSize + 4 * MiB;
  }
  d.snapshots.push({ name: snap, description: o.description, created: now(j), state: withMemory ? (d.state === 'paused' ? 'paused' : 'running') : 'shutoff', location: 'internal', parent: d.current });
  d.current = snap;
  return null;
}

/** Removes a snapshot from the list (its children take its parent). */
function dropMetadata(d: Domain, snap: Snapshot) {
  for (const s of d.snapshots) if (s.parent === snap.name) s.parent = snap.parent;
  d.snapshots = d.snapshots.filter((s) => s !== snap);
  if (d.current === snap.name) d.current = snap.parent;
}

/**
 * Merges images of a disk's chain into a base: the data of `top` (and of
 * every image between it and the base) goes into the base. Needs room on
 * the file system for what the base gains. Returns null, or "no space".
 */
export function commit(j: Game, name: string, target: string, top: string, base: string): 'no space' | null {
  const d = libvirt(j).domains[name];
  const disk = (d.live ?? d.config).disks.find((x) => x.target === target)!;
  const { links } = chainOf(j, disk.source, active(d) ? d.held : undefined);
  const iTop = links.findIndex((l) => l.path === top);
  const iBase = links.findIndex((l) => l.path === base);
  const merged = links.slice(iTop, iBase);
  const baseFile = links[iBase].file!;
  const need = merged.reduce((t, l) => t + (l.file?.disk?.fresh ?? 0), 0);
  if (freeBytes(j, base) < need) return 'no space';
  baseFile.size = (baseFile.size ?? 0) + need;
  setDisk(baseFile, { fresh: (baseFile.disk!.fresh ?? 0) + need, virtual: Math.max(baseFile.disk!.virtual, ...merged.map((l) => l.file!.disk!.virtual)) });
  // What was above the merged images now rests on the base.
  if (iTop > 0) setDisk(links[iTop - 1].file!, { backing: base });
  else {
    // An active commit, pivoted: the disk is the base now.
    disk.source = base;
    const c = d.config.disks.find((x) => x.target === target);
    if (c) c.source = base;
  }
  if (d.held) {
    for (const l of merged) delete d.held[l.path];
  }
  return null;
}

/**
 * virsh snapshot-delete: an internal snapshot is removed from the image;
 * an external one has its overlay merged into the image it froze (libvirt
 * 9.0 and later), then its file removed. Returns libvirt's error, or null.
 */
export function deleteSnapshot(j: Game, name: string, snapName: string, metadataOnly: boolean): string | null {
  const d = libvirt(j).domains[name];
  const snap = d.snapshots.find((s) => s.name === snapName)!;
  if (metadataOnly) {
    dropMetadata(d, snap);
    return null;
  }
  if (snap.location === 'internal') {
    const conf = d.live ?? d.config;
    for (const disk of conf.disks.filter((x) => x.device === 'disk')) {
      const top = chainOf(j, disk.source, active(d) ? d.held : undefined).links[0];
      const s = top?.file?.disk?.snapshots?.find((x) => x.tag === snapName);
      if (top?.file && s) {
        setDisk(top.file, { snapshots: top.file.disk!.snapshots!.filter((x) => x !== s) });
        top.file.size = Math.max(196 * KiB, (top.file.size ?? 0) - s.vmSize - 4 * MiB);
      }
    }
    dropMetadata(d, snap);
    return null;
  }
  for (const [target, overlay] of Object.entries(snap.overlay ?? {})) {
    const disk = (d.live ?? d.config).disks.find((x) => x.target === target);
    const { links } = chainOf(j, disk?.source ?? '', active(d) ? d.held : undefined);
    const frozen = snap.frozen?.[target] ?? '';
    const iOverlay = links.findIndex((l) => l.path === overlay);
    if (iOverlay < 0 || links[iOverlay + 1]?.path !== frozen) return 'Requested operation is not valid: snapshot VM disk source and parent disk source are not the same';
    if (iOverlay === 0 && !active(d)) {
      // The domain is off: the overlay is merged offline the same way.
    }
    if (commit(j, name, target, overlay, frozen) === 'no space') return `internal error: unable to execute QEMU command 'block-commit': Could not resize image: No space left on device`;
    unlink(hostOf(j), overlay);
    // The other snapshots that pointed at this overlay as their frozen image now point at its base.
    for (const s of d.snapshots) if (s.frozen?.[target] === overlay) s.frozen[target] = frozen;
  }
  dropMetadata(d, snap);
  return null;
}

/** Are a domain's snapshots consistent with its disks (each external one's overlay in the current chain)? */
export function snapshotsConsistent(j: Game, name: string): boolean {
  const d = libvirt(j).domains[name];
  const conf = d.live ?? d.config;
  return d.snapshots.every((s) => {
    if (s.location === 'internal') return conf.disks.some((disk) => chainOf(j, disk.source, active(d) ? d.held : undefined).links[0]?.file?.disk?.snapshots?.some((x) => x.tag === s.name));
    return Object.entries(s.overlay ?? {}).every(([target, overlay]) => {
      const disk = conf.disks.find((x) => x.target === target);
      return !!disk && chainOf(j, disk.source, active(d) ? d.held : undefined).links.some((l) => l.path === overlay);
    });
  });
}

/** Is a domain's disk chain whole, as the directories hold it (what a next start would find)? */
export function chainWhole(j: Game, name: string): boolean {
  const d = libvirt(j).domains[name];
  return (d.live ?? d.config).disks.filter((x) => x.device === 'disk').every((disk) => !chainOf(j, disk.source).missing);
}

// ——— The network: addresses, who answers, names ———

export type Where = 'host' | 'lan' | 'nat';

/** A guest's address now (null: off, paused, still booting, or without a network). */
export function guestAddress(j: Game, name: string): { ip: string; net: Where } | null {
  const lv = libvirt(j);
  const d = lv.domains[name];
  if (!d || d.state !== 'running' || d.booting > 0) return null;
  const iface = d.live?.ifaces[0];
  if (!iface) return null;
  if (iface.type === 'network') {
    const lease = lv.networks[iface.source]?.leases.find((l) => l.mac === iface.mac);
    return lease ? { ip: lease.ip, net: 'nat' } : null;
  }
  return d.lanIp ? { ip: d.lanIp, net: 'lan' } : null;
}

/**
 * Who answers at an address, seen from a network: the guests claiming it
 * (two guests with the same address, or the same MAC on the bridge, take
 * turns: the bridge and the neighbours' ARP caches follow whoever spoke last).
 */
export function answering(j: Game, ip: string, from: Where): string | null {
  const lv = libvirt(j);
  const claims = Object.keys(lv.domains).filter((n) => {
    const a = guestAddress(j, n);
    return a && a.ip === ip && (a.net === from || from === 'host' || (from === 'nat' && a.net === 'lan'));
  });
  // The same MAC twice on the bridge: frames go to one, then the other.
  const lanMacs = (n: string) => lv.domains[n].live?.ifaces[0]?.mac;
  if (from !== 'nat' && claims.length === 1 && guestAddress(j, claims[0])?.net === 'lan') {
    const twins = Object.keys(lv.domains).filter((n) => n !== claims[0] && lv.domains[n].state === 'running' && lv.domains[n].live?.ifaces[0]?.type === 'bridge' && lanMacs(n) === lanMacs(claims[0]));
    if (twins.length) claims.push(...twins);
  }
  if (!claims.length) return null;
  if (claims.length === 1) return claims[0];
  lv.flip++;
  return claims.sort()[lv.flip % claims.length];
}

/** Two running guests on the bridge share a MAC address or an IP address. */
export function clash(j: Game, a: string, b: string): { mac: boolean; ip: boolean } {
  const lv = libvirt(j);
  const [x, y] = [lv.domains[a], lv.domains[b]];
  const on = (d: Domain | undefined) => d?.state === 'running' && d.live?.ifaces[0]?.type === 'bridge';
  if (!on(x) || !on(y)) return { mac: false, ip: false };
  return { mac: x.live!.ifaces[0].mac === y.live!.ifaces[0].mac, ip: !!x.lanIp && x.lanIp === y.lanIp };
}
