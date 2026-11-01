// Histoire « La Coopérative » — chapitre « Le secret » : le prestataire de
// paiement prévient que la clé de la coopérative traîne sur internet. Le site
// est servi depuis le dossier de l'appli : nginx donne /.env (les secrets)
// et /.git/config (un jeton) à qui les demande. Le journal d'accès dit qui
// les a pris cette nuit.
//   - fermer la fuite : une location qui refuse les fichiers cachés
//     (location ~ /\. { deny all; }), ou un root qui ne contient que le site,
//     ou des droits qui empêchent www-data de lire ;
//   - bloquer l'adresse qui les a téléchargés (deny) ;
//   - mettre la nouvelle clé dans .env et relancer l'appli (elle ne relit
//     son .env qu'au démarrage).
// Objectif vérifié sur l'état, par des requêtes au nginx simulé : /.env et
// /.git/config ne sont plus servis, le site et la caisse répondent toujours,
// l'adresse fautive reçoit 403, et l'appli a chargé la nouvelle clé.
// Sources : https://nginx.org/en/docs/http/ngx_http_core_module.html#location,
// https://nginx.org/en/docs/http/ngx_http_access_module.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { cooperativeAccounts, M, cooperativeWorld, PASSWORD } from './coop';
import { till, BINARY_NGINX, OLD_KEY, NEW_KEY, ENV, tillEnv, tillState, tillWorld, nginxCooperative, visit } from './till-web';
import { loadNginx } from '../nginx';

const ATTACKER = '203.0.113.77';

const SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name coop.example www.coop.example;

    # quick and simple: serve the app directory
    root /srv/till/app;
    index index.html;

    location /till/ {
        proxy_pass http://127.0.0.1:3000/;
    }
}`;

const ACCESS = `192.0.2.44 - - [18/Oct/2027:18:02:11 +0200] "GET / HTTP/1.1" 200 118 "-" "Mozilla/5.0 (X11; Linux x86_64)"
192.0.2.44 - - [18/Oct/2027:18:02:12 +0200] "GET /till/ HTTP/1.1" 200 95 "-" "Mozilla/5.0 (X11; Linux x86_64)"
192.0.2.51 - - [18/Oct/2027:19:40:03 +0200] "GET / HTTP/1.1" 200 118 "-" "Mozilla/5.0 (Android 14)"
198.51.100.23 - - [19/Oct/2027:02:47:03 +0200] "GET /wp-login.php HTTP/1.1" 404 162 "-" "Mozilla/5.0 (compatible; scanner)"
198.51.100.23 - - [19/Oct/2027:02:47:04 +0200] "GET /phpmyadmin/ HTTP/1.1" 404 162 "-" "Mozilla/5.0 (compatible; scanner)"
${ATTACKER} - - [19/Oct/2027:03:12:40 +0200] "GET /.env HTTP/1.1" 200 150 "-" "python-requests/2.32.3"
${ATTACKER} - - [19/Oct/2027:03:12:41 +0200] "GET /.git/config HTTP/1.1" 200 192 "-" "python-requests/2.32.3"
${ATTACKER} - - [19/Oct/2027:03:12:41 +0200] "GET /.git/HEAD HTTP/1.1" 200 20 "-" "python-requests/2.32.3"
192.0.2.44 - - [19/Oct/2027:08:58:30 +0200] "GET /till/ HTTP/1.1" 200 95 "-" "Mozilla/5.0 (X11; Linux x86_64)"`;

const APP_LOG = `2027-10-18 08:00:02 till listening on 127.0.0.1:3000
2027-10-19 08:58:31 login ok for lina from 127.0.0.1`;

const status = (j: Game, path: string, address = '192.0.2.99') => visit(j, path, { address }, false)?.code ?? 0;
const leak = (j: Game, path: string) => status(j, path) === 200;
const siteOk = (j: Game) => status(j, '/') === 200 && status(j, '/till/') === 200;
const blockedAttacker = (j: Game) => status(j, '/', ATTACKER) === 403;
const loadedKey = (j: Game) => till(j).load.PAIEMENT_CLE === NEW_KEY;
const closed = (j: Game) => !leak(j, '/.env') && !leak(j, '/.git/config') && siteOk(j);

export const secret: Chapter = {
  id: 'secret',
  number: 3,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'awk',
    'sort',
    'uniq',
    'wc',
    'find',
    'cp',
    'mv',
    'mkdir',
    'rm',
    'nano',
    'sudo',
    'id',
    'whoami',
    'chmod',
    'chown',
    'ln',
    'systemctl',
    'journalctl',
    'nginx',
    'curl',
  ],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: () => cooperativeAccounts(false),
  state: () => tillState(tillEnv(OLD_KEY)),
  initialise: (j) => loadNginx(j),
  createWorld: (t) => {
    const webTill = tillWorld({ env: tillEnv(OLD_KEY), logAccess: ACCESS, appLog: APP_LOG });
    return cooperativeWorld({
      withoutMarc: true,
      home: { 'email_awa.txt': f(t('secret-email-awa', { cle: NEW_KEY })) },
      etc: nginxCooperative(SITE),
      sbin: BINARY_NGINX,
      more: webTill,
    });
  },
  events: [
    { id: 'env-only', condition: (j) => !leak(j, '/.env') && leak(j, '/.git/config'), message: (j) => j.t('secret-event-env-only') },
    { id: 'site-broken', condition: (j) => !leak(j, '/.env') && !siteOk(j), message: (j) => j.t('secret-event-site-broken') },
    { id: 'closed', condition: closed, message: (j) => j.t('secret-event-closed') },
    { id: 'attacker', condition: blockedAttacker, message: (j) => j.t('secret-event-attacker', { adresse: ATTACKER }) },
    {
      id: 'key-written',
      condition: (j) => (j.read(ENV) ?? '').includes(NEW_KEY) && !loadedKey(j),
      message: (j) => j.t('secret-event-key-written'),
    },
    { id: 'end', condition: (j) => closed(j) && blockedAttacker(j) && loadedKey(j), message: (j) => j.t('secret-event-end') },
  ],
};
