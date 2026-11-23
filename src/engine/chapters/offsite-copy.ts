// Story "The Dance Troupe", chapter "The Offsite Copy": the nightly copy of
// the office share to Garage (rclone sync, office-backup.timer) has failed
// every night since the power cut of 3 April. wings' clock is three days
// behind and NTP is off: Garage refuses a request dated more than a day
// before its own clock ("InvalidRequest: Bad request: Date is too old").
// On Sunday Linh tried things: the region in /etc/rclone/office.conf is now
// us-east-1 (Garage's s3_region is "garage": AuthorizationHeaderMalformed),
// and the key office-backup lost write on the bucket ("so that nothing can
// erase the backups": AccessDenied, and Garage has no append-only right).
// Meanwhile Anahera saved a blank template over the arts council report:
// the last good copy is in the backup, and a plain `rclone sync` would
// overwrite it there.
// The fix: the clock synchronised (timedatectl set-ntp true), the region
// back to garage, read and write on backups for office-backup; the report
// restored from the backup (rclone copyto, aws s3 cp); the script made safe
// (--backup-dir on the same bucket, outside office/: what sync replaces or
// deletes is moved there), tried with --dry-run, run (the script or the
// service), and checked with rclone check.
// Objective checked on the state: the clock synchronised; the backup key
// read+write on backups only; the script's sync with a --backup-dir on
// backups, not overlapping office/; the bucket's office/ the same as the
// share (rclone's comparison: sizes and MD5s); the report's good text on
// wings; none of the new files lost; an rclone check without differences;
// no TLS check turned off.
// False leads: rclone sync in the wrong direction (the share loses its new
// files), --no-check-certificate or no_check_certificate = true (the error
// isn't TLS), a sync without --backup-dir before restoring the report (its
// last good copy overwritten).
// Sources: https://rclone.org/commands/rclone_sync/, https://rclone.org/docs/#backup-dir-dir,
// https://rclone.org/commands/rclone_check/, https://rclone.org/s3/,
// https://garagehq.deuxfleurs.fr/documentation/connect/cli/.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { anyPerm, etagOf, permOf } from '../garage';
import { readIni, type RcloneRun } from '../objects-client';
import { BACKUP_SCRIPT, HOME, NEW_FILES, OFFICE, OFFICE_FILES, PASSWORD, RCLONE_CONF, REPORT, bucket, cluster, initialiseStory, keyNamed, passTime, seen, wingsAccounts, wingsState, wingsWorld } from './dance-troupe';

const clockOk = (j: Game) => !!j.state.clockTime?.synchronised && Math.abs(j.state.clockTime.offset) < 60_000;
const backups = (j: Game) => bucket(j, 'backups');
const keyOk = (j: Game) => {
  const k = keyNamed(j, 'office-backup');
  const conf = readIni(j.read(RCLONE_CONF)).garage;
  const used = cluster(j).keys.find((x) => x.id === conf?.access_key_id);
  const b = backups(j);
  if (!used || !b || used.name === 'troupe-admin') return false;
  const p = permOf(used, b);
  void k;
  return p.read && p.write && !p.owner && cluster(j).buckets.every((x) => x === b || !anyPerm(permOf(used, x)));
};
const regionOk = (j: Game) => readIni(j.read(RCLONE_CONF)).garage?.region === 'garage';

