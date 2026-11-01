// Story "The Lab" — chapter "The stuck reboot": last night, the server
// rebooted (a new kernel) and did not recover. Théo, a volunteer, had added
// the scans' USB disk to /etc/fstab by its name, /dev/sdc1, following a
// tutorial on his laptop. Since chapter 3, sdc is one of the 4 TB disks (in
// md2): the USB disk is now called sde. systemd waits for /dev/sdc1, gives
// up after 90 seconds, and the machine stops in emergency mode.
// We read the journal (journalctl -xb), find the disk by its UUID
// (lsblk -f, blkid), fix fstab (UUID=…, nofail: Théo sometimes takes it
// with him), check (findmnt --verify, mount -a), make systemd reread fstab
// (daemon-reload), and resume booting (systemctl default, exit or reboot).
// Objective checked on the state: fstab designates the scans disk by its
// UUID (or its label), with nofail, no line blocks the boot any more, the
// disk is mounted on /srv/scans, and the machine has left emergency mode.
// Sources: fstab(5), systemd.mount(5), findmnt(8), blkid(8),
// https://wiki.debian.org/fstab, https://www.freedesktop.org/software/systemd/man/latest/systemd-fstab-generator.html

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { devUpdate } from '../storage';
import { blocking, readFstab, resolveSource, deviceUnit, mountUnit } from '../fstab';
import { writeLog, start, systemd } from '../systemd';
import { mountToBoot } from '../commands/disks';
import { labAccounts, labState, labWorld, labKernel, st, UUID_SCANS } from './lab';

const R = '/root';
const BANNER = [
  'You are in emergency mode. After logging in, type "journalctl -xb" to view',
  'system logs, "systemctl reboot" to reboot, or "exit"',
  'to continue bootup.',
].join('\n');

const fstab = (j: Game) => j.read('/etc/fstab') ?? '';
const scansLine = (j: Game) => readFstab(fstab(j)).inputs.find((e) => e.target === '/srv/scans');
// The scans line designates the disk by what does not change: its UUID or its label.
const byId = (j: Game) => {
  const e = scansLine(j);
  return !!e && /^(UUID=|LABEL=|\/dev\/disk\/by-(uuid|label)\/)/.test(e.source) && resolveSource(st(j), e.source) === '/dev/sde1';
};
const withNofail = (j: Game) => !!scansLine(j)?.options.includes('nofail');
const healthy = (j: Game) => blocking(st(j), fstab(j)).length === 0 && readFstab(fstab(j)).errors.length === 0;
const mounted = (j: Game) => ((j.state.mounts ?? []) as { path: string; name: string }[]).some((m) => m.path === '/srv/scans' && m.name === '/dev/sde1');
const fstabOk = (j: Game) => byId(j) && withNofail(j) && healthy(j);

// The machine stops in emergency mode: what systemd writes to the journal.
function enterInRescue(j: Game): void {
  const sd = systemd(j)!;
  const e = blocking(st(j), j.state.fstabRead ?? fstab(j))[0];
  const dev = deviceUnit(e.source);
  const mount = mountUnit(e.target);
  sd.clock += 90_000;
  writeLog(sd, dev, 'systemd', 1, `${dev}: Job ${dev}/start timed out.`, 4);
  writeLog(sd, dev, 'systemd', 1, `Timed out waiting for device ${dev} - ${e.source}.`, 3);
  writeLog(sd, mount, 'systemd', 1, `Dependency failed for systemd-fsck@${dev.replace(/\.device$/, '')}.service - File System Check on ${e.source}.`, 3);
  writeLog(sd, mount, 'systemd', 1, `Dependency failed for ${mount} - ${e.target}.`, 3);
  writeLog(sd, 'local-fs.target', 'systemd', 1, 'Dependency failed for local-fs.target - Local File Systems.', 3);
  writeLog(sd, 'local-fs.target', 'systemd', 1, "local-fs.target: Job local-fs.target/start failed with result 'dependency'.", 4);
  writeLog(sd, 'local-fs.target', 'systemd', 1, 'local-fs.target: Triggering OnFailure= dependencies.', 5);
  writeLog(sd, 'emergency.service', 'systemd', 1, 'Started emergency.service - Emergency Shell.');
  writeLog(sd, 'emergency.target', 'systemd', 1, 'Reached target emergency.target - Emergency Mode.');
  j.state.rescue = true;
  j.state.relapses = (j.state.relapses ?? 0) + 1;
  // Relapse with an fstab already correct: systemd simply has not reread the file.
  if (fstabOk(j)) j.state.relapseWithoutReload = true;
}

