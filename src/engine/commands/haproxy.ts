// HAProxy's commands: haproxy (-c -f: the configuration check; -v, -vv),
// socat to its runtime API (the stats socket, echo "show stat" | socat
// stdio /run/haproxy/admin.sock), and curl on a story whose network
// carries load balancers (state.haHttp on the main machine, see
// chapters/blood-drive.ts).
// Sources: https://docs.haproxy.org/3.0/management.html (1. command line,
// 9.3 the runtime API), http://www.dest-unreach.org/socat/doc/socat.html.

import type { Command } from './index';
import type { Shell } from '../shell';
import { HAPROXY_VERSION, checkReport, haproxy, parseCfg, runtime, type Answer } from '../haproxy';
import { systemd } from '../systemd';

const pidOf = (game: Shell) => 4100 + (((game.state.haCalls = ((game.state.haCalls as number | undefined) ?? 0) + 1) as number) * 13) % 900;

function haproxyCommand(game: Shell, args: string[]): string {
  if (args.includes('-v') || args.includes('-vv') || args.includes('-V') && !args.includes('-c')) {
    const lines = [`HAProxy version ${HAPROXY_VERSION} 2025/06/03 - https://haproxy.org/`, 'Status: long-term supported branch - will stop receiving fixes around Q2 2029.', `Known bugs: http://www.haproxy.org/bugs/bugs-${HAPROXY_VERSION.split('-')[0]}.html`, 'Running on: Linux 6.12.48+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.12.48-1 (2025-09-20) x86_64'];
    if (args.includes('-vv')) lines.push('Build options :', '  TARGET  = linux-glibc', '  CC      = x86_64-linux-gnu-gcc', 'Feature list : +EPOLL +LINUX_SPLICE +LIBCRYPT +OPENSSL +LUA +PCRE2 +PROMEX +SYSTEMD', 'Built with multi-threading support (MAX_TGROUPS=16, MAX_THREADS=256, default=2).');
    return lines.join('\n');
  }
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === '-f') files.push(args[++i] ?? '');
  const check = args.includes('-c');
  const quiet = args.includes('-q');
  const unknown = args.find((a, i) => a.startsWith('-') && !['-c', '-f', '-q', '-V', '-W', '-Ws', '-db', '-d'].includes(a) && args[i - 1] !== '-f');
  if (unknown) return game.error(`[ALERT]    (${pidOf(game)}) : unknown option '${unknown}'.\n${game.t('haproxy-usage')}`, 1);
  if (!files.length) return game.error(`[ALERT]    (${pidOf(game)}) : No configuration file specified.\n${game.t('haproxy-usage')}`, 1);
  if (!check) return game.error(game.t('haproxy-not-by-hand'), 1);
  const pid = pidOf(game);
  for (const f of files) {
    const n = game.find(f);
    if (!n) return game.error(`[ALERT]    (${pid}) : Cannot open configuration file/directory ${f} : No such file or directory`, 1);
    if (n.type === 'file' && !game.can(n, 'r')) return game.error(`[ALERT]    (${pid}) : Cannot open configuration file/directory ${f} : Permission denied`, 1);
  }
  const report = checkReport(parseCfg(files.map((f) => game.read(f) ?? '').join('\n'), files[0]), pid, files[0]);
  if (!report.ok) return game.error(report.lines.join('\n'), 1);
  return quiet ? '' : report.lines.join('\n');
}

// socat's address forms we follow: STDIO, -, STDIN; UNIX-CONNECT:PATH, UNIX-CLIENT:PATH, or a bare path (GOPEN).
function socat(game: Shell, args: string[], input: string | null): string {
  const addresses = args.filter((a) => a === '-' || !a.startsWith('-'));
  if (addresses.length !== 2) return game.error(`${stamp(game)} E exactly 2 addresses required (there are ${addresses.length}); use option "-h" for help`, 1);
  const io = addresses.find((a) => /^(stdio|-|stdin|stdout|readline)$/i.test(a));
  const other = addresses.find((a) => a !== io);
  if (!io || !other) return game.error(game.t('socat-only-stdio'), 1);
  const path = other.replace(/^(unix-connect|unix-client|unix|gopen|open):/i, '');
  const n = game.find(path);
  if (!n) return game.error(`${stamp(game)} E connect(5, AF=1 "${path}", ${path.length + 2}): No such file or directory`, 1);
  if (!game.can(n, 'r') || !game.can(n, 'w')) return game.error(`${stamp(game)} E connect(5, AF=1 "${path}", ${path.length + 2}): Permission denied`, 1);
  const r = haproxy(game);
  const socket = r?.conf.socket;
  if (!r || socket !== path) return game.error(`${stamp(game)} E connect(5, AF=1 "${path}", ${path.length + 2}): Connection refused`, 1);
  const commands = (input ?? '').split(/[;\n]/).map((c) => c.trim()).filter(Boolean);
  if (!commands.length) return '';
  return commands.map((c) => runtime(game, c)).join('').replace(/\n$/, '');
}

