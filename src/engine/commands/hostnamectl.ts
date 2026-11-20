// hostnamectl: the machine's name and what it runs, after hostnamectl(1) of
// systemd 257 (Debian 13): https://manpages.debian.org/trixie/systemd/hostnamectl.1.en.html
// The operating system comes from /etc/os-release (os-release(5)), the kernel
// from uname's model, the machine id from the journal's directory or the
// machine's name (debian.ts).
// Differences: status, hostname and set-hostname only; no pretty or
// transient names, no chassis, icon or deployment settings; a QEMU/KVM
// virtual machine, always.

import type { Shell } from '../shell';
import { isDebian, machineIdOf, PRETTY_NAME } from '../debian';
import { machineId } from '../journal-files';
import type { Command } from './index';
import { bootId } from './systemd';

// PRETTY_NAME= of /etc/os-release (os-release(5)), Debian's otherwise.
function prettyName(game: Shell): string {
  const text = game.read('/etc/os-release') ?? game.read('/usr/lib/os-release') ?? '';
  const m = /^PRETTY_NAME=(.*)$/m.exec(text);
  return m ? m[1].replace(/^"|"$/g, '') : PRETTY_NAME;
}

function status(game: Shell): string {
  const name = game.read('/etc/hostname')?.trim() || game.hostName;
  const kernel = (game.state.kernel as { active: string } | undefined)?.active ?? '6.12.0-quetes';
  const id = machineId(game) || machineIdOf(game.host);
  const boot = bootId((game.state.systemd as { boot?: number } | undefined)?.boot ?? 1);
  const lines: [string, string][] = [
    ['Static hostname', name],
    ['Icon name', 'computer-vm'],
    ['Chassis', 'vm 🖴'],
    ['Machine ID', id],
    ['Boot ID', boot],
    ['Virtualization', 'kvm'],
    ['Operating System', prettyName(game)],
    ['Kernel', `Linux ${kernel}`],
    ['Architecture', 'x86-64'],
    ['Hardware Vendor', 'QEMU'],
    ['Hardware Model', 'Standard PC _Q35 + ICH9, 2009_'],
    ['Firmware Version', '2025.02-8'],
  ];
  return lines.map(([k, v]) => `${k.padStart(16)}: ${v}`).join('\n');
}

// lsb_release (lsb-release-minimal, https://manpages.debian.org/trixie/lsb-release/lsb_release.1.en.html):
// only once the lsb-release package is installed (it isn't by default since Debian 12).
function lsbRelease(game: Shell, args: string[]): string {
  if (!game.find('/usr/bin/lsb_release')) {
    game.status = 127;
    return game.error(game.t('command-missing', { command: 'lsb_release' }));
  }
  const text = game.read('/etc/os-release') ?? '';
  const field = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(text)?.[1].replace(/^"|"$/g, '') ?? '';
  const flags = new Set(args.flatMap((a) => (a.startsWith('--') ? [{ all: 'a', id: 'i', description: 'd', release: 'r', codename: 'c', short: 's' }[a.slice(2)] ?? '?'] : a.slice(1).split(''))));
  const bad = [...flags].find((f) => !'aidrcs'.includes(f));
  if (bad) return game.error(`lsb_release: invalid option -- '${bad}'`, 1);
  const all = flags.has('a');
  const rows: [string, string, string][] = [
    ['i', 'Distributor ID', field('ID') === 'debian' ? 'Debian' : field('NAME')],
    ['d', 'Description', field('PRETTY_NAME')],
    ['r', 'Release', field('VERSION_ID')],
    ['c', 'Codename', field('VERSION_CODENAME')],
  ];
  const chosen = rows.filter(([k]) => all || flags.has(k));
  if (!chosen.length) return '';
  if (flags.has('s')) return chosen.map(([, , v]) => v).join(' ');
  return chosen.map(([, label, v]) => `${label}:\t${v}`).join('\n');
}

export const HOSTNAMECTL: Record<string, Command> = {
  'os-release': { section: 5, launch: () => '' },
  lsb_release: { ownOptions: true, launch: ({ args, game }) => lsbRelease(game, args) },
  hostnamectl: {
    ownOptions: true,
    launch: ({ args, game }) => {
      if (!isDebian(game)) return game.error(game.t('command-missing', { command: 'hostnamectl' }), 127);
      const words = args.filter((a) => !['--no-pager', '--no-ask-password', '--static'].includes(a));
      const unknown = words.find((a) => a.startsWith('-'));
      if (unknown) return game.error(unknown.startsWith('--') ? `hostnamectl: unrecognized option '${unknown}'` : `hostnamectl: invalid option -- '${unknown.slice(1, 2)}'`);
      const [verb = 'status', ...rest] = words;
      if (verb === 'status') return status(game);
      if (verb === 'hostname') {
        if (!rest.length) return game.read('/etc/hostname')?.trim() || game.hostName;
        return setName(game, rest[0]);
      }
      if (verb === 'set-hostname') {
        if (!rest.length) return game.error('Too few arguments.');
        return setName(game, rest[0]);
      }
      return game.error(`Unknown command verb '${verb}'.`);
    },
  },
};

// set-hostname: root writes /etc/hostname (the static name); the prompt follows at the next login.
function setName(game: Shell, name: string): string {
  if (game.who !== 'root') return game.error('Could not set static hostname: Access denied');
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62})(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*$/.test(name)) return game.error(`Invalid hostname '${name}'`);
  const file = game.find('/etc/hostname');
  if (file?.type === 'file') file.content = name;
  else if (game.find('/etc')?.type === 'directory') game.place('hostnamectl', '/etc/hostname', { type: 'file', content: name, lines: true, owner: 'root' });
  return '';
}
