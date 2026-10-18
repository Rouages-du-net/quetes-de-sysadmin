// apt : installer des paquets Debian, d'après apt(8) et la sortie d'apt 3.0
// (Debian 13 « trixie ») : https://manpages.debian.org/trixie/apt/apt.8.en.html
// Comme sur un serveur tout neuf, la liste des paquets est vide tant qu'on
// n'a pas lancé `apt update` (« Unable to locate package »). Installer un
// service le démarre et l'active aussitôt, comme le font les paquets Debian.
// L'état est dans etat.apt :
//   { listes: liste téléchargée ?, installes: { paquet: version } }
// Écarts : un petit catalogue, des versions et des tailles indicatives ;
// seulement update, install, list --installed ; aucun vrai téléchargement.

import { d, f, type Dossier } from '../monde';
import type { Shell } from '../shell';
import { demarrer, journaliser, systemd } from '../systemd';
import { chargerNginx, CONF, fichiersLus, heureNginx, tester, VERSION, verifierNginx } from '../nginx';
import type { Commande } from './index';

interface Paquet {
  version: string;
  architecture: 'amd64' | 'all';
  // Taille à télécharger et place prise une fois installé (ko).
  telecharger: number;
  installe: number;
  dependances?: string[];
  suggestions?: string[];
  // Les fichiers et le service que pose le paquet.
  poser?: (jeu: Shell) => void;
}

// Les pages et la configuration de nginx sur Debian (en anglais, comme les vraies).
const NGINX_CONF = `user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    access_log /var/log/nginx/access.log;

    gzip on;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}`;

const MIME = `types {
    text/html                             html htm shtml;
    text/css                              css;
    text/plain                            txt;
    image/png                             png;
    image/jpeg                            jpeg jpg;
    application/javascript                js;
}`;

export const SITE_PAR_DEFAUT = `# Default server configuration
#
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;

    # Add index.php to the list if you are using PHP
    index index.html index.htm index.nginx-debian.html;

    server_name _;

    location / {
        # First attempt to serve request as file, then
        # as directory, then fall back to displaying a 404.
        try_files $uri $uri/ =404;
    }
}`;

export const BIENVENUE = `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>
<p><em>Thank you for using nginx.</em></p>
</body>
</html>`;

const NGINX_DESCRIPTION = 'A high performance web server and a reverse proxy server';
const racine = { proprio: 'root' };

// Pose des fichiers sans écraser ceux qui sont déjà là (les fichiers de
// configuration restaurés restent, comme les « conffiles » de dpkg).
function poser(jeu: Shell, chemin: string, arbre: Dossier) {
  const ici = jeu.trouver(chemin);
  if (!ici) return void jeu.placer('apt', chemin, arbre);
  if (ici.type !== 'dossier') return;
  for (const [nom, enfant] of Object.entries(arbre.enfants)) {
    if (enfant.type === 'dossier') poser(jeu, `${chemin}/${nom}`, enfant);
    else if (!ici.enfants[nom]) ici.enfants[nom] = enfant;
  }
}

