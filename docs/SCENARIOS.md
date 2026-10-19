# Scénarios — Quêtes de Sysadmin

*Apprendre la ligne de commande Linux en jouant.* Publié sur
https://sysadmin.rouages.net et intégrable dans d'autres sites
(voir [INTEGRER.md](INTEGRER.md)). Le moteur est dans `src/moteur/` :

- `shell.ts` : le moteur d'une machine (chemins, permissions, tubes `|`,
  redirections `>` et `>>`, `sudo`, événements) ;
- `console.ts`, `machines.ts`, `poste.ts` : le réseau simulé (le poste de
  départ, une machine par histoire, `ssh` et `exit` pour passer de l'une à
  l'autre) ;
- `commandes/` : les commandes, par famille (`fichiers`, `texte`, `systeme`,
  `reseau`, `git`) ; chacune lit ses arguments et l'entrée du tube, renvoie
  sa sortie et signale ses erreurs à part (elles ne passent pas dans les
  tubes, comme la sortie d'erreur d'un vrai shell) ;
- `monde.ts` : les briques d'un monde (lieux, objets, droits, événements) ;
- `chapitres/` : un fichier par chapitre, et `index.ts` qui les range en
  histoires ;
- `commandes/manuel.ts` et `commandes/pages.ts` : le manuel (`man`, `--help`,
  `man -k`).

L'interface est dans `src/interface/` (`jeu.ts`, `styles.css`), l'élément
`<quetes-de-sysadmin>` dans `src/element.ts`. Tous les textes (histoires,
messages, manuel, interface) sont dans `src/textes/fr/*.ftl` (voir
`docs/TRADUIRE.md`). Les parties sont rejouées par `tests/quetes.test.ts`.

## Principes

- **Inspiré de l'original, sans le recopier** : l'idée (un lieu = un dossier,
  un objet = un fichier, des commandes apprises en avançant) vient de
  [Terminus](https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html),
  créé au MIT par Shawn Conrad et Michele Pratusevich. Les chapitres 1 et 2
  ont leurs propres lieux et leurs propres énigmes (l'île du Phare, le Bourg
  du port) ; ils ne suivent pas le parcours de l'original. Le jeu est né
  sous le nom « Terminus en français » sur Les rouages du net (rouages.net)
  avant de devenir ce projet indépendant, en octobre 2026.
- **Nos propres textes** : l'histoire, les lieux et les dialogues sont
  originaux, ce n'est pas une traduction.
- **De vraies commandes, de vrais comportements** : mêmes chemins (`..`, `~`,
  `/`), mêmes règles (`mv` renomme, `cp` copie, `rm` est définitif, les
  jokers `*` sont développés avant la commande, comme le fait le shell). Les
  écarts volontaires sont signalés dans le code et listés ci-dessous.
- **Un seul monde, relié par `ssh`** : on part de son **poste**
  (`vous@poste`) ; chaque histoire tourne sur une machine du réseau
  (`royaume`, `datacenter`, `fourmiliere`, `manuscrit`, `bibliotheque`), que
  l'on rejoint avec `ssh` et que l'on quitte avec `exit`. Le poste n'a au
  départ que la clé du royaume : finir l'Effaceur donne les clés des quatre
  autres machines, qui se jouent ensuite dans l'ordre que l'on veut. Le menu
  reste un raccourci (accessibilité, enseignant·es) ; l'attribut `histoire`
  ouvre directement une histoire, même sans sa clé.
- **Histoires et chapitres** : cinq histoires ; dans une
  histoire, chaque chapitre a son monde, ses commandes et sa fin, et s'ouvre
  quand le précédent est terminé. La progression est gardée dans le
  navigateur (`localStorage`, clé `quetes-de-sysadmin`, réglable par l’attribut `cle`), chapitre par chapitre.
- **Des exemples sans danger** : adresses IP privées (RFC 1918), de
  collecte d'opérateur (RFC 6598) ou réservées à la documentation (RFC 5737),
  noms de domaine en `.example` (RFC 6761). Seule exception : 9.9.9.9, le
  vrai résolveur DNS public de Quad9.
- **Sorties authentiques** : `ping`, `dig`, `traceroute`, `curl`, `ps`,
  `systemctl` répondent en anglais, comme sur un vrai système ; `git` et
  les messages d'erreur de base (« Permission non accordée ») en français,
  comme avec un système réglé en français.

### Le manuel, premier réflexe

Pour apprendre à se dépanner seul·e, le manuel est disponible partout, dès le
chapitre 1, et pour toutes les commandes du jeu (même celles qu'on n'a pas
encore le droit de lancer, comme sur un vrai système) :

- `man commande` : une page au format habituel (NOM, SYNOPSIS, DESCRIPTION,
  OPTIONS, EXEMPLES, VOIR AUSSI), fabriquée par `commandes/manuel.ts` à
  partir de la définition de la commande et de ses compléments
  (`commandes/pages.ts` : options, exemples, renvois) ;
- `commande --help` : un résumé ;
- `man -k mot` et `apropos mot` : chercher une commande par mot-clé ;
  `whatis commande` : une ligne ;
- une option inconnue donne le vrai message des coreutils : « ls : option
  invalide -- 'z' / Saisissez « ls --help » pour plus d'informations. »

Dans le chapitre 1, le cours sur les fichiers cachés ne donne plus l'option :
il renvoie à `man ls`, et la gardienne du phare renvoie aux EXEMPLES de
`man mv`. Au chapitre 2, le parchemin présente `--help` et `man -k`.

### Écarts volontaires avec un vrai Linux

| Commande | Dans le jeu | Sous Linux |
|---|---|---|
| `less` | affiche tout, comme `cat` | affiche page par page (`q` pour quitter) |
| `mv` | ne déplace que des objets (fichiers) | déplace aussi les dossiers |
| `rm -r`, `cp -r` | refusés | effacent / copient des dossiers entiers |
| `grep` sans résultat | « (aucune ligne ne contient …) » | n'affiche rien |
| `grep` | expressions régulières basiques (par défaut), étendues (`-E`) ou texte brut (`-F`), traduites en expressions JavaScript ; pas de classes `[[:alpha:]]` ni de références arrière `\1` | POSIX complet |
| `man` | affiche la page d'un coup, en quelques sections | ouvre une page plein écran (flèches, `/mot` pour chercher, `q` pour quitter), bien plus longue |
| `ls -l` | type et droits, propriétaire, groupe (= propriétaire), taille, nom | ajoute le nombre de liens et la date |
| permissions | propriétaire, groupe, autres ; bits spéciaux affichés (`s`, `t`) ; le setgid d'un dossier passe son groupe (et le setgid) à ce qu'on y crée ; `chmod` à 4 chiffres ; pas de setuid ni de sticky appliqués, ni d'ACL ; un fichier déplacé dans un dossier setgid sans groupe à lui en prend aussi le groupe | setuid, sticky appliqués, ACL (`setfacl`), `mv` garde le groupe |
| `usermod -G` | prend effet tout de suite | les groupes d'une session sont lus à la connexion : il faut se reconnecter (le jeu le dit dans le texte) |
| `chown`, `chgrp` | `-R` seulement | aussi `--reference`, `-h`… |
| `chmod -w` (sans u/g/o) | agit sur tout le monde | tient compte du masque `umask` |
| `umask` | commande avec sa page `man` ; vaut pour la session ; le masque des autres comptes se lit dans `/etc/profile`, `/etc/profile.d/*.sh`, `~/.bashrc`, `~/.profile` (la dernière ligne `umask` l'emporte) | commande intégrée à bash (`help umask`) ; `pam_umask`, `login.defs` |
| comptes (`usermod`, `userdel`, `gpasswd`, `chage`) | `usermod -L/-U/-e/-s/-G` ; `userdel [-r] [-f]` (refus si un processus du compte tourne) ; `gpasswd -a/-d` ; `chage -l/-E` (dates au format AAAA-MM-JJ) ; pas de `/etc/shadow` lisible ; messages de la traduction française de shadow-utils | toutes les options, `passwd`, `deluser`, `/etc/shadow` |
| `sudo`, `sudoers`, `visudo` | `/etc/sudoers` et `@includedir` (fichiers sans point ni `~`), règles `qui machines=(compte) [NOPASSWD:] commandes`, `Cmnd_Alias`, jokers ; `sudo -l [-U compte]` ; `visudo [-c] [-f fichier]` vérifie à la fermeture de l'éditeur et demande « Et maintenant ? » ; une erreur dans la politique bloque sudo ; seul « vous » lance des commandes avec sudo (les autres comptes : `sudo -l -U`) ; pas d'alias d'utilisateurs ni de machines, pas de `!` | toute la grammaire de sudoers, plugins, `sudoedit` |
| `who`, `pkill`, `which` | sessions décrites par le chapitre (une session vit tant que son `sshd` tourne) ; `pkill [-u compte] [motif]` ; `which` déduit le chemin (`/usr/bin`, ou `/usr/sbin` pour la section 8) | `w`, `loginctl`, toutes les options de procps ; `which` lit le PATH |
| `rm` d'un fichier protégé en écriture | efface sans demander | demande confirmation |
| `sudo` | redemande le mot de passe seulement au premier usage du chapitre | s'en souvient environ 15 minutes |
| `cat` d'une archive | message d'erreur | affiche des octets illisibles |
| `ping` | 4 envois par défaut | continue jusqu'à Ctrl+C |
| `traceroute` | s'arrête 3 sauts après le dernier qui répond | continue jusqu'à 30 sauts |
| `ps aux` | utilisateur, PID, %CPU, %MEM, commande | ajoute VSZ, RSS, TTY, STAT, START, TIME |
| `tar` | taille calculée (texte compressé au tiers, médias à 98 %) ; s'il n'y a pas la place, rien n'est écrit | vraie compression ; une archive partielle peut rester |
| `git` | une seule branche (`main`), fichiers à la racine du dépôt seulement, identifiants calculés par le jeu, `commit` exige `-m` ; distants par chemin seulement (dépôts nus de la machine) ; `push` et `pull` en avance rapide seulement (pas de fusion) ; crochets `pre-receive` et `post-receive` ; chiffres de `push` indicatifs | branches, sous-dossiers, SHA-1/SHA-256, éditeur de texte, distants par SSH ou HTTPS, fusions, tous les crochets |
| scripts (`sh`, crochets) | `/bin/sh` réduit (`script.ts`) : une commande par ligne, `#`, `set -e`, `exit`, variables, `$(…)`, `read`, `&&`, `\|\|`, `[ … ]` ; pas de `if`, `for`, `while`, `case` ni de fonctions ; une commande réussit si elle n'a écrit aucune erreur | le langage complet |
| `diff` | format normal, `-u` (trois lignes de contexte), `-r`, `-q` ; l'heure de l'en-tête `-u` est l'heure de la machine | toutes les options |
| `date`, `test`, `readlink` | `date` sans option ou `+FORMAT` (directives courantes) ; `test` (et `[ … ]` dans un script) : `-e -f -d -L -s -r -w -x -n -z`, `=`, `!=`, comparaisons numériques ; `readlink [-f]` | `date -d`, `-u`… ; `test` complet ; `realpath` |
| Le Kiosque (La Gazette) | une appli Node.js simulée : version lue au démarrage via un lien, `/health` en JSON, configuration dans un fichier `.env`, migration de schéma au démarrage (jamais en arrière) ; une heure de visites simulée à chaque rechargement de nginx dans « Le canari » | une vraie appli et sa base PostgreSQL |
| journal nginx | format « combined » sans la page d'origine ni le navigateur | deux champs de plus en fin de ligne |
| `ssh` | deux modèles : sur la plupart des machines, une clé est acceptée si c'est celle que le jeu a donnée pour cette machine ; sur `maison` et son réseau interne (`acces.ts`), le vrai fonctionnement : `authorized_keys` d'en face, phrase de passe, mot de passe si sshd l'accepte (trois essais), `-J`/`ProxyJump` (le nom suivant est résolu par la machine du saut), `-L` avec `-f -N` (un processus à arrêter avec `kill`), commande à distance, `-G` (extrait) ; pas d'agent, de `-R`, de `-D` ni de certificats ; une seule clé d'hôte (ed25519) ; message d'usage raccourci | tout cela, agent, `ForwardAgent`, redirections distantes et dynamiques |
| `exit` | a sa page `man` | commande intégrée à bash : `help exit` |
| session `ssh` | la machine garde son état tant que la page reste ouverte ; un rechargement relance le chapitre en cours | la machine garde son état |
| sections du manuel | 1 (commandes), 5 (fichiers de configuration : `sshd_config`, `ssh_config`, `sudoers`) et 8 (administration : `usermod`, `reboot`) | aussi 2, 3, 4, 6 et 7 (appels système, bibliothèques…) |
| systemd | services seuls (pas de cibles, de dépendances, de timers ni de fichiers d'unité modifiables) ; l'horloge avance d'une seconde par action ; `journalctl -f` non simulé | unités de tous types, `daemon-reload`, `journalctl -f` |
| `systemctl` sans être root | « Access denied », il faut `sudo` | demande le mot de passe (polkit) |
| `sudo` après `reboot` | se souvient encore du mot de passe | le redemande |
| `sshd` | une partie des mots-clés ; toutes les erreurs listées d'un coup ; le mot de passe n'est demandé que sur les machines au vrai ssh (`maison`) ; pas de `StrictModes` (droits de `~/.ssh` non vérifiés) ni d'options dans `authorized_keys` | s'arrête à la première erreur ; propose le mot de passe partout ; refuse un `authorized_keys` modifiable par d'autres |
| `ufw` | règles IPv4 et IPv6 confondues (lignes « (v6) » pour la forme) ; pas de règles sortantes, de routage, de journalisation, d'`insert` ni de `reset` ; messages proches de la traduction française d'ufw | tout cela |
| `ss` | sockets décrites par le chapitre, et la session ssh en cours | toutes les sockets du système |
| fail2ban | une seule prison (`sshd`) ; `findtime` non appliqué (tous les échecs du journal comptent) ; filtre réduit à « Failed password », « Invalid user », « Failed publickey » ; le poste banni garde sa session ouverte | plusieurs prisons ; fenêtre `findtime` ; filtres complets ; le bannissement coupe aussi la session en cours |
| `rsync` | `-a`, `-v`, `-n`, `--delete` ; local, ou à distance par ssh (`machine:chemin`, dans un sens ou dans l'autre, avec les mêmes clés et rebonds que `ssh`) ; un fichier change si son contenu change ; chiffres de « sent/received » indicatifs | compare taille et date, toutes les options, démon rsync |
| `scp`, `ssh-copy-id` | `scp` : `-r`, `-P`, `-J`, `-i`, une copie dans un sens ou dans l'autre (pas entre deux machines distantes), ligne de progression immédiate ; `ssh-copy-id` : `-i`, `-p`, `-J`, la clé `~/.ssh/id*.pub` la plus récente par défaut | `scp` entre deux machines distantes (`-3`), SFTP ; `ssh-copy-id -f`, `-n` |
| machines internes | derrière `maison`, `wiki` et `archives` existent dès qu'on s'y connecte ; on y entre par ssh depuis `maison`, ou avec `-J` depuis le poste (`exit` ramène alors au poste) ; un programme absent répond `command not found` | un vrai réseau, routé |
| `crontab`, cron | l'éditeur est toujours `nano` ; pas de variables d'environnement ni de `%` ; le jeu « fait passer la nuit » quand la crontab change | cron tourne en continu ; `select-editor` au premier `crontab -e` |
| `apt` | `update`, `install [-y]`, `list --installed`, `list --upgradable`, `upgrade` et `full-upgrade` (les mises à jour décrites par le chapitre) ; un petit catalogue, versions et tailles indicatives ; un paquet qui échoue à démarrer n'est pas laissé « à moitié configuré » ; une mise à jour coupée laisse ses paquets dépaquetés (`dpkg --configure -a`) ; `/var/run/reboot-required` pour un noyau ou la libc | tout le catalogue Debian, `remove`, `search`, `show`, `apt-get`… ; dpkg garde l'état de chaque paquet |
| réseau local (`ip`, `ifup`, `ifdown`) | IPv4 seulement ; `ip addr`, `ip link`, `ip route` (show, add, del, set, `-br`, `-d`), interfaces VLAN 802.1Q ; `/etc/network/interfaces` lu comme ifupdown (`auto`, `iface … inet static`, `manual`, `loopback`, `address`, `netmask`, `gateway`, `vlan-raw-device`, `source`) ; le commutateur et ses ports sont décrits par le chapitre ; pas d'ARP visible, de MTU, de bonding ni de systemd-networkd | tout iproute2, ifupdown2, NetworkManager, systemd-networkd |
| `dnsmasq` | DHCP seulement (les options DNS sont acceptées et ignorées) ; `interface` (avec `*`), `except-interface`, `dhcp-range`, `dhcp-host`, `dhcp-option` ; les appareils demandent une adresse à chaque démarrage du service ; l'adresse est tirée de l'adresse MAC ; pas de renouvellement de bail | DNS, TFTP, PXE, DHCPv6, renouvellement |
| `nft` (nftables) | IPv4 ; tables `ip`, `inet` (`ip6` lu, sans effet) ; chaînes de base `filter` et `nat` (hooks, priorités, politique), chaînes ordinaires (`jump`, `goto`) ; conditions `iifname`, `oifname`, `ip saddr`, `ip daddr`, `ip protocol`, `meta l4proto`, `tcp`/`udp` `dport`/`sport` (services connus du jeu), `ct state`, négation `!=`, ensembles anonymes ; actions `counter`, `log`, `accept`, `drop`, `reject`, `masquerade`, `snat` (au `postrouting`), `dnat` (au `prerouting`, vers une adresse et un port) ; `define`, `include` ; `-f`, `-c`, `-a` ; `add`, `insert`, `delete`, `flush`, `list` ; le trafic est celui des appareils décrits par le chapitre (et de visiteurs d'internet), et les compteurs comptent un passage de chaque échange ; messages d'erreur proches de nft ; la chaîne `input` ne coupe pas la session ssh du jeu | ensembles nommés, maps, `limit`, `quota`, IPv6, `bridge`, `netdev`, `nft monitor`, les règles sur le contenu des paquets |
| `sysctl`, `conntrack` | `sysctl` : lire, `-w`, `clé=valeur`, `-p`, `--system`, `-a`, `-n` sur quelques clés (`/proc/sys` est un vrai dossier du jeu) ; `/etc/sysctl.d/*.conf` puis `/etc/sysctl.conf` au démarrage ; `conntrack -L` (`-p`, `-s`, `-d`), `-C`, `-F` : les échanges du moment, dont la session ssh | toutes les clés du noyau ; `conntrack -E`, `-D`, états UDP et ICMP détaillés |
| `wg`, `wg-quick` (WireGuard) | `genkey`, `genpsk`, `pubkey`, `show`, `showconf` ; `wg-quick up`, `down`, `strip` ; le service `wg-quick@wg0` ; la clé publique n'est pas calculée par Curve25519 (une empreinte qui en tient lieu, au bon format) ; les pairs sont décrits par le chapitre (le portable de Malik) ; pas de `wg set`, `PostUp`, `PresharedKey` vérifiée, IPv6, ni de tout le trafic par le tunnel côté routeur ; `wg-quick` sans sudo refuse au lieu de relancer sudo | Curve25519, `wg set`, `syncconf`, `PostUp`/`PostDown`, IPv6, `wg-quick save` |
| `ping` sur un réseau local | un appareil répond s'il est dans le VLAN de l'interface dont le réseau contient son adresse ; une adresse privée envoyée à la box se perd ; un nom d'appareil est reconnu sans DNS | ARP, DNS local, `/etc/hosts` |
| `tmux`, `uname`, `dpkg` | `tmux new [-s]`, `ls`, `attach [-t]`, `detach`, `kill-session`, une fenêtre par session ; pas de raccourcis clavier (`tmux detach` pour Ctrl+b d) ; attach rejoue les dernières lignes ; le nom de la session s'affiche devant l'invite (la barre d'état) ; `uname -r/-a` ; `dpkg --configure -a` | fenêtres, volets, raccourcis, `screen` ; toutes les options de dpkg |
| `nginx` | `-t`, `-T`, `-v` ; une partie des directives ; le site est choisi par `server_name` puis `default_server` ; `location` par préfixe, `=`, `^~`, ou expression régulière (`~`, `~*`, syntaxe de JavaScript plutôt que PCRE), choisie dans l'ordre de nginx ; `proxy_set_header` (variables `$remote_addr`, `$proxy_add_x_forwarded_for`, `$http_…`, `$host`, `$scheme`), `root`, `alias`, `index`, `return`, `proxy_pass` vers une appli simulée ou un `upstream` (`weight`, `backup`, `down`, tourniquet pondéré, serveur suivant s'il ne répond pas ; pas de `max_fails`/`fail_timeout` appliqués) ; `try_files` lu mais pas appliqué | toutes les directives et modules |
| `curl` sur la machine du site | ne joint que la machine elle-même (localhost, son nom, son adresse), ou un tunnel `ssh -L` ouvert sur le poste | tout le réseau |
| `tar` | `-C` ; une archive coupée s'arrête à la coupure (messages proches de GNU tar) ; root garde propriétaires et droits | aussi `--strip-components`, `-p`, archives multi-volumes… |
| `ssh-keygen` | `-R`, `-F`, `-l -f` ; crée des clés ed25519 seulement (`-t`, `-C`, `-N`, `-f`), fausses mais de la bonne forme, avec leur image aléatoire | tous les types de clés, conversion, certificats… |
| `certbot` | un seul certificat, celui du chapitre ; `certificates`, `renew`, `certonly`, `reconfigure` ; autorité simulée (le défi HTTP-01 passe par le nginx simulé) ; les fichiers de `live/` sont réécrits (pas de liens vers `archive/`) ; le module nginx ne modifie pas la configuration | plusieurs certificats, vraie autorité ACME, liens symboliques, défis DNS |
| `openssl` | `x509` (`-dates`, `-subject`, `-issuer`, `-ext`, `-checkend`) et `s_client -connect` (rend la main tout de suite) ; le contenu des PEM est propre au jeu | des centaines de sous-commandes ; vrai X.509 ; `s_client` attend une entrée |
| `curl https://` | vérifie dates et noms du certificat présenté (erreur 60), `-k` pour passer outre | vérifie aussi la chaîne de confiance complète, OCSP… |
| horloge | heure de Paris : CET l'hiver, CEST l'été | fuseau de la machine |
| `restic` | `-r` et `--password-file` obligatoires (pas de variables d'environnement) ; `snapshots`, `ls`, `find`, `diff`, `dump`, `restore`, `backup`, `forget`, `prune`, `check`, `stats` ; pas d'`init` ; un « pack » par sauvegarde ; fichiers du dépôt illisibles mais pas binaires ; pas de barres de progression | tout cela, et `mount`, `copy`, `key`, `tag`, dépôts distants (sftp, S3, rest-server) |
| liens symboliques | `ln -s` (`-f`, `-n`), suivis pour lire, écrire et entrer ; `ls -l` les montre ; `readlink` | aussi `realpath`, `find -L`… |
| `curl` | `-I`, `-i`, `-k`, `-L`, `-H` (Host, ou un en-tête transmis), `-X`, `-d` (seulement la méthode) ; ne joint que la machine où l'on est (nginx, une appli sur son port, un conteneur) | toutes les options, tout le réseau |
| DNS (BIND) | zones A, AAAA, CNAME, MX, NS, TXT, SOA ; un primaire (`named`), un secondaire qui recopie quand le serial augmente (tout de suite), un résolveur public avec cache ; `dig` (`@serveur`, type, `+short`, `+noall +answer`), `host`, `named-checkzone`, `named-checkconf` (accolades et fichiers), `rndc reload`/`status` ; pas de section AUTHORITY, de DNSSEC ni de zones inverses | tout cela |
| `awk` | programme entre apostrophes : motifs, `BEGIN`/`END`, champs, tableaux, `printf`, fonctions courantes, `-F`, `-v` ; pas de `getline`, de redirection dans `print`, de fonctions définies ni de `?:` | le langage complet (mawk sur Debian) |
| trafic web | dans « Le soir du concert », une minute de trafic simulée après chaque rechargement de nginx ; `limit_req` suit l'algorithme de nginx (seau qui fuit, rafale, `nodelay`) ; pas de `delay=`, ni de `limit_conn` | trafic réel, en continu |
| Docker | images d'un registre simulé, conteneurs (couche, volumes, dossiers montés, ports, `--restart`), `run`, `ps`, `images`, `pull`, `logs` (`-n`, `-t`), `exec` (`-u` ; `ls`, `cat`, `env`, `id`, `whoami`), `cp`, `stop`, `start`, `restart`, `rm`, `port`, `update --restart`, `inspect` (`-f '{{.Champ}}'`), `volume` ; sans `-d`, `run` rend la main ; pas de réseau entre conteneurs hors Compose, pas de `build` | tout Docker |
| Docker Compose | `compose.yaml` en YAML réduit (correspondances, listes, chaînes, `[a, b]`) ; clés `image`, `ports`, `volumes`, `environment`, `env_file`, `depends_on`, `restart`, `user`, `read_only`, `cap_drop`, `security_opt` ; `up` (recrée ce qui a changé), `down` (`-v`), `ps`, `logs`, `config`, `restart`, `stop`, `start`, `exec`, `pull` ; un service qui échoue au démarrage est relancé une fois s'il a une politique `restart` | toute la spécification Compose, `build`, `healthcheck`, profils |
| Docker et le pare-feu | un port publié sur 0.0.0.0 répond de l'extérieur quelles que soient les règles ufw (comme les règles iptables de Docker) ; `nc -zv` depuis une autre machine ; `system df`, `image prune` (`-a`), `container prune`, `volume prune` (`-a`), `system prune` (`-a`, `--volumes`), `rmi` | chaîne DOCKER-USER, ufw-docker, `iptables -L` |
| Utilisateur d'un conteneur | `--user`/`-u` et `user:` (nom de l'image ou `uid[:gid]`, un uid inconnu de l'image prend le gid 0), `docker exec -u` ; l'uid du conteneur est celui de la machine (pas de userns-remap) : droits Unix appliqués par numéro sur les dossiers montés, fichiers créés au nom de cet uid, processus visibles dans `ps aux` ; `--read-only` empêche d'écrire hors des volumes ; `--cap-drop` et `--security-opt` sont gardés (et montrés par `inspect`) sans autre effet ; un conteneur tombé est relancé à chaque commande (pas d'attente qui double) | userns-remap, mode rootless, capacités réelles, seccomp, AppArmor, droits sur les volumes nommés |
| `nc` | `-z`, `-v`, une plage de ports ; sans `-z`, rend la main | netcat complet (écouter, envoyer, proxy) |
| disques (`lsblk`, `mount`, `umount`) | périphériques décrits par le chapitre ; `mount` sans argument, `-o ro` ; un support en lecture seule refuse toute création (le contenu d'un fichier existant reste modifiable par une redirection) ; pas de `/etc/fstab` | toutes les options, `fstab`, systèmes de fichiers réels |
| `rsnapshot` | `configtest`, `-t`, `-v`, `du`, la rotation des niveaux (`cp -al` puis `rsync`) ; une partie des directives ; messages proches de rsnapshot 1.4 | `backup_script`, `link_dest`, `sync_first`, sauvegardes distantes |
| PostgreSQL | rôles et authentification « peer » ; `psql -c/-f/-l` avec un SQL réduit (`SELECT count(*)`, `SELECT … WHERE col = v ORDER BY … LIMIT`, `DELETE`, `TRUNCATE`, `DROP TABLE`, `\l`, `\dt`, `\d`) ; `pg_dump` (texte, `-Fc`, `-t`, `-f`), `pg_restore` (`-l`, `-d`, `-t`, `--data-only`, `--clean`), `createdb`, `dropdb` ; une archive `-Fc` ne contient qu'une référence gardée par le jeu ; une seule clé primaire par table | tout PostgreSQL, psql interactif, WAL et restauration à un instant donné |
| `lsof`, `truncate`, `logrotate` | `lsof` ne connaît que les fichiers ouverts décrits par le chapitre (`+L1`, `-p`, `-u`, un fichier) ; `logrotate` : une partie des directives, `-d`, `-f`, `-v`, sorties abrégées | toutes les options, tous les fichiers ouverts du système |
| mémoire (`free`, `top`, `dmesg`) | la mémoire de chaque processus est décrite par le chapitre ; pas de swap, le cache ne se libère pas (`available` = `free`) ; l'OOM killer tue le plus gros processus (sans `oom_score_adj`) ; `top` affiche un instantané et rend la main (`-b`, `-n`, `-o`, `-c`) ; `dmesg` (`-T`) réservé à root | swap, récupération du cache, score de l'OOM killer, `top` interactif, `htop` |
| surcharges systemd | `systemctl edit`, `set-property` (seulement `MemoryMax=`), `daemon-reload` ; dans les surcharges, seuls `MemoryMax=` et `Restart=` de `[Service]` comptent ; un service relancé par `Restart=` repart aussitôt | toutes les directives, `RestartSec=`, `StartLimitBurst=`, `systemctl cat`, `revert` |
| inodes | `df -i`, `du --inodes` : un inode par fichier ou lieu ; un support peut déclarer son nombre d'inodes (et ceux pris par le système) ; plus d'inode libre, plus de création | blocs réservés, `tune2fs`, inodes des liens symboliques et des fichiers spéciaux |
| `find` | `-name`, `-type`, `-mtime`, `-maxdepth`, `-delete`, `-print` ; l'âge se compte sur l'horloge de la machine simulée | `-exec`, `-newer`, `-size`, `-user`, les opérateurs (`-o`, `!`) |
| « Liste d'arguments trop longue » | un programme (pas `cd`, `echo`, `pwd`, `test`, `printf`) refuse plus de 2 Mio d'arguments (ARG_MAX) | la limite compte aussi l'environnement ; `xargs` |
| sorties géantes | l'écran ne garde que les 2 000 dernières lignes d'une sortie (avec une mention) | l'historique du terminal |
| heure | chaque machine a un fuseau et un décalage d'horloge (`etat.heure`) ; `date` (`-s`), `timedatectl` (`status`, `show`, `list-timezones`, `set-timezone`, `set-ntp`, `set-time`, `timesync-status`) ; timesyncd essaie ses serveurs (`NTP=`, sinon `FallbackNTP=`) et se synchronise d'un coup à son démarrage ; le journal suit l'heure de la machine ; les fuseaux viennent d'`Intl` | ajustement progressif de l'horloge, RTC séparée, `hwclock`, chrony |
| supervision | `check_disk` (`-w`, `-c`, `-W`, `-K`, `-p`), `check_http` (`-H`, `-I`, `-p`, `-u`, machine locale seulement), `check_procs` (`-C`, `-w`, `-c`) ; codes de retour 0 à 3 ; pas de page `man` réelle (les plugins répondent à `--help`) | tous les plugins et leurs options, `check_curl` |
| `mail`, `last` | `mail` : `-s`, `-E`, livraison locale dans `/var/mail` après `/etc/aliases`, liste de la boîte sans mode interactif ; `last` : connexions décrites par le chapitre, `-n` | le courrier qui quitte la machine (MTA), `mail` interactif, `lastb`, `who` |
| timers systemd | unités écrites à la main dans `/etc/systemd/system` (`.service` : `Type=`, `ExecStart=`, `User=` ; `.timer` : `OnCalendar=` avec jour de la semaine, `*-*-*` et `H:M[:S]`, `OnBootSec=`, `OnActiveSec=`, `OnUnitActiveSec=`, `Unit=`), à la minute près ; `list-timers`, `systemd-analyze calendar` ; cron envoie par courrier ce qu'écrit une tâche | `Persistent=`, `RandomizedDelaySec=`, `AccuracySec=`, dépendances entre unités |
| codes de retour | une commande rend 1 si elle a écrit une erreur, sauf si elle donne le sien (plugins, `grep`) ; dans un tube, celui de la dernière commande | tous les codes des vrais outils |
| zombies | `ps -ef` montre le parent ; aucun signal n'agit sur un zombie ; ils disparaissent quand leur parent s'arrête | `wait()`, `SIGCHLD`, adoption par un sous-reaper |
| `sudo -u`, `crontab -u`, `usermod -L` | `sudo -u compte` sans autre option ; `crontab -u` réservé à root ; `usermod -L/-U` marque le compte sans montrer `/etc/shadow` | toutes les options |
| s'enfermer dehors | le menu du jeu rouvre la session | console de secours (VNC, KVM) de l'hébergeur |
| `nano` | une zone de texte : `^O` écrire, `^X` quitter (avec `O`/`N`/`^C`), boutons pour les claviers sans Ctrl ; pas de recherche, de couper-coller ni de numéros de ligne ; le texte passe à la ligne ; messages proches de la traduction française de nano | tous les raccourcis de la barre d'aide, pas de retour à la ligne automatique |

## Histoire 1 : l'Effaceur

Une créature, l'Effaceur, parcourt le royaume et efface tout ce qu'elle
touche. On découvrira qu'elle n'est pas méchante : c'est un programme qui
obéit à un ordre ancien, écrit par erreur dans sa configuration, à la
Racine (`/`).
Morale technique : un programme fait ce qu'on lui a dit, pas ce qu'on voulait.

```mermaid
flowchart LR
  C1["Chapitre 1 · L'Île du Phare<br/>ls, cd, pwd, cat, less, ls -a, mv"] --> C2["Chapitre 2 · Le Bourg<br/>grep, touch, cp, mkdir, rm"]
  C2 --> C3["Chapitre 3 · La Racine<br/>ls -l, chmod, whoami, sudo"]
  C3 --> C4["Chapitre 4 · La Sauvegarde<br/>rsync, crontab"]
```

### Chapitre 1 — L'Île du Phare (fait)

L'Effaceur a effacé l'ampoule du phare : sans lumière, aucun bateau ne peut
quitter l'île pour le Bourg.

| Lieu | Énigme | Commande apprise |
|---|---|---|
| Cabane | lire le message de Maëlle, la gardienne du phare | `ls`, `cat` |
| Plage | panneau, ravaudeuse (touche Tab, flèche ↑) | `cd`, `cd ..`, `pwd` |
| Colline/EcoleDesSignaux/SalleDExercice | remettre le crabe dans le Seau | `mv objet Lieu` |
| Colline/EcoleDesSignaux/Cours | manuel, chemins, fichier caché `.note_secrete`, déplacer et renommer d'un coup | `man`, `~`, `/`, `ls -a` |
| Jetee | ranger le filet qui bloque le Phare au Hangar du Port | `mv filet ~/Port/Hangar` (chemin depuis `~`) |
| Port/Remise → Phare/Escalier/Lanterne | rapporter l'ampoule de secours cachée sous le nom exact `ampoule` | `ls -a`, `mv .ampoule_de_secours …/Lanterne/ampoule` |

### Chapitre 2 — Le Bourg (fait)

Le bateau dépose le personnage au Bourg du port.

| Lieu | Énigme | Commande apprise |
|---|---|---|
| Mairie | quelle affiche parle de l'Effaceur, puis la clé sous le `.paillasson` | `grep Effaceur *`, `ls -a` |
| Mairie/Archives | lire la chronique de l'Effaceur | `grep`, `grep -i` |
| Boulangerie | trois levains pour le boulanger | `cp` |
| Atelier | fabriquer un engrenage, puis cinq : l'horloge repart et ouvre la grille de la Ruelle | `touch`, `cp` |
| Ruelle | barricade trop lourde pour `mv` | `rm` (et pas de corbeille) |
| Ruelle/Cour/Egout | payer les rats avec le fromage du Marché, sans y retourner | `cp ~/Marche/fromage .` (chemin complet, `.`) |
| Egout/Galerie | retrouver Nour au bord du Toboggan | — |
| Ecole | reconstruire la Classe de Nour (un lieu) | `mkdir` |

### Chapitre 3 — La Racine (fait)

Pourquoi « La Racine » et pas « Le Noyau » : sous Linux, le noyau (*kernel*)
est le programme central du système ; l'arborescence des fichiers, elle,
part de la racine `/`, et l'administrateur s'appelle `root`.

Le Toboggan dépose le personnage dans sa vraie maison, `/home/vous`. Le
monde ressemble enfin à un vrai Linux : `/home`, `/etc`, `/var/log`, `/root`.

| Lieu | Énigme | Commande apprise |
|---|---|---|
| `/home/vous` | l'Effaceur efface un souvenir à chaque commande : le lieu `souvenirs` est en `rwxrwxrwx` | `ls -l`, `chmod o-w` (effacer = écrire dans le lieu) |
| `/var/log` | le journal du démon montre deux cibles au lieu d'une | `cat`, `grep cible` |
| `/etc/effaceur.conf` | « cible = /Royaume /Corbeille » : une espace en trop ; le fichier appartient à root | Permission non accordée |
| `journal.txt` | retrouver son mot de passe (noté, « très mauvaise idée ») | `grep "mot de passe"` (guillemets) |
| `/etc` | installer la version corrigée | `sudo cp ~/effaceur.conf.corrige /etc/effaceur.conf` |
| bonus | `/root`, `/etc/sudoers`, `/home/nour` (journal intime : on ne le lit pas, même root) | `sudo ls`, `sudo cat`, `whoami`, `sudo cd` (introuvable : `cd` est intégré au shell) |

Le dénouement : le personnage était l'administrateur·ice du royaume. C'est
lui ou elle qui avait écrit la configuration, avec une espace de trop.
L'Effaceur n'était pas méchant : il faisait exactement ce qu'on lui avait
écrit. Le message de `sudo` (« Réfléchissez avant de taper ») est le vrai.

### Chapitre 4 — La Sauvegarde (fait)

Maëlle veut que les souvenirs ne puissent plus disparaître : un disque de
sauvegarde est monté sur `/mnt/sauvegarde`. Le chapitre se joue sur
`royaume` ; les clés des autres machines restent données à la fin de La
Racine (chapitre 3).

| Étape | Commande apprise |
|---|---|
| Copier | `rsync -av ~/souvenirs/ /mnt/sauvegarde/souvenirs/` (la barre finale compte), `rsync -n` pour essayer |
| Automatiser | `crontab -e`, une ligne `15 3 * * * rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/` (ou `@daily`) ; `crontab -l` |
| La nuit passe | le jeu lance les tâches qui tombent entre minuit et 6 h (`src/moteur/cron.ts`) ; un souvenir arrivé dans la journée doit se retrouver dans la sauvegarde |
| Restaurer | au matin, un souvenir est effacé : `rsync -a` ou `cp` depuis la sauvegarde |

Objectif vérifié sur l'état : la nuit a mis la sauvegarde à jour (y compris
le nouveau souvenir), le souvenir effacé est revenu à l'identique, et une
tâche de nuit avec `rsync` reste planifiée.

Pièges prévus : `rsync` sans `-a` (`skipping directory`), la barre finale
oubliée (`souvenirs/souvenirs`), une crontab invalide (`bad hour`, refusée
à l'installation), une tâche qui ne tombe pas la nuit, une tâche qui échoue
(le courrier de cron montre l'erreur de rsync), `--delete` après
l'effacement (la sauvegarde perd aussi le souvenir). Autre solution
acceptée : `@daily`, copie du dossier entier, restauration avec `cp`.
Débrief : barre finale, `-n`, planifier, tester la restauration, règle
3-2-1 et versions ; liens vers `rsync(1)` et `crontab(5)`.

## Histoire 2 : Le Datacenter (faite, cinq chapitres)

Premier jour de stage : le site de la médiathèque répond par des erreurs 503.
Awa, responsable d'exploitation, est en réunion ; ses notes guident.

| Étape | Commande apprise |
|---|---|
| Lire le journal `/var/log/nginx/access.log` | `head`, `tail`, `wc -l` |
| Compter les erreurs 503 | `grep " 503 " … \| wc -l` (tube) |
| Trouver qui envoie autant de demandes | `cut -d " " -f 1 … \| sort \| uniq -c \| sort -n \| tail -3` |
| Voir la surcharge | `ps aux` |
| Bloquer le robot dans un fichier de root | `echo "deny …;" \| sudo tee -a /etc/nginx/bloques.conf` (et pourquoi `sudo echo … >>` échoue) |
| Faire relire la configuration | `sudo systemctl reload nginx` |
| Relancer le service bloqué | `sudo kill PID` (systemd le relance) |
| Écrire le rapport | `… > rapport.txt`, `echo … >> rapport.txt` |

Pièges prévus : `kill` avant de bloquer (le service repart à 99 %), `tee`
sans `-a` ou `>` qui écrase `bloques.conf` (une sauvegarde `.bak` existe).

### Chapitre 2 — Deuxième jour (fait)

Malo arrive en renfort : il doit lire les journaux de nginx sans `sudo`, et
l'équipe web a besoin d'un dossier partagé fermé aux autres comptes. La
machine a de vrais comptes et groupes (`/etc/passwd`, `/etc/group`), comme
une Debian : les journaux appartiennent à `www-data`, groupe `adm`, en 640.

| Étape | Commande apprise |
|---|---|
| Comprendre pourquoi on lit les journaux sans `sudo` | `id`, `id malo`, `groups`, `ls -l /var/log/nginx` |
| Donner la lecture des journaux à Malo | `sudo usermod -aG adm malo` |
| Dossier d'équipe | `sudo chgrp equipe-web /srv/equipe` puis `sudo chmod 770 /srv/equipe` (ou `chown root:equipe-web`, `chmod g+w,o-rx`) |

Objectifs vérifiés sur l'état : Malo lit les deux journaux et reste dans
`equipe-web`, les journaux restent fermés aux autres, et l'équipe (et elle
seule) entre, lit et écrit dans `/srv/equipe`.

Pièges prévus : `usermod -G` sans `-a` (Malo perd `equipe-web`),
`chmod o+r` sur les journaux (adresses IP lisibles par tous : données
personnelles), `chmod 777` sur le partage, `chgrp` sans être propriétaire.
Débrief : moindre privilège, `-aG`, setgid pour aller plus loin, liens vers
`usermod(8)`, `chmod(1)` et les groupes système de Debian.

### Chapitre 3 — La nuit du redémarrage (fait)

Le serveur a redémarré cette nuit (mises à jour automatiques) et le site
est tombé. Deux problèmes cachés depuis vendredi : `nginx` a été désactivé
pendant un test, et un `chown -R root:` a donné à root le dossier où
`php-fpm` (compte `www-data`) écrit son journal. La machine a un vrai
systemd simulé (`src/moteur/systemd.ts`) : services, journal, horloge,
redémarrages.

| Étape | Commande apprise |
|---|---|
| Trouver ce qui ne tourne pas | `systemctl --failed`, `systemctl status nginx catalogue` |
| Comprendre pourquoi | `journalctl -xeu catalogue`, `journalctl -b -p err`, `ls -l /var/log` |
| Réparer | `sudo chown www-data: /var/log/catalogue`, `sudo systemctl restart catalogue` |
| Que ça tienne | `sudo systemctl enable --now nginx` |
| Le prouver | `sudo reboot` (la session ssh est coupée), puis `systemctl --failed` |

Objectif vérifié sur l'état : après un redémarrage, sans rien relancer à la
main, les deux services tournent, et on a consulté leur état.

Pièges prévus : `start` sans `enable` (nginx ne revient pas au redémarrage
suivant), `chmod 777` sur le dossier des journaux, `systemctl` sans `sudo`.
Débrief : `--failed` après chaque redémarrage, `journalctl -xeu`, start
n'est pas enable, le dossier d'un service appartient à son compte, liens
vers `systemctl` et `journalctl` (freedesktop.org).

### Chapitre 4 — Le grand incendie (fait)

Cette nuit, le datacenter de l'hébergeur a brûlé (clin d'œil à l'incendie
d'OVHcloud à Strasbourg, en mars 2021). L'hébergeur livre une machine neuve,
même nom et même adresse, mais vide, et avec une **nouvelle clé d'hôte SSH**.
Les sauvegardes de chaque nuit étaient dans un autre datacenter : elles sont
montées sur `/mnt/sauvegarde`, avec le plan de reprise d'Awa (`PRA.txt`).

| Étape | Commande apprise |
|---|---|
| Se reconnecter | `ssh datacenter` refuse (« REMOTE HOST IDENTIFICATION HAS CHANGED! ») ; comparer l'empreinte annoncée, `ssh-keygen -R datacenter.example` (le nom écrit dans `known_hosts`), puis `yes` |
| Installer le serveur web | `sudo apt update`, puis `sudo apt install nginx` (qui le démarre et l'active) ; `curl http://localhost` |
| Vérifier la sauvegarde | `tar -tzf` : l'archive de cette nuit est coupée (« Fin de fichier inattendue ») ; `ls -l` montre sa taille |
| Restaurer | `sudo tar -xzf /mnt/sauvegarde/mediatheque-2026-10-22.tar.gz -C /` |
| Recharger sans casser | `sudo nginx -t` (« a duplicate default server »), retirer `sites-enabled/default`, `sudo nginx -t`, `sudo systemctl reload nginx` |
| Tester | `curl http://mediatheque.example` |

Objectif vérifié sur l'état : nginx tourne, démarre avec la machine, et sert
pour `mediatheque.example` la page de la dernière sauvegarde intacte (celle
du 22).

Pièges prévus : `apt install` avant `apt update` (« Unable to locate
package »), `apt` sans `sudo` (verrou de dpkg), l'archive coupée (extraite,
elle rend la configuration sans les pages : 404), une extraction dans `~`
(sans `-C /`), la sauvegarde de mercredi (plus ancienne que nécessaire), les
deux `default_server` (le rechargement est refusé, l'ancienne configuration
reste), `ssh-keygen -R datacenter` (le nom court n'est pas dans
`known_hosts`). Autres solutions acceptées : restaurer avant d'installer
(nginx ne démarre pas à l'installation, puis `systemctl start`), garder le
site de Debian et enlever `default_server` de la médiathèque, `cd /` puis
`tar -xzf` sans `-C`. Débrief : 3-2-1 avec une copie loin, plan de reprise
écrit et essayé, relire ses sauvegardes, perte acceptée (une journée),
clé d'hôte, `nginx -t` ; liens vers apt(8), la documentation de nginx, GNU
tar et ssh-keygen.

### Chapitre 5 — Le certificat a expiré (fait)

Trois mois après l'incendie, le certificat HTTPS de la médiathèque a expiré
ce matin ; les navigateurs affichent une alerte. Le jour de l'incendie, le
certificat avait été demandé avant la restauration du site : certbot a noté
`/var/www/html` (le site par défaut de Debian) comme dossier du défi. Depuis
30 jours, chaque renouvellement automatique échoue en silence (404). Depuis
juin 2025, Let's Encrypt n'envoie plus de courriel avant l'expiration.

| Étape | Commande apprise |
|---|---|
| Voir comme un visiteur | `curl https://mediatheque.example` (erreur 60), `openssl s_client -connect … \| openssl x509 -noout -dates` |
| Le certificat sur le disque | `sudo certbot certificates`, `openssl x509 -in … -noout -dates -subject -ext subjectAltName` |
| Pourquoi pas renouvelé | `systemctl --failed`, `journalctl -u certbot`, `sudo certbot renew --dry-run` (le défi en 404) |
| Le bon dossier | `cat /etc/letsencrypt/renewal/mediatheque.example.conf` ; `sudo certbot renew --webroot -w /var/www/mediatheque` |
| Que nginx serve le nouveau | `sudo systemctl reload nginx` (nginx lit le certificat au chargement) |
| Que ça tienne | `sudo certbot reconfigure --cert-name mediatheque.example --deploy-hook "systemctl reload nginx"` |

Objectif vérifié sur l'état : nginx présente un certificat valide pour les
deux noms du site, le prochain renouvellement automatique réussirait (le
défi est servi), et nginx sera rechargé après (deploy hook dans le fichier
de renouvellement, script exécutable dans `renewal-hooks/deploy/`, ou module
nginx de certbot).

Pièges prévus : `certbot` sans `sudo`, `--dry-run` qui n'enregistre rien,
ne corriger que `webroot_path` sans `[[webroot_map]]`, le certificat
renouvelé que nginx ne sert pas encore, un script de deploy hook non
exécutable, `--nginx` sans le paquet `python3-certbot-nginx`. Autres
solutions acceptées : modifier le fichier de renouvellement avec `nano`,
`certonly --webroot -w … -d … -d …`, `--deploy-hook` sur `renew`, le module
nginx (`apt install python3-certbot-nginx`, `certbot renew --nginx`), relancer
le service `certbot`. Débrief : 90 jours et 30 jours, surveiller soi-même
l'expiration, `--dry-run`, le défi HTTP-01, deploy hook ; liens vers la
documentation de certbot, les défis de Let's Encrypt et `openssl x509`.

## Histoire 3 : Le Paquet perdu (faite)

« Internet ne marche plus » au café associatif. Le carnet de Kofi donne la
méthode : tester de proche en proche. Prolonge le module « De l'Entrée à la
page ».

| Étape | Ce qu'on découvre |
|---|---|
| `ping 192.168.1.1` | le réseau local marche |
| `ping 9.9.9.9` | internet marche |
| `ping lettres.example` | « Temporary failure in name resolution » : le DNS |
| `dig lettres.example`, `cat /etc/resolv.conf` | l'ordinateur interroge l'ancienne box, disparue |
| `dig @9.9.9.9 lettres.example` | le nom existe bien |
| `sudo cp /etc/resolv.conf.box /etc/resolv.conf` | DNS réparé |
| `ping lettres.example` | 100 % de pertes… |
| `traceroute lettres.example` | box, opérateur, point d'échange, hébergeur, puis silence |
| `curl -I https://lettres.example` | `HTTP/2 200` : le serveur ignorait juste le ping |

## Histoire 4 : La Machine à remonter le temps (faite)

Le chat d'Inès, romancière, a marché sur le clavier ; elle a enregistré et
fait un commit. `git log`, `git show HEAD`, `git diff HEAD~1 roman.txt`,
`git restore --source=HEAD~1 roman.txt`, puis `git add` et `git commit`
pour enregistrer la version réparée (sans effacer l'histoire). Ensuite,
mettre ses poèmes à l'abri : `git init`, `git add .`, `git commit -m`.

## Histoire 5 : Les Archives (faite, deux chapitres)

Le serveur de la bibliothèque du quartier s'éteint à minuit ; Rosa n'a
qu'une clé USB de 64 Mo. `du -sh` et `df -h` montrent que le fonds (174 Mo)
ne tient pas ; `tar` échoue (« Aucun espace disponible sur le
périphérique »). `find fonds -name "*.tmp"` trouve 120 Mo de fichiers
temporaires, effacés avec `-delete`. L'archive compressée (`tar -czf`)
fait alors 48 Mo ; `tar -tzf` la vérifie. Morale d'archiviste : une seule
copie n'est pas une sauvegarde.

### Chapitre 2 — Les versions (fait)

Depuis janvier, le fonds vit sur un nouveau serveur, sauvegardé chaque nuit
avec restic sur le disque que la mairie prête (`/mnt/mairie`, presque
plein). Il y a quatre nuits, un script de « correction automatique » a
abîmé la transcription du journal de Marie ; chaque sauvegarde a gardé la
version abîmée. Trente instantanés, du 7 janvier au 5 février.

| Étape | Commande apprise |
|---|---|
| Ouvrir le dépôt | `restic -r … --password-file … snapshots` (ou le mot de passe tapé) |
| Trouver quand c'est arrivé | `restic find --long journal_de_marie.txt` (la date change le 2 février), `restic diff A B`, `restic dump ID fichier` |
| Restaurer | `restic restore ID --target /tmp/restauration --include …` puis `cp` (le chemin complet est recréé), ou `restic dump … > fichier` |
| Faire de la place | `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --dry-run`, puis sans `--dry-run`, puis `restic prune` (ou `--prune`) ; `df -h /mnt/mairie` |
| Vérifier | `restic check` |
| Protéger le mot de passe | `chmod 600 ~/.config/restic/mot-de-passe` |

Objectif vérifié sur l'état : le journal est revenu à l'identique, un
instantané contient encore la bonne version, le disque a retrouvé de la
place, le dépôt a été vérifié depuis sa dernière modification, et le
fichier du mot de passe n'est plus lisible par les autres comptes.

Pièges prévus : `restic` sans `-r`, un mauvais mot de passe, la restauration
qui recrée le chemin complet sous `--target`, `forget` sans `prune` (la
place ne revient pas), une politique trop sévère avant d'avoir restauré
(plus aucun instantané ne contient la bonne version). Autres solutions
acceptées : `dump` redirigé, `forget --prune` d'un coup, une nouvelle
sauvegarde après restauration puis une politique plus courte. Débrief :
versions plutôt que miroir, politique de rétention, forget n'est pas prune,
check et restaurations d'essai, chiffrement et garde du mot de passe ;
liens vers la documentation de restic.

## Histoire 6 : Les Lettres du quartier (en cours, six chapitres)

L'association de Kofi (vue dans Le Paquet perdu) loue un petit serveur pour
son site, `lettres.example` (machine `lettres`, même adresse que dans Le
Paquet perdu). L'hébergeur l'a livré avec la configuration par défaut :
connexion root et mots de passe acceptés.

### Chapitre 1 — Fermer la porte (fait)

Le serveur SSH simulé (`src/moteur/sshd.ts`) lit `/etc/ssh/sshd_config`
comme OpenSSH : mots-clés, `Include` lu à sa place, **première valeur lue
qui l'emporte**, valeurs par défaut. La configuration appliquée est celle du
dernier démarrage ou rechargement du service `ssh`, et c'est elle que la
commande `ssh` du poste consulte pour accepter ou refuser une connexion.

| Étape | Commande apprise |
|---|---|
| Voir les attaques | `journalctl -u ssh` (force brute sur root, admin, test, ubuntu) |
| Changer la configuration | `sudo nano /etc/ssh/sshd_config` : `PermitRootLogin no`, `PasswordAuthentication no` |
| Vérifier | `sudo sshd -t` (fichier et ligne de l'erreur), `sudo sshd -T` (configuration effective) |
| Appliquer | `sudo systemctl reload ssh` (refusé si la configuration est fausse : l'ancienne reste) |
| Prouver qu'on peut encore entrer | `exit`, puis `ssh lettres` |

Objectif vérifié sur l'état : la configuration *appliquée* refuse root et
les mots de passe, accepte toujours le compte `vous`, et une nouvelle
connexion a réussi depuis.

Pièges prévus : faute de frappe (`PermitRootLogin non`), le fichier
`sshd_config.d/50-cloud-init.conf` inclus en tête qui garde
`PasswordAuthentication yes`, modifier sans recharger, un `AllowUsers` qui
oublie son propre compte (on s'enferme dehors : la session en cours reste
ouverte, et le menu du jeu sert de console de secours de l'hébergeur).
Autre solution acceptée : un fichier `sshd_config.d/00-…conf`, lu en
premier. Débrief : clés seulement, jamais root en direct, `sshd -t` et
`sshd -T`, garder une session ouverte, liens vers `sshd_config(5)` et
`sshd(8)` (man.openbsd.org).

### Chapitre 2 — Le pare-feu (fait)

Un scan (sortie de nmap) montre la base de données du site (MariaDB, 3306)
joignable depuis internet. Le pare-feu simulé (`src/moteur/parefeu.ts`)
suit ufw : politique par défaut, règles ordonnées (la première qui
correspond décide), connexions établies jamais coupées. La commande `ssh`
du poste s'y heurte : `deny` donne `Connection timed out`, `reject`
`Connection refused`.

| Étape | Commande apprise |
|---|---|
| Qui écoute, et où ? | `ss -tln`, `sudo ss -tlnp` (0.0.0.0 contre 127.0.0.1) |
| Autoriser les portes utiles | `sudo ufw allow "Nginx Full"`, `sudo ufw limit OpenSSH` (ou `allow from 192.0.2.2 to any port 22`) |
| Activer | `sudo ufw enable` (question o/n) |
| Vérifier | `sudo ufw status verbose`, puis `exit` et `ssh lettres` |

Objectif vérifié sur l'état : pare-feu actif, entrant refusé par défaut,
SSH joignable depuis le poste, 80 et 443 depuis internet, 3306 fermé, et
une nouvelle connexion ssh réussie depuis l'activation.

Pièges prévus : activer avant d'autoriser SSH (la session tient, la
suivante est bloquée : le menu sert de console de secours), `default allow`
(la base reste ouverte), oublier le site, ne pas activer. Autre solution
acceptée : `default reject` et SSH depuis l'adresse du poste seulement.
Débrief : `ss -tlnp` d'abord, autoriser SSH avant `enable`, `limit`,
`bind-address`, liens vers `ufw(8)` et `ss(8)`.

### Chapitre 3 — La sentinelle (fait)

fail2ban tourne avec les réglages de Debian (prison `sshd`, bannissement de
10 minutes). `/var/log/fail2ban.log` montre les robots qui reviennent dès la
fin de leur bannissement, et Rania, la webmestre, bannie après cinq erreurs
de nom d'utilisateur. Le fail2ban simulé (`src/moteur/fail2ban.ts`) lit la
configuration dans l'ordre `jail.conf`, `jail.d/*.conf`, `jail.local`,
`jail.d/*.local` (le dernier lu l'emporte, `[sshd]` sur `[DEFAULT]`), compte
les échecs dans le journal de SSH et bannit à `maxretry`, sauf `ignoreip`.
La commande `ssh` du poste se heurte aux bannissements (`Connection
refused`).

| Étape | Commande apprise |
|---|---|
| Comprendre | `cat /var/log/fail2ban.log`, `sudo fail2ban-client status sshd`, `journalctl -u ssh` |
| Rendre l'accès à Rania | `sudo fail2ban-client set sshd unbanip 198.51.100.40` |
| Régler | `sudo nano /etc/fail2ban/jail.local` : `bantime = 1h`, `ignoreip = 127.0.0.1/8 ::1 192.0.2.2 198.51.100.40` |
| Appliquer et vérifier | `sudo fail2ban-client -t`, `sudo systemctl reload fail2ban`, `sudo fail2ban-client status sshd` |

Objectif vérifié sur l'état : la configuration chargée active la prison,
bannit au moins une heure et ignore Rania et le poste ; Rania et le poste ne
sont pas bannis, les deux robots si ; et l'on a consulté l'état de la prison
depuis.

Pièges prévus : faute de syntaxe (le vrai message de configparser),
`maxretry = 3` sans `ignoreip` (le poste, qui a raté trois connexions hier,
se bannit lui-même : le menu sert de console de secours), oublier de
recharger, oublier que Rania reste bannie (un bannissement survit au
rechargement), modifier `jail.conf` (ça marche, mais un avertissement
explique pourquoi c'est une mauvaise idée). Autre solution acceptée :
`jail.d/*.local`, `bantime = -1`, `ignoreip` en CIDR.

### Chapitre 4 — La colocation (fait)

Le café associatif (celui du Paquet perdu) emménage sur le serveur des
Lettres : deux sites sur une machine. Et l'agenda des ateliers de Rania, un
petit programme Node.js qui n'écoute que sur `127.0.0.1:3000`, doit
s'afficher sous `http://lettres.example/agenda/`.

| Étape | Commande apprise |
|---|---|
| Voir comment un site est activé | `ls -l /etc/nginx/sites-enabled` (un lien symbolique) |
| Créer le site du café | `sudo cp sites-available/lettres sites-available/cafe`, `sudo nano …` (server_name, root, sans default_server) |
| L'activer | `sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/` |
| Tester avant le DNS | `curl -H "Host: cafe.example" http://127.0.0.1` |
| Publier l'agenda | `location /agenda/ { proxy_pass http://127.0.0.1:3000/; }`, `sudo nginx -t`, `sudo systemctl reload nginx` |
| Comprendre un 502 | `sudo tail /var/log/nginx/error.log`, `sudo systemctl enable --now agenda` |

Objectif vérifié sur l'état : nginx sert la page du café pour
`cafe.example`, celle des Lettres pour `lettres.example`, l'agenda sous
`/agenda/` et `/agenda/semaine`, et le service `agenda` démarrera avec la
machine.

Pièges prévus : `ln -s` avec un chemin relatif lu depuis le mauvais lieu
(lien cassé, `nginx -t` échoue), le fichier copié qui garde
`default_server` (« duplicate default server ») ou `server_name`
(« conflicting server name », le café montre les Lettres), l'agenda arrêté
(502, `connect() failed` dans error.log), `proxy_pass` sans barre finale
(« Cannot GET /agenda/ »), `start` sans `enable`. Autres solutions
acceptées : un fichier écrit de zéro, `localhost` dans `proxy_pass`, une
copie au lieu d'un lien dans `sites-enabled`. Débrief : sites-available et
sites-enabled, default_server et server_name, tester avec `Host`, barre
finale de proxy_pass, 502 et error.log, appli derrière un proxy sur
127.0.0.1 ; liens vers la documentation de nginx.

### Chapitre 5 — Ça marche chez moi (fait)

Kofi a « fait pointer » cafe.example vers le serveur… dans le `/etc/hosts`
de son propre ordinateur. Chez lui, le site du café marche ; ailleurs, le
nom mène à l'ancien hébergeur, et `www.cafe.example` n'existe pas. Le
serveur des Lettres fait autorité pour la zone (BIND, `named`) ; le registre
en garde une copie (`ns2.registre.example`). Le DNS simulé est dans
`src/moteur/dns.ts`.

| Étape | Commande apprise |
|---|---|
| Voir ce que voient les autres | `dig cafe.example` (résolveur public, ancienne adresse, TTL qui décroît) |
| Interroger les serveurs qui font autorité | `dig @localhost cafe.example`, `dig @ns2.registre.example cafe.example SOA +short` |
| Corriger la zone | `sudo nano /etc/bind/zones/db.cafe.example` : l'adresse, `www IN CNAME cafe.example.`, le serial |
| Vérifier, recharger | `named-checkzone cafe.example …`, `sudo rndc reload`, `journalctl -u named` |

Objectif vérifié sur l'état : les deux serveurs qui font autorité répondent
la nouvelle adresse pour `cafe.example` et `www.cafe.example`, le MX est
toujours là, la zone des Lettres n'a pas bougé.

Pièges prévus : `/etc/hosts` « maison », le résolveur qui garde l'ancienne
réponse en cache (TTL de 24 heures), une adresse mal tapée (`bad dotted
quad`, la zone reste l'ancienne), le serial oublié (« zone serial
unchanged », ns2 garde l'ancienne zone), le point final oublié
(`cafe.example.cafe.example.`), `rndc` sans `sudo`. Autres solutions
acceptées : un enregistrement A pour `www`, `systemctl reload named`.
Débrief : tester comme les autres, serveurs faisant autorité contre
résolveur, serial, `named-checkzone`, point final, baisser le TTL avant un
déménagement ; liens vers la documentation de BIND et la RFC 1034.

### Chapitre 6 — Le soir du concert (fait)

Soir de concert au café : l'agenda (une appli qui sert une vingtaine de
pages par seconde) ne répond plus, les visiteur·ses reçoivent des 504. Un
robot aspire l'agenda depuis trois adresses, 24 requêtes par seconde. Après
chaque rechargement de nginx, le jeu fait passer une minute de trafic, qui
s'écrit dans `access.log`.

| Étape | Commande apprise |
|---|---|
| Lire les codes de réponse | `awk '{print $9}' access.log \| sort \| uniq -c` |
| Trouver qui demande | `awk '{print $1}' … \| sort \| uniq -c \| sort -n`, `awk '$9 == 504 {print $1}' …` |
| Limiter le débit | `limit_req_zone $binary_remote_addr zone=agenda:10m rate=2r/s;` puis `limit_req zone=agenda burst=10 nodelay;` (et `limit_req_status 429;`) |
| Vérifier | `sudo nginx -t`, `sudo systemctl reload nginx`, la minute suivante dans `access.log` et `error.log` |

Objectif vérifié sur l'état : pendant la dernière minute simulée, toutes les
requêtes des visiteur·ses ont été servies, et la limitation de débit a
refusé au moins 60 % des requêtes du robot.

Pièges prévus : `limit_req` sans `limit_req_zone` (« zero size shared
memory zone »), une limite sans rafale (une page et ses quatre fichiers
d'un coup : les vraies personnes sont refusées), une limite trop large ou
mal placée (le robot passe encore), `deny` des adresses du robot (marche ce
soir, mais pas une règle durable). Autres solutions acceptées : la zone dans
`conf.d/`, la limite sur tout le site, un débit de 1 requête par seconde.
Débrief : lire les journaux avant d'agir, limiter par adresse là où c'est
coûteux, rafale et `nodelay`, 429, `deny` contre règle durable ; liens vers
`limit_req`, le format des journaux et awk (POSIX).

## Histoire 7 : La Fabrique (quatre chapitres)

Le fablab du quartier (machine `fabrique`, 192.0.2.15) prête des outils aux
habitant·es grâce à l'outilthèque, une petite appli web qui tourne dans
Docker. Yasmine s'en occupe. Docker est simulé dans `src/moteur/docker.ts`
(images, conteneurs et leur couche, volumes, dossiers montés, ports publiés,
politiques de redémarrage) ; les applis des images sont décrites par les
chapitres.

### Chapitre 1 — La mise à jour (fait)

L'outilthèque a été lancée il y a deux semaines avec un simple `docker run`,
sans volume : sa base vit dans la couche du conteneur. La version 1.5 est
sortie, et il y a 37 prêts en cours à ne pas perdre.

| Étape | Commande apprise |
|---|---|
| Voir ce qui tourne | `sudo docker ps -a`, `docker logs`, `curl http://localhost:8080` (et `docker` sans `sudo` : le socket refuse) |
| Savoir où sont les données | `sudo docker inspect -f '{{json .Mounts}}' outiltheque`, `docker exec outiltheque ls -l /var/lib/outiltheque` |
| Mettre la base à l'abri | `sudo docker cp outiltheque:/var/lib/outiltheque ./sauvegarde` |
| Le nouveau conteneur | `docker stop outiltheque`, `docker run -d --name … -p 8080:8080 -v outiltheque-donnees:/var/lib/outiltheque --restart unless-stopped registre.example/outiltheque:1.5` |
| Remettre la base | `docker cp sauvegarde/. conteneur:/var/lib/outiltheque`, `docker restart` (la base migre), `docker logs` |

Objectif vérifié sur l'état : un conteneur de la version 1.5 tourne, publie
le port 8080, garde sa base dans un volume ou un dossier de la machine, y
retrouve les 37 prêts, et repartira avec la machine (`always` ou
`unless-stopped`).

Pièges prévus : `docker` sans `sudo`, `docker rm` d'un conteneur qui tourne,
`docker rm -f` avant d'avoir copié la base (perdue pour de bon : le chapitre
se recommence depuis le menu), le port 8080 encore pris par l'ancien
conteneur (« port is already allocated »), le nouveau conteneur qui crée une
base vide, l'oubli de `--restart`. Autres solutions acceptées : un dossier
de la machine (`-v /srv/outiltheque:/var/lib/outiltheque`), copier la base
dans le volume avant de lancer, `docker update --restart`, `always`.
Débrief : `inspect` avant de toucher, volumes, `docker cp`, remplacer sans
supprimer trop tôt, `--restart`, le groupe docker vaut root ; liens vers
la documentation de Docker.

### Chapitre 2 — La composition (fait)

Le fablab veut un site de réservation des machines : l'appli
`reservations` et sa base PostgreSQL, décrites dans un `compose.yaml` copié
d'un tutoriel (`/srv/reservations`). Compose est simulé dans
`src/moteur/compose.ts` (YAML réduit, variables de `.env`, réseau du projet
où chaque service est joignable par son nom, volumes nommés).

| Étape | Commande apprise |
|---|---|
| Lancer, regarder | `sudo docker compose up -d`, `docker compose ps`, `docker compose logs appli`, `curl http://localhost:8081` |
| Joindre la base | `DATABASE_URL=postgres://…@db:5432/…` (le nom du service, pas `localhost`) |
| Garder les données | `volumes: - donnees:/var/lib/postgresql/data` et `volumes: donnees:` en bas du fichier |
| Sortir le secret | `${POSTGRES_PASSWORD}` dans `compose.yaml`, la valeur dans `.env`, `chmod 600 .env` ; `docker compose config` |
| Que ça tienne | `restart: unless-stopped` sur chaque service, puis `docker compose up -d` |

Objectif vérifié sur l'état : les conteneurs correspondent au fichier et à
`.env` actuels, l'appli est connectée à la base, la base garde ses données
dans un volume, le mot de passe n'est plus dans `compose.yaml` mais dans un
`.env` lisible par root seulement, et les deux services ont une politique de
redémarrage.

Pièges prévus : `localhost` dans un conteneur (`ECONNREFUSED 127.0.0.1:5432`),
`version:` obsolète (avertissement), variable absente de `.env` (PostgreSQL
refuse de s'initialiser sans mot de passe), mot de passe changé après la
création de la base (`password authentication failed` : `POSTGRES_PASSWORD`
ne sert qu'à l'initialisation ; `down -v` efface les volumes), `.env`
lisible par tous, l'oubli de `restart`. Débrief : nom des services, volume
nommé, secrets dans `.env`, `config`, `down -v`, `restart` ; liens vers la
documentation de Compose et l'image PostgreSQL.

### Chapitre 3 — Le trou dans le pare-feu (fait)

Rania a testé le serveur depuis chez elle : PostgreSQL répond sur le port
5432, alors qu'ufw n'autorise que SSH, 8080 et 8081. Yasmine avait ajouté
`ports: - "5432:5432"` à la base pour pgAdmin. Docker publie ce port avec
ses propres règles iptables, appliquées avant celles d'ufw. Et le disque est
plein à 92 %.

| Étape | Commande apprise |
|---|---|
| Tester comme le monde | depuis le poste : `nc -zv fabrique 5432` (puis 22, 3306…) |
| Comprendre | `sudo ss -tlnp` (docker-proxy sur 0.0.0.0:5432), `sudo ufw status` (pas de 5432) ; `ufw deny 5432` ne change rien |
| Fermer | dans `compose.yaml` : retirer `ports:` de la base, ou `"127.0.0.1:5432:5432"` ; `sudo docker compose up -d` ; retester depuis le poste |
| Faire de la place | `df -h /`, `sudo docker system df`, `docker image prune -a`, `docker container prune` |

Objectif vérifié sur l'état : le port 5432 ne répond plus depuis
l'extérieur, les deux applis répondent toujours, le disque est sous 75 %, et
les volumes utiles (dont `wiki-ancien`, qu'aucun conteneur n'utilise) sont
toujours là.

Pièges prévus : croire `ufw status`, ajouter une règle ufw (sans effet),
`docker image prune` sans `-a` (trop peu de place gagnée),
`docker volume prune -a` qui efface le wiki (le chapitre se recommence
depuis le menu), une image utilisée par un conteneur arrêté (protégée).
Autres solutions acceptées : plus de port du tout pour la base,
`docker system prune -a -f`, `docker rmi`. Débrief : publier le moins
possible, `127.0.0.1` et tunnel SSH, tester de l'extérieur, `system df` et
`prune`, le danger de `volume prune -a` ; liens vers la documentation de
Docker (ufw, ports publiés, ménage).

### Chapitre 4 — Les pleins pouvoirs (fait)

La galerie photo du fablab (`/srv/galerie`, port 8082) reçoit les photos
envoyées par les visiteur·ses. Son image ne déclare pas d'utilisateur et
`compose.yaml` n'a pas de `user:` : elle tourne en root. Les fichiers
qu'elle écrit dans le dossier monté `photos/` appartiennent à root sur la
machine, et Yasmine ne peut plus gérer les photos sans `sudo`. Rania
rappelle qu'une faille dans la galerie donnerait root sur tout ce qui est
monté.

| Étape | Commande apprise |
|---|---|
| Qui suis-je, dedans et dehors | `sudo docker exec galerie-galerie-1 id` (uid=0), `ps aux` sur la machine (le processus de la galerie au nom de root) |
| Changer d'utilisateur | `user: "1001:1001"` dans `compose.yaml` (ou `docker run --user`), `sudo docker compose up -d` |
| Comprendre l'échec | `docker compose ps` (Restarting), `docker compose logs` (EACCES), `ls -lan photos` (uid et gid en numéros, fichiers cachés) |
| Donner le dossier | `sudo chown -R 1001:1001 /srv/galerie/photos` ; Docker relance la galerie tout seul |

Objectif vérifié sur l'état : un conteneur de la galerie tourne sous un uid
autre que 0 et répond, les 14 photos sont là, Yasmine (uid 1001) peut
écrire dans le dossier, et ni celui-ci ni `.miniatures` ne sont ouverts en
écriture à tous.

Pièges prévus : un nom inconnu de l'image (`user: galerie` : « unable to
find user galerie: no matching entries in passwd file »), `chown` sans `-R`
(le dossier `.miniatures` reste à root), `user: node` (uid 1000 : sur la
machine, ses fichiers appartiennent à « vous », et Yasmine ne peut toujours
pas écrire), `chmod 777`, une photo effacée (le chapitre se recommence
depuis le menu). Autres solutions acceptées : `docker run -u`, un autre uid
avec le groupe de Yasmine et `chmod -R g+w`. Débrief : `id` et `ps aux`,
l'uid partagé avec la machine (sans userns-remap), `USER`/`--user`/`user:`,
des numéros plutôt que des noms, `chown -R` plutôt que `chmod 777`,
`--cap-drop ALL`, `no-new-privileges`, `--read-only`, ni `--privileged` ni
socket Docker monté, mode rootless ; liens vers la documentation de Docker.

## Histoire 8 : La Gazette (cinq chapitres)

Le journal en ligne du quartier (machine `gazette`, 192.0.2.16) apprend à
déployer : Samia (rédactrice en chef) et Théo (stagiaire). Phase 6 de la
feuille de route.

### Chapitre 1 — Le dépôt nu (fait)

Le site est servi par nginx depuis `/var/www/gazette`, où chacun·e copiait
ses fichiers à la main. Le code est suivi par git dans `~/gazette`.

| Étape | Commande apprise |
|---|---|
| Voir ce qui a dérivé | `diff -r ~/gazette /var/www/gazette` (la correction de Théo n'existe que sur le serveur) |
| Le dépôt du serveur | `sudo git init --bare /srv/git/gazette.git`, `sudo chown -R vous: …` |
| Le crochet | `hooks/post-receive` : `git --work-tree=/var/www/gazette checkout -f main`, `chmod +x` |
| Publier | `git remote add prod /srv/git/gazette.git`, `git commit -am`, `git push prod main` |

Objectif vérifié sur l'état : le site est exactement le dernier commit du
dépôt du serveur, extrait par son crochet, avec l'article, la correction de
Théo, puis la date de l'agenda corrigée (demandée une fois le site en ligne).
Pièges prévus : dépôt créé avec sudo (« droits insuffisants »), pas de
crochet, crochet non exécutable (l'astuce de git), `checkout` sans `-f`
(fichiers non suivis), correction de Théo écrasée par le déploiement,
correction faite directement sur le serveur. Débrief : une seule source,
dépôt nu, crochets, `--shared=group` ; liens vers le livre de git et
githooks.

### Chapitre 2 — Le retour arrière (fait)

Chaque push est publié dans `/srv/gazette/releases/<date>`, et le lien
`/srv/gazette/current` (servi par nginx) désigne la version en ligne. La
mise en page de Théo, sans `index.html`, donne un 403.

| Étape | Commande apprise |
|---|---|
| Comprendre | `curl -I`, `ls -l /srv/gazette`, `readlink`, `ls releases/*` |
| Revenir en arrière | `ln -sfn releases/20270514101502 current` |
| Le garde-fou | dans le crochet, `cd` dans la nouvelle version puis `sh tests.sh` AVANT `ln -sfn` (avec `set -e`) |
| Publier la réparation | `git pull prod main`, `mv accueil.html index.html`, `git add .`, `git commit`, `git push` |

Objectif vérifié sur l'état : la nouvelle mise en page est en ligne,
publiée par le crochet après ses tests, et un nouveau push cassé de Théo
(simulé dès que le crochet lance les tests) n'a pas été mis en ligne.
Pièges prévus : `ln -sf` sans `-n` (le lien est créé dans la version
cassée), tests après la bascule, tests lancés depuis le dépôt (tout est
refusé), `push` refusé tant qu'on n'a pas récupéré les commits de Théo.

### Chapitre 3 — Bleu et vert (fait)

Le Kiosque (abonnements à la lettre, Node.js) tourne sur l'emplacement bleu
(port 3001) derrière nginx ; l'emplacement vert (3002) est libre.

| Étape | Commande apprise |
|---|---|
| La nouvelle version à côté | `ln -sfn /srv/kiosque/versions/1.5.0 /srv/kiosque/vert`, `sudo systemctl start kiosque-vert` |
| Vérifier sa santé | `curl -s localhost:3002/health` (503), `cat …/NOTES.txt`, la variable dans `/etc/kiosque/kiosque.env`, `systemctl restart` |
| Basculer | `proxy_pass http://127.0.0.1:3002/;`, `sudo nginx -t`, `sudo systemctl reload nginx` |

Objectif vérifié sur l'état : nginx (configuration chargée) envoie
`/kiosque/` vers une instance 1.5.0 en bonne santé, et l'autre instance
tourne toujours. Pièges prévus : changer le lien sans redémarrer, basculer
avant `/health`, oublier le `reload`, arrêter bleu tout de suite.

### Chapitre 4 — Le canari (fait)

La 1.6.0 passe `/health` mais plante sur `/archives`. Vert sert la 1.5.0.

| Étape | Commande apprise |
|---|---|
| Le canari | `upstream kiosque { server 127.0.0.1:3002 weight=9; server 127.0.0.1:3001 weight=1; }`, `proxy_pass http://kiosque/;`, reload |
| Regarder | `awk '{print $9}' access.log \| sort \| uniq -c`, `grep " 500 "`, `curl localhost:3001/archives` |
| Arrêter, recommencer | `down`, reload ; la 1.6.1 publiée ; nouveau canari ; puis tout vers bleu |

Objectif vérifié sur l'état : tout `/kiosque/` va à la 1.6.1 en bonne
santé, après un canari de la 1.6.1 sans erreur, vert toujours allumé.
Pièges prévus : tout basculer d'un coup sur la 1.6.0 (toutes les visites
d'archives en 500), un « canari » à 50 %.

### Chapitre 5 — La migration (fait)

Théo a mis la 2.0.0 sur vert et basculé nginx ; au démarrage, elle a migré
la base (schéma 3 → 4). Elle ne marche pas (variable renommée), et bleu
(1.6.1) ne sait plus lire la base.

| Étape | Commande apprise |
|---|---|
| Comprendre | `curl localhost:3002/health`, `curl localhost:3001/health`, `sudo journalctl -u kiosque-vert` (la migration), les notes de version |
| Réparer en avant | `KIOSQUE_SMTP_URL=…` dans `kiosque.env`, `systemctl restart kiosque-vert` |
| Refaire le filet | `ln -sfn …/2.0.0 /srv/kiosque/bleu`, `systemctl restart kiosque-bleu` |

Objectif vérifié sur l'état : nginx sert une instance 2.x en bonne santé, et
l'autre instance tourne aussi en 2.x en bonne santé. Piège prévu : revenir
sur bleu (1.6.1), qui répond 500. Débrief : sauvegarder avant une
migration (`pg_dump`), étendre puis contracter, réparer en avant.

## Histoire 9 : La Ludothèque (trois chapitres)

Le serveur de la ludothèque du quartier (machine `ludotheque`, 192.0.2.17) :
Bérénice (présidente) et Malo (bénévole). Phase 7 de la feuille de route.

### Chapitre 1 — La rançon (fait)

Lundi matin, le partage (`/srv/partage`) est chiffré (`.locked`) ; une
demande de rançon traîne dans chaque dossier. Le mot de passe du compte
`accueil` a été deviné ; un programme tourne encore sous ce compte, et sa
crontab le relance. La copie nocturne du NAS (`rsync --delete`) est chiffrée
aussi.

| Étape | Commande apprise |
|---|---|
| Mesurer | `find /srv/partage -name "*.locked" \| wc -l`, `cat LISEZ-MOI…` (on ne paie pas) |
| Arrêter l'attaque | `ps aux`, `sudo kill 3141`, `sudo crontab -u accueil -l/-r`, `sudo usermod -L accueil`, `journalctl -u ssh` |
| Trouver une sauvegarde | `ls /mnt/nas/partage` (chiffrée), `lsblk -f` (le disque `SAUVEGARDE`) |
| Restaurer | `sudo mount -o ro /dev/sdb1 /mnt/cle`, `restic snapshots`, `restic restore latest --target /`, `find … -delete`, `sudo umount /mnt/cle` |

Objectif vérifié sur l'état : le chiffreur est arrêté et ne revient plus,
le compte est verrouillé, les six fichiers sont restaurés, plus aucun
`.locked` ni demande de rançon, et le disque est démonté. Pièges prévus :
restaurer avant d'arrêter le chiffreur (les fichiers sont rechiffrés),
oublier la crontab (il revient), brancher la sauvegarde pendant l'attaque,
démonter depuis le point de montage (« target is busy »).

### Chapitre 2 — Les instantanés (fait)

Régler rsnapshot (configuration de Debian) pour `/srv/partage/` vers le
second disque, 7 quotidiens et 4 hebdomadaires, et le lancer avec cron. Le
jeu fait passer deux semaines ; le dernier soir, Bérénice écrase
l'inventaire par une vieille copie.

| Étape | Commande apprise |
|---|---|
| Régler | `/etc/rsnapshot.conf` (tabulations), `rsnapshot configtest`, `rsnapshot -t daily` |
| Planifier | `sudo crontab -e` : `0 3 * * 1 … weekly`, `30 3 * * * … daily` |
| Constater | `ls /mnt/instantanes`, `rsnapshot du`, `ls -i` (même inode), `diff` |
| Restaurer | `cp …/daily.1/localhost/srv/partage/inventaire.csv /srv/partage/` |

Objectif vérifié sur l'état : 7 instantanés quotidiens et un hebdomadaire
sur `/mnt/instantanes`, et l'inventaire revenu à sa version de
l'avant-veille. Pièges prévus : des espaces au lieu de tabulations, la
crontab d'un compte ordinaire (le courrier de cron le dit), le dernier
instantané (pris après l'erreur).

### Chapitre 3 — La base (fait)

Les prêts vivent dans une base PostgreSQL ; Malo copie ses fichiers avec
rsnapshot pendant qu'elle tourne.

| Étape | Commande apprise |
|---|---|
| Se connecter | `psql -l` (rôle inconnu), `sudo -u postgres psql -d ludo -c "\dt"` |
| Sauvegarder | `sudo -u postgres pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo` |
| Tester | `createdb ludo_test`, `pg_restore -d ludo_test …`, `SELECT count(*)` |
| Réparer | la table `prets` vidée : `pg_restore -d ludo --data-only -t prets …` |
| Planifier | `sudo crontab -u postgres -e` |

Objectif vérifié sur l'état : une tâche cron fait le `pg_dump` de `ludo`
sous `postgres`, une archive existe, une base de test a les mêmes nombres
de lignes, et les prêts sont revenus. Pièges prévus : la redirection `>`
avec `sudo -u`, restaurer par-dessus la base en service, réinjecter dans
une table pleine (doublons), `pg_dump` dans la crontab de root.

## Histoire 10 : L'Astreinte (six chapitres)

Des nuits d'astreinte pour Radio Quartier (machine `radio`, 192.0.2.18),
avec Zoé, bénévole technique. Les pannes classiques, une par nuit, puis la
supervision qui prévient avant que ça casse. Phase 7 de la feuille de route.

### Chapitre 1 — Le disque plein (fait)

2 h 47 : l'enregistrement de nuit échoue, « No space left on device ». Le
relais du flux (`radio-flux`) écrit son journal en mode debug depuis trois
jours (16 Go).

| Étape | Commande apprise |
|---|---|
| Trouver | `df -h`, `sudo du -sh /var/log/*`, `tail` (des lignes DEBUG) |
| Le piège | `rm` d'un fichier encore ouvert : `df` reste plein, `sudo lsof +L1` montre `(deleted)` |
| Vider | `sudo truncate -s 0 /var/log/radio/flux.log` (ou redémarrer le relais) |
| Corriger | `loglevel = info` dans `/etc/radio/flux.conf`, `systemctl restart radio-flux` |
| Éviter | `/etc/logrotate.d/radio` (`rotate`, `daily`, `copytruncate` ou `postrotate … systemctl reload`), `logrotate -d` |

Objectif vérifié sur l'état : le disque est sous 80 %, aucun fichier effacé
n'est encore tenu ouvert, le relais tourne sans debug, et une configuration
logrotate valable couvre son journal et sait le faire rouvrir. Pièges
prévus : `rm` d'un fichier ouvert, une rotation qui renomme sans faire
rouvrir (le relais écrit dans `flux.log.1`), une directive mal écrite.

### Chapitre 2 — La mémoire (fait)

4 h 31 : le direct ne diffuse plus que du silence. La playlist de la nuit
(`radio-playlist`, un programme Node) a été tuée par l'OOM killer : elle
garde en mémoire chaque morceau décodé (une fuite). Et des processus
zombies (`<defunct>`) résistent à `kill -9`.

| Étape | Commande apprise |
|---|---|
| Comprendre | `systemctl status` (`Result: oom-kill`), `sudo dmesg -T` ou `journalctl -k` (`Out of memory: Killed process`), `free -h` |
| Voir la fuite | relancer, puis `top -o %MEM` d'une commande à l'autre ; le noyau frappe à nouveau |
| Contenir | `sudo systemctl edit radio-playlist` : `[Service]`, `MemoryMax=600M`, `Restart=on-failure` (ou `systemctl set-property … MemoryMax=`, une surcharge écrite à la main et `daemon-reload`) |
| Les zombies | `ps -ef` (le parent, PPID 2305), `kill` n'y peut rien, `sudo systemctl restart radio-podcast` |

Objectif vérifié sur l'état : la playlist tourne avec une limite de mémoire
entre 256 Mo et 1 Go et une relance automatique, plus aucun zombie, le
relais actif. Pièges prévus : `kill -9` sur un zombie, relancer sans limite
(l'OOM killer revient), une limite sans `Restart=` (la playlist reste
arrêtée), une limite trop basse (tuée au démarrage) ou trop haute, une
surcharge écrite à la main sans `daemon-reload`.

### Chapitre 3 — Les inodes (fait)

3 h 20 : l'enregistrement de nuit échoue de nouveau, « No space left on
device », mais `df -h` dit que le volume des données (`/srv/radio`, 1 Gio)
est presque vide. Le relais y écrit un petit fichier par écoute depuis
mars : les 65 536 inodes sont pris.

| Étape | Commande apprise |
|---|---|
| Comprendre | `df -h` (22 %), `sudo touch` (« Aucun espace disponible »), `df -i` (100 %) |
| Trouver | `sudo du --inodes -d 1 /srv/radio`, `ls \| wc -l` |
| Le piège | `rm *` : « Liste d'arguments trop longue » (ARG_MAX) |
| Faire le ménage | `find /srv/radio/stats -type f -mtime +30` (voir), puis `-delete` |
| Éviter | une tâche cron (root ou radio) : `find … -mtime +30 -delete` ; le jeu fait passer une journée et une nuit |

Objectif vérifié sur l'état, après la nuit simulée : aucune statistique de
moins de 31 jours n'a disparu, la plus ancienne a au plus 60 jours, moins
de 80 % des inodes sont occupés. Pièges prévus : `rm *`, la crontab de
`vous` (pas le droit d'effacer les fichiers de `radio` : courrier de cron),
une tâche qui efface tout (le rapport du mois est perdu), un horaire qui ne
tombe pas la nuit.

### Chapitre 4 — L'horloge (fait)

Lundi, 9 h 12 : la matinale (6 h – 9 h) ne s'est enregistrée qu'à partir
de 8 h 09. Le serveur, migré ce week-end sur une image standard, vit à
l'heure UTC (cron lance l'enregistrement à 6 h UTC, 8 h à Paris) et son
horloge retarde de neuf minutes : timesyncd est arrêté, et sa configuration
vise le serveur NTP de l'ancien hébergeur.

| Étape | Commande apprise |
|---|---|
| Comprendre | `date` (UTC), `timedatectl` (fuseau, `synchronized: no`, `NTP service: inactive`), `sudo crontab -u radio -l`, le journal de l'enregistrement |
| Le fuseau | `timedatectl list-timezones`, `sudo timedatectl set-timezone Europe/Paris` |
| NTP | `sudo timedatectl set-ntp true` ; `journalctl -u systemd-timesyncd` (pas de réponse) ; `NTP=ntp.hebergeur.example` dans `/etc/systemd/timesyncd.conf`, `systemctl restart systemd-timesyncd`, `timedatectl timesync-status` |
| cron | `sudo systemctl restart cron` (il lit le fuseau au démarrage) |

Objectif vérifié sur l'état : fuseau Europe/Paris, horloge synchronisée
par timesyncd, activé au démarrage, cron redémarré après le changement de
fuseau. Pièges prévus : `date -s` à la main (l'horloge redérive), un fuseau
mal écrit, `set-time` avec NTP actif, timesyncd démarré sans être activé,
cron pas redémarré.

### Chapitre 5 — La sonde (fait)

Après quatre nuits à réparer après coup, Zoé veut être prévenue avant que
ça casse. Sa sonde (`/usr/local/bin/sonde`) lance des plugins de
supervision et envoie par courrier ce qui n'est pas OK ; elle ne regarde
que le disque système, et rien ne la lance. Puis Zoé organise un exercice :
la nuit suivante, deux pannes (le relais qui tombe à 1 h 10, un import qui
épuise les inodes de `/srv/radio` à partir de 1 h 40).

| Étape | Commande apprise |
|---|---|
| Les plugins | `/usr/lib/nagios/plugins/check_disk -w 20% -c 10% -W 20% -K 10% -p /srv/radio`, `check_http -H localhost -p 8000 -u /direct`, `check_procs -C flux -c 1:` (hors du PATH) |
| L'alerte | `… \| grep -v " OK" \| mail -E -s Alerte-radio root`, `/etc/aliases`, `/var/mail/zoe` |
| Planifier | `sonde.service` (`Type=oneshot`) et `sonde.timer` (`OnCalendar=*:0/5`, `WantedBy=timers.target`), `systemd-analyze calendar`, `systemctl daemon-reload`, `enable --now`, `list-timers` (ou une ligne de crontab) |
| Vérifier | la nuit d'exercice, `journalctl -u sonde` |

Objectif vérifié sur l'état, après la nuit simulée (qui se rejoue à chaque
changement de la sonde ou de sa planification) : le relais tombé a donné
une alerte en moins de 15 minutes, les inodes avant d'être épuisés, et
aucune alerte n'est partie quand tout allait bien. Pièges prévus : les
plugins appelés sans leur chemin, `OnUnitActiveSec=` seul (ne part
jamais), un timer modifié sans `daemon-reload`, un seuil trop serré
(fausses alertes), une sonde qui ne regarde pas les inodes ni le direct.

### Chapitre 6 — Le post-mortem (fait)

Dimanche nuit, Théo était d'astreinte : le direct a coupé 45 minutes. Ses
notes sont approximatives ; les faits sont dans les journaux. La mise à
jour automatique (unattended-upgrades, needrestart) a relancé le relais à
2 h 13, qui n'a pas pu repartir : une option inconnue attendait dans
`flux.conf` depuis le 20 août, jamais appliquée.

| Étape | Commande apprise |
|---|---|
| Les faits | `journalctl --since "2027-09-12 02:00" --until "…"`, `last`, `/var/log/apt/history.log`, `/var/log/unattended-upgrades/`, `/var/mail/theo` |
| L'origine | `journalctl \| grep flux.conf` (la commande `sudo nano` du 20 août) |
| Écrire | `nano postmortem.md` : résumé, chronologie, impact, causes, ce qui a marché, actions |

Objectif vérifié sur l'état du fichier : plus de « (à compléter) », la
chronologie avec 2 h 13, 2 h 15 et 2 h 58, l'impact (45 minutes), le
déclencheur et la cause (`flux.conf`, depuis le 20 août), au moins deux
actions, et aucun mot qui cherche un coupable (liste dans le fichier de
textes). Zoé relit à chaque enregistrement et dit ce qui manque.

## Idées pour la suite

- Le Paquet perdu, chapitre 2 : le réseau local (`ip a`, adresses privées,
  NAT), en lien avec « La box ».

## Pour ajouter un chapitre

1. Créer `src/scripts/terminus/chapitres/mon-chapitre.ts` qui exporte un
   `Chapitre` (voir `monde.ts`) : commandes connues, monde (`d()` pour un
   lieu, `f()` pour un objet), événements (condition → message, une seule
   fois) et l'événement final.
   Si l'histoire a besoin de processus, d'un réseau ou de dépôts git, les
   décrire dans `etat()` (voir l'en-tête de chaque fichier de `commandes/`).
2. L'ajouter à une histoire de `HISTOIRES` dans `chapitres/index.ts` (ou
   créer une nouvelle histoire).
3. Vérifier qu'on peut le finir : une partie complète jouée par un script
   (le moteur se compile avec esbuild pour Node), puis dans Chromium à 1000
   et 375 px.

## Histoire 11 : La Maison des associations (quatre chapitres)

La Maison des associations du quartier (machine `maison`, 192.0.2.19) :
une passerelle, seule visible depuis internet, et derrière elle un réseau
interne (`wiki`, 10.20.0.11, et `archives`, 10.20.0.12). Yasmine, la
coordinatrice, confie l'informatique à la joueuse ou au joueur ; Gaspard,
l'ancien bénévole, a déménagé. Ici, ssh fonctionne pour de vrai (`acces.ts`) :
pas de clé donnée par le jeu. Phase 2 de la feuille de route.

### Chapitre 1 — Les clés (fait)

Un compte tout neuf, avec un mot de passe provisoire (`lilas-2027`).

| Étape | Commande apprise |
|---|---|
| Créer sa paire | `ssh-keygen` (sur le poste), phrase de passe facultative |
| La poser | `ssh-copy-id maison` (mot de passe une dernière fois), ou `~/.ssh/authorized_keys` à la main |
| Fermer | `PasswordAuthentication no` dans `sshd_config` (ou un fichier de `sshd_config.d`), `sshd -t`, `systemctl reload ssh` |
| Vérifier | `exit`, `ssh maison` : entrée par la clé |

Objectif vérifié sur l'état : sshd applique `PasswordAuthentication no`,
une clé à soi est autorisée, et une connexion par clé a eu lieu après ce
chargement. Pièges prévus : `ssh-copy-id` avant `ssh-keygen` (il pose la
clé du royaume, la plus récente de `~/.ssh`, que ssh ne proposera pas),
fermer la porte avant d'avoir posé sa clé (le menu sert de console de
secours).

### Chapitre 2 — Le rebond (fait)

Le wiki n'est joignable que depuis la passerelle ; Gaspard y laissait sa
clé privée.

| Étape | Commande apprise |
|---|---|
| Rebondir | `ssh -J maison wiki` (la clé d'hôte du wiki est vérifiée depuis le poste) |
| Le raccourci | `Host wiki`, `HostName wiki`, `ProxyJump maison` dans `~/.ssh/config` du poste ; `ssh -G wiki` |
| Où suis-je ? | `hostname`, l'invite |

Objectif vérifié sur l'état : une connexion par clé au wiki, un bloc
`Host` du poste qui y mène par maison (vérifié comme ssh le lirait), et
aucune clé privée sur maison. Pièges prévus : `ssh wiki` depuis le poste
(nom inconnu), depuis maison (« Permission denied »), une clé privée
recopiée sur maison (`scp`).

### Chapitre 3 — Le tunnel (fait)

La page d'administration du wiki n'écoute que sur 127.0.0.1:8080 du wiki,
qui n'a ni navigateur ni curl ; trois inscriptions attendent.

| Étape | Commande apprise |
|---|---|
| Comprendre | `ss -tln`, `systemctl status wiki-admin` (sur le wiki) |
| Le tunnel | `ssh -f -N -L 8080:localhost:8080 wiki` |
| Agir | `curl localhost:8080/admin`, `/admin/valider/samir`, `/admin/valider/lea` |
| Refermer | `ps`, `kill` |

Objectif vérifié sur l'état : Samir et Léa validé·es, le compte
publicitaire non, plus aucun tunnel ouvert sur le poste. Pièges prévus :
`-L 8080:localhost:8080 maison` (localhost vu de maison),
`-L 8080:wiki:8080 maison` (le service n'écoute pas sur l'adresse du wiki),
`-N` sans `-f`, valider la publicité (on peut la refuser ensuite).

### Chapitre 4 — Les transferts (fait)

Avant l'assemblée générale : le rapport d'activité à rapatrier, la
sauvegarde du dossier partagé à refaire.

| Étape | Commande apprise |
|---|---|
| Rapatrier | `scp wiki:/srv/wiki/exports/rapport-2027.pdf .` (depuis le poste, par le raccourci) |
| Sauvegarder | depuis maison, avec la clé dédiée `id_sauvegarde` : `rsync -avn /srv/partage/ archives:/srv/sauvegardes/partage/`, puis sans `-n` |
| Réparer | `rsync -av --delete …` (après un essai `-n`) |

Objectif vérifié sur l'état : le rapport intact sur le poste, chaque
fichier du dossier partagé identique sur archives, sans dossier copié en
trop. Pièges prévus : la barre oblique finale oubliée (un dossier
`partage/partage`), `--delete` sans essai à blanc. Le débrief parle de FTP
et telnet, qui font passer les mots de passe en clair.

## Histoire 12 : La Coopérative (cinq chapitres)

L'épicerie coopérative du quartier (machine `cooperative`, 192.0.2.20) :
la caisse (un service), l'équipe caisse (Lina, Karim), un compte de
déploiement partagé (`deploy`). Awa, la coordinatrice, confie le serveur à
la joueuse ou au joueur quand Marc, qui le tenait, s'en va. Les trous de
la feuille de route : comptes, sudoers, droits partagés, un secret exposé
par nginx, `X-Forwarded-For`, `apt upgrade` et tmux.

### Chapitre 1 — Le départ (fait)

| Étape | Commande apprise |
|---|---|
| Voir | `who`, `ps -u marc`, `sudo crontab -l -u marc`, `/home/deploy/.ssh/authorized_keys` |
| Fermer | `usermod -e 1` (ou `chage -E 0`, `usermod -s /usr/sbin/nologin`, `userdel`) ; `usermod -L` seul ne suffit pas |
| Retirer | sa ligne dans `authorized_keys` de `deploy`, `gpasswd -d marc sudo`, `pkill -u marc` |
| Garder | le script de sauvegarde hors de `/home/marc`, dans la crontab de root (ou `/etc/cron.d`) |

Objectif vérifié sur l'état : marc ne peut plus entrer (compte expiré,
sans shell ou supprimé, ou mot de passe verrouillé et plus de clé), sa clé
n'est plus dans `deploy` (les deux autres y sont), plus de sudo ni de
processus, et la sauvegarde tourne sous root ou deploy. Pièges prévus :
`usermod -L` seul (la clé passe), vider tout `authorized_keys` de deploy,
`userdel -r` avant d'avoir repris le script (la sauvegarde d'hier le
contient), la tâche dans sa propre crontab.

### Chapitre 2 — Les droits partagés (fait)

| Étape | Commande apprise |
|---|---|
| Le dossier | `chgrp -R caisse`, `chmod -R g+w`, `chmod g+s` (ou `2775`), `ls -ld` |
| Le masque | `umask`, `umask 002` dans `~/.profile` de Lina et Karim (ou `/etc/profile.d`) |
| sudo | `which systemctl`, `sudo visudo -f /etc/sudoers.d/caisse` : `%caisse ALL=(root) /usr/bin/systemctl restart caisse`, `sudo -l -U lina`, `visudo -c` |

Objectif vérifié sur l'état : le dossier (groupe caisse, écriture du
groupe, setgid), les fichiers existants, le masque des deux comptes, et ce
que la politique de sudo permet (relancer la caisse) et refuse (un shell,
arrêter ssh), sans erreur. Pièges prévus : une commande sans chemin
(visudo refuse et demande « Et maintenant ? »), un fichier `caisse.conf`
(ignoré), une règle `ALL`, `systemctl` sans arguments, une faute écrite
avec nano (sudo refuse tout).

### Chapitre 3 — Le secret (fait)

La clé de paiement traîne sur internet : le site est servi depuis le
dossier de l'appli (`root /srv/caisse/app`), avec son `.env` et son `.git`.

| Étape | Commande apprise |
|---|---|
| Constater | `curl http://cooperative.example/.env`, `sudo grep '\.env' /var/log/nginx/access.log` |
| Fermer | `location ~ /\. { deny all; }` (ou des droits que www-data ne peut pas lire), `nginx -t`, `reload` |
| Bloquer | `deny 203.0.113.77;` |
| Changer la clé | `.env`, puis `systemctl restart caisse` (l'appli ne relit son `.env` qu'au démarrage), `curl 127.0.0.1:3000/health` |

Objectif vérifié par des requêtes au nginx simulé : `/.env` et
`/.git/config` ne sont plus servis, `/` et `/caisse/` répondent, l'adresse
fautive reçoit 403, et l'appli a chargé la nouvelle clé. Pièges prévus :
bloquer seulement `/.env` (le jeton de `.git/config` sort encore), un
`deny all` qui ferme tout le site, la clé écrite sans relancer l'appli.

### Chapitre 4 — Le proxy (fait)

Plus personne ne peut se connecter à la caisse : un robot essaie des mots
de passe, et l'appli (Express), qui voit tout le monde en 127.0.0.1
derrière nginx, a verrouillé tout le monde.

| Étape | Commande apprise |
|---|---|
| Comprendre | comparer `/var/log/caisse/app.log` (127.0.0.1) et `access.log` (198.51.100.66) |
| nginx | `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (ou `$remote_addr`) |
| L'appli | `TRUST_PROXY=loopback` dans `.env` (ou l'adresse de nginx), `systemctl restart caisse` |

À chaque rechargement de nginx ou démarrage de l'appli, le jeu rejoue cinq
minutes de trafic (le robot, avec un faux `X-Forwarded-For` à chaque essai,
puis Lina). Objectif vérifié sur ce trafic : Lina entre, et c'est l'adresse
du robot qui est verrouillée. Pièges prévus : rien côté nginx (tout le
monde reste en 127.0.0.1), `TRUST_PROXY=true` (le robot change d'adresse à
volonté), `$http_x_forwarded_for` (nginx transmet l'en-tête du client sans
le compléter).

### Chapitre 5 — Les mises à jour (fait)

Des mois sans mise à jour ; avant l'ouverture, le wifi de la coopérative
coupe une fois, au milieu de la mise à jour.

| Étape | Commande apprise |
|---|---|
| Voir | `uname -r`, `sudo apt update`, `apt list --upgradable` |
| Mettre à jour | `tmux new -s maj`, `sudo apt upgrade` ; après la coupure : `tmux ls`, `tmux attach -t maj` (sans tmux : `sudo dpkg --configure -a`) |
| Redémarrer | `cat /var/run/reboot-required.pkgs`, `sudo reboot`, `uname -r` |
| Vérifier | `systemctl --failed`, `systemctl status caisse`, `sudo systemctl enable --now caisse` |

Objectif vérifié sur l'état : plus de mise à jour en attente, dpkg
propre, le nouveau noyau tourne, nginx et la caisse actifs, la caisse
activée au démarrage. Pièges prévus : `apt upgrade` avant `apt update`
(rien à faire), la mise à jour hors de tmux (dpkg interrompu, apt refuse
tout), oublier de redémarrer (l'ancien noyau tourne), la caisse jamais
activée (elle ne repart pas), tmux imbriqué.

## Histoire 13 : La Ruche (phase 9)

Un tiers-lieu (des bureaux d'associations, un café avec un wifi pour les
invité·es, une imprimante et des caméras). Son routeur est une Debian
(machine `ruche`, 192.0.2.21) : `eth0` vers la box du fournisseur, `eth1`
vers le commutateur. Malik, le régisseur ; l'électricien a découpé le
réseau en VLAN sur le commutateur. Phase 9 de la feuille de route.

### Chapitre 1 — Les VLAN (fait)

Le commutateur a trois VLAN (10 bureaux, 20 invité·es, 30 équipements),
port 1 en trunk 802.1Q vers le routeur ; le routeur parle encore à plat.

| Étape | Commande apprise |
|---|---|
| Voir | `ip -br a`, `ip route`, `ping`, `plan-commutateur.txt` |
| Essayer | `ip link add link eth1 name eth1.10 type vlan id 10`, `ip addr add`, `ip link set … up`, `ip -d link show` |
| Faire durer | `/etc/network/interfaces` (`auto eth1.10`, `iface eth1.10 inet static`, `address`), `ifup -a` |

Objectif vérifié sur l'état : pour chaque VLAN, une interface montée sur
`eth1` avec le bon numéro et l'adresse `.1` de son réseau, et la même
chose dans `/etc/network/interfaces`. Pièges prévus : un mauvais numéro de
VLAN (`Destination Host Unreachable`), seulement `ip` (ne tient pas au
redémarrage), un masque faux dans le fichier, `ip` sans sudo.

### Chapitre 2 — Le DHCP (fait)

dnsmasq sert encore l'ancien réseau à plat ; la nouvelle imprimante ne
sait que demander son adresse en DHCP, mais doit garder `10.10.30.10`.

| Étape | Commande apprise |
|---|---|
| Voir | `journalctl -u dnsmasq`, `/var/lib/misc/dnsmasq.leases` |
| Configurer | `/etc/dnsmasq.d/ruche` : `interface=eth1.10,…` (ou `eth1*`), une `dhcp-range` par VLAN, `dhcp-host=MAC,imprimante,10.10.30.10` |
| Appliquer | `dnsmasq --test`, `systemctl restart dnsmasq`, `ping imprimante` |

Objectif vérifié sur l'état : chaque appareil en DHCP a une adresse dans
le réseau de son VLAN, l'imprimante la sienne, et dnsmasq n'écoute pas
`eth0`. Pièges prévus : garder `interface=eth1` (n'écoute pas `eth1.10`),
aucune restriction (dnsmasq entend la box : « DHCP pirate »), une option
mal écrite (`bad option`), l'imprimante sans réservation.

### Chapitre 3 — Les zones (fait)

Les adresses sont là, mais rien ne sort : le routeur ne transmet pas les
paquets, et personne ne traduit les adresses privées. Sacha, l'ancien
bénévole, l'avait fait à la main (`notes-de-sacha.txt`) ; tout est parti au
redémarrage. Malik veut aussi des zones : les bureaux vont partout, les
invité·es seulement sur internet, les équipements nulle part (mais le NAS
enregistre les caméras).

| Étape | Commande apprise |
|---|---|
| Voir | `sysctl net.ipv4.ip_forward`, `nft list ruleset`, `conntrack -L` (`[UNREPLIED]`, l'adresse traduite), `journalctl -k` (`log prefix`) |
| Router, traduire | `sysctl -w`, une chaîne `type nat hook postrouting` avec `oifname "eth0" masquerade` |
| Filtrer | chaîne `forward` en `policy drop`, `ct state established,related accept`, puis `iifname`/`oifname` (ou `ip saddr`/`ip daddr`, ensembles `{ … }`) zone par zone |
| Faire durer | `/etc/sysctl.d/*.conf` (ou `/etc/sysctl.conf`), `sysctl --system`, `/etc/nftables.conf`, `nft -c -f`, `systemctl enable --now nftables` |

Objectif vérifié sur l'état : le trafic simulé des appareils (internet
depuis les bureaux et le wifi, l'impression, l'enregistrement des caméras ;
le téléphone d'un visiteur vers le NAS et une caméra, la caméra vers son
fabricant) passe ou est bloqué comme prévu, maintenant et avec ce que le
routeur chargerait au démarrage, sans refuser une nouvelle connexion ssh
depuis le poste d'administration. Pièges prévus : router sans traduire
(les réponses ne reviennent pas), traduire sans filtrer (la caméra sort, le
visiteur voit le NAS), `policy drop` sans `ct state` (les réponses sont
jetées), la chaîne `input` qui ferme ssh, une faute dans le fichier
(`syntax error`, le service ne démarre pas), tout à la main (perdu au
`reboot`), `nft` et `sysctl -w` sans sudo.

### Chapitre 4 — Le télétravail (fait)

Malik veut ouvrir le NAS depuis chez lui ; on lui propose « d'ouvrir le port
445 sur la box ». À la place : un VPN WireGuard sur le routeur. Le portable
de Malik a déjà ses clés (sa clé publique est dans le courriel) ; son
fichier `portable-malik.conf` attend la partie `[Peer]` (le routeur). Le
pare-feu des zones est en place, avec une chaîne `input` fermée par défaut.

| Étape | Commande apprise |
|---|---|
| Les clés | `umask 077`, `wg genkey \| tee privatekey \| wg pubkey > publickey` |
| Le routeur | `/etc/wireguard/wg0.conf` : `[Interface]` (`Address`, `ListenPort`, `PrivateKey`), `[Peer]` (`PublicKey`, `AllowedIPs = 10.10.99.2/32`) ; `wg-quick up wg0`, `wg show` (`latest handshake`) |
| Le portable | `PublicKey` du routeur, `Endpoint = ruche.example:51820`, `AllowedIPs = 10.10.10.0/24` |
| Le pare-feu | `udp dport 51820 accept` (input), `iifname "wg0" oifname "eth1.10" accept` (forward), dans `/etc/nftables.conf` |
| Faire durer | `systemctl enable --now wg-quick@wg0` |

Objectif vérifié sur l'état : le portable fait sa poignée de main et joint le
NAS, maintenant et au prochain démarrage (service activé, fichiers), ssh
reste ouvert au poste d'administration, et aucune copie de la clé privée du
routeur n'est lisible par les autres comptes. Pièges prévus : `wg genkey >
privatekey` sans `umask` (l'avertissement de wg, puis la clé lisible par
tous), la chaîne `input` qui jette l'UDP, la clé privée donnée à la place de
la clé publique, `wg-quick up` puis le service (« already exists »), une
règle tapée à la main et perdue au redémarrage, `wg show` sans sudo.

### Chapitre 5 — La DMZ (fait)

Le site de réservation des salles tourne maintenant sur place, sur un petit
serveur (`web`, 10.10.40.10) que l'électricien a mis dans un nouveau VLAN 40,
la DMZ. Inès, bénévole, voudrait que les ports 80 et 443 de l'adresse
publique y mènent ; Malik veut que le serveur, s'il est piraté, ne voie rien
d'autre.

| Étape | Commande apprise |
|---|---|
| Le VLAN | `eth1.40` dans `/etc/network/interfaces`, `ifup eth1.40`, `ping web` |
| Publier | une chaîne `type nat hook prerouting priority dstnat`, `iifname "eth0" tcp dport { 80, 443 } dnat to 10.10.40.10` |
| Laisser passer | `forward` : `iifname "eth0" oifname "eth1.40" tcp dport { 80, 443 } accept` (l'adresse après traduction), `iifname "eth1.40" oifname "eth0" accept` (les mises à jour) |
| Vérifier | `conntrack -L -s 203.0.113.77` (la réponse vient de 10.10.40.10), `/etc/nftables.conf`, `systemctl reload nftables` |

Objectif vérifié sur l'état : le trafic simulé (un visiteur d'internet vers
les ports 80, 443 et 22 de l'adresse publique, le serveur vers ses mises à
jour, le NAS et l'imprimante, les bureaux vers le serveur, et les zones du
chapitre 3) passe ou est bloqué comme prévu, maintenant et au prochain
démarrage, ssh restant ouvert au poste d'administration. Pièges prévus :
`dnat` sans règle `forward`, une règle `forward` qui attend l'adresse
publique (elle ne la voit jamais), tout publier (`dnat` sans port : ssh du
serveur visible d'internet), la DMZ qui peut ouvrir vers l'intérieur, tout à
la main (perdu au redémarrage).

