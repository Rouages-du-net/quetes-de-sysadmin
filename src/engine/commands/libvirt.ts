// Virtualisation commands, on the model of ../libvirt.ts: virsh (the
// domains, their XML, states, snapshots, block jobs, memory and vCPUs,
// storage pool, networks), qemu-img (info, create, resize, convert,
// check, commit, snapshot), virt-install, virt-clone, and growpart inside
// a guest (with resize2fs on its partition).
// After https://libvirt.org/manpages/virsh.html, https://www.qemu.org/docs/master/tools/qemu-img.html,
// virt-install(1) and virt-clone(1) (https://github.com/virt-manager/virt-manager/tree/main/man)
// and growpart(1) (cloud-utils). Outputs as libvirt 11 and QEMU 10 print
// them (vshTable's columns, size_to_str's sizes).
// Differences: virsh is not interactive (no virsh shell); it always talks
// to qemu:///system; virsh edit doesn't offer to try again after an error
// (the change is dropped); virsh console shows what the console printed and
// gives the prompt back (as if you had pressed Ctrl-]); block jobs finish at
// once; reverting to an external snapshot is refused; a guest's disk has a
// single partition.

import type { Shell } from '../shell';
import type { Command } from './index';
import { help } from './manual';
import { kernel } from '../memory';
import {
  GiB, IMAGES, KiB, MiB, active, chainOf, commit, configFromXml, createSnapshot, define, deleteSnapshot, domainXml, freeBytes, freshMac, guestRss,
  hasLibvirt, hostOf, imageAt, imageFile, libvirt, now, parseXml, put, qemuBytes, qemuSize, scaledKiB, setDisk, startDomain, stopDomain, sync,
  uuidOf, vnetOf, pauseDomain, guestIdentity, bootGuest, type DiskImage, type Domain, type DomConfig,
} from '../libvirt';

// ——— Common ———

/** vshTable: a leading space, columns padded and separated by three spaces, a line of dashes. */
function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) => (' ' + cells.map((c, i) => (c ?? '').padEnd(widths[i])).join('   ')).trimEnd();
  return [line(headers), '-'.repeat(widths.reduce((t, w) => t + w, 0) + 3 * widths.length), ...rows.map(line)].join('\n') + '\n';
}

const pad = (label: string, value: string) => `${(label + ':').padEnd(16)}${value}`;
const stamp = (ms: number) => {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

interface Parsed {
  pos: string[];
  flags: Set<string>;
  values: Record<string, string>;
  bad: string | null;
}

/** virsh's options: --flag, --opt value, --opt=value; the rest are positional (in the order the command names them). */
function parse(args: string[], withValue: string[], flags: string[]): Parsed {
  const out: Parsed = { pos: [], flags: new Set(), values: {}, bad: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--') && a.length > 2) {
      const [name, value] = a.slice(2).split(/=(.*)/s);
      if (withValue.includes(name)) out.values[name] = value ?? args[++i] ?? '';
      else if (flags.includes(name)) out.flags.add(name);
      else out.bad ??= name;
    } else out.pos.push(a);
  }
  return out;
}

// ——— virsh ———

type Sub = { values?: string[]; flags?: string[]; run: (game: Shell, p: Parsed, name: string) => string; help: string; group: string };

const failed = (game: Shell, message: string, code = 1) => game.error(`error: ${message}`, code);

/** The domain an argument names (by name, id or uuid), or virsh's error. */
function domainArg(game: Shell, p: Parsed, sub: string, i = 0): [string, Domain] | null {
  const ref = p.values.domain ?? p.pos[i];
  if (!ref) {
    failed(game, `command '${sub}' requires <domain> option`);
    return null;
  }
  const lv = libvirt(game);
  const found = Object.entries(lv.domains).find(([n, d]) => n === ref || String(d.id) === ref || d.config.uuid === ref);
  if (!found) {
    failed(game, `failed to get domain '${ref}'`);
    return null;
  }
  return found;
}

/** --config, --live, --current: what a change applies to. */
function scope(game: Shell, p: Parsed, d: Domain): { live: boolean; config: boolean } | null {
  const live = p.flags.has('live');
  const config = p.flags.has('config');
  if (p.flags.has('current') && (live || config)) {
    failed(game, 'Options --current and --live are mutually exclusive');
    return null;
  }
  if (!live && !config) return active(d) ? { live: true, config: false } : { live: false, config: true };
  if (live && !active(d)) {
    failed(game, 'Requested operation is not valid: domain is not running');
    return null;
  }
  return { live, config };
}

function list(game: Shell, p: Parsed): string {
  const lv = libvirt(game);
  const all = p.flags.has('all') || p.flags.has('inactive');
  const rows = Object.entries(lv.domains)
    .filter(([, d]) => (p.flags.has('inactive') ? !active(d) : all || active(d)))
    .filter(([, d]) => (p.flags.has('autostart') ? d.autostart : p.flags.has('no-autostart') ? !d.autostart : true))
    .sort(([an, a], [bn, b]) => (a.id ?? Infinity) - (b.id ?? Infinity) || an.localeCompare(bn));
  if (p.flags.has('name')) return rows.map(([n]) => n).join('\n') + (rows.length ? '\n' : '');
  return table(['Id', 'Name', 'State'], rows.map(([n, d]) => [d.id === null ? '-' : String(d.id), n, d.state]));
}

function dominfo(game: Shell, name: string, d: Domain): string {
  const c = d.live ?? d.config;
  return [
    pad('Id', d.id === null ? '-' : String(d.id)),
    pad('Name', name),
    pad('UUID', c.uuid),
    pad('OS Type', 'hvm'),
    pad('State', d.state),
    pad('CPU(s)', String(c.vcpus)),
    ...(active(d) ? [pad('CPU time', `${d.cpuTime.toFixed(1)}s`)] : []),
    pad('Max memory', `${c.memory} KiB`),
    pad('Used memory', `${c.currentMemory} KiB`),
    pad('Persistent', d.persistent ? 'yes' : 'no'),
    pad('Autostart', d.autostart ? 'enable' : 'disable'),
    pad('Managed save', 'no'),
    pad('Security model', 'apparmor'),
    pad('Security DOI', '0'),
    ...(active(d) ? [pad('Security label', `libvirt-${c.uuid} (enforcing)`)] : []),
  ].join('\n') + '\n';
  void game;
}

function domstate(name: string, d: Domain, reason: boolean): string {
  return reason ? `${d.state} (${d.reason})\n` : `${d.state}\n`;
  void name;
}

function domblklist(game: Shell, d: Domain, details: boolean): string {
  const c = d.live ?? d.config;
  if (details) return table(['Type', 'Device', 'Target', 'Source'], c.disks.map((x) => ['file', x.device, x.target, x.source || '-']));
  return table(['Target', 'Source'], c.disks.map((x) => [x.target, x.source || '-']));
  void game;
}

function domiflist(game: Shell, name: string, d: Domain): string {
  const c = d.live ?? d.config;
  return table(['Interface', 'Type', 'Source', 'Model', 'MAC'], c.ifaces.map((i, k) => [(active(d) && vnetOf(game, name, k)) || '-', i.type, i.source, i.model, i.mac]));
}

function domifaddr(game: Shell, p: Parsed, name: string, d: Domain): string {
  if (!active(d)) return failed(game, 'Requested operation is not valid: domain is not running');
  const source = p.values.source ?? 'lease';
  if (source === 'agent') return failed(game, "argument unsupported: QEMU guest agent is not configured");
  const lv = libvirt(game);
  const rows: string[][] = [];
  d.live!.ifaces.forEach((i, k) => {
    const dev = vnetOf(game, name, k) ?? '-';
    if (source === 'lease') {
      if (i.type !== 'network') return;
      const l = lv.networks[i.source]?.leases.find((x) => x.mac === i.mac);
      if (l && d.booting === 0 && d.state === 'running') rows.push([dev, i.mac, 'ipv4', `${l.ip}/${lv.networks[i.source].prefix}`]);
    } else if (source === 'arp') {
      const ip = i.type === 'network' ? lv.networks[i.source]?.leases.find((x) => x.mac === i.mac)?.ip : d.lanIp;
      if (ip && d.booting === 0 && d.state === 'running') rows.push([dev, i.mac, 'ipv4', `${ip}/0`]);
    }
  });
  return table(['Name', 'MAC address', 'Protocol', 'Address'], rows);
}

function dommemstat(game: Shell, d: Domain): string {
  if (!active(d)) return failed(game, 'Requested operation is not valid: domain is not running');
  const c = d.live!;
  const used = d.guestUsed ?? Math.round(c.currentMemory / 4);
  const cache = Math.min(c.currentMemory - used - 65536, d.guestCache ?? c.currentMemory);
  const unused = Math.max(0, c.currentMemory - used - cache);
  return [
    `actual ${c.currentMemory}`,
    'swap_in 0',
    'swap_out 0',
    'major_fault 2848',
    'minor_fault 3317621',
    `unused ${unused}`,
    `available ${c.currentMemory - 98304}`,
    `usable ${unused + cache - 131072}`,
    `last_update ${Math.floor(now(game) / 1000)}`,
    `disk_caches ${cache}`,
    'hugetlb_pgalloc 0',
    'hugetlb_pgfail 0',
    `rss ${guestRss(d)}`,
  ].join('\n') + '\n';
}

function domstats(game: Shell, name: string, d: Domain): string {
  const c = d.live ?? d.config;
  const lines = [`Domain: '${name}'`, `  state.state=${{ running: 1, paused: 3, 'shut off': 5, crashed: 6, 'in shutdown': 4 }[d.state]}`, `  state.reason=${d.state === 'paused' && d.ioError ? 5 : 1}`];
  if (active(d)) {
    lines.push(`  cpu.time=${Math.round(d.cpuTime * 1e9)}`, `  balloon.current=${c.currentMemory}`, `  balloon.maximum=${c.memory}`, `  balloon.rss=${guestRss(d)}`, `  vcpu.current=${c.vcpus}`, `  vcpu.maximum=${c.maxVcpus}`);
    c.disks.forEach((x, i) => {
      const top = chainOf(game, x.source, d.held).links[0];
      lines.push(`  block.${i}.name=${x.target}`, `  block.${i}.path=${x.source}`, ...(top?.file?.disk ? [`  block.${i}.allocation=${top.file.size ?? 0}`, `  block.${i}.capacity=${top.file.disk.virtual}`, `  block.${i}.physical=${top.file.size ?? 0}`] : []));
    });
  }
  return lines.join('\n') + '\n\n';
}