// On boot (reboot): systemd reads fstab as it is on disk.
function startMounts(j: Game): boolean {
  j.state.fstabRead = fstab(j);
  if (blocking(st(j), fstab(j)).length) {
    enterInRescue(j);
    return false;
  }
  mountToBoot(j as Shell);
  j.state.rescue = false;
  return true;
}

// systemctl default (or exit): systemd resumes booting with fstab as it read it (daemon-reload).
function continueBoot(j: Shell): string {
  if (!j.state.rescue) return '';
  if (blocking(st(j), j.state.fstabRead ?? fstab(j)).length) {
    enterInRescue(j);
    return BANNER;
  }
  mountToBoot(j);
  const sd = systemd(j)!;
  writeLog(sd, 'local-fs.target', 'systemd', 1, 'Reached target local-fs.target - Local File Systems.');
  for (const [name, s] of Object.entries(sd.services)) if (s.active && s.state !== 'active') start(j, sd, name, true);
  writeLog(sd, 'multi-user.target', 'systemd', 1, 'Reached target multi-user.target - Multi-User System.');
  j.state.rescue = false;
  return '';
}

export const rescue: Chapter = {
  id: 'stuck-boot',
  number: 4,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'echo',
    'nano',
    'id',
    'whoami',
    'df',
    'lsblk',
    'blkid',
    'findmnt',
    'mount',
    'umount',
    'dmesg',
    'journalctl',
    'systemctl',
    'reboot',
  ],
  home: R,
  welcome: 'message_from_odile.txt',
  names: true,
  final: 'end',
  steps: ['journal', 'disks', 'fixed', 'mounted', 'end'],
  accounts: labAccounts,
  state: () => ({ ...labState('rescue'), rescue: true, hostConsole: true }),
  initialise: (j) => {
    labKernel(j, 'rescue');
    devUpdate(j);
    // We work as root on the hosting provider's console.
    j.who = 'root';
    j.state.fstabRead = fstab(j);
    j.state.startMounts = startMounts;
    j.state.continueBoot = continueBoot;
    j.state.rescueBanner = BANNER;
    // The machine is stopped in emergency mode: no service has started.
    for (const s of Object.values(systemd(j)!.services)) s.state = 'inactive';
    enterInRescue(j);
    j.state.relapses = 0;
  },
  createWorld: (t) => labWorld(t, { 'message_from_odile.txt': f(t('stuck-boot-message-odile', { banner: BANNER })) }, { winter: true, rescue: true }),
  events: [
    {
      id: 'journal',
      condition: (j) => j.last.output.includes('Timed out waiting for device'),
      message: (j) => j.t('stuck-boot-event-journal'),
    },
    {
      id: 'disks',
      condition: (j) => j.last.output.includes(UUID_SCANS) || /sde1.*SCANS|SCANS.*sde1/.test(j.last.output),
      message: (j) => j.t('stuck-boot-event-disks'),
    },
    {
      id: 'name',
      condition: (j) => scansLine(j)?.source === '/dev/sde1',
      message: (j) => j.t('stuck-boot-event-name'),
    },
    {
      id: 'deleted',
      condition: (j) => !scansLine(j),
      message: (j) => j.t('stuck-boot-event-deleted'),
    },
    {
      id: 'read',
      condition: (j) => readFstab(fstab(j)).errors.length > 0,
      message: (j) => j.t('stuck-boot-event-read'),
    },
    {
      id: 'without-nofail',
      condition: (j) => byId(j) && !withNofail(j),
      message: (j) => j.t('stuck-boot-event-without-nofail'),
    },
    { id: 'fixed', condition: fstabOk, message: (j) => j.t('stuck-boot-event-fixed') },
    { id: 'relapse', condition: (j) => (j.state.relapses ?? 0) > 0 && !fstabOk(j), message: (j) => j.t('stuck-boot-event-relapse') },
    { id: 'relapse-reload', condition: (j) => !!j.state.relapseWithoutReload, message: (j) => j.t('stuck-boot-event-relapse-reload') },
    { id: 'mounted', condition: mounted, message: (j) => j.t('stuck-boot-event-mounted') },
    {
      id: 'end',
      condition: (j) => fstabOk(j) && mounted(j) && !j.state.rescue,
      message: (j) => j.t('stuck-boot-event-end'),
    },
  ],
};
