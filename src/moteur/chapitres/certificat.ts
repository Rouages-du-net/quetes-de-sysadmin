// Histoire « Le Datacenter » — chapitre « Le certificat a expiré » : TLS et
// Let's Encrypt. Trois mois après l'incendie, le certificat HTTPS de la
// médiathèque a expiré ce matin. Le jour de l'incendie, Awa l'avait demandé
// avec certbot avant que le site soit restauré : certbot a noté le dossier
// du site par défaut de Debian (/var/www/html). Depuis un mois, chaque
// tentative de renouvellement automatique échoue (le défi est déposé là où
// nginx ne le sert pas), sans que personne ne le voie.
// Commandes : curl https, openssl x509 / s_client, certbot certificates,
// renew --dry-run, --webroot -w, --deploy-hook, journalctl -u certbot.
// Objectif vérifié sur l'état : nginx présente un certificat valide pour les
// deux noms du site, le prochain renouvellement automatique réussirait, et
// nginx sera rechargé tout seul après (deploy hook, ou module nginx).
// Sources : https://eff-certbot.readthedocs.io/en/stable/using.html,
// https://letsencrypt.org/docs/challenge-types/, https://docs.openssl.org/3.5/man1/openssl-x509/

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu, Shell } from '../shell';
import type { Traduire } from '../../textes';
import { nouveauSystemd, systemd, versUtc, type Systemd } from '../systemd';
import { chargerNginx, verifierNginx } from '../nginx';
import { lire, EMETTEUR, type Certificat } from '../tls';
import { BIENVENUE, MIME, NGINX_CONF, SITE_PAR_DEFAUT } from '../commandes/apt';
import {
  certificatServiBon,
  ecrireRenouvellement,
  fichiersCertificat,
  LE,
  rechargementAutomatique,
  renouvellementPossible,
  serviceCertbot,
} from '../commandes/certbot';

const M = '/home/vous';
const SITE = 'medialibrary.example';
const NOMS = [SITE, `www.${SITE}`];
const ROBOT = '198.51.100.77';

// Le certificat demandé le jour de l'incendie, valable 90 jours.
const ANCIEN: Certificat = {
  cn: SITE,
  noms: NOMS,
  emetteur: EMETTEUR,
  serie: '04a1f3c9e27b58d6103fa9c7e2b4d85f61c0',
  debut: Date.UTC(2026, 9, 23, 6, 40, 0),
  fin: Date.UTC(2027, 0, 21, 6, 39, 59),
};

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    'www-data': { uid: 33, groupe: 'www-data', maison: '/var/www', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    sudo: { gid: 27, membres: ['vous'] },
    'www-data': { gid: 33, membres: [] },
    vous: { gid: 1000, membres: [] },
  },
});

// Le site : en HTTP sur le port 80 (et pour les défis de Let's Encrypt), en HTTPS sur le 443.
const CONF_SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${NOMS.join(' ')};

    root /var/www/mediatheque;
    index index.html;

    include /etc/nginx/bloques.conf;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name ${NOMS.join(' ')};

    ssl_certificate /etc/letsencrypt/live/${SITE}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${SITE}/privkey.pem;

    root /var/www/mediatheque;
    index index.html;

    include /etc/nginx/bloques.conf;
}`;

const bloques = (t: Traduire) => `# ${t('premier-jour-bloques-commentaire')}
deny 203.0.113.5;
deny 192.0.2.99;
deny ${ROBOT};`;

const RENOUVELLEMENT = ecrireRenouvellement({
  entete: {
    version: '4.0.0',
    archive_dir: `${LE}/archive/${SITE}`,
    cert: `${LE}/live/${SITE}/cert.pem`,
    privkey: `${LE}/live/${SITE}/privkey.pem`,
    chain: `${LE}/live/${SITE}/chain.pem`,
    fullchain: `${LE}/live/${SITE}/fullchain.pem`,
  },
  params: {
    account: '6f2a8c41d7e94b0a9c3e15b27d0f8a61',
    authenticator: 'webroot',
    webroot_path: '/var/www/html,',
    server: 'https://acme-v02.api.letsencrypt.org/directory',
    key_type: 'ecdsa',
  },
  carte: { [SITE]: '/var/www/html', [`www.${SITE}`]: '/var/www/html' },
});

// Le journal de certbot : la dernière tentative a échoué, comme toutes depuis un mois.
const JOURNAL_CERTBOT = `2027-01-21 03:24:11,307:DEBUG:certbot._internal.main:certbot version: 4.0.0
2027-01-21 03:24:11,308:DEBUG:certbot._internal.main:Arguments: ['-q', '--no-random-sleep-on-renew']
2027-01-21 03:24:11,512:INFO:certbot._internal.renewal:Renewing an existing certificate for ${NOMS.join(' and ')}
2027-01-21 03:24:13,904:INFO:certbot._internal.auth_handler:Waiting for verification...
2027-01-21 03:24:15,118:INFO:certbot._internal.auth_handler:Challenge failed for domain ${SITE}
2027-01-21 03:24:15,118:INFO:certbot._internal.auth_handler:Challenge failed for domain www.${SITE}
2027-01-21 03:24:15,120:DEBUG:certbot._internal.display.obj:Notifying user: Certbot failed to authenticate some domains (authenticator: webroot). The Certificate Authority reported these problems:
  Domain: ${SITE}
  Type:   unauthorized
  Detail: 192.0.2.11: Invalid response from http://${SITE}/.well-known/acme-challenge/Wk3pZ0aXq7cN2sR8vL1yT6eH4bG9dF5mJ0uK3oP7iQ: 404
