// The Bike Share: Prometheus, its targets and rules, the Alertmanager and
// its silences. Replayed with the console, in every language; the
// expected texts are checked in French. Also: PromQL (parser, evaluator,
// rate's extrapolation), prometheus.yml and rule files as Prometheus reads
// them, the Alertmanager's routing, amtool's matchers, jq.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { machineName } from '../src/engine/machines';
import { evaluate, formatExp, formatValue, parse, PromQLError, type Labels, type Storage, type StoredSeries } from '../src/engine/promql';
import { readPromConfig, readRules, ConfigError, expandTemplate } from '../src/engine/prometheus';
import { readAmConfig, routesFor, routeTree, readMatcher } from '../src/engine/alertmanager';
import { appCounters, errorsUntil } from '../src/engine/chapters/bike-share';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { COMMANDS } from '../src/engine/commands';

const MDP = 'pedal-2029';

// A storage made of fixed series.
const store = (series: StoredSeries[]): Storage => ({ select: (ms) => series.filter((s) => ms.every((m) => (m.op === '=' ? (s.labels[m.name] ?? '') === m.value : m.op === '!=' ? (s.labels[m.name] ?? '') !== m.value : new RegExp(`^(?:${m.value})$`).test(s.labels[m.name] ?? '') === (m.op === '=~')))) });
const counter = (labels: Labels, perSecond: number, from: number, to: number, reset?: number): StoredSeries => {
  const samples = [];
  for (let t = from; t <= to; t += 15_000) samples.push({ t, v: (reset !== undefined && t >= reset ? t - reset : t - from) / 1000 * perSecond });
  return { labels, samples };
};
const T = 1_800_000_000_000;

describe('PromQL', () => {
  it('parses selectors, functions, aggregations and operators, with Prometheus messages', () => {
    expect(parse('rate(http_requests_total{status=~"5.."}[5m])').kind).toBe('call');
    expect(parse('sum by (job) (rate(x_total[5m])) / sum without (route) (rate(x_total[5m])) > bool 0.05').kind).toBe('binary');
    expect(parse('sum(rate(x_total[1m])) by (job)').kind).toBe('aggregate');
    expect(() => parse('rate(up)')).toThrow('expected type range vector in call to function "rate", got instant vector');
    expect(() => parse('up[5m] + 1')).toThrow('binary expression must contain only scalar and instant vector types');
    expect(() => parse('1 > 2')).toThrow('comparisons between scalars must use BOOL modifier');
    expect(() => parse('foo(up)')).toThrow('unknown function with name "foo"');
    expect(() => parse('sum(rate(x[5m])')).toThrow(/parse error: unclosed left parenthesis/);
    expect(() => parse('up{job="node"')).toThrow(PromQLError);
    expect(() => parse('{}')).toThrow('vector selector must contain at least one non-empty matcher');
    expect(() => parse('up[5x]')).toThrow('bad number or duration syntax: "5x"');
  });

  it('rate extrapolates like Prometheus, handles a counter reset, and warns on a gauge', () => {
    const s = store([counter({ __name__: 'x_total', job: 'a' }, 2, T - 600_000, T), counter({ __name__: 'y_total', job: 'a' }, 4, T - 600_000, T, T - 120_000)]);
    const v = evaluate(parse('rate(x_total[5m])'), s, T).value;
    expect(v.type === 'vector' && v.samples[0].v).toBeCloseTo(2, 6);
    const w = evaluate(parse('rate(y_total[5m])'), s, T).value;
    // The sample at the reset counts from zero: the 15 s before it are lost, like in Prometheus.
    expect(w.type === 'vector' && w.samples[0].v).toBeCloseTo(3.8, 6);
    const g = store([{ labels: { __name__: 'node_load1' }, samples: [{ t: T - 60_000, v: 1 }, { t: T, v: 2 }] }]);
    expect(evaluate(parse('rate(node_load1[5m])'), g, T, 'rate(node_load1[5m])').infos[0]).toBe('PromQL info: metric might not be a counter, name does not end in _total/_sum/_count/_bucket: "node_load1" (1:6)');
  });

  it('matches vectors one to one, filters, sums, and refuses many-to-many', () => {
    const s = store([
      { labels: { __name__: 'a', job: 'x', route: '1' }, samples: [{ t: T, v: 3 }] },
      { labels: { __name__: 'a', job: 'x', route: '2' }, samples: [{ t: T, v: 1 }] },
      { labels: { __name__: 'b', job: 'x' }, samples: [{ t: T, v: 8 }] },
    ]);
    const r = evaluate(parse('sum by (job) (a) / on (job) b'), s, T).value;
    expect(r.type === 'vector' && r.samples).toEqual([{ labels: { job: 'x' }, v: 0.5 }]);
    const f = evaluate(parse('a > 2'), s, T).value;
    expect(f.type === 'vector' && f.samples).toEqual([{ labels: { __name__: 'a', job: 'x', route: '1' }, v: 3 }]);
    expect(() => evaluate(parse('b / ignoring (route) a'), s, T)).toThrow(/many-to-many matching not allowed/);
    const stale = store([{ labels: { __name__: 'up', job: 'n' }, samples: [{ t: T - 30_000, v: 1 }, { t: T - 15_000, v: NaN, stale: true }] }]);
    expect((evaluate(parse('up'), stale, T).value as { samples: unknown[] }).samples).toHaveLength(0);
  });

  it('writes values like Go', () => {
    expect(formatValue(0.1)).toBe('0.1');
    expect(formatValue(1e-7)).toBe('0.0000001');
    expect(formatValue(NaN)).toBe('NaN');
    expect(formatValue(Infinity)).toBe('+Inf');
    expect(formatExp(0.072)).toBe('7.2e-02');
    expect(formatExp(1234)).toBe('1.234e+03');
    expect(expandTemplate('{{ $labels.instance }}: {{ $value | humanizePercentage }}', { instance: 'hub:9100' }, 0.12406)).toBe('hub:9100: 12.41%');
  });
});

