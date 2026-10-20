# Traduire Quêtes de Sysadmin

Tous les textes du jeu sont dans **`src/textes/<langue>/`**, au format
**[Fluent](https://projectfluent.org)** (`.ftl`), créé par Mozilla pour des
traductions naturelles : pluriels, variables nommées, longs textes sur
plusieurs lignes. Le code ne contient que des identifiants. Le **français**
(`src/textes/fr/`) est la langue de référence.

## Les fichiers

| Fichier | Contenu |
|---|---|
| `interface.ftl` | menus, boutons, progression |
| `histoires.ftl` | titre et résumé de chaque histoire |
| `chapitre-<id>.ftl` | un chapitre : son titre, les textes de ses lieux et objets, ses événements |
| `shell.ftl` | invite, sudo, tubes, messages d'erreur communs |
| `manuel.ftl` | les pages `man` de chaque commande, et `--help` |
| `commandes-*.ftl` | les messages des commandes (`ls`, `tar`, `git`…) |

## Le format en bref

```ftl
# Un commentaire pour les traducteur·rices
eveil-evenement-crabe = Le crabe retrouve son seau.

# Un texte sur plusieurs lignes : chaque ligne est en retrait.
eveil-message =
    « Si tu lis ceci, c'est que l'Effaceur est passé sur l'île.

    Une créature parcourt le royaume… »

# Une variable : { $nom }. Ne pas traduire son nom.
erreur-introuvable = { $commande } : { $cible } : aucun fichier ou dossier de ce nom

# Un pluriel, selon les règles de chaque langue (Intl.PluralRules)
etat-chapitres-faits =
    { $faits ->
        [one] { $faits } chapitre
       *[other] { $faits } chapitres
    } sur { $total }

# Un attribut : .nom = …
histoire-effaceur = L’Effaceur
    .resume = Une créature efface tout dans le royaume.
```

Pièges du format :

- une ligne de texte qui commence par `.`, `[` ou `*` s'écrit `{"."}`,
  `{"["}`, `{"*"}` (sinon Fluent la prend pour un attribut ou une variante) ;
- les accolades s'écrivent `{"{"}` et `{"}"}` ;
- dans un texte sur plusieurs lignes, le retrait commun est retiré : un
  tableau aligné par des espaces garde son alignement relatif ;
- les paragraphes peuvent être coupés librement : le jeu recolle les lignes
  d'un même paragraphe et laisse le terminal les faire passer à la ligne,
  sauf les lignes en retrait, les tirets et les tableaux (doubles espaces).

## Ce qui ne se traduit pas

- **Les identifiants techniques** : noms de commandes et d'options, chemins
  système (`/etc/nginx/`), adresses, variables `{ $… }`.
- **Les sorties d'un outil qui répond en anglais** même sur un Linux en
  français (`ping`, `dig`, `curl`, journaux nginx) : elles sont dans le code.
- Les messages d'un outil traduit (coreutils, man-db, git, sudo) suivent la
  traduction officielle de cet outil dans ta langue, quand elle existe :
  c'est ce que verrait un·e administrateur·rice avec `LANG` dans ta langue.

Pour l'instant, les **noms des lieux et des objets** (`Phare`, `crabe`) sont
encore dans le code : leur traduction, avec des noms faciles à taper dans
chaque langue, est prévue (voir la feuille de route, phase 10). En attendant,
une traduction garde ces noms tels quels (on les tape) et peut les expliquer
au passage : « the Seau (bucket) ».

Les commandes des exemples du manuel sont dans le code (`pages.ts`). Quand
l'une d'elles contient des mots (`grep "mot de passe" journal.txt`), une
langue peut la remplacer par un attribut `.commande-N` de la page :

```ftl
man-grep = prints the lines that contain the pattern…
    .exemple-3 = search for several words: quotes keep the spaces
    .commande-3 = grep "my password" journal.txt
```

Les messages que le jeu **vérifie** (titres et mots-clés du post-mortem,
noms de jeux de la base…) se traduisent par ce que le joueur ou la joueuse
écrirait dans sa langue : lire le commentaire au-dessus du message.

## Les langues disponibles

| Code | Langue | État |
|---|---|---|
| `fr` | français | langue de référence |
| `en` | anglais | complet (textes, manuel, messages des outils comme avec `LANG=C`) ; noms des lieux et fichiers encore en français |

## Ajouter une langue

1. Copier `src/textes/fr/` vers `src/textes/<code>/` (code BCP 47 : `en`,
   `de`, `es`, `zh-Hans`, `ko`…) et traduire. Un texte absent s'affiche en
   français : on peut avancer fichier par fichier.
2. `npm test` : vérifie que les fichiers sont valides, sans identifiant en
   double ni inconnu du français, et rejoue chaque quête dans chaque langue.
3. Ajouter, si la langue en a besoin, ses règles typographiques dans
   `typographie()` (`src/textes/index.ts`) : les espaces insécables du
   français en sont un exemple.

Le format Fluent est reconnu par les plateformes de traduction libres
([Weblate](https://weblate.org), [Pontoon](https://pontoon.mozilla.org)),
qui permettent de traduire sans toucher à Git.

## Pour les développeur·ses

- Dans le code : `t('identifiant', { variable })` (interface) ou
  `jeu.t(...)` (moteur, commandes, chapitres). `t.existe(id)` teste la
  présence d'un texte facultatif.
- Un nombre passé en variable est mis en forme selon la langue (« 1 234 ») :
  passer en texte (`String(pid)`) ce qui doit rester tel quel.
- Une phrase entière par message, jamais de phrase assemblée par morceaux.
- `tests/textes.test.ts` échoue si du texte français reste dans
  `src/moteur/` ou `src/interface/`.
