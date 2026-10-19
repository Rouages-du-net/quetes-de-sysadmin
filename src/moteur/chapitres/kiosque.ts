// Le Kiosque de la Gazette : l'appli Node.js des abonnements à la lettre
// d'information, derrière nginx (location /kiosque/). Deux emplacements
// tournent côte à côte, bleu (port 3001) et vert (port 3002), chacun avec
// son service systemd ; /srv/kiosque/bleu et /srv/kiosque/vert sont des
// liens vers une version de /srv/kiosque/versions/. Comme un vrai
// processus, une instance lit son code et sa configuration
// (/etc/kiosque/kiosque.env) à son démarrage : changer le lien ou la
// configuration ne compte qu'après un redémarrage.
// Chaque instance répond sur /health (200 ou 503, en JSON), comme le
// recommandent les guides de déploiement (bleu/vert : https://martinfowler.com/bliki/BlueGreenDeployment.html).

import { d, f, type Droits, type Noeud } from '../monde';
import type { Jeu } from '../shell';
import type { DefinitionService } from '../systemd';
import { requete, type Appli, type Configuration } from '../nginx';
import { journaliser, systemd } from '../systemd';
import { lireEnv } from '../compose';

export const KIOSQUE = '/srv/kiosque';
export const ENV = '/etc/kiosque/kiosque.env';
export const PORTS: Record<string, number> = { bleu: 3001, vert: 3002 };

export interface VersionKiosque {
  // Les variables de configuration sans lesquelles elle ne fonctionne pas.
  requiert: string[];
  // Les pages qui plantent (un bogue que seul le vrai trafic révèle).
  panne?: string[];
  // Le schéma de base de données qu'elle attend (et celui où elle le migre).
  schema: number;
}

export const VERSIONS: Record<string, VersionKiosque> = {
  '1.4.2': { requiert: [], schema: 3 },
  '1.5.0': { requiert: ['KIOSQUE_SMTP'], schema: 3 },
  // La recherche dans les archives plante : /health n'en sait rien.
  '1.6.0': { requiert: ['KIOSQUE_SMTP'], panne: ['/archives'], schema: 3 },
  '1.6.1': { requiert: ['KIOSQUE_SMTP'], schema: 3 },
  // Migre la base au démarrage (schéma 4 : la colonne courriel devient email).
  '2.0.0': { requiert: ['KIOSQUE_SMTP_URL'], schema: 4 },
  '2.0.1': { requiert: ['KIOSQUE_SMTP_URL'], schema: 4 },
};

// La base du Kiosque : le schéma où elle en est (les migrations ne font qu'avancer).
export const base = (j: Jeu): { schema: number } => (j.etat.kiosqueBase ??= { schema: 3 });

export interface Instance {
  version: string;
  config: Record<string, string>;
}

export const instances = (j: Jeu): Record<string, Instance> => (j.etat.kiosque ??= {});

/** La version que vise le lien d'un emplacement (/srv/kiosque/vert → versions/1.5.0). */
export function versionDuLien(j: Jeu, couleur: string): string | null {
  const lien = (j.trouver(`${KIOSQUE}/${couleur}`, false) as { lien?: string } | null)?.lien;
  const nom = lien?.replace(/\/$/, '').split('/').at(-1);
  return nom && VERSIONS[nom] && j.trouver(`${KIOSQUE}/${couleur}/serveur.js`)?.type === 'fichier' ? nom : null;
}

/** Le service systemd d'un emplacement. */
export function serviceKiosque(couleur: string, pid: number, etat: 'active' | 'inactive' = 'active'): DefinitionService {
  return {
    description: `Gazette kiosk (${couleur})`,
    etat,
    active: etat === 'active',
    executable: 'node',
    processus: [{ pid, utilisateur: 'kiosque', cpu: 0.6, mem: 3.1, commande: `node ${KIOSQUE}/${couleur}/serveur.js` }],
    verifier: (j) =>
      versionDuLien(j, couleur)
        ? null
        : [
            `node:internal/modules/cjs/loader:1228`,
            `Error: Cannot find module '${KIOSQUE}/${couleur}/serveur.js'`,
            `  code: 'MODULE_NOT_FOUND'`,
            `Node.js v22.12.0`,
          ],
    // Au démarrage, le processus charge son code et sa configuration.
    charger: (j) => {
      const version = versionDuLien(j, couleur)!;
      instances(j)[couleur] = { version, config: lireEnv(j.lire(ENV)) };
      const sd = systemd(j);
      if (!sd) return;
      const ecrire = (message: string) => journaliser(sd, `kiosque-${couleur}.service`, 'node', pid, message, 6, false);
      ecrire(`Kiosque ${version} starting (NODE_ENV=production)`);
      // Une version plus récente migre la base, comme les outils de migration
      // des frameworks : la base ne revient pas en arrière d'elle-même.
      const b = base(j);
      if (VERSIONS[version].schema > b.schema) {
        for (let n = b.schema + 1; n <= VERSIONS[version].schema; n++) ecrire(`Running migration 00${n}_${MIGRATIONS[n] ?? 'update'}... done`);
        ecrire(`Database schema is now at version ${VERSIONS[version].schema}`);
        b.schema = VERSIONS[version].schema;
      }
      ecrire(`Listening on http://127.0.0.1:${PORTS[couleur]}`);
    },
  };
}

// Les migrations du Kiosque, par numéro de schéma.
const MIGRATIONS: Record<number, string> = { 4: 'rename_abonnes_courriel_to_email' };

const json = (code: number, objet: unknown) => ({ code, corps: JSON.stringify(objet), type: 'application/json; charset=utf-8' });

