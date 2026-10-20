// Histoire « Les Archives » : sauver le fonds d'une bibliothèque de quartier
// sur une petite clé USB, avec du, df, find et tar. Les tailles des images,
// sons et PDF sont simulées (champ `taille`).

import { d, f, type Chapitre, type Fichier } from '../monde';

const M = '/home/vous';
const CLE = '/media/cle';
const Mo = 1024 * 1024;
// Les commandes qui écrivent sur la clé (bash : une redirection >).
const ECRIVAINS = ['tar', 'cp', 'mv', 'mkdir', 'bash'];

const binaire = (description: string, taille: number) => f(description, { taille: Math.round(taille * Mo) });
const texte = (t: string, taille: number) => f(t, { taille: Math.round(taille * Mo), lignes: true });

// Les fichiers qu'il faut absolument sauver (chemins relatifs à ~).
const PRECIEUX = [
  'fonds/manuscrits/journal_de_marie.txt',
  'fonds/manuscrits/lettres_1914.txt',
  'fonds/manuscrits/recettes_du_quartier.txt',
  'fonds/cartes/plan_1890.png',
  'fonds/cartes/plan_1954.png',
  'fonds/presse/gazette_1936.pdf',
  'fonds/presse/gazette_1968.pdf',
  'fonds/enregistrements/chants_du_marche.ogg',
  'fonds/enregistrements/entretien_fatou.ogg',
];

// Une archive tar sur la clé qui contient tous les fichiers précieux.
function archiveComplete(j: { trouver: (c: string) => any }): Fichier | null {
  const cle = j.trouver(CLE);
  if (cle?.type !== 'dossier') return null;
  for (const n of Object.values(cle.enfants) as Fichier[]) {
    if (n.type !== 'fichier' || !n.archive) continue;
    const chemins = Object.keys(n.archive.fichiers).map((c) => c.replace(/^(\.\/|~\/|home\/vous\/)/, ''));
    if (PRECIEUX.every((p) => chemins.some((c) => c === p || c.endsWith('/' + p)))) return n;
  }
  return null;
}

export const archives: Chapitre = {
  id: 'archives',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'du', 'df', 'find', 'tar', 'cp', 'mv', 'rm', 'mkdir'],
  maison: M,
  accueil: 'lettre_de_rosa.txt',
  noms: true,
  final: 'sauve',
  etat: () => ({
    montages: [
      { chemin: CLE, capacite: 64 * Mo, nom: '/dev/sdb1' },
      { chemin: '/', capacite: 20 * 1024 * Mo, nom: '/dev/sda1' },
    ],
  }),
  creerMonde: (t) =>
    d({
      home: d({
        vous: d({
          'lettre_de_rosa.txt': f(t('archives-lettre-de-rosa')),
          'notes_rosa.txt': f(t('archives-notes-rosa')),
          fonds: d({
            'lisezmoi.txt': f(t('archives-lisezmoi')),
            manuscrits: d({
              'journal_de_marie.txt': texte(t('archives-journal-de-marie'), 3),
              'lettres_1914.txt': texte(t('archives-lettres-1914'), 2.5),
              'recettes_du_quartier.txt': texte(t('archives-recettes-du-quartier'), 1.5),
            }),
            cartes: d({
              'plan_1890.png': binaire(t('archives-image-png'), 6),
              'plan_1954.png': binaire(t('archives-image-png'), 5),
              'rendu.tmp': binaire(t('archives-fichier-temporaire'), 30),
            }),
            presse: d({
              'gazette_1936.pdf': binaire(t('archives-document-pdf'), 4),
              'gazette_1968.pdf': binaire(t('archives-document-pdf'), 4.5),
              'export.tmp': binaire(t('archives-fichier-temporaire'), 40),
            }),
            enregistrements: d({
              'chants_du_marche.ogg': binaire(t('archives-son-ogg'), 12),
              'entretien_fatou.ogg': binaire(t('archives-son-ogg'), 15),
              'brut.tmp': binaire(t('archives-fichier-temporaire'), 50),
            }),
          }),
        }),
      }),
      media: d({ cle: d({}) }),
    }),
  evenements: [
    {
      id: 'mesure',
      condition: (j) => j.derniere.commandes[0]?.[0] === 'du',
      message: (j) => j.t('archives-evenement-mesure'),
    },
    {
      id: 'plein',
      condition: (j) => j.derniere.erreurs.some((e) => ECRIVAINS.some((commande) => e === j.t('erreur-espace', { commande }))),
      message: (j) => j.t('archives-evenement-plein'),
    },
    {
      id: 'tmp',
      condition: (j) => j.derniere.commandes[0]?.[0] === 'find' && j.derniere.sortie.includes('brut.tmp'),
      message: (j) => j.t('archives-evenement-tmp'),
    },
    {
      id: 'perte',
      condition: (j) => !archiveComplete(j) && PRECIEUX.some((p) => !j.existe(`${M}/${p}`)),
      message: (j) => j.t('archives-evenement-perte'),
    },
    {
      id: 'menage',
      condition: (j) => j.existe(`${M}/fonds`) && !['cartes/rendu.tmp', 'presse/export.tmp', 'enregistrements/brut.tmp'].some((t) => j.existe(`${M}/fonds/${t}`)),
      message: (j) => j.t('archives-evenement-menage'),
    },
    {
      id: 'sauve',
      condition: (j) => !!archiveComplete(j),
      message: (j) => j.t('archives-evenement-sauve', { taille: (archiveComplete(j)!.taille ?? 0) / Mo }),
    },
  ],
};