const PAQUETS: Record<string, Paquet> = {
  'nginx-common': {
    version: `${VERSION}-3`,
    architecture: 'all',
    telecharger: 113,
    installe: 486,
    poser: (jeu) => {
      const fichier = (texte: string) => f(texte, { lignes: true, proprio: 'root' });
      poser(
        jeu,
        '/etc/nginx',
        d(
          {
            'nginx.conf': fichier(NGINX_CONF),
            'mime.types': fichier(MIME),
            'conf.d': d({}, undefined, racine),
            'modules-enabled': d({}, undefined, racine),
            'sites-available': d({ default: fichier(SITE_PAR_DEFAUT) }, undefined, racine),
            // Sur Debian, sites-enabled/default est un lien vers sites-available/default.
            'sites-enabled': d({ default: fichier(SITE_PAR_DEFAUT) }, undefined, racine),
          },
          undefined,
          racine,
        ),
      );
      poser(
        jeu,
        '/var/www',
        d({ html: d({ 'index.nginx-debian.html': f(BIENVENUE, { lignes: true, proprio: 'root' }) }, undefined, racine) }, undefined, racine),
      );
      poser(
        jeu,
        '/var/log/nginx',
        d({ 'access.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }) }, undefined, {
          proprio: 'root',
          groupe: 'adm',
        }),
      );
    },
  },
  nginx: {
    version: `${VERSION}-3`,
    architecture: 'amd64',
    telecharger: 527,
    installe: 1210,
    dependances: ['nginx-common'],
    suggestions: ['fcgiwrap', 'nginx-doc', 'ssl-cert'],
    poser: (jeu) => {
      poser(jeu, '/usr/sbin', d({ nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) }, undefined, racine));
      const sd = systemd(jeu)!;
      sd.services.nginx ??= {
        description: NGINX_DESCRIPTION,
        etat: 'inactive',
        active: false,
        executable: 'nginx',
        depuis: sd.horloge,
        processus: [
          { pid: 2411, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
          { pid: 2412, utilisateur: 'www-data', cpu: 0, mem: 0.4, commande: 'nginx: worker process' },
        ],
        verifier: verifierNginx,
        charger: chargerNginx,
        verifierAuRechargement: true,
      };
    },
  },
  curl: { version: '8.14.1-2', architecture: 'amd64', telecharger: 269, installe: 497 },
  rsync: { version: '3.4.1+ds1-5', architecture: 'amd64', telecharger: 445, installe: 806 },
  tar: { version: '1.35+dfsg-3.1', architecture: 'amd64', telecharger: 846, installe: 3234 },
  'openssh-server': { version: '1:10.0p1-7', architecture: 'amd64', telecharger: 610, installe: 2132 },
};

// Les paquets déjà là sur l'image Debian de l'hébergeur.
export const INSTALLES_DE_BASE = ['curl', 'rsync', 'tar', 'openssh-server'];

const SOURCES = [
  'http://deb.debian.org/debian trixie InRelease [140 kB]',
  'http://deb.debian.org/debian trixie-updates InRelease [47.3 kB]',
  'http://security.debian.org/debian-security trixie-security InRelease [43.4 kB]',
  'http://deb.debian.org/debian trixie/main amd64 Packages [9,669 kB]',
  'http://deb.debian.org/debian trixie/main Translation-en [6,486 kB]',
  'http://security.debian.org/debian-security trixie-security/main amd64 Packages [64.2 kB]',
];

const ko = (n: number) => `${n.toLocaleString('en-US')} kB`;
const LECTURE = ['Reading package lists... Done', 'Building dependency tree... Done', 'Reading state information... Done'];

interface EtatApt {
  listes: boolean;
  installes: Record<string, string>;
}

const etat = (jeu: Shell): EtatApt =>
  (jeu.etat.apt ??= { listes: false, installes: Object.fromEntries(INSTALLES_DE_BASE.map((p) => [p, PAQUETS[p].version])) });

// Seul root peut toucher à la base des paquets : apt s'arrête au verrou.
const verrou = (jeu: Shell, fichier: string, quoi: string) =>
  jeu.erreur(`Error: Could not open lock file ${fichier} - open (13: Permission denied)\nError: ${quoi}`);

