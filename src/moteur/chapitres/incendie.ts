// Histoire « Le Datacenter » — chapitre « Le grand incendie » : reconstruire
// un serveur à partir des sauvegardes. Le datacenter de l'hébergeur a brûlé
// cette nuit ; une machine neuve (même nom, même adresse, nouvelle clé
// d'hôte SSH) attend, vide. Les sauvegardes de chaque nuit sont ailleurs,
// montées sur /mnt/sauvegarde, avec le plan de reprise d'Awa. Commandes :
// ssh-keygen -R (sur le poste), apt update/install, tar -tzf / -xzf -C,
// nginx -t, systemctl reload, curl. Pièges : apt install avant apt update,
// la dernière archive coupée par l'incendie, une extraction dans ~, les deux
// sites « default_server » (celui de Debian et celui restauré).
// Objectif vérifié sur l'état : nginx tourne, démarre avec la machine, et
// sert pour mediatheque.example la dernière sauvegarde intacte.
// Sources : https://manpages.debian.org/trixie/apt/apt.8.en.html,
// https://nginx.org/en/docs/switches.html, https://nginx.org/en/docs/http/request_processing.html,
// https://www.gnu.org/software/tar/manual/, https://man.openbsd.org/ssh-keygen

import { chemin, d, f, fichiersComptes, type Chapitre, type Comptes, type Fichier } from '../monde';
import type { Jeu } from '../shell';
import type { Traduire } from '../../textes';
import { nouveauSystemd, systemd } from '../systemd';
import { requete } from '../nginx';

const M = '/home/vous';
const SAUVEGARDES = '/mnt/sauvegarde';
const SITE = 'mediatheque.example';
const ROBOT = '198.51.100.77';
// Les sauvegardes de chaque nuit (0 h 30) ; celle de cette nuit a été coupée
// par l'incendie (0 h 47).
const ARCHIVES = ['2026-10-21', '2026-10-22', '2026-10-23'];
const archive = (jour: string) => `${SAUVEGARDES}/mediatheque-${jour}.tar.gz`;

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

// La configuration du site, telle qu'Awa l'avait écrite (sans commentaire :
// le fichier est le même dans toutes les langues).
const CONF_SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SITE} www.${SITE};

    root /var/www/mediatheque;
    index index.html;

    include /etc/nginx/bloques.conf;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

const bloques = (t: Traduire) => `# ${t('premier-jour-bloques-commentaire')}
deny 203.0.113.5;
deny 192.0.2.99;
deny ${ROBOT};`;

// La page d'accueil dans chaque sauvegarde : 1 (mercredi), 2 (jeudi), 3 (vendredi, perdue).
const accueil = (t: Traduire, version: number) => t(`incendie-site-index-${version}`);

function contenuArchive(t: Traduire, version: number): Record<string, Fichier> {
  const fichier = (texte: string): Fichier => ({ type: 'fichier', contenu: texte, lignes: true, proprio: 'root', groupe: 'root' });
  return {
    'etc/nginx/bloques.conf': fichier(bloques(t)),
    'etc/nginx/sites-available/mediatheque': fichier(CONF_SITE),
    'etc/nginx/sites-enabled/mediatheque': fichier(CONF_SITE),
    'var/www/mediatheque/index.html': fichier(accueil(t, version)),
    'var/www/mediatheque/horaires.html': fichier(t('incendie-site-horaires')),
  };
}

const sauvegarde = (t: Traduire, version: number, taille: number, tronquee?: number) =>
  f('', { proprio: 'root', taille, archive: { fichiers: contenuArchive(t, version), compresse: true, tronquee } });

const sd = (j: Jeu) => systemd(j)!;
const page = (j: Jeu) => requete(j, SITE, '/', 80, false);
const sert = (j: Jeu, version: number) => {
  const r = page(j);
  return r?.code === 200 && r.corps === accueil(j.t, version);
};

