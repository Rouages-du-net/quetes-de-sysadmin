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
- `src/moteur/fail2ban.ts` : fail2ban d'une machine (configuration, prisons sshd,
  nginx-limit-req et recidive, bannissements,
  `port` de la prison ; `ssh` s'y heurte). `src/moteur/apercu-nft.ts` : ce que
  `nft list ruleset` montre sous ufw et fail2ban.
- `src/moteur/cron.ts` : crontabs (analyse comme cron) et nuit simulée.
- `src/moteur/nginx.ts` : nginx d'une machine (configuration lue et vérifiée
  comme `nginx -t`, appliquée au reload ; `curl` s'y adresse) ; `apt` et la
  commande `nginx` dans `commandes/apt.ts`.
- `src/moteur/apache.ts` : Apache d'une machine (configuration de Debian lue
  comme `apache2ctl configtest`, hôtes virtuels, `.htaccess` et `AllowOverride`,
  `mod_rewrite`) ; joint par nginx et `curl` comme une appli (`etat.applis`) ;
  `/etc/apache2` du paquet dans `apache-debian.ts` ; `apache2ctl`, `a2ensite`,
  `a2enmod`… dans `commandes/apache.ts`.
- `src/moteur/courrier.ts` : le courrier d'une machine (Postfix : `main.cf`, la
  file, `/var/log/mail.log` ; OpenDKIM : `opendkim.conf`, clé, signature au
  passage du milter ; SPF, DKIM et DMARC vérifiés par les serveurs d'en face
  avec le DNS simulé) ; `postconf`, `postfix`, `postqueue`, `mailq`, `postsuper`,
  `opendkim-genkey`, `opendkim-testkey` dans `commandes/courrier.ts` ;
  `chapitres/jardins.ts` : ce que les chapitres du « Courrier indésirable »
  ont en commun.
- `src/moteur/ansible.ts` : Ansible (un sous-ensemble de YAML, `ansible.cfg`,
  inventaire INI, modules, `become`, `--check`, `--diff`, handlers, PLAY
  RECAP) ; la connexion passe par `connecterSansQuestion` d'`acces.ts`
  (comme BatchMode) ; `ansible`, `ansible-playbook`, `ansible-inventory`,
  `ansible-doc` dans `commandes/ansible.ts` ; `chapitres/flotte.ts` : ce que
  les chapitres de « La flotte » ont en commun.
- `src/moteur/caddy.ts` : Caddy d'une machine (`etat.caddy` : Caddyfile lu
  comme l'adaptateur, `caddy fmt`, HTTPS automatique avec une autorité ACME
  simulée que le DNS et le pare-feu peuvent bloquer, journaux JSON, ce que
  répond Caddy à `curl`) ; `caddy` dans `commandes/caddy.ts`.
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
  dans `commandes/systemd.ts`. Les entrées-sorties disque (`etat.io` :
  demandes, ordonnanceur, `IO*BandwidthMax=`, classes d'ionice) dans
  `src/moteur/entrees-sorties.ts`, `iostat`, `pidstat`, `ionice` dans
  `commandes/iostat.ts`. Inodes : un support de `etat.montages` peut
  déclarer `inodes` (et `inodesBase`) ; `df -i`, `du --inodes`, `find -mtime`
  (date `mtime` des fichiers) ; la limite ARG_MAX dans `shell.ts`.
  L'heure d'une machine (fuseau, horloge qui dérive, NTP) dans
  `src/moteur/heure.ts`, `timedatectl` dans `commandes/heure.ts`.
  Unités écrites à la main et timers systemd, et le temps qui passe minute
  par minute (`passerTemps`, timers et cron) dans `src/moteur/minuteries.ts` ;
  la machine qui vit pendant qu'on joue (`Chapitre.activite`, `vivre()`) dans
  `src/moteur/activite.ts`, le suivi `tail -f`/`journalctl -f` (`Shell.suivi`,
  `Console.suivre()`, `interrompre()` pour Ctrl-C) ;
  supervision (`check_disk`, `check_http`, `check_procs`, hors du PATH),
  `mail` et `last` dans `commandes/supervision.ts`. Une commande peut donner
  son code de retour (`jeu.statut`).
- `src/moteur/stockage.ts` : le stockage d'une machine (`etat.stockage` :
  disques et SMART, partitions GPT, grappes RAID 1, `/proc/mdstat`, la
  reconstruction qui avance avant chaque commande, `Chapitre.avantCommande`) ;
  `smartctl`, `mdadm`, `sfdisk`, `grub-install` et `lsblk` sur ce modèle dans
  `commandes/stockage.ts` (dont `mdadm --create`) ; LVM (`stockage.lvm` : PV,
  VG, LV en segments, taille du système de fichiers) dans `src/moteur/lvm.ts`,
  `pvs`, `vgs`, `lvs`, `pvcreate`, `pvremove`, `vgextend`, `vgreduce`,
  `pvmove`, `lvextend`, `resize2fs`, `update-initramfs` dans `commandes/lvm.ts` ;
  `/etc/fstab` (lecture, sources `UUID=`/`LABEL=`, démarrage et mode secours :
  `etat.demarrerMontages`, `etat.continuerDemarrage` appelés par `reboot`,
  `systemctl default` et `exit`) dans `src/moteur/fstab.ts`, `mount -a` dans
  `commandes/disques.ts`, `blkid` et `findmnt` dans `commandes/fstab.ts` ;
  `chapitres/labo.ts` : ce que les chapitres du Labo ont en commun.
