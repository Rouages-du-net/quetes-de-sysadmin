// Story "The Observatory", chapter 4 — "The Stuck Process": every night at
// 2 am, cron runs sync-photos, a script that copies the gallery to the
// club's NAS with rsync. Last night the NAS was off: rsync has been waiting
// for nine hours, the script retries it forever, and its PID file will make
// tonight's run give up ("already running"). The NAS is back; the stuck
// copy must go, cleanly.
// The script ignores TERM, INT and HUP (trap '' …, "don't stop halfway");
// killing its rsync makes it start another one. kill -9 (KILL) ends the
// script, but then nothing removes its PID file, and its rsync stays,
// adopted by init.
// Commands: ps -ef (the parent), pgrep, kill (-l, -TERM, -KILL), cat of the
// script, the PID file, rm.
// Objective checked on the state: no sync-photos nor rsync process left,
// the stale PID file removed, cron still running (tonight's copy will run).
// Sources: https://man7.org/linux/man-pages/man7/signal.7.html,
// https://man7.org/linux/man-pages/man1/kill.1.html,
// https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html#index-trap

import type { Chapter, Directory } from '../world';
import { d, f } from '../world';
import type { Game } from '../shell';
import type { Process } from '../commands/system';
import { HOME, PASSWORD, accounts, observatoryState, observatoryWorld, passTime, prepare, proc, running, seen } from './observatory';

const BOOT = Date.UTC(2028, 0, 2, 7, 2, 0);
const NOW = Date.UTC(2028, 0, 11, 10, 52, 0);
export const SCRIPT = 3301;
export const RSYNC = 3302;
export const PIDFILE = '/run/sync-photos.pid';
const RSYNC_COMMAND = 'rsync -a --partial /srv/skygallery/photos/ nas.internal:/volume1/photos/';

export const SYNC_SCRIPT = `#!/bin/bash
# Nightly copy of the gallery to the club's NAS (started by cron: /etc/cron.d/sync-photos).
LOCK=${PIDFILE}
if [ -e "$LOCK" ]; then
  echo "sync-photos: already running (pid $(cat "$LOCK"))" >&2
  exit 1
fi
echo $$ > "$LOCK"
trap '' INT TERM HUP        # don't stop halfway
until ${RSYNC_COMMAND}; do
  sleep 60                  # the NAS may be asleep: try again
done
rm -f "$LOCK"`;

const procs = (j: Game): Process[] => j.state.process ?? [];
const alive = (j: Game, pid: number) => procs(j).some((p) => p.pid === pid);
const rsyncs = (j: Game) => procs(j).filter((p) => p.command.startsWith('rsync '));
const scriptAlive = (j: Game) => alive(j, SCRIPT);
const pidFile = (j: Game) => j.exists(PIDFILE);

export const stuckProcess: Chapter = {
  id: 'stuck-process',
  number: 4,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps', 'top', 'pgrep', 'pkill',
    'kill', 'rm', 'systemctl', 'journalctl', 'ping',
  ],
  home: HOME,
  welcome: 'message_from_amara.txt',
  names: true,
  final: 'end',
  steps: ['stuck', 'ignored', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => ({
    ...observatoryState(t, {
      boot: BOOT,
      now: NOW,
      gallery: 0.1,
      load: [1.02, 1.01, 1.0],
      process: [
        proc(3290, 'root', '/bin/sh -c /usr/local/bin/sync-photos', { ppid: 633 }),
        proc(SCRIPT, 'root', '/bin/bash /usr/local/bin/sync-photos', { ppid: 3290, ignores: ['INT', 'TERM', 'HUP'] }),
        proc(RSYNC, 'root', RSYNC_COMMAND, { ppid: SCRIPT, mem: 0.3 }),
      ],
    }),
    nextPid: RSYNC + 1,
  }),
  initialise: (j) => {
    prepare(j);
    // The script ignores the signals its trap names: the story notes it.
    j.state.onSignal = (game: Game, p: Process, signal: string) => {
      if (p.pid === SCRIPT) game.state.ignoredSignal = signal;
      return undefined;
    };
    j.state.onKill = (game: Game, p: Process) => {
      // The script's rsync dies: the script, if it still runs, starts another one.
      if (p.command.startsWith('rsync ') && p.ppid === SCRIPT && scriptAlive(game)) {
        const pid = game.state.nextPid++;
        game.state.process.push(proc(pid, 'root', RSYNC_COMMAND, { ppid: SCRIPT, mem: 0.3 }));
        game.state.respawned = pid;
      }
      // The script dies: its children are adopted by init (PPID 1); /bin/sh -c, cron's, ends with it.
      if (p.pid === SCRIPT) {
        for (const q of procs(game)) if (q.ppid === SCRIPT) q.ppid = 1;
        game.state.process = procs(game).filter((q) => q.pid !== 3290);
      }
      return undefined;
    };
  },
  afterCommand: passTime,
  createWorld: (t) => {
    const world = observatoryWorld(t, { welcome: { 'message_from_amara.txt': t('stuck-process-message-amara') } });
    const usr = world.children.usr as Directory;
    ((usr.children.local as Directory).children.bin as Directory).children['sync-photos'] = f(SYNC_SCRIPT, { lines: true, owner: 'root', mode: 'rwxr-xr-x' });
    const etc = world.children.etc as Directory;
    etc.children['cron.d'] = d(
      { 'sync-photos': f('# Copy the gallery to the NAS every night.\n0 2 * * * root /usr/local/bin/sync-photos', { lines: true, owner: 'root' }) },
      undefined,
      { owner: 'root' },
    );
    world.children.run = d({ 'sync-photos.pid': f(String(SCRIPT), { owner: 'root', mode: 'rw-r--r--' }) }, undefined, { owner: 'root' });
    return world;
  },
  events: [
    {
      id: 'stuck',
      condition: (j) => seen(j, RSYNC_COMMAND) || (seen(j, 'sync-photos') && seen(j, 'rsync')),
      message: (j) => j.t('stuck-process-event-stuck'),
    },
    {
      id: 'ignored',
      condition: (j) => j.state.ignoredSignal !== undefined && scriptAlive(j),
      message: (j) => j.t('stuck-process-event-ignored', { signal: j.state.ignoredSignal }),
    },
    {
      id: 'respawn',
      condition: (j) => j.state.respawned !== undefined && scriptAlive(j),
      message: (j) => j.t('stuck-process-event-respawn', { pid: String(j.state.respawned) }),
    },
    {
      id: 'orphan',
      condition: (j) => !scriptAlive(j) && rsyncs(j).length > 0,
      message: (j) => j.t('stuck-process-event-orphan'),
    },
    {
      id: 'stale',
      condition: (j) => !scriptAlive(j) && !rsyncs(j).length && pidFile(j),
      message: (j) => j.t('stuck-process-event-stale'),
    },
    {
      id: 'early-lock',
      condition: (j) => scriptAlive(j) && !pidFile(j),
      message: (j) => j.t('stuck-process-event-early-lock'),
    },
    {
      id: 'cron-stopped',
      condition: (j) => !running(j, 'cron'),
      message: (j) => j.t('stuck-process-event-cron-stopped'),
    },
    {
      id: 'end',
      condition: (j) => !scriptAlive(j) && !rsyncs(j).length && !pidFile(j) && running(j, 'cron'),
      message: (j) => j.t('stuck-process-event-end'),
    },
  ],
};
