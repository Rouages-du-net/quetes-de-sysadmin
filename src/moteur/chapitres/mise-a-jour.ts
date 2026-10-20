// Histoire « La Fabrique » — chapitre « La mise à jour » : Docker. Le fablab
// prête des outils grâce à l'outilthèque, une appli lancée il y a deux
// semaines avec un simple docker run, sans volume : sa base de données vit
// dans la couche du conteneur. La version 1.5 est sortie ; mettre à jour,
// c'est supprimer le conteneur et en créer un neuf… et sans précaution, les
// 37 prêts en cours disparaissent avec lui.
// Commandes : docker ps, logs, exec, inspect, cp, stop, rm, pull, run (-d,
// --name, -p, -v, --restart), volume, curl.
// Objectif vérifié sur l'état : un conteneur de la version 1.5 tourne, publie
// le port 8080, garde sa base dans un volume ou un dossier de la machine
// (plus dans sa couche), y retrouve les 37 prêts, et repartira avec la machine.
// Sources : https://docs.docker.com/engine/storage/volumes/,
// https://docs.docker.com/reference/cli/docker/container/cp/,
// https://docs.docker.com/engine/containers/start-containers-automatically/

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { APPLIS, demarrerDocker, docker, ecrireDans, identifiant, lireDans, nomImage, type Conteneur, type EtatDocker, type Image } from '../docker';

const M = '/home/vous';
const DEPOT = 'registre.example/outiltheque';
const BASE = '/var/lib/outiltheque/outiltheque.db';
const SCHEMAS: Record<string, number> = { '1.4': 3, '1.5': 4 };
const PRETS = 37;

// La base de l'outilthèque : un fichier SQLite (son contenu est simulé :
// l'en-tête de SQLite, puis les données lisibles par le jeu).
interface Base {
  schema: number;
  prets: { outil: string; personne: string; jusqua: string }[];
}
const ENTETE = 'SQLite format 3';
export const ecrireBase = (b: Base) => `${ENTETE}\u0000${JSON.stringify(b)}`;
export function lireBase(contenu: string | null): Base | null {
  if (!contenu?.startsWith(ENTETE)) return null;
  try {
    return JSON.parse(contenu.slice(ENTETE.length + 1)) as Base;
  } catch {
    return null;
  }
}

function prets(outils: string[], personnes: string[]): Base['prets'] {
  return Array.from({ length: PRETS }, (_, i) => ({
    outil: outils[(i * 5) % outils.length],
    personne: personnes[(i * 7) % personnes.length],
    jusqua: `2027-04-${String(5 + (i % 20)).padStart(2, '0')}`,
  }));
}

