### Histoire « Les Refuges », chapitre 3 « Échecs de connexion » : une
### règle rsyslog avec une condition, l'ordre des règles, stop. La
### configuration, les chemins et les sorties des outils ne sont pas
### traduits.

chapter-ssh-alerts = Échecs de connexion
    .summary = Des robots essaient des mots de passe sur chaque refuge. L'alerte de Lou lit un seul fichier : mets-y les échecs de connexion de tous les refuges, et rien d'autre, sans casser les fichiers par refuge.

## Fichiers

ssh-alerts-message-lou =
    De :     Lou
    À :      toi
    Objet :  Une alerte pour les attaques SSH

    Bonjour,

    J'ai écrit une petite vérification, lancée par cron toutes les cinq
    minutes : elle compte les lignes de
    /var/log/remote/ssh-failures.log, et m'envoie un SMS si ça grossit
    trop vite. Quelqu'un qui essaie des mots de passe sur un refuge, en
    somme.

    Tu pourrais faire écrire à rsyslog les échecs de connexion SSH de
    tous les refuges dedans (et seulement eux) ? Les fichiers par refuge
    doivent continuer de marcher.

    Même mot de passe sudo : sommet-2028.

    Lou

## Événements

ssh-alerts-event-failures =
    « Failed password for invalid user admin… » : le message de sshd pour
    un mauvais mot de passe. Dans rsyslog, un message a des propriétés :
    $programname (sshd), $msg (le texte), $fromhost-ip… Un « if » les
    teste (man rsyslog.conf).
ssh-alerts-event-rule =
    Une règle écrit dans ssh-failures.log. rsyslog l'utilise-t-il déjà ?
    Il lit sa configuration à son démarrage (sudo rsyslogd -N1 pour
    vérifier, puis un redémarrage).
ssh-alerts-event-after-stop =
    La règle est là, rsyslog a redémarré, et ssh-failures.log reste vide :
    les règles s'appliquent dans l'ordre, et les messages des refuges
    s'arrêtent à la règle par refuge de 10-remote.conf. Une règle placée
    après ne les voit jamais. Mets la tienne avant (un fichier lu plus
    tôt : 05-…, ou dans le même bloc, avant le stop).
ssh-alerts-event-too-wide =
    ssh-failures.log reçoit plus que des échecs de connexion : le filtre
    est trop large (le programme seul prend aussi « Accepted
    publickey… »). Ajoute une condition sur le message ($msg contains
    'Failed password').
ssh-alerts-event-per-hut-broken =
    Les fichiers par refuge ne reçoivent plus rien : une règle arrête
    maintenant les messages des refuges avant eux, ou la règle par refuge
    a changé. Les deux doivent marcher.
ssh-alerts-event-end =
    ssh-failures.log rassemble les échecs de connexion de tous les
    refuges, et seulement eux ; chaque refuge garde son fichier. Lou :
    « Trois robots en même temps sur le refuge du col, et mon téléphone a
    sonné. Parfait. »

    Bravo ! Tu as terminé le chapitre « Échecs de connexion ».

    CE QUI S'EST PASSÉ
    rsyslog applique ses règles dans l'ordre, et stop arrête le parcours
    d'un message. La règle par refuge finissait par stop : une nouvelle
    règle devait venir avant elle, et tester à la fois le programme et le
    message.

    LES RÈGLES DE RSYSLOG
    - if $programname == 'sshd' and $msg contains 'Failed password' then
      /var/log/remote/ssh-failures.log
    - Les fichiers de /etc/rsyslog.d sont lus par ordre alphabétique
      (05-… avant 10-…), avant les règles de rsyslog.conf.
    - Un message peut aller dans plusieurs fichiers, jusqu'à un stop.

    BONNES PRATIQUES
    - rsyslogd -N1, puis redémarrer, puis essayer : logger -t sshd "Failed
      password for test".
    - Une alerte sur un rythme (des lignes par minute), pas sur chaque
      ligne.
    - Contre les essais de mots de passe eux-mêmes : des clés seulement,
      et fail2ban.

    DOCUMENTATION
    - Les conditions de RainerScript : https://www.rsyslog.com/doc/rainerscript/control_structures.html
    - Les propriétés : https://www.rsyslog.com/doc/configuration/properties.html
