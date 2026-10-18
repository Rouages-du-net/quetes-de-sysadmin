# Quêtes de Sysadmin

*Apprendre le métier d'administrateur·rice système en jouant, dans le
navigateur, avec de vraies commandes et de vrais comportements.*

On y apprend la ligne de commande Linux, puis à se connecter à des serveurs,
à les sécuriser, à servir des sites, à déployer, à sauvegarder et à réparer
quand tout casse. Chaque quête est un incident ou une mission réaliste, dans
un système entièrement simulé : rien ne sort du navigateur.

> **État** : neuf histoires jouables, reliées par `ssh` depuis son poste
> (ligne de commande, permissions et sudo, journaux et processus, comptes et
> groupes, services systemd, réseau, git, archives, durcissement SSH, pare-feu,
> fail2ban, sauvegardes avec rsync, cron et restic, nginx, TLS, DNS, Docker et
> Compose, déploiement par git, bleu/vert, canari, migrations, rançongiciel,
> rsnapshot, pg_dump), avec
> un manuel intégré et un éditeur `nano`. La suite est dans la
> [feuille de route](docs/ROADMAP.md).

## Jouer

- En ligne : **https://sysadmin.rouages.net**
- Sur ton site, en deux lignes : voir [docs/INTEGRER.md](docs/INTEGRER.md).

## Développer

```bash
npm install
npm run dev                # http://localhost:4321
npm test                   # rejoue toutes les quêtes (Vitest)
npm run build              # dist/ : le site, et dist/integration/ : le fichier à intégrer
npm run preview &          # http://localhost:4340
npm run test:navigateur    # vérifie le jeu dans Chromium (1000 et 375 px, CSP, intégration)
```

| Dossier | Contenu |
|---|---|
| `src/pages/`, `src/layouts/` | les pages du site (Astro) |
| `public/.htaccess` | configuration Apache : HTTPS, cache, sécurité, CORS |
| `src/moteur/` | le shell simulé, les commandes, le manuel, les histoires et leurs chapitres |
| `src/interface/` | l'interface du jeu (terminal, choix des histoires, progression) et ses styles |
| `src/element.ts` | l'élément `<quetes-de-sysadmin>` à intégrer |
| `src/textes/` | tous les textes du jeu, par langue, au format Fluent ([traduire](docs/TRADUIRE.md)) |
| `tests/` | parties rejouées (`quetes.test.ts`) et vérifications dans le navigateur |
| `docs/` | [scénarios](docs/SCENARIOS.md), [intégration](docs/INTEGRER.md), [déploiement](docs/DEPLOIEMENT.md), [feuille de route](docs/ROADMAP.md) |

## D'où vient ce jeu

Quêtes de Sysadmin est **inspiré de
[Terminus](https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html),
créé au MIT par Shawn Conrad et Michele Pratusevich** : l'idée d'un monde où
chaque lieu est un dossier et chaque objet un fichier vient de là. Les lieux,
les histoires, les énigmes et le code sont les nôtres. Le jeu est né sous le
nom « Terminus en français » sur [Les rouages du net](https://rouages.net), un
site de vulgarisation sur internet, l'informatique et l'IA, avant de devenir
ce projet indépendant.

## Principes

- **Statique** : un site sans serveur ni base de données, publié sur
  [sysadmin.rouages.net](https://sysadmin.rouages.net) ; tout se passe dans le navigateur, la
  progression est gardée localement, sans compte.
- **Apprendre à se dépanner** : `man`, `--help` et `man -k` marchent partout
  dès la première quête, et certaines énigmes ne se résolvent qu'en lisant le
  manuel.
- **Vraies commandes** : mêmes noms, mêmes options courantes, mêmes sorties ;
  chaque écart volontaire avec un vrai Linux est documenté.
- **Sans danger** : adresses et noms de domaine réservés aux exemples, aucune
  vraie cible ; les quêtes de sécurité restent défensives.
- **Accessible** : clavier, lecteur d'écran, contraste, mobile.
- **Sans pisteur**, sans publicité, sans ressource tierce.
- **En français d'abord**, puis traduit (anglais, allemand, espagnol,
  mandarin, coréen…) une fois terminé : les textes sont séparés du code dès
  le départ.

## Licences

- **Code** : [GNU GPL version 3](LICENSE) (ou toute version ultérieure).
  Tu peux utiliser, étudier, modifier et redistribuer le jeu ; les versions
  modifiées que tu distribues restent sous GPL.
- **Textes** (histoires, dialogues, débriefs, documentation) :
  [Creative Commons Attribution - Partage dans les mêmes conditions 4.0
  International (CC BY-SA 4.0)](LICENSE-CONTENUS.txt), comme
  [Les rouages du net](https://rouages.net).

Terminus, le jeu du MIT qui a inspiré celui-ci, n'est pas repris : ni son
code, ni ses textes.
