// A Rocky Linux machine's packages and firewall (the `rhel` family): dnf
// (DNF 4.20, the dnf of Rocky and RHEL 10; dnf5 is Fedora's), rpm 4.19 and
// firewall-cmd 2.4.3, on the models of ../rpm.ts and ../firewalld.ts.
// Outputs after their sources at those versions (Rocky's src.rpms):
// dnf/cli/output.py (the transaction table, "Is this ok [y/N]: ",
// fmtSection, historyListCmd), dnf/cli/cli.py ("This command has to be run
// with superuser privileges…", provides' "No matches found…"),
// dnf/base.py ("Last metadata expiration check: …", "No match for
// argument"), dnf/cli/commands/install.py ("Unable to find a match");
// rpm's lib/query.c ("package %s is not installed", "file %s is not owned
// by any package"), lib/verify.c (S.5....T.  c); firewalld's
// firewall-cmd.in and command.py ("success", "Warning: ALREADY_ENABLED",
// "Error: INVALID_SERVICE", "Authorization failed.", "FirewallD is not
// running", print_zone_policy_info's --list-all).
// Documentation: https://dnf.readthedocs.io/en/latest/command_ref.html,
// https://rpm.org/docs/4.19.x/man/rpm.8, https://firewalld.org/documentation/man-pages/firewall-cmd.html
// Differences (docs/SCENARIOS.md): the repositories answer at once, no
// GPG check shown, a few packages, the transaction's progress lines shortened.

import type { Shell } from '../shell';
import type { Command } from './index';
import { systemd } from '../systemd';
import { ALL, BASE, byName, closure, installFiles, isInstalled, nevra, removeFiles, rpm, type Pkg } from '../rpm';
import { firewalld, parseRich, reloadFirewall, richText, running, SERVICES, VERSION, ZONES, type Zone } from '../firewalld';

// ——— Formats ———