export const incendie: Chapitre = {
  id: 'incendie',
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
    'id',
    'ps',
    'du',
    'df',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'nano',
    'sudo',
    'apt',
    'tar',
    'rsync',
    'nginx',
    'systemctl',
    'journalctl',
    'curl',
    'whoami',
  ],
  maison: M,
  accueil: 'courriel_awa.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'bienvenue-2026',
  // Une machine neuve : la clé d'hôte n'est plus celle que le poste connaît.
  cleHote: '-apres-incendie',
  comptes,
  etat: () => {
    const vendredi = Date.UTC(2026, 9, 23, 7, 12, 0);
    return {
      systemd: nouveauSystemd('datacenter', vendredi, Date.UTC(2026, 9, 23, 8, 5, 0), {
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
      }),
      processus: [
        { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
        { pid: 598, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' },
        { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      ],
      // curl joint la machine elle-même sous ces noms (nginx.ts).
      nginx: { charge: null, noms: ['datacenter', 'datacenter.internal', SITE, `www.${SITE}`, '192.0.2.11'] },
    };
  },
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0]) => d(enfants, undefined, racine);
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: f('datacenter', { lignes: true, proprio: 'root' }),
        debian_version: f('13.1', { lignes: true, proprio: 'root' }),
        apt: lieu({
          'sources.list.d': lieu({
            'debian.sources': f(
              'Types: deb\nURIs: http://deb.debian.org/debian\nSuites: trixie trixie-updates\nComponents: main\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\n\nTypes: deb\nURIs: http://security.debian.org/debian-security\nSuites: trixie-security\nComponents: main\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg',
              { lignes: true, proprio: 'root' },
            ),
          }),
        }),
      }),
      home: lieu({ vous: d({ 'courriel_awa.txt': f(t('incendie-courriel-awa')) }) }),
      mnt: lieu({
        sauvegarde: lieu({
          'PRA.txt': f(t('incendie-pra'), { proprio: 'root' }),
          [`mediatheque-${ARCHIVES[0]}.tar.gz`]: sauvegarde(t, 1, 48_213),
          [`mediatheque-${ARCHIVES[1]}.tar.gz`]: sauvegarde(t, 2, 48_390),
          // Coupée après les trois fichiers de configuration.
          [`mediatheque-${ARCHIVES[2]}.tar.gz`]: sauvegarde(t, 3, 20_480, 3),
        }),
      }),
      usr: lieu({ sbin: lieu({}), bin: lieu({}) }),
      var: lieu({ lib: lieu({ apt: lieu({ lists: lieu({}) }) }), log: lieu({}) }),
    });
  },
  evenements: [
    {
      id: 'liste-vide',
      condition: (j) => j.etat.aptIntrouvable === true,
      message: (j) => j.t('incendie-evenement-liste-vide'),
    },
    {
      id: 'nginx',
      condition: (j) => sd(j).services.nginx?.etat === 'active',
      message: (j) => j.t('incendie-evenement-nginx'),
    },
    {
      id: 'tronquee',
      condition: (j) => j.etat.archiveTronquee === chemin(j.t, archive(ARCHIVES[2])),
      message: (j) => j.t('incendie-evenement-tronquee'),
    },
    {
      id: 'mauvais-lieu',
      condition: (j) => j.existe(chemin(j.t, `${M}/etc`)) || j.existe(chemin(j.t, `${M}/var`)),
      message: (j) => j.t('incendie-evenement-mauvais-lieu'),
    },
    {
      id: 'doublon',
      condition: (j) =>
        (j.etat.nginxErreur ?? '').includes('duplicate default server') || sd(j).journal.some((e) => e.message.includes('duplicate default server')),
      message: (j) => j.t('incendie-evenement-doublon'),
    },
    {
      id: 'mercredi',
      condition: (j) => sert(j, 1),
      message: (j) => j.t('incendie-evenement-mercredi'),
    },
    {
      id: 'fin',
      condition: (j) => sert(j, 2) && sd(j).services.nginx?.active === true,
      message: (j) => j.t('incendie-evenement-fin'),
    },
  ],
};
