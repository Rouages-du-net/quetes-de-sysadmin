// Story "The Co-op": the site and the till app, shared by the chapters
// "The secret" and "The proxy". nginx serves the site and passes /till/ to
// the app (Node.js, Express, 127.0.0.1:3000), which reads its .env on
// start.
// The client's address, as the app sees it: like Express and its
// "trust proxy" setting (https://expressjs.com/en/guide/behind-proxies.html):
//   - false: the connection's address (127.0.0.1 behind nginx);
//   - true: the first address in X-Forwarded-For (which the client can write);
//   - loopback (or a list of addresses): X-Forwarded-For is walked from the
//     right, and the first untrusted address is the client's.

import { d, f, password, type Directory, type Node } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { loadNginx, httpRequest, checkNginx, type App, type Client, type Request } from '../nginx';
import { writeLog, newSystemd, systemd, type DefinitionService } from '../systemd';
import { MIME, NGINX_CONF } from '../commands/apt';
import { NOW } from './coop';

export const SITE = '/etc/nginx/sites-available/coop';
export const APP = '/srv/till/app';
export const ENV = `${APP}/.env`;
export const DOMAIN = 'coop.example';
export const OLD_KEY = 'pk_live_coop_4f9a2c71e8b3';
export const NEW_KEY = 'pk_live_coop_9d27be05c4a1';
const LOG = '/var/log/till/app.log';

// The words of the app the player sees are those of the language
// (secret-till-* in chapter-secret.ftl): the payment key's variable, the
// login page's path, the fields of /health.
/** The name of the variable that holds the payment key (PAYMENT_KEY…). */
export const paymentKey = (t: Translate) => t('secret-till-env-payment');
/** The login page's path, under /till/ for nginx (/login…). */
export const loginPath = (t: Translate) => `/${t('secret-till-login')}`;

export const tillEnv = (t: Translate, key: string, trust = 'false') => `NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://till:${password(t, 'Chickpeas-42')}@localhost/till
${paymentKey(t)}=${key}
TRUST_PROXY=${trust}`;

/** The variables of a .env (KEY=value, without quotes or comments). */
export function readEnv(text: string): Record<string, string> {
  const v: Record<string, string> = {};
  for (const l of text.split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#]*?)"?\s*$/.exec(l);
    if (m) v[m[1]] = m[2];
  }
  return v;
}

interface TillState {
  // The variables read at the last start.
  load: Record<string, string>;
  failures: Record<string, number>;
  banned: string[];
  connected: string[];
}
export const till = (j: Game) => j.state.till as TillState;

// A trusted address for "trust proxy": loopback (127.0.0.0/8, ::1), or a list.
function reliable(address: string, setting: string): boolean {
  if (setting === 'true') return true;
  return setting
    .split(',')
    .map((x) => x.trim())
    .some((r) => (r === 'loopback' ? /^127\./.test(address) || address === '::1' : r === address));
}

