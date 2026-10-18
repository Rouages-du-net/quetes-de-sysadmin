// Histoire « La Fabrique » — chapitre « Le trou dans le pare-feu » : Docker
// et ufw, et la place que prend Docker. Rania (des Lettres du quartier) a
// testé le serveur du fablab depuis l'extérieur : PostgreSQL répond sur le
// port 5432, alors qu'ufw ne l'autorise pas. Yasmine avait ajouté
// « ports: - "5432:5432" » à la base pour s'y connecter depuis son portable.
// Docker publie ce port avec ses propres règles iptables, consultées avant
// celles d'ufw : la base est ouverte au monde entier. En prime, le disque est
// plein à 91 % : images inutiles, une image de 9,6 Go, des conteneurs
// arrêtés… et un volume à ne surtout pas jeter.
// Objectif vérifié sur l'état : le port 5432 ne répond plus depuis
// l'extérieur, les deux applis répondent toujours, le disque est sous 75 %,
// et aucun volume utile n'a disparu.
// Sources : https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw,
// https://docs.docker.com/engine/network/#published-ports,
// https://docs.docker.com/engine/manage-resources/pruning/

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu, Shell } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import {
  demarrerDocker,
  docker,
  ecrireDans,
  identifiant,
  majDisque,
  nomImage,
  requeteDocker,
  type Conteneur,
  type EtatDocker,
  type Image,
} from '../docker';
import { lireProjet, monter, conteneursDuProjet } from '../compose';
import { nouveauPareFeu, type PareFeu } from '../parefeu';
import { etatPort } from '../ports';
import { POSTE } from '../machines';
import { connecter } from './composition';
import { ecrireBase } from './mise-a-jour';

const M = '/home/vous';
const PROJET = '/srv/reservations';
const Go = 1_000_000_000;
const DISQUE = 20 * Go;
const VOLUMES_UTILES = ['outiltheque-donnees', 'reservations_donnees', 'wiki-ancien'];

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

// Le compose.yaml de la fin du chapitre 2… plus le port de la base, ajouté par Yasmine.
const COMPOSE = `services:
  appli:
    image: registre.example/reservations:2.1
    ports:
      - "8081:3000"
    environment:
      - DATABASE_URL=postgres://fablab:\${POSTGRES_PASSWORD}@db:5432/reservations
    restart: unless-stopped
    depends_on:
      - db

  db:
    image: postgres:17
    environment:
      - POSTGRES_USER=fablab
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=reservations
    # Pour pgAdmin, depuis mon portable (Yasmine)
    ports:
      - "5432:5432"
    volumes:
      - donnees:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  donnees:`;

const image = (depot: string, tag: string, appli: string, port: number, commande: string, taille: number, joursAvant: number): Image => ({
  depot,
  tag,
  id: identifiant(`${depot}:${tag}:${taille}`),
  taille,
  cree: Date.UTC(2027, 3, 24, 10, 0, 0) - joursAvant * 86_400_000,
  appli,
  port,
  commande,
});

