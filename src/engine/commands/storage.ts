// Les disques d'un serveur : smartctl (smartmontools) pour leur santé,
// mdadm pour le RAID logiciel, sfdisk pour les tables de partitions,
// grub-install pour la zone de démarrage, et lsblk quand la machine a un
// modèle de stockage (voir stockage.ts). Sorties et messages d'après
// smartctl(8) (smartmontools 7.4), mdadm(8) (mdadm 4.3, Manage.c),
// sfdisk(8) (util-linux 2.40) et grub-install(8) (GRUB 2.12) :
// https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in,
// https://man7.org/linux/man-pages/man8/mdadm.8.html,
// https://man7.org/linux/man-pages/man8/sfdisk.8.html,
// https://www.gnu.org/software/grub/manual/grub/html_node/Installing-GRUB-using-grub_002dinstall.html
// Écarts : voir le tableau de docs/SCENARIOS.md (smartctl, mdadm, sfdisk).

import type { Shell } from '../shell';
import type { Command } from './index';
import { help } from './manual';
import { systemd } from '../systemd';
import { sizeFor, lvSize } from '../lvm';
import { systemFor } from '../fstab';
import {
  active,
  advance,
  degraded,
  busyDisk,
  inRebuild,
  GUID_TYPE,
  arrayFor,
  devUpdate,
  majmin,
  TYPE_NAME,
  freeNumber,
  partitionFor,
  freePlace,
  rebuiltInThisMoment,
  SECTOR,
  stockage,
  binarySize,
  shortSize,
  decimalSize,
  type Disk,
  type Array,
  type Partition,
  type Stockage,
  type TypePartition,
} from '../storage';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');
/** « Sat Nov 13 07:42:10 2027 », comme ctime(3). */
const dateC = (ms: number) => {
  const d = new Date(ms);
  return `${DAYS[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
};
const now = (game: Shell) => systemd(game)?.clock ?? Date.UTC(2027, 10, 13, 7, 42, 0);
const withoutDev = (name: string) => name.replace(/^\/dev\//, '');

// ——— smartctl ———

const SMART_HEADER = 'smartctl 7.4 2023-08-01 r5530 [x86_64-linux-6.12.48+deb13-amd64] (local build)\nCopyright (C) 2002-23, Bruce Allen, Christian Franke, www.smartmontools.org';

function informations(game: Shell, d: Disk): string {
  const bytes = d.sectors * SECTOR;
  return [
    '=== START OF INFORMATION SECTION ===',
    `Device Model:     ${d.template}`,
    `Serial Number:    ${d.serial}`,
    `Firmware Version: LB07`,
    `User Capacity:    ${bytes.toLocaleString('en-US')} bytes [${(bytes / 1e12).toFixed(2)} TB]`,
    'Sector Sizes:     512 bytes logical, 4096 bytes physical',
    'Rotation Rate:    7200 rpm',
    'Form Factor:      3.5 inches',
    'Device is:        Not in smartctl database 7.3/5528',
    'ATA Version is:   ACS-3 T13/2161-D revision 5',
    'SATA Version is:  SATA 3.3, 6.0 Gb/s (current: 6.0 Gb/s)',
    `Local Time is:    ${dateC(now(game))} UTC`,
    'SMART support is: Available - device has SMART capability.',
    'SMART support is: Enabled',
  ].join('\n');
}

function attributes(d: Disk): string {
  const s = d.smart;
  // VALUE baisse quand les secteurs réalloués s'accumulent ; sous THRESH, l'attribut « échoue ».
  const realloc = Math.max(1, 200 - Math.ceil(s.reallocated / 26));
  const line = (id: number, name: string, flag: string, value: number, worst: number, threshold: number, type: string, update: string, raw: number | string) =>
    `${String(id).padStart(3)} ${name.padEnd(23)} ${flag}   ${String(value).padStart(3, '0')}   ${String(worst).padStart(3, '0')}   ${String(threshold).padStart(3, '0')}    ${type.padEnd(9)} ${update.padEnd(8)} ${value <= threshold && threshold > 0 ? 'FAILING_NOW' : '    -      '} ${raw}`;
  return [
    'SMART Attributes Data Structure revision number: 16',
    'Vendor Specific SMART Attributes with Thresholds:',
    'ID# ATTRIBUTE_NAME          FLAG     VALUE WORST THRESH TYPE      UPDATED  WHEN_FAILED RAW_VALUE',
    line(1, 'Raw_Read_Error_Rate', '0x002f', s.inWaiting ? 191 : 200, s.inWaiting ? 186 : 200, 51, 'Pre-fail', 'Always', s.ataErrors * 59),
    line(3, 'Spin_Up_Time', '0x0027', 176, 174, 21, 'Pre-fail', 'Always', 4183),
    line(4, 'Start_Stop_Count', '0x0032', 100, 100, 0, 'Old_age', 'Always', 74),
    line(5, 'Reallocated_Sector_Ct', '0x0033', realloc, realloc, 140, 'Pre-fail', 'Always', s.reallocated),
    line(9, 'Power_On_Hours', '0x0032', Math.max(0, 100 - Math.floor(s.hours / 876)), Math.max(0, 100 - Math.floor(s.hours / 876)), 0, 'Old_age', 'Always', s.hours),
    line(12, 'Power_Cycle_Count', '0x0032', 100, 100, 0, 'Old_age', 'Always', 71),
    line(194, 'Temperature_Celsius', '0x0022', 113 - s.temperature + 34, 104, 0, 'Old_age', 'Always', s.temperature),
    line(196, 'Reallocated_Event_Count', '0x0032', s.reallocated ? 128 : 200, s.reallocated ? 128 : 200, 0, 'Old_age', 'Always', Math.ceil(s.reallocated / 16)),
    line(197, 'Current_Pending_Sector', '0x0032', 200, 200, 0, 'Old_age', 'Always', s.inWaiting),
    line(198, 'Offline_Uncorrectable', '0x0030', s.unreadable ? 200 : 100, 253, 0, 'Old_age', 'Offline', s.unreadable),
    line(199, 'UDMA_CRC_Error_Count', '0x0032', 200, 200, 0, 'Old_age', 'Always', s.crc),
  ].join('\n');
}

function errorsLog(d: Disk): string {
  const s = d.smart;
  if (!s.ataErrors) return 'SMART Error Log Version: 1\nNo Errors Logged';
  return [
    'SMART Error Log Version: 1',
    `ATA Error Count: ${s.ataErrors} (device log contains only the most recent five errors)`,
    '\tCR = Command Register [HEX]',
    '\tER = Error register [HEX]',
    '\tST = Status register [HEX]',
    '',
    `Error ${s.ataErrors} occurred at disk power-on lifetime: ${s.hours - 2} hours (${Math.floor((s.hours - 2) / 24)} days + ${(s.hours - 2) % 24} hours)`,
    '  When the command that caused the error occurred, the device was active or idle.',
    '',
    '  After command completion occurred, registers were:',
    '  ER ST SC SN CL CH DH',
    '  -- -- -- -- -- -- --',
    '  40 51 00 87 d6 12 e0  Error: UNC at LBA = 0x0012d687 = 1234567',
  ].join('\n');
}

function testsLog(d: Disk, tests: { type: string; hours: number }[]): string {
  const s = d.smart;
  const lines = [
    'SMART Self-test log structure revision number 1',
    'Num  Test_Description    Status                  Remaining  LifeTime(hours)  LBA_of_first_error',
  ];
  const all = [...tests].reverse().concat([{ type: 'Short offline', hours: s.hours - 168 }]);
  all.forEach((t, i) => {
    const failure = s.inWaiting > 0 && i === 0 && tests.length > 0;
    const status = failure ? 'Completed: read failure       90%' : 'Completed without error       00%';
    lines.push(`# ${String(i + 1).padEnd(2)} ${t.type.padEnd(19)} ${status}     ${String(t.hours).padStart(5)}         ${failure ? '1234567' : '-'}`);
  });
  return lines.join('\n');
}

