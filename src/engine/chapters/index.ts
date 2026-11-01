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
];

// All chapters, across all stories (unique identifiers).
export const CHAPTERS: Chapter[] = STORIES.flatMap((h) => h.chapters);
