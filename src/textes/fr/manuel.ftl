### Le manuel : une entrée par commande, avec son résumé (première phrase,
### reprise par la ligne NOM et par whatis), sa description et ses attributs :
###   .synopsis     comment l'écrire (les identifiants techniques ne se traduisent pas)
###   .option-X     l'explication de l'option -X
###   .exemple-N    l'explication du N-ième exemple (la commande est dans le code)
### Voir src/moteur/commandes/manuel.ts.

man-aide = liste les commandes que tu connais.
    .synopsis = aide
man-apropos = cherche un mot dans le résumé de toutes les commandes. Comme man -k.
    .synopsis = apropos mot
man-cat = affiche le contenu de fichiers (concatenate : il peut en coller plusieurs bout à bout). Sans fichier, recopie ce qui arrive par un tube.
    .synopsis = cat fichier...
    .exemple-1 = afficher un fichier
man-cd = change de lieu (change directory). « cd .. » remonte d’un cran, « cd ~ » ou « cd » seul ramène à la maison, « cd / » à la racine.
    .synopsis = cd lieu
    .exemple-1 = entrer dans le lieu Port
    .exemple-2 = remonter d’un cran
    .exemple-3 = rentrer chez soi
    .exemple-4 = aller à la racine
man-chmod = change les permissions (change mode). Ex. : chmod o-w lieu retire aux autres (o) le droit d’écrire (w) ; chmod 755 lieu donne rwx au propriétaire, r-x aux autres. Seul le propriétaire (ou root) peut le faire.
    .synopsis = chmod droits fichier
    .exemple-1 = retirer aux autres le droit d’écrire
    .exemple-2 = rwx pour le propriétaire, r-x pour les autres
man-clear = efface l’écran.
    .synopsis = clear
man-cp = copie un fichier (copy). L’original reste en place. -r copie un lieu entier avec tout son contenu.
    .synopsis = cp [-r] source destination
    .option-r = copie un lieu entier, avec tout ce qu’il contient (récursif).
    .exemple-1 = faire une copie à côté
    .exemple-2 = copier ici (.) un fichier d’ailleurs
man-curl = va chercher une page web, comme un navigateur mais sans l’afficher joliment. -I ne demande que l’en-tête de la réponse (le code d’état, par exemple 200 = OK).
    .synopsis = curl [-I] adresse
man-cut = découpe chaque ligne en champs selon le séparateur et garde le champ N (ou N,M). Ex. : cut -d " " -f 1 garde le premier mot.
    .synopsis = cut -d séparateur -f N [fichier]
man-df = place libre sur les supports (disk free) : disque, clé USB… -h écrit en K, M, G.
    .synopsis = df [-h] [lieu]
    .option-h = tailles lisibles : K, M, G.
man-dig = pose une question au DNS : « quelle est l’adresse IP de ce nom ? » (domain information groper). @serveur choisit le serveur DNS à interroger ; +short ne garde que la réponse.
    .synopsis = dig [@serveur] nom [+short]
man-du = mesure la place occupée (disk usage), lieu par lieu. -s donne seulement le total, -h écrit en K, M, G. Ex. : du -sh *
    .synopsis = du [-s] [-h] [lieu...]
    .option-h = tailles lisibles : K, M, G.
    .option-s = un seul total par lieu (summary), sans le détail.
man-echo = affiche le texte. Très utile avec > pour écrire dans un fichier : echo "bonjour" > note.txt
    .synopsis = echo texte
man-exit = quitte le shell. Dans une session ssh, ferme la connexion et ramène à la machine d'où l'on venait (ici, ton poste).
    .synopsis = exit
man-find = cherche des fichiers dans un lieu et tous ses sous-lieux. Ex. : find . -name "*.pdf" ; -type f ne garde que les fichiers, -type d que les dossiers ; -delete efface ce qui est trouvé (prudence !).
    .synopsis = find [lieu] [-name motif] [-type f|d] [-delete]
