### Histoire « La Fanzinothèque », chapitre « Refusé » : les scans d'un
### catalogue de fanzines ont changé de disque, et le profil AppArmor de
### php-fpm les refuse. Les lignes DENIED du noyau, le profil et son fichier
### local/, apparmor_parser -r. Les commandes, options, chemins, règles de
### profil et sorties ne se traduisent pas.

chapter-denied-upload = Refusé
    .summary = Le salon du fanzine, c'est demain, et depuis que les scans ont changé de disque le catalogue de la fanzinothèque affiche une page d'erreur et refuse tous les envois, alors que les droits des fichiers semblent bons. Trouvez qui dit non, et laissez passer l'appli sans ouvrir toute la machine.

## Fichiers

denied-upload-message-nomvula =
    De : Nomvula (coordinatrice de la Fanzinothèque)
    Vendredi 11 mars, 17 h 40

    Bonsoir, et merci d'être venu·e un vendredi soir !

    Demain, c'est notre salon du fanzine, et depuis cet après-midi le
    catalogue en ligne affiche une page d'erreur. Pire : les bénévoles qui
    scannent les nouveaux fanzines ne peuvent plus les envoyer, la page dit
    juste « Upload failed. ».

    Seul changement aujourd'hui : à 15 h, Rahim a déplacé les scans sur le
    nouveau disque (l'ancien était plein) et changé les réglages de l'appli.
    Il a vérifié avant de partir chercher les tables : /srv/scans appartient
    à www-data, comme l'ancien répertoire. Il ne comprend pas non plus.

    Bartek, qui a installé agrafeuse en 2031, a laissé des notes dans votre
    répertoire personnel. sudo marche avec votre mot de passe. Et s'il vous
    plaît : Bartek disait toujours de ne pas simplement couper la protection
    du serveur. Pas la veille du salon.

    Nomvula

denied-upload-notes-bartek =
    Notes de Bartek (agrafeuse, 2031)

    - agrafeuse : Debian 13, nginx devant, PHP 8.4 derrière (le service
      php8.4-fpm). L'appli du catalogue, zinecat, est dans
      /var/www/zinecat ; ses réglages dans config.php.
    - AppArmor est actif par défaut sur Debian. J'ai installé le paquet
      apparmor-profiles pour son profil php-fpm : php-fpm tourne confiné,
      une faille de l'appli ne livrerait pas toute la machine.
    - Le profil, c'est /etc/apparmor.d/php-fpm. Il appartient au paquet :
      je n'y touche pas. Nos propres règles sont dans
      /etc/apparmor.d/local/php-fpm.
    - sudo aa-status liste les profils chargés et les processus qu'ils
      confinent.
    - Debian 13 n'a pas de /var/log/syslog : les messages du noyau, ceux
      d'AppArmor compris, sont dans le journal (sudo journalctl -k) et dans
      sudo dmesg.
    - Les journaux de nginx : /var/log/nginx/access.log et error.log.

## Événements

denied-upload-event-denied =
    Le voilà. apparmor="DENIED" operation="open" profile="php-fpm"
    name="/srv/scans/" : le noyau a refusé à php-fpm (fsuid=33 : www-data)
    de lire le répertoire, alors que ses droits le permettent. AppArmor est
    consulté après les droits, et il décide par chemin, d'après le profil du
    programme. requested_mask="r", c'est une lecture ; operation="mknod"
    avec « c », c'est créer un fichier : un envoi. Quelles règles a le
    profil de php-fpm ? (man apparmor.d)

denied-upload-event-profile =
    Le profil de php-fpm se termine par include if exists <local/php-fpm> :
    les règles propres au site, dans un fichier qu'aucune mise à jour de
    paquet n'écrasera. Les lignes de Bartek y nomment
    /var/www/zinecat/scans, l'ancienne place.

denied-upload-event-disabled =
    Le profil de php-fpm n'est plus chargé, ou il est désactivé : le
    catalogue remarche peut-être, mais php-fpm tourne maintenant sans
    confinement, et une faille de l'appli atteindrait toute la machine.
    Réactivez-le (man aa-enforce). Attention aux processus déjà lancés : un
    profil s'attache quand un programme est exécuté.

denied-upload-event-complain =
    Le mode complain : AppArmor laisse tout passer et le note comme
    apparmor="ALLOWED". C'est fait pour observer un programme un moment, pas
    pour réparer : en mode complain, le profil ne protège rien. Remettez-le
    en mode enforce une fois la bonne règle en place.

denied-upload-event-vendor =
    /etc/apparmor.d/php-fpm appartient au paquet apparmor-profiles (un
    fichier de configuration que dpkg suit) : à la prochaine mise à jour,
    dpkg demandera s'il faut garder votre version ou prendre la nouvelle, et
    la personne suivante prendra peut-être la nouvelle. Retirez-en vos
    lignes : les règles du site vont dans le fichier que le profil inclut
    pour ça.

denied-upload-event-chmod =
    /srv/scans est maintenant modifiable par tout le monde. Les droits
    n'étaient pas le problème (www-data possède le répertoire) : AppArmor
    est consulté après eux, et il dit toujours non. Remettez les droits
    comme avant (chmod 755).

denied-upload-event-parser-local =
    local/php-fpm est un morceau de profil, pas un profil : l'analyseur ne
    peut pas le charger seul. Rechargez le profil qui l'inclut, le fichier
    de /etc/apparmor.d lui-même.

denied-upload-event-parser-error =
    L'analyseur a refusé le fichier, et le noyau a gardé le profil qu'il
    avait. Le message nomme le fichier et la ligne ; chaque règle se termine
    par une virgule, et une virgule oubliée est signalée à la ligne
    suivante.

denied-upload-event-too-open =
    Cette règle donne toute la machine à php-fpm : il pourrait maintenant
    lire /etc/shadow ou les clés de root. Un profil liste ce dont le
    programme a besoin : le répertoire des scans et son contenu, rien de
    plus.

denied-upload-event-not-reloaded =
    La règle est dans le fichier, mais le noyau a toujours l'ancien profil :
    AppArmor lit un profil quand on le charge, pas quand ses fichiers
    changent. Rechargez-le (man apparmor_parser).

denied-upload-event-read-only =
    Le catalogue relit les scans, mais les envois échouent encore : le
    profil laisse php-fpm lire /srv/scans, pas y créer de fichiers (mknod,
    requested_mask="c" : il faut w).

denied-upload-event-unconfined =
    Le profil est chargé, mais les processus de php-fpm tournent sans
    confinement : ils ont été exécutés pendant que le profil n'était pas
    chargé, et un profil s'attache quand un programme est exécuté (sudo
    aa-status le montre). Redémarrez php8.4-fpm.

