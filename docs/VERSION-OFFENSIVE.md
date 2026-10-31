# Une histoire offensive — guide pour qui veut l'écrire

Ce document n'est pas une quête du jeu : c'est un guide pour la personne
(humaine) qui voudra construire une histoire plus offensive que ce que le
reste du jeu fait — comprendre une attaque en la rejouant, pas seulement en
lire le résultat. Comprendre une attaque aide à s'en défendre, mais le jeu
reste par ailleurs strictement défensif (voir « Règles du jeu » dans
`CLAUDE.md`) : ce choix ne concerne que cette histoire, et reste à assumer et
à documenter par son autrice ou son auteur. Un agent Claude ne construira pas
cette histoire de lui-même ; ce guide sert à préparer le travail pour quand
vous vous y mettrez, et éventuellement à le faire construire ensuite.

## 1. Une place, pas encore prise

- **Un nom** : ni « Le Labo » (histoire 15, les disques), ni « La Veille »
  (histoire 16, le serveur `petrin`). Quelque chose côté audit offensif —
  par exemple *Le Test d'intrusion*, *L'Autre Côté*, *Red Team*. À vérifier
  au moment de vous y mettre : `grep "^## Histoire" docs/SCENARIOS.md`
  donne la liste à jour et le prochain numéro libre.
- **Une machine et une adresse**, dans `src/moteur/machines.ts` (voir les
  entrées existantes pour la forme).
- **Un identifiant d'histoire** (`id`), utilisé dans `src/moteur/chapitres/index.ts`,
  `src/moteur/progression.ts` et `tests/progression/ordre.txt`.

## 2. Les décisions qui vous reviennent

C'est la partie que je n'ai pas prise à votre place :

- **Jusqu'où va « offensif »** : un balayage plus poussé (déjà fait par
  `nmap`) ? un outil de recherche d'avis par version, en lecture seule
  (façon `searchsploit`, sans rien exécuter) ? ou une vraie preuve de
  concept qui « marche » dans le monde simulé ? Plus vous allez vers la
  troisième option, plus la section 4 ci-dessous pèse lourd.
- **CVE réelles ou fictives.** Le reste du jeu utilise des CVE fictives
  (`CVE-2099-NNNNN`, voir `src/moteur/chapitres/veille.ts`) justement pour ne
  jamais documenter une vraie faille exploitable. Partir du réel est un choix
  à assumer et à expliquer dans le débrief.
- **Les garde-fous racontés dans l'histoire elle-même** : autorisation
  écrite, cadre légal, la différence entre un test d'intrusion mandaté et une
  intrusion — comme `src/moteur/chapitres/perimetre.ts` (« L'Audit ») le fait
  déjà pour la lecture d'un périmètre. Une histoire offensive sans ce
  rappel explicite serait un manuel d'attaque, pas une quête.

## 3. Le format d'une quête (rappel)

Le format complet, avec exemples, est dans `CONTRIBUTING.md`. En résumé,
par chapitre :

| Fichier | Contenu |
|---|---|
| `src/moteur/chapitres/<id>.ts` | commandes connues, monde de départ, état des outils, événements |
| `src/textes/fr/chapitre-<id>.ftl` + `en/...` | tous les textes : accueil, événements, débrief |
| `src/textes/fr/indices-<histoire>.ftl` + `en/...` | un indice gradué par étape |
| `tests/<histoire>.test.ts` | chaque chapitre rejoué (solution, une autre voie si possible, fausses pistes), dans chaque langue |
| `docs/SCENARIOS.md` | la fiche de l'histoire |

Et le câblage une fois les chapitres écrits : `src/moteur/chapitres/index.ts`
(enregistrer l'histoire), `src/moteur/parcours.ts` (chaque chapitre dans au
moins un parcours, sinon `tests/parcours.test.ts` échoue),
`src/textes/fr/histoires.ftl` + `en/...` (titre, résumé),
`src/textes/fr/noms.ftl` + `en/...` (si `noms: true`).

## 4. Le vrai point bloquant : un nouvel outil simulé

C'est là que le temps de développement humain devient significatif, et c'est
prévisible : chaque outil déjà dans le jeu (`nmap`, `lynis`, `ufw`,
`fail2ban`…) a demandé un moteur, une commande, une page de manuel, des
textes dans les deux langues et une ligne dans le tableau des écarts de
`docs/SCENARIOS.md`. Quelques repères, pris sur `nmap` et `lynis` (les deux
derniers outils ajoutés, pour « L'Audit ») :

| Pièce | Exemple | Taille |
|---|---|---|
| Le moteur (l'état simulé) | `src/moteur/scan.ts` | ~250 lignes |
| La commande (lit les arguments, écrit la sortie) | `src/moteur/commandes/nmap.ts` | ~70 lignes |
| Un outil plus simple (état lu directement) | `src/moteur/lynis.ts` + `commandes/lynis.ts` | ~235 + ~30 lignes |
| La page de manuel (`man`, `--help`), dans `manuel.ftl` | `man-nmap`, `man-lynis` | quelques dizaines de lignes par outil, ×2 langues |

À cela s'ajoutent : l'entrée dans `src/moteur/commandes/index.ts`, les
options et exemples dans `src/moteur/commandes/pages.ts`, une ligne dans le
tableau des écarts de `docs/SCENARIOS.md` (ce que l'outil simplifie par
rapport au vrai), et une ligne dans la structure de `CLAUDE.md`. Pour un
outil offensif qui modélise une vraie exploitation (pas seulement une
lecture), il faut en plus représenter l'état « compromis » d'un service et
ce qui change dans le monde simulé une fois la preuve de concept lancée —
c'est le genre d'ajout qui a justifié qu'un agent ne le fasse pas sans vous.

**Pour réduire ce travail**, trois pistes, de la moins coûteuse à la plus
coûteuse :

1. **Ne rien ajouter : rejouer les outils existants dans un sens
   offensif.** `nmap` (reconnaissance), `curl` (requêtes contre un service
   déjà simulé, par exemple nginx ou une appli Docker), `ss`, `grep` dans des
   journaux : tout existe déjà. Une « exploitation » peut être modélisée
   comme une suite de ces commandes contre un service **déjà mal
   configuré** par le chapitre (un peu comme « L'exposition » dans
   « L'Audit » laisse Redis ouvert), sans nouvel outil du tout.
2. **Un petit outil en lecture seule.** Un outil qui ne fait que consulter
   un état déjà simulé (comme `lynis`, ~265 lignes à deux) coûte beaucoup
   moins qu'un outil qui modifie l'état du monde.
3. **Un outil qui modifie l'état du monde** (une vraie preuve de concept qui
   « réussit »). C'est la version la plus proche d'un véritable outil
   offensif, et la plus longue : elle demande de décrire, pour chaque
   service visé, ce que « avant » et « après » l'exploitation veut dire dans
   le monde simulé (fichiers, comptes, processus), en plus du moteur et de
   la commande eux-mêmes.

## 5. Avant de pousser

```bash
npm test                    # chaque quête rejouée, textes, indices, progression…
npm run build                # Astro + tsc
npm run preview &            # puis :
npm run test:navigateur      # Chromium, 1000 et 375 px
```

## Ce qu'un agent peut faire, sur demande

La partie mécanique et neutre reste possible à déléguer : câbler une
histoire une fois les chapitres écrits (`index.ts`, `machines.ts`,
`parcours.ts`, `progression.ts`), ou relire un chapitre déjà écrit pour sa
cohérence avec le moteur existant, sans en changer la substance offensive.
