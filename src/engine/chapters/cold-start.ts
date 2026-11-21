// Story "The Health Centre", chapter "The Cold Start": Monday morning,
// after Saturday night's storm and power cut. hearth restarted on its own;
// agenda and records came back (autostart), ledger didn't: it was never
// marked to start with the host. Started by hand, it pauses at once:
// "paused (I/O error)", /var is full. Ilse took three external disk-only
// snapshots of ledger over the year (before an update, before the year-end
// closing, before the Debian 13 upgrade) and never merged them: the chain
// ledger.qcow2 ← before-update ← before-yearend ← before-upgrade holds a
// 200 GiB thin disk four times over, and the guest's writes at boot filled
// what was left. A test clone Priya no longer needs is the room to make
// first; then the chain is merged (virsh blockcommit --active --pivot, or
// virsh snapshot-delete of each external snapshot, which merges since
// libvirt 9), the leftover overlays and snapshot metadata go, the guest is
// resumed, marked autostart, and reached over ssh.
// Objective checked on the state: ledger running (booted), autostart, its
// chain whole as the directories hold it, its snapshots consistent with
// it, /var below 90 %, and an ssh session into ledger.
// False leads: rm of an overlay in use (QEMU keeps it open: no space comes
// back, and the next start would find a broken chain), virsh shutdown of a
// paused guest (it hears nothing), virsh destroy (a hard power-off),
// snapshot-revert (refused; it would drop a year of accounting), undefine
// (refused: the domain has snapshots), qemu-img info without -U (QEMU's lock).
// Sources: https://libvirt.org/kbase/merging_disk_image_chains.html,
// https://libvirt.org/kbase/snapshots.html, https://libvirt.org/manpages/virsh.html
// (blockcommit, snapshot-delete, domblkerror, autostart),
// https://www.qemu.org/docs/master/tools/qemu-img.html (info, -U).

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { IMAGES, active, chainWhole, freeBytes, libvirt, snapshotsConsistent, usedShare } from '../libvirt';
import { HOME, PASSWORD, connections, dom, guests, hearthAccounts, hearthState, hearthWorld, initialiseHearth, passTime, seen, typed } from './health-centre';

const ledger = (j: Game) => dom(j, 'ledger')!;
const OVERLAYS = ['before-update', 'before-yearend', 'before-upgrade'].map((x) => `${IMAGES}/ledger.${x}`);
const merged = (j: Game) => {
  const d = ledger(j);
  return (d.live ?? d.config).disks[0].source === `${IMAGES}/ledger.qcow2` && d.config.disks[0].source === `${IMAGES}/ledger.qcow2`;
};
const overlaysLeft = (j: Game) => OVERLAYS.some((p) => !!j.find(p));
// An overlay removed while QEMU still holds it.
const removedHeld = (j: Game) => {
  const d = ledger(j);
  return active(d) && Object.entries(d.held ?? {}).some(([p, node]) => j.find(p) !== node);
};
const healthy = (j: Game) => ledger(j).state === 'running' && ledger(j).booting === 0;