function domblkinfo(game: Shell, p: Parsed, d: Domain): string {
  const target = p.pos[1] ?? p.values.device;
  if (!target) return failed(game, "command 'domblkinfo' requires <device> option");
  const disk = (d.live ?? d.config).disks.find((x) => x.target === target || x.source === target);
  if (!disk) return failed(game, `invalid argument: invalid path ${target} not assigned to domain`);
  const top = chainOf(game, disk.source, active(d) ? d.held : undefined).links[0];
  const cap = top?.file?.disk?.virtual ?? 0;
  const alloc = top?.file?.size ?? 0;
  const h = (n: number) => (p.flags.has('human') ? `${(n / (n >= GiB ? GiB : MiB)).toFixed(3)} ${n >= GiB ? 'GiB' : 'MiB'}` : String(n));
  return [pad('Capacity', h(cap)), pad('Allocation', h(alloc)), pad('Physical', h(alloc))].join('\n') + '\n';
}

function domblkerror(game: Shell, d: Domain): string {
  if (!active(d)) return failed(game, 'Requested operation is not valid: domain is not running');
  return d.ioError ? `${d.ioError.target}: ${d.ioError.error}\n` : 'No errors found\n';
}

// ——— dumpxml, edit, define, undefine ———

function edit(game: Shell, name: string): string {
  const original = domainXml(game, name, true) + '\n';
  const lv = libvirt(game);
  const temp = `/tmp/virsh${String(100000 + (hash6(name + now(game)) % 899999))}.xml`;
  put(game, temp, { type: 'file', content: original, owner: game.who, lines: true, mode: 'rw-------' });
  game.edition = {
    path: temp,
    text: original,
    root: game.who === 'root',
    message: game.t('nano-lines-read', { lines: original.split('\n').length - 1 }),
    conclude: true,
    after: () => {
      const text = game.read(temp) ?? '';
      game.erase(temp);
      if (text.trim() === original.trim()) return `Domain '${name}' XML configuration not changed.\n`;
      const doc = parseXml(text, 'domain_definition');
      const note = game.t('virsh-edit-dropped');
      // What closing the editor prints: the error is written on the terminal (the editor's after() has no error channel).
      const fail = (message: string) => {
        game.status = 1;
        return `error: ${message}\n${note}`;
      };
      if ('error' in doc) return fail(doc.error);
      const conf = configFromXml(doc, lv.domains[name]?.config);
      if ('error' in conf) return fail(conf.error);
      const r = define(game, conf, name);
      if ('error' in r) return fail(r.error);
      sync(game);
      return `Domain '${r.name}' XML configuration edited.\n`;
    },
  };
  return '';
}

const hash6 = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1_000_003;
  return h;
};

function defineFile(game: Shell, p: Parsed): string {
  const file = p.values.file ?? p.pos[0];
  if (!file) return failed(game, "command 'define' requires <file> option");
  const text = game.read(file);
  if (text === null) return failed(game, `Failed to open file '${file}': No such file or directory`);
  const doc = parseXml(text, file.split('/').at(-1)!);
  if ('error' in doc) return failed(game, `Failed to define domain from ${file}\nerror: ${doc.error}`);
  const conf = configFromXml(doc);
  if ('error' in conf) return failed(game, `Failed to define domain from ${file}\nerror: ${conf.error}`);
  const r = define(game, conf);
  if ('error' in r) return failed(game, `Failed to define domain from ${file}\nerror: ${r.error}`);
  return `Domain '${r.name}' defined from ${file}\n`;
}

function undefine(game: Shell, p: Parsed, name: string, d: Domain): string {
  const lv = libvirt(game);
  if (d.snapshots.length && !p.flags.has('snapshots-metadata'))
    return failed(game, `Failed to undefine domain '${name}'\nerror: Requested operation is not valid: cannot delete ${active(d) ? 'active' : 'inactive'} domain with ${d.snapshots.length} snapshots`);
  const out: string[] = [];
  if (p.flags.has('remove-all-storage')) {
    if (active(d)) return failed(game, `Failed to undefine domain '${name}'\nerror: Requested operation is not valid: Domain needs to be inactive to remove storage`);
    for (const disk of d.config.disks)
      if (disk.device === 'disk' && game.find(disk.source)) {
        game.erase(disk.source);
        out.push(`Storage volume '${disk.target}'(${disk.source}) removed.`);
      }
  }
  if (active(d)) {
    d.persistent = false;
    d.autostart = false;
  } else delete lv.domains[name];
  sync(game);
  out.push(`Domain '${name}' has been undefined`);
  return out.join('\n') + '\n';
}

// ——— Memory and vCPUs ———

function setmem(game: Shell, p: Parsed, name: string, d: Domain, max: boolean): string {
  const sub = max ? 'setmaxmem' : 'setmem';
  const raw = p.values.size ?? p.values.kilobytes ?? p.pos[1];
  if (!raw) return failed(game, `command '${sub}' requires <size> option`);
  const kib = scaledKiB(raw);
  if (kib === null || kib <= 0) return failed(game, `Invalid value of ${raw} for memory size`);
  const s = scope(game, p, d);
  if (!s) return '';
  if (max) {
    if (s.live) return failed(game, `Unable to change MaxMemorySize\nerror: Requested operation is not valid: cannot resize the maximum memory on an active domain`);
    d.config.memory = kib;
    d.config.currentMemory = Math.min(d.config.currentMemory, kib);
    sync(game);
    return '';
  }
  if (s.live && kib > d.live!.memory) return failed(game, 'invalid argument: cannot set memory higher than max memory');
  if (s.config && kib > d.config.memory) return failed(game, 'invalid argument: cannot set memory higher than max memory');
  if (s.live) {
    d.live!.currentMemory = kib;
    // The balloon takes back what the guest had in its page cache first.
    d.guestCache = Math.min(d.guestCache ?? kib, Math.max(0, kib - (d.guestUsed ?? 0) - 262144));
  }
  if (s.config) d.config.currentMemory = kib;
  sync(game);
  return '';
  void name;
}

function setvcpus(game: Shell, p: Parsed, d: Domain): string {
  const raw = p.values.count ?? p.pos[1];
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1) return failed(game, raw ? `Invalid number of virtual CPUs` : "command 'setvcpus' requires <count> option");
  if (p.flags.has('maximum')) {
    if (!p.flags.has('config')) return failed(game, 'invalid argument: --maximum must be used with --config');
    d.config.maxVcpus = n;
    d.config.vcpus = Math.min(d.config.vcpus, n);
    return '';
  }
  const s = scope(game, p, d);
  if (!s) return '';
  if (s.live && n > d.live!.maxVcpus) return failed(game, `invalid argument: requested vcpus is greater than max allowable vcpus for the live domain: ${n} > ${d.live!.maxVcpus}`);
  if (s.config && n > d.config.maxVcpus) return failed(game, `invalid argument: requested vcpus is greater than max allowable vcpus for the persistent domain: ${n} > ${d.config.maxVcpus}`);
  if (s.live) d.live!.vcpus = n;
  if (s.config) d.config.vcpus = n;
  return '';
}

function vcpucount(d: Domain): string {
  return [`${'maximum'.padEnd(10)}${'config'.padEnd(9)}${String(d.config.maxVcpus).padStart(7)}`, ...(d.live ? [`${'maximum'.padEnd(10)}${'live'.padEnd(9)}${String(d.live.maxVcpus).padStart(7)}`] : []), `${'current'.padEnd(10)}${'config'.padEnd(9)}${String(d.config.vcpus).padStart(7)}`, ...(d.live ? [`${'current'.padEnd(10)}${'live'.padEnd(9)}${String(d.live.vcpus).padStart(7)}`] : [])].join('\n') + '\n';
}

// ——— Snapshots ———

function snapshotList(game: Shell, p: Parsed, d: Domain): string {
  if (p.flags.has('tree')) {
    const lines: string[] = [];
    const walk = (parent: string | null, indent: string) => {
      const kids = d.snapshots.filter((s) => s.parent === parent);
      kids.forEach((s, i) => {
        lines.push(parent === null ? s.name : `${indent}+- ${s.name}`);
        walk(s.name, parent === null ? '  |' : `${indent}${i === kids.length - 1 ? '   ' : '  |'}`);
        if (parent === null) lines.push('');
      });
    };
    walk(null, '');
    return lines.join('\n') + '\n';
  }
  const rows = d.snapshots.map((s) => [s.name, `${stamp(s.created)} +0000`, s.state, ...(p.flags.has('parent') ? [s.parent ?? ''] : [])]);
  return table(['Name', 'Creation Time', 'State', ...(p.flags.has('parent') ? ['Parent'] : [])], rows);
  void game;
}

function snapshotCreateAs(game: Shell, p: Parsed, name: string, d: Domain): string {
  const snap = p.values.name ?? p.pos[1] ?? String(Math.floor(now(game) / 1000));
  const description = p.values.description ?? p.pos[2];
  const e = createSnapshot(game, name, snap, { description, diskOnly: p.flags.has('disk-only'), noMetadata: p.flags.has('no-metadata') });
  if (e) return failed(game, e);
  sync(game);
  return `Domain snapshot ${snap} created\n`;
}

function snapshotDelete(game: Shell, p: Parsed, name: string, d: Domain): string {
  const snapName = p.values.snapshotname ?? p.pos[1];
  if (p.flags.has('current') && !snapName && !d.current) return failed(game, `Operation not supported: domain '${name}' has no current snapshot`);
  const target = snapName ?? d.current;
  if (!target) return failed(game, "command 'snapshot-delete' requires <snapshotname> option");
  if (!d.snapshots.some((s) => s.name === target)) return failed(game, `Domain snapshot not found: no domain snapshot with matching name '${target}'`);
  const e = deleteSnapshot(game, name, target, p.flags.has('metadata'));
  if (e) return failed(game, `Failed to delete snapshot ${target}\nerror: ${e}`);
  sync(game);
  return `Domain snapshot ${target} deleted\n`;
}

