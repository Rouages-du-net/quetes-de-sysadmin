# Quêtes de Sysadmin — consignes pour Claude

Jeu éducatif dans le navigateur pour apprendre l'administration système Linux
(voir `README.md` et `docs/ROADMAP.md`). Projet frère de
[Les rouages du net](https://github.com/Rouages-du-net/rouages.net), dont il
reprend le moteur « Terminus en français » (`src/scripts/terminus/`).

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
- Avant de pousser : la construction et les tests doivent passer ; pour tout
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