function installer(jeu: Shell, noms: string[], oui: boolean): string {
  const e = etat(jeu);
  const inconnus = noms.filter((n) => !e.listes || !PAQUETS[n]);
  if (inconnus.length) {
    jeu.etat.aptIntrouvable = true;
    return jeu.erreur([...LECTURE, ...inconnus.map((n) => `Error: Unable to locate package ${n}`)].join('\n'));
  }
  const deja = noms.filter((n) => e.installes[n]);
  const demandes = noms.filter((n) => !e.installes[n]);
  const dependances = [...new Set(demandes.flatMap((n) => PAQUETS[n].dependances ?? []))].filter((n) => !e.installes[n] && !demandes.includes(n));
  const tous = [...dependances, ...demandes];
  const sortie = [...LECTURE, ...deja.map((n) => `${n} is already the newest version (${e.installes[n]}).`)];
  if (!tous.length) {
    sortie.push('Summary:', '  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0');
    return sortie.join('\n');
  }
  const suggestions = [...new Set(demandes.flatMap((n) => PAQUETS[n].suggestions ?? []))];
  const telecharger = tous.reduce((t, n) => t + PAQUETS[n].telecharger, 0);
  const place = tous.reduce((t, n) => t + PAQUETS[n].installe, 0);
  sortie.push(
    'Installing:',
    `  ${demandes.join('  ')}`,
    '',
    ...(dependances.length ? ['Installing dependencies:', `  ${dependances.join('  ')}`, ''] : []),
    ...(suggestions.length ? ['Suggested packages:', `  ${suggestions.join('  ')}`, ''] : []),
    'Summary:',
    `  Upgrading: 0, Installing: ${tous.length}, Removing: 0, Not Upgrading: 0`,
    `  Download size: ${ko(telecharger)}`,
    `  Space needed: ${ko(place)} / 18.2 GB available`,
  );
  const suite = () => {
    const lignes: string[] = [];
    tous.forEach((n, i) => {
      const p = PAQUETS[n];
      lignes.push(
        `Get:${i + 1} http://deb.debian.org/debian trixie/main ${p.architecture} ${n} ${p.architecture} ${p.version} [${ko(p.telecharger)}]`,
      );
    });
    lignes.push(`Fetched ${ko(telecharger)} in 0s (${ko(telecharger * 4)}/s)`);
    tous.forEach((n, i) => {
      const p = PAQUETS[n];
      lignes.push(`Selecting previously unselected package ${n}.`);
      if (i === 0) lignes.push('(Reading database ... 28412 files and directories currently installed.)');
      lignes.push(`Preparing to unpack .../${n}_${p.version.replace(/^\d+:/, '')}_${p.architecture}.deb ...`, `Unpacking ${n} (${p.version}) ...`);
    });
    const echecs: string[] = [];
    for (const n of tous) {
      const p = PAQUETS[n];
      lignes.push(`Setting up ${n} (${p.version}) ...`);
      p.poser?.(jeu);
      e.installes[n] = p.version;
      // Le paquet d'un service l'active et le démarre (deb-systemd-helper, invoke-rc.d).
      const sd = systemd(jeu);
      const service = sd?.services[n];
      if (sd && service) {
        if (!service.active)
          lignes.push(`Created symlink '/etc/systemd/system/multi-user.target.wants/${n}.service' → '/usr/lib/systemd/system/${n}.service'.`);
        service.active = true;
        journaliser(sd, '', 'systemd', 1, 'Reloading finished in 187 ms.');
        if (service.etat !== 'active' && !demarrer(jeu, sd, n, true)) {
          lignes.push(
            `Job for ${n}.service failed because the control process exited with error code.`,
            `See "systemctl status ${n}.service" and "journalctl -xeu ${n}.service" for details.`,
            `invoke-rc.d: initscript ${n}, action "start" failed.`,
            `dpkg: error processing package ${n} (--configure):`,
            ` installed ${n} package post-installation script subprocess returned error exit status 1`,
          );
          echecs.push(n);
        }
      }
    }
    lignes.push('Processing triggers for man-db (2.13.1-1) ...');
    if (echecs.length)
      lignes.push(
        'Errors were encountered while processing:',
        ...echecs.map((n) => ` ${n}`),
        'Error: Sub-process /usr/bin/dpkg returned an error code (1)',
      );
    return lignes.join('\n');
  };
  if (oui) return [...sortie, '', suite()].join('\n');
  // La réponse arrive à la ligne suivante, hors de sudo : on reprend le compte root.
  jeu.demander('Continue? [Y/n] ', (reponse) => {
    if (reponse !== '' && !/^y(es)?$/i.test(reponse)) return 'Abort.';
    const avant = jeu.qui;
    jeu.qui = 'root';
    try {
      return suite();
    } finally {
      jeu.qui = avant;
    }
  });
  return [...sortie, ''].join('\n');
}