const stamp = (game: Shell) => {
  const d = new Date(systemd(game)?.clock ?? 0);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} socat[${pidOf(game)}]`;
};

type Http = (from: Shell, address: string, port: number, path: string) => { answer: Answer | null; reset?: boolean } | 'no-route' | 'refused';

/** curl on a story with load balancers: names from /etc/hosts, the answer of who listens there. */
export function haCurl(game: Shell, args: string[]): string {
  const http = game.principal.state.haHttp as Http;
  const VALUE = ['-H', '--header', '-o', '--output', '-w', '--write-out', '-m', '--max-time', '--connect-timeout', '-A', '--user-agent', '-X', '--request'];
  let silent = false;
  let showErrors = false;
  let fail = false;
  let include = false;
  let head = false;
  let output: string | null = null;
  let writeOut: string | null = null;
  const urls: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (VALUE.includes(a)) {
      const v = args[++i];
      if (v === undefined) return game.error(`curl: option ${a}: requires parameter\ncurl: try 'curl --help' or 'curl --manual' for more information`, 2);
      if (a === '-o' || a === '--output') output = v;
      if (a === '-w' || a === '--write-out') writeOut = v;
      continue;
    }
    if (a === '--silent') silent = true;
    else if (a === '--show-error') showErrors = true;
    else if (a === '--fail') fail = true;
    else if (a === '--include') include = true;
    else if (a === '--head') head = true;
    else if (a.startsWith('--')) continue;
    else if (/^-[A-Za-z]+$/.test(a)) {
      for (const l of a.slice(1)) {
        if (l === 's') silent = true;
        else if (l === 'S') showErrors = true;
        else if (l === 'f') fail = true;
        else if (l === 'i') include = true;
        else if (l === 'I') head = true;
      }
    } else urls.push(a);
  }
  const err = (code: number, message: string) => {
    if (silent && !showErrors) {
      game.status = code;
      return writeOut !== null ? format(writeOut, 0) : '';
    }
    return game.error(`curl: (${code}) ${message}`, code);
  };
  const format = (w: string, code: number) => w.replace(/%\{(http_code|response_code)\}/g, String(code).padStart(3, '0')).replace(/%\{time_total\}/g, '0.004211').replace(/\\n/g, '\n');
  if (!urls.length) return game.error("curl: no URL specified\ncurl: try 'curl --help' or 'curl --manual' for more information", 2);
  const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/.exec(urls[0]);
  if (!m) return err(3, 'URL rejected: Malformed input to a URL function');
  const host = m[2];
  const port = Number(m[3] ?? (m[1] === 'https' ? 443 : 80));
  const path = m[4] || '/';
  let address: string | null = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : host === 'localhost' ? '127.0.0.1' : null;
  if (!address)
    for (const line of (game.read('/etc/hosts') ?? '').split('\n')) {
      const [a, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
      if (names.includes(host)) address = a;
    }
  if (!address) return err(6, `Could not resolve host: ${host}`);
  const r = http(game, address, port, path);
  if (r === 'no-route') return err(7, `Failed to connect to ${host} port ${port} after 3072 ms: Couldn't connect to server`);
  if (r === 'refused') return err(7, `Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server`);
  if (!r.answer) return err(56, 'Recv failure: Connection reset by peer');
  const a = r.answer;
  if (fail && a.code >= 400) return err(22, `The requested URL returned error: ${a.code}`);
  const status = `HTTP/1.1 ${a.code} ${a.reason}`;
  const headers = [status, ...a.headers].join('\n');
  const body = head ? headers : include ? `${headers}\n\n${a.body}` : a.body;
  let shown = body;
  if (output) {
    if (output !== '/dev/null') {
      const error = game.place('curl', output, { type: 'file', content: a.body, owner: game.who, lines: true });
      if (error) return game.error(`Warning: Failed to open the file ${output}: ${error}\ncurl: (23) Failure writing output to destination`, 23);
    }
    shown = '';
  }
  const extra = writeOut !== null ? format(writeOut, a.code) : '';
  return (shown && extra ? `${shown}\n${extra}` : shown || extra).replace(/\n$/, '');
}

export const HAPROXY_COMMANDS: Record<string, Command> = {
  haproxy: { section: 8, ownOptions: true, launch: ({ args, game }) => haproxyCommand(game, args) },
  socat: { section: 1, ownOptions: true, launch: ({ args, game, input }) => socat(game, args, input) },
};
