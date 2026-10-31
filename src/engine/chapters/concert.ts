// Histoire « Les Lettres du quartier » — chapitre « Le soir du concert » :
// lire les journaux d'accès avec awk, et limiter le débit avec nginx. Ce
// soir, le café annonce un concert ; l'agenda (une appli qui sert 20
// requêtes par seconde) ne répond plus : un robot aspire ses pages depuis
// trois adresses, 24 requêtes par seconde en tout. Les visiteur·ses
// reçoivent des 504.
// Après chaque rechargement de nginx, le jeu fait passer une minute de
// trafic (visiteur·ses : une page et ses quatre fichiers d'un coup, puis une
// autre page ; robot : 8 requêtes par seconde et par adresse) ; le journal
// d'accès la montre.
// Objectif vérifié sur l'état : pendant la dernière minute, toutes les
// requêtes des visiteur·ses ont été servies, et la limitation de débit a
// refusé au moins 60 % des requêtes du robot (429 ou 503).
// Sources : https://nginx.org/en/docs/http/ngx_http_limit_req_module.html,
// https://blog.nginx.org/blog/rate-limiting-nginx, https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../world';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { chargerNginx, requete, verifierNginx, type Appli, type Client } from '../nginx';
import { MIME, NGINX_CONF, SITE_PAR_DEFAUT } from '../commands/apt';

const M = '/home/vous';
const LETTRES = 'letters.example';
const ROBOTS = ['198.51.100.23', '198.51.100.24', '198.51.100.25'];
const HUMAINS = ['203.0.113.41', '203.0.113.57', '192.0.2.77', '203.0.113.83', '192.0.2.140', '203.0.113.201'];
const NAVIGATEUR = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const ASPIRATEUR = 'AgendaScraper/2.1 (+http://scraper.example/bot)';
const FICHIERS = ['/agenda/style.css', '/agenda/app.js', '/agenda/logo.png', '/agenda/plan.png'];

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