export const APT: Record<string, Commande> = {
  apt: {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const oui = args.some((a) => a === '-y' || a === '--yes' || a === '--assume-yes');
      const mots = args.filter((a) => !a.startsWith('-'));
      const [action, ...paquets] = mots;
      const e = etat(jeu);
      if (!action) return jeu.erreur(jeu.t('apt-usage'));
      if (action === 'update') {
        if (jeu.qui !== 'root') return verrou(jeu, '/var/lib/apt/lists/lock', 'Unable to lock directory /var/lib/apt/lists/');
        e.listes = true;
        return [
          ...SOURCES.map((s, i) => `Get:${i + 1} ${s}`),
          'Fetched 16.4 MB in 2s (8,210 kB/s)',
          ...LECTURE.slice(0, 2),
          'All packages are up to date.',
        ].join('\n');
      }
      if (action === 'install') {
        if (!paquets.length) return jeu.erreur(`${LECTURE.join('\n')}\nSummary:\n  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0`);
        if (jeu.qui !== 'root')
          return verrou(jeu, '/var/lib/dpkg/lock-frontend', 'Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?');
        return installer(jeu, paquets, oui);
      }
      if (action === 'list') {
        if (!args.includes('--installed')) return jeu.erreur(jeu.t('apt-list'));
        const lignes = Object.entries(e.installes)
          .sort()
          .map(([n, v]) => `${n}/trixie,now ${v} ${PAQUETS[n].architecture} [installed]`);
        return ['Listing... Done', ...lignes].join('\n');
      }
      return jeu.erreur(`Error: Invalid operation ${action}`);
    },
  },
  // nginx : le serveur web. Ici, on s'en sert pour vérifier la configuration
  // (-t), l'afficher en entier (-T) et connaître sa version (-v).
  nginx: {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      if (!jeu.trouver('/usr/sbin/nginx')) return jeu.erreur(jeu.t('commande-introuvable', { commande: 'nginx' }));
      const option = args[0];
      if (option === '-v') return `nginx version: nginx/${VERSION}`;
      if (option !== '-t' && option !== '-T') {
        const lettre = option?.replace(/^-+/, '') ?? '';
        return jeu.erreur(option ? `nginx: invalid option: "${lettre}"` : jeu.t('nginx-sans-option'));
      }
      const res = tester(jeu);
      const sortie: string[] = [];
      // Hors de root, nginx ne peut ouvrir ni son journal ni son fichier de PID.
      if (jeu.qui !== 'root')
        sortie.push('nginx: [alert] could not open error log file: open() "/var/log/nginx/error.log" failed (13: Permission denied)');
      if (res.erreur) {
        jeu.etat.nginxErreur = res.erreur;
        sortie.push(`nginx: [emerg] ${res.erreur}`, `nginx: configuration file ${CONF} test failed`);
        return jeu.erreur(sortie.join('\n'));
      }
      jeu.etat.nginxTeste = true;
      sortie.push(`nginx: the configuration file ${CONF} syntax is ok`);
      if (jeu.qui !== 'root') {
        const h = heureNginx(systemd(jeu)?.horloge ?? 0);
        sortie.push(
          `${h} [emerg] 2533#2533: open() "/run/nginx.pid" failed (13: Permission denied)`,
          `nginx: configuration file ${CONF} test failed`,
        );
        return jeu.erreur(sortie.join('\n'));
      }
      sortie.push(`nginx: configuration file ${CONF} test is successful`);
      if (option === '-T') sortie.push(...fichiersLus(jeu).flatMap((chemin) => [`# configuration file ${chemin}:`, jeu.lire(chemin) ?? '', '']));
      return sortie.join('\n').trimEnd();
    },
  },
};
