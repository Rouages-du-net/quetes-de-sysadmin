// Story "The Canteen", chapter 1 — "The Boot Order": after this
// morning's power cut, the canteen's server came back up, but its menu and
// bookings app didn't: it started before PostgreSQL ("connect
// ECONNREFUSED 127.0.0.1:5432"), because nothing in its unit file says it
// needs the database. Started by hand, it works… until the next reboot.
// Commands: systemctl status / cat / list-dependencies / edit /
// daemon-reload / reboot, journalctl -b -u, systemd-analyze verify.
// Objective checked on the state: after a reboot started by the player,
// PostgreSQL, the app and nginx run without having been started by hand, and
// this was checked. Requires= alone doesn't order (both start together):
// it takes After= (with Requires= or Wants=).
// Sources: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#Before=,
// https://www.freedesktop.org/software/systemd/man/latest/systemctl.html

import type { Chapter } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { systemd } from '../systemd';
import { key } from '../units';
import { HOME, PASSWORD, ETH0_NETWORK, START, accounts, canteenState, canteenWorld, firstBoot, running, seen } from './canteen';

// Ibrahim's unit: everything it needs to run… except the order.
export const MENU_UNIT_IBRAHIM = (t: Translate) => `[Unit]
Description=${t('canteen-menu-description')}

[Service]
User=menu
WorkingDirectory=/srv/menu
EnvironmentFile=/etc/menu/menu.env
ExecStart=/usr/bin/node server.js

[Install]
WantedBy=multi-user.target`;

const NOW = Date.UTC(2027, 10, 8, 8, 15, 0);
const sd = (j: Game) => systemd(j)!;
const deps = (j: Game) => sd(j).services.menu.deps;
const after = (j: Game) => (deps(j)?.after ?? []).map(key);
const pulled = (j: Game) => [...(deps(j)?.requires ?? []), ...(deps(j)?.wants ?? []), ...(deps(j)?.bindsTo ?? [])].map(key);
const rebooted = (j: Game) => sd(j).boot > 1;

export const bootOrder: Chapter = {
  id: 'boot-order',
  number: 1,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps',
    'systemctl', 'journalctl', 'systemd-analyze', 'reboot', 'curl', 'ss',
  ],
  home: HOME,
  welcome: 'message_from_ibrahim.txt',
  names: true,
  final: 'end',
  steps: ['refused', 'order', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => canteenState(t, { postgres: 702, boot: START }, { lo: { type: 'loopback', carrier: true }, eth0: { type: 'ether', carrier: true } }),
  initialise: (j) => firstBoot(j, NOW),
  createWorld: (t) =>
    canteenWorld(t, {
      menuUnit: MENU_UNIT_IBRAHIM(t),
      welcome: { 'message_from_ibrahim.txt': t('boot-order-message-ibrahim') },
      network: { '10-eth0.network': ETH0_NETWORK },
    }),
  events: [
    {
      id: 'refused',
      condition: (j) => seen(j, 'ECONNREFUSED 127.0.0.1:5432'),
      message: (j) => j.t('boot-order-event-refused'),
    },
    {
      id: 'by-hand',
      condition: (j) => !rebooted(j) && running(j, 'menu'),
      message: (j) => j.t('boot-order-event-by-hand'),
    },
    {
      id: 'wrong-name',
      condition: (j) => [...after(j), ...pulled(j)].some((u) => /^postgres(ql)?/.test(u) && u !== 'postgresql'),
      message: (j) => j.t('boot-order-event-wrong-name'),
    },
    {
      id: 'requires-only',
      condition: (j) => rebooted(j) && !running(j, 'menu') && pulled(j).includes('postgresql') && !after(j).includes('postgresql'),
      message: (j) => j.t('boot-order-event-requires-only'),
    },
    {
      id: 'order',
      condition: (j) => after(j).includes('postgresql'),
      message: (j) => j.t('boot-order-event-order'),
    },
    {
      id: 'end',
      condition: (j) =>
        rebooted(j) && sd(j).checkedAfterBoot === true && !sd(j).mainAStarted && running(j, 'menu') && running(j, 'postgresql') && running(j, 'nginx'),
      message: (j) => j.t('boot-order-event-end'),
    },
  ],
};

export { START };
