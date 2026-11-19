// The Prometheus tools of Debian's packages: promtool (check config, check
// rules, check metrics, query instant), amtool (alert query, silence add,
// query and expire, check-config, config routes show and test), the
// daemons' own binaries (prometheus, prometheus-alertmanager,
// prometheus-node-exporter: --version), the Alertmanager's HTTP API
// (/api/v2/…) and curl on a machine of a story with metrics
// (state.metricsNet: its names, firewalls and services), plus sleep (time
// passes for the story).
// Sources: https://prometheus.io/docs/prometheus/latest/command-line/promtool/,
// https://github.com/prometheus/alertmanager#amtool,
// https://prometheus.io/docs/alerting/latest/clients/ (API v2),
// https://curl.se/docs/manpage.html (-G, --data-urlencode, -g, -s, -S, -f).

import type { Command } from './index';
import type { Shell } from '../shell';
import { formatValue, labelsText, parseDuration, seconds, type Labels, type Matcher } from '../promql';
import { CONFIG_FILE, metricsNet, prom, query, readPromConfig, readRules, ruleFilePaths, PROMETHEUS_VERSION, ConfigError, statusText, goJson, rfc3339, exposition, type Reply } from '../prometheus';
import { am, AM_CONFIG, ALERTMANAGER_VERSION, alertStatus, addSilence, expireSilence, fingerprint, matcherText, readAmConfig, readMatcher, reloadAm, routesFor, routeTree, silenceState, type AmState } from '../alertmanager';
import { systemd } from '../systemd';

const clock = (game: Shell) => prom(game)?.lastTick || systemd(game)?.clock || 0;
const BUILD = (name: string, version: string) =>
  `${name}, version ${version} (branch: debian/sid, revision: ${version}-1)\n  build user:       team+pkg-go@tracker.debian.org\n  build date:       20250115-12:00:00\n  go version:       go1.24.4\n  platform:         linux/amd64\n  tags:             unknown`;

// ——— curl on the story's network ———

const REASONS: Record<number, string> = { 200: 'OK', 204: 'No Content', 302: 'Found', 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 422: 'Unprocessable Entity', 500: 'Internal Server Error', 503: 'Service Unavailable' };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
};
const params = (q: string) => Object.fromEntries(q.split('&').filter(Boolean).map((kv) => [decode(kv.split('=')[0]), decode(kv.split('=').slice(1).join('='))]));

