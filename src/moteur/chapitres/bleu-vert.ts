// Histoire « La Gazette » — chapitre « Bleu et vert » : mettre à jour le
// Kiosque (l'appli des abonnements) sans coupure. La 1.4.2 tourne sur
// l'emplacement bleu (port 3001), que nginx sert sous /kiosque/. On installe
// la 1.5.0 sur l'emplacement vert (port 3002), on vérifie sa santé
// (/health) : il lui manque une variable de configuration, que ses notes de
// version annoncent. Une fois vert en bonne santé, nginx bascule vers lui
// (proxy_pass, nginx -t, reload) ; bleu reste allumé pour un retour arrière
// instantané.
// Objectif vérifié sur l'état : nginx (configuration chargée) envoie
// /kiosque/ vers une instance en 1.5.0 en bonne santé, et l'autre instance
// tourne toujours.
// Sources : https://martinfowler.com/bliki/BlueGreenDeployment.html,
// https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass,
// https://nginx.org/en/docs/beginners_guide.html#control

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { chargerNginx, requete, verifierNginx, type Configuration } from '../nginx';
import { MIME, NGINX_CONF } from '../commandes/apt';
import { comptesGazette } from './depot-nu';
import { KIOSQUE, PORTS, appliKiosque, dossierVersion, instances, sante, serviceKiosque, uniteKiosque, versionDuLien } from './kiosque';

const M = '/home/vous';
const GAZETTE = 'gazette.example';
const SITE = '/etc/nginx/sites-available/gazette';

const comptes = (): Comptes => {
  const c = comptesGazette();
  c.utilisateurs.kiosque = { uid: 997, groupe: 'kiosque', maison: KIOSQUE, shell: '/usr/sbin/nologin' };
  c.groupes.kiosque = { gid: 997, membres: [] };
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
    location /kiosque/ {
        proxy_pass http://127.0.0.1:3001/;
    }
}`;

const sd = (j: Jeu) => systemd(j)!;
const actif = (j: Jeu, couleur: string) => sd(j).services[`kiosque-${couleur}`]?.etat === 'active';
// La couleur vers laquelle nginx envoie /kiosque/ (configuration chargée).
const servie = (j: Jeu): string | null => {
  const config: Configuration | null = j.etat.nginx?.charge ?? null;
  const proxy = config?.serveurs.flatMap((s) => s.locations).find((l) => l.chemin === '/kiosque/')?.proxy ?? '';
  return Object.keys(PORTS).find((c) => proxy.includes(`:${PORTS[c]}`)) ?? null;
};
const lecteursOk = (j: Jeu) => requete(j, GAZETTE, '/kiosque/', 80, false)?.code === 200;
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
      'kiosque-bleu': serviceKiosque('bleu', 1501),
      'kiosque-vert': serviceKiosque('vert', 1502, 'inactive'),
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 604, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
      { pid: 1501, utilisateur: 'kiosque', cpu: 0.6, mem: 3.1, commande: `node ${KIOSQUE}/bleu/serveur.js` },
    ],
    nginx: { charge: null, noms: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'] },
    applis: { '127.0.0.1:3001': appliKiosque('bleu'), '127.0.0.1:3002': appliKiosque('vert') },
  }),
  initialiser: (j) => {
    chargerNginx(j);
    // bleu tourne depuis le démarrage de la machine : sa version et sa configuration d'alors.
    sd(j).services['kiosque-bleu'].charger!(j);
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const kiosque: Droits = { proprio: 'kiosque', groupe: 'kiosque' };
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('gazette'),
        kiosque: lieu({
          'kiosque.env': fichier('KIOSQUE_BASE=postgres://kiosque@localhost/kiosque\nKIOSQUE_LISTE=lettre@gazette.example', {
            proprio: 'root',
            groupe: 'kiosque',
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
          system: lieu({ 'kiosque-bleu.service': fichier(uniteKiosque('bleu')), 'kiosque-vert.service': fichier(uniteKiosque('vert')) }),
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
        kiosque: lieu(
          {
            versions: lieu({ '1.4.2': dossierVersion(t, '1.4.2'), '1.5.0': dossierVersion(t, '1.5.0', 'bleu-vert-notes-150') }, kiosque),
            bleu: f('', { ...kiosque, lien: `${KIOSQUE}/versions/1.4.2` }),
            vert: f('', { ...kiosque, lien: `${KIOSQUE}/versions/1.4.2` }),
          },
          { ...kiosque, groupe: 'redaction', mode: 'rwxrwxr-x' },
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
        actif(j, 'vert') &&
        !!instances(j).vert &&
        versionDuLien(j, 'vert') !== instances(j).vert.version &&
        sortie(j).includes(`"version":"${instances(j).vert.version}"`),
      message: (j) => j.t('bleu-vert-evenement-pas-redemarre'),
    },
    { id: 'trop-tot', condition: (j) => !lecteursOk(j), message: (j) => j.t('bleu-vert-evenement-trop-tot') },
    {
      id: 'pas-recharge',
      condition: (j) => (j.lire(SITE) ?? '').includes('127.0.0.1:3002') && servie(j) === 'bleu' && j.derniere.commandes.some((c) => c[0] === 'curl'),
      message: (j) => j.t('bleu-vert-evenement-pas-recharge'),
    },
    { id: 'plus-de-filet', condition: (j) => servie(j) === 'vert' && !actif(j, 'bleu'), message: (j) => j.t('bleu-vert-evenement-plus-de-filet') },
    {
      id: 'fin',
      condition: (j) => {
        const c = servie(j);
        const autre = c === 'bleu' ? 'vert' : 'bleu';
        const s = c ? sante(j, c) : null;
        return !!c && s?.status === 'ok' && s.version === '1.5.0' && lecteursOk(j) && actif(j, autre);
      },
      message: (j) => j.t('bleu-vert-evenement-fin'),
    },
  ],
};
