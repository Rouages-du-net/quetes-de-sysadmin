// Histoire « La Gazette » — chapitre « Bleu et green » : mettre à jour le
// Kiosque (l'appli des abonnements) sans coupure. La 1.4.2 tourne sur
// l'emplacement blue (port 3001), que nginx sert sous /kiosk/. On installe
// la 1.5.0 sur l'emplacement green (port 3002), on vérifie sa santé
// (/health) : il lui manque une variable de configuration, que ses notes de
// version annoncent. Une fois green en bonne santé, nginx bascule vers lui
// (proxy_pass, nginx -t, reload) ; blue reste allumé pour un retour arrière
// instantané.
// Objectif vérifié sur l'état : nginx (configuration chargée) envoie
// /kiosk/ vers une instance en 1.5.0 en bonne santé, et l'autre instance
// tourne toujours.
// Sources : https://martinfowler.com/bliki/BlueGreenDeployment.html,
// https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass,
// https://nginx.org/en/docs/beginners_guide.html#control

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../world';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { chargerNginx, requete, verifierNginx, type Configuration } from '../nginx';
import { MIME, NGINX_CONF } from '../commands/apt';
import { comptesGazette } from './bare-repo';
import { KIOSQUE, PORTS, appliKiosque, dossierVersion, instances, sante, serviceKiosque, uniteKiosque, versionDuLien } from './kiosk';

const M = '/home/vous';
const GAZETTE = 'gazette.example';
const SITE = '/etc/nginx/sites-available/gazette';

const comptes = (): Comptes => {
  const c = comptesGazette();
  c.utilisateurs.kiosk = { uid: 997, groupe: 'kiosk', maison: KIOSQUE, shell: '/usr/sbin/nologin' };
  c.groupes.kiosk = { gid: 997, membres: [] };
  return c;
};

const conf = (t: Jeu['t']) => `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${GAZETTE} www.${GAZETTE};

    root /srv/gazette/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # ${t('bleu-vert-conf-commentaire')}
    location /kiosk/ {
        proxy_pass http://127.0.0.1:3001/;
    }
}`;

const sd = (j: Jeu) => systemd(j)!;
const actif = (j: Jeu, couleur: string) => sd(j).services[`kiosk-${couleur}`]?.etat === 'active';
// La couleur vers laquelle nginx envoie /kiosk/ (configuration chargée).
const servie = (j: Jeu): string | null => {
  const config: Configuration | null = j.etat.nginx?.charge ?? null;
  const proxy = config?.serveurs.flatMap((s) => s.locations).find((l) => l.chemin === '/kiosk/')?.proxy ?? '';
  return Object.keys(PORTS).find((c) => proxy.includes(`:${PORTS[c]}`)) ?? null;
};
const lecteursOk = (j: Jeu) => requete(j, GAZETTE, '/kiosk/', 80, false)?.code === 200;
const sortie = (j: Jeu) => [j.derniere.sortie, ...j.derniere.erreurs].join('\n');

