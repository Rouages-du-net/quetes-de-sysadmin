// Story "The Health Centre", chapter "The Tight Fit": a month later, the
// whole practice complains that everything is slow, and the records
// application refuses to save. hearth swaps: its guests were given more
// memory than it has (records alone 16 GiB, for 3.4 GiB it really uses:
// the rest is page cache, which a guest happily fills). Inside records,
// the root file system is full: the medical records' exports must stay
// (retention), the disk must grow. The method: free the host's memory
// (virsh setmem records 6G --live --config: the balloon now, the
// definition for the next boot), take a snapshot before touching the
// disk, grow the image (virsh blockresize while it runs; or shut down and
// qemu-img resize), then inside the guest growpart and resize2fs, check,
// and delete the snapshot (and Ilse's forgotten one from October): a
// snapshot is not a backup, and every one of them weighs on the image.
// Objective checked on the state: no swapping, and the definitions'
// memory fits the host; records' file system bigger than 20 GiB; no
// snapshot left on records; no data lost to a shrink.
// False leads: qemu-img resize while records runs (QEMU's write lock),
// shrinking an image (refused, or with --shrink, data lost), setmem
// --config alone (nothing changes now), a size above the maximum memory.
// Sources: https://libvirt.org/manpages/virsh.html (setmem, setmaxmem,
// dommemstat, blockresize, snapshot-create-as, snapshot-delete),
// https://www.qemu.org/docs/master/tools/qemu-img.html (resize, --shrink),
// https://manpages.debian.org/trixie/cloud-guest-utils/growpart.1.en.html,
// https://man7.org/linux/man-pages/man8/resize2fs.8.html.

import type { Chapter } from '../world';
import { d, f, type Node } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { GiB, active, libvirt, swapping, topOf } from '../libvirt';
import { GUEST_COMMANDS, HOME, PASSWORD, dom, guest, guests, hearthAccounts, hearthState, hearthWorld, initialiseHearth, passTime, seen, typed } from './health-centre';

const records = (j: Game) => dom(j, 'records')!;
const virtual = (j: Game) => topOf(j, records(j))?.file?.disk?.virtual ?? 0;
const lost = (j: Game) => !!topOf(j, records(j))?.file?.disk?.lost;
const root = (j: Game) => ((guest(j, 'records')?.state.mounts ?? []) as { path: string; capacity: number; part?: number }[]).find((m) => m.path === '/');
const ORIGINAL = 20 * GiB;
const fsGrown = (j: Game) => (root(j)?.capacity ?? 0) > ORIGINAL;
const partGrown = (j: Game) => (root(j)?.part ?? 0) > ORIGINAL;
/** What the definitions give at the next boot, for the guests that start with the host, fits its RAM. */
const configFits = (j: Game) => {
  const lv = libvirt(j);
  const sum = Object.values(lv.domains).filter((d) => d.autostart || active(d)).reduce((t, d) => t + d.config.currentMemory, 0);
  return sum + lv.hostReserve + 256 * 1024 <= lv.hostMemory;
};
const ownSnapshots = (j: Game) => records(j).snapshots.filter((s) => s.name !== 'before-trixie');

