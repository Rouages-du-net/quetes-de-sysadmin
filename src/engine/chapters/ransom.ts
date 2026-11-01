// Story "The Game Library" — chapter "The ransom": Monday morning, the game
// library's shared files are encrypted (.locked) and a ransom note lies in
// every folder. The password of the frontdesk account was guessed; a program
// still runs under this account, and its crontab starts it again. Last
// night's copy on the NAS is encrypted too: rsync --delete faithfully copied
// the damage. What is left is the USB disk in the drawer, offline: a restic
// repository from a week ago.
// Objective checked on the state: the encryptor is stopped and does not
// come back (crontab cleaned), the frontdesk account is locked, all files are
// restored, no more .locked file nor ransom note, and the backup disk is
// unmounted (offline again).
// Sources: https://www.cisa.gov/stopransomware/ransomware-guide,
// https://cyber.gouv.fr/publications/attaques-par-rancongiciels-tous-concernes,
// https://restic.readthedocs.io/en/stable/050_restore.html,
// https://man7.org/linux/man-pages/man8/mount.8.html

import { password, path, d, f, accountsFiles, name, account, type Chapter, type Accounts, type Directory, type Rights, type Node } from '../world';
import { machineName } from '../machines';
import type { Game, Shell } from '../shell';
import { writeLog, newSystemd, systemd } from '../systemd';
import type { Process } from '../commands/system';
import { addSnapshot, writeRepo, hex, type Repo, type Version } from '../commands/restic';
import type { Device } from '../commands/disks';

const M = '/home/you';
const SHARE = '/srv/share';
const NAS = '/mnt/nas';
const KEY = '/mnt/usb';
// The USB disk's restic repository.
const REPO = `${KEY}/repo`;
const USB = '/dev/sdb1';
const ENCRYPTOR = '/home/frontdesk/.cache/.upd/system-update';
const NOTE = 'READ-ME-TO-RECOVER.txt';
const PASSWORD = 'pawn-knight-rook-27';
const Go = 1_000_000_000;

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    frontdesk: { uid: 1001, group: 'frontdesk' },
    berenice: { uid: 1002, group: 'berenice' },
  },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you', 'berenice'] },
    you: { gid: 1000, members: [] },
    frontdesk: { gid: 1001, members: [] },
    berenice: { gid: 1002, members: [] },
    gamelib: { gid: 1100, members: ['you', 'frontdesk', 'berenice'] },
  },
});

// The share's files (relative path → text identifier).
const FILES: Record<string, string> = {
  'inventory.csv': 'ransom-inventory',
  'volunteer-rota.txt': 'ransom-schedule',
  'games-day-poster.txt': 'ransom-shows',
  'rules/goose-game.txt': 'ransom-rules-goose',
  'rules/ludo.txt': 'ransom-rules-horses',
  'rules/draughts.txt': 'ransom-rules-ladies',
};

// An encrypted file: a name ending in .locked and unreadable bytes.
const unreadable = (seed: string) =>
  hex(`encrypted-${seed}`, 160)
    .replace(/(.{40})/g, '$1\n')
    .trim();

// The backup of Sunday 13 June, on the USB disk.
function usbRepo(t: Game['t']): Repo {
  const repo: Repo = { id: hex('repo-game-library'), password: password(t, PASSWORD), snapshotList: [], packs: [], checked: true, pruneA: false };
  const sundays = [Date.UTC(2027, 4, 30, 18, 0, 0), Date.UTC(2027, 5, 6, 18, 0, 0), Date.UTC(2027, 5, 13, 18, 0, 0)];
  sundays.forEach((time, i) => {
    const files: Record<string, Version> = {};
    for (const [rel, id] of Object.entries(FILES)) {
      const text = t(id);
      files[path(t, `${SHARE}/${rel}`)] = { content: text, size: new TextEncoder().encode(text).length, modified: time - 86_400_000 };
    }
    addSnapshot(repo, { id: hex(`snapshot-game-library-${i}`), time, host: 'games', paths: [path(t, SHARE)], files });
  });
  repo.checked = true;
  return repo;
}