const verdict = (d: Disk) => `SMART overall-health self-assessment test result: ${d.smart.failure ? 'FAILED!' : 'PASSED'}`;

function smartctl(game: Shell, args: string[]): string {
  const options = args.filter((a) => a.startsWith('-'));
  const target = args.filter((a, i) => !a.startsWith('-') && !['-t', '-l', '--test', '--log'].includes(args[i - 1])).at(-1);
  const value = (short: string, long: string) => {
    const i = args.findIndex((a) => a === short || a === long);
    return i >= 0 ? args[i + 1] : args.find((a) => a.startsWith(`${long}=`))?.split('=')[1];
  };
  const known = ['-a', '--all', '-x', '--xall', '-H', '--health', '-i', '--info', '-A', '--attributes', '-l', '--log', '-t', '--test', '-h', '--help'];
  const unknown = options.find((o) => !known.includes(o.split('=')[0]));
  if (unknown)
    return game.error(`${SMART_HEADER}\n\n=======> UNRECOGNIZED OPTION: ${unknown.replace(/^-+/, '')}\n=======> VALID ARGUMENTS ARE: help\n\nUse smartctl -h to get a usage summary`, 1);
  if (args.includes('-h') || args.includes('--help')) return help('smartctl', STOCKAGE.smartctl, game.t);
  if (!target) return game.error(`${SMART_HEADER}\n\nERROR: smartctl requires a device name as the final command-line argument.\n\n\nUse smartctl -h to get a usage summary`, 1);
  const st = stockage(game);
  const name = withoutDev(target).replace(/\d+$/, '');
  const d = st?.disks[name];
  if (game.who !== 'root') return game.error(`${SMART_HEADER}\n\nSmartctl open device: ${target} failed: Permission denied`, 2);
  if (!st || !d || !target.startsWith('/dev/')) return game.error(`${SMART_HEADER}\n\nSmartctl open device: ${target} failed: No such device`, 2);
  const tests: { type: string; hours: number }[] = (game.state.testsSmart ??= {})[name] ?? [];
  const test = value('-t', '--test');
  if (test) {
    if (!['short', 'long'].includes(test))
      return game.error(`${SMART_HEADER}\n\n=======> INVALID ARGUMENT TO -t: ${test}\n=======> VALID ARGUMENTS ARE: offline, short, long, conveyance, force, vendor,N, select,M-N, pending,N, afterselect,[on|off]\n\nUse smartctl -h to get a usage summary`, 1);
    const short = test === 'short';
    (game.state.testsSmart[name] = tests).push({ type: short ? 'Short offline' : 'Extended offline', hours: d.smart.hours });
    const testName = short ? 'Short' : 'Extended';
    const duration = short ? 2 : 254;
    return [
      SMART_HEADER,
      '',
      '=== START OF OFFLINE IMMEDIATE AND SELF-TEST SECTION ===',
      `Sending command: "Execute SMART ${testName} self-test routine immediately in off-line mode".`,
      `Drive command "Execute SMART ${testName} self-test routine immediately in off-line mode" successful.`,
      'Testing has begun.',
      `Please wait ${duration} minutes for test to complete.`,
      `Test will complete after ${dateC(now(game) + duration * 60_000)} UTC`,
      'Use smartctl -X to abort test.',
    ].join('\n');
  }
  // Le code de retour de smartctl est un masque : 64, le journal d'erreurs n'est pas vide ; 128, un test a échoué.
  const codes = (d.smart.ataErrors ? 64 : 0) | (d.smart.inWaiting && tests.length ? 128 : 0) | (d.smart.failure ? 8 : 0);
  const log = value('-l', '--log');
  const parts: string[] = [SMART_HEADER, ''];
  const all = options.some((o) => ['-a', '--all', '-x', '--xall'].includes(o));
  if (all || options.some((o) => o === '-i' || o === '--info')) parts.push(informations(game, d), '');
  if (all || options.some((o) => ['-H', '--health', '-A', '--attributes'].includes(o))) parts.push('=== START OF READ SMART DATA SECTION ===');
  if (all || options.some((o) => o === '-H' || o === '--health')) parts.push(verdict(d), '');
  if (all || options.some((o) => o === '-A' || o === '--attributes')) parts.push(attributes(d), '');
  if (all || log === 'error') parts.push(errorsLog(d), '');
  if (all || log === 'selftest') parts.push(testsLog(d, tests), '');
  if (log && !['error', 'selftest'].includes(log))
    return game.error(`${SMART_HEADER}\n\n=======> INVALID ARGUMENT TO -l: ${log}\n=======> VALID ARGUMENTS ARE: error, selftest, selective, directory, background, scttemp, ...\n\nUse smartctl -h to get a usage summary`, 1);
  if (parts.length === 2) parts.push('=== START OF INFORMATION SECTION ===\nSMART support is: Available - device has SMART capability.', '');
  game.status = codes;
  return parts.join('\n').trimEnd();
}