/** curl on a machine whose story models its network (Prometheus, exporters, Alertmanager…). */
export function metricsCurl(game: Shell, args: string[]): string {
  const net = metricsNet(game)!;
  const VALUE = ['-X', '--request', '-d', '--data', '--data-raw', '--data-urlencode', '--data-binary', '-H', '--header', '-o', '--output', '-w', '--write-out', '-m', '--max-time', '--connect-timeout', '-A', '--user-agent', '-u', '--user'];
  let method: string | null = null;
  const data: string[] = [];
  let get = false;
  let globoff = false;
  let silent = false;
  let showErrors = false;
  let fail = false;
  let include = false;
  let head = false;
  let verbose = false;
  let output: string | null = null;
  let writeOut: string | null = null;
  const urls: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (VALUE.includes(a)) {
      const v = args[++i];
      if (v === undefined) return game.error(`curl: option ${a}: requires parameter\ncurl: try 'curl --help' or 'curl --manual' for more information`, 2);
      if (a === '-X' || a === '--request') method = v.toUpperCase();
      else if (a === '--data-urlencode') {
        const eq = v.indexOf('=');
        data.push(eq < 0 ? encodeURIComponent(v) : `${v.slice(0, eq)}=${encodeURIComponent(v.slice(eq + 1))}`);
      } else if (a.startsWith('-d') || a.startsWith('--data')) data.push(v);
      else if (a === '-o' || a === '--output') output = v;
      else if (a === '-w' || a === '--write-out') writeOut = v;
      continue;
    }
    const eq = /^--(data-urlencode|data|request)=(.*)$/.exec(a);
    if (eq) {
      if (eq[1] === 'request') method = eq[2].toUpperCase();
      else data.push(eq[1] === 'data-urlencode' ? `${eq[2].split('=')[0]}=${encodeURIComponent(eq[2].split('=').slice(1).join('='))}` : eq[2]);
      continue;
    }
    if (a === '--get') get = true;
    else if (a === '--globoff') globoff = true;
    else if (a === '--silent') silent = true;
    else if (a === '--show-error') showErrors = true;
    else if (a === '--fail') fail = true;
    else if (a === '--include') include = true;
    else if (a === '--head') head = true;
    else if (a === '--verbose') verbose = true;
    else if (a.startsWith('--')) continue;
    else if (/^-[A-Za-z]+$/.test(a)) {
      for (const l of a.slice(1)) {
        if (l === 'G') get = true;
        else if (l === 'g') globoff = true;
        else if (l === 's') silent = true;
        else if (l === 'S') showErrors = true;
        else if (l === 'f') fail = true;
        else if (l === 'i') include = true;
        else if (l === 'I') head = true;
        else if (l === 'v') verbose = true;
      }
    } else urls.push(a);
  }
  const err = (code: number, message: string) => {
    if (silent && !showErrors) {
      game.status = code;
      return '';
    }
    return game.error(`curl: (${code}) ${message}`, code);
  };
  if (!urls.length) return game.error("curl: no URL specified\ncurl: try 'curl --help' or 'curl --manual' for more information", 2);
  let url = urls[0];
  // curl's URL globbing: {a,b} and [1-3] are patterns unless -g.
  if (!globoff && /[{}[\]]/.test(url)) {
    if (/\[/.test(url) && !/\[[0-9a-fA-F:]+\]/.test(url)) return err(3, `bad range in URL position ${url.indexOf('[') + 1}:\n${url}\n${' '.repeat(url.indexOf('['))}^`);
    if (/\{[^}]*\{/.test(url)) return err(3, `nested brace in URL position ${url.indexOf('{', url.indexOf('{') + 1) + 1}:\n${url}`);
    if (/\{[^}]*$/.test(url)) return err(3, `unmatched brace in URL position ${url.indexOf('{') + 1}:\n${url}\n${' '.repeat(url.indexOf('{'))}^`);
    // {x} with a single item: the braces just go.
    url = url.replace(/\{([^},]*)\}/g, '$1');
    if (/\{[^}]*,[^}]*\}/.test(url)) url = url.replace(/\{([^},]*),[^}]*\}/, '$1');
  }
  if (/\s/.test(url)) return err(3, 'URL rejected: Malformed input to a URL function');
  const m = /^(?:(https?):\/\/)?(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?([^?#]*)(?:\?([^#]*))?/.exec(url);
  if (!m) return err(3, 'URL rejected: Malformed input to a URL function');
  const scheme = m[1] ?? 'http';
  const host = m[2].replace(/^\[|\]$/g, '');
  const port = Number(m[3] ?? (scheme === 'https' ? 443 : 80));
  const path = m[4] || '/';
  let queryText = m[5] ?? '';
  let body = data.join('&');
  if (get && body) {
    queryText = queryText ? `${queryText}&${body}` : body;
    body = '';
  }
  const verb = head ? 'HEAD' : (method ?? (body ? 'POST' : 'GET'));
  const address = net.resolve(game, host);
  if (!address) return err(6, `Could not resolve host: ${host}`);
  const all = { ...params(queryText), ...(body ? params(body) : {}) };
  const reply: Reply = net.request(game, address, port, verb, path, all, body);
  const log: string[] = [];
  if (verbose) log.push(`* Host ${host}:${port} was resolved.`, `* IPv4: ${address}`, `*   Trying ${address}:${port}...`);
  if (reply.kind === 'refused') return (verbose ? log.join('\n') + '\n' : '') + err(7, `Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server`);
  if (reply.kind === 'timeout') return (verbose ? log.join('\n') + '\n' : '') + err(28, `Failed to connect to ${host} port ${port} after 134982 ms: Couldn't connect to server`);
  const r = reply.kind === 'metrics' ? { code: 200, body: exposition(reply.families), type: 'text/plain; version=0.0.4; charset=utf-8' } : { code: reply.code, body: reply.body, type: reply.type ?? 'text/plain; charset=utf-8' };
  const date = new Date(clock(game)).toUTCString();
  const headers = [`HTTP/1.1 ${r.code} ${REASONS[r.code] ?? statusText(r.code)}`.trimEnd(), `Content-Type: ${r.type}`, `Date: ${date}`, `Content-Length: ${new TextEncoder().encode(r.body).length}`];
  if (verbose) log.push(`* Connected to ${host} (${address}) port ${port}`, `> ${verb} ${path}${queryText ? `?${queryText}` : ''} HTTP/1.1`, `> Host: ${host}:${port}`, '> User-Agent: curl/8.14.1', '> Accept: */*', ...(body ? ['> Content-Type: application/x-www-form-urlencoded', `> Content-Length: ${body.length}`] : []), '> ', ...headers.map((h) => `< ${h}`), '< ');
  if (fail && r.code >= 400) return (verbose ? log.join('\n') + '\n' : '') + err(22, `The requested URL returned error: ${r.code}`);
  let shown = head ? headers.join('\n') : include ? `${headers.join('\n')}\n\n${r.body}` : r.body;
  if (output) {
    if (output !== '/dev/null') {
      const e = game.place('curl', output, { type: 'file', content: r.body, owner: game.who });
      if (e) return game.error(`curl: (23) Failure writing output to destination, passed ${r.body.length} returned 0`, 23);
    }
    shown = head || include ? headers.join('\n') : '';
  }
  if (writeOut !== null) shown += writeOut.replace(/%\{(http_code|response_code)\}/g, String(r.code)).replace(/%\{size_download\}/g, String(r.body.length)).replace(/%\{time_total\}/g, '0.004211').replace(/\\n/g, '\n');
  return (verbose ? log.join('\n') + '\n' : '') + shown.replace(/\n$/, '');
}


// ——— The Alertmanager's API ———

const sortObj = (l: Labels) => Object.fromEntries(Object.keys(l).sort().map((k) => [k, l[k]]));

/** The Alertmanager's HTTP API on its port. */
export function amHttp(game: Shell, method: string, path: string, query: Record<string, string>, body: string): { code: number; body: string; type: string } {
  const s = am(game)!;
  const t = clock(game);
  const json = (code: number, v: unknown) => ({ code, body: JSON.stringify(v) + '\n', type: 'application/json' });
  const text = (code: number, b: string) => ({ code, body: b, type: 'text/plain; charset=utf-8' });
  if (path === '/-/healthy' || path === '/-/ready') return text(200, 'OK');
  if (path === '/-/reload') return method === 'POST' ? (reloadAm(game, t) ? text(200, '') : text(500, `failed to reload config: ${s.lastReload.ok ? '' : 'see the journal'}\n`)) : text(405, 'Method Not Allowed\n');
  if (path === '/' ) return { code: 200, body: '<!DOCTYPE html>\n<html lang="en">\n<title>Alertmanager</title>\n</html>\n', type: 'text/html; charset=utf-8' };
  if (path === '/api/v2/status')
    return json(200, { cluster: { name: '01J', peers: [], status: 'disabled' }, config: { original: s.configText }, uptime: rfc3339(t - 3_600_000), versionInfo: { branch: 'debian/sid', buildDate: '20250115-12:00:00', buildUser: 'team+pkg-go@tracker.debian.org', goVersion: 'go1.24.4', revision: `${ALERTMANAGER_VERSION}-1`, version: ALERTMANAGER_VERSION } });
  if (path === '/api/v2/alerts' && method === 'GET') {
    const filter = (query.filter ?? '')
      .split(',')
      .filter(Boolean)
      .map((x) => readMatcher(x.replace(/^\{|\}$/g, '')))
      .filter((x): x is Matcher => !!x);
    return json(200, amAlerts(s, t, filter, query.silenced !== 'false', query.inhibited !== 'false', query.active !== 'false').map(({ a, st, receivers }) => ({ annotations: sortObj(a.annotations), endsAt: rfc3339(a.endsAt), fingerprint: fingerprint(a.labels), receivers: receivers.map((name) => ({ name })), startsAt: rfc3339(a.startsAt), status: { inhibitedBy: st.inhibitedBy, silencedBy: st.silencedBy, state: st.state }, updatedAt: rfc3339(a.updatedAt), generatorURL: 'http://gauge:9090/graph', labels: sortObj(a.labels) })));
  }
  if (path === '/api/v2/silences' && method === 'GET') return json(200, s.silences.map((x) => silenceJson(x, t)));
  if (path === '/api/v2/silences' && method === 'POST') {
    let v: { matchers?: { name: string; value: string; isRegex?: boolean; isEqual?: boolean }[]; startsAt?: string; endsAt?: string; createdBy?: string; comment?: string };
    try {
      v = JSON.parse(body);
    } catch {
      return text(400, 'parsing silence body from "" failed, because EOF\n');
    }
    const startsAt = Date.parse(v.startsAt ?? '');
    const endsAt = Date.parse(v.endsAt ?? '');
    if (!v.matchers?.length || !Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return text(400, 'silence invalid: at least one matcher required\n');
    if (endsAt <= startsAt) return text(400, 'silence invalid: end time must not be before start time\n');
    const x = addSilence(game, { matchers: v.matchers.map((m) => ({ name: m.name, value: m.value, op: m.isRegex ? (m.isEqual === false ? '!~' : '=~') : m.isEqual === false ? '!=' : '=' })), startsAt, endsAt, createdBy: v.createdBy ?? '', comment: v.comment ?? '' }, t);
    return json(200, { silenceID: x.id });
  }
  const del = /^\/api\/v2\/silence\/([0-9a-f-]+)$/.exec(path);
  if (del && method === 'DELETE') return expireSilence(game, del[1], t) ? text(200, '') : text(404, `silence ${del[1]} not found\n`);
  if (del) {
    const x = s.silences.find((y) => y.id === del[1]);
    return x ? json(200, silenceJson(x, t)) : text(404, `silence ${del[1]} not found\n`);
  }
  return text(404, '404 page not found\n');
}

function silenceJson(x: AmState['silences'][number], t: number) {
  return {
    id: x.id,
    status: { state: silenceState(x, t) },
    updatedAt: rfc3339(x.updatedAt),
    comment: x.comment,
    createdBy: x.createdBy,
    endsAt: rfc3339(x.endsAt),
    matchers: x.matchers.map((m) => ({ isEqual: !m.op.startsWith('!'), isRegex: m.op.includes('~'), name: m.name, value: m.value })),
    startsAt: rfc3339(x.startsAt),
  };
}

function amAlerts(s: AmState, t: number, filter: Matcher[], silenced: boolean, inhibited: boolean, active: boolean) {
  return Object.values(s.alerts)
    .filter((a) => a.endsAt > t)
    .map((a) => ({ a, st: alertStatus(s, a, t), receivers: s.config ? routesFor(s.config.route, a.labels).map((r) => r.receiver) : [] }))
    .filter(({ a, st }) => {
      if (!filter.every((m) => matchOne(a.labels, m))) return false;
      if (st.silencedBy.length && !silenced) return false;
      if (st.inhibitedBy.length && !inhibited) return false;
      if (st.state === 'active' && !active) return false;
      return true;
    })
    .sort((x, y) => x.a.startsAt - y.a.startsAt || labelsText(x.a.labels).localeCompare(labelsText(y.a.labels)));
}
const matchOne = (l: Labels, m: Matcher) => {
  const v = l[m.name] ?? '';
  if (m.op === '=') return v === m.value;
  if (m.op === '!=') return v !== m.value;
  const re = new RegExp(`^(?:${m.value})$`);
  return m.op === '=~' ? re.test(v) : !re.test(v);
};

// ——— Columns, as Go's tabwriter with a padding of 2 ———

function columns(rows: string[][]): string {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => [...(r[i] ?? '')].length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c + ' '.repeat(widths[i] - [...c].length + 2))).join('').trimEnd()).join('\n');
}

