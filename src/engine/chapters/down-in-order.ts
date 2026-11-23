// Story "The Climbing Wall", chapter "Down in Order": since the cut, the NAS
// (harness, the photo archive and the signed waivers) is plugged into the
// same UPS as belay, but nothing tells it when to stop. It must become
// upsmon's secondary: belay's upsd listening on the office network (LISTEN
// is read only at start: a restart, not a reload), an account for it in
// upsd.users (upsmon secondary), belay's firewall letting harness in on
// 3493 and nobody else, harness's upsmon.conf (MONITOR hallups@belay …
// secondary), its nut-monitor enabled and started. Then the drill: belay
// waits for harness to log out (HOSTSYNC), shuts down, and tells the UPS to
// cut its output after offdelay seconds; harness takes two and a half
// minutes to stop, so the default 20 s cut it mid-shutdown: offdelay in
// ups.conf long enough (and ondelay greater, as usbhid-ups(8) says).
// Objective checked on the state: harness logged into hallups as a
// secondary; 3493 not reachable from the internet; no other primary; a
// drill since, where both halted cleanly, came back by themselves, and
// harness's upsmon logged in again.
// False leads: LISTEN 0.0.0.0 with the port open to all, a reload after
// changing LISTEN, harness given primary rights, nut-monitor started but
// not enabled (it doesn't come back after the drill), ondelay not greater
// than offdelay.
// Sources: https://networkupstools.org/docs/man/upsd.conf.html (LISTEN),
// https://networkupstools.org/docs/man/upsd.users.html,
// https://networkupstools.org/docs/man/upsmon.html (shutdown sequence,
// HOSTSYNC), https://networkupstools.org/docs/man/usbhid-ups.html
// (offdelay, ondelay), https://networkupstools.org/docs/man/nut.conf.html.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import {
  BELAY, HOME, PASSWORD, belayAccounts, belayState, belayWorld, fileUps, harnessAllowed, harnessHost, initialiseStory, lastDrill, machine, nut, passTime, secondaryOk, seen, story, upsdExposed, fileMon,
} from './climbing-wall';
import { readUpsdConf } from '../nut';

const upsd = (j: Game) => nut(machine(j, 'belay')!).upsd;
const listensOffice = (j: Game) => !!upsd(j)?.listen.some((a) => a.address === BELAY.office || a.address === '0.0.0.0');
const fileListens = (j: Game) => readUpsdConf(machine(j, 'belay')!.read('/etc/nut/upsd.conf')).listen.some((a) => a.address === BELAY.office || a.address === '0.0.0.0' || a.address === '*');
const extraPrimary = (j: Game) => {
  const users = upsd(j)?.users ?? {};
  const harnessPrimary = fileMon(j, 'harness').monitors.some((m) => m.primary);
  return Object.entries(users).some(([u, x]) => u !== 'upsmon' && x.upsmon === 'primary') || harnessPrimary;
};
const secondaryUser = (j: Game) => Object.entries(upsd(j)?.users ?? {}).some(([u, x]) => u !== 'upsmon' && x.upsmon === 'secondary' && !!x.password);
const ondelayLow = (j: Game) => {
  const s = fileUps(j).hallups;
  return !!s && (s.offdelay ?? 20) >= (s.ondelay ?? 30);
};
const goodDrills = (j: Game) => story(j).drills.filter((d) => d.watching && d.hosts.harness);
const enabled = (j: Game) => !!(machine(j, 'harness')!.state.systemd as { services: Record<string, { active: boolean }> }).services['nut-monitor'].active;

export const downInOrder: Chapter = {
  id: 'down-in-order',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'ip', 'ssh', 'ufw', 'upsc', 'upsmon', 'upsd', 'upsdrvctl', 'ipmitool', 'exit'],
  home: HOME,
  welcome: 'message_from_akosua.txt',
  names: true,
  final: 'end',
  steps: ['listen', 'secondary-user', 'firewall', 'secondary', 'drill-crash', 'end'],
  password: PASSWORD,
  accounts: belayAccounts,
  hosts: { harness: harnessHost(2) },
  state: (t) => belayState(t, 2),
  initialise: (j) => initialiseStory(j, 2),
  createWorld: (t) =>
    belayWorld(t, 2, {
      'message_from_akosua.txt': f(t('down-in-order-message-akosua')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'listen-restart', condition: (j) => fileListens(j) && !listensOffice(j) && !!upsd(j), message: (j) => j.t('down-in-order-event-listen-restart') },
    { id: 'listen', condition: listensOffice, message: (j) => j.t('down-in-order-event-listen') },
    { id: 'exposed', condition: upsdExposed, message: (j) => j.t('down-in-order-event-exposed') },
    { id: 'secondary-user', condition: secondaryUser, message: (j) => j.t('down-in-order-event-secondary-user') },
    { id: 'too-much', condition: extraPrimary, message: (j) => j.t('down-in-order-event-too-much') },
    { id: 'firewall', condition: (j) => listensOffice(j) && harnessAllowed(j), message: (j) => j.t('down-in-order-event-firewall') },
    { id: 'blocked', condition: (j) => listensOffice(j) && !harnessAllowed(j) && seen(j, 'Connection timed out'), message: (j) => j.t('down-in-order-event-blocked') },
    { id: 'secondary', condition: secondaryOk, message: (j) => j.t('down-in-order-event-secondary') },
    { id: 'drill-crash', condition: (j) => goodDrills(j).some((d) => d.hosts.harness.crashed), message: (j) => j.t('down-in-order-event-drill-crash') },
    { id: 'ondelay', condition: ondelayLow, message: (j) => j.t('down-in-order-event-ondelay') },
    { id: 'not-enabled', condition: (j) => goodDrills(j).some((d) => !d.secondaryBack) && !enabled(j), message: (j) => j.t('down-in-order-event-not-enabled') },
    {
      id: 'end',
      condition: (j) => {
        const d = lastDrill(j);
        return (
          !!d && d.watching && !!d.hosts.harness && d.hosts.harness.halted && !d.hosts.harness.crashed && d.hosts.harness.alone && d.hosts.belay.halted && !d.hosts.belay.crashed && d.hosts.belay.alone && d.secondaryBack &&
          secondaryOk(j) && !upsdExposed(j) && !extraPrimary(j) && !ondelayLow(j)
        );
      },
      message: (j) => j.t('down-in-order-event-end'),
    },
  ],
};
