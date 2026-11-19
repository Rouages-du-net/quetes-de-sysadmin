// Story "The Pantry": what its chapters share. The neighbourhood's
// community grocery (L'Épicerie solidaire in French) keeps its files on a
// small Debian server, crate (cagette in French): the households it helps
// (families.csv: sensitive data), the stock, the volunteers, and the app's
// PostgreSQL database, dumped every night to /var/backups/pantry.sql. A
// USB disk takes a copy home every Friday (Joaquín, a volunteer) and
// brings it back on Monday. Fatou coordinates; Mei, the treasurer, keeps
// the association's password manager, and a sealed envelope in the bank.
// Chapter 1 encrypts that disk (LUKS); chapter 2 gives the restic
// repository a key that doesn't live on the server; chapter 3 replays the
// loss of the server on spare (secours), a borrowed laptop: an internal
// host with the USB disk plugged in.
// The storage is described by storage.ts and luks.ts.

import { d, f, name, password, accountsFiles, type Accounts, type Directory, type Node, type Rights, type InternalHost } from '../world';
import { machineName } from '../machines';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, type DefinitionService } from '../systemd';
import { devDirectory, devUpdate, storageOf, type Disk, type StorageState } from '../storage';
import { mapperUpdate, newUuid, type Header } from '../luks';
import { addSnapshot, hex, repoChildren, type Repo, type Snapshot, type Version } from '../commands/restic';
import { fileBytes, sha256 } from '../commands/checksums';
import { brancher } from '../devices';
import { generateKey } from '../access';

export const M = '/home/you';
export const PASSWORD = 'shelf-2029';
// The passphrase Mei keeps for the disk (chapter 1), and the restic recovery password (chapter 2).
export const DISK_PASSPHRASE = 'tram-lemon-harbour-58';
export const RESTIC_RECOVERY = 'basket-orchard-copper-73';
// What the nightly job reads (/root/.restic-pass): written by Noor, never typed.
export const NIGHTLY_PASSWORD = 'Vq3tN8sLw2ZpR6kD-x4Hm';

// Monday 5 March 2029, 9:10 (chapter 1); Monday 12 March, 9:05 (chapter 2); Saturday 17 March, 10:00 (chapter 3).
export const NOW_1 = Date.UTC(2029, 2, 5, 9, 10, 0);
export const NOW_2 = Date.UTC(2029, 2, 12, 9, 5, 0);
export const NOW_3 = Date.UTC(2029, 2, 17, 10, 0, 0);
const BOOT = Date.UTC(2029, 1, 20, 6, 2, 0);

export const SPARE = '192.0.2.49';
export const MOUNT = '/mnt/offsite';
export const REPO = '/mnt/offsite/restic';
export const KEYFILE = '/root/offsite.key';
export const SCRIPT = '/usr/local/sbin/nightly-backup';
export const DUMP = '/var/backups/pantry.sql';

const SDB_SECTORS = 3_907_029_168;
const SDA_SECTORS = 937_703_088;
export const UUID = {
  root: '3b1f6c2a-8d4e-4a17-b2c9-5e0d7f1a6c31',
  srv: '9e2d4b6f-1a3c-4e58-a7b9-0c1d2e3f4a52',
  plain: '6c8a0e2f-4b1d-4f39-8e7a-2d5c9b0a1e64',
  luks: newUuid('/dev/sdb1-crate'),
  inner: '5f7b9d1e-3a2c-4b6d-9e8f-7a6b5c4d3e21',
  spareRoot: 'a2c4e6f8-1b3d-4f5a-8c7e-9d0b2a4c6e83',
};

export const pantryAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    postgres: { uid: 108, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
    you: { uid: 1000, group: 'you' },
    fatou: { uid: 1001, group: 'fatou' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    disk: { gid: 6, members: [] },
    sudo: { gid: 27, members: ['you'] },
    'www-data': { gid: 33, members: [] },
    postgres: { gid: 113, members: [] },
    you: { gid: 1000, members: [] },
    fatou: { gid: 1001, members: [] },
  },
});

// ——— The pantry's files ———

