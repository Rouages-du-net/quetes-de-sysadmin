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
man-apt = installe et met à jour les logiciels d'une Debian, sous forme de paquets téléchargés depuis les dépôts du projet. apt update télécharge la liste des paquets disponibles : sur un serveur tout neuf, elle est vide, et apt ne trouve rien tant qu'on ne l'a pas fait. apt install installe un paquet et ceux dont il a besoin ; un paquet qui fournit un service (nginx…) le démarre et l'active aussitôt. Réservé à root.
    .synopsis = apt update ; apt install [-y] paquet... ; apt list --installed
    .exemple-1 = récupérer la liste des paquets disponibles (à faire en premier)
    .exemple-2 = installer le serveur web nginx
    .exemple-3 = les paquets déjà installés
man-bash = le shell de ta session (Bourne-Again SHell) : il lit les commandes que tu tapes. bash script lance un script, comme sh.
    .synopsis = bash script [argument...]
    .exemple-1 = lancer un script
man-certbot = demande et renouvelle les certificats HTTPS gratuits de Let's Encrypt. Pour prouver qu'on tient le site, certbot dépose un fichier « défi » que l'autorité vient chercher en HTTP : avec --webroot, dans le dossier donné par -w, qui doit être celui que le serveur web sert pour ce nom ; avec --nginx (paquet python3-certbot-nginx), c'est nginx qui le sert. Chaque certificat vaut 90 jours ; un timer systemd lance certbot renew deux fois par jour, qui renouvelle ce qui expire dans moins de 30 jours. La façon de renouveler est notée dans /etc/letsencrypt/renewal/nom.conf (réécrit à chaque renouvellement réussi). Un deploy hook est une commande lancée après chaque renouvellement réussi, par exemple pour recharger nginx ; les scripts exécutables de /etc/letsencrypt/renewal-hooks/deploy/ aussi. Réservé à root.
    .synopsis = certbot certificates ; certbot renew [--dry-run] [--webroot -w dossier] [--deploy-hook commande] ; certbot certonly --webroot -w dossier -d nom [-d nom...] ; certbot reconfigure --cert-name nom [options]
    .exemple-1 = les certificats, leurs noms et leur date d'expiration
    .exemple-2 = répétition générale : tout le renouvellement, sans rien changer
    .exemple-3 = renouveler en déposant le défi dans le dossier du site
    .exemple-4 = recharger nginx après chaque renouvellement réussi
    .exemple-5 = changer la façon de renouveler, testée sans renouveler maintenant
man-date = affiche la date et l'heure de la machine. Avec +FORMAT, les écrit à sa façon : %Y l'année, %m le mois, %d le jour, %H l'heure, %M les minutes, %S les secondes, %F pour 2027-05-17, %T pour 20:30:12. Pratique pour nommer un dossier ou une sauvegarde : date +%Y%m%d%H%M%S.
    .synopsis = date [+FORMAT]
    .exemple-1 = la date et l'heure
    .exemple-2 = un nom qui se trie dans l'ordre : année, mois, jour, heure, minutes, secondes
    .exemple-3 = la date seule, au format ISO
man-openssl = la boîte à outils de la cryptographie (TLS, certificats, clés). openssl x509 lit un certificat : ses dates (-dates), son titulaire (-subject), son émetteur (-issuer), ses noms (-ext subjectAltName) ; -checkend secondes dit s'il expire d'ici là. openssl s_client se connecte à un serveur en TLS et montre le certificat qu'il présente vraiment, et si on peut lui faire confiance (Verify return code).
    .synopsis = openssl x509 [-in fichier] -noout [-dates] [-subject] [-issuer] [-checkend secondes] ; openssl s_client -connect machine:port [-servername nom]
    .exemple-1 = les dates de validité d'un certificat
    .exemple-2 = le certificat que présente vraiment le serveur, et ses dates
    .exemple-3 = expire-t-il dans les quinze jours (1 296 000 secondes) ?