export const tightFit: Chapter = {
  id: 'tight-fit',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'df', 'du', 'free', 'top', 'ps', 'vmstat', 'sudo', 'ssh', 'nano', 'systemctl', 'journalctl', 'virsh', 'qemu-img', 'exit'],
  home: HOME,
  welcome: 'message_from_grace.txt',
  names: true,
  final: 'end',
  steps: ['swap', 'memstat', 'memory-fixed', 'guest-full', 'snapshot', 'grown', 'partition', 'filesystem', 'cleaned', 'end'],
  password: PASSWORD,
  accounts: hearthAccounts,
  state: (t) => hearthState(t, 3),
  initialise: initialiseHearth,
  hosts: guests(3, { records: { commands: [...GUEST_COMMANDS, 'growpart', 'resize2fs'], full: true, files: (t) => recordsFiles(t) } }),
  createWorld: (t) => hearthWorld(t, 3, { 'message_from_grace.txt': t('tight-fit-message-grace'), 'note_from_joon.txt': t('tight-fit-note-joon') }),
  afterCommand: (j) => {
    passTime(j);
    // A snapshot taken while the disk still had its old size: the safety net is there.
    if (ownSnapshots(j).length && virtual(j) === ORIGINAL) j.state.netTaken = true;
  },
  events: [
    { id: 'swap', condition: (j) => swapping(j) && (seen(j, /^Swap:\s+\S+\s+[1-9]/m) || seen(j, /MiB Swap: .* [1-9][\d.]* used/)), message: (j) => j.t('tight-fit-event-swap') },
    { id: 'memstat', condition: (j) => /records/.test(typed(j)) && seen(j, 'disk_caches'), message: (j) => j.t('tight-fit-event-memstat') },
    { id: 'too-high', condition: (j) => seen(j, 'cannot set memory higher than max memory'), message: (j) => j.t('tight-fit-event-too-high') },
    { id: 'config-only', condition: (j) => swapping(j) && records(j).config.currentMemory < 16 * 1024 * 1024 && (records(j).live?.currentMemory ?? 0) >= 16 * 1024 * 1024, message: (j) => j.t('tight-fit-event-config-only') },
    { id: 'memory-fixed', condition: (j) => !swapping(j) && configFits(j), message: (j) => j.t('tight-fit-event-memory-fixed') },
    {
      id: 'guest-full',
      condition: (j) => {
        const s = guest(j, 'records');
        return !!s && /\/dev\/vda1\s.*100% \/$/m.test(s.last.output);
      },
      message: (j) => j.t('tight-fit-event-guest-full'),
    },
    { id: 'lock', condition: (j) => seen(j, 'Failed to get "write" lock'), message: (j) => j.t('tight-fit-event-lock') },
    { id: 'shrink-refused', condition: (j) => seen(j, 'Use the --shrink option') || seen(j, 'Shrinking images is currently not supported'), message: (j) => j.t('tight-fit-event-shrink-refused') },
    { id: 'shrunk', condition: lost, message: (j) => j.t('tight-fit-event-shrunk') },
    { id: 'snapshot', condition: (j) => !!j.state.netTaken, message: (j) => j.t('tight-fit-event-snapshot') },
    { id: 'grown', condition: (j) => virtual(j) > ORIGINAL, message: (j) => j.t(j.state.netTaken ? 'tight-fit-event-grown' : 'tight-fit-event-grown-no-net') },
    { id: 'partition', condition: partGrown, message: (j) => j.t('tight-fit-event-partition') },
    { id: 'filesystem', condition: fsGrown, message: (j) => j.t('tight-fit-event-filesystem') },
    { id: 'cleaned', condition: (j) => fsGrown(j) && !records(j).snapshots.length, message: (j) => j.t('tight-fit-event-cleaned') },
    {
      id: 'end',
      condition: (j) => !swapping(j) && configFits(j) && fsGrown(j) && !records(j).snapshots.length && !lost(j) && records(j).state === 'running',
      message: (j) => j.t('tight-fit-event-end'),
    },
  ],
};


/** records' files: the exports the law says to keep, filling the disk. */
function recordsFiles(t: Translate): Record<string, Node> {
  const big = (gib: number) => f('', { size: Math.round(gib * GiB), owner: 'root', mode: 'rw-r-----' });
  const exports: Record<string, Node> = {};
  for (const [k, month] of ['2029-11', '2029-12', '2030-01', '2030-02', '2030-03', '2030-04'].entries()) exports[`records-${month}.sql.gz`] = big(1.6 + k * 0.35);
  return {
    srv: d({ records: d({ exports: d(exports, undefined, { owner: 'root', mode: 'rwxr-x---' }), 'RETENTION.txt': f(t('tight-fit-retention'), { owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }),
    var: d({ log: d({ records: d({ 'export.log': f('2030-04-18 02:00:01 export started\n2030-04-18 02:03:44 ERROR: write /srv/records/exports/records-2030-04-18.sql.gz: No space left on device\n2030-04-18 13:52:10 ERROR: could not write to file "base/16384/2619": No space left on device', { lines: true, owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }),
  };
}
