// Story "The Canteen", chapter 4 — "The Late Disk": the canteen keeps its
// bookings lists on an old USB disk, mounted on /srv/data (fstab, with
// nofail since the day it was missing). At boot it takes about 25 seconds
// to appear; the app doesn't wait for it: it started first and wrote this
// morning's list into /srv/data on the system disk… then the USB disk was
// mounted on top and hid it. For the kitchen, the morning's bookings have
// vanished.
// Commands: findmnt, lsblk, journalctl -b, systemd-analyze critical-chain,
// umount / mount (what a mount point hides), cp, systemctl edit
// (RequiresMountsFor=), reboot.
// Objective checked on the state: this morning's list is back on the USB
// disk, with its bookings; after a reboot started by the player, the app
// started after the disk was mounted, and this was checked. Other accepted
// solution: nofail removed (the boot waits for the disk, at the price of
// emergency mode if it is ever missing).
// Sources: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#RequiresMountsFor=,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html#nofail,
// https://man7.org/linux/man-pages/man8/mount.8.html

import type { Chapter, Directory, File } from '../world';
import { d, f } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { systemd } from '../systemd';
import type { Device } from '../commands/disks';
import { HOME, PASSWORD, ETH0_NETWORK, accounts, canteenState, canteenWorld, firstBoot, running, seen } from './canteen';

// After chapters 1 to 3: ordered after PostgreSQL, part of it, and the network
// question settled; but nothing about /srv/data.
export const MENU_UNIT_LATE = (t: Translate) => `[Unit]
Description=${t('canteen-menu-description')}
After=postgresql.service
Wants=postgresql.service
PartOf=postgresql.service

[Service]
User=menu
WorkingDirectory=/srv/menu
EnvironmentFile=/etc/menu/menu.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target`;

export const USB = '/dev/sdb1';
const UUID = '5e1f0c7a-38d2-4b8e-9a61-0c2b7d4e9f13';
export const DATA = '/srv/data';
export const TODAY = '2027-11-29';
export const FSTAB = `# /etc/fstab: static file system information.
# <file system>                            <mount point> <type> <options>         <dump> <pass>
UUID=1d3f6b2a-7c55-4e0f-8b9a-2e4c6a8d0f11  /             ext4   errors=remount-ro 0      1
# The canteen's USB disk (bookings, photos). nofail: the server must boot even without it.
UUID=${UUID}  ${DATA}     ext4   defaults,nofail   0      2`;

const BOOT = Date.UTC(2027, 10, 29, 6, 30, 0);
const NOW = Date.UTC(2027, 10, 29, 9, 40, 0);
const sd = (j: Game) => systemd(j)!;
const today = (t: Translate) => `${TODAY}.csv`;

/** A list of bookings: the header, then one line per booking (the morning's, at the first boot). */
const list = (t: Translate, morning: boolean) => [t('late-disk-header'), ...(morning ? t('late-disk-bookings').split('\n') : [])].join('\n');

/** The node at this path inside a tree (the USB disk's, mounted or not). */
function inTree(tree: Directory, path: string[]): File | Directory | null {
  let n: File | Directory = tree;
  for (const p of path) {
    if (n.type !== 'directory') return null;
    const next = n.children[p];
    if (!next || (next.type !== 'directory' && next.type !== 'file')) return null;
    n = next as File | Directory;
  }
  return n;
}
const usb = (j: Game) => (j.state.devices?.[USB] as Device | undefined)?.tree;
/** The morning's bookings, on the USB disk itself. */
export const recovered = (j: Game) => {
  const tree = usb(j);
  const n = tree && inTree(tree, ['bookings', today(j.t)]);
  if (n?.type !== 'file' || typeof n.content !== 'string') return false;
  return j.t('late-disk-bookings').split('\n').every((l) => (n.content as string).includes(l));
};
/** At the last boot, the app started once the disk was mounted. */
const afterMount = (j: Game) => {
  const units = sd(j).lastBoot?.units ?? {};
  const mount = units['srv-data.mount'];
  return !!mount && !!units.menu && units.menu.at >= mount.at + mount.took;
};
const mounted = (j: Game) => ((j.state.mounts ?? []) as { path: string }[]).some((m) => m.path === DATA);
// At the last boot, /srv/data had nofail.
const nofail = (j: Game) => /UUID=\S+\s+\/srv\/data\s+\S+\s+\S*nofail/.test(sd(j).lastBoot?.fstab ?? '');

