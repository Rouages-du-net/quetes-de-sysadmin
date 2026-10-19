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

- Site : **Astro** (`astro.config.mjs`, `output: 'static'`, `compressHTML`
  désactivé comme sur rouages.net). Pages dans `src/pages/`, gabarit
  `src/layouts/Base.astro`, styles du site `src/styles/site.css`, config
  Apache `public/.htaccess` (HTTPS, cache, CSP, CORS du fichier à intégrer).
- `src/moteur/` : shell simulé (`shell.ts`), commandes (`commandes/`, dont
  le manuel : `manuel.ts`, `pages.ts`), monde (`monde.ts`), histoires
  (`chapitres/`). Aucune dépendance au DOM.
- `src/moteur/systemd.ts` : services, journal et horloge d'une machine
  (`systemctl`, `journalctl`, `reboot` dans `commandes/systemd.ts`).
- `src/moteur/sshd.ts` : le serveur SSH d'une machine (lecture de
  `sshd_config` comme OpenSSH, configuration appliquée au reload).
- `src/moteur/parefeu.ts` : le pare-feu d'une machine (règles ufw ; `ssh`
  s'y heurte).
- `src/moteur/fail2ban.ts` : fail2ban d'une machine (configuration, bannissements ;
  `ssh` s'y heurte).
- `src/moteur/cron.ts` : crontabs (analyse comme cron) et nuit simulée.
- `src/moteur/nginx.ts` : nginx d'une machine (configuration lue et vérifiée
  comme `nginx -t`, appliquée au reload ; `curl` s'y adresse) ; `apt` et la
  commande `nginx` dans `commandes/apt.ts`.
- `src/moteur/tls.ts` : certificats (fichiers PEM lisibles par le jeu) ;
  `certbot` et `openssl` dans `commandes/certbot.ts` (le défi HTTP-01 passe
  par le nginx simulé).
- `src/moteur/dns.ts` : DNS (zones BIND, primaire, secondaire, cache du
  résolveur) ; `dig`, `host`, `named-checkzone`, `rndc` dans `commandes/bind.ts`.
- `src/moteur/docker.ts` : Docker d'une machine (images, conteneurs, couche,
  volumes, ports publiés, `--restart`, utilisateur du conteneur et droits sur
  les dossiers montés) ; les applis des images sont
  déclarées par les chapitres (`APPLIS`) ; la commande dans `commandes/docker.ts`.
  Docker Compose (`compose.yaml`, `.env`, réseau du projet) dans `src/moteur/compose.ts`.
- `src/moteur/script.ts` : un petit `/bin/sh` pour les crochets de git et
  les scripts (`sh`, `./script`, `test`, `date` dans `commandes/scripts.ts`) ;
  git (dépôts nus, `push`, crochets) dans `commandes/git.ts`, `diff` dans
  `commandes/diff.ts`.
- `chapitres/kiosque.ts` : l'appli des chapitres de déploiement de La
  Gazette (bleu/vert, `/health`, migration, visites simulées) ; nginx sait
  répartir entre plusieurs serveurs (`upstream`).
- `commandes/disques.ts` (`lsblk`, `mount`, `umount`, `etat.peripheriques`),
  `commandes/rsnapshot.ts`, `src/moteur/postgres.ts` et `commandes/postgres.ts`
  (`psql`, `pg_dump`, `pg_restore`, `createdb`, `dropdb`).
- `src/moteur/ouverts.ts` (fichiers tenus ouverts par un service : `lsof`,
  place des fichiers effacés), `commandes/journaux.ts` (`lsof`, `truncate`,
  `logrotate`) ; `src/moteur/memoire.ts` (mémoire des processus, OOM killer,
  `MemoryMax=`) et `commandes/memoire.ts` (`free`, `top`, `dmesg`) ; les
  surcharges systemd (`systemctl edit`, `set-property`, `daemon-reload`)
  dans `commandes/systemd.ts`. Inodes : un support de `etat.montages` peut
  déclarer `inodes` (et `inodesBase`) ; `df -i`, `du --inodes`, `find -mtime`
  (date `mtime` des fichiers) ; la limite ARG_MAX dans `shell.ts`.
  L'heure d'une machine (fuseau, horloge qui dérive, NTP) dans
  `src/moteur/heure.ts`, `timedatectl` dans `commandes/heure.ts`.
  Unités écrites à la main et timers systemd, et le temps qui passe minute
  par minute (`passerTemps`, timers et cron) dans `src/moteur/minuteries.ts` ;
  supervision (`check_disk`, `check_http`, `check_procs`, hors du PATH),
  `mail` et `last` dans `commandes/supervision.ts`. Une commande peut donner
  son code de retour (`jeu.statut`).
- `commandes/restic.ts` : dépôts restic (instantanés, déduplication,
  politiques de `forget`, `prune`), rangés dans `etat.restic`.
- `src/moteur/console.ts`, `machines.ts`, `poste.ts` : le réseau simulé ;
  on part du poste et on se connecte en `ssh` à la machine de chaque
  histoire (`commandes/ssh.ts`).
