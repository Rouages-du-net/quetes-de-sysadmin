// Story "The Huts", chapter 1 — "Gathering the Logs": Lou configured the
// three huts to send their logs to the valley (*.* @valley.internal:514,
// UDP), but nothing arrives: the valley's rsyslog doesn't listen (imudp is
// commented out, as Debian installs it), and ufw only lets SSH in. Once
// they arrive, the huts' messages must go to one file per hut, not into
// the valley's own /var/log/syslog.
// Commands: ss -ulnp, the configuration (/etc/rsyslog.conf, rsyslog.d),
// rsyslogd -N1, systemctl restart rsyslog, ufw allow, a template with
// %HOSTNAME%, stop, logger, tail.
// Objective checked on the state: rsyslog listens on UDP 514, the firewall
// lets the huts in, each hut's messages arrive in a file of its own, and
// none of them land in a file the valley's own messages reach. Several right answers: legacy or
// RainerScript syntax, a template on %HOSTNAME% or %FROMHOST-IP%, a
// firewall rule for 514/udp or for the huts' network.
// Sources: https://www.rsyslog.com/doc/configuration/modules/imudp.html,
// https://www.rsyslog.com/doc/configuration/templates.html,
// https://www.rsyslog.com/doc/configuration/filters.html

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { name } from '../world';
import { readConfig, route, rsyslog } from '../rsyslog';
import { HOME, HUTS, PASSWORD, accounts, hutsState, hutsWorld, passTime, prepareRsyslog, RSYSLOG_CONF, running, seen, sshOnly } from './huts';

const BOOT = Date.UTC(2028, 4, 1, 6, 0, 0);
const NOW = Date.UTC(2028, 4, 2, 10, 12, 0);

const listens = (j: Game) => (rsyslog(j)?.config?.inputs ?? []).some((i) => i.type === 'imudp' && i.port === 514);
const arrived = (j: Game) => Object.keys(rsyslog(j)?.received ?? {}).length;
const hutNames = (j: Game) => HUTS.map((h) => name(j.t, h));
/** The files under /var/log that hold this hut's lines, and only its lines. */
function ownFile(j: Game, hut: string): string | null {
  const found: string[] = [];
  const walk = (path: string) => {
    const n = j.find(path);
    if (n?.type === 'directory') for (const c of Object.keys(n.children)) walk(`${path}/${c}`);
    else if (n?.type === 'file' && typeof n.content === 'string' && n.content.includes(` ${hut} `)) {
      const lines = n.content.split('\n').filter(Boolean);
      if (lines.every((l) => l.split(' ').filter(Boolean)[3] === hut)) found.push(path);
    }
  };
  walk('/var/log');
  return found[0] ?? null;
}
// Mixed: under the running configuration, a hut's message lands in a file
// that the valley's own messages also reach (syslog, cron.log…).
function mixed(j: Game): boolean {
  const r = rsyslog(j);
  const c = r?.config;
  if (!r || !c || !running(j, 'rsyslog')) return false;
  const local = new Set<string>();
  const out: string[] = [];
  for (const s of r.senders)
    for (const m of s.messages) {
      route(j, c, { ...m, host: 'valley', address: '127.0.0.1' }).forEach((p) => local.add(p));
      out.push(...route(j, c, { ...m, host: s.host, address: s.address }));
    }
  return out.some((p) => local.has(p));
}

export const centralLogs: Chapter = {
  id: 'central-logs',
  number: 1,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'mkdir',
    'systemctl', 'journalctl', 'ss', 'ufw', 'rsyslogd', 'logger',
  ],
  home: HOME,
  welcome: 'message_from_lou.txt',
  names: true,
  final: 'end',
  steps: ['silent', 'listening', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => hutsState(t, { boot: BOOT, now: NOW, firewall: sshOnly() }),
  initialise: prepareRsyslog,
  afterCommand: passTime,
  createWorld: (t) => hutsWorld(t, { welcome: { 'message_from_lou.txt': t('central-logs-message-lou') }, conf: RSYSLOG_CONF }),
  events: [
    {
      id: 'silent',
      condition: (j) => seen(j, '#module(load="imudp")') || (seen(j, 'State') && seen(j, 'Local Address') && !listens(j)),
      message: (j) => j.t('central-logs-event-silent'),
    },
    {
      id: 'restart-needed',
      condition: (j) => readConfig(j).inputs.some((i) => i.type === 'imudp') && !listens(j),
      message: (j) => j.t('central-logs-event-restart-needed'),
    },
    {
      id: 'listening',
      condition: (j) => listens(j),
      message: (j) => j.t('central-logs-event-listening'),
    },
    {
      id: 'firewall',
      condition: (j) => listens(j) && !arrived(j) && Object.values(rsyslog(j)?.lost ?? {}).some((n) => n > 3),
      message: (j) => j.t('central-logs-event-firewall'),
    },
    {
      id: 'mixed',
      condition: (j) => arrived(j) > 0 && mixed(j),
      message: (j) => j.t('central-logs-event-mixed'),
    },
    {
      id: 'config-error',
      condition: (j) => (rsyslog(j)?.config?.errors.length ?? 0) > 0,
      message: (j) => j.t('central-logs-event-config-error'),
    },
    {
      id: 'end',
      condition: (j) => running(j, 'rsyslog') && listens(j) && hutNames(j).every((h) => ownFile(j, h)) && !mixed(j),
      message: (j) => j.t('central-logs-event-end', { file: ownFile(j, hutNames(j)[0])! }),
    },
  ],
};
