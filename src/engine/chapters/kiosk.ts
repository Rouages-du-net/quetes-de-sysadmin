// The Gazette's Kiosk: the Node.js app for newsletter
// subscriptions, behind nginx (location /kiosk/). Two slots
// run side by side, blue (port 3001) and green (port 3002), each with
// its systemd service; /srv/kiosk/blue and /srv/kiosk/green are
// links to a version in /srv/kiosk/versions/. Like a real
// process, an instance reads its code and configuration
// (/etc/kiosk/kiosk.env) when it starts: changing the link or the
// configuration only counts after a restart.
// Each instance answers on /health (200 or 503, in JSON), as
// deployment guides recommend (blue/green: https://martinfowler.com/bliki/BlueGreenDeployment.html).

import { d, f, type Rights, type Node } from '../world';
import type { Game } from '../shell';
import type { DefinitionService } from '../systemd';
import { httpRequest, type App, type Configuration } from '../nginx';
import { writeLog, systemd } from '../systemd';
import { readEnv } from '../compose';

export const KIOSK = '/srv/kiosk';
export const ENV = '/etc/kiosk/kiosk.env';
export const PORTS: Record<string, number> = { blue: 3001, green: 3002 };

export interface KioskVersion {
  // The configuration variables it can't work without.
  requires: string[];
  // The pages that crash (a bug only real traffic reveals).
  failure?: string[];
  // The database schema it expects (and the one it migrates it to).
  schema: number;
}

export const VERSIONS: Record<string, KioskVersion> = {
  '1.4.2': { requires: [], schema: 3 },
  '1.5.0': { requires: ['KIOSK_SMTP'], schema: 3 },
  // Searching the archives crashes: /health knows nothing about it.
  '1.6.0': { requires: ['KIOSK_SMTP'], failure: ['/archives'], schema: 3 },
  '1.6.1': { requires: ['KIOSK_SMTP'], schema: 3 },
  // Migrates the database on start (schema 4: the subscribers' mail column becomes email).
  '2.0.0': { requires: ['KIOSK_SMTP_URL'], schema: 4 },
  '2.0.1': { requires: ['KIOSK_SMTP_URL'], schema: 4 },
};

// The Kiosk's database: the schema it is at (migrations only go forward).
export const base = (j: Game): { schema: number } => (j.state.kioskBase ??= { schema: 3 });

export interface Instance {
  version: string;
  config: Record<string, string>;
}

export const instances = (j: Game): Record<string, Instance> => (j.state.kiosk ??= {});

/** The version a slot's link points to (/srv/kiosk/green → versions/1.5.0). */
export function linkVersion(j: Game, colour: string): string | null {
  const link = (j.find(`${KIOSK}/${colour}`, false) as { link?: string } | null)?.link;
  const name = link?.replace(/\/$/, '').split('/').at(-1);
  return name && VERSIONS[name] && j.find(`${KIOSK}/${colour}/server.js`)?.type === 'file' ? name : null;
}

/** A slot's systemd service. */
export function kioskService(colour: string, pid: number, state: 'active' | 'inactive' = 'active'): DefinitionService {
  return {
    description: `Gazette kiosk (${colour})`,
    state,
    active: state === 'active',
    executable: 'node',
    process: [{ pid, user: 'kiosk', cpu: 0.6, mem: 3.1, command: `node ${KIOSK}/${colour}/server.js` }],
    check: (j) =>
      linkVersion(j, colour)
        ? null
        : [
            `node:internal/modules/cjs/loader:1228`,
            `Error: Cannot find module '${KIOSK}/${colour}/server.js'`,
            `  code: 'MODULE_NOT_FOUND'`,
            `Node.js v22.12.0`,
          ],
    // On start, the process loads its code and configuration.
    load: (j) => {
      const version = linkVersion(j, colour)!;
      instances(j)[colour] = { version, config: readEnv(j.read(ENV)) };
      const sd = systemd(j);
      if (!sd) return;
      const write = (message: string) => writeLog(sd, `kiosk-${colour}.service`, 'node', pid, message, 6, false);
      write(`Kiosk ${version} starting (NODE_ENV=production)`);
      // A newer version migrates the database, like frameworks' migration
      // tools: the database doesn't go back by itself.
      const b = base(j);
      if (VERSIONS[version].schema > b.schema) {
        for (let n = b.schema + 1; n <= VERSIONS[version].schema; n++) write(`Running migration 00${n}_${migrationName(j.t, n)}... done`);
        write(`Database schema is now at version ${VERSIONS[version].schema}`);
        b.schema = VERSIONS[version].schema;
      }
      write(`Listening on http://127.0.0.1:${PORTS[colour]}`);
    },
  };
}

// The Kiosk's migrations, by schema number: their names speak of the
// database's columns, in the language (kiosk-migration-4).
export const migrationName = (t: Game['t'], n: number) => (t.exists(`kiosk-migration-${n}`) ? t(`kiosk-migration-${n}`) : 'update');

const json = (code: number, object: unknown) => ({ code, body: JSON.stringify(object), type: 'application/json; charset=utf-8' });

