### Histoire « Le Café des langues », chapitre « Permission refusée,
### mais… » : un site déplacé avec mv garde l'étiquette SELinux du
### répertoire personnel ; httpd n'a pas le droit de le lire. ls -Z, le
### journal d'audit (ausearch, audit2why), semanage fcontext et restorecon.
### Commandes, options, chemins, étiquettes et sorties ne sont pas traduits.

chapter-wrong-label = Permission refusée, mais…
    .summary = Le nouveau site est en place, les droits sont parfaits, et l'écran du café affiche une page de test. Quelque chose refuse à httpd ce que les droits Unix permettent : trouvez qui refuse, lisez pourquoi, et corrigez pour que ça tienne au prochain réétiquetage, sans éteindre SELinux.

## Fichiers

wrong-label-message-thuy =
    De : Thuy (table vietnamienne, et gardienne du panneau)
    Samedi 12 décembre, 10 h 15

    Bonjour !

    Itzel a mis le nouveau site sur bouilloire ce matin, et depuis, l'écran
    près de la porte affiche de nouveau la « Test Page » grise au lieu des
    tables. Elle a vérifié les droits deux fois ; elle m'a même envoyé une
    capture de ls -l, tout en rw-r--r--. Jeudi, 40 personnes sont venues ;
    samedi, c'est la journée portes ouvertes, et j'aimerais tant que les
    tables soient à l'écran.

    Kaveh, de l'association d'à côté, vient ce soir à 22 h redémarrer
    bouilloire pour une mise à jour du noyau. Seun a laissé bouilloire prête
    pour ça, a-t-il dit.

    Thuy

wrong-label-message-itzel =
    De : Itzel
    Samedi 12 décembre, 9 h 45

    J'ai construit le nouveau site dans mon répertoire sur bouilloire
    (~/site), puis je l'ai déplacé dans /srv/site, là où vont les sites
    web, j'ai lu. Exactement ce que j'ai fait :

        sudo mkdir /srv/site
        cd ~/site && sudo mv css index.html tables.html /srv/site/

    Puis un fichier pour httpd, /etc/httpd/conf.d/commontongue.conf, avec
    DocumentRoot "/srv/site", et sudo systemctl restart httpd. Aucune
    erreur. Les fichiers sont lisibles par tout le monde. Que veut httpd de
    plus ?

    Itzel

## Événements

wrong-label-event-test-page =
    Cette page de test, c'est httpd qui répond 403 pour « / » : le
    welcome.conf de Rocky l'affiche chaque fois que httpd refuse la page
    d'accueil. httpd a trouvé le site mais n'a pas eu le droit de le lire.
    Son journal d'erreurs (/var/log/httpd/error_log) dit quel fichier.

wrong-label-event-error-log =
    « Permission denied » pour un fichier que tous les comptes peuvent lire :
    les droits Unix ne sont pas les seuls sur bouilloire. Chaque fichier a
    aussi une étiquette SELinux, que ls sait montrer (man ls, -Z), et chaque
    processus la sienne (ps -Z) : celle de httpd est httpd_t.

wrong-label-event-labels =
    user_home_t : l'étiquette des fichiers d'un répertoire personnel. mv ne
    réétiquette pas : les fichiers ont gardé l'étiquette qu'ils avaient chez
    Itzel, et httpd_t n'a pas le droit de lire user_home_t. Comparez avec
    /var/www/html (ls -Zd). Qui a refusé, et quand, est dans le journal
    d'audit.

wrong-label-event-avc =
    Un AVC, c'est un refus de SELinux : qui (scontext, httpd_t), quoi
    (tcontext, le type du fichier ; tclass) et quelle permission
    ({"{"} read {"}"}), permissive=0 : refusé. audit2why explique un refus
    (son paquet manque peut-être : dnf trouve quel paquet a une commande).

wrong-label-event-tools-missing =
    semanage, audit2why et audit2allow ne sont pas dans une installation
    minimale : ils viennent avec un paquet. dnf peut dire lequel (man dnf :
    provides).

wrong-label-event-tools =
    Les outils de la politique sont là. audit2why lit les refus et dit
    pourquoi ; semanage fcontext -l dit quelle étiquette la politique donne
    à chaque chemin. Laquelle donne-t-elle à /srv/site ?

wrong-label-event-permissive =
    Permissive : SELinux ne refuse plus rien, donc le site s'affiche ; ça
    prouve que SELinux est en cause, mais tous les services confinés de
    bouilloire ont perdu leur protection, pas seulement httpd. Remettez
    enforcing (setenforce 1) et corrigez plutôt les étiquettes.

wrong-label-event-config-off =
    /etc/selinux/config ne dit plus SELINUX=enforcing : au prochain démarrage
    (ce soir, avec Kaveh), bouilloire démarrerait sans la protection de
    SELinux. Remettez enforcing dans le fichier.

wrong-label-event-chmod =
    Un fichier du site est maintenant modifiable par tout le monde (chmod 777
    ou o+w) : les droits Unix suffisaient déjà à httpd, ils n'étaient pas le
    problème. Remettez-les (644 pour les fichiers, 755 pour les
    répertoires) ; c'est l'étiquette qui manque à httpd.

