// A machine's Prometheus (state.prometheus): its configuration read like
// Prometheus 2.53 reads /etc/prometheus/prometheus.yml (global, rule_files,
// scrape_configs with static_configs, alerting), its targets scraped every
// scrape_interval through the story's network (state.metricsNet: names,
// firewalls, who listens, what each exporter exposes), a small time series
// database (samples, staleness markers when a target goes down), its rules
// (rule_files: recording and alerting rules, `for`, labels, annotations
// with a few template functions) evaluated every evaluation_interval, the
// alerts' states (inactive, pending, firing, resolved) sent to the
// Alertmanager, and its HTTP API (/api/v1/query, /api/v1/targets,
// /api/v1/alerts, /api/v1/rules, /api/v1/status/config, /-/healthy,
// /-/ready, /-/reload) answering curl with the real JSON shapes.
// Time passes by ticks (advance()): the story calls it as minutes go by.
// Sources: https://prometheus.io/docs/prometheus/latest/configuration/configuration/,
// https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/,
// https://prometheus.io/docs/prometheus/latest/querying/api/,
// https://prometheus.io/docs/prometheus/latest/management_api/,
// https://prometheus.io/docs/instrumenting/exposition_formats/.
// Differences: static_configs only (no service discovery nor relabelling),
// HTTP only, a query's "query" printed as written, the loaded configuration
// shown as its file, no remote write, no query_range.

import type { Game } from './shell';
import { readYaml, YamlError, type Value } from './ansible';
import { evaluate, formatDuration, formatExp, formatValue, labelsText, lastBefore, matches, parse, parseDuration, PromQLError, seconds, type Labels, type Matcher, type Node, type Sample, type Storage, type StoredSeries, type Value as PromValue } from './promql';
import { systemd } from './systemd';

export const PROMETHEUS_VERSION = '2.53.3+ds1';
export const CONFIG_FILE = '/etc/prometheus/prometheus.yml';
const TICK = 15_000;
// Samples older than this are dropped (enough for the stories' ranges).
const RETENTION = 3 * 3_600_000;

// ——— The story's network, as Prometheus and curl see it ———

export interface Family {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'untyped';
  samples: { name?: string; labels: Labels; v: number }[];
}
export type Reply =
  | { kind: 'http'; code: number; body: string; type?: string }
  | { kind: 'metrics'; families: Family[] }
  | { kind: 'refused' }
  | { kind: 'timeout' };

/** What a story provides: resolve a name, and answer a request from a machine to an address and port. */
export interface MetricsNet {
  resolve(from: Game, host: string): string | null;
  request(from: Game, address: string, port: number, method: string, path: string, query: Record<string, string>, body: string): Reply;
  // The address a machine is seen from.
  addressOf(from: Game): string;
}

export const metricsNet = (j: Game): MetricsNet | null => ((j as unknown as { principal: Game }).principal ?? j).state.metricsNet ?? null;

/** The exposition text format (version 0.0.4) of a list of families. */
export function exposition(families: Family[]): string {
  const lines: string[] = [];
  for (const f of families) {
    lines.push(`# HELP ${f.name} ${f.help}`, `# TYPE ${f.name} ${f.type}`);
    for (const s of f.samples) {
      const l = Object.keys(s.labels)
        .map((k) => `${k}="${s.labels[k]}"`)
        .join(',');
      lines.push(`${s.name ?? f.name}${l ? `{${l}}` : ''} ${formatGo(s.v)}`);
    }
  }
  return lines.join('\n') + '\n';
}

// The client libraries write floats with %g-like shortest forms (1.2e+07 for large ones).
function formatGo(v: number): string {
  if (Number.isInteger(v) && Math.abs(v) < 1e21) return Math.abs(v) >= 1e6 ? formatExp(v).replace(/(\.\d*?)0+e/, '$1e').replace('.e', 'e') : String(v);
  return formatValue(v);
}

// ——— Configuration ———

export interface Target {
  address: string;
  labels: Labels;
}
export interface Job {
  name: string;
  interval: number;
  timeout: number;
  metricsPath: string;
  scheme: string;
  targets: Target[];
}
export interface PromConfig {
  scrapeInterval: number;
  scrapeTimeout: number;
  evaluationInterval: number;
  externalLabels: Labels;
  ruleFiles: string[];
  jobs: Job[];
  alertmanagers: string[];
}

export class ConfigError extends Error {}

const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const FIELDS: Record<string, { type: string; keys: string[] }> = {
  top: { type: 'config.plain', keys: ['global', 'rule_files', 'scrape_configs', 'alerting', 'remote_write', 'remote_read', 'storage', 'tracing', 'scrape_config_files'] },
  global: { type: 'config.plain', keys: ['scrape_interval', 'scrape_timeout', 'evaluation_interval', 'external_labels', 'query_log_file', 'rule_query_offset', 'body_size_limit', 'sample_limit'] },
  scrape: {
    type: 'config.ScrapeConfig',
    keys: ['job_name', 'scrape_interval', 'scrape_timeout', 'metrics_path', 'scheme', 'static_configs', 'honor_labels', 'honor_timestamps', 'params', 'relabel_configs', 'metric_relabel_configs', 'basic_auth', 'tls_config', 'sample_limit', 'follow_redirects'],
  },
  static: { type: 'targetgroup.Group', keys: ['targets', 'labels'] },
  alerting: { type: 'config.AlertingConfig', keys: ['alertmanagers', 'alert_relabel_configs'] },
  alertmanager: { type: 'config.AlertmanagerConfig', keys: ['static_configs', 'scheme', 'path_prefix', 'timeout', 'api_version'] },
};

/** The line where a key first appears (for go-yaml's "line N: field x not found"). */
const lineOf = (text: string, key: string, from = 0) => {
  const lines = text.split('\n');
  for (let i = from; i < lines.length; i++) if (new RegExp(`^\\s*(-\\s+)?["']?${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*:`).test(lines[i])) return i + 1;
  return 1;
};

const isObject = (v: Value | undefined): v is Record<string, Value> => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v: Value | undefined): Value[] => (Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v]);

function checkFields(text: string, v: Value | undefined, kind: string, errors: string[]) {
  if (!isObject(v)) return;
  for (const k of Object.keys(v)) if (!FIELDS[kind].keys.includes(k)) errors.push(`line ${lineOf(text, k)}: field ${k} not found in type ${FIELDS[kind].type}`);
}

