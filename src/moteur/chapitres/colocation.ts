// Histoire « Les Lettres du quartier » — chapitre « La colocation » : hôtes
// virtuels et reverse proxy avec nginx. Le café associatif veut son site,
// cafe.example, sur le serveur des Lettres ; et l'agenda des ateliers de
// Rania (un petit programme Node.js qui écoute sur 127.0.0.1:3000) doit
// être publié sous http://lettres.example/agenda/.
// Commandes : cp, nano, ln -s (sites-available → sites-enabled, comme
// Debian), nginx -t, systemctl reload, curl -H "Host: …", proxy_pass,
// /var/log/nginx/error.log, systemctl enable --now.
// Objectif vérifié sur l'état : nginx sert le site du café pour son nom, le
// site des Lettres reste intact, l'agenda répond sous /agenda/ (y compris
// ses sous-pages), et le service agenda démarrera avec la machine.
// Sources : https://nginx.org/en/docs/http/request_processing.html,
// https://nginx.org/en/docs/http/server_names.html,
// https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { chargerNginx, requete, verifierNginx, type Appli } from '../nginx';
import { BIENVENUE, MIME, NGINX_CONF, SITE_PAR_DEFAUT } from '../commandes/apt';

const M = '/home/vous';
const LETTRES = 'lettres.example';
const CAFE = 'cafe.example';

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    'www-data': { uid: 33, groupe: 'www-data', maison: '/var/www', shell: '/usr/sbin/nologin' },
    agenda: { uid: 998, groupe: 'agenda', maison: '/opt/agenda', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    rania: { uid: 1001, groupe: 'rania' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    sudo: { gid: 27, membres: ['vous', 'rania'] },
    'www-data': { gid: 33, membres: [] },
    agenda: { gid: 998, membres: [] },
    vous: { gid: 1000, membres: [] },
    rania: { gid: 1001, membres: [] },
  },
});

// Le site des Lettres, tel que Rania l'a installé (site par défaut du port 80).
const CONF_LETTRES = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${LETTRES} www.${LETTRES};

    root /var/www/lettres;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

const sd = (j: Jeu) => systemd(j)!;
const page = (j: Jeu, hote: string, chemin = '/') => requete(j, hote, chemin, 80, false);
const sert = (j: Jeu, hote: string, chemin: string, texte: string) => {
  const r = page(j, hote, chemin);
  return r?.code === 200 && r.corps === texte;
};
const cafeServi = (j: Jeu) => sert(j, CAFE, '/', j.t('colocation-site-cafe'));
const lettresServi = (j: Jeu) => sert(j, LETTRES, '/', j.t('colocation-site-lettres'));
const agendaServi = (j: Jeu) =>
  sert(j, LETTRES, '/agenda/', j.t('colocation-agenda-accueil')) && sert(j, LETTRES, '/agenda/semaine', j.t('colocation-agenda-semaine'));
const derniereCurl = (j: Jeu) => j.derniere.commandes.some((c) => c[0] === 'curl');