export const coldStart: Chapter = {
  id: 'cold-start',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'df', 'du', 'rm', 'lsof', 'ps', 'free', 'sudo', 'ssh', 'nano', 'systemctl', 'journalctl', 'virsh', 'qemu-img', 'exit'],
  home: HOME,
  welcome: 'message_from_grace.txt',
  names: true,
  final: 'end',
  steps: ['list', 'autostart-off', 'paused', 'no-space', 'chain', 'room', 'merged', 'cleaned', 'resumed', 'autostart', 'ssh', 'end'],
  password: PASSWORD,
  accounts: hearthAccounts,
  state: (t) => hearthState(t, 1),
  initialise: initialiseHearth,
  hosts: guests(1),
  createWorld: (t) =>
    hearthWorld(t, 1, {
      'message_from_grace.txt': t('cold-start-message-grace'),
      'note_from_ilse.txt': t('cold-start-note-ilse'),
      'message_from_priya.txt': t('cold-start-message-priya'),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'list', condition: (j) => seen(j, /-\s+ledger\s+shut off/), message: (j) => j.t('cold-start-event-list') },
    { id: 'autostart-off', condition: (j) => seen(j, /Name:\s+ledger/) && seen(j, /Autostart:\s+disable/), message: (j) => j.t('cold-start-event-autostart-off') },
    { id: 'paused', condition: (j) => ledger(j).state === 'paused' && !!ledger(j).ioError, message: (j) => j.t('cold-start-event-paused') },
    { id: 'no-space', condition: (j) => j.flags.has('paused') && (seen(j, /\/dev\/sda3 .* 100% \/var/) || seen(j, 'vda: no space')), message: (j) => j.t('cold-start-event-no-space') },
    { id: 'lock', condition: (j) => seen(j, 'Failed to get shared "write" lock'), message: (j) => j.t('cold-start-event-lock') },
    { id: 'chain', condition: (j) => seen(j, 'backing file: /var/lib/libvirt/images/ledger.') || seen(j, /before-yearend\s+\d{4}-\d\d-\d\d .*disk-snapshot/), message: (j) => j.t('cold-start-event-chain') },
    { id: 'acpi-paused', condition: (j) => ((j.state.acpiSent as string[] | undefined) ?? []).includes('ledger:paused'), message: (j) => j.t('cold-start-event-acpi-paused') },
    { id: 'destroyed', condition: (j) => ((j.state.destroyed as string[] | undefined) ?? []).includes('ledger'), message: (j) => j.t('cold-start-event-destroyed') },
    { id: 'revert', condition: (j) => seen(j, 'revert to external snapshot not supported yet'), message: (j) => j.t('cold-start-event-revert') },
    { id: 'undefine', condition: (j) => seen(j, 'cannot delete inactive domain with') || seen(j, 'cannot delete active domain with'), message: (j) => j.t('cold-start-event-undefine') },
    { id: 'rm-held', condition: removedHeld, message: (j) => j.t('cold-start-event-rm-held') },
    { id: 'broken', condition: (j) => !active(ledger(j)) && !chainWhole(j, 'ledger'), message: (j) => j.t('cold-start-event-broken') },
    { id: 'commit-failed', condition: (j) => seen(j, 'Commit failed') || seen(j, 'No space left on device') && /snapshot-delete|commit/.test(typed(j)), message: (j) => j.t('cold-start-event-commit-failed') },
    { id: 'room', condition: (j) => !j.find(`${IMAGES}/ledger-test-clone.qcow2`) && freeBytes(j, IMAGES) > 8 * 1024 ** 3, message: (j) => j.t('cold-start-event-room') },
    { id: 'merged', condition: merged, message: (j) => j.t(overlaysLeft(j) || ledger(j).snapshots.length ? 'cold-start-event-merged-leftovers' : 'cold-start-event-merged') },
    { id: 'paused-again', condition: (j) => (ledger(j).pauses ?? 0) >= 2, message: (j) => j.t('cold-start-event-paused-again') },
    { id: 'cleaned', condition: (j) => merged(j) && !overlaysLeft(j) && snapshotsConsistent(j, 'ledger') && usedShare(j, IMAGES) < 0.9, message: (j) => j.t('cold-start-event-cleaned') },
    { id: 'resumed', condition: (j) => j.flags.has('paused') && healthy(j), message: (j) => j.t('cold-start-event-resumed') },
    { id: 'autostart', condition: (j) => ledger(j).autostart, message: (j) => j.t('cold-start-event-autostart') },
    { id: 'ssh', condition: (j) => healthy(j) && connections(j, 'ledger') > 0, message: (j) => j.t('cold-start-event-ssh') },
    {
      id: 'end',
      condition: (j) =>
        healthy(j) && ledger(j).autostart && chainWhole(j, 'ledger') && snapshotsConsistent(j, 'ledger') && usedShare(j, IMAGES) < 0.9 && connections(j, 'ledger') > 0 && !libvirt(j).jobs.length,
      message: (j) => j.t('cold-start-event-end'),
    },
  ],
};
