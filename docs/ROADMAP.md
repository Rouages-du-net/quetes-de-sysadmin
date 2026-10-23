# Quêtes de Sysadmin — feuille de route

*Apprendre le métier d'administrateur·rice système en jouant, dans le
navigateur, avec de vraies commandes et de vrais comportements.*

Projet issu de « Terminus en français » ([rouages.net](https://rouages.net/jeux/terminus/),
code dans `src/scripts/terminus/` du dépôt
[Rouages-du-net/rouages.net](https://github.com/Rouages-du-net/rouages.net)),
lui-même **inspiré de [Terminus](https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html),
créé au MIT par Shawn Conrad et Michele Pratusevich**. Le nouveau projet
garde cette mention et le lien vers l'original.

---

## Principes (repris de Terminus en français, à confirmer)

- **100 % statique**, dans le navigateur : aucune vraie machine, aucun vrai
  réseau. Tout est simulé (fichiers, services, réseau, temps), de façon
  déterministe et testable.
- **Vraies commandes, vrais comportements** : mêmes noms, mêmes options
  courantes, mêmes sorties (en anglais quand le vrai outil répond en
  anglais). Chaque écart volontaire est listé dans un tableau.
- **Une quête = un incident ou une mission réaliste** : un ticket, un
  objectif vérifiable par l'état du système simulé (pas par la commande
  exacte tapée), une ou plusieurs solutions acceptées.
- **On apprend aussi le « pourquoi »** : chaque quête finit par un débrief
  court (ce qui s'est passé, la bonne pratique, le lien vers la doc officielle).
- **Sans danger** : adresses de documentation (RFC 5737, 3849), domaines
  `.example`, aucune vraie cible ; les quêtes de sécurité restent défensives.
- **Accessible** : clavier, lecteur d'écran (sortie annoncée), contraste AA,
  mode réduit pour les animations, utilisable sur mobile (clavier virtuel).
- **Progression locale** (`localStorage`), sans compte, sans pisteur.
- **En français d'abord**, textes séparés du code pour pouvoir traduire
  (anglais, allemand, espagnol, mandarin, coréen… une fois le jeu terminé).
- **Licences** : code sous GPL v3 ou ultérieure, textes sous CC BY-SA 4.0.
- **Apprendre à se dépanner** : `man`, `--help`, `man -k`/`apropos` et
  `whatis` partout, dès la première quête ; des énigmes qui ne se résolvent
  qu'en lisant le manuel ; des messages d'erreur fidèles qui renvoient vers
  `--help`.

---

## Phase 0 — Fondations du nouveau dépôt

- [x] Reprendre le moteur de Terminus en français (shell, commandes,
      manuel, monde, cinq histoires) dans `src/moteur/` : le projet ne dépend
      plus de rouages.net
- [x] Interface autonome (`src/interface/`) et élément intégrable
      `<quetes-de-sysadmin>` (Shadow DOM, attributs `histoire`, `cle`,
      `theme`, `langue`, couleurs en variables CSS) ; mode d'emploi
      `docs/INTEGRER.md`
- [x] **Extraire les textes** des histoires, des commandes, du manuel et de
      l'interface vers `src/textes/fr/*.ftl`, au format standard **Fluent**
      (Weblate, Pontoon) ; aucun texte en dur, vérifié par les tests ; mode
      d'emploi `docs/TRADUIRE.md`
- [x] Nom, mention « inspiré de Terminus (MIT) », README, CLAUDE.md
      (consignes de l'agent dédié)
- [x] Licences : GPL v3 (code), CC BY-SA 4.0 (textes)
- [x] Charte de contribution (format d'une quête, tests, relecture) :
      `docs/CONTRIBUER.md`
- [x] Pile : site **Astro** (pages statiques), jeu en TypeScript sans
      framework (élément `<quetes-de-sysadmin>`, construit aussi seul par
      Vite pour l'intégration) ; tests Vitest (chaque chapitre rejoué) et
      vérification Playwright (`tests/navigateur.mjs`, aussi en CI)
- [x] Déploiement statique sur **sysadmin.rouages.net** : workflow
      `.github/workflows/deploy.yml` (FTPS depuis `main`, vérification du site
      en ligne), `.htaccess` (HTTPS, cache, CSP, CORS), page 404 ; mode
      d'emploi `docs/DEPLOIEMENT.md`
- [ ] Créer le sous-domaine sur cPanel et renseigner les secrets FTP
- [ ] Rediriger l'ancienne page `rouages.net/jeux/terminus/` vers
      sysadmin.rouages.net (ou y intégrer l'élément)
- [x] Réécrire les chapitres 1 et 2 dans un univers propre (fait dans
      rouages.net le 17 octobre 2026 : « L'Île du Phare » et « Le Bourg »)
- [ ] Progression : les joueur·ses de rouages.net (clé `rouages-terminus`,
      autre domaine) repartent de zéro ; l'annoncer sur l'ancienne page

## Phase 1 — Un moteur de « machines » simulées

Aujourd'hui, le moteur simule **une** machine. Les quêtes d'administration en
demandent plusieurs.

- [x] **Un seul monde** : chaque histoire devient une machine
      du même réseau simulé, et l'on passe de l'une à l'autre avec `ssh`
      (`ssh fourmiliere`). Finir l'Effaceur donne les clés des autres
      machines, à jouer ensuite dans l'ordre voulu. Le menu des
      histoires reste disponible (accessibilité, enseignant·es, intégration
      avec l'attribut `histoire`) ; une seule progression.
- [x] **Plusieurs hôtes** : chacun son système de fichiers et son nom,
      invite `utilisateur@hôte:~$` (`console.ts`, `machines.ts`, `poste.ts`)
- [x] Comptes propres à chaque machine ; l'état d'une machine est gardé
      entre deux connexions ssh (tant que la page est ouverte)
- [x] Services et ports propres à chaque machine (`ss`, `nc`, services
      systemd et leurs sockets décrits par chaque chapitre)
- [x] **Réseau simulé** : adresses, ports ouverts, résolution de noms
      (`/etc/hosts`, DNS), routes, latence ; ce qu'un pare-feu laisse passer
      (ufw, nftables), réseau local d'un routeur (VLAN, DHCP, NAT, VPN)
- [x] **Services** (`systemd` simulé, `src/moteur/systemd.ts`) : état,
      démarrage, échec, activation au démarrage, `systemctl`, `journalctl`,
      `reboot` ; quête « La nuit du redémarrage » (Datacenter, chapitre 3)
- [ ] Dépendances entre services, timers, fichiers d'unité modifiables
- [x] **Temps simulé** : horloge de systemd, tâches planifiées (`cron` :
      une nuit simulée lance les tâches qui y tombent)
- [ ] Timers systemd (faits : unités écrites à la main, `OnCalendar=`,
      `list-timers`, « La sonde »), journaux qui défilent, attaques
      « pendant » la quête
- [x] **Utilisateur·rices et groupes** : vrais droits de groupe, comptes par
      machine (`/etc/passwd`, `/etc/group`), `id`, `groups`, `usermod -aG`,
      `chgrp`, `chown` ; quête « Deuxième jour » (Datacenter, chapitre 2)
- [x] `sudoers` (`visudo`, `sudo -l -U`, `/etc/sudoers.d`), `umask`, bit
      setgid des dossiers partagés ; « Les droits partagés » (La
      Coopérative, chapitre 2)
- [x] **Éditeur de fichiers** façon `nano` (`^O`, `^X`, boutons sur
      mobile), droits vérifiés à l'enregistrement, objectifs des quêtes mis
      à jour ; solution alternative au chapitre 1 du Datacenter
- [x] Vérification de syntaxe par service : `sshd -t`, `nginx -t` (et
      `nginx -T`), rechargement refusé si la configuration est fausse
- [x] **Manuel intégré** : pages `man` complètes générées depuis la
      définition de chaque commande, `--help`, `man -k`, `apropos`, `whatis` ;
      option inconnue → vrai message d'erreur (repris du travail fait dans
      rouages.net)
- [x] **Vérificateur d'objectifs** : prédicats sur l'état (« le port 22
      n'accepte plus les mots de passe », « le site répond en HTTPS »…) :
      les événements de chaque chapitre

## Phase 2 — Se connecter et se déplacer

- [x] **SSH** : `ssh`, clés (`ssh-keygen`, `ssh-copy-id`, `authorized_keys`,
      phrase de passe), `~/.ssh/config`, empreinte de l'hôte (`known_hosts`),
      mot de passe puis refus du mot de passe ; « Les clés » (La Maison des
      associations, chapitre 1)
- [x] **Rebonds** : hôte bastion, `ssh -J` / `ProxyJump` (« Le rebond »),
      redirection de port locale `-L` avec `-f -N` (« Le tunnel ») ; reste
      `-R` et `-D`
- [x] **Durcissement SSH** : `PermitRootLogin no`, `PasswordAuthentication
      no`, `AllowUsers`, `sshd -t`, `sshd -T`, `Include` de Debian ; quête
      « Fermer la porte » (Les Lettres du quartier), où l'on peut s'enfermer
      dehors (le menu sert de console de secours)
- [x] **Changer le port SSH** : deux `Port`, ufw, `~/.ssh/config`, `known_hosts`
      en `[nom]:port`, le `port` de la prison fail2ban (« Le port », Les
      Lettres du quartier, chapitre 7)
- [x] **Transferts** : **`scp`**, `rsync` à distance (`-a`, `--delete`,
      `-n`) et pourquoi FTP en clair est à proscrire (« Les transferts ») ;
      `sftp`, et **FTPS** avec `lftp` pour les hébergeurs mutualisés qui
      l'imposent, le cas de rouages.net (« L'hébergeur », La Maison des
      associations, chapitre 5)
- [x] `tmux` : garder une session vivante quand la connexion tombe ;
      « Les mises à jour » (La Coopérative, chapitre 5)

## Phase 3 — Sécuriser le serveur

- [x] **Pare-feu** : `ufw` (politique par défaut, `allow`, `deny`, `reject`,
      `limit`, `delete`, profils d'applications, numéros), et `ssh` qui
      s'arrête au pare-feu (timeout) ; quête « Le pare-feu » (Les Lettres du
      quartier, chapitre 2)
- [x] Un aperçu de `nftables` sous `ufw` : `nft list ruleset` montre les
      chaînes `ufw-*` et la table de fail2ban (« Le port »)
- [x] **fail2ban** : lire `fail2ban.log` et le journal de SSH, `jail.local`
      (jamais `jail.conf`), `bantime`, `maxretry`, `ignoreip` (CIDR),
      `fail2ban-client status`, `unbanip`, `-t`, `reload` ; quête « La
      sentinelle » (Les Lettres du quartier, chapitre 3), où l'on peut se
      bannir soi-même
- [x] La prison `recidive` et la prison `nginx-limit-req`, activées dans
      leur section (« La récidive », Les Lettres du quartier, chapitre 8)
- [x] **Mises à jour** : `apt update`, `list --upgradable`, `upgrade`,
      `dpkg --configure -a`, `/var/run/reboot-required`, `uname -r`, noyau
      (« Les mises à jour », La Coopérative, chapitre 5) ; mises à jour
      automatiques (`unattended-upgrades` : `20auto-upgrades`,
      `Origins-Pattern`, `Mail`, `Automatic-Reboot-Time`, `apt-config`,
      « Les mises à jour automatiques », chapitre 6)
- [x] **Comptes** : supprimer un compte (`userdel`), désactiver le compte
      d'un ancien collègue (`usermod -e`, `chage -E`), clés à révoquer (y
      compris dans un compte partagé), `gpasswd -d`, `who`, `pkill -u` ;
      « Le départ » (La Coopérative, chapitre 1)
- [x] **Surface d'attaque** : `ss -tlnp`, un service qui écoute sur
      `0.0.0.0` au lieu de `127.0.0.1` (la base de données exposée)
- [x] **Certificats TLS** : Let's Encrypt (`certbot`), défi HTTP-01,
      renouvellement automatique, deploy hook, `openssl x509` et `s_client`,
      `curl https://` ; quête « Le certificat a expiré » (Datacenter,
      chapitre 5)
- [x] **Secrets** : fichier `.env` (et `.git`) publié par erreur, le journal
      d'accès, `location ~ /\.`, `deny`, rotation d'une clé ; « Le secret »
      (La Coopérative, chapitre 3)

## Phase 4 — Servir des sites

- [x] **Serveur web** : **Nginx**, **hôtes virtuels** (plusieurs sites sur une
      même machine), `sites-available` et `ln -s`, `nginx -t` avant de
      recharger ; quête « La colocation » (Les Lettres du quartier, chapitre 4)
- [ ] Apache, pour comparer
- [x] **Reverse proxy** devant une application (`proxy_pass`, barre finale,
      502 et `error.log`) ; `return 301` simulé
- [x] En-têtes transmis à l'appli (`proxy_set_header`, `X-Forwarded-For`,
      `trust proxy` d'Express) ; « Le proxy » (La Coopérative, chapitre 4)
- [x] **DNS** : enregistrements A, AAAA, CNAME, MX, TXT, TTL et caches (la
      « propagation »), zone BIND, serial, secondaire ; quête « Ça marche
      chez moi » (Les Lettres du quartier, chapitre 5)
- [x] **Journaux d'accès** : trouver qui fait tomber le site (`awk`, `sort`,
      `uniq -c`), limiter le débit (`limit_req`, rafale, 429) ; quête « Le
      soir du concert » (Les Lettres du quartier, chapitre 6)

## Phase 5 — Conteneurs

- [x] **Docker** : image, conteneur, `docker run/ps/logs/exec/cp`, ports,
      volumes (et ce qu'on perd sans volume), `--restart` ; quête « La mise
      à jour » (La Fabrique, chapitre 1)
- [x] **Docker Compose** : plusieurs services (appli, base), réseau
      interne (le nom du service), variables et `.env`, volumes, redémarrage ;
      quête « La composition » (La Fabrique, chapitre 2)
- [x] Mettre à jour une image sans perdre les données (« La mise à jour »)
- [x] Nettoyer le disque (`docker system df`, `prune`) ; « Le trou dans le pare-feu »
- [x] Sécurité : ne pas exposer la base, `ufw` et Docker (les ports publiés
      contournent ufw) ; « Le trou dans le pare-feu » (La Fabrique, chapitre 3)
- [x] Ne pas tourner en root dans le conteneur : `--user`, `user:`, l'uid
      partagé avec la machine, `chown -R` ; « Les pleins pouvoirs » (La Fabrique,
      chapitre 4)

## Phase 6 — Déployer

- [x] **Déploiement par git** : dépôt nu sur le serveur, crochet
      `post-receive` ; « Le dépôt nu » (La Gazette, chapitre 1)
- [x] **Intégration continue** (simulée) : tests qui bloquent un déploiement
      (`tests.sh` lancé par le crochet avant la bascule) ; « Le retour arrière »
      (La Gazette, chapitre 2)
- [x] **Bleu/vert** : deux versions côte à côte, bascule du proxy, retour
      arrière instantané ; « Bleu et vert » (La Gazette, chapitre 3)
- [x] **Canari** et vérifications de santé (`/health`) : `upstream` et
      `weight`, les 500 dans `access.log` ; « Le canari » (La Gazette, chapitre 4)
- [x] **Migrations de base de données** qui empêchent le retour arrière ;
      « La migration » (La Gazette, chapitre 5)
- [x] **Retour arrière** (`rollback`) après un déploiement raté : `ln -sfn`
      vers la version d'avant (chapitre 2), rebascule du proxy (chapitres 3 et 4)

## Phase 7 — Sauvegarder et restaurer

- [x] **La règle 3-2-1**, et pourquoi une copie sur le même disque n'est pas
      une sauvegarde (débrief de « La Sauvegarde »)
- [x] **rsync** : `-a`, `-v`, `-n`, `--delete`, la barre finale ; planifié
      avec `cron` ; quête « La Sauvegarde » (Effaceur, chapitre 4)
- [x] **rsnapshot** (instantanés par liens physiques, rotation quotidienne et
      hebdomadaire, cron) ; « Les instantanés » (La Ludothèque, chapitre 2)
- [x] **restic** (chiffrement, déduplication, `snapshots`, `find`, `diff`,
      `dump`, `restore`, `forget --prune`, `check`) ; quête « Les versions »
      (Les Archives, chapitre 2)
- [x] Sauvegarder une base (`pg_dump`, `pg_restore`) plutôt que ses fichiers,
      restauration de test ; « La base » (La Ludothèque, chapitre 3)
- [x] **Restauration de service** : quête « Le grand incendie » (Datacenter,
      chapitre 4) : repartir d'une machine vide avec les sauvegardes et le
      plan de reprise ; archive coupée à vérifier avec `tar -tzf`, `apt`,
      `nginx -t`, clé d'hôte SSH qui change (`ssh-keygen -R`)
- [x] **Exercice de restauration** : un souvenir effacé à restaurer depuis
      la sauvegarde (« La Sauvegarde »)
- [x] Rançongiciel et sauvegardes hors ligne (`mount -o ro`, restic) ;
      « La rançon » (La Ludothèque, chapitre 1)
- [x] Charge et ressources : `top`, `free`, `df`, `du` faits (L'Astreinte,
      chapitres 1 et 2) ; `iostat`, `pidstat -d`, `ionice` et la limite de débit
      de systemd (`IOWriteBandwidthMax=`) : « Le goulot » (chapitre 7)
- [x] Pannes classiques : disque plein et fuite de journaux (« Le disque
      plein »), mémoire épuisée (OOM) et processus zombies (« La mémoire »),
      inodes épuisés (« Les inodes »), horloge décalée et fuseau
      (« L'horloge », NTP et `timedatectl`) faits
- [x] Rotation des journaux (`logrotate`) ; « Le disque plein »
      (L'Astreinte, chapitre 1)
- [x] Supervision et alertes (plugins `check_disk`, `check_http`,
      `check_procs`, `mail`, seuils, exercice de panne) ; « La sonde »
      (L'Astreinte, chapitre 5)
- [x] **Post-mortem sans reproche** : rédiger ce qui s'est passé
      (`journalctl --since/--until`, `last`) ; « Le post-mortem »
      (L'Astreinte, chapitre 6)

## Phase 9 — Le réseau d'entreprise

- [x] Commutateurs et **VLAN** : séparer bureaux, invité·es et
      équipements ; port « trunk » (802.1Q) vers le routeur, `ip link`,
      `/etc/network/interfaces` ; « Les VLAN » (La Ruche, chapitre 1)
- [x] DHCP : dnsmasq, une plage par VLAN, réservations ; « Le DHCP » (La
      Ruche, chapitre 2)
- [x] Routage, NAT et pare-feu entre zones : `sysctl`, nftables
      (`forward`, `masquerade`, `ct state`), `conntrack` ; « Les zones » (La
      Ruche, chapitre 3)
- [x] Une DMZ : un serveur public dans un VLAN à part, `dnat` au
      `prerouting`, la DMZ isolée du réseau interne ; « La DMZ » (La Ruche,
      chapitre 5)
- [x] VPN WireGuard pour le télétravail : clés, `wg0.conf`, `wg-quick`,
      pare-feu ; « Le télétravail » (La Ruche, chapitre 4)
- [x] VPN entre deux sites : un pair de plus sur `wg0`, `AllowedIPs` comme
      table de routage, `PersistentKeepalive` derrière une box ; « L'Annexe »
      (La Ruche, chapitre 6)
- [x] Annuaire : OpenLDAP pour les comptes de l'équipe (`ldapsearch`,
      LDIF, `ldapmodify`, `slappasswd`) ; « L'annuaire » (La Ruche, chapitre 7)
- [x] Wi-Fi d'entreprise : 802.1X avec FreeRADIUS, qui vérifie les comptes
      dans l'annuaire et place chacun dans son VLAN ; « Le Wi-Fi des bureaux »
      (La Ruche, chapitre 8)

Écarté : les boucles réseau et Spanning Tree (trop bas niveau pour ce jeu,
qui travaille sur les machines plutôt que sur les commutateurs).

---

## Phase 10 — Traductions

Une fois le jeu terminé en français (l'architecture le prépare dès la
phase 0 : voir « Traductions » dans `CLAUDE.md`).

- [x] Anglais (`src/textes/en/`, page `/en/`, chaque quête rejouée en anglais)
- [ ] Allemand, espagnol, mandarin, coréen, puis d'autres langues
- [x] Sorties des commandes simulées selon `LANG`, comme les vrais outils (en anglais : les messages d'origine, comme avec `LANG=C`)
- [x] Noms de lieux et d'objets traduits et faciles à taper (`noms.ftl`,
      L'Effaceur et le poste) ; complétion testée dans chaque langue
- [x] Noms des documents des autres histoires (courriels, messages, notes
      d'aide, `LISEZMOI.txt`… : `noms: true` partout)
- [x] Noms des données des serveurs, jusque dans ce qui les garde en mémoire
      (instantanés restic et rsnapshot, copies rsync, fichiers suivis par
      git, scripts, crontabs, journaux) : fonds des Archives et disque de
      la mairie, roman et poèmes d'Inès, partage et rançongiciel de la
      Ludothèque, partage, sauvegardes et wiki de la Maison des
      associations, relevés et sauvegardes de la Coopérative, dossier de
      l'équipe du Datacenter, dossiers de la radio de L'Astreinte ; restent
      tels quels les noms techniques (sites et adresses servis par HTTP,
      bases, images et projets Docker, unités systemd, programmes et
      scripts du PATH) et les noms propres (émissions de la radio)
- [x] Nom du compte du joueur ou de la joueuse (`vous`, en anglais `you` :
      invite, `/home`, propriétaires, journaux…) et de l'utilisateur de
      l'Effaceur (`effaceur`, `eraser`) ; les noms des machines (`royaume`,
      `datacenter`…) restent ceux des hôtes
- [ ] Recollage des paragraphes et typographie selon la langue (le chinois et
      le coréen ne séparent pas les lignes par une espace)
- [ ] Plateforme de traduction (Weblate hébergé, gratuit pour les projets
      libres) branchée sur `src/textes/`
- [ ] Terminal simulé compatible avec les caractères larges (CJK)
- [ ] Relecture par des locuteur·rices natif·ves, glossaire technique par langue
- [ ] Quêtes rejouées automatiquement dans chaque langue

## Idées en plus

- [x] **Bilan de fin de chapitre** (`src/moteur/bilan.ts`) : temps passé,
  commandes tapées (et en erreur), indices ; le détail compare, étape par
  étape, la commande qui l'a franchie à la solution de référence (celle des
  indices), en rappelant qu'une autre façon de faire est tout aussi juste.
- [x] **Instantané de secours** (panneau Mission, `Console.restaurer`) :
  prendre un instantané, y revenir, annuler la dernière saisie. Le moteur
  est déterministe : rouvrir le chapitre et rejouer les saisies (commandes,
  réponses, enregistrements de nano) redonne la machine d'alors. Pas
  d'instantané en mode examen, ni quand on est passé par le poste.
- [x] **Parcours thématiques** (`src/moteur/parcours.ts`, troisième vue du
  menu) : premiers pas, sécurité, web, réseaux, sauvegardes, conteneurs et
  déploiement, production, comptes et identités ; chaque chapitre est dans
  au moins un parcours ; le prochain à faire est mis en avant, ce qui
  attend dit quel chapitre finir d'abord.
- [x] **Coloration de la ligne de commande**, comme fish ou
  zsh-syntax-highlighting : la commande en vert si le shell du jeu la
  lancerait, en rouge (et soulignée d'une vague) sinon, les options, les
  chaînes, les jokers qui trouvent quelque chose, les tubes et redirections,
  les chemins qui existent soulignés ; la commande reste colorée au-dessus de
  sa sortie. Rien pour une réponse (yes/no, mot de passe, `sftp>`). Contraste
  AA dans les quatre thèmes ; bouton « Couleurs » pour la couper.
- [x] **Couleurs des sorties**, comme les vrais outils (séquences ANSI,
  `src/moteur/couleurs.ts`) : `ls --color=auto` et `grep --color=auto` (les
  alias de Debian), `diff --color`, `systemctl status` et `--failed` ; à
  l'écran seulement, jamais dans un tube ni un fichier (sauf
  `--color=always`) ; les événements lisent la sortie sans les codes, et
  chaque chapitre est rejoué avec les couleurs. Reste à faire : `ip -c`,
  `journalctl` (priorités), `git diff`.
- [x] **Carte du réseau en menu** : le poste, internet, puis une machine par
  histoire (nom et adresse), branchée sur un même câble ; sa branche est en
  pointillés tant qu'elle est verrouillée, ambre quand on y joue, verte quand
  l'histoire est finie, et un paquet y file (coupé si le système demande moins
  d'animations). La vue « Baies » (les mêmes boutons, avec leur résumé) reste
  au choix ; le choix est gardé dans le navigateur.
- [x] **Affichage du terminal** : quatre thèmes (phosphore, ambre, contraste
  élevé, papier), taille du texte, plein écran (Échap en sort), gardés dans le
  navigateur ; mises en scène d'une connexion et d'un redémarrage (coupées si
  le système demande moins d'animations).
- [x] **Tableau de classe** pour les enseignant·es : on y glisse les fichiers
  de sauvegarde des élèves (ou on colle leurs codes) ; chapitres, grade,
  succès, meilleur examen, avancée par histoire ; export CSV (sans formule
  injectable) ; tout reste dans le navigateur.
- [x] **Indices gradués**, dans la Mission : le manuel d'abord, puis une
  piste, puis presque la réponse, pour la première étape pas encore franchie
  (`indices-<histoire>.ftl`) ; le débrief compte les indices demandés ; rien
  en mode examen ; un succès « Sans filet » pour un chapitre sans indice.
- [x] **Succès et grades** : 17 succès vérifiés sur ce qui s'est vraiment
  passé (ls -a, un tube, une redirection, une restauration, le mode examen…),
  dont 3 clins d'œil cachés (xyzzy, le sandwich de xkcd 149, sl) ; un grade,
  de Stagiaire à SRE, selon les chapitres terminés, aussi dans le carnet.
- [x] **Mission, barre de touches mobile, Ctrl-R et Ctrl-C** ; **style
  « salle des machines »** propre au site.
- [x] **Emporter sa progression** (salles de TP) : « Ma progression » donne
  un code court à recopier (les chapitres terminés, somme de contrôle contre
  les fautes de frappe, ordre des chapitres figé : `tests/progression/ordre.txt`)
  ou un fichier JSON avec toute la sauvegarde ; un nom facultatif s'inscrit
  en tête du carnet. Sans serveur ni chiffrement : ce n'est pas une preuve.
- [x] **La carte** : un bouton au-dessus du terminal ouvre, dans une
  fenêtre, l'arbre des lieux connus de la machine où l'on est (lieux
  visités, lieux aperçus en italique, maison, lieux fermés), avec « tu es
  ici ». Rien n'est dévoilé au-delà de ce qu'on a vu ; pas de fichiers.
- [x] **Le plan du réseau** : dans les histoires à plusieurs machines (La
  Maison des associations, La Ruche), un onglet « Réseau » de la carte
  montre le réseau prévu (le schéma affiché au mur : routeur, VLAN,
  machines internes, tunnels WireGuard), en SVG et en liste, avec « tu es
  ici » et les machines où l'on s'est déjà connecté·e. C'est le plan, pas
  l'état : le vérifier reste le travail des vraies commandes.
- [x] **Le carnet du sysadmin** : chaque commande découverte s'ajoute à un
  aide-mémoire personnel (sa ligne du manuel, la première ligne tapée, le
  chapitre), gardé dans le navigateur, exportable en Markdown.
- [x] **Mode « examen »** : une case au-dessus du terminal ; le chapitre
  recommence sur une machine neuve, sans aucun indice (seul le débrief
  s'affiche), avec un chrono et le meilleur temps gardé dans le navigateur.
  Reste possible : des pannes tirées au hasard, propres à l'examen.
- [x] **Quêtes à plusieurs bonnes réponses** : « UNE AUTRE VOIE » dans le
  débrief de quinze chapitres (`ufw` ou `nftables`, `rsnapshot` ou `restic`,
  fail2ban ou `ufw limit`, certbot ou acme.sh et DNS-01…). Reste possible :
  des chapitres qu'on fait des deux façons.
- [x] **Défis de la communauté** : format de quête documenté pour que d'autres
  en écrivent (`docs/CONTRIBUER.md`).
- [x] **Lien avec rouages.net** : après un chapitre, les étapes des modules
  ou les mots du glossaire qui expliquent son concept (DNS, TLS, NAT…),
  `src/moteur/rouages.ts`. Reste le sens inverse, à faire sur rouages.net.
- [x] **Pour les enseignant·es** : fiches par quête (objectif, prérequis,
  commandes découvertes, durée indicative) sur `/enseignants/`, générées à la
  construction (`src/moteur/fiches.ts`) ; progression exportable sans compte,
  en tête du carnet téléchargé.

---

## Organisation

- Un **agent dédié** sur le dépôt, avec un CLAUDE.md qui reprend les règles de
  rouages.net : français, accessibilité, statique, tests avant de pousser, PR
  automatique, écarts avec le vrai Linux documentés, aucune donnée
  personnelle.
- Ordre conseillé : phase 0, puis 1 (moteur multi-hôtes), puis 2 et 3 (le
  cœur du métier), puis 7 (sauvegardes), avant les conteneurs et le
  déploiement.