describe('Prometheus and Alertmanager files', () => {
  it('reads prometheus.yml and says what is wrong, like Prometheus', () => {
    const c = readPromConfig("global:\n  scrape_interval: 15s\nscrape_configs:\n  - job_name: node\n    static_configs:\n      - targets: ['a:9100', 'b:9100']\n        labels:\n          role: docks\n");
    expect(c.jobs[0].targets).toEqual([
      { address: 'a:9100', labels: { role: 'docks' } },
      { address: 'b:9100', labels: { role: 'docks' } },
    ]);
    expect(c.evaluationInterval).toBe(60_000);
    expect(() => readPromConfig('scrape_configs:\n  - job_name: node\n    static_config:\n      - targets: [a]\n')).toThrow('line 3: field static_config not found in type config.ScrapeConfig');
    expect(() => readPromConfig('scrape_configs:\n  - job_name: a\n  - job_name: a\n')).toThrow('found multiple scrape configs with job name "a"');
    expect(() => readPromConfig('global:\n  scrape_interval: 15\n')).toThrow('not a valid duration string: "15"');
    expect(() => readPromConfig("scrape_configs:\n  - job_name: a\n    static_configs:\n      - targets: ['http://a:9100']\n")).toThrow('"http://a:9100" is not a valid hostname');
  });

  it('reads rule files and points at the faulty rule', () => {
    const g = readRules('groups:\n  - name: g\n    rules:\n      - alert: A\n        expr: up == 0\n        for: 2m\n', 'r.yml', 15_000);
    expect(g[0].rules[0]).toMatchObject({ name: 'A', for: 120_000 });
    expect(() => readRules('groups:\n  - name: g\n    rules:\n      - alert: A\n        expr: rate(up[5m]\n', 'r.yml', 15_000)).toThrow(/^r\.yml: 5:15: group "g", rule 1, "A": could not parse expression: 1:/);
    expect(() => readRules('groups:\n  - name: g\n    rules:\n      - alert: A\n        expresion: up\n', 'r.yml', 15_000)).toThrow('field expresion not found in type rulefmt.RuleNode');
  });

  it('routes alerts like the Alertmanager, and reads amtool matchers', () => {
    const c = readAmConfig('route:\n  receiver: team\n  group_by: [alertname]\n  routes:\n    - matchers:\n        - severity="page"\n      receiver: on-call\n      repeat_interval: 2h\nreceivers:\n  - name: team\n  - name: on-call\n');
    expect(routesFor(c.route, { severity: 'page' }).map((r) => r.receiver)).toEqual(['on-call']);
    expect(routesFor(c.route, { severity: 'warning' }).map((r) => [r.receiver, r.repeatInterval])).toEqual([['team', 4 * 3_600_000]]);
    expect(routeTree(c.route)).toBe('Routing tree:\n└── default-route  receiver: team\n    └── {severity="page"}  receiver: on-call');
    expect(() => readAmConfig('route:\n  receiver: nobody\nreceivers:\n  - name: team\n')).toThrow('undefined receiver "nobody" used in route');
    expect(readMatcher('instance=~"hub.*"')).toEqual({ name: 'instance', op: '=~', value: 'hub.*' });
  });

  it('counts the app\'s requests deterministically, with bursts and an incident', () => {
    const t0 = Date.UTC(2029, 4, 15, 8, 0, 0);
    expect(errorsUntil(t0 + 60_000, null) - errorsUntil(t0, null)).toBeCloseTo(0.04 * 60, 6);
    const c = appCounters(t0, t0 + 3_600_000, { from: t0, to: Infinity });
    expect(c.errors / (c.stations + c.notFound + c.rentals + c.returnsOk + c.errors)).toBeCloseTo(0.124, 2);
  });
});