export const bleuVert: Chapitre = {
  id: 'bleu-vert',
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
    'diff',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'ln',
    'readlink',
    'chmod',
    'echo',
    'tee',
    'id',
    'whoami',
    'date',
    'sudo',
    'nano',
    'curl',
    'nginx',
    'systemctl',
    'journalctl',
    'ps',
  ],
  maison: M,
  accueil: 'message_de_samia.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'gazette-2027',
  comptes,
  etat: () => ({
    systemd: nouveauSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 4, 24, 14, 0, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 604, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        processus: [
          { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
          { pid: 802, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
        ],
        verifier: verifierNginx,
        charger: chargerNginx,
        verifierAuRechargement: true,
      },
      'kiosk-blue': serviceKiosque('blue', 1501),
      'kiosk-green': serviceKiosque('green', 1502, 'inactive'),
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 604, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
      { pid: 1501, utilisateur: 'kiosk', cpu: 0.6, mem: 3.1, commande: `node ${KIOSQUE}/blue/serveur.js` },
    ],
    nginx: { charge: null, noms: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'] },
    applis: { '127.0.0.1:3001': appliKiosque('blue'), '127.0.0.1:3002': appliKiosque('green') },
  }),
  initialiser: (j) => {
    chargerNginx(j);
    // blue tourne depuis le démarrage de la machine : sa version et sa configuration d'alors.
    sd(j).services['kiosk-blue'].charger!(j);
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const kiosk: Droits = { proprio: 'kiosk', groupe: 'kiosk' };
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('gazette'),
        kiosk: lieu({
          'kiosk.env': fichier('KIOSK_BASE=postgres://kiosk@localhost/kiosk\nKIOSK_LIST=lettre@gazette.example', {
            proprio: 'root',
            groupe: 'kiosk',
            mode: 'rw-r-----',
          }),
        }),
        nginx: lieu({
          'nginx.conf': fichier(NGINX_CONF),
          'mime.types': fichier(MIME),
          'conf.d': lieu({}),
          'modules-enabled': lieu({}),
          'sites-available': lieu({ gazette: fichier(conf(t)) }),
          'sites-enabled': lieu({ gazette: f('', { proprio: 'root', lien: SITE }) }),
        }),
        systemd: lieu({
          system: lieu({ 'kiosk-blue.service': fichier(uniteKiosque('blue')), 'kiosk-green.service': fichier(uniteKiosque('green')) }),
        }),
      }),
      home: lieu({
        vous: d({ 'message_de_samia.txt': f(t('bleu-vert-message-de-samia')) }),
        samia: lieu({}, { proprio: 'samia', mode: 'rwx------' }),
        theo: lieu({}, { proprio: 'theo', mode: 'rwx------' }),
      }),
      srv: lieu({
        gazette: lieu({
          releases: lieu({ '20270524090000': lieu({ 'index.html': fichier(t('retour-arriere-site-accueil'), { proprio: 'vous' }) }) }),
          current: f('', { proprio: 'vous', lien: '/srv/gazette/releases/20270524090000' }),
        }),
        kiosk: lieu(
          {
            versions: lieu({ '1.4.2': dossierVersion(t, '1.4.2'), '1.5.0': dossierVersion(t, '1.5.0', 'bleu-vert-notes-150') }, kiosk),
            blue: f('', { ...kiosk, lien: `${KIOSQUE}/versions/1.4.2` }),
            green: f('', { ...kiosk, lien: `${KIOSQUE}/versions/1.4.2` }),
          },
          { ...kiosk, groupe: 'redaction', mode: 'rwxrwxr-x' },
        ),
      }),
      usr: lieu({ sbin: lieu({ nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) }) }),
      var: lieu({
        log: lieu({
          nginx: lieu(
            {
              'access.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
              'error.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
            },
            { proprio: 'root', groupe: 'adm' },
          ),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'sante-ko',
      condition: (j) => sortie(j).includes('"status":"error"') && sortie(j).includes('is not set'),
      message: (j) => j.t('bleu-vert-evenement-sante-ko'),
    },
    {
      id: 'pas-redemarre',
      condition: (j) =>
        actif(j, 'green') &&
        !!instances(j).green &&
        versionDuLien(j, 'green') !== instances(j).green.version &&
        sortie(j).includes(`"version":"${instances(j).green.version}"`),
      message: (j) => j.t('bleu-vert-evenement-pas-redemarre'),
    },
    { id: 'trop-tot', condition: (j) => !lecteursOk(j), message: (j) => j.t('bleu-vert-evenement-trop-tot') },
    {
      id: 'pas-recharge',
      condition: (j) => (j.lire(SITE) ?? '').includes('127.0.0.1:3002') && servie(j) === 'blue' && j.derniere.commandes.some((c) => c[0] === 'curl'),
      message: (j) => j.t('bleu-vert-evenement-pas-recharge'),
    },
    { id: 'plus-de-filet', condition: (j) => servie(j) === 'green' && !actif(j, 'blue'), message: (j) => j.t('bleu-vert-evenement-plus-de-filet') },
    {
      id: 'fin',
      condition: (j) => {
        const c = servie(j);
        const autre = c === 'blue' ? 'green' : 'blue';
        const s = c ? sante(j, c) : null;
        return !!c && s?.status === 'ok' && s.version === '1.5.0' && lecteursOk(j) && actif(j, autre);
      },
      message: (j) => j.t('bleu-vert-evenement-fin'),
    },
  ],
};