/** L'appli d'un emplacement, telle que nginx et curl la joignent. */
export function appliKiosque(couleur: string): Appli {
  return {
    service: `kiosque-${couleur}`,
    pages: {},
    repondre: (j, chemin) => {
      const ici = instances(j)[couleur];
      const v = VERSIONS[ici.version];
      const manque = v.requiert.filter((k) => !ici.config[k]);
      // Une base migrée plus loin que ce que la version connaît : elle ne sait plus la lire.
      const tropRecente = base(j).schema > v.schema;
      if (chemin === '/health')
        return tropRecente
          ? json(503, { status: 'error', version: ici.version, error: `database schema ${base(j).schema} is newer than supported (${v.schema})` })
          : manque.length
            ? json(503, { status: 'error', version: ici.version, error: `${manque[0]} is not set` })
            : json(200, { status: 'ok', version: ici.version });
      if (tropRecente || manque.length || v.panne?.includes(chemin)) return { code: 500, corps: 'Internal Server Error' };
      if (chemin === '/' || chemin === '') return { code: 200, corps: j.t('kiosque-accueil', { version: ici.version }) };
      if (chemin === '/archives') return { code: 200, corps: j.t('kiosque-archives', { version: ici.version }) };
      return {
        code: 404,
        corps: `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET ${chemin}</pre>\n</body>\n</html>`,
      };
    },
  };
}

/** La santé d'un emplacement (null : il ne répond pas). */
export function sante(j: Jeu, couleur: string): { status: string; version: string } | null {
  const appli = appliKiosque(couleur);
  if (j.etat.systemd?.services[appli.service]?.etat !== 'active' || !instances(j)[couleur]) return null;
  return JSON.parse(appli.repondre!(j, '/health', { entetes: {}, adresse: '127.0.0.1' }).corps);
}

/** Les fichiers d'une version (/srv/kiosque/versions/1.5.0). */
export function dossierVersion(t: Jeu['t'], version: string, notes?: string): Noeud {
  const droits: Droits = { proprio: 'kiosque', groupe: 'kiosque' };
  return d(
    {
      'serveur.js': f(`// Kiosque ${version}\nrequire('./app').listen(process.env.PORT);`, { lignes: true, ...droits }),
      'package.json': f(JSON.stringify({ name: 'kiosque', version, main: 'serveur.js' }, null, 2), { lignes: true, ...droits }),
      ...(notes ? { 'NOTES.txt': f(t(notes), droits) } : {}),
    },
    undefined,
    droits,
  );
}

/** Le fichier d'unité systemd d'un emplacement (pour cat /etc/systemd/system/…). */
export const uniteKiosque = (couleur: string) => `[Unit]
Description=Gazette kiosk (${couleur})
After=network.target

[Service]
User=kiosque
Environment=PORT=${PORTS[couleur]}
EnvironmentFile=${ENV}
ExecStart=/usr/bin/node ${KIOSQUE}/${couleur}/serveur.js
Restart=on-failure

[Install]
WantedBy=multi-user.target`;

/**
 * La part du trafic de /kiosque/ que reçoit chaque emplacement, d'après la
 * configuration chargée de nginx (proxy_pass direct, ou upstream et ses poids).
 */
export function repartition(j: Jeu): Record<string, number> {
  const config: Configuration | null = j.etat.nginx?.charge ?? null;
  const proxy = config?.serveurs.flatMap((s) => s.locations).find((l) => l.chemin === '/kiosque/')?.proxy ?? '';
  const hote = /^https?:\/\/([^/]+)/.exec(proxy)?.[1] ?? '';
  const couleur = (adresse: string) => Object.keys(PORTS).find((c) => adresse.endsWith(`:${PORTS[c]}`));
  const amont = config?.amonts?.[hote];
  const parts: Record<string, number> = {};
  if (!amont) {
    const c = couleur(hote);
    if (c) parts[c] = 1;
    return parts;
  }
  const actifs = amont.serveurs.filter((x) => !x.eteint && !x.secours);
  const total = actifs.reduce((t, x) => t + x.poids, 0);
  for (const x of actifs) {
    const c = couleur(x.adresse);
    if (c) parts[c] = (parts[c] ?? 0) + x.poids / total;
  }
  return parts;
}

export interface Lot {
  total: number;
  // Par version servie : visites et erreurs (5xx).
  parVersion: Record<string, { visites: number; erreurs: number }>;
  erreurs: number;
}

/**
 * Une heure de lecteur·rices sur le Kiosque : des visites (accueil et
 * archives) qui passent par nginx et s'écrivent dans access.log ; l'horloge
 * avance. Adresses de documentation (RFC 5737).
 */
export function lecteurs(j: Jeu, nombre = 60): Lot {
  const sd = systemd(j)!;
  const lot: Lot = { total: 0, parVersion: {}, erreurs: 0 };
  for (let i = 0; i < nombre; i++) {
    const chemin = i % 3 === 1 ? '/kiosque/archives' : '/kiosque/';
    const client = {
      adresse: `198.51.100.${((i * 37) % 240) + 10}`,
      temps: sd.horloge + i * 60_000,
      agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
    };
    j.etat.nginxDernierAmont = null;
    const r = requete(j, 'gazette.example', chemin, 80, true, client);
    const port = Number(String(j.etat.nginxDernierAmont ?? '').split(':')[1]);
    const couleur = Object.keys(PORTS).find((c) => PORTS[c] === port);
    const version = couleur ? instances(j)[couleur]?.version : undefined;
    lot.total++;
    const erreur = !r || r.code >= 500;
    if (erreur) lot.erreurs++;
    if (version) {
      const v = (lot.parVersion[version] ??= { visites: 0, erreurs: 0 });
      v.visites++;
      if (erreur) v.erreurs++;
    }
  }
  sd.horloge += nombre * 60_000;
  return lot;
}