/** The files of /srv/pantry, by their name in the language, with their content (as the game stores it). */
export function pantryFiles(t: Translate, moment: 'friday' | 'monday' | 'week'): Record<string, string> {
  const clip = (s: string) => s.replace(/^\n+|\s+$/g, '');
  const families = clip(t('pantry-families-csv'));
  // The households registered since: one more line each week.
  const extra = moment === 'friday' ? '' : moment === 'monday' ? clip(t('pantry-families-new-1')) : `${clip(t('pantry-families-new-1'))}\n${clip(t('pantry-families-new-2'))}`;
  return {
    [name(t, 'families.csv')]: extra ? `${families}\n${extra}` : families,
    'stock.csv': clip(t(moment === 'week' ? 'pantry-stock-csv-2' : 'pantry-stock-csv')),
    [name(t, 'volunteers.csv')]: clip(t('pantry-volunteers-csv')),
  };
}

/** SHA256SUMS, as the nightly job writes it before the backup (sha256sum FILES > SHA256SUMS). */
export const manifest = (files: Record<string, string>) =>
  Object.keys(files)
    .sort()
    .map((n) => `${sha256(fileBytes(files[n]))}  ${n}`)
    .join('\n');

/** The directory /srv/pantry (a copy of it on the old disk, too). */
function pantryDirectory(t: Translate, moment: 'friday' | 'monday' | 'week', withManifest: boolean): Directory {
  const files = pantryFiles(t, moment);
  const own: Rights = { owner: 'www-data', group: 'www-data', mode: 'rw-r-----' };
  return d(
    {
      ...Object.fromEntries(Object.entries(files).map(([n, c]) => [n, f(c, { lines: true, ...own })])),
      ...(withManifest ? { SHA256SUMS: f(manifest(files), { lines: true, owner: 'root', group: 'root' }) } : {}),
    },
    undefined,
    { owner: 'www-data', group: 'www-data', mode: 'rwxr-x---' },
  );
}

const ownedByRoot = (n: Node): Node => {
  n.owner ??= 'root';
  n.group ??= 'root';
  if (n.type === 'directory') for (const c of Object.values(n.children)) ownedByRoot(c);
  return n;
};

// ——— The restic repository on the disk (chapters 2 and 3) ———

export const pantryPath = (t: Translate) => `/srv/${name(t, 'pantry')}`;

/** The repository as Noor set it up (5 March): one key, a snapshot each weeknight; and, at chapter 3, Mei's key. */
export function pantryRepo(t: Translate, moment: 'week' | 'drill'): Repo {
  const host = machineName(t, 'crate');
  const repo: Repo = { id: hex('pantry-repository-2029'), password: NIGHTLY_PASSWORD, snapshotList: [], packs: [], checked: false, pruneNeeded: false };
  repo.keys = [{ id: hex('pantry-key-nightly'), password: NIGHTLY_PASSWORD, user: 'root', host, created: Date.UTC(2029, 2, 5, 21, 4, 11) }];
  const nights = moment === 'week' ? [6, 7, 8, 9] : [6, 7, 8, 9, 13, 14, 15, 16];
  const base = pantryPath(t);
  nights.forEach((day, i) => {
    const files = pantryFiles(t, day < 9 ? 'friday' : day < 13 ? 'monday' : 'week');
    const time = Date.UTC(2029, 2, day, 1, 0, 12 + i);
    const all: Record<string, Version> = {};
    for (const [n, c] of Object.entries(files)) all[`${base}/${n}`] = { content: c, size: new TextEncoder().encode(c).length, modified: time - 3_600_000 };
    const sums = manifest(files);
    all[`${base}/SHA256SUMS`] = { content: sums, size: new TextEncoder().encode(sums).length, modified: time };
    const s: Snapshot = { id: hex(`pantry-snapshot-${day}`), time, host, paths: [base], files: all };
    addSnapshot(repo, s);
  });
  if (moment === 'drill') repo.keys.push({ id: hex('pantry-key-escrow'), password: password(t, RESTIC_RECOVERY), user: 'root', host, created: NOW_2 + 1_500_000 });
  repo.checked = true;
  return repo;
}

/** The key file (/root/offsite.key): 4096 random bytes, the same in every game. */
export const keyfileContent = () => (hex('pantry-offsite-keyfile', 8192).match(/../g) ?? []).map((x) => String.fromCharCode(parseInt(x, 16))).join('');

// ——— Storage ———

