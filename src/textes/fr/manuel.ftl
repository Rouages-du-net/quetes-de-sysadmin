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
man-sudo = exécute une commande en tant que root, l’administrateur qui a tous les droits (superuser do). Demande TON mot de passe, pas celui de root.
    .synopsis = sudo commande
    .exemple-1 = lire un fichier réservé à root
man-systemctl = gère les services, ces programmes qui tournent en permanence (serveur web…). « reload » leur fait relire leur configuration. Seul root peut les démarrer ou les arrêter : sudo systemctl reload nginx
    .synopsis = systemctl status|start|stop|restart|reload service
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