- `commandes/restic.ts` : dépôts restic (instantanés, déduplication,
  politiques de `forget`, `prune`), rangés dans `etat.restic`.
- `src/moteur/deverrouillage.ts` : les histoires s'ouvrent par vagues ; une
  histoire ajoutée déclare dans `chapitres/index.ts` (`apres`) les chapitres
  à finir avant d'en recevoir la clé (`prerequis()` pour les tests).
- `src/moteur/console.ts`, `machines.ts`, `poste.ts` : le réseau simulé (et
  l'instantané de secours, `Console.restaurer` : le moteur reste déterministe,
  sans `Date.now` ni `Math.random`) ;
  on part du poste et on se connecte en `ssh` à la machine de chaque
  histoire (`commandes/ssh.ts`).
- `src/moteur/acces.ts` : le « vrai » ssh (machines à `etat.sshReel` et
  machines internes d'une histoire, `Chapitre.hotes`) : `~/.ssh/config`,
  `ProxyJump`, `known_hosts`, `authorized_keys`, phrase de passe, mot de
  passe ; `ssh-copy-id` et `scp` dans `commandes/transferts.ts`, `rsync`
  distant dans `commandes/sauvegarde.ts`. `sftp` (session interactive) dans
  `commandes/sftp.ts` ; un hébergement mutualisé en FTPS
  (`src/moteur/hebergeur.ts`, déclaré par l'histoire) et `lftp` dans
  `commandes/lftp.ts`. La console garde une pile de
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
  `etat.noyau`, `etat.coupureReseau` : la connexion tombe, `Shell.coupure`) ;
  `unattended-upgrade` et `apt-config` dans `commandes/unattended.ts`, la
  configuration d'apt (`apt.conf.d`) dans `src/moteur/aptconf.ts`.
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
- `src/moteur/radius.ts` : FreeRADIUS (`etat.radius` : configuration lue au
  démarrage, `clients.conf`, module ldap, fichier `users`, demandes des
  bornes et VLAN) ; `freeradius` et `radtest` dans `commandes/radius.ts`.
- `chapitres/audit.ts` : ce que les chapitres de « L'Audit » ont en commun
  (le serveur du Fournil : comptes, `sshd_config`, sudoers, `mondeFournil`,
  le réseau que voit nmap, `sectionsMd` pour relire un document du joueur) ;
  `perimetre.ts`, `rapport.ts`, `exposition.ts` (le `bind` de Redis lu au
  redémarrage, par le service), `traces.ts` (journal de ssh et `last` écrits
  par `initialiser`, empreintes de clés, crontab de Nadia, le mot de passe de
  la base : `ALTER ROLE` et `.env` lu au démarrage de l'appli) et
  `contre-visite.ts`.
- `src/moteur/scan.ts` et `commandes/nmap.ts` : nmap sur le réseau déclaré par
  l'histoire (`etat.scan` : machines, services, périmètre ; `etat.scans`
  garde chaque balayage) ; `src/moteur/lynis.ts` et `commandes/lynis.ts` :
  Lynis (constats lus sur l'état de la machine, `/var/log/lynis-report.dat`).
- `chapitres/veille.ts` : ce que les chapitres de « La Veille » ont en commun
  (le serveur `petrin`, six mois après « L'Audit » : comptes, `mondeVeille`,
  les CVE fictives `CVE-2099-NNNNN` du bulletin) ; `bulletin.ts`,
  `priorite.ts`, `correctif.ts`, `preuve.ts` (une tentative antérieure dans
  le journal d'accès de nginx) et `routine.ts` (`unattended-upgrades`
  restreint à la sécurité via `src/moteur/aptconf.ts`, un timer ou une tâche
  cron écrits à la main, `src/moteur/minuteries.ts`).
- `src/interface/` : interface (`jeu.ts`, fonction `monter()`, éditeur `nano`
  dans `editeur.ts`, le carnet du sysadmin dont la logique est dans
  `src/moteur/carnet.ts`, les liens vers rouages.net après un chapitre dans
  `src/moteur/rouages.ts`, la carte des lieux connus dont la logique est
  dans `src/moteur/carte.ts`, et son onglet « Réseau » : le plan prévu du
  réseau, déclaré par chaque chapitre dans `Chapitre.plan`, voir
  `src/moteur/plan.ts` ; « Ma progression », le code court et le fichier
  de sauvegarde, dans `src/moteur/progression.ts` : un chapitre ajouté va
  à la fin d'`ORDRE_DU_CODE` et de `tests/progression/ordre.txt` ; les
  succès et le grade dans `src/moteur/succes.ts`, les clins d'œil dans
  `OEUFS` de `shell.ts` ; la coloration de la ligne de commande dans `src/moteur/coloration.ts` (elle suit le
  shell du jeu : `decouper()`, `connues()`), les couleurs des sorties (séquences ANSI,
  `Shell.couleurs`, `--color`) dans `src/moteur/couleurs.ts` : une condition
  d'événement lit `derniere.sortie`, déjà sans couleurs ; l'astreinte et l'incident du jour dans `src/moteur/astreinte.ts` (tiré
  de la date par l'interface ; le moteur ne lit pas l'heure), les parcours thématiques dans `src/moteur/parcours.ts` (un chapitre ajouté
  va dans au moins un parcours, `tests/parcours.test.ts` le vérifie), le bilan de fin de chapitre dans `src/moteur/bilan.ts` (`Shell.franchies`,
  `commandesTapees`), les indices gradués dans `src/moteur/indices.ts`,
  leurs textes dans `src/textes/<langue>/indices-<histoire>.ftl` : chaque
  nouveau chapitre en a, `tests/indices.test.ts` le vérifie) et styles
  (`styles.css`, tout sous `.qds`, couleurs en variables `--qds-*`).
- `src/element.ts` : l'élément `<quetes-de-sysadmin>` (Shadow DOM).
- `src/pages/enseignants.astro` et `src/pages/en/teachers.astro` : les
  fiches des quêtes (composant `src/components/Fiches.astro`), calculées par
  `src/moteur/fiches.ts` (commandes découvertes, prérequis, durée).
  Le tableau de classe (`/enseignants/classe/`, `/en/teachers/class/`,
  composant `Classe.astro`, `src/interface/classe.ts`, logique dans
  `src/moteur/classe.ts`) lit les sauvegardes des élèves dans le navigateur.
- `src/textes/<langue>/*.ftl` : tous les textes (Fluent), chargés par
  `src/textes/index.ts` (`traducteur()`, `typographie()`) ; `noms.ftl` : les
  noms des lieux et des objets des chapitres à `noms: true` (dans le code,
  `chemin()` et `nom()` de `monde.ts` ; dans les tests, `dansLaLangue()`) ;
  `machines.ftl` : les noms des machines (royaume → kingdom ; `nomMachine()`,
  `hoteDansLaLangue()` de `machines.ts`, `Shell.nomHote` ; dans les tests,
  `machinesDansLaLangue()`) ; `mots-de-passe.ftl` : les mots de passe des
  histoires (`motDePasse()` de `monde.ts`).
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
  noms en `.internal` pour les machines et réseaux internes (ICANN, 2024),
  `.example` pour ce qui est public : sites, DNS, courriels (RFC 6761) ;
  jamais un nom inventé qui pourrait exister. Les quêtes de sécurité restent défensives :
  on protège, on détecte, on répare.
- **Crédit** : garder la mention « inspiré de Terminus, créé au MIT par Shawn
  Conrad et Michele Pratusevich » et le lien vers l'original. Ne pas reprendre
  les lieux, textes ni énigmes de l'original.

## Traductions (prévues : anglais, allemand, espagnol, mandarin, coréen…)

Le jeu sera traduit une fois terminé. Tout le code doit le permettre dès
maintenant :

- **Aucun texte en dur dans le code** : histoires, dialogues, débriefs,
  messages du jeu et pages `man` vivent dans `src/textes/<langue>/*.ftl`
  (format **Fluent**, le français est la langue de référence, l'anglais la
  langue par défaut et de repli) ; le code
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
