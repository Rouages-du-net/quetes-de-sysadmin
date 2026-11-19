// Story "The Pantry", chapter "The Restore Drill": a backup you haven't
// restored is a hope, not a backup. On Saturday, Fatou stages the loss of
// crate: spare, a borrowed laptop with a fresh Debian (an internal host),
// plays the new server, with the USB disk plugged in and nothing else but
// what is in Mei's envelope. You open the disk with the passphrase, mount
// it, open the repository with the escrowed password, check it down to the
// data (restic check --read-data), restore the latest snapshot beside
// (restic restore latest --target), and compare with the manifest the job
// writes (sha256sum -c SHA256SUMS). The checklist's last line asks for the
// database: it is in no snapshot (the job only backs up /srv/pantry, the
// nightly dump is in /var/backups). You fix the job on crate, and close
// the disk on spare.
// Objective checked on the state: on spare, the disk opened with a
// passphrase and the repository with Mei's key, read in full, the files
// restored outside the disk and verified, no secret of crate copied to
// spare, the disk closed; on crate, the job backs up the database's dump.
// Sources: https://restic.readthedocs.io/en/stable/050_restore.html,
// https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency,
// sha256sum: https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html

import { f, name, password, type Chapter } from '../world';
import type { Game } from '../shell';
import { storageOf } from '../storage';
import { hex, type Repo } from '../commands/restic';
import { DISK_PASSPHRASE, DUMP, M, RESTIC_RECOVERY, NIGHTLY_PASSWORD, PASSWORD, REPO, SCRIPT, filesOf, keyfileContent, pantryAccounts, pantryFiles, pantryKernel, pantryState, pantryWorld, spare, spareHost } from './pantry';

export const SPARE_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'tee', 'nano', 'mkdir', 'rm', 'df', 'diff', 'sudo', 'lsblk', 'blkid', 'findmnt', 'mount', 'umount', 'cryptsetup', 'restic', 'sha256sum', 'export', 'unset', 'exit'];

