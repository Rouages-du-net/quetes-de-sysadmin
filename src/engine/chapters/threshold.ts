// Story "The Bike Share", chapter "The Threshold": Prometheus sees every
// machine now, but nobody looks at it. Ngozi wants two alerts: a disk with
// less than 10 % free (hub's has 7 % since the April backup), and the
// rental app answering errors to more than 5 % of its requests (since this
// morning's release, about one return in two fails). You explore with
// PromQL (curl --data-urlencode 'query=…' or promtool query instant):
// node_filesystem_avail_bytes / node_filesystem_size_bytes, then
// rate(http_requests_total{status=~"5.."}[5m]) against all requests,
// summed (sum by (job)); you write the rules in /etc/prometheus/rules/
// (alert, expr, for, labels, annotations), check them (promtool check
// rules), reload, and watch them go pending, then firing
// (/api/v1/alerts); then the fixes (the old backup removed, the app
// restarted on Tomás's corrected release) make them resolve.
// The rules are tried on made-up days (bike-share.ts, trial()): the disk
// rule must fire for any machine at 7 % free and not at 12 % nor for
// /run; the error rule must fire during a lasting incident and stay quiet
// on a normal day, whose short bursts (two minutes every quarter of an
// hour, when a station reconnects) a rule without `for:` pages for.
// Traps: rate() on a gauge, alerting on a counter's raw value (it only
// grows), dividing each series by itself (no sum), status!="200" (201
// and 404 aren't errors), no `for:`.
// Objective checked on the state: both rules loaded, well behaved on the
// made-up days, with a severity label and a summary; the disk alert has
// fired and resolved; the app runs the fixed release and no error alert is
// active; the rule files on disk are the ones loaded.
// Sources: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/,
// https://prometheus.io/docs/prometheus/latest/querying/functions/#rate,
// https://prometheus.io/docs/practices/alerting/,
// https://prometheus.io/docs/prometheus/latest/querying/api/#alerts.

import { f, type Chapter, type Directory } from '../world';
import type { Game } from '../shell';
import type { Node } from '../promql';
import { prom } from '../prometheus';
import {
  HOME,
  PASSWORD,
  PHOTOS,
  gaugeAccounts,
  gaugeState,
  gaugeWorld,
  initialiseGauge,
  saddleHost,
  hubHost,
  passTime,
  seen,
  host,
  typed,
  diskRuleOk,
  errorRuleOk,
  errorRuleQuiet,
  normalDayFirings,
  loadedAlertRules,
  wellLabelled,
  configSaved,
} from './bike-share';
import { machineName } from '../machines';

// A selector of a counter (…_total) used outside rate, irate or increase.
function rawCounter(n: Node, inside = false): boolean {
  switch (n.kind) {
    case 'selector':
      return !inside && /_total$/.test(n.name ?? '');
    case 'call':
      return n.args.some((a) => rawCounter(a, ['rate', 'irate', 'increase'].includes(n.fn)));
    case 'aggregate':
    case 'unary':
    case 'paren':
      return rawCounter(n.expr, inside);
    case 'binary':
      return rawCounter(n.lhs, inside) || rawCounter(n.rhs, inside);
    default:
      return false;
  }
}
// rate() (or irate, increase) of a gauge.
function rateOfGauge(n: Node): boolean {
  switch (n.kind) {
    case 'call':
      return (['rate', 'irate', 'increase'].includes(n.fn) && n.args[0]?.kind === 'selector' && !/(_total|_sum|_count|_bucket)$/.test(n.args[0].name ?? '')) || n.args.some(rateOfGauge);
    case 'aggregate':
    case 'unary':
    case 'paren':
      return rateOfGauge(n.expr);
    case 'binary':
      return rateOfGauge(n.lhs) || rateOfGauge(n.rhs);
    default:
      return false;
  }
}
// A division of rates without any aggregation: each series divided by itself.
function unsummed(n: Node): boolean {
  if (n.kind === 'paren') return unsummed(n.expr);
  if (n.kind !== 'binary') return false;
  if (n.op === '/') {
    const plain = (x: Node): boolean => (x.kind === 'paren' ? plain(x.expr) : x.kind === 'call' && ['rate', 'irate', 'increase'].includes(x.fn));
    if (plain(n.lhs) && plain(n.rhs)) return true;
  }
  return unsummed(n.lhs) || unsummed(n.rhs);
}

const mentions = (j: Game, metric: string) => loadedAlertRules(j).filter((r) => r.exprText.includes(metric));
const diskRules = (j: Game) => loadedAlertRules(j).filter((r) => diskRuleOk(j, r));
const errorRules = (j: Game) => loadedAlertRules(j).filter((r) => errorRuleOk(j, r));
const history = (j: Game) => prom(j)?.history ?? [];
const hubName = (j: Game) => machineName(j.t, 'hub');
const diskFired = (j: Game) => history(j).some((h) => h.to === 'firing' && diskRules(j).some((r) => r.exprText === h.expr) && (h.labels.instance ?? '').startsWith(hubName(j)));
const diskResolved = (j: Game) => {
  const fired = history(j).find((h) => h.to === 'firing' && diskRules(j).some((r) => r.exprText === h.expr) && (h.labels.instance ?? '').startsWith(hubName(j)));
  return !!fired && history(j).some((h) => h.t > fired.t && h.rule === fired.rule && h.to === 'resolved' && h.labels.instance === fired.labels.instance);
};
const errorFired = (j: Game) => history(j).some((h) => h.to === 'firing' && errorRules(j).some((r) => r.exprText === h.expr));
const errorActive = (j: Game) => {
  const names = errorRules(j).map((r) => r.name);
  return loadedAlertRules(j).some((r) => names.includes(r.name) && Object.values(r.alerts).some((a) => a.resolvedAt === undefined && a.state === 'firing'));
};
// The stations' photos (four months) are still on hub.
const photosKept = (j: Game) => {
  const n = host(j, 'hub').find(PHOTOS);
  return n?.type === 'directory' && Object.keys(n.children).length >= 4;
};
function restorePhotos(j: Game) {
  const hub = host(j, 'hub');
  const srv = hub.find('/srv/docks');
  const fresh = hubHost(2).createWorld(j.t);
  const photos = (((fresh.children.srv as Directory).children.docks as Directory).children.photos as Directory);
  if (srv?.type === 'directory') srv.children.photos = photos;
}
const fixed = (j: Game) => {
  const inc = (j as unknown as { principal: Game }).principal.state.incident as { to: number } | null;
  return !!inc && inc.to !== Infinity;
};

