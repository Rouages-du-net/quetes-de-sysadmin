### Histoire « Les Jardins », chapitre « Le moindre privilège » : l'appli se
### connecte en root par le réseau, MariaDB écoute sur toutes les adresses.
### Comptes 'user'@'host', CREATE USER, GRANT, REVOKE, DROP USER,
### unix_socket, mariadb-secure-installation, bind-address, ufw. Les
### commandes, options, chemins, le SQL et les sorties ne se traduisent pas.

chapter-least-privilege = Le moindre privilège
    .summary = L'appli de réservation a déménagé sur un nouveau serveur et, pour la remettre en route, quelqu'un lui a donné les clés de tout : le compte root de la base, joignable depuis tout internet. Donnez à l'appli ce dont elle a besoin, et rien de plus.

## Fichiers

least-privilege-message-halima =
    De : Halima (présidente, association des Jardins de Greenholme)
    Mardi 20 mai, 18 h 10

    Bonjour,

    Selin, qui nous aide pour l'informatique, a scanné nos adresses depuis
    chez elle hier soir (on le lui avait demandé) et elle s'inquiète : voyez
    son rapport, je l'ai copié à côté de ce message. Lwazi a déménagé
    l'appli sur un nouveau serveur, barrow, dimanche, et avoue avoir « tout
    ouvert » pour que ça marche. Son mot est là aussi.

    Vous pourriez fermer ce qui doit l'être, sans casser le site ? Les
    membres réservent leurs parcelles d'été cette semaine.

    Halima

least-privilege-scan-selin =
    Scan des ports des adresses publiques de l'association, depuis l'extérieur (Selin)
    Lundi 19 mai 2031, 22 h 41

    Nmap scan report for 192.0.2.131
    Host is up (0.012s latency).
    Not shown: 997 filtered tcp ports (no-response)
    PORT     STATE SERVICE VERSION
    22/tcp   open  ssh     OpenSSH 10.0p2 Debian 7 (protocol 2.0)
    3306/tcp open  mysql   MariaDB 11.8.9-MariaDB-0+deb13u1
    8080/tcp closed http-proxy

    Selin : 3306, c'est la base de données. N'importe qui sur internet peut
    y essayer des mots de passe. C'est voulu ?

least-privilege-note-lwazi =
    Lwazi, dimanche 18 mai

    Désolé, j'étais pressé. Plotline tourne maintenant sur barrow
    (198.51.100.134) : shed n'existe plus. Au premier démarrage, l'appli a
    reçu « Host '198.51.100.134' is not allowed to connect to this MariaDB
    server », alors :
    - j'ai créé root@'%' avec un mot de passe et je l'ai mis dans les
      réglages de l'appli (barrow : /srv/plotline/.env) ;
    - j'ai mis bind-address = 0.0.0.0 dans 50-server.cnf « pour être sûr ».
    Ça marche. Je sais que ce n'est pas joli. On joint barrow en ssh depuis
    truelle ; sudo y marche aussi.

## Événements

least-privilege-event-scan =
    3306/tcp open, depuis chez Selin : MariaDB répond à tout internet, sur
    la liaison de bureau de truelle. Ce n'est pas encore une intrusion, mais
    chaque compte qui accepte les connexions de '%' peut être essayé depuis
    n'importe où. Qui peut se connecter, d'où, avec quels droits ? (sudo
    mariadb ; SELECT user, host, plugin FROM mysql.user ; SHOW GRANTS
    FOR …)
least-privilege-event-accounts =
    Lisez les comptes comme 'user'@'host' : un compte, c'est un nom ET
    l'adresse d'où il peut venir. root@'%', c'est root depuis n'importe où,
    avec tous les privilèges ; les comptes au nom vide sont anonymes
    (n'importe qui, n'importe quel nom) ; plotline@198.51.100.133 appartient
    à shed, qui n'existe plus ; la base test est ouverte à tous. L'appli a
    besoin de quatre sortes d'instructions sur une seule base : quel compte
    lui suffirait tout juste ?
least-privilege-event-all-on-all =
    ON *.* donne à ce compte des droits sur toutes les bases, tables
    système mysql comprises, et certains privilèges globaux lui permettent
    de lire des fichiers, de tuer des connexions ou de changer les réglages
    du serveur. Une appli piratée livre tout cela. Accordez sur plots.*
    seulement, et seulement ce que l'appli fait (man mariadb : GRANT,
    REVOKE).
least-privilege-event-any-host =
    '%' comme hôte veut dire « depuis n'importe quelle adresse » : avec
    truelle qui écoute sur internet, n'importe qui peut essayer le mot de
    passe de ce compte. L'appli vient toujours de barrow : nommez son
    adresse (ou le réseau arrière, '198.51.100.%').
least-privilege-event-app-account =
    Ce compte va à l'appli : son hôte est celui de barrow, ses droits sont
    SELECT, INSERT, UPDATE et DELETE sur plots, rien de global. Il faut
    maintenant que l'appli s'en serve : ses réglages sont sur barrow.
