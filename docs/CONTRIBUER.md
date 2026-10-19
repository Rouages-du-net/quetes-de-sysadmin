# Contribuer à Quêtes de Sysadmin

Merci de vouloir écrire une quête ou améliorer le jeu ! Cette page décrit ce
qu'on attend d'une contribution, et surtout le **format d'une quête**. Les
règles complètes sont dans `CLAUDE.md` (elles valent pour tout le monde,
pas seulement pour l'agent) ; le détail des textes est dans
[`TRADUIRE.md`](TRADUIRE.md).

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
- **Accessible** : jouable au clavier et sur un écran de 375 px.

## Le format d'une quête

Une **histoire** est une suite de **chapitres** (des quêtes), sur une
machine du réseau simulé. Un chapitre, c'est :

| Fichier | Contenu |
|---|---|
| `src/moteur/chapitres/<id>.ts` | le chapitre : ses commandes, son monde de départ, son état, ses événements |
| `src/textes/fr/chapitre-<id>.ftl` | tous ses textes : courriel de départ, fichiers, événements, débrief |
| `tests/<histoire>.test.ts` | la partie rejouée : la solution attendue, une autre solution, les fausses pistes |
| `docs/SCENARIOS.md` | sa fiche : l'histoire, les commandes apprises, l'objectif, les pièges |

### Le chapitre (`Chapitre`, dans `src/moteur/monde.ts`)

- `id`, `numero`, et l'histoire qui l'accueille (`src/moteur/chapitres/index.ts`).
- `commandes` : celles que le chapitre connaît (les autres répondent
  « commande introuvable », comme sur une machine où le paquet manque) ;
  leur manuel reste lisible avec `man`.
- `creerMonde(t)` : le système de fichiers de départ ; les textes viennent
  de `t('…')`, jamais du code.
- `etat()` et `initialiser(jeu)` : l'état des outils simulés (services,
  pare-feu, annuaire…) au début.
- `accueil` : le fichier lu à l'arrivée (souvent un courriel) ; `motDePasse`
  pour sudo.
- `evenements` : des conditions sur l'état, vérifiées après chaque commande
  et à la fermeture de l'éditeur. Chacune affiche son message une seule
  fois. L'événement `final` termine le chapitre : c'est le débrief.

### Les événements : indices et fausses pistes

Un bon chapitre prévoit les erreurs courantes et y répond par un événement
qui **explique sans donner la solution** : ce qui s'est passé, et où
chercher (une page `man`, un fichier, une commande d'observation). Exemples :
la configuration modifiée sans recharger le service, la règle qui ne tient
pas au redémarrage, le mot de passe stocké en clair.

### Le débrief

Le message final a toujours trois parties :

```
CE QUI S'EST PASSÉ
LA BONNE PRATIQUE
LA DOCUMENTATION
```

La documentation : des liens vers la documentation **officielle** de l'outil
(pages de manuel, site du projet, RFC).

### Les tests

Chaque chapitre a au moins :

- un test qui **rejoue la solution attendue** jusqu'au bout
  (`expect(c.termines).toContain('<id>')`) ;
- un test d'**une autre solution** correcte, quand il y en a une ;
- un test des **fausses pistes** : chaque événement d'indice est déclenché,
  et le chapitre n'est pas fini tant que l'erreur reste.

Les tests rejouent chaque quête dans chaque langue disponible ; les textes
ne sont vérifiés qu'en français (`contient`).

## Un nouvel outil simulé

Un outil (nginx, nftables, slapd…) a son moteur dans `src/moteur/<outil>.ts`
(sans DOM, sans texte français) et ses commandes dans
`src/moteur/commandes/<outil>.ts`. Pour chaque commande :

- son entrée dans `src/moteur/commandes/index.ts` ;
- ses options et exemples dans `src/moteur/commandes/pages.ts` ;
- sa page dans `src/textes/fr/manuel.ftl` (`man-<commande>`, `.synopsis`,
  `.option-X`, `.exemple-N`) ;
- une ligne dans le tableau des écarts de `SCENARIOS.md` ;
- une ligne dans la structure de `CLAUDE.md`.

## Avant d'ouvrir une PR

```bash
npm test                    # chaque quête rejouée
npm run build               # le site, le fichier d'intégration, tsc
npm run preview &           # puis :
npm run test:navigateur     # Chromium, 1000 et 375 px, CSP
```

Pour un changement visible, jouer le chapitre dans Chromium à 375 et 1000 px
de large : pas d'erreur console, pas de défilement horizontal.

Tout est **en français** : textes du jeu, documentation, messages de commit
et PR. Écriture inclusive au point médian quand c'est naturel. Les sorties
des commandes simulées restent en anglais quand le vrai outil répond en
anglais.

## Licences

Le code est sous **GPL v3 ou ultérieure** (`LICENSE`), les textes sous
**CC BY-SA 4.0** (`LICENSE-CONTENUS.txt`). En contribuant, vous acceptez que
votre contribution soit publiée sous ces licences.

Le jeu est **inspiré de Terminus, créé au MIT par Shawn Conrad et Michele
Pratusevich** : on garde cette mention, mais on ne reprend ni ses lieux, ni
ses textes, ni ses énigmes.