export const colocation: Chapitre = {
  id: 'colocation',
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
    'cp',
    'mv',
    'rm',
    'mkdir',
    'ln',
    'chmod',
    'chown',
    'nano',
    'sudo',
    'nginx',
    'systemctl',
    'journalctl',
    'curl',
    'ps',
    'id',
    'whoami',
  ],
  maison: M,
  accueil: 'courriel_kofi.txt',
  final: 'fin',
  motDePasse: 'fourmis-2026',
  comptes,
  etat: (t) => ({
    systemd: nouveauSystemd('lettres', Date.UTC(2027, 2, 1, 6, 12, 0), Date.UTC(2027, 2, 13, 10, 0, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
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
      // Rania l'a installé, mais ne l'a jamais démarré.
      agenda: {
        description: 'Agenda des ateliers (Node.js)',
        etat: 'inactive',
        active: false,
        executable: 'node',
        processus: [{ pid: 1450, utilisateur: 'agenda', cpu: 0.4, mem: 2.3, commande: 'node /opt/agenda/serveur.js' }],
      },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
    ],
    // Le DNS de cafe.example pointe déjà ici (Kofi s'en est occupé).
    nginx: { charge: null, noms: ['lettres', LETTRES, `www.${LETTRES}`, CAFE, `www.${CAFE}`, '203.0.113.10'] },
    applis: {
      '127.0.0.1:3000': {
        service: 'agenda',
        pages: { '/': t('colocation-agenda-accueil'), '/semaine': t('colocation-agenda-semaine'), '/ateliers': t('colocation-agenda-ateliers') },
      } satisfies Appli,
    },
  }),
  initialiser: (j) => chargerNginx(j),
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('lettres'),
        nginx: lieu({
          'nginx.conf': fichier(NGINX_CONF),
          'mime.types': fichier(MIME),
          'conf.d': lieu({}),
          'modules-enabled': lieu({}),
          'sites-available': lieu({ default: fichier(SITE_PAR_DEFAUT), lettres: fichier(CONF_LETTRES) }),
          // Comme sur Debian : un site activé est un lien vers sites-available.
          'sites-enabled': lieu({ lettres: f('', { proprio: 'root', lien: '/etc/nginx/sites-available/lettres' }) }),
        }),
      }),
      home: lieu({
        vous: d({ 'courriel_kofi.txt': f(t('colocation-courriel-kofi')), 'note_de_rania.txt': f(t('colocation-note-de-rania')) }),
        rania: lieu({}, { proprio: 'rania', mode: 'rwx------' }),
      }),
      opt: lieu({
        agenda: lieu(
          {
            'serveur.js': fichier(t('colocation-agenda-code'), { proprio: 'agenda' }),
            'LISEZMOI.txt': fichier(t('colocation-agenda-lisezmoi'), { proprio: 'agenda' }),
          },
          { proprio: 'agenda' },
        ),
      }),
      usr: lieu({ sbin: lieu({ nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) }) }),
      var: lieu({
        www: lieu({
          html: lieu({ 'index.nginx-debian.html': fichier(BIENVENUE) }),
          lettres: lieu({ 'index.html': fichier(t('colocation-site-lettres')) }),
          // Rania a déjà déposé les pages du café.
          cafe: lieu({ 'index.html': fichier(t('colocation-site-cafe'), { proprio: 'rania' }) }, { proprio: 'rania' }),
        }),
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
      id: 'lien-casse',
      condition: (j) =>
        /open\(\) "\/etc\/nginx\/sites-enabled\/[^"]+" failed/.test(j.etat.nginxErreur ?? '') ||
        sd(j).journal.some((e) => /open\(\) "\/etc\/nginx\/sites-enabled\//.test(e.message)),
      message: (j) => j.t('colocation-evenement-lien-casse'),
    },
    {
      id: 'conflit',
      condition: (j) =>
        j.derniere.sortie.includes('conflicting server name') || j.derniere.erreurs.some((e) => e.includes('conflicting server name')),
      message: (j) => j.t('colocation-evenement-conflit'),
    },
    {
      id: 'mauvais-site',
      condition: (j) => derniereCurl(j) && j.derniere.ligne.includes(CAFE) && j.derniere.sortie === j.t('colocation-site-lettres'),
      message: (j) => j.t('colocation-evenement-mauvais-site'),
    },
    {
      id: 'cafe',
      condition: cafeServi,
      message: (j) => j.t('colocation-evenement-cafe'),
    },
    {
      id: 'passerelle',
      condition: (j) => derniereCurl(j) && j.derniere.sortie.includes('502 Bad Gateway'),
      message: (j) => j.t('colocation-evenement-passerelle'),
    },
    {
      id: 'cannot-get',
      condition: (j) => derniereCurl(j) && j.derniere.sortie.includes('Cannot GET /agenda'),
      message: (j) => j.t('colocation-evenement-cannot-get'),
    },
    {
      id: 'agenda-sans-enable',
      condition: (j) => agendaServi(j) && !sd(j).services.agenda.active,
      message: (j) => j.t('colocation-evenement-agenda-sans-enable'),
    },
    {
      id: 'fin',
      condition: (j) => cafeServi(j) && lettresServi(j) && agendaServi(j) && sd(j).services.agenda.active,
      message: (j) => j.t('colocation-evenement-fin'),
    },
  ],
};