function snapshotRevert(game: Shell, p: Parsed, name: string, d: Domain): string {
  const target = p.values.snapshotname ?? p.pos[1] ?? (p.flags.has('current') ? d.current : null);
  if (!target) return failed(game, "command 'snapshot-revert' requires <snapshotname> option");
  const snap = d.snapshots.find((s) => s.name === target);
  if (!snap) return failed(game, `Domain snapshot not found: no domain snapshot with matching name '${target}'`);
  if (snap.location === 'external') return failed(game, 'unsupported configuration: revert to external snapshot not supported yet');
  // Back to the snapshot's disk (its size too), and to its state.
  for (const disk of (d.live ?? d.config).disks.filter((x) => x.device === 'disk')) {
    const top = chainOf(game, disk.source, active(d) ? d.held : undefined).links[0];
    const s = top?.file?.disk?.snapshots?.find((x) => x.tag === target);
    if (top?.file && s) setDisk(top.file, { virtual: s.virtual, lost: false });
  }
  game.state.reverted = [...((game.state.reverted as string[] | undefined) ?? []), `${name}:${target}`];
  if (snap.state === 'shutoff') stopDomain(game, name, 'from snapshot');
  else {
    if (!active(d)) startDomain(game, name);
    d.booting = 0;
    if (snap.state === 'paused') pauseDomain(game, name, 'from snapshot');
    else {
      d.state = 'running';
      d.reason = 'from snapshot';
    }
  }
  d.current = target;
  sync(game);
  return '';
}

function snapshotCurrent(game: Shell, p: Parsed, name: string, d: Domain): string {
  if (!d.current) return failed(game, `Operation not supported: domain '${name}' has no current snapshot`);
  if (p.flags.has('name')) return `${d.current}\n`;
  const s = d.snapshots.find((x) => x.name === d.current)!;
  return snapshotInfoText(name, d, s);
  void game;
}

function snapshotInfoText(name: string, d: Domain, s: Domain['snapshots'][number]): string {
  return [
    pad('Name', s.name),
    pad('Domain', name),
    pad('Current', d.current === s.name ? 'yes' : 'no'),
    pad('State', s.state),
    pad('Location', s.location),
    pad('Parent', s.parent ?? '-'),
    pad('Children', String(d.snapshots.filter((x) => x.parent === s.name).length)),
    pad('Descendants', String(d.snapshots.filter((x) => x.parent === s.name).length)),
    pad('Metadata', 'yes'),
  ].join('\n') + '\n';
}

// ——— Block jobs ———

function blockcommit(game: Shell, p: Parsed, name: string, d: Domain): string {
  const target = p.pos[1] ?? p.values.path;
  if (!target) return failed(game, "command 'blockcommit' requires <path> option");
  if (!active(d)) return failed(game, 'Requested operation is not valid: domain is not running');
  const disk = d.live!.disks.find((x) => x.target === target || x.source === target);
  if (!disk) return failed(game, `invalid argument: invalid path ${target} not assigned to domain`);
  const lv = libvirt(game);
  if (lv.jobs.some((x) => x.domain === name && x.target === disk.target)) return failed(game, `block copy still active: disk '${disk.target}' already in active block job`);
  const { links } = chainOf(game, disk.source, d.held);
  if (links.length < 2) return failed(game, `invalid argument: top '${disk.source}' in chain for '${disk.target}' has no backing file`);
  const find = (ref: string) => links.findIndex((l) => l.path === ref || l.path.split('/').at(-1) === ref);
  const iTop = p.flags.has('active') ? 0 : p.values.top ? find(p.values.top) : 0;
  if (iTop < 0) return failed(game, `invalid argument: could not find image '${p.values.top}' in chain for '${disk.source}'`);
  const iBase = p.flags.has('shallow') ? iTop + 1 : p.values.base ? find(p.values.base) : links.length - 1;
  if (iBase < 0) return failed(game, `invalid argument: could not find image '${p.values.base}' beneath '${links[iTop].path}' in chain for '${disk.source}'`);
  if (iBase <= iTop) return failed(game, `invalid argument: could not find base image in chain for '${disk.source}'`);
  if (iTop === 0 && !p.flags.has('active')) return failed(game, `invalid argument: commit of '${disk.target}' active layer requires active flag`);
  const top = links.slice(iTop, iBase).map((l) => l.path);
  const base = links[iBase].path;
  const verbose = p.flags.has('verbose');
  if (iTop > 0) {
    // An intermediate commit ends by itself.
    if (commit(game, name, disk.target, top[0], base) === 'no space') return failed(game, 'Commit failed') + (verbose ? 'Block commit: [ 37 %]\n' : '');
    if (p.flags.has('delete')) for (const t of top) game.erase(t);
    sync(game);
    return p.flags.has('wait') || verbose ? `${verbose ? 'Block commit: [100 %]\n' : ''}Commit complete\n` : 'Block Commit started\n';
  }
  // An active commit: the job copies, then waits to be pivoted (or ends there with --pivot).
  if (freeBytes(game, base) < links.slice(0, iBase).reduce((t, l) => t + (l.file?.disk?.fresh ?? 0), 0)) return failed(game, 'Commit failed') + (verbose ? 'Block commit: [ 37 %]\n' : '');
  if (p.flags.has('pivot')) {
    commit(game, name, disk.target, top[0], base);
    if (p.flags.has('delete')) for (const t of top) game.erase(t);
    sync(game);
    return `${verbose ? 'Block commit: [100 %]\n' : ''}Successfully pivoted\n`;
  }
  lv.jobs.push({ type: 'active-commit', domain: name, target: disk.target, top, base, ready: true });
  if (p.flags.has('wait') || verbose) return `${verbose ? 'Block commit: [100 %]\n' : ''}Now in synchronized phase\n`;
  return 'Active Block Commit started\n';
}

function blockjob(game: Shell, p: Parsed, name: string, d: Domain): string {
  const target = p.pos[1] ?? p.values.path;
  if (!target) return failed(game, "command 'blockjob' requires <path> option");
  const lv = libvirt(game);
  const job = lv.jobs.find((x) => x.domain === name && (x.target === target || (d.live?.disks.find((y) => y.target === x.target)?.source ?? '') === target));
  if (!job) return p.flags.has('info') || !p.flags.size ? `No current block job for ${target}\n` : failed(game, `Requested operation is not valid: No active block job '${target}'`);
  if (p.flags.has('pivot')) {
    lv.jobs = lv.jobs.filter((x) => x !== job);
    if (commit(game, name, job.target, job.top[0], job.base) === 'no space') return failed(game, 'Commit failed');
    sync(game);
    return '';
  }
  if (p.flags.has('abort')) {
    lv.jobs = lv.jobs.filter((x) => x !== job);
    return '';
  }
  return `Active Block Commit: [100 %]\n`;
}

function blockresize(game: Shell, p: Parsed, name: string, d: Domain): string {
  const target = p.pos[1] ?? p.values.path;
  const raw = p.values.size ?? p.pos[2];
  if (!target) return failed(game, "command 'blockresize' requires <path> option");
  if (!raw) return failed(game, "command 'blockresize' requires <size> option");
  if (!active(d)) return failed(game, `Failed to resize block device '${target}'\nerror: Requested operation is not valid: domain is not running`);
  const disk = d.live!.disks.find((x) => x.target === target || x.source === target);
  if (!disk) return failed(game, `Failed to resize block device '${target}'\nerror: invalid argument: invalid path ${target} not assigned to domain`);
  const kib = scaledKiB(raw);
  if (kib === null) return failed(game, `Numeric value '${raw}' for <size> option is malformed or out of range`);
  const top = chainOf(game, disk.source, d.held).links[0];
  const bytes = kib * 1024;
  const before = top!.file!.disk!.virtual;
  if (bytes < before) return failed(game, `Failed to resize block device '${target}'\nerror: internal error: unable to execute QEMU command 'block_resize': Shrinking images is currently not supported`);
  setDisk(top!.file!, { virtual: bytes });
  // The guest's kernel sees the new size at once (virtio-blk's config change).
  game.state.resized = [...((game.state.resized as string[] | undefined) ?? []), name];
  const guest = hostOf(game).internals.get(name);
  if (guest) {
    kernel(guest, `virtio_blk virtio2: [${target}] new size: ${bytes / 512} 512-byte logical blocks (${(bytes / 1e9).toFixed(1)} GB/${(bytes / GiB).toFixed(1)} GiB)`);
    kernel(guest, `${target}: detected capacity change from ${before / 512} to ${bytes / 512}`);
  }
  sync(game);
  return `Block device '${target}' is resized\n`;
}

// ——— Pools, volumes, networks ———

function poolList(game: Shell): string {
  return table(['Name', 'State', 'Autostart'], Object.values(libvirt(game).pools).map((x) => [x.name, x.active ? 'active' : 'inactive', x.autostart ? 'yes' : 'no']));
}

function poolInfo(game: Shell, p: Parsed): string {
  const pool = libvirt(game).pools[p.pos[0] ?? 'default'];
  if (!pool) return failed(game, `failed to get pool '${p.pos[0]}'\nerror: Storage pool not found: no storage pool with matching name '${p.pos[0]}'`);
  const h = hostOf(game);
  const m = ((h.state.mounts ?? []) as { path: string; capacity: number }[]).filter((x) => pool.path.startsWith(x.path)).sort((a, b) => b.path.length - a.path.length)[0];
  const cap = m?.capacity ?? 0;
  const free = Math.max(0, freeBytes(game, pool.path));
  const g = (n: number) => `${(n / GiB).toFixed(2)} GiB`;
  return [pad('Name', pool.name), pad('UUID', pool.uuid), pad('State', 'running'), pad('Persistent', 'yes'), pad('Autostart', pool.autostart ? 'yes' : 'no'), pad('Capacity', g(cap)), pad('Allocation', g(cap - free)), pad('Available', g(free))].join('\n') + '\n';
}

