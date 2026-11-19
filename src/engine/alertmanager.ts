// A machine's Alertmanager (state.alertmanager): its configuration read
// like Alertmanager 0.28 reads /etc/prometheus/alertmanager.yml (Debian's
// prometheus-alertmanager package): global, route (receiver, group_by,
// group_wait, group_interval, repeat_interval, matchers or match/match_re,
// continue, nested routes), receivers (webhook_configs, email_configs),
// inhibit_rules; the alerts Prometheus sends, grouped and routed, the
// notifications sent to the receivers (a webhook: the story's network
// answers it), silences (matchers, start, end, comment, author) and
// inhibitions. amtool talks to it (commands/prometheus.ts).
// Sources: https://prometheus.io/docs/alerting/latest/configuration/,
// https://prometheus.io/docs/alerting/latest/alertmanager/ (grouping,
// inhibition, silences), https://github.com/prometheus/alertmanager#amtool.
// Differences: webhook receivers only deliver (email, Slack… are read but
// go nowhere), no templates, no clustering, no time intervals; a
// notification is sent at once (no retries).

import type { Game } from './shell';
import { readYaml, YamlError, type Value } from './ansible';
import { labelsText, parseDuration, formatDuration, type Labels, type Matcher } from './promql';
import { metricsNet, promLog } from './prometheus';

export const ALERTMANAGER_VERSION = '0.28.1+ds';
export const AM_CONFIG = '/etc/prometheus/alertmanager.yml';
export const AM_UNIT = 'prometheus-alertmanager.service';
export const AM_PID = 845;

export interface Route {
  receiver: string;
  groupBy: string[] | '...';
  groupWait: number;
  groupInterval: number;
  repeatInterval: number;
  matchers: Matcher[];
  continue: boolean;
  routes: Route[];
  // Its place in the tree ("{}/{severity=\"page\"}/0"), for the groups' keys.
  id: string;
}
export interface Receiver {
  name: string;
  webhooks: { url: string; sendResolved: boolean }[];
  // Other integrations (email_configs…): their names, read but not delivered here.
  others: string[];
}
export interface Inhibit {
  source: Matcher[];
  target: Matcher[];
  equal: string[];
}
export interface AmConfig {
  route: Route;
  receivers: Receiver[];
  inhibit: Inhibit[];
  resolveTimeout: number;
  templates: number;
  hasGlobal: boolean;
}

export class AmConfigError extends Error {}

const isObject = (v: Value | undefined): v is Record<string, Value> => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v: Value | undefined): Value[] => (Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v]);

/** A matcher written like Alertmanager's (severity="page", team=~"ops|db", name!=x). */
export function readMatcher(text: string): Matcher | null {
  const m = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|!=|=)\s*(.*?)\s*$/.exec(text);
  if (!m) return null;
  let value = m[3];
  if (/^".*"$/.test(value)) value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  else if (/^'.*'$/.test(value)) value = value.slice(1, -1);
  if (m[2].includes('~'))
    try {
      new RegExp(`^(?:${value})$`);
    } catch {
      return null;
    }
  return { name: m[1], op: m[2] as Matcher['op'], value };
}

