// The stories of Sysadmin Quests and their chapters, in order. See
// docs/SCENARIOS.md. The stories are independent; within a
// story, a chapter opens when the previous one is finished.
import type { Chapter, Story } from '../world';
import { awakening } from './lighthouse';
import { village } from './village';
import { root } from './root';
import { backup } from './backup';
import { datacenter } from './first-day';
import { secondDay } from './second-day';
import { reboot } from './reboot-night';
import { fire } from './fire';
import { certificate } from './certificate';
import { pkg } from './lost-packet';
import { time } from './manuscript';
import { archives } from './archives';
import { versions } from './versions';
import { door } from './shut-the-door';
import { firewall } from './firewall';
import { sentinel } from './sentinel';
import { colocation } from './sharing';
import { atMe } from './works-for-me';
import { concert } from './concert';
import { port } from './port';
import { repeatOffence } from './repeat-offenders';
import { update } from './update';
import { composition } from './compose';
import { bypass } from './firewall-hole';
import { powersFull } from './full-powers';
import { bareRepo } from './bare-repo';
import { rollback } from './rollback';
import { greenBlue } from './blue-green';
import { canary } from './canary';
import { migration } from './migration';
import { ransom } from './ransom';
import { chapterSnapshots } from './snapshots';
import { base } from './database';
import { fullDisk } from './full-disk';
import { chapterMemory } from './memory';
import { inodes } from './inodes';
import { clock } from './clock';
import { probe } from './probe';
import { postMortem } from './post-mortem';
import { bottleneck } from './bottleneck';
import { keys } from './keys';
import { jump } from './jump';
import { tunnel } from './tunnel';
import { transfers } from './transfers';
import { host } from './web-host';
import { departure } from './departure';
import { rights } from './shared-rights';
import { secret } from './secret';
import { proxy } from './proxy';
import { updates } from './updates';
import { automatic } from './auto-updates';
import { vlan } from './vlan';
import { dhcp } from './dhcp';
import { zones } from './zones';
import { vpn } from './remote-work';
import { dmz } from './dmz';
import { annex } from './annex';
import { chapterDirectory } from './directory';
import { wifi } from './wifi';
import { report } from './report';
import { exposure } from './exposure';
import { traces } from './traces';
import { scope } from './scope';
import { againstVisit } from './follow-up';
import { fatigue } from './tired-disk';
import { newDisk } from './new-disk';
import { grow } from './more-room';
import { rescue } from './stuck-boot';
import { bulletin } from './bulletin';
import { priority } from './priority';
import { fix } from './fix';
import { proof } from './proof';
import { routine } from './routine';
import { workshop } from './repair-cafe';
import { postman } from './postman';
import { signature } from './signature';
import { chapterPolicy } from './policy';
import { inventory } from './inventory';
import { playbook } from './playbook';
import { rehearsal } from './rehearsal';
import { padlock } from './padlock';
import { bootOrder } from './boot-order';
import { heavyLoad } from './heavy-load';
import { quota } from './quota';
import { tooManyFiles } from './too-many-files';
import { stuckProcess } from './stuck-process';
import { tooManyClients } from './too-many-clients';
import { slowQuery } from './slow-query';
import { readOnlyChapter } from './read-only';
import { failover } from './failover';
import { centralLogs } from './central-logs';
import { nfsExport } from './nfs-export';
import { nfsOwners } from './nfs-owners';
import { sambaShare } from './samba-share';
import { alarm } from './alarm';
import { containment } from './containment';
import { eradication } from './eradication';
import { hardening } from './hardening';
import { portableScript } from './portable-script';
import { rcServices } from './rc-services';
import { lastRule } from './last-rule';
import { readFirst } from './read-first';
import { byteOrder } from './byte-order';
import { switchOver } from './switch-over';
import { copybook } from './copybook';
import { returnCode } from './return-code';
import { lateFile } from './late-file';
import { inquiry } from './inquiry';
import { spooled } from './spooled';
import { saveFile } from './save-file';
import { lineEndings } from './line-endings';
import { smbMount } from './smb-mount';
import { fullVolume } from './full-volume';
import { twoLocks } from './two-locks';
import { serviceLogon } from './service-logon';
import { logFlood } from './log-flood';
import { silentBackup } from './silent-backup';
import { comingsAndGoings } from './comings-and-goings';
import { stalePassword } from './stale-password';
import { unappliedPolicy } from './unapplied-policy';
import { dormantAccounts } from './dormant-accounts';
import { lostDisk } from './lost-disk';
import { spareKey } from './spare-key';
import { restoreDrill } from './restore-drill';
import { newCard } from './new-card';
import { otherDoor } from './other-door';
import { bothWays } from './both-ways';
import { blindSpot } from './blind-spot';
import { threshold } from './threshold';
import { quietHours } from './quiet-hours';
import { wontStart } from './wont-start';
import { frontDesk } from './front-desk';
import { lockerRoom } from './locker-room';
import { deepEnd } from './deep-end';
import { journalFull } from './journal-full';
import { sshAlerts } from './ssh-alerts';
import { restartLoop } from './restart-loop';
import { slowBoot } from './slow-boot';
import { lateDisk } from './late-disk';
import { stuckQueue } from './stuck-queue';
import { newPrinter } from './new-printer';
import { paperTrail } from './paper-trail';
import { expiryDate } from './expiry-date';
import { chainOfTrust } from './chain-of-trust';
import { stolenLaptop } from './stolen-laptop';
import { whoCanPush } from './who-can-push';
import { leakyPipeline } from './leaky-pipeline';
import { signedRelease } from './signed-release';
import { coldStart } from './cold-start';
import { wrongSide } from './wrong-side';
import { tightFit } from './tight-fit';