function volList(game: Shell, p: Parsed): string {
  const pool = libvirt(game).pools[p.pos[0] ?? ''];
  if (!pool) return failed(game, `failed to get pool '${p.pos[0] ?? ''}'\nerror: Storage pool not found: no storage pool with matching name '${p.pos[0] ?? ''}'`);
  const dir = hostOf(game).find(pool.path);
  const names = dir?.type === 'directory' ? Object.keys(dir.children).sort() : [];
  const h = (n: number) => (n >= GiB ? `${(n / GiB).toFixed(2)} GiB` : `${(n / MiB).toFixed(2)} MiB`);
  if (p.flags.has('details'))
    return table(['Name', 'Path', 'Type', 'Capacity', 'Allocation'], names.map((n) => {
      const f = dir!.type === 'directory' ? dir!.children[n] : null;
      const disk = f?.type === 'file' ? f.disk : undefined;
      const size = f?.type === 'file' ? (f.size ?? 0) : 4096;
      return [n, `${pool.path}/${n}`, f?.type === 'directory' ? 'dir' : 'file', h(disk?.virtual ?? size), h(size)];
    }));
  return table(['Name', 'Path'], names.map((n) => [n, `${pool.path}/${n}`]));
}

function netList(game: Shell, p: Parsed): string {
  return table(['Name', 'State', 'Autostart', 'Persistent'], Object.values(libvirt(game).networks).filter((n) => p.flags.has('all') || n.active).map((n) => [n.name, n.active ? 'active' : 'inactive', n.autostart ? 'yes' : 'no', 'yes']));
}

function netInfo(game: Shell, p: Parsed): string {
  const n = libvirt(game).networks[p.pos[0] ?? ''];
  if (!n) return failed(game, `failed to get network '${p.pos[0] ?? ''}'\nerror: Network not found: no network with matching name '${p.pos[0] ?? ''}'`);
  return [pad('Name', n.name), pad('UUID', n.uuid), pad('Active', n.active ? 'yes' : 'no'), pad('Persistent', 'yes'), pad('Autostart', n.autostart ? 'yes' : 'no'), pad('Bridge', n.bridge)].join('\n') + '\n';
}

function netDumpxml(game: Shell, p: Parsed): string {
  const n = libvirt(game).networks[p.pos[0] ?? ''];
  if (!n) return failed(game, `failed to get network '${p.pos[0] ?? ''}'\nerror: Network not found: no network with matching name '${p.pos[0] ?? ''}'`);
  return [
    `<network${n.active ? " connections='" + Object.values(libvirt(game).domains).filter((d) => d.live?.ifaces.some((i) => i.type === 'network' && i.source === n.name)).length + "'" : ''}>`,
    `  <name>${n.name}</name>`,
    `  <uuid>${n.uuid}</uuid>`,
    `  <forward mode='${n.forward}'>`,
    '    <nat>',
    "      <port start='1024' end='65535'/>",
    '    </nat>',
    '  </forward>',
    `  <bridge name='${n.bridge}' stp='on' delay='0'/>`,
    `  <mac address='${n.mac}'/>`,
    `  <ip address='${n.address}' netmask='255.255.255.0'>`,
    '    <dhcp>',
    `      <range start='${n.range[0]}' end='${n.range[1]}'/>`,
    '    </dhcp>',
    '  </ip>',
    '</network>',
  ].join('\n') + '\n';
}

function netLeases(game: Shell, p: Parsed): string {
  const n = libvirt(game).networks[p.pos[0] ?? ''];
  if (!n) return failed(game, `failed to get network '${p.pos[0] ?? ''}'\nerror: Network not found: no network with matching name '${p.pos[0] ?? ''}'`);
  return table(['Expiry Time', 'MAC address', 'Protocol', 'IP address', 'Hostname', 'Client ID or DUID'], n.leases.map((l) => [stamp(l.expiry), l.mac, 'ipv4', `${l.ip}/${n.prefix}`, l.hostname, l.clientId]));
}

// ——— Interfaces ———

function attachInterface(game: Shell, p: Parsed, name: string, d: Domain): string {
  const type = p.values.type ?? p.pos[1];
  const source = p.values.source ?? p.pos[2];
  if (!type) return failed(game, "command 'attach-interface' requires <type> option");
  if (!source) return failed(game, "command 'attach-interface' requires <source> option");
  if (!['network', 'bridge'].includes(type)) return failed(game, `No support for ${type} in command 'attach-interface'`);
  const s = scope(game, p, d);
  if (!s) return '';
  const mac = (p.values.mac ?? freshMac(game, `${name}:attach:${now(game)}`)).toLowerCase();
  const lv = libvirt(game);
  if (type === 'bridge' && source !== lv.lan.bridge) return failed(game, `Failed to attach interface\nerror: Cannot get interface MTU on '${source}': No such device`);
  if (type === 'network' && !lv.networks[source]) return failed(game, `Failed to attach interface\nerror: Network not found: no network with matching name '${source}'`);
  const iface = { type: type as 'network' | 'bridge', source, mac, model: p.values.model ?? 'virtio' };
  if (s.live) {
    d.live!.ifaces.push({ ...iface });
    if (d.live!.ifaces.length === 1) bootGuest(game, name);
    else game.state.hotplugged = [...((game.state.hotplugged as string[] | undefined) ?? []), name];
  }
  if (s.config) d.config.ifaces.push({ ...iface });
  sync(game);
  return 'Interface attached successfully\n';
}

function detachInterface(game: Shell, p: Parsed, name: string, d: Domain): string {
  const type = p.values.type ?? p.pos[1];
  if (!type) return failed(game, "command 'detach-interface' requires <type> option");
  const s = scope(game, p, d);
  if (!s) return '';
  const mac = p.values.mac?.toLowerCase();
  const drop = (c: DomConfig) => {
    const matching = c.ifaces.filter((i) => i.type === type && (!mac || i.mac === mac));
    if (matching.length > 1 && !mac) return 'many';
    if (!matching.length) return 'none';
    c.ifaces = c.ifaces.filter((i) => i !== matching[0]);
    return 'ok';
  };
  for (const c of [...(s.live ? [d.live!] : []), ...(s.config ? [d.config] : [])]) {
    const r = drop(c);
    if (r === 'many') return failed(game, `Failed to detach interface\nerror: operation failed: multiple matching interfaces found`);
    if (r === 'none') return failed(game, `Failed to detach interface\nerror: operation failed: no interface found`);
  }
  // The guest moves to what remains (its first interface), and asks for an address there.
  if (s.live) bootGuest(game, name);
  sync(game);
  return 'Interface detached successfully\n';
}

// ——— Console, node ———

function consoleCmd(game: Shell, name: string, d: Domain): string {
  if (!active(d)) return failed(game, 'The domain is not running');
  const lines = d.console ?? [];
  return [`Connected to domain '${name}'`, 'Escape character is ^] (Ctrl + ])', ...(d.state === 'paused' ? lines : lines), '', game.t('virsh-console-left')].join('\n') + '\n';
}

function nodeinfo(game: Shell): string {
  const lv = libvirt(game);
  return [pad('CPU model', 'x86_64'), pad('CPU(s)', String(lv.hostCpus)), pad('CPU frequency', '2900 MHz'), pad('CPU socket(s)', '1'), pad('Core(s) per socket', String(lv.hostCpus / 2)), pad('Thread(s) per core', '2'), pad('NUMA cell(s)', '1'), pad('Memory size', `${lv.hostMemory} KiB`)].join('\n') + '\n';
}

function nodememstats(game: Shell): string {
  const h = hostOf(game);
  const m = h.state.memory as { total: number; kernel: number; rss: Record<number, number> };
  const used = m.kernel + Object.values(m.rss).reduce((t, x) => t + x, 0);
  const free = Math.max(0, m.total - used);
  return [`${'total  :'.padEnd(10)}${String(Math.round(m.total / 1024)).padStart(12)} KiB`, `${'free   :'.padEnd(10)}${String(Math.round(free / 1024)).padStart(12)} KiB`, `${'buffers:'.padEnd(10)}${String(184_320).padStart(12)} KiB`, `${'cached :'.padEnd(10)}${String(Math.round(Math.min(free, m.kernel) / 2048)).padStart(12)} KiB`].join('\n') + '\n';
}

// ——— The table of subcommands ———

