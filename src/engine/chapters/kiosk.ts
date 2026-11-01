// Le Kiosque de la Gazette : l'appli Node.js des abonnements à la lettre
// d'information, derrière nginx (location /kiosk/). Deux emplacements
// tournent côte à côte, blue (port 3001) et green (port 3002), chacun avec
// son service systemd ; /srv/kiosk/blue et /srv/kiosk/green sont des
// liens vers une version de /srv/kiosk/versions/. Comme un vrai
// processus, une instance lit son code et sa configuration
// (/etc/kiosk/kiosk.env) à son démarrage : changer le lien ou la
// configuration ne compte qu'après un redémarrage.
// Chaque instance répond sur /health (200 ou 503, en JSON), comme le
// recommandent les guides de déploiement (blue/green : https://martinfowler.com/bliki/BlueGreenDeployment.html).

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
  // Les variables de configuration sans lesquelles elle ne fonctionne pas.
  requires: string[];
  // Les pages qui plantent (un bogue que seul le vrai trafic révèle).
  failure?: string[];
  // Le schéma de base de données qu'elle attend (et celui où elle le migre).
  schema: number;
}

export const VERSIONS: Record<string, KioskVersion> = {
  '1.4.2': { requires: [], schema: 3 },
  '1.5.0': { requires: ['KIOSK_SMTP'], schema: 3 },
  // La recherche dans les archives plante : /health n'en sait rien.
  '1.6.0': { requires: ['KIOSK_SMTP'], failure: ['/archives'], schema: 3 },
  '1.6.1': { requires: ['KIOSK_SMTP'], schema: 3 },
  // Migre la base au démarrage (schéma 4 : la colonne courriel devient email).
  '2.0.0': { requires: ['KIOSK_SMTP_URL'], schema: 4 },
  '2.0.1': { requires: ['KIOSK_SMTP_URL'], schema: 4 },
};

// La base du Kiosque : le schéma où elle en est (les migrations ne font qu'avancer).
export const base = (j: Game): { schema: number } => (j.state.kioskBase ??= { schema: 3 });

export interface Instance {
  version: string;
  config: Record<string, string>;
}

export const instances = (j: Game): Record<string, Instance> => (j.state.kiosk ??= {});

/** La version que vise le lien d'un emplacement (/srv/kiosk/green → versions/1.5.0). */
export function linkVersion(j: Game, colour: string): string | null {
  const link = (j.find(`${KIOSK}/${colour}`, false) as { link?: string } | null)?.link;
  const name = link?.replace(/\/$/, '').split('/').at(-1);
  return name && VERSIONS[name] && j.find(`${KIOSK}/${colour}/serveur.js`)?.type === 'fichier' ? name : null;
}

/** Le service systemd d'un emplacement. */
export function kioskService(colour: string, pid: number, state: 'active' | 'inactive' = 'active'): DefinitionService {
  return {
    description: `Gazette kiosk (${colour})`,
    state,
    active: state === 'active',
    executable: 'node',
    process: [{ pid, user: 'kiosk', cpu: 0.6, mem: 3.1, command: `node ${KIOSK}/${colour}/serveur.js` }],
    check: (j) =>
      linkVersion(j, colour)
        ? null
        : [
            `node:internal/modules/cjs/loader:1228`,
            `Error: Cannot find module '${KIOSK}/${colour}/serveur.js'`,
            `  code: 'MODULE_NOT_FOUND'`,
            `Node.js v22.12.0`,
          ],
    // Au démarrage, le processus charge son code et sa configuration.
    load: (j) => {
      const version = linkVersion(j, colour)!;
      instances(j)[colour] = { version, config: readEnv(j.read(ENV)) };
      const sd = systemd(j);
      if (!sd) return;
      const write = (message: string) => writeLog(sd, `kiosk-${colour}.service`, 'node', pid, message, 6, false);
      write(`Kiosque ${version} starting (NODE_ENV=production)`);
      // Une version plus récente migre la base, comme les outils de migration
      // des frameworks : la base ne revient pas en arrière d'elle-même.
      const b = base(j);
      if (VERSIONS[version].schema > b.schema) {
        for (let n = b.schema + 1; n <= VERSIONS[version].schema; n++) write(`Running migration 00${n}_${MIGRATIONS[n] ?? 'update'}... done`);
        write(`Database schema is now at version ${VERSIONS[version].schema}`);
        b.schema = VERSIONS[version].schema;
      }
      write(`Listening on http://127.0.0.1:${PORTS[colour]}`);
    },
  };
}

// Les migrations du Kiosque, par numéro de schéma.
const MIGRATIONS: Record<number, string> = { 4: 'rename_abonnes_courriel_to_email' };

const json = (code: number, object: unknown) => ({ code, body: JSON.stringify(object), type: 'application/json; charset=utf-8' });

/** L'appli d'un emplacement, telle que nginx et curl la joignent. */
export function kioskApp(colour: string): App {
  return {
    service: `kiosk-${colour}`,
    pages: {},
    answer: (j, path) => {
      const here = instances(j)[colour];
      const v = VERSIONS[here.version];
      const missing = v.requires.filter((k) => !here.config[k]);
      // Une base migrée plus loin que ce que la version connaît : elle ne sait plus la lire.
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

/** La santé d'un emplacement (null : il ne répond pas). */
export function health(j: Game, colour: string): { status: string; version: string } | null {
  const app = kioskApp(colour);
  if (j.state.systemd?.services[app.service]?.state !== 'active' || !instances(j)[colour]) return null;
  return JSON.parse(app.answer!(j, '/health', { headers: {}, address: '127.0.0.1' }).body);
}

/** Les fichiers d'une version (/srv/kiosk/versions/1.5.0). */
export function versionDirectory(t: Game['t'], version: string, notes?: string): Node {
  const rights: Rights = { owner: 'kiosk', group: 'kiosk' };
  return d(
    {
      'serveur.js': f(`// Kiosque ${version}\nrequire('./app').listen(process.env.PORT);`, { lines: true, ...rights }),
      'package.json': f(JSON.stringify({ name: 'kiosk', version, main: 'serveur.js' }, null, 2), { lines: true, ...rights }),
      ...(notes ? { 'NOTES.txt': f(t(notes), rights) } : {}),
    },
    undefined,
    rights,
  );
}

/** Le fichier d'unité systemd d'un emplacement (pour cat /etc/systemd/system/…). */
export const kioskUnit = (colour: string) => `[Unit]
Description=Gazette kiosk (${colour})
After=network.target

[Service]
User=kiosk
Environment=PORT=${PORTS[colour]}
EnvironmentFile=${ENV}
ExecStart=/usr/bin/node ${KIOSK}/${colour}/serveur.js
Restart=on-failure

[Install]
WantedBy=multi-user.target`;

/**
 * La part du trafic de /kiosk/ que reçoit chaque emplacement, d'après la
 * configuration chargée de nginx (proxy_pass direct, ou upstream et ses poids).
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
  // Par version servie : visites et erreurs (5xx).
  byVersion: Record<string, { visits: number; errors: number }>;
  errors: number;
}

/**
 * Une heure de lecteur·rices sur le Kiosque : des visites (accueil et
 * archives) qui passent par nginx et s'écrivent dans access.log ; l'horloge
 * avance. Adresses de documentation (RFC 5737).
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