// ——— mdadm ———

const arrayName = (st: Stockage, target: string) => {
  const n = withoutDev(target).replace(/^md\//, 'md');
  return st.arrays[n] ? n : null;
};
const memberLine = (st: Stockage, number: number | string, part: string, role: number | string, state: string) => {
  const [update, min] = part ? majmin(st, part) : [0, 0];
  return `${String(number).padStart(8)}${String(update).padStart(8)}${String(min).padStart(9)}${String(role).padStart(9)}      ${state}${part ? `   /dev/${part}` : ''}`;
};

function detail(game: Shell, st: Stockage, name: string): string {
  const g = st.arrays[name];
  const bytes = g.blocks * 1024;
  const recons = inRebuild(g);
  const inCourse = rebuiltInThisMoment(st) === name;
  const states = ['clean'];
  if (degraded(g)) states.push('degraded');
  if (recons.length) states.push(inCourse ? 'recovering' : 'resyncing (DELAYED)');
  if (g.synchro !== undefined) states.push(inCourse ? 'resyncing' : 'resyncing (DELAYED)');
  const faulty = g.members.filter((m) => m.state === 'defectueux');
  const rows: string[] = [];
  for (let r = 0; r < g.wanted; r++) {
    const m = g.members.find((x) => x.role === r && x.state !== 'defectueux');
    if (!m) rows.push(memberLine(st, '-', '', r, 'removed'));
    else rows.push(memberLine(st, m.number, m.part, r, m.state === 'actif' ? 'active sync' : 'spare rebuilding'));
  }
  for (const m of g.members.filter((x) => x.state === 'spare')) rows.push(memberLine(st, m.number, m.part, '-', 'spare'));
  for (const m of faulty) rows.push(memberLine(st, m.number, m.part, '-', 'faulty'));
  return [
    `/dev/${name}:`,
    '           Version : 1.2',
    `     Creation Time : ${dateC(g.creation)}`,
    `        Raid Level : ${g.level}`,
    `        Array Size : ${g.blocks} (${binarySize(bytes)} ${decimalSize(bytes)})`,
    `     Used Dev Size : ${g.blocks} (${binarySize(bytes)} ${decimalSize(bytes)})`,
    `      Raid Devices : ${g.wanted}`,
    `     Total Devices : ${g.members.length}`,
    '       Persistence : Superblock is persistent',
    '',
    ...(g.bitmap ? ['     Intent Bitmap : Internal', ''] : []),
    `       Update Time : ${dateC(now(game))}`,
    `             State : ${states.join(', ')} `,
    `    Active Devices : ${active(g).length}`,
    `   Working Devices : ${g.members.length - faulty.length}`,
    `    Failed Devices : ${faulty.length}`,
    `     Spare Devices : ${recons.length + g.members.filter((x) => x.state === 'spare').length}`,
    '',
    `Consistency Policy : ${g.bitmap ? 'bitmap' : 'resync'}`,
    '',
    ...(recons.length && inCourse ? [`    Rebuild Status : ${Math.floor((recons[0].copyOf ?? 0) * 100)}% complete`, ''] : []),
    ...(g.synchro !== undefined && inCourse ? [`     Resync Status : ${Math.floor(g.synchro * 100)}% complete`, ''] : []),
    `              Name : ${g.name}  (local to host ${systemd(game)?.host ?? game.host})`,
    `              UUID : ${g.uuid}`,
    `            Events : ${g.events}`,
    '',
    '    Number   Major   Minor   RaidDevice State',
    ...rows,
  ].join('\n');
}

export const uuidMdadm = (uuid: string) => uuid.replace(/-/g, '').replace(/(.{8})(?=.)/g, '$1:');

function manage(game: Shell, st: Stockage, name: string, ops: [string, string[]][]): string {
  const g = st.arrays[name];
  const outputs: string[] = [];
  const md = `/dev/${name}`;
  for (const [op, targets] of ops) {
    for (const target of targets) {
      const part = withoutDev(target);
      const m = g.members.find((x) => x.part === part);
      if (op === 'fail') {
        if (!m) {
          game.error(`mdadm: set device faulty failed for ${target}:  No such device`);
          continue;
        }
        // RAID 1 : le noyau refuse de marquer défectueux le dernier membre à jour.
        if (m.state === 'actif' && active(g).length === 1) {
          game.error(`mdadm: set device faulty failed for ${target}:  Device or resource busy`);
          continue;
        }
        m.state = 'defectueux';
        delete m.copyOf;
        g.events += 1;
        outputs.push(`mdadm: set ${target} faulty in ${md}`);
      } else if (op === 'remove') {
        const targeted = target === 'failed' ? g.members.filter((x) => x.state === 'defectueux') : m ? [m] : [];
        if (!targeted.length) {
          if (target !== 'failed') game.error(`mdadm: hot remove failed for ${target}: No such device or address`);
          continue;
        }
        for (const v of targeted) {
          // On ne retire qu'un membre défectueux (ou un spare) : un membre actif est occupé.
          if (v.state === 'actif') {
            game.error(`mdadm: hot remove failed for /dev/${v.part}: Device or resource busy`);
            continue;
          }
          g.members = g.members.filter((x) => x !== v);
          g.events += 1;
          outputs.push(`mdadm: hot removed /dev/${v.part} from ${md}`);
        }
      } else {
        // add, re-add : la partition (ou le disque) doit exister, être libre, et assez grande.
        const disk = /^sd[a-z]$/.test(part) ? st.disks[part] : undefined;
        const p = partitionFor(st, part);
        if (!disk && !p) {
          game.error(`mdadm: Cannot find ${target}: No such file or directory`);
          continue;
        }
        if (arrayFor(st, part) || st.lvm?.pvs[part] || (disk && busyDisk(st, part)) || (p && arrayFor(st, p.disk))) {
          game.error(`mdadm: Cannot open ${target}: Device or resource busy`);
          continue;
        }
        const sectors = disk ? disk.sectors : p!.p.sectors;
        if (sectors / 2 < g.blocks) {
          game.error(`mdadm: ${target} not large enough to join array`);
          continue;
        }
        const old = (game.state.anciensMembres ??= {})[`${name}:${part}`] as number | undefined;
        if (op === 're-add' && old === undefined) {
          game.error(`mdadm: --re-add for ${target} to ${md} is not possible`);
          continue;
        }
        // Le disque entier dans la grappe : son superbloc md écrase la table de partitions.
        if (disk) {
          disk.partitions = [];
          disk.table = null;
        }
        // Une place libre (grappe dégradée) : il la reprend en se reconstruisant ; sinon, il attend en spare.
        const place = freePlace(g);
        g.members.push({
          part,
          number: freeNumber(g),
          role: place,
          state: place === null ? 'spare' : 'reconstruction',
          ...(place === null ? {} : { copyOf: 0 }),
          ...(op === 're-add' ? { fast: true } : {}),
        });
        g.events += 1;
        outputs.push(`mdadm: ${op === 're-add' ? 're-added' : 'added'} ${target}`);
      }
    }
    // On garde la trace des anciens membres (pour --re-add).
    for (const x of g.members) (game.state.anciensMembres ??= {})[`${name}:${x.part}`] = x.number;
  }
  devUpdate(game);
  return outputs.join('\n');
}

const OPERATIONS: Record<string, string> = {
  '--fail': 'fail',
  '-f': 'fail',
  '--set-faulty': 'fail',
  '--remove': 'remove',
  '-r': 'remove',
  '--add': 'add',
  '-a': 'add',
  '--re-add': 're-add',
};

function mdadm(game: Shell, args: string[]): string {
  if (!args.length) return game.error('Usage: mdadm --help\n  for help', 2);
  if (args.includes('--help') || args.includes('-h')) return help('mdadm', STOCKAGE.mdadm, game.t);
  const st = stockage(game);
  if (args[0] === '--create' || args[0] === '-C') return create(game, st, args.slice(1));
  const detailMode = args.includes('--detail') || args.includes('-D');
  if (detailMode) {
    if (args.includes('--scan') || args.includes('-s')) {
      if (game.who !== 'root') return game.error('mdadm: must be super-user to perform this action', 1);
      return Object.entries(st?.arrays ?? {})
        .sort(([, a], [, b]) => a.rank - b.rank)
        .map(([n, g]) => `ARRAY /dev/md/${n.slice(2)} metadata=1.2 name=${g.name} UUID=${uuidMdadm(g.uuid)}`)
        .join('\n');
    }
    const targets = args.filter((a) => !a.startsWith('-'));
    if (!targets.length) return game.error('mdadm: No devices given.', 1);
    // --brief : une ligne ARRAY par grappe, celle de mdadm.conf.
    const short = args.includes('--brief') || args.includes('-b');
    const outputs: string[] = [];
    for (const c of targets) {
      if (game.who !== 'root') {
        game.error(`mdadm: cannot open ${c}: Permission denied`, 1);
        continue;
      }
      const n = st ? arrayName(st, c) : null;
      if (!n) {
        game.error(partitionFor(st ?? { disks: {}, arrays: {}, grub: [] }, c) || /^\/dev\/sd[a-z]$/.test(c) ? `mdadm: ${c} does not appear to be an md device` : `mdadm: cannot open ${c}: No such file or directory`, 1);
        continue;
      }
      const g = st!.arrays[n];
      outputs.push(short ? `ARRAY /dev/${n} metadata=1.2 name=${g.name} UUID=${uuidMdadm(g.uuid)}` : detail(game, st!, n));
    }
    return outputs.join('\n');
  }
  // Le mode « manage » : mdadm [--manage] /dev/mdX --fail dev … --remove dev … --add dev …
  const rest = args.filter((a) => a !== '--manage');
  const unknown = rest.find((a) => a.startsWith('-') && !(a in OPERATIONS));
  if (unknown) return game.error(`mdadm: unrecognised option ${unknown}\nUsage: mdadm --help\n  for help`, 2);
  const target = rest[0];
  if (!target || target.startsWith('-')) return game.error('mdadm: an md device must be given in this mode', 2);
  if (game.who !== 'root') return game.error('mdadm: must be super-user to perform this action', 1);
  const n = st ? arrayName(st, target) : null;
  if (!n) return game.error(`mdadm: error opening ${target}: No such file or directory`, 1);
  const ops: [string, string[]][] = [];
  for (const a of rest.slice(1)) {
    if (a in OPERATIONS) ops.push([OPERATIONS[a], []]);
    else if (ops.length) ops.at(-1)![1].push(a);
    else return game.error(`mdadm: ${a} only meaningful with -r or -f, not -a`, 2);
  }
  if (!ops.length || ops.some(([, c]) => !c.length)) return game.error('mdadm: no devices given for ' + target, 2);
  return manage(game, st!, n, ops);
}

// mdadm --create : une grappe RAID 1 neuve, sur des disques ou des partitions libres.
function create(game: Shell, st: Stockage | null, args: string[]): string {
  let level = '';
  let count = 0;
  let withoutQuestion = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = (short: string, long: string) => (a === short || a === long ? args[++i] : a.startsWith(`${long}=`) ? a.slice(long.length + 1) : a.startsWith(short) && a.length > short.length ? a.slice(short.length) : null);
    const l = value('-l', '--level');
    const n = value('-n', '--raid-devices');
    if (l !== null) level = l ?? '';
    else if (n !== null) count = Number(n);
    else if (a === '--run' || a === '-R') withoutQuestion = true;
    else if (a.startsWith('--metadata=') || a.startsWith('-e')) continue;
    else if (a.startsWith('-')) return game.error(`mdadm: unrecognised option ${a}\nUsage: mdadm --help\n  for help`, 2);
    else positional.push(a);
  }
  const [md, ...members] = positional;
  if (!md) return game.error('mdadm: an md device must be given in this mode', 2);
  if (game.who !== 'root') return game.error('mdadm: must be super-user to perform this action', 1);
  const name = withoutDev(md).replace(/^md\//, 'md');
  if (!st || !/^md\d+$/.test(name)) return game.error(`mdadm: ${md} is an invalid name for an md device.  Try /dev/md/${name.replace(/\D/g, '') || '0'}`, 1);
  if (st.arrays[name]) return game.error(`mdadm: ${md} is already in use.`, 1);
  if (!level) return game.error('mdadm: a RAID level is needed to create an array.', 2);
  if (!['1', 'raid1', 'mirror'].includes(level)) return game.error(game.t('mdadm-niveau', { niveau: level }), 2);
  if (!count) return game.error('mdadm: no raid-devices specified.', 2);
  if (members.length > count) return game.error(`mdadm: You have listed more devices (${members.length}) than are in the array(${count})!`, 2);
  if (members.length < count) return game.error("mdadm: You haven't given enough devices (real or missing) to create this array", 2);
  const warnings: string[] = [];
  // « missing » : une place laissée vide (la grappe naît dégradée, on la complétera avec --add).
  const presents = members.filter((m) => m !== 'missing');
  if (!presents.length) return game.error('mdadm: at least one device must be given', 2);
  for (const m of presents) {
    const n = withoutDev(m);
    const disk = st.disks[n];
    const p = partitionFor(st, n);
    if (!m.startsWith('/dev/') || (!disk && !p)) return game.error(`mdadm: cannot open ${m}: No such file or directory`, 1);
    if (arrayFor(st, n) || st.lvm?.pvs[n] || (disk && busyDisk(st, n)) || (p && (arrayFor(st, p.disk) || st.lvm?.pvs[p.disk])))
      return game.error(`mdadm: cannot open ${m}: Device or resource busy`, 1);
    if (disk?.table) warnings.push(`mdadm: partition table exists on ${m} but will be lost or\n       meaningless after creating array`);
  }
  const sizes = presents.map((m) => {
    const n = withoutDev(m);
    return st.disks[n] ? st.disks[n].sectors : partitionFor(st, n)!.p.sectors;
  });
  const run = () => {
    // La taille utile : celle du plus petit membre, moins la place du superbloc (128 Mio en tête).
    const blocks = Math.floor((Math.min(...sizes) * SECTOR - 134_217_728) / 1024 / 64) * 64;
    const rank = Number(name.slice(2));
    for (const m of presents) {
      const d = st.disks[withoutDev(m)];
      if (d) {
        d.partitions = [];
        d.table = null;
      }
    }
    st.arrays[name] = {
      level: 'raid1',
      wanted: count,
      blocks,
      uuid: (() => {
        const h = [1, 2, 3, 4].map((k) => condenser(`${name}-${members.join()}-${k}`)).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
      })(),
      name: `${systemd(game)?.host ?? game.host}:${rank}`,
      members: members.flatMap((m, i) => (m === 'missing' ? [] : [{ part: withoutDev(m), number: i, role: i, state: 'actif' as const }])),
      events: 0,
      creation: now(game),
      bitmap: blocks * 1024 > 100e9,
      // Une grappe complète synchronise ses membres ; une grappe dégradée n'a rien à synchroniser.
      ...(presents.length === count && count > 1 ? { synchro: 0 } : {}),
      rank,
    };
    devUpdate(game);
    return 'mdadm: Defaulting to version 1.2 metadata\nmdadm: array ' + md + ' started.';
  };
  const note = [
    ...warnings,
    'mdadm: Note: this array has metadata at the start and',
    '    may not be suitable as a boot device.  If you plan to',
    "    store '/boot' on this device please ensure that",
    '    your boot-loader understands md/v1.x metadata, or use',
    '    --metadata=0.90',
  ].join('\n');
  if (withoutQuestion) return `${note}\n${run()}`;
  game.ask('Continue creating array? ', (response) => (/^y(es)?$/i.test(response) ? run() : game.error('mdadm: create aborted.', 1)));
  return note;
}

// Huit chiffres hexadécimaux tirés d'un texte (FNV-1a) : un UUID qui ne change jamais.
const condenser = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};

