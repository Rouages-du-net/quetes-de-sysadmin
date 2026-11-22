### Histoire « La Chorale », chapitre « Gardé pour toujours » : les
### journaux du serveur de la chorale remontent à des années, contre la
### politique de conservation. logrotate (rotate, maxage), find -mtime, map
### et log_format de nginx, MaxRetentionSec= de journald. Les commandes,
### options, chemins et sorties ne sont pas traduits.

chapter-kept-forever = Gardé pour toujours
    .summary = Le bureau de la chorale a écrit, il y a deux ans, combien de temps il garde les données personnelles. Le serveur ne l'a jamais lu : ses journaux gardent l'adresse de chaque visiteur·se depuis 2027. Mettez les journaux en accord avec la politique, sans jeter ce qu'elle demande de garder.

## Fichiers

kept-forever-message-amara =
    De : Amara (présidente de la Chorale des Berges)
    Mardi 4 mars, 9 h 10

    Bonjour, et merci de reprendre notre petit serveur !

    À la réunion du bureau la semaine dernière, quelqu'un a demandé si nous
    faisons vraiment ce que dit notre politique de conservation. Nous
    l'avons adoptée en 2029 (elle est dans
    /srv/choir/docs/politique-de-conservation.txt), Ruben avait installé le
    serveur avant, et j'ai peur que personne n'ait jamais vérifié. Ruben est
    parti vivre à Glasgow ; il vous a laissé un mot.

    Pourriez-vous regarder les journaux du serveur et leur faire suivre la
    politique ? Garder ce qu'elle dit de garder, et rien de plus longtemps.
    Je préfère que nous le découvrions nous-mêmes plutôt qu'un·e choriste à
    notre place.

    Vous êtes sur baguette, le serveur de la chorale ; sudo marche avec
    votre mot de passe.

    Amara

kept-forever-note-ruben =
    Notes de Ruben (baguette, 2027)

    - nginx sert www.riversidechoir.example depuis /var/www/choir ;
      l'espace choristes (/members/) est l'appli de la chorale (gunicorn,
      port 8000). Journaux dans /var/log/nginx.
    - J'ai réglé logrotate pour garder les journaux web dix ans, « au cas
      où » (/etc/logrotate.d/nginx). Le disque ne coûte rien.
    - L'espace choristes écrit son journal de sécurité (connexions,
      modifications de profil) dans /var/log/choir/audit.log, tourné chaque
      mois.
    - journalctl pour tout le reste ; le journal est persistant
      (/var/log/journal).

    Ruben

## Événements

kept-forever-event-policy =
    Voilà la promesse du bureau : trente jours de journaux d'accès web avec
    les adresses tronquées, douze mois pour le journal de sécurité de
    l'espace choristes, trente jours pour le journal du système. Regardez
    maintenant ce que le serveur garde vraiment : /var/log/nginx,
    /var/log/choir, le journal.
kept-forever-event-forever =
    { $weeks } semaines de journaux d'accès, jusqu'à septembre 2027, chaque
    ligne avec l'adresse IP complète d'un·e visiteur·se : pour le RGPD, une
    adresse IP est une donnée personnelle. Le « rotate 520 » de Ruben garde
    dix ans de journaux hebdomadaires. Où logrotate décide-t-il de la durée
    de vie d'un journal ? (man logrotate : rotate, maxage, daily, weekly.)
kept-forever-event-today-only =
    Le journal du jour a disparu, mais les années d'archives sont toujours
    là : le problème n'a jamais été le fichier du jour. Et la politique
    demande de garder trente jours de journaux, pour enquêter sur un
    incident : supprimez ce qui est plus vieux, pas ce qui est récent.
