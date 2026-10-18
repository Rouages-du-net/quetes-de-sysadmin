# Quêtes de Sysadmin — consignes pour Claude

Jeu éducatif dans le navigateur pour apprendre l'administration système Linux
(voir `README.md`, `docs/SCENARIOS.md` et `docs/ROADMAP.md`). Projet
**indépendant** : tout le code et toute la documentation sont dans ce dépôt
(il est né dans Les rouages du net, mais il n'en dépend plus). Il doit pouvoir
s'intégrer dans n'importe quel site (`docs/INTEGRER.md`) : ne rien supposer de
la page qui l'accueille.

Le jeu sera publié sur **https://sysadmin.rouages.net** : un site 100 %
statique (pas de serveur Node, pas de base de données), hébergé comme
rouages.net.

## Structure et commandes

- `src/moteur/` : shell simulé (`shell.ts`), commandes (`commandes/`, dont
  le manuel : `manuel.ts`, `pages.ts`), monde (`monde.ts`), histoires
  (`chapitres/`). Aucune dépendance au DOM.
- `src/interface/` : interface (`jeu.ts`, fonction `monter()`) et styles
  (`styles.css`, tout sous `.qds`, couleurs en variables `--qds-*`).
- `src/element.ts` : l'élément `<quetes-de-sysadmin>` (Shadow DOM).
- `src/textes/` : textes de l'interface par langue (clés, `Intl`).
- `tests/quetes.test.ts` : chaque chapitre rejoué ; `tests/navigateur.mjs` :
  Chromium, 1000 et 375 px, intégration dans une autre page.

```bash
npm install
npm test                    # Vitest
npm run build               # tsc + site (dist/) + fichier d'intégration (dist/integration/)
npx vite preview --port 4340 &   # puis :
npm run test:navigateur
```

**Dette connue** : les textes des histoires, des commandes et du manuel sont
encore écrits en français dans `src/moteur/`. Les extraire vers `src/textes/`
est une tâche de la phase 0 (voir la feuille de route) ; tout nouveau texte
va directement dans `src/textes/`.

## Langue

Contenu du jeu, documentation, messages de commit et PR **en français**.
Licences : code sous **GPL v3 ou ultérieure** (`LICENSE`), textes sous
**CC BY-SA 4.0** (`LICENSE-CONTENUS.txt`) ; toute contribution s'y conforme.
Écriture inclusive au point médian quand c'est naturel (« administrateur·rice »).
Les sorties des commandes simulées restent en anglais quand le vrai outil
répond en anglais.

## Flux de travail

- **Ouvrir une PR automatiquement à la fin de chaque travail**, vers `main`.
- Si la PR précédente de la branche a été fusionnée, repartir de `main` à jour.
- Avant de pousser : `npm test` et `npm run build` doivent passer ; pour tout
  changement visible, vérifier dans Chromium (Playwright,
  `executablePath: '/opt/pw-browsers/chromium'`, `args: ['--headless=new']`),
  y compris à 375 px de large, sans erreur console.
- Chaque quête a un **test qui la rejoue** jusqu'au bout (solution attendue),
  plus au moins une fausse piste.
- Ne jamais lancer `pkill -f` avec un motif qui figure dans sa propre ligne
  de commande ; arrêter un serveur par son PID.

## Règles du jeu

- **100 % statique**, simulé et déterministe : aucune vraie machine, aucun vrai
  réseau, aucune requête vers l'extérieur.
- **Vraies commandes, vrais comportements** : noms, options courantes, codes de
  retour et messages fidèles. Tout écart volontaire va dans le tableau des
  écarts de la documentation.
- **Le manuel d'abord** : chaque commande simulée a sa page `man` (NOM,
  SYNOPSIS, DESCRIPTION, OPTIONS, EXEMPLES, VOIR AUSSI), répond à `--help`, et
  apparaît dans `man -k` / `apropos`. Une option inconnue donne le vrai message
  (« Saisissez « ls --help » pour plus d'informations »). Les indices du jeu
  renvoient vers le manuel plutôt que de donner la réponse.
- **Objectifs vérifiés sur l'état du système simulé**, pas sur la commande
  exacte tapée : plusieurs solutions correctes doivent passer.
- **Chaque quête finit par un débrief** : ce qui s'est passé, la bonne
  pratique, un lien vers la documentation officielle de l'outil.
- **Exemples sans danger** : adresses de documentation (RFC 5737, RFC 3849),
  domaines `.example` (RFC 6761). Les quêtes de sécurité restent défensives :
  on protège, on détecte, on répare.
- **Crédit** : garder la mention « inspiré de Terminus, créé au MIT par Shawn
  Conrad et Michele Pratusevich » et le lien vers l'original. Ne pas reprendre
  les lieux, textes ni énigmes de l'original.

## Traductions (prévues : anglais, allemand, espagnol, mandarin, coréen…)

Le jeu sera traduit une fois terminé. Tout le code doit le permettre dès
maintenant :

- **Aucun texte en dur dans le code** : histoires, dialogues, débriefs,
  messages du jeu et pages `man` vivent dans des fichiers de textes par langue
  (le français est la langue de référence) ; le code n'utilise que des clés.
- **Pluriels, nombres et dates** via `Intl` (`Intl.PluralRules`,
  `Intl.NumberFormat`, `Intl.DateTimeFormat`), jamais par concaténation.
- **Pas de phrase fabriquée par morceaux** : une phrase entière par clé, avec
  des variables nommées (`{fichier}`), car l'ordre des mots change d'une
  langue à l'autre.
- **Noms de lieux et d'objets traduisibles**, mais toujours faciles à taper :
  prévoir pour chaque langue des noms sans caractère difficile à saisir, et
  tester la complétion par Tab.
- **Sorties des commandes** : elles imitent l'outil réel dans la langue du
  système (`LANG`), comme sur un vrai Linux ; les identifiants techniques
  (commandes, options, chemins système) ne se traduisent jamais.
- **Écritures non latines** (chinois, coréen…) : mise en page qui supporte
  les caractères larges dans le terminal simulé (alignement des colonnes),
  polices servies par le site ou polices système, jamais de police tierce.
- **Mise en page** : prévoir des textes jusqu'à 40 % plus longs qu'en
  français ; `lang` correct sur la page ; prévoir le sens d'écriture si une
  langue de droite à gauche est ajoutée.
- Les tests rejouent chaque quête dans chaque langue disponible.

## Accessibilité et vie privée

- Jouable au clavier ; sorties annoncées aux lecteurs d'écran ; contraste AA ;
  `prefers-reduced-motion` respecté ; utilisable sur mobile.
- Aucun pisteur, aucune publicité, aucune ressource tierce (polices et scripts
  servis par le site). Progression dans `localStorage`, sans compte.
- Ne jamais mettre de vraie donnée personnelle dans les quêtes.

## Exactitude

- Le comportement des outils simulés (ufw, fail2ban, nginx, docker, restic…)
  s'appuie sur leur **documentation officielle** ; citer la page utilisée en
  commentaire ou dans le débrief.
- Signaler dans la documentation ce qui est simplifié.