const amDate = (t: number) => new Date(t).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

// ——— Reading the flags of a kingpin program (promtool, amtool) ———

function flags(args: string[], withValue: string[]): { flags: Record<string, string>; rest: string[]; error?: string } {
  const out: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const [name, ...v] = a.slice(2).split('=');
      if (withValue.includes(name)) {
        const value = v.length ? v.join('=') : args[++i];
        if (value === undefined) return { flags: out, rest, error: `expected argument for flag --${name}` };
        out[name] = value;
      } else out[name] = v.length ? v.join('=') : 'true';
    } else if (/^-[a-zA-Z]$/.test(a)) {
      const long = SHORT[a.slice(1)];
      if (!long) return { flags: out, rest, error: `unknown short flag '${a}'` };
      if (withValue.includes(long)) {
        const value = args[++i];
        if (value === undefined) return { flags: out, rest, error: `expected argument for flag -${a.slice(1)}` };
        out[long] = value;
      } else out[long] = 'true';
    } else rest.push(a);
  }
  return { flags: out, rest };
}
const SHORT: Record<string, string> = { d: 'duration', c: 'comment', a: 'author', o: 'output', q: 'quiet', s: 'silenced', i: 'inhibited', e: 'expired' };

// ——— promtool ———

function checkConfig(game: Shell, files: string[]): string {
  const out: string[] = [];
  let failed = false;
  for (const file of files) {
    out.push(`Checking ${file}`);
    const text = game.read(file);
    if (text === null) {
      out.push(`  FAILED: open ${file}: no such file or directory`, '');
      failed = true;
      continue;
    }
    let ruleFiles: string[] = [];
    try {
      const c = readPromConfig(text);
      ruleFiles = ruleFilePaths(game, c);
      out.push(`  SUCCESS: ${ruleFiles.length} rule files found`, ` SUCCESS: ${file} is valid prometheus config file syntax`, '');
    } catch (e) {
      out.push(`  FAILED: parsing YAML file ${file}: ${(e as Error).message}`, '');
      failed = true;
      continue;
    }
    const r = checkRules(game, ruleFiles);
    if (game.status) failed = true;
    if (r) out.push(r);
  }
  if (failed) game.status = 1;
  return out.join('\n').replace(/\n+$/, '\n');
}

