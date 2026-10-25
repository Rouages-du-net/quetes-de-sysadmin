// Histoire « La Fabrique » — chapitre « La composition » : Docker Compose.
// Le fablab veut un site de réservation des machines (découpe laser,
// imprimantes 3D) : une appli et sa base PostgreSQL, décrites dans un
// compose.yaml copié d'un tutoriel. Il a quatre défauts : l'appli cherche la
// base sur « localhost » (dans un conteneur, c'est lui-même), la base n'a pas
// de volume, le mot de passe est écrit en clair dans le fichier (que Yasmine
// veut publier sur le dépôt git du fablab), et rien ne redémarre.
// Objectif vérifié sur l'état : les deux services tournent et l'appli est
// connectée à la base, les données de la base sont dans un volume, le mot de
// passe n'est que dans .env (lisible par root seulement), et les deux
// services ont une politique de redémarrage.
// Sources : https://docs.docker.com/compose/how-tos/networking/,
// https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/,
// https://hub.docker.com/_/postgres (POSTGRES_PASSWORD, initialisation)

import { motDePasse, d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { APPLIS, demarrerDocker, docker, ecrireDans, identifiant, lireDans, nomImage, type Conteneur, type EtatDocker, type Image } from '../docker';
import { conteneursDuProjet, empreinte, joindre, lireEnv, lireProjet, type ConteneurCompose } from '../compose';
import type { Shell } from '../shell';

const M = '/home/vous';
const PROJET = '/srv/reservations';
const DONNEES = '/var/lib/postgresql/data';
const AUTH = `${DONNEES}/pg_hba_qds.json`;

const journal = (jeu: Jeu, c: Conteneur, texte: string) => c.journal.push({ temps: systemd(jeu)?.horloge ?? 0, texte });

// PostgreSQL (image officielle) : la base n'est créée qu'une fois, quand le
// dossier des données est vide ; POSTGRES_PASSWORD ne sert qu'à ce moment-là.
APPLIS.postgres = {
  comptes: { postgres: 999 },
  demarrer: (jeu, c) => {
    if (lireDans(jeu, c, `${DONNEES}/PG_VERSION`)) {
      journal(jeu, c, '');
      journal(jeu, c, 'PostgreSQL Database directory appears to contain a database; Skipping initialization');
      journal(jeu, c, '');
    } else {
      const motDePasse = c.env.POSTGRES_PASSWORD ?? '';
      if (!motDePasse && c.env.POSTGRES_HOST_AUTH_METHOD !== 'trust') {
        for (const l of [
          'Error: Database is uninitialized and superuser password is not specified.',
          '       You must specify POSTGRES_PASSWORD to a non-empty value for the',
          '       superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".',
        ])
          journal(jeu, c, l);
        return 1;
      }
      const utilisateur = c.env.POSTGRES_USER || 'postgres';
      journal(jeu, c, `The files belonging to this database system will be owned by user "postgres".`);
      journal(jeu, c, `fixing permissions on existing directory ${DONNEES} ... ok`);
      journal(jeu, c, 'PostgreSQL init process complete; ready for start up.');
      ecrireDans(jeu, c, `${DONNEES}/PG_VERSION`, '17');
      ecrireDans(jeu, c, AUTH, JSON.stringify({ utilisateur, motDePasse, base: c.env.POSTGRES_DB || utilisateur }));
    }
    journal(
      jeu,
      c,
      `${new Date(systemd(jeu)?.horloge ?? 0).toISOString().slice(0, 19).replace('T', ' ')}.000 UTC [1] LOG:  database system is ready to accept connections`,
    );
    return null;
  },
  // PostgreSQL ne parle pas HTTP : une requête web reçoit une réponse vide.
  repondre: () => ({ code: 0, corps: '' }),
};

// La connexion de l'appli à sa base, d'après DATABASE_URL.
export function connecter(jeu: Jeu, c: Conteneur): string | null {
  const url = c.env.DATABASE_URL;
  if (!url) return 'Error: DATABASE_URL is not set';
  const m = /^postgres(?:ql)?:\/\/([^:@/]*)(?::([^@/]*))?@([^:/]+)(?::(\d+))?\/([^?]+)/.exec(url);
  if (!m) return `TypeError: Invalid URL: ${url}`;
  const [, utilisateur, motDePasse = '', hote, port = '5432', base] = m;
  // Dans un conteneur, localhost, c'est le conteneur lui-même.
  if (['localhost', '127.0.0.1'].includes(hote)) return `Error: connect ECONNREFUSED 127.0.0.1:${port}`;
  const db = joindre(jeu, c, hote);
  if (!db) return `Error: getaddrinfo ENOTFOUND ${hote}`;
  if (db.etat !== 'running' || port !== '5432') return `Error: connect ECONNREFUSED ${db.ip}:${port}`;
  const auth = JSON.parse(lireDans(jeu, db, AUTH) ?? '{}');
  if (utilisateur !== auth.utilisateur || motDePasse !== auth.motDePasse) return `error: password authentication failed for user "${utilisateur}"`;
  if (base !== auth.base) return `error: database "${base}" does not exist`;
  return null;
}

APPLIS.reservations = {
  // Construite sur l'image node, qui a un compte node (uid 1000)… mais ne s'en sert pas.
  comptes: { node: 1000 },
  demarrer: (jeu, c) => {
    journal(jeu, c, '> reservations@2.1.0 start');
    journal(jeu, c, '> node serveur.js');
    const erreur = connecter(jeu, c);
    if (erreur) {
      journal(jeu, c, erreur);
      return 1;
    }
    journal(jeu, c, 'Connected to PostgreSQL 17');
    journal(jeu, c, 'Migrations applied (3)');
    journal(jeu, c, 'Listening on http://0.0.0.0:3000');
    return null;
  },
  repondre: (jeu, c, chemin) => {
    const erreur = connecter(jeu, c);
    if (erreur) return { code: 500, corps: `Internal Server Error: ${erreur}` };
    if (chemin === '/' || chemin === '') return { code: 200, corps: jeu.t('composition-appli-accueil') };
    return { code: 404, corps: `Cannot GET ${chemin}` };
  },
};

const comptes = (): Comptes => ({
  utilisateurs: { root: { uid: 0, groupe: 'root', maison: '/root' }, vous: { uid: 1000, groupe: 'vous' }, yasmine: { uid: 1001, groupe: 'yasmine' } },
  groupes: {
    root: { gid: 0, membres: [] },
    sudo: { gid: 27, membres: ['vous', 'yasmine'] },
    docker: { gid: 999, membres: ['yasmine'] },
    vous: { gid: 1000, membres: [] },
    yasmine: { gid: 1001, membres: [] },
  },
});

// Le fichier du tutoriel, tel que Yasmine l'a copié.
const COMPOSE = `version: "3.8"

services:
  appli:
    image: registry.example/reservations:2.1
    ports:
      - "8081:3000"
    environment:
      - DATABASE_URL=postgres://fablab:atelier2027@localhost:5432/reservations
    depends_on:
      - db

  db:
    image: postgres:17
    environment:
      - POSTGRES_USER=fablab
      - POSTGRES_PASSWORD=atelier2027
      - POSTGRES_DB=reservations`;

const image = (depot: string, tag: string, appli: string, port: number, commande: string, taille: number, cree: number): Image => ({
  depot,
  tag,
  id: identifiant(`${depot}:${tag}`),
  taille,
  cree,
  appli,
  port,
  commande,
});

function etatDocker(): EtatDocker {
  const outil = image(
    'registry.example/outiltheque',
    '1.5',
    'outiltheque',
    8080,
    '/usr/local/bin/outiltheque serve',
    151_600_000,
    Date.UTC(2027, 3, 1, 9, 0, 0),
  );
  const reservations = image(
    'registry.example/reservations',
    '2.1',
    'reservations',
    3000,
    'docker-entrypoint.sh node serveur.js',
    212_400_000,
    Date.UTC(2027, 3, 8, 16, 0, 0),
  );
  const postgres = image('postgres', '17', 'postgres', 5432, 'docker-entrypoint.sh postgres', 438_900_000, Date.UTC(2027, 3, 2, 3, 0, 0));
  const registre = Object.fromEntries([outil, reservations, postgres].map((i) => [nomImage(i), i]));
  return { images: { [nomImage(outil)]: outil }, registre, conteneurs: [], volumes: {}, prochain: 1 };
}

const etat = (j: Jeu) => docker(j)!;
const projet = (j: Jeu) => conteneursDuProjet(etat(j), 'reservations');
const service = (j: Jeu, nom: string) => projet(j).find((c) => c.service === nom);
const relance = (c?: Conteneur) => !!c && ['always', 'unless-stopped'].includes(c.redemarrage);
// Le mot de passe de la base, tel que .env le donne.
const motDePasseEnv = (j: Jeu) => lireEnv(j.lire(`${PROJET}/.env`)).POSTGRES_PASSWORD ?? '';
const enClair = (j: Jeu) => {
  const mdp = service(j, 'db')?.env.POSTGRES_PASSWORD;
  return !!mdp && (j.lire(`${PROJET}/compose.yaml`) ?? '').includes(mdp);
};
const envProtege = (j: Jeu) => {
  const n = j.trouver(`${PROJET}/.env`);
  return !!n && !j.peut(n, 'r', 'yasmine');
};
const connectee = (j: Jeu) => {
  const a = service(j, 'appli');
  return a?.etat === 'running' && connecter(j, a) === null;
};
// Les conteneurs correspondent-ils au compose.yaml et au .env actuels (pas de up oublié) ?
const aJour = (j: Jeu) => {
  try {
    const p = lireProjet(j as Shell, PROJET);
    return p.services.every((s) => (service(j, s.nom) as ConteneurCompose | undefined)?.empreinte === empreinte(s));
  } catch {
    return false;
  }
};
const surVolume = (j: Jeu) => service(j, 'db')?.montages.some((m) => m.type === 'volume' && m.cible.replace(/\/$/, '') === DONNEES) ?? false;

export const composition: Chapitre = {
  id: 'composition',
  numero: 2,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'mkdir',
    'cp',
    'mv',
    'rm',
    'chmod',
    'chown',
    'echo',
    'tee',
    'id',
    'whoami',
    'sudo',
    'nano',
    'curl',
    'docker',
    'systemctl',
    'journalctl',
    'reboot',
  ],
  maison: M,
  accueil: 'message_de_yasmine.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'fablab-2027',
  comptes,
  etat: () => ({
    systemd: nouveauSystemd('fabrique', Date.UTC(2027, 3, 3, 10, 30, 0), Date.UTC(2027, 3, 10, 14, 0, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 610, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      docker: {
        description: 'Docker Application Container Engine',
        active: true,
        executable: 'dockerd',
        processus: [
          { pid: 702, utilisateur: 'root', cpu: 0.4, mem: 2.1, commande: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
        ],
        charger: (j) => demarrerDocker(j),
      },
    }),
    docker: { ...etatDocker(), noms: ['fabrique', 'fabrique.internal', '192.0.2.15'] },
  }),
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: f('fabrique', { lignes: true, proprio: 'root' }) }),
      home: lieu({
        vous: d({ 'message_de_yasmine.txt': f(t('composition-message-de-yasmine')), 'aide_compose.txt': f(t('composition-aide-compose')) }),
      }),
      srv: lieu({ reservations: lieu({ 'compose.yaml': f(COMPOSE.replaceAll('atelier2027', motDePasse(t, 'atelier2027')), { lignes: true, proprio: 'root' }) }) }),
    });
  },
  evenements: [
    {
      id: 'localhost',
      condition: (j) =>
        (service(j, 'appli')?.journal ?? []).some((l) => l.texte.includes('ECONNREFUSED 127.0.0.1')) && j.derniere.ligne.includes('docker'),
      message: (j) => j.t('composition-evenement-localhost'),
    },
    {
      id: 'sans-mot-de-passe',
      condition: (j) => (service(j, 'db')?.journal ?? []).some((l) => l.texte.includes('superuser password is not specified')),
      message: (j) => j.t('composition-evenement-sans-mot-de-passe'),
    },
    {
      id: 'authentification',
      condition: (j) => (service(j, 'appli')?.journal ?? []).some((l) => l.texte.includes('password authentication failed')),
      message: (j) => j.t('composition-evenement-authentification'),
    },
    {
      id: 'connectee',
      condition: connectee,
      message: (j) => j.t('composition-evenement-connectee'),
    },
    {
      id: 'volumes-effaces',
      condition: (j) => j.etat.composeVolumesEffaces === true,
      message: (j) => j.t('composition-evenement-volumes-effaces'),
    },
    {
      id: 'en-clair',
      condition: (j) => connectee(j) && surVolume(j) && enClair(j),
      message: (j) => j.t('composition-evenement-en-clair'),
    },
    {
      id: 'env-lisible',
      condition: (j) => connectee(j) && surVolume(j) && !enClair(j) && motDePasseEnv(j) !== '' && !envProtege(j),
      message: (j) => j.t('composition-evenement-env-lisible'),
    },
    {
      id: 'sans-redemarrage',
      condition: (j) => connectee(j) && surVolume(j) && !enClair(j) && envProtege(j) && !(relance(service(j, 'appli')) && relance(service(j, 'db'))),
      message: (j) => j.t('composition-evenement-sans-redemarrage'),
    },
    {
      id: 'fin',
      condition: (j) =>
        connectee(j) &&
        aJour(j) &&
        surVolume(j) &&
        !enClair(j) &&
        motDePasseEnv(j) !== '' &&
        envProtege(j) &&
        relance(service(j, 'appli')) &&
        relance(service(j, 'db')),
      message: (j) => j.t('composition-evenement-fin'),
    },
  ],
};