function etatDocker(): EtatDocker {
  const liste = [
    image('registre.example/outiltheque', '1.4', 'outiltheque', 8080, '/usr/local/bin/outiltheque serve', 148_200_000, 140),
    image('registre.example/outiltheque', '1.5', 'outiltheque', 8080, '/usr/local/bin/outiltheque serve', 151_600_000, 23),
    image('registre.example/reservations', '2.0', 'reservations', 3000, 'docker-entrypoint.sh node serveur.js', 205_100_000, 40),
    image('registre.example/reservations', '2.1', 'reservations', 3000, 'docker-entrypoint.sh node serveur.js', 212_400_000, 16),
    image('postgres', '16', 'postgres', 5432, 'docker-entrypoint.sh postgres', 431_700_000, 60),
    image('postgres', '17', 'postgres', 5432, 'docker-entrypoint.sh postgres', 438_900_000, 22),
    // L'essai d'un modèle d'IA en local, oublié là.
    image('registre.example/ia-locale', 'latest', 'aucune', 8000, 'python -m serveur', 9_600_000_000, 31),
    image('node', '22', 'aucune', 0, 'docker-entrypoint.sh node', 1_120_000_000, 45),
    ...[0, 1, 2].map((k) => image('<none>', '<none>', 'aucune', 0, '', 410_000_000 + k * 7_000_000, 50 + k * 9)),
  ];
  const images = Object.fromEntries(liste.map((i) => [i.depot === '<none>' ? `<none>@${i.id}` : nomImage(i), i]));
  return {
    images,
    registre: Object.fromEntries(liste.filter((i) => i.depot !== '<none>').map((i) => [nomImage(i), i])),
    conteneurs: [],
    volumes: {
      'outiltheque-donnees': { cree: Date.UTC(2027, 3, 3, 10, 12, 0), donnees: {}, taille: 2_400_000 },
      reservations_donnees: { cree: Date.UTC(2027, 3, 10, 14, 30, 0), donnees: {}, taille: 162_000_000 },
      // Les pages de l'ancien wiki du fablab, gardées pour les extraire un jour.
      'wiki-ancien': { cree: Date.UTC(2026, 10, 2, 9, 0, 0), donnees: { 'wiki.sqlite': 'SQLite format 3' }, taille: 48_100_000 },
    },
    prochain: 10,
  };
}

const conteneur = (
  j: Jeu,
  nom: string,
  image: string,
  ports: Conteneur['ports'],
  volume: string | null,
  redemarrage: string,
  etat: Conteneur['etat'],
): Conteneur => ({
  id: identifiant(`conteneur-${nom}`),
  nom,
  image,
  etat,
  code: 0,
  ports,
  montages: volume ? [{ type: 'volume', source: volume, cible: '/var/lib/outiltheque', lectureSeule: false }] : [],
  env: {},
  redemarrage,
  cree: Date.UTC(2027, 3, 3, 10, 20, 0),
  debut: systemd(j)?.horloge ?? 0,
  fin: Date.UTC(2027, 3, 3, 10, 18, 0),
  couche: {},
  journal: [],
  ip: `172.17.0.${etat === 'running' ? 2 : 3}`,
});

const sd = (j: Jeu) => systemd(j)!;
const etat = (j: Jeu) => docker(j)!;
const shell = (j: Jeu) => j as Shell;
const ouvertAuMonde = (j: Jeu) => etatPort(j, 5432, false, POSTE.adresse) === 'ouvert';
const occupation = (j: Jeu) => shell(j).taille(j.trouver('/')!) / DISQUE;
const volumesPerdus = (j: Jeu) => VOLUMES_UTILES.filter((v) => !etat(j).volumes[v]);
const appliOk = (j: Jeu) => {
  const a = conteneursDuProjet(etat(j), 'reservations').find((c) => c.service === 'appli');
  return a?.etat === 'running' && connecter(j, a) === null;
};
const outilOk = (j: Jeu) => requeteDocker(j, '127.0.0.1', 8080, '/')?.code === 200;
const ufw = (j: Jeu) => j.etat.ufw as PareFeu;