man-awk = un petit langage pour lire des lignes découpées en champs. Chaque ligne est coupée aux espaces : $1 est le premier champ, $2 le deuxième, $NF le dernier, $0 la ligne entière ; NR est le numéro de la ligne. Un programme est une suite de « motif {"{"} action {"}"} » : l'action s'applique aux lignes où le motif est vrai (sans motif : toutes ; sans action : la ligne est affichée). BEGIN s'exécute avant la première ligne, END après la dernière. Les tableaux comptent très bien : c[$1]++ puis, dans END, for (k in c) print c[k], k. Mettre le programme entre apostrophes, pour que le shell ne touche pas aux $.
    .synopsis = awk [-F séparateur] [-v variable=valeur] 'programme' [fichier...]
    .exemple-1 = le premier champ de chaque ligne (l'adresse, dans un journal web)
    .exemple-2 = les lignes dont le 9e champ (le code HTTP) vaut 502
    .exemple-3 = compter les codes HTTP
    .exemple-4 = additionner le 10e champ (les octets envoyés)
    .exemple-5 = avec un autre séparateur (les comptes de /etc/passwd)
man-cat = affiche le contenu de fichiers (concatenate : il peut en coller plusieurs bout à bout). Sans fichier, recopie ce qui arrive par un tube.
    .synopsis = cat fichier...
    .exemple-1 = afficher un fichier
man-cd = change de lieu (change directory). « cd .. » remonte d’un cran, « cd ~ » ou « cd » seul ramène à la maison, « cd / » à la racine.
    .synopsis = cd lieu
    .exemple-1 = entrer dans le lieu Port
    .exemple-2 = remonter d’un cran
    .exemple-3 = rentrer chez soi
    .exemple-4 = aller à la racine
man-chmod = change les permissions (change mode). Ex. : chmod o-w lieu retire aux autres (o) le droit d’écrire (w) ; chmod 755 lieu donne rwx au propriétaire, r-x aux autres. Seul le propriétaire (ou root) peut le faire. -R agit aussi sur tout le contenu d'un dossier.
    .synopsis = chmod [-R] droits fichier
    .option-R = agit sur le dossier et sur tout ce qu'il contient (récursif).
    .exemple-1 = retirer aux autres le droit d’écrire
    .exemple-2 = rwx pour le propriétaire, r-x pour les autres
    .exemple-3 = donner au groupe le droit d'écrire, dans tout un dossier
man-clear = efface l’écran.
    .synopsis = clear
man-cp = copie un fichier (copy). L’original reste en place. -r copie un lieu entier avec tout son contenu.
    .synopsis = cp [-r] source destination
    .option-r = copie un lieu entier, avec tout ce qu’il contient (récursif).
    .exemple-1 = faire une copie à côté
    .exemple-2 = copier ici (.) un fichier d’ailleurs
man-curl = va chercher une page web, comme un navigateur mais sans l’afficher joliment. -I ne demande que l’en-tête de la réponse (le code d’état, par exemple 200 = OK). En HTTPS (https://…), curl vérifie le certificat du serveur comme un navigateur : dates de validité, nom du site, autorité de confiance ; s’il y a un problème, il s’arrête avec une erreur 60.
    .synopsis = curl [-I] [-i] [-k] adresse
    .option-I = ne demande que l’en-tête de la réponse (HEAD).
    .option-i = montre l’en-tête de la réponse, puis la page (include).
    .option-k = ne vérifie pas le certificat (insecure) : à ne faire que pour un essai, jamais pour de vrai.
man-cut = découpe chaque ligne en champs selon le séparateur et garde le champ N (ou N,M). Ex. : cut -d " " -f 1 garde le premier mot.
    .synopsis = cut -d séparateur -f N [fichier]
man-df = place libre sur les supports (disk free) : disque, clé USB… -h écrit en K, M, G.
    .synopsis = df [-h] [lieu]
    .option-h = tailles lisibles : K, M, G.
man-dig = pose une question au DNS : « quelle est l’adresse IP de ce nom ? » (domain information groper). @serveur choisit le serveur DNS à interroger (sinon, celui de /etc/resolv.conf) ; on peut demander un autre type d’enregistrement que A (adresse IPv4) : AAAA (IPv6), CNAME (alias), MX (courrier), NS (serveurs de la zone), TXT, SOA (dont le numéro de série). +short ne garde que la réponse. Dans la réponse, le nombre avant IN est le TTL : combien de secondes un résolveur peut garder cette réponse en cache. Le drapeau aa (authoritative answer) dit qu’elle vient d’un serveur qui fait autorité pour la zone.
    .synopsis = dig [@serveur] nom [type] [+short]
    .exemple-1 = l'adresse d'un nom, demandée au résolveur habituel
    .exemple-2 = la même question, posée directement à un serveur qui fait autorité
    .exemple-3 = les serveurs DNS d'une zone
    .exemple-4 = le SOA : son numéro de série change à chaque modification
man-docker = lance des applications dans des conteneurs : chacune avec ses fichiers, isolée du reste de la machine, à partir d'une image (une application prête à l'emploi, qu'on télécharge avec pull). docker run crée et démarre un conteneur : -d en arrière-plan, --name pour le nommer, -p machine:conteneur publie un port, -v nom:/chemin y monte un volume (ou -v /dossier:/chemin un dossier de la machine), -e VARIABLE=valeur, --restart unless-stopped pour qu'il reparte avec la machine, --user uid:gid (ou -u) pour le faire tourner sous un autre compte que celui prévu par l'image : sans USER dans l'image ni --user, le conteneur tourne en root. L'uid d'un conteneur est le même que sur la machine (root dedans, c'est root sur les dossiers montés) ; un nom (--user node) doit exister dans le /etc/passwd de l'image. --read-only interdit d'écrire ailleurs que dans les volumes, --cap-drop ALL retire les privilèges spéciaux de root, --security-opt no-new-privileges empêche d'en regagner. Attention : ce qu'un conteneur écrit ailleurs que dans un volume vit dans sa propre couche, et disparaît avec lui (docker rm) ; mettre à jour une application, c'est supprimer le conteneur et en créer un neuf avec la nouvelle image. docker ps (-a) liste les conteneurs, logs montre leur journal, exec lance une commande dedans, cp copie des fichiers entre la machine et un conteneur. Il faut être root (ou dans le groupe docker, qui revient au même).
    .synopsis = docker run [-d] [--name nom] [-p port:port] [-v volume:/chemin] [-e VAR=valeur] [--restart politique] [--user uid:gid] [--read-only] [--cap-drop ALL] [--security-opt no-new-privileges] image ; docker ps [-a] ; docker logs conteneur ; docker exec [-u utilisateur] conteneur commande ; docker cp source destination ; docker stop|start|rm conteneur ; docker pull image ; docker images ; docker volume ls|create|rm ; docker inspect conteneur
    .exemple-1 = les conteneurs, même arrêtés
    .exemple-2 = le journal d'un conteneur
    .exemple-3 = ce qu'il y a dans un dossier du conteneur
    .exemple-4 = copier un dossier du conteneur vers la machine
    .exemple-5 = un conteneur en arrière-plan, son port publié, ses données dans un volume, et qui repart avec la machine
    .exemple-6 = les volumes d'un conteneur
    .exemple-7 = sous quel compte tourne le conteneur ?
    .exemple-8 = un conteneur qui ne tourne pas en root
man-docker-compose = lance plusieurs conteneurs qui vont ensemble (une appli et sa base, par exemple), décrits dans le fichier compose.yaml du dossier courant : sous services:, un bloc par service, avec image:, ports:, volumes:, environment:, depends_on: (démarrer d'abord), restart: et user: (le compte, comme docker run --user ; par exemple user: "1001:1001", entre guillemets). Compose crée un réseau pour le projet : chaque service y est joignable par son nom (db, appli). Les volumes nommés se déclarent sous volumes: en bas du fichier. ${"{"}VARIABLE{"}"} est remplacée par la valeur du fichier .env du dossier (pratique pour garder les secrets hors du fichier). On tape docker compose (avec une espace) : c'est une sous-commande de docker.
    .synopsis = docker compose up [-d] ; docker compose down [-v] ; docker compose ps ; docker compose logs [service] ; docker compose config ; docker compose restart [service] ; docker compose exec service commande
    .exemple-1 = créer et démarrer (ou recréer) les services, en arrière-plan
    .exemple-2 = l'état des services
    .exemple-3 = le journal d'un service
    .exemple-4 = le fichier tel que Compose le comprend, variables remplacées
    .exemple-5 = tout arrêter et supprimer (avec -v, les volumes aussi : leurs données sont perdues)
man-diff = compare deux fichiers ligne à ligne, et montre ce qu'il faut changer pour passer du premier au second. En format normal, « 3c3 » veut dire : la ligne 3 du premier devient la ligne 3 du second (c pour change, d pour delete, a pour add) ; les lignes qui commencent par < viennent du premier fichier, celles par > du second. -u donne le format unifié, celui de git diff : - pour ce qui part, + pour ce qui arrive, avec trois lignes autour. Avec deux lieux, diff compare les fichiers de même nom, et -r descend dans les sous-lieux. Rien n'est affiché si les fichiers sont identiques.
    .synopsis = diff [-u] [-r] [-q] fichier1 fichier2
    .option-u = format unifié (unified) : - et +, avec trois lignes de contexte.
    .option-r = compare aussi les sous-lieux, récursivement.
    .option-q = dit seulement si les fichiers diffèrent (quiet).
    .exemple-1 = ce qui change entre deux fichiers
    .exemple-2 = la même chose, au format de git diff
    .exemple-3 = tout ce qui diffère entre deux lieux
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
      git commit -am "message"    la même chose, en préparant d'abord tous les fichiers suivis modifiés
      git rm fichier              efface un fichier et le retire du suivi
      git log [--oneline]         l'historique des commits
      git diff [ID] [fichier]     les différences (- avant, + après)
      git show [ID]               un commit et ses changements
      git restore --source=ID f   remet le fichier f tel qu'il était dans le commit ID
    Pour travailler à plusieurs, ou publier, on envoie ses commits vers un autre dépôt (un « distant ») :
      git init --bare lieu.git    crée un dépôt nu (sans copie de travail), comme sur un serveur
      git clone lieu.git          copie un dépôt (son distant s'appelle origin)
      git remote add nom lieu     déclare un distant ; git remote -v les liste
      git push nom main           envoie ses commits au distant
      git pull nom main           récupère ceux du distant
    Un dépôt nu peut réagir à un push : ses crochets (hooks/pre-receive, hooks/post-receive) sont des scripts lancés à chaque réception, s'ils sont exécutables (chmod +x). pre-receive peut refuser le push (code de retour non nul). Pour déployer, post-receive extrait les fichiers dans un lieu : git --work-tree=lieu checkout -f main.
    Un commit se désigne par le début de son identifiant (au moins 4 caractères), ou par HEAD (le dernier), HEAD~1 (l'avant-dernier)…
    .synopsis = git [--git-dir=dépôt] [--work-tree=lieu] commande
man-grep = affiche les lignes qui contiennent le motif. -i ignore les majuscules, -v garde les lignes qui ne le contiennent PAS, -c compte les lignes, -q n'affiche rien (seul compte le code de retour : réussite si le motif est trouvé, utile dans un script). Sans fichier, cherche dans ce qui arrive par un tube. « grep mot * » cherche dans tous les fichiers du lieu.
    .synopsis = grep [-i] [-v] [-c] [-q] motif [fichier...]
    .option-i = ignore la différence entre majuscules et minuscules.
    .option-v = inverse la recherche : garde les lignes qui ne contiennent PAS le motif.
    .option-c = compte les lignes trouvées au lieu de les afficher.
    .option-q = silencieux (quiet) : n'affiche rien, réussit si le motif est trouvé, échoue sinon.
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
man-ln = crée un lien (link). Avec -s, un lien symbolique : un petit fichier qui contient le chemin d'un autre, et que les commandes suivent pour lire, écrire ou entrer (ls -l le montre avec une flèche ->). Si la destination est un lieu, le lien y prend le nom de la cible. Attention : un chemin relatif est lu depuis le lieu du lien, pas depuis là où l'on est ; dans le doute, donner un chemin absolu. Effacer le lien (rm) n'efface pas le fichier visé. Sans -s, un lien physique : un deuxième nom pour le même fichier. Pour remplacer un lien qui vise un lieu (un lien « current » vers la version en ligne), il faut -f et -n : sans -n, ln entre dans le lieu visé et y crée le nouveau lien. Remplacer un lien est instantané : c'est ainsi qu'on bascule d'une version à l'autre, et qu'on revient en arrière.
    .synopsis = ln [-s] [-f] [-n] [-v] cible [lien | lieu]
    .option-s = lien symbolique (sinon : lien physique).
    .option-f = remplace le lien s'il existe déjà (force).
    .option-n = si la destination est un lien vers un lieu, la traiter comme un fichier (no-dereference) : avec -f, le lien est remplacé.
    .option-v = dit ce qui a été fait (verbose).
    .exemple-1 = activer un site nginx, à la façon de Debian
    .exemple-2 = voir les liens et ce qu'ils visent
    .exemple-3 = basculer le lien current vers une autre version, d'un coup
man-ls = liste le contenu d’un lieu (list). -a montre aussi les fichiers cachés, dont le nom commence par un point. -l (long) montre les permissions, le propriétaire et la taille ; -h écrit les tailles en K, M, G ; -n montre les numéros (uid, gid) au lieu des noms.
    .synopsis = ls [-a] [-l] [-h] [-n] [lieu]
    .option-a = montre tout (all), y compris les fichiers cachés, dont le nom commence par un point, et les lieux . et ..
    .option-l = format long : type, permissions, propriétaire, groupe, taille et nom, une entrée par ligne.
    .option-h = avec -l, écrit les tailles de façon lisible (human-readable) : 1,2K, 34M, 5G.
    .option-n = comme -l, mais avec les numéros du propriétaire (uid) et du groupe (gid) au lieu de leurs noms (numeric).
    .exemple-1 = ce qu’il y a ici
    .exemple-2 = tout, même ce qui est caché
    .exemple-3 = les permissions du lieu souvenirs
man-man = affiche le manuel d’une commande (manual). C’est le premier réflexe quand on ne sait plus comment marche une commande : sa syntaxe, ses options, des exemples. Sur un vrai Linux, la page s’ouvre en plein écran : on la parcourt avec les flèches, on cherche avec /mot et on la quitte avec q.
    .synopsis = man [-k mot] commande
    .option-k = cherche un mot dans le résumé de toutes les commandes (comme apropos), pour trouver la commande qui fait ce qu’on veut.
    .exemple-1 = le manuel de ls
    .exemple-2 = quelles commandes parlent de copier ?
    .exemple-3 = un résumé rapide, sans ouvrir le manuel
man-mkdir = crée un nouveau lieu, c’est-à-dire un dossier (make directory). -p crée aussi les lieux parents qui manquent, et ne dit rien si le lieu existe déjà.
    .synopsis = mkdir [-p] lieu
    .option-p = crée aussi les lieux parents (parents), sans erreur s'ils existent.
    .exemple-1 = créer un lieu
    .exemple-2 = créer un lieu et tous ses parents d'un coup
man-mv = déplace un fichier dans un lieu (move), ou le renomme si la destination est un nouveau nom.
    .synopsis = mv source destination
    .exemple-1 = déplacer crabe dans le lieu Seau
    .exemple-2 = renommer
    .exemple-3 = déplacer et renommer d’un coup
man-nc = netcat, le couteau suisse du réseau. Ici, pour tester si un port TCP d'une machine répond, comme le ferait n'importe qui sur internet : -z teste sans rien envoyer, -v dit le résultat. « succeeded » : le port est ouvert ; « Connection refused » : personne n'écoute (ou le pare-feu refuse) ; « timed out » : le pare-feu jette les paquets. Tester depuis une AUTRE machine montre ce que voit le monde ; depuis la machine elle-même, le pare-feu n'intervient pas.
    .synopsis = nc -zv machine port[-port]
    .exemple-1 = le port 22 (SSH) de la machine fabrique répond-il ?
    .exemple-2 = les ports de 5430 à 5435
man-nginx = le serveur web (et proxy). Ce n'est pas lui qu'on lance à la main : systemd s'en occupe (systemctl start, reload nginx). Sa configuration part de /etc/nginx/nginx.conf, qui inclut les sites de /etc/nginx/sites-enabled/ : un bloc server par site, avec listen (le port ; default_server pour le site qui répond quand aucun nom ne correspond, un seul par port), server_name (les noms du site), root (le lieu des pages) et index (la page d'accueil). Chaque directive finit par un point-virgule. Avant tout rechargement : sudo nginx -t, qui donne le fichier et la ligne de l'erreur. Plusieurs sites sur une machine (hôtes virtuels) : un bloc server par site, chacun avec son server_name. Dans un bloc location (le préfixe d'un chemin), proxy_pass passe la visite à un autre programme (reverse proxy) : avec une adresse qui finit par une barre (http://127.0.0.1:3000/), le préfixe de la location est remplacé par /, sinon le chemin est transmis tel quel. return 301 https://$host$request_uri; renvoie ailleurs. Les erreurs de service vont dans /var/log/nginx/error.log. Limiter le débit : limit_req_zone $binary_remote_addr zone=nom:10m rate=2r/s; (dans le bloc http, une clé par adresse, 2 requêtes par seconde) puis limit_req zone=nom burst=10 nodelay; là où on veut limiter : au-delà du débit, une rafale de 10 requêtes est encore servie ; au-delà, refus (503, ou le code de limit_req_status, par exemple 429). deny adresse; refuse une adresse (403). Répartir entre plusieurs exemplaires d'une appli : un bloc upstream nom {"{"} server 127.0.0.1:3001 weight=9; server 127.0.0.1:3002 weight=1; {"}"} dans le bloc http (un fichier de sites-enabled y est inclus), puis proxy_pass http://nom/; weight donne la part de chacun (ici 9 visites sur 10 pour le premier), down le met de côté, backup ne sert que si les autres ne répondent pas. Un serveur qui ne répond pas est sauté ; une page qui répond 500 arrive telle quelle au visiteur.
    .synopsis = nginx -t ; nginx -T ; nginx -v
    .option-t = vérifie la configuration (test) et s'arrête.
    .option-T = vérifie, puis affiche toute la configuration lue, fichier par fichier.
    .option-v = affiche la version.
    .exemple-1 = vérifier la configuration avant de recharger
    .exemple-2 = relire toute la configuration, include compris
    .exemple-3 = la version de nginx
man-ping = envoie de petits messages (ICMP « echo ») à une machine et mesure le temps de l’aller-retour. Ici, 4 envois par défaut (sous Linux, ping continue jusqu’à Ctrl+C). Attention : beaucoup de serveurs ne répondent pas au ping, sans être en panne pour autant.
    .synopsis = ping [-c N] machine
man-ps = liste les processus, c’est-à-dire les programmes en cours d’exécution (process status). Sans option : les tiens ; « ps aux » : ceux de tout le monde, avec la part de processeur (%CPU) et de mémoire (%MEM).
    .synopsis = ps [aux]
man-pwd = affiche le chemin complet du lieu où tu es (print working directory).
    .synopsis = pwd
man-readlink = affiche ce que vise un lien symbolique. -f donne le chemin complet, en suivant tous les liens : utile pour savoir quelle version est en ligne derrière un lien « current ».
    .synopsis = readlink [-f] lien
    .option-f = le chemin complet, tous les liens suivis (canonicalize).
    .exemple-1 = où pointe le lien
    .exemple-2 = le chemin complet, liens suivis
man-restic = sauvegarde des dossiers dans un dépôt chiffré, en instantanés (snapshots) : chaque sauvegarde garde l'état complet du moment, mais seules les données nouvelles prennent de la place (déduplication). Il faut le dépôt (-r) et son mot de passe (--password-file, sinon il le demande) : sans mot de passe, rien n'est lisible, pas même la liste. snapshots liste les instantanés ; ls, find, diff et dump regardent dedans ; restore ID --target lieu recrée les fichiers (avec leur chemin complet) sous ce lieu, --include pour n'en prendre qu'une partie ; forget retire des instantanés selon une politique (--keep-daily 7…) ou par leur ID, sans libérer de place : c'est prune qui supprime les données devenues inutiles (ou forget --prune) ; check vérifie le dépôt.
    .synopsis = restic -r dépôt [--password-file fichier] snapshots|ls ID [lieu]|find motif|diff ID ID|dump ID fichier|restore ID --target lieu [--include chemin]|backup lieu|forget [--keep-daily N --keep-weekly N --keep-monthly N] [--prune] [--dry-run]|prune|check|stats
    .exemple-1 = la liste des instantanés
    .exemple-2 = dans quels instantanés est ce fichier, avec sa taille et sa date
    .exemple-3 = ce qui a changé entre deux instantanés
    .exemple-4 = afficher un fichier tel qu'il était dans un instantané
    .exemple-5 = restaurer un seul fichier, sous /tmp/restauration
    .exemple-6 = garder 7 jours, 4 semaines, 12 mois, et rendre la place (essayer d'abord avec --dry-run)
    .exemple-7 = vérifier le dépôt
man-rndc = pilote le serveur DNS named (BIND) qui tourne. rndc reload relit les fichiers de zone (toutes, ou une seule) ; named prévient alors les serveurs secondaires (NOTIFY), qui ne recopient la zone que si son numéro de série (dans le SOA) a augmenté. Le journal de named (journalctl -u named) dit ce qui a été chargé. Réservé à root.
    .synopsis = rndc reload [zone] ; rndc status
    .exemple-1 = recharger une zone après l'avoir modifiée (et son serial augmenté)
    .exemple-2 = l'état du serveur
man-rm = efface un fichier (remove). Attention : sous Linux, il n’y a pas de corbeille, c’est définitif.
    .synopsis = rm fichier
    .exemple-1 = effacer un fichier, pour toujours
man-sh = lance un script : un fichier de commandes, une par ligne (le shell /bin/sh, dash sur Debian). Un script commence par #!/bin/sh ; rendu exécutable (chmod +x), il se lance aussi par son chemin : ./deployer.sh. Dans un script : # commente, NOM=valeur crée une variable lue par $NOM, $(commande) se remplace par ce qu'écrit la commande, set -e arrête tout à la première commande qui échoue, exit 1 termine en échec. « a && b » lance b seulement si a a réussi, « a || b » seulement s'il a échoué. Dans ce jeu, pas de if, for ni while : une commande par ligne.
    .synopsis = sh script [argument...]
    .exemple-1 = lancer un script
    .exemple-2 = lancer un script exécutable par son chemin
    .exemple-3 = le rendre exécutable
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
man-ssh-keygen = gère les clés SSH et la liste des machines connues (~/.ssh/known_hosts). Quand une machine a été réinstallée, sa clé d'hôte change et ssh refuse de s'y connecter : après avoir vérifié la nouvelle empreinte par un autre moyen (courriel, console de l'hébergeur), on retire l'ancienne clé avec -R, sous le nom exact écrit dans known_hosts. Ici, ssh-keygen ne crée pas de clés : le jeu les donne.
    .synopsis = ssh-keygen -R machine [-f fichier] ; ssh-keygen -F machine ; ssh-keygen -l -f fichier
    .option-R = retire de known_hosts toutes les clés de cette machine (l'ancien fichier est gardé en .old).
    .option-F = cherche cette machine dans known_hosts et affiche ses lignes.
    .option-l = affiche l'empreinte des clés d'un fichier (avec -f).
    .option-f = le fichier à lire ou à modifier (par défaut ~/.ssh/known_hosts).
    .exemple-1 = oublier l'ancienne clé de la machine (après avoir vérifié la nouvelle empreinte !)
    .exemple-2 = la machine est-elle dans known_hosts ?
    .exemple-3 = les empreintes de toutes les machines connues
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
man-tar = archive (tape archive) : -c crée une archive avec des fichiers et des lieux, -t liste son contenu, -x l’extrait ; -z compresse (gzip) ; -f donne le nom de l’archive. Les chemins enregistrés sont relatifs : -x les recrée là où l’on est, ou dans le lieu donné par -C. Extraite par root, une archive garde les propriétaires et les droits de ses fichiers. Ex. : tar -czf sauvegarde.tar.gz dossier
    .synopsis = tar -c|-t|-x [-z] -f archive [-C lieu] [lieux...]
    .option-c = crée une archive (create).
    .option-t = liste le contenu d’une archive.
    .option-x = extrait une archive (extract).
    .option-z = compresse ou décompresse avec gzip.
    .option-v = affiche les fichiers traités (verbose).
    .option-f = le nom de l’archive suit (file).
    .option-C = extrait dans ce lieu au lieu du lieu courant (change directory).
    .exemple-1 = archiver et compresser
    .exemple-2 = voir ce qu’il y a dedans (et vérifier qu’elle se lit jusqu’au bout)
    .exemple-3 = extraire ici
    .exemple-4 = restaurer une sauvegarde à sa place, depuis la racine
man-tee = recopie ce qui arrive par un tube à la fois à l’écran et dans un fichier (comme un raccord en T). -a ajoute à la fin au lieu d’écraser. Avec sudo, c’est root qui écrit le fichier.
    .synopsis = tee [-a] fichier
    .option-a = ajoute à la fin du fichier au lieu de l’écraser.
man-test = vérifie une condition, sans rien afficher : réussit si elle est vraie, échoue sinon. -f fichier (un fichier existe), -d lieu (un lieu existe), -e (l'un ou l'autre), -s (fichier non vide), -x (exécutable), -n texte (non vide), -z texte (vide), a = b, a != b, et pour des nombres -eq, -ne, -lt, -gt. Dans un script, on écrit souvent [ condition ] (avec des espaces autour des crochets) : c'est la même commande. Avec || exit 1, un script s'arrête si la condition est fausse.
    .synopsis = test condition ; [ condition ]
    .exemple-1 = index.html existe-t-il ?
    .exemple-2 = la même chose, avec des crochets (dans un script)
    .exemple-3 = arrêter le script si le fichier manque
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
man-chown = change le propriétaire d'un fichier (change owner), et son groupe avec propriétaire:groupe. On peut donner des noms ou des numéros (uid:gid), même un numéro qu'aucun compte de la machine ne porte. Seul root peut le faire. -R agit aussi sur tout le contenu d'un dossier.
    .synopsis = chown [-R] propriétaire[:groupe] fichier...
    .option-R = agit sur le dossier et sur tout ce qu'il contient (récursif).
    .exemple-1 = donner un fichier à malo
    .exemple-2 = propriétaire et groupe d'un coup, sur tout un dossier
    .exemple-3 = par numéros : uid 1001, gid 1001
man-groups = affiche les groupes dont fait partie un compte : son groupe principal, puis ses groupes secondaires.
    .synopsis = groups [utilisateur...]
    .exemple-1 = mes groupes
    .exemple-2 = les groupes de malo
man-host = la version courte de dig : les adresses et le courrier d'un nom, en phrases. Un deuxième argument choisit le serveur DNS à interroger.
    .synopsis = host nom [serveur]
    .exemple-1 = les adresses d'un nom
    .exemple-2 = la même question à un autre serveur
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

man-named-checkzone = vérifie un fichier de zone de BIND avant de le charger : la syntaxe, les adresses, le SOA. Affiche le numéro de série lu et OK, ou les erreurs avec le fichier et la ligne. Dans un fichier de zone, un nom qui ne finit pas par un point est relatif à la zone : www devient www.cafe.example., mais cafe.example (sans point) devient cafe.example.cafe.example. ; @ désigne la zone elle-même.
    .synopsis = named-checkzone zone fichier
    .exemple-1 = vérifier la zone avant rndc reload
man-named-checkconf = vérifie la configuration de named (BIND) : ne dit rien si elle est correcte.
    .synopsis = named-checkconf
    .exemple-1 = vérifier la configuration
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

man-rsync = copie des fichiers et des dossiers, en ne recopiant que ce qui a changé : l'outil classique des sauvegardes. -a (archive) copie tout un dossier en gardant les droits ; -v montre ce qui est copié ; -n (--dry-run) montre ce qui SERAIT fait, sans rien toucher ; --delete retire de la destination ce qui n'est plus dans la source (un miroir exact : prudence, il recopie aussi les effacements). Attention à la barre finale : « rsync -a souvenirs/ dest/ » copie le CONTENU de souvenirs dans dest, « rsync -a souvenirs dest/ » crée dest/souvenirs.
    .synopsis = rsync [-a] [-v] [-n] [--delete] source... destination
    .option-a = mode archive : récursif, en gardant droits et dates.
    .option-r = récursif : copie aussi le contenu des dossiers.
    .option-v = bavard : liste ce qui est copié (verbose).
    .option-n = essai : montre ce qui serait fait, sans rien écrire (dry run).
    .exemple-1 = sauvegarder le contenu d'un dossier dans un autre
    .exemple-2 = d'abord essayer, avec --delete : rien n'est touché
    .exemple-3 = restaurer un seul fichier depuis la sauvegarde
man-crontab = gère tes tâches planifiées : des commandes que cron lance tout seul, à heure fixe. crontab -e ouvre ta crontab dans l'éditeur ; à la fermeture, elle est vérifiée puis installée. crontab -l l'affiche, crontab -r la supprime. Une ligne = cinq champs pour l'heure, puis la commande : minute (0-59), heure (0-23), jour du mois (1-31), mois (1-12), jour de la semaine (0-7, 0 et 7 = dimanche). * veut dire « chaque », 1-5 une plage, 1,15 une liste, */10 « toutes les 10 ». Ou un raccourci : @daily (chaque nuit à minuit), @hourly, @weekly, @reboot (au démarrage). Les tâches tournent depuis ta maison ; ce qu'elles écrivent t'est envoyé par courrier.
    .synopsis = crontab -e | -l | -r | fichier
    .exemple-1 = modifier ses tâches planifiées
    .exemple-2 = les afficher
    .exemple-3 = une ligne de crontab : chaque nuit à 3 h 15

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
