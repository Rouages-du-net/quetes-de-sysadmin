### Histoire « L'Observatoire », chapitre 2 « Le Quota » : nice ne
### plafonne pas, CPUQuota= si. Les commandes, les chemins, les noms
### d'unités et les messages de systemd ne sont pas traduits.

chapter-quota = Le Quota
    .summary = L'empilement est maintenant un service avec Nice=19, et la galerie va bien. Mais l'hébergeur va brider la machine : toute la nuit au-dessus de son quota de processeur. Plafonne l'empilement sans faire perdre sa nuit à Jules.

## Fichiers

quota-message-amara =
    De :     Amara
    À :      toi
    Objet :  L'hébergeur va nous brider

    Bonjour,

    Depuis ta réparation, Jules a fait de son empilement un service :
    /etc/systemd/system/stacking.service, avec Nice=19, comme tu l'avais
    conseillé. Il le lance en allant se coucher. La galerie ne souffre
    plus.

    Mais lis le courrier de l'hébergeur (courrier_hebergeur.txt) : la
    machine dépasse son « niveau de base » toute la nuit, et ils vont la
    ralentir. Tu peux garder l'empilement sous cette limite, pour cette
    nuit et les suivantes ?

    Il tourne encore (depuis 1 h 10, jusque vers 11 h) : si possible, ne
    le redémarre pas, Jules perdrait sa nuit.

    Même mot de passe sudo : nebuleuse-2028.

    Amara
quota-mail-host =
    De :     support@cloud.example
    À :      club-astro@cloud.example
    Objet :  [observatory] Crédits processeur épuisés

    Bonjour,

    Votre instance « observatory » (2 vCPU, offre « burst ») utilise plus
    de son niveau de base de 40 % de ses vCPU depuis 7 heures d'affilée.
    Ses crédits processeur sont épuisés : à partir de 12 h aujourd'hui,
    elle sera limitée à ce niveau de base jusqu'à ce que ses crédits se
    reconstituent.

    Pour l'éviter, gardez l'utilisation moyenne de l'instance sous 40 %.

    L'équipe cloud.example

## Évènements

quota-event-measure =
    Les workers sont à nice 19, et pourtant ils prennent presque tout
    des deux processeurs : personne ne parcourt la galerie à cette heure,
    donc personne ne réclame le reste. Nice partage entre les processus
    qui veulent le processeur ; il ne plafonne rien. Sur toute la nuit,
    la machine est à 100 % de ses deux vCPU : bien au-dessus des 40 % de
    l'hébergeur.
quota-event-nice-property =
    systemctl set-property ne change que les réglages de contrôle des
    ressources, ceux que systemd peut appliquer à un service qui tourne
    (CPUQuota=, CPUWeight=, MemoryMax=…). Nice= s'applique quand les
    processus démarrent. Et nice n'est pas ce qu'il faut ici : man
    systemd.resource-control.
quota-event-reload =
    Le fichier dit CPUQuota=, mais systemd ne l'a pas encore lu : après
    avoir modifié à la main un fichier d'unité ou une surcharge, sudo
    systemctl daemon-reload. (systemctl edit et systemctl set-property le
    font d'eux-mêmes.)
quota-event-per-cpu =
    Un quota est posé, mais trop haut pour l'hébergeur. CPUQuota= compte
    en pourcentage d'UN processeur : 100 % est un processeur entier,
    200 % les deux. L'hébergeur accepte 40 % des deux vCPU : 0,8
    processeur, donc CPUQuota=80% au plus.
quota-event-stopped =
    L'empilement est arrêté. Jules : « Ma nuit ! » Pour qu'il finisse, il
    doit tourner : sudo systemctl start stacking (il repart du début) — et
    plafonne-le, sinon l'hébergeur ralentira tout.
quota-event-restarted =
    L'empilement a redémarré : il repart du début des photos de la nuit.
    Jules soupire, mais il aura fini cet après-midi. Aucun redémarrage
    n'était nécessaire : systemd applique CPUQuota= à un service qui
    tourne (set-property, ou daemon-reload après une surcharge).
quota-event-end =
    L'empilement reste maintenant sous 0,8 processeur : 40 % de la
    machine. Il tourne toujours, un peu plus longtemps, et la limite de
    l'hébergeur est respectée ; le réglage est sur le disque, il
    s'appliquera aussi les nuits suivantes. Amara : « Parfait, je réponds
    à l'hébergeur. »

    Bravo ! Tu as terminé le chapitre « Le Quota ».

    CE QUI S'EST PASSÉ
    Nice=19 faisait passer l'empilement après tous les autres processus,
    mais il ne plafonne rien : quand personne d'autre ne veut le
    processeur, un processus « gentil » le prend en entier. Toute la nuit,
    la machine était à 100 % de ses deux vCPU, plus que les 40 % que
    l'offre de l'hébergeur accepte dans la durée.

    NICE PARTAGE, LE QUOTA PLAFONNE
    - nice (Nice=, renice) : qui passe en premier quand il n'y en a pas
      assez pour tout le monde. Aucune limite quand le processeur est
      libre.
    - CPUQuota= (systemd, les cgroups du noyau) : au plus tant de temps
      processeur par seconde, même quand le processeur est libre. 100 % =
      un processeur, 200 % = deux.
    - CPUWeight= : comme nice, mais entre services (cgroups).

    BONNES PRATIQUES
    - sudo systemctl set-property stacking CPUQuota=80% : appliqué tout de
      suite, et gardé sur le disque (dans /etc/systemd/system.control).
    - Ou sudo systemctl edit stacking ({"["}Service] CPUQuota=80%) : une
      surcharge, lue tout de suite par systemctl edit. À la main :
      daemon-reload.
    - Vérifier avec systemd-cgtop, ou top : les workers, ensemble, restent
      sous le quota.

    DOCUMENTATION
    - CPUQuota=, CPUWeight= : https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - systemctl set-property : https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    - systemd-cgtop : https://www.freedesktop.org/software/systemd/man/latest/systemd-cgtop.html