denied-upload-event-fixed =
    Le noyau laisse de nouveau php-fpm entrer dans /srv/scans : le catalogue
    répond, et le dernier envoi est passé (ls -l /srv/scans). Pas besoin de
    redémarrer : un profil remplacé dans le noyau s'applique tout de suite
    aux processus qu'il confine.

denied-upload-event-end =
    Nomvula : « riso-dreams-04 est dans le catalogue, et les bénévoles
    envoient de nouveau leurs scans. Rahim dit qu'il pensera à AppArmor la
    prochaine fois qu'il déplacera quelque chose. À demain au salon ! »

    Bravo ! Vous avez terminé Refusé.

    CE QUI S'EST PASSÉ
    php-fpm tourne sous le profil AppArmor php-fpm, qui liste par leur
    chemin les fichiers qu'il peut utiliser. Les règles du site écrites par
    Bartek, dans local/php-fpm, nommaient /var/www/zinecat/scans. Quand
    Rahim a déplacé les scans dans /srv/scans, les droits Unix étaient bons,
    mais le chemin n'était plus dans le profil : le noyau a refusé, et l'a
    noté (apparmor="DENIED" … name="/srv/scans/"). Vous avez ajouté la
    nouvelle place à local/php-fpm et rechargé le profil avec
    apparmor_parser -r : les processus en cours ont eu les nouvelles règles
    tout de suite.

    BONNES PRATIQUES
    - « Permission denied » alors que les droits semblent bons : lire le
      journal du noyau (journalctl -k, dmesg ; /var/log/audit/audit.log
      quand auditd tourne) à la recherche d'apparmor="DENIED" : profile,
      operation, name et requested_mask disent qui s'est vu refuser quoi.
    - Les règles d'un site vont dans /etc/apparmor.d/local/NOM, jamais dans
      le profil du paquet : une mise à jour remplace le fichier du paquet.
    - Recharger le profil lui-même (apparmor_parser -r
      /etc/apparmor.d/NOM, ou systemctl reload apparmor), pas son morceau
      local.
    - Donner le minimum : /srv/scans/ r et /srv/scans/** rw, pas /** rw.
    - aa-disable, le mode complain laissé, chmod 777 : ils font taire le
      message, le trou reste. Et un profil réactivé n'atteint que les
      programmes exécutés après lui.
    - Quand on déplace les données d'un service, on déplace son
      confinement avec.

    UNE AUTRE FAÇON DE FAIRE
    SELinux (Red Hat, Fedora, Rocky Linux) décide par étiquettes, pas par
    chemins : un fichier est permis par son type (httpd_sys_rw_content_t),
    où qu'il soit. Là-bas, un fichier déplacé doit être réétiqueté
    (semanage fcontext, restorecon) ; avec AppArmor, son nouveau chemin doit
    être nommé dans le profil. Une étiquette suit un fichier renommé ; un
    chemin se lit plus facilement dans une règle.

    DOCUMENTATION
    - apparmor.d(5) : https://manpages.debian.org/trixie/apparmor/apparmor.d.5.en.html
    - apparmor_parser(8) : https://manpages.debian.org/trixie/apparmor/apparmor_parser.8.en.html
    - aa-status(8) : https://manpages.debian.org/trixie/apparmor/aa-status.8.en.html
    - AppArmor sur Debian : https://wiki.debian.org/AppArmor/HowToUse
    - AppArmor : https://apparmor.net

## Ce que partagent les chapitres de l'histoire : gardé ici pour se charger avec l'histoire.

zine-library-local-comment = # Règles propres au site pour php-fpm (Bartek, 2031) : le catalogue des fanzines.
zine-library-local-comment-scans = # Les scans ont déménagé sur le nouveau disque (mars 2033).
zine-library-local-readme =
    # Les ajouts et modifications propres au site pour un profil vont dans
    # un fichier de ce répertoire qui porte le nom du profil (local/php-fpm
    # pour php-fpm). Le profil l'inclut (« include if exists
    # <local/php-fpm> »), et aucune mise à jour de paquet ne l'écrase. Après
    # un changement, rechargez le profil lui-même :
    # apparmor_parser -r /etc/apparmor.d/php-fpm
zine-library-config-comment = // Où sont rangés les scans (Rahim, 11 mars : déplacés sur le nouveau disque).
zine-library-script-comment = # zine-backup : la sauvegarde nocturne du catalogue (Hinewai, 2032).
zine-library-conf-comment = # Ce que zine-backup sauvegarde (SOURCES) et où (DEST).
zine-library-cron-comment = # Toutes les nuits à 2 h 30 (Hinewai).
