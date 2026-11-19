// Story "The Pantry", chapter "The Spare Key": a week later, the disk is
// encrypted and Noor has moved the nightly job to restic (an encrypted,
// deduplicated repository on the disk). Mei asks the question that
// matters: "if crate burned tonight, could we read the backups with what
// is in my envelope?" No: the disk opens with her passphrase, but the
// repository's only key is the password in /root/.restic-pass, on crate
// itself. You open the disk, read the job (RESTIC_REPOSITORY,
// RESTIC_PASSWORD_FILE), list the snapshots and the keys, add a second key
// whose password Mei keeps off the machine (restic key add), check the
// repository, delete Mei's note, and close the disk before Friday.
// Objective checked on the state: the repository has a key with Mei's
// password and still the nightly job's key (a different one), it was
// checked after the new key, no file on crate holds Mei's password, and
// the disk is unmounted and closed.
// Sources: https://restic.readthedocs.io/en/stable/070_encryption.html,
// https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html,
// https://restic.readthedocs.io/en/stable/045_working_with_repos.html

import { f, name, password, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { keysOf, type Repo } from '../commands/restic';
import { M, NOW_2, PASSWORD, REPO, RESTIC_RECOVERY, devFollow, filesOf, pantryAccounts, pantryKernel, pantryState, pantryWorld, st } from './pantry';

const repo = (j: Game) => (j.state.restic as Record<string, Repo>)[REPO];
const mei = (j: Game) => password(j.t, RESTIC_RECOVERY);
const nightlyFile = (j: Game) => (j.read('/root/.restic-pass') ?? '').trim();
const meiKey = (j: Game) => keysOf(repo(j)).find((k) => k.password === mei(j));
const nightlyKey = (j: Game) => keysOf(repo(j)).find((k) => k.password === nightlyFile(j) && k !== meiKey(j));
const escrowed = (j: Game) => !!meiKey(j);
const nightlyWorks = (j: Game) => !!nightlyKey(j);
const mountedDisk = (j: Game) => ((j.state.mounts ?? []) as { name: string; path: string }[]).some((m) => m.name.startsWith('/dev/mapper/'));
const closed = (j: Game) => !Object.keys(st(j).crypt ?? {}).length && !mountedDisk(j);
const secretFiles = (j: Game) => filesOf(j).filter(([, c]) => c.includes(mei(j)));
const noteGone = (j: Game) => secretFiles(j).length === 0;
// restic check after Mei's key was added (the key list changed the repository's files).
const checkedAfter = (j: Game) => !!j.state.checkedWithEscrow;
const done = (j: Game, action: string) => ((j.state.resticDone as string[] | undefined) ?? []).includes(action);

export const spareKey: Chapter = {
  id: 'spare-key',
  number: 2,
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
    'rm',
    'stat',
    'export',
    'unset',
    'sudo',
    'df',
    'lsblk',
    'blkid',
    'findmnt',
    'mount',
    'umount',
    'cryptsetup',
    'cryptdisks_start',
    'cryptdisks_stop',
    'restic',
  ],
  home: M,
  welcome: 'message_from_fatou.txt',
  names: true,
  final: 'end',
  steps: ['opened', 'job', 'snapshots', 'one-key', 'escrowed', 'checked', 'note', 'closed', 'end'],
  password: PASSWORD,
  accounts: pantryAccounts,
  state: (t) => pantryState(t, 2),
  initialise: (j) => {
    pantryKernel(j, NOW_2 - 900_000);
    devFollow(j);
  },
  createWorld: (t) =>
    pantryWorld(t, 2, {
      'message_from_fatou.txt': f(t('spare-key-message-fatou')),
      'note_from_mei.txt': f(t('spare-key-note-mei', { password: password(t, RESTIC_RECOVERY) })),
    }),
  beforeCommand: devFollow,
  afterCommand: (j) => {
    devFollow(j);
    if (meiKey(j) && repo(j).checked) j.state.checkedWithEscrow = true;
    return undefined;
  },
  events: [
    { id: 'opened', condition: mountedDisk, message: (j) => j.t('spare-key-event-opened') },
    { id: 'job', condition: (j) => j.last.output.includes('RESTIC_PASSWORD_FILE'), message: (j) => j.t('spare-key-event-job') },
    {
      id: 'sudo-env',
      condition: (j) => j.last.errors.some((e) => e.includes('Please specify repository location')) && [...((j as unknown as { exported: Set<string> }).exported ?? [])].some((n) => n.startsWith('RESTIC_')),
      message: (j) => j.t('spare-key-event-sudo-env'),
    },
    { id: 'snapshots', condition: (j) => done(j, 'snapshots'), message: (j) => j.t('spare-key-event-snapshots') },
    { id: 'one-key', condition: (j) => done(j, 'key list'), message: (j) => j.t('spare-key-event-one-key') },
    { id: 'envelope-fails', condition: (j) => !!j.state.resticWrongPassword && !escrowed(j), message: (j) => j.t('spare-key-event-envelope-fails') },
    { id: 'init', condition: (j) => j.last.errors.some((e) => e.includes('config file already exists')), message: (j) => j.t('spare-key-event-init') },
    { id: 'remove-current', condition: (j) => !!j.state.resticRemoveCurrent, message: (j) => j.t('spare-key-event-remove-current') },
    { id: 'nightly-broken', condition: (j) => !nightlyWorks(j), message: (j) => j.t('spare-key-event-nightly-broken') },
    { id: 'escrowed', condition: (j) => escrowed(j) && nightlyWorks(j), message: (j) => j.t('spare-key-event-escrowed') },
    { id: 'checked', condition: (j) => escrowed(j) && checkedAfter(j), message: (j) => j.t('spare-key-event-checked') },
    {
      id: 'written-down',
      condition: (j) => secretFiles(j).some(([p]) => p !== `${(j as Shell).home}/${name(j.t, 'note_from_mei.txt')}`),
      message: (j) => j.t('spare-key-event-written-down'),
    },
    { id: 'note', condition: (j) => escrowed(j) && noteGone(j), message: (j) => j.t('spare-key-event-note') },
    {
      id: 'note-early',
      condition: (j) => !escrowed(j) && noteGone(j),
      action: (j) => {
        const n = j.find((j as Shell).home);
        if (n?.type === 'directory') n.children[name(j.t, 'note_from_mei.txt')] = f(j.t('spare-key-note-mei', { password: mei(j) }), { owner: j.player, group: j.player });
      },
      message: (j) => j.t('spare-key-event-note-early'),
    },
    { id: 'closed', condition: (j) => escrowed(j) && closed(j), message: (j) => j.t('spare-key-event-closed') },
    {
      id: 'end',
      condition: (j) => escrowed(j) && nightlyWorks(j) && checkedAfter(j) && noteGone(j) && closed(j),
      message: (j) => j.t('spare-key-event-end'),
    },
  ],
};

