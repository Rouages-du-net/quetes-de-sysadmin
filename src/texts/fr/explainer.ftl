### L'explication des erreurs (src/engine/explainer.ts) : une courte
### explication, proposée sous la sortie d'une commande qui a échoué, que
### le joueur ou la joueuse peut ouvrir. Elle dit ce que veut dire le
### message et où regarder (une page du manuel, une commande de diagnostic),
### jamais la réponse du chapitre.
###
### L'attribut .match de chaque explication liste les messages d'erreur
### qu'elle explique, un par ligne, tels que le jeu les affiche en français :
### * remplace n'importe quel texte, un $ final la fin de la ligne. Les
### marqueurs anglais sont toujours lus aussi (bien des outils répondent en
### anglais quelle que soit la langue) : on ne liste ici que les messages
### que le jeu affiche en français, ou on omet .match. En Fluent, une ligne
### ne peut pas commencer par [, * ou ., et il faut éviter les accolades.

explainer-button = Que veut dire cette erreur ?
explainer-label = L'erreur, expliquée :

explainer-sudo-password = sudo demande ton propre mot de passe, celui du compte avec lequel tu es connecté·e, pas celui de root. Rien ne s'affiche pendant que tu le tapes, ni étoiles ni points : c'est normal. Après trois essais ratés, sudo abandonne ; relance la commande pour qu'il le redemande.
    .match =
        Désolé, essayez de nouveau.
        saisies de mots de passe incorrectes

explainer-sudoers = sudo sait qui tu es, et sa politique dit que ton compte n'a pas le droit de lancer cette commande en root sur cette machine : c'est une règle, pas un mauvais mot de passe. Les règles sont dans /etc/sudoers et les fichiers de /etc/sudoers.d. sudo -l liste ce que tu peux lancer ; man sudoers explique comment s'écrit une règle.
    .match =
        pas autorisé à exécuter

explainer-ssh-denied = Le serveur SSH a répondu, mais il a refusé de te laisser entrer : le compte, la clé ou le mot de passe ne convenait pas. Les mots entre parenthèses sont les méthodes qu'il accepte (publickey, password). ssh -v montre chaque clé essayée et les réponses du serveur ; sur le serveur, le journal d'authentification raconte sa version.

explainer-config-test = La vérification de la configuration a trouvé une erreur et l'a refusée. Lis la ligne marquée [emerg] (ou celle avant « test failed ») : elle donne le fichier et le numéro de ligne, comme dans fichier:12. L'erreur est souvent sur cette ligne ou juste au-dessus, un point-virgule ou une accolade fermante oubliés. Si elle dit plutôt Permission denied, c'est la vérification elle-même qui demandait les droits de root.

explainer-yaml = Le fichier YAML n'a pas pu être lu. YAML est strict sur l'indentation : des espaces seulement, jamais de tabulations, et les éléments sous une clé doivent être exactement alignés. Le message donne un numéro de ligne, mais l'erreur est souvent une ou deux lignes au-dessus ; cat -A montre les tabulations sous la forme ^I.

explainer-unit-not-found = systemd ne connaît aucune unité de ce nom. Vérifie l'orthographe : c'est le nom du fichier d'unité, qui peut différer de celui du programme (apache2 et non httpd, sur Debian). systemctl list-unit-files montre les unités qu'il connaît ; un paquet non installé n'apporte aucune unité.

explainer-unit-failed = systemd a lancé le service et le programme s'est arrêté sur une erreur ; la raison n'est pas dans ce message. systemctl status montre les dernières lignes du journal du service, et journalctl -u suivi du nom de l'unité les montre toutes. Lis de bas en haut : la première vraie erreur est en général juste au-dessus des lignes qui disent que l'unité a échoué.

explainer-db-access-denied = Le serveur de base de données a répondu, et refusé ce compte. Un compte MariaDB ou MySQL, c'est un nom ET l'adresse d'où il vient ('app'@'198.51.100.134') : le même nom depuis une autre adresse est un autre compte, ou aucun (« is not allowed to connect »). « using password: NO » veut dire qu'aucun mot de passe n'a été envoyé (-p le demande) ; pour root sur Debian, sudo mariadb entre par la socket sans mot de passe. « command denied » veut dire que le compte est entré mais n'a pas ce privilège sur cette table. SELECT user, host, plugin FROM mysql.user et SHOW GRANTS FOR 'nom'@'hôte' montrent ce qui existe.

