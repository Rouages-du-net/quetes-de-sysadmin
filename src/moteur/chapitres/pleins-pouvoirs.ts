// Histoire « La Fabrique » — chapitre « Les pleins pouvoirs » : ne pas
// faire tourner un conteneur en root. La galerie photo du fablab reçoit des
// photos envoyées par les visiteur·ses ; elle tourne en root (son image n'a
// pas de USER, et compose.yaml pas de user:). Ses fichiers, dans le dossier
// monté /srv/galerie/photos, appartiennent donc à root sur la machine :
// Yasmine ne peut plus les gérer sans sudo. Et une faille dans la galerie
// donnerait root sur tout ce qui est monté.
// Objectif vérifié sur l'état : la galerie tourne sous un autre uid que 0 et
// répond, les 14 photos sont là, Yasmine peut écrire dans le dossier, et
// celui-ci n'est pas ouvert en écriture à tout le monde (pas de chmod 777).
// Sources : https://docs.docker.com/reference/cli/docker/container/run/#user,
// https://docs.docker.com/reference/compose-file/services/#user,
// https://docs.docker.com/engine/security/#linux-kernel-capabilities,
// https://docs.docker.com/engine/security/userns-remap/,
// https://docs.docker.com/build/building/best-practices/#user

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits, type Noeud } from '../monde';
import type { Jeu, Shell } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import {
  APPLIS,
  creerDossierDans,
  demarrerDocker,
  docker,
  ecrireDans,
  identifiant,
  identite,
  imageDu,
  journal,
  majDisque,
  nomImage,
  relancerEnBoucle,
  requeteDocker,
  type Conteneur,
  type EtatDocker,
  type Image,
} from '../docker';
import { lireProjet, monter } from '../compose';
import { nouveauPareFeu } from '../parefeu';
import { ecrireBase } from './mise-a-jour';

const M = '/home/vous';
const PROJET = '/srv/galerie';
const PHOTOS = `${PROJET}/photos`;
const MINIATURES = '/app/photos/.miniatures';
const NOMS_PHOTOS = [
  'benchy-premier-essai.jpg',
  'benchy-reussi.jpg',
  'lampe-decoupe-laser.jpg',
  'horloge-en-bois.jpg',
  'robot-suiveur-de-ligne.jpg',
  'atelier-soudure-enfants.jpg',
  'velo-repare.jpg',
  'grille-pain-ressuscite.jpg',
  'enseigne-led.jpg',
  'boite-a-outils-partagee.jpg',
  'brodeuse-numerique.jpg',
  'drone-maison.jpg',
  'clavier-sur-mesure.jpg',
  'fete-du-fablab.jpg',
];

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

const COMPOSE = `services:
  galerie:
    image: registre.example/galerie:3.2
    ports:
      - "8082:3000"
    volumes:
      - ./photos:/app/photos
    restart: unless-stopped`;

// La galerie : au démarrage, elle (re)fait l'index de ses miniatures dans
// le dossier monté ; si elle ne peut pas y écrire, elle s'arrête, comme un
// programme Node.js qui reçoit EACCES.
function erreurNode(jeu: Jeu, c: Conteneur, code: 'EACCES' | 'EROFS', appel: 'mkdir' | 'open', chemin: string) {
  const message = code === 'EACCES' ? 'permission denied' : 'read-only file system';
  for (const l of [
    `Error: ${code}: ${message}, ${appel} '${chemin}'`,
    '    at async buildThumbnails (/app/serveur.js:42:3) {',
    `  errno: ${code === 'EACCES' ? -13 : -30},`,
    `  code: '${code}',`,
    `  syscall: '${appel}',`,
    `  path: '${chemin}'`,
    '}',
    '',
    'Node.js v22.12.0',
  ])
    journal(jeu, c, l);
}

const photosPresentes = (j: Jeu) => {
  const n = j.trouver(PHOTOS);
  return n?.type === 'dossier' ? NOMS_PHOTOS.filter((p) => n.enfants[p]?.type === 'fichier') : [];
};

APPLIS.galerie = {
  // Construite sur l'image node : un compte node (uid 1000) existe, mais
  // l'image ne s'en sert pas (pas de USER dans son Dockerfile).
  comptes: { node: 1000 },
  demarrer: (jeu, c) => {
    journal(jeu, c, '> galerie@3.2.0 start');
    journal(jeu, c, '> node serveur.js');
    const dossier = creerDossierDans(jeu, c, MINIATURES);
    if (dossier) {
      erreurNode(jeu, c, dossier === 'permission denied' ? 'EACCES' : 'EROFS', 'mkdir', MINIATURES);
      return 1;
    }
    const index = ecrireDans(jeu, c, `${MINIATURES}/index.json`, JSON.stringify(photosPresentes(jeu)));
    if (index) {
      erreurNode(jeu, c, index === 'permission denied' ? 'EACCES' : 'EROFS', 'open', `${MINIATURES}/index.json`);
      return 1;
    }
    journal(jeu, c, `Gallery: ${photosPresentes(jeu).length} photos, thumbnails up to date`);
    journal(jeu, c, 'Listening on http://0.0.0.0:3000');
    return null;
  },
  repondre: (jeu, _c, chemin) => {
    if (chemin === '/' || chemin === '')
      return { code: 200, corps: jeu.t('pleins-pouvoirs-galerie-accueil', { nombre: photosPresentes(jeu).length }) };
    return { code: 404, corps: `Cannot GET ${chemin}` };
  },
};