export const contournement: Chapitre = {
  id: 'contournement',
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
    'du',
    'df',
    'mkdir',
    'cp',
    'mv',
    'rm',
    'chmod',
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
    'ss',
    'ufw',
    'nc',
  ],
  maison: M,
  accueil: 'message_de_rania.txt',
  final: 'fin',
  motDePasse: 'fablab-2027',
  comptes,
  etat: () => {
    const pf = nouveauPareFeu();
    pf.actif = true;
    pf.regles = [
      { action: 'allow', vers: 'OpenSSH', ports: [22], de: null },
      { action: 'allow', vers: '8080/tcp', ports: [8080], de: null },
      { action: 'allow', vers: '8081/tcp', ports: [8081], de: null },
    ];
    return {
      systemd: nouveauSystemd('fabrique', Date.UTC(2027, 3, 20, 7, 10, 0), Date.UTC(2027, 3, 24, 10, 0, 0), {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          processus: [{ pid: 610, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
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
      ufw: pf,
      ecoute: [
        { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 610 },
        { proto: 'tcp', adresse: '[::]', port: 22, processus: 'sshd', pid: 610 },
      ],
      montages: [{ chemin: '/', capacite: DISQUE, nom: '/dev/vda1' }],
      docker: { ...etatDocker(), noms: ['fabrique', 'fabrique.example', '192.0.2.15'] },
    };
  },
  // Les conteneurs du fablab, tels qu'ils tournent depuis le dernier démarrage.
  initialiser: (j) => {
    const e = etat(j);
    const outil = conteneur(
      j,
      'outiltheque',
      'registre.example/outiltheque:1.5',
      [{ ip: '0.0.0.0', hote: 8080, conteneur: 8080 }],
      'outiltheque-donnees',
      'unless-stopped',
      'running',
    );
    const ancien = conteneur(
      j,
      'outiltheque-ancien',
      'registre.example/outiltheque:1.4',
      [{ ip: '0.0.0.0', hote: 8080, conteneur: 8080 }],
      null,
      'no',
      'exited',
    );
    e.conteneurs.push(ancien, outil);
    ecrireDans(j, outil, '/var/lib/outiltheque/outiltheque.db', ecrireBase({ schema: 4, prets: [] }));
    // La base de réservations existe déjà dans son volume (mot de passe de .env).
    e.volumes.reservations_donnees.donnees = {
      PG_VERSION: '17',
      'pg_hba_qds.json': JSON.stringify({ utilisateur: 'fablab', motDePasse: 'atelier2027', base: 'reservations' }),
    };
    monter(shell(j), lireProjet(j, PROJET), () => true);
    majDisque(j);
    sd(j).journal = sd(j).journal.filter((x) => x.unite !== 'docker.service');
  },
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: f('fabrique', { lignes: true, proprio: 'root' }) }),
      home: lieu({
        vous: d({ 'message_de_rania.txt': f(t('contournement-message-de-rania')), 'mot_de_yasmine.txt': f(t('contournement-mot-de-yasmine')) }),
      }),
      srv: lieu({
        reservations: lieu({
          'compose.yaml': f(COMPOSE, { lignes: true, proprio: 'root' }),
          '.env': f('POSTGRES_PASSWORD=atelier2027', { lignes: true, proprio: 'root', mode: 'rw-------' }),
        }),
      }),
      // Le système et ses journaux : la place qui n'est pas à Docker.
      usr: lieu({ systeme: f('', { taille: 3_100_000_000, proprio: 'root' }) }),
      var: lieu({
        lib: lieu({ docker: lieu({}, { proprio: 'root', mode: 'rwx--x---' }) }),
        log: lieu({ journal: lieu({ 'system.journal': f('', { taille: 1_600_000_000, proprio: 'root' }) }) }),
      }),
    });
  },
  evenements: [
    {
      id: 'ss',
      condition: (j) => j.derniere.sortie.includes('docker-proxy') && j.derniere.sortie.includes(':5432'),
      message: (j) => j.t('contournement-evenement-ss'),
    },
    {
      id: 'ufw-inutile',
      condition: (j) => ufw(j).regles.some((r) => r.ports.includes(5432) && r.action !== 'allow') && ouvertAuMonde(j),
      message: (j) => j.t('contournement-evenement-ufw-inutile'),
    },
    {
      id: 'ferme',
      condition: (j) => !ouvertAuMonde(j) && appliOk(j),
      message: (j) => j.t('contournement-evenement-ferme'),
    },
    {
      id: 'volume-perdu',
      condition: (j) => volumesPerdus(j).length > 0,
      message: (j) => j.t('contournement-evenement-volume-perdu', { volumes: volumesPerdus(j).join(', ') }),
    },
    {
      id: 'disque',
      condition: (j) => occupation(j) < 0.75,
      message: (j) => j.t('contournement-evenement-disque', { pourcent: Math.round(occupation(j) * 100) }),
    },
    {
      id: 'fin',
      condition: (j) => !ouvertAuMonde(j) && appliOk(j) && outilOk(j) && occupation(j) < 0.75 && volumesPerdus(j).length === 0,
      message: (j) => j.t('contournement-evenement-fin'),
    },
  ],
};