explainer-db-unreachable = Le client de la base n'a pu joindre aucun serveur. Par la socket (sans -h, ou -h localhost), le serveur ne tourne probablement pas : systemctl status mariadb, puis journalctl -u mariadb pour savoir pourquoi il s'est arrêté. Par le réseau (-h une adresse), rien n'y écoute ou un pare-feu est sur le chemin : sur le serveur, ss -tlnp montre où mariadbd écoute (bind-address dans sa configuration), et les règles du pare-feu qui peut joindre le port 3306.

explainer-db-too-many = Toutes les places de connexion du serveur de base sont prises (max_connections). Avant de monter la limite, regarde qui les tient : SHOW PROCESSLIST (en root, qui garde une place de plus) montre chaque connexion, d'où elle vient et si elle dort. Beaucoup de connexions endormies d'une même appli veulent souvent dire que l'appli ne les ferme pas ; wait_timeout décide combien de temps le serveur attend avant de les fermer lui-même.

explainer-ups-unknown = upsd a répondu, mais il ne sert aucun onduleur de ce nom. Le nom d'un onduleur est sa section dans /etc/nut/ups.conf du serveur, écrit NOM@HÔTE (localhost par défaut) : upsc -l HÔTE liste les noms que connaît ce serveur. Dans upsmon.conf, une ligne MONITOR qui nomme un onduleur inexistant ne surveille rien : upsmon ne le verra jamais passer sur batterie.

explainer-ups-denied = upsd a refusé ce compte. Chaque compte de /etc/nut/upsd.users du serveur dit ce qu'il peut faire : instcmds (les commandes instantanées pour upscmd, ou ALL), actions = SET (pour changer des variables avec upsrw), upsmon primary ou secondary (pour upsmon). Un nom de compte ou un mot de passe faux donne la même réponse. upsd relit upsd.users quand on le recharge (systemctl reload nut-server).

explainer-ups-driver = upsd connaît cet onduleur, mais son pilote ne tourne pas, ou a perdu l'onduleur : upsd n'a aucune donnée à donner. Le pilote est un service à part sur Debian (systemctl status nut-driver@NOM, journalctl -u nut-driver@NOM), démarré depuis la section de l'onduleur dans /etc/nut/ups.conf ; vérifie aussi le câble USB.

explainer-db-syntax = Le serveur de base n'a pas pu lire l'instruction SQL. Le texte après « near » est l'endroit où il a cessé de comprendre : l'erreur est juste avant, souvent une virgule ou un guillemet oublié, un mot mal écrit, ou une instruction que ce serveur ne connaît pas. Une instruction tapée dans le shell entre guillemets doubles garde ses apostrophes intactes : mariadb -e "SELECT … WHERE name = 'x'".

explainer-db-read-only = Le serveur de base est en lecture seule (sa variable read_only est active) : il refuse les écritures des comptes ordinaires. Sur un réplica, c'est voulu : les écritures vont au primaire, et le réplica les reçoit. SELECT @@read_only montre le réglage ; connecte-toi au primaire pour écrire.

explainer-sieve-compile = Le script Sieve n'a pas pu être compilé : il ne peut donc pas tourner. Le message donne la ligne et le premier problème seulement : une commande inconnue est souvent une faute de frappe, ou une extension utilisée sans être demandée en tête (require ["fileinto", "vacation"];) ; « expected end of command ';' » veut dire qu'il manque un point-virgule au bout de la ligne d'avant. Corrige, puis compile de nouveau avec sievec avant d'activer le script.

explainer-dovecot-config = Dovecot n'arrive pas à lire sa configuration : le fichier et la ligne sont dans le message. « Unknown setting » est un réglage mal écrit (ou d'une autre version de Dovecot : la 2.4 en a renommé beaucoup), « Missing '{"}"}' » une section restée ouverte. Tant que le fichier est faux, doveadm et doveconf s'arrêtent, et un reload garde l'ancienne configuration. doveconf -n la relit une fois corrigée.

explainer-mail-unknown-user = Cet utilisateur n'est pas dans la base d'utilisateurs (userdb) de Dovecot. Les utilisateurs de Dovecot sont ce que renvoie sa userdb (ici un passwd-file), pas les comptes de la machine, et le nom est en général l'adresse entière : utilisateur@domaine. doveadm user '*' liste les utilisateurs que Dovecot connaît.

