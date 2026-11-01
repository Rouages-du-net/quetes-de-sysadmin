// Histoire « La Coopérative » : le site et l'appli de caisse, communs aux
// chapitres « Le secret » et « Le proxy ». nginx sert le site et passe
// /till/ à l'appli (Node.js, Express, 127.0.0.1:3000), qui lit son .env
// au démarrage.
// L'adresse du client, vue par l'appli : comme Express et son réglage
// « trust proxy » (https://expressjs.com/en/guide/behind-proxies.html) :
//   - false : l'adresse de la connexion (127.0.0.1 derrière nginx) ;
//   - true : la première adresse de X-Forwarded-For (que le client peut écrire) ;
//   - loopback (ou une liste d'adresses) : on remonte X-Forwarded-For depuis la
//     droite, et la première adresse non fiable est celle du client.

import { d, f, type Directory, type Node } from '../world';
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

export const tillEnv = (key: string, trust = 'false') => `NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://till:Pois-Chiches-42@localhost/till
PAIEMENT_CLE=${key}
TRUST_PROXY=${trust}`;

/** Les variables d'un .env (CLE=valeur, sans guillemets ni commentaires). */
export function readEnv(text: string): Record<string, string> {
  const v: Record<string, string> = {};
  for (const l of text.split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#]*?)"?\s*$/.exec(l);
    if (m) v[m[1]] = m[2];
  }
  return v;
}

interface TillState {
  // Les variables lues au dernier démarrage.
  load: Record<string, string>;
  failures: Record<string, number>;
  banned: string[];
  connected: string[];
}
export const till = (j: Game) => j.state.till as TillState;

// Une adresse fiable pour « trust proxy » : loopback (127.0.0.0/8, ::1), ou une liste.
function reliable(address: string, setting: string): boolean {
  if (setting === 'true') return true;
  return setting
    .split(',')
    .map((x) => x.trim())
    .some((r) => (r === 'loopback' ? /^127\./.test(address) || address === '::1' : r === address));
}

/** L'adresse du client selon l'appli (req.ip d'Express). */
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
  if (n?.type !== 'fichier' || typeof n.content !== 'string') return;
  const sd = systemd(j);
  const timeOfDay = new Date(sd?.clock ?? NOW).toISOString().slice(0, 19).replace('T', ' ');
  n.content = `${n.content}\n${timeOfDay} ${line}`;
}

// L'appli : la page de connexion, /health, et /connexion (u=compte&p=mot de passe), avec un
// verrou après 5 échecs depuis la même adresse.
export const TILL_APP: App = {
  service: 'till',
  pages: {},
  answer: (j, path, request) => {
    const c = till(j);
    const json = (code: number, body: unknown) => ({ code, type: 'application/json; charset=utf-8', body: JSON.stringify(body) });
    if (path === '/')
      return { code: 200, body: '<!DOCTYPE html>\n<title>Caisse</title>\n<form method="post" action="/till/connexion">…</form>' };
    if (path === '/health') return json(200, { status: 'ok', paiement: c.load.PAIEMENT_CLE === NEW_KEY ? 'ok' : 'cle_revoquee' });
    if (path === '/connexion') {
      const ip = clientAddress(request, c.load.TRUST_PROXY ?? 'false');
      const account = request.headers['x-compte'] ?? '';
      if (c.banned.includes(ip)) {
        note(j, `rejected login for ${account} from ${ip} (locked)`);
        return json(429, { error: 'Too many attempts, try again in 15 minutes' });
      }
      if (request.headers['x-mot-de-passe'] === 'bon') {
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

/** Une requête simulée, comme si elle venait d'internet, vers le site (sans trace si le jeu vérifie). */
export function visit(j: Game, path: string, client: Partial<Client> & { address: string }, trace = true) {
  return httpRequest(j, DOMAIN, path, 80, trace, { time: systemd(j)?.clock ?? NOW, agent: 'Mozilla/5.0', ...client });
}

/** Les services de la machine : nginx, et l'appli (qui lit son .env à chaque démarrage). */
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
      // Au démarrage : le .env relu, la mémoire des verrous vidée.
      c.load = readEnv(j.read(ENV) ?? '');
      c.failures = {};
      c.banned = [];
      c.connected = [];
      const sd = systemd(j);
      if (sd) writeLog(sd, 'till.service', 'node', 731, 'till listening on 127.0.0.1:3000');
      afterTill?.(j);
    },
  };
  return newSystemd('cooperative', NOW - 6 * 86_400_000, NOW, { nginx, till: app });
}

/** L'état du site : nginx (journal d'accès), l'appli et ses verrous. */
export const tillState = (env: string, more: Record<string, unknown> = {}) => ({
  systemd: tillSystemd(),
  nginx: { load: null, names: ['coop', DOMAIN, `www.${DOMAIN}`, '192.0.2.20', 'localhost', '127.0.0.1'], journalAcces: true },
  applis: { '127.0.0.1:3000': TILL_APP },
  till: { load: readEnv(env), failures: {}, banned: [], connected: [] } satisfies TillState,
  ...more,
});

const root = { owner: 'root' };

/** /usr/sbin/nginx (installé). */
export const BINARY_NGINX: Record<string, Node> = { nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) };
const file = (content: string, rights: { owner?: string; group?: string; mode?: string } = root) => f(content, { lines: true, ...rights });

/** /etc/nginx (le site cooperative activé), et les journaux. */
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

/** /srv/till/app (le code, le .env, le dépôt git) et /var/log. */
export function tillWorld(o: { env: string; envMode?: string; logAccess: string; appLog: string }): { srv: Directory; var: Directory } {
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
                  '<!DOCTYPE html>\n<html lang="fr">\n<title>Cooperative</title>\n<h1>Cooperative</h1>\n<a href="/till/">Caisse</a>\n</html>',
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