- `src/moteur/acces.ts` : le « vrai » ssh (machines à `etat.sshReel` et
  machines internes d'une histoire, `Chapitre.hotes`) : `~/.ssh/config`,
  `ProxyJump`, `known_hosts`, `authorized_keys`, phrase de passe, mot de
  passe ; `ssh-copy-id` et `scp` dans `commandes/transferts.ts`, `rsync`
  distant dans `commandes/sauvegarde.ts`. La console garde une pile de
  sessions internes (`interieur`) ; `Chapitre.surveillePoste` fait vérifier
  les événements après les commandes tapées sur le poste.
- `src/moteur/sudoers.ts` : la politique de sudo (`/etc/sudoers`,
  `@includedir`, règles) ; `visudo` et `sudo -l` dans `commandes/sudoers.ts` ;
  `userdel`, `gpasswd`, `chage` dans `commandes/comptes.ts` ; `umask` (masque
  de la session, `Shell.masque`) et setgid appliqués à la création (`placer`).
- `chapitres/caisse-web.ts` : le site et l'appli de caisse de La Coopérative
  (Express simulé : `.env` lu au démarrage, `trust proxy`, verrous par
  adresse) ; nginx transmet `proxy_set_header` à l'appli (`Demande`), et
  `grep` lit des expressions régulières (`versRegexBasique`).
- `commandes/tmux.ts` : sessions tmux d'une machine (`etat.tmux`, `Shell.tmux` ;
  la console y recopie ce qui s'affiche) et `uname` ; `apt upgrade` et
  `dpkg --configure -a` dans `commandes/apt.ts` (`etat.apt.mises`,
  `etat.noyau`, `etat.coupureReseau` : la connexion tombe, `Shell.coupure`).
- `src/moteur/lan.ts` : le réseau local d'un routeur (`etat.lan` : interfaces,
  VLAN 802.1Q sur un trunk, appareils du commutateur, `/etc/network/interfaces`
  lu comme ifupdown) ; `ip`, `ifup`, `ifdown`, `dnsmasq --test` dans
  `commandes/lan.ts` ; le DHCP (`dnsmasq.ts` : configuration, baux, journal) ;
  `ping` passe par ce modèle quand la machine en a un.
- `src/moteur/nftables.ts` : le pare-feu nftables d'un routeur (`etat.nft` :
  tables, chaînes, règles lues comme `nft`, trajet d'un paquet, NAT, trafic
  des appareils `Lan.flux`) ; `nft`, `sysctl` (`/proc/sys` est un dossier du
  monde) et `conntrack` dans `commandes/nftables.ts`.
- `src/moteur/wireguard.ts` : WireGuard d'un routeur (`etat.wg` : clés,
  `wg0.conf` lu comme wg-quick, pairs distants `Lan.distants` et leur
  poignée de main) ; `wg`, `wg-quick` et le service `wg-quick@NOM` dans
  `commandes/wireguard.ts`.
- `src/moteur/ldap.ts` : un annuaire OpenLDAP (`etat.ldap` : entrées, LDIF,
  schéma réduit, filtres, `{SSHA}`) ; `ldapsearch`, `ldapadd`, `ldapmodify`,
  `ldapdelete`, `ldappasswd`, `ldapwhoami`, `slappasswd`, `slapcat` dans
  `commandes/ldap.ts`.
- `src/interface/` : interface (`jeu.ts`, fonction `monter()`, éditeur `nano`
  dans `editeur.ts`) et styles
  (`styles.css`, tout sous `.qds`, couleurs en variables `--qds-*`).
- `src/element.ts` : l'élément `<quetes-de-sysadmin>` (Shadow DOM).
- `src/textes/<langue>/*.ftl` : tous les textes (Fluent), chargés par
  `src/textes/index.ts` (`traducteur()`, `typographie()`).
- `tests/quetes.test.ts` : chaque chapitre rejoué ; `tests/navigateur.mjs` :
  Chromium, 1000 et 375 px, CSP de `.htaccess` appliquée, page 404,
  intégration dans une autre page.
- Déploiement : `.github/workflows/deploy.yml` (tests sur chaque PR, FTPS et
  vérification du site en ligne depuis `main`) ; voir `docs/DEPLOIEMENT.md`.
  Toute nouvelle ressource doit respecter la CSP (aucun script en ligne).

```bash
npm install
npm test                    # Vitest
npm run dev                 # http://localhost:4321
npm run build               # site Astro (dist/) + fichier d'intégration (dist/integration/) + tsc
npm run preview &           # http://localhost:4340, puis :
npm run test:navigateur
```

**Textes** : tout texte affiché (histoire, dialogue, débrief, message,
page `man`) va dans `src/textes/fr/*.ftl` (format Fluent), jamais dans le
code ; le code appelle `t('id', { variable })` ou `jeu.t(...)`. Mode
d'emploi : `docs/TRADUIRE.md`. `tests/textes.test.ts` échoue si du français
reste dans `src/moteur/` ou `src/interface/`.

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
  messages du jeu et pages `man` vivent dans `src/textes/<langue>/*.ftl`
  (format **Fluent**, le français est la langue de référence) ; le code
  n'utilise que des identifiants (voir `docs/TRADUIRE.md`).
- **Pluriels, nombres et dates** via Fluent (sélecteurs, qui s'appuient sur
  `Intl`) ou `Intl` directement, jamais par concaténation. Un nombre
  technique (PID, port, taille brute) passe en texte : `String(pid)`.
- **Pas de phrase fabriquée par morceaux** : une phrase entière par clé, avec
  des variables nommées (`{ $fichier }`), car l'ordre des mots change d'une
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
