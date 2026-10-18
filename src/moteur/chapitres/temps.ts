// Histoire « La Machine à remonter le temps » : git, pour garder l'historique
// d'un texte et revenir en arrière. Inès, romancière, a abîmé son manuscrit ;
// heureusement, il est suivi par git. Ses poèmes, eux, ne le sont pas.

import { d, f, type Chapitre } from '../monde';
import { nouveauCommit, type Commit, type Depot } from '../commandes/git';

const M = '/home/vous';
const ROMAN = `${M}/roman`;
const POEMES = `${M}/poemes`;
const AUTRICE = 'Inès Haddad <ines@example.org>';

const CH1 = `CHAPITRE 1 — LE DÉPART

Le car de nuit quitta Marseille à vingt-deux heures.
Yasmina serrait contre elle la lettre de sa grand-mère.
« Va voir le phare, avait écrit Mamie Zohra. Tout y est. »`;

const CH2 = `CHAPITRE 2 — LA TRAVERSÉE

Le bateau pour l'île partait à l'aube.
Sur le pont, un vieux marin réparait un filet en chantonnant.
Il connaissait le phare : « Personne n'y monte plus depuis 1962. »`;

const CH3 = `CHAPITRE 3 — LE PHARE

La porte céda au troisième coup d'épaule.
Tout en haut, sous la lanterne, une boîte en fer attendait.
Dedans : des cahiers, couverts de l'écriture serrée de Zohra.`;

const DEGATS = `CHAPITRE 3 — LE PHARE

jjjjjjjjjjjjjjjjjjjjjjkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk;;;;;;;;;;;;;
mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm`;

const V1 = CH1;
const V2 = `${CH1}\n\n${CH2}`;
export const V3 = `${CH1}\n\n${CH2}\n\n${CH3}`;
const V4 = `${CH1}\n\n${CH2}\n\n${DEGATS}`;

const POEMES_INES: Record<string, string> = {
  'mer.txt': 'La mer recoud\nles bords du monde\navec du fil d’écume.',
  'phare.txt': 'Un œil qui tourne\ndans la nuit des marins :\nil ne dort jamais.',
  'zohra.txt': 'Ma grand-mère parlait\ntrois langues et demie,\nla demie, c’était le silence.',
};

function historique(): Depot {
  const commits: Commit[] = [];
  const ajouter = (message: string, date: string, texte: string) =>
    commits.push(nouveauCommit(commits.at(-1) ?? null, message, AUTRICE, date, { 'roman.txt': texte }));
  ajouter('Chapitre 1 : le départ', 'Mon Oct 5 22:14:09 2026 +0200', V1);
  ajouter('Chapitre 2 : la traversée', 'Thu Oct 8 21:40:33 2026 +0200', V2);
  ajouter('Chapitre 3 : le phare', 'Sun Oct 11 23:02:51 2026 +0200', V3);
  ajouter('Sauvegarde du matin', 'Mon Oct 12 07:55:12 2026 +0200', V4);
  return { commits, index: { 'roman.txt': V4 } };
}