wrong-label-event-home-boolean =
    httpd_read_user_content laisse httpd lire les fichiers de tous les
    répertoires personnels : le site s'afficherait, mais aussi tout ce qu'un
    compte laisse chez lui. Éteignez-le ; le site ne devrait pas ressembler
    à un répertoire personnel.

wrong-label-event-module =
    Un module fait par audit2allow est chargé : httpd_t peut maintenant lire
    tout ce qui porte cette étiquette, dans /srv/site et dans chaque
    répertoire personnel. Il autorise ce qui a été refusé, pas ce que vous
    vouliez. Retirez-le (semodule -r) et donnez aux fichiers la bonne
    étiquette.

wrong-label-event-var-t =
    restorecon a fait ce que dit la politique : /srv/site est var_t, comme
    tout ce que la politique ne connaît pas sous /srv (semanage fcontext -l
    | grep /srv). httpd n'a pas le droit de lire var_t non plus. La
    politique doit d'abord apprendre ce qu'est /srv/site ; ensuite
    restorecon l'appliquera.

wrong-label-event-rule =
    La politique étiquette maintenant le site comme du contenu web. Les
    fichiers gardent leur étiquette actuelle jusqu'à ce que quelque chose les
    réétiquette : restorecon -Rv, puis vérifiez depuis le panneau.

wrong-label-event-relabelled =
    22 h. Kaveh : « J'ai redémarré bouilloire pour la mise à jour du noyau.
    C'était long : un truc sur le "relabelling" du système de fichiers ?
    Thuy dit que l'écran est revenu à la page de test. »

    Seun avait laissé /.autorelabel : au démarrage, tout le disque a été
    réétiqueté d'après la politique. Les étiquettes posées avec chcon ne sont
    pas dans la politique : elles ont disparu, et /srv/site est de nouveau
    var_t. Apprenez-le à la politique (semanage fcontext), puis restorecon.

wrong-label-event-rebooted =
    22 h. Kaveh : « J'ai redémarré bouilloire pour la mise à jour du noyau.
    Tout a l'air bien ! »

    Cette fois, aucun réétiquetage n'a eu lieu (/.autorelabel avait
    disparu), donc les étiquettes posées à la main ont survécu. Elles ne sont
    toujours pas dans la politique : le prochain restorecon ou réétiquetage
    remettra var_t. Apprenez-le à la politique (semanage fcontext).

wrong-label-event-end =
    Thuy : « Les tables sont à l'écran, en sept langues. Itzel danse dans la
    cuisine. »

    Bravo ! Vous avez terminé Permission refusée, mais….

    CE QUI S'EST PASSÉ
    Itzel a déplacé le site depuis son répertoire avec mv, et mv garde
    l'étiquette SELinux d'un fichier : les fichiers sont restés user_home_t,
    que httpd_t n'a pas le droit de lire, donc httpd recevait « Permission
    denied » du noyau alors que les droits Unix le permettaient (AH00132
    dans son journal d'erreurs, un AVC dans le journal d'audit). La
    politique elle-même étiquette /srv/site en var_t. Vous avez appris à la
    politique que /srv/site est du contenu web (semanage fcontext), puis
    réétiqueté les fichiers d'après elle (restorecon), si bien que les
    étiquettes tiennent aussi au prochain réétiquetage.

    BONNES PRATIQUES
    - Un « Permission denied » que les droits Unix n'expliquent pas :
      regardez les étiquettes (ls -Z, ps -Z) et le journal d'audit (ausearch
      -m avc -ts recent).
    - Copier en place (cp, qui donne au nouveau fichier l'étiquette de
      l'endroit) ou réétiqueter après un déplacement : mv garde l'ancienne
      étiquette.
    - Corriger la politique, pas le fichier : semanage fcontext -a -t
      httpd_sys_content_t "/srv/site(/.*)?" (ou -e /var/www /srv/site), puis
      restorecon -Rv /srv/site. chcon dure jusqu'au prochain réétiquetage.
    - setenforce 0 est un diagnostic qui dure quelques secondes, jamais une
      réparation ; chmod 777 ne corrige rien de ce que SELinux refuse, et
      ouvre les fichiers à tout le monde.
    - audit2allow écrit une règle pour ce qui a été refusé : ici, httpd qui
      lit les répertoires personnels. Lisez d'abord audit2why : le plus
      souvent, la réponse est une étiquette, un type de port ou un booléen.
    - Ou utilisez ce que la politique connaît déjà : /var/www, ou /srv/www
      (la politique étiquette /srv/www, et /srv/nimportequoi/www, comme du
      contenu web).

    DOCUMENTATION
    - RHEL 10, utiliser SELinux, dépannage : https://docs.redhat.com/fr/documentation/red_hat_enterprise_linux/10/html/using_selinux/troubleshooting-problems-related-to-selinux_using-selinux
    - semanage-fcontext(8) : https://man7.org/linux/man-pages/man8/semanage-fcontext.8.html
    - restorecon(8) : https://man7.org/linux/man-pages/man8/restorecon.8.html
    - Rocky Linux, apprendre SELinux : https://docs.rockylinux.org/fr/guides/security/learning_selinux/