// ——— sfdisk ———

const diskHeader = (name: string, d: Disk) => {
  const bytes = d.sectors * SECTOR;
  return [
    `Disk /dev/${name}: ${binarySize(bytes)}, ${bytes} bytes, ${d.sectors} sectors`,
    `Disk model: ${d.template}`,
    'Units: sectors of 1 * 512 = 512 bytes',
    'Sector size (logical/physical): 512 bytes / 4096 bytes',
    'I/O size (minimum/optimal): 4096 bytes / 4096 bytes',
  ];
};

function listing(name: string, d: Disk): string {
  const lines = diskHeader(name, d);
  if (!d.table) return lines.join('\n');
  lines.push('Disklabel type: gpt', `Disk identifier: ${d.table}`, '');
  const width = Math.max(6, ...d.partitions.map((p) => `/dev/${name}${p.number}`.length));
  lines.push(`${'Device'.padEnd(width)}${'Start'.padStart(10)}${'End'.padStart(11)}${'Sectors'.padStart(11)}${'Size'.padStart(6)} Type`);
  for (const p of d.partitions)
    lines.push(
      `${`/dev/${name}${p.number}`.padEnd(width)}${String(p.start).padStart(10)}${String(p.start + p.sectors - 1).padStart(11)}${String(p.sectors).padStart(11)}${shortSize(p.sectors * SECTOR).padStart(6)} ${TYPE_NAME[p.type]}`,
    );
  return lines.join('\n');
}

