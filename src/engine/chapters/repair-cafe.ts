// Histoire « Les Lettres du quartier » — chapitre « L'atelier de réparation » :
// Apache, pour comparer avec nginx. Le site de l'atelier de réparation quitte
// son ancien hébergeur ; il tournait sous Apache, avec un .htaccess qui
// réécrit les adresses courtes des fiches (/guide/42, imprimées sur les
// affiches). Rania a installé apache2 sur le serveur des Lettres, mais il ne
// démarre pas : nginx tient déjà le port 80. On le met derrière nginx, sur
// 127.0.0.1:8080, comme l'agenda.
// Commandes : systemctl status, journalctl -u apache2, ss -tlnp, ports.conf
// (Listen), <VirtualHost>, a2ensite (un lien fait à la main sans .conf est
// ignoré), apache2ctl configtest et -S, AllowOverride, a2enmod rewrite,
// le journal d'erreurs du site, nginx devant (ln -s, proxy_pass, Host).
// Objectif vérifié sur l'état : Apache tourne et démarrera avec la machine,
// n'écoute que sur la boucle locale ; par nginx, repair.example sert
// l'accueil de l'atelier et /guide/42 la fiche 42 ; letters.example reste
// intact.
// Sources : https://httpd.apache.org/docs/2.4/bind.html,
// https://httpd.apache.org/docs/2.4/vhosts/name-based.html,
// https://httpd.apache.org/docs/2.4/howto/htaccess.html,
// https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html,
// https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../world';
import type { Jeu } from '../shell';
import { demarrer, nouveauSystemd, systemd } from '../systemd';
import { chargerNginx, requete, verifierNginx, type Reponse } from '../nginx';
import { arreterApache, chargerApache, demander, ecoutesApache, PID, seulementLocal, verifierApache } from '../apache';
import { BIENVENUE_APACHE, etcApache2, modulesApache2 } from '../apache-debian';
import { BIENVENUE, MIME, NGINX_CONF, SITE_PAR_DEFAUT } from '../commands/apt';
import type { PareFeu } from '../firewall';
import type { Ecoute } from '../commands/ss';

const M = '/home/vous';
const LETTRES = 'letters.example';
const CAFE = 'cafe.example';
const ATELIER = 'repair.example';

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    'www-data': { uid: 33, groupe: 'www-data', maison: '/var/www', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    rania: { uid: 1001, groupe: 'rania' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    sudo: { gid: 27, membres: ['vous', 'rania'] },
    'www-data': { gid: 33, membres: [] },
    vous: { gid: 1000, membres: [] },
    rania: { gid: 1001, membres: [] },
  },
});

const site = (nom: string, racine: string, defaut = false) => `server {
    listen 80${defaut ? ' default_server' : ''};
    listen [::]:80${defaut ? ' default_server' : ''};
    server_name ${nom} www.${nom};

    root ${racine};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

// Le site nginx de l'atelier, préparé par Rania : nginx passe tout à Apache.
const NGINX_ATELIER = `server {
    listen 80;
    listen [::]:80;
    server_name ${ATELIER} www.${ATELIER};

    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}`;

// Le site Apache de l'atelier, recopié de l'ancien hébergeur (où Apache écoutait sur le port 80).
export const APACHE_ATELIER = `<VirtualHost *:80>
    ServerName ${ATELIER}
    ServerAlias www.${ATELIER}
    ServerAdmin webmaster@${ATELIER}
    DocumentRoot /var/www/repair

    ErrorLog \${APACHE_LOG_DIR}/repair-error.log
    CustomLog \${APACHE_LOG_DIR}/repair-access.log combined