export const threshold: Chapter = {
  id: 'threshold',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'curl', 'jq', 'promtool', 'systemctl', 'journalctl', 'kill', 'ssh', 'df', 'sleep', 'exit'],
  home: HOME,
  welcome: 'message_from_ngozi.txt',
  names: true,
  final: 'end',
  steps: ['disk-query', 'error-query', 'disk-rule', 'error-rule', 'disk-firing', 'disk-resolved', 'error-firing', 'error-resolved', 'end'],
  password: PASSWORD,
  accounts: gaugeAccounts,
  state: (t) => gaugeState(t, 2),
  initialise: initialiseGauge,
  hosts: { saddle: saddleHost(2), hub: hubHost(2) },
  createWorld: (t) =>
    gaugeWorld(t, 2, {
      'message_from_ngozi.txt': f(t('threshold-message-ngozi')),
      'note_from_tomas.txt': f(t('threshold-note-tomas')),
    }),
  afterCommand: passTime,
  events: [
    { id: 'disk-query', condition: (j) => typed(j).includes('node_filesystem_avail_bytes') && (seen(j, '"resultType":"vector"') || seen(j, / => [\d.e+-]+ @\[/)), message: (j) => j.t('threshold-event-disk-query') },
    { id: 'error-query', condition: (j) => /http_requests_total/.test(typed(j)) && /\b(rate|irate|increase)\(/.test(typed(j)) && (seen(j, '"resultType":"vector"') || seen(j, / => [\d.e+-]+ @\[/)), message: (j) => j.t('threshold-event-error-query') },
    { id: 'rate-gauge', condition: (j) => seen(j, 'metric might not be a counter') || loadedAlertRules(j).some((r) => rateOfGauge(r.expr)), message: (j) => j.t('threshold-event-rate-gauge') },
    { id: 'raw-counter', condition: (j) => loadedAlertRules(j).some((r) => rawCounter(r.expr)), message: (j) => j.t('threshold-event-raw-counter') },
    { id: 'unsummed', condition: (j) => mentions(j, 'http_requests_total').some((r) => unsummed(r.expr) && !errorRuleQuiet(j, r)), message: (j) => j.t('threshold-event-unsummed') },
    { id: 'not-errors', condition: (j) => mentions(j, 'http_requests_total').some((r) => /status\s*!=\s*"200"|status\s*!~/.test(r.exprText) && !errorRuleQuiet(j, r)), message: (j) => j.t('threshold-event-not-errors') },
    { id: 'no-for', condition: (j) => mentions(j, 'http_requests_total').some((r) => r.for === 0 && !rawCounter(r.expr) && !unsummed(r.expr) && normalDayFirings(j, r) > 1), message: (j) => j.t('threshold-event-no-for') },
    { id: 'disk-rule', condition: (j) => diskRules(j).length > 0, message: (j) => j.t('threshold-event-disk-rule') },
    { id: 'error-rule', condition: (j) => errorRules(j).length > 0, message: (j) => j.t('threshold-event-error-rule') },
    { id: 'labels', condition: (j) => [...diskRules(j), ...errorRules(j)].some((r) => !wellLabelled(r)), message: (j) => j.t('threshold-event-labels') },
    { id: 'pending', condition: (j) => seen(j, /"state": ?"pending"|\bpending$/m), message: (j) => j.t('threshold-event-pending') },
    { id: 'disk-firing', condition: diskFired, message: (j) => j.t('threshold-event-disk-firing') },
    // The photos deleted: Ngozi brings them back from the off-site copy (and the disk fills again).
    { id: 'photos', condition: (j) => !photosKept(j), action: restorePhotos, message: (j) => j.t('threshold-event-photos') },
    { id: 'disk-resolved', condition: diskResolved, message: (j) => j.t('threshold-event-disk-resolved') },
    { id: 'restart-early', condition: (j) => fixed(j) && !errorFired(j), message: (j) => j.t('threshold-event-restart-early') },
    { id: 'error-firing', condition: errorFired, message: (j) => j.t('threshold-event-error-firing') },
    { id: 'error-resolved', condition: (j) => fixed(j) && errorRules(j).length > 0 && !errorActive(j), message: (j) => j.t('threshold-event-error-resolved') },
    {
      id: 'end',
      condition: (j) => {
        const d = diskRules(j);
        const e = errorRules(j);
        return d.some(wellLabelled) && e.some(wellLabelled) && diskResolved(j) && fixed(j) && !errorActive(j) && configSaved(j);
      },
      message: (j) => j.t('threshold-event-end'),
    },
  ],
};
