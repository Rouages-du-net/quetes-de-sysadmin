// Story "The Observatory", chapter 2 — "The Quota": after chapter 1, Jules
// turned the stacking into a service (/etc/systemd/system/stacking.service,
// with Nice=19): the gallery no longer suffers. But the hosting provider
// writes: the machine has been above its CPU baseline (40 % of its two
// vCPUs) all night, its credits are exhausted and it will be throttled.
// Nice only shares the CPU when others want it; alone, the stacking still
// takes everything. A cap is needed: CPUQuota= (100 % = one CPU, so 80 %
// for 40 % of two).
// Commands: top, systemd-cgtop, systemctl cat / edit / set-property /
// daemon-reload, the unit file.
// Objective checked on the state: the stacking still runs (Jules's night is
// not lost), capped at 80 % of a CPU or less, by a setting written on disk
// (systemctl set-property, or a drop-in followed by daemon-reload); a
// restart is not needed (and costs the night's progress).
// Sources: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html#CPUQuota=,
// https://www.freedesktop.org/software/systemd/man/latest/systemctl.html#set-property%20UNIT%20PROPERTY=VALUE%E2%80%A6

import type { Chapter } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { HOME, PASSWORD, STACK, WORKERS, accounts, observatoryState, observatoryWorld, passTime, prepare, proc, running, sd, seen, workers } from './observatory';
import { shares } from '../cpu';
import { dropIns, mainFile } from '../units';

const BOOT = Date.UTC(2027, 11, 2, 7, 12, 0);
const NOW = Date.UTC(2027, 11, 21, 8, 34, 0);
const nightly = '/srv/nights/2027-12-20';
// The provider's baseline: 40 % of two vCPUs, so 0.8 CPU.
export const BASELINE = 0.8;

export const STACKING_UNIT = (t: Translate) => `[Unit]
Description=${t('observatory-stacking-description')}

[Service]
User=jules
Group=astro
Nice=19
ExecStart=/usr/local/bin/stack-night --jobs 8 ${nightly}`;

const stacking = (j: Game) => sd(j).services.stacking;
const used = (j: Game) => {
  const s = shares(j);
  return workers(j).reduce((t, p) => t + (s[p.pid] ?? 0), 0);
};
const files = (j: Game) => [mainFile(j, 'stacking', stacking(j)), ...dropIns(j, 'stacking')].filter((x): x is string => !!x);
const written = (j: Game) => files(j).some((f) => /^\s*CPUQuota\s*=\s*\S/m.test(j.read(f) ?? ''));
const capped = (j: Game) => (stacking(j).cpuQuota ?? Infinity) <= BASELINE + 1e-9;

export const quota: Chapter = {
  id: 'quota',
  number: 2,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps', 'top', 'free',
    'uptime', 'nproc', 'pgrep', 'renice', 'kill', 'curl', 'systemctl', 'journalctl', 'systemd-cgtop',
  ],
  home: HOME,
  welcome: 'message_from_amara.txt',
  names: true,
  final: 'end',
  steps: ['measure', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => {
    const workerProcs = WORKERS.map((pid, i) => proc(pid, 'jules', `/usr/local/lib/stack/stack-worker --part ${i + 1}/8 ${nightly}`, { ppid: STACK, mem: 1.1, nice: 19 }));
    const parent = proc(STACK, 'jules', `/usr/local/lib/stack/stack-night --jobs 8 ${nightly}`, { mem: 0.5, nice: 19 });
    return observatoryState(t, {
      boot: BOOT,
      now: NOW,
      // 8:30 am: nobody browses the gallery yet.
      gallery: 0,
      load: [8.31, 8.27, 8.19],
      services: {
        stacking: {
          description: t('observatory-stacking-description'),
          active: true,
          executable: 'stack-night',
          file: '/etc/systemd/system/stacking.service',
          modelled: true,
          process: [parent, ...workerProcs],
        },
      },
      demand: Object.fromEntries(WORKERS.map((p) => [p, 1])),
    });
  },
  initialise: (j) => {
    prepare(j);
    // Started by Jules at 1:10 am, before going to bed.
    stacking(j).since = Date.UTC(2027, 11, 21, 1, 10, 0);
    j.state.startedAt = stacking(j).since;
  },
  afterCommand: passTime,
  createWorld: (t) =>
    observatoryWorld(t, {
      welcome: { 'message_from_amara.txt': t('quota-message-amara'), 'mail_from_the_host.txt': t('quota-mail-host') },
      units: { 'stacking.service': STACKING_UNIT(t) },
    }),
  events: [
    {
      id: 'measure',
      condition: (j) => seen(j, 'stack-worker') || seen(j, '/system.slice/stacking.service'),
      message: (j) => j.t('quota-event-measure'),
    },
    {
      id: 'nice-property',
      condition: (j) => seen(j, 'Cannot set property Nice'),
      message: (j) => j.t('quota-event-nice-property'),
    },
    {
      id: 'reload',
      condition: (j) => written(j) && stacking(j).cpuQuota === undefined,
      message: (j) => j.t('quota-event-reload'),
    },
    {
      id: 'per-cpu',
      condition: (j) => stacking(j).cpuQuota !== undefined && !capped(j),
      message: (j) => j.t('quota-event-per-cpu'),
    },
    {
      id: 'stopped',
      condition: (j) => !running(j, 'stacking') || workers(j).length < WORKERS.length,
      message: (j) => j.t('quota-event-stopped'),
    },
    {
      id: 'restarted',
      condition: (j) => running(j, 'stacking') && stacking(j).since !== j.state.startedAt,
      message: (j) => j.t('quota-event-restarted'),
    },
    {
      id: 'end',
      condition: (j) => running(j, 'stacking') && workers(j).length === WORKERS.length && capped(j) && written(j) && used(j) <= BASELINE + 1e-6,
      message: (j) => j.t('quota-event-end'),
    },
  ],
};
