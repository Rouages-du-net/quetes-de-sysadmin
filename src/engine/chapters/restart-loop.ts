// Story "The Canteen", chapter 2 — "The Restart Loop": last night, the
// automatic updates upgraded PostgreSQL and restarted it. The app lost its
// connection and exited; Ibrahim's Restart=always restarted it at once
// (RestartSec= is 100 ms by default), five times in half a second, while
// the database was still restarting: "Start request repeated too quickly",
// Result: start-limit-hit, and the app stayed down until morning.
// Commands: systemctl status / cat / edit / restart / reset-failed,
// journalctl -u, systemd-analyze verify.
// Objective checked on the state: after a restart of PostgreSQL (the
// player's test of the nightly update), the app runs again by itself. Two
// right answers: PartOf=postgresql.service (with After=), which stops the
// app before the database and starts it again after; or a RestartSec= long
// enough for PostgreSQL to come back. BindsTo= alone stops it without
// bringing it back.
// Sources: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Restart=,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#StartLimitIntervalSec=interval,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#PartOf=

import type { Chapter } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { systemd, writeLog } from '../systemd';
import { key, restartWithDependents, runPending } from '../units';
import { HOME, PASSWORD, ETH0_NETWORK, START, accounts, canteenState, canteenWorld, firstBoot, running, seen } from './canteen';

// After chapter 1: ordered after PostgreSQL; and Ibrahim added Restart=always.
export const MENU_UNIT_RESTART = (t: Translate) => `[Unit]
Description=${t('canteen-menu-description')}
After=postgresql.service
Wants=postgresql.service

[Service]
User=menu
WorkingDirectory=/srv/menu
EnvironmentFile=/etc/menu/menu.env
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target`;

const NIGHT = Date.UTC(2027, 10, 15, 3, 12, 0);
const NOW = Date.UTC(2027, 10, 15, 7, 50, 0);
const sd = (j: Game) => systemd(j)!;
const deps = (j: Game) => sd(j).services.menu.deps;
// The player's last test (PostgreSQL stopped and started again, as at night), in this boot;
// and the last time the app was started by hand.
const pgRestart = (j: Game) => (j.state.pgTestBoot === sd(j).boot ? (j.state.pgTestAt as number | undefined) : undefined);
const menuByHand = (j: Game) => j.state.menuByHandAt as number | undefined;

export const restartLoop: Chapter = {
  id: 'restart-loop',
  number: 2,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps',
    'systemctl', 'journalctl', 'systemd-analyze', 'reboot', 'curl', 'ss',
  ],
  home: HOME,
  welcome: 'message_from_ibrahim.txt',
  names: true,
  final: 'end',
  steps: ['limit', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => ({
    ...canteenState(t, { postgres: 2100, boot: Date.UTC(2027, 10, 12, 18, 4, 0) }, { lo: { type: 'loopback', carrier: true }, eth0: { type: 'ether', carrier: true } }),
    // The player's tests: the time of each restart of PostgreSQL, each start of the app by hand.
    onSystemctl: (j: Game, action: string, name: string) => {
      if (!['start', 'restart'].includes(action)) return;
      if (name === 'postgresql' && j.state.pgStoppedAt !== undefined) {
        j.state.pgTestAt = j.state.pgStoppedAt;
        j.state.pgTestBoot = sd(j).boot;
        // What became of the app with this test.
        j.state.menuAfterTest = sd(j).services.menu.state;
      }
      if (name === 'menu') j.state.menuByHandAt = sd(j).clock;
    },
  }),
  initialise: (j) => {
    firstBoot(j, NIGHT);
    // The night: unattended-upgrades upgrades PostgreSQL and restarts it.
    const s = sd(j);
    writeLog(s, 'unattended-upgrades.service', 'unattended-upgrade', 3310, 'Packages that will be upgraded: postgresql-17 postgresql-client-17');
    restartWithDependents(j, s, 'postgresql');
    runPending(j, s);
    j.state.pgStoppedAt = undefined;
    writeLog(s, 'unattended-upgrades.service', 'unattended-upgrade', 3310, 'All upgrades installed');
    s.clock = NOW;
    s.mainAStarted = false;
  },
  createWorld: (t) =>
    canteenWorld(t, {
      menuUnit: MENU_UNIT_RESTART(t),
      welcome: { 'message_from_ibrahim.txt': t('restart-loop-message-ibrahim') },
      network: { '10-eth0.network': ETH0_NETWORK },
    }),
  events: [
    {
      id: 'limit',
      condition: (j) => seen(j, "start-limit-hit") || seen(j, 'Start request repeated too quickly'),
      message: (j) => j.t('restart-loop-event-limit'),
    },
    {
      id: 'too-often',
      condition: (j) => seen(j, 'start of the service was attempted too often'),
      message: (j) => j.t('restart-loop-event-too-often'),
    },
    {
      id: 'again',
      condition: (j) => pgRestart(j) !== undefined && sd(j).services.menu.result === 'start-limit-hit' && sd(j).services.menu.since >= pgRestart(j)!,
      message: (j) => j.t('restart-loop-event-again'),
    },
    {
      id: 'binds-to',
      condition: (j) =>
        pgRestart(j) !== undefined &&
        j.state.menuAfterTest === 'inactive' &&
        (deps(j)?.bindsTo ?? []).map(key).includes('postgresql') &&
        !(deps(j)?.partOf ?? []).map(key).includes('postgresql'),
      message: (j) => j.t('restart-loop-event-binds-to'),
    },
    {
      id: 'end',
      condition: (j) =>
        pgRestart(j) !== undefined &&
        running(j, 'postgresql') &&
        running(j, 'menu') &&
        sd(j).services.menu.since >= pgRestart(j)! &&
        (menuByHand(j) === undefined || menuByHand(j)! < pgRestart(j)!),
      message: (j) => j.t('restart-loop-event-end'),
    },
  ],
};

export { START };
