// Story "The Lab": what its chapters share. The server of the
// Lab, the neighbourhood photo club (machine lab), rented from a host:
// two 2 TB disks in software RAID 1 (mdadm). md0 holds the system (/),
// md1 the members' photos (/srv). Odile, the president, is not
// technical; the host replaces disks on request (a ticket with the
// serial number), but the RAID is the customer's job.
// The storage is described by storage.ts (disks, SMART, partitions, arrays).

import { d, f, name, accountsFiles, type Accounts, type Directory, type Rights } from '../world';
import { machineName } from '../machines';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, type DefinitionService } from '../systemd';
import { devDirectory, devUpdate, mdstat, storageOf, type Disk, type Partition, type Smart, type StorageState } from '../storage';
import { allocate, pvExtents, lvSize, type LogicVolume } from '../lvm';
import { timeWhoPass } from '../commands/storage';

export const M = '/home/you';
export const PASSWORD = 'film-2027';
// Saturday 13 November 2027, 7:42 am.
export const NOW = Date.UTC(2027, 10, 13, 7, 42, 0);
const BOOT = Date.UTC(2027, 9, 2, 4, 11, 0);
// Chapter 3: Saturday 15 January 2028, 10 am; the server was rebooted to plug in the disks.
export const PLACE_NOW = Date.UTC(2028, 0, 15, 10, 0, 0);
const PLACE_BOOT = Date.UTC(2028, 0, 15, 6, 40, 0);
// Chapter 4: Tuesday 25 January 2028, the nightly reboot (a new kernel) did not complete.
const RESCUE_BOOT = Date.UTC(2028, 0, 25, 4, 2, 0);
const RESCUE_NOW = Date.UTC(2028, 0, 25, 7, 55, 0);
const SECTORS = 3_907_029_168;

// The serial numbers: the failing disk's, the other one's, and the new one's.
export const SERIES = { sda: 'LB7K2A0F31C4', sdb: 'LB7K2A0F58E9', neuf: 'LB7K2B1D07A2', sdc: 'LB4K2C0E19F3', sdd: 'LB4K2C0E2A47' };
export const TEMPLATE = 'LB2000-7K2';
const TEMPLATE_4T = 'LB4000-7K2';
const SECTORS_4T = 7_814_037_168;

export const labAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    odile: { uid: 1001, group: 'odile' },
    theo: { uid: 1002, group: 'theo' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    disk: { gid: 6, members: [] },
    sudo: { gid: 27, members: ['you'] },
    'www-data': { gid: 33, members: [] },
    you: { gid: 1000, members: [] },
    odile: { gid: 1001, members: [] },
    theo: { gid: 1002, members: [] },
  },
});

// The GPT table of the server's disks: GRUB's small partition, then
// one partition per array.
const partitions = (seed: string): Partition[] => [
  { number: 1, start: 2048, sectors: 2048, type: 'bios', uuid: `3C1F0A2E-${seed}-4B7D-9E21-0D5A6C8B1F01` },
  { number: 2, start: 4096, sectors: 67_108_864, type: 'raid', uuid: `8E4D2B6A-${seed}-4F3C-A1D7-2B9E5C0F7A02` },
  { number: 3, start: 67_112_960, sectors: SECTORS - 34 - 67_112_960 + 1, type: 'raid', uuid: `D7A95C13-${seed}-4E8B-B2F6-6A1C3E9D4B03` },
];
const healthySmart = (hours: number): Smart => ({ hours, temperature: 34, reallocated: 0, inWaiting: 0, unreadable: 0, crc: 0, ataErrors: 0 });
const disk = (rank: number, serial: string, smart: Smart, table: string | null, parts: Partition[]): Disk => ({
  template: TEMPLATE,
  serial,
  sectors: SECTORS,
  table,
  partitions: parts,
  smart,
  rank,
});

export type Moment = 'tired' | 'new' | 'replaced' | 'rescue';
// The moments when disk sdb has already been replaced, and when sdc and sdd are plugged in.
const afterReplacement = (m: Moment) => m === 'replaced' || m === 'rescue';

