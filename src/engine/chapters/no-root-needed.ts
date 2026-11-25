// Story "The Walking Club", chapter "No Root Needed": Trailbook ran under
// Docker as root since 2031 (Bolat's notes); Soo-ah stopped Docker after a
// security review and wants it back under the service account trailbook,
// with rootless Podman. Ayasha created the account with useradd --system:
// no subordinate ids, so podman builds a single mapping and the image's
// layers (a file of group 42) can't be unpacked. Then the port: 80 is
// nginx's, and below 1024 an unprivileged process can't bind (pasta's
// "Permission denied"); 8080 behind nginx is the way. Then the data:
// owned by uid 1000 (Docker's container user was the host's 1000, you),
// while trailbook's container runs as uid 1000 inside, 296608 + 999 outside.
// The fix: sudo chown the data to trailbook, then :U (chowned from inside
// the namespace), --userns=keep-id (the account's own uid inside), or
// podman unshare chown 1000:1000.
// Objective checked on the state: trailbook has its own subordinate ranges
// (65536, overlapping nobody's); a rootless container of trailbook runs the
// image with /srv/trailbook/data at /data and opened the club's database;
// the site answers through nginx; no rootful container runs; the data isn't
// world-writable; the unprivileged ports start at 1024 or above (now and at
// boot).
// False leads: sudo podman (rootful, the root we left), chmod 777 on the
// data, ip_unprivileged_port_start lowered (any user's program may then
// take 22 or 443), ranges copied from another account (overlap).
// Sources: https://docs.podman.io/en/v5.4.2/markdown/podman-run.1.html
// (--publish, --userns=keep-id, volume options U and Z),
// https://docs.podman.io/en/v5.4.2/markdown/podman-unshare.1.html,
// https://docs.podman.io/en/v5.4.2/markdown/podman-system-migrate.1.html,
// subuid(5), usermod(8) (--add-subuids), the rootless tutorial.

import type { Chapter } from '../world';
import { f, player } from '../world';
import type { Game } from '../shell';
import { store } from '../podman';
import { HOME, IMAGE, PASSWORD, dataIntact, initialiseStory, passTime, portsLowered, ranges, running, seen, serving, siteUp, walkAccounts, walkState, walkWorld, worldWritable } from './walking-club';

export const WALK_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'nano', 'sudo', 'id', 'getent', 'ps', 'ss', 'curl', 'systemctl', 'journalctl', 'sysctl', 'usermod', 'chown', 'chmod', 'podman', 'exit'];

const rangesOk = (j: Game) => ranges(j).ok && !ranges(j).overlap;
const rootContainers = (j: Game) => running(j, 'root').length > 0;
const cantWrite = (j: Game) => store(j, 'trailbook').containers.some((c) => c.state === 'exited' && c.code === 1 && c.log.some((l) => l.text.includes('cannot open database')));
const emptyData = (j: Game) => running(j, 'trailbook').some((c) => c.image === IMAGE && c.files['/data/trailbook.db'] === 'empty');

export const noRootNeeded: Chapter = {
  id: 'no-root-needed',
  number: 1,
  commands: WALK_COMMANDS,
  home: HOME,
  welcome: 'message_from_soo-ah.txt',
  names: true,
  final: 'end',
  steps: ['single-mapping', 'ranges', 'stale-namespace', 'pulled', 'port-80', 'cant-write', 'running', 'end'],
  password: PASSWORD,
  accounts: walkAccounts,
  state: (t) => walkState(t, 1),
  initialise: (j) => initialiseStory(j, 1),
  createWorld: (t) =>
    walkWorld(t, 1, {
      'message_from_soo-ah.txt': f(t('no-root-needed-message-soo-ah')),
      'notes_from_bolat.txt': f(t('no-root-needed-notes-bolat', { you: player(t) })),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'single-mapping', condition: (j) => seen(j, /no sub[ug]id ranges found/) || (!ranges(j).ok && seen(j, 'potentially insufficient UIDs')), message: (j) => j.t('no-root-needed-event-single-mapping') },
    { id: 'overlap', condition: (j) => ranges(j).overlap, message: (j) => j.t('no-root-needed-event-overlap') },
    { id: 'ranges', condition: rangesOk, message: (j) => j.t('no-root-needed-event-ranges') },
    { id: 'stale-namespace', condition: (j) => rangesOk(j) && seen(j, 'potentially insufficient UIDs'), message: (j) => j.t('no-root-needed-event-stale-namespace') },
    { id: 'pulled', condition: (j) => !!store(j, 'trailbook').images[IMAGE], message: (j) => j.t('no-root-needed-event-pulled') },
    { id: 'sudo-podman', condition: (j) => store(j, 'root').containers.length > 0 || Object.keys(store(j, 'root').images).length > 0, message: (j) => j.t('no-root-needed-event-sudo-podman') },
    { id: 'port-80', condition: (j) => seen(j, /Failed to bind port \d+ \(Permission denied\)|cannot expose privileged port/), message: (j) => j.t('no-root-needed-event-port-80') },
    { id: 'lowered', condition: portsLowered, message: (j) => j.t('no-root-needed-event-lowered') },
    { id: 'chown-refused', condition: (j) => seen(j, 'failed to chown recursively host path'), message: (j) => j.t('no-root-needed-event-chown-refused') },
    { id: 'cant-write', condition: cantWrite, message: (j) => j.t('no-root-needed-event-cant-write') },
    { id: 'world-writable', condition: worldWritable, message: (j) => j.t('no-root-needed-event-world-writable') },
    { id: 'empty', condition: emptyData, message: (j) => j.t('no-root-needed-event-empty') },
    { id: 'running', condition: (j) => !!serving(j), message: (j) => j.t('no-root-needed-event-running') },
    {
      id: 'end',
      condition: (j) => rangesOk(j) && !!serving(j) && siteUp(j) && !portsLowered(j) && !rootContainers(j) && !worldWritable(j) && dataIntact(j),
      message: (j) => j.t('no-root-needed-event-end'),
    },
  ],
};
