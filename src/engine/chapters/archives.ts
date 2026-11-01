// Histoire « Les Archives » : sauver le fonds d'une bibliothèque de quartier
// sur une petite clé USB, avec du, df, find et tar. Les tailles des images,
// sons et PDF sont simulées (champ `taille`).

import { path, d, f, name, type Chapter, type File } from '../world';
import type { Game } from '../shell';

const M = '/home/vous';
const KEY = '/media/cle';
const Mo = 1024 * 1024;
// Les commandes qui écrivent sur la clé (bash : une redirection >).
const WRITERS = ['tar', 'cp', 'mv', 'mkdir', 'bash'];

const binary = (description: string, size: number) => f(description, { size: Math.round(size * Mo) });
const text = (t: string, size: number) => f(t, { size: Math.round(size * Mo), lines: true });

// Les fichiers qu'il faut absolument sauver (chemins relatifs à ~).
const PRECIOUS = [
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
function archiveComplete(j: Pick<Game, 'find' | 'player' | 't'>): File | null {
  const key = j.find(path(j.t, KEY));
  if (key?.type !== 'dossier') return null;
  for (const n of Object.values(key.children) as File[]) {
    if (n.type !== 'fichier' || !n.archive) continue;
    const paths = Object.keys(n.archive.files).map((c) => c.replace(new RegExp(`^(\\./|~/|home/${j.player}/)`), ''));
    if (PRECIOUS.map((p) => path(j.t, p)).every((p) => paths.some((c) => c === p || c.endsWith('/' + p)))) return n;
  }
  return null;
}

export const archives: Chapter = {
  id: 'archives',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'du', 'df', 'find', 'tar', 'cp', 'mv', 'rm', 'mkdir'],
  home: M,
  welcome: 'lettre_de_rosa.txt',
  names: true,
  final: 'sauve',
  state: (t) => ({
    montages: [
      { path: path(t, KEY), capacity: 64 * Mo, name: '/dev/sdb1' },
      { path: '/', capacity: 20 * 1024 * Mo, name: '/dev/sda1' },
    ],
  }),
  createWorld: (t) =>
    d({
      home: d({
        vous: d({
          'lettre_de_rosa.txt': f(t('archives-lettre-de-rosa')),
          'notes_rosa.txt': f(t('archives-notes-rosa')),
          fonds: d({
            'lisezmoi.txt': f(t('archives-lisezmoi')),
            manuscrits: d({
              'journal_de_marie.txt': text(t('archives-journal-de-marie'), 3),
              'lettres_1914.txt': text(t('archives-lettres-1914'), 2.5),
              'recettes_du_quartier.txt': text(t('archives-recettes-du-quartier'), 1.5),
            }),
            cartes: d({
              'plan_1890.png': binary(t('archives-image-png'), 6),
              'plan_1954.png': binary(t('archives-image-png'), 5),
              'rendu.tmp': binary(t('archives-fichier-temporaire'), 30),
            }),
            presse: d({
              'gazette_1936.pdf': binary(t('archives-document-pdf'), 4),
              'gazette_1968.pdf': binary(t('archives-document-pdf'), 4.5),
              'export.tmp': binary(t('archives-fichier-temporaire'), 40),
            }),
            enregistrements: d({
              'chants_du_marche.ogg': binary(t('archives-son-ogg'), 12),
              'entretien_fatou.ogg': binary(t('archives-son-ogg'), 15),
              'brut.tmp': binary(t('archives-fichier-temporaire'), 50),
            }),
          }),
        }),
      }),
      media: d({ cle: d({}) }),
    }),
  events: [
    {
      id: 'mesure',
      condition: (j) => j.last.commands[0]?.[0] === 'du',
      message: (j) => j.t('archives-evenement-mesure'),
    },
    {
      id: 'plein',
      condition: (j) => j.last.errors.some((e) => WRITERS.some((command) => e === j.t('erreur-espace', { commande: command }))),
      message: (j) => j.t('archives-evenement-plein'),
    },
    {
      id: 'tmp',
      condition: (j) => j.last.commands[0]?.[0] === 'find' && j.last.output.includes(name(j.t, 'brut.tmp')),
      message: (j) => j.t('archives-evenement-tmp'),
    },
    {
      id: 'perte',
      condition: (j) => !archiveComplete(j) && PRECIOUS.some((p) => !j.exists(path(j.t, `${M}/${p}`))),
      message: (j) => j.t('archives-evenement-perte'),
    },
    {
      id: 'menage',
      condition: (j) => j.exists(path(j.t, `${M}/fonds`)) && !['cartes/rendu.tmp', 'presse/export.tmp', 'enregistrements/brut.tmp'].some((t) => j.exists(path(j.t, `${M}/fonds/${t}`))),
      message: (j) => j.t('archives-evenement-menage'),
    },
    {
      id: 'sauve',
      condition: (j) => !!archiveComplete(j),
      message: (j) => j.t('archives-evenement-sauve', { taille: (archiveComplete(j)!.size ?? 0) / Mo }),
    },
  ],
};
