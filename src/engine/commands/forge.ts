// The forge's commands (see ../forge.ts): forgejo (the server's CLI: forgejo
// admin user list|create|change-password|delete|must-change-password|
// generate-access-token), forgejo-runner (its version, its configuration),
// the forgejo-api(7) page, and curl towards the forge (its API and web routes).
// Sources: https://forgejo.org/docs/latest/admin/command-line/,
// https://forgejo.org/docs/latest/admin/actions/runner-installation/,
// https://curl.se/docs/manpage.html (-d @file strips newlines, --json).

import type { Shell } from '../shell';
import type { Command } from './index';
import { FORGEJO_VERSION, RUNNER_VERSION, deleteUser, forge, forgeHttp, reason, type ForgeUser } from '../forge';
import { fingerprint } from './git';

// Go's tabwriter as forgejo admin user list uses it (minwidth 5, padding 1).
function table(rows: string[][]): string {
  const widths = rows[0].map((_, k) => Math.max(5, ...rows.map((r) => r[k].length + 1)));
  return rows.map((r) => r.map((c, k) => (k === r.length - 1 ? c : c.padEnd(widths[k]))).join('')).join('\n');
}

const CONFIG = '/etc/forgejo/app.ini';

function forgejo(game: Shell, args: string[]): string {
  const f = forge(game);
  let config: string | null = null;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--config' || a === '-c') config = args[++i] ?? '';
    else if (a.startsWith('--config=')) config = a.slice(9);
    else if (a === '--work-path' || a === '-w' || a === '--custom-path' || a === '-C') i++;
    else if (a === '--version' || a === '-v') return `Forgejo version ${FORGEJO_VERSION} built with GNU Make 4.4.1, go1.24.9 : bindata, timetzdata, sqlite, sqlite_unlock_notify`;
    else rest.push(a);
  }
  const [area, sub, ...opts] = rest;
  if (!area || area === 'help') return game.t('forgejo-usage');
  if (area === 'web') return game.error(game.t('forgejo-web-service'), 1);
  if (area !== 'admin' || sub !== 'user') return game.error(game.t('forgejo-not-simulated', { command: rest.slice(0, 3).join(' ') }), 1);
  // Forgejo refuses to run as root; its configuration is readable by root and the forgejo group.
  if (game.who === 'root') return game.error('Forgejo is not supposed to be run as root. Sorry. If you need to use privileged TCP ports please instead use setcap and the `cap_net_bind_service` permission', 1);
  const path = config ?? '/var/lib/forgejo/custom/conf/app.ini';
  const n = game.find(path);
  if (n?.type !== 'file' || !f)
    return game.error(`${config ? `failed to load config file "${path}": open ${path}: no such file or directory\n` : ''}Unable to load config file for a installed Forgejo instance, you should either use "--config" to set your config file (app.ini), or run "forgejo web" command to install Forgejo.`, 1);
  if (!game.can(n, 'r')) return game.error(`failed to load config file "${path}": open ${path}: permission denied`, 1);
  const [action, ...more] = opts;
  const value = (name: string) => {
    const k = more.findIndex((o) => o === `--${name}` || o.startsWith(`--${name}=`));
    if (k < 0) return undefined;
    return more[k].includes('=') ? more[k].slice(name.length + 3) : more[k + 1];
  };
  const has = (name: string) => more.includes(`--${name}`);
  const findUser = (): ForgeUser | null => {
    const login = value('username') ?? value('u') ?? more.find((o) => !o.startsWith('-'));
    const id = value('id');
    return Object.values(f.users).find((u) => u.login === login || String(u.id) === id) ?? null;
  };
  if (action === 'list') {
    const users = Object.values(f.users)
      .filter((u) => !has('admin') || u.admin)
      .sort((a, b) => a.id - b.id);
    return table([['ID', 'Username', 'Email', 'IsActive', 'IsAdmin', '2FA'], ...users.map((u) => [String(u.id), u.login, u.email, String(u.active && !u.prohibitLogin), String(u.admin), 'false'])]);
  }
  if (action === 'create') {
    const login = value('username');
    const email = value('email');
    if (!login || !email) return game.error('Incorrect Usage: Required flags "username, email" not set', 1);
    if (f.users[login]) return game.error(`CreateUser: user already exists [name: ${login}]`, 1);
    const random = has('random-password');
    const password = value('password') ?? (random ? fingerprint(`password-${login}`).slice(0, 12) : undefined);
    if (!password) return game.error('Incorrect Usage: password or random-password must be set', 1);
    const now = game.state.systemd?.clock ?? 0;
    f.users[login] = { id: f.nextId++, login, fullName: '', email, admin: has('admin'), active: true, prohibitLogin: false, password, created: now, lastLogin: now, keys: [], mustChangePassword: !has('must-change-password=false') };
    return [...(random ? [`generated random password is '${password}'`] : []), `New user '${login}' has been successfully created!`].join('\n');
  }
  if (action === 'change-password') {
    const u = findUser();
    const password = value('password') ?? value('p');
    if (!value('username') && !value('u')) return game.error('Incorrect Usage: Required flag "username" not set', 1);
    if (!u) return game.error(`user does not exist [uid: 0, name: ${value('username') ?? value('u')}]`, 1);
    if (!password) return game.error('Incorrect Usage: Required flag "password" not set', 1);
    u.password = password;
    return `${u.login}'s password has been successfully updated!`;
  }
  if (action === 'must-change-password') {
    const logins = more.filter((o) => !o.startsWith('-'));
    for (const l of logins) if (f.users[l]) f.users[l].mustChangePassword = true;
    return `Updated ${logins.filter((l) => f.users[l]).length} users setting MustChangePassword to true`;
  }
  if (action === 'delete') {
    const u = findUser();
    if (!u) return game.error(`user does not exist [uid: 0, name: ${value('username') ?? value('id') ?? ''}]`, 1);
    const refused = deleteUser(f, u.login, has('purge') || has('P'));
    return refused ? game.error(refused, 1) : '';
  }
  if (action === 'generate-access-token') {
    const u = findUser();
    if (!u) return game.error(`user does not exist [uid: 0, name: ${value('username') ?? ''}]`, 1);
    const name = value('token-name') ?? value('t') ?? 'gitea-admin';
    if (f.tokens.some((t) => t.owner === u.login && t.name === name)) return game.error(`access token name has been used already`, 1);
    const token = fingerprint(`token-${u.login}-${name}-${f.nextId}`);
    f.tokens.push({ id: f.nextId++, name, owner: u.login, value: token, scopes: (value('scopes') ?? 'all').split(',').map((s) => s.trim()), created: game.state.systemd?.clock ?? 0 });
    return has('raw') ? token : `Access token was successfully created: ${token}`;
  }
  return game.error(game.t('forgejo-user-usage'), 1);
}