// The expected content of each restored file.
const expected = (j: Game) => Object.fromEntries(Object.entries(FILES).map(([rel, id]) => [path(j.t, `${SHARE}/${rel}`), j.t(id)]));

const sd = (j: Game) => systemd(j)!;
const process = (j: Game): Process[] => j.state.process ?? [];
const activeEncryptor = (j: Game) => process(j).some((p) => p.command.startsWith(path(j.t, ENCRYPTOR)));
// The front desk's account (accueil in French).
const frontdesk = (t: Game['t']) => account(t, 'frontdesk');
// The encryptor's option, in the language (--silencieux in French).
const quiet = (t: Game['t']) => t('ransom-option-quiet');
const persistence = (j: Game) => (j.state.crontabs?.[frontdesk(j.t)] ?? '').includes(name(j.t, 'system-update'));
const locked = (j: Game) => (j.state.lockedAccounts ?? []).includes(frontdesk(j.t));
const mountedKey = (j: Game) => (j.state.mounts ?? []).some((m: { name: string }) => m.name === USB);

// All the files under a place (absolute paths).
function all(j: Game, place: string): string[] {
  const n = j.find(place);
  if (n?.type !== 'directory') return [];
  return Object.entries(n.children).flatMap(([name, e]) => (e.type === 'directory' ? all(j, `${place}/${name}`) : [`${place}/${name}`]));
}
const remains = (j: Game) => all(j, path(j.t, SHARE)).filter((c) => c.endsWith('.locked') || c.endsWith(`/${name(j.t, NOTE)}`));
const restored = (j: Game) => Object.entries(expected(j)).filter(([c, text]) => j.read(c) === text).length;
const allRestored = (j: Game) => restored(j) === Object.keys(FILES).length;

/**
 * The encryptor at work: each clear file of the share that the frontdesk
 * account can modify becomes unreadable, renamed to .locked, with a ransom
 * note in its folder. Returns the number of files hit.
 */
function encrypt(j: Game, place: string): number {
  const n = j.find(place);
  const intruder = frontdesk(j.t);
  if (n?.type !== 'directory' || !j.can(n, 'w', intruder)) return 0;
  const note = name(j.t, NOTE);
  let touches = 0;
  for (const [name, e] of Object.entries(n.children)) {
    if (e.type === 'directory') touches += encrypt(j, `${place}/${name}`);
    else if (!name.endsWith('.locked') && name !== note && e.link === undefined) {
      delete n.children[name];
      n.children[`${name}.locked`] = {
        type: 'file',
        content: unreadable(`${place}/${name}`),
        lines: true,
        owner: intruder,
        group: account(j.t, 'gamelib'),
        mode: 'rw-rw-r--',
      };
      touches++;
    }
  }
  if (touches && !n.children[note]) n.children[note] = { type: 'file', content: j.t('ransom-note'), owner: intruder, group: account(j.t, 'gamelib') };
  return touches;
}