function flush(name: string, d: Disk): string {
  return [
    'label: gpt',
    `label-id: ${d.table}`,
    `device: /dev/${name}`,
    'unit: sectors',
    'first-lba: 2048',
    `last-lba: ${d.sectors - 34}`,
    'sector-size: 512',
    '',
    ...d.partitions.map(
      (p) => `/dev/${name}${p.number} : start=${String(p.start).padStart(12)}, size=${String(p.sectors).padStart(12)}, type=${GUID_TYPE[p.type]}, uuid=${p.uuid}`,
    ),
  ].join('\n');
}

/** Lit un script sfdisk (celui de sfdisk -d) : la table et ses partitions. */
function readScript(text: string): { table: string | null; partitions: Omit<Partition, 'number'>[]; numbers: number[] } | string {
  let table: string | null = null;
  const partitions: Omit<Partition, 'number'>[] = [];
  const numbers: number[] = [];
  const types = Object.fromEntries(Object.entries(GUID_TYPE).map(([k, v]) => [v, k as TypePartition]));
  for (const rawValue of text.split('\n')) {
    const l = rawValue.trim();
    if (!l || l.startsWith('#')) continue;
    const header = /^([a-z-]+):\s*(.*)$/.exec(l);
    if (header) {
      if (header[1] === 'label' && header[2] !== 'gpt') return `unsupported label '${header[2]}'`;
      if (header[1] === 'label-id') table = header[2];
      continue;
    }
    const m = /^(\S+)\s*:\s*(.*)$/.exec(l);
    if (!m) return `script header: unknown line '${l}'`;
    const fields = Object.fromEntries(
      m[2].split(',').map((x) => {
        const [k, ...v] = x.split('=');
        return [k.trim(), v.join('=').trim()];
      }),
    );
    const type = types[(fields.type ?? '').toUpperCase()];
    if (!fields.start || !fields.size || !type) return `failed to parse script line '${l}'`;
    numbers.push(Number(/(\d+)$/.exec(m[1])?.[1] ?? partitions.length + 1));
    partitions.push({ start: Number(fields.start), sectors: Number(fields.size), type, uuid: fields.uuid ?? '' });
  }
  return { table, partitions, numbers };
}

