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

import { d, f, type Dossier, type Noeud } from '../monde';
import type { Jeu } from '../shell';
import { chargerNginx, requete, verifierNginx, type Appli, type Client, type Demande } from '../nginx';
import { journaliser, nouveauSystemd, systemd, type DefinitionService } from '../systemd';
import { MIME, NGINX_CONF } from '../commandes/apt';
import { MAINTENANT } from './cooperative';

export const SITE = '/etc/nginx/sites-available/coop';
export const APPLI = '/srv/till/app';
export const ENV = `${APPLI}/.env`;
export const DOMAINE = 'coop.example';
export const CLE_ANCIENNE = 'pk_live_coop_4f9a2c71e8b3';
export const CLE_NOUVELLE = 'pk_live_coop_9d27be05c4a1';
const JOURNAL = '/var/log/till/app.log';

export const envCaisse = (cle: string, confiance = 'false') => `NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://till:Pois-Chiches-42@localhost/till
PAIEMENT_CLE=${cle}
TRUST_PROXY=${confiance}`;

/** Les variables d'un .env (CLE=valeur, sans guillemets ni commentaires). */
export function lireEnv(texte: string): Record<string, string> {
  const v: Record<string, string> = {};
  for (const l of texte.split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#]*?)"?\s*$/.exec(l);
    if (m) v[m[1]] = m[2];
  }
  return v;
}

interface EtatCaisse {
  // Les variables lues au dernier démarrage.
  charge: Record<string, string>;
  echecs: Record<string, number>;
  bannis: string[];
  connectes: string[];
}
export const till = (j: Jeu) => j.etat.till as EtatCaisse;

// Une adresse fiable pour « trust proxy » : loopback (127.0.0.0/8, ::1), ou une liste.
function fiable(adresse: string, reglage: string): boolean {
  if (reglage === 'true') return true;
  return reglage
    .split(',')
    .map((x) => x.trim())
    .some((r) => (r === 'loopback' ? /^127\./.test(adresse) || adresse === '::1' : r === adresse));
}