kept-forever-event-too-much =
    Vous avez supprimé des journaux que la politique demande de garder : les
    dernières semaines de journaux web (trente jours, pour enquêter sur un
    incident) ou le journal de sécurité des douze derniers mois. Une
    politique de conservation est un maximum et un minimum. Sur un vrai
    serveur, il faudrait les restaurer depuis une sauvegarde ; ici,
    recommencez le chapitre (ou revenez à l'instantané de secours) et ne
    supprimez que ce qui est plus vieux que ce que la politique permet.
kept-forever-event-rotation =
    logrotate ne garde plus que trente jours de journaux d'accès. Mais
    logrotate n'agit qu'à la prochaine rotation, et il ne supprime que le
    journal qui dépasse son compte : les années d'archives laissées par un
    compte plus grand restent où elles sont. Regardez-les à nouveau (ls, ou
    find -mtime).
kept-forever-event-leftovers =
    logrotate est passé avec le nouveau compte, et { $count } anciennes
    archives sont toujours là : il ne supprime que l'archive qui dépasse le
    compte (et, avec maxage, les vieilles parmi compte + 1), jamais les
    centaines de fichiers laissés au-delà. Supprimez vous-même ce qui a plus
    de trente jours, prudemment : find /var/log/nginx -mtime +30 les liste
    avant que vous ne supprimiez quoi que ce soit.
kept-forever-event-purged =
    Plus rien de plus de trente jours dans /var/log/nginx, et les semaines
    récentes sont toujours là. Le passé est en règle ; reste le présent :
    chaque nouvelle ligne porte encore l'adresse complète du visiteur ou de
    la visiteuse.
kept-forever-event-log-off =
    access_log off : nginx n'écrit plus aucun journal d'accès. Plus
    d'adresses, certes, mais plus moyen d'enquêter sur un incident non plus,
    et la politique en demande trente jours. Gardez le journal, avec
    l'adresse tronquée (man nginx : map, log_format).
kept-forever-event-v6-whole =
    Les adresses IPv4 sont tronquées, mais les visiteur·ses en IPv6
    gardent leur adresse complète : une partie des visites de la chorale
    arrive en IPv6 (2001:db8:…). Votre map doit traiter les deux, ou se
    rabattre sur une valeur par défaut qui ne révèle rien.
kept-forever-event-not-loaded =
    La configuration des fichiers tronque les adresses, mais le nginx qui
    tourne utilise toujours la configuration qu'il a chargée : nginx -t,
    puis rechargez-le (systemctl reload nginx).
kept-forever-event-anonymised =
    Les nouvelles visites apparaissent dans access.log avec une adresse
    tronquée (le dernier octet d'une adresse IPv4, tout ce qui suit le
    deuxième groupe d'une adresse IPv6) : assez pour repérer un réseau qui
    inonde le site, pas assez pour désigner un foyer. Reste le journal du
    système.
kept-forever-event-vacuum-only =
    Les vieux fichiers du journal ont disparu, mais rien ne dit à journald
    de garder le journal à trente jours : il va regrossir. La politique a sa
    place dans sa configuration (man journald.conf : MaxRetentionSec=).
kept-forever-event-journal-not-loaded =
    MaxRetentionSec= est dans le fichier, mais journald lit sa configuration
    à son démarrage : redémarrez-le (systemctl restart systemd-journald).
kept-forever-event-journal =
    journald garde maintenant trente jours, et a supprimé les fichiers
    archivés plus anciens.
kept-forever-event-end =
    Amara : « Merci ! Je vais dire au bureau que nous faisons maintenant ce
    que nous disons. Je me demande ce que nous gardons d'autre sans le
    savoir… »

    Bravo ! Vous avez terminé Gardé pour toujours.

    CE QUI S'EST PASSÉ
    La politique du bureau promettait trente jours de journaux web aux
    adresses tronquées, et trente jours de journal du système. Le logrotate
    de Ruben gardait dix ans de journaux hebdomadaires, avec l'adresse IP
    complète de chaque visite, et le journal remontait à 2027. Vous avez
    réglé logrotate sur trente jours, supprimé les archives qu'il n'aurait
    jamais supprimées lui-même, tronqué les adresses qu'écrit nginx avec une
    map et un log_format, et donné à journald un MaxRetentionSec=, en
    gardant le journal de sécurité de l'espace choristes, qui était déjà
    juste.

    BONNES PRATIQUES
    - Limitation de la conservation (RGPD, article 5, 1, e) : une donnée
      personnelle n'est pas gardée plus longtemps que son but ne l'exige.
      Une adresse IP est une donnée personnelle.
    - Une durée de conservation se règle dans l'outil qui garde la donnée
      (logrotate, journald), pas dans un pense-bête : elle s'applique alors
      chaque jour.
    - Changer le compte de logrotate ne nettoie pas le passé : il ne
      supprime que l'archive qui dépasse le compte. Vérifiez avec find
      -mtime avant de supprimer.
    - Minimiser à la source : une adresse tronquée dans le journal plutôt
      qu'une adresse complète nettoyée plus tard. Le journal d'erreurs garde
      encore des adresses complètes : gardez-le court lui aussi, ou à un
      niveau qui en écrit moins.
    - Une politique est aussi un minimum : le journal de sécurité des douze
      derniers mois reste, pour répondre à « qui s'est connecté ? » après un
      incident.

    DOCUMENTATION
    - RGPD, article 5 : https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - La CNIL : https://www.cnil.fr/
    - Le module de journalisation de nginx : https://nginx.org/en/docs/http/ngx_http_log_module.html
    - Le module map de nginx : https://nginx.org/en/docs/http/ngx_http_map_module.html
    - logrotate(8) : https://man7.org/linux/man-pages/man8/logrotate.8.html
    - journald.conf(5) : https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html