const SUBS: Record<string, Sub> = {
  list: { group: 'domain', help: 'list domains', flags: ['all', 'inactive', 'name', 'autostart', 'no-autostart', 'state-running', 'state-shutoff', 'state-paused'], run: (g, p) => list(g, p) },
  start: {
    group: 'domain', help: 'start a (previously defined) inactive domain', values: ['domain'], flags: ['console', 'paused'],
    run: (g, p) => {
      const x = domainArg(g, p, 'start');
      if (!x) return '';
      if (active(x[1])) return failed(g, 'Domain is already active');
      const e = startDomain(g, x[0]);
      if (e) return failed(g, `Failed to start domain '${x[0]}'\nerror: ${e}`);
      if (p.flags.has('paused')) pauseDomain(g, x[0], 'user');
      sync(g);
      return `Domain '${x[0]}' started\n`;
    },
  },
  shutdown: {
    group: 'domain', help: 'gracefully shutdown a domain', values: ['domain', 'mode'],
    run: (g, p) => {
      const x = domainArg(g, p, 'shutdown');
      if (!x) return '';
      const [name, d] = x;
      if (!active(d)) return failed(g, `Failed to shutdown domain '${name}'\nerror: Requested operation is not valid: domain is not running`);
      // The ACPI button: a running guest that hears it powers off; a paused one hears nothing.
      g.state.acpiSent = [...((g.state.acpiSent as string[] | undefined) ?? []), `${name}:${d.state}`];
      if (d.state === 'running' && !d.deaf && d.booting === 0) d.state = 'in shutdown';
      return `Domain '${name}' is being shutdown\n`;
    },
  },
  destroy: {
    group: 'domain', help: 'destroy (stop) a domain', values: ['domain'], flags: ['graceful'],
    run: (g, p) => {
      const x = domainArg(g, p, 'destroy');
      if (!x) return '';
      if (!active(x[1])) return failed(g, `Failed to destroy domain '${x[0]}'\nerror: Requested operation is not valid: domain is not running`);
      g.state.destroyed = [...((g.state.destroyed as string[] | undefined) ?? []), x[0]];
      stopDomain(g, x[0], 'destroyed');
      sync(g);
      return `Domain '${x[0]}' destroyed\n`;
    },
  },
  reboot: {
    group: 'domain', help: 'reboot a domain', values: ['domain', 'mode'],
    run: (g, p) => {
      const x = domainArg(g, p, 'reboot');
      if (!x) return '';
      const [name, d] = x;
      if (!active(d)) return failed(g, `Failed to reboot domain '${name}'\nerror: Requested operation is not valid: domain is not running`);
      if (d.state === 'paused') return failed(g, `Failed to reboot domain '${name}'\nerror: Requested operation is not valid: domain is not running`);
      // The guest reboots inside the same QEMU process: the running definition doesn't change.
      g.state.guestReboots = [...((g.state.guestReboots as string[] | undefined) ?? []), name];
      d.booting = 1;
      d.console = bootConsole2(name);
      bootGuest(g, name);
      return `Domain '${name}' is being rebooted\n`;
    },
  },
  suspend: {
    group: 'domain', help: 'suspend a domain', values: ['domain'],
    run: (g, p) => {
      const x = domainArg(g, p, 'suspend');
      if (!x) return '';
      if (!active(x[1])) return failed(g, `Failed to suspend domain '${x[0]}'\nerror: Requested operation is not valid: domain is not running`);
      pauseDomain(g, x[0], 'user');
      return `Domain '${x[0]}' suspended\n`;
    },
  },
  resume: {
    group: 'domain', help: 'resume a domain', values: ['domain'],
    run: (g, p) => {
      const x = domainArg(g, p, 'resume');
      if (!x) return '';
      const [name, d] = x;
      if (!active(d)) return failed(g, `Failed to resume domain '${name}'\nerror: Requested operation is not valid: domain is not running`);
      if (d.state !== 'paused') return failed(g, `Failed to resume domain '${name}'\nerror: Requested operation is not valid: domain is already running`);
      d.state = 'running';
      d.reason = 'unpaused';
      d.ioError = undefined;
      return `Domain '${name}' resumed\n`;
    },
  },
  autostart: {
    group: 'domain', help: 'autostart a domain', values: ['domain'], flags: ['disable'],
    run: (g, p) => {
      const x = domainArg(g, p, 'autostart');
      if (!x) return '';
      const [name, d] = x;
      if (!d.persistent) return failed(g, `Failed to mark domain '${name}' as autostarted\nerror: Requested operation is not valid: cannot set autostart for transient domain`);
      d.autostart = !p.flags.has('disable');
      sync(g);
      return d.autostart ? `Domain '${name}' marked as autostarted\n` : `Domain '${name}' unmarked as autostarted\n`;
    },
  },
  dominfo: { group: 'monitor', help: 'domain information', values: ['domain'], run: (g, p) => ((x) => (x ? dominfo(g, x[0], x[1]) : ''))(domainArg(g, p, 'dominfo')) },
  domstate: { group: 'monitor', help: 'domain state', values: ['domain'], flags: ['reason'], run: (g, p) => ((x) => (x ? domstate(x[0], x[1], p.flags.has('reason')) : ''))(domainArg(g, p, 'domstate')) },
  domblklist: { group: 'monitor', help: 'list all domain blocks', values: ['domain'], flags: ['details', 'inactive'], run: (g, p) => ((x) => (x ? domblklist(g, p.flags.has('inactive') ? { ...x[1], live: null } : x[1], p.flags.has('details')) : ''))(domainArg(g, p, 'domblklist')) },
  domiflist: { group: 'monitor', help: 'list all domain virtual interfaces', values: ['domain'], flags: ['inactive'], run: (g, p) => ((x) => (x ? domiflist(g, x[0], p.flags.has('inactive') ? { ...x[1], live: null, state: 'shut off' } : x[1]) : ''))(domainArg(g, p, 'domiflist')) },
  domifaddr: { group: 'monitor', help: 'Get network interfaces\' addresses for a running domain', values: ['domain', 'source', 'interface'], flags: ['full'], run: (g, p) => ((x) => (x ? domifaddr(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'domifaddr')) },
  dommemstat: { group: 'monitor', help: 'get memory statistics for a domain', values: ['domain', 'period'], flags: ['live', 'config', 'current'], run: (g, p) => ((x) => (x ? dommemstat(g, x[1]) : ''))(domainArg(g, p, 'dommemstat')) },
  domstats: {
    group: 'monitor', help: 'get statistics about one or multiple domains', flags: ['state', 'cpu-total', 'balloon', 'vcpu', 'block', 'interface', 'list-active', 'list-running'],
    run: (g, p) => {
      const lv = libvirt(g);
      const names = p.pos.length ? p.pos : Object.keys(lv.domains).filter((n) => !p.flags.has('list-active') || active(lv.domains[n]));
      for (const n of names) if (!lv.domains[n]) return failed(g, `failed to get domain '${n}'`);
      return names.map((n) => domstats(g, n, lv.domains[n])).join('');
    },
  },
  domblkinfo: { group: 'monitor', help: 'domain block device size information', values: ['domain', 'device'], flags: ['human', 'all'], run: (g, p) => ((x) => (x ? domblkinfo(g, p, x[1]) : ''))(domainArg(g, p, 'domblkinfo')) },
  domblkerror: { group: 'monitor', help: 'Show errors on block devices', values: ['domain'], run: (g, p) => ((x) => (x ? domblkerror(g, x[1]) : ''))(domainArg(g, p, 'domblkerror')) },
  dumpxml: { group: 'domain', help: 'domain information in XML', values: ['domain', 'xpath'], flags: ['inactive', 'security-info', 'migratable', 'wrap'], run: (g, p) => ((x) => (x ? domainXml(g, x[0], p.flags.has('inactive')) + '\n' : ''))(domainArg(g, p, 'dumpxml')) },
  edit: { group: 'domain', help: 'edit XML configuration for a domain', values: ['domain'], run: (g, p) => ((x) => (x ? edit(g, x[0]) : ''))(domainArg(g, p, 'edit')) },
  define: { group: 'domain', help: 'define (but don\'t start) a domain from an XML file', values: ['file'], flags: ['validate'], run: (g, p) => defineFile(g, p) },
  undefine: { group: 'domain', help: 'undefine a domain', values: ['domain', 'storage'], flags: ['remove-all-storage', 'snapshots-metadata', 'nvram', 'managed-save', 'checkpoints-metadata'], run: (g, p) => ((x) => (x ? undefine(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'undefine')) },
  setmem: { group: 'domain', help: 'change memory allocation', values: ['domain', 'size', 'kilobytes'], flags: ['config', 'live', 'current'], run: (g, p) => ((x) => (x ? setmem(g, p, x[0], x[1], false) : ''))(domainArg(g, p, 'setmem')) },
  setmaxmem: { group: 'domain', help: 'change maximum memory limit', values: ['domain', 'size', 'kilobytes'], flags: ['config', 'live', 'current'], run: (g, p) => ((x) => (x ? setmem(g, p, x[0], x[1], true) : ''))(domainArg(g, p, 'setmaxmem')) },
  setvcpus: { group: 'domain', help: 'change number of virtual CPUs', values: ['domain', 'count'], flags: ['config', 'live', 'current', 'maximum', 'guest', 'hotpluggable'], run: (g, p) => ((x) => (x ? setvcpus(g, p, x[1]) : ''))(domainArg(g, p, 'setvcpus')) },
  vcpucount: { group: 'domain', help: 'domain vcpu counts', values: ['domain'], flags: ['config', 'live', 'current', 'maximum', 'active'], run: (g, p) => ((x) => (x ? vcpucount(x[1]) : ''))(domainArg(g, p, 'vcpucount')) },
  console: { group: 'domain', help: 'connect to the guest console', values: ['domain', 'devname'], flags: ['force', 'safe'], run: (g, p) => ((x) => (x ? consoleCmd(g, x[0], x[1]) : ''))(domainArg(g, p, 'console')) },
  'snapshot-list': { group: 'snapshot', help: 'List snapshots for a domain', values: ['domain'], flags: ['tree', 'parent', 'name', 'roots', 'leaves', 'internal', 'external', 'disk-only'], run: (g, p) => ((x) => (x ? snapshotList(g, p, x[1]) : ''))(domainArg(g, p, 'snapshot-list')) },
  'snapshot-create-as': { group: 'snapshot', help: 'Create a snapshot from a set of args', values: ['domain', 'name', 'description', 'diskspec', 'memspec'], flags: ['disk-only', 'atomic', 'no-metadata', 'quiesce', 'live', 'print-xml', 'halt'], run: (g, p) => ((x) => (x ? snapshotCreateAs(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'snapshot-create-as')) },
  'snapshot-delete': { group: 'snapshot', help: 'Delete a domain snapshot', values: ['domain', 'snapshotname'], flags: ['current', 'children', 'children-only', 'metadata'], run: (g, p) => ((x) => (x ? snapshotDelete(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'snapshot-delete')) },
  'snapshot-revert': { group: 'snapshot', help: 'Revert a domain to a snapshot', values: ['domain', 'snapshotname'], flags: ['current', 'running', 'paused', 'force', 'reset-nvram'], run: (g, p) => ((x) => (x ? snapshotRevert(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'snapshot-revert')) },
  'snapshot-current': { group: 'snapshot', help: 'Get or set the current snapshot', values: ['domain'], flags: ['name', 'security-info'], run: (g, p) => ((x) => (x ? snapshotCurrent(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'snapshot-current')) },
  'snapshot-info': {
    group: 'snapshot', help: 'snapshot information', values: ['domain', 'snapshotname'], flags: ['current'],
    run: (g, p) => {
      const x = domainArg(g, p, 'snapshot-info');
      if (!x) return '';
      const s = x[1].snapshots.find((y) => y.name === (p.values.snapshotname ?? p.pos[1] ?? x[1].current));
      return s ? snapshotInfoText(x[0], x[1], s) : failed(g, `Domain snapshot not found: no domain snapshot with matching name '${p.pos[1] ?? ''}'`);
    },
  },
  blockcommit: { group: 'domain', help: 'Start a block commit operation.', values: ['domain', 'path', 'base', 'top', 'bandwidth', 'timeout'], flags: ['active', 'pivot', 'keep-overlay', 'wait', 'verbose', 'delete', 'shallow', 'async', 'keep-relative', 'bytes'], run: (g, p) => ((x) => (x ? blockcommit(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'blockcommit')) },
  blockjob: { group: 'domain', help: 'Manage active block operations', values: ['domain', 'path', 'bandwidth'], flags: ['abort', 'pivot', 'info', 'async', 'raw', 'bytes'], run: (g, p) => ((x) => (x ? blockjob(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'blockjob')) },
  blockresize: { group: 'domain', help: 'Resize block device of domain.', values: ['domain', 'path', 'size'], flags: ['capacity'], run: (g, p) => ((x) => (x ? blockresize(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'blockresize')) },
  'attach-interface': { group: 'domain', help: 'attach network interface', values: ['domain', 'type', 'source', 'mac', 'model', 'target'], flags: ['config', 'live', 'current', 'persistent'], run: (g, p) => ((x) => (x ? attachInterface(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'attach-interface')) },
  'detach-interface': { group: 'domain', help: 'detach network interface', values: ['domain', 'type', 'mac'], flags: ['config', 'live', 'current', 'persistent'], run: (g, p) => ((x) => (x ? detachInterface(g, p, x[0], x[1]) : ''))(domainArg(g, p, 'detach-interface')) },
  'pool-list': { group: 'pool', help: 'list pools', flags: ['all', 'inactive', 'details'], run: (g) => poolList(g) },
  'pool-info': { group: 'pool', help: 'storage pool information', flags: ['bytes'], run: (g, p) => poolInfo(g, p) },
  'vol-list': { group: 'volume', help: 'list vols', values: ['pool'], flags: ['details'], run: (g, p) => volList(g, { ...p, pos: p.values.pool ? [p.values.pool] : p.pos }) },
  'net-list': { group: 'network', help: 'list networks', flags: ['all', 'inactive', 'name'], run: (g, p) => netList(g, p) },
  'net-info': { group: 'network', help: 'network information', run: (g, p) => netInfo(g, p) },
  'net-dumpxml': { group: 'network', help: 'network information in XML', flags: ['inactive'], run: (g, p) => netDumpxml(g, p) },
  'net-dhcp-leases': { group: 'network', help: 'print lease info for a given network', values: ['mac'], run: (g, p) => netLeases(g, p) },
  nodeinfo: { group: 'host', help: 'node information', run: (g) => nodeinfo(g) },
  nodememstats: { group: 'host', help: 'Prints memory stats of the node.', values: ['cell'], run: (g) => nodememstats(g) },
  version: { group: 'host', help: 'show version', flags: ['daemon'], run: () => 'Compiled against library: libvirt 11.3.0\nUsing library: libvirt 11.3.0\nUsing API: QEMU 11.3.0\nRunning hypervisor: QEMU 10.0.2\n' },
  uri: { group: 'host', help: 'print the hypervisor canonical URI', run: () => 'qemu:///system\n' },
  hostname: { group: 'host', help: 'print the hypervisor hostname', run: (g) => `${hostOf(g).hostName}\n` },
};

function bootConsole2(name: string): string[] {
  return ['[  OK  ] Reached target reboot.target - System Reboot.', '[    0.000000] Linux version 6.12.48+deb13-amd64 (debian-kernel@lists.debian.org)', '[  OK  ] Started ssh.service - OpenBSD Secure Shell server.', '', `Debian GNU/Linux 13 ${name} ttyS0`, '', `${name} login:`];
}

const GROUPS: [string, string][] = [
  ['domain', 'Domain Management'],
  ['monitor', 'Domain Monitoring'],
  ['host', 'Host and Hypervisor'],
  ['network', 'Networking'],
  ['pool', 'Storage Pool'],
  ['volume', 'Storage Volume'],
  ['snapshot', 'Snapshot'],
];

function virshHelp(game: Shell, topic?: string): string {
  if (topic && SUBS[topic]) {
    const s = SUBS[topic];
    return [`  NAME`, `    ${topic} - ${s.help}`, '', '  SYNOPSIS', `    ${topic}${s.values?.includes('domain') ? ' <domain>' : ''}${(s.values ?? []).filter((v) => v !== 'domain').map((v) => ` [--${v} <string>]`).join('')}${(s.flags ?? []).map((f) => ` [--${f}]`).join('')}`, '', `  ${game.t('virsh-help-man')}`].join('\n') + '\n';
  }
  if (topic) return failed(game, `command or command group '${topic}' doesn't exist`);
  const out = ['Grouping of commands:', ''];
  for (const [g, title] of GROUPS) {
    out.push(` ${title} (help keyword '${g}'):`);
    for (const [n, s] of Object.entries(SUBS).sort(([a], [b]) => a.localeCompare(b))) if (s.group === g) out.push(`    ${n.padEnd(31)}${s.help}`);
    out.push('');
  }
  return out.join('\n');
}

function virsh(game: Shell, args: string[]): string {
  if (!hasLibvirt(game)) return game.error('error: failed to connect to the hypervisor\nerror: Failed to connect socket to \'/var/run/libvirt/virtqemud-sock\': No such file or directory', 1);
  let rest = [...args];
  // Global options: -c URI, --connect URI, -q, -r.
  while (rest[0]?.startsWith('-')) {
    const o = rest.shift()!;
    if (o === '-h' || o === '--help') return help('virsh', VIRT.virsh, game.t);
    if (o === '-v' || o === '--version') return '11.3.0\n';
    if (o === '-c' || o === '--connect') {
      const uri = rest.shift() ?? '';
      if (uri !== 'qemu:///system') return game.error(`error: failed to connect to the hypervisor\nerror: ${game.t('virsh-only-system', { uri })}`, 1);
    } else if (!['-q', '--quiet', '-r', '--readonly'].includes(o)) return game.error(`virsh: unrecognized option '${o}'\nerror: unsupported option '-?'. See --help.`, 1);
  }
  const [sub, ...more] = rest;
  if (!sub) return game.error(game.t('virsh-no-shell'), 1);
  if (sub === 'help') return virshHelp(game, more[0]);
  const s = SUBS[sub];
  if (!s) return failed(game, `unknown command: '${sub}'`);
  if (more.includes('--help')) return virshHelp(game, sub);
  const p = parse(more, s.values ?? [], s.flags ?? []);
  if (p.bad) return failed(game, `command '${sub}' doesn't support option --${p.bad}`);
  // Changing a domain needs to be root or in the libvirt group (polkit's rule for qemu:///system).
  if (game.who !== 'root' && !game.groupsFor(game.who).includes('libvirt'))
    return failed(game, 'failed to connect to the hypervisor\nerror: authentication unavailable: no polkit agent available to authenticate action \'org.libvirt.unix.manage\'');
  const out = s.run(game, p, sub);
  return out.replace(/\n$/, '');
}

// ——— qemu-img ———

const qerror = (game: Shell, message: string, code = 1) => game.error(`qemu-img: ${message}`, code);

/** The domain whose running QEMU holds this image (by path, or the same file under another name). */
function holder(game: Shell, path: string): string | null {
  const lv = libvirt(game);
  const node = hostOf(game).find(path);
  for (const [name, d] of Object.entries(lv.domains)) if (active(d) && d.held && (path in d.held || Object.values(d.held).includes(node as never))) return name;
  return null;
}

/** Opens an image as qemu-img does: the file must exist and be readable; a running QEMU's lock is respected unless -U. */
function openImage(game: Shell, path: string, write: boolean, share: boolean): { file: import('../world').File; disk: DiskImage } | null {
  const n = game.find(path);
  if (!n || n.type !== 'file') {
    qerror(game, `Could not open '${path}': Could not open '${path}': No such file or directory`);
    return null;
  }
  if (!game.can(n, 'r') || (write && !game.can(n, 'w'))) {
    qerror(game, `Could not open '${path}': Could not open '${path}': Permission denied`);
    return null;
  }
  if (holder(game, game.resolve(path)) && (write || !share)) {
    qerror(game, `Could not open '${path}': Failed to get ${write ? '' : 'shared '}"write" lock\nIs another process using the image [${path}]?`);
    return null;
  }
  return { file: n, disk: n.disk ?? { format: 'raw', virtual: n.size ?? 0 } };
}

function infoBlock(game: Shell, path: string, file: import('../world').File, disk: DiskImage): string {
  const lines = [`image: ${path}`, `file format: ${disk.format === 'iso' ? 'raw' : disk.format}`, `virtual size: ${qemuSize(disk.virtual)} (${disk.virtual} bytes)`, `disk size: ${qemuSize(file.size ?? 0)}`];
  if (disk.format === 'qcow2') {
    lines.push('cluster_size: 65536');
    if (disk.backing) lines.push(`backing file: ${disk.backing}`, 'backing file format: qcow2');
    if (disk.snapshots?.length) {
      lines.push('Snapshot list:', 'ID        TAG               VM STATE SIZE   DATE                VM CLOCK     ICOUNT');
      for (const s of disk.snapshots) {
        const clock = new Date(s.vmClock).toISOString().slice(11, 23);
        lines.push(`${String(s.id).padEnd(10)}${s.tag.padEnd(18)}${qemuSize(s.vmSize).padStart(13)} ${stamp(s.date)} ${clock.padStart(15)} ${'--'.padStart(9)}`);
      }
    }
    lines.push('Format specific information:', '    compat: 1.1', '    compression type: zlib', '    lazy refcounts: false', '    refcount bits: 16', '    corrupt: false', '    extended l2: false');
  }
  lines.push("Child node '/file':", `    filename: ${path}`, '    protocol type: file', `    file length: ${qemuSize(file.size ?? 0)} (${file.size ?? 0} bytes)`, `    disk size: ${qemuSize(file.size ?? 0)}`);
  return lines.join('\n');
}

function qemuImg(game: Shell, args: string[]): string {
  const [sub, ...rest] = args;
  if (!sub || sub === '--help' || sub === '-h') return help('qemu-img', VIRT['qemu-img'], game.t);
  if (sub === '--version' || sub === '-V') return 'qemu-img version 10.0.2 (Debian 1:10.0.2+ds-2)\nCopyright (c) 2003-2025 Fabrice Bellard and the QEMU Project developers';
  const share = rest.includes('-U') || rest.includes('--force-share');
  const files = rest.filter((a, i) => !a.startsWith('-') && !['-f', '-O', '-b', '-F', '-o', '-l', '-c', '-d', '-a', '--output'].includes(rest[i - 1] ?? ''));
  const opt = (o: string) => ((i) => (i >= 0 ? rest[i + 1] : undefined))(rest.indexOf(o));
  switch (sub) {
    case 'info': {
      const path = files[0];
      if (!path) return qerror(game, 'Expecting one image file name');
      const img = openImage(game, path, false, share);
      if (!img) return '';
      if (!rest.includes('--backing-chain')) return infoBlock(game, path, img.file, img.disk);
      const blocks: string[] = [];
      let here: string | undefined = path;
      let k = 0;
      while (here && k++ < 10) {
        const o: { file: import('../world').File; disk: DiskImage } | null = here === path ? img : openImage(game, here, false, share);
        if (!o) return blocks.join('\n\n');
        blocks.push(infoBlock(game, here, o.file, o.disk));
        here = o.disk.backing;
      }
      return blocks.join('\n\n');
    }
    case 'check': {
      const path = files[0];
      if (!path) return qerror(game, 'Expecting one image file name');
      const img = openImage(game, path, false, share);
      if (!img) return '';
      const clusters = Math.ceil(img.disk.virtual / 65536);
      const allocated = Math.min(clusters, Math.ceil((img.file.size ?? 0) / 65536));
      return `No errors were found on the image.\n${allocated}/${clusters} = ${((100 * allocated) / clusters).toFixed(2)}% allocated, 0.00% fragmented, 0.00% compressed clusters\nImage end offset: ${img.file.size ?? 0}`;
    }
    case 'create': {
      const fmt = opt('-f') ?? 'raw';
      const backing = opt('-b');
      const [path, size] = files;
      if (!path) return qerror(game, 'Expecting image file name');
      let virtual = size ? qemuBytes(size) : null;
      if (size && virtual === null) return qerror(game, 'Invalid image size specified. You may use k, M, G, T, P or E suffixes for');
      if (backing) {
        if (!opt('-F')) return qerror(game, `${path}: Backing file specified without backing format\nDetected format of qcow2.`);
        const b = game.find(backing.startsWith('/') ? backing : `${path.replace(/[^/]*$/, '')}${backing}`);
        if (!b || b.type !== 'file') return qerror(game, `${path}: Could not open '${backing}': No such file or directory\nCould not open backing image.`);
        virtual ??= b.disk?.virtual ?? b.size ?? 0;
      }
      if (virtual === null) return qerror(game, `${path}: Image creation needs a size parameter`);
      const parent = game.find(path + '/..');
      if (!parent || parent.type !== 'directory' || !game.can(parent, 'w')) return qerror(game, `${path}: Could not create '${path}': Permission denied`);
      put(game, game.resolve(path), imageFile({ format: fmt === 'qcow2' ? 'qcow2' : 'raw', virtual, ...(backing ? { backing: backing.startsWith('/') ? backing : game.resolve(`${path}/../${backing}`) } : {}), fresh: 0 }, fmt === 'qcow2' ? 196 * KiB : 0, now(game), game.who));
      return fmt === 'qcow2'
        ? `Formatting '${path}', fmt=qcow2 cluster_size=65536 extended_l2=off compression_type=zlib size=${virtual}${backing ? ` backing_file=${backing} backing_fmt=${opt('-F')}` : ''} lazy_refcounts=off refcount_bits=16`
        : `Formatting '${path}', fmt=raw size=${virtual}`;
    }
    case 'resize': {
      const shrink = rest.includes('--shrink');
      const [path, size] = files;
      if (!path || !size) return qerror(game, 'Expecting image file name and size');
      const img = openImage(game, path, true, false);
      if (!img) return '';
      const rel = /^[+-]/.test(size);
      const amount = qemuBytes(size.replace(/^[+-]/, ''));
      if (amount === null) return qerror(game, 'Invalid image size specified. You may use k, M, G, T, P or E suffixes for');
      const target = rel ? img.disk.virtual + (size.startsWith('-') ? -amount : amount) : amount;
      if (target < img.disk.virtual && !shrink)
        return qerror(game, "warning: Shrinking an image will delete all data beyond the shrunken image's end. Before performing such an operation, make sure there is no important data there.\nqemu-img: Use the --shrink option to perform a shrink operation.");
      setDisk(img.file, { virtual: target, ...(target < img.disk.virtual ? { lost: true } : {}) });
      game.state.qemuResized = [...((game.state.qemuResized as string[] | undefined) ?? []), game.resolve(path)];
      return 'Image resized.';
    }
    case 'convert': {
      const fmt = opt('-O') ?? 'raw';
      const [src, dst] = files;
      if (!src || !dst) return qerror(game, 'Expecting one image file name');
      const img = openImage(game, src, false, share);
      if (!img) return '';
      // The whole chain, flattened into one image.
      const { links } = chainOf(game, game.resolve(src));
      const data = links.reduce((t, l) => t + Math.max(0, (l.file?.size ?? 0) - 196 * KiB), 0);
      const size = Math.min(img.disk.virtual, data);
      if (freeBytes(game, game.resolve(dst)) < size) return qerror(game, `error while writing at byte ${Math.floor(size / 3)}: No space left on device`);
      put(game, game.resolve(dst), imageFile({ format: fmt === 'qcow2' ? 'qcow2' : 'raw', virtual: img.disk.virtual, fresh: size }, fmt === 'qcow2' ? size : img.disk.virtual, now(game), game.who));
      return '';
    }
    case 'commit': {
      const path = files[0];
      if (!path) return qerror(game, 'Expecting one image file name');
      const img = openImage(game, path, true, false);
      if (!img) return '';
      if (!img.disk.backing) return qerror(game, 'Image does not have a backing file');
      const base = imageAt(game, img.disk.backing);
      if (!base) return qerror(game, `Could not open backing file: Could not open '${img.disk.backing}': No such file or directory`);
      if (holder(game, img.disk.backing)) return qerror(game, `Could not open '${img.disk.backing}': Failed to get "write" lock\nIs another process using the image [${img.disk.backing}]?`);
      const need = img.disk.fresh ?? 0;
      if (freeBytes(game, img.disk.backing) < need) return qerror(game, 'Block job failed: No space left on device');
      base.file.size = (base.file.size ?? 0) + need;
      setDisk(base.file, { fresh: (base.disk.fresh ?? 0) + need });
      // The top image is emptied (unless -d).
      if (!rest.includes('-d')) {
        img.file.size = 196 * KiB;
        setDisk(img.file, { fresh: 0 });
      }
      return 'Image committed.';
    }
    case 'snapshot': {
      const path = files[0];
      if (!path) return qerror(game, 'Expecting one image file name');
      if (rest.includes('-l')) {
        const img = openImage(game, path, false, share);
        if (!img) return '';
        const snaps = img.disk.snapshots ?? [];
        if (!snaps.length) return '';
        return ['Snapshot list:', 'ID        TAG               VM STATE SIZE   DATE                VM CLOCK     ICOUNT', ...snaps.map((s) => `${String(s.id).padEnd(10)}${s.tag.padEnd(18)}${qemuSize(s.vmSize).padStart(13)} ${stamp(s.date)} ${new Date(s.vmClock).toISOString().slice(11, 23).padStart(15)} ${'--'.padStart(9)}`)].join('\n');
      }
      const img = openImage(game, path, true, false);
      if (!img) return '';
      const del = opt('-d');
      if (del) {
        if (!img.disk.snapshots?.some((s) => s.tag === del)) return qerror(game, `Could not delete snapshot '${del}': snapshot not found`);
        setDisk(img.file, { snapshots: img.disk.snapshots.filter((s) => s.tag !== del) });
        return '';
      }
      const c = opt('-c');
      if (c) {
        const snaps = img.disk.snapshots ?? [];
        setDisk(img.file, { snapshots: [...snaps, { id: (snaps.at(-1)?.id ?? 0) + 1, tag: c, vmSize: 0, date: now(game), vmClock: 0, virtual: img.disk.virtual }] });
        return '';
      }
      return qerror(game, 'Expecting one image file name');
    }
    default:
      return qerror(game, `Command not found: ${sub}`);
  }
}

// ——— virt-install, virt-clone ———

function virtInstall(game: Shell, args: string[]): string {
  if (args.includes('--help') || args.includes('-h')) return help('virt-install', VIRT['virt-install'], game.t);
  const opt = (o: string) => ((i) => (i >= 0 ? args[i + 1] : undefined))(args.findIndex((a) => a === o || a === o.replace(/^--/, '-')));
  const name = opt('--name') ?? opt('-n');
  if (!name) return game.error('ERROR    --name is required', 1);
  if (libvirt(game).domains[name]) return game.error(`ERROR    Guest name '${name}' is already in use.`, 1);
  const memory = Number(opt('--memory') ?? opt('--ram') ?? '');
  if (!memory) return game.error('ERROR    --memory amount in MiB is required', 1);
  const vcpus = Number(opt('--vcpus') ?? '1');
  const diskSpec = opt('--disk') ?? '';
  const parts = Object.fromEntries(diskSpec.split(',').map((x) => (x.includes('=') ? x.split(/=(.*)/s).slice(0, 2) : ['path', x])));
  const path = parts.path ?? `${IMAGES}/${name}.qcow2`;
  if (!args.includes('--import') && !args.includes('--location') && !args.includes('--cdrom') && !args.includes('--pxe')) return game.error('ERROR    An install method must be specified\n(--location URL, --cdrom CD/ISO, --pxe, --import, --boot hd|cdrom|...)', 1);
  if (parts.size) {
    const bytes = Number(parts.size) * GiB;
    if (game.find(path)) return game.error(`ERROR    Disk ${path} is already in use by other guests [].`, 1);
    put(game, path, imageFile({ format: 'qcow2', virtual: bytes, fresh: 0 }, 196 * KiB, now(game)));
  } else if (!game.find(path)) return game.error(`ERROR    Error: --disk ${diskSpec}: Size must be specified for non existent volume '${path}'`, 1);
  const net = opt('--network') ?? 'network=default';
  const [ntype, nsource] = net.split(',')[0].split('=');
  const conf: DomConfig = {
    name, uuid: uuidOf(`${name}:${now(game)}`), memory: memory * 1024, currentMemory: memory * 1024, vcpus, maxVcpus: vcpus,
    osId: 'http://debian.org/debian/13',
    disks: [{ target: 'vda', source: path, format: 'qcow2', device: 'disk', bus: 'virtio' }],
    ifaces: net === 'none' ? [] : [{ type: ntype === 'bridge' ? 'bridge' : 'network', source: nsource ?? 'default', mac: '', model: 'virtio' }],
  };
  const r = define(game, conf);
  if ('error' in r) return game.error(`ERROR    ${r.error}`, 1);
  const e = startDomain(game, name);
  if (e) {
    delete libvirt(game).domains[name];
    return game.error(`ERROR    ${e}\nDomain installation does not appear to have been successful.`, 1);
  }
  sync(game);
  return `\nStarting install...\nCreating domain...                                          |    0 B  00:00:00\nDomain creation completed.${args.includes('--noautoconsole') ? '' : '\nRunning text console command: virsh --connect qemu:///system console ' + name}`;
}

function virtClone(game: Shell, args: string[]): string {
  if (args.includes('--help') || args.includes('-h')) return help('virt-clone', VIRT['virt-clone'], game.t);
  const opt = (o: string, s?: string) => ((i) => (i >= 0 ? args[i + 1] : undefined))(args.findIndex((a) => a === o || (s !== undefined && a === s)));
  const original = opt('--original', '-o');
  if (!original) return game.error('ERROR    --original is required', 1);
  const lv = libvirt(game);
  const src = lv.domains[original];
  if (!src) return game.error(`ERROR    Domain '${original}' was not found.`, 1);
  if (src.state === 'running' || src.state === 'in shutdown') return game.error('ERROR    Domain with devices to clone must be paused or shutoff.', 1);
  const name = opt('--name', '-n') ?? (args.includes('--auto-clone') ? `${original}-clone` : undefined);
  if (!name) return game.error('ERROR    A name is required for the new virtual machine, use \'--name NEW_VM_NAME\' to specify one.', 1);
  if (lv.domains[name]) return game.error(`ERROR    Invalid name for new guest: Guest name '${name}' is already in use.`, 1);
  const disk = src.config.disks.find((x) => x.device === 'disk')!;
  const dest = opt('--file', '-f') ?? `${IMAGES}/${name}.qcow2`;
  if (game.find(dest)) return game.error(`ERROR    The disk ${dest} already exists`, 1);
  const { links, missing } = chainOf(game, disk.source);
  if (missing) return game.error(`ERROR    Could not use path '${missing.path}' for cloning: No such file or directory`, 1);
  const size = links.reduce((t, l) => t + Math.max(0, (l.file?.size ?? 0) - 196 * KiB), 0);
  if (freeBytes(game, dest) < size) return game.error(`ERROR    There is not enough free space on the storage pool to create the volume. (${Math.floor(freeBytes(game, dest) / MiB)} M requested allocation > ${Math.floor(size / MiB)} M available)`, 1);
  put(game, dest, imageFile({ format: 'qcow2', virtual: links[0].file!.disk!.virtual, fresh: size }, size, now(game)));
  const conf: DomConfig = { ...structuredClone(src.config), name, uuid: uuidOf(`${name}:clone:${now(game)}`) };
  conf.disks = conf.disks.map((x) => (x.device === 'disk' && x.target === disk.target ? { ...x, source: dest } : x));
  conf.ifaces = conf.ifaces.map((i, k) => ({ ...i, mac: freshMac(game, `${name}:clone:${k}`) }));
  define(game, conf);
  // The disk is a copy: inside, the same machine-id and hostname as the original.
  lv.guests[name] = { ...guestIdentity(game, original) };
  const s = hostOf(game).internals.get(name);
  if (s) {
    const id = lv.guests[name];
    const write = (path: string, text: string) => {
      const n = s.find(path);
      if (n?.type === 'file') n.content = text;
    };
    write('/etc/machine-id', id.machineId);
    write('/etc/hostname', id.hostname);
  }
  sync(game);
  return `Allocating '${dest.split('/').at(-1)}'${' '.repeat(Math.max(1, 30 - dest.split('/').at(-1)!.length))}|  ${Math.round(links[0].file!.disk!.virtual / GiB)} GB  00:00:07\n\nClone '${name}' created successfully.`;
}

// ——— Inside a guest: growpart, and resize2fs on its partition ———

const SECTORS = (bytes: number) => Math.floor(bytes / 512);

interface GuestRoot {
  name: string;
  disk?: number;
  part?: number;
  capacity: number;
  path: string;
}
const guestRoot = (game: Shell): GuestRoot | undefined => ((game.state.mounts ?? []) as GuestRoot[]).find((m) => m.path === '/' && m.name === '/dev/vda1' && m.disk !== undefined);

function growpart(game: Shell, args: string[]): string {
  if (args.includes('--help') || args.includes('-h')) return help('growpart', VIRT.growpart, game.t);
  const dry = args.includes('-N') || args.includes('--dry-run');
  const [disk, part] = args.filter((a) => !a.startsWith('-'));
  if (!disk || !part) return game.error('growpart disk partition\n   rewrite partition table so that partition takes up all the space it can\n   options:\n    -h | --help       print Usage and exit\n         --fudge F    if part could be resized, but change would be less than \'F\' bytes, do not resize (default: 1048576)\n    -N | --dry-run    only report what would be done, show new \'sfdisk -d\'\n    -v | --verbose    increase verbosity / debug\n    -u | --update  R  update the the kernel partition table info after growing\n\nExample:\n - growpart /dev/sda 1\n   Resize partition 1 on /dev/sda', 2);
  const root = guestRoot(game);
  if (!root || disk !== '/dev/vda' || part !== '1') return game.error(`FAILED: ${disk}: does not exist`, 2);
  if (game.who !== 'root') return game.error(`failed [sfd_dump:1] sfdisk --unit=S --dump ${disk}\nsfdisk: cannot open ${disk}: Permission denied\nFAILED: failed to dump sfdisk info for ${disk}`, 2);
  const start = 2048;
  const oldSize = SECTORS(root.part!) ;
  const newSize = SECTORS(root.disk!) - start - 33;
  if (newSize <= oldSize + 2048) return game.error(`NOCHANGE: partition 1 is size ${oldSize}. it cannot be grown`, 1);
  const line = `CHANGED: partition=1 start=${start} old: size=${oldSize} end=${start + oldSize - 1} new: size=${newSize} end=${start + newSize - 1}`;
  if (dry) return line.replace('CHANGED', 'CHANGE');
  root.part = newSize * 512;
  game.state.grownPart = (game.state.grownPart as number | undefined ?? 0) + 1;
  return line;
}

/** resize2fs on a guest's root partition: the file system takes the whole partition. null: not a guest's partition. */
export function resizeGuestFs(game: Shell, target: string): string | null {
  const root = guestRoot(game);
  if (!root || target !== '/dev/vda1') return null;
  const header = 'resize2fs 1.47.2 (1-Jan-2025)';
  if (game.who !== 'root') return game.error(`${header}\nresize2fs: Permission denied while trying to open ${target}\nCouldn't find valid filesystem superblock.`, 1);
  const blocks = (b: number) => Math.floor(b / 4096);
  if (blocks(root.capacity) >= blocks(root.part!)) return `${header}\nThe filesystem is already ${blocks(root.capacity)} (4k) blocks long.  Nothing to do!\n`;
  const desc = (b: number) => Math.ceil(Math.ceil(b / 4096 / 32_768) / 64);
  const before = root.capacity;
  root.capacity = blocks(root.part!) * 4096;
  return [header, `Filesystem at ${target} is mounted on /; on-line resizing required`, `old_desc_blocks = ${desc(before)}, new_desc_blocks = ${desc(root.capacity)}`, `The filesystem on ${target} is now ${blocks(root.capacity)} (4k) blocks long.`, ''].join('\n');
}

// ——— systemd-machine-id-setup (systemd 257) ———

function machineIdSetup(game: Shell, args: string[]): string {
  if (args.includes('--help') || args.includes('-h')) return help('systemd-machine-id-setup', VIRT['systemd-machine-id-setup'], game.t);
  const bad = args.find((a) => !['--print', '--commit'].includes(a) && !a.startsWith('--root='));
  if (bad) return game.error(`systemd-machine-id-setup: unrecognized option '${bad}'`, 1);
  const current = (game.read('/etc/machine-id') ?? '').trim();
  if (/^[0-9a-f]{32}$/.test(current)) return args.includes('--print') ? current : '';
  if (game.who !== 'root') return game.error('Failed to initialize machine ID: Permission denied', 1);
  // In a KVM guest, systemd takes the VM's UUID (its SMBIOS product_uuid).
  const d = hasLibvirt(game) && hostOf(game) !== game ? libvirt(game).domains[game.host] : undefined;
  const id = d ? d.config.uuid.replace(/-/g, '') : uuidOf(`${game.host}:${now(game)}`).replace(/-/g, '');
  put(game, '/etc/machine-id', { type: 'file', content: id, lines: true, owner: 'root', mode: 'r--r--r--' });
  return [`Initializing machine ID from ${d ? 'VM' : 'random generator'}${d ? ' UUID' : ''}.`, ...(args.includes('--print') ? [id] : [])].join('\n');
}

export const VIRT: Record<string, Command> = {
  'systemd-machine-id-setup': { section: 1, ownOptions: true, launch: ({ args, game }) => machineIdSetup(game, args) },
  virsh: { ownOptions: true, launch: ({ args, game }) => virsh(game, args) },
  'qemu-img': { ownOptions: true, launch: ({ args, game }) => qemuImg(game, args) },
  'virt-install': { ownOptions: true, launch: ({ args, game }) => virtInstall(game, args) },
  'virt-clone': { ownOptions: true, launch: ({ args, game }) => virtClone(game, args) },
  growpart: { ownOptions: true, launch: ({ args, game }) => growpart(game, args) },
};
