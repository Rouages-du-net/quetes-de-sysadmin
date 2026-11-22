// Story "The Choir", chapter "Kept Forever": the board adopted a retention
// policy in 2029 (/srv/choir/docs/retention-policy.txt) and nobody applied
// it. The web server's access logs, with every visitor's full address, go
// back to September 2027: Ruben's logrotate keeps 520 weeks. The journal
// keeps three and a half years. The members' area's security log is
// already right (12 months), and must stay.
// The fix: logrotate brought to 30 days (daily + rotate 30, weekly +
// rotate 3, or maxage 30), the archives older than 30 days removed (find
// -mtime +30 -delete, or by hand: logrotate only removes the log that passes
// its count, not the ones a larger count left behind), the addresses
// truncated in new lines (map + log_format + access_log, nginx -t, reload),
// and journald's MaxRetentionSec= (restart, or a vacuum on top).
// Objective checked on the state: logrotate's retention for access.log at
// most 31 days, no file of /var/log/nginx older than that, the last three
// weeks still there, the loaded nginx writing neither the IPv4 nor the IPv6
// address of a visitor (and still logging), journald's retention loaded and
// no archived journal older than 31 days, the audit archives of the last
// 12 months still there.
// False leads: emptying today's log only, deleting all logs (the policy
// keeps 30 days, and the audit log 12 months), access_log off, a map that
// keeps IPv6 addresses whole, a vacuum without MaxRetentionSec=, a file
// edited but not reloaded.
// Sources: https://nginx.org/en/docs/http/ngx_http_log_module.html,
// https://nginx.org/en/docs/http/ngx_http_map_module.html,
// https://man7.org/linux/man-pages/man8/logrotate.8.html (rotate, maxage),
// https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html#MaxRetentionSec=.

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { f } from '../world';
import { maxRetention } from '../journal-files';
import {
  ACCESS, ARCHIVES, HOME, PASSWORD, accessRetention, auditLost, choirAccounts, choirState, choirWorld, initialiseChoir, loaded, oldJournals, oldNginxFiles, passTime, recentKept, todayFirstLine, sd, seen, typed, wouldLog,
} from './choir';

const V4 = '203.0.113.57';
const V6 = '2001:db8:4a::17';
const rotationOk = (j: Game) => (accessRetention(j) ?? Infinity) <= 31;
const purged = (j: Game) => oldNginxFiles(j).length === 0;
const nginxUp = (j: Game) => sd(j).services.nginx?.state === 'active' && !!loaded(j);
const logs = (j: Game, a: string) => (nginxUp(j) ? wouldLog(j, a) : []);
const logsOff = (j: Game) => nginxUp(j) && logs(j, V4).length === 0;
const anonymised = (j: Game) => {
  const lines = [...logs(j, V4), ...logs(j, V6)];
  return lines.length > 0 && lines.every((l) => !l.includes(V4) && !l.includes(V6) && l.includes('GET / '));
};
const journalOk = (j: Game) => {
  const r = j.state.journalRetention as number | null | undefined;
  return !!r && r <= 31 * 86_400_000 && oldJournals(j).length === 0;
};
// A map or log_format written in the files, that the running nginx hasn't loaded.
const writtenNotLoaded = (j: Game) => {
  const texts = ['/etc/nginx/nginx.conf', '/etc/nginx/sites-available/choir', ...Object.keys((j.find('/etc/nginx/conf.d') as { children?: Record<string, unknown> })?.children ?? {}).map((n) => `/etc/nginx/conf.d/${n}`)].map((p) => j.read(p) ?? '');
  return texts.some((x) => /^\s*(map|log_format)\b/m.test(x)) && !anonymised(j) && !logsOff(j);
};
const allKept = (j: Game) => auditLost(j).length === 0 && recentKept(j);

export const keptForever: Chapter = {
  id: 'kept-forever',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'zcat', 'zgrep', 'wc', 'du', 'df', 'find', 'rm', 'cp', 'nano', 'sudo', 'systemctl', 'journalctl', 'logrotate', 'nginx', 'curl', 'date', 'exit'],
  home: HOME,
  welcome: 'message_from_amara.txt',
  names: true,
  final: 'end',
  steps: ['policy', 'forever', 'rotation', 'purged', 'anonymised', 'journal', 'end'],
  password: PASSWORD,
  accounts: choirAccounts,
  state: (t) => choirState(t, 1),
  initialise: (j) => initialiseChoir(j, 1),
  createWorld: (t) =>
    choirWorld(t, 1, {
      'message_from_amara.txt': f(t('kept-forever-message-amara')),
      'note_from_ruben.txt': f(t('kept-forever-note-ruben')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'policy', condition: (j) => seen(j, j.t('choir-policy-marker')), message: (j) => j.t('kept-forever-event-policy') },
    {
      id: 'forever',
      condition: (j) => seen(j, `access.log.${ARCHIVES}.gz`) || seen(j, /^\s*rotate 520\s*$/m),
      message: (j) => j.t('kept-forever-event-forever', { weeks: String(ARCHIVES) }),
    },
    { id: 'today-only', condition: (j) => !(j.read(ACCESS) ?? '').includes(todayFirstLine()) && oldNginxFiles(j).length > 0, message: (j) => j.t('kept-forever-event-today-only') },
    { id: 'too-much', condition: (j) => !allKept(j), message: (j) => j.t('kept-forever-event-too-much') },
    { id: 'rotation', condition: rotationOk, message: (j) => j.t('kept-forever-event-rotation') },
    {
      id: 'leftovers',
      condition: (j) => rotationOk(j) && (j.state.logrotateRuns ?? 0) > 0 && !purged(j),
      message: (j) => j.t('kept-forever-event-leftovers', { count: oldNginxFiles(j).length }),
    },
    { id: 'purged', condition: (j) => purged(j) && allKept(j), message: (j) => j.t('kept-forever-event-purged') },
    { id: 'log-off', condition: logsOff, message: (j) => j.t('kept-forever-event-log-off') },
    { id: 'v6-whole', condition: (j) => logs(j, V6).some((l) => l.includes(V6)) && !logs(j, V4).some((l) => l.includes(V4)), message: (j) => j.t('kept-forever-event-v6-whole') },
    { id: 'not-loaded', condition: (j) => writtenNotLoaded(j) && /nginx -t|cat .*nginx|tail .*access/.test(typed(j)), message: (j) => j.t('kept-forever-event-not-loaded') },
    { id: 'anonymised', condition: anonymised, message: (j) => j.t('kept-forever-event-anonymised') },
    { id: 'vacuum-only', condition: (j) => oldJournals(j).length === 0 && !j.state.journalRetention, message: (j) => j.t('kept-forever-event-vacuum-only') },
    { id: 'journal-not-loaded', condition: (j) => !!maxRetention(j) && !j.state.journalRetention && /journal/.test(typed(j)), message: (j) => j.t('kept-forever-event-journal-not-loaded') },
    { id: 'journal', condition: journalOk, message: (j) => j.t('kept-forever-event-journal') },
    {
      id: 'end',
      condition: (j) => rotationOk(j) && purged(j) && allKept(j) && anonymised(j) && journalOk(j),
      message: (j) => j.t('kept-forever-event-end'),
    },
  ],
};
