// Story "The Zine Library", chapter "A Profile of Our Own": Hinewai's
// nightly backup script runs as root, and in February someone added /etc
// to its SOURCES: /etc/shadow ended up in an archive on the volunteers'
// shared USB key. The board wants the script confined: whatever its
// configuration says, it may read the scans and the catalogue, write its
// archive, and nothing else.
// The way: a profile (aa-autodep, or written by hand) in complain mode, a
// run to observe (auditd is installed: the ALLOWED lines go to
// /var/log/audit/audit.log), the lines read (aa-logprof, or by hand: the
// directories, the catalogue's capability dac_read_search, tar and gzip as
// ix), then enforce mode, and a run that works; /etc/shadow is refused.
// A new profile attaches at the next exec: the script is a new process on
// each run, nothing to restart.
// Objective checked on the state: the profile that attaches to
// /usr/local/sbin/zine-backup loaded in enforce mode, in enforce mode in
// its file too, reaching nothing a backup never needs (/etc/shadow, root's
// and your SSH keys, /etc/sudoers, writing /etc/passwd or cron.d, tar
// unconfined), and the last run confined by it, successful, with the scans
// and the catalogue archived.
// False leads: enforcing before observing (the run fails: DENIED lines), a
// profile like /** rwix (or tar as ux), complain mode left on, a profile
// that doesn't attach to the script's path.
// Sources: aa-autodep(8), aa-logprof(8), aa-genprof(8), aa-complain(8),
// aa-enforce(8), apparmor.d(5), https://wiki.debian.org/AppArmor/HowToUse
// (auditd for the profile tools).

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { apparmor, modeOf } from '../apparmor';
import { HOME, PASSWORD, goodRun, initialiseZines, passTime, scriptFile, scriptProfile, seen, story, tooWide, zineAccounts, zineState, zineWorld } from './zine-library';

const runs = (j: Game) => story(j).runs;
/** A run refused by a profile in enforce mode. */
const tooEarly = (j: Game) => runs(j).some((r) => r.mode === 'enforce' && r.denied.length > 0 && !r.denied.every((d) => d === '/etc/shadow'));
const observed = (j: Game) => runs(j).some((r) => r.mode === 'complain');
/** The profile on disk has learnt more than aa-autodep's start. */
const rules = (j: Game) => {
  const f = scriptFile(j);
  return !!f && f.profile.files.some((r) => r.re.test('/srv/scans/riso-dreams-04.pdf') || r.re.test('/srv/scans/')) && f.profile.files.some((r) => r.exec && r.re.test('/usr/bin/tar'));
};
const enforced = (j: Game) => scriptProfile(j)?.mode === 'enforce';
/** A profile whose name speaks of the script is loaded, but the script still ran unconfined. */
const notAttached = (j: Game) => {
  const last = runs(j).at(-1);
  return !!last && last.label === null && !scriptProfile(j) && Object.keys(apparmor(j).profiles).some((n) => n.includes('zine-backup'));
};
const shadowDenied = (j: Game) => runs(j).some((r) => r.mode === 'enforce' && r.shadowTried && r.denied.includes('/etc/shadow'));

export const backupProfile: Chapter = {
  id: 'backup-profile',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'diff', 'sudo', 'systemctl', 'journalctl', 'ps', 'tar', 'aa-status', 'apparmor_parser', 'aa-enforce', 'aa-complain', 'aa-disable', 'aa-autodep', 'aa-logprof', 'aa-genprof', 'exit'],
  home: HOME,
  welcome: 'message_from_hinewai.txt',
  names: true,
  final: 'end',
  steps: ['script', 'profile-file', 'observed', 'rules', 'enforced', 'end'],
  password: PASSWORD,
  accounts: zineAccounts,
  state: (t) => zineState(t, 2),
  initialise: (j) => initialiseZines(j, 2),
  createWorld: (t) =>
    zineWorld(t, 2, {
      'message_from_hinewai.txt': f(t('backup-profile-message-hinewai')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'script', condition: (j) => seen(j, 'tar -czf "$DEST/zine-$STAMP.tar.gz" $SOURCES') || seen(j, 'SOURCES="'), message: (j) => j.t('backup-profile-event-script') },
    { id: 'profile-file', condition: (j) => !!scriptFile(j), message: (j) => j.t('backup-profile-event-profile-file') },
    { id: 'too-early', condition: tooEarly, message: (j) => j.t('backup-profile-event-too-early') },
    { id: 'not-attached', condition: notAttached, message: (j) => j.t('backup-profile-event-not-attached') },
    { id: 'observed', condition: observed, message: (j) => j.t('backup-profile-event-observed') },
    { id: 'too-wide', condition: (j) => !!tooWide(j), message: (j) => j.t('backup-profile-event-too-wide', { path: tooWide(j) ?? '' }) },
    { id: 'rules', condition: rules, message: (j) => j.t('backup-profile-event-rules') },
    { id: 'enforced', condition: enforced, message: (j) => j.t('backup-profile-event-enforced') },
    { id: 'shadow', condition: shadowDenied, message: (j) => j.t('backup-profile-event-shadow') },
    {
      id: 'end',
      condition: (j) => {
        const p = scriptProfile(j);
        const file = scriptFile(j);
        return !!p && p.mode === 'enforce' && !tooWide(j) && !!file && modeOf(file.profile) === 'enforce' && goodRun(runs(j).at(-1), p.name);
      },
      message: (j) => j.t('backup-profile-event-end'),
    },
  ],
};