/** The client's address according to the app (Express's req.ip). */
export function clientAddress(request: Request, setting: string): string {
  if (!setting || setting === 'false') return request.address;
  const xff = (request.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (setting === 'true') return xff[0] ?? request.address;
  const string = [request.address, ...xff.reverse()];
  return string.find((a) => !reliable(a, setting)) ?? string.at(-1)!;
}

function note(j: Game, line: string) {
  const n = j.find(LOG);
  if (n?.type !== 'file' || typeof n.content !== 'string') return;
  const sd = systemd(j);
  const timeOfDay = new Date(sd?.clock ?? NOW).toISOString().slice(0, 19).replace('T', ' ');
  n.content = `${n.content}\n${timeOfDay} ${line}`;
}

// The app: the home page, /health, and the login page (the x-account and
// x-password headers), with a lock after 5 failures from the same address.
export const TILL_APP: App = {
  service: 'till',
  pages: {},
  answer: (j, path, request) => {
    const c = till(j);
    const json = (code: number, body: unknown) => ({ code, type: 'application/json; charset=utf-8', body: JSON.stringify(body) });
    const t = j.t;
    if (path === '/')
      return {
        code: 200,
        body: `<!DOCTYPE html>\n<title>${t('secret-till-title')}</title>\n<form method="post" action="/till${loginPath(t)}">…</form>`,
      };
    if (path === '/health')
      return json(200, { status: 'ok', [t('secret-till-health-payment')]: c.load[paymentKey(t)] === NEW_KEY ? 'ok' : t('secret-till-health-revoked') });
    if (path === loginPath(t)) {
      const ip = clientAddress(request, c.load.TRUST_PROXY ?? 'false');
      const account = request.headers['x-account'] ?? '';
      if (c.banned.includes(ip)) {
        note(j, `rejected login for ${account} from ${ip} (locked)`);
        return json(429, { error: 'Too many attempts, try again in 15 minutes' });
      }
      if (request.headers['x-password'] === 'good') {
        if (!c.connected.includes(account)) c.connected.push(account);
        note(j, `login ok for ${account} from ${ip}`);
        return json(200, { ok: true });
      }
      c.failures[ip] = (c.failures[ip] ?? 0) + 1;
      note(j, `login failed for ${account} from ${ip}`);
      if (c.failures[ip] >= 5 && !c.banned.includes(ip)) {
        c.banned.push(ip);
        note(j, `locked ${ip} for 15 minutes`);
      }
      return json(401, { error: 'Invalid credentials' });
    }
    return {
      code: 404,
      body: `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET ${path}</pre>\n</body>\n</html>`,
    };
  },
};

/** A simulated request to the site, as if it came from the internet (leaves no trace if the game is checking). */
export function visit(j: Game, path: string, client: Partial<Client> & { address: string }, trace = true) {
  return httpRequest(j, DOMAIN, path, 80, trace, { time: systemd(j)?.clock ?? NOW, agent: 'Mozilla/5.0', ...client });
}

/** The machine's services: nginx, and the app (which reads its .env on every start). */
export function tillSystemd(afterNginx?: (j: Game) => void, afterTill?: (j: Game) => void) {
  const nginx: DefinitionService = {
    description: 'A high performance web server and a reverse proxy server',
    active: true,
    executable: 'nginx',
    process: [
      { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
    ],
    check: checkNginx,
    load: (j) => {
      loadNginx(j);
      afterNginx?.(j);
    },
    checkToReload: true,
  };
  const app: DefinitionService = {
    description: 'Cooperative till',
    active: true,
    executable: 'node',
    process: [{ pid: 731, user: 'till', cpu: 1.2, mem: 3.4, command: '/usr/bin/node /srv/till/app/server.js' }],
    load: (j) => {
      const c = till(j);
      if (!c) return;
      // On start: the .env reread, the memory of locks cleared.
      c.load = readEnv(j.read(ENV) ?? '');
      c.failures = {};
      c.banned = [];
      c.connected = [];
      const sd = systemd(j);
      if (sd) writeLog(sd, 'till.service', 'node', 731, 'till listening on 127.0.0.1:3000');
      afterTill?.(j);
    },
  };
  return newSystemd('coop', NOW - 6 * 86_400_000, NOW, { nginx, till: app });
}

/** The site's state: nginx (access log), the app and its locks. */
export const tillState = (env: string, more: Record<string, unknown> = {}) => ({
  systemd: tillSystemd(),
  nginx: { load: null, names: ['coop', DOMAIN, `www.${DOMAIN}`, '192.0.2.20', 'localhost', '127.0.0.1'], accessLog: true },
  apps: { '127.0.0.1:3000': TILL_APP },
  till: { load: readEnv(env), failures: {}, banned: [], connected: [] } satisfies TillState,
  ...more,
});

const root = { owner: 'root' };

/** /usr/sbin/nginx (installed). */
export const BINARY_NGINX: Record<string, Node> = { nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) };
const file = (content: string, rights: { owner?: string; group?: string; mode?: string } = root) => f(content, { lines: true, ...rights });

/** /etc/nginx (the cooperative site enabled), and the logs. */
export function nginxCooperative(site: string): Record<string, Node> {
  return {
    nginx: d(
      {
        'nginx.conf': file(NGINX_CONF),
        'mime.types': file(MIME),
        'conf.d': d({}, undefined, root),
        'modules-enabled': d({}, undefined, root),
        'sites-available': d({ coop: file(site) }, undefined, root),
        'sites-enabled': d({ coop: f('', { owner: 'root', link: SITE }) }, undefined, root),
      },
      undefined,
      root,
    ),
  };
}

/** /srv/till/app (the code, the .env, the git repository) and /var/log. */
export function tillWorld(t: Translate, o: { env: string; envMode?: string; logAccess: string; appLog: string }): { srv: Directory; var: Directory } {
  const rightsTill = { owner: 'till', group: 'till' };
  return {
    srv: d(
      {
        till: d(
          {
            app: d(
              {
                '.env': file(o.env, { ...rightsTill, mode: o.envMode ?? 'rw-r--r--' }),
                '.git': d(
                  {
                    config: file(
                      '[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote "origin"]\n\turl = https://deploy:ghp_coopExampleToken42@git.coop.example/till.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*',
                      rightsTill,
                    ),
                    HEAD: file('ref: refs/heads/main', rightsTill),
                  },
                  undefined,
                  rightsTill,
                ),
                'index.html': file(
                  `<!DOCTYPE html>\n<html lang="${t('secret-till-lang')}">\n<title>${t('secret-till-site')}</title>\n<h1>${t('secret-till-site')}</h1>\n<a href="/till/">${t('secret-till-title')}</a>\n</html>`,
                  rightsTill,
                ),
                'server.js': file(
                  "require('dotenv').config();\nconst app = require('express')();\napp.set('trust proxy', process.env.TRUST_PROXY);\n// ...",
                  rightsTill,
                ),
                'package.json': file(
                  '{\n  "name": "till",\n  "version": "2.3.1",\n  "dependencies": { "dotenv": "^16.4.5", "express": "^4.21.2" }\n}',
                  rightsTill,
                ),
              },
              undefined,
              rightsTill,
            ),
          },
          undefined,
          rightsTill,
        ),
      },
      undefined,
      root,
    ),
    var: d(
      {
        log: d(
          {
            nginx: d(
              {
                'access.log': f(o.logAccess, { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }),
                'error.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }),
              },
              undefined,
              { owner: 'root', group: 'adm' },
            ),
            till: d({ 'app.log': f(o.appLog, { lines: true, owner: 'till', group: 'adm', mode: 'rw-r-----' }) }, undefined, rightsTill),
          },
          undefined,
          root,
        ),
        run: d({}, undefined, root),
      },
      undefined,
      root,
    ),
  };
}