// Le site des Lettres à la fin de « La colocation ».
const CONF_LETTRES = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${LETTRES} www.${LETTRES};

    root /var/www/letters;
    index index.html;

    location /agenda/ {
        proxy_pass http://127.0.0.1:3000/;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}`;

interface Bilan {
  humains: number;
  humainsServis: number;
  robot: number;
  robotLimite: number;
  robotInterdit: number;
  depasses: number;
  humainsLimites: number;
}

/**
 * Une minute de trafic à partir de `debut` (heure locale) : chaque requête
 * passe par le nginx simulé, et s'écrit dans access.log.
 */
function minute(j: Jeu, debut: number): Bilan {
  const requetes: { temps: number; adresse: string; chemin: string; humain: boolean }[] = [];
  HUMAINS.forEach((adresse, i) => {
    const t = debut + 5_000 + i * 9_000;
    requetes.push({ temps: t, adresse, chemin: '/agenda/', humain: true });
    FICHIERS.forEach((chemin, k) => requetes.push({ temps: t + 40 + k * 30, adresse, chemin, humain: true }));
    requetes.push({ temps: t + 21_000, adresse, chemin: i % 2 ? '/agenda/ateliers' : '/agenda/semaine', humain: true });
  });
  ROBOTS.forEach((adresse, r) => {
    for (let k = 0; k < 480; k++)
      requetes.push({ temps: debut + r * 41 + k * 125, adresse, chemin: `/agenda/ateliers?page=${((k * 3 + r) % 240) + 1}`, humain: false });
  });
  requetes.sort((a, b) => a.temps - b.temps);
  const bilan: Bilan = { humains: 0, humainsServis: 0, robot: 0, robotLimite: 0, robotInterdit: 0, depasses: 0, humainsLimites: 0 };
  for (const q of requetes) {
    const client: Client = { adresse: q.adresse, temps: q.temps, agent: q.humain ? NAVIGATEUR : ASPIRATEUR };
    const code = requete(j, LETTRES, q.chemin, 80, true, client)?.code ?? 0;
    if (code === 504) bilan.depasses++;
    if (q.humain) {
      bilan.humains++;
      if (code === 200) bilan.humainsServis++;
      if (code === 429 || code === 503) bilan.humainsLimites++;
    } else {
      bilan.robot++;
      if (code === 429 || code === 503) bilan.robotLimite++;
      if (code === 403) bilan.robotInterdit++;
    }
  }
  systemd(j)!.horloge = Math.max(debut + 60_000, requetes.at(-1)!.temps + 1_000);
  return bilan;
}

const bilan = (j: Jeu): Bilan | undefined => j.etat.concertBilan;
const reussi = (b?: Bilan) => !!b && b.humainsServis === b.humains && b.robotLimite >= b.robot * 0.6;

export const concert: Chapitre = {
  id: 'concert',
  numero: 6,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'wc',
    'sort',
    'uniq',
    'cut',
    'awk',
    'echo',
    'tee',
    'cp',
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
  accueil: 'message_de_kofi.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'fourmis-2026',
  comptes,
  etat: (t) => ({
    systemd: nouveauSystemd('lettres', Date.UTC(2027, 2, 1, 6, 12, 0), Date.UTC(2027, 2, 27, 20, 3, 0), {
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
          { pid: 802, utilisateur: 'www-data', cpu: 12.4, mem: 0.9, commande: 'nginx: worker process' },
        ],
        verifier: verifierNginx,
        charger: chargerNginx,
        verifierAuRechargement: true,
      },
      agenda: {
        description: 'Agenda des ateliers (Node.js)',
        active: true,
        executable: 'node',
        processus: [{ pid: 1450, utilisateur: 'agenda', cpu: 99.2, mem: 6.8, commande: 'node /opt/agenda/serveur.js' }],
      },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, utilisateur: 'www-data', cpu: 12.4, mem: 0.9, commande: 'nginx: worker process' },
      { pid: 1450, utilisateur: 'agenda', cpu: 99.2, mem: 6.8, commande: 'node /opt/agenda/serveur.js' },
    ],
    nginx: { charge: null, noms: ['lettres', LETTRES, `www.${LETTRES}`, '203.0.113.10'], journalAcces: true },
    applis: {
      '127.0.0.1:3000': {
        service: 'agenda',
        capacite: 20,
        pages: {
          '/': t('colocation-agenda-accueil'),
          '/semaine': t('colocation-agenda-semaine'),
          '/ateliers': t('colocation-agenda-ateliers'),
          '/style.css': '(CSS)',
          '/app.js': '(JavaScript)',
          '/logo.png': '(PNG)',
          '/plan.png': '(PNG)',
        },
      } satisfies Appli,
    },
  }),
  // Les deux dernières minutes de trafic, avant l'arrivée de la joueuse ou du joueur.
  initialiser: (j) => {
    chargerNginx(j);
    minute(j, Date.UTC(2027, 2, 27, 20, 3, 0));
    j.etat.concertBilan = minute(j, Date.UTC(2027, 2, 27, 20, 4, 0));
    j.etat.concertCharge = j.etat.nginx.charge;
  },
  // Après chaque rechargement réussi de nginx, une minute de trafic passe.
  apresCommande: (j) => {
    if (j.etat.nginx.charge === j.etat.concertCharge || systemd(j)!.services.nginx.etat !== 'active') return;
    j.etat.concertCharge = j.etat.nginx.charge;
    const b = minute(j, Math.ceil(systemd(j)!.horloge / 60_000) * 60_000);
    j.etat.concertBilan = b;
    return j.t('concert-minute', {
      humains: b.humains,
      servis: b.humainsServis,
      robot: b.robot,
      refuses: b.robotLimite + b.robotInterdit,
      depasses: b.depasses,
    });
  },
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
          'sites-available': lieu({ default: fichier(SITE_PAR_DEFAUT), letters: fichier(CONF_LETTRES) }),
          'sites-enabled': lieu({ letters: f('', { proprio: 'root', lien: '/etc/nginx/sites-available/letters' }) }),
        }),
      }),
      home: lieu({ vous: d({ 'message_de_kofi.txt': f(t('concert-message-de-kofi')), 'aide_journaux.txt': f(t('concert-aide-journaux')) }) }),
      usr: lieu({ sbin: lieu({ nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) }) }),
      var: lieu({
        www: lieu({ letters: lieu({ 'index.html': fichier(t('colocation-site-lettres')) }) }),
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
      id: 'robot',
      condition: (j) => j.derniere.commandes.some((c) => ['awk', 'cut', 'uniq'].includes(c[0])) && ROBOTS.some((r) => j.derniere.sortie.includes(r)),
      message: (j) => j.t('concert-evenement-robot'),
    },
    {
      id: 'interdit',
      condition: (j) => (bilan(j)?.robotInterdit ?? 0) > 0,
      message: (j) => j.t('concert-evenement-interdit'),
    },
    {
      id: 'humains-limites',
      condition: (j) => (bilan(j)?.humainsLimites ?? 0) > 0,
      message: (j) => j.t('concert-evenement-humains-limites'),
    },
    {
      id: 'encore-trop',
      condition: (j) => {
        const b = bilan(j);
        return !!b && b.robotLimite > 0 && b.humainsLimites === 0 && !reussi(b);
      },
      message: (j) => j.t('concert-evenement-encore-trop'),
    },
    {
      id: 'fin',
      condition: (j) => reussi(bilan(j)),
      message: (j) => j.t('concert-evenement-fin'),
    },
  ],
};