export type Moment = 'plain' | 'encrypted' | 'drill' | 'spare';

const usbDisk = (rank: number, encrypted: boolean): Disk => ({
  template: 'USB3.0 Disk 2TB',
  serial: 'NA9R4T2K',
  sectors: SDB_SECTORS,
  table: '7D2C4A61-5E3B-4F08-9A1C-6B8E0D2F4A73',
  partitions: [{ number: 1, start: 2048, sectors: SDB_SECTORS - 2048 - 34, type: 'linux', uuid: encrypted ? '2E4A6C8B-0D1F-4A3E-B5C7-9D1E3F5A7C92' : '2E4A6C8B-0D1F-4A3E-B5C7-9D1E3F5A7C92' }],
  smart: { hours: 3120, temperature: 31, reallocated: 0, inWaiting: 0, unreadable: 0, crc: 0, ataErrors: 0 },
  rank,
  removable: true,
});

/** The machine's storage at a chapter's start: the old clear disk, the encrypted one, or (chapter 3) crate without it. */
export function pantryStorage(t: Translate, moment: Moment): StorageState {
  const systemDisk: Disk =
    moment === 'spare'
      ? {
          template: 'NVMe-SSD 256GB',
          serial: 'SP3X91L0',
          sectors: 500_118_192,
          table: '1C3E5A7B-9D0F-4B2C-8E4A-6C8E0A2C4E15',
          partitions: [{ number: 1, start: 2048, sectors: 500_118_192 - 2048 - 34, type: 'linux', uuid: '4B6D8F0A-2C4E-4A6B-8D0F-1A3C5E7B9D26' }],
          smart: { hours: 812, temperature: 36, reallocated: 0, inWaiting: 0, unreadable: 0, crc: 0, ataErrors: 0 },
          rank: 0,
        }
      : {
          template: 'SSD 480GB',
          serial: 'S4K7C2B91',
          sectors: SDA_SECTORS,
          table: '5B7D9F1A-3C5E-4A7B-9D1F-2A4C6E8A0B37',
          partitions: [
            { number: 1, start: 2048, sectors: 134_217_728, type: 'linux', uuid: '8A0C2E4B-6D8F-4A1C-9E3B-5D7F9A1C3E48' },
            { number: 2, start: 134_219_776, sectors: SDA_SECTORS - 134_219_776 - 34, type: 'linux', uuid: '0B2D4F6A-8C0E-4B3D-A5F7-9B1D3F5A7C59' },
          ],
          smart: { hours: 14_208, temperature: 33, reallocated: 0, inWaiting: 0, unreadable: 0, crc: 0, ataErrors: 0 },
          rank: 0,
        };
  const st: StorageState = { disks: { sda: systemDisk }, arrays: {}, grub: ['sda'], fs: {} };
  if (moment === 'spare') st.fs!['/dev/sda1'] = { type: 'ext4', uuid: UUID.spareRoot };
  else {
    st.fs!['/dev/sda1'] = { type: 'ext4', uuid: UUID.root };
    st.fs!['/dev/sda2'] = { type: 'ext4', uuid: UUID.srv };
  }
  if (moment === 'drill') return st;
  st.disks.sdb = usbDisk(1, moment !== 'plain');
  const bytes = (SDB_SECTORS - 2048 - 34) * 512;
  if (moment === 'plain') {
    // The old disk: ext4 in clear, the files copied by rsync last Friday.
    st.fs!['/dev/sdb1'] = {
      type: 'ext4',
      uuid: UUID.plain,
      label: 'OFFSITE',
      bytes,
      tree: ownedByRoot(
        d(
          {
            'lost+found': d({}, undefined, { owner: 'root', mode: 'rwx------' }),
            [name(t, 'pantry')]: pantryDirectory(t, 'friday', false),
            [name(t, 'last-sync.txt')]: f(t('lost-disk-last-sync'), { lines: true, owner: 'root' }),
          },
          undefined,
          { owner: 'root', group: 'root', mode: 'rwxr-xr-x' },
        ),
      ) as Directory,
    };
    return st;
  }
  // The encrypted disk: Mei's passphrase in slot 0, the key file in slot 1, restic inside.
  const repo = pantryRepo(t, moment === 'spare' ? 'drill' : 'week');
  const restic: Directory = { type: 'directory', children: repoChildren(repo), owner: 'root', group: 'root', mode: 'rwx------' };
  const header: Header = {
    uuid: UUID.luks,
    slots: { 0: { kind: 'passphrase', secret: password(t, DISK_PASSPHRASE) }, 1: { kind: 'keyfile', secret: keyfileContent() } },
    epoch: 4,
    inner: {
      type: 'ext4',
      uuid: UUID.inner,
      bytes: bytes - 16 * 1024 * 1024,
      tree: ownedByRoot(d({ 'lost+found': d({}, undefined, { owner: 'root', mode: 'rwx------' }), restic }, undefined, { owner: 'root', group: 'root', mode: 'rwxr-xr-x' })) as Directory,
    },
  };
  st.luks = { '/dev/sdb1': header };
  st.crypt = {};
  st.fs!['/dev/sdb1'] = { type: 'crypto_LUKS', uuid: UUID.luks };
  return st;
}