export const ransom: Chapter = {
  id: 'ransom',
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
    'find',
    'wc',
    'du',
    'df',
    'diff',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'touch',
    'id',
    'whoami',
    'ps',
    'kill',
    'crontab',
    'usermod',
    'journalctl',
    'systemctl',
    'lsblk',
    'mount',
    'umount',
    'restic',
    'sudo',
    'nano',
  ],
  home: M,
  welcome: 'message_from_berenice.txt',
  names: true,
  final: 'end',
  password: 'dice-2027',
  accounts,
  state: (t) => {
    const tree = d({ [name(t, 'repo')]: d({}, undefined, { owner: 'root' }) }, undefined, { owner: 'root', mode: 'rwxr-xr-x' });
    const usb: Device = {
      disk: '/dev/sdb',
      majmin: [8, 17],
      removable: true,
      size: 32 * Go,
      system: 'exfat',
      label: t('ransom-usb-label'),
      uuid: '6A1C-3F2E',
      tree,
    };
    return {
      systemd: newSystemd('games', Date.UTC(2027, 5, 1, 7, 0, 0), Date.UTC(2027, 5, 21, 8, 45, 0), {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
      }),
      process: [
        { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
        { pid: 611, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
        { pid: 640, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
        { pid: 3141, user: frontdesk(t), cpu: 97.3, mem: 1.4, command: `${path(t, ENCRYPTOR)} ${quiet(t)}` },
      ],
      crontabs: {
        root: `# ${t('ransom-crontab-root')}\n30 2 * * * rsync -a --delete ${path(t, SHARE)}/ ${path(t, `${NAS}/share`)}/`,
        [frontdesk(t)]: `*/10 * * * * ${path(t, ENCRYPTOR)} ${quiet(t)}\n@reboot ${path(t, ENCRYPTOR)} ${quiet(t)}`,
      },
      mounts: [
        { path: '/', capacity: 40 * Go, name: '/dev/vda1', system: 'ext4' },
        {
          path: NAS,
          capacity: 2000 * Go,
          name: `//nas.${machineName(t, 'games')}.internal${path(t, '/backups')}`,
          system: 'cifs',
          options: 'relatime,vers=3.1.1,uid=0,file_mode=0777,dir_mode=0777',
        },
      ],
      devices: { [USB]: usb },
      restic: { [path(t, REPO)]: usbRepo(t) },
      resticClock: Date.UTC(2027, 5, 21, 9, 0, 0),
    };
  },
  initialise: (j) => {
    const game = j as Shell;
    // The restic repository's files, on the USB disk (mounted while they are written).
    const place = j.find(path(j.t, KEY)) as Directory;
    const tree = (j.state.devices[USB] as Device).tree;
    const cache = place.children;
    place.children = tree.children;
    writeRepo(game, path(j.t, REPO), j.state.restic[path(j.t, REPO)]);
    place.children = cache;
    // The night: successful login on frontdesk after several attempts, then the encryption.
    const s = sd(j);
    const now = s.clock;
    const intruder = frontdesk(j.t);
    s.clock = Date.UTC(2027, 5, 21, 3, 11, 0);
    for (const n of [1, 2, 3])
      writeLog(s, 'ssh.service', 'sshd', 4100 + n, `Failed password for ${intruder} from 203.0.113.66 port ${51200 + n * 7} ssh2`, 6);
    writeLog(s, 'ssh.service', 'sshd', 4104, `Accepted password for ${intruder} from 203.0.113.66 port 51240 ssh2`);
    s.clock = Date.UTC(2027, 5, 21, 3, 14, 0);
    writeLog(s, 'cron.service', 'CRON', 3140, `(${intruder}) CMD (${path(j.t, ENCRYPTOR)} ${quiet(j.t)})`);
    s.clock = now;
    // What the encryptor has already done, and what rsync copied to the NAS last night.
    encrypt(j, path(j.t, SHARE));
    const nas = j.find(path(j.t, `${NAS}/share`));
    const share = j.find(path(j.t, SHARE));
    if (nas?.type === 'directory' && share?.type === 'directory') nas.children = structuredClone(share.children);
  },
  // While it runs, the encryptor comes back over the files; while its crontab exists, it returns.
  afterCommand: (j) => {
    const messages: string[] = [];
    if (activeEncryptor(j)) {
      const touches = encrypt(j, path(j.t, SHARE));
      if (touches) j.state.reencrypted = (j.state.reencrypted ?? 0) + touches;
    } else if (persistence(j)) {
      j.state.waiting = (j.state.waiting ?? 0) + 1;
      if (j.state.waiting >= 4) {
        j.state.waiting = 0;
        const pid = 3141 + (j.state.returns = (j.state.returns ?? 0) + 1) * 7;
        process(j).push({ pid, user: frontdesk(j.t), cpu: 97.3, mem: 1.4, command: `${path(j.t, ENCRYPTOR)} ${quiet(j.t)}` });
        writeLog(sd(j), 'cron.service', 'CRON', pid - 1, `(${frontdesk(j.t)}) CMD (${path(j.t, ENCRYPTOR)} ${quiet(j.t)})`);
        encrypt(j, path(j.t, SHARE));
        messages.push(j.t('ransom-return'));
      }
    }
    return messages.join('\n\n') || undefined;
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const gamelib = (owner: string): Rights => ({ owner, group: 'gamelib', mode: 'rw-rw-r--' });
    const share: Record<string, Node> = {};
    for (const [rel, id] of Object.entries(FILES)) {
      const [directory, name] = rel.includes('/') ? rel.split('/') : ['', rel];
      const target = directory
        ? ((share[directory] ??= place({}, { owner: 'berenice', group: 'gamelib', mode: 'rwxrwxr-x' })) as Directory).children
        : share;
      target[name] = file(t(id), gamelib(directory ? 'berenice' : 'frontdesk'));
    }
    return place({
      etc: place({ ...accountsFiles(), hostname: file('games') }),
      home: place({
        you: d({ 'message_from_berenice.txt': f(t('ransom-message-berenice')) }),
        frontdesk: place(
          {
            '.cache': place(
              {
                '.upd': place(
                  { 'system-update': f(unreadable('binary'), { owner: 'frontdesk', mode: 'rwxr-xr-x', size: 2_481_336 }) },
                  { owner: 'frontdesk' },
                ),
              },
              { owner: 'frontdesk' },
            ),
          },
          { owner: 'frontdesk', mode: 'rwxr-x---' },
        ),
        berenice: place({}, { owner: 'berenice', mode: 'rwx------' }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      srv: place({ share: place(share, { owner: 'root', group: 'gamelib', mode: 'rwxrwxr-x' }) }),
      mnt: place({
        // The NAS share, mounted permanently: everyone can write to it.
        nas: place({ share: place({}, { owner: 'root', mode: 'rwxrwxrwx' }) }, { owner: 'root', mode: 'rwxrwxrwx' }),
        usb: place({}),
      }),
    });
  },
  events: [
    {
      id: 'extent',
      condition: (j) => /\.locked/.test(j.last.output) && !j.last.commands.some((c) => c.includes(NAS) || c.some((a) => a.startsWith(NAS))),
      message: (j) => j.t('ransom-event-extent'),
    },
    {
      id: 'encryptor-seen',
      condition: (j) => j.last.output.includes(name(j.t, 'system-update')) && j.last.commands.some((c) => c[0] === 'ps') && activeEncryptor(j),
      message: (j) => j.t('ransom-event-encryptor-seen'),
    },
    {
      id: 'nas',
      condition: (j) => j.last.commands.some((c) => c.some((a) => a.startsWith(NAS))) && /\.locked/.test(j.last.output),
      message: (j) => j.t('ransom-event-nas'),
    },
    { id: 'reencrypted', condition: (j) => (j.state.reencrypted ?? 0) > 0, message: (j) => j.t('ransom-event-reencrypted') },
    { id: 'key-too-early', condition: (j) => mountedKey(j) && activeEncryptor(j), message: (j) => j.t('ransom-event-key-too-early') },
    { id: 'restored', condition: (j) => allRestored(j) && !activeEncryptor(j), message: (j) => j.t('ransom-event-restored') },
    {
      id: 'end',
      condition: (j) => !activeEncryptor(j) && !persistence(j) && locked(j) && allRestored(j) && remains(j).length === 0 && !mountedKey(j),
      message: (j) => j.t('ransom-event-end'),
    },
  ],
};