/** dnf's format_number: 47 k, 1.5 M. */
export function size(n: number): string {
  const units = ['', 'k', 'M', 'G'];
  let v = n;
  let i = 0;
  while (v > 999 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  if (i === 0) return `${Math.round(v)}`;
  return `${v < 9.95 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
/** %c in the en_US locale: Mon 07 Dec 2026 06:35:12 PM UTC. */
export function cTime(ms: number): string {
  const d = new Date(ms);
  const day = d.toUTCString().slice(0, 3);
  const month = d.toUTCString().slice(8, 11);
  const h = d.getUTCHours();
  const hh = String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0');
  return `${day} ${String(d.getUTCDate()).padStart(2, '0')} ${month} ${d.getUTCFullYear()} ${hh}:${d.toISOString().slice(14, 19)} ${h < 12 ? 'AM' : 'PM'} UTC`;
}
const clock = (game: Shell) => systemd(game)?.clock ?? 0;
const ago = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const metadataLine = (game: Shell) => `Last metadata expiration check: ${ago(clock(game) - rpm(game).metadata)} ago on ${cTime(rpm(game).metadata)}.`;
const section = (text: string) => {
  const cols = 78;
  const fill = Math.max(2, Math.floor((cols - text.length - 2) / 2));
  const end = Math.max(2, cols - text.length - 2 - fill);
  return `${'='.repeat(fill)} ${text} ${'='.repeat(end)}`;
};
const RULE = '='.repeat(80);
const vr = (p: Pkg) => `${p.version}-${p.release}`;

function table(rows: [string, Pkg[]][]): string[] {
  const out = [RULE, ` ${'Package'.padEnd(29)} ${'Architecture'.padEnd(12)} ${'Version'.padEnd(26)} ${'Repository'.padEnd(10)} ${'Size'.padStart(6)}`, RULE];
  for (const [title, pkgs] of rows) {
    if (!pkgs.length) continue;
    out.push(`${title}:`);
    for (const p of pkgs) out.push(` ${p.name.padEnd(29)} ${p.arch.padEnd(12)} ${vr(p).padEnd(26)} ${p.repo.padEnd(10)} ${size(p.size).padStart(6)}`);
  }
  return out;
}

// ——— dnf ———

const SUPERUSER = 'Error: This command has to be run with superuser privileges (under the root user on most systems).';

function dnfInstall(game: Shell, names: string[], yes: boolean, command: string): string {
  if (game.who !== 'root') return game.error(SUPERUSER, 1);
  const out = [metadataLine(game)];
  const missing = names.filter((n) => !byName(n));
  const already = names.filter((n) => byName(n) && isInstalled(game, n));
  for (const n of already) out.push(`Package ${nevra(byName(n)!)} is already installed.`);
  if (missing.length) {
    for (const n of missing) out.push(`No match for argument: ${n}`);
    game.error(`Error: Unable to find a match: ${missing.join(' ')}`, 1);
    return out.join('\n');
  }
  const { main, deps, weak } = closure(game, names);
  out.push('Dependencies resolved.');
  if (!main.length) {
    out.push('Nothing to do.', 'Complete!');
    return out.join('\n');
  }
  const all = [...main, ...deps, ...weak];
  out.push(
    ...table([
      ['Installing', main],
      ['Installing dependencies', deps],
      ['Installing weak dependencies', weak],
    ]),
    '',
    'Transaction Summary',
    RULE,
    `Install  ${all.length} Package${all.length > 1 ? 's' : ''}`,
    '',
    `Total download size: ${size(all.reduce((t, p) => t + p.size, 0))}`,
    `Installed size: ${size(all.reduce((t, p) => t + p.installed, 0))}`,
  );
  const run = () => {
    const sorted = [...deps, ...weak, ...main];
    const total = sorted.length;
    const lines = ['Downloading Packages:'];
    sorted.forEach((p, i) => lines.push(`(${i + 1}/${total}): ${`${nevra(p)}.rpm`.padEnd(44).slice(0, 44)} ${'2.4 MB/s'.padStart(9)} | ${size(p.size).padStart(5)}B     00:00`));
    lines.push('-'.repeat(80), `${'Total'.padEnd(48)}${'3.1 MB/s'.padStart(9)} | ${size(all.reduce((t, p) => t + p.size, 0)).padStart(5)}B     00:00`);
    lines.push('Running transaction check', 'Transaction check succeeded.', 'Running transaction test', 'Transaction test succeeded.', 'Running transaction');
    lines.push(`  Preparing        :${' '.repeat(54)}1/1`);
    sorted.forEach((p, i) => {
      lines.push(`  Installing       : ${nevra(p).padEnd(52)}${`${i + 1}/${total}`.padStart(6)}`);
      if (p.accounts || p.units) lines.push(`  Running scriptlet: ${nevra(p).padEnd(52)}${`${i + 1}/${total}`.padStart(6)}`);
    });
    sorted.forEach((p, i) => lines.push(`  Verifying        : ${nevra(p).padEnd(52)}${`${i + 1}/${total}`.padStart(6)}`));
    const at = clock(game);
    for (const p of sorted) {
      installFiles(game, p);
      rpm(game).installed[p.name] = { at, from: p.repo };
    }
    const r = rpm(game);
    r.history.push({ id: r.history.length + 1, command, at, user: game.player, action: 'Install', packages: sorted.map((p) => p.name) });
    lines.push('', 'Installed:');
    // dnf's list in columns: as many as fit in 80, each as wide as its widest name plus two.
    const names2 = sorted.map(nevra).sort();
    const width = Math.max(...names2.map((x) => x.length)) + 2;
    const per = Math.max(1, Math.floor(78 / width));
    for (let i = 0; i < names2.length; i += per) lines.push(`  ${names2.slice(i, i + per).map((x) => x.padEnd(width)).join('').trimEnd()}`);
    lines.push('', 'Complete!');
    return lines.join('\n');
  };
  if (yes) return `${out.join('\n')}\n${run()}`;
  game.ask('Is this ok [y/N]: ', (answer) => {
    if (!/^y(es)?$/i.test(answer.trim())) {
      game.error('Operation aborted.', 1);
      return '';
    }
    return run();
  });
  return out.join('\n');
}

function dnfRemove(game: Shell, names: string[], yes: boolean, command: string): string {
  if (game.who !== 'root') return game.error(SUPERUSER, 1);
  const found = names.map((n) => byName(n)).filter((p): p is Pkg => !!p && isInstalled(game, p.name));
  const out: string[] = [];
  for (const n of names) if (!found.some((p) => p.name === n)) out.push(`No match for argument: ${n}`);
  if (!found.length) {
    game.error('Error: No packages marked for removal.', 1);
    return out.join('\n');
  }
  // clean_requirements_on_remove: the dependencies installed with them go too.
  const deps = found.flatMap((p) => [...(p.requires ?? []), ...(p.weak ?? [])]).map(byName).filter((p): p is Pkg => !!p && isInstalled(game, p.name) && !BASE.includes(p) && !found.includes(p));
  const unique = [...new Set(deps)];
  const all = [...found, ...unique];
  out.push(
    'Dependencies resolved.',
    ...table([
      ['Removing', found],
      ['Removing unused dependencies', unique],
    ]).map((l) => l.replace(/ appstream /, ' @appstream')),
    '',
    'Transaction Summary',
    RULE,
    `Remove  ${all.length} Package${all.length > 1 ? 's' : ''}`,
    '',
    `Freed space: ${size(all.reduce((t, p) => t + p.installed, 0))}`,
  );
  const run = () => {
    for (const p of all) {
      removeFiles(game, p);
      delete rpm(game).installed[p.name];
    }
    const r = rpm(game);
    r.history.push({ id: r.history.length + 1, command, at: clock(game), user: game.player, action: 'Removed', packages: all.map((p) => p.name) });
    return ['Running transaction check', 'Transaction check succeeded.', 'Running transaction test', 'Transaction test succeeded.', 'Running transaction', '', 'Removed:', ...all.map((p) => `  ${nevra(p)}`), '', 'Complete!'].join('\n');
  };
  if (yes) return `${out.join('\n')}\n${run()}`;
  game.ask('Is this ok [y/N]: ', (a) => (/^y(es)?$/i.test(a.trim()) ? run() : (game.error('Operation aborted.', 1), '')));
  return out.join('\n');
}

const glob = (pattern: string) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);

function dnfInfo(game: Shell, names: string[]): string {
  const pick = names.length ? ALL.filter((p) => names.some((n) => glob(n).test(p.name))) : ALL;
  if (!pick.length) return game.error('Error: No matching Packages to list', 1);
  const block = (p: Pkg, installed: boolean) =>
    [
      `Name         : ${p.name}`,
      `Version      : ${p.version}`,
      `Release      : ${p.release}`,
      `Architecture : ${p.arch}`,
      `Size         : ${size(installed ? p.installed : p.size)}`,
      `Source       : ${p.name.replace(/-(core|filesystem|tools)$/, '')}-${vr(p)}.src.rpm`,
      `Repository   : ${installed ? '@System' : p.repo}`,
      ...(installed ? [`From repo    : ${rpm(game).installed[p.name].from}`] : []),
      `Summary      : ${p.summary}`,
      `URL          : ${p.url || 'https://rockylinux.org/'}`,
      `License      : ${p.license}`,
      `Description  : ${p.description.split('\n').join('\n             : ')}`,
      '',
    ].join('\n');
  const inst = pick.filter((p) => isInstalled(game, p.name));
  const avail = pick.filter((p) => !isInstalled(game, p.name));
  return [metadataLine(game), ...(inst.length ? ['Installed Packages', ...inst.map((p) => block(p, true))] : []), ...(avail.length ? ['Available Packages', ...avail.map((p) => block(p, false))] : [])].join('\n').trimEnd();
}

function dnfList(game: Shell, args: string[]): string {
  const which = ['installed', 'available', 'all'].includes(args[0]) ? args.shift()! : 'all';
  const pick = (p: Pkg) => !args.length || args.some((n) => glob(n).test(p.name));
  const row = (p: Pkg, from: string) => `${`${p.name}.${p.arch}`.padEnd(40)} ${vr(p).padEnd(26)} ${from}`;
  const inst = ALL.filter((p) => pick(p) && isInstalled(game, p.name));
  const avail = ALL.filter((p) => pick(p) && !isInstalled(game, p.name));
  const out = [metadataLine(game)];
  if (which !== 'available' && inst.length) out.push('Installed Packages', ...inst.map((p) => row(p, `@${rpm(game).installed[p.name].from}`)));
  if (which !== 'installed' && avail.length) out.push('Available Packages', ...avail.map((p) => row(p, p.repo)));
  if (out.length === 1) return game.error('Error: No matching Packages to list', 1);
  return out.join('\n');
}

function dnfSearch(game: Shell, words: string[]): string {
  if (!words.length) return game.error('dnf search: error: the following arguments are required: KEYWORD', 1);
  const w = words.map((x) => x.toLowerCase());
  const exact = ALL.filter((p) => w.includes(p.name));
  const both = ALL.filter((p) => !exact.includes(p) && w.every((x) => p.name.includes(x)) && w.every((x) => p.summary.toLowerCase().includes(x)));
  const name = ALL.filter((p) => !exact.includes(p) && !both.includes(p) && w.every((x) => p.name.includes(x)));
  const summary = ALL.filter((p) => !exact.includes(p) && !both.includes(p) && !name.includes(p) && w.every((x) => p.summary.toLowerCase().includes(x)));
  const line = (p: Pkg) => `${p.name}.${p.arch} : ${p.summary}`;
  const out = [metadataLine(game)];
  const key = words.join(', ');
  if (exact.length) out.push(section(`Name Exactly Matched: ${key}`), ...exact.map(line));
  if (both.length) out.push(section(`Name & Summary Matched: ${key}`), ...both.map(line));
  if (name.length) out.push(section(`Name Matched: ${key}`), ...name.map(line));
  if (summary.length) out.push(section(`Summary Matched: ${key}`), ...summary.map(line));
  if (out.length === 1) {
    game.error(`No matches found.`, 1);
    return '';
  }
  return out.join('\n');
}

function dnfProvides(game: Shell, specs: string[]): string {
  const out = [metadataLine(game)];
  let found = false;
  for (const spec of specs) {
    // Without a slash, dnf also tries the name in /usr/bin and /usr/sbin.
    const tries = spec.includes('/') ? [glob(spec)] : [glob(spec), glob(`/usr/bin/${spec}`), glob(`/usr/sbin/${spec}`)];
    for (const p of ALL) {
      const file = Object.keys(p.files).map((f) => f.replace(/\/$/, '')).find((f) => tries.some((r) => r.test(f)));
      const byNameMatch = !file && tries[0].test(p.name);
      if (!file && !byNameMatch) continue;
      found = true;
      out.push(`${nevra(p)} : ${p.summary}`, `Repo        : ${isInstalled(game, p.name) ? '@System' : p.repo}`, 'Matched from:', file ? `Filename    : ${file}` : `Provide    : ${p.name} = ${vr(p)}`, '');
    }
  }
  if (!found) {
    game.error('Error: No matches found. If searching for a file, try specifying the full path or using a wildcard prefix ("*/") at the beginning.', 1);
    return out.join('\n');
  }
  return out.join('\n').trimEnd();
}

function dnfHistory(game: Shell, args: string[]): string {
  const r = rpm(game);
  const sub = args[0] ?? 'list';
  if (sub === 'info') {
    const t = r.history.find((x) => String(x.id) === (args[1] ?? String(r.history.length))) ?? r.history.at(-1)!;
    return [
      `Transaction ID : ${t.id}`,
      `Begin time     : ${cTime(t.at)}`,
      `User           : ${t.user === 'System <unset>' ? 'System <unset>' : `${t.user} <${t.user}>`}`,
      'Return-Code    : Success',
      'Releasever     : 10',
      `Command Line   : ${t.command}`,
      'Packages Altered:',
      ...t.packages.map((n) => `    ${t.action.padEnd(9)} ${byName(n) ? nevra(byName(n)!) : n} @${byName(n)?.repo ?? 'anaconda'}`),
    ].join('\n');
  }
  if (sub !== 'list' && !/^\d+$/.test(sub)) return game.error(`History argument "${sub}" is not a valid ID or command`, 1);
  const users = new Set(r.history.map((t) => t.user));
  const byUser = users.size > 1;
  const head = `${'ID'.padStart(6)} | ${(byUser ? 'User name' : 'Command line').padEnd(24)} | ${'Date and time'.padEnd(16)} | ${'Action(s)'.padEnd(14)} | ${'Altered'.padEnd(7)}`;
  const rows = [...r.history].reverse().map((t) => {
    const d = new Date(t.at).toISOString();
    const who = byUser ? (t.user === 'System <unset>' ? 'System <unset>' : `${t.user} <${t.user}>`) : t.command;
    return `${String(t.id).padStart(6)} | ${who.padEnd(24).slice(0, 24)} | ${`${d.slice(0, 10)} ${d.slice(11, 16)}`} | ${t.action.padEnd(14)} | ${String(t.packages.length).padStart(4)}   `;
  });
  return [head, '-'.repeat(79), ...rows].join('\n');
}

function dnf(game: Shell, raw: string[]): string {
  const yes = raw.some((a) => a === '-y' || a === '--assumeyes');
  const args = raw.filter((a) => a !== '-y' && a !== '--assumeyes' && a !== '-q' && a !== '--quiet' && !a.startsWith('--setopt'));
  if (args.includes('--version')) return '4.20.0\n  Installed: dnf-0:4.20.0-28.el10.rocky.0.1.noarch';
  const unknown = args.find((a) => a.startsWith('-'));
  if (unknown) return game.error(`usage: dnf [options] COMMAND\n\ndnf: error: unrecognized arguments: ${unknown}`, 2);
  const [cmd, ...rest] = args;
  const line = ['dnf', ...raw].join(' ').replace(/^dnf /, '');
  switch (cmd) {
    case undefined:
      return game.error('usage: dnf [options] COMMAND\n\nList of Main Commands:\n\nautoremove  check-update  clean  history  info  install  list  makecache  provides  reinstall  remove  repolist  search  upgrade\n\ndnf: error: the following arguments are required: COMMAND', 1);
    case 'install':
    case 'in':
      if (!rest.length) return game.error('Error: Need to pass a list of pkgs to install', 1);
      return dnfInstall(game, rest, yes, line);
    case 'remove':
    case 'erase':
    case 'rm':
      if (!rest.length) return game.error('Error: Need to pass a list of pkgs to remove', 1);
      return dnfRemove(game, rest, yes, line);
    case 'info':
      return dnfInfo(game, rest);
    case 'list':
    case 'ls':
      return dnfList(game, rest);
    case 'search':
    case 'se':
      return dnfSearch(game, rest);
    case 'provides':
    case 'whatprovides':
    case 'wp':
      if (!rest.length) return game.error('dnf provides: error: the following arguments are required: dependency', 1);
      return dnfProvides(game, rest);
    case 'repolist':
      return ['repo id                       repo name', 'appstream                     Rocky Linux 10 - AppStream', 'baseos                        Rocky Linux 10 - BaseOS', 'extras                        Rocky Linux 10 - Extras'].join('\n');
    case 'history':
    case 'hist':
      return dnfHistory(game, rest);
    case 'makecache':
    case 'mc':
      rpm(game).metadata = clock(game);
      return ['Rocky Linux 10 - BaseOS                          12 kB/s | 4.3 kB     00:00', 'Rocky Linux 10 - AppStream                       15 kB/s | 4.4 kB     00:00', 'Rocky Linux 10 - Extras                          10 kB/s | 3.1 kB     00:00', 'Metadata cache created.'].join('\n');
    case 'check-update':
    case 'upgrade':
    case 'update':
      return [metadataLine(game), ...(cmd === 'check-update' ? [] : ['Dependencies resolved.', 'Nothing to do.', 'Complete!'])].join('\n');
    default:
      return game.error(`No such command: ${cmd}. Please use /usr/bin/dnf --help\nIt could be a DNF plugin command, try: "dnf install 'dnf-command(${cmd})'"`, 1);
  }
}

// ——— rpm ———

function rpmCommand(game: Shell, raw: string[]): string {
  const flags = raw.filter((a) => a.startsWith('-')).join('').replace(/-/g, '');
  const args = raw.filter((a) => !a.startsWith('-'));
  if (raw.includes('--version')) return 'RPM version 4.19.1.1';
  if (/^[V]+$/.test(flags) || flags === 'Va') {
    const pick = flags === 'Va' ? ALL.filter((p) => isInstalled(game, p.name)) : args.map(byName).filter((p): p is Pkg => !!p);
    const out: string[] = [];
    for (const n of args) if (!byName(n) || !isInstalled(game, n)) game.error(`package ${n} is not installed`, 1);
    for (const p of pick)
      for (const c of p.config ?? []) {
        const now = game.read(c);
        const orig = p.files[c];
        if (now === null) out.push(`missing   c ${c}`);
        else if (orig && now !== orig) out.push(`S.5....T.  c ${c}`);
      }
    if (out.length) game.status = 1;
    return out.join('\n');
  }
  if (!flags.startsWith('q')) {
    if (/[ieUF]/.test(flags)) return game.error(game.who === 'root' ? `rpm: install and erase are left to dnf in the game (dnf install, dnf remove).` : 'error: can\'t create transaction lock on /usr/lib/sysimage/rpm/.rpm.lock (Permission denied)', 1);
    return game.error(`rpm: no mode specified\nTry 'rpm --help' for more information.`, 1);
  }
  const mode = flags.slice(1);
  const installed = (n: string) => byName(n) && isInstalled(game, n) ? byName(n)! : null;
  if (mode.includes('a')) {
    const list = ALL.filter((p) => isInstalled(game, p.name)).filter((p) => !args.length || args.some((a) => glob(a).test(p.name)));
    return list.map(nevra).join('\n');
  }
  if (mode.includes('f')) {
    return args
      .map((path) => {
        const abs = game.resolve(path);
        if (!game.exists(abs)) return game.error(`error: file ${abs}: No such file or directory`, 1);
        const owner = ALL.filter((p) => isInstalled(game, p.name)).find((p) => Object.keys(p.files).some((f) => f.replace(/\/$/, '') === abs));
        if (!owner) return game.error(`file ${abs} is not owned by any package`, 1);
        return nevra(owner);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (!args.length) return game.error('rpm: no arguments given for query', 1);
  return args
    .map((n) => {
      const p = installed(n);
      if (!p) {
        game.error(`package ${n} is not installed`, 1);
        return null;
      }
      if (mode.includes('i'))
        return [
          `Name        : ${p.name}`,
          `Version     : ${p.version}`,
          `Release     : ${p.release}`,
          `Architecture: ${p.arch}`,
          `Install Date: ${cTime(rpm(game).installed[p.name].at)}`,
          'Group       : Unspecified',
          `Size        : ${p.installed}`,
          `License     : ${p.license}`,
          `Source RPM  : ${p.name}-${vr(p)}.src.rpm`,
          'Packager    : Rocky Linux Build System (Peridot) <releng@rockylinux.org>',
          'Vendor      : Rocky Enterprise Software Foundation',
          `URL         : ${p.url || 'https://rockylinux.org/'}`,
          `Summary     : ${p.summary}`,
          'Description :',
          p.description,
        ].join('\n');
      if (mode.includes('l') || mode.includes('c')) {
        const files = Object.keys(p.files).map((f) => f.replace(/\/$/, ''));
        const shown = mode.includes('c') ? (p.config ?? []) : files;
        return shown.length ? shown.sort().join('\n') : '(contains no files)';
      }
      return nevra(p);
    })
    .filter((x) => x !== null)
    .join('\n');
}

// ——— firewall-cmd ———

const NOT_AUTHORIZED = 'Authorization failed.\n    Make sure polkit agent is running or run the application as superuser.';

function zoneInfo(name: string, z: Zone, attrs: string[]): string {
  return [
    `${name}${attrs.length ? ` (${attrs.join(', ')})` : ''}`,
    `  target: ${z.target}`,
    '  ingress-priority: 0',
    '  egress-priority: 0',
    '  icmp-block-inversion: no',
    `  interfaces: ${z.interfaces.join(' ')}`,
    `  sources: ${z.sources.join(' ')}`,
    `  services: ${[...z.services].sort().join(' ')}`,
    `  ports: ${z.ports.join(' ')}`,
    '  protocols: ',
    '  forward: yes',
    '  masquerade: no',
    '  forward-ports: ',
    '  source-ports: ',
    '  icmp-blocks: ',
    `  rich rules: ${z.richRules.length ? `\n\t${z.richRules.join('\n\t')}` : ''}`,
  ].join('\n');
}

function firewallCmd(game: Shell, raw: string[]): string {
  // --option=value or --option value.
  const opts: [string, string | null][] = [];
  const TAKES = ['zone', 'add-service', 'remove-service', 'add-port', 'remove-port', 'add-rich-rule', 'remove-rich-rule', 'query-service', 'query-port', 'info-service', 'add-source', 'remove-source', 'set-default-zone', 'info-zone'];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    const m = /^--([\w-]+)(?:=(.*))?$/s.exec(a);
    if (!m) return game.error(`usage: see firewall-cmd man page\nfirewall-cmd: error: unrecognized arguments: ${a}`, 2);
    if (m[2] !== undefined) opts.push([m[1], m[2]]);
    else if (TAKES.includes(m[1])) opts.push([m[1], raw[++i] ?? '']);
    else opts.push([m[1], null]);
  }
  const has = (k: string) => opts.some(([o]) => o === k);
  const values = (k: string) => opts.filter(([o]) => o === k).map(([, v]) => v ?? '');
  if (!opts.length) return game.error('usage: see firewall-cmd man page\nNo option specified.', 2);
  if (has('version')) return VERSION;
  const fw = firewalld(game)!;
  if (has('state')) {
    if (!running(game)) return game.error('not running', 252);
    return 'running';
  }
  const permanent = has('permanent');
  // Without the daemon, firewall-cmd can't talk to it (firewall-offline-cmd could).
  if (!running(game)) return game.error('FirewallD is not running', 252);
  const zoneName = values('zone')[0] ?? fw.defaultZone;
  if (values('zone').length && !ZONES.includes(zoneName)) return game.error(`Error: INVALID_ZONE: ${zoneName}`, 112);
  const config = permanent ? fw.permanent : fw.runtime;
  const z = config[zoneName];
  const modifying = opts.some(([o]) => /^(add|remove)-|^reload$|^complete-reload$|^runtime-to-permanent$|^set-default-zone$/.test(o));
  if (modifying && game.who !== 'root') return game.error(NOT_AUTHORIZED, 253);
  if (has('reload') || has('complete-reload')) {
    reloadFirewall(game);
    return 'success';
  }
  if (has('runtime-to-permanent')) {
    fw.permanent = JSON.parse(JSON.stringify(fw.runtime));
    for (const zz of Object.values(fw.permanent)) zz.interfaces = [];
    return 'success';
  }
  if (has('get-default-zone')) return fw.defaultZone;
  if (has('get-zones')) return ZONES.join(' ');
  if (has('get-services')) return Object.keys(SERVICES).sort().join(' ');
  if (has('get-active-zones')) {
    return Object.entries(fw.runtime)
      .filter(([, x]) => x.interfaces.length || x.sources.length)
      .map(([n, x]) => [`${n}${n === fw.defaultZone ? ' (default)' : ''}`, ...(x.interfaces.length ? [`  interfaces: ${x.interfaces.join(' ')}`] : []), ...(x.sources.length ? [`  sources: ${x.sources.join(' ')}`] : [])].join('\n'))
      .join('\n');
  }
  const attrs = (n: string) => [...(n === fw.defaultZone ? ['default'] : []), ...(!permanent && (fw.runtime[n].interfaces.length || fw.runtime[n].sources.length) ? ['active'] : [])];
  if (has('list-all')) return zoneInfo(zoneName, z, attrs(zoneName));
  if (has('list-all-zones')) return Object.entries(config).map(([n, x]) => zoneInfo(n, x, attrs(n))).join('\n\n');
  if (has('info-zone')) return zoneInfo(values('info-zone')[0], config[values('info-zone')[0]] ?? z, attrs(values('info-zone')[0]));
  if (has('list-services')) return [...z.services].sort().join(' ');
  if (has('list-ports')) return z.ports.join(' ');
  if (has('list-rich-rules')) return z.richRules.join('\n');
  if (has('info-service')) {
    const s = values('info-service')[0];
    if (!SERVICES[s]) return game.error(`Error: INVALID_SERVICE: ${s}`, 101);
    return [s, `  ports: ${SERVICES[s].join(' ')}`, '  protocols: ', '  source-ports: ', '  modules: ', '  destination: ', '  includes: ', '  helpers: '].join('\n');
  }
  if (has('query-service')) {
    const yes = z.services.includes(values('query-service')[0]);
    game.status = yes ? 0 : 1;
    return yes ? 'yes' : 'no';
  }
  if (has('query-port')) {
    const yes = z.ports.includes(values('query-port')[0]);
    game.status = yes ? 0 : 1;
    return yes ? 'yes' : 'no';
  }
  // The changes: each item; a warning for one already there (exit 0), an error otherwise.
  const warnings: string[] = [];
  const where = permanent ? '' : ` in '${zoneName}'`;
  const already = (item: string) => warnings.push(permanent ? `Warning: ALREADY_ENABLED: ${item}` : `Warning: ALREADY_ENABLED: '${item}' already${where}`);
  const notThere = (item: string) => warnings.push(permanent ? `Warning: NOT_ENABLED: ${item}` : `Warning: NOT_ENABLED: '${item}' not${where}`);
  for (const [o, v] of opts) {
    const value = v ?? '';
    if (o === 'add-service' || o === 'remove-service') {
      if (!SERVICES[value]) return game.error(permanent ? `Error: INVALID_SERVICE: Zone '${zoneName}': '${value}' not among existing services` : `Error: INVALID_SERVICE: ${value}`, 101);
      if (o === 'add-service') z.services.includes(value) ? already(value) : z.services.push(value);
      else z.services.includes(value) ? (z.services = z.services.filter((s) => s !== value)) : notThere(value);
    } else if (o === 'add-port' || o === 'remove-port') {
      const m = /^(\d+(?:-\d+)?)\/(\w+)$/.exec(value);
      if (!value.includes('/')) return game.error('Error: INVALID_PORT: bad port (most likely missing protocol), correct syntax is portid[-portid]/protocol', 102);
      if (!m || Number(m[1].split('-')[0]) > 65535) return game.error(`Error: INVALID_PORT: ${value.split('/')[0]}`, 102);
      if (!['tcp', 'udp', 'sctp', 'dccp'].includes(m[2])) return game.error(`Error: INVALID_PROTOCOL: '${m[2]}' not in {'tcp'|'udp'|'sctp'|'dccp'}`, 103);
      const item = `${m[1]}/${m[2]}`;
      const shownItem = `${m[1]}:${m[2]}`;
      if (o === 'add-port') z.ports.includes(item) ? already(shownItem) : z.ports.push(item);
      else z.ports.includes(item) ? (z.ports = z.ports.filter((s) => s !== item)) : notThere(shownItem);
    } else if (o === 'add-rich-rule' || o === 'remove-rich-rule') {
      let text: string;
      try {
        text = richText(parseRich(value));
      } catch (e) {
        const msg = (e as Error).message;
        const code = msg.startsWith('INVALID_FAMILY') ? 124 : msg.startsWith('INVALID_ADDR') ? 105 : msg.startsWith('INVALID_SERVICE') ? 101 : msg.startsWith('INVALID_PORT') ? 102 : msg.startsWith('INVALID_PROTOCOL') ? 103 : 122;
        return game.error(`Error: ${msg}`, code);
      }
      if (o === 'add-rich-rule') z.richRules.includes(text) ? already(text) : z.richRules.push(text);
      else z.richRules.includes(text) ? (z.richRules = z.richRules.filter((s) => s !== text)) : notThere(text);
    } else if (o === 'add-source' || o === 'remove-source') {
      if (o === 'add-source') z.sources.includes(value) ? already(value) : z.sources.push(value);
      else z.sources = z.sources.filter((s) => s !== value);
    } else if (o === 'set-default-zone') {
      if (!ZONES.includes(value)) return game.error(`Error: INVALID_ZONE: ${value}`, 112);
      fw.defaultZone = value;
    } else if (!['zone', 'permanent'].includes(o)) return game.error(`usage: see firewall-cmd man page\nfirewall-cmd: error: unrecognized arguments: --${o}`, 2);
  }
  if (warnings.length) game.error(warnings.join('\n'));
  return 'success';
}

// ——— The commands ———

export const RHEL_PACKAGE_COMMANDS: Record<string, Command> = {
  dnf: { ownOptions: true, section: 8, launch: ({ args, game }) => dnf(game, args) },
  rpm: { ownOptions: true, section: 8, launch: ({ args, game }) => rpmCommand(game, args) },
  'firewall-cmd': { ownOptions: true, launch: ({ args, game }) => firewallCmd(game, args) },
};
