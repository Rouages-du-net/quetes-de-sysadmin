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

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { comptesCooperative, M, mondeCooperative, MOT_DE_PASSE } from './cooperative';
import { caisse, NGINX_BINAIRE, CLE_ANCIENNE, CLE_NOUVELLE, ENV, envCaisse, etatCaisse, mondeCaisse, nginxCooperative, visite } from './caisse-web';
import { chargerNginx } from '../nginx';

const ATTAQUANT = '203.0.113.77';

const SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name cooperative.example www.cooperative.example;

    # quick and simple: serve the app directory
    root /srv/caisse/app;
    index index.html;

    location /caisse/ {
        proxy_pass http://127.0.0.1:3000/;
    }
}`;

const ACCES = `192.0.2.44 - - [18/Oct/2027:18:02:11 +0200] "GET / HTTP/1.1" 200 118 "-" "Mozilla/5.0 (X11; Linux x86_64)"
192.0.2.44 - - [18/Oct/2027:18:02:12 +0200] "GET /caisse/ HTTP/1.1" 200 95 "-" "Mozilla/5.0 (X11; Linux x86_64)"
192.0.2.51 - - [18/Oct/2027:19:40:03 +0200] "GET / HTTP/1.1" 200 118 "-" "Mozilla/5.0 (Android 14)"
198.51.100.23 - - [19/Oct/2027:02:47:03 +0200] "GET /wp-login.php HTTP/1.1" 404 162 "-" "Mozilla/5.0 (compatible; scanner)"
198.51.100.23 - - [19/Oct/2027:02:47:04 +0200] "GET /phpmyadmin/ HTTP/1.1" 404 162 "-" "Mozilla/5.0 (compatible; scanner)"
${ATTAQUANT} - - [19/Oct/2027:03:12:40 +0200] "GET /.env HTTP/1.1" 200 150 "-" "python-requests/2.32.3"
${ATTAQUANT} - - [19/Oct/2027:03:12:41 +0200] "GET /.git/config HTTP/1.1" 200 192 "-" "python-requests/2.32.3"
${ATTAQUANT} - - [19/Oct/2027:03:12:41 +0200] "GET /.git/HEAD HTTP/1.1" 200 20 "-" "python-requests/2.32.3"
192.0.2.44 - - [19/Oct/2027:08:58:30 +0200] "GET /caisse/ HTTP/1.1" 200 95 "-" "Mozilla/5.0 (X11; Linux x86_64)"`;

const APP_LOG = `2027-10-18 08:00:02 caisse listening on 127.0.0.1:3000
2027-10-19 08:58:31 login ok for lina from 127.0.0.1`;

const statut = (j: Jeu, chemin: string, adresse = '192.0.2.99') => visite(j, chemin, { adresse }, false)?.code ?? 0;
const fuite = (j: Jeu, chemin: string) => statut(j, chemin) === 200;
const siteOk = (j: Jeu) => statut(j, '/') === 200 && statut(j, '/caisse/') === 200;
const attaquantBloque = (j: Jeu) => statut(j, '/', ATTAQUANT) === 403;
const cleChargee = (j: Jeu) => caisse(j).charge.PAIEMENT_CLE === CLE_NOUVELLE;
const fermee = (j: Jeu) => !fuite(j, '/.env') && !fuite(j, '/.git/config') && siteOk(j);

export const secret: Chapitre = {
  id: 'secret',
  numero: 3,
  commandes: [
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
  maison: M,
  accueil: 'courriel_awa.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: () => comptesCooperative(false),
  etat: () => etatCaisse(envCaisse(CLE_ANCIENNE)),
  initialiser: (j) => chargerNginx(j),
  creerMonde: (t) => {
    const caisseWeb = mondeCaisse({ env: envCaisse(CLE_ANCIENNE), accesLog: ACCES, appLog: APP_LOG });
    return mondeCooperative({
      sansMarc: true,
      maison: { 'courriel_awa.txt': f(t('secret-courriel-awa', { cle: CLE_NOUVELLE })) },
      etc: nginxCooperative(SITE),
      sbin: NGINX_BINAIRE,
      plus: caisseWeb,
    });
  },
  evenements: [
    { id: 'env-seul', condition: (j) => !fuite(j, '/.env') && fuite(j, '/.git/config'), message: (j) => j.t('secret-evenement-env-seul') },
    { id: 'site-casse', condition: (j) => !fuite(j, '/.env') && !siteOk(j), message: (j) => j.t('secret-evenement-site-casse') },
    { id: 'fermee', condition: fermee, message: (j) => j.t('secret-evenement-fermee') },
    { id: 'attaquant', condition: attaquantBloque, message: (j) => j.t('secret-evenement-attaquant', { adresse: ATTAQUANT }) },
    {
      id: 'cle-ecrite',
      condition: (j) => (j.lire(ENV) ?? '').includes(CLE_NOUVELLE) && !cleChargee(j),
      message: (j) => j.t('secret-evenement-cle-ecrite'),
    },
    { id: 'fin', condition: (j) => fermee(j) && attaquantBloque(j) && cleChargee(j), message: (j) => j.t('secret-evenement-fin') },
  ],
};