// L'appli de l'image : elle lit et écrit sa base à chaque démarrage et requête.
APPLIS.outiltheque = {
  // L'image crée son propre compte et s'en sert (USER outil dans son Dockerfile).
  utilisateur: 'outil',
  comptes: { outil: 1000 },
  demarrer: (jeu, c, image) => {
    const ecrire = (texte: string) => c.journal.push({ temps: systemd(jeu)?.horloge ?? 0, texte });
    const version = image.tag;
    const schema = SCHEMAS[version] ?? 4;
    ecrire(`outiltheque ${version}.0 starting (pid 1)`);
    const base = lireBase(lireDans(jeu, c, BASE));
    if (!base) {
      ecrire(`No database found at ${BASE}, creating a new one`);
      ecrireDans(jeu, c, BASE, ecrireBase({ schema, prets: [] }));
    } else if (base.schema > schema) {
      ecrire(`FATAL: database schema ${base.schema} is newer than this version supports (${schema})`);
      return 1;
    } else if (base.schema < schema) {
      ecrire(`Migrating database schema ${base.schema} -> ${schema}`);
      ecrireDans(jeu, c, BASE, ecrireBase({ ...base, schema }));
      ecrire(`Migration done: ${base.prets.length} loans kept`);
    } else ecrire(`Database ready: ${base.prets.length} loans`);
    ecrire('Listening on http://0.0.0.0:8080');
    return null;
  },
  repondre: (jeu, c, chemin) => {
    const base = lireBase(lireDans(jeu, c, BASE));
    const version = c.image.split(':').at(-1)!;
    if (!base) return { code: 500, corps: 'Internal Server Error: database is missing' };
    if (chemin === '/' || chemin === '') return { code: 200, corps: jeu.t('mise-a-jour-appli-accueil', { version, prets: base.prets.length }) };
    if (chemin === '/prets')
      return {
        code: 200,
        corps: [
          jeu.t('mise-a-jour-appli-prets', { prets: base.prets.length }),
          ...base.prets.slice(0, 5).map((p) => `  ${p.outil} — ${p.personne} — ${p.jusqua}`),
        ].join('\n'),
      };
    return { code: 404, corps: 'Not Found' };
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

const image = (tag: string, cree: number): Image => ({
  depot: DEPOT,
  tag,
  id: identifiant(`${DEPOT}:${tag}`),
  taille: tag === '1.4' ? 148_200_000 : 151_600_000,
  cree,
  appli: 'outiltheque',
  port: 8080,
  commande: '/usr/local/bin/outiltheque serve',
});

const etatDocker = (t: (id: string) => string): EtatDocker => {
  const v14 = image('1.4', Date.UTC(2026, 11, 2, 10, 0, 0));
  const v15 = image('1.5', Date.UTC(2027, 3, 1, 9, 0, 0));
  const base = ecrireBase({ schema: 3, prets: prets(t('mise-a-jour-outils').split(', '), t('mise-a-jour-personnes').split(', ')) });
  // Lancé il y a deux semaines : docker run -d --name outiltheque -p 8080:8080 …:1.4
  const ancien: Conteneur = {
    id: identifiant('conteneur-outiltheque-1.4'),
    nom: 'outiltheque',
    image: nomImage(v14),
    etat: 'running',
    code: 0,
    ports: [{ ip: '0.0.0.0', hote: 8080, conteneur: 8080 }],
    montages: [],
    env: {},
    redemarrage: 'no',
    cree: Date.UTC(2027, 2, 20, 14, 2, 0),
    debut: Date.UTC(2027, 2, 31, 8, 40, 0),
    fin: Date.UTC(2027, 2, 31, 8, 39, 0),
    couche: { [BASE]: base },
    journal: [
      { temps: Date.UTC(2027, 2, 20, 14, 2, 1), texte: 'outiltheque 1.4.0 starting (pid 1)' },
      { temps: Date.UTC(2027, 2, 20, 14, 2, 1), texte: `No database found at ${BASE}, creating a new one` },
      { temps: Date.UTC(2027, 2, 20, 14, 2, 2), texte: 'Listening on http://0.0.0.0:8080' },
      { temps: Date.UTC(2027, 2, 31, 8, 40, 1), texte: 'outiltheque 1.4.0 starting (pid 1)' },
      { temps: Date.UTC(2027, 2, 31, 8, 40, 1), texte: `Database ready: ${PRETS} loans` },
      { temps: Date.UTC(2027, 2, 31, 8, 40, 2), texte: 'Listening on http://0.0.0.0:8080' },
    ],
    ip: '172.17.0.2',
  };
  return {
    images: { [nomImage(v14)]: v14 },
    registre: { [nomImage(v14)]: v14, [nomImage(v15)]: v15, [`${DEPOT}:latest`]: { ...v15, tag: 'latest' } },
    conteneurs: [ancien],
    volumes: {},
    prochain: 1,
  };
};

const etat = (j: Jeu) => docker(j)!;
// Où se trouvent les prêts : une base qui en contient autant, n'importe où.
const baseComplete = (contenu: string | null) => (lireBase(contenu)?.prets.length ?? 0) === PRETS;

function quelquePart(j: Jeu): boolean {
  const e = etat(j);
  if (e.conteneurs.some((c) => baseComplete(lireDans(j, c, BASE)))) return true;
  if (Object.values(e.volumes).some((v) => Object.values(v.donnees).some(baseComplete))) return true;
  const chercher = (chemin: string, profondeur: number): boolean => {
    const n = j.trouver(chemin);
    if (!n || profondeur > 8) return false;
    if (n.type === 'fichier') return baseComplete(j.lire(chemin));
    return Object.keys(n.enfants).some((k) => chercher(`${chemin === '/' ? '' : chemin}/${k}`, profondeur + 1));
  };
  return chercher('/home', 0) || chercher('/srv', 0) || chercher('/tmp', 0) || chercher('/root', 0) || chercher('/opt', 0);
}

// Le conteneur à jour qui tourne et publie 8080.
const nouveau = (j: Jeu) =>
  etat(j).conteneurs.find((c) => c.etat === 'running' && c.image.endsWith(':1.5') && c.ports.some((p) => p.hote === 8080 && p.conteneur === 8080));
const surMontage = (c: Conteneur) => c.montages.some((m) => BASE.startsWith(m.cible.replace(/\/$/, '') + '/'));

export const miseAJour: Chapitre = {
  id: 'mise-a-jour',
  numero: 1,
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
  etat: (t) => ({
    systemd: nouveauSystemd('fabrique', Date.UTC(2027, 2, 31, 8, 39, 0), Date.UTC(2027, 3, 3, 10, 0, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 610, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      containerd: {
        description: 'containerd container runtime',
        active: true,
        executable: 'containerd',
        processus: [{ pid: 655, utilisateur: 'root', cpu: 0.3, mem: 1.2, commande: '/usr/bin/containerd' }],
      },
      docker: {
        description: 'Docker Application Container Engine',
        active: true,
        executable: 'dockerd',
        processus: [
          { pid: 702, utilisateur: 'root', cpu: 0.4, mem: 2.1, commande: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
        ],
        // Au démarrage de la machine, docker relance les conteneurs selon --restart.
        charger: (j) => demarrerDocker(j),
      },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 702, utilisateur: 'root', cpu: 0.4, mem: 2.1, commande: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
      { pid: 1188, utilisateur: '1000', cpu: 0.8, mem: 3.4, commande: '/usr/local/bin/outiltheque serve' },
    ],
    docker: { ...etatDocker(t), noms: ['fabrique', 'fabrique.example', '192.0.2.15'] },
  }),
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: f('fabrique', { lignes: true, proprio: 'root' }) }),
      home: lieu({
        vous: d({ 'message_de_yasmine.txt': f(t('mise-a-jour-message-de-yasmine')), 'notes_docker.txt': f(t('mise-a-jour-notes-docker')) }),
      }),
      srv: lieu({}),
      var: lieu({ lib: lieu({ docker: lieu({}, { proprio: 'root', mode: 'rwx--x---' }) }) }),
    });
  },
  evenements: [
    {
      id: 'couche',
      // docker inspect montre un conteneur sans volume ni dossier monté.
      condition: (j) =>
        j.derniere.ligne.includes('docker') &&
        (j.derniere.sortie.includes('"Mounts": []') || (j.derniere.ligne.includes('Mounts') && j.derniere.sortie.trim() === '[]')),
      message: (j) => j.t('mise-a-jour-evenement-couche'),
    },
    {
      id: 'port-occupe',
      condition: (j) => j.derniere.erreurs.some((e) => e.includes('port is already allocated')),
      message: (j) => j.t('mise-a-jour-evenement-port-occupe'),
    },
    {
      id: 'perdu',
      condition: (j) => !quelquePart(j),
      message: (j) => j.t('mise-a-jour-evenement-perdu'),
    },
    {
      id: 'neuf-vide',
      condition: (j) => {
        const c = nouveau(j);
        return !!c && (lireBase(lireDans(j, c, BASE))?.prets.length ?? 0) === 0;
      },
      message: (j) => j.t('mise-a-jour-evenement-neuf-vide'),
    },
    {
      id: 'sans-redemarrage',
      condition: (j) => {
        const c = nouveau(j);
        return !!c && surMontage(c) && baseComplete(lireDans(j, c, BASE)) && !['always', 'unless-stopped'].includes(c.redemarrage);
      },
      message: (j) => j.t('mise-a-jour-evenement-sans-redemarrage'),
    },
    {
      id: 'fin',
      condition: (j) => {
        const c = nouveau(j);
        return !!c && surMontage(c) && baseComplete(lireDans(j, c, BASE)) && ['always', 'unless-stopped'].includes(c.redemarrage);
      },
      message: (j) => j.t('mise-a-jour-evenement-fin'),
    },
  ],
};
