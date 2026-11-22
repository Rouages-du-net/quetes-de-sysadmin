// The stories of Sysadmin Quests and their chapters, in order. See
// docs/SCENARIOS.md. The stories are independent; within a
// story, a chapter opens when the previous one is finished.
// Each story's chapters are in its own module (stories/<id>.ts), which the
// game loads only when the story is opened (story-registry.ts); the menu
// reads catalogue.json, generated from this list (npm run catalogue).
import type { Chapter, Story } from '../world';
import { chapters as eraser } from '../stories/eraser';
import { chapters as datacenter } from '../stories/datacenter';
import { chapters as packet } from '../stories/packet';
import { chapters as timeMachine } from '../stories/time-machine';
import { chapters as archives } from '../stories/archives';
import { chapters as letters } from '../stories/letters';
import { chapters as fablab } from '../stories/fablab';
import { chapters as gazette } from '../stories/gazette';
import { chapters as gameLibrary } from '../stories/game-library';
import { chapters as onCall } from '../stories/on-call';
import { chapters as communityCentre } from '../stories/community-centre';
import { chapters as coop } from '../stories/coop';
import { chapters as hive } from '../stories/hive';
import { chapters as audit } from '../stories/audit';
import { chapters as lab } from '../stories/lab';
import { chapters as watch } from '../stories/watch';
import { chapters as junkMail } from '../stories/junk-mail';
import { chapters as fleet } from '../stories/fleet';
import { chapters as patch } from '../stories/patch';
import { chapters as canteen } from '../stories/canteen';
import { chapters as observatory } from '../stories/observatory';
import { chapters as theatre } from '../stories/theatre';
import { chapters as huts } from '../stories/huts';
import { chapters as photoClub } from '../stories/photo-club';
import { chapters as bastion } from '../stories/bastion';
import { chapters as otherUnix } from '../stories/other-unix';
import { chapters as oldSun } from '../stories/old-sun';
import { chapters as nightBatch } from '../stories/night-batch';
import { chapters as orderBook } from '../stories/order-book';
import { chapters as mixedFleet } from '../stories/mixed-fleet';
import { chapters as musicSchool } from '../stories/music-school';
import { chapters as cardCatalogue } from '../stories/card-catalogue';
import { chapters as pantry } from '../stories/pantry';
import { chapters as ferry } from '../stories/ferry';
import { chapters as bikeShare } from '../stories/bike-share';
import { chapters as pool } from '../stories/pool';
import { chapters as staffRoom } from '../stories/staff-room';
import { chapters as airwaves } from '../stories/airwaves';
import { chapters as toolLibrary } from '../stories/tool-library';
import { chapters as healthCentre } from '../stories/health-centre';

// Stories open little by little: each one says, in `after`, the chapters
// to finish before receiving its key (see unlocking.ts and docs/SCENARIOS.md).
export const STORIES: Story[] = [
  { id: 'eraser', chapters: eraser },
  { id: 'datacenter', after: ['root'], chapters: datacenter },
  { id: 'packet', after: ['root'], chapters: packet },
  { id: 'time-machine', after: ['root'], chapters: timeMachine },
  { id: 'archives', after: ['root'], chapters: archives },
  { id: 'letters', after: ['reboot-night', 'lost-packet'], chapters: letters },
  { id: 'fablab', after: ['reboot-night'], chapters: fablab },
  { id: 'gazette', after: ['manuscript', 'reboot-night'], chapters: gazette },
  { id: 'game-library', after: ['versions'], chapters: gameLibrary },
  { id: 'on-call', after: ['reboot-night'], chapters: onCall },
  { id: 'community-centre', after: ['shut-the-door'], chapters: communityCentre },
  { id: 'coop', after: ['sharing', 'second-day'], chapters: coop },
  { id: 'hive', after: ['firewall', 'jump'], chapters: hive },
  { id: 'audit', after: ['sentinel', 'shared-rights'], chapters: audit },
  { id: 'lab', after: ['full-disk'], chapters: lab },
  { id: 'watch', after: ['follow-up'], chapters: watch },
  { id: 'junk-mail', after: ['works-for-me'], chapters: junkMail },
  { id: 'fleet', after: ['keys'], chapters: fleet },
  { id: 'patch', after: ['certificate', 'sharing'], chapters: patch },
  { id: 'canteen', after: ['reboot-night', 'probe'], chapters: canteen },
  { id: 'observatory', after: ['memory', 'boot-order'], chapters: observatory },
  { id: 'theatre', after: ['database', 'restart-loop'], chapters: theatre },
  { id: 'huts', after: ['full-disk', 'firewall'], chapters: huts },
  { id: 'photo-club', after: ['late-disk', 'shared-rights'], chapters: photoClub },
  { id: 'bastion', after: ['routine'], chapters: bastion },
  { id: 'other-unix', after: ['firewall', 'bare-repo'], chapters: otherUnix },
  { id: 'old-sun', after: ['database', 'portable-script'], chapters: oldSun },
  { id: 'night-batch', after: ['switch-over', 'probe'], chapters: nightBatch },
  { id: 'order-book', after: ['late-file', 'transfers'], chapters: orderBook },
  { id: 'mixed-fleet', after: ['samba-share', 'portable-script'], chapters: mixedFleet },
  { id: 'music-school', after: ['full-volume', 'smb-mount'], chapters: musicSchool },
  { id: 'card-catalogue', after: ['silent-backup', 'directory'], chapters: cardCatalogue },
  { id: 'pantry', after: ['snapshots', 'stuck-boot'], chapters: pantry },
  { id: 'ferry', after: ['zones', 'works-for-me'], chapters: ferry },
  { id: 'bike-share', after: ['ssh-alerts', 'heavy-load'], chapters: bikeShare },
  { id: 'pool', after: ['compose', 'blue-green'], chapters: pool },
  { id: 'staff-room', after: ['samba-share', 'full-disk'], chapters: staffRoom },
  { id: 'airwaves', after: ['padlock', 'restore-drill'], chapters: airwaves },
  { id: 'tool-library', after: ['bare-repo', 'eradication'], chapters: toolLibrary },
  { id: 'health-centre', after: ['more-room', 'dhcp'], chapters: healthCentre },
];

// All chapters, across all stories (unique identifiers).
export const CHAPTERS: Chapter[] = STORIES.flatMap((h) => h.chapters);