export const matcherText = (m: Matcher) => `${m.name}${m.op}"${m.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const lineOf = (text: string, k: string) => {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => new RegExp(`^\\s*(-\\s+)?${k}\\s*:`).test(l));
  return i + 1 || 1;
};

const KNOWN: Record<string, string[]> = {
  top: ['global', 'route', 'receivers', 'inhibit_rules', 'templates', 'time_intervals', 'mute_time_intervals'],
  route: ['receiver', 'group_by', 'group_wait', 'group_interval', 'repeat_interval', 'matchers', 'match', 'match_re', 'continue', 'routes', 'mute_time_intervals', 'active_time_intervals'],
  receiver: ['name', 'webhook_configs', 'email_configs', 'slack_configs', 'pagerduty_configs', 'opsgenie_configs', 'telegram_configs', 'msteams_configs', 'discord_configs', 'webex_configs', 'pushover_configs'],
  webhook: ['url', 'send_resolved', 'max_alerts', 'http_config', 'url_file', 'timeout'],
  inhibit: ['source_matchers', 'target_matchers', 'equal', 'source_match', 'target_match', 'source_match_re', 'target_match_re'],
};
const TYPES: Record<string, string> = { top: 'config.plain', route: 'config.plain', receiver: 'config.plain', webhook: 'config.plain', inhibit: 'config.plain' };

function fields(text: string, v: Value | undefined, kind: string, errors: string[]) {
  if (!isObject(v)) return;
  for (const k of Object.keys(v)) if (!KNOWN[kind].includes(k)) errors.push(`line ${lineOf(text, k)}: field ${k} not found in type ${TYPES[kind]}`);
}

function dur(v: Value | undefined, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const d = typeof v === 'string' ? parseDuration(v) : null;
  if (d === null) throw new AmConfigError(`not a valid duration string: "${String(v)}"`);
  return d;
}

function matchersOf(r: Record<string, Value>, newKey: string, oldKey: string, reKey: string): Matcher[] {
  const out: Matcher[] = [];
  for (const m of list(r[newKey])) {
    const x = readMatcher(String(m));
    if (!x) throw new AmConfigError(`bad matcher format: ${String(m)}`);
    out.push(x);
  }
  if (isObject(r[oldKey])) for (const [k, v] of Object.entries(r[oldKey] as Record<string, Value>)) out.push({ name: k, op: '=', value: String(v) });
  if (isObject(r[reKey])) for (const [k, v] of Object.entries(r[reKey] as Record<string, Value>)) out.push({ name: k, op: '=~', value: String(v) });
  return out;
}

/** Reads alertmanager.yml; throws AmConfigError with Alertmanager's message. */
export function readAmConfig(text: string): AmConfig {
  let raw: Value;
  try {
    raw = readYaml(text);
  } catch (e) {
    if (e instanceof YamlError) throw new AmConfigError(`yaml: line ${e.line}: ${e.message}`);
    throw e;
  }
  if (!isObject(raw)) throw new AmConfigError('no route provided in config');
  const errors: string[] = [];
  fields(text, raw, 'top', errors);
  const walk = (r: Value | undefined) => {
    fields(text, r, 'route', errors);
    if (isObject(r)) list(r.routes).forEach(walk);
  };
  walk(raw.route);
  for (const r of list(raw.receivers)) {
    fields(text, r, 'receiver', errors);
    if (isObject(r)) for (const w of list(r.webhook_configs)) fields(text, w, 'webhook', errors);
  }
  for (const i of list(raw.inhibit_rules)) fields(text, i, 'inhibit', errors);
  if (errors.length) throw new AmConfigError(`yaml: unmarshal errors:\n  ${errors.join('\n  ')}`);
  if (!isObject(raw.route)) throw new AmConfigError('no route provided in config');
  const receivers: Receiver[] = [];
  for (const r of list(raw.receivers)) {
    if (!isObject(r)) continue;
    const name = typeof r.name === 'string' ? r.name : '';
    if (!name) throw new AmConfigError('missing name in receiver');
    if (receivers.some((x) => x.name === name)) throw new AmConfigError(`notification config name "${name}" is not unique`);
    const webhooks = list(r.webhook_configs).map((w) => {
      if (!isObject(w) || typeof w.url !== 'string' || !w.url) throw new AmConfigError('one of url or url_file must be configured');
      if (!/^https?:\/\/[^/]+/.test(w.url)) throw new AmConfigError(`unsupported scheme "${w.url.split(':')[0]}" for URL`);
      return { url: w.url, sendResolved: w.send_resolved !== 'false' };
    });
    const others = Object.keys(r).filter((k) => k.endsWith('_configs') && k !== 'webhook_configs');
    receivers.push({ name, webhooks, others });
  }
  const build = (r: Record<string, Value>, parent: Route | null, id: string): Route => {
    const receiver = typeof r.receiver === 'string' && r.receiver ? r.receiver : parent?.receiver ?? '';
    if (!parent && !receiver) throw new AmConfigError('root route must specify a default receiver');
    if (receiver && !receivers.some((x) => x.name === receiver)) throw new AmConfigError(`undefined receiver "${receiver}" used in route`);
    if (!parent && (r.matchers !== undefined || r.match !== undefined || r.match_re !== undefined)) throw new AmConfigError('root route must not have any matchers');
    const groupByRaw = r.group_by === undefined ? null : list(r.group_by).map(String);
    const groupBy: string[] | '...' = groupByRaw === null ? (parent?.groupBy ?? []) : groupByRaw.includes('...') ? '...' : groupByRaw;
    if (Array.isArray(groupBy)) for (const l of groupBy) if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(l)) throw new AmConfigError(`invalid label name "${l}" in group_by list`);
    const route: Route = {
      receiver,
      groupBy,
      groupWait: dur(r.group_wait, parent?.groupWait ?? 30_000),
      groupInterval: dur(r.group_interval, parent?.groupInterval ?? 300_000),
      repeatInterval: dur(r.repeat_interval, parent?.repeatInterval ?? 4 * 3_600_000),
      matchers: parent ? matchersOf(r, 'matchers', 'match', 'match_re') : [],
      continue: r.continue === 'true',
      routes: [],
      id,
    };
    if (route.groupInterval === 0) throw new AmConfigError('group_interval cannot be zero');
    if (route.repeatInterval === 0) throw new AmConfigError('repeat_interval cannot be zero');
    route.routes = list(r.routes).filter(isObject).map((c, i) => build(c as Record<string, Value>, route, `${id}/${i}`));
    return route;
  };
  const route = build(raw.route, null, '{}');
  const inhibit: Inhibit[] = list(raw.inhibit_rules)
    .filter(isObject)
    .map((i) => {
      const x = i as Record<string, Value>;
      return { source: matchersOf(x, 'source_matchers', 'source_match', 'source_match_re'), target: matchersOf(x, 'target_matchers', 'target_match', 'target_match_re'), equal: list(x.equal).map(String) };
    });
  const global = isObject(raw.global) ? raw.global : {};
  return { route, receivers, inhibit, resolveTimeout: dur(global.resolve_timeout, 300_000), templates: list(raw.templates).length, hasGlobal: true };
}

// ——— Routing ———

const matchAll = (labels: Labels, ms: Matcher[]) =>
  ms.every((m) => {
    const v = labels[m.name] ?? '';
    if (m.op === '=') return v === m.value;
    if (m.op === '!=') return v !== m.value;
    const re = new RegExp(`^(?:${m.value})$`);
    return m.op === '=~' ? re.test(v) : !re.test(v);
  });
export { matchAll };

/** The routes an alert ends in (the deepest matching ones, following continue). */
export function routesFor(route: Route, labels: Labels): Route[] {
  const out: Route[] = [];
  for (const c of route.routes) {
    if (!matchAll(labels, c.matchers)) continue;
    out.push(...routesFor(c, labels));
    if (!c.continue) break;
  }
  return out.length ? out : [route];
}

/** The routing tree as `amtool config routes` draws it. */
export function routeTree(route: Route): string {
  const lines = ['Routing tree:'];
  const draw = (r: Route, prefix: string, last: boolean, root: boolean) => {
    const name = root ? 'default-route' : `{${r.matchers.map(matcherText).join(',')}}`;
    lines.push(`${prefix}${last ? '└── ' : '├── '}${name}${r.continue ? '  continue: true' : ''}  receiver: ${r.receiver}`);
    r.routes.forEach((c, i) => draw(c, prefix + (last ? '    ' : '│   '), i === r.routes.length - 1, false));
  };
  draw(route, '', true, true);
  return lines.join('\n');
}

// ——— State ———

export interface AmAlert {
  labels: Labels;
  annotations: Labels;
  startsAt: number;
  endsAt: number;
  updatedAt: number;
}
export interface Silence {
  id: string;
  matchers: Matcher[];
  startsAt: number;
  endsAt: number;
  createdBy: string;
  comment: string;
  updatedAt: number;
}
export interface Group {
  route: string;
  receiver: string;
  labels: Labels;
  created: number;
  nextFlush: number;
  lastNotified: number | null;
  // What the last notification said (firing and resolved fingerprints).
  sent: string;
}
export interface Delivery {
  t: number;
  receiver: string;
  url: string;
  status: 'firing' | 'resolved';
  alerts: { labels: Labels; status: 'firing' | 'resolved' }[];
  delivered: boolean;
}
export interface AmState {
  config: AmConfig | null;
  configText: string;
  alerts: Record<string, AmAlert>;
  silences: Silence[];
  groups: Record<string, Group>;
  deliveries: Delivery[];
  up: boolean;
  counter: number;
  lastReload: { t: number; ok: boolean };
}

export const am = (j: Game): AmState | null => ((j as unknown as { principal: Game }).principal ?? j).state.alertmanager ?? null;
export const newAm = (): AmState => ({ config: null, configText: '', alerts: {}, silences: [], groups: {}, deliveries: [], up: false, counter: 0, lastReload: { t: 0, ok: true } });

const fp = (l: Labels) => labelsText(l);
/** A fingerprint like Alertmanager's (16 hexadecimal digits), steady for a label set. */
export function fingerprint(l: Labels): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const c of fp(l)) {
    h1 = Math.imul(h1 ^ c.charCodeAt(0), 16777619) >>> 0;
    h2 = Math.imul(h2 + c.charCodeAt(0), 2246822519) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16);
}

export function amLog(j: Game, t: number, level: string, caller: string, msg: string, extra = '') {
  promLog(j, t, level, caller, msg, extra, AM_UNIT, 'prometheus-alertmanager', AM_PID);
}

export function startAm(j: Game, t: number): string[] | null {
  const s = am(j)!;
  amLog(j, t, 'info', 'main.go:181', 'Starting Alertmanager', `version="(version=${ALERTMANAGER_VERSION}, branch=debian/sid, revision=${ALERTMANAGER_VERSION}-1)"`);
  const text = j.read(AM_CONFIG) ?? '';
  try {
    s.config = readAmConfig(text);
    s.configText = text;
  } catch (e) {
    s.up = false;
    return [`ts=${new Date(t).toISOString()} caller=coordinator.go:118 level=error component=configuration msg="Loading configuration file failed" file=${AM_CONFIG} err="${(e as Error).message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`];
  }
  s.up = true;
  s.lastReload = { t, ok: true };
  // A restart forgets the groups (their timers start again) but keeps silences (nflog and silences on disk).
  s.groups = {};
  amLog(j, t, 'info', 'coordinator.go:126', 'Completed loading of configuration file', `component=configuration file=${AM_CONFIG}`);
  amLog(j, t, 'info', 'tls_config.go:313', 'Listening on', 'address=[::]:9093');
  return null;
}

