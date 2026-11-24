// Story "The Zine Library", chapter "Denied": this afternoon Rahim moved the
// zines' scans from /var/www/zinecat/scans to /srv/scans (the new disk) and
// changed the app's config.php. Since then the catalogue answers 500 and
// the volunteers' uploads fail, although /srv/scans belongs to www-data:
// php-fpm runs under its AppArmor profile (Debian's apparmor-profiles), and
// the site's rules Bartek wrote in /etc/apparmor.d/local/php-fpm name only
// the old place. The kernel's log says so: apparmor="DENIED"
// operation="open" profile="php-fpm" name="/srv/scans/".
// The fix: the new place in the local file (or a file of
// /etc/apparmor.d/php-fpm.d), then the profile reloaded
// (apparmor_parser -r /etc/apparmor.d/php-fpm, or systemctl reload
// apparmor): a replaced profile reaches the running workers, no restart.
// Objective checked on the state: php-fpm's profile loaded in enforce mode
// and confining the workers, allowing the directory config.php names to be
// read and written; the vendor's file as shipped; the scans' directory not
// writable by everyone; the last upload went through.
// False leads: aa-disable (works, unconfined; and once re-enabled, the
// running workers stay unconfined until php-fpm restarts), aa-complain left
// on, the vendor's file edited (a conffile: the next upgrade asks or
// overwrites it), chmod 777, the local file edited but not reloaded, a
// reload of the local file itself (it holds no profile), read without write.
// Sources: apparmor.d(5) ("local/"), apparmor_parser(8) (-r),
// https://wiki.debian.org/AppArmor/HowToUse, the php-fpm profile of
// apparmor 4.1.0.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game, Shell } from '../shell';
import { permits } from '../apparmor';
import {
  HOME, PASSWORD, SCANS, disabledLink, fpm, fpmOnDisk, fpmReads, fpmServes, initialiseZines, lastUpload, passTime, seen, typed, vendorIntact, workersConfined, worldWritable, zineAccounts, zineState, zineWorld, scansDir,
} from './zine-library';

/** A rule so wide that php-fpm could read the system's secrets (/** r). */
const tooOpen = (j: Game) => {
  const p = fpm(j);
  return !!p && (permits(p, '/etc/shadow', 'r', true) || permits(p, '/root/.ssh/id_ed25519', 'r', true));
};
const writable = (j: Game) => worldWritable(j, scansDir(j as Shell)) || worldWritable(j, SCANS);
/** A rule for the new place is written (local/, php-fpm.d/ or the vendor's file) but the kernel doesn't have it. */
const notReloaded = (j: Game) => {
  const disk = fpmOnDisk(j);
  const p = fpm(j);
  return !!disk && !!p && fpmServes(j, disk) && !fpmServes(j, p);
};

export const deniedUpload: Chapter = {
  id: 'denied-upload',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'diff', 'sudo', 'systemctl', 'journalctl', 'dmesg', 'ps', 'curl', 'chmod', 'aa-status', 'apparmor_parser', 'aa-enforce', 'aa-complain', 'aa-disable', 'exit'],
  home: HOME,
  welcome: 'message_from_nomvula.txt',
  names: true,
  final: 'end',
  steps: ['denied', 'profile', 'fixed', 'end'],
  password: PASSWORD,
  accounts: zineAccounts,
  state: (t) => zineState(t, 1),
  initialise: (j) => initialiseZines(j, 1),
  createWorld: (t) =>
    zineWorld(t, 1, {
      'message_from_nomvula.txt': f(t('denied-upload-message-nomvula')),
      'notes_from_bartek.txt': f(t('denied-upload-notes-bartek')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'denied', condition: (j) => seen(j, /apparmor="DENIED"[^\n]*profile="php-fpm"/), message: (j) => j.t('denied-upload-event-denied') },
    { id: 'profile', condition: (j) => seen(j, 'include if exists <local/php-fpm>') || (seen(j, /^\s+php-fpm$/m) && seen(j, 'profiles are in enforce mode')), message: (j) => j.t('denied-upload-event-profile') },
    { id: 'disabled', condition: (j) => !fpm(j) || disabledLink(j, 'php-fpm'), message: (j) => j.t('denied-upload-event-disabled') },
    { id: 'complain', condition: (j) => fpm(j)?.mode === 'complain', message: (j) => j.t('denied-upload-event-complain') },
    { id: 'vendor', condition: (j) => !vendorIntact(j), message: (j) => j.t('denied-upload-event-vendor') },
    { id: 'chmod', condition: writable, message: (j) => j.t('denied-upload-event-chmod') },
    { id: 'parser-local', condition: (j) => /apparmor_parser/.test(typed(j)) && /local\/php-fpm/.test(typed(j)) && seen(j, 'AppArmor parser error'), message: (j) => j.t('denied-upload-event-parser-local') },
    { id: 'parser-error', condition: (j) => seen(j, 'AppArmor parser error') && !/local\/php-fpm/.test(typed(j)), message: (j) => j.t('denied-upload-event-parser-error') },
    { id: 'too-open', condition: tooOpen, message: (j) => j.t('denied-upload-event-too-open') },
    { id: 'not-reloaded', condition: notReloaded, message: (j) => j.t('denied-upload-event-not-reloaded') },
    { id: 'read-only', condition: (j) => fpmReads(j) && !fpmServes(j) && fpm(j)?.mode === 'enforce', message: (j) => j.t('denied-upload-event-read-only') },
    { id: 'unconfined', condition: (j) => fpm(j)?.mode === 'enforce' && !workersConfined(j), message: (j) => j.t('denied-upload-event-unconfined') },
    { id: 'fixed', condition: (j) => fpm(j)?.mode === 'enforce' && fpmServes(j) && workersConfined(j) && !!lastUpload(j)?.ok, message: (j) => j.t('denied-upload-event-fixed') },
    {
      id: 'end',
      condition: (j) => {
        const p = fpm(j);
        return !!p && p.mode === 'enforce' && fpmServes(j) && workersConfined(j) && vendorIntact(j) && !writable(j) && !disabledLink(j, 'php-fpm') && !!lastUpload(j)?.ok && !tooOpen(j);
      },
      message: (j) => j.t('denied-upload-event-end'),
    },
  ],
};
