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
- [ ] **Temps simulé** : horloge accélérée, tâches planifiées (cron,
      timers), journaux qui défilent, attaques qui arrivent « pendant » la quête
- [x] **Utilisateur·rices et groupes** : vrais droits de groupe, comptes par
      machine (`/etc/passwd`, `/etc/group`), `id`, `groups`, `usermod -aG`,
      `chgrp`, `chown` ; quête « Deuxième jour » (Datacenter, chapitre 2)
- [ ] `sudoers`, `umask`, bit setgid des dossiers partagés
- [x] **Éditeur de fichiers** façon `nano` (`^O`, `^X`, boutons sur
      mobile), droits vérifiés à l'enregistrement, objectifs des quêtes mis
      à jour ; solution alternative au chapitre 1 du Datacenter
- [ ] Vérification de syntaxe par service : `sshd -t` fait, `nginx -t` à venir
- [ ] **Manuel intégré** : pages `man` complètes générées depuis la
      définition de chaque commande, `--help`, `man -k`, `apropos`, `whatis` ;
      option inconnue → vrai message d'erreur (repris du travail fait dans
      rouages.net)
- [ ] **Vérificateur d'objectifs** : prédicats sur l'état (« le port 22
      n'accepte plus les mots de passe », « le site répond en HTTPS »…)

## Phase 2 — Se connecter et se déplacer

- [ ] **SSH** : `ssh`, clés (`ssh-keygen`, `ssh-copy-id`), `~/.ssh/config`,
      empreinte de l'hôte (`known_hosts`), refus de mot de passe. Déjà là :
      `ssh` avec `~/.ssh/config`, `/etc/hosts`, `known_hosts` (question de la
      première connexion), clés et leurs permissions, `-i`, `-p`, `exit`
- [ ] **Rebonds** : hôte bastion, `ssh -J` / `ProxyJump`, redirection de ports
      (`-L`, `-R`) pour atteindre un service interne
- [x] **Durcissement SSH** : `PermitRootLogin no`, `PasswordAuthentication
      no`, `AllowUsers`, `sshd -t`, `sshd -T`, `Include` de Debian ; quête
      « Fermer la porte » (Les Lettres du quartier), où l'on peut s'enfermer
      dehors (le menu sert de console de secours)
- [ ] Changer le port SSH (et le pare-feu qui va avec, phase 3)
- [ ] **Transferts** : **`scp`**, `sftp`, `rsync` (options `-a`, `--delete`,
      `--dry-run`), et pourquoi FTP en clair est à proscrire ; **FTPS** pour
      les hébergeurs mutualisés qui l'imposent (le cas de rouages.net !)
- [ ] `tmux` ou `screen` : garder une session vivante quand la connexion
      tombe

## Phase 3 — Sécuriser le serveur

- [ ] **Pare-feu** : `ufw` (défaut « tout refuser en entrée », ouvrir 22,
      80, 443, limiter SSH), puis un aperçu de `nftables` en dessous
- [ ] **fail2ban** : lire `auth.log`, voir les tentatives de force brute,
      configurer une prison, débannir une adresse légitime
- [ ] **Mises à jour** : `apt update/upgrade`, mises à jour automatiques de
      sécurité, redémarrage nécessaire, noyau
- [ ] **Comptes** : supprimer un compte inutile, désactiver un compte d'ancien
      collègue, mots de passe et clés à révoquer
- [ ] **Surface d'attaque** : `ss -tlnp`, services qui écoutent sur
      `0.0.0.0` au lieu de `127.0.0.1`, base de données exposée
- [ ] **Certificats TLS** : Let's Encrypt (`certbot`), renouvellement
      automatique, quête « le certificat a expiré cette nuit »
- [ ] **Secrets** : fichier `.env` publié par erreur, rotation d'une clé

## Phase 4 — Servir des sites

- [ ] **Serveur web** : **Nginx** (et Apache pour comparer), **hôtes virtuels** (plusieurs
      sites sur une même machine, comme dans le module « De l'Entrée à la
      page » de rouages.net), `nginx -t` avant de recharger
- [ ] **Reverse proxy** devant une application, en-têtes, HTTP → HTTPS
- [ ] **DNS** : enregistrements A, AAAA, CNAME, MX, TXT, TTL, propagation ;
      quête « le site ne marche que chez moi »
- [ ] **Journaux d'accès** : trouver qui fait tomber le site (`awk`, `sort`,
      `uniq -c`), limiter le débit

## Phase 5 — Conteneurs

- [ ] **Docker** : image, conteneur, `docker run/ps/logs/exec`, ports, volumes
      (et ce qu'on perd sans volume)
- [ ] **Docker Compose** : plusieurs services (web, base, cache), réseau
      interne, variables d'environnement, redémarrage
- [ ] Mettre à jour une image sans perdre les données ; nettoyer le disque
      (`docker system df`, `prune`)
- [ ] Sécurité : ne pas exposer la base, ne pas tourner en root, `ufw` et
      Docker (les règles contournées : un piège classique)

## Phase 6 — Déployer

- [ ] **Déploiement par git** : dépôt nu sur le serveur, crochet
      `post-receive`, ou `git pull` dans un dossier de publication
- [ ] **Intégration continue** (simulée) : tests qui bloquent un déploiement
- [ ] **Bleu/vert** : deux versions côte à côte, bascule du proxy, retour
      arrière instantané
- [ ] **Canari** et vérifications de santé (`/health`)
- [ ] **Migrations de base de données** qui empêchent le retour arrière
- [ ] **Retour arrière** (`rollback`) après un déploiement raté

## Phase 7 — Sauvegarder et restaurer

- [ ] **La règle 3-2-1**, et pourquoi une copie sur le même disque n'est pas
      une sauvegarde
- [ ] **rsync** et **rsnapshot** (instantanés par liens physiques, rotation
      horaire, quotidienne, hebdomadaire)
- [ ] **restic** (chiffrement, déduplication, `snapshots`, `restore`,
      `forget --prune`, `check`)
- [ ] Sauvegarder une base (`mysqldump`, `pg_dump`) plutôt que ses fichiers
- [ ] **Restauration de service** : quête « le serveur a brûlé » (repartir
      d'une machine vide avec les sauvegardes et la documentation)
- [ ] **Exercice de restauration** : une sauvegarde jamais testée n'en est
      pas une ; rançongiciel et sauvegardes hors ligne

## Phase 8 — Surveiller et réagir

- [ ] Charge et ressources : `top`/`htop`, `free`, `df`, `du`, `iostat`
- [ ] Pannes classiques : disque plein, mémoire épuisée (OOM), processus
      zombie, fuite de journaux, horloge décalée (NTP), inodes épuisés
- [ ] Rotation des journaux (`logrotate`)
- [ ] Supervision et alertes (sonde HTTP, seuils) ; astreinte simulée
- [ ] **Post-mortem sans reproche** : rédiger ce qui s'est passé

## Phase 9 — Le réseau d'entreprise

- [ ] Commutateurs et **VLAN** : séparer postes, serveurs, invité·es et
      téléphonie ; ports d'accès et ports « trunk » (802.1Q)
- [ ] Boucles réseau et tempêtes de diffusion, et le protocole qui les évite
      (Spanning Tree)
- [ ] DHCP, NAT, routage entre VLAN, pare-feu entre zones (DMZ)
- [ ] VPN (WireGuard) pour le télétravail et entre sites
- [ ] Wi-Fi d'entreprise (réseau invité isolé)
- [ ] Annuaire et authentification centralisée (aperçu)

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
