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
- [ ] Charte de contribution (format d'une quête, tests, relecture)
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
- [ ] Services et ports propres à chaque machine
- [ ] **Réseau simulé** : adresses, ports ouverts, résolution de noms
      (`/etc/hosts`, DNS), routes, latence ; ce qu'un pare-feu laisse passer
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
- [ ] **Manuel intégré** : pages `man` complètes générées depuis la
      définition de chaque commande, `--help`, `man -k`, `apropos`, `whatis` ;
      option inconnue → vrai message d'erreur (repris du travail fait dans
      rouages.net)
- [ ] **Vérificateur d'objectifs** : prédicats sur l'état (« le port 22
      n'accepte plus les mots de passe », « le site répond en HTTPS »…)

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
- [ ] Changer le port SSH (et le pare-feu qui va avec, phase 3)
- [ ] **Transferts** : **`scp`**, `rsync` à distance (`-a`, `--delete`,
      `-n`) et pourquoi FTP en clair est à proscrire faits (« Les
      transferts ») ; reste `sftp`, et **FTPS** pour les hébergeurs
      mutualisés qui l'imposent (le cas de rouages.net !)
- [x] `tmux` : garder une session vivante quand la connexion tombe ;
      « Les mises à jour » (La Coopérative, chapitre 5)

## Phase 3 — Sécuriser le serveur

- [x] **Pare-feu** : `ufw` (politique par défaut, `allow`, `deny`, `reject`,
      `limit`, `delete`, profils d'applications, numéros), et `ssh` qui
      s'arrête au pare-feu (timeout) ; quête « Le pare-feu » (Les Lettres du
      quartier, chapitre 2)
- [ ] Un aperçu de `nftables` sous `ufw`
- [x] **fail2ban** : lire `fail2ban.log` et le journal de SSH, `jail.local`
      (jamais `jail.conf`), `bantime`, `maxretry`, `ignoreip` (CIDR),
      `fail2ban-client status`, `unbanip`, `-t`, `reload` ; quête « La
      sentinelle » (Les Lettres du quartier, chapitre 3), où l'on peut se
      bannir soi-même
- [ ] La prison `recidive`, d'autres prisons (nginx)
- [ ] **Mises à jour** : `apt update`, `list --upgradable`, `upgrade`,
      `dpkg --configure -a`, `/var/run/reboot-required`, `uname -r`, noyau
      (« Les mises à jour », La Coopérative, chapitre 5) ; reste les mises à
      jour automatiques (`unattended-upgrades`)
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
- [ ] Charge et ressources : `top`, `free`, `df`, `du` faits (L'Astreinte,
      chapitres 1 et 2) ; reste `iostat`
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
- [ ] Annuaire : OpenLDAP pour les comptes de l'équipe (La Ruche,
      chapitre 7)
- [ ] Wi-Fi d'entreprise : 802.1X avec FreeRADIUS, qui vérifie les comptes
      dans l'annuaire et place chacun dans son VLAN (La Ruche, chapitre 8)

Écarté : les boucles réseau et Spanning Tree (trop bas niveau pour ce jeu,
qui travaille sur les machines plutôt que sur les commutateurs).

---

## Phase 10 — Traductions

Une fois le jeu terminé en français (l'architecture le prépare dès la
phase 0 : voir « Traductions » dans `CLAUDE.md`).

- [ ] Anglais, allemand, espagnol, mandarin, coréen, puis d'autres langues
- [ ] Sorties des commandes simulées selon `LANG`, comme les vrais outils
- [ ] Noms de lieux et d'objets traduits et faciles à taper (encore dans le
      code) ; complétion testée ; nom de l'utilisateur·rice (`vous`) et de
      la machine dans l'invite
- [ ] Recollage des paragraphes et typographie selon la langue (le chinois et
      le coréen ne séparent pas les lignes par une espace)
- [ ] Plateforme de traduction (Weblate hébergé, gratuit pour les projets
      libres) branchée sur `src/textes/`
- [ ] Terminal simulé compatible avec les caractères larges (CJK)
- [ ] Relecture par des locuteur·rices natif·ves, glossaire technique par langue
- [ ] Quêtes rejouées automatiquement dans chaque langue

## Idées en plus

- **Le carnet du sysadmin** : chaque commande découverte s'ajoute à un aide-mémoire
  personnel, exportable.
- **Mode « examen »** : une machine en panne, sans indices, avec un chrono.
- **Quêtes à plusieurs bonnes réponses** : comparer deux solutions (`ufw` ou
  `nftables`, `rsnapshot` ou `restic`) et leurs compromis.
- **Défis de la communauté** : format de quête documenté pour que d'autres
  en écrivent.
- **Lien avec rouages.net** : chaque quête renvoie au module qui explique le
  concept (DNS, TLS, hôtes virtuels…), et inversement.
- **Pour les enseignant·es** : fiches par quête (objectifs, prérequis, durée),
  progression exportable sans compte.

---

## Organisation

- Un **agent dédié** sur le dépôt, avec un CLAUDE.md qui reprend les règles de
  rouages.net : français, accessibilité, statique, tests avant de pousser, PR
  automatique, écarts avec le vrai Linux documentés, aucune donnée
  personnelle.
- Ordre conseillé : phase 0, puis 1 (moteur multi-hôtes), puis 2 et 3 (le
  cœur du métier), puis 7 (sauvegardes), avant les conteneurs et le
  déploiement.