const sp = (j: Game) => spare(j);
const spState = (j: Game) => sp(j)?.state ?? {};
const spStorage = (j: Game) => {
  const s = sp(j);
  return s ? storageOf(s) : null;
};
const spRepo = (j: Game) => (spState(j).restic as Record<string, Repo> | undefined)?.[REPO];
const opened = (j: Game, kind: string) => ((spState(j).luksOpened as string[] | undefined) ?? []).some((x) => x.endsWith(`:${kind}`));
const mountedThere = (j: Game) => ((spState(j).mounts ?? []) as { name: string }[]).some((m) => m.name.startsWith('/dev/mapper/'));
const escrowUsed = (j: Game) => ((spState(j).resticKeysUsed as string[] | undefined) ?? []).includes(hex('pantry-key-escrow'));
const nightlyUsed = (j: Game) => ((spState(j).resticKeysUsed as string[] | undefined) ?? []).includes(hex('pantry-key-nightly'));
const readData = (j: Game) => !!spRepo(j)?.dataChecked;
const done = (j: Game, action: string) => ((spState(j).resticDone as string[] | undefined) ?? []).includes(action);
const families = (j: Game) => name(j.t, 'families.csv');
const restored = (j: Game) => {
  const s = sp(j);
  if (!s) return false;
  const want = pantryFiles(j.t, 'week')[families(j)];
  return filesOf(s).some(([p, c]) => p.endsWith(`/${families(j)}`) && !p.startsWith('/mnt/') && c === want);
};
const verified = (j: Game) => ((spState(j).sha256Checked as { ok: number; failed: number }[] | undefined) ?? []).some((x) => x.ok >= 3 && x.failed === 0);
const fixed = (j: Game) => /^[^#\n]*restic[^\n]*\bbackup\b[^\n]*\/var\/backups/m.test(j.read(SCRIPT) ?? '');
const copiedSecret = (j: Game) => {
  const s = sp(j);
  if (!s) return false;
  const key = keyfileContent();
  return filesOf(s).some(([p, c]) => !p.startsWith('/mnt/') && (c === key || c.includes(NIGHTLY_PASSWORD)));
};
const closedThere = (j: Game) => !!spStorage(j) && !Object.keys(spStorage(j)!.crypt ?? {}).length && !mountedThere(j);

export const restoreDrill: Chapter = {
  id: 'restore-drill',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'nano', 'sudo', 'df', 'lsblk', 'restic', 'sha256sum', 'ssh', 'scp', 'exit'],
  home: M,
  welcome: 'message_from_fatou.txt',
  names: true,
  final: 'end',
  steps: ['plugged', 'opened', 'mounted', 'snapshots', 'read-data', 'restored', 'verified', 'no-dump', 'fixed', 'closed', 'end'],
  password: PASSWORD,
  accounts: pantryAccounts,
  state: (t) => pantryState(t, 3),
  initialise: (j) => pantryKernel(j, null),
  hosts: { spare: spareHost(SPARE_COMMANDS) },
  createWorld: (t) =>
    pantryWorld(t, 3, {
      'message_from_fatou.txt': f(t('restore-drill-message-fatou', { disk: password(t, DISK_PASSPHRASE), restic: password(t, RESTIC_RECOVERY) })),
      'drill.txt': f(t('restore-drill-checklist'), { lines: true }),
    }),
  events: [
    { id: 'log', condition: (j) => j.last.output.includes('backup completed'), message: (j) => j.t('restore-drill-event-log') },
    { id: 'plugged', condition: (j) => /crypto_LUKS/.test(sp(j)?.last.output ?? ''), message: (j) => j.t('restore-drill-event-plugged') },
    { id: 'copied-secret', condition: copiedSecret, message: (j) => j.t('restore-drill-event-copied-secret') },
    { id: 'opened-key', condition: (j) => opened(j, 'keyfile'), message: (j) => j.t('restore-drill-event-opened-key') },
    { id: 'opened', condition: (j) => opened(j, 'passphrase'), message: (j) => j.t('restore-drill-event-opened') },
    { id: 'mounted', condition: mountedThere, message: (j) => j.t('restore-drill-event-mounted') },
    { id: 'nightly-key', condition: nightlyUsed, message: (j) => j.t('restore-drill-event-nightly-key') },
    { id: 'snapshots', condition: (j) => escrowUsed(j) && done(j, 'snapshots'), message: (j) => j.t('restore-drill-event-snapshots') },
    { id: 'check-only', condition: (j) => done(j, 'check') && !readData(j), message: (j) => j.t('restore-drill-event-check-only') },
    { id: 'read-data', condition: readData, message: (j) => j.t('restore-drill-event-read-data') },
    { id: 'over-root', condition: (j) => spState(j).resticRestoredTo === '', message: (j) => j.t('restore-drill-event-over-root') },
    { id: 'restored', condition: restored, message: (j) => j.t('restore-drill-event-restored') },
    {
      id: 'mismatch',
      condition: (j) => ((spState(j).sha256Checked as { failed: number }[] | undefined) ?? []).some((x) => x.failed > 0),
      message: (j) => j.t('restore-drill-event-mismatch'),
    },
    { id: 'verified', condition: verified, message: (j) => j.t('restore-drill-event-verified') },
    {
      id: 'no-dump',
      // Looked for the dump in the backups (restic find), or in what was restored: it isn't there.
      condition: (j) =>
        ((spState(j).resticFound as { pattern: string; found: boolean }[] | undefined) ?? []).some((x) => /sql|pantry|dump/i.test(x.pattern) && !x.found) ||
        (restored(j) && /\.sql|dump/.test(sp(j)?.last.line ?? '') && !!sp(j)?.last.errors.length),
      message: (j) => j.t('restore-drill-event-no-dump', { dump: DUMP }),
    },
    { id: 'fixed', condition: fixed, message: (j) => j.t('restore-drill-event-fixed') },
    { id: 'closed', condition: (j) => restored(j) && closedThere(j), message: (j) => j.t('restore-drill-event-closed') },
    {
      id: 'end',
      condition: (j) => opened(j, 'passphrase') && escrowUsed(j) && readData(j) && restored(j) && verified(j) && fixed(j) && closedThere(j) && !copiedSecret(j),
      message: (j) => j.t('restore-drill-event-end'),
    },
  ],
};