man-git =
    garde l'historique d'un dossier (un « dépôt »). Les principales commandes :
      git init                    transforme le lieu en dépôt
      git status                  ce qui a changé depuis le dernier commit
      git add fichier (ou .)      prépare un fichier pour le prochain commit
      git commit -m "message"     enregistre une photo de tous les fichiers préparés
      git log [--oneline]         l'historique des commits
      git diff [ID] [fichier]     les différences (- avant, + après)
      git show [ID]               un commit et ses changements
      git restore --source=ID f   remet le fichier f tel qu'il était dans le commit ID
    Un commit se désigne par le début de son identifiant (au moins 4 caractères), ou par HEAD (le dernier), HEAD~1 (l'avant-dernier)…
    .synopsis = git commande
man-grep = affiche les lignes qui contiennent le motif. -i ignore les majuscules, -v garde les lignes qui ne le contiennent PAS, -c compte les lignes. Sans fichier, cherche dans ce qui arrive par un tube. « grep mot * » cherche dans tous les fichiers du lieu.
    .synopsis = grep [-i] [-v] [-c] motif [fichier...]
    .option-i = ignore la différence entre majuscules et minuscules.
    .option-v = inverse la recherche : garde les lignes qui ne contiennent PAS le motif.
    .option-c = compte les lignes trouvées au lieu de les afficher.
    .exemple-1 = les lignes qui parlent de l’Effaceur
    .exemple-2 = dans tous les fichiers d’ici, majuscule ou pas
    .exemple-3 = un motif avec des espaces, entre guillemets
man-head = affiche le début d’un fichier (les 10 premières lignes, ou N).
    .synopsis = head [-n N] [fichier]
    .option-n = nombre de lignes à afficher (10 par défaut) : head -n 3 fichier.
man-kill = demande à un processus de s’arrêter (il reçoit un signal). PID est son numéro, donné par ps. kill -9 PID force l’arrêt. On ne peut arrêter que ses propres processus (ou tous, en root).
    .synopsis = kill PID
man-less = affiche un fichier page par page. Ici, les fichiers sont courts : less fait comme cat.
    .synopsis = less fichier
man-ls = liste le contenu d’un lieu (list). -a montre aussi les fichiers cachés, dont le nom commence par un point. -l (long) montre les permissions, le propriétaire et la taille ; -h écrit les tailles en K, M, G.
    .synopsis = ls [-a] [-l] [-h] [lieu]
    .option-a = montre tout (all), y compris les fichiers cachés, dont le nom commence par un point, et les lieux . et ..
    .option-l = format long : type, permissions, propriétaire, groupe, taille et nom, une entrée par ligne.
    .option-h = avec -l, écrit les tailles de façon lisible (human-readable) : 1,2K, 34M, 5G.
    .exemple-1 = ce qu’il y a ici
    .exemple-2 = tout, même ce qui est caché
    .exemple-3 = les permissions du lieu souvenirs
man-man = affiche le manuel d’une commande (manual). C’est le premier réflexe quand on ne sait plus comment marche une commande : sa syntaxe, ses options, des exemples. Sur un vrai Linux, la page s’ouvre en plein écran : on la parcourt avec les flèches, on cherche avec /mot et on la quitte avec q.
    .synopsis = man [-k mot] commande
    .option-k = cherche un mot dans le résumé de toutes les commandes (comme apropos), pour trouver la commande qui fait ce qu’on veut.
    .exemple-1 = le manuel de ls
    .exemple-2 = quelles commandes parlent de copier ?
    .exemple-3 = un résumé rapide, sans ouvrir le manuel
man-mkdir = crée un nouveau lieu, c’est-à-dire un dossier (make directory).
    .synopsis = mkdir lieu
    .exemple-1 = créer un lieu
man-mv = déplace un fichier dans un lieu (move), ou le renomme si la destination est un nouveau nom.
    .synopsis = mv source destination
    .exemple-1 = déplacer crabe dans le lieu Seau
    .exemple-2 = renommer
    .exemple-3 = déplacer et renommer d’un coup
man-ping = envoie de petits messages (ICMP « echo ») à une machine et mesure le temps de l’aller-retour. Ici, 4 envois par défaut (sous Linux, ping continue jusqu’à Ctrl+C). Attention : beaucoup de serveurs ne répondent pas au ping, sans être en panne pour autant.
    .synopsis = ping [-c N] machine
man-ps = liste les processus, c’est-à-dire les programmes en cours d’exécution (process status). Sans option : les tiens ; « ps aux » : ceux de tout le monde, avec la part de processeur (%CPU) et de mémoire (%MEM).
    .synopsis = ps [aux]
man-pwd = affiche le chemin complet du lieu où tu es (print working directory).
    .synopsis = pwd
man-rm = efface un fichier (remove). Attention : sous Linux, il n’y a pas de corbeille, c’est définitif.
    .synopsis = rm fichier
    .exemple-1 = effacer un fichier, pour toujours
man-sort = trie les lignes : par ordre alphabétique, ou -n numérique (2 avant 10), -r à l’envers.
    .synopsis = sort [-n] [-r] [fichier]
    .option-n = trie les nombres par valeur (2 avant 10).
    .option-r = trie à l’envers.
    .exemple-1 = du plus petit au plus grand
man-ssh = se connecte à une autre machine, de façon chiffrée (Secure Shell). ssh lit ~/.ssh/config pour trouver le vrai nom de la machine, l'utilisateur et la clé à utiliser, puis vérifie l'identité de la machine dans ~/.ssh/known_hosts. La première fois, il demande de confirmer son empreinte (yes). On s'authentifie avec une clé privée, qui ne doit être lisible que par soi (chmod 600). exit ferme la connexion.
    .synopsis = ssh [-i clé] [-p port] [utilisateur@]machine
    .option-i = utilise ce fichier de clé privée (identity file).
    .option-p = port à contacter (22 par défaut).
    .exemple-1 = se connecter à la machine royaume (nom défini dans ~/.ssh/config)
    .exemple-2 = la même chose sans ~/.ssh/config : utilisateur, nom complet et clé
    .exemple-3 = voir les machines que l'on connaît
man-sudo = exécute une commande en tant que root, l’administrateur qui a tous les droits (superuser do). Demande TON mot de passe, pas celui de root.
    .synopsis = sudo commande
    .exemple-1 = lire un fichier réservé à root
man-systemctl = gère les services, ces programmes qui tournent en permanence (serveur web…), à travers systemd. status montre l'état d'un service et ses derniers messages ; start, stop, restart le démarrent, l'arrêtent ou le relancent ; reload lui fait relire sa configuration. enable le fait démarrer avec la machine, disable non : start ne vaut que jusqu'au prochain redémarrage. --failed liste les services en échec. Seul root peut changer l'état d'un service.
    .synopsis = systemctl [status|start|stop|restart|reload|enable|disable|is-active|is-enabled] service ; systemctl --failed ; systemctl reboot
    .exemple-1 = l'état de nginx et ses derniers messages
    .exemple-2 = les services en échec (le premier réflexe après un redémarrage)
    .exemple-3 = relancer nginx
    .exemple-4 = démarrer nginx maintenant ET à chaque démarrage de la machine
man-tail = affiche la fin d’un fichier (les 10 dernières lignes, ou N). Pratique pour les journaux, où le plus récent est à la fin.
    .synopsis = tail [-n N] [fichier]
    .option-n = nombre de lignes à afficher (10 par défaut) : tail -n 3 fichier.
    .exemple-1 = les 5 événements les plus récents
man-tar = archive (tape archive) : -c crée une archive avec des fichiers et des lieux, -t liste son contenu, -x l’extrait ; -z compresse (gzip) ; -f donne le nom de l’archive. Ex. : tar -czf sauvegarde.tar.gz dossier
    .synopsis = tar -c|-t|-x [-z] -f archive [lieux...]
    .option-c = crée une archive (create).
    .option-t = liste le contenu d’une archive.
    .option-x = extrait une archive (extract).
    .option-z = compresse ou décompresse avec gzip.
    .option-v = affiche les fichiers traités (verbose).
    .option-f = le nom de l’archive suit (file).
    .exemple-1 = archiver et compresser
    .exemple-2 = voir ce qu’il y a dedans
    .exemple-3 = extraire
man-tee = recopie ce qui arrive par un tube à la fois à l’écran et dans un fichier (comme un raccord en T). -a ajoute à la fin au lieu d’écraser. Avec sudo, c’est root qui écrit le fichier.
    .synopsis = tee [-a] fichier
    .option-a = ajoute à la fin du fichier au lieu de l’écraser.
man-touch = crée un fichier vide (ou met à jour sa date s’il existe déjà).
    .synopsis = touch fichier
    .exemple-1 = créer un fichier vide
man-traceroute = montre le chemin des paquets, routeur par routeur (« saut » par « saut »), avec le temps de réponse de chacun. « * * * » : ce saut n’a pas répondu.
    .synopsis = traceroute machine
man-uniq = fusionne les lignes identiques qui se suivent. -c indique combien de fois chacune apparaît. On trie d’abord (sort) pour que les doublons se suivent : sort | uniq -c
    .synopsis = uniq [-c] [fichier]
    .option-c = compte combien de fois chaque ligne se répète.
    .exemple-1 = compter les répétitions, puis trier
man-wc = compte (word count) les lignes (-l), les mots (-w) et les octets (-c). Sans option : les trois.
    .synopsis = wc [-l] [-w] [-c] [fichier]
    .option-l = compte les lignes.
    .option-w = compte les mots.
    .option-c = compte les octets.
    .exemple-1 = combien de lignes contiennent « erreur » ?
man-whatis = affiche en une ligne à quoi sert une commande.
    .synopsis = whatis commande
man-whoami = affiche sous quel nom d’utilisateur tu agis (who am I).
    .synopsis = whoami

man-chgrp = change le groupe d'un fichier ou d'un dossier (change group). Le propriétaire peut choisir un groupe dont il est membre ; root peut choisir n'importe quel groupe. -R agit aussi sur tout le contenu d'un dossier.
    .synopsis = chgrp [-R] groupe fichier...
    .option-R = agit sur le dossier et sur tout ce qu'il contient (récursif).
    .exemple-1 = donner le fichier au groupe equipe-web
    .exemple-2 = un dossier entier, avec son contenu
man-chown = change le propriétaire d'un fichier (change owner), et son groupe avec propriétaire:groupe. Seul root peut le faire. -R agit aussi sur tout le contenu d'un dossier.
    .synopsis = chown [-R] propriétaire[:groupe] fichier...
    .option-R = agit sur le dossier et sur tout ce qu'il contient (récursif).
    .exemple-1 = donner un fichier à malo
    .exemple-2 = propriétaire et groupe d'un coup, sur tout un dossier
man-groups = affiche les groupes dont fait partie un compte : son groupe principal, puis ses groupes secondaires.
    .synopsis = groups [utilisateur...]
    .exemple-1 = mes groupes
    .exemple-2 = les groupes de malo
man-id = affiche l'identité d'un compte : son numéro (uid), son groupe principal (gid) et tous ses groupes. Les droits d'un fichier se décident avec ces informations.
    .synopsis = id [utilisateur]
    .exemple-1 = qui suis-je, et dans quels groupes ?
    .exemple-2 = l'identité de malo
man-usermod = modifie un compte (user modify), notamment ses groupes. -G donne la liste des groupes secondaires, séparés par des virgules : elle REMPLACE les groupes actuels. Avec -a (append), les groupes sont AJOUTÉS. Réservé à root.
    .synopsis = usermod [-a] -G groupe[,groupe...] utilisateur
    .option-a = ajoute les groupes de -G au lieu de remplacer les groupes actuels (append).
    .option-G = la liste des groupes secondaires, séparés par des virgules.
    .exemple-1 = ajouter malo au groupe adm, sans toucher à ses autres groupes
    .exemple-2 = attention : malo n'est plus que dans adm (ses autres groupes secondaires sont retirés)

man-journalctl = lit le journal de systemd, où les services écrivent leurs messages (et leurs erreurs). -u ne garde qu'un service, -n les N dernières lignes, -b le démarrage en cours, -p err les erreurs. -x ajoute des explications et -e va à la fin : journalctl -xeu nginx est la formule classique quand un service refuse de démarrer. Il faut être root, ou dans le groupe adm ou systemd-journal, pour tout lire.
    .synopsis = journalctl [-u service] [-n N] [-b] [-p priorité] [-x] [-e]
    .option-u = seulement les messages de ce service (unit).
    .option-n = seulement les N dernières lignes.
    .option-b = seulement depuis le dernier démarrage de la machine (boot).
    .option-p = seulement cette priorité et les plus graves : err, warning, info…
    .option-x = ajoute des explications aux messages connus.
    .option-e = va directement à la fin du journal.
    .exemple-1 = les messages de nginx
    .exemple-2 = la formule quand un service ne démarre pas
    .exemple-3 = les erreurs depuis le dernier démarrage
    .exemple-4 = les 20 derniers messages
man-reboot = redémarre la machine. Les services activés (systemctl enable) repartent tout seuls ; les autres restent arrêtés. Sur une connexion ssh, la session est coupée : il faut se reconnecter. Réservé à root.
    .synopsis = reboot
    .exemple-1 = redémarrer la machine

man-nano = un éditeur de texte simple, dans le terminal. On tape directement dans le fichier ; les raccourcis sont en bas de l'écran, ^ voulant dire Ctrl : ^O (Ctrl+O) écrit le fichier, ^X (Ctrl+X) quitte en proposant d'enregistrer les modifications. Pour modifier un fichier de root, on ouvre nano avec sudo. (Dans le jeu, sur mobile, les raccourcis sont aussi des boutons.)
    .synopsis = nano fichier
    .exemple-1 = écrire des notes (le fichier est créé s'il n'existe pas)
    .exemple-2 = modifier un fichier de configuration de root

man-sshd = le serveur SSH : c'est lui qui accepte (ou refuse) les connexions ssh. On ne le lance pas à la main : systemd s'en occupe (service ssh). Mais deux options servent tous les jours, avec sudo : -t vérifie la configuration et ne dit rien si elle est correcte ; -T affiche la configuration complète telle que sshd l'appliquerait, une fois tous les fichiers lus. Après une modification : sudo sshd -t, puis sudo systemctl reload ssh.
    .synopsis = sshd [-t | -T] [-f fichier]
    .option-t = vérifie la configuration (test) : ne dit rien si tout va bien, sinon donne le fichier et la ligne de l'erreur.
    .option-T = affiche la configuration effective, valeur par valeur (en minuscules).
    .option-f = lit ce fichier au lieu de /etc/ssh/sshd_config.
    .exemple-1 = vérifier la configuration avant de recharger le service
    .exemple-2 = voir la valeur vraiment appliquée de PasswordAuthentication
man-sshd_config = le fichier de configuration du serveur SSH : une option par ligne, « MotClé valeur ». Les lignes qui commencent par # sont des commentaires (souvent la valeur par défaut). Attention : pour chaque mot-clé, c'est la PREMIÈRE valeur lue qui compte, et la ligne Include lit d'autres fichiers à l'endroit où elle se trouve (sur Debian, /etc/ssh/sshd_config.d/*.conf, tout en haut). Options utiles : PermitRootLogin no (pas de connexion directe en root), PasswordAuthentication no (clés seulement), PubkeyAuthentication yes, AllowUsers (les seuls comptes admis). Les changements ne s'appliquent qu'après sudo systemctl reload ssh.
    .synopsis = /etc/ssh/sshd_config
    .exemple-1 = modifier la configuration
    .exemple-2 = les fichiers inclus, qui passent AVANT la suite du fichier principal

man-ufw = gère le pare-feu de la machine (Uncomplicated Firewall) : quelles connexions ENTRANTES sont acceptées. On fixe une politique par défaut (le plus sûr : tout refuser en entrée), puis on autorise une à une les portes utiles, par numéro de port (22/tcp), par nom de service (ssh, http) ou par profil d'application (OpenSSH, « Nginx Full »). La première règle qui correspond décide. limit accepte mais freine les connexions trop rapprochées (contre la force brute). Avant enable, autoriser SSH : sinon, plus aucune nouvelle connexion. Réservé à root.
    .synopsis = ufw status [verbose|numbered] ; ufw enable|disable ; ufw default allow|deny|reject [incoming|outgoing] ; ufw allow|deny|reject|limit RÈGLE ; ufw delete RÈGLE|NUMÉRO ; ufw app list
    .exemple-1 = l'état du pare-feu, les politiques par défaut et les règles
    .exemple-2 = autoriser SSH (profil d'application)
    .exemple-3 = autoriser SSH seulement depuis une adresse
    .exemple-4 = refuser par défaut tout ce qui entre
    .exemple-5 = activer le pare-feu (après avoir autorisé SSH !)
    .exemple-6 = supprimer une règle
man-ss = affiche les « sockets » de la machine : les ports où un programme attend des connexions, et les connexions établies (socket statistics). -t TCP, -u UDP, -l seulement ce qui écoute, -a tout, -n les numéros de port plutôt que leurs noms, -p le programme (il faut être root pour voir ceux des autres comptes). Une adresse 0.0.0.0 veut dire « sur toutes les interfaces », donc joignable depuis le réseau ; 127.0.0.1, seulement depuis la machine elle-même.
    .synopsis = ss [-t] [-u] [-l] [-a] [-n] [-p]
    .option-t = sockets TCP.
    .option-u = sockets UDP.
    .option-l = seulement les sockets en écoute (listening).
    .option-a = toutes les sockets, en écoute et établies.
    .option-n = numéros de port, sans les traduire en noms de services.
    .option-p = le programme qui utilise chaque socket.
    .exemple-1 = qui écoute, sur quelle adresse et quel port ?
    .exemple-2 = les connexions TCP établies

man-fail2ban-client = pilote fail2ban, le gardien qui lit les journaux et bannit les adresses qui échouent trop souvent à se connecter (force brute). Une « prison » (jail) surveille un service : sshd pour SSH. status donne la liste des prisons ; status sshd, les échecs et les adresses bannies ; set sshd unbanip ADRESSE lève un bannissement ; -t vérifie la configuration ; reload la recharge. Réservé à root.
    .synopsis = fail2ban-client status [prison] ; fail2ban-client set prison banip|unbanip ADRESSE ; fail2ban-client get prison bantime|findtime|maxretry|ignoreip ; fail2ban-client -t ; fail2ban-client reload
    .exemple-1 = les prisons actives
    .exemple-2 = les échecs et les adresses bannies de la prison sshd
    .exemple-3 = débannir une adresse
    .exemple-4 = vérifier la configuration
    .exemple-5 = recharger la configuration
man-jail_conf = la configuration de fail2ban. Ne modifiez pas /etc/fail2ban/jail.conf, qu'une mise à jour remplacerait : écrivez vos réglages dans /etc/fail2ban/jail.local (ou jail.d/*.local), lus APRÈS et qui l'emportent. Format : des sections ([DEFAULT] pour tout, [sshd] pour la prison SSH) et des lignes « clé = valeur ». enabled = true active une prison ; maxretry : nombre d'échecs avant le bannissement ; findtime : la fenêtre où on les compte ; bantime : la durée du bannissement (600, 10m, 1h, 1d, 1w ; -1 pour toujours) ; ignoreip : les adresses ou réseaux (CIDR, ex. 192.0.2.0/24) jamais bannis, séparés par des espaces.
    .synopsis = /etc/fail2ban/jail.local
    .exemple-1 = écrire ses réglages
    .exemple-2 = la valeur appliquée

## Mise en page du manuel et messages de man-db et des coreutils

# En-tête de chaque page, entre « LS(1) » et « LS(1) »
manuel-entete = Manuel du jeu
manuel-section-nom = NOM
manuel-section-synopsis = SYNOPSIS
manuel-section-description = DESCRIPTION
manuel-section-options = OPTIONS
manuel-section-exemples = EXEMPLES
manuel-section-voir-aussi = VOIR AUSSI
# Première ligne de « commande --help »
manuel-utilisation = Utilisation : { $synopsis }
manuel-complet = Manuel complet : man { $commande }
manuel-option-invalide =
    { $commande } : option invalide -- '{ $lettre }'
    Saisissez « { $commande } --help » pour plus d'informations.