function checkRules(game: Shell, files: string[]): string {
  const out: string[] = [];
  let failed = false;
  for (const file of files) {
    out.push(`Checking ${file}`);
    const text = game.read(file);
    if (text === null) {
      out.push(`  FAILED:`, `open ${file}: no such file or directory`, '');
      failed = true;
      continue;
    }
    try {
      const groups = readRules(text, file, 60_000);
      out.push(`  SUCCESS: ${groups.reduce((n, g) => n + g.rules.length, 0)} rules found`, '');
    } catch (e) {
      out.push('  FAILED:', ...(e as Error).message.split('\n'), '');
      failed = true;
    }
  }
  if (failed) game.status = 1;
  return out.join('\n');
}

function promqlLine(labels: Labels, v: number, t: number) {
  return `${labelsText(labels)} => ${formatValue(v)} @[${seconds(t)}]`;
}

// ——— amtool ———

/** amtool's Alertmanager: --alertmanager.url, or /etc/amtool/config.yml, or ~/.config/amtool/config.yml. */
function amtoolUrl(game: Shell, f: Record<string, string>): string | null {
  if (f['alertmanager.url']) return f['alertmanager.url'];
  for (const file of ['/etc/amtool/config.yml', '~/.config/amtool/config.yml']) {
    const m = /^\s*alertmanager\.url\s*:\s*["']?([^"'\s#]+)/m.exec(game.read(file) ?? '');
    if (m) return m[1];
  }
  return null;
}
function amtoolDefault(game: Shell, key: string): string | null {
  for (const file of ['~/.config/amtool/config.yml', '/etc/amtool/config.yml']) {
    const m = new RegExp(`^\\s*${key.replace('.', '\\.')}\\s*:\\s*["']?([^"'#\\n]+?)["']?\\s*$`, 'm').exec(game.read(file) ?? '');
    if (m) return m[1];
  }
  return null;
}

/** Reaches the Alertmanager behind a URL: its state, or amtool's error. */
function reachAm(game: Shell, url: string, api: string): AmState | string {
  const m = /^(https?):\/\/([^/:]+)(?::(\d+))?/.exec(url);
  if (!m) return `amtool: error: parse "${url}": invalid URI for request`;
  const net = metricsNet(game);
  const host = m[2];
  const port = Number(m[3] ?? 80);
  const address = net?.resolve(game, host);
  if (!address) return `amtool: error: Get "${url}${api}": dial tcp: lookup ${host} on 192.0.2.1:53: no such host`;
  const r = net!.request(game, address, port, 'GET', '/-/healthy', {}, '');
  if (r.kind === 'refused') return `amtool: error: Get "${url}${api}": dial tcp ${host === 'localhost' ? '[::1]' : address}:${port}: connect: connection refused`;
  if (r.kind === 'timeout') return `amtool: error: Get "${url}${api}": context deadline exceeded`;
  if (r.kind !== 'http' || r.body !== 'OK') return `amtool: error: [GET ${api}][404] unexpected status code`;
  return am(game)!;
}

function readAmMatchers(game: Shell, words: string[]): Matcher[] | string {
  const out: Matcher[] = [];
  for (const [i, w] of words.entries()) {
    for (const part of w.replace(/^\{|\}$/g, '').split(',').filter(Boolean)) {
      if (i === 0 && !/[=~!]/.test(part)) {
        out.push({ name: 'alertname', op: '=', value: part });
        continue;
      }
      const m = readMatcher(part);
      if (!m) return `amtool: error: bad matcher format: ${part}`;
      out.push(m);
    }
  }
  return out;
}

function parseTime(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export const PROMETHEUS_COMMANDS: Record<string, Command> = {
  promtool: {
    ownOptions: true,
    launch: ({ args, input, game }) => {
      if (args[0] === '--version') return BUILD('promtool', PROMETHEUS_VERSION);
      const f = flags(args, ['time', 'format']);
      if (f.error) return game.error(`promtool: error: ${f.error}, try --help`, 1);
      const [cmd, sub, ...rest] = f.rest;
      if (!cmd) return game.error('promtool: error: expected command but got nothing, try --help', 1);
      if (cmd === 'check') {
        if (sub === 'config') {
          if (!rest.length) return game.error("promtool: error: required argument 'config-files' not provided, try --help", 1);
          const out = checkConfig(game, rest);
          if (game.status) return game.error(out.trimEnd(), 1);
          return out.trimEnd();
        }
        if (sub === 'rules') {
          if (!rest.length) {
            if (input === null) return game.error("promtool: error: required argument 'rule-files' not provided, try --help", 1);
          }
          const out = checkRules(game, rest);
          if (game.status) return game.error(out.trimEnd(), 1);
          return out.trimEnd();
        }
        if (sub === 'metrics') {
          // The exposition read from the input: a few of promtool's lint checks.
          const problems: string[] = [];
          const types = [...(input ?? '').matchAll(/^# TYPE (\S+) (\S+)/gm)];
          const helps = new Set([...(input ?? '').matchAll(/^# HELP (\S+)/gm)].map((m) => m[1]));
          for (const [, name, type] of types) {
            if (type === 'counter' && !name.endsWith('_total')) problems.push(`${name} counter metrics should have "_total" suffix`);
            if (!helps.has(name)) problems.push(`${name} no help text`);
          }
          if (problems.length) {
            game.status = 3;
            return problems.join('\n');
          }
          return '';
        }
        return game.error(`promtool: error: expected command but got "${sub ?? ''}", try --help`, 1);
      }
      if (cmd === 'query') {
        if (sub !== 'instant') return game.error(sub === 'range' || sub === 'series' || sub === 'labels' ? game.t('promtool-query-not-simulated', { command: sub }) : `promtool: error: expected command but got "${sub ?? ''}", try --help`, 1);
        const [server, expr] = rest;
        if (!server) return game.error("promtool: error: required argument 'server' not provided, try --help", 1);
        if (expr === undefined) return game.error("promtool: error: required argument 'expr' not provided, try --help", 1);
        const net = metricsNet(game);
        const m = /^(?:https?:\/\/)?([^/:]+)(?::(\d+))?/.exec(server);
        const address = m && net?.resolve(game, m[1]);
        const port = Number(m?.[2] ?? 80);
        const r = address ? net!.request(game, address, port, 'GET', '/-/ready', {}, '') : null;
        if (!r || r.kind !== 'http' || !/Ready/.test(r.body))
          return game.error(`query error: Post "${server.replace(/\/$/, '')}/api/v1/query": ${!address ? `dial tcp: lookup ${m?.[1] ?? server}: no such host` : r?.kind === 'timeout' ? 'context deadline exceeded' : `dial tcp ${m?.[1] === 'localhost' ? '[::1]' : address}:${port}: connect: connection refused`}`, 1);
        let t = clock(game);
        if (f.flags.time) {
          const parsed = parseTime(f.flags.time) ?? (Number.isFinite(Number(f.flags.time)) ? Number(f.flags.time) * 1000 : null);
          if (parsed === null) return game.error(`error parsing evaluation time: cannot parse "${f.flags.time}" to a valid timestamp`, 1);
          t = parsed;
        }
        const q = query(game, expr, t);
        if ('error' in q) return game.error(`query error: ${q.type}: ${q.error}`, 1);
        if (f.flags.format === 'json') return goJson((resultFor(q.value, t) as { result: unknown }).result);
        const v = q.value;
        const info = q.infos.map((x) => `Warnings: ${x}`);
        const body =
          v.type === 'scalar'
            ? `scalar: ${formatValue(v.v)} @[${seconds(t)}]`
            : v.type === 'vector'
              ? v.samples.map((s) => promqlLine(s.labels, s.v, t)).join('\n')
              : v.type === 'matrix'
                ? v.series.map((s) => `${labelsText(s.labels)} =>\n${s.samples.map((x) => `${formatValue(x.v)} @[${seconds(x.t)}]`).join('\n')}`).join('\n')
                : `string: ${v.v} @[${seconds(t)}]`;
        return [...info, body].filter(Boolean).join('\n');
      }
      if (cmd === 'test') return game.error(game.t('promtool-test-not-simulated'), 1);
      return game.error(`promtool: error: expected command but got "${cmd}", try --help`, 1);
    },
  },

  amtool: {
    ownOptions: true,
    launch: ({ args, game }) => {
      if (args[0] === '--version') return BUILD('amtool', ALERTMANAGER_VERSION);
      const f = flags(args, ['alertmanager.url', 'duration', 'comment', 'author', 'output', 'start', 'end', 'config.file', 'verify.receivers', 'within']);
      if (f.error) return game.error(`amtool: error: ${f.error}, try --help`, 1);
      const [cmd, sub, ...rest] = f.rest;
      const t = clock(game);
      const output = f.flags.output ?? amtoolDefault(game, 'output') ?? 'simple';
      if (!cmd) return game.error('amtool: error: expected command but got nothing, try --help', 1);
      if (cmd === 'check-config') {
        const files = [sub, ...rest].filter(Boolean);
        if (!files.length) return game.error("amtool: error: required argument 'check-files' not provided, try --help", 1);
        const out: string[] = [];
        let failed = 0;
        for (const file of files) {
          const text = game.read(file);
          if (text === null) {
            out.push(`Checking '${file}'  FAILED: open ${file}: no such file or directory`, '');
            failed++;
            continue;
          }
          try {
            const c = readAmConfig(text);
            out.push(`Checking '${file}'  SUCCESS`, 'Found:', ' - global config', ' - route', ` - ${c.inhibit.length} inhibit rules`, ` - ${c.receivers.length} receivers`, ` - ${c.templates} templates`, '');
          } catch (e) {
            out.push(`Checking '${file}'  FAILED: ${(e as Error).message}`, '');
            failed++;
          }
        }
        if (failed) return game.error(`${out.join('\n')}\namtool: error: failed to validate ${failed} file(s)`, 1);
        return out.join('\n').trimEnd();
      }
      if (cmd === 'config') {
        // config routes: from --config.file, or the running Alertmanager's configuration.
        const fromFile = f.flags['config.file'];
        let config;
        if (fromFile) {
          const text = game.read(fromFile);
          if (text === null) return game.error(`amtool: error: open ${fromFile}: no such file or directory`, 1);
          try {
            config = readAmConfig(text);
          } catch (e) {
            return game.error(`amtool: error: ${(e as Error).message}`, 1);
          }
        } else {
          const url = amtoolUrl(game, f.flags);
          if (!url) return game.error('amtool: error: required flag --alertmanager.url not provided', 1);
          const s = reachAm(game, url, '/api/v2/status');
          if (typeof s === 'string') return game.error(s, 1);
          if (sub === undefined || sub === 'show') return s.configText.trimEnd();
          config = s.config!;
        }
        if (sub === 'routes' && (rest[0] === undefined || rest[0] === 'show')) return routeTree(config.route);
        if (sub === 'routes' && rest[0] === 'test') {
          const ms = readAmMatchers(game, rest.slice(1).map((x) => (/[=~!]/.test(x) ? x : x)));
          if (typeof ms === 'string') return game.error(ms, 1);
          const labels: Labels = Object.fromEntries(ms.filter((m) => m.op === '=').map((m) => [m.name, m.value]));
          const receivers = routesFor(config.route, labels).map((r) => r.receiver);
          const got = receivers.join(',');
          if (f.flags['verify.receivers'] !== undefined && f.flags['verify.receivers'] !== got) {
            game.status = 1;
            return `${got}\nWARNING: Expected receivers did not match resolved receivers.`;
          }
          return got;
        }
        return game.error(`amtool: error: expected command but got "${sub ?? ''}", try --help`, 1);
      }
      const url = amtoolUrl(game, f.flags);
      if (!url) return game.error('amtool: error: required flag --alertmanager.url not provided', 1);
      if (cmd === 'alert' || cmd === 'alerts') {
        const words = sub === 'query' ? rest : sub === undefined ? [] : [sub, ...rest];
        const s = reachAm(game, url, '/api/v2/alerts');
        if (typeof s === 'string') return game.error(s, 1);
        const ms = readAmMatchers(game, words);
        if (typeof ms === 'string') return game.error(ms, 1);
        const silenced = f.flags.silenced === 'true';
        const inhibited = f.flags.inhibited === 'true';
        const list = amAlerts(s, t, ms, silenced, inhibited, true);
        if (output === 'json') return JSON.stringify(list.map(({ a, st }) => ({ labels: a.labels, annotations: a.annotations, startsAt: rfc3339(a.startsAt), endsAt: rfc3339(a.endsAt), status: st })));
        if (output === 'extended')
          return columns([['Labels', 'Annotations', 'Starts At', 'Ends At', 'Generator URL', 'State'], ...list.map(({ a, st }) => [Object.entries(sortObj(a.labels)).map(([k, v]) => `${k}="${v}"`).join(' '), Object.entries(sortObj(a.annotations)).map(([k, v]) => `${k}="${v}"`).join(' '), amDate(a.startsAt), amDate(a.endsAt), 'http://gauge:9090/graph', st.state])]);
        return columns([['Alertname', 'Starts At', 'Summary', 'State'], ...list.map(({ a, st }) => [a.labels.alertname ?? '', amDate(a.startsAt), a.annotations.summary ?? '', st.state])]);
      }
      if (cmd === 'silence' || cmd === 'silences') {
        const s = reachAm(game, url, '/api/v2/silences');
        if (typeof s === 'string') return game.error(s, 1);
        const action = sub ?? 'query';
        if (action === 'add') {
          const ms = readAmMatchers(game, rest);
          if (typeof ms === 'string') return game.error(ms, 1);
          if (!ms.length) return game.error("amtool: error: required argument 'matcher-groups' not provided, try --help", 1);
          const comment = f.flags.comment ?? amtoolDefault(game, 'comment') ?? '';
          const requireComment = (amtoolDefault(game, 'require-comment') ?? 'true') !== 'false';
          if (!comment && requireComment) return game.error('amtool: error: comment required by config', 1);
          let start = t;
          if (f.flags.start) {
            const x = parseTime(f.flags.start);
            if (x === null) return game.error(`amtool: error: parsing time "${f.flags.start}" as "2006-01-02T15:04:05Z07:00": cannot parse "${f.flags.start}" as "2006"`, 1);
            start = x;
          }
          let end: number;
          if (f.flags.end) {
            const x = parseTime(f.flags.end);
            if (x === null) return game.error(`amtool: error: parsing time "${f.flags.end}" as "2006-01-02T15:04:05Z07:00": cannot parse "${f.flags.end}" as "2006"`, 1);
            end = x;
          } else {
            const d = parseDuration(f.flags.duration ?? '1h');
            if (d === null) return game.error(`amtool: error: time: invalid duration "${f.flags.duration}"`, 1);
            if (d === 0) return game.error('amtool: error: silence duration must be greater than 0', 1);
            end = start + d;
          }
          if (start >= end) return game.error('amtool: error: silence cannot start after it ends', 1);
          const author = f.flags.author ?? amtoolDefault(game, 'author') ?? game.who;
          const x = addSilence(game, { matchers: ms, startsAt: start, endsAt: end, createdBy: author, comment }, t);
          return x.id;
        }
        if (action === 'query') {
          const ms = readAmMatchers(game, rest);
          if (typeof ms === 'string') return game.error(ms, 1);
          const expired = f.flags.expired === 'true';
          const list = s.silences.filter((x) => (expired ? silenceState(x, t) === 'expired' : silenceState(x, t) !== 'expired')).filter((x) => ms.every((m) => x.matchers.some((y) => y.name === m.name && y.value === m.value)));
          if (f.flags.quiet === 'true') return list.map((x) => x.id).join('\n');
          if (output === 'json') return JSON.stringify(list.map((x) => silenceJson(x, t)));
          return columns([['ID', 'Matchers', 'Ends At', 'Created By', 'Comment'], ...list.map((x) => [x.id, x.matchers.map(matcherText).join(' '), amDate(x.endsAt), x.createdBy, x.comment])]);
        }
        if (action === 'expire') {
          if (!rest.length) return game.error('amtool: error: no silence IDs specified', 1);
          for (const id of rest) {
            if (!s.silences.some((x) => x.id === id)) return game.error(`amtool: error: [DELETE /silence/{silenceID}][404] deleteSilenceNotFound`, 1);
            expireSilence(game, id, t);
          }
          return '';
        }
        return game.error(`amtool: error: expected command but got "${action}", try --help`, 1);
      }
      return game.error(`amtool: error: expected command but got "${cmd}", try --help`, 1);
    },
  },

  prometheus: {
    ownOptions: true,
    launch: ({ args, game }) => {
      if (args.includes('--version')) return BUILD('prometheus', PROMETHEUS_VERSION);
      if (args.includes('--config.file') || args.some((a) => a.startsWith('--config.file='))) {
        const file = args.find((a) => a.startsWith('--config.file='))?.split('=')[1] ?? args[args.indexOf('--config.file') + 1] ?? CONFIG_FILE;
        try {
          readPromConfig(game.read(file) ?? '');
        } catch (e) {
          return game.error(`ts=${new Date(clock(game)).toISOString()} caller=main.go:571 level=error msg="Error loading config (--config.file=${file})" file=${file} err="parsing YAML file ${file}: ${(e as ConfigError).message.replace(/\n/g, '\\n')}"`, 2);
        }
      }
      return game.error(`ts=${new Date(clock(game)).toISOString()} caller=main.go:1180 level=error err="opening storage failed: lock DB directory: resource temporarily unavailable"`, 1);
    },
  },
  'prometheus-alertmanager': {
    ownOptions: true,
    launch: ({ args, game }) => (args.includes('--version') ? BUILD('alertmanager', ALERTMANAGER_VERSION) : game.error(`ts=${new Date(clock(game)).toISOString()} caller=main.go:258 level=error msg="unable to initialize gossip mesh" err="create memberlist: Failed to start TCP listener on \\"0.0.0.0\\" port 9094: listen tcp 0.0.0.0:9094: bind: address already in use"`, 1)),
  },
  'prometheus-node-exporter': {
    ownOptions: true,
    launch: ({ args, game }) => (args.includes('--version') ? BUILD('node_exporter', '1.9.0') : game.error(`ts=${new Date(clock(game)).toISOString()} caller=node_exporter.go:247 level=error err="listen tcp :9100: bind: address already in use"`, 1)),
  },

  sleep: {
    ownOptions: true,
    launch: ({ args, game }) => {
      if (!args.length) return game.error("sleep: missing operand\nTry 'sleep --help' for more information.");
      let total = 0;
      for (const a of args) {
        const m = /^(\d+(?:\.\d+)?)([smhd]?)$/.exec(a);
        if (!m) return game.error(`sleep: invalid time interval '${a}'\nTry 'sleep --help' for more information.`);
        total += Number(m[1]) * { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2]]! * 1000;
      }
      // The story decides what the wait means (state.onSleep: time passes); elsewhere, it returns at once.
      game.state.slept = (game.state.slept ?? 0) + total;
      return '';
    },
  },
};

function resultFor(v: import('../promql').Value, t: number) {
  if (v.type === 'vector') return { result: v.samples.map((s) => ({ metric: sortObj(s.labels), value: [seconds(t), formatValue(s.v)] })) };
  if (v.type === 'scalar') return { result: [seconds(t), formatValue(v.v)] };
  return { result: [] };
}

export { matcherText };