/** A slot's app, as nginx and curl reach it. */
export function kioskApp(colour: string): App {
  return {
    service: `kiosk-${colour}`,
    pages: {},
    answer: (j, path) => {
      const here = instances(j)[colour];
      const v = VERSIONS[here.version];
      const missing = v.requires.filter((k) => !here.config[k]);
      // A database migrated further than the version knows: it can no longer read it.
      const recentTrop = base(j).schema > v.schema;
      if (path === '/health')
        return recentTrop
          ? json(503, { status: 'error', version: here.version, error: `database schema ${base(j).schema} is newer than supported (${v.schema})` })
          : missing.length
            ? json(503, { status: 'error', version: here.version, error: `${missing[0]} is not set` })
            : json(200, { status: 'ok', version: here.version });
      if (recentTrop || missing.length || v.failure?.includes(path)) return { code: 500, body: 'Internal Server Error' };
      if (path === '/' || path === '') return { code: 200, body: j.t('kiosk-welcome', { version: here.version }) };
      if (path === '/archives') return { code: 200, body: j.t('kiosk-archives', { version: here.version }) };
      return {
        code: 404,
        body: `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET ${path}</pre>\n</body>\n</html>`,
      };
    },
  };
}

/** A slot's health (null: it doesn't answer). */
export function health(j: Game, colour: string): { status: string; version: string } | null {
  const app = kioskApp(colour);
  if (j.state.systemd?.services[app.service]?.state !== 'active' || !instances(j)[colour]) return null;
  return JSON.parse(app.answer!(j, '/health', { headers: {}, address: '127.0.0.1' }).body);
}

/** The files of a version (/srv/kiosk/versions/1.5.0). */
export function versionDirectory(t: Game['t'], version: string, notes?: string): Node {
  const rights: Rights = { owner: 'kiosk', group: 'kiosk' };
  return d(
    {
      'server.js': f(`// Kiosk ${version}\nrequire('./app').listen(process.env.PORT);`, { lines: true, ...rights }),
      'package.json': f(JSON.stringify({ name: 'kiosk', version, main: 'server.js' }, null, 2), { lines: true, ...rights }),
      ...(notes ? { 'NOTES.txt': f(t(notes), rights) } : {}),
    },
    undefined,
    rights,
  );
}

/** A slot's systemd unit file (for cat /etc/systemd/system/…). */
export const kioskUnit = (colour: string) => `[Unit]
Description=Gazette kiosk (${colour})
After=network.target

[Service]
User=kiosk
Environment=PORT=${PORTS[colour]}
EnvironmentFile=${ENV}
ExecStart=/usr/bin/node ${KIOSK}/${colour}/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target`;

/**
 * The share of /kiosk/ traffic each slot receives, according to nginx's
 * loaded configuration (direct proxy_pass, or upstream and its weights).
 */
export function distribution(j: Game): Record<string, number> {
  const config: Configuration | null = j.state.nginx?.load ?? null;
  const proxy = config?.servers.flatMap((s) => s.locations).find((l) => l.path === '/kiosk/')?.proxy ?? '';
  const host = /^https?:\/\/([^/]+)/.exec(proxy)?.[1] ?? '';
  const colour = (address: string) => Object.keys(PORTS).find((c) => address.endsWith(`:${PORTS[c]}`));
  const upstream = config?.upstreams?.[host];
  const parts: Record<string, number> = {};
  if (!upstream) {
    const c = colour(host);
    if (c) parts[c] = 1;
    return parts;
  }
  const active = upstream.servers.filter((x) => !x.off && !x.rescue);
  const total = active.reduce((t, x) => t + x.weight, 0);
  for (const x of active) {
    const c = colour(x.address);
    if (c) parts[c] = (parts[c] ?? 0) + x.weight / total;
  }
  return parts;
}

export interface Batch {
  total: number;
  // Per served version: visits and errors (5xx).
  byVersion: Record<string, { visits: number; errors: number }>;
  errors: number;
}

/**
 * One hour of readers on the Kiosk: visits (home page and
 * archives) that go through nginx and are written to access.log; the clock
 * moves forward. Documentation addresses (RFC 5737).
 */
export function readers(j: Game, count = 60): Batch {
  const sd = systemd(j)!;
  const batch: Batch = { total: 0, byVersion: {}, errors: 0 };
  for (let i = 0; i < count; i++) {
    const path = i % 3 === 1 ? '/kiosk/archives' : '/kiosk/';
    const client = {
      address: `198.51.100.${((i * 37) % 240) + 10}`,
      time: sd.clock + i * 60_000,
      agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
    };
    j.state.nginxLastUpstream = null;
    const r = httpRequest(j, 'gazette.example', path, 80, true, client);
    const port = Number(String(j.state.nginxLastUpstream ?? '').split(':')[1]);
    const colour = Object.keys(PORTS).find((c) => PORTS[c] === port);
    const version = colour ? instances(j)[colour]?.version : undefined;
    batch.total++;
    const error = !r || r.code >= 500;
    if (error) batch.errors++;
    if (version) {
      const v = (batch.byVersion[version] ??= { visits: 0, errors: 0 });
      v.visits++;
      if (error) v.errors++;
    }
  }
  sd.clock += count * 60_000;
  return batch;
}