function sfdisk(game: Shell, args: string[], input: string | null): string {
  if (args.includes('-h') || args.includes('--help')) return help('sfdisk', STOCKAGE.sfdisk, game.t);
  const unknown = args.find((a) => a.startsWith('-') && !['-d', '--dump', '-l', '--list'].includes(a));
  if (unknown)
    return game.error(
      unknown.startsWith('--') ? `sfdisk: unrecognized option '${unknown}'\nTry 'sfdisk --help' for more information.` : `sfdisk: invalid option -- '${unknown.slice(1, 2)}'\nTry 'sfdisk --help' for more information.`,
      1,
    );
  const st = stockage(game);
  const targets = args.filter((a) => !a.startsWith('-'));
  const disk = (c: string) => (st && /^\/dev\/sd[a-z]$/.test(c) ? st.disks[withoutDev(c)] : undefined);
  const open = (c: string): Disk | null => {
    if (game.who !== 'root') return game.error(`sfdisk: cannot open ${c}: Permission denied`, 1), null;
    const d = disk(c);
    if (!d) return game.error(`sfdisk: cannot open ${c}: No such file or directory`, 1), null;
    return d;
  };
  if (args.includes('-l') || args.includes('--list')) {
    const names = targets.length ? targets : Object.keys(st?.disks ?? {}).map((n) => `/dev/${n}`);
    return names
      .map((c) => {
        const d = open(c);
        return d ? listing(withoutDev(c), d) : null;
      })
      .filter((x): x is string => x !== null)
      .join('\n\n');
  }
  if (args.includes('-d') || args.includes('--dump')) {
    if (!targets.length) return game.error('sfdisk: no disk device specified', 1);
    const d = open(targets[0]);
    if (!d) return '';
    if (!d.table) return game.error(`sfdisk: ${targets[0]}: does not contain a recognized partition table`, 1);
    return flush(withoutDev(targets[0]), d);
  }
  // Écrire une table : le script arrive sur l'entrée standard.
  if (!targets.length) return game.error('sfdisk: no disk device specified', 1);
  const name = withoutDev(targets[0]);
  const d = open(targets[0]);
  if (!d) return '';
  if (input === null) return game.error(game.t('sfdisk-interactif'), 1);
  const header = ['Checking that no-one is using this disk right now ... FAILED', ''];
  if (busyDisk(st!, name))
    return game.error(
      [
        ...header,
        'This disk is currently in use - repartitioning is probably a bad idea.',
        'Umount all file systems, and swapoff all swap partitions on this disk.',
        'Use the --no-reread flag to suppress this check.',
        '',
        'sfdisk: Use the --force flag to overrule all checks.',
      ].join('\n'),
      1,
    );
  const script = readScript(input);
  if (typeof script === 'string') return game.error(`sfdisk: ${script}`, 1);
  if (!script.partitions.length) return game.error('sfdisk: no partitions defined', 1);
  const end = Math.max(...script.partitions.map((p) => p.start + p.sectors));
  if (end > d.sectors - 33) return game.error(`sfdisk: failed to add #${script.partitions.length} partition: Numerical result out of range\nLeaving.`, 1);
  const before = diskHeader(name, d);
  d.table = script.table ?? 'E2A7C1D4-5B3F-4A8E-9C6D-1F0B2A3C4D5E';
  d.partitions = script.partitions.map((p, i) => ({ ...p, number: script.numbers[i] }));
  devUpdate(game);
  return [
    'Checking that no-one is using this disk right now ... OK',
    '',
    ...before,
    '',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    `>>> Created a new GPT disklabel (GUID: ${d.table}).`,
    ...d.partitions.map((p) => `/dev/${name}${p.number}: Created a new partition ${p.number} of type '${TYPE_NAME[p.type]}' and of size ${binarySize(p.sectors * SECTOR)}.`),
    `/dev/${name}${d.partitions.length + 1}: Done.`,
    '',
    'New situation:',
    listing(name, d).split('\n').slice(5).join('\n'),
    '',
    'The partition table has been altered.',
    'Calling ioctl() to re-read partition table.',
    'Syncing disks.',
  ].join('\n');
}

