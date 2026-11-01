// Story "The Canteen", chapter 3 — "The Slow Boot": since Ibrahim added a
// second network card (eth1, for a backup line not wired yet) and its
// configuration, the server takes more than two minutes to come back after
// a reboot, and the site answers 502 in the meantime. nginx (and the app)
// wait for network-online.target, and systemd-networkd-wait-online waits
// for every configured link… including eth1, which has no cable: after two
// minutes it gives up.
// Commands: systemd-analyze time / blame / critical-chain,
// systemctl list-dependencies, networkctl, journalctl -b, the .network files.
// Objective checked on the state: after a reboot started by the player, the
// machine is up in less than 30 s (systemd-analyze time), with PostgreSQL,
// the app and nginx running, and this was checked. Several right answers:
// RequiredForOnline=no in eth1's .network file, a drop-in that tells
// wait-online what to wait for (--any, --interface=eth0), or no
// configuration for eth1 until it is wired.
// Sources: https://systemd.io/NETWORK_ONLINE/,
// https://www.freedesktop.org/software/systemd/man/latest/systemd-networkd-wait-online.service.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.network.html#RequiredForOnline=,
// https://www.freedesktop.org/software/systemd/man/latest/systemd-analyze.html

import type { Chapter } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { systemd } from '../systemd';
import { key } from '../units';
import { HOME, PASSWORD, ETH0_NETWORK, START, accounts, canteenState, canteenWorld, firstBoot, running, seen } from './canteen';

// After chapter 2: ordered after PostgreSQL and part of it; and Ibrahim
// made it wait for the network, "to be safe".
export const MENU_UNIT_SLOW = (t: Translate) => `[Unit]
Description=${t('canteen-menu-description')}
After=network-online.target postgresql.service
Wants=network-online.target postgresql.service
PartOf=postgresql.service

[Service]
User=menu
WorkingDirectory=/srv/menu
EnvironmentFile=/etc/menu/menu.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target`;

// The second card, for the backup line: configured, but not wired yet.
export const ETH1_NETWORK = `[Match]
Name=eth1

[Network]
DHCP=yes`;

const NOW = Date.UTC(2027, 10, 22, 9, 5, 0);
const sd = (j: Game) => systemd(j)!;
const rebooted = (j: Game) => sd(j).boot > 1;
const fast = (j: Game) => (sd(j).lastBoot?.userspace ?? Infinity) < 30_000;

export const slowBoot: Chapter = {
  id: 'slow-boot',
  number: 3,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps', 'mv', 'rm', 'cp',
    'systemctl', 'journalctl', 'systemd-analyze', 'networkctl', 'reboot', 'curl', 'ss', 'ip',
  ],
  home: HOME,
  welcome: 'message_from_ibrahim.txt',
  names: true,
  final: 'end',
  steps: ['blame', 'no-carrier', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) =>
    canteenState(
      t,
      { postgres: 702, boot: Date.UTC(2027, 10, 22, 8, 31, 0) },
      { lo: { type: 'loopback', carrier: true }, eth0: { type: 'ether', carrier: true }, eth1: { type: 'ether', carrier: false } },
    ),
  initialise: (j) => firstBoot(j, NOW),
  createWorld: (t) =>
    canteenWorld(t, {
      menuUnit: MENU_UNIT_SLOW(t),
      welcome: { 'message_from_ibrahim.txt': t('slow-boot-message-ibrahim') },
      network: { '10-eth0.network': ETH0_NETWORK, '20-eth1.network': ETH1_NETWORK },
    }),
  events: [
    {
      id: 'blame',
      condition: (j) => seen(j, 'systemd-networkd-wait-online.service') && seen(j, '2min'),
      message: (j) => j.t('slow-boot-event-blame'),
    },
    {
      id: 'no-carrier',
      condition: (j) => seen(j, 'no-carrier'),
      message: (j) => j.t('slow-boot-event-no-carrier'),
    },
    {
      id: 'menu-only',
      condition: (j) =>
        rebooted(j) && !fast(j) && !(sd(j).services.menu.deps?.after ?? []).map(key).includes('network-online.target'),
      message: (j) => j.t('slow-boot-event-menu-only'),
    },
    {
      id: 'disabled',
      condition: (j) => rebooted(j) && fast(j) && !sd(j).services['systemd-networkd-wait-online'].active,
      message: (j) => j.t('slow-boot-event-disabled'),
    },
    {
      id: 'end',
      condition: (j) =>
        rebooted(j) && fast(j) && sd(j).checkedAfterBoot === true && running(j, 'menu') && running(j, 'postgresql') && running(j, 'nginx'),
      message: (j) => j.t('slow-boot-event-end'),
    },
  ],
};

export { START };
