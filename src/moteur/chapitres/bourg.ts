// Chapitre 2 — Le Bourg : grep, rm, touch, cp, mkdir. Notre propre histoire
// et nos propres énigmes, dans la suite de L'Île du Phare.

import { d, f, type Chapitre } from '../monde';

const M = '/Quai';
const BOULANGERIE = `${M}/Boulangerie`;
const ATELIER = `${M}/Atelier`;
const RUELLE = `${M}/Ruelle`;
const COUR = `${RUELLE}/Cour`;
const EGOUT = `${COUR}/Egout`;
const CLASSE = `${M}/Ecole/Classe`;

const affiche = (lignes: string[]) => f(lignes.join('\n'), { lignes: true });

export const bourg: Chapitre = {
  id: 'bourg',
  numero: 2,
  titre: 'Le Bourg',
  resume: 'Chercher, créer, copier, effacer : grep, touch, cp, mkdir, rm.',
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir'],
  maison: M,
  accueil: 'crieur.txt',
  final: 'nour',
  creerMonde: () =>
    d({
      Quai: d({
        'crieur.txt': f(`
Le bateau de la capitaine Ana te dépose sur le quai d'un bourg. Un crieur
public agite sa cloche.

« Oyez ! L'Effaceur est passé par le Bourg ! La boulangerie n'a plus de
levain, l'horloge est arrêtée, l'école n'a plus de classe, et la petite
Nour a disparu ! Qui nous aidera ? »

Il te tend un parchemin :  cat parchemin_des_sorts.txt
`),
        'parchemin_des_sorts.txt': f(`
LE PARCHEMIN DES SORTS — cinq nouvelles commandes

  grep motif fichier    trouve les lignes qui contiennent un motif
  touch nom             crée un objet (un fichier vide)
  cp source dest        copie un objet (copy)
  mkdir Nom             crée un lieu (make directory)
  rm objet              efface un objet (remove) — pour toujours !

Rappel : « man grep » (ou man cp, man rm…) donne le mode d'emploi, et
« grep --help » un résumé. Tu ne sais plus quelle commande copie ?
« man -k copie » cherche dans tous les manuels.

Les gens du Bourg ont besoin de toi : la Boulangerie, l'Atelier, l'Ecole,
la Mairie… Commence où tu veux.
`),
        Marche: d({
          'marchande.txt': f(`
« Plus rien à vendre, l'Effaceur a tout pris ! Enfin, presque : regarde
mes étals. »

Elle baisse la voix : « Un conseil. Avant d'effacer quoi que ce soit avec
rm, réfléchis bien. Il n'y a pas de corbeille, sous Linux. C'est comme ça
que l'Effaceur travaille : rm, rm, rm, sans jamais se retourner. »
`),
          'pomme': f(`Une pomme un peu fripée.`),
          'pomme_2': f(`Une autre pomme, tout aussi fripée.`),
          'fromage': f(`Une meule de fromage qui sent très fort. « Le seul produit que l'Effaceur n'a pas voulu toucher », dit la marchande.`, {
            protege: { rm: '« Ne touche pas à mon dernier fromage ! » proteste la marchande.' },
          }),
        }),
        Boulangerie: d({
          'boulanger.txt': f(`
Le boulanger contemple son pétrin vide.

« L'Effaceur a tout pris. Il ne me reste qu'un seul levain, et il m'en
faut trois pour les trois fournées du matin. Ah, si je pouvais en avoir
trois ! »

(cp levain levain_2 crée une copie du levain.)
`),
          'levain': f(`Un bocal de levain qui bulle doucement. C'est vivant, ça se nourrit… et ça se copie.`, {
            protege: { rm: '« Pas mon dernier levain ! » crie le boulanger.' },
          }),
        }),
        Atelier: d({
          'artisane.txt': f(`
L'artisane fouille ses tiroirs vides.

« Ah, de l'aide ! L'Effaceur a effacé tous mes engrenages, et sans eux,
l'horloge du Bourg ne tourne plus. Tu sais fabriquer un objet ? Il suffit
d'une commande :

  touch engrenage

Ensuite, il m'en faudrait cinq en tout. Fabriquer, c'est long… copier,
c'est rapide. »
`),
        }),
        Ecole: d({
          'institutrice.txt': f(`
L'institutrice fait la classe… dans la cour, faute de salle.

« L'Effaceur a effacé notre Classe ! Une salle de classe, c'est un lieu.
Tu sais en construire un ? »

(mkdir Nom crée un lieu.)
`),
        }),
        Mairie: d({
          'greffiere.txt': f(`
La greffière croule sous les affiches.

« Chaque habitant·e a placardé un avis depuis le passage de l'Effaceur. Il
y en a une qui dit où il est allé, mais laquelle ? Je n'ai pas le temps de
toutes les lire. Toi non plus.

Utilise grep : il cherche un mot dans des fichiers et affiche les lignes
qui le contiennent. L'étoile * veut dire « tous les fichiers d'ici » :

  grep Effaceur *
`),
          'avis_bal.txt': affiche(['AVIS : le bal du samedi est maintenu.', 'Apportez des lampions.']),
          'avis_chat.txt': affiche(['PERDU : chat roux, répond au nom de Pixel.', 'Récompense : un fromage.']),
          'avis_egouts.txt': affiche([
            'AVIS DES ÉGOUTIERS',
            'Nous avons vu l’Effaceur descendre dans l’Egout, au fond de la Cour de la Ruelle.',
            'La petite Nour l’a suivi. Les rats ne laissent passer personne.',
            'La clé des Archives est sous le paillasson de la Mairie (un objet caché, bien sûr).',
          ]),
          'avis_marche.txt': affiche(['MARCHÉ : ouvert le jeudi.', 'Fromages, pommes, et c’est à peu près tout.']),
          'avis_horloge.txt': affiche([
            'AVIS : l’horloge est arrêtée.',
            'Tant qu’elle ne tourne pas, la grille de la Ruelle reste fermée.',
          ]),
          '.paillasson': f(`Sous le paillasson, une petite clé. Tu la prends.`, {
            lu: (j) => {
              j.drapeaux.add('cle-archives');
              return 'La porte des Archives est ouverte.';
            },
          }),
          Archives: d(
            {
              'archiviste.txt': f(`
Une archiviste travaille à la lueur d'une bougie.

« Tu as trouvé la clé ! Alors tu sais te servir de grep. J'étudie
l'Effaceur depuis des années. Tout est dans la chronique, mais elle est
longue. Cherche les lignes qui parlent de lui :

  grep Effaceur chronique.txt

Et si tu ne sais plus si c'est avec une majuscule, ajoute -i :

  grep -i effaceur chronique.txt
`),
              'chronique.txt': f(`
CHRONIQUE DU ROYAUME

An 1 : fondation du Bourg au bord de la mer.
An 12 : construction du quai, en pierre de l'île.
An 40 : l'Effaceur est créé à la Racine pour vider la Corbeille.
An 41 : grande fournée de pain pour la fête du levain.
An 77 : la maison de l'horloger est agrandie.
An 102 : l'Effaceur n'obéit plus qu'à un seul ordre : tout effacer.
An 103 : on raconte que seule la personne qui l'a lancé peut l'arrêter.
An 104 : la foire aux pommes est annulée (il pleut).
An 130 : on allume le phare de l'île pour guider les bateaux.
An 131 : l'Effaceur vit à la Racine, tout en bas, sous les égouts du Bourg.
`, { lignes: true }),
            },
            (jeu) => (jeu.drapeaux.has('cle-archives') ? null : 'La porte des Archives est fermée à clé. Les affiches de la Mairie en disent peut-être plus.'),
          ),
        }),
        Ruelle: d(
          {
            'barricade': f(`Une barricade de planches, de tonneaux et de chaises cassées, dressée à la hâte. Bien trop lourde pour être déplacée.`, {
              protege: { mv: 'Tu tires de toutes tes forces… rien. La barricade est trop lourde pour mv. Mais tu connais un sort plus radical.' },
            }),
            Cour: d(
              {
                'mur.txt': f(`Une cour pavée. Au fond, une plaque d'égout entrouverte : l'Egout.`),
                Egout: d(
                  {
                    'rats.txt': f(`
Une armée de rats bloque le passage.

« Couic ! Personne ne passe sans payer. Nous voulons du FROMAGE, ici,
tout de suite ! »

Il y a un fromage au Marche. Pour en copier un ici sans y retourner,
donne son chemin complet et . (le lieu où tu es) comme destination :

  cp ~/Marche/fromage .
`),
                    Galerie: d(
                      {
                        'nour.txt': f(`
Nour est assise au bord d'un grand Toboggan qui plonge dans le noir.

« Merci d'être venu·e ! J'ai suivi l'Effaceur jusqu'ici. Il a glissé par
ce Toboggan, vers la Racine, en marmonnant : "effacer, effacer, l'ordre
de la racine…" Puis les rats m'ont bloquée. »
`, {
                          lu: (j) => {
                            j.drapeaux.add('nour-lue');
                          },
                        }),
                      },
                      (jeu) => (jeu.existe(`${EGOUT}/rats.txt`) ? '« Couic ! » Les rats te barrent la Galerie.' : null),
                    ),
                  },
                ),
              },
              (jeu) => (jeu.existe(`${RUELLE}/barricade`) ? 'Une barricade bloque l’entrée de la Cour.' : null),
            ),
          },
          (jeu) =>
            jeu.compter(ATELIER, 'engrenage') >= 5 ? null : 'La grille de la Ruelle est fermée. Elle s’ouvre à heure fixe… mais l’horloge du Bourg est arrêtée.',
        ),
      }),
    }),
  evenements: [
    {
      id: 'levain',
      condition: (j) => j.compter(BOULANGERIE, 'levain') >= 3,
      message: '« Trois levains ! » Le boulanger n’en revient pas. « Une copie, c’est un nouvel objet, identique à l’original. Merci ! »',
    },
    {
      id: 'engrenage',
      condition: (j) => j.compter(ATELIER, 'engrenage') >= 1,
      message: '« Un engrenage ! Parfait. Plus que quatre… avec cp, ce sera vite fait. »',
    },
    {
      id: 'engrenages',
      condition: (j) => j.compter(ATELIER, 'engrenage') >= 5,
      message: 'Tic, tac… L’horloge du Bourg se remet à tourner ! Au premier coup de midi, la grille de la Ruelle s’ouvre en grinçant.',
    },
    {
      id: 'classe',
      condition: (j) => j.trouver(CLASSE)?.type === 'dossier',
      message: (j) =>
        j.drapeaux.has('nour-lue')
          ? 'Une Classe se dresse à l’École. Les enfants s’y précipitent.'
          : 'Une Classe se dresse à l’École. Les enfants s’y précipitent. « Il ne manque qu’une élève », soupire l’institutrice : « Nour. »',
    },
    {
      id: 'barricade',
      condition: (j) => !j.existe(`${RUELLE}/barricade`),
      message: 'Pouf ! La barricade disparaît. La Cour est accessible.\n(Pas de corbeille : elle ne reviendra jamais.)',
    },
    {
      id: 'rats',
      condition: (j) => j.existe(`${EGOUT}/fromage`),
      action: (j) => {
        j.effacer(`${EGOUT}/rats.txt`);
        j.effacer(`${EGOUT}/fromage`);
      },
      message: 'Les rats se jettent sur le fromage et l’emportent dans un trou. La Galerie est libre.',
    },
    {
      id: 'nour-sans-classe',
      condition: (j) => j.drapeaux.has('nour-lue') && j.trouver(CLASSE)?.type !== 'dossier',
      message: '« Je veux bien rentrer », dit Nour, « mais l’Effaceur a effacé ma Classe. Tu peux la reconstruire, à l’École ? » (mkdir)',
    },
    {
      id: 'nour',
      condition: (j) => j.drapeaux.has('nour-lue') && j.trouver(CLASSE)?.type === 'dossier',
      message: `Nour court rejoindre sa Classe toute neuve.

Bravo ! Tu as terminé le chapitre 2.

Tu sais maintenant chercher (grep), créer (touch, mkdir), copier (cp) et
effacer (rm) — avec prudence, puisqu'il n'y a pas de corbeille.

L'Effaceur se cache à la Racine, au bas du Toboggan : le chapitre 3
t'attend.`,
    },
  ],
};
