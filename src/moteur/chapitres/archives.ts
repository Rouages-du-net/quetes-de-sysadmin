// Histoire « Les Archives » : sauver le fonds d'une bibliothèque de quartier
// sur une petite clé USB, avec du, df, find et tar. Les tailles des images,
// sons et PDF sont simulées (champ `taille`).

import { d, f, type Chapitre, type Fichier } from '../monde';

const M = '/home/vous';
const CLE = '/media/cle';
const Mo = 1024 * 1024;

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
  titre: 'Les Archives',
  resume: 'Mesurer, trier et empaqueter un fonds pour le sauver sur une clé : du, df, find, tar.',
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'du', 'df', 'find', 'tar', 'cp', 'mv', 'rm', 'mkdir'],
  maison: M,
  accueil: 'lettre_de_rosa.txt',
  final: 'sauve',
  etat: () => ({
    montages: [
      { chemin: CLE, capacite: 64 * Mo, nom: '/dev/sdb1' },
      { chemin: '/', capacite: 20 * 1024 * Mo, nom: '/dev/sda1' },
    ],
  }),
  creerMonde: () =>
    d({
      home: d({
        vous: d({
          'lettre_de_rosa.txt': f(`
Une lettre de Rosa, bibliothécaire de la bibliothèque du quartier :

« Le serveur de la bibliothèque sera éteint ce soir à minuit, définitivement :
la mairie ne le paie plus. Tout notre fonds est dessus : les manuscrits
donnés par les habitant·es, les vieux plans, la gazette, les enregistrements
du marché.

Je n'ai qu'une vieille clé USB de 64 Mo, branchée sur /media/cle. Peux-tu y
mettre le fonds, dans UNE SEULE archive compressée ? Une archive est plus
facile à transporter, et la compression gagne de la place.

Attention, ce n'est pas tout de copier : il faut que tout tienne. Mesure
d'abord. Mes notes sont dans cat notes_rosa.txt »
`),
          'notes_rosa.txt': f(`
NOTES DE ROSA

Combien de place ?
  du -sh fonds          la taille totale du dossier fonds
  du -h fonds           la taille de chaque sous-dossier
  df -h /media/cle      la place libre sur la clé

Chercher des fichiers, partout dans un dossier et ses sous-dossiers :
  find fonds -name "*.pdf"      tous les PDF
  find fonds -name "*.tmp"      tous les fichiers temporaires
Les fichiers .tmp sont des restes de nos logiciels de numérisation : on peut
les jeter sans regret. Pour effacer tout ce que find trouve, on ajoute
-delete à la fin (relis bien la commande avant de taper Entrée !).

Faire une archive compressée (tar = tape archive, z = gzip) :
  tar -czf /media/cle/fonds.tar.gz fonds
Vérifier ce qu'elle contient :
  tar -tzf /media/cle/fonds.tar.gz
`),
          fonds: d({
            'lisezmoi.txt': f('Fonds de la bibliothèque du quartier. Dons des habitant·es, 1890-2026.'),
            manuscrits: d({
              'journal_de_marie.txt': texte('Journal de Marie, couturière, 1931-1940 (transcription).', 3),
              'lettres_1914.txt': texte('Lettres d’Ahmed à sa sœur, 1914-1918 (transcription).', 2.5),
              'recettes_du_quartier.txt': texte('Recettes collectées au marché, 1975-2020.', 1.5),
            }),
            cartes: d({
              'plan_1890.png': binaire('(image PNG)', 6),
              'plan_1954.png': binaire('(image PNG)', 5),
              'rendu.tmp': binaire('(fichier temporaire)', 30),
            }),
            presse: d({
              'gazette_1936.pdf': binaire('(document PDF)', 4),
              'gazette_1968.pdf': binaire('(document PDF)', 4.5),
              'export.tmp': binaire('(fichier temporaire)', 40),
            }),
            enregistrements: d({
              'chants_du_marche.ogg': binaire('(son Ogg Vorbis)', 12),
              'entretien_fatou.ogg': binaire('(son Ogg Vorbis)', 15),
              'brut.tmp': binaire('(fichier temporaire)', 50),
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
      message: `
Le fonds pèse bien plus que les 64 Mo de la clé. Mais regarde où se trouve
la place : quelques gros fichiers… Rosa parlait de fichiers temporaires.
find fonds -name "*.tmp"
`,
    },
    {
      id: 'plein',
      condition: (j) => j.derniere.erreurs.some((e) => e.includes('Aucun espace disponible')),
      message: `
« Aucun espace disponible sur le périphérique » : l'archive ne tient pas sur
la clé. Il faut faire de la place AVANT : que contient le fonds qui n'est
pas précieux ? (du -h fonds, puis find fonds -name "*.tmp")
`,
    },
    {
      id: 'tmp',
      condition: (j) => j.derniere.commandes[0]?.[0] === 'find' && j.derniere.sortie.includes('brut.tmp'),
      message: `
Trois fichiers temporaires, 120 Mo à eux trois ! Rosa dit qu'on peut les
jeter. find peut les effacer d'un coup, avec -delete à la fin :

  find fonds -name "*.tmp" -delete

(Relis bien avant Entrée : sans le -name, find effacerait TOUT le fonds.)
`,
    },
    {
      id: 'perte',
      condition: (j) => !archiveComplete(j) && PRECIEUX.some((p) => !j.existe(`${M}/${p}`)),
      message: `
Aïe : un fichier précieux du fonds a disparu, et il n'y a pas de corbeille…
Dans la vraie vie, c'est pour cela qu'on fait des sauvegardes AVANT de faire
le ménage. Ici, tu peux recommencer le chapitre (lien sous le terminal).
`,
    },
    {
      id: 'menage',
      condition: (j) => j.existe(`${M}/fonds`) && !['cartes/rendu.tmp', 'presse/export.tmp', 'enregistrements/brut.tmp'].some((t) => j.existe(`${M}/fonds/${t}`)),
      message: `
Le ménage est fait. Vérifie avec du -sh fonds, puis crée l'archive
compressée directement sur la clé :

  tar -czf /media/cle/fonds.tar.gz fonds
`,
    },
    {
      id: 'sauve',
      condition: (j) => !!archiveComplete(j),
      message: (j) => {
        const a = archiveComplete(j)!;
        const mo = ((a.taille ?? 0) / Mo).toFixed(1).replace('.', ',');
        return `
L'archive est sur la clé : ${mo} Mo, avec tout le fonds. Les textes ont été
fortement compressés ; les images, les sons et les PDF, déjà compressés,
presque pas. Pour vérifier son contenu sans l'ouvrir :
tar -tzf /media/cle/fonds.tar.gz

Rosa débranche la clé à 23 h 58. « Tout y est. Merci ! »

FIN DE L'HISTOIRE « LES ARCHIVES ».

Tu sais maintenant mesurer (du, df), chercher et trier (find, -delete) et
empaqueter (tar). Et une règle d'or des archivistes : une seule copie, ce
n'est pas une sauvegarde. Rosa en fera une deuxième dès demain.
`;
      },
    },
  ],
};
