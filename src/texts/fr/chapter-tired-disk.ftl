### Histoire « Le Labo », chapitre 1 « Le disque qui fatigue » : SMART, le
### RAID logiciel (mdadm), sortir un disque de ses grappes. Les commandes,
### options, chemins et sorties (smartctl, mdadm, /proc/mdstat) ne se
### traduisent pas. On y trouve aussi les textes communs à l'histoire (labo-…).

chapter-tired-disk = Le disque qui fatigue
    .summary = smartd s'inquiète d'un disque : lire ce que SMART dit vraiment, comprendre le RAID du serveur, sortir le disque malade de ses grappes et demander son remplacement par son numéro de série.

## Communs à l'histoire

lab-procedure-host =
    Remplacement d'un disque défectueux — serveurs dédiés

    1. Avant de nous écrire, retirez le disque de vos grappes RAID logiciel
       (mdadm) : nous le débranchons à chaud, et un disque encore utilisé
       pourrait abîmer la grappe.
    2. Indiquez dans votre demande le numéro de série (S/N) du disque à
       remplacer, et seulement celui-là : les noms sda ou sdb peuvent
       changer d'un démarrage à l'autre, pas le numéro de série
       (smartctl -i ou lsblk -o le montrent).
    3. Nous intervenons sous 24 heures. Le disque neuf est livré vierge :
       à vous de le partitionner et de reconstruire votre RAID.
lab-syslog =
    Nov 11 03:12:44 labo smartd[588]: Device: /dev/sdb [SAT], 8 Currently unreadable (pending) sectors
    Nov 11 03:42:44 labo smartd[588]: Device: /dev/sdb [SAT], 8 Offline uncorrectable sectors
    Nov 13 03:00:12 labo smartd[588]: Device: /dev/sdb [SAT], starting scheduled Short Self-Test.
    Nov 13 03:02:44 labo smartd[588]: Device: /dev/sdb [SAT], previous self-test completed with error (read test element)
    Nov 13 03:12:44 labo smartd[588]: Device: /dev/sdb [SAT], 8 Currently unreadable (pending) sectors

# La page d'accueil de la galerie (/var/www/galerie/index.html).
lab-gallery-index = <!doctype html><title>Le Labo</title>

## Fichiers

tired-disk-message-odile =
    Un message d'Odile, présidente du Labo, le club photo du quartier
    (samedi, 7 h 30) :

    « Bonjour, et merci de reprendre le serveur du club ! Je n'y connais
    pas grand-chose, mais depuis jeudi je reçois des courriers bizarres de
    « smartd » au sujet d'un disque. Je te les ai fait suivre : la commande
    mail les liste, et ils sont dans /var/mail/vous. La galerie était très
    lente cette nuit, aussi.

    Le serveur est loué chez un hébergeur. D'après l'ancien bénévole, il a
    deux disques « en RAID », pour qu'on ne perde rien si l'un lâche. Si un
    disque doit être changé, l'hébergeur le fait gratuitement : sa
    procédure est dans procedure_hebergeur.txt. Écris la demande dans
    ~/ticket.txt, je l'enverrai depuis notre compte client.

    Pour sudo : argentique-2027. »

## Événements

tired-disk-event-alert =
    smartd et le noyau parlent du même disque : sdb. Des secteurs qu'il
    n'arrive plus à lire (pending), et des lectures que le RAID a dû refaire
    sur l'autre disque (redirecting … to other mirror). Avant de conclure,
    regarde comment les disques sont assemblés : cat /proc/mdstat.
tired-disk-event-arrays =
    Deux grappes RAID 1 : md0 (le système, /) avec sda2 et sdb2, et md1
    (les photos, /srv) avec sda3 et sdb3. [UU] : pour l'instant, les deux
    copies sont là. Chaque disque est donc dans les deux grappes. Que dit
    SMART de sdb, et de sda pour comparer ? (man smartctl)
tired-disk-event-smart =
    « PASSED »… et pourtant : plus de mille secteurs réalloués, 8 en
    attente, 37 erreurs dans son journal. Le verdict global ne bascule
    qu'au seuil du fabricant ; un compte de secteurs réalloués qui grimpe
    annonce la panne. Compare avec sda : zéro partout. Il faut sortir sdb
    de ses deux grappes avant de le faire changer (man mdadm : --fail,
    puis --remove).
tired-disk-event-busy =
    mdadm refuse : on ne retire pas un membre actif d'une grappe (« Device
    or resource busy »). Il faut d'abord le déclarer défectueux (--fail),
    puis le retirer (--remove) ; les deux tiennent dans la même commande.
tired-disk-event-healthy =
    Attention : c'est un membre de sda, le disque SAIN, que tu viens de
    sortir de sa grappe ! Elle ne tient plus que sur sdb, celui qui
    s'abîme. Retire-le (--remove), puis remets-le (--re-add) : il sera
    remis à jour et la grappe retrouvera sa copie saine. Ensuite seulement,
    occupe-toi de sdb.
# { $partition } : la partition de sdb encore en place ; { $array } : sa grappe
tired-disk-event-half =
    Une grappe est faite. Mais sdb est aussi dans l'autre : { $partition }
    fait encore partie de { $array }. Un disque qu'on remplace sort de
    toutes ses grappes.
tired-disk-event-removed =
    sdb ne fait plus partie d'aucune grappe : /proc/mdstat montre [U_] pour
    les deux. Le serveur tourne sur sda seul, sans filet : il faut faire
    changer le disque vite. Reste le ticket, ~/ticket.txt, avec ce que
    demande la procédure de l'hébergeur.
# { $file } : le nom du ticket
tired-disk-event-ticket-false =
    Le ticket contient le numéro de série de sda : c'est le disque SAIN !
    L'hébergeur débrancherait le seul disque qui marche encore. Corrige
    { $file } : seulement le numéro de série de sdb.
tired-disk-event-ticket =
    Le ticket donne le numéro de série du disque à remplacer. Odile
    l'enverra dès que le disque sera sorti de ses grappes.
tired-disk-event-end =
    Odile : « Envoyé ! L'hébergeur répond qu'il change le disque cette nuit. »

    Bravo ! Tu as terminé le chapitre 1 du Labo. (La suite t'attend :
    ssh labo.)

    CE QUI S'EST PASSÉ
    Le disque sdb s'abîmait : des secteurs illisibles, que smartd signalait
    depuis deux jours et que le RAID compensait en relisant l'autre disque.
    SMART disait pourtant PASSED : son verdict global ne bascule qu'au
    seuil du fabricant, souvent trop tard. Tu as comparé les attributs des
    deux disques, sorti sdb de ses deux grappes, et demandé son
    remplacement par son numéro de série.

    LA BONNE PRATIQUE
    - Faire tourner smartd, et lire ses courriers : ceux de root doivent
      arriver chez quelqu'un (/etc/aliases).
    - Juger un disque sur ses attributs (5, 197, 198) et leur évolution,
      pas sur PASSED.
    - Avant un remplacement : --fail puis --remove, dans chaque grappe du
      disque.
    - Désigner un disque par son numéro de série, jamais par sda ou sdb,
      qui peuvent changer d'un démarrage à l'autre.
    - Un RAID n'est pas une sauvegarde : il protège d'une panne de disque,
      pas d'un effacement, d'un rançongiciel ni d'un incendie.

    LA DOCUMENTATION
    - smartctl : https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in
    - mdadm : https://man7.org/linux/man-pages/man8/mdadm.8.html
    - Le RAID logiciel de Linux (md) : https://docs.kernel.org/admin-guide/md.html