const image = (depot: string, tag: string, appli: string, port: number, commande: string, taille: number, joursAvant: number): Image => ({
  depot,
  tag,
  id: identifiant(`${depot}:${tag}:${taille}`),
  taille,
  cree: Date.UTC(2027, 4, 2, 10, 0, 0) - joursAvant * 86_400_000,
  appli,
  port,
  commande,
});

function etatDocker(): EtatDocker {
  const liste = [
    image('registre.example/outiltheque', '1.5', 'outiltheque', 8080, '/usr/local/bin/outiltheque serve', 151_600_000, 31),
    image('registre.example/galerie', '3.2', 'galerie', 3000, 'docker-entrypoint.sh node serveur.js', 236_800_000, 12),
  ];
  return {
    images: Object.fromEntries(liste.map((i) => [nomImage(i), i])),
    registre: Object.fromEntries(liste.map((i) => [nomImage(i), i])),
    conteneurs: [],
    volumes: { 'outiltheque-donnees': { cree: Date.UTC(2027, 3, 3, 10, 12, 0), donnees: {}, taille: 2_400_000 } },
    prochain: 20,
  };
}

const etat = (j: Jeu) => docker(j)!;
const sd = (j: Jeu) => systemd(j)!;

// Le conteneur de la galerie qui compte : celui qui tourne, sinon le plus récent.
const galeries = (j: Jeu) => etat(j).conteneurs.filter((c) => imageDu(j, c)?.appli === 'galerie');
const galerie = (j: Jeu) => galeries(j).find((c) => c.etat === 'running') ?? galeries(j).at(-1);
const uid = (j: Jeu, c: Conteneur | undefined) => {
  if (!c) return null;
  const id = identite(imageDu(j, c), c);
  return 'erreur' in id ? null : id.uid;
};
const tourne = (j: Jeu) => galerie(j)?.etat === 'running';
const enRoot = (j: Jeu) => tourne(j) && uid(j, galerie(j)) === 0;
const repond = (j: Jeu) => requeteDocker(j, '127.0.0.1', 8082, '/')?.code === 200;
const toutesLesPhotos = (j: Jeu) => photosPresentes(j).length === NOMS_PHOTOS.length;
const dossier = (j: Jeu, chemin: string) => j.trouver(chemin) as Noeud | undefined;
const yasminePeut = (j: Jeu) => {
  const n = dossier(j, PHOTOS);
  return !!n && j.peut(n, 'w', 'yasmine') && j.peut(n, 'x', 'yasmine');
};
// Écrire pour « les autres » (chmod 777, o+w) : n'importe quel compte de la machine.
const ouvertATous = (j: Jeu) => [PHOTOS, `${PHOTOS}/.miniatures`].some((p) => dossier(j, p)?.mode?.[7] === 'w');
const enErreur = (j: Jeu) => {
  const c = galerie(j);
  return !!c && c.etat !== 'running' && c.journal.some((l) => l.texte.includes('EACCES'));
};

