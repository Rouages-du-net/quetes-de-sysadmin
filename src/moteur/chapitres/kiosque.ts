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
import type { Appli } from '../nginx';
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

export const VERSIONS: Record<string, VersionKiosque> = { '1.4.2': { requiert: [], schema: 3 }, '1.5.0': { requiert: ['KIOSQUE_SMTP'], schema: 3 } };

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
      instances(j)[couleur] = { version: versionDuLien(j, couleur)!, config: lireEnv(j.lire(ENV)) };
    },
  };
}

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
      if (chemin === '/health')
        return manque.length
          ? json(503, { status: 'error', version: ici.version, error: `${manque[0]} is not set` })
          : json(200, { status: 'ok', version: ici.version });
      if (manque.length || v.panne?.includes(chemin)) return { code: 500, corps: 'Internal Server Error' };
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
  return JSON.parse(appli.repondre!(j, '/health').corps);
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