2027-01-21 03:24:15,121:ERROR:certbot._internal.renewal:Failed to renew certificate ${SITE} with error: Some challenges have failed.
2027-01-21 03:24:15,122:ERROR:certbot._internal.renewal:All renewals failed. The following certificates could not be renewed:
2027-01-21 03:24:15,122:ERROR:certbot._internal.renewal:  ${LE}/live/${SITE}/fullchain.pem (failure)`;

// Depuis le 22 décembre (30 jours avant l'expiration), le timer lance certbot
// deux fois par jour ; chaque fois, le renouvellement échoue.
function journalDuServeur(): Systemd {
  const sd = nouveauSystemd('datacenter', Date.UTC(2027, 0, 4, 9, 2, 0), Date.UTC(2027, 0, 21, 9, 20, 0), {
    ssh: {
      description: 'OpenBSD Secure Shell server',
      active: true,
      executable: 'sshd',
      processus: [{ pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
    },
    cron: {
      description: 'Regular background program processing daemon',
      active: true,
      executable: 'cron',
      processus: [{ pid: 598, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' }],
    },
    nginx: {
      description: 'A high performance web server and a reverse proxy server',
      active: true,
      executable: 'nginx',
      processus: [
        { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
        { pid: 802, utilisateur: 'www-data', cpu: 0.2, mem: 0.6, commande: 'nginx: worker process' },
      ],
      verifier: verifierNginx,
      charger: chargerNginx,
      verifierAuRechargement: true,
    },
    certbot: {
      description: 'Certbot',
      etat: 'inactive',
      active: false,
      executable: 'certbot',
      ponctuel: true,
      verifier: (j) => serviceCertbot(shell(j)),
    },
  });
  const tentatives = [
    [2026, 11, 22, 4, 2],
    [2026, 11, 22, 16, 37],
    [2027, 0, 19, 15, 48],
    [2027, 0, 20, 3, 51],
    [2027, 0, 20, 15, 12],
    [2027, 0, 21, 3, 24],
  ];
  const ecrire = (temps: number, ident: string, pid: number, message: string, priorite = 6) =>
    sd.journal.push({ temps, demarrage: 1, unite: 'certbot.service', ident, pid, message, priorite });
  tentatives.forEach(([a, mo, j, h, mi], i) => {
    const t = Date.UTC(a, mo, j, h, mi, 0);
    const pid = 41200 + i * 317;
    ecrire(t, 'systemd', 1, 'Starting certbot.service - Certbot...');
    ecrire(t + 4000, 'certbot', pid, `Failed to renew certificate ${SITE} with error: Some challenges have failed.`, 3);
    ecrire(t + 4000, 'certbot', pid, 'All renewals failed. The following certificates could not be renewed:', 3);
    ecrire(t + 4000, 'certbot', pid, `  ${LE}/live/${SITE}/fullchain.pem (failure)`, 3);
    ecrire(t + 4000, 'certbot', pid, '1 renew failure(s), 0 parse failure(s)', 3);
    ecrire(t + 5000, 'systemd', 1, 'certbot.service: Main process exited, code=exited, status=1/FAILURE', 4);
    ecrire(t + 5000, 'systemd', 1, "certbot.service: Failed with result 'exit-code'.", 4);
    ecrire(t + 5000, 'systemd', 1, 'Failed to start certbot.service - Certbot.', 3);
  });
  // Le journal est dans l'ordre du temps (le démarrage du 4 janvier en premier).
  sd.journal.sort((a, b) => a.temps - b.temps);
  sd.services.certbot = { ...sd.services.certbot, etat: 'failed', depuis: Date.UTC(2027, 0, 21, 3, 24, 5) };
  return sd;
}

// Les paquets installés sur la machine reconstruite.
const VERSIONS: Record<string, string> = {
  curl: '8.14.1-2',
  rsync: '3.4.1+ds1-5',
  tar: '1.35+dfsg-3.1',
  'openssh-server': '1:10.0p1-7',
  nginx: '1.26.3-3',
  'nginx-common': '1.26.3-3',
  certbot: '4.0.0-2',
};

const sd = (j: Jeu) => systemd(j)!;
const surDisque = (j: Jeu) => lire(j.lire(`${LE}/live/${SITE}/fullchain.pem`));
// Les événements reçoivent le shell de la machine.
const shell = (j: Jeu) => j as Shell;
const servi = (j: Jeu) => NOMS.every((n) => certificatServiBon(shell(j), n));

export const certificat: Chapitre = {
  id: 'certificat',
  numero: 5,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'echo',
    'tee',
    'id',
    'ps',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'chmod',
    'nano',
    'sudo',
    'apt',
    'nginx',
    'systemctl',
    'journalctl',
    'curl',
    'certbot',
    'openssl',
    'whoami',
  ],
  maison: M,
  accueil: 'courriel_awa.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'bienvenue-2026',
  // La machine reconstruite après l'incendie : même clé d'hôte qu'au chapitre 4.
  cleHote: '-apres-incendie',
  comptes,
  etat: () => ({
    systemd: journalDuServeur(),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 598, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' },
      { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, utilisateur: 'www-data', cpu: 0.2, mem: 0.6, commande: 'nginx: worker process' },
    ],
    apt: { listes: true, installes: { ...VERSIONS } },
    nginx: { charge: null, noms: ['datacenter', 'datacenter.internal', ...NOMS, '192.0.2.11'] },
  }),
  // nginx tourne depuis le démarrage : il a chargé le certificat d'octobre.
  initialiser: (j) => chargerNginx(j),
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, mode?: string) => f(texte, { lignes: true, proprio: 'root', mode });
    const cert = fichiersCertificat(ANCIEN);
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('datacenter'),
        nginx: lieu({
          'nginx.conf': fichier(NGINX_CONF),
          'mime.types': fichier(MIME),
          'bloques.conf': fichier(bloques(t)),
          'conf.d': lieu({}),
          'modules-enabled': lieu({}),
          'sites-available': lieu({ default: fichier(SITE_PAR_DEFAUT), mediatheque: fichier(CONF_SITE) }),
          'sites-enabled': lieu({ mediatheque: fichier(CONF_SITE) }),
        }),
        letsencrypt: lieu({
          live: lieu(
            {
              [SITE]: lieu({
                'cert.pem': fichier(cert['cert.pem']),
                'chain.pem': fichier(cert['chain.pem']),
                'fullchain.pem': fichier(cert['fullchain.pem']),
                'privkey.pem': fichier(cert['privkey.pem'], 'rw-------'),
                README: fichier(t('certificat-lisezmoi-live')),
              }),
            },
            { proprio: 'root', mode: 'rwx------' },
          ),
          renewal: lieu({ [`${SITE}.conf`]: fichier(RENOUVELLEMENT) }),
          'renewal-hooks': lieu({ deploy: lieu({}), pre: lieu({}), post: lieu({}) }),
        }),
      }),
      home: lieu({ vous: d({ 'courriel_awa.txt': f(t('certificat-courriel-awa')), 'message_de_lea.txt': f(t('certificat-message-de-lea')) }) }),
      usr: lieu({
        bin: lieu({
          certbot: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 966 }),
          openssl: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_014_808 }),
        }),
        sbin: lieu({ nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) }),
        lib: lieu({ python3: lieu({ 'dist-packages': lieu({}) }) }),
      }),
      var: lieu({
        www: lieu({
          html: lieu({ 'index.nginx-debian.html': fichier(BIENVENUE) }),
          mediatheque: lieu({ 'index.html': fichier(t('certificat-site-index')) }),
        }),
        log: lieu({
          letsencrypt: lieu({ 'letsencrypt.log': fichier(JOURNAL_CERTBOT) }, { proprio: 'root', mode: 'rwx------' }),
          nginx: lieu(
            { 'access.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }) },
            { proprio: 'root', groupe: 'adm' },
          ),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'expire',
      condition: (j) => j.derniere.erreurs.some((e) => e.includes('certificate has expired')) || j.derniere.sortie.includes('INVALID: EXPIRED'),
      message: (j) => j.t('certificat-evenement-expire'),
    },
    {
      id: 'defi',
      condition: (j) => j.etat.certbotDefiEchoue === true,
      message: (j) => j.t('certificat-evenement-defi'),
    },
    {
      id: 'pas-recharge',
      condition: (j) => {
        const c = surDisque(j);
        return !!c && c.fin > versUtc(sd(j).horloge) && !servi(j);
      },
      message: (j) => j.t('certificat-evenement-pas-recharge'),
    },
    {
      id: 'sans-hook',
      condition: (j) => servi(j) && renouvellementPossible(shell(j)) && !rechargementAutomatique(shell(j)),
      message: (j) => j.t('certificat-evenement-sans-hook'),
    },
    {
      id: 'fin',
      condition: (j) => servi(j) && renouvellementPossible(shell(j)) && rechargementAutomatique(shell(j)),
      message: (j) => j.t('certificat-evenement-fin'),
    },
  ],
};
