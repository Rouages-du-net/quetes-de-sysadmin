// Histoire « La Maison des associations » — chapitre « Les transferts » :
// rapatrier le rapport d'activité du wiki sur son poste (scp, qui rebondit
// par maison grâce au raccourci du chapitre précédent), puis mettre la
// sauvegarde du dossier partagé à jour sur archives (rsync, depuis maison,
// avec la clé de sauvegarde que Gaspard a créée pour ça).
// Piège réel : la barre oblique finale de la source de rsync (/srv/partage/
// copie le CONTENU ; /srv/partage copie le dossier lui-même, qui se retrouve
// dans /srv/sauvegardes/partage/partage).
// Objectif vérifié sur l'état : le rapport (intact) sur le poste, et chaque
// fichier de /srv/partage présent, identique, au même endroit sur archives,
// sans le dossier copié en trop (rsync --delete le retire).
// Sources : https://man.openbsd.org/scp, https://download.samba.org/pub/rsync/rsync.1

import { chemin, d, f, nom, type Chapitre, type Dossier, type Noeud } from '../monde';
import type { Jeu, Shell } from '../shell';
import { genererCle } from '../acces';
import { chargerSshd, comptesMaison, dossierSsh, etatMaison, hoteInterne, M, mondeMaison, MOT_DE_PASSE } from './maison';

const RAPPORT = 'rapport-2027.pdf';
const PARTAGE = '/srv/partage';
const SAUVEGARDE = '/srv/sauvegardes/partage';
// Un PDF (son début) : le contenu exact sert à vérifier que la copie est intacte.
const PDF = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 12 >>\nendobj';
// La clé de sauvegarde de maison vers archives (une clé par usage, pas celle d'une personne).
const CLE_SAUVEGARDE = genererCle('maison-sauvegarde', 'sauvegarde@maison');

const vous = { proprio: 'vous' };
const fichier = (contenu: string) => f(contenu, { lignes: true, proprio: 'vous' });

// Le dossier partagé de maison : comptes rendus, affiches, planning.
const partage = (t: (id: string) => string): Dossier =>
  d(
    {
      'comptes-rendus': d(
        { 'ag-2026.txt': fichier(t('transferts-cr-ag-2026')), 'ca-2027-09.txt': fichier(t('transferts-cr-ca-2027-09')) },
        undefined,
        vous,
      ),
      affiches: d({ 'fete-des-voisins.pdf': fichier('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj') }, undefined, vous),
      'planning-salles.txt': fichier(t('transferts-planning')),
    },
    undefined,
    vous,
  );

// Tous les fichiers d'un dossier, par chemin relatif.
function fichiers(j: Jeu, racine: string): Record<string, string> {
  const res: Record<string, string> = {};
  const parcourir = (n: Noeud, chemin: string) => {
    if (n.type === 'dossier') for (const [nom, e] of Object.entries(n.enfants)) parcourir(e, chemin ? `${chemin}/${nom}` : nom);
    else res[chemin] = j.lire(`${racine}/${chemin}`) ?? '';
  };
  const n = j.trouver(racine);
  if (n?.type === 'dossier') parcourir(n, '');
  return res;
}

const archives = (j: Jeu) => (j as Shell).interne('archives')!;
const poste = (j: Jeu) => (j.etat.poste as (() => Shell) | undefined)?.();

// Le rapport, intact, quelque part dans la maison du poste.
const rapportSurLePoste = (j: Jeu) => {
  const p = poste(j);
  if (!p) return false;
  const tous = fichiers(p, p.resoudre('~'));
  return Object.entries(tous).some(([c, contenu]) => c.split('/').at(-1) === nom(j.t, RAPPORT) && contenu === PDF);
};

const sauvegardeAJour = (j: Jeu) => {
  const copie = fichiers(archives(j), chemin(j.t, SAUVEGARDE));
  return Object.entries(fichiers(j, chemin(j.t, PARTAGE))).every(([c, contenu]) => copie[c] === contenu);
};
// La copie en trop : /srv/sauvegardes/partage/partage (dans la langue).
const imbrique = (j: Jeu) => chemin(j.t, `${SAUVEGARDE}/partage`);

export const transferts: Chapitre = {
  id: 'transferts',
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
    'find',
    'du',
    'diff',
    'id',
    'whoami',
    'hostname',
    'rm',
    'mv',
    'ssh',
    'scp',
    'rsync',
  ],
  maison: M,
  accueil: 'courriel_yasmine.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesMaison,
  clesDuJoueur: true,
  surveillePoste: true,
  etat: () => etatMaison(),
  initialiser: chargerSshd,
  hotes: {
    wiki: hoteInterne('wiki', '10.20.0.11', {
      commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'du', 'id', 'whoami', 'hostname'],
      plus: () => ({
        srv: d({ wiki: d({ exports: d({ [RAPPORT]: f(PDF, { lignes: true, proprio: 'www-data', mode: 'rw-r--r--' }) }) }) }, undefined, {
          proprio: 'root',
        }),
      }),
    }),
    archives: hoteInterne('archives', '10.20.0.12', {
      commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'du', 'diff', 'id', 'whoami', 'hostname', 'rm', 'mv'],
      maison: () => ({ '.ssh': dossierSsh({ authorized_keys: f(CLE_SAUVEGARDE.publique, { lignes: true, proprio: 'vous', mode: 'rw-------' }) }) }),
      // La sauvegarde de l'an dernier : un seul compte rendu.
      plus: (t) => ({
        srv: d(
          {
            sauvegardes: d(
              { partage: d({ 'comptes-rendus': d({ 'ag-2026.txt': fichier(t('transferts-cr-ag-2026')) }, undefined, vous) }, undefined, vous) },
              undefined,
              vous,
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      }),
    }),
  },
  creerMonde: (t) =>
    mondeMaison({
      motsDePasse: 'no',
      maison: {
        'courriel_yasmine.txt': f(t('transferts-courriel-yasmine')),
        '.ssh': dossierSsh({
          config: f('Host archives\n    IdentityFile ~/.ssh/id_sauvegarde', { lignes: true, proprio: 'vous', mode: 'rw-r--r--' }),
          id_sauvegarde: f(CLE_SAUVEGARDE.prive, { lignes: true, proprio: 'vous', mode: 'rw-------' }),
          'id_sauvegarde.pub': f(CLE_SAUVEGARDE.publique, { lignes: true, proprio: 'vous', mode: 'rw-r--r--' }),
        }),
      },
      plus: { srv: d({ partage: partage(t) }, undefined, { proprio: 'root' }) },
    }),
  evenements: [
    { id: 'rapport', condition: rapportSurLePoste, message: (j) => j.t('transferts-evenement-rapport') },
    {
      id: 'imbrique',
      condition: (j) => archives(j).existe(imbrique(j)),
      message: (j) => j.t('transferts-evenement-imbrique', { dossier: imbrique(j) }),
    },
    {
      id: 'sauvegarde',
      condition: (j) => sauvegardeAJour(j) && !archives(j).existe(imbrique(j)),
      message: (j) => j.t('transferts-evenement-sauvegarde'),
    },
    {
      id: 'fin',
      condition: (j) => rapportSurLePoste(j) && sauvegardeAJour(j) && !archives(j).existe(imbrique(j)),
      message: (j) => j.t('transferts-evenement-fin'),
    },
  ],
};
