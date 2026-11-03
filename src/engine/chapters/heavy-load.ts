// Story "The Observatory", chapter 1 — "Heavy Load": the morning after the
// Geminids, Jules started the stacking of his photos by hand (stack-night
// --jobs 8: eight worker processes, each keeping a CPU busy) on a machine
// that has two. The club's gallery waits for a CPU: five seconds per page.
// The stacking has been running for three hours and would start again from
// zero: it must not be stopped.
// Commands: uptime, nproc, top, ps (-o ni, --sort), pgrep, renice, curl -w.
// Objective checked on the state: the gallery answers in less than half a
// second, with the eight workers still running. Several right answers: renice
// the workers (renice -n 19 -u jules, or their PIDs), or give the gallery a
// higher priority (a negative nice value, as root). renice of the parent
// alone changes nothing: its children keep their own nice value.
// Sources: https://man7.org/linux/man-pages/man1/uptime.1.html,
// https://man7.org/linux/man-pages/man1/renice.1.html,
// https://man7.org/linux/man-pages/man5/proc_loadavg.5.html

import type { Chapter } from '../world';
import type { Game } from '../shell';
import type { Process } from '../commands/system';
import { HOME, PASSWORD, GALLERY, STACK, WORKERS, accounts, galleryTime, observatoryState, observatoryWorld, passTime, prepare, proc, running, seen, workers } from './observatory';

const BOOT = Date.UTC(2027, 11, 2, 7, 12, 0);
const NOW = Date.UTC(2027, 11, 14, 9, 31, 0);
const nightly = '/srv/nights/2027-12-14';

const fast = (j: Game) => galleryTime(j) < 0.5;
const procs = (j: Game): Process[] => j.state.process ?? [];
const niceOf = (j: Game, pid: number) => procs(j).find((p) => p.pid === pid)?.nice ?? 0;

export const heavyLoad: Chapter = {
  id: 'heavy-load',
  number: 1,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'sudo', 'id', 'whoami', 'who', 'ps', 'top', 'free',
    'uptime', 'nproc', 'pgrep', 'renice', 'nice', 'kill', 'curl', 'systemctl', 'journalctl',
  ],
  home: HOME,
  welcome: 'message_from_amara.txt',
  names: true,
  final: 'end',
  steps: ['load', 'workers', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) =>
    observatoryState(t, {
      boot: BOOT,
      now: NOW,
      gallery: 1,
      load: [9.04, 8.87, 7.21],
      process: [
        proc(2010, 'jules', 'tmux new -s stack'),
        proc(2011, 'jules', '-bash', { ppid: 2010 }),
        proc(STACK, 'jules', `/usr/local/lib/stack/stack-night --jobs 8 ${nightly}`, { ppid: 2011, mem: 0.5 }),
        ...WORKERS.map((pid, i) => proc(pid, 'jules', `/usr/local/lib/stack/stack-worker --part ${i + 1}/8 ${nightly}`, { ppid: STACK, mem: 1.1 })),
      ],
      demand: Object.fromEntries(WORKERS.map((p) => [p, 1])),
    }),
  initialise: prepare,
  afterCommand: passTime,
  createWorld: (t) => observatoryWorld(t, { welcome: { 'message_from_amara.txt': t('heavy-load-message-amara') } }),
  events: [
    {
      id: 'load',
      condition: (j) => seen(j, 'load average'),
      message: (j) => j.t('heavy-load-event-load'),
    },
    {
      id: 'workers',
      condition: (j) => seen(j, 'stack-worker') || seen(j, 'stack-work'),
      message: (j) => j.t('heavy-load-event-workers'),
    },
    {
      id: 'parent-only',
      condition: (j) => niceOf(j, STACK) > 0 && WORKERS.every((p) => niceOf(j, p) === 0),
      message: (j) => j.t('heavy-load-event-parent-only'),
    },
    {
      id: 'some-workers',
      condition: (j) => WORKERS.some((p) => niceOf(j, p) > 0) && !fast(j) && workers(j).length === WORKERS.length,
      message: (j) => j.t('heavy-load-event-some-workers'),
    },
    {
      id: 'killed',
      condition: (j) => workers(j).length < WORKERS.length || !procs(j).some((p) => p.pid === STACK),
      message: (j) => j.t('heavy-load-event-killed'),
    },
    {
      id: 'gallery-stopped',
      condition: (j) => !running(j, 'gallery'),
      message: (j) => j.t('heavy-load-event-gallery-stopped'),
    },
    {
      id: 'end',
      condition: (j) => fast(j) && running(j, 'gallery') && workers(j).length === WORKERS.length,
      message: (j) => j.t(niceOf(j, GALLERY) < 0 ? 'heavy-load-event-end-gallery' : 'heavy-load-event-end'),
    },
  ],
};
