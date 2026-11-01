// unattended-upgrades: Debian's automatic updates, and apt-config. Like the
// unattended-upgrades package (Debian 13):
//   - /etc/apt/apt.conf.d/20auto-upgrades enables the two tasks of the
//     apt-daily-upgrade service (APT::Periodic::Update-Package-Lists and
//     ::Unattended-Upgrade; "0" or absent: nothing happens);
//   - 50unattended-upgrades says what to install: Origins-Pattern (each
//     "key=value,…" pattern must match the package's origin; by default,
//     Debian and its security updates), Package-Blacklist (regular
//     expressions), Mail, MailReport, Automatic-Reboot,
//     Automatic-Reboot-Time;
//   - the log in /var/log/unattended-upgrades/unattended-upgrades.log.
// Sources: https://wiki.debian.org/UnattendedUpgrades,
// https://manpages.debian.org/trixie/unattended-upgrades/unattended-upgrade.8.en.html,
// https://github.com/mvo5/unattended-upgrades/blob/master/data/50unattended-upgrades.Debian
// Differences: no autoremove, MinimalSteps nor pausing on battery; the
// packages' origins are described by the chapter; the --debug output is
// abridged; the scheduled reboot is not played.

import type { Game, Shell } from '../shell';
import { writeLog, restart, systemd } from '../systemd';
import { readConfApt, empty, yes, type ConfApt } from '../apt-conf';
import { configure, state, availableUpdates, SECURITY, type Origin } from './apt';
import { send } from './monitoring';
import { help } from './manual';
import type { Command } from './index';

const CODENAME = 'trixie';
const LOG = '/var/log/unattended-upgrades/unattended-upgrades.log';
export const UU = 'Unattended-Upgrade';

// Does an Origins-Pattern pattern match this origin? (unattended-upgrades' keys and aliases)
function correspond(pattern: string, o: Origin): boolean {
  const fields: Record<string, keyof Origin> = {
    o: 'o',
    origin: 'o',
    n: 'n',
    codename: 'n',
    l: 'l',
    label: 'l',
    a: 'n',
    archive: 'n',
    suite: 'n',
    site: 'site',
  };
  const text = pattern.replace(/\$\{distro_codename\}/g, CODENAME).replace(/\$\{distro_id\}/g, 'Debian');
  return text.split(/(?<!\\),/).every((chunk) => {
    const [key, ...v] = chunk.split('=');
    const field = fields[key.trim()];
    if (!field) return false;
    const re = new RegExp(
      `^${v
        .join('=')
        .trim()
        .replace(/[.+^$()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')}$`,
    );
    return re.test(o[field]);
  });
}

const patterns = (c: ConfApt) =>
  (c.lists[`${UU}::Origins-Pattern`] ?? []).map((m) => m.replace(/\$\{distro_codename\}/g, CODENAME).replace(/\$\{distro_id\}/g, 'Debian'));

/** What unattended-upgrades would install, and what it leaves (origin not allowed, blacklist). */
export function updatesSort(game: Shell, c: ConfApt) {
  const e = state(game);
  const permitted = patterns(c);
  const black = (c.lists[`${UU}::Package-Blacklist`] ?? []).map((m) => new RegExp(`^(?:${m})`));
  const sockets: [string, string][] = [];
  const left: { pkg: string; reason: 'origin' | 'blacklist' }[] = [];
  for (const [n, v] of availableUpdates(e)) {
    const o = e.origins?.[n] ?? SECURITY;
    if (!permitted.some((m) => correspond(m, o))) left.push({ pkg: n, reason: 'origin' });
    else if (black.some((re) => re.test(n))) left.push({ pkg: n, reason: 'blacklist' });
    else sockets.push([n, v]);
  }
  // The new kernel follows linux-image-amd64.
  const fresh = Object.entries(e.fresh ?? {}).filter(
    ([n]) => !e.installed[n] && sockets.some(([m]) => m === 'linux-image-amd64') && n.startsWith('linux-image-'),
  );
  return { prises: [...fresh, ...sockets], laissees: left, permitted };
}