/** L'adresse du client selon l'appli (req.ip d'Express). */
export function adresseClient(demande: Demande, reglage: string): string {
  if (!reglage || reglage === 'false') return demande.adresse;
  const xff = (demande.entetes['x-forwarded-for'] ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (reglage === 'true') return xff[0] ?? demande.adresse;
  const chaine = [demande.adresse, ...xff.reverse()];
  return chaine.find((a) => !fiable(a, reglage)) ?? chaine.at(-1)!;
}

function noter(j: Jeu, ligne: string) {
  const n = j.trouver(JOURNAL);
  if (n?.type !== 'fichier' || typeof n.contenu !== 'string') return;
  const sd = systemd(j);
  const heure = new Date(sd?.horloge ?? MAINTENANT).toISOString().slice(0, 19).replace('T', ' ');
  n.contenu = `${n.contenu}\n${heure} ${ligne}`;
}

// L'appli : la page de connexion, /health, et /connexion (u=compte&p=mot de passe), avec un
// verrou après 5 échecs depuis la même adresse.
export const APPLI_CAISSE: Appli = {
  service: 'till',
  pages: {},
  repondre: (j, chemin, demande) => {
    const c = till(j);
    const json = (code: number, corps: unknown) => ({ code, type: 'application/json; charset=utf-8', corps: JSON.stringify(corps) });
    if (chemin === '/')
      return { code: 200, corps: '<!DOCTYPE html>\n<title>Caisse</title>\n<form method="post" action="/till/connexion">…</form>' };
    if (chemin === '/health') return json(200, { status: 'ok', paiement: c.charge.PAIEMENT_CLE === CLE_NOUVELLE ? 'ok' : 'cle_revoquee' });
    if (chemin === '/connexion') {
      const ip = adresseClient(demande, c.charge.TRUST_PROXY ?? 'false');
      const compte = demande.entetes['x-compte'] ?? '';
      if (c.bannis.includes(ip)) {
        noter(j, `rejected login for ${compte} from ${ip} (locked)`);
        return json(429, { error: 'Too many attempts, try again in 15 minutes' });
      }
      if (demande.entetes['x-mot-de-passe'] === 'bon') {
        if (!c.connectes.includes(compte)) c.connectes.push(compte);
        noter(j, `login ok for ${compte} from ${ip}`);
        return json(200, { ok: true });
      }
      c.echecs[ip] = (c.echecs[ip] ?? 0) + 1;
      noter(j, `login failed for ${compte} from ${ip}`);
      if (c.echecs[ip] >= 5 && !c.bannis.includes(ip)) {
        c.bannis.push(ip);
        noter(j, `locked ${ip} for 15 minutes`);
      }
      return json(401, { error: 'Invalid credentials' });
    }
    return {
      code: 404,
      corps: `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET ${chemin}</pre>\n</body>\n</html>`,
    };
  },
};

/** Une requête simulée, comme si elle venait d'internet, vers le site (sans trace si le jeu vérifie). */
export function visite(j: Jeu, chemin: string, client: Partial<Client> & { adresse: string }, trace = true) {
  return requete(j, DOMAINE, chemin, 80, trace, { temps: systemd(j)?.horloge ?? MAINTENANT, agent: 'Mozilla/5.0', ...client });
}

/** Les services de la machine : nginx, et l'appli (qui lit son .env à chaque démarrage). */
export function systemdCaisse(apresNginx?: (j: Jeu) => void, apresCaisse?: (j: Jeu) => void) {
  const nginx: DefinitionService = {
    description: 'A high performance web server and a reverse proxy server',
    active: true,
    executable: 'nginx',
    processus: [
      { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
    ],
    verifier: verifierNginx,
    charger: (j) => {
      chargerNginx(j);
      apresNginx?.(j);
    },
    verifierAuRechargement: true,
  };
  const appli: DefinitionService = {
    description: 'Cooperative till',
    active: true,
    executable: 'node',
    processus: [{ pid: 731, utilisateur: 'till', cpu: 1.2, mem: 3.4, commande: '/usr/bin/node /srv/till/app/server.js' }],
    charger: (j) => {
      const c = till(j);
      if (!c) return;
      // Au démarrage : le .env relu, la mémoire des verrous vidée.
      c.charge = lireEnv(j.lire(ENV) ?? '');
      c.echecs = {};
      c.bannis = [];
      c.connectes = [];
      const sd = systemd(j);
      if (sd) journaliser(sd, 'till.service', 'node', 731, 'till listening on 127.0.0.1:3000');
      apresCaisse?.(j);
    },
  };
  return nouveauSystemd('cooperative', MAINTENANT - 6 * 86_400_000, MAINTENANT, { nginx, till: appli });
}

/** L'état du site : nginx (journal d'accès), l'appli et ses verrous. */
export const etatCaisse = (env: string, plus: Record<string, unknown> = {}) => ({
  systemd: systemdCaisse(),
  nginx: { charge: null, noms: ['coop', DOMAINE, `www.${DOMAINE}`, '192.0.2.20', 'localhost', '127.0.0.1'], journalAcces: true },
  applis: { '127.0.0.1:3000': APPLI_CAISSE },
  till: { charge: lireEnv(env), echecs: {}, bannis: [], connectes: [] } satisfies EtatCaisse,
  ...plus,
});

const racine = { proprio: 'root' };

/** /usr/sbin/nginx (installé). */
export const NGINX_BINAIRE: Record<string, Noeud> = { nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) };
const fichier = (contenu: string, droits: { proprio?: string; groupe?: string; mode?: string } = racine) => f(contenu, { lignes: true, ...droits });

/** /etc/nginx (le site cooperative activé), et les journaux. */
export function nginxCooperative(site: string): Record<string, Noeud> {
  return {
    nginx: d(
      {
        'nginx.conf': fichier(NGINX_CONF),
        'mime.types': fichier(MIME),
        'conf.d': d({}, undefined, racine),
        'modules-enabled': d({}, undefined, racine),
        'sites-available': d({ coop: fichier(site) }, undefined, racine),
        'sites-enabled': d({ coop: f('', { proprio: 'root', lien: SITE }) }, undefined, racine),
      },
      undefined,
      racine,
    ),
  };
}

/** /srv/till/app (le code, le .env, le dépôt git) et /var/log. */
export function mondeCaisse(o: { env: string; envMode?: string; accesLog: string; appLog: string }): { srv: Dossier; var: Dossier } {
  const caisseDroits = { proprio: 'till', groupe: 'till' };
  return {
    srv: d(
      {
        till: d(
          {
            app: d(
              {
                '.env': fichier(o.env, { ...caisseDroits, mode: o.envMode ?? 'rw-r--r--' }),
                '.git': d(
                  {
                    config: fichier(
                      '[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote "origin"]\n\turl = https://deploy:ghp_coopExampleToken42@git.coop.example/till.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*',
                      caisseDroits,
                    ),
                    HEAD: fichier('ref: refs/heads/main', caisseDroits),
                  },
                  undefined,
                  caisseDroits,
                ),
                'index.html': fichier(
                  '<!DOCTYPE html>\n<html lang="fr">\n<title>Cooperative</title>\n<h1>Cooperative</h1>\n<a href="/till/">Caisse</a>\n</html>',
                  caisseDroits,
                ),
                'server.js': fichier(
                  "require('dotenv').config();\nconst app = require('express')();\napp.set('trust proxy', process.env.TRUST_PROXY);\n// ...",
                  caisseDroits,
                ),
                'package.json': fichier(
                  '{\n  "name": "till",\n  "version": "2.3.1",\n  "dependencies": { "dotenv": "^16.4.5", "express": "^4.21.2" }\n}',
                  caisseDroits,
                ),
              },
              undefined,
              caisseDroits,
            ),
          },
          undefined,
          caisseDroits,
        ),
      },
      undefined,
      racine,
    ),
    var: d(
      {
        log: d(
          {
            nginx: d(
              {
                'access.log': f(o.accesLog, { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
                'error.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
              },
              undefined,
              { proprio: 'root', groupe: 'adm' },
            ),
            till: d({ 'app.log': f(o.appLog, { lignes: true, proprio: 'till', groupe: 'adm', mode: 'rw-r-----' }) }, undefined, caisseDroits),
          },
          undefined,
          racine,
        ),
        run: d({}, undefined, racine),
      },
      undefined,
      racine,
    ),
  };
}