explainer-search-query = doveadm n'a pas compris la requête de recherche. Chaque clé prend sa valeur juste après elle (mailbox Trash, savedbefore 2031-01-01, larger 5M) ; une date s'écrit AAAA-MM-JJ ou comme un intervalle, 30d ou 2w (il n'y a pas d'unité pour l'année) ; OR se place entre deux clés, et les parenthèses doivent être protégées du shell. man doveadm-search-query liste les clés.

explainer-refused = La machine a répondu, mais rien n'a accepté la connexion sur ce port : aucun programme n'y écoute, ou un pare-feu la rejette activement. Sur le serveur, ss -tlnp liste les ports où des programmes écoutent, et systemctl status dit si le service tourne. Vérifie aussi l'adresse et le port utilisés.

explainer-timed-out = Aucune réponse n'est revenue avant que l'outil abandonne. Les paquets ont sans doute été jetés en route, souvent par un pare-feu qui ignore au lieu de rejeter, ou la machine est éteinte, ou l'adresse est fausse. Compare avec « Connection refused », qui veut dire que la machine, elle, a répondu.

explainer-no-route = Ta machine n'a trouvé aucun chemin vers cette adresse : aucune route n'y mène, ou un routeur ou le pare-feu d'en face a répondu qu'elle est injoignable. ip route montre où ta machine envoie ses paquets ; vérifie aussi l'adresse elle-même.

explainer-resolve = Le nom n'a pas pu être traduit en adresse : c'est un problème de DNS (ou de /etc/hosts), pas un problème du serveur lui-même. Vérifie d'abord l'orthographe ; puis dig ou host montre ce que le DNS répond pour ce nom, et /etc/resolv.conf quel serveur ta machine interroge.

explainer-address-in-use = Le programme voulait écouter sur un port qu'un autre programme occupe déjà : un seul programme à la fois peut écouter sur une adresse et un port. ss -tlnp montre quel programme le tient. Deux services réglés sur le même port, ou une vieille copie qui tourne encore, en sont les causes habituelles.

explainer-read-only = Ce système de fichiers est monté en lecture seule : personne ne peut y écrire, pas même root, quels que soient les droits. mount ou findmnt montre l'option ro. Le système remonte parfois un disque en lecture seule de lui-même après des erreurs graves : dmesg et le journal méritent d'être lus d'abord.
    .match =
        Système de fichiers accessible en lecture seulement

explainer-no-space = Le support qui contient ce fichier est plein, ou il n'a plus d'inode libre (un par fichier). df -h montre l'espace libre de chaque système de fichiers et df -i ses inodes ; du aide à trouver ce qui prend la place. Un fichier supprimé qu'un programme garde ouvert garde sa place jusqu'à ce que le programme le ferme (lsof).
    .match =
        Aucun espace disponible sur le périphérique

explainer-syntax = Le shell n'a pas pu lire la ligne, donc rien n'a été lancé : un caractère qui a un sens pour lui est à un endroit où il ne va pas (un |, un ;, une parenthèse, un mot comme then ou done), ou un guillemet ou un bloc est resté ouvert. Regarde le symbole que nomme le message, et vérifie que chaque guillemet est refermé. man bash, section SHELL GRAMMAR, en donne les règles.
    .match =
        erreur de syntaxe près du symbole
        erreur de syntaxe : fin de fichier prématurée

explainer-ps-not-recognized = PowerShell (ou cmd.exe) n'a trouvé aucune cmdlet, fonction ou programme de ce nom. Vérifie l'orthographe : les cmdlets s'appellent Verbe-Nom, comme Get-Service, et un script du dossier courant se lance avec .\ devant son nom. Get-Command liste les commandes que connaît cette machine ; certaines viennent d'un module que seules certaines machines ont.

explainer-not-found = Le shell n'a trouvé aucun programme de ce nom. Vérifie l'orthographe et la casse (ls, pas LS). Le programme n'est peut-être pas installé sur cette machine, ou pas encore ouvert dans ce chapitre : aide liste les commandes dont tu disposes, et man -k cherche dans le manuel par mot-clé.
    .match =
        commande introuvable
        pas encore cette commande dans ce chapitre

explainer-access-denied = Windows a refusé l'accès : ton compte n'a pas l'autorisation sur ce fichier, ce dossier, cette clé ou ce service. Pour un partage, les autorisations du partage et les autorisations NTFS s'appliquent toutes deux, et la plus stricte l'emporte. Get-Acl (ou icacls) montre qui peut faire quoi, et whoami /groups les groupes qu'apporte ton compte.

explainer-permission = Le système a refusé : ton compte n'a pas le droit qu'il faut sur ce fichier ou ce dossier (r pour lire, w pour écrire, x pour entrer dans un dossier ou lancer un programme). ls -l montre le propriétaire, le groupe et les droits de chacun et des autres, et chaque dossier du chemin doit te laisser passer. Certains fichiers sont à root exprès : lis les droits avant de dégainer sudo.
    .match =
        Permission non accordée

explainer-not-permitted = L'opération elle-même est interdite à ton compte, quels que soient les droits : seul le propriétaire d'un fichier (ou root) peut changer ses droits ou son propriétaire, et seul root peut envoyer un signal aux processus d'un autre compte. Même root reçoit ce message sur un fichier rendu immuable : lsattr montre l'attribut i. man chmod, man kill et man chattr expliquent chaque cas.
    .match =
        Opération non permise

explainer-not-directory = Une partie du chemin donné est un fichier, pas un dossier : rien ne peut être dedans, et cd ne peut pas y entrer. ls -l les distingue : la ligne d'un dossier commence par d. Vérifie le chemin un morceau à la fois.
    .match =
        est pas un dossier
        est pas un répertoire

explainer-is-directory = La commande attendait un fichier et a reçu un dossier. ls montre ce que contient un dossier ; cat, nano et une redirection (>) ne marchent que sur des fichiers. Supprimer ou copier un dossier entier demande une option : voir man rm et man cp.
    .match =
        est un dossier
        Est un dossier

explainer-no-such-file = Rien n'existe à ce chemin, tel qu'il est écrit. Un chemin qui ne commence pas par / est relatif : il part du dossier courant, que montre pwd ; un chemin qui commence par / part de la racine. Les noms tiennent compte des majuscules (Notes n'est pas notes), et Tab ne complète qu'un nom qui existe : un bon test.
    .match =
        aucun fichier ou dossier de ce
        Aucun fichier ou dossier de ce

## Le réglage, à côté d'Astuces et de Sauvegarde auto.
display-explainer = Aide aux erreurs
display-explainer-title = Proposer une courte explication sous les messages d'erreur courants

explainer-s3-date = Le stockage objet a refusé la requête à cause de sa date. Chaque requête S3 est signée avec la date et l'heure de la machine qui l'envoie : Amazon S3 en refuse une à plus de 15 minutes de sa propre horloge (RequestTimeTooSkewed), Garage une datée de plus de 24 heures avant son horloge (« Date is too old ») ; une URL présignée est refusée une fois son X-Amz-Expires passé. Le serveur n'y est pour rien : date et timedatectl montrent l'horloge de cette machine, et si NTP la garde juste.

explainer-s3-region = La requête a été signée pour une autre région que celle du stockage. La région fait partie de la signature (sa portée : date/région/s3/aws4_request), donc une mauvaise région rend la signature invalide même avec la bonne clé. Le message donne la portée qu'attendait le serveur : mets cette région dans la configuration du client (region dans ~/.aws/config ou rclone.conf, ou --region).

explainer-s3-access-denied = Le stockage objet connaît la clé (ou a refusé une requête sans clé) et ne la laisse pas faire cela. « Operation is not allowed for this key » veut dire que la clé n'a pas le droit sur ce bucket (read pour lister et lire, write pour déposer et supprimer, owner pour les réglages du bucket) ; « No such key », un ID de clé qu'il ne connaît pas ; « Invalid signature », un mauvais secret ; « anonymous access », une requête envoyée sans clé. Avec Garage, sudo garage bucket info BUCKET montre les droits de chaque clé ; aws configure list montre quelle clé le client utilise.

explainer-s3-no-bucket = Aucun bucket ne porte ce nom sur ce stockage. Vérifie l'orthographe (les noms de buckets sont en minuscules), et que le client parle au bon point d'accès (--endpoint-url, endpoint_url dans ~/.aws/config, endpoint dans rclone.conf) : un autre stockage a d'autres buckets. aws s3 ls liste les buckets dont cette clé peut se servir ; avec Garage, sudo garage bucket list les liste tous.

explainer-s3-credentials = L'outil AWS n'a trouvé aucune clé pour signer. Il cherche sur la ligne de commande (--profile), dans l'environnement (AWS_ACCESS_KEY_ID et AWS_SECRET_ACCESS_KEY, AWS_PROFILE), puis dans ~/.aws/credentials et ~/.aws/config, dans le dossier personnel de l'utilisateur qui le lance : sous sudo, c'est celui de root, pas le tien. aws configure list montre ce qu'il a trouvé, et où.

explainer-garage-layout = Garage n'a pas appliqué le changement d'agencement. Un agencement se change en deux temps : les changements sont préparés (garage layout assign, remove), puis appliqués par garage layout apply --version N, N étant la version suivante qu'affiche garage layout show, pour que personne n'applique un agencement qu'il n'a pas lu. Un agencement doit aussi garder au moins autant de nœuds avec une capacité que le facteur de réplication.

explainer-firewalld-auth = firewall-cmd peut lire la configuration de firewalld sous n'importe quel compte, mais la changer demande root : par ssh, aucun agent polkit ne peut demander de mot de passe. Relance la commande avec sudo.

explainer-firewalld-not-running = Le démon firewalld ne tourne pas : firewall-cmd n'a personne à qui parler (et rien ne filtre). systemctl status firewalld dit pourquoi ; systemctl enable --now firewalld le démarre et le garde au démarrage.

explainer-dnf-root = Installer ou supprimer des paquets change le système : dnf demande root. Relance-le avec sudo (chercher, info et list marchent sans).

explainer-httpd-bind = httpd n'a pas pu ouvrir une socket. Avec (98) Address already in use, un autre programme écoute sur ce port (ss -tlnp). Avec (13) Permission denied et rien d'autre là, sur un système avec SELinux, httpd_t ne peut écouter que sur les ports typés http_port_t : cherche un AVC (ausearch -m avc), et donne ce type au port avec semanage port -a -t http_port_t -p tcp PORT. Tant qu'une socket échoue, httpd ne démarre pas du tout.

explainer-selinux-denied = « Permission denied » alors que les droits Unix le permettent : sur un système avec SELinux, le noyau peut refuser ce que l'étiquette du fichier n'autorise pas au domaine du programme. Compare les étiquettes (ls -Z, ps -Z), lis les refus (sudo ausearch -m avc -ts recent | audit2why), et corrige l'étiquette dans la politique (semanage fcontext, puis restorecon) plutôt que d'éteindre SELinux.
explainer-tofu-lock = OpenTofu n'a pas pu verrouiller l'état : une autre exécution tient le verrou, et OpenTofu n'attend personne. Lock Info dit qui l'a pris, pour quelle opération et quand. Avec un état local (terraform.tfstate), le verrou appartient à ce processus : regarde s'il tourne encore (ps), et laisse-le finir ou arrête-le ; tofu force-unlock ne sert qu'aux états distants, et -lock=false risque deux exécutions qui écrivent l'état en même temps.

explainer-tofu-init = Ce répertoire de travail n'est pas initialisé, ou ne correspond plus à sa configuration : le fournisseur dont il a besoin n'est pas installé ni enregistré dans .terraform.lock.hcl. tofu init installe les fournisseurs et écrit le fichier de verrouillage ; après un changement de contrainte de version, tofu init -upgrade.

explainer-tofu-variable = Une variable est déclarée (un bloc variable) mais rien ne lui donne de valeur : pas de valeur par défaut, pas de fichier .tfvars, pas de -var. Une valeur donnée avec -var ne dure que le temps de la commande ; les fichiers terraform.tfvars et *.auto.tfvars sont lus à chaque fois, tout comme les variables d'environnement TF_VAR_nom.

explainer-tofu-argument = La configuration ne correspond pas au schéma du fournisseur : un argument qu'il ne connaît pas (souvent une faute de frappe, OpenTofu propose alors le bon nom), un argument obligatoire absent, ou un bloc mal placé. Le message donne le fichier et la ligne ; tofu validate vérifie tout sans rien toucher, et la documentation du fournisseur liste les arguments de chaque ressource.
explainer-podman-subids = Podman sans root construit un espace de noms utilisateur pour le compte : dedans, 0 est le compte lui-même et 1, 2, 3… sont ses identifiants subordonnés, lus dans /etc/subuid et /etc/subgid (COMPTE:PREMIER:NOMBRE). Un compte sans plage obtient un espace d'un seul identifiant, et aucune image dont les fichiers appartiennent à d'autres identifiants ne peut s'y déballer. Regarde les deux fichiers (man subuid) ; usermod --add-subuids et --add-subgids ajoutent une plage. Podman garde l'espace de noms du compte : après avoir changé les fichiers, podman system migrate le reconstruit.

explainer-privileged-port = Un programme qui n'est pas root ne peut pas écouter sur un port inférieur à net.ipv4.ip_unprivileged_port_start (1024 par défaut) : avec Podman sans root, le programme qui publie le port (pasta, ou rootlessport) tourne sous ton compte. Publie un port à partir de 1024 et laisse 80 et 443 à un mandataire inverse (nginx, Caddy) qui transmet vers lui. Abaisser ce réglage ouvre ces ports aux programmes de tous les comptes, pas seulement du tien.

explainer-user-bus = systemctl --user (et journalctl --user) parlent au gestionnaire de services de ton propre compte par son bus, qu'ils trouvent avec $XDG_RUNTIME_DIR (/run/user/UID). Une connexion le définit (pam_systemd) ; sudo, su et cron, non. Il faut aussi que le gestionnaire tourne : il démarre avec la première session du compte, ou au démarrage de la machine si le compte persiste (loginctl enable-linger). Depuis root, systemctl --user -M COMPTE@ atteint le gestionnaire d'un autre compte.
explainer-apparmor-root = Lire ou changer la politique d'AppArmor, c'est l'affaire de root : les profils chargés dans le noyau, les processus qu'ils confinent, en charger ou en retirer un. Lancez la commande avec sudo. (Seul aa-status --enabled s'en passe.)

explainer-apparmor-parser = apparmor_parser n'a pas pu lire le profil, il n'a donc rien chargé : le noyau garde la version qu'il avait. Le message nomme le fichier et la ligne (« in profile » donne le fichier où est l'erreur, peut-être un fichier inclus) ; chaque règle se termine par une virgule, et une virgule oubliée est signalée à la ligne suivante. Un fichier de local/ ou d'abstractions/ n'est pas un profil : chargez le profil qui l'inclut. man apparmor.d donne la syntaxe ; apparmor_parser -Q vérifie un fichier sans le charger.

explainer-sops-no-key = sops n'a pas pu déchiffrer la clé de données du fichier : aucune des identités age qu'il a trouvées ne correspond aux destinataires du fichier (listés sous Group 0), ou il n'en a trouvé aucune. Il lit SOPS_AGE_KEY, SOPS_AGE_KEY_FILE et ~/.config/sops/age/keys.txt du compte qui le lance (celui de root sous sudo). Soit le fichier n'a pas été chiffré pour ta clé, soit sops ne cherche pas là où elle est : sops ne peut déchiffrer que pour un destinataire choisi au chiffrement (.sops.yaml, --age, updatekeys).

explainer-sops-mac = Le fichier a été modifié en dehors de sops : le MAC, calculé sur toutes les valeurs quand sops a écrit le fichier pour la dernière fois, ne leur correspond plus (ou l'étiquette propre à une valeur échoue). Une valeur ENC[…] modifiée à la main, une ligne supprimée ou une valeur en clair changée suffit. Reprends le fichier depuis git, et change les valeurs avec sops edit ou sops set ; --ignore-mac ne sert qu'à récupérer un fichier abîmé.

explainer-sops-no-rule = sops ne sait pas pour qui chiffrer ce nouveau fichier : pas de --age sur la ligne de commande, pas de .sops.yaml dans le répertoire courant ni au-dessus, ou aucune règle de création dont le path_regex correspond au fichier (le chemin relatif au répertoire de .sops.yaml). Lance sops depuis le dépôt, et vérifie l'expression rationnelle de la règle.

explainer-age-keygen-exists = age-keygen n'écrase jamais un fichier : perdre une clé secrète rendrait illisible tout ce qui a été chiffré pour elle. Utilise la clé déjà là (age-keygen -y FICHIER affiche sa clé publique), ou choisis exprès un autre nom de fichier. Il échoue aussi quand le répertoire du fichier n'existe pas encore (mkdir -p).