// ——— grub-install ———

function grubInstall(game: Shell, args: string[]): string {
  if (args.includes('-h') || args.includes('--help')) return help('grub-install', STOCKAGE['grub-install'], game.t);
  const target = args.find((a) => !a.startsWith('-'));
  if (game.who !== 'root') return game.error('grub-install: error: failed to get canonical path of `/boot/grub/i386-pc\'.', 1);
  if (!target) return game.error('grub-install: error: install device isn\'t specified.', 1);
  const st = stockage(game);
  const name = withoutDev(target);
  if (st && partitionFor(st, name)) return game.error(`grub-install: error: unable to identify a filesystem in ${target}; safety check can't be performed.`, 1);
  const d = st?.disks[name];
  if (!d || !target.startsWith('/dev/')) return game.error(`grub-install: error: cannot find a GRUB drive for ${target}.  Check your device.map.`, 1);
  // Sur une table GPT, GRUB (en mode BIOS) s'installe dans la partition « BIOS boot ».
  if (!d.partitions.some((p) => p.type === 'bios'))
    return game.error(
      `Installing for i386-pc platform.\ngrub-install: warning: this GPT partition label contains no BIOS Boot Partition; embedding won't be possible.\ngrub-install: error: embedding is not possible, but this is required for cross-disk install.`,
      1,
    );
  if (!st!.grub.includes(name)) st!.grub.push(name);
  return 'Installing for i386-pc platform.\nInstallation finished. No error reported.';
}

// ——— lsblk, sur une machine qui a un modèle de stockage ———

interface LsblkLine {
  name: string;
  prefix: string;
  type: 'disk' | 'part' | 'raid1' | 'lvm';
  bytes: number;
  majmin: [number, number];
  point: string;
  template: string;
  serial: string;
  fstype: string;
  uuid: string;
  label?: string;
  removable?: boolean;
}