/**
 * The server's storage at the start of a chapter: 'tired' (sdb is wearing
 * out, everything is still in RAID), 'new' (sdb has just been replaced by a
 * blank disk, the arrays run on sda alone) or 'replaced' (everything is
 * repaired, and the host has plugged in two new 4 TB disks, sdc and sdd).
 * The photos are in a logical volume (LVM) on top of md1, as Debian's
 * installer suggests ("RAID then LVM").
 */
export function labStorage(t: Translate, moment: Moment): StorageState {
  // The volume group (lab, labo in French) and the arrays' names (host:number), in the language.
  const vg = name(t, 'lab');
  const host = machineName(t, 'lab');
  const fresh = moment === 'new';
  const sdb = fresh
    ? disk(1, SERIES.neuf, healthySmart(3), null, [])
    : afterReplacement(moment)
      ? disk(1, SERIES.neuf, healthySmart(412), '6A1B3C5D-7E9F-4012-8A3B-C4D5E6F70812', partitions('1A3B'))
    : disk(1, SERIES.sdb, { hours: 28_509, temperature: 37, reallocated: 1208, inWaiting: 8, unreadable: 8, crc: 0, ataErrors: 37 }, '6A1B3C5D-7E9F-4012-8A3B-C4D5E6F70812', partitions('2B4C'));
  const members = (n: number) => [
    { part: `sda${n}`, number: 0, role: 0, state: 'active' as const },
    ...(fresh ? [] : [{ part: `sdb${n}`, number: 1, role: 1, state: 'active' as const }]),
  ];
  const st: StorageState = {
    disks: {
      sda: disk(0, SERIES.sda, healthySmart(28_512), '6A1B3C5D-7E9F-4012-8A3B-C4D5E6F70812', partitions('1A3B')),
      sdb,
      ...(afterReplacement(moment)
        ? {
            sdc: { ...disk(2, SERIES.sdc, healthySmart(2), null, []), template: TEMPLATE_4T, sectors: SECTORS_4T },
            sdd: { ...disk(3, SERIES.sdd, healthySmart(2), null, []), template: TEMPLATE_4T, sectors: SECTORS_4T },
          }
        : {}),
      // Chapter 4: Théo's USB disk of scans, plugged into the server.
      ...(moment === 'rescue'
        ? {
            sde: {
              ...disk(4, 'NA7Q3K1P', healthySmart(1210), '9B2E4F61-3C8A-4D17-A5E2-7F0C6B9D1A33', [
                { number: 1, start: 2048, sectors: 1_953_521_664, type: 'linux', uuid: '4F8C2A1D-6E3B-4A9F-B7D5-0C2E8A4F6B11' },
              ]),
              template: 'USB3.0 Disk 1TB',
              sectors: 1_953_525_168,
              removable: true,
            },
          }
        : {}),
    },
    arrays: {
      md0: { level: 'raid1', wanted: 2, blocks: 33_520_640, uuid: '5d1e0a3c-7b2f-4e91-a6c8-3f0d9b1e2c47', name: `${host}:0`, members: members(2), events: fresh ? 4182 : 4171, creation: Date.UTC(2024, 2, 6, 10, 12, 31), rank: 0 },
      md1: { level: 'raid1', wanted: 2, blocks: 1_919_824_896, uuid: 'a8c3e5f1-2d4b-4a6e-9f17-0b3c5d7e9a21', name: `${host}:1`, members: members(3), events: fresh ? 91_877 : 91_866, creation: Date.UTC(2024, 2, 6, 10, 12, 58), bitmap: true, rank: 1 },
    },
    grub: fresh ? ['sda'] : ['sda', 'sdb'],
  };
  // The photos volume takes the whole lab group (a single PV: md1).
  const photos: LogicVolume = { segments: [], fs: 0, point: '/srv', minor: 0 };
  st.lvm = { pvs: { md1: { vg, uuid: 'q3Xk7v-Lb2N-9fRt-Wm4P-cH8s-Jd5Y-a1ZeQo' } }, vgs: { [vg]: { uuid: 'Hn4w2B-pT6e-Rk9M-sL3v-Qa7X-dF1c-Zg8Y0u', lvs: { photos } } } };
  allocate(st, photos, pvExtents(st, 'md1'), ['md1']);
  // Chapter 4: the end of chapter 3, md2 made of the new disks and given to the photos volume.
  if (moment === 'rescue') {
    st.arrays.md2 = {
      level: 'raid1',
      wanted: 2,
      blocks: 3_906_887_488,
      uuid: 'e3b9d1c7-4a2f-4c8e-b5d6-7f1a9c3e2b40',
      name: `${host}:2`,
      members: [
        { part: 'sdc', number: 0, role: 0, state: 'active' },
        { part: 'sdd', number: 1, role: 1, state: 'active' },
      ],
      events: 2210,
      creation: PLACE_NOW,
      bitmap: true,
      rank: 2,
    };
    st.lvm.pvs.md2 = { vg, uuid: 'Vd6sQ1-mK3p-Xe7R-tB9w-Lc2N-yH4f-Jz8aPu' };
    allocate(st, photos, pvExtents(st, 'md2'), ['md2']);
  }
  photos.fs = lvSize(photos);
  // The file systems, and their UUIDs (those of /etc/fstab).
  st.fs = {
    '/dev/md0': { type: 'ext4', uuid: '0f9c2a4e-61d3-4b8a-9e57-c3d1a2b4e6f8' },
    [`/dev/mapper/${vg}-photos`]: { type: 'ext4', uuid: '7b3e5d1f-2a4c-4e6b-8d9f-1a2b3c4d5e6f' },
    ...(moment === 'rescue' ? { '/dev/sde1': { type: 'ext4', uuid: UUID_SCANS, label: 'SCANS', bytes: 984_000_000_000, tree: scans(t) } } : {}),
  };
  return st;
}