export const lateDisk: Chapter = {
  id: 'late-disk',
  number: 4,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps', 'cp', 'mv', 'mkdir', 'wc', 'diff',
    'systemctl', 'journalctl', 'systemd-analyze', 'reboot', 'mount', 'umount', 'findmnt', 'lsblk', 'df', 'curl',
  ],
  home: HOME,
  welcome: 'message_from_ibrahim.txt',
  names: true,
  final: 'end',
  steps: ['hidden', 'recovered', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => {
    const usbTree = d(
      {
        bookings: d(
          {
            '2027-11-25.csv': f(list(t, false) + '\n' + t('late-disk-old-bookings'), { lines: true, owner: 'menu' }),
            '2027-11-26.csv': f(list(t, false) + '\n' + t('late-disk-old-bookings'), { lines: true, owner: 'menu' }),
          },
          undefined,
          { owner: 'menu', group: 'menu' },
        ),
        'lost+found': d({}, undefined, { owner: 'root', mode: 'rwx------' }),
      },
      undefined,
      { owner: 'root' },
    );
    const device: Device = { disk: '/dev/sdb', majmin: [8, 17], removable: true, size: 128_035_676_160, system: 'ext4', label: 'DATA', uuid: UUID, tree: usbTree, delay: 24_310 };
    return {
      ...canteenState(t, { postgres: 702, boot: BOOT }, { lo: { type: 'loopback', carrier: true }, eth0: { type: 'ether', carrier: true } }),
      devices: { [USB]: device },
      mounts: [],
      // The morning's bookings, written by the app at the first boot.
      morning: true,
    };
  },
  initialise: (j) => {
    // The app writes today's list where /srv/data is when it starts.
    const menu = systemd(j)!.services.menu;
    menu.load = (game: Game) => {
      const g = game as Shell;
      const before = g.who;
      g.who = 'root';
      try {
        const dir = `${DATA}/bookings`;
        if (!g.exists(dir)) g.place('node', dir, { type: 'directory', children: {}, owner: 'menu', group: 'menu' });
        const file = `${dir}/${today(g.t)}`;
        if (!g.exists(file)) g.place('node', file, { type: 'file', content: list(g.t, g.state.morning === true), owner: 'menu', lines: true });
      } finally {
        g.who = before;
      }
      g.state.morning = false;
    };
    firstBoot(j, NOW);
  },
  createWorld: (t) => {
    const world = canteenWorld(t, {
      menuUnit: MENU_UNIT_LATE(t),
      welcome: { 'message_from_ibrahim.txt': t('late-disk-message-ibrahim') },
      network: { '10-eth0.network': ETH0_NETWORK },
    });
    const etc = world.children.etc as Directory;
    etc.children.fstab = f(FSTAB, { lines: true, owner: 'root' });
    const srv = world.children.srv as Directory;
    srv.children.data = d({}, undefined, { owner: 'menu', group: 'menu' });
    return world;
  },
  events: [
    {
      id: 'hidden',
      condition: (j) => !mounted(j) && j.exists(`${DATA}/bookings/${today(j.t)}`) && seen(j, today(j.t)) && !j.last.errors.length,
      message: (j) => j.t('late-disk-event-hidden'),
    },
    {
      id: 'order',
      condition: (j) => seen(j, 'Mounted srv-data.mount'),
      message: (j) => j.t('late-disk-event-order'),
    },
    {
      id: 'recovered',
      condition: recovered,
      message: (j) => j.t('late-disk-event-recovered'),
    },
    {
      id: 'no-nofail',
      condition: (j) => sd(j).boot > 1 && afterMount(j) && !nofail(j),
      message: (j) => j.t('late-disk-event-no-nofail'),
    },
    {
      id: 'end',
      condition: (j) => sd(j).boot > 1 && sd(j).checkedAfterBoot === true && recovered(j) && afterMount(j) && running(j, 'menu'),
      message: (j) => j.t('late-disk-event-end'),
    },
  ],
};
