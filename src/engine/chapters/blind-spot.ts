// Story "The Bike Share", chapter "The Blind Spot": last Saturday the
// docking stations' gateway (hub) stopped and nobody knew until the phones
// rang; yet Aroha had installed Prometheus on gauge. Its targets tell why:
// saddle's node exporter doesn't answer (saddle's ufw drops port 9100:
// "context deadline exceeded"), the rental job still scrapes localhost:3000
// (Aroha's first test, before the app moved to saddle: "connection
// refused"), and hub was never added. You read the targets through the
// HTTP API (curl, jq) or promtool query instant, look at an exporter's
// /metrics, open 9100 on saddle for gauge only, fix the scrape
// configuration (static_configs, targets, labels), check it (promtool check
// config) and have Prometheus reread it (systemctl reload prometheus, which
// sends SIGHUP; POST /-/reload only with --web.enable-lifecycle).
// Objective checked on the state: the five targets (Prometheus, the three
// node exporters, the app) up in the running configuration, no target
// down, the file the same as what runs, saddle's 9100 open to gauge and
// closed to the internet.
// Sources: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config,
// https://prometheus.io/docs/prometheus/latest/querying/api/#targets,
// https://prometheus.io/docs/prometheus/latest/command-line/promtool/,
// https://prometheus.io/docs/prometheus/latest/management_api/#reload.

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { verdict, type Firewall } from '../firewall';
import { prom, readAll } from '../prometheus';
import { HOME, PASSWORD, OUTSIDE, WANTED, gaugeAccounts, gaugeState, gaugeWorld, initialiseGauge, saddleHost, hubHost, passTime, seen, host, isUp, saddleFirewallOk, configSaved, targetsOf, SADDLE, HUB } from './bike-share';

const notReloaded = (j: Game) => {
  const r = readAll(j);
  return !('error' in r) && r.text !== prom(j)?.configText;
};

export const blindSpot: Chapter = {
  id: 'blind-spot',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'curl', 'jq', 'promtool', 'prometheus', 'systemctl', 'journalctl', 'ps', 'kill', 'ss', 'ssh', 'sleep', 'exit'],
  home: HOME,
  welcome: 'message_from_ngozi.txt',
  names: true,
  final: 'end',
  steps: ['targets', 'deadline', 'refused', 'saddle-open', 'config-check', 'hub-up', 'end'],
  password: PASSWORD,
  accounts: gaugeAccounts,
  state: (t) => gaugeState(t, 1),
  initialise: initialiseGauge,
  hosts: { saddle: saddleHost(1), hub: hubHost(1) },
  createWorld: (t) =>
    gaugeWorld(t, 1, {
      'message_from_ngozi.txt': f(t('blind-spot-message-ngozi')),
      'note_from_tomas.txt': f(t('blind-spot-note-tomas')),
    }),
  afterCommand: passTime,
  events: [
    { id: 'targets', condition: (j) => seen(j, /"health": ?"down"/) || seen(j, /^up\{[^}]*\} => 0 @/m) || seen(j, /"__name__": ?"up"[^}]*\},\s*"value": ?\[\s*[\d.]+,\s*"0"/), message: (j) => j.t('blind-spot-event-targets') },
    { id: 'deadline', condition: (j) => seen(j, 'context deadline exceeded'), message: (j) => j.t('blind-spot-event-deadline') },
    { id: 'refused', condition: (j) => seen(j, /127\.0\.0\.1:3000: connect: connection refused/), message: (j) => j.t('blind-spot-event-refused') },
    { id: 'exporter', condition: (j) => seen(j, '# TYPE node_cpu_seconds_total counter'), message: (j) => j.t('blind-spot-event-exporter') },
    { id: 'app-metrics', condition: (j) => seen(j, '# TYPE http_requests_total counter'), message: (j) => j.t('blind-spot-event-app-metrics') },
    { id: 'too-open', condition: (j) => verdict(host(j, 'saddle').state.ufw as Firewall, 9100, OUTSIDE) === 'accepted', message: (j) => j.t('blind-spot-event-too-open') },
    { id: 'saddle-open', condition: saddleFirewallOk, message: (j) => j.t('blind-spot-event-saddle-open') },
    { id: 'config-invalid', condition: (j) => seen(j, 'FAILED: parsing YAML file'), message: (j) => j.t('blind-spot-event-config-invalid') },
    { id: 'config-check', condition: (j) => seen(j, 'is valid prometheus config file syntax'), message: (j) => j.t('blind-spot-event-config-check') },
    { id: 'lifecycle', condition: (j) => seen(j, 'Lifecycle API is not enabled.'), message: (j) => j.t('blind-spot-event-lifecycle') },
    { id: 'bad-reload', condition: (j) => prom(j)?.lastReload.ok === false, message: (j) => j.t('blind-spot-event-bad-reload') },
    { id: 'not-reloaded', condition: (j) => notReloaded(j) && seen(j, 'is valid prometheus config file syntax'), message: (j) => j.t('blind-spot-event-not-reloaded') },
    { id: 'saddle-up', condition: (j) => isUp(j, SADDLE, 9100), message: (j) => j.t('blind-spot-event-saddle-up') },
    { id: 'rental-up', condition: (j) => isUp(j, SADDLE, 3000), message: (j) => j.t('blind-spot-event-rental-up') },
    { id: 'hub-up', condition: (j) => isUp(j, HUB, 9100), message: (j) => j.t('blind-spot-event-hub-up') },
    {
      id: 'end',
      condition: (j) => WANTED.every(([a, p]) => isUp(j, a, p)) && targetsOf(j).every((x) => x.health === 'up') && saddleFirewallOk(j) && configSaved(j),
      message: (j) => j.t('blind-spot-event-end', { targets: String(targetsOf(j).length) }),
    },
  ],
};