export function reloadAm(j: Game, t: number): boolean {
  const s = am(j)!;
  if (!s.up) return false;
  amLog(j, t, 'info', 'coordinator.go:113', 'Loading configuration file', `component=configuration file=${AM_CONFIG}`);
  const text = j.read(AM_CONFIG) ?? '';
  try {
    s.config = readAmConfig(text);
    s.configText = text;
  } catch (e) {
    amLog(j, t, 'error', 'coordinator.go:118', 'Loading configuration file failed', `component=configuration file=${AM_CONFIG} err="${(e as Error).message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
    s.lastReload = { t, ok: false };
    return false;
  }
  s.lastReload = { t, ok: true };
  // Groups are rebuilt from the new routes; what was already notified isn't sent again before repeat_interval.
  const old = s.groups;
  s.groups = {};
  for (const [k, g] of Object.entries(old)) s.groups[k] = g;
  amLog(j, t, 'info', 'coordinator.go:126', 'Completed loading of configuration file', `component=configuration file=${AM_CONFIG}`);
  return true;
}

export function stopAm(j: Game, t: number) {
  const s = am(j)!;
  if (!s.up) return;
  amLog(j, t, 'info', 'main.go:546', 'Received SIGTERM, exiting gracefully...');
  s.up = false;
  s.groups = {};
}

/** Alerts posted by Prometheus (POST /api/v2/alerts). */
export function receive(j: Game, alerts: { labels: Labels; annotations: Labels; startsAt: number; endsAt: number }[], t: number) {
  const s = am(j)!;
  for (const a of alerts) {
    const k = fp(a.labels);
    const old = s.alerts[k];
    s.alerts[k] = { labels: a.labels, annotations: a.annotations, startsAt: old && old.endsAt > t ? old.startsAt : a.startsAt, endsAt: a.endsAt, updatedAt: t };
  }
}

export const silenceState = (x: Silence, t: number): 'pending' | 'active' | 'expired' => (x.endsAt <= t ? 'expired' : x.startsAt > t ? 'pending' : 'active');

/** The silences that mute an alert now. */
export function silencedBy(s: AmState, labels: Labels, t: number): string[] {
  return s.silences.filter((x) => silenceState(x, t) === 'active' && matchAll(labels, x.matchers)).map((x) => x.id);
}

/** The alerts that inhibit this one now (inhibit_rules). */
export function inhibitedBy(s: AmState, labels: Labels, t: number): string[] {
  if (!s.config) return [];
  const out: string[] = [];
  for (const rule of s.config.inhibit) {
    if (!matchAll(labels, rule.target)) continue;
    for (const a of Object.values(s.alerts)) {
      if (a.endsAt <= t || fp(a.labels) === fp(labels)) continue;
      if (!matchAll(a.labels, rule.source)) continue;
      if (rule.equal.every((l) => (a.labels[l] ?? '') === (labels[l] ?? ''))) out.push(fingerprint(a.labels));
    }
  }
  return out;
}

export type AlertStatus = 'active' | 'suppressed' | 'unprocessed';
export function alertStatus(s: AmState, a: AmAlert, t: number): { state: AlertStatus; silencedBy: string[]; inhibitedBy: string[] } {
  const sil = silencedBy(s, a.labels, t);
  const inh = inhibitedBy(s, a.labels, t);
  return { state: sil.length || inh.length ? 'suppressed' : 'active', silencedBy: sil, inhibitedBy: inh };
}

const groupLabels = (r: Route, labels: Labels): Labels => (r.groupBy === '...' ? { ...labels } : Object.fromEntries(r.groupBy.filter((l) => labels[l] !== undefined).map((l) => [l, labels[l]])));

/** Each tick: alerts routed into groups, groups flushed when due. */
export function tickAm(j: Game, t: number) {
  const s = am(j);
  if (!s?.up || !s.config) return;
  const cfg = s.config;
  // Alerts resolved long ago are forgotten.
  for (const [k, a] of Object.entries(s.alerts)) if (a.endsAt < t - cfg.resolveTimeout - 15 * 60_000) delete s.alerts[k];
  const routes = allRoutes(cfg.route);
  const members: Record<string, AmAlert[]> = {};
  for (const a of Object.values(s.alerts)) {
    for (const r of routesFor(cfg.route, a.labels)) {
      const gl = groupLabels(r, a.labels);
      const k = `${r.id}:${fp(gl)}`;
      (members[k] ??= []).push(a);
      if (!s.groups[k] && a.endsAt > t) s.groups[k] = { route: r.id, receiver: r.receiver, labels: gl, created: t, nextFlush: t + r.groupWait, lastNotified: null, sent: '' };
    }
  }
  for (const [k, g] of Object.entries(s.groups)) {
    const r = routes.find((x) => x.id === g.route);
    if (!r) {
      delete s.groups[k];
      continue;
    }
    g.receiver = r.receiver;
    if (t < g.nextFlush) continue;
    g.nextFlush = t + r.groupInterval;
    const alerts = (members[k] ?? []).filter((a) => alertStatus(s, a, t).state === 'active' || a.endsAt <= t);
    const firing = alerts.filter((a) => a.endsAt > t);
    const resolved = alerts.filter((a) => a.endsAt <= t);
    const receiver = cfg.receivers.find((x) => x.name === r.receiver);
    const sendResolved = receiver?.webhooks.some((w) => w.sendResolved) ?? false;
    const said = `${firing.map((a) => fp(a.labels)).sort().join(';')}|${resolved.map((a) => fp(a.labels)).sort().join(';')}`;
    const firingBefore = g.sent.split('|')[0];
    const changed = firing.map((a) => fp(a.labels)).sort().join(';') !== firingBefore || (sendResolved && resolved.length > 0 && said !== g.sent);
    const repeat = firing.length > 0 && g.lastNotified !== null && t - g.lastNotified >= r.repeatInterval;
    if ((changed || repeat) && (firing.length || (sendResolved && resolved.length))) {
      deliver(j, s, g, receiver, firing, sendResolved ? resolved : [], t);
      g.lastNotified = t;
      g.sent = said;
    } else if (changed) g.sent = said;
    if (!firing.length && !(members[k] ?? []).some((a) => a.endsAt > t)) delete s.groups[k];
  }
}

function allRoutes(r: Route): Route[] {
  return [r, ...r.routes.flatMap(allRoutes)];
}

function deliver(j: Game, s: AmState, g: Group, receiver: Receiver | undefined, firing: AmAlert[], resolved: AmAlert[], t: number) {
  if (!receiver) return;
  const net = metricsNet(j);
  const status = firing.length ? 'firing' : 'resolved';
  const alerts = [...firing.map((a) => ({ labels: a.labels, status: 'firing' as const })), ...resolved.map((a) => ({ labels: a.labels, status: 'resolved' as const }))];
  for (const [i, w] of receiver.webhooks.entries()) {
    const m = /^(https?):\/\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(w.url)!;
    const host = m[2];
    const port = Number(m[3] ?? (m[1] === 'https' ? 443 : 80));
    const address = net?.resolve(j, host) ?? null;
    const body = JSON.stringify({ receiver: receiver.name, status, alerts, groupLabels: g.labels });
    const r = address ? net!.request(j, address, port, 'POST', m[4] ?? '/', {}, body) : null;
    const ok = !!r && r.kind === 'http' && r.code < 300;
    s.deliveries.push({ t, receiver: receiver.name, url: w.url, status, alerts, delivered: ok });
    if (!ok) {
      const why = !address ? `dial tcp: lookup ${host}: no such host` : r?.kind === 'timeout' ? 'context deadline exceeded' : r?.kind === 'http' ? `unexpected status code ${r.code}` : `dial tcp ${address}:${port}: connect: connection refused`;
      amLog(j, t, 'error', 'dispatch.go:360', 'Notify for alerts failed', `component=dispatcher num_alerts=${alerts.length} err="${receiver.name}/webhook[${i}]: notify retry canceled after 2 attempts: Post \\"<redacted>\\": ${why}"`);
    }
  }
  if (s.deliveries.length > 400) s.deliveries.splice(0, s.deliveries.length - 400);
}

// ——— Silences ———

/** A silence's ID: a UUID, steady for the game (from a counter). */
function uuid(n: number, seed: string): string {
  let h = 2166136261;
  const hex: string[] = [];
  for (let k = 0; k < 4; k++) {
    for (const c of `${seed}:${n}:${k}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    hex.push(h.toString(16).padStart(8, '0'));
  }
  const x = hex.join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-${'89ab'[parseInt(x[16], 16) % 4]}${x.slice(17, 20)}-${x.slice(20, 32)}`;
}

export function addSilence(j: Game, x: Omit<Silence, 'id' | 'updatedAt'>, t: number): Silence {
  const s = am(j)!;
  s.counter++;
  const silence: Silence = { ...x, id: uuid(s.counter, x.comment), updatedAt: t };
  s.silences.push(silence);
  return silence;
}

export function expireSilence(j: Game, id: string, t: number): boolean {
  const s = am(j)!;
  const x = s.silences.find((y) => y.id === id);
  if (!x || silenceState(x, t) === 'expired') return false;
  x.endsAt = t;
  x.updatedAt = t;
  return true;
}

export { formatDuration };
