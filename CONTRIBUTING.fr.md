# Contribuer à Quêtes de Sysadmin

— [English version](CONTRIBUTING.md) (la version de référence)

Merci de vouloir écrire une quête ou améliorer le jeu ! Cette page décrit ce
qu'on attend d'une contribution, et surtout le **format d'une quête**. Les
règles complètes sont dans `CLAUDE.md` (elles valent pour tout le monde,
pas seulement pour l'agent) ; le détail des textes est dans
[`docs/TRANSLATING.md`](docs/TRANSLATING.md).

## Signaler un problème ou une idée

Le bouton « Signaler un problème ou une idée » du jeu (sous le menu, parmi
les actions d'un chapitre, et dans le pied de page du site) rédige le
signalement : on choisit le type (le comportement d'une commande, un texte
ou un indice pas clair, une idée, autre chose), on écrit un message, on
coche le contexte à inclure (version, langue, chapitre, les dernières
commandes et leurs réponses, navigateur, réglages, carnet), on voit le texte
exact, puis on ouvre soi-même une issue GitHub préremplie ou on copie le
texte. Le jeu n'envoie rien. Les signalements arrivent comme des issues
fondées sur `.github/ISSUE_TEMPLATE/feedback.md`, titrées `[bug]`, `[text]`,
`[idea]` ou `[other]`, et commencent par
`<!-- sysadmin-quests feedback v1 -->` ; leurs titres de section sont dans
la langue du joueur ou de la joueuse, les lignes dessous gardent des
libellés anglais (`version:`, `chapter:`…). Un signalement trop long pour un
lien perd ses plus anciennes commandes et le dit ; on a proposé de coller le
texte copié. Le texte est construit par `src/engine/feedback.ts`.

## Les principes

- **Vraies commandes, vrais comportements.** Noms, options courantes, codes
  de retour et messages d'erreur fidèles à l'outil réel (sur Debian), d'après
  sa documentation officielle, citée en commentaire et dans le débrief. Ce
  qui est simplifié va dans le **tableau des écarts** de `SCENARIOS.md`.
- **Le manuel d'abord.** Chaque commande simulée a sa page `man`, répond à
  `--help` et apparaît dans `man -k`. Les indices renvoient au manuel plutôt
  que de donner la réponse.
- **Objectifs vérifiés sur l'état du système simulé**, jamais sur la commande
  tapée : plusieurs solutions correctes doivent passer.
- **100 % statique et déterministe** : aucune vraie machine, aucun vrai
  réseau, rien de tiré au hasard sans graine.
- **Exemples sans danger** : adresses de documentation (RFC 5737 :
  192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 ; RFC 1918 pour les réseaux
  internes ; RFC 3849 pour IPv6), adresses MAC de documentation (RFC 7042),
  domaines `.example`. Aucune vraie donnée personnelle. Les quêtes de
  sécurité restent défensives : on protège, on détecte, on répare.
- **Accessible** : jouable au clavier et sur un écran de 375 px ; WCAG 2.2 AA,
  vérifié par `tests/a11y.mjs` (y ajouter toute nouvelle page, fenêtre ou
  situation), voir `docs/ACCESSIBILITY.md` (en anglais).

## Le format d'une quête

Une **histoire** est une suite de **chapitres** (des quêtes), sur une
machine du réseau simulé. Un chapitre, c'est :

| Fichier | Contenu |
|---|---|
| `src/engine/chapters/<id>.ts` | le chapitre : ses commandes, son monde de départ, son état, ses événements |
| `src/texts/en/chapter-<id>.ftl` (et `fr/`) | tous ses textes : courriel de départ, fichiers, événements, débrief |
| `src/texts/en/hints-<story>.ftl` (et `fr/`) | ses indices gradués : une piste, puis presque la réponse, pour chaque étape |
| `tests/<histoire>.test.ts` | la partie rejouée : la solution attendue, une autre solution, les fausses pistes |
| `docs/SCENARIOS.md` | sa fiche : l'histoire, les commandes apprises, l'objectif, les pièges |

Un nouveau chapitre va aussi dans le module de son histoire
(`src/engine/stories/<histoire>.ts`, les chapitres dans l'ordre), à la fin de
`CODE_ORDER` dans `src/engine/progress.ts` et de `tests/progress/order.txt`,
et dans au moins un parcours (`src/engine/paths.ts`). Une nouvelle histoire
a son module dans `src/engine/stories/`, déclare dans
`src/engine/chapters/index.ts` les chapitres qui l'ouvrent (`after`) et
reçoit une machine dans `src/engine/machines.ts`, et une date de sortie
dans `src/engine/releases.ts` (le jour où elle arrive sur `main` : le flux
des nouvelles histoires et les badges « Nouveau » du menu la lisent ;
`tests/releases.test.ts` échoue tant qu'elle manque). Lance ensuite
`npm run catalogue` : le menu connaît les histoires par
`src/engine/catalogue.json` sans les charger (le jeu ne charge une histoire
qu'à son ouverture), et `npm test` échoue tant qu'il n'est pas à jour. Le
module d'un chapitre ne doit pas appeler `t()` quand il est importé : ses
textes se chargent avec lui.

#### Ajouter une histoire (ou porter une histoire écrite avant le découpage)

Le jeu ne charge une histoire qu'à son ouverture : une histoire se branche
donc à trois endroits, dont `tests/catalogue.test.ts` vérifie l'accord :

1. `src/engine/stories/<histoire>.ts` : importe ses chapitres depuis
   `src/engine/chapters/` et les exporte dans l'ordre,
   `export const chapters: Chapter[] = [premier, deuxieme, troisieme];`
   (copie le module d'une autre histoire).
2. `src/engine/chapters/index.ts` : un import,
   `import { chapters as monHistoire } from '../stories/<histoire>';`, et une
   entrée dans `STORIES`, `{ id: '<histoire>', after: [...], chapters: monHistoire }`.
   Une histoire écrite à l'ancienne importait chaque chapitre ici : déplace
   ces imports dans son module.
3. `npm run catalogue` : réécrit `src/engine/catalogue.json` (le menu, les
   commandes et la taille de ses chapitres, et les fichiers de textes qui se
   chargent avec l'histoire : ses `chapter-*.ftl` et `hints-<histoire>.ftl`,
   plus ceux d'autres histoires que ses modules nomment).

Les textes partagés par l'histoire hors de ces fichiers (un `<histoire>.ftl`
comme `blood-drive.ftl`) se chargent avec les textes communs. Rien d'autre ne
change : machines, parcours, `CODE_ORDER`, tests. `npm run build` vérifie
ensuite le budget de la première visite : le code propre à l'histoire doit
rester dans son morceau, donc le cœur du moteur (shell, commandes,
`console.ts`) n'importe jamais un chapitre.

#### Les commandes propres à une histoire

Un outil qu'une seule histoire (ou quelques-unes) utilise va dans une
**famille du moteur**, pas dans la première visite (`src/engine/families.ts`,
voir `docs/DEPLOYMENT.md`, « Chunks and budget »). Son moteur
(`src/engine/<outil>.ts`) et ses commandes (`src/engine/commands/<outil>.ts`)
restent où ils sont ; ensuite :

1. `src/engine/families/<famille>.ts` importe ses commandes et appelle
   `registerFamily('<famille>', { ...MES_COMMANDES }, HOOKS)` (copie
   `families/cups.ts`) ; son chargeur va dans `FAMILIES` et le type de ses
   `HOOKS` dans `Hooks` (`families.ts`).
2. Le module de l'histoire l'importe : `import '../families/<famille>';`
   (`tests/families.test.ts` vérifie que chaque histoire dont les chapitres
   listent les commandes de la famille le fait). Une histoire dont le monde
   les lance de lui-même (une tâche cron, une unité) sans que ses chapitres
   les listent, ou dont une commande du cœur demande la famille sur sa
   machine (lsblk sur des disques décrits), l'importe aussi et le dit dans
   `RUN_BY_THE_WORLD` de ce test.
3. Le cœur (le shell, les autres commandes) n'importe jamais les modules de
   la famille : là où il doit appeler l'outil, il passe par un crochet,
   `family('<famille>').maFonction(…)` (lève `NeedsLoading` : la ligne
   repart une fois la famille là) ou `familyIfLoaded('<famille>')?.…` pour
   une question à laquelle seules les machines de l'histoire peuvent
   répondre oui. `tests/families.test.ts` échoue si le jeu atteint un module
   d'une famille.
4. Ses commandes restent dans la table de `commands/index.ts` par leur
   entrée (options, section, `cmdlet`…), générée dans
   `src/engine/families.json` par `npm run catalogue` ; leurs options et
   exemples vont dans `pages.ts` et `examples.ts` comme pour toute commande.

Une commande que toute histoire peut croiser (`sleep`, `base64`) reste dans
le cœur.

### Le chapitre (`Chapter`, dans `src/engine/world.ts`)

- `id`, `number`, et l'histoire qui l'accueille (`src/engine/chapters/index.ts`).
- `commands` : celles que le chapitre enseigne. Le chapitre garde aussi
  les commandes de chaque chapitre qu'il suppose (les prérequis `after` de
  son histoire et les chapitres précédents de son histoire) qui existent
  sur sa machine (`src/engine/availability.ts`) ; les autres répondent
  « tu n'as pas encore cette commande », et leur manuel reste lisible avec
  `man`. `withhold` garde fermée une commande supposée quand elle ferait
  la leçon à la place du joueur ou de la joueuse.
- `createWorld(t)` : le système de fichiers de départ ; les textes viennent
  de `t('…')`, jamais du code.
- `state()` et `initialise(jeu)` : l'état des outils simulés (services,
  pare-feu, annuaire…) au début.
- `welcome` : le fichier lu à l'arrivée (souvent un courriel) ; `password`
  pour sudo.
- `events` : des conditions sur l'état, vérifiées après chaque commande
  et à la fermeture de l'éditeur. Chacune affiche son message une seule
  fois. L'événement `final` termine le chapitre : c'est le débrief.

### Les événements : indices et fausses pistes

Un bon chapitre prévoit les erreurs courantes et y répond par un événement
qui **explique sans donner la solution** : ce qui s'est passé, et où
chercher (une page `man`, un fichier, une commande d'observation). Exemples :
la configuration modifiée sans recharger le service, la règle qui ne tient
pas au redémarrage, le mot de passe stocké en clair.

### Le débrief

Le message final a toujours trois parties, et une quatrième quand un autre
outil répond au même besoin :

```
CE QUI S'EST PASSÉ
LA BONNE PRATIQUE
UNE AUTRE VOIE        (facultatif : l'autre outil, et le compromis)
LA DOCUMENTATION
```

En mode examen, c'est le seul message du chapitre qui s'affiche : il doit se
comprendre sans les indices qui l'ont précédé.

La documentation : des liens vers la documentation **officielle** de l'outil
(pages de manuel, site du projet, RFC).

### Les tests

Chaque chapitre a au moins :

- un test qui **rejoue la solution attendue** jusqu'au bout
  (`expect(c.finished).toContain('<id>')`) ;
- un test d'**une autre solution** correcte, quand il y en a une ;
- un test des **fausses pistes** : chaque événement d'indice est déclenché,
  et le chapitre n'est pas fini tant que l'erreur reste.

Les tests rejouent chaque quête dans chaque langue complète, et, dans chaque
langue en cours, les histoires qu'elle traduit déjà (`languagesFor()` dans
`tests/names.ts`) ; les scénarios des tests sont écrits avec les noms
anglais (`inLanguage()` les traduit), et les textes vérifiés en français.

### La difficulté

Chaque chapitre affiche une difficulté de 1 à 5 étoiles, calculée par
`src/engine/difficulty.ts` d'après les chapitres qu'il suppose (ceux qui
ouvrent son histoire, puis les précédents de son histoire) et sa taille (les
étapes que le jeu vérifie, les commandes qu'il introduit) : rien à régler à
la main. L'échelle est absolue, avec des seuils fixes : une nouvelle
histoire reçoit ses propres niveaux sans changer ceux des autres ; choisis
donc son `after` d'après ce qu'elle suppose vraiment, pas d'après ses
étoiles.

## Un nouvel outil simulé

Un outil (nginx, nftables, slapd…) a son moteur dans `src/engine/<outil>.ts`
(sans DOM, sans texte affiché) et ses commandes dans
`src/engine/commandes/<outil>.ts`. Pour chaque commande :

- son entrée dans `src/engine/commands/index.ts`, ou dans une famille du
  moteur quand seules quelques histoires l'utilisent (voir « Les commandes
  propres à une histoire ») ;
- ses options dans `src/engine/commands/pages.ts`, ses exemples et son VOIR
  AUSSI dans `src/engine/commands/examples.ts` (ils se chargent avec le
  manuel) ;
- sa page dans `src/texts/en/manual.ftl` et `fr/manual.ftl`
  (`man-<commande>`, `.synopsis`, `.option-X`, `.example-N`) ;
- une ligne dans le tableau des écarts de `SCENARIOS.md` ;
- une ligne dans la structure de `CLAUDE.md`.

## Avant d'ouvrir une PR

```bash
npm test                    # chaque quête rejouée
npm run build               # le site, le fichier d'intégration, tsc, le budget de la première visite
npm run catalogue           # après l'ajout d'une histoire ou d'un chapitre
npm run preview &           # puis :
npm run test:browser     # Chromium, 1000 et 375 px, CSP
```

Pour un changement visible, jouer le chapitre dans Chromium à 375 et 1000 px
de large : pas d'erreur console, pas de défilement horizontal.

## Les langues

- **Traduire** : chaque texte est dans `src/texts/<langue>/*.ftl` (format
  Fluent). Une nouvelle langue commence **en cours** (`src/texts/languages.json`) :
  elle se traduit fichier par fichier (le manuel, page par page), ce qui
  manque s'affiche en anglais, et une histoire pas encore traduite se joue
  en anglais. Une histoire est une bonne unité de travail : ses fichiers
  `chapter-*.ftl` et `hints-*.ftl`, et son fichier propre si elle en a un ;
  `npm run coverage:texts` liste ce qui reste. Voir
  [`docs/TRANSLATING.md`](docs/TRANSLATING.md) (en anglais) pour les noms,
  les mots de passe et les noms de machines, traduits eux aussi.

- **L'anglais d'abord.** C'est la langue de référence des textes du jeu :
  chaque texte s'écrit d'abord en anglais (`src/texts/en/`), puis se
  traduit (`src/texts/fr/`…).
- **Le dépôt est en anglais** : documentation, commentaires du code,
  messages de commit et PR. Ce guide, le README et le guide d'intégration
  ont leur version française ; les autres documents sont en anglais
  seulement.
- **Le code en anglais.** Les fichiers et les identifiants (variables,
  fonctions, types, composants) sont en anglais, et le monde aussi (lieux,
  machines, comptes, mots de passe) ; les classes CSS, les valeurs internes
  et les commentaires aussi. Le **nouveau** code s'écrit en anglais,
  sans mêler un grand renommage et une fonctionnalité dans la même PR. Un
  nom public reçoit d'abord son alias anglais, l'ancien reste accepté.
- Écriture inclusive au point médian quand c'est naturel, dans les textes
  français. Les sorties des commandes simulées restent en anglais quand le
  vrai outil répond en anglais.

## Licences

Le code est sous **GPL v3 ou ultérieure** (`LICENSE`), les textes sous
**CC BY-SA 4.0** (`LICENSE-CONTENUS.txt`). En contribuant, vous acceptez que
votre contribution soit publiée sous ces licences.

Le jeu est **inspiré de Terminus, créé au MIT par Shawn Conrad et Michele
Pratusevich** : on garde cette mention, mais on ne reprend ni ses lieux, ni
ses textes, ni ses énigmes.
