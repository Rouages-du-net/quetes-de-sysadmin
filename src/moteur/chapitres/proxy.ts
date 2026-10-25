// Histoire « La Coopérative » — chapitre « Le proxy » : depuis ce matin,
// plus personne ne peut se connecter à la caisse (« Too many attempts »).
// Un robot essaie des mots de passe ; l'appli verrouille l'adresse qui
// échoue cinq fois… mais derrière nginx, toutes les requêtes lui arrivent de
// 127.0.0.1 : elle a verrouillé tout le monde.
//   - nginx doit dire à l'appli qui est le vrai client :
//     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for (ou $remote_addr) ;
//   - l'appli ne doit croire cet en-tête que s'il vient de nginx :
//     TRUST_PROXY=loopback (et pas true : le robot écrit lui-même un faux
//     X-Forwarded-For à chaque essai, que nginx ne fait que compléter) ;
//   - recharger nginx, relancer l'appli (qui oublie ses verrous).
// À chaque rechargement de nginx ou démarrage de l'appli, le jeu rejoue cinq
// minutes de trafic : le robot (198.51.100.66, un faux X-Forwarded-For
// différent à chaque essai), puis Lina qui se connecte.
// Objectif vérifié sur ce trafic : Lina entre, et c'est bien l'adresse du
// robot qui est verrouillée.
// Sources : https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header,
// https://expressjs.com/en/guide/behind-proxies.html

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { chargerNginx } from '../nginx';
import { comptesCooperative, M, mondeCooperative, MOT_DE_PASSE } from './cooperative';
import { caisse, CLE_NOUVELLE, envCaisse, etatCaisse, mondeCaisse, NGINX_BINAIRE, nginxCooperative, systemdCaisse, visite } from './caisse-web';

const ROBOT = '198.51.100.66';
const LINA = '192.0.2.44';

// Le site, avec la correction du chapitre précédent.
const SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name coop.example www.coop.example;

    root /srv/caisse/app;
    index index.html;

    deny 203.0.113.77;

    location ~ /\\. {
        deny all;
    }

    location /caisse/ {
        proxy_pass http://127.0.0.1:3000/;
    }
}`;

const robot = (n: number) =>
  `${ROBOT} - - [19/Oct/2027:07:5${Math.floor(n / 10)}:${String((n % 10) * 6).padStart(2, '0')} +0200] "POST /caisse/connexion HTTP/1.1" ${n < 5 ? 401 : 429} 41 "-" "python-requests/2.32.3"`;
const ACCES = [
  ...Array.from({ length: 12 }, (_, n) => robot(n)),
  `${LINA} - - [19/Oct/2027:08:58:30 +0200] "GET /caisse/ HTTP/1.1" 200 95 "-" "Mozilla/5.0 (X11; Linux x86_64)"`,
  `${LINA} - - [19/Oct/2027:08:58:44 +0200] "POST /caisse/connexion HTTP/1.1" 429 52 "-" "Mozilla/5.0 (X11; Linux x86_64)"`,
  `192.0.2.51 - - [19/Oct/2027:09:12:03 +0200] "POST /caisse/connexion HTTP/1.1" 429 52 "-" "Mozilla/5.0 (Android 14)"`,
].join('\n');

const APP_LOG = [
  '2027-10-19 05:00:02 caisse listening on 127.0.0.1:3000',
  ...Array.from({ length: 5 }, (_, n) => `2027-10-19 05:5${n}:0${n} login failed for admin from 127.0.0.1`),
  '2027-10-19 05:54:04 locked 127.0.0.1 for 15 minutes',
  '2027-10-19 06:58:44 rejected login for lina from 127.0.0.1 (locked)',
  '2027-10-19 07:12:03 rejected login for karim from 127.0.0.1 (locked)',
].join('\n');

// Cinq minutes de trafic : le robot (un faux X-Forwarded-For à chaque essai), puis Lina.
function simuler(j: Jeu) {
  const c = caisse(j);
  if (!c || !j.etat.nginx?.charge) return;
  for (let n = 0; n < 8; n++)
    visite(j, '/caisse/connexion', {
      adresse: ROBOT,
      methode: 'POST',
      agent: 'python-requests/2.32.3',
      entetes: { 'x-forwarded-for': `10.${n + 1}.${n * 7}.${n + 3}`, 'x-compte': 'admin', 'x-mot-de-passe': `essai${n}` },
    });
  const r = visite(j, '/caisse/connexion', { adresse: LINA, methode: 'POST', entetes: { 'x-compte': 'lina', 'x-mot-de-passe': 'bon' } });
  j.etat.simulation = { lina: r?.code === 200, robotVerrouille: c.bannis.includes(ROBOT), bannis: [...c.bannis] };
}

type Simulation = { lina: boolean; robotVerrouille: boolean; bannis: string[] } | undefined;
const sim = (j: Jeu) => j.etat.simulation as Simulation;

export const proxy: Chapitre = {
  id: 'proxy',
  numero: 4,
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
    'nano',
    'sudo',
    'id',
    'whoami',
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
  etat: () => ({ ...etatCaisse(envCaisse(CLE_NOUVELLE)), systemd: systemdCaisse(simuler, simuler) }),
  initialiser: (j) => {
    chargerNginx(j);
    // Ce matin : le robot a fait verrouiller 127.0.0.1, c'est-à-dire tout le monde.
    caisse(j).bannis = ['127.0.0.1'];
  },
  creerMonde: (t) =>
    mondeCooperative({
      sansMarc: true,
      maison: { 'courriel_awa.txt': f(t('proxy-courriel-awa')) },
      etc: nginxCooperative(SITE),
      sbin: NGINX_BINAIRE,
      plus: mondeCaisse({ env: envCaisse(CLE_NOUVELLE), envMode: 'rw-------', accesLog: ACCES, appLog: APP_LOG }),
    }),
  evenements: [
    {
      id: 'tout-le-monde',
      condition: (j) => !!sim(j) && !sim(j)!.lina && sim(j)!.bannis.some((b) => b.startsWith('127.')),
      message: (j) => j.t('proxy-evenement-tout-le-monde'),
    },
    {
      id: 'usurpe',
      condition: (j) => !!sim(j) && sim(j)!.lina && !sim(j)!.robotVerrouille,
      message: (j) => j.t('proxy-evenement-usurpe', { robot: ROBOT }),
    },
    {
      id: 'fin',
      condition: (j) => !!sim(j) && sim(j)!.lina && sim(j)!.robotVerrouille,
      message: (j) => j.t('proxy-evenement-fin', { robot: ROBOT }),
    },
  ],
};