export const st = (j: Game) => storageOf(j)!;

// ——— The machine ———

const services = (): Record<string, DefinitionService> => ({
  ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }] },
  cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [{ pid: 598, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' }] },
  'postgresql@15-main': {
    description: 'PostgreSQL Cluster 15-main',
    active: true,
    executable: 'postgres',
    process: [{ pid: 742, user: 'postgres', cpu: 0, mem: 1.4, command: '/usr/lib/postgresql/15/bin/postgres -D /var/lib/postgresql/15/main' }],
  },
});

export type ChapterNo = 1 | 2 | 3;

/** The machine's state at the start of a chapter. */
export function pantryState(t: Translate, chapter: ChapterNo) {
  const now = chapter === 1 ? NOW_1 : chapter === 2 ? NOW_2 : NOW_3;
  const storage = pantryStorage(t, chapter === 1 ? 'plain' : chapter === 2 ? 'encrypted' : 'drill');
  return {
    systemd: newSystemd(machineName(t, 'crate'), BOOT, now, services()),
    storage,
    resticClock: now,
    restic: chapter === 2 ? { [REPO]: pantryRepo(t, 'week') } : {},
    mounts: [
      { path: '/', capacity: 134_217_728 * 512, name: '/dev/sda1', system: 'ext4' },
      { path: '/srv', capacity: (SDA_SECTORS - 134_219_776) * 512, name: '/dev/sda2', system: 'ext4' },
    ],
  };
}

/** Kernel messages: the USB disk plugged in (chapters 1 and 2). */
export function pantryKernel(j: Game, plugged: number | null): void {
  j.state.kernel = [
    { time: BOOT, text: 'Linux version 6.12.48+deb13-amd64 (debian-kernel@lists.debian.org)' },
    ...(plugged
      ? [
          { time: plugged, text: 'usb 2-2: new SuperSpeed USB device number 3 using xhci_hcd' },
          { time: plugged + 200, text: 'usb-storage 2-2:1.0: USB Mass Storage device detected' },
          { time: plugged + 1100, text: 'sd 6:0:0:0: [sdb] 3907029168 512-byte logical blocks: (2.00 TB/1.82 TiB)' },
          { time: plugged + 1150, text: ' sdb: sdb1' },
          { time: plugged + 1200, text: 'sd 6:0:0:0: [sdb] Attached SCSI removable disk' },
        ]
      : []),
  ];
}

/** /etc/fstab: the system, and the backup disk's line (by its label in chapter 1, by its mapping after). */
const fstab = (chapter: ChapterNo) =>
  [
    '# /etc/fstab: static file system information.',
    '# <file system>                           <mount point>  <type> <options>          <dump> <pass>',
    `UUID=${UUID.root} /              ext4   errors=remount-ro  0      1`,
    `UUID=${UUID.srv} /srv           ext4   defaults           0      2`,
    chapter === 1 ? `LABEL=OFFSITE                             ${MOUNT}   ext4   defaults,noauto    0      2` : `/dev/mapper/offsite                       ${MOUNT}   ext4   noauto,nofail      0      2`,
  ].join('\n');

const crypttabStart = '# <target name>\t<source device>\t\t<key file>\t<options>';

