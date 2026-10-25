### Histoire « L'Astreinte », chapitre 4 « L'horloge » : fuseau horaire,
### NTP (systemd-timesyncd), timedatectl, cron qui lit le fuseau au
### démarrage. Les commandes, options, directives et messages des outils
### ne se traduisent pas.

chapitre-horloge = L'horloge
    .resume = Lundi, 9 h 12 : la matinale ne s'est enregistrée qu'à partir de 8 h 09. Le serveur, migré ce week-end, a-t-il perdu la notion du temps ?

## Fichiers

horloge-message-de-zoe =
    Un message de Zoé (lundi, 9 h 05) :

    « La matinale (de 6 h à 9 h) ne s'est enregistrée qu'à partir de
    8 h 09 : on a perdu deux heures d'émission ! C'est la tâche cron du
    compte radio qui lance l'enregistrement (sudo crontab -u radio -l), et
    elle n'a pas changé.

    Ce qui a changé : l'hébergeur a migré le serveur sur une nouvelle
    machine ce week-end (son mail est dans mail_hebergeur.txt). Pourtant,
    le journal de l'enregistrement dit bien « 06:00 »… »
horloge-mail-hebergeur =
    De : support@hosting.example
    Objet : Migration de votre serveur radio terminée

    Bonjour,

    Votre serveur a été migré sur notre nouvelle infrastructure samedi
    soir, à partir d'une image système standard : vos données et votre
    configuration ont été recopiées.

    Rappel : depuis notre réseau, l'accès aux serveurs NTP publics est
    filtré. Utilisez notre serveur de temps : ntp.hosting.example
    (l'ancien, ntp.old-hosting.example, est arrêté).

    L'équipe support
horloge-timesyncd-conf =
    #  This file is part of systemd.
    #
    # Entries in this file show the compile time defaults. Local configuration
    # should be created by either modifying this file (or a copy of it placed in
    # /etc/ if the original file is shipped in /usr/), or by creating "drop-ins" in
    # the /etc/systemd/timesyncd.conf.d/ directory. The latter is generally
    # recommended. Defaults can be restored by simply deleting the main
    # configuration file and all drop-ins located in /etc/.
    #
    # See timesyncd.conf(5) for details.

    {"[Time]"}
    NTP=ntp.old-hosting.example
    #FallbackNTP=0.debian.pool.ntp.org 1.debian.pool.ntp.org 2.debian.pool.ntp.org 3.debian.pool.ntp.org
    #RootDistanceMaxSec=5
    #PollIntervalMinSec=32
    #PollIntervalMaxSec=2048
horloge-script-enregistrer =
    #!/bin/sh
    # enregistrer ÉMISSION DURÉE : enregistre le direct pendant DURÉE minutes.
    # L'heure du journal est celle de la machine (date).
    echo "$(date '+%F %T') $1 : début ($2 min)" >> /var/log/radio/enregistrer.log
    exec /usr/local/bin/flux-record --mount /direct --minutes "$2" --out "/srv/radio/emissions/$1-$(date +%F).ogg"
horloge-journal-enregistrer =
    2027-08-26 06:00:01 matinale : début (180 min)
    2027-08-26 23:00:01 nuit : début (240 min)
    2027-08-27 06:00:01 matinale : début (180 min)
    2027-08-27 23:00:01 nuit : début (240 min)
    2027-08-28 23:00:01 nuit : début (240 min)
    2027-08-29 23:00:01 nuit : début (240 min)
    2027-08-30 06:00:01 matinale : début (180 min)

## Événements

horloge-evenement-utc =
    UTC : la machine vit à l'heure du méridien de Greenwich, pas à celle
    de Paris (deux heures de plus en été). Or cron lance les tâches à
    l'heure locale de la machine : « 6 h » dans la crontab, c'est 6 h UTC,
    donc 8 h à Paris. L'image de l'hébergeur a gardé le fuseau par défaut.
    Le fuseau se règle avec timedatectl (man timedatectl).
horloge-evenement-retard =
    « System clock synchronized: no » : personne ne remet l'horloge à
    l'heure. Une horloge d'ordinateur dérive de quelques secondes par
    jour… et celle-ci a déjà neuf minutes de retard (ton poste, lui, dit
    9 h 12). Ce travail, c'est celui de NTP (Network Time Protocol) : ici,
    le service systemd-timesyncd, qui est arrêté (NTP service: inactive).
horloge-evenement-manuel =
    L'horloge est remise à l'heure… pour l'instant. Sans NTP, elle
    continue de dériver, et personne ne la corrigera la prochaine fois. Il
    vaut mieux confier ce travail à systemd-timesyncd.
horloge-evenement-muet =
    systemd-timesyncd tourne, mais l'horloge n'est toujours pas
    synchronisée : le serveur NTP qu'il interroge ne répond pas (sudo
    journalctl -u systemd-timesyncd, ou timedatectl timesync-status). Sa
    configuration est dans /etc/systemd/timesyncd.conf ; il ne la relit
    qu'au démarrage. Le mail de l'hébergeur parle justement de NTP.
horloge-evenement-synchro =
    « Contacted time server » : l'horloge est synchronisée, et
    systemd-timesyncd la gardera à l'heure (timedatectl).
horloge-evenement-non-active =
    systemd-timesyncd tourne, mais il n'est pas activé : au prochain
    redémarrage de la machine, il ne repartira pas. timedatectl set-ntp
    true fait les deux (ou systemctl enable).
horloge-evenement-cron =
    Le fuseau a changé, mais cron l'a lu à son démarrage, samedi : tant
    qu'il n'a pas redémarré, il compte encore en UTC, et la matinale de
    demain partirait toujours à 8 h. (C'est vrai de beaucoup de services
    qui tournent depuis longtemps : un changement de fuseau se fait suivre
    d'un redémarrage.)
horloge-evenement-fin =
    La machine est à l'heure de Paris, synchronisée par NTP, et cron le
    sait. Demain, la matinale s'enregistrera à 6 h. Zoé : « Je vais
    demander à l'hébergeur de régler le fuseau dans son image… »

    Bravo ! Tu as terminé le chapitre 4 de L'Astreinte.

    CE QUI S'EST PASSÉ
    La nouvelle machine était à l'heure UTC, le fuseau par défaut de
    l'image : cron a lancé l'enregistrement à 6 h UTC, 8 h à Paris. Et
    sans NTP (timesyncd arrêté, et pointé vers un serveur disparu), son
    horloge retardait de neuf minutes. Les journaux, eux, écrivaient
    « 06:00 » sans dire dans quel fuseau.

    LA BONNE PRATIQUE
    - timedatectl d'abord : fuseau, synchronisation, service NTP.
    - Le fuseau : timedatectl set-timezone Europe/Paris, puis redémarrer
      les services qui planifient (cron).
    - NTP toujours actif : timedatectl set-ntp true, avec le serveur de
      l'hébergeur si les serveurs publics sont filtrés (NTP= dans
      /etc/systemd/timesyncd.conf, puis redémarrer systemd-timesyncd).
    - Ne pas régler l'heure à la main (date -s) : ça ne tient pas.
    - Beaucoup d'équipes gardent les serveurs en UTC et écrivent leurs
      crontabs en conséquence : l'important est de le savoir, et de le
      noter. Les journaux gagnent à afficher le fuseau (date +%z).

    LA DOCUMENTATION
    - timedatectl : https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html
    - timesyncd.conf : https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html
    - changer de fuseau sur Debian : https://wiki.debian.org/TimeZoneChanges