const timestamp = (game: Game) => {
  const ms = systemd(game)?.clock ?? 0;
  return `${new Date(ms).toISOString().replace('T', ' ').slice(0, 19)},${String(ms % 1000).padStart(3, '0')}`;
};

function note(game: Shell, lines: string[]) {
  const text = lines.map((l) => `${timestamp(game)} INFO ${l}`).join('\n');
  const n = game.find(LOG);
  if (n?.type === 'file' && typeof n.content === 'string') n.content = n.content ? `${n.content}\n${text}` : text;
  else {
    if (!game.exists('/var/log/unattended-upgrades'))
      game.place('unattended-upgrade', '/var/log/unattended-upgrades', { type: 'directory', children: {}, owner: 'root' });
    game.place('unattended-upgrade', LOG, { type: 'file', content: text, lines: true, owner: 'root', mode: 'rw-r--r--' });
  }
}

export interface UuResult {
  installed: string[];
  // The reboot: "now" (done), a time (scheduled), or null.
  reboot: string | null;
}

/** A run of unattended-upgrade, as apt-daily-upgrade.service starts it (or root by hand). */
export function uuPass(game: Shell, o: { dry?: boolean; verbose?: boolean } = {}): { output: string[]; result: UuResult } {
  const c = readConfApt(game);
  const { prises: sockets, laissees: left, permitted } = updatesSort(game, c);
  const black = c.lists[`${UU}::Package-Blacklist`] ?? [];
  const info = [
    ...(o.dry ? ['Option --dry-run given, *not* performing real actions'] : []),
    'Starting unattended upgrades script',
    `Allowed origins are: ${permitted.join(', ')}`,
    `Initial blacklist: ${black.join(' ')}`,
    'Initial whitelist (not strict): ',
  ];
  const detail = o.verbose
    ? left.map(({ pkg, reason }) => {
        const or = state(game).origins?.[pkg] ?? SECURITY;
        return reason === 'blacklist'
          ? `${pkg} is blacklisted`
          : `Checking: ${pkg} ([<Origin component:'main' archive:'${or.n}' origin:'${or.o}' label:'${or.l}' site:'${or.site}' isTrusted:True>])\nadjusting candidate version: ${pkg} not in allowed origins`;
      })
    : [];
  const result: UuResult = { installed: [], reboot: null };
  if (!sockets.length) {
    const end = [...info, 'No packages found that can be upgraded unattended and no pending auto-removals'];
    if (!o.dry) {
      note(game, end);
      // MailReport "always": a report even when there was nothing to do.
      if (c.values[`${UU}::Mail`] && c.values[`${UU}::MailReport`] === 'always') report(game, c, [], false, end);
    }
    return { output: o.verbose ? [...end.slice(0, -1), ...detail, end.at(-1)!] : [], result };
  }
  const names = sockets.map(([n]) => n).sort();
  const lines = [
    ...info,
    `Packages that will be upgraded: ${names.join(' ')}`,
    'Writing dpkg log to /var/log/unattended-upgrades/unattended-upgrades-dpkg.log',
  ];
  if (o.dry) return { output: o.verbose ? [...info, ...detail, ...lines.slice(info.length)] : [], result };
  configure(game, state(game), sockets);
  result.installed = names;
  lines.push('All upgrades installed');
  const restartA = game.exists('/var/run/reboot-required');
  // The report by mail (MailReport: on-change by default).
  if (c.values[`${UU}::Mail`] && (c.values[`${UU}::MailReport`] ?? 'on-change') !== 'only-on-error') report(game, c, names, restartA, lines);
  if (restartA && yes(c.values[`${UU}::Automatic-Reboot`])) {
    const when = c.values[`${UU}::Automatic-Reboot-Time`] ?? 'now';
    lines.push('Found /var/run/reboot-required, rebooting');
    result.reboot = when;
  }
  note(game, lines);
  return { output: o.verbose ? [...lines.slice(0, info.length), ...detail, ...lines.slice(info.length)] : [], result };
}