</VirtualHost>`;

// Les règles de l'ancien hébergeur : /guide/42 sert guides/42.html (le commentaire vient des textes).
const HTACCESS = `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^guide/([0-9]+)/?$ guides/$1.html [L]`;

// Les machines du chapitre : SSH sur 2222 (« Le port »), nginx sur 80 et 443.
const ECOUTE: Ecoute[] = [
  { proto: 'tcp', adresse: '0.0.0.0', port: 2222, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '[::]', port: 2222, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 80, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '[::]', port: 80, processus: 'nginx', pid: 701 },
];

const PROCESSUS_APACHE = [
  { pid: PID, utilisateur: 'root', cpu: 0, mem: 0.4, commande: '/usr/sbin/apache2 -k start' },
  { pid: PID + 1, utilisateur: 'www-data', cpu: 0, mem: 0.3, commande: '/usr/sbin/apache2 -k start' },
  { pid: PID + 2, utilisateur: 'www-data', cpu: 0, mem: 0.3, commande: '/usr/sbin/apache2 -k start' },
];

// Hier, apt install apache2 : le paquet a voulu démarrer Apache, qui n'a pas pu (le port 80 est à nginx).
const INSTALLATION = Date.UTC(2026, 10, 19, 18, 42, 0);
const MAINTENANT = Date.UTC(2026, 10, 20, 9, 30, 0);

const sd = (j: Jeu) => systemd(j)!;
const sert = (r: Reponse | { code: number; corps: string } | null, texte: string) => r?.code === 200 && r.corps === texte;
const accueil = (j: Jeu) => j.t('atelier-site-accueil');
const fiche = (j: Jeu) => j.t('atelier-fiche-42');
// Par nginx (sans trace dans les journaux), comme un visiteur.
const parNginx = (j: Jeu, chemin: string) => requete(j, ATELIER, chemin, 80, false);
// Apache lui-même, sur l'un de ses ports.
const parApache = (j: Jeu, chemin: string, texte: string) => ecoutesApache(j).some((e) => sert(demander(j, e.port, chemin, ATELIER), texte));
const apacheTourne = (j: Jeu) => sd(j).services.apache2.etat === 'active';
const siteServi = (j: Jeu) => sert(parNginx(j, '/'), accueil(j));
const ficheServie = (j: Jeu) => sert(parNginx(j, '/guide/42'), fiche(j));
const lettresServi = (j: Jeu) => sert(requete(j, LETTRES, '/', 80, false), j.t('colocation-site-lettres'));
const curl = (j: Jeu) => j.derniere.commandes.some((c) => c[0] === 'curl');
const vu = (j: Jeu, texte: string) => j.derniere.sortie.includes(texte) || j.derniere.erreurs.some((e) => e.includes(texte));

export const atelier: Chapitre = {
  id: 'atelier',
  numero: 9,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'ln',
    'readlink',
    'chmod',
    'chown',
    'nano',
    'sudo',
    'nginx',
    'systemctl',
    'journalctl',
    'curl',
    'ss',
    'ps',
    'id',
    'whoami',
    'apache2ctl',
    'apachectl',
    'a2ensite',
    'a2dissite',
    'a2enmod',
    'a2dismod',
    'a2enconf',
    'a2disconf',
  ],
  maison: M,
  accueil: 'courriel_kofi.txt',
  noms: true,
  final: 'fin',
  etapes: ['occupe', 'ecoute', 'site', 'proxy', 'reecriture', 'fin'],
  motDePasse: 'fourmis-2026',
  comptes,
  etat: () => ({
    // SSH écoute sur 2222 depuis « Le port ».
    sshd: { charge: { port: '2222' }, recharges: 0 },
    ecoute: ECOUTE.map((e) => ({ ...e })),
    ufw: {
      actif: true,
      entrant: 'deny',
      sortant: 'allow',
      regles: [
        { action: 'allow', vers: '2222/tcp', ports: [2222], de: null },
        { action: 'allow', vers: 'Nginx Full', ports: [80, 443], de: null },
      ],
    } satisfies PareFeu,
    systemd: nouveauSystemd('lettres', Date.UTC(2026, 10, 2, 7, 14, 0), INSTALLATION, {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        processus: [
          { pid: 701, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
          { pid: 702, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
        ],
        verifier: verifierNginx,
        charger: chargerNginx,
        verifierAuRechargement: true,
      },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
      // Installé hier : activé par le paquet, mais en échec.
      apache2: {
        description: 'The Apache HTTP Server',
        etat: 'inactive',
        active: true,
        executable: 'apache2',
        processus: PROCESSUS_APACHE,
        verifier: verifierApache,
        charger: chargerApache,
        arret: arreterApache,
        verifierAuRechargement: true,
      },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 701, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 702, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
    ],
    // Le DNS de repair.example pointe déjà ici (Kofi s'en est occupé).
    nginx: { charge: null, noms: ['lettres', LETTRES, `www.${LETTRES}`, CAFE, `www.${CAFE}`, ATELIER, `www.${ATELIER}`, '203.0.113.10'] },
    applis: {},
    apache: { charge: null },
  }),
  initialiser: (j) => {
    chargerNginx(j);
    // Le paquet a essayé de démarrer Apache à l'installation : le journal en garde la trace.
    const s = sd(j);
    demarrer(j, s, 'apache2', true);
    s.horloge = MAINTENANT;
  },
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const journal = (texte = '') => f(texte, { lignes: true, proprio: 'root', groupe: 'adm', mode: 'rw-r-----' });
    const binaire = (taille: number) => f('', { proprio: 'root', mode: 'rwxr-xr-x', taille });
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('lettres'),
        nginx: lieu({
          'nginx.conf': fichier(NGINX_CONF),
          'mime.types': fichier(MIME),
          'conf.d': lieu({}),
          'modules-enabled': lieu({}),
          'sites-available': lieu({
            default: fichier(SITE_PAR_DEFAUT),
            letters: fichier(site(LETTRES, '/var/www/letters', true)),
            cafe: fichier(site(CAFE, '/var/www/cafe')),
            repair: fichier(NGINX_ATELIER, { proprio: 'root' }),
          }),
          'sites-enabled': lieu({
            letters: f('', { proprio: 'root', lien: '/etc/nginx/sites-available/letters' }),
            cafe: f('', { proprio: 'root', lien: '/etc/nginx/sites-available/cafe' }),
          }),
        }),
        // Rania a « activé » le site comme pour nginx : un lien, mais sans .conf.
        apache2: etcApache2(
          { 'repair.conf': APACHE_ATELIER },
          { '000-default.conf': '../sites-available/000-default.conf', repair: '/etc/apache2/sites-available/repair.conf' },
        ),
      }),
      home: lieu({
        vous: d({ 'courriel_kofi.txt': f(t('atelier-courriel-kofi')), 'note_de_rania.txt': f(t('atelier-note-de-rania')) }),
        rania: lieu({}, { proprio: 'rania', mode: 'rwx------' }),
      }),
      usr: lieu({
        sbin: lieu({
          nginx: binaire(1_342_520),
          apache2: binaire(734_216),
          apache2ctl: binaire(7_442),
          apachectl: f('', { proprio: 'root', lien: 'apache2ctl' }),
          a2ensite: binaire(15_862),
          a2dissite: f('', { proprio: 'root', lien: 'a2ensite' }),
          a2enmod: f('', { proprio: 'root', lien: 'a2ensite' }),
          a2dismod: f('', { proprio: 'root', lien: 'a2ensite' }),
          a2enconf: f('', { proprio: 'root', lien: 'a2ensite' }),
          a2disconf: f('', { proprio: 'root', lien: 'a2ensite' }),
        }),
        lib: lieu({ apache2: modulesApache2() }),
      }),
      var: lieu({
        www: lieu({
          html: lieu({ 'index.html': fichier(BIENVENUE_APACHE), 'index.nginx-debian.html': fichier(BIENVENUE) }),
          letters: lieu({ 'index.html': fichier(t('colocation-site-lettres')) }),
          cafe: lieu({ 'index.html': fichier(t('colocation-site-cafe')) }),
          // Le site de l'atelier, tel qu'il était chez l'ancien hébergeur.
          repair: lieu(
            {
              'index.html': fichier(t('atelier-site-accueil'), { proprio: 'rania' }),
              '.htaccess': fichier(`${t('atelier-htaccess-commentaire')}\n${HTACCESS}`, { proprio: 'rania' }),
              guides: lieu(
                {
                  '7.html': fichier(t('atelier-fiche-7'), { proprio: 'rania' }),
                  '42.html': fichier(t('atelier-fiche-42'), { proprio: 'rania' }),
                },
                { proprio: 'rania' },
              ),
            },
            { proprio: 'rania' },
          ),
        }),
        log: lieu({
          nginx: lieu(
            {
              'access.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
              'error.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
            },
            { proprio: 'root', groupe: 'adm' },
          ),
          apache2: lieu(
            {
              'access.log': journal(),
              'error.log': journal(),
              'other_vhosts_access.log': journal(),
              'repair-access.log': journal(),
              'repair-error.log': journal(),
            },
            { proprio: 'root', groupe: 'adm', mode: 'rwxr-x---' },
          ),
        }),
      }),
    });
  },
  evenements: [
    { id: 'occupe', condition: (j) => vu(j, 'Address already in use'), message: (j) => j.t('atelier-evenement-occupe') },
    { id: 'ah00558', condition: (j) => vu(j, 'AH00558'), message: (j) => j.t('atelier-evenement-ah00558') },
    { id: 'ecoute', condition: (j) => apacheTourne(j), message: (j) => j.t('atelier-evenement-ecoute') },
    { id: 'partout', condition: (j) => apacheTourne(j) && !seulementLocal(j), message: (j) => j.t('atelier-evenement-partout') },
    { id: 'defaut', condition: (j) => curl(j) && j.derniere.sortie.includes('Apache2 Debian Default Page'), message: (j) => j.t('atelier-evenement-defaut') },
    { id: 'site', condition: (j) => parApache(j, '/', accueil(j)), message: (j) => j.t('atelier-evenement-site') },
    { id: 'passerelle', condition: (j) => curl(j) && j.derniere.sortie.includes('502 Bad Gateway'), message: (j) => j.t('atelier-evenement-passerelle') },
    { id: 'proxy', condition: siteServi, message: (j) => j.t('atelier-evenement-proxy') },
    {
      id: 'ignore',
      condition: (j) => curl(j) && j.derniere.ligne.includes('guide') && j.derniere.sortie.includes('The requested URL was not found on this server'),
      message: (j) => j.t('atelier-evenement-ignore'),
    },
    {
      id: 'interne',
      condition: (j) => curl(j) && j.derniere.sortie.includes('misconfiguration and was unable'),
      message: (j) => j.t('atelier-evenement-interne'),
    },
    { id: 'reecriture', condition: (j) => parApache(j, '/guide/42', fiche(j)) || ficheServie(j), message: (j) => j.t('atelier-evenement-reecriture') },
    {
      id: 'fin',
      condition: (j) => apacheTourne(j) && sd(j).services.apache2.active && seulementLocal(j) && siteServi(j) && ficheServie(j) && lettresServi(j),
      message: (j) => j.t('atelier-evenement-fin'),
    },
  ],
};
