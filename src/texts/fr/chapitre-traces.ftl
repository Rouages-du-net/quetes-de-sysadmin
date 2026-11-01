### Histoire « L'Audit », chapitre « Les traces » : une connexion de nuit
### qu'on n'attendait pas. journalctl, last, les empreintes de clés
### (ssh-keygen -l), authorized_keys et une tâche cron laissée par l'intrus.
### Les commandes, les chemins et les messages des outils (en anglais) ne se
### traduisent pas.

chapter-traces = Les traces
    .resume = Remonter la trace d'une connexion inattendue : journal, last, empreinte d'une clé, clé et tâche cron de l'intrus.

## Fichiers

traces-email-salome =
    De :     Salomé (auditrice)
    À :      toi
    Objet :  Audit du Fournil — troisième partie : les traces

    Bonjour,

    Merci pour la deuxième partie : mon balayage ne voit plus que SSH, le
    site et son port sécurisé. Il reste une chose que je n'aime pas, et ce
    n'est plus de la configuration : en lisant le journal de ssh, j'ai vu
    une connexion du compte de Nadia dans la nuit de dimanche à lundi, à
    3 h 12, depuis une adresse qu'elle ne reconnaît pas.

    Nadia me dit : « Je dormais, et ma clé n'est que sur l'ordinateur de la
    boutique. »

    Ce que j'attends :
    1. Que tu retrouves cette connexion : quand, d'où, et avec quelle clé
       (le journal garde son empreinte).
    2. Que tu retires la clé qui n'est pas celle de Nadia, sans l'enfermer
       dehors.
    3. Que tu cherches ce que la personne a pu laisser derrière elle, et
       que tu nettoies. Les tâches planifiées de Nadia sont un endroit
       classique : mais attention à ne pas effacer sa vraie sauvegarde.
    4. Que tu regardes ce qu'elle a pu LIRE : l'historique des commandes de
       Nadia (.bash_history) dit ce qui a été tapé pendant la session. Un
       secret lu est un secret à changer, pour de vrai : le nouveau doit
       marcher partout, et l'appli de commandes ne doit pas tomber.

    Note : un commentaire dans une clé (« nadia@portable ») ne prouve rien,
    n'importe qui peut écrire ce qu'il veut. Compare les empreintes.

    Salomé
    (Pour sudo, ton mot de passe est toujours : farine-2028)

## Événements

# { $adresse } : l'adresse d'où est venue la connexion
traces-event-found =
    Voilà la connexion : une session du compte « nadia » venue de
    { $adresse }, à 3 h 12, alors que Nadia se connecte d'habitude de la
    boutique (198.51.100.7), le soir. Le journal de ssh a gardé l'empreinte
    de la clé utilisée : « ED25519 SHA256:… ».

    Quelle clé de /home/nadia/.ssh/authorized_keys a cette empreinte ?
    (man ssh-keygen, option -l)
traces-event-key-identified =
    Voilà l'empreinte de chaque clé du fichier. Compare avec celle du
    journal : c'est la seconde qui a servi la nuit de la connexion, et elle
    porte pourtant le commentaire « nadia@portable ». Le commentaire n'est
    qu'une étiquette.

    Retire cette ligne (et elle seule) de authorized_keys.
traces-event-nadia-locked-out =
    Attention : la clé de Nadia n'est plus dans authorized_keys ! Elle ne
    pourrait plus se connecter. Remets sa clé (celle dont l'empreinte est
    dans les connexions du soir, depuis la boutique) : on retire la clé de
    l'intrus, pas celle de Nadia.
traces-event-key-revoked =
    Il ne reste dans authorized_keys que la clé de Nadia : la clé de l'intrus
    ne peut plus ouvrir de session.

    Mais retirer la clé, c'est fermer la porte par laquelle il est entré.
    Qu'a-t-il laissé à l'intérieur pendant ces trois minutes ? Regarde ce
    qui se lance tout seul pour le compte de Nadia (man crontab).
traces-event-cron-found =
    Deux tâches pour Nadia : sauvegarde.sh à 4 h (c'est la sienne), et une
    ligne qui, toutes les dix minutes, télécharge un programme depuis
    203.0.113.99 et l'exécute. C'est la balise de l'intrus : il peut changer
    ce que le serveur fait à distance, même sans clé.

    Retire cette ligne, et seulement elle.
traces-event-secret-seen =
    Voilà ce que la personne a tapé pendant ses trois minutes : elle a lu
    /srv/commandes/.env. À l'époque, ce fichier était lisible par tout le
    monde (« Le rapport ») : le mot de passe de la base de données est
    compromis, même si la clé et la tâche sont retirées. Fermer la porte ne
    change pas une clé qui a déjà été copiée.

    Il faut changer ce mot de passe, des deux côtés : dans PostgreSQL (man
    psql ; ALTER ROLE ... PASSWORD, depuis le compte postgres) ET dans le
    fichier .env, puis relancer l'appli. Choisis un mot de passe long (douze
    caractères au moins) et différent de l'ancien.