/** The script's sync line: its --backup-dir on the backups bucket, outside office/. */
function scriptSafe(j: Game): boolean {
  const text = j.read(BACKUP_SCRIPT) ?? '';
  return text.split('\n').some((raw) => {
    const line = raw.replace(/#.*$/, '');
    if (!/\brclone\b/.test(line) || !/\bsync\b/.test(line) || !line.includes(OFFICE) || !/(\w+):backups\/office\b/.test(line)) return false;
    const m = /--backup-dir[= ]+["']?(\w+):backups\/([^\s"']+)/.exec(line);
    return !!m && !/^office(\/|$)/.test(m[2]);
  });
}
const insecureConfig = (j: Game) => /no_check_certificate\s*=\s*true/.test(j.read(RCLONE_CONF) ?? '') || /--no-check-certificate|--no-verify-ssl/.test(j.read(BACKUP_SCRIPT) ?? '');
const insecure = (j: Game) => insecureConfig(j) || ((j.state.rcloneRuns ?? []) as RcloneRun[]).some((r) => r.insecure) || /--no-verify-ssl|--no-check-certificate/.test(j.last.line ?? '');
const runsSince = (j: Game) => (j.state.troupe as { since?: number }).since ?? 0;

const good = (j: Game) => etagOf(j.t(OFFICE_FILES[REPORT]));
const local = (j: Game, rel: string) => j.read(`${OFFICE}/${rel}`);
const restored = (j: Game) => {
  const text = local(j, REPORT);
  return text !== null && etagOf(text) === good(j);
};
// The good report exists nowhere any more: not on wings, not in the bucket.
const overwritten = (j: Game) => !restored(j) && !Object.values(backups(j)?.objects ?? {}).some((o) => o.etag === good(j));
const newLost = (j: Game) => Object.entries(NEW_FILES).some(([rel, id]) => local(j, rel) === null || etagOf(local(j, rel)!) !== etagOf(j.t(id)));

/** The bucket's office/ holds what the share holds (same names, sizes, MD5s). */
function inSync(j: Game): boolean {
  const b = backups(j);
  if (!b) return false;
  const remote = Object.entries(b.objects).filter(([k]) => k.startsWith('office/'));
  const files: string[] = [];
  const walk = (path: string, rel: string) => {
    const n = j.find(path);
    if (n?.type === 'directory') for (const c of Object.keys(n.children)) walk(`${path}/${c}`, rel ? `${rel}/${c}` : c);
    else if (n?.type === 'file') files.push(rel);
  };
  walk(OFFICE, '');
  if (remote.length !== files.length) return false;
  return files.every((rel) => {
    const o = b.objects[`office/${rel}`];
    const text = local(j, rel);
    return !!o && text !== null && o.etag === etagOf(text);
  });
}
const checked = (j: Game) => ((j.state.rcloneRuns ?? []) as RcloneRun[]).some((r) => r.command === 'check' && r.ok && r.at >= runsSince(j)) && inSync(j);
const dryRun = (j: Game) => ((j.state.rcloneRuns ?? []) as RcloneRun[]).some((r) => r.command === 'sync' && r.dry && r.ok);
const wrongWay = (j: Game) => newLost(j);

export const offsiteCopy: Chapter = {
  id: 'offsite-copy',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'diff', 'nano', 'sudo', 'date', 'timedatectl', 'systemctl', 'journalctl', 'md5sum', 'garage', 'aws', 'rclone', 'exit'],
  home: HOME,
  welcome: 'message_from_linh.txt',
  names: true,
  final: 'end',
  steps: ['failing', 'clock', 'region', 'write', 'restored', 'safe', 'synced', 'checked', 'end'],
  password: PASSWORD,
  accounts: wingsAccounts,
  state: (t) => wingsState(t, 2),
  initialise: (j) => initialiseStory(j, 2),
  createWorld: (t) =>
    wingsWorld(t, 2, {
      home: { 'message_from_linh.txt': f(t('offsite-copy-message-linh')), 'message_from_anahera.txt': f(t('offsite-copy-message-anahera')), 'notes_from_teodora.txt': f(t('offsite-copy-notes-teodora')) },
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'failing', condition: (j) => seen(j, 'Bad request: Date is too old'), message: (j) => j.t('offsite-copy-event-failing') },
    { id: 'clock', condition: clockOk, message: (j) => j.t('offsite-copy-event-clock') },
    { id: 'region', condition: (j) => clockOk(j) && regionOk(j), message: (j) => j.t('offsite-copy-event-region') },
    { id: 'insecure', condition: insecure, message: (j) => j.t('offsite-copy-event-insecure') },
    { id: 'write', condition: keyOk, message: (j) => j.t('offsite-copy-event-write') },
    { id: 'wrong-way', condition: wrongWay, message: (j) => j.t('offsite-copy-event-wrong-way') },
    { id: 'overwritten', condition: overwritten, message: (j) => j.t('offsite-copy-event-overwritten') },
    { id: 'restored', condition: restored, message: (j) => j.t('offsite-copy-event-restored') },
    { id: 'safe', condition: scriptSafe, message: (j) => j.t('offsite-copy-event-safe') },
    { id: 'dry-run', condition: dryRun, message: (j) => j.t('offsite-copy-event-dry-run') },
    { id: 'synced', condition: (j) => inSync(j) && restored(j), message: (j) => j.t('offsite-copy-event-synced') },
    { id: 'checked', condition: checked, message: (j) => j.t('offsite-copy-event-checked') },
    {
      id: 'end',
      condition: (j) => clockOk(j) && regionOk(j) && keyOk(j) && scriptSafe(j) && restored(j) && !newLost(j) && inSync(j) && checked(j) && !insecureConfig(j),
      message: (j) => j.t('offsite-copy-event-end'),
    },
  ],
};