least-privilege-event-env-not-loaded =
    Le fichier .env indique le nouveau compte, mais l'appli se connecte
    toujours en root : elle a lu ses réglages à son démarrage et les garde
    en mémoire (voir /srv/plotline/LISEZMOI.txt).
least-privilege-event-app-denied =
    L'appli ne peut pas travailler avec ses nouveaux réglages : { $error }.
    Son journal dit la même chose (barrow : /var/log/plotline/app.log).
    Vérifiez l'hôte du compte, son mot de passe (IDENTIFIED BY) par rapport
    au .env, et ses droits (SHOW GRANTS FOR …).
least-privilege-event-app-switched =
    Plotline se connecte maintenant avec son propre compte (le journal de
    barrow le dit) et ne peut toucher qu'à plots, avec les quatre
    instructions qu'elle utilise. Plus personne n'a besoin de root@'%'.
least-privilege-event-locked-out =
    root@localhost ne peut plus entrer par la socket. Si rien d'autre n'a
    les privilèges, plus personne ne peut administrer le serveur. Debian
    garde une deuxième porte : mysql@localhost, en unix_socket, pour le
    compte mysql du système (sudo -u mysql mariadb). Remettez root :
    ALTER USER root@localhost IDENTIFIED VIA unix_socket;
least-privilege-event-sys-dropped =
    mariadb.sys n'est pas un reste : c'est un compte verrouillé qui possède
    les vues système, dont mysql.user. Sans lui, elles échouent avec « The
    user specified as a definer does not exist ». Recréez-le :
    CREATE USER 'mariadb.sys'@'localhost' ACCOUNT LOCK;
least-privilege-event-root-local =
    root ne sert plus qu'à cette machine, par unix_socket : seul le root du
    système (sudo mariadb) entre, sans mot de passe à deviner.
least-privilege-event-cleanup =
    Plus de compte anonyme, plus de base test ouverte à tous, plus de
    compte pour un serveur disparu : ce qui reste est ce qui sert.
least-privilege-event-still-open =
    MariaDB a redémarré, mais il écoute toujours sur toutes les adresses,
    et rien devant lui ne filtre : le scan de Selin trouverait encore 3306
    ouvert. Où il écoute, c'est bind-address ; qui peut joindre le port,
    c'est aussi le travail du pare-feu (ufw).
least-privilege-event-app-cut =
    L'appli ne joint plus le serveur (« Can't connect to server »). La base
    doit rester joignable depuis barrow, par le réseau arrière : 127.0.0.1,
    c'est truelle seule, et une règle de pare-feu doit laisser entrer
    barrow.
least-privilege-event-network =
    Le port 3306 est fermé depuis internet, et barrow le joint toujours par
    le réseau arrière.
least-privilege-event-end =
    Halima : « Selin a refait son scan : seul ssh répond. Et les
    réservations ne se sont pas arrêtées une seconde. Merci ! »

    Bravo ! Vous avez terminé Le moindre privilège.

    CE QUI S'EST PASSÉ
    Pour remettre l'appli en route sur son nouveau serveur, on lui avait
    donné le compte root, depuis n'importe quelle adresse, avec un mot de
    passe écrit dans un fichier, et MariaDB écoutait sur toutes les
    adresses, internet compris. Vous avez donné à l'appli un compte à elle,
    depuis barrow seulement, avec les quatre instructions dont elle a
    besoin sur sa base ; gardé root pour la machine elle-même, par la
    socket ; retiré ce qu'une vieille installation avait laissé (comptes
    anonymes, base test, compte d'un serveur disparu) ; et fermé le port à
    internet.

    BONNE PRATIQUE
    - Un compte par application, nommé avec l'adresse d'où il vient, avec
      les privilèges que ses instructions demandent sur sa base, rien
      ON *.*.
    - Sur Debian, root@localhost utilise unix_socket : le root du système
      entre sans mot de passe, et personne ne peut en deviner un. Gardez-le
      ainsi.
    - mariadb-secure-installation retire d'un coup les comptes anonymes, la
      base test et root à distance, sur un nouveau serveur.
    - N'écouter que là où sont les clients (bind-address), et filtrer devant
      (ufw) : deux verrous plutôt qu'un.
    - Un mot de passe dans un fichier reste un secret : rendez ce fichier
      lisible par l'appli seule (chmod 640, propriétaire root, groupe de
      l'appli).

    DOCUMENTATION
    - CREATE USER et les noms de comptes : https://mariadb.com/kb/en/create-user/
    - GRANT : https://mariadb.com/kb/en/grant/
    - L'authentification unix_socket : https://mariadb.com/kb/en/authentication-plugin-unix-socket/
    - mariadb-secure-installation : https://mariadb.com/kb/en/mariadb-secure-installation/
    - Configurer MariaDB pour l'accès à distance : https://mariadb.com/kb/en/configuring-mariadb-for-remote-client-access/
    - Le compte mariadb.sys : https://mariadb.com/kb/en/mariadbsys-user/
