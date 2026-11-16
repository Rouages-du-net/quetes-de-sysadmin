// Solaris 10's administration commands, on the model of ../solaris.ts: SMF
// (svcs, svcadm, svcprop), ZFS (zfs, zpool), zones (zoneadm, zonename),
// packages (pkginfo), the processor (isainfo) and prstat. Outputs after
// Solaris 10's manual pages (https://docs.oracle.com/cd/E26505_01/) — in
// English, as on the real system.

import type { Shell } from '../shell';
import type { Command } from './index';
import type { Process } from './system';
import { isSolaris, matchFmri, smf, zfs, type SmfService } from '../solaris';

const notHere = (game: Shell, cmd: string) => {
  game.status = 127;
  return game.error(`-bash: ${cmd}: command not found`);
};
const only = (f: (game: Shell, args: string[]) => string, name: string): Command['launch'] => ({ args, game }) => (isSolaris(game) ? f(game, args) : notHere(game, name));

const ORDER = ['legacy_run', 'disabled', 'online', 'offline', 'maintenance'];

// ——— svcs ———

function svcs(game: Shell, args: string[]): string {
  const st = smf(game);
  const flags = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const bad = [...flags].find((l) => !'aHlpvx'.includes(l));
  if (bad) return game.error(`svcs: illegal option -- ${bad}\nUsage: svcs [-aHpv] [-o col[,col]...] [-R restarter] [-sS col] [<service> ...]\n       svcs -d | -D [-Hpv] [-o col[,col]...] [-sS col] <service> ...\n       svcs -l <service> ...\n       svcs -x [-v] [<service> ...]\n       svcs -?`, 2);
  const patterns = args.filter((a) => !a.startsWith('-'));
  let fmris = Object.keys(st.services);
  if (patterns.length) {
    const chosen = new Set<string>();
    for (const p of patterns) {
      const m = matchFmri(game, p);
      if (!m.length) game.error(`svcs: Pattern '${p}' doesn't match any instances`, 1);
      m.forEach((f) => chosen.add(f));
    }
    fmris = [...chosen];
    if (!fmris.length) return '';
  }
  const s = (f: string) => st.services[f];
  if (flags.has('x')) {
    // Explain what doesn't run although it should (maintenance, offline).
    const trouble = fmris.filter((f) => ['maintenance', 'offline'].includes(s(f).state));
    return trouble
      .map((f) =>
        [
          `${f} (${s(f).description})`,
          ` State: ${s(f).state} since ${s(f).stime}`,
          `Reason: ${s(f).reason ?? 'Start method exited with $SMF_EXIT_ERR_CONFIG.'}`,
          '   See: http://sun.com/msg/SMF-8000-KS',
          `   See: /var/svc/log/${f.replace(/^svc:\//, '').replace(/\//g, '-')}.log`,
          'Impact: This service is not running.',
        ].join('\n'),
      )
      .join('\n\n');
  }
  if (flags.has('l')) {
    return fmris
      .map((f) =>
        [
          `fmri         ${f}`,
          `name         ${s(f).description}`,
          `enabled      ${s(f).state === 'disabled' ? 'false' : s(f).temporary ? 'false (temporary)' : 'true'}`,
          `state        ${s(f).state}`,
          'next_state   none',
          `state_time   ${s(f).stime}`,
          `logfile      /var/svc/log/${f.replace(/^svc:\//, '').replace(/\//g, '-')}.log`,
          'restarter    svc:/system/svc/restarter:default',
          ...(s(f).state === 'online' && s(f).contract ? [`contract_id  ${s(f).contract}`] : []),
          'dependency   require_all/none svc:/milestone/network:default (online)',
        ].join('\n'),
      )
      .join('\n\n');
  }
  // Without -a: what isn't disabled.
  const shown = fmris.filter((f) => flags.has('a') || patterns.length || s(f).state !== 'disabled');
  shown.sort((a, b) => ORDER.indexOf(s(a).state) - ORDER.indexOf(s(b).state) || a.localeCompare(b));
  const procs: Process[] = game.state.process ?? [];
  const lines = flags.has('H') ? [] : ['STATE          STIME    FMRI'];
  for (const f of shown) {
    lines.push(`${s(f).state.padEnd(14)} ${(s(f).state === 'disabled' ? s(f).stime.split(' ').slice(1, 3).join('_') : 'Mar_03').padEnd(8)} ${f}`);
    if (flags.has('p'))
      for (const pid of s(f).pids ?? []) {
        const p = procs.find((x) => x.pid === pid);
        if (p) lines.push(`               ${'6:12:44'.padStart(8)} ${String(pid).padStart(8)} ${p.command.split(' ')[0].split('/').at(-1)}`);
      }
  }
  return lines.join('\n');
}