describe('jq', () => {
  const sh = new Shell(STORIES[0].chapters[0], 'en');
  const jq = (filter: string, input: string, ...flags: string[]) => {
    sh.recoverErrors();
    return COMMANDS.jq.launch({ args: [...flags, filter], input, game: sh, last: true });
  };
  it('paths, iteration, construction, select, interpolation, errors', () => {
    expect(jq('.a.b', '{"a":{"b":[1,2]}}', '-c')).toBe('[1,2]');
    expect(jq('.a[] | select(. > 1)', '{"a":[1,2,3]}')).toBe('2\n3');
    expect(jq('{x: .a, y: (.b | length)}', '{"a":"s","b":[1,2]}', '-c')).toBe('{"x":"s","y":2}');
    expect(jq('.[] | "\\(.n) \\(.v)"', '[{"n":"a","v":1}]', '-r')).toBe('a 1');
    expect(jq('.a.b', '{"a":[1]}')).toBe('');
    expect(sh.recoverErrors()[0]).toMatch(/^jq: error \(at <stdin>:\d+\): Cannot index array with "b"$/);
  });
});

for (const language of LANGUAGES)
  describe(`The Bike Share — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const S = machineName(t, 'saddle');
    const H = machineName(t, 'hub');
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...prerequisites('bike-share'), ...finished] });
      const one = (l: string) => {
        let output = c.execute(machinesInLanguage(c.t, L(l))) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh gauge', 'yes']);
      const main = () => ((c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell);
      return { c, play, edit, flag: (id: string) => main().flags.has(id), done: (id: string) => c.finished.includes(id) };
    };
    const PROM = '/etc/prometheus/prometheus.yml';
    const AM = '/etc/prometheus/alertmanager.yml';
    const RULES = '/etc/prometheus/rules/bikes.yml';
    const targets = "curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | \"\\(.labels.instance) \\(.health)\"'";

    // ——— Chapter 1: "The Blind Spot" ———

    const fixTargets = (x: string) => x.replace(`'${S}.internal:9100']`, `'${S}.internal:9100', '${H}.internal:9100']`).replace("['localhost:3000']", `['${S}.internal:3000']`);

    it('chapter 1 — solution: the targets through the API, ufw on saddle for gauge only, the scrape configuration, a reload', () => {
      const { play, edit, flag, done } = part();
      let all = play(['cat message_from_ngozi.txt', "curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, instance: .labels.instance, health, lastError}'"]);
      expect(all).toContain(`"lastError": "Get \\"http://${S}.internal:9100/metrics\\": context deadline exceeded"`);
      expect(all).toContain('dial tcp 127.0.0.1:3000: connect: connection refused');
      expect(flag('targets') && flag('deadline') && flag('refused')).toBe(true);
      contains(all, 'pare-feu qui jette les paquets');
      all = play([`ssh ${S}`, 'yes', 'curl -s localhost:9100/metrics | head -4', 'sudo ufw status']);
      expect(all).toContain('# TYPE node_boot_time_seconds gauge');
      expect(all).toMatch(/3000\/tcp +ALLOW +192\.0\.2\.54/);
      all = play(['sudo ufw allow from 192.0.2.54 to any port 9100 proto tcp', 'curl -s localhost:3000/metrics | grep returns', 'exit']);
      expect(flag('saddle-open')).toBe(true);
      expect(flag('saddle-up')).toBe(true);
      expect(all).toMatch(/http_requests_total\{method="POST",route="\/returns",status="500"\} \d+/);
      edit(`sudo nano ${PROM}`, fixTargets);
      all = play([`promtool check config ${PROM}`]);
      expect(all).toContain(` SUCCESS: ${PROM} is valid prometheus config file syntax`);
      expect(flag('not-reloaded')).toBe(true);
      expect(done('blind-spot')).toBe(false);
      all = play(['sudo systemctl reload prometheus', targets]);
      expect(all).toContain(`${H}.internal:9100 up`);
      expect(all).toContain(`${S}.internal:3000 up`);
      expect(done('blind-spot')).toBe(true);
      contains(all, 'Vous avez terminé L\'Angle mort');
      all = play(["promtool query instant http://localhost:9090 'up == 0'"]);
      expect(all.trim()).toBe('');
    });

    it('chapter 1 — another solution: addresses as targets with a label, a rule without proto, SIGHUP by hand', () => {
      const { play, edit, done } = part();
      play([`ssh ${S}`, 'yes', 'sudo ufw allow from 192.0.2.54 to any port 9100', 'exit']);
      edit(`sudo nano ${PROM}`, (x) => x.replace("['localhost:3000']", "['192.0.2.55:3000']").replace(`'${S}.internal:9100']`, `'${S}.internal:9100']\n      - targets: ['192.0.2.56:9100']\n        labels:\n          role: docks`));
      const all = play(['ps aux | grep prometheus', 'sudo kill -HUP 812', 'ls', "promtool query instant http://localhost:9090 'up{role=\"docks\"}'"]);
      expect(all).toContain('up{instance="192.0.2.56:9100", job="node", role="docks"} => 1');
      expect(done('blind-spot')).toBe(true);
    });

    it('chapter 1 — false leads: 9100 open to everyone, POST /-/reload, a broken file reloaded', () => {
      const { play, edit, flag, done } = part();
      let all = play([`ssh ${S}`, 'yes', 'sudo ufw allow 9100/tcp', 'exit']);
      expect(flag('too-open')).toBe(true);
      expect(flag('saddle-open')).toBe(false);
      contains(all, 'ouvert à tout internet');
      edit(`sudo nano ${PROM}`, (x) => fixTargets(x).replace('    static_configs:\n      - targets: [\'localhost:9090\']', "    static_config:\n      - targets: ['localhost:9090']"));
      all = play([`promtool check config ${PROM}`, 'curl -s -X POST localhost:9090/-/reload']);
      expect(all).toContain(`FAILED: parsing YAML file ${PROM}: yaml: unmarshal errors:`);
      expect(all).toContain('field static_config not found in type config.ScrapeConfig');
      expect(all).toContain('Lifecycle API is not enabled.');
      expect(flag('lifecycle')).toBe(true);
      all = play(['sudo systemctl reload prometheus', 'sudo journalctl -u prometheus -n 3']);
      expect(flag('bad-reload')).toBe(true);
      expect(all).toContain('msg="Error reloading config"');
      contains(all, 'garde la configuration qu\'il avait');
      edit(`sudo nano ${PROM}`, (x) => x.replace('    static_config:', '    static_configs:'));
      play(['sudo systemctl reload prometheus', 'ls']);
      expect(done('blind-spot')).toBe(false);
      play([`ssh ${S}`, 'sudo ufw delete allow 9100/tcp', 'sudo ufw allow from 192.0.2.54 to any port 9100 proto tcp', 'exit']);
      expect(done('blind-spot')).toBe(true);
    });

    // ——— Chapter 2: "The Threshold" ———

    const C1 = ['blind-spot'];
    const rules = (disk: string, errors: string, forErrors = '10m', extra = '') => `groups:
  - name: bikes
    rules:
      - alert: DiskAlmostFull
        expr: ${disk}
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.instance }}: {{ $labels.mountpoint }} almost full"
      - alert: HighErrorRate
        expr: ${errors}
        for: ${forErrors}
        labels:
          severity: page${extra}
        annotations:
          summary: "Errors: {{ $value | humanizePercentage }}"
`;
    const DISK = 'node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes < 0.10';
    const ERRORS = 'sum by (job) (rate(http_requests_total{status=~"5.."}[5m])) / sum by (job) (rate(http_requests_total[5m])) > 0.05';

    it('chapter 2 — solution: queries, two rules, pending then firing, the fixes, resolved', () => {
      const { play, edit, flag, done } = part(C1);
      let all = play(["promtool query instant http://localhost:9090 'node_filesystem_avail_bytes / node_filesystem_size_bytes'"]);
      expect(all).toMatch(new RegExp(`instance="${H}\\.internal:9100", job="node", mountpoint="/"\\} => 0\\.07`));
      all = play([`promtool query instant http://localhost:9090 '${ERRORS.replace(' > 0.05', '')}'`]);
      expect(all).toMatch(/\{job="rental"\} => 0\.12/);
      expect(flag('disk-query') && flag('error-query')).toBe(true);
      edit(`sudo nano ${RULES}`, () => rules(DISK, ERRORS));
      all = play([`promtool check rules ${RULES}`, 'sudo systemctl reload prometheus']);
      expect(all).toContain('  SUCCESS: 2 rules found');
      expect(flag('disk-rule') && flag('error-rule')).toBe(true);
      all = play(["curl -s localhost:9090/api/v1/alerts | jq -r '.data.alerts[] | \"\\(.labels.alertname) \\(.state)\"'"]);
      expect(all).toContain('DiskAlmostFull pending');
      expect(flag('pending')).toBe(true);
      all = play(['sleep 600', 'curl -s localhost:9090/api/v1/alerts | jq -c .data.alerts[]']);
      expect(flag('disk-firing') && flag('error-firing')).toBe(true);
      expect(all).toContain('"state":"firing"');
      contains(all, 'l\'ancienne sauvegarde peut partir');
      play([`ssh ${H}`, 'yes', 'sudo rm /var/backups/docks-2029-04.tar.gz', 'exit']);
      expect(flag('disk-resolved')).toBe(true);
      play([`ssh ${S}`, 'yes', 'sudo systemctl restart rental', 'exit']);
      expect(flag('restart-early')).toBe(false);
      all = play(['sleep 600', 'tail -n 4 /var/log/alert-relay/relay.log']);
      expect(all).toContain('#team RESOLVED HighErrorRate');
      expect(done('threshold')).toBe(true);
      contains(all, 'Vous avez terminé Le Seuil');
    });

    it('chapter 2 — another solution: percentages, a sum without by, two files, SIGHUP', () => {
      const { play, edit, done } = part(C1);
      edit('sudo nano /etc/prometheus/rules/disk.yml', () =>
        `groups:\n  - name: disks\n    rules:\n      - alert: DiskFull\n        expr: node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} * 100 < 10\n        for: 2m\n        labels:\n          severity: warning\n        annotations:\n          summary: disk almost full\n`,
      );
      edit('sudo nano /etc/prometheus/rules/app.yml', () =>
        `groups:\n  - name: app\n    rules:\n      - alert: RentalErrors\n        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05\n        for: 15m\n        labels:\n          severity: page\n        annotations:\n          summary: too many errors\n`,
      );
      play(['sudo kill -HUP 812', 'sleep 1200', `ssh ${H}`, 'yes', 'sudo rm /var/backups/docks-2029-04.tar.gz', 'exit', `ssh ${S}`, 'yes', 'sudo systemctl restart rental', 'exit', 'sleep 900']);
      expect(done('threshold')).toBe(true);
    });

    it('chapter 2 — false leads: rate on a gauge, a raw counter, a series divided by itself, no for:, no labels, the photos, an early restart', () => {
      const { play, edit, flag, done } = part(C1);
      let all = play(["curl -s -G --data-urlencode 'query=rate(node_filesystem_avail_bytes[5m])' localhost:9090/api/v1/query | jq -r '.infos[]'"]);
      expect(all).toContain('PromQL info: metric might not be a counter, name does not end in _total/_sum/_count/_bucket: \\"node_filesystem_avail_bytes\\" (1:6)'.replace(/\\"/g, '"'));
      expect(flag('rate-gauge')).toBe(true);
      // Tomás's fix applied before any alert has fired.
      all = play([`ssh ${S}`, 'yes', 'sudo systemctl restart rental', 'exit']);
      expect(flag('restart-early')).toBe(true);
      contains(all, 'on n\'a jamais vu l\'alerte');
      edit(`sudo nano ${RULES}`, () => rules(DISK, 'http_requests_total{status="500"} > 100'));
      all = play(['sudo systemctl reload prometheus']);
      expect(flag('raw-counter')).toBe(true);
      expect(flag('error-rule')).toBe(false);
      contains(all, 'ne fait que croître');
      edit(`sudo nano ${RULES}`, () => rules(DISK, 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05'));
      all = play(['sudo systemctl reload prometheus']);
      expect(flag('unsummed')).toBe(true);
      contains(all, 'divise chaque série par elle-même');
      edit(`sudo nano ${RULES}`, () => rules(DISK, ERRORS, '0s'));
      all = play(['sudo systemctl reload prometheus']);
      expect(flag('no-for')).toBe(true);
      expect(flag('error-rule')).toBe(false);
      edit(`sudo nano ${RULES}`, () => rules(DISK, 'sum by (job) (rate(http_requests_total{status!="200"}[5m])) / sum by (job) (rate(http_requests_total[5m])) > 0.05'));
      play(['sudo systemctl reload prometheus']);
      expect(flag('not-errors')).toBe(true);
      edit(`sudo nano ${RULES}`, () => rules(DISK, ERRORS).replace('        labels:\n          severity: page\n', ''));
      all = play(['sudo systemctl reload prometheus']);
      expect(flag('error-rule') && flag('labels')).toBe(true);
      all = play([`ssh ${H}`, 'yes', 'sudo rm /srv/docks/photos/2029-02', 'ls /srv/docks/photos', 'exit']);
      expect(flag('photos')).toBe(true);
      edit(`sudo nano ${RULES}`, () => rules(DISK, ERRORS));
      play(['sudo systemctl reload prometheus', 'sleep 900', `ssh ${H}`, 'sudo rm /var/backups/docks-2029-04.tar.gz', 'exit', 'sleep 300']);
      expect(done('threshold')).toBe(true);
    });

    // ——— Chapter 3: "Quiet Hours" ———

    const C2 = ['blind-spot', 'threshold'];
    const fixAm = (x: string) => x.replace('severity="critical"', 'severity="page"').replace('repeat_interval: 1m', 'repeat_interval: 4h');

    it('chapter 3 — solution: the relay\'s log, the routing tree, matcher and repeat fixed, a silence for hub', () => {
      const { play, edit, flag, done } = part(C2);
      let all = play(['tail -n 6 /var/log/alert-relay/relay.log', 'amtool alert query', 'amtool config routes', 'amtool config routes test severity=page alertname=NodeDown']);
      expect(all).toMatch(/#team FIRING DiskAlmostFull device=\/dev\/vdb1/);
      expect(all).toContain('    └── {severity="critical"}  receiver: on-call');
      expect(all).toMatch(/^team$/m);
      expect(flag('repeats') && flag('routes')).toBe(true);
      contains(all, 'critical ne correspond à rien');
      edit(`sudo nano ${AM}`, fixAm);
      all = play([`amtool check-config ${AM}`, 'sudo systemctl reload prometheus-alertmanager', 'amtool config routes test severity=page alertname=NodeDown']);
      expect(all).toContain(`Checking '${AM}'  SUCCESS`);
      expect(all).toMatch(/^on-call$/m);
      expect(flag('routing') && flag('repeat-interval')).toBe(true);
      all = play([`amtool silence add instance="${H}.internal:9100" --duration=2h --comment="disk replaced"`, 'amtool silence query']);
      expect(all).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/m);
      expect(all).toContain(`instance="${H}.internal:9100"`);
      expect(done('quiet-hours')).toBe(true);
      contains(all, 'Vous avez terminé Heures calmes');
      all = play(['sleep 1800', 'amtool alert query --silenced', 'tail -n 3 /var/log/alert-relay/relay.log']);
      expect(all).toMatch(/NodeDown +2029-05-19 10:0\d:\d\d UTC .* suppressed/);
      expect(all).not.toContain('#on-call FIRING NodeDown');
      expect(flag('paged')).toBe(false);
    });

    it('chapter 3 — another solution: match and an inherited repeat, a POST /-/reload, a silence with start and end', () => {
      const { play, edit, done } = part(C2);
      edit(`sudo nano ${AM}`, (x) => x.replace('repeat_interval: 1m', 'repeat_interval: 3h').replace('    - matchers:\n        - severity="critical"\n', '    - match:\n        severity: page\n'));
      play(['curl -s -X POST localhost:9093/-/reload', `amtool silence add alertname=NodeDown instance=~"${H}.*" --start=2029-05-19T09:55:00Z --end=2029-05-19T12:00:00Z --comment="disk swap"`]);
      expect(done('quiet-hours')).toBe(true);
    });

    it('chapter 3 — false leads: a broken file, a silence too broad, then too short, Prometheus stopped, the rule removed', () => {
      const { play, edit, flag, done } = part(C2);
      edit(`sudo nano ${AM}`, (x) => fixAm(x).replace('receiver: on-call', 'reciever: on-call'));
      let all = play([`amtool check-config ${AM}`, 'sudo systemctl reload prometheus-alertmanager']);
      expect(all).toContain('amtool: error: failed to validate 1 file(s)');
      expect(flag('am-invalid') && flag('am-bad-reload')).toBe(true);
      edit(`sudo nano ${AM}`, (x) => x.replace('reciever: on-call', 'receiver: on-call'));
      play(['sudo systemctl reload prometheus-alertmanager']);
      all = play(['amtool silence add severity=page --duration=3h --comment=maintenance']);
      expect(flag('too-broad')).toBe(true);
      contains(all, 'personne ne le saura');
      const id = all.match(/[0-9a-f-]{36}/)![0];
      all = play([`amtool silence expire ${id}`, `amtool silence add instance="${H}.internal:9100" --duration=1h --comment=maintenance`, 'amtool silence add --comment=x']);
      expect(flag('too-short')).toBe(true);
      expect(all).toContain("amtool: error: required argument 'matcher-groups' not provided, try --help");
      expect(done('quiet-hours')).toBe(false);
      play(['sudo systemctl stop prometheus']);
      expect(flag('stopped')).toBe(true);
      play(['sudo systemctl start prometheus', `amtool silence add instance="${H}.internal:9100" --duration=3h --comment="hub maintenance"`]);
      expect(done('quiet-hours')).toBe(true);
    });

    it('chapter 3 — no silence: the on-call phone rings during the maintenance, and removing the rule is no way out', () => {
      const { play, edit, flag, done } = part(C2);
      edit(`sudo nano ${AM}`, fixAm);
      let all = play(['sudo systemctl reload prometheus-alertmanager', 'sleep 1800', 'tail -n 2 /var/log/alert-relay/relay.log']);
      expect(all).toContain(`#on-call FIRING NodeDown instance=${H}.internal:9100`);
      expect(flag('paged')).toBe(true);
      edit(`sudo nano ${RULES}`, (x) => x.replace(/      - alert: NodeDown[\s\S]*$/, ''));
      all = play(['sudo systemctl reload prometheus']);
      expect(flag('rule-removed')).toBe(true);
      contains(all, 'supprimer une règle, c\'est pour toujours');
      expect(done('quiet-hours')).toBe(false);
    });
  });
