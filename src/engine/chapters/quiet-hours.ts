// Story "The Bike Share", chapter "Quiet Hours": the alerts exist, but the
// Alertmanager Aroha configured sends them all to #team, and every minute:
// its only route matches severity="critical", a value no rule uses (they
// say page or warning), and repeat_interval is 1m, so the same disk warning
// fills the channel while Tuesday's NodeDown of saddle never paged anyone.
// And at 10:00, hub goes down for two hours of planned maintenance (a
// disk replaced). You read the relay's log, the routing tree (amtool config
// routes, amtool config routes test), fix the route's matcher and the
// repeat interval (amtool check-config, systemctl reload
// prometheus-alertmanager), then silence hub's alerts for the maintenance
// window (amtool silence add instance=… --duration=… --comment=…, amtool
// silence query) rather than deleting the rule or stopping Prometheus.
// Objective checked on the state: in the running configuration, a page
// alert goes to on-call and a warning to team, neither repeated more often
// than every hour; a silence covers hub's NodeDown from 10:00 to 11:30,
// and nothing of saddle's or gauge's; Prometheus and the Alertmanager run,
// NodeDown is still a loaded rule; the file is the one running.
// Sources: https://prometheus.io/docs/alerting/latest/configuration/#route,
// https://prometheus.io/docs/alerting/latest/alertmanager/#silences,
// https://github.com/prometheus/alertmanager#amtool.

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { machineName } from '../machines';
import type { Labels } from '../promql';
import { am, matchAll, readAmConfig, routesFor, silenceState, AM_CONFIG, type Silence } from '../alertmanager';
import { prom } from '../prometheus';
import { HOME, PASSWORD, MAINTENANCE_FROM, MAINTENANCE_TO, gaugeAccounts, gaugeState, gaugeWorld, initialiseGauge, saddleHost, hubHost, passTime, seen, running, typed, now } from './bike-share';

const alertOf = (j: Game, id: 'saddle' | 'hub' | 'gauge', name: string, severity: string): Labels => ({
  alertname: name,
  instance: id === 'gauge' ? 'localhost:9100' : `${machineName(j.t, id)}.internal:9100`,
  job: 'node',
  monitor: 'bikes',
  severity,
});
const page = (j: Game) => alertOf(j, 'saddle', 'NodeDown', 'page');
const warning = (j: Game) => ({ ...alertOf(j, 'saddle', 'DiskAlmostFull', 'warning'), mountpoint: '/var/lib/rental', device: '/dev/vdb1', fstype: 'ext4' });

const config = (j: Game) => am(j)?.config ?? null;
const routing = (j: Game) => {
  const c = config(j);
  if (!c) return false;
  const p = routesFor(c.route, page(j)).map((r) => r.receiver);
  const w = routesFor(c.route, warning(j)).map((r) => r.receiver);
  return p.includes('on-call') && w.includes('team') && !w.includes('on-call');
};
const repeats = (j: Game) => {
  const c = config(j);
  if (!c) return false;
  return [...routesFor(c.route, page(j)), ...routesFor(c.route, warning(j))].every((r) => r.repeatInterval >= 3_600_000);
};
const live = (j: Game): Silence[] => (am(j)?.silences ?? []).filter((x) => silenceState(x, now(j)) !== 'expired');
const covers = (x: Silence, l: Labels) => matchAll(l, x.matchers);
const hubDown = (j: Game) => alertOf(j, 'hub', 'NodeDown', 'page');
const others = (j: Game) => [page(j), warning(j), alertOf(j, 'gauge', 'NodeDown', 'page'), { ...alertOf(j, 'saddle', 'HighErrorRate', 'page'), instance: `${machineName(j.t, 'saddle')}.internal:3000`, job: 'rental' }];
const tooBroad = (j: Game) => live(j).some((x) => others(j).some((l) => covers(x, l)));
const silenced = (j: Game) => live(j).some((x) => covers(x, hubDown(j)) && x.startsAt <= MAINTENANCE_FROM && x.endsAt >= MAINTENANCE_TO);
const tooShort = (j: Game) => live(j).some((x) => covers(x, hubDown(j)) && (x.startsAt > MAINTENANCE_FROM || x.endsAt < MAINTENANCE_TO));
const nodeDownRule = (j: Game) => (prom(j)?.groups ?? []).some((g) => g.rules.some((r) => r.kind === 'alert' && /\bup\b/.test(r.exprText)));
const fileLoaded = (j: Game) => {
  const text = j.read(AM_CONFIG) ?? '';
  try {
    readAmConfig(text);
  } catch {
    return false;
  }
  return text === am(j)?.configText;
};
const hubPaged = (j: Game) => (am(j)?.deliveries ?? []).some((d) => d.receiver === 'on-call' && d.alerts.some((a) => a.status === 'firing' && a.labels.alertname === 'NodeDown' && (a.labels.instance ?? '').startsWith(machineName(j.t, 'hub'))));