function duration(v: Value | undefined, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const d = typeof v === 'string' ? parseDuration(v) : null;
  if (d === null) throw new ConfigError(`not a valid duration string: "${String(v)}"`);
  return d;
}

function labelsFrom(v: Value | undefined): Labels {
  if (!isObject(v)) return {};
  const out: Labels = {};
  for (const [k, x] of Object.entries(v)) {
    if (!LABEL_NAME.test(k)) throw new ConfigError(`"${k}" is not a valid label name`);
    out[k] = typeof x === 'string' ? x : JSON.stringify(x);
  }
  return out;
}

/** Reads prometheus.yml; throws ConfigError with Prometheus's message (without the file's name). */
export function readPromConfig(text: string): PromConfig {
  let raw: Value;
  try {
    raw = readYaml(text);
  } catch (e) {
    if (e instanceof YamlError) throw new ConfigError(`yaml: line ${e.line}: ${e.message}`);
    throw e;
  }
  if (raw === '') raw = {};
  if (!isObject(raw)) throw new ConfigError(`yaml: unmarshal errors:\n  line 1: cannot unmarshal !!str \`${String(raw).slice(0, 20)}\` into config.plain`);
  const errors: string[] = [];
  checkFields(text, raw, 'top', errors);
  const global = isObject(raw.global) ? raw.global : {};
  checkFields(text, raw.global, 'global', errors);
  const scrapes = list(raw.scrape_configs);
  scrapes.forEach((s) => {
    checkFields(text, s, 'scrape', errors);
    if (isObject(s)) for (const st of list(s.static_configs)) checkFields(text, st, 'static', errors);
  });
  checkFields(text, raw.alerting, 'alerting', errors);
  const ams = isObject(raw.alerting) ? list(raw.alerting.alertmanagers) : [];
  for (const a of ams) {
    checkFields(text, a, 'alertmanager', errors);
    if (isObject(a)) for (const st of list(a.static_configs)) checkFields(text, st, 'static', errors);
  }
  if (errors.length) throw new ConfigError(`yaml: unmarshal errors:\n  ${errors.join('\n  ')}`);
  const scrapeInterval = duration(global.scrape_interval, 60_000);
  const scrapeTimeout = duration(global.scrape_timeout, Math.min(10_000, scrapeInterval));
  const evaluationInterval = duration(global.evaluation_interval, 60_000);
  if (scrapeTimeout > scrapeInterval) throw new ConfigError('global scrape timeout greater than scrape interval');
  const jobs: Job[] = [];
  for (const s of scrapes) {
    if (!isObject(s)) continue;
    const name = typeof s.job_name === 'string' ? s.job_name : '';
    if (!name) throw new ConfigError('job_name is empty');
    if (jobs.some((j) => j.name === name)) throw new ConfigError(`found multiple scrape configs with job name "${name}"`);
    const interval = duration(s.scrape_interval, scrapeInterval);
    const timeout = duration(s.scrape_timeout, Math.min(scrapeTimeout, interval));
    if (timeout > interval) throw new ConfigError(`scrape timeout greater than scrape interval for scrape config with job name "${name}"`);
    const scheme = typeof s.scheme === 'string' && s.scheme ? s.scheme : 'http';
    if (!['http', 'https'].includes(scheme)) throw new ConfigError(`unknown scrape config scheme "${scheme}"`);
    const metricsPath = typeof s.metrics_path === 'string' && s.metrics_path ? s.metrics_path : '/metrics';
    const targets: Target[] = [];
    for (const st of list(s.static_configs)) {
      if (!isObject(st)) continue;
      const labels = labelsFrom(st.labels);
      for (const t of list(st.targets)) {
        const address = String(t);
        if (/^https?:\/\//.test(address) || address.includes('/')) throw new ConfigError(`"${address}" is not a valid hostname`);
        if (!/^[A-Za-z0-9.-]+(:\d+)?$/.test(address) && !/^\[[0-9a-fA-F:]+\](:\d+)?$/.test(address)) throw new ConfigError(`"${address}" is not a valid hostname`);
        targets.push({ address, labels });
      }
    }
    jobs.push({ name, interval, timeout, metricsPath, scheme, targets });
  }
  const alertmanagers: string[] = [];
  for (const a of ams) if (isObject(a)) for (const st of list(a.static_configs)) if (isObject(st)) for (const t of list(st.targets)) alertmanagers.push(String(t));
  const ruleFiles = list(raw.rule_files).map(String);
  return { scrapeInterval, scrapeTimeout, evaluationInterval, externalLabels: labelsFrom(global.external_labels), ruleFiles, jobs, alertmanagers };
}

// ——— Rules ———

export interface ActiveAlert {
  labels: Labels;
  annotations: Labels;
  state: 'pending' | 'firing';
  activeAt: number;
  firedAt?: number;
  resolvedAt?: number;
  value: number;
  lastSent?: number;
}
export interface Rule {
  kind: 'alert' | 'record';
  name: string;
  exprText: string;
  expr: Node;
  for: number;
  labels: Labels;
  annotations: Labels;
  alerts: Record<string, ActiveAlert>;
  health: 'ok' | 'err' | 'unknown';
  lastError: string;
  lastEval: number;
}
export interface RuleGroup {
  name: string;
  file: string;
  interval: number;
  rules: Rule[];
}

const RULE_FIELDS = ['record', 'alert', 'expr', 'for', 'keep_firing_for', 'labels', 'annotations'];

/** Reads a rule file; throws ConfigError with promtool's message (lines start with the file's name). */
export function readRules(text: string, file: string, evaluationInterval: number): RuleGroup[] {
  let raw: Value;
  try {
    raw = readYaml(text);
  } catch (e) {
    if (e instanceof YamlError) throw new ConfigError(`${file}: yaml: line ${e.line}: ${e.message}`);
    throw e;
  }
  if (raw === '') return [];
  if (!isObject(raw)) throw new ConfigError(`${file}: yaml: unmarshal errors:\n  line 1: cannot unmarshal !!str into rulefmt.RuleGroups`);
  const errors: string[] = [];
  for (const k of Object.keys(raw)) if (k !== 'groups') errors.push(`line ${lineOf(text, k)}: field ${k} not found in type rulefmt.RuleGroups`);
  const groups = list(raw.groups);
  let ruleLine = 0;
  for (const g of groups) {
    if (!isObject(g)) continue;
    for (const k of Object.keys(g)) if (!['name', 'interval', 'rules', 'limit', 'query_offset'].includes(k)) errors.push(`line ${lineOf(text, k)}: field ${k} not found in type rulefmt.RuleGroup`);
    for (const r of list(g.rules)) {
      if (!isObject(r)) continue;
      for (const k of Object.keys(r)) if (!RULE_FIELDS.includes(k)) errors.push(`line ${lineOf(text, k, ruleLine)}: field ${k} not found in type rulefmt.RuleNode`);
      ruleLine = lineOf(text, Object.keys(r)[0] ?? 'alert', ruleLine) ;
    }
  }
  if (errors.length) throw new ConfigError(`${file}: yaml: unmarshal errors:\n  ${errors.join('\n  ')}`);
  const out: RuleGroup[] = [];
  const problems: string[] = [];
  let from = 0;
  for (const g of groups) {
    if (!isObject(g)) continue;
    const name = typeof g.name === 'string' ? g.name : '';
    if (!name) problems.push(`${file}: Groupname must not be empty`);
    if (out.some((x) => x.name === name)) problems.push(`${file}: ${lineOf(text, 'name', from)}:${1}: groupname: "${name}" is repeated in the same file`);
    let interval = evaluationInterval;
    try {
      interval = duration(g.interval, evaluationInterval);
    } catch (e) {
      problems.push(`${file}: ${(e as Error).message}`);
    }
    const rules: Rule[] = [];
    list(g.rules).forEach((r, k) => {
      if (!isObject(r)) return;
      const alert = typeof r.alert === 'string' ? r.alert : '';
      const record = typeof r.record === 'string' ? r.record : '';
      const exprText = typeof r.expr === 'string' ? r.expr.trim() : '';
      const exprLine = lineOf(text, 'expr', from);
      from = Math.max(from, lineOf(text, alert ? 'alert' : 'record', from));
      const where = `${file}: ${exprLine}:${(text.split('\n')[exprLine - 1] ?? '').indexOf('expr') + 7}: group "${name}", rule ${k + 1}, "${alert || record}"`;
      if (alert && record) return void problems.push(`${where}: only one of 'record' and 'alert' must be set`);
      if (!alert && !record) return void problems.push(`${where}: one of 'record' or 'alert' must be set`);
      if (!exprText) return void problems.push(`${where}: field 'expr' must be set in rule`);
      if (record && !/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(record)) return void problems.push(`${where}: invalid recording rule name: ${record}`);
      if (record && (r.for !== undefined || r.annotations !== undefined)) return void problems.push(`${where}: invalid field 'for' in recording rule`);
      let expr: Node;
      try {
        expr = parse(exprText);
      } catch (e) {
        return void problems.push(`${where}: could not parse expression: ${(e as Error).message}`);
      }
      let forMs = 0;
      try {
        forMs = duration(r.for, 0);
      } catch (e) {
        return void problems.push(`${where}: ${(e as Error).message}`);
      }
      let labels: Labels = {};
      try {
        labels = labelsFrom(r.labels);
      } catch (e) {
        return void problems.push(`${where}: ${(e as Error).message}`);
      }
      const annotations = isObject(r.annotations) ? Object.fromEntries(Object.entries(r.annotations).map(([a, b]) => [a, String(b)])) : {};
      rules.push({ kind: alert ? 'alert' : 'record', name: alert || record, exprText, expr, for: forMs, labels, annotations, alerts: {}, health: 'unknown', lastError: '', lastEval: 0 });
    });
    out.push({ name, file, interval, rules });
  }
  if (problems.length) throw new ConfigError(problems.join('\n'));
  return out;
}

// A few of Go's template functions, enough for the usual annotations.
function humanize(v: number): string {
  if (v === 0 || !Number.isFinite(v)) return formatG(v);
  const big = ['', 'k', 'M', 'G', 'T', 'P', 'E'];
  const small = ['', 'm', 'u', 'n', 'p', 'f', 'a'];
  let x = v;
  let i = 0;
  if (Math.abs(x) >= 1) {
    while (Math.abs(x) >= 1000 && i < big.length - 1) {
      x /= 1000;
      i++;
    }
    return formatG(x) + big[i];
  }
  while (Math.abs(x) < 1 && i < small.length - 1) {
    x *= 1000;
    i++;
  }
  return formatG(x) + small[i];
}
// Go's %.4g.
const formatG = (v: number) => (Number.isFinite(v) ? String(Number(v.toPrecision(4))) : formatValue(v));

/** Expands an annotation's template ({{ $labels.instance }}, {{ $value }}, {{ $value | humanizePercentage }}…). */
export function expandTemplate(text: string, labels: Labels, value: number): string {
  return text.replace(/\{\{-?\s*(.*?)\s*-?\}\}/g, (all, inner: string) => {
    const term = (x: string): string | number => {
      const t = x.trim();
      if (t === '$value' || t === '.Value') return value;
      const m = /^(?:\$labels|\.Labels)\.([A-Za-z_]\w*)$/.exec(t);
      if (m) return labels[m[1]] ?? '';
      const q = /^"(.*)"$/.exec(t);
      return q ? q[1] : t;
    };
    const apply = (fn: string, x: string | number) => {
      const n = typeof x === 'number' ? x : Number(x);
      if (fn === 'humanize') return humanize(n);
      if (fn === 'humanizePercentage') return `${formatG(n * 100)}%`;
      if (fn === 'humanize1024') return humanize(n);
      if (fn === 'humanizeDuration') return `${formatG(n)}s`;
      if (fn === 'toUpper') return String(x).toUpperCase();
      if (fn === 'toLower') return String(x).toLowerCase();
      return null;
    };
    const parts = inner.split('|').map((p) => p.trim());
    let current: string | number;
    const first = parts[0].split(/\s+/);
    if (first[0] === 'printf') {
      const format = term(first[1] ?? '""') as string;
      const arg = term(first.slice(2).join(' ')) as number;
      current = format.replace(/%(\.(\d+))?([fgdsv])/, (_m, _p, digits, kind) => (kind === 'f' ? Number(arg).toFixed(digits === undefined ? 6 : Number(digits)) : kind === 'd' ? String(Math.trunc(Number(arg))) : typeof arg === 'number' ? formatG(arg) : String(arg)));
    } else if (first.length === 2) {
      const r = apply(first[0], term(first[1]));
      if (r === null) return all;
      current = r;
    } else current = term(parts[0]);
    for (const fn of parts.slice(1)) {
      const r = apply(fn, current);
      if (r === null) return all;
      current = r;
    }
    return typeof current === 'number' ? formatValue(current) : current;
  });
}

// ——— The database ———

export interface TargetState {
  job: string;
  address: string;
  labels: Labels;
  url: string;
  health: 'up' | 'down' | 'unknown';
  lastError: string;
  lastScrape: number;
  duration: number;
  next: number;
  series: string[];
}

export interface AlertTransition {
  t: number;
  rule: string;
  // The rule's expression (a rule renamed or rewritten is another one).
  expr: string;
  labels: Labels;
  to: 'pending' | 'firing' | 'resolved' | 'inactive';
}

export interface PromState {
  config: PromConfig | null;
  configText: string;
  groups: RuleGroup[];
  tsdb: Record<string, StoredSeries>;
  targets: Record<string, TargetState>;
  lastTick: number;
  nextEval: Record<string, number>;
  lifecycle: boolean;
  lastReload: { t: number; ok: boolean };
  history: AlertTransition[];
  // Last time a notifier error was logged (so as not to fill the journal).
  notifierError?: number;
  // Prometheus is running (follows its service).
  up: boolean;
}

export const prom = (j: Game): PromState | null => ((j as unknown as { principal: Game }).principal ?? j).state.prometheus ?? null;

export function newProm(): PromState {
  return { config: null, configText: '', groups: [], tsdb: {}, targets: {}, lastTick: 0, nextEval: {}, lifecycle: false, lastReload: { t: 0, ok: true }, history: [], up: false };
}

export function storageOf(p: PromState): Storage {
  return {
    select: (ms: Matcher[], start: number, end: number) => {
      const out: StoredSeries[] = [];
      const name = ms.find((m) => m.name === '__name__' && m.op === '=')?.value;
      for (const s of Object.values(p.tsdb)) {
        if (name && s.labels.__name__ !== name) continue;
        if (!matches(s.labels, ms)) continue;
        const last = s.samples.at(-1);
        if (!last || last.t < start - 5 * 60_000) continue;
        void end;
        out.push(s);
      }
      return out;
    },
  };
}

function append(p: PromState, labels: Labels, t: number, v: number, stale = false) {
  const key = labelsText(labels);
  const s = (p.tsdb[key] ??= { labels, samples: [] });
  const last = s.samples.at(-1);
  if (last && last.t >= t) return;
  if (stale && (!last || last.stale)) return;
  s.samples.push(stale ? { t, v: NaN, stale: true } : { t, v });
}

function staleAll(p: PromState, keys: string[], t: number) {
  for (const k of keys) {
    const s = p.tsdb[k];
    if (s) append(p, s.labels, t, NaN, true);
  }
}

// ——— Journal ———

const ts = (t: number) => new Date(t).toISOString();
export function promLog(j: Game, t: number, level: string, caller: string, msg: string, extra = '', unit = 'prometheus.service', ident = 'prometheus', pid = 812) {
  const sd = systemd(j);
  if (!sd) return;
  sd.log.push({ time: t, boot: sd.boot, unit, ident, pid, message: `ts=${ts(t)} caller=${caller} level=${level} msg="${msg}"${extra ? ' ' + extra : ''}`, priority: level === 'error' ? 3 : level === 'warn' ? 4 : 6 });
}

// ——— Loading ———

/** The rule files a configuration names (globs relative to its directory). */
export function ruleFilePaths(j: Game, config: PromConfig): string[] {
  const out: string[] = [];
  for (const pattern of config.ruleFiles) {
    const full = pattern.startsWith('/') ? pattern : `/etc/prometheus/${pattern}`;
    const i = full.lastIndexOf('/');
    const dir = full.slice(0, i) || '/';
    const base = full.slice(i + 1);
    const place = j.find(dir);
    if (place?.type !== 'directory') continue;
    const re = new RegExp(`^${base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
    for (const n of Object.keys(place.children).sort()) if (re.test(n) && place.children[n].type === 'file') out.push(`${dir}/${n}`);
  }
  return out;
}

/** Reads the configuration and its rule files from the disk; an error message, or the result. */
export function readAll(j: Game): { config: PromConfig; groups: RuleGroup[]; text: string } | { error: string; rules?: boolean } {
  const text = j.read(CONFIG_FILE);
  if (text === null) return { error: `open ${CONFIG_FILE}: no such file or directory` };
  let config: PromConfig;
  try {
    config = readPromConfig(text);
  } catch (e) {
    return { error: `parsing YAML file ${CONFIG_FILE}: ${(e as Error).message}` };
  }
  const groups: RuleGroup[] = [];
  for (const f of ruleFilePaths(j, config)) {
    try {
      groups.push(...readRules(j.read(f) ?? '', f, config.evaluationInterval));
    } catch (e) {
      return { error: (e as Error).message, rules: true };
    }
  }
  return { config, groups, text };
}

const key = (job: string, address: string) => `${job}|${address}`;

/** Applies a configuration read from disk: targets kept, added or removed, rules replaced (their alerts kept when the rule is the same). */
function apply(j: Game, p: PromState, config: PromConfig, groups: RuleGroup[], text: string, t: number) {
  const fresh: Record<string, TargetState> = {};
  for (const job of config.jobs)
    for (const target of job.targets) {
      const k = key(job.name, target.address);
      const old = p.targets[k];
      const labels: Labels = { ...target.labels, instance: target.labels.instance ?? target.address, job: job.name };
      fresh[k] = old && labelsText(old.labels) === labelsText(labels) && old.url === `${job.scheme}://${withPort(target.address, job.scheme)}${job.metricsPath}`
        ? old
        : { job: job.name, address: target.address, labels, url: `${job.scheme}://${withPort(target.address, job.scheme)}${job.metricsPath}`, health: 'unknown', lastError: '', lastScrape: 0, duration: 0, next: t, series: [] };
    }
  for (const [k, old] of Object.entries(p.targets)) if (!fresh[k] || fresh[k] !== old) staleAll(p, [...old.series, labelsText({ __name__: 'up', ...old.labels })], t);
  p.targets = fresh;
  // Rules: an alert in progress survives a reload if its rule is unchanged (same name, expression and labels).
  const oldRules = p.groups.flatMap((g) => g.rules);
  for (const g of groups)
    for (const r of g.rules) {
      const o = oldRules.find((x) => x.kind === r.kind && x.name === r.name && x.exprText === r.exprText && labelsText(x.labels) === labelsText(r.labels));
      if (o) {
        r.alerts = o.alerts;
        r.health = o.health;
        r.lastError = o.lastError;
        r.lastEval = o.lastEval;
      }
    }
  for (const o of oldRules)
    for (const a of Object.values(o.alerts))
      if (!groups.some((g) => g.rules.some((r) => r.alerts === o.alerts)) && a.state === 'firing') p.history.push({ t, rule: o.name, expr: o.exprText, labels: a.labels, to: 'inactive' });
  p.groups = groups;
  p.config = config;
  p.configText = text;
  for (const g of groups) p.nextEval[`${g.file}|${g.name}`] ??= t;
}

const withPort = (address: string, scheme: string) => (/:\d+$/.test(address) ? address : `${address}:${scheme === 'https' ? 443 : 80}`);

/** Prometheus starts: false (and errors in the journal) if its configuration doesn't load. */
export function startProm(j: Game, t: number): string[] | null {
  const p = prom(j)!;
  const r = readAll(j);
  promLog(j, t, 'info', 'main.go:688', 'Starting Prometheus Server', `mode=server version="(version=${PROMETHEUS_VERSION}, branch=debian/sid, revision=${PROMETHEUS_VERSION}-1)"`);
  promLog(j, t, 'info', 'main.go:1403', 'Loading configuration file', `filename=${CONFIG_FILE}`);
  if ('error' in r) {
    const line = `ts=${ts(t)} caller=main.go:1415 level=error msg="Error loading config (--config.file=${CONFIG_FILE})" file=${CONFIG_FILE} err="${r.error.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    p.up = false;
    return [line];
  }
  // /etc/default/prometheus: ARGS="--web.enable-lifecycle" lets POST /-/reload through.
  const args = /^\s*ARGS\s*=\s*"([^"]*)"/m.exec(j.read('/etc/default/prometheus') ?? '')?.[1] ?? '';
  p.lifecycle = /--web\.enable-lifecycle\b/.test(args);
  apply(j, p, r.config, r.groups, r.text, t);
  p.up = true;
  p.lastReload = { t, ok: true };
  promLog(j, t, 'info', 'main.go:1440', 'Completed loading of configuration file', `filename=${CONFIG_FILE} totalDuration=4.21ms`);
  promLog(j, t, 'info', 'main.go:1172', 'Server is ready to receive web requests.');
  return null;
}

/** SIGHUP or POST /-/reload: the new configuration, or the old one kept with an error in the journal. */
export function reloadProm(j: Game, t: number): boolean {
  const p = prom(j)!;
  if (!p.up) return false;
  promLog(j, t, 'info', 'main.go:1403', 'Loading configuration file', `filename=${CONFIG_FILE}`);
  const r = readAll(j);
  if ('error' in r) {
    if (r.rules) promLog(j, t, 'error', 'manager.go:1010', 'loading groups failed', `component="rule manager" err="${r.error.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
    promLog(j, t, 'error', 'main.go:1131', 'Error reloading config', `err="${(r.rules ? `one or more errors occurred while applying the new configuration (--config.file=\\"${CONFIG_FILE}\\")` : `couldn't load configuration (--config.file=\\"${CONFIG_FILE}\\"): ${r.error}`).replace(/\n/g, '\\n')}"`);
    p.lastReload = { t, ok: false };
    return false;
  }
  apply(j, p, r.config, r.groups, r.text, t);
  p.lastReload = { t, ok: true };
  promLog(j, t, 'info', 'main.go:1440', 'Completed loading of configuration file', `filename=${CONFIG_FILE} totalDuration=3.87ms`);
  return true;
}

export function stopProm(j: Game, t: number) {
  const p = prom(j)!;
  if (!p.up) return;
  promLog(j, t, 'warn', 'main.go:878', 'Received SIGTERM, exiting gracefully...');
  promLog(j, t, 'info', 'main.go:1324', 'See you next time!');
  // Its series end; alerts are forgotten (Prometheus 2 doesn't restore pending state by default).
  for (const tg of Object.values(p.targets)) staleAll(p, tg.series, t);
  for (const g of p.groups) for (const r of g.rules) r.alerts = {};
  p.up = false;
}

// ——— Time passing: scrapes, rules, notifications ———

export interface Hooks {
  // Each tick, after the rules: the Alertmanager's turn (alertmanager.ts).
  onTick?: (j: Game, t: number) => void;
  // Alerts sent to the Alertmanager.
  send?: (j: Game, address: string, alerts: { labels: Labels; annotations: Labels; startsAt: number; endsAt: number }[], t: number) => boolean;
}
let hooks: Hooks = {};
export const setHooks = (h: Hooks) => (hooks = { ...hooks, ...h });

/** Time passes up to `until` (ms): each tick, the targets due are scraped, the groups due evaluated. */
export function advance(j: Game, until: number) {
  const p = prom(j);
  if (!p) return;
  for (let t = p.lastTick + TICK; t <= until; t += TICK) {
    p.lastTick = t;
    if (p.up && p.config) {
      for (const target of Object.values(p.targets)) if (target.next <= t) scrape(j, p, target, t);
      for (const g of p.groups) {
        const k = `${g.file}|${g.name}`;
        if ((p.nextEval[k] ?? t) <= t) {
          evalGroup(j, p, g, t);
          p.nextEval[k] = t + g.interval;
        }
      }
    }
    hooks.onTick?.(j, t);
  }
  // Retention.
  const limit = until - RETENTION;
  for (const [k, s] of Object.entries(p.tsdb)) {
    if (s.samples.length && s.samples[0].t < limit) s.samples = s.samples.filter((x) => x.t >= limit);
    if (!s.samples.length) delete p.tsdb[k];
  }
}

/** Splits host:port. */
export function hostPort(address: string, scheme = 'http'): { host: string; port: number } {
  const m = /^(.*?)(?::(\d+))?$/.exec(address)!;
  return { host: m[1].replace(/^\[|\]$/g, ''), port: Number(m[2] ?? (scheme === 'https' ? 443 : 80)) };
}

/** What a scrape of this target gives now: the families, or Prometheus's error. */
export function scrapeResult(j: Game, target: TargetState): { families: Family[] } | { error: string } {
  const net = metricsNet(j);
  const job = prom(j)?.config?.jobs.find((x) => x.name === target.job);
  const { host, port } = hostPort(target.address, job?.scheme);
  const url = target.url;
  if (!net) return { error: `Get "${url}": dial tcp: lookup ${host}: no such host` };
  const address = net.resolve(j, host);
  if (!address) return { error: `Get "${url}": dial tcp: lookup ${host} on 192.0.2.1:53: no such host` };
  const r = net.request(j, address, port, 'GET', job?.metricsPath ?? '/metrics', {}, '');
  if (r.kind === 'refused') return { error: `Get "${url}": dial tcp ${address}:${port}: connect: connection refused` };
  if (r.kind === 'timeout') return { error: `Get "${url}": context deadline exceeded` };
  if (r.kind === 'http') {
    if (r.code !== 200) return { error: `server returned HTTP status ${r.code} ${STATUS[r.code] ?? ''}`.trimEnd() };
    const first = r.body.trim().split(/\s/)[0] ?? '';
    return { error: `"${first.slice(0, 20)}" is not a valid start token` };
  }
  return { families: r.families };
}

const STATUS: Record<number, string> = { 200: 'OK', 302: 'Found', 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 500: 'Internal Server Error', 503: 'Service Unavailable' };
export const statusText = (code: number) => STATUS[code] ?? '';

function scrape(j: Game, p: PromState, target: TargetState, t: number) {
  const job = p.config!.jobs.find((x) => x.name === target.job);
  target.next = t + (job?.interval ?? p.config!.scrapeInterval);
  const r = scrapeResult(j, target);
  // A small, steady duration per target (deterministic).
  const seed = [...target.url].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
  const ok = 'families' in r;
  const dur = ok ? 0.002 + seed / 100_000 : 'error' in r && r.error.includes('deadline') ? (job?.timeout ?? 10_000) / 1000 : 0.0004 + seed / 1_000_000;
  target.lastScrape = t;
  target.duration = dur;
  const base = target.labels;
  const keys: string[] = [];
  if (ok) {
    target.health = 'up';
    target.lastError = '';
    let n = 0;
    for (const f of r.families)
      for (const s of f.samples) {
        const labels: Labels = { __name__: s.name ?? f.name };
        for (const [k, v] of Object.entries(s.labels)) labels[base[k] !== undefined ? `exported_${k}` : k] = v;
        Object.assign(labels, base);
        append(p, labels, t, s.v);
        keys.push(labelsText(labels));
        n++;
      }
    // Series that vanished from the exposition (a restart…) get a staleness marker.
    staleAll(p, target.series.filter((k) => !keys.includes(k)), t);
    target.series = keys;
    append(p, { __name__: 'scrape_samples_scraped', ...base }, t, n);
  } else {
    target.health = 'down';
    target.lastError = r.error;
    staleAll(p, target.series, t);
    target.series = [];
    append(p, { __name__: 'scrape_samples_scraped', ...base }, t, 0);
  }
  append(p, { __name__: 'up', ...base }, t, ok ? 1 : 0);
  append(p, { __name__: 'scrape_duration_seconds', ...base }, t, dur);
}

/** Evaluates a group at t: recording rules write their series, alerting rules move their alerts on. */
function evalGroup(j: Game, p: PromState, g: RuleGroup, t: number) {
  const storage = storageOf(p);
  for (const r of g.rules) {
    r.lastEval = t;
    let samples: { labels: Labels; v: number }[];
    try {
      const v = evaluate(r.expr, storage, t).value;
      samples = v.type === 'vector' ? v.samples : v.type === 'scalar' ? [{ labels: {}, v: v.v }] : [];
      r.health = 'ok';
      r.lastError = '';
    } catch (e) {
      r.health = 'err';
      r.lastError = (e as Error).message;
      promLog(j, t, 'warn', 'group.go:552', 'Evaluating rule failed', `component="rule manager" file=${g.file} group=${g.name} name=${r.name} index=0 rule="${r.kind}: ${r.name}" err="${r.lastError.replace(/"/g, '\\"')}"`);
      continue;
    }
    if (r.kind === 'record') {
      for (const s of samples) append(p, { ...s.labels, ...r.labels, __name__: r.name }, t, s.v);
      continue;
    }
    const seen = new Set<string>();
    for (const s of samples) {
      const { __name__: _, ...rest } = s.labels;
      void _;
      const labels: Labels = { ...rest, ...Object.fromEntries(Object.entries(r.labels).map(([k, v]) => [k, expandTemplate(v, rest, s.v)])), alertname: r.name };
      const k = labelsText(labels);
      seen.add(k);
      const annotations = Object.fromEntries(Object.entries(r.annotations).map(([a, b]) => [a, expandTemplate(b, rest, s.v)]));
      const a = r.alerts[k];
      if (!a || a.resolvedAt !== undefined) {
        r.alerts[k] = { labels, annotations, state: r.for ? 'pending' : 'firing', activeAt: t, value: s.v, ...(r.for ? {} : { firedAt: t }) };
        p.history.push({ t, rule: r.name, expr: r.exprText, labels, to: r.for ? 'pending' : 'firing' });
      } else {
        a.value = s.v;
        a.annotations = annotations;
        if (a.state === 'pending' && t - a.activeAt >= r.for) {
          a.state = 'firing';
          a.firedAt = t;
          p.history.push({ t, rule: r.name, expr: r.exprText, labels, to: 'firing' });
        }
      }
    }
    for (const [k, a] of Object.entries(r.alerts)) {
      if (seen.has(k) || a.resolvedAt !== undefined) continue;
      if (a.state === 'pending') {
        delete r.alerts[k];
        p.history.push({ t, rule: r.name, expr: r.exprText, labels: a.labels, to: 'inactive' });
      } else {
        a.resolvedAt = t;
        p.history.push({ t, rule: r.name, expr: r.exprText, labels: a.labels, to: 'resolved' });
      }
    }
    // ALERTS{alertstate=…}: the alerts as a series.
    for (const a of Object.values(r.alerts)) if (a.resolvedAt === undefined) append(p, { __name__: 'ALERTS', ...a.labels, alertstate: a.state }, t, 1);
    // Resolved alerts are kept 15 minutes, to tell the Alertmanager.
    for (const [k, a] of Object.entries(r.alerts)) if (a.resolvedAt !== undefined && t - a.resolvedAt > 15 * 60_000) delete r.alerts[k];
  }
  notify(j, p, g, t);
}

// Firing alerts are sent again every minute (--rules.alert.resend-delay); their end is 4 resends away.
function notify(j: Game, p: PromState, g: RuleGroup, t: number) {
  if (!p.config?.alertmanagers.length || !hooks.send) return;
  const batch: { labels: Labels; annotations: Labels; startsAt: number; endsAt: number }[] = [];
  for (const r of g.rules)
    for (const a of Object.values(r.alerts)) {
      if (a.state !== 'firing') continue;
      const due = a.lastSent === undefined || t - a.lastSent >= 60_000 || (a.resolvedAt !== undefined && a.lastSent < a.resolvedAt);
      if (!due) continue;
      a.lastSent = t;
      batch.push({ labels: { ...p.config.externalLabels, ...a.labels }, annotations: a.annotations, startsAt: a.firedAt ?? a.activeAt, endsAt: a.resolvedAt ?? t + 4 * 60_000 });
    }
  if (!batch.length) return;
  for (const am of p.config.alertmanagers) {
    const ok = hooks.send(j, am, batch, t);
    if (!ok && (p.notifierError === undefined || t - p.notifierError >= 60_000)) {
      p.notifierError = t;
      const { host, port } = hostPort(am);
      promLog(j, t, 'error', 'notifier.go:532', 'Error sending alert', `component=notifier alertmanager=http://${am}/api/v2/alerts count=${batch.length} err="Post \\"http://${am}/api/v2/alerts\\": dial tcp ${host === 'localhost' ? '127.0.0.1' : host}:${port}: connect: connection refused"`);
    }
  }
}

// ——— Queries for the commands and the chapters ———

/** Runs a query at t (ms): the result, or the error as the API gives it. */
export function query(j: Game, text: string, t: number): { value: PromValue; infos: string[] } | { error: string; type: 'bad_data' | 'execution' } {
  const p = prom(j)!;
  let node: Node;
  try {
    node = parse(text);
  } catch (e) {
    return { error: `invalid parameter "query": ${(e as Error).message}`, type: 'bad_data' };
  }
  try {
    const r = evaluate(node, storageOf(p), t, text);
    return { value: r.value, infos: r.infos };
  } catch (e) {
    if (e instanceof PromQLError) return { error: e.message, type: 'execution' };
    throw e;
  }
}

/** The alerts of the loaded rules (not resolved). */
export function activeAlerts(p: PromState): { rule: Rule; alert: ActiveAlert }[] {
  return p.groups.flatMap((g) => g.rules.flatMap((r) => Object.values(r.alerts).filter((a) => a.resolvedAt === undefined).map((alert) => ({ rule: r, alert }))));
}

/** The latest value of `up` for each target. */
export const targetHealth = (p: PromState) => Object.values(p.targets);

// ——— JSON as Prometheus writes it (Go's encoder escapes <, > and &) ———

export function goJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

const sortLabels = (l: Labels): Labels => Object.fromEntries(Object.keys(l).sort().map((k) => [k, l[k]]));
const point = (t: number, v: number) => [seconds(t), formatValue(v)];

/** An instant result as the API's "data". */
export function resultJson(v: PromValue, t: number): unknown {
  switch (v.type) {
    case 'scalar':
      return { resultType: 'scalar', result: point(t, v.v) };
    case 'string':
      return { resultType: 'string', result: [seconds(t), v.v] };
    case 'vector':
      return { resultType: 'vector', result: v.samples.map((s) => ({ metric: sortLabels(s.labels), value: point(t, s.v) })) };
    case 'matrix':
      return { resultType: 'matrix', result: v.series.map((s) => ({ metric: sortLabels(s.labels), values: s.samples.map((x) => point(x.t, x.v)) })) };
  }
}

// A Go time as RFC3339Nano, with a steady fraction per target.
export const rfc3339 = (t: number) => (t ? new Date(t).toISOString().replace('.000Z', 'Z') : '0001-01-01T00:00:00Z');

/** Prometheus's HTTP API on its port: { code, body, type }. */
export function promHttp(j: Game, method: string, path: string, params: Record<string, string>): { code: number; body: string; type: string } {
  const p = prom(j)!;
  const now = p.lastTick;
  const ok = (data: unknown, extra: Record<string, unknown> = {}) => ({ code: 200, body: goJson({ status: 'success', data, ...extra }), type: 'application/json' });
  const bad = (code: number, type: string, error: string) => ({ code, body: goJson({ status: 'error', errorType: type, error }), type: 'application/json' });
  const text = (code: number, body: string) => ({ code, body, type: 'text/plain; charset=utf-8' });
  switch (path) {
    case '/':
      return { code: 302, body: '<a href="/query">Found</a>.\n\n', type: 'text/html; charset=utf-8' };
    case '/-/healthy':
      return text(200, 'Prometheus Server is Healthy.\n');
    case '/-/ready':
      return text(200, 'Prometheus Server is Ready.\n');
    case '/-/reload':
      if (method !== 'POST' && method !== 'PUT') return text(405, 'Only POST or PUT requests allowed\n');
      if (!p.lifecycle) return text(403, 'Lifecycle API is not enabled.\n');
      return reloadProm(j, now) ? text(200, '') : text(500, `failed to reload config: one or more errors occurred while applying the new configuration (--config.file="${CONFIG_FILE}")\n`);
    case '/-/quit':
      return p.lifecycle ? text(200, 'Requesting termination... Goodbye!\n') : text(403, 'Lifecycle API is not enabled.\n');
    case '/api/v1/query': {
      const q = params.query;
      if (q === undefined || q === '') return bad(400, 'bad_data', 'invalid parameter "query": 1:1: parse error: no expression found in input');
      let t = now;
      if (params.time) {
        const n = Number(params.time);
        const parsed = Number.isFinite(n) ? n * 1000 : Date.parse(params.time);
        if (!Number.isFinite(parsed)) return bad(400, 'bad_data', `invalid parameter "time": cannot parse "${params.time}" to a valid timestamp`);
        t = parsed;
      }
      const r = query(j, q, t);
      if ('error' in r) return bad(r.type === 'bad_data' ? 400 : 422, r.type, r.error);
      return ok(resultJson(r.value, t), r.infos.length ? { infos: r.infos } : {});
    }
    case '/api/v1/query_range':
      return bad(400, 'bad_data', 'invalid parameter "start": cannot parse "" to a valid timestamp');
    case '/api/v1/targets': {
      const state = params.state ?? 'any';
      const active =
        state === 'dropped'
          ? []
          : Object.values(p.targets).map((tg) => {
              const job = p.config?.jobs.find((x) => x.name === tg.job);
              const interval = formatDuration(job?.interval ?? 60_000);
              const timeout = formatDuration(job?.timeout ?? 10_000);
              const { instance: _i, job: _j, ...extra } = tg.labels;
              void _i;
              void _j;
              return {
                discoveredLabels: sortLabels({ __address__: tg.address, __metrics_path__: job?.metricsPath ?? '/metrics', __scheme__: job?.scheme ?? 'http', __scrape_interval__: interval, __scrape_timeout__: timeout, job: tg.job, ...extra }),
                labels: sortLabels(tg.labels),
                scrapePool: tg.job,
                scrapeUrl: tg.url,
                globalUrl: tg.url,
                lastError: tg.lastError,
                lastScrape: rfc3339(tg.lastScrape),
                lastScrapeDuration: Number(tg.duration.toFixed(9)),
                health: tg.health,
                scrapeInterval: interval,
                scrapeTimeout: timeout,
              };
            });
      return ok({ activeTargets: active, droppedTargets: [], droppedTargetCounts: Object.fromEntries((p.config?.jobs ?? []).map((x) => [x.name, 0])) });
    }
    case '/api/v1/alerts':
      return ok({
        alerts: activeAlerts(p).map(({ alert }) => ({ labels: sortLabels(alert.labels), annotations: sortLabels(alert.annotations), state: alert.state, activeAt: rfc3339(alert.activeAt), value: formatExp(alert.value) })),
      });
    case '/api/v1/rules': {
      const type = params.type;
      return ok({
        groups: p.groups.map((g) => ({
          name: g.name,
          file: g.file,
          rules: g.rules
            .filter((r) => !type || (type === 'alert' ? r.kind === 'alert' : r.kind === 'record'))
            .map((r) => {
              const alerts = Object.values(r.alerts).filter((a) => a.resolvedAt === undefined);
              const state = alerts.some((a) => a.state === 'firing') ? 'firing' : alerts.length ? 'pending' : 'inactive';
              const common = { name: r.name, query: r.exprText, labels: sortLabels(r.labels), health: r.health, ...(r.lastError ? { lastError: r.lastError } : {}), evaluationTime: 0.000412, lastEvaluation: rfc3339(r.lastEval) };
              return r.kind === 'alert'
                ? { state, name: r.name, query: r.exprText, duration: r.for / 1000, keepFiringFor: 0, labels: sortLabels(r.labels), annotations: sortLabels(r.annotations), alerts: alerts.map((a) => ({ labels: sortLabels(a.labels), annotations: sortLabels(a.annotations), state: a.state, activeAt: rfc3339(a.activeAt), value: formatExp(a.value) })), health: r.health, ...(r.lastError ? { lastError: r.lastError } : {}), evaluationTime: 0.000412, lastEvaluation: rfc3339(r.lastEval), type: 'alerting' }
                : { ...common, type: 'recording' };
            }),
          interval: g.interval / 1000,
          limit: 0,
          evaluationTime: 0.000873,
          lastEvaluation: rfc3339(g.rules[0]?.lastEval ?? 0),
        })),
      });
    }
    case '/api/v1/status/config':
      return ok({ yaml: p.configText });
    case '/api/v1/status/buildinfo':
      return ok({ version: PROMETHEUS_VERSION, revision: `${PROMETHEUS_VERSION}-1`, branch: 'debian/sid', buildUser: 'team+pkg-go@tracker.debian.org', buildDate: '20250115-12:00:00', goVersion: 'go1.24.4' });
    case '/metrics':
      return { code: 200, body: exposition(selfMetrics(p)), type: 'text/plain; version=0.0.4; charset=utf-8' };
  }
  const label = /^\/api\/v1\/label\/([^/]+)\/values$/.exec(path);
  if (label) {
    const values = new Set<string>();
    for (const s of Object.values(p.tsdb)) if (s.labels[label[1]] !== undefined && !s.samples.at(-1)?.stale) values.add(s.labels[label[1]]);
    return ok([...values].sort());
  }
  return text(404, '404 page not found\n');
}

/** What Prometheus says about itself on /metrics (a few of its own series). */
export function selfMetrics(p: PromState): Family[] {
  const firing = activeAlerts(p).length;
  return [
    { name: 'prometheus_build_info', help: 'A metric with a constant \'1\' value labeled by version, revision, branch, goversion from which prometheus was built, and the goos and goarch for the build.', type: 'gauge', samples: [{ labels: { branch: 'debian/sid', goversion: 'go1.24.4', version: PROMETHEUS_VERSION }, v: 1 }] },
    { name: 'prometheus_config_last_reload_successful', help: 'Whether the last configuration reload attempt was successful.', type: 'gauge', samples: [{ labels: {}, v: p.lastReload.ok ? 1 : 0 }] },
    { name: 'prometheus_config_last_reload_success_timestamp_seconds', help: 'Timestamp of the last successful configuration reload.', type: 'gauge', samples: [{ labels: {}, v: Math.floor(p.lastReload.t / 1000) }] },
    { name: 'prometheus_notifications_alertmanagers_discovered', help: 'The number of alertmanagers discovered and active.', type: 'gauge', samples: [{ labels: {}, v: p.config?.alertmanagers.length ?? 0 }] },
    { name: 'prometheus_rule_group_rules', help: 'The number of rules.', type: 'gauge', samples: p.groups.map((g) => ({ labels: { rule_group: `${g.file};${g.name}` }, v: g.rules.length })) },
    { name: 'prometheus_tsdb_head_series', help: 'Total number of series in the head block.', type: 'gauge', samples: [{ labels: {}, v: Object.keys(p.tsdb).length }] },
    { name: 'prometheus_alerts_active', help: 'Alerts in pending or firing state (the game\'s own count).', type: 'gauge', samples: [{ labels: {}, v: firing }] },
  ];
}

/** The last sample of a series at or before t (for the chapters). */
export function valueAt(p: PromState, labels: Labels, t: number): number | null {
  const s = p.tsdb[labelsText(labels)];
  const x = s && lastBefore(s.samples, t);
  return x && !x.stale ? x.v : null;
}

export type { Sample };