export const pleinsPouvoirs: Chapitre = {
  id: 'pleins-pouvoirs',
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
    'mkdir',
    'cp',
    'mv',
    'rm',
    'chmod',
    'chown',
    'chgrp',
    'echo',
    'tee',
    'id',
    'whoami',
    'groups',
    'ps',
    'sudo',
    'nano',
    'curl',
    'docker',
    'systemctl',
    'journalctl',
  ],
  maison: M,
  accueil: 'message_de_yasmine.txt',
  final: 'fin',
  motDePasse: 'fablab-2027',
  comptes,
  etat: () => {
    // Le pare-feu de la fin du chapitre 3, plus le port de la galerie.
    const pf = nouveauPareFeu();
    pf.actif = true;
    pf.regles = [22, 8080, 8081, 8082].map((p) => ({ action: 'allow', vers: p === 22 ? 'OpenSSH' : `${p}/tcp`, ports: [p], de: null }));
    return {
      ufw: pf,
      systemd: nouveauSystemd('fabrique', Date.UTC(2027, 3, 28, 7, 5, 0), Date.UTC(2027, 4, 2, 9, 30, 0), {
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
      processus: [
        { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.3, commande: '/sbin/init' },
        { pid: 610, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
        { pid: 702, utilisateur: 'root', cpu: 0.4, mem: 2.1, commande: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
      ],
      montages: [{ chemin: '/', capacite: 20_000_000_000, nom: '/dev/vda1' }],
      docker: { ...etatDocker(), noms: ['fabrique', 'fabrique.example', '192.0.2.15'] },
    };
  },
  initialiser: (j) => {
    const e = etat(j);
    // L'outilthèque, bien faite : son image a un compte à elle (USER outil).
    const outil: Conteneur = {
      id: identifiant('conteneur-outiltheque-4'),
      nom: 'outiltheque',
      image: 'registre.example/outiltheque:1.5',
      etat: 'created',
      code: 0,
      ports: [{ ip: '0.0.0.0', hote: 8080, conteneur: 8080 }],
      montages: [{ type: 'volume', source: 'outiltheque-donnees', cible: '/var/lib/outiltheque', lectureSeule: false }],
      env: {},
      redemarrage: 'unless-stopped',
      cree: Date.UTC(2027, 3, 3, 10, 20, 0),
      debut: 0,
      fin: 0,
      couche: {},
      journal: [],
      ip: '172.17.0.2',
    };
    e.conteneurs.push(outil);
    ecrireDans(j, outil, '/var/lib/outiltheque/outiltheque.db', ecrireBase({ schema: 4, prets: [] }));
    demarrerDocker(j);
    // La galerie, lancée par Yasmine avec docker compose up -d (en root).
    monter(j as Shell, lireProjet(j, PROJET), () => true);
    majDisque(j);
    sd(j).journal = sd(j).journal.filter((x) => x.unite !== 'docker.service');
  },
  // Docker relance la galerie quand elle tombe (restart: unless-stopped).
  apresCommande: (j) => relancerEnBoucle(j),
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const photo = (taille: number) => f('JFIF', { lignes: true, proprio: 'root', taille });
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: f('fabrique', { lignes: true, proprio: 'root' }) }),
      home: lieu({
        vous: d({ 'message_de_yasmine.txt': f(t('pleins-pouvoirs-message-de-yasmine')), 'mot_de_rania.txt': f(t('pleins-pouvoirs-mot-de-rania')) }),
        yasmine: d({}, undefined, { proprio: 'yasmine', mode: 'rwxr-x---' }),
      }),
      srv: lieu({
        galerie: lieu({
          'compose.yaml': f(COMPOSE, { lignes: true, proprio: 'root' }),
          'LISEZMOI.txt': f(t('pleins-pouvoirs-lisezmoi'), { proprio: 'root' }),
          // Créé par Docker au premier lancement (le dossier n'existait pas) : à root.
          photos: lieu(Object.fromEntries(NOMS_PHOTOS.map((p, i) => [p, photo(1_800_000 + i * 137_000)]))),
        }),
      }),
      var: lieu({ lib: lieu({ docker: lieu({}, { proprio: 'root', mode: 'rwx--x---' }) }) }),
    });
  },
  evenements: [
    {
      id: 'root',
      condition: (j) => enRoot(j) && (j.derniere.sortie.includes('uid=0(root)') || /^root\s+\d+.*node serveur\.js/m.test(j.derniere.sortie)),
      message: (j) => j.t('pleins-pouvoirs-evenement-root'),
    },
    {
      id: 'inconnu',
      condition: (j) => [j.derniere.sortie, ...j.derniere.erreurs].some((x) => x.includes('no matching entries in passwd file')),
      message: (j) => j.t('pleins-pouvoirs-evenement-inconnu'),
    },
    { id: 'eacces', condition: (j) => enErreur(j), message: (j) => j.t('pleins-pouvoirs-evenement-eacces') },
    {
      id: 'uid-1000',
      condition: (j) => tourne(j) && uid(j, galerie(j)) === 1000 && !yasminePeut(j),
      message: (j) => j.t('pleins-pouvoirs-evenement-uid-1000'),
    },
    { id: 'ouvert-a-tous', condition: (j) => ouvertATous(j), message: (j) => j.t('pleins-pouvoirs-evenement-ouvert-a-tous') },
    {
      id: 'photos-perdues',
      condition: (j) => !toutesLesPhotos(j),
      message: (j) => j.t('pleins-pouvoirs-evenement-photos-perdues', { nombre: NOMS_PHOTOS.length - photosPresentes(j).length }),
    },
    {
      id: 'fin',
      condition: (j) => tourne(j) && !enRoot(j) && repond(j) && toutesLesPhotos(j) && yasminePeut(j) && !ouvertATous(j),
      message: (j) => j.t('pleins-pouvoirs-evenement-fin'),
    },
  ],
};