/** The nightly job (Noor's, chapter 2): opens the disk with the key file, restic, closes. */
export const nightlyScript = (t: Translate, withDump = false) =>
  [
    '#!/bin/sh',
    `# ${t('spare-key-script-comment')}`,
    'set -e',
    `cd ${pantryPath(t)} && sha256sum ${Object.keys(pantryFiles(t, 'friday')).sort().join(' ')} > SHA256SUMS`,
    'cryptdisks_start offsite',
    `mount ${MOUNT}`,
    `export RESTIC_REPOSITORY=${REPO}`,
    'export RESTIC_PASSWORD_FILE=/root/.restic-pass',
    `restic backup ${pantryPath(t)}${withDump ? ` ${DUMP}` : ''}`,
    'restic forget --keep-daily 7 --keep-weekly 8 --prune',
    `umount ${MOUNT}`,
    'cryptdisks_stop offsite',
    'echo "$(date -Is) backup completed"',
  ].join('\n');

/** The nightly log: "backup completed", every night. */
const nightlyLog = (chapter: ChapterNo) => {
  const nights = chapter === 2 ? [6, 7, 8, 9] : [6, 7, 8, 9, 13, 14, 15, 16];
  return nights.map((n, i) => `2029-03-${String(n).padStart(2, '0')}T01:0${2 + (i % 3)}:41+01:00 backup completed`).join('\n');
};