export const temps: Chapitre = {
  id: 'manuscrit',
  numero: 1,
  titre: 'La Machine à remonter le temps',
  resume: 'Voyager dans les versions d’un texte avec git : log, diff, restore, add, commit, init.',
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'git'],
  maison: M,
  accueil: 'message_d_ines.txt',
  final: 'fin',
  etat: () => ({
    git: { [ROMAN]: historique() },
    auteur: AUTRICE,
    date: 'Tue Oct 13 10:30:00 2026 +0200',
  }),
  creerMonde: () =>
    d({
      home: d({
        vous: d({
          'message_d_ines.txt': f(`
Un message d'Inès, ton amie romancière :

« Catastrophe ! Ce matin, mon chat a marché sur le clavier pendant que mon
roman était ouvert… et j'ai enregistré sans regarder. Le chapitre 3 n'est
plus qu'une bouillie de lettres. Et pire : j'ai fait un commit juste après !

Heureusement, mon dossier roman est suivi par git, une machine à remonter
le temps pour les fichiers : chaque « commit » est une photo de tous les
fichiers, avec un message et une date. Tu peux m'aider à retrouver mon
chapitre ? Commence par jeter un œil :

  cd roman
  cat roman.txt
  git log

Et pendant que tu y es… mes poèmes, dans le dossier poemes, ne sont suivis
par rien du tout. Si mon chat recommence, je perds tout. »
`),
          roman: d({
            '.git': d({ HEAD: f('ref: refs/heads/main', { lignes: true }) }),
            'roman.txt': f(V4, { lignes: true }),
          }),
          poemes: d(Object.fromEntries(Object.entries(POEMES_INES).map(([nom, texte]) => [nom, f(texte, { lignes: true })]))),
          'aide_git.txt': f(`
AIDE-MÉMOIRE GIT (voir aussi :  man git)

  git log --oneline          l'historique, un commit par ligne (le plus récent en haut)
  git show ID                ce qu'un commit a changé
  git diff ID roman.txt      les différences entre ce commit et le fichier actuel
                             (- : la ligne d'avant, + : la ligne de maintenant)
  git restore --source=ID roman.txt
                             remet roman.txt comme il était dans ce commit
  git status                 ce qui a changé depuis le dernier commit
  git add roman.txt          prépare le fichier pour le prochain commit
  git commit -m "message"    prend la photo, avec un message

Un commit se désigne par le début de son identifiant (7 caractères suffisent),
ou par HEAD (le dernier), HEAD~1 (l'avant-dernier), HEAD~2…

Pour commencer à suivre un dossier :  git init , puis  git add .  (le point =
tout le dossier) et  git commit -m "…"
`),
        }),
      }),
    }),
  evenements: [
    {
      id: 'historique',
      condition: (j) => j.derniere.commandes[0]?.[0] === 'git' && j.derniere.commandes[0]?.[1] === 'log',
      message: `
Quatre commits, du plus récent au plus ancien. Le dernier, « Sauvegarde du
matin », est celui du chat. L'avant-dernier, « Chapitre 3 : le phare », date
d'avant la catastrophe. Pour voir ce que le chat a changé : git show HEAD
`,
    },
    {
      id: 'restaure',
      condition: (j) => j.lire(`${ROMAN}/roman.txt`) === V3,
      message: `
Le chapitre 3 est de retour ! Le fichier a voyagé dans le temps.
Mais pour l'instant, seule ta copie de travail est réparée : le dernier
commit contient toujours la bouillie. Regarde git status , puis enregistre
la version réparée :

  git add roman.txt
  git commit -m "Restaure le chapitre 3 (merci le chat)"
`,
    },
    {
      id: 'sauve',
      condition: (j) => {
        const depot: Depot = j.etat.git[ROMAN];
        return depot.commits.length > 4 && depot.commits.at(-1)!.fichiers['roman.txt'] === V3;
      },
      message: `
Commit enregistré. Remarque : on n'a rien effacé de l'histoire. Le commit
du chat est toujours là (git log) ; on a simplement ajouté une nouvelle
photo, réparée, par-dessus. Avec git, on ne perd presque jamais rien.

Reste les poèmes d'Inès : dans le dossier poemes, transforme-le en dépôt
(git init), puis prends une première photo de tous les poèmes.
`,
    },
    {
      id: 'poemes',
      condition: (j) => {
        const depot: Depot | undefined = j.etat.git?.[POEMES];
        const c = depot?.commits.at(-1);
        return !!c && Object.keys(POEMES_INES).every((nom) => nom in c.fichiers);
      },
      message: `Les trois poèmes sont désormais dans un commit : même si le chat revient, ils sont à l'abri dans l'historique.`,
    },
    {
      id: 'fin',
      condition: (j) => j.drapeaux.has('sauve') && j.drapeaux.has('poemes'),
      message: `
Inès te répond : « Mon chapitre ! Mes poèmes ! Tu es une magicienne, un
magicien, enfin… une personne formidable. »

FIN DE L'HISTOIRE « LA MACHINE À REMONTER LE TEMPS ».

Tu sais maintenant lire l'histoire d'un dossier (git log, git show), voir
les différences (git diff), revenir à une version (git restore) et prendre
de nouvelles photos (git add, git commit). git a été créé en 2005 par
Linus Torvalds, pour développer le noyau Linux. On s'en sert aussi pour des
livres, des thèses, des sites web… comme celui que tu lis.
`,
    },
  ],
};
