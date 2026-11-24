// Story "The Walking Club", chapter "Logged Out": Ayasha logged in as
// trailbook over ssh, started Trailbook with podman run -d, and logged out
// at 18:02; the site died with her session. A rootless container started
// from a session lives in the account's service manager (user@997.service),
// which logind stops when the last session ends, unless the account lingers.
// And nothing would start it again after a reboot. The fix: a Quadlet unit
// (~trailbook/.config/containers/systemd/*.container, its [Install]
// WantedBy=default.target), loginctl enable-linger trailbook, systemctl
// --user daemon-reload and start (with XDG_RUNTIME_DIR set, or -M
// trailbook@ --user), then a reboot (the kernel update waits for one).
// Objective checked on the state: trailbook lingers; a unit generated from a
// .container file is wanted by default.target, was started by the manager
// at this boot (a reboot happened) and runs the container that serves the
// club's data; the site answers; no rootful container and no system unit
// running podman.
// False leads: nohup podman run (the manager's cgroup still goes, and
// nothing comes back after a reboot), a root unit calling sudo -u trailbook
// podman (no user session: cgroupfs, conmon outside systemd's sight),
// systemctl --user enable on a generated unit, podman generate systemd
// (deprecated in Podman 5).
// Sources: https://docs.podman.io/en/v5.4.2/markdown/podman-systemd.unit.5.html,
// https://www.freedesktop.org/software/systemd/man/latest/loginctl.html
// (enable-linger), https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
// (KillUserProcesses, UserStopDelaySec), systemctl(1) (--user, --machine).

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { systemd, type Systemd } from '../systemd';
import { lingers, podman, store } from '../podman';
import { WALK_COMMANDS } from './no-root-needed';
import { HOME, IMAGE, PASSWORD, dataIntact, initialiseStory, passTime, running, seen, serving, siteUp, typed, walkAccounts, walkState, walkWorld } from './walking-club';

const sd = (j: Game) => systemd(j) as Systemd;
const units = (j: Game) => Object.values(podman(j).managers.trailbook?.units ?? {}).filter((u) => u.args.includes(IMAGE));
const unitOk = (j: Game) => units(j).find((u) => u.wanted);
const unitRunning = (j: Game) => {
  const c = serving(j);
  return !!c?.unit && units(j).some((u) => u.name === c.unit && u.state === 'active');
};
/** A hand-written system unit that runs podman (the root unit false lead). */
const rootUnits = (j: Game) => {
  const n = j.find('/etc/systemd/system');
  if (n?.type !== 'directory') return [];
  return Object.keys(n.children).filter((k) => k.endsWith('.service') && /\bpodman\b/.test(j.read(`/etc/systemd/system/${k}`) ?? ''));
};
const rootUnitActive = (j: Game) => rootUnits(j).some((k) => sd(j).services[k.replace(/\.service$/, '')]?.state === 'active');
const rebooted = (j: Game) => sd(j).boot > 1;
const nohup = (j: Game) => store(j, 'trailbook').containers.some((c) => c.nohup);

export const loggedOut: Chapter = {
  id: 'logged-out',
  number: 2,
  commands: [...WALK_COMMANDS, 'loginctl', 'quadlet', 'mkdir', 'export', 'env', 'nohup', 'reboot'],
  home: HOME,
  welcome: 'message_from_ayasha.txt',
  names: true,
  final: 'end',
  steps: ['logout', 'quadlet', 'linger', 'no-bus', 'unit-running', 'rebooted', 'end'],
  password: PASSWORD,
  accounts: walkAccounts,
  state: (t) => walkState(t, 2),
  initialise: (j) => initialiseStory(j, 2),
  createWorld: (t) => walkWorld(t, 2, { 'message_from_ayasha.txt': f(t('logged-out-message-ayasha')) }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'logout', condition: (j) => seen(j, /Removed session 41|Stopping user@997\.service/), message: (j) => j.t('logged-out-event-logout') },
    { id: 'nohup', condition: nohup, message: (j) => j.t('logged-out-event-nohup') },
    { id: 'root-unit', condition: (j) => rootUnits(j).length > 0, message: (j) => j.t('logged-out-event-root-unit') },
    { id: 'generate', condition: (j) => /podman\s+generate\s+systemd/.test(typed(j)), message: (j) => j.t('logged-out-event-generate') },
    { id: 'quadlet-error', condition: (j) => seen(j, /unsupported key|no Image or Rootfs key/), message: (j) => j.t('logged-out-event-quadlet-error') },
    { id: 'quadlet', condition: (j) => units(j).length > 0, message: (j) => j.t('logged-out-event-quadlet') },
    { id: 'no-bus', condition: (j) => seen(j, 'XDG_RUNTIME_DIR not defined'), message: (j) => j.t('logged-out-event-no-bus') },
    { id: 'generated', condition: (j) => seen(j, 'is transient or generated'), message: (j) => j.t('logged-out-event-generated') },
    { id: 'linger', condition: (j) => lingers(j, 'trailbook'), message: (j) => j.t('logged-out-event-linger') },
    { id: 'not-wanted', condition: (j) => units(j).length > 0 && !unitOk(j) && unitRunning(j), message: (j) => j.t('logged-out-event-not-wanted') },
    { id: 'unit-running', condition: unitRunning, message: (j) => j.t('logged-out-event-unit-running') },
    { id: 'rebooted', condition: (j) => rebooted(j) && !siteUp(j), message: (j) => j.t('logged-out-event-rebooted') },
    {
      id: 'end',
      condition: (j) => {
        const u = unitOk(j);
        return (
          rebooted(j) &&
          lingers(j, 'trailbook') &&
          !!u &&
          u.state === 'active' &&
          u.byManagerStart === sd(j).boot &&
          serving(j)?.unit === u.name &&
          siteUp(j) &&
          running(j, 'root').length === 0 &&
          !rootUnitActive(j) &&
          dataIntact(j)
        );
      },
      message: (j) => j.t('logged-out-event-end'),
    },
  ],
};
