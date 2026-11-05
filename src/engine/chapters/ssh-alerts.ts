// Story "The Huts", chapter 3 — "Failed Logins": robots try passwords on
// every hut's SSH. Lou's alert (a small check run by cron) reads one file,
// /var/log/remote/ssh-failures.log, and warns when it grows too fast: it
// must hold the failed logins of every hut, and nothing else. The huts'
// messages already go to one file per hut, then stop (chapter 1): a rule
// placed after that stop never sees them.
// Commands: the rules (/etc/rsyslog.d), rsyslogd -N1, if $programname ==
// 'sshd' and $msg contains 'Failed password' then …, the order of the files
// (10-remote.conf before 20-…), systemctl restart rsyslog, logger -t sshd
// to try it, tail.
// Objective checked on the state: ssh-failures.log holds failed logins from
// at least two huts, and only failed logins; the per-hut files still
// receive. Traps: a rule after the stop (nothing arrives), a filter on the
// program alone (accepted logins too), a filter that drops the per-hut files.
// Sources: https://www.rsyslog.com/doc/rainerscript/control_structures.html,
// https://www.rsyslog.com/doc/configuration/properties.html

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { name } from '../world';
import { readConfig, route, rsyslog } from '../rsyslog';
import { HOME, HUTS, PASSWORD, accounts, hutsState, hutsWorld, passTime, prepareRsyslog, REMOTE_CONF, RSYSLOG_CONF_UDP, remoteHistory, running, seen } from './huts';
import { newFirewall } from '../firewall';

const BOOT = Date.UTC(2028, 4, 1, 6, 0, 0);
const NOW = Date.UTC(2028, 5, 20, 21, 5, 0);
export const ALERTS = '/var/log/remote/ssh-failures.log';

const lines = (j: Game, path: string) => (j.read(path) ?? '').split('\n').filter(Boolean);
const hutOf = (l: string) => l.split(' ').filter(Boolean)[3];
const onlyFailures = (j: Game) => lines(j, ALERTS).every((l) => / sshd\[\d+\]: Failed password /.test(l));
const huts = (j: Game) => new Set(lines(j, ALERTS).map(hutOf).filter((h) => HUTS.map((x) => name(j.t, x)).includes(h))).size;
// Where each hut's messages go under the running configuration.
const routes = (j: Game) => {
  const r = rsyslog(j);
  const c = r?.config;
  if (!r || !c || !running(j, 'rsyslog')) return null;
  return r.senders.flatMap((s) => s.messages.map((m) => ({ host: s.host, failure: m.program === 'sshd' && m.text.startsWith('Failed password'), to: route(j, c, { ...m, host: s.host, address: s.address }) })));
};
// The per-hut files keep receiving: every message of a hut reaches a file
// that only this hut's messages reach (whatever its name).
const perHut = (j: Game) => {
  const all = routes(j);
  if (!all) return false;
  const owners = new Map<string, Set<string>>();
  for (const x of all) for (const p of x.to) owners.set(p, (owners.get(p) ?? new Set()).add(x.host));
  return all.every((x) => x.to.some((p) => p !== ALERTS && owners.get(p)!.size === 1));
};
// The running configuration has a rule for ssh-failures.log, but a hut's failed
// login never reaches it (it stops at the per-hut rule, before).
const afterStop = (j: Game) => {
  const c = rsyslog(j)?.config;
  return !!c?.rules.some((x) => x.actions.some((a) => a.kind === 'file' && a.path === ALERTS)) && !!routes(j)?.some((x) => x.failure && !x.to.includes(ALERTS));
};
// Exactly the failed logins go to ssh-failures.log.
const exact = (j: Game) => routes(j)?.every((x) => x.to.includes(ALERTS) === x.failure) ?? false;

export const sshAlerts: Chapter = {
  id: 'ssh-alerts',
  number: 3,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'mkdir', 'mv', 'cp', 'wc',
    'systemctl', 'journalctl', 'ss', 'ufw', 'rsyslogd', 'logger',
  ],
  home: HOME,
  welcome: 'message_from_lou.txt',
  names: true,
  final: 'end',
  steps: ['failures', 'rule', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) =>
    hutsState(t, {
      boot: BOOT,
      now: NOW,
      firewall: { ...newFirewall(), enabled: true, rules: [{ action: 'allow', to: '22/tcp', ports: [22], forEachOf: null }, { action: 'allow', to: '514/udp', ports: [514], forEachOf: '198.51.100.0/24' }] },
    }),
  initialise: prepareRsyslog,
  afterCommand: passTime,
  createWorld: (t) =>
    hutsWorld(t, {
      welcome: { 'message_from_lou.txt': t('ssh-alerts-message-lou') },
      conf: RSYSLOG_CONF_UDP,
      dropIns: { '10-remote.conf': REMOTE_CONF },
      remote: remoteHistory(t, NOW),
    }),
  events: [
    {
      id: 'failures',
      condition: (j) => seen(j, 'Failed password'),
      message: (j) => j.t('ssh-alerts-event-failures'),
    },
    {
      id: 'rule',
      condition: (j) => readConfig(j).rules.some((r) => r.actions.some((a) => a.kind === 'file' && a.path === ALERTS)),
      message: (j) => j.t('ssh-alerts-event-rule'),
    },
    {
      id: 'after-stop',
      condition: (j) => running(j, 'rsyslog') && afterStop(j),
      message: (j) => j.t('ssh-alerts-event-after-stop'),
    },
    {
      id: 'too-wide',
      condition: (j) => (lines(j, ALERTS).length > 0 && !onlyFailures(j)) || (!!routes(j)?.some((x) => !x.failure && x.to.includes(ALERTS))),
      message: (j) => j.t('ssh-alerts-event-too-wide'),
    },
    {
      id: 'per-hut-broken',
      condition: (j) => routes(j) !== null && !perHut(j),
      message: (j) => j.t('ssh-alerts-event-per-hut-broken'),
    },
    {
      id: 'end',
      condition: (j) => exact(j) && perHut(j) && huts(j) >= 2,
      message: (j) => j.t('ssh-alerts-event-end'),
    },
  ],
};
