// Story "The Bastion" — chapter "Eradication": 10:30. The miner is
// stopped and cut off, deploy is closed. But the intruder left ways back,
// and changed something. Remove them, one by one, without breaking what is
// legitimate:
//   - deploy's crontab: an @reboot line relaunches the watchdog; the line
//     above it (sync-orders, every quarter of an hour) is Selma's and must
//     stay (crontab -r would take it too);
//   - deploy's authorized_keys: a second key, with a comment that looks
//     legitimate (deploy@ci-runner); only the fingerprint Selma gives tells
//     them apart (ssh-keygen -lf);
//   - /tmp/.cache: the miner and its watchdog (the game has no rm -r: two rm);
//   - /srv/delivery/server.js: changed at 02:43 that night (find -mtime,
//     or the history): one line added at the end relaunches the watchdog
//     each time the app starts. Restore it from Selma's signed release, after
//     checking the signature (gpg --verify): the copy in deploy's home was
//     rebuilt by the intruder (BAD signature), the one in /srv/releases is
//     good.
// Objective checked on the state: no @reboot line and sync-orders kept,
// the intruder's key removed and Selma's kept, /tmp/.cache gone,
// server.js identical to the release, the app running and nothing
// relaunched.
// Sources: https://man7.org/linux/man-pages/man5/crontab.5.html,
// https://man.openbsd.org/ssh-keygen, https://man7.org/linux/man-pages/man1/find.1.html,
// https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html,
// https://csrc.nist.gov/pubs/sp/800/61/r2/final (eradication and recovery)

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import {
  DEPLOY_KEYS, M, MINER_PATH, PASSWORD, REBOOT_LINE, SERVER, SERVER_JS, SYNC_LINE, WATCHDOG_PATH, appAlive, bastionAccounts, bastionState, bastionWorld, containedIptables,
  deployKeys, selmaFingerprint, initialiseBastion, intruderProcs,
} from './bastion';

const lines = (text: string | null) => (text ?? '').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
const crontab = (j: Game) => lines((j.state.crontabs as Record<string, string> | undefined)?.deploy ?? null);
const body = (key: string) => key.split(' ')[1];
const keys = (j: Game) => lines(j.read(DEPLOY_KEYS));
const hasKey = (j: Game, key: string) => keys(j).some((l) => l.split(/\s+/).includes(body(key)));

const cronClean = (j: Game) => !crontab(j).some((l) => l.includes(WATCHDOG_PATH));
const cronKept = (j: Game) => crontab(j).some((l) => l.includes('/srv/delivery/bin/sync-orders'));
const keyGone = (j: Game) => !hasKey(j, deployKeys().intruder);
const selmaKept = (j: Game) => hasKey(j, deployKeys().selma);
const filesGone = (j: Game) => !j.exists(MINER_PATH) && !j.exists(WATCHDOG_PATH);
const restored = (j: Game) => (j.read(SERVER) ?? '').trim() === SERVER_JS.trim();
const done = (j: Game) => cronClean(j) && cronKept(j) && keyGone(j) && selmaKept(j) && filesGone(j) && restored(j) && appAlive(j) && !intruderProcs(j).length;

export const eradication: Chapter = {
  id: 'eradication',
  number: 3,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'nano', 'sudo', 'id', 'whoami', 'ps', 'pgrep', 'kill', 'crontab',
    'ssh-keygen', 'rm', 'cp', 'mv', 'diff', 'tar', 'gpg', 'systemctl', 'journalctl',
  ],
  home: M,
  welcome: 'email_selma.txt',
  names: true,
  final: 'end',
  steps: ['cron', 'key', 'files', 'verified', 'restored', 'end'],
  password: PASSWORD,
  accounts: () => {
    const c = bastionAccounts();
    c.users.deploy.expires = '1970-01-02';
    return c;
  },
  state: (t) => bastionState(t, { miner: false, iptables: containedIptables() }),
  initialise: initialiseBastion,
  createWorld: (t) =>
    bastionWorld(t, {
      home: { 'email_selma.txt': f(t('eradication-email-selma', { fingerprint: selmaFingerprint() })), 'incident.md': f(t('eradication-incident'), { lines: true }) },
    }),
  events: [
    { id: 'cron-all', condition: (j) => !cronKept(j), message: (j) => j.t('eradication-event-cron-all', { line: SYNC_LINE }) },
    { id: 'cron', condition: (j) => cronClean(j) && cronKept(j), message: (j) => j.t('eradication-event-cron', { line: REBOOT_LINE }) },
    { id: 'key-all', condition: (j) => !selmaKept(j), message: (j) => j.t('eradication-event-key-all') },
    { id: 'key', condition: (j) => keyGone(j) && selmaKept(j), message: (j) => j.t('eradication-event-key') },
    { id: 'files', condition: filesGone, message: (j) => j.t('eradication-event-files') },
    { id: 'bad-signature', condition: (j) => j.last.output.includes('BAD signature'), message: (j) => j.t('eradication-event-bad-signature') },
    { id: 'verified', condition: (j) => j.last.output.includes('Good signature'), message: (j) => j.t('eradication-event-verified') },
    { id: 'restored', condition: restored, message: (j) => j.t('eradication-event-restored') },
    { id: 'relaunched', condition: (j) => !!j.state.relaunched, message: (j) => j.t('eradication-event-relaunched') },
    { id: 'end', condition: done, message: (j) => j.t('eradication-event-end') },
  ],
};