export function lsblkStockage(game: Shell, st: Stockage, args: string[]): string {
  const mounts: { path: string; name: string; system?: string }[] = game.state.montages ?? [];
  const point = (n: string) => mounts.find((m) => m.name === `/dev/${n}`)?.path ?? '';
  const withoutChildren = args.some((a) => /^-\w*d/.test(a) || a === '--nodeps');
  const lines: LsblkLine[] = [];
  const pvs = st.lvm?.pvs ?? {};
  // Les volumes logiques qui ont un morceau sur ce PV (vg-lv).
  const lvsOn = (pv: string) =>
    Object.entries(st.lvm?.vgs ?? {}).flatMap(([vg, g]) => Object.entries(g.lvs).filter(([, lv]) => lv.segments.some((x) => x.pv === pv)).map(([n]) => `${vg}-${n}`));
  // Ce qui est posé sur un périphérique : sa grappe, ses volumes logiques, ou ses partitions.
  const children = (n: string): string[] => {
    const g = arrayFor(st, n);
    if (g) return [g[0]];
    if (pvs[n]) return lvsOn(n);
    return st.disks[n]?.partitions.map((p) => `${n}${p.number}`) ?? [];
  };
  const lineFor = (n: string, prefix: string): LsblkLine => {
    const sysf = systemFor(st, `/dev/${n}`) ?? systemFor(st, `/dev/mapper/${n}`);
    const fs = arrayFor(st, n) ? ['linux_raid_member', arrayFor(st, n)![1].uuid] : pvs[n] ? ['LVM2_member', pvs[n].uuid] : sysf ? [sysf.type, sysf.uuid] : null;
    const d = st.disks[n];
    const g = st.arrays[n];
    const lv = /^([\w.+]+)-([\w.+]+)$/.exec(n);
    const vol = lv && !d && !g ? st.lvm?.vgs[lv[1]]?.lvs[lv[2]] : undefined;
    const mounted = mounts.find((m) => m.name === (vol ? `/dev/mapper/${n}` : `/dev/${n}`));
    return {
      name: n,
      prefix,
      type: d ? 'disk' : g ? 'raid1' : vol ? 'lvm' : 'part',
      bytes: vol ? lvSize(vol) : (sizeFor(st, n) ?? 0),
      majmin: vol ? [253, vol.minor] : majmin(st, n),
      point: mounted?.path ?? '',
      template: d?.template ?? '',
      serial: d?.serial ?? '',
      fstype: fs ? fs[0] : vol || mounted ? (mounted?.system ?? 'ext4') : '',
      uuid: fs ? fs[1] : '',
      label: sysf?.label ?? (arrayFor(st, n) ? arrayFor(st, n)![1].name : ''),
      removable: !!st.disks[n.replace(/\d+$/, '')]?.removable,
    };
  };
  const put = (n: string, before: string, last: boolean, root: boolean) => {
    lines.push(lineFor(n, root ? '' : `${before}${last ? '└─' : '├─'}`));
    if (withoutChildren) return;
    const next = root ? '' : `${before}${last ? '  ' : '│ '}`;
    const listing = children(n);
    listing.forEach((e, i) => put(e, next, i === listing.length - 1, false));
  };
  for (const [n] of Object.entries(st.disks).sort(([, a], [, b]) => a.rank - b.rank)) put(n, '', true, true);
  // Les colonnes : -o liste, -f les systèmes de fichiers, sinon celles par défaut.
  const iO = args.findIndex((a) => a === '-o' || a === '--output');
  const requested = iO >= 0 ? (args[iO + 1] ?? '').toUpperCase().split(',').filter(Boolean) : args.some((a) => /^-\w*f/.test(a)) ? ['NAME', 'FSTYPE', 'LABEL', 'UUID', 'MOUNTPOINTS'] : ['NAME', 'MAJ:MIN', 'RM', 'SIZE', 'RO', 'TYPE', 'MOUNTPOINTS'];
  const columns: Record<string, { right?: boolean; value: (l: LsblkLine) => string }> = {
    NAME: { value: (l) => l.prefix + l.name },
    'MAJ:MIN': { value: (l) => `${String(l.majmin[0]).padStart(3)}:${String(l.majmin[1]).padEnd(3)}` },
    RM: { right: true, value: (l) => (l.removable ? '1' : '0') },
    SIZE: { right: true, value: (l) => shortSize(l.bytes) },
    RO: { right: true, value: () => '0' },
    TYPE: { value: (l) => l.type },
    MOUNTPOINT: { value: (l) => l.point },
    MOUNTPOINTS: { value: (l) => l.point },
    MODEL: { value: (l) => l.template },
    SERIAL: { value: (l) => l.serial },
    FSTYPE: { value: (l) => l.fstype },
    UUID: { value: (l) => l.uuid },
    LABEL: { value: (l) => l.label ?? '' },
  };
  const unknown = requested.find((c) => !columns[c]);
  if (unknown) return game.error(`lsblk: unknown column: ${unknown}`, 1);
  const widths = requested.map((c) => Math.max(c.length, ...lines.map((l) => [...columns[c].value(l)].length)));
  const cell = (c: string, text: string, i: number, last: boolean) => {
    if (last) return text;
    const missing = widths[i] - [...text].length;
    return columns[c].right ? ' '.repeat(missing) + text : text + ' '.repeat(missing);
  };
  const line = (values: string[]) => values.map((v, i) => cell(requested[i], v, i, i === values.length - 1)).join(' ').trimEnd();
  return [line(requested), ...lines.map((l) => line(requested.map((c) => columns[c].value(l))))].join('\n');
}

export const STOCKAGE: Record<string, Command> = {
  smartctl: { section: 8, ownOptions: true, launch: ({ args, game }) => smartctl(game, args) },
  mdadm: { section: 8, ownOptions: true, launch: ({ args, game }) => mdadm(game, args) },
  sfdisk: { section: 8, ownOptions: true, launch: ({ args, game, input }) => sfdisk(game, args, input) },
  'grub-install': { section: 8, ownOptions: true, launch: ({ args, game }) => grubInstall(game, args) },
};

/** Le temps passe d'une commande sur la machine : la reconstruction avance. */
export function timeWhoPass(game: Shell): void {
  const st = stockage(game);
  if (st) advance(st);
}