traces-event-password-weak =
    Le mot de passe de la base a changé, mais il est trop court : douze
    caractères au moins, et mieux vaut une phrase de passe qu'un mot. Un
    secret qui se devine se remplace aussi mal que celui qu'on a perdu.
traces-event-a-restart =
    La base et .env ont le même nouveau mot de passe, mais l'appli tourne
    encore avec l'ancien : elle lit .env quand elle démarre, pas quand le
    fichier change. Relance-la (systemctl restart commandes) puis regarde
    qu'elle reste active (systemctl status commandes).
traces-event-app-down =
    L'appli de commandes est arrêtée : au démarrage, elle a lu dans .env un
    mot de passe que la base n'accepte pas (journalctl -u commandes : « password
    authentication failed »). Les deux côtés doivent dire la même chose : le
    mot de passe du rôle commandes dans PostgreSQL, et celui de DATABASE_URL
    dans .env. Corrige celui qui diffère, puis relance l'appli.
traces-event-password =
    Le mot de passe de la base est changé de bout en bout : le rôle dans
    PostgreSQL, le fichier .env (toujours fermé aux autres comptes), et
    l'appli relancée qui s'y connecte. L'ancien, que l'intrus a lu,
    n'ouvre plus rien.
traces-event-backup-lost =
    La sauvegarde de Nadia (sauvegarde.sh, à 4 h) n'est plus planifiée :
    crontab -r efface TOUTE la crontab. Remets sa ligne :
      0 4 * * * /srv/commandes/bin/sauvegarde.sh
    et retire seulement la ligne de l'intrus.
traces-event-cron-cleaned =
    Plus de balise, et la vraie sauvegarde de Nadia est toujours là.
traces-event-end =
    La clé de l'intrus est retirée, sa tâche aussi, le mot de passe qu'il a lu
    est remplacé partout, et Nadia peut toujours entrer et sauvegarder. Salomé : « Mon rapport est complet. Je repasserai
    dans six mois pour voir si tout tient. »

    Bravo ! Tu as terminé le chapitre « Les traces », et l'histoire
    « L'Audit ».

    CE QUI S'EST PASSÉ
    Quelqu'un est entré avec une clé ajoutée au compte de Nadia (on ne sait
    pas encore comment : un accès volé, un vieux secret…), et a laissé une
    tâche cron pour revenir. Une clé dans authorized_keys est une porte
    permanente : elle survit à un changement de mot de passe. C'est pour
    cela que, dans un audit, on compare les empreintes plutôt que les
    commentaires, et qu'on cherche les « persistances » après avoir trouvé
    l'entrée.

    LA BONNE PRATIQUE
    - Lire les traces d'abord (journalctl -u ssh, last) ET GARDER UNE COPIE
      avant de nettoyer : les preuves servent à comprendre.
    - Identifier une clé par son empreinte (ssh-keygen -l -f) et la retirer
      seule. Relire authorized_keys de chaque compte, régulièrement.
    - Chercher les persistances : crontabs (sudo crontab -u compte -l,
      /etc/cron.d), timers et services systemd, ~/.bashrc, authorized_keys.
    - Considérer comme compromis tout secret lisible pendant l'intrusion : le
      fichier .env des commandes était lisible par tous cette nuit-là (« Le
      rapport »). On le change des deux côtés (la base ET le fichier), on
      relance l'appli, on vérifie qu'elle tient. Un mot de passe tapé dans
      « psql -c "ALTER ROLE ... PASSWORD '...'" » reste dans l'historique du
      shell : la méta-commande \password de psql l'évite (elle le demande sans
      l'afficher).
    - Prévenir qui de droit : l'assureur, et, si des données personnelles
      étaient concernées, l'autorité de protection des données de son pays,
      souvent sous un délai court (72 heures en Europe, d'après le RGPD).
      Par exemple : la CNIL (France), la BfDI et les autorités des Länder
      (Allemagne), l'AEPD (Espagne), l'ICO (Royaume-Uni), l'APD-GBA
      (Belgique), la CNPD (Luxembourg), le PFPDT (Suisse), le Commissariat à
      la protection de la vie privée (Canada), la FTC et les autorités des
      États (États-Unis). La liste des autorités européennes est tenue par
      le Comité européen de la protection des données (edpb.europa.eu).

    UNE AUTRE VOIE
    Pour être averti·e plus tôt : fail2ban surveille les échecs, pas les
    réussites ; une alerte sur toute connexion hors des adresses connues
    (un script lisant le journal et mail, comme dans « La sonde ») ou une
    liste d'autorisation d'adresses (AllowUsers nadia@198.51.100.7)
    auraient signalé ou bloqué cette session.

    LA DOCUMENTATION
    - ssh-keygen : https://man.openbsd.org/ssh-keygen
    - sshd (authorized_keys) : https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
    - crontab : https://man7.org/linux/man-pages/man5/crontab.5.html
    - last : https://man7.org/linux/man-pages/man1/last.1.html
    - ALTER ROLE : https://www.postgresql.org/docs/current/sql-alterrole.html
    - Notification d'une violation de données (RGPD, article 33) : https://gdpr-info.eu/art-33-gdpr/
