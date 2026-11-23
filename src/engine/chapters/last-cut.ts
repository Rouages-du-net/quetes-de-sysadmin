// Story "The Climbing Wall", chapter "The Last Cut": on 16 November a storm
// cut the hall's mains for 83 minutes; belay ran on the UPS for 49 of them,
// then died without shutting down. Its upsmon watched eaton@localhost: the
// old UPS's name, gone since Haruto renamed the section [hallups] in 2030.
// upsmon has logged "does not exist on server localhost" ever since (Haruto
// even throttled the line); a UPS it never heard from is never critical, so
// it never shut anything down.
// The fix: MONITOR names hallups (or the section is named eaton again),
// upsmon reloaded or restarted, logged in as a primary; then a drill after
// hours (upsmon -c fsd, NUT's documented test: FSD, shutdown, the UPS cut
// and given back). After a clean shutdown, belay's firmware policy
// "previous" keeps it off: ipmitool chassis policy always-on, and a second
// drill where it comes back alone.
// Objective checked on the state: upsmon logged into hallups as a primary
// with power value at least 1, MINSUPPLIES at least 1, a SHUTDOWNCMD that
// halts, the power restore policy always-on, and a drill since upsmon was
// watching where belay halted cleanly and came back by itself.
// False leads: MINSUPPLIES 0 (upsmon never shuts down), a SHUTDOWNCMD that
// does nothing, nut-monitor stopped or disabled, a drill while upsmon is
// still blind (it shuts down all the same: the drill doesn't prove the
// detection), upsdrvctl shutdown typed by hand (the load is cut).
// Sources: https://networkupstools.org/docs/man/upsmon.html (-c fsd),
// https://networkupstools.org/docs/man/upsmon.conf.html (MONITOR, MINSUPPLIES),
// https://networkupstools.org/docs/user-manual.chunked/Configuration_notes.html
// ("Testing shutdowns"), ipmitool(1) (chassis policy).

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { shutdownKind } from '../nut';
import { HOME, PASSWORD, belayAccounts, belayState, belayWorld, belayMon, fileMon, initialiseStory, lastDrill, passTime, power, seen, story, watching, machine } from './climbing-wall';

const policy = (j: Game) => power(j).hosts.belay.policy;
const confOk = (j: Game) => {
  const c = belayMon(j);
  return !!c && c.minsupplies >= 1 && shutdownKind(c.shutdowncmd) === 'halt';
};
const fileBad = (j: Game) => fileMon(j).minsupplies < 1 || shutdownKind(fileMon(j).shutdowncmd) !== 'halt';
const watchedSince = (j: Game) => (story(j).drills.length ? story(j).drills : []).filter((d) => d.watching);
const cleanDrill = (j: Game) => watchedSince(j).some((d) => d.hosts.belay?.halted && !d.hosts.belay.crashed);
const aloneDrill = (j: Game) => watchedSince(j).some((d) => d.hosts.belay?.halted && !d.hosts.belay.crashed && d.hosts.belay.alone);
const monitorDown = (j: Game) => {
  const s = machine(j, 'belay')!;
  const svc = (s.state.systemd as { services: Record<string, { state: string; active: boolean }> }).services['nut-monitor'];
  return svc.state !== 'active' || !svc.active;
};

export const lastCut: Chapter = {
  id: 'last-cut',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'upsc', 'upsmon', 'upsdrvctl', 'ipmitool', 'exit'],
  home: HOME,
  welcome: 'message_from_nkechi.txt',
  names: true,
  final: 'end',
  steps: ['blind', 'renamed', 'watching', 'drill', 'stayed-off', 'policy', 'end'],
  password: PASSWORD,
  accounts: belayAccounts,
  state: (t) => belayState(t, 1),
  initialise: (j) => initialiseStory(j, 1),
  createWorld: (t) =>
    belayWorld(t, 1, {
      'message_from_nkechi.txt': f(t('last-cut-message-nkechi')),
      'notes_from_haruto.txt': f(t('last-cut-notes-haruto')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'blind', condition: (j) => seen(j, 'does not exist on server localhost') || seen(j, "Can't login to UPS [eaton@localhost]"), message: (j) => j.t('last-cut-event-blind') },
    { id: 'renamed', condition: (j) => seen(j, /^hallups$/m) || seen(j, 'hallups: APC Back-UPS'), message: (j) => j.t('last-cut-event-renamed') },
    { id: 'minsupplies', condition: (j) => (belayMon(j)?.minsupplies ?? 1) < 1 || fileMon(j).minsupplies < 1, message: (j) => j.t('last-cut-event-minsupplies') },
    { id: 'no-shutdown', condition: (j) => shutdownKind(fileMon(j).shutdowncmd) !== 'halt', message: (j) => j.t('last-cut-event-no-shutdown') },
    { id: 'monitor-down', condition: monitorDown, message: (j) => j.t('last-cut-event-monitor-down') },
    { id: 'killed', condition: (j) => !!machine(j, 'belay')!.state.killTyped, message: (j) => j.t('last-cut-event-killed') },
    { id: 'watching', condition: watching, message: (j) => j.t('last-cut-event-watching') },
    { id: 'blind-drill', condition: (j) => story(j).drills.some((d) => !d.watching), message: (j) => j.t('last-cut-event-blind-drill') },
    { id: 'drill', condition: cleanDrill, message: (j) => j.t('last-cut-event-drill') },
    { id: 'stayed-off', condition: (j) => watchedSince(j).some((d) => d.hosts.belay?.button), message: (j) => j.t('last-cut-event-stayed-off') },
    { id: 'policy', condition: (j) => policy(j) === 'always-on', message: (j) => j.t('last-cut-event-policy') },
    {
      id: 'end',
      condition: (j) => watching(j) && confOk(j) && !fileBad(j) && policy(j) === 'always-on' && aloneDrill(j) && !!lastDrill(j)?.hosts.belay?.alone,
      message: (j) => j.t('last-cut-event-end'),
    },
  ],
};