/** crate's world: the system, the pantry's files, what the chapter adds in the home directory. */
export function pantryWorld(t: Translate, chapter: ChapterNo, home: Record<string, Node>): Directory {
  const root: Rights = { owner: 'root' };
  const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const key = generateKey('pantry-crate', `you@${machineName(t, 'crate')}`);
  return place({
    dev: devDirectory(),
    etc: place({
      ...accountsFiles(),
      hostname: file(machineName(t, 'crate')),
      hosts: file(
        `127.0.0.1\tlocalhost\n192.0.2.48\t${machineName(t, 'crate')} ${machineName(t, 'crate')}.internal${chapter === 3 ? `\n${SPARE}\t${machineName(t, 'spare')} ${machineName(t, 'spare')}.internal` : ''}`,
      ),
      fstab: file(fstab(chapter)),
      crypttab: file(chapter === 1 ? crypttabStart : `${crypttabStart}\noffsite\tUUID=${UUID.luks}\t${KEYFILE}\tluks,noauto`),
      'cron.d': place({
        'pantry-dump': file(`# ${t('pantry-cron-dump-comment')}\n30 23 * * * postgres pg_dump pantry > ${DUMP}`),
        ...(chapter >= 2 ? { 'nightly-backup': file(`# ${t('pantry-cron-backup-comment')}\n0 1 * * 1-5 root ${SCRIPT} >> /var/log/nightly-backup.log 2>&1`) } : {}),
      }),
    }),
    home: place({ you: d({ ...home, '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }) }), fatou: place({}, { owner: 'fatou', mode: 'rwx------' }) }),
    mnt: place({ offsite: place({}) }),
    proc: place({}),
    root: place(
      chapter >= 2
        ? {
            // Raw bytes, kept as they are (f() would tidy a text).
            'offsite.key': { type: 'file', content: keyfileContent(), owner: 'root', group: 'root', mode: 'r--------', charset: 'binary' },
            '.restic-pass': f(NIGHTLY_PASSWORD, { lines: true, owner: 'root', group: 'root', mode: 'rw-------' }),
          }
        : {},
      { owner: 'root', mode: 'rwx------' },
    ),
    srv: place({ [name(t, 'pantry')]: pantryDirectory(t, chapter === 1 ? 'monday' : chapter === 2 ? 'monday' : 'week', chapter >= 2) }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({ local: place({ sbin: place(chapter >= 2 ? { 'nightly-backup': f(nightlyScript(t), { lines: true, owner: 'root', mode: 'rwxr-x---' }) } : {}) }) }),
    var: place({
      backups: place({ 'pantry.sql': f(t('pantry-dump-sql'), { lines: true, owner: 'postgres', group: 'postgres', mode: 'rw-r-----' }) }),
      log: place(chapter >= 2 ? { 'nightly-backup.log': file(nightlyLog(chapter), { owner: 'root', group: 'adm', mode: 'rw-r-----' }) } : {}),
    }),
  });
}

/** Mounts the old clear disk where it was (chapter 1 starts with it mounted). */
export function mountOldDisk(j: Game): void {
  const s = j as Shell;
  const before = s.who;
  s.who = 'root';
  try {
    brancher(s, '/dev/sdb1', MOUNT, '');
  } finally {
    s.who = before;
  }
}

/** Before and after each command: /dev follows the disks and the mappings. */
export function devFollow(j: Game): void {
  devUpdate(j);
  mapperUpdate(j);
}

// ——— spare, the borrowed laptop (chapter 3) ———

export const spareAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' } },
  groups: { root: { gid: 0, members: [] }, disk: { gid: 6, members: [] }, sudo: { gid: 27, members: ['you'] }, you: { gid: 1000, members: [] } },
});

export function spareHost(commands: string[]): InternalHost {
  return {
    address: SPARE,
    domain: 'spare.internal',
    accounts: spareAccounts,
    commands,
    state: (t) => ({
      systemd: newSystemd(machineName(t, 'spare'), Date.UTC(2029, 2, 17, 9, 12, 0), NOW_3, {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [{ pid: 588, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D' }] },
      }),
      storage: pantryStorage(t, 'spare'),
      restic: { [REPO]: pantryRepo(t, 'drill') },
      resticClock: NOW_3,
      mounts: [{ path: '/', capacity: (500_118_192 - 2048) * 512, name: '/dev/sda1', system: 'ext4' }],
      kernel: [
        { time: Date.UTC(2029, 2, 17, 9, 12, 0), text: 'Linux version 6.12.48+deb13-amd64 (debian-kernel@lists.debian.org)' },
        { time: Date.UTC(2029, 2, 17, 9, 40, 2), text: 'usb 2-1: new SuperSpeed USB device number 2 using xhci_hcd' },
        { time: Date.UTC(2029, 2, 17, 9, 40, 3), text: 'sd 4:0:0:0: [sdb] 3907029168 512-byte logical blocks: (2.00 TB/1.82 TiB)' },
        { time: Date.UTC(2029, 2, 17, 9, 40, 3), text: ' sdb: sdb1' },
        { time: Date.UTC(2029, 2, 17, 9, 40, 3), text: 'sd 4:0:0:0: [sdb] Attached SCSI removable disk' },
      ],
    }),
    initialise: (j) => devFollow(j),
    createWorld: (t) => {
      const key = generateKey('pantry-crate', `you@${machineName(t, 'crate')}`);
      const root: Rights = { owner: 'root' };
      const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
      return place({
        dev: devDirectory(),
        etc: place({
          ...accountsFiles(),
          hostname: f(machineName(t, 'spare'), { lines: true, owner: 'root' }),
          fstab: f(`# /etc/fstab: static file system information.\nUUID=${UUID.spareRoot} /  ext4  errors=remount-ro  0  1`, { lines: true, owner: 'root' }),
          crypttab: f(crypttabStart, { lines: true, owner: 'root' }),
        }),
        home: place({ you: d({ '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
        mnt: place({}),
        root: place({}, { owner: 'root', mode: 'rwx------' }),
        srv: place({}),
        tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      });
    },
  };
}

/** spare, once the player has connected to it (null before). */
export const spare = (j: Game): Shell | null => (j as Shell).principal.internal('spare');

/** Every file of a tree (path → content), to find a secret wherever it was written. */
export function filesOf(j: Game, from = '/'): [string, string][] {
  const out: [string, string][] = [];
  const walk = (p: string) => {
    if (p === '/proc' || p === '/dev') return;
    const n = j.find(p);
    if (!n) return;
    if (n.type === 'file') {
      if (!n.link) out.push([p, j.read(p) ?? '']);
      return;
    }
    for (const c of Object.keys(n.children)) walk(p === '/' ? `/${c}` : `${p}/${c}`);
  };
  walk(from);
  return out;
}

/** A file named `wanted` in a tree that isn't mounted (a closed disk's), with its content. */
export function inTree(dir: Directory | undefined, wanted: string): string[] {
  if (!dir) return [];
  const out: string[] = [];
  for (const [n, c] of Object.entries(dir.children)) {
    if (c.type === 'directory') out.push(...inTree(c, wanted));
    else if (n === wanted && typeof c.content === 'string') out.push(c.content);
  }
  return out;
}