// ——— svcadm ———

function svcadm(game: Shell, args: string[]): string {
  const [verb, ...rest] = args;
  const usage =
    'Usage: svcadm [-v] [cmd [args ...]]\n\n\tsvcadm enable [-rst] <service> ...\t- enable and online service(s)\n\tsvcadm disable [-st] <service> ...\t- disable and offline service(s)\n\tsvcadm restart <service> ...\t\t- restart specified service(s)\n\tsvcadm refresh <service> ...\t\t- re-read service configuration\n\tsvcadm mark [-It] <state> <service> ...\t- set maintenance state\n\tsvcadm clear <service> ...\t\t- clear maintenance state\n\tsvcadm milestone [-d] <milestone>\t- advance to a service milestone';
  if (!verb || !['enable', 'disable', 'restart', 'refresh', 'clear'].includes(verb)) return game.error(usage, 2);
  const temporary = rest.includes('-t');
  const patterns = rest.filter((a) => !a.startsWith('-'));
  if (!patterns.length) return game.error(usage, 2);
  for (const p of patterns) {
    const m = matchFmri(game, p);
    if (!m.length) {
      game.error(`svcadm: Pattern '${p}' doesn't match any instances`, 1);
      continue;
    }
    if (m.length > 1) {
      game.error(`svcadm: Pattern '${p}' matches multiple instances:\n${m.map((f) => `\t${f}`).join('\n')}`, 1);
      continue;
    }
    const f = m[0];
    if (game.who !== 'root') {
      game.error(`svcadm: ${f}: Permission denied.`, 1);
      continue;
    }
    const s: SmfService = smf(game).services[f];
    if (verb === 'enable' && s.state !== 'online') {
      s.state = 'online';
      s.temporary = temporary;
      s.onEnable?.(game);
    } else if (verb === 'disable' && s.state !== 'disabled') {
      s.state = 'disabled';
      s.temporary = temporary;
      s.stime = 'Wed Nov 20 14:02:11 2029';
      s.onDisable?.(game);
    } else if ((verb === 'restart' || verb === 'refresh') && s.state === 'online') {
      s.onDisable?.(game);
      s.onEnable?.(game);
    } else if (verb === 'clear' && s.state === 'maintenance') s.state = 'online';
  }
  return '';
}

// ——— svcprop ———

function svcprop(game: Shell, args: string[]): string {
  const pi = args.indexOf('-p');
  const prop = pi >= 0 ? args[pi + 1] : undefined;
  const pattern = args.filter((a, k) => !a.startsWith('-') && (pi < 0 || k !== pi + 1))[0];
  if (!pattern) return game.error('Usage: svcprop [-fqtv] [-C | -c | -s snapshot] [-p [name/]name]... \n         {FMRI | pattern}...', 2);
  const m = matchFmri(game, pattern);
  if (!m.length) return game.error(`svcprop: Pattern '${pattern}' doesn't match any entities`, 1);
  const props = smf(game).services[m[0]].props ?? {};
  if (prop) {
    const key = Object.keys(props).find((k) => k === prop || k.endsWith(`/${prop}`));
    if (!key) return game.error(`svcprop: Couldn't find property \`${prop}' for instance \`${m[0]}'.`, 1);
    return props[key];
  }
  return Object.entries(props)
    .map(([k, v]) => `${k} astring ${v}`)
    .join('\n');
}

// ——— prstat ———

function prstat(game: Shell): string {
  const procs: Process[] = game.state.process ?? [];
  const lines = ['   PID USERNAME  SIZE   RSS STATE  PRI NICE      TIME  CPU PROCESS/NLWP'];
  for (const p of [...procs].sort((a, b) => b.cpu - a.cpu || a.pid - b.pid)) {
    const size = Math.round(4 + p.mem * 40);
    const name = p.command.split(' ')[0].split('/').at(-1) ?? p.command;
    lines.push(
      `${String(p.pid).padStart(6)} ${p.user.padEnd(8)} ${`${size}M`.padStart(5)} ${`${Math.round(size * 0.4)}M`.padStart(5)} ${(p.cpu > 0 ? 'cpu0' : 'sleep').padEnd(6)} ${'59'.padStart(3)} ${'0'.padStart(4)} ${'0:00:12'.padStart(9)} ${`${p.cpu.toFixed(1)}%`.padStart(4)} ${name}/1`,
    );
  }
  lines.push(`Total: ${procs.length} processes, ${procs.length * 3 + 12} lwps, load averages: 0.08, 0.07, 0.06`);
  return lines.join('\n');
}

