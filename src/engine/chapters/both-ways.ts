// Story "The Ferry", chapter "Both Ways": the first Saturday of the
// season, bookings open at nine. On Amaru's phone (mobile data, IPv6) the
// site hesitates or fails; on the office's Wi-Fi (IPv4) it shows, but
// /booking/ answers "502 Bad Gateway" since Lucía updated the app last
// night. Two faults, one per family:
//   - nginx only listens in IPv4 ("listen 80;"): over IPv6 the connection
//     is refused, and the browser falls back to IPv4 (happy eyeballs,
//     RFC 8305) when it can; a "listen [::]:80;" line (IPv6 only by
//     default, ipv6only=on) is missing;
//   - the app now listens on "localhost", which Node.js resolves to ::1
//     first, while nginx's proxy_pass asks 127.0.0.1: "connect() failed
//     (111: Connection refused) while connecting to upstream".
// You see it from outside (curl -4/-6 -v from lookout), read the sockets
// (ss -tlnp) and nginx's error log, then fix both (nginx -t, reload; the
// app's HOST and a restart, or proxy_pass to [::1]).
// Objective checked on the state: from the internet, in IPv4 and in IPv6,
// the timetable and the booking page answer 200.
// Sources: https://nginx.org/en/docs/http/ngx_http_core_module.html#listen (ipv6only),
// https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass,
// https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback,
// https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder (verbatim order since Node.js 17),
// https://www.rfc-editor.org/rfc/rfc8305 (happy eyeballs).

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { listens } from '../ipv6';
import { M, NOW_3, PASSWORD, QUAY4, SITE, STATIC, ferryAccounts, ferryState, ferryWorld, initialiseFerry, lookoutHost, lookoutSaw, visit, bookingBind } from './ferry';

const seen = (j: Game) => `${j.last.output}\n${j.last.errors.join('\n')}\n${lookoutSaw(j)}`;
const typed = (j: Game) => (j as Shell).commandLine ?? '';
const v6Site = (j: Game) => listens(j, 6, STATIC, 80);
const all = (j: Game) => [visit(j, 4, '/'), visit(j, 6, '/'), visit(j, 4, '/booking/'), visit(j, 6, '/booking/')];

export const bothWays: Chapter = {
  id: 'both-ways',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'ss', 'curl', 'nginx', 'systemctl', 'journalctl', 'ping', 'ping6', 'nc', 'dig', 'ssh', 'exit'],
  home: M,
  welcome: 'message_from_amaru.txt',
  names: true,
  final: 'end',
  steps: ['refused6', 'sockets', 'bad-gateway', 'error-log', 'listen6', 'upstream-ok', 'end'],
  password: PASSWORD,
  accounts: ferryAccounts,
  state: (t) => ferryState(t, 3),
  initialise: initialiseFerry,
  hosts: { lookout: lookoutHost(NOW_3, (t) => t('ferry-lookout-readme')) },
  createWorld: (t) =>
    ferryWorld(t, 3, {
      'message_from_amaru.txt': f(t('both-ways-message-amaru')),
      'note_from_lucia.txt': f(t('both-ways-note-lucia')),
    }),
  events: [
    {
      id: 'refused6',
      condition: (j) =>
        /connect to (2001:db8:4e1:20::80|::1) port 80 from \S+ port \d+ failed: Connection refused/.test(seen(j)) ||
        (/(^|\s)(-6|--ipv6|-[a-zA-Z]*6[a-zA-Z]*)(\s|$)|\[/.test(typed(j)) && /curl: \(7\) Failed to connect to \S+ port 80 /.test(seen(j))),
      message: (j) => j.t('both-ways-event-refused6'),
    },
    {
      id: 'sockets',
      condition: (j) => /0\.0\.0\.0:(80|http)\s/.test(j.last.output) && /\[::1\]:(3000|hbci)\s/.test(j.last.output),
      message: (j) => j.t('both-ways-event-sockets'),
    },
    { id: 'bad-gateway', condition: (j) => /502 Bad Gateway/.test(seen(j)), message: (j) => j.t('both-ways-event-bad-gateway') },
    {
      id: 'error-log',
      condition: (j) => j.last.output.includes('connect() failed (111: Connection refused) while connecting to upstream') && j.last.output.includes('upstream: "http://127.0.0.1:3000/'),
      message: (j) => j.t('both-ways-event-error-log'),
    },
    {
      id: 'not-reloaded',
      condition: (j) => /listen\s+\[::\]/.test(j.read(SITE) ?? '') && !v6Site(j) && /test is successful/.test(seen(j)),
      message: (j) => j.t('both-ways-event-not-reloaded'),
    },
    { id: 'bind-conflict', condition: (j) => /bind\(\) to \[::\]:80 failed \(98: Address already in use\)/.test(seen(j)), message: (j) => j.t('both-ways-event-bind-conflict') },
    { id: 'listen6', condition: v6Site, message: (j) => j.t('both-ways-event-listen6') },
    {
      id: 'exposed',
      condition: (j) => ['0.0.0.0', '*'].includes(bookingBind(((j.state.bookingEnv ?? {}) as Record<string, string>).HOST)),
      message: (j) => j.t('both-ways-event-exposed'),
    },
    { id: 'upstream-ok', condition: (j) => visit(j, 4, '/booking/') === 200, message: (j) => j.t('both-ways-event-upstream-ok') },
    {
      id: 'end',
      condition: (j) => all(j).every((c) => c === 200),
      message: (j) => j.t('both-ways-event-end', { v4: QUAY4, v6: STATIC }),
    },
  ],
};