export const quietHours: Chapter = {
  id: 'quiet-hours',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'curl', 'jq', 'promtool', 'amtool', 'systemctl', 'journalctl', 'kill', 'ssh', 'sleep', 'exit'],
  home: HOME,
  welcome: 'message_from_ngozi.txt',
  names: true,
  final: 'end',
  steps: ['repeats', 'routes', 'routing', 'repeat-interval', 'silenced', 'end'],
  password: PASSWORD,
  accounts: gaugeAccounts,
  state: (t) => gaugeState(t, 3),
  initialise: initialiseGauge,
  hosts: { saddle: saddleHost(3), hub: hubHost(3) },
  createWorld: (t) => gaugeWorld(t, 3, { 'message_from_ngozi.txt': f(t('quiet-hours-message-ngozi')) }),
  afterCommand: passTime,
  events: [
    { id: 'repeats', condition: (j) => (j.last.output.match(/#team FIRING DiskAlmostFull/g) ?? []).length >= 3, message: (j) => j.t('quiet-hours-event-repeats') },
    { id: 'routes', condition: (j) => seen(j, 'Routing tree:') || (/config routes test/.test(typed(j)) && /severity=.?page/.test(typed(j)) && seen(j, /^team$/m)), message: (j) => j.t('quiet-hours-event-routes') },
    { id: 'am-invalid', condition: (j) => seen(j, /^Checking '.*'  FAILED/m), message: (j) => j.t('quiet-hours-event-am-invalid') },
    { id: 'am-check', condition: (j) => seen(j, /^Checking '.*'  SUCCESS/m), message: (j) => j.t('quiet-hours-event-am-check') },
    { id: 'am-not-reloaded', condition: (j) => !fileLoaded(j) && seen(j, /^Checking '.*'  SUCCESS/m), message: (j) => j.t('quiet-hours-event-am-not-reloaded') },
    { id: 'am-bad-reload', condition: (j) => am(j)?.lastReload.ok === false, message: (j) => j.t('quiet-hours-event-am-bad-reload') },
    { id: 'routing', condition: routing, message: (j) => j.t('quiet-hours-event-routing') },
    { id: 'repeat-interval', condition: repeats, message: (j) => j.t('quiet-hours-event-repeat-interval') },
    { id: 'stopped', condition: (j) => !running(j, 'prometheus') || !running(j, 'prometheus-alertmanager'), message: (j) => j.t('quiet-hours-event-stopped') },
    { id: 'rule-removed', condition: (j) => !nodeDownRule(j), message: (j) => j.t('quiet-hours-event-rule-removed') },
    { id: 'too-broad', condition: tooBroad, message: (j) => j.t('quiet-hours-event-too-broad') },
    { id: 'too-short', condition: (j) => tooShort(j) && !silenced(j), message: (j) => j.t('quiet-hours-event-too-short') },
    { id: 'silenced', condition: silenced, message: (j) => j.t('quiet-hours-event-silenced') },
    { id: 'paged', condition: hubPaged, message: (j) => j.t('quiet-hours-event-paged') },
    {
      id: 'end',
      condition: (j) => routing(j) && repeats(j) && silenced(j) && !tooBroad(j) && running(j, 'prometheus') && running(j, 'prometheus-alertmanager') && nodeDownRule(j) && fileLoaded(j),
      message: (j) => j.t('quiet-hours-event-end'),
    },
  ],
};