// Stories open little by little: each one says, in `after`, the chapters
// to finish before receiving its key (see unlocking.ts and docs/SCENARIOS.md).
export const STORIES: Story[] = [
  {
    id: 'eraser',
    chapters: [awakening, village, root, backup],
  },
  {
    id: 'datacenter',
    after: ['root'],
    chapters: [datacenter, secondDay, reboot, fire, certificate],
  },
  {
    id: 'packet',
    after: ['root'],
    chapters: [pkg],
  },
  {
    id: 'time-machine',
    after: ['root'],
    chapters: [time],
  },
  {
    id: 'archives',
    after: ['root'],
    chapters: [archives, versions],
  },
  {
    id: 'letters',
    after: ['reboot-night', 'lost-packet'],
    chapters: [door, firewall, sentinel, colocation, atMe, concert, port, repeatOffence, workshop],
  },
  {
    id: 'fablab',
    after: ['reboot-night'],
    chapters: [update, composition, bypass, powersFull],
  },
  {
    id: 'gazette',
    after: ['manuscript', 'reboot-night'],
    chapters: [bareRepo, rollback, greenBlue, canary, migration],
  },
  {
    id: 'game-library',
    after: ['versions'],
    chapters: [ransom, chapterSnapshots, base],
  },
  {
    id: 'on-call',
    after: ['reboot-night'],
    chapters: [fullDisk, chapterMemory, inodes, clock, probe, postMortem, bottleneck],
  },
  {
    id: 'community-centre',
    after: ['shut-the-door'],
    chapters: [keys, jump, tunnel, transfers, host],
  },
  {
    id: 'coop',
    after: ['sharing', 'second-day'],
    chapters: [departure, rights, secret, proxy, updates, automatic],
  },
  {
    id: 'hive',
    after: ['firewall', 'jump'],
    chapters: [vlan, dhcp, zones, vpn, dmz, annex, chapterDirectory, wifi],
  },
  {
    id: 'audit',
    after: ['sentinel', 'shared-rights'],
    chapters: [scope, report, exposure, traces, againstVisit],
  },
  {
    id: 'lab',
    after: ['full-disk'],
    chapters: [fatigue, newDisk, grow, rescue],
  },
  {
    id: 'watch',
    after: ['follow-up'],
    chapters: [bulletin, priority, fix, proof, routine],
  },
  {
    id: 'junk-mail',
    after: ['works-for-me'],
    chapters: [postman, signature, chapterPolicy],
  },
  {
    id: 'fleet',
    after: ['keys'],
    chapters: [inventory, playbook, rehearsal],
  },
  {
    id: 'patch',
    after: ['certificate', 'sharing'],
    chapters: [padlock],
  },
  {
    id: 'canteen',
    after: ['reboot-night', 'probe'],
    chapters: [bootOrder, restartLoop, slowBoot, lateDisk],
  },
  {
    id: 'observatory',
    after: ['memory', 'boot-order'],
    chapters: [heavyLoad, quota, tooManyFiles, stuckProcess],
  },
  {
    id: 'theatre',
    after: ['database', 'restart-loop'],
    chapters: [tooManyClients, slowQuery, readOnlyChapter, failover],
  },
  {
    id: 'huts',
    after: ['full-disk', 'firewall'],
    chapters: [centralLogs, journalFull, sshAlerts],
  },
  {
    id: 'photo-club',
    after: ['late-disk', 'shared-rights'],
    chapters: [nfsExport, nfsOwners, sambaShare],
  },
  {
    id: 'bastion',
    after: ['routine'],
    chapters: [alarm, containment, eradication, hardening],
  },
  {
    id: 'other-unix',
    after: ['firewall', 'bare-repo'],
    chapters: [portableScript, rcServices, lastRule],
  },
  {
    id: 'old-sun',
    after: ['database', 'portable-script'],
    chapters: [readFirst, byteOrder, switchOver],
  },
  {
    id: 'night-batch',
    after: ['switch-over', 'probe'],
    chapters: [copybook, returnCode, lateFile],
  },
  {
    id: 'order-book',
    after: ['late-file', 'transfers'],
    chapters: [inquiry, spooled, saveFile],
  },
  {
    id: 'mixed-fleet',
    after: ['samba-share', 'portable-script'],
    chapters: [lineEndings, smbMount, fullVolume],
  },
  {
    id: 'music-school',
    after: ['full-volume', 'smb-mount'],
    chapters: [twoLocks, serviceLogon, logFlood, silentBackup],
  },
  {
    id: 'card-catalogue',
    after: ['silent-backup', 'directory'],
    chapters: [comingsAndGoings, stalePassword, unappliedPolicy, dormantAccounts],
  },
  {
    id: 'pantry',
    after: ['snapshots', 'stuck-boot'],
    chapters: [lostDisk, spareKey, restoreDrill],
  },
  {
    id: 'ferry',
    after: ['zones', 'works-for-me'],
    chapters: [newCard, otherDoor, bothWays],
  },
  {
    id: 'bike-share',
    after: ['ssh-alerts', 'heavy-load'],
    chapters: [blindSpot, threshold, quietHours],
  },
  {
    id: 'pool',
    after: ['compose', 'blue-green'],
    chapters: [wontStart, frontDesk, lockerRoom, deepEnd],
  },
  {
    id: 'staff-room',
    after: ['samba-share', 'full-disk'],
    chapters: [stuckQueue, newPrinter, paperTrail],
  },
  {
    id: 'airwaves',
    after: ['padlock', 'restore-drill'],
    chapters: [expiryDate, chainOfTrust, stolenLaptop],
  },
  {
    id: 'tool-library',
    after: ['bare-repo', 'eradication'],
    chapters: [whoCanPush, leakyPipeline, signedRelease],
  },
  {
    id: 'health-centre',
    after: ['more-room', 'dhcp'],
    chapters: [coldStart, wrongSide, tightFit],
  },
];

// All chapters, across all stories (unique identifiers).
export const CHAPTERS: Chapter[] = STORIES.flatMap((h) => h.chapters);