export const st = (j: Game) => storageOf(j)!;

// The scans disk: folders of scans from the club's archives (a disk of its
// own, outside the world: its names are translated here).
export const UUID_SCANS = 'c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13';
const scans = (t: Translate): Directory => {
  const scan = (size: number) => f('', { owner: 'theo', group: 'theo', size });
  return d(
    {
      'archives-1962': d({ [name(t, 'negatives-001.tif')]: scan(212_000_000), [name(t, 'negatives-002.tif')]: scan(198_000_000) }, undefined, { owner: 'theo' }),
      'archives-1978': d({ [name(t, 'prints-001.tif')]: scan(176_000_000) }, undefined, { owner: 'theo' }),
    },
    undefined,
    { owner: 'theo', group: 'theo' },
  );
};

// The machine's services: ssh, smartd (smartmontools), mdmonitor, and nginx for the gallery.
const services = (): Record<string, DefinitionService> => ({
  ssh: {
    description: 'OpenBSD Secure Shell server',
    active: true,
    executable: 'sshd',
    process: [{ pid: 604, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  },
  smartmontools: {
    description: 'Self Monitoring and Reporting Technology (SMART) Daemon',
    active: true,
    executable: 'smartd',
    process: [{ pid: 588, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/smartd -n' }],
  },
  mdmonitor: {
    description: 'MD array monitor',
    active: true,
    executable: 'mdadm',
    process: [{ pid: 591, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/mdadm --monitor --scan' }],
  },
  nginx: {
    description: 'A high performance web server and a reverse proxy server',
    active: true,
    executable: 'nginx',
    process: [{ pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' }],
  },
});

/** The machine's state at the start of a chapter (systemd, storage, mounts). */
export const labState = (t: Translate, moment: Moment) => {
  const storage = labStorage(t, moment);
  const vg = name(t, 'lab');
  return {
    systemd: newSystemd(
      machineName(t, 'lab'),
      moment === 'replaced' ? PLACE_BOOT : moment === 'rescue' ? RESCUE_BOOT : BOOT,
      moment === 'replaced' ? PLACE_NOW : moment === 'rescue' ? RESCUE_NOW : NOW,
      services(),
    ),
    storage,
    mounts: [
      { path: '/', capacity: 33_000_000_000, name: '/dev/md0', system: 'ext4' },
      { path: '/srv', capacity: storage.lvm!.vgs[vg].lvs.photos.fs, name: `/dev/mapper/${vg}-photos`, system: 'ext4' },
    ],
  };
};

/** Kernel messages: sdb's read errors (chapter 1), or its replacement (chapter 2). */
export function labKernel(j: Game, moment: Moment): void {
  const start = moment === 'replaced' ? PLACE_BOOT : moment === 'rescue' ? RESCUE_BOOT : BOOT;
  const newDisks = (['sdc', 'sdd'] as const).flatMap((d, i): [number, string][] => [
    [start + 3000 + i * 10, `ata${i + 3}.00: ATA-11: LB4000-7K2, LB07, max UDMA/133`],
    [start + 3100 + i * 10, `sd ${i + 2}:0:0:0: [${d}] 7814037168 512-byte logical blocks: (4.00 TB/3.64 TiB)`],
    [start + 3200 + i * 10, `sd ${i + 2}:0:0:0: [${d}] Attached SCSI disk`],
  ]);
  const lines: [number, string][] =
    moment === 'replaced'
      ? newDisks
      : moment === 'rescue'
        ? [
            ...newDisks,
            [start + 3400, 'md/raid1:md2: active with 2 out of 2 mirrors'],
            [start + 5100, 'usb 2-1: new SuperSpeed USB device number 2 using xhci_hcd'],
            [start + 5300, 'usb-storage 2-1:1.0: USB Mass Storage device detected'],
            [start + 6200, 'sd 6:0:0:0: [sde] 1953525168 512-byte logical blocks: (1.00 TB/932 GiB)'],
            [start + 6300, ' sde: sde1'],
            [start + 6400, 'sd 6:0:0:0: [sde] Attached SCSI removable disk'],
          ]
      : moment === 'tired'
      ? [
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: exception Emask 0x0 SAct 0x40000 SErr 0x0 action 0x0'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: irq_stat 0x40000008'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: failed command: READ FPDMA QUEUED'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: cmd 60/08:90:87:d6:12/00:00:00:00:00/40 tag 18 ncq dma 4096 in\n         res 41/40:00:87:d6:12/00:00:00:00:00/40 Emask 0x409 (media error) <F>'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: status: { DRDY ERR }'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: error: { UNC }'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'ata2.00: configured for UDMA/133'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'sd 1:0:0:0: [sdb] tag#18 FAILED Result: hostbyte=DID_OK driverbyte=DRIVER_OK cmd_age=3s'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'sd 1:0:0:0: [sdb] tag#18 Sense Key : Medium Error [current]'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'sd 1:0:0:0: [sdb] tag#18 Add. Sense: Unrecovered read error - auto reallocate failed'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'I/O error, dev sdb, sector 1234567 op 0x0:(READ) flags 0x0 phys_seg 1 prio class 2'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'md/raid1:md0: sdb2: rescheduling sector 1195655'],
          [Date.UTC(2027, 10, 11, 3, 12, 42), 'md/raid1:md0: redirecting sector 1195655 to other mirror: sda2'],
          [Date.UTC(2027, 10, 11, 3, 12, 42), 'ata2: EH complete'],
          [Date.UTC(2027, 10, 13, 2, 47, 9), 'ata2.00: failed command: READ FPDMA QUEUED'],
          [Date.UTC(2027, 10, 13, 2, 47, 10), 'I/O error, dev sdb, sector 1990344712 op 0x0:(READ) flags 0x0 phys_seg 1 prio class 2'],
          [Date.UTC(2027, 10, 13, 2, 47, 10), 'md/raid1:md1: sdb3: rescheduling sector 1923231752'],
          [Date.UTC(2027, 10, 13, 2, 47, 11), 'md/raid1:md1: redirecting sector 1923231752 to other mirror: sda3'],
        ]
      : [
          [Date.UTC(2027, 10, 14, 6, 58, 2), 'ata2: SATA link down (SStatus 0 SControl 300)'],
          [Date.UTC(2027, 10, 14, 6, 58, 2), 'ata2.00: disable device'],
          [Date.UTC(2027, 10, 14, 7, 6, 51), 'ata2: SATA link up 6.0 Gbps (SStatus 133 SControl 300)'],
          [Date.UTC(2027, 10, 14, 7, 6, 51), `ata2.00: ATA-11: ${TEMPLATE}, LB07, max UDMA/133`],
          [Date.UTC(2027, 10, 14, 7, 6, 51), 'ata2.00: 3907029168 sectors, multi 16: LBA48 NCQ (depth 32), AA'],
          [Date.UTC(2027, 10, 14, 7, 6, 52), 'sd 1:0:0:0: [sdb] 3907029168 512-byte logical blocks: (2.00 TB/1.82 TiB)'],
          [Date.UTC(2027, 10, 14, 7, 6, 52), 'sd 1:0:0:0: [sdb] Attached SCSI disk'],
        ];
  j.state.kernel = [
    { time: start, text: 'Linux version 6.12.48+deb13-amd64 (debian-kernel@lists.debian.org)' },
    { time: start + 2000, text: 'md/raid1:md0: active with 2 out of 2 mirrors' },
    { time: start + 2100, text: 'md/raid1:md1: active with 2 out of 2 mirrors' },
    ...lines.map(([time, text]) => ({ time, text })),
  ];
}

// A mail from smartd (smartmontools 7.4 format), in the player's mailbox (root: the player's account in /etc/aliases).
const smartdMail = (host: string, time: string, subject: string, warning: string, first: string) =>
  [
    `From root@${host} ${time}`,
    'To: root',
    `Subject: SMART error (${subject}) detected on host: ${host}`,
    `From: root <root@${host}>`,
    '',
    'This message was generated by the smartd daemon running on:',
    '',
    `   host name:  ${host}`,
    '   DNS domain: internal',
    '',
    'The following warning/error was logged by the smartd daemon:',
    '',
    `Device: /dev/sdb [SAT], ${warning}`,
    '',
    'Device info:',
    `${TEMPLATE}, S/N:${SERIES.sdb}, WWN:5-000c50-0a1b2c3d4, FW:LB07, 2.00 TB`,
    '',
    "For details see host's SYSLOG.",
    '',
    'You can also use the smartctl utility for further investigation.',
    `The original message about this issue was sent at ${first} UTC`,
    'Another message will be sent in 24 hours if the problem persists.',
    '',
  ].join('\n');

/** smartd's mails, from the machine (its name in the language: labo, lab). */
export const smartdBox = (host: string) =>
  [
    smartdMail(host, 'Thu Nov 11 03:12:44 2027', 'CurrentPendingSector', '8 Currently unreadable (pending) sectors', 'Thu Nov 11 03:12:44 2027'),
    smartdMail(host, 'Thu Nov 11 03:42:44 2027', 'OfflineUncorrectableSector', '8 Offline uncorrectable sectors', 'Thu Nov 11 03:42:44 2027'),
    smartdMail(host, 'Sat Nov 13 03:12:44 2027', 'CurrentPendingSector', '8 Currently unreadable (pending) sectors', 'Thu Nov 11 03:12:44 2027'),
  ].join('\n');

/** The machine's world: the system, the photos, and what the chapter adds in the home directory and elsewhere. */
export function labWorld(t: Translate, home: Record<string, ReturnType<typeof f>>, more: { mail?: string; winter?: boolean; rescue?: boolean } = {}): Directory {
  const root: Rights = { owner: 'root' };
  const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const photo = (size: number) => f('', { owner: 'www-data', group: 'www-data', size });
  return place({
    dev: devDirectory(),
    etc: place({
      ...accountsFiles(),
      hostname: file(machineName(t, 'lab')),
      aliases: file('# See man 5 aliases for format\npostmaster:    root\nroot: you'),
      fstab: file(
        [
          '# /etc/fstab: static file system information.',
          '# <file system>                           <mount point> <type> <options>          <dump> <pass>',
          'UUID=0f9c2a4e-61d3-4b8a-9e57-c3d1a2b4e6f8 /             ext4   errors=remount-ro  0      1',
          'UUID=7b3e5d1f-2a4c-4e6b-8d9f-1a2b3c4d5e6f /srv          ext4   defaults           0      2',
          // Chapter 4: the line added by Théo, following a tutorial on his laptop.
          ...(more.rescue ? ['', t('stuck-boot-fstab-comment'), '/dev/sdc1  /srv/scans  ext4  defaults  0  2'] : []),
        ].join('\n'),
      ),
      mdadm: place({
        'mdadm.conf': file(
          [
            '# mdadm.conf',
            '#',
            '# !NB! Run update-initramfs -u after updating this file.',
            '',
            'HOMEHOST <system>',
            'MAILADDR root',
            '',
            `ARRAY /dev/md/0  metadata=1.2 UUID=5d1e0a3c:7b2f4e91:a6c83f0d:9b1e2c47 name=${machineName(t, 'lab')}:0`,
            `ARRAY /dev/md/1  metadata=1.2 UUID=a8c3e5f1:2d4b4a6e:9f170b3c:5d7e9a21 name=${machineName(t, 'lab')}:1`,
            ...(more.rescue ? [`ARRAY /dev/md2 metadata=1.2 name=${machineName(t, 'lab')}:2 UUID=e3b9d1c7:4a2f4c8e:b5d67f1a:9c3e2b40`] : []),
          ].join('\n'),
        ),
      }),
      'smartd.conf': file(
        [
          '# Monitor all disks, mail root on trouble, short self-test every night at 3 am.',
          'DEVICESCAN -d removable -n standby -m root -M exec /usr/share/smartmontools/smartd-runner -s S/../.././03',
        ].join('\n'),
      ),
    }),
    home: place({ you: d(more.rescue ? {} : home), odile: place({}, { owner: 'odile', mode: 'rwx------' }) }),
    // Chapter 4: we work as root, on the host's console.
    ...(more.rescue ? { root: place(home, { owner: 'root', mode: 'rwx------' }) } : {}),
    proc: place({ mdstat: f((j) => mdstat(storageOf(j)!), { lines: true, owner: 'root', mode: 'r--r--r--' }) }),
    srv: place({
      photos: place(
        {
          '2025': place({ 'spring-show': place({ 'prints.tar': photo(48_000_000_000) }, { owner: 'www-data' }) }, { owner: 'www-data' }),
          '2026': place({ 'harbour-trip': place({ 'raw.tar': photo(212_000_000_000) }, { owner: 'www-data' }) }, { owner: 'www-data' }),
          '2027': place(
            {
              'night-contest': place({ 'raw.tar': photo(391_000_000_000) }, { owner: 'www-data' }),
              // Chapter 3: the autumn archives, poured in all at once.
              ...(more.winter ? { 'autumn-archives': place({ 'raw.tar': photo(1_259_000_000_000) }, { owner: 'www-data' }) } : {}),
            },
            { owner: 'www-data' },
          ),
        },
        { owner: 'www-data', group: 'www-data' },
      ),
      // The mount point of the scans disk (chapter 4).
      ...(more.rescue ? { scans: place({}, { owner: 'root' }) } : {}),
    }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({ lib: f('', { owner: 'root', size: 2_900_000_000 }) }),
    var: place({
      log: place({ syslog: f(t('lab-syslog'), { lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----' }) }),
      mail: place(
        more.mail === undefined ? {} : { you: f(more.mail, { lines: true, owner: 'you', group: 'mail', mode: 'rw-rw----' }) },
        { owner: 'root', group: 'mail', mode: 'rwxrwsr-x' },
      ),
      www: place({ gallery: place({ 'index.html': file(t('lab-gallery-index'), { owner: 'www-data' }) }) }),
    }),
  });
}

/** Before each command: time has passed since the previous one (the rebuild progresses). */
export function beforeLabCommand(j: Game): void {
  timeWhoPass(j as Shell);
  devUpdate(j);
}

