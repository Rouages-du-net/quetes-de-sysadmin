// Story "The Pantry", chapter "The Lost Disk": on Friday evening, Joaquín
// left the backup disk on the tram; the lost-property office gave it back
// on Monday. It is not encrypted: anyone could have read the list of the
// households the pantry helps. You encrypt it with LUKS: unmount it,
// luksFormat the right device (the real YES prompt), open it, make an ext4
// file system on the mapping, add a key file kept on the server (root
// only) for the nightly job and Mei's passphrase (her password manager,
// her sealed envelope) in a second slot, describe it in /etc/crypttab
// (UUID=, the key file, luks,noauto: a removable disk) and /etc/fstab
// (the mapping, noauto or nofail), copy the files back onto it, then close it.
// Objective checked on the state: sdb (or sdb1) is LUKS, with Mei's
// passphrase and a key file that only root can read, outside the disk;
// crypttab and fstab describe it; the pantry's files are on the encrypted
// file system; the disk is closed; Mei's note is no longer on the server.
// Sources: cryptsetup(8), crypttab(5), https://cryptsetup-team.pages.debian.net/cryptsetup/README.Debian.html,
// https://gitlab.com/cryptsetup/cryptsetup/-/wikis/FrequentlyAskedQuestions

import { f, name, password, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { readFstab, blocking } from '../fstab';
import { deviceFor, readCrypttab, type Header } from '../luks';
import { DISK_PASSPHRASE, M, MOUNT, NOW_1, PASSWORD, devFollow, filesOf, inTree, mountOldDisk, pantryAccounts, pantryFiles, pantryKernel, pantryState, pantryWorld, st } from './pantry';

const LUKS_DEVICES = ['/dev/sdb1', '/dev/sdb'];
const luks = (j: Game): [string, Header] | null => {
  const found = LUKS_DEVICES.find((x) => st(j).luks?.[x]);
  return found ? [found, st(j).luks![found]] : null;
};
const mei = (j: Game) => password(j.t, DISK_PASSPHRASE);
const passphrase = (j: Game) => Object.values(luks(j)?.[1].slots ?? {}).some((k) => k.kind === 'passphrase' && k.secret === mei(j));
const otherPassphrase = (j: Game) => Object.values(luks(j)?.[1].slots ?? {}).some((k) => k.kind === 'passphrase' && k.secret !== mei(j));

// The key files: the files of the server (outside the disk) whose content opens a slot.
const keyFiles = (j: Game) => {
  const secrets = Object.values(luks(j)?.[1].slots ?? {}).filter((k) => k.kind === 'keyfile').map((k) => k.secret);
  return filesOf(j).filter(([, c]) => secrets.includes(c));
};
const secure = (j: Game, path: string) => {
  const n = j.find(path);
  return !!n && n.owner === 'root' && /^r[w-]-------$/.test(n.mode ?? 'rw-r--r--') && j.find(path.replace(/\/[^/]+$/, '') || '/')?.owner === 'root';
};
const onDisk = (p: string) => p.startsWith(`${MOUNT}/`);
const keyfileOk = (j: Game) => keyFiles(j).some(([p]) => !onDisk(p) && secure(j, p));
const keyfileOpen = (j: Game) => keyFiles(j).some(([p]) => !secure(j, p));

const crypttab = (j: Game) => readCrypttab(j.read('/etc/crypttab') ?? '');
const crypttabEntry = (j: Game) => {
  const l = luks(j);
  if (!l) return undefined;
  const keys = keyFiles(j).map(([p]) => p);
  return crypttab(j).find((e) => deviceFor(st(j), e.source) === l[0] && keys.includes(e.key) && e.options.includes('luks'));
};
const byUuid = (j: Game) => /^(UUID=|\/dev\/disk\/by-uuid\/)/.test(crypttabEntry(j)?.source ?? '');
const removable = (j: Game) => ['noauto', 'nofail'].some((o) => crypttabEntry(j)?.options.includes(o));
const crypttabOk = (j: Game) => !!crypttabEntry(j) && byUuid(j) && removable(j);

const fstabText = (j: Game) => j.read('/etc/fstab') ?? '';
const fstabOk = (j: Game) => {
  const e = crypttabEntry(j);
  if (!e) return false;
  const { inputs, errors } = readFstab(fstabText(j));
  const line = inputs.find((x) => x.source === `/dev/mapper/${e.name}`);
  return (
    !!line &&
    errors.length === 0 &&
    ['noauto', 'nofail'].some((o) => line.options.includes(o)) &&
    !inputs.some((x) => x.source === 'LABEL=OFFSITE') &&
    blocking(st(j), fstabText(j)).length === 0
  );
};

// The encrypted file system holds the server's files (the families' list, as it is today).
const inner = (j: Game) => {
  const l = luks(j);
  if (!l) return undefined;
  const open = Object.entries(st(j).crypt ?? {}).find(([, m]) => m.device === l[0]);
  return open ? st(j).fs?.[`/dev/mapper/${open[0]}`] : l[1].inner;
};
const hasFs = (j: Game) => inner(j)?.type === 'ext4';
const copied = (j: Game) => {
  const want = pantryFiles(j.t, 'monday')[name(j.t, 'families.csv')];
  return inTree(inner(j)?.tree, name(j.t, 'families.csv')).includes(want);
};
const mounted = (j: Game, dev: string) => ((j.state.mounts ?? []) as { name: string }[]).some((m) => m.name === dev);
const closed = (j: Game) => !Object.keys(st(j).crypt ?? {}).length && !((j.state.mounts ?? []) as { name: string }[]).some((m) => /^\/dev\/(sdb|mapper\/)/.test(m.name));
const noteGone = (j: Game) => !filesOf(j).some(([, c]) => c.includes(mei(j)));
const refused = (j: Game, re: RegExp) => re.test((j.state.luksFormatRefused as string | undefined) ?? '');

export const lostDisk: Chapter = {
  id: 'lost-disk',
  number: 1,
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
    'tee',
    'nano',
    'cp',
    'rm',
    'mkdir',
    'chmod',
    'chown',
    'stat',
    'rsync',
    'sudo',
    'df',
    'dmesg',
    'lsblk',
    'blkid',
    'findmnt',
    'mount',
    'umount',
    'dd',
    'cryptsetup',
    'mkfs.ext4',
    'cryptdisks_start',
    'cryptdisks_stop',
  ],
  home: M,
  welcome: 'message_from_fatou.txt',
  names: true,
  final: 'end',
  steps: ['disk', 'unmounted', 'formatted', 'filesystem', 'keyfile', 'passphrase', 'crypttab', 'fstab', 'copied', 'closed', 'note', 'end'],
  password: PASSWORD,
  accounts: pantryAccounts,
  state: (t) => pantryState(t, 1),
  initialise: (j) => {
    pantryKernel(j, NOW_1 - 1_800_000);
    devFollow(j);
    mountOldDisk(j);
  },
  createWorld: (t) =>
    pantryWorld(t, 1, {
      'message_from_fatou.txt': f(t('lost-disk-message-fatou')),
      'note_from_mei.txt': f(t('lost-disk-note-mei', { passphrase: password(t, DISK_PASSPHRASE) })),
    }),
  beforeCommand: devFollow,
  afterCommand: (j) => devFollow(j),
  events: [
    {
      id: 'disk',
      condition: (j) => /sdb1/.test(j.last.output) && /OFFSITE|\/mnt\/offsite/.test(j.last.output),
      message: (j) => j.t('lost-disk-event-disk'),
    },
    { id: 'system-disk', condition: (j) => refused(j, /^\/dev\/sda/), message: (j) => j.t('lost-disk-event-system-disk') },
    { id: 'in-use', condition: (j) => refused(j, /^\/dev\/sdb/), message: (j) => j.t('lost-disk-event-in-use') },
    { id: 'unmounted', condition: (j) => !mounted(j, '/dev/sdb1') && !luks(j), message: (j) => j.t('lost-disk-event-unmounted') },
    { id: 'lowercase', condition: (j) => j.state.luksFormatAborted !== undefined, message: (j) => j.t('lost-disk-event-lowercase') },
    { id: 'formatted', condition: (j) => !!luks(j), message: (j) => j.t('lost-disk-event-formatted') },
    {
      id: 'mounted-luks',
      condition: (j) => j.last.errors.some((e) => e.includes("unknown filesystem type 'crypto_LUKS'")),
      message: (j) => j.t('lost-disk-event-mounted-luks'),
    },
    {
      id: 'mkfs-header',
      condition: (j) => ((j.state.luksFormatted as string[] | undefined) ?? []).some((x) => ((j.state.mkfsDone as string[] | undefined) ?? []).includes(x)) && !luks(j),
      message: (j) => j.t('lost-disk-event-mkfs-header'),
    },
    { id: 'filesystem', condition: hasFs, message: (j) => j.t('lost-disk-event-filesystem') },
    { id: 'keyfile-open', condition: keyfileOpen, message: (j) => j.t('lost-disk-event-keyfile-open') },
    { id: 'keyfile-on-disk', condition: (j) => keyFiles(j).some(([p]) => onDisk(p)), message: (j) => j.t('lost-disk-event-keyfile-on-disk') },
    { id: 'keyfile', condition: keyfileOk, message: (j) => j.t('lost-disk-event-keyfile') },
    { id: 'own-passphrase', condition: (j) => otherPassphrase(j) && !passphrase(j), message: (j) => j.t('lost-disk-event-own-passphrase') },
    { id: 'passphrase', condition: passphrase, message: (j) => j.t('lost-disk-event-passphrase') },
    { id: 'insecure', condition: (j) => !!j.state.cryptdisksInsecure, message: (j) => j.t('lost-disk-event-insecure') },
    { id: 'crypttab-name', condition: (j) => !!crypttabEntry(j) && !byUuid(j), message: (j) => j.t('lost-disk-event-crypttab-name') },
    { id: 'crypttab-auto', condition: (j) => !!crypttabEntry(j) && byUuid(j) && !removable(j), message: (j) => j.t('lost-disk-event-crypttab-auto') },
    { id: 'crypttab', condition: crypttabOk, message: (j) => j.t('lost-disk-event-crypttab') },
    { id: 'fstab', condition: (j) => crypttabOk(j) && fstabOk(j), message: (j) => j.t('lost-disk-event-fstab') },
    { id: 'copied', condition: copied, message: (j) => j.t('lost-disk-event-copied') },
    { id: 'busy', condition: (j) => !!j.state.luksCloseBusy, message: (j) => j.t('lost-disk-event-busy') },
    { id: 'closed', condition: (j) => copied(j) && closed(j), message: (j) => j.t('lost-disk-event-closed') },
    { id: 'note', condition: (j) => passphrase(j) && noteGone(j), message: (j) => j.t('lost-disk-event-note') },
    {
      id: 'note-early',
      condition: (j) => !passphrase(j) && noteGone(j),
      // Mei sends it again (the next deletion, once it is in its slot, is the right one).
      action: (j) => {
        const n = j.find((j as Shell).home);
        if (n?.type === 'directory') n.children[name(j.t, 'note_from_mei.txt')] = f(j.t('lost-disk-note-mei', { passphrase: mei(j) }), { owner: j.player, group: j.player });
      },
      message: (j) => j.t('lost-disk-event-note-early'),
    },
    {
      id: 'end',
      condition: (j) => !!luks(j) && hasFs(j) && keyfileOk(j) && !keyfileOpen(j) && passphrase(j) && crypttabOk(j) && fstabOk(j) && copied(j) && closed(j) && noteGone(j),
      message: (j) => j.t('lost-disk-event-end'),
    },
  ],
};