// ——— zfs, zpool ———

function zfsCommand(game: Shell, args: string[]): string {
  const z = zfs(game);
  const [verb, ...rest] = args;
  if (verb === 'list') {
    const ti = rest.indexOf('-t');
    const type = ti >= 0 ? rest[ti + 1] : 'filesystem';
    const names = rest.filter((a, k) => !a.startsWith('-') && (ti < 0 || k !== ti + 1));
    const rows: string[][] = [['NAME', 'USED', 'AVAIL', 'REFER', 'MOUNTPOINT']];
    if (type === 'filesystem' || type === 'all')
      for (const [n, d] of Object.entries(z.datasets)) if (!names.length || names.some((x) => n === x || n.startsWith(`${x}/`))) rows.push([n, d.used, d.avail, d.refer, d.mountpoint]);
    if (type === 'snapshot' || type === 'all')
      for (const [n, s] of Object.entries(z.snapshots)) if (!names.length || names.some((x) => n.startsWith(`${x}@`) || n.startsWith(`${x}/`))) rows.push([n, s.used, '-', s.refer, '-']);
    if (rows.length === 1) return type === 'snapshot' ? 'no datasets available' : '';
    const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
    return rows.map((r) => r.map((c, i) => (i === 0 || i === 4 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ').trimEnd()).join('\n');
  }
  if (verb === 'snapshot') {
    const name = rest.find((a) => !a.startsWith('-'));
    if (!name || !name.includes('@')) return game.error(`missing snapshot argument\nusage:\n\tsnapshot [-r] [-o property=value] ... <filesystem@snapname|volume@snapname> ...`, 2);
    const [ds] = name.split('@');
    if (!z.datasets[ds]) return game.error(`cannot open '${ds}': dataset does not exist`, 1);
    if (game.who !== 'root') return game.error(`cannot create snapshot '${name}': permission denied`, 1);
    if (z.snapshots[name]) return game.error(`cannot create snapshot '${name}': dataset already exists`, 1);
    z.snapshots[name] = { used: '0', refer: z.datasets[ds].refer, creation: 'Wed Nov 20 14:02 2029' };
    return '';
  }
  if (verb === 'destroy') {
    const name = rest.find((a) => !a.startsWith('-'));
    if (!name) return game.error('missing dataset argument', 2);
    if (game.who !== 'root') return game.error(`cannot destroy '${name}': permission denied`, 1);
    if (z.snapshots[name]) {
      delete z.snapshots[name];
      return '';
    }
    if (z.datasets[name]) return game.error(`cannot destroy '${name}': filesystem has children\nuse '-r' to destroy the following datasets:`, 1);
    return game.error(`cannot open '${name}': dataset does not exist`, 1);
  }
  if (verb === 'get') {
    const [prop, name] = rest.filter((a) => !a.startsWith('-'));
    const d = z.datasets[name ?? ''];
    if (!d) return game.error(`cannot open '${name ?? ''}': dataset does not exist`, 1);
    const value = prop === 'mountpoint' ? d.mountpoint : prop === 'used' ? d.used : prop === 'available' ? d.avail : prop === 'readonly' ? 'off' : '-';
    return `NAME         PROPERTY    VALUE         SOURCE\n${name.padEnd(12)} ${(prop ?? '').padEnd(11)} ${value.padEnd(13)} default`;
  }
  return game.error(`unrecognized command '${verb ?? ''}'\nusage: zfs command args ...\nwhere 'command' is one of the following:\n\n\tlist [-rH][-d max] [-o property[,...]] [-t type[,...]] [-s property] ...\n\tsnapshot [-r] [-o property=value] ... <filesystem@snapname|volume@snapname> ...\n\tdestroy [-rRf] <filesystem|volume|snapshot>\n\tget [-rHp] [-d max] [-o field[,...]] [-s source[,...]] <\"all\" | property[,...]> [filesystem|volume|snapshot] ...`, 2);
}

function zpool(game: Shell, args: string[]): string {
  const z = zfs(game);
  const [verb] = args;
  if (verb === 'list' || !verb) {
    const rows = [['NAME', 'SIZE', 'ALLOC', 'FREE', 'CAP', 'HEALTH', 'ALTROOT'], ...Object.entries(z.pools).map(([n, p]) => [n, p.size, p.alloc, p.free, '3%', p.health, '-'])];
    const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
    return rows.map((r) => r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ')).join('\n');
  }
  if (verb === 'status')
    return Object.entries(z.pools)
      .map(([n, p]) =>
        [
          `  pool: ${n}`,
          ` state: ${p.health}`,
          ' scrub: scrub completed after 0h12m with 0 errors on Sun Nov 17 03:12:41 2029',
          'config:',
          '',
          '\tNAME          STATE     READ WRITE CKSUM',
          `\t${n.padEnd(13)} ${p.health.padEnd(9)}    0     0     0`,
          `\t  mirror-0    ${p.health.padEnd(9)}    0     0     0`,
          ...p.devices.map((d) => `\t    ${d.padEnd(9)} ${p.health.padEnd(9)}    0     0     0`),
          '',
          'errors: No known data errors',
        ].join('\n'),
      )
      .join('\n\n');
  return game.error(`unrecognized command '${verb}'\nusage: zpool command args ...`, 2);
}

// ——— zones, packages, processor ———

const zoneadm = (game: Shell, args: string[]) =>
  args[0] === 'list'
    ? args.includes('-v') || args.some((a) => /^-\w*v/.test(a))
      ? '  ID NAME             STATUS     PATH                           BRAND    IP    \n   0 global           running    /                              native   shared'
      : 'global'
    : game.error('usage:\tzoneadm [-z <zone>] [-u <uuid-match>] <subcommand>\n\tlist [-cipv]', 253);

const PACKAGES: [string, string, string][] = [
  ['system', 'SUNWcsr', 'Core Solaris, (Root)'],
  ['system', 'SUNWcsu', 'Core Solaris, (Usr)'],
  ['system', 'SUNWzfsu', 'ZFS (Usr)'],
  ['application', 'SUNWpostgr-84-server', 'PostgreSQL 8.4 server'],
  ['application', 'SUNWpostgr-84-client', 'PostgreSQL 8.4 client tools'],
  ['application', 'SUNWpostgr-84-libs', 'PostgreSQL 8.4 client libraries'],
  ['application', 'SUNWsshdu', 'SSH Server, (Usr)'],
  ['application', 'SMCsudo', 'sudo (from sunfreeware.com)'],
];

function pkginfo(game: Shell, args: string[]): string {
  const li = args.indexOf('-l');
  const name = args.find((a) => !a.startsWith('-'));
  if (li >= 0) {
    const p = PACKAGES.find(([, n]) => n === name);
    if (!p) return game.error(`ERROR: information for "${name ?? ''}" was not found`, 1);
    return [`   PKGINST:  ${p[1]}`, `      NAME:  ${p[2]}`, `  CATEGORY:  ${p[0]}`, '      ARCH:  sparc', '   VERSION:  11.10.0,REV=2005.01.21.15.53', '    STATUS:  completely installed'].join('\n');
  }
  const list = name ? PACKAGES.filter(([, n]) => n === name) : PACKAGES;
  if (name && !list.length) return game.error(`ERROR: information for "${name}" was not found`, 1);
  return list.map(([c, n, d]) => `${c.padEnd(11)} ${n.padEnd(22)} ${d}`).join('\n');
}

function isainfo(_game: Shell, args: string[]): string {
  if (args.includes('-b')) return '64';
  if (args.includes('-k') || args.includes('-n')) return 'sparcv9';
  if (args.includes('-v')) return '64-bit sparcv9 applications\n\tvis2 vis \n32-bit sparc applications\n\tvis2 vis v8plus div32 mul32';
  return 'sparcv9 sparc';
}

export const SOLARIS: Record<string, Command> = {
  svcs: { ownOptions: true, launch: only(svcs, 'svcs') },
  svcadm: { section: 8, ownOptions: true, launch: only(svcadm, 'svcadm') },
  svcprop: { ownOptions: true, launch: only(svcprop, 'svcprop') },
  prstat: { section: 8, ownOptions: true, launch: only((game) => prstat(game), 'prstat') },
  zfs: { section: 8, ownOptions: true, launch: only(zfsCommand, 'zfs') },
  zpool: { section: 8, ownOptions: true, launch: only(zpool, 'zpool') },
  zoneadm: { section: 8, ownOptions: true, launch: only(zoneadm, 'zoneadm') },
  zonename: { ownOptions: true, launch: only(() => 'global', 'zonename') },
  pkginfo: { ownOptions: true, launch: only(pkginfo, 'pkginfo') },
  isainfo: { ownOptions: true, launch: only(isainfo, 'isainfo') },
};
