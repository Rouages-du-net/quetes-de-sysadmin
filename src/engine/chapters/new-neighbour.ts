// Story "The Language Café", chapter "New Neighbour": kettle runs Rocky
// Linux 10, and the café's screen should show its site by tonight. A
// Debian sysadmin finds the other family's tools: /etc/os-release, dnf
// (install httpd), systemctl enable --now, and firewalld: http and https
// allowed at runtime AND in the permanent configuration, then checked from
// the noticeboard (curl).
// Objective checked on the state: httpd installed, running and enabled;
// firewalld running; the public zone allows 80 and 443 now and after a
// reload; SELinux still enforcing; the noticeboard gets an answer from httpd.
// False leads: apt (command not found), a runtime-only rule (lost at the
// next --reload), a permanent-only rule (not active until then), firewalld
// stopped, setenforce 0.
// Sources: https://docs.rockylinux.org/guides/security/firewalld-beginners/,
// https://dnf.readthedocs.io/en/latest/command_ref.html, firewall-cmd(1).

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { firewalld } from '../firewalld';
import {
  HOME, PASSWORD, SITE, enforcing, enforcingAtBoot, firewallUp, httpdEnabled, httpdUp, initialiseKettle, installed, kettle, kettleAccounts, kettleState, kettleWorld, noticeboardHost, openToAll, passTime, reach, seen,
} from './language-cafe';

const curls = (j: Game) => ((kettle(j).state.cafeCurls ?? []) as { from: string; port: number; code: number }[]).filter((c) => c.from !== kettle(j).host);
const both = (j: Game, port: number) => openToAll(j, port, 'runtime') && openToAll(j, port, 'permanent');

export const newNeighbour: Chapter = {
  id: 'new-neighbour',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'curl', 'ssh', 'exit', 'hostnamectl', 'uname', 'dnf', 'rpm', 'firewall-cmd', 'getenforce', 'setenforce', 'sestatus'],
  home: HOME,
  welcome: 'message_from_dilnoza.txt',
  names: true,
  final: 'end',
  steps: ['rocky', 'installed', 'running', 'blocked', 'runtime-only', 'permanent-only', 'reached', 'end'],
  password: PASSWORD,
  accounts: kettleAccounts(1),
  state: (t) => kettleState(t, 1),
  initialise: (j) => initialiseKettle(j, 1),
  hosts: { noticeboard: noticeboardHost() },
  createWorld: (t) =>
    kettleWorld(t, 1, {
      'message_from_dilnoza.txt': f(t('new-neighbour-message-dilnoza')),
      'notes_from_seun.txt': f(t('new-neighbour-notes-seun')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'debian', condition: (j) => seen(j, /-bash: (apt|apt-get|apt-cache|dpkg|ufw|a2ensite|a2enmod|apache2ctl): command not found/), message: (j) => j.t('new-neighbour-event-debian') },
    { id: 'rocky', condition: (j) => seen(j, 'Rocky Linux'), message: (j) => j.t('new-neighbour-event-rocky') },
    { id: 'installed', condition: (j) => installed(j, 'httpd'), message: (j) => j.t('new-neighbour-event-installed') },
    { id: 'running', condition: (j) => httpdUp(j) && httpdEnabled(j), message: (j) => j.t('new-neighbour-event-running') },
    { id: 'not-enabled', condition: (j) => httpdUp(j) && !httpdEnabled(j), message: (j) => j.t('new-neighbour-event-not-enabled') },
    { id: 'blocked', condition: (j) => curls(j).some((c) => c.code === 0 && c.port === 80) && !openToAll(j, 80, 'runtime'), message: (j) => j.t('new-neighbour-event-blocked') },
    { id: 'lost', condition: (j) => (firewalld(kettle(j))?.lost ?? []).some((x) => ['http', 'https', '80/tcp', '443/tcp'].includes(x)), message: (j) => j.t('new-neighbour-event-lost') },
    { id: 'runtime-only', condition: (j) => openToAll(j, 80, 'runtime') && !openToAll(j, 80, 'permanent'), message: (j) => j.t('new-neighbour-event-runtime-only') },
    { id: 'permanent-only', condition: (j) => openToAll(j, 80, 'permanent') && !openToAll(j, 80, 'runtime'), message: (j) => j.t('new-neighbour-event-permanent-only') },
    { id: 'firewall-off', condition: (j) => !firewallUp(j), message: (j) => j.t('new-neighbour-event-firewall-off') },
    { id: 'selinux-off', condition: (j) => !enforcing(j) || !enforcingAtBoot(j), message: (j) => j.t('new-neighbour-event-selinux-off') },
    { id: 'reached', condition: (j) => curls(j).some((c) => c.code > 0 && c.port === 80), message: (j) => j.t('new-neighbour-event-reached') },
    {
      id: 'end',
      condition: (j) =>
        installed(j, 'httpd') &&
        httpdUp(j) &&
        httpdEnabled(j) &&
        firewallUp(j) &&
        both(j, 80) &&
        both(j, 443) &&
        enforcing(j) &&
        enforcingAtBoot(j) &&
        reach(j, 'office', SITE, 80) > 0 &&
        reach(j, 'office', SITE, 80, '/', 'permanent') > 0,
      message: (j) => j.t('new-neighbour-event-end'),
    },
  ],
};