function forgejoRunner(game: Shell, args: string[]): string {
  if (args.includes('--version') || args.includes('-v') || args[0] === 'version') return `forgejo-runner version ${RUNNER_VERSION}`;
  const [sub] = args.filter((a) => !a.startsWith('-'));
  if (!sub) return game.t('forgejo-runner-usage');
  if (sub === 'daemon') return game.error(game.t('forgejo-runner-service'), 1);
  if (sub === 'generate-config') return game.t('forgejo-runner-config');
  return game.error(game.t('forgejo-not-simulated', { command: `forgejo-runner ${sub}` }), 1);
}

/** curl towards the forge: its API under /api/v1, a user's keys (/NAME.keys), a job's logs. */
export function forgeCurl(game: Shell, args: string[], input: string | null): string {
  const f = forge(game)!;
  const headers: Record<string, string> = {};
  let method: string | null = null;
  const data: string[] = [];
  let user: string | null = null;
  let output: string | null = null;
  let writeOut: string | null = null;
  const urls: string[] = [];
  const flags = new Set<string>();
  const readData = (v: string, raw: boolean): string | null => {
    if (raw || !v.startsWith('@')) return v;
    const file = v.slice(1);
    const text = file === '-' ? (input ?? '') : game.read(file);
    if (text === null) {
      game.error(`Warning: Couldn't read data from file "${file}", this makes an empty POST.`);
      return '';
    }
    // -d @file strips carriage returns and newlines; --data-binary keeps them.
    return text;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i] ?? '';
    if (a === '-H' || a === '--header') {
      const h = /^([\w-]+):\s*(.*)$/.exec(next());
      if (h) headers[h[1].toLowerCase()] = h[2];
    } else if (a === '-X' || a === '--request') method = next().toUpperCase();
    else if (a === '-d' || a === '--data' || a === '--data-ascii') {
      data.push(readData(next(), false) ?? '');
    } else if (a === '--data-binary') data.push(readData(next(), false) ?? '');
    else if (a === '--data-raw') data.push(next());
    else if (a === '--json') {
      const v = next();
      data.push(v.startsWith('@') ? (readData(v, false) ?? '') : v);
      headers['content-type'] ??= 'application/json';
      headers.accept ??= 'application/json';
    } else if (a === '-u' || a === '--user') user = next();
    else if (a === '-o' || a === '--output') output = next();
    else if (a === '-w' || a === '--write-out') writeOut = next();
    else if (a === '-A' || a === '--user-agent' || a === '-e' || a === '--referer' || a === '--cacert' || a === '-m' || a === '--max-time' || a === '--connect-timeout') next();
    else if (/^-[a-zA-Z]+$/.test(a)) {
      for (const l of a.slice(1)) {
        if (!'sSiIfLkv4'.includes(l)) return game.error(`curl: option ${a}: is unknown\ncurl: try 'curl --help' or 'curl --manual' for more information`, 2);
        flags.add(l);
      }
    } else if (['--silent', '--show-error', '--include', '--head', '--fail', '--location', '--insecure', '--verbose'].includes(a)) flags.add({ '--silent': 's', '--show-error': 'S', '--include': 'i', '--head': 'I', '--fail': 'f', '--location': 'L', '--insecure': 'k', '--verbose': 'v' }[a]!);
    else if (a.startsWith('-')) return game.error(`curl: option ${a}: is unknown\ncurl: try 'curl --help' or 'curl --manual' for more information`, 2);
    else urls.push(a);
  }
  // -d @file: the newlines go (curl's man page); fix up the stripping done above for each @file.
  for (let k = 0, d = 0; k < args.length; k++)
    if (['-d', '--data', '--data-ascii'].includes(args[k])) {
      if ((args[k + 1] ?? '').startsWith('@')) data[d] = data[d].replace(/[\r\n]/g, '');
      d++;
    } else if (['--data-binary', '--data-raw', '--json'].includes(args[k])) d++;
  const url = urls[0];
  if (!url) return game.error("curl: no URL specified\ncurl: try 'curl --help' or 'curl --manual' for more information", 2);
  const m = /^(?:(https?):\/\/)?([^/:?]+)(?::(\d+))?([^#]*)$/.exec(url);
  if (!m) return game.error('curl: (3) URL rejected: Malformed input to a URL function', 3);
  const host = m[2].toLowerCase();
  const port = Number(m[3] ?? (m[1] === 'http' ? 80 : 443));
  const local = ['localhost', '127.0.0.1'].includes(host);
  const known = host === f.domain || (local && port === 3000);
  if (!known) {
    if (local) return game.error(`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server`, 7);
    return game.error(`curl: (6) Could not resolve host: ${host}`, 6);
  }
  if (host === f.domain && m[1] === 'http') {
    // nginx sends plain HTTP to HTTPS.
    const body = `<html>\n<head><title>301 Moved Permanently</title></head>\n<body>\n<center><h1>301 Moved Permanently</h1></center>\n<hr><center>nginx</center>\n</body>\n</html>`;
    return flags.has('I') || flags.has('i') ? `HTTP/1.1 301 Moved Permanently\nServer: nginx\nLocation: https://${f.domain}${m[4] || '/'}${flags.has('I') ? '' : `\n\n${body}`}` : body;
  }
  const body = data.length ? data.join('&') : null;
  const verb = method ?? (flags.has('I') ? 'HEAD' : body !== null ? 'POST' : 'GET');
  const r = forgeHttp(game, verb, m[4] || '/', headers, body, user);
  const head = [`HTTP/2 ${r.status}`, 'server: nginx', `content-type: ${r.type}`, 'cache-control: max-age=0, private, must-revalidate, no-transform', 'x-content-type-options: nosniff', 'x-frame-options: SAMEORIGIN'].join('\n');
  if (flags.has('f') && r.status >= 400) return game.error(flags.has('s') && !flags.has('S') ? '' : `curl: (22) The requested URL returned error: ${r.status}`, 22);
  let shown = flags.has('I') ? head : flags.has('i') ? `${head}\n\n${r.body}` : r.body;
  if (flags.has('v')) game.error([`* Connected to ${host} (${host === f.domain ? '192.0.2.80' : '127.0.0.1'}) port ${port}`, `> ${verb} ${m[4] || '/'} HTTP/2`, `> Host: ${host}`, '> User-Agent: curl/8.14.1', '> Accept: */*', ...Object.entries(headers).map(([k, v]) => `> ${k}: ${k === 'authorization' ? v : v}`), '>', `< HTTP/2 ${r.status} ${reason(r.status)}`.trim()].join('\n'));
  if (output) {
    const e = output === '/dev/null' ? null : game.place('curl', output, { type: 'file', content: r.body, owner: game.who, lines: true });
    if (e) return game.error(`curl: (23) Failure writing output to destination, passed 0 returned 4294967295`, 23);
    shown = '';
  }
  if (writeOut !== null) {
    const extra = writeOut.replace(/%\{http_code\}|%\{response_code\}/g, String(r.status)).replace(/\\n/g, '\n');
    shown = shown ? `${shown}${extra.startsWith('\n') ? '' : '\n'}${extra}` : extra;
  }
  return shown.replace(/\n$/, '');
}

export const FORGE: Record<string, Command> = {
  forgejo: { ownOptions: true, launch: ({ args, game }) => forgejo(game, args) },
  'forgejo-runner': { ownOptions: true, launch: ({ args, game }) => forgejoRunner(game, args) },
  // The forge's HTTP API: a page of the manual (man forgejo-api).
  'forgejo-api': { section: 7, launch: () => '' },
};