// The report by mail, sent by root (MailReport: on-change by default).
function report(game: Shell, c: ConfApt, names: string[], restartA: boolean, lines: string[]) {
  const host = systemd(game)?.host ?? 'localhost';
  const who = game.who;
  game.who = 'root';
  send(
    game,
    [c.values[`${UU}::Mail`]],
    `${restartA ? '[reboot required] ' : ''}unattended-upgrades result for ${host}: SUCCESS`,
    [
      `Unattended upgrade result: ${names.length ? 'All upgrades installed' : 'No packages found that can be upgraded unattended and no pending auto-removals'}`,
      '',
      ...(restartA ? ['Warning: A reboot is required to complete this upgrade, or a previous one.', ''] : []),
      ...(names.length ? ['Packages that were upgraded:', ` ${names.join(' ')}`, ''] : []),
      'Unattended-upgrades log:',
      ...lines,
    ].join('\n'),
  );
  game.who = who;
}

/** Applies the reboot requested by a run: right away, or scheduled (shutdown -r HH:MM). */
export function restartAfter(game: Shell, r: UuResult) {
  const sd = systemd(game);
  if (!r.reboot || !sd) return;
  if (r.reboot === 'now') {
    restart(game, sd);
    game.reboot = true;
  } else {
    game.state.rebootScheduled = r.reboot;
    writeLog(sd, '', 'systemd-logind', 512, `Reboot scheduled for ${r.reboot}, use 'shutdown -c' to cancel.`);
  }
}

/** apt-daily-upgrade.service: apt.systemd.daily only starts unattended-upgrade if 20auto-upgrades asks for it. */
export function afterDaily(game: Game) {
  const sh = game as Shell;
  const c = readConfApt(sh);
  sh.state.daily = (sh.state.daily ?? 0) + 1;
  if (c.errors.length || c.values['APT::Periodic::Enable'] === '0') return;
  if (!yes(c.values['APT::Periodic::Unattended-Upgrade'] ?? '0')) return;
  const { result } = uuPass(sh);
  sh.state.autoPasses = (sh.state.autoPasses ?? 0) + 1;
  restartAfter(sh, result);
}

/** Check when apt-daily-upgrade.service starts: an unreadable configuration makes it fail. */
export const checkDaily = (game: Game) => {
  const e = readConfApt(game).errors;
  return e.length ? e : null;
};

export const UNATTENDED: Record<string, Command> = {
  'unattended-upgrade': {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      const known = ['--dry-run', '-d', '--debug', '-v', '--verbose', '-h', '--help'];
      const unknown = args.find((a) => !known.includes(a));
      if (unknown) return game.error(`Usage: unattended-upgrade [options]\n\nunattended-upgrade: error: no such option: ${unknown}`, 2);
      if (args.includes('-h') || args.includes('--help')) return help('unattended-upgrade', UNATTENDED['unattended-upgrade'], game.t);
      if (game.who !== 'root') return game.error('You need to be root to run this application', 1);
      const c = readConfApt(game);
      if (c.errors.length) return game.error(c.errors.join('\n'), 1);
      const dry = args.includes('--dry-run');
      const verbose = args.some((a) => ['-d', '--debug', '-v', '--verbose'].includes(a));
      const { output, result } = uuPass(game, { dry, verbose });
      restartAfter(game, result);
      return output.join('\n');
    },
  },
  'apt-config': {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      const [action] = args.filter((a) => !a.startsWith('-'));
      if (!action || args.includes('-h') || args.includes('--help')) return help('apt-config', UNATTENDED['apt-config'], game.t);
      const c = readConfApt(game);
      if (c.errors.length) return game.error(c.errors.join('\n'), 100);
      if (action === 'dump') {
        const filter = args.filter((a) => !a.startsWith('-'))[1];
        const all = empty(c);
        return filter
          ? all
              .split('\n')
              .filter((l) => l.startsWith(filter))
              .join('\n')
          : all;
      }
      return game.error(`E: Invalid operation ${action}`, 100);
    },
  },
  // The manual page of apt's configuration file.
  'apt.conf': { section: 5, launch: () => '' },
};
