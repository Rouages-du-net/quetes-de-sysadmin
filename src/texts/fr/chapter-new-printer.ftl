### Histoire « La Salle des profs », chapitre « La Nouvelle Imprimante » :
### une file sans pilote pour le multifonction de la salle des profs, par
### défaut pour l'école, partagée avec le personnel seulement ; la vieille
### LaserJet de l'accueil et son pilote. lpadmin, lpinfo, driverless, les
### blocs Location de cupsd.conf. Les commandes, options, chemins et sorties
### ne se traduisent pas.

chapter-new-printer = La Nouvelle Imprimante
    .summary = Le nouveau multifonction de la salle des profs est arrivé, et la vieille LaserJet de l'accueil veut une seconde vie. Ajoutez les deux à CUPS, à la manière moderne quand c'est possible, à l'ancienne quand il le faut, et veillez à ce que les Chromebooks des élèves restent de leur côté.

## Fichiers

new-printer-message-ines =
    De : Ines (secrétariat de l'école)
    Mercredi 28 novembre, 13 h 30

    Bonjour !

    Le nouveau multifonction de la salle des profs est branché (le bon de
    livraison est dans votre dossier). Pourriez-vous l'ajouter sur craie,
    et en faire l'imprimante par défaut pour tout le monde ? Le personnel
    doit pouvoir y imprimer depuis ses PC et ses Mac, comme sur celle du
    secrétariat.

    Mais attention : il est réservé au personnel. Les Chromebooks de la
    bibliothèque voient l'imprimante de la bibliothèque, et c'est tout ce
    qu'ils doivent voir. Je ne veux pas des « créations » des élèves dans
    la salle des profs.

    Et l'accueil aimerait retrouver la vieille HP LaserJet 4250 : elle
    marche parfaitement, elle est juste vieille. Elle est branchée aussi.

    Ines

new-printer-delivery-note =
    BON DE LIVRAISON

    1 x multifonction RICOH IM C3010 (couleur, A4/A3)
    Installé dans : salle des profs
    Réseau : VLAN du personnel, adresse 198.51.100.21 (mfp-staffroom.internal)
    Impression : certifié IPP Everywhere / AirPrint / Mopria (sans pilote),
    port 631, chemin /ipp/print. Aucun pilote nécessaire pour les systèmes récents.

    Ancienne imprimante rebranchée : HP LaserJet 4250, adresse 198.51.100.22
    (laserjet-reception.internal). Impression réseau : port brut 9100 (JetDirect).

## Événements

new-printer-event-discover =
    Le multifonction s'annonce sur le réseau (DNS-SD, les noms en .local) :
    IPP Everywhere, la norme derrière l'impression sans pilote. CUPS lui
    demande ses capacités en IPP et fabrique le PPD lui-même : le -m
    everywhere de lpadmin, aucun pilote à installer (man lpadmin).
new-printer-event-not-enabled =
    La file existe mais elle est désactivée et refuse les travaux : lpadmin
    crée ainsi une nouvelle file, sauf si -E vient après -p (avant -p, -E
    veut dire « chiffrer la connexion »). cupsenable et cupsaccept
    marchent aussi.
new-printer-event-added =
    La file { $queue } est prête, sans pilote. Est-ce la destination par
    défaut que verront les ordinateurs du personnel (lpstat -d) ? Et qui
    peut l'atteindre : un œil sur le <Location /> de cupsd.conf serait sage.
new-printer-event-lpoptions-only =
    lpoptions -d a réglé VOTRE imprimante par défaut, dans
    ~/.cups/lpoptions : cela ne change rien pour le serveur, ni pour les
    ordinateurs du personnel. La destination par défaut du serveur, c'est
    le -d de lpadmin.
new-printer-event-default =
    Le multifonction est la destination par défaut du serveur : les
    ordinateurs du personnel le proposeront en premier.
new-printer-event-pupil-printed =
    Ines : « Trente pages de skins de jeu viennent de sortir dans la salle
    des profs ! »

    Un Chromebook a imprimé sur le multifonction. cupsd.conf partage tout
    avec « Allow @LOCAL » dans <Location />, et @LOCAL veut dire tous les
    réseaux sur lesquels craie a une interface : ip -br addr en montre
    trois, dont le VLAN des élèves, pour l'imprimante de la bibliothèque.
    Les nouvelles files sont partagées par défaut (DefaultShared). Qui
    envoie quoi : /var/log/cups/access_log.
new-printer-event-remote-any =
    « Allow all » : désormais, quiconque atteint le port 631 peut
    imprimer, depuis n'importe quel réseau. C'est l'inverse de ce que
    demandait Ines. Un Location peut nommer des réseaux (Allow
    198.51.100.0/24, Allow @IF(eth1)) et une file peut nommer ses
    utilisateur·rices (lpadmin -u allow:@staff).
new-printer-event-not-applied =
    cupsd.conf a changé, mais cupsd tourne toujours avec la configuration
    lue au démarrage. cupsd -t vérifie le fichier ; un redémarrage (ou
    cupsctl, qui le redémarre) l'applique.
new-printer-event-staff-blocked =
    Maintenant, le personnel ne peut plus imprimer sur le multifonction
    non plus : un PC du personnel est refusé (l'access_log montre 403 ou
    client-error-not-possible). Partagée, ouverte au réseau du personnel :
    il faut les deux.
new-printer-event-library-broken =
    Les Chromebooks de la bibliothèque ne peuvent plus imprimer sur
    l'imprimante de la bibliothèque : la restriction est trop large.
    Restreignez la file de la salle des profs, pas tout le serveur.
new-printer-event-printers-conf =
    printers.conf modifié pendant que cupsd tourne : cupsd l'écrasera, et
    une file sans son PPD dans /etc/cups/ppd imprime en brut. L'outil des
    files, c'est lpadmin.
new-printer-event-restricted =
    Le personnel imprime sur le multifonction, les Chromebooks sont
    refusés (403 dans l'access_log, ou client-error-not-authorized), et ils
    impriment toujours à la bibliothèque. Maintenant, la vieille LaserJet.
new-printer-event-everywhere-refused =
    « IPP Everywhere driver requires an IPP connection » : la LaserJet 4250
    (2004) ne connaît que le port brut 9100, socket://. CUPS ne peut rien
    lui demander : il lui faut un PPD, une description de l'imprimante, et
    les filtres derrière. lpinfo -m liste les pilotes installés ; ceux de
    HP sont dans un paquet Debian (apt search hpcups).
new-printer-event-raw =
    Une file brute (raw) envoie le document tel quel : la LaserJet ne
    comprend pas le PDF. Et CUPS le dit : les files brutes sont
    dépréciées. Il lui faut un pilote.
new-printer-event-hpcups =
    printer-driver-hpcups est installé : lpinfo -m connaît maintenant la
    LaserJet 4250 (lpinfo -m | grep 4250).
new-printer-event-old-added =
    La LaserJet de l'accueil a sa file, avec { $model }. CUPS prévient que
    les pilotes d'imprimante sont dépréciés : CUPS 3 n'imprimera que sans
    pilote, et les vieilles imprimantes auront besoin d'une Printer
    Application.
new-printer-event-end =
    Ines : « La salle des profs imprime, l'accueil imprime, et les
    Chromebooks de la bibliothèque ne voient que la bibliothèque. Parfait ! »

    Bravo ! Vous avez terminé La Nouvelle Imprimante.

    CE QUI S'EST PASSÉ
    Le multifonction parle IPP Everywhere : la file { $queue } est sans
    pilote (-m everywhere), activée à la création (-E après -p), et c'est la
    destination par défaut du serveur (lpadmin -d). cupsd.conf partageait
    tout avec « Allow @LOCAL », et @LOCAL inclut le VLAN des élèves, où
    craie sert la bibliothèque : vous avez réservé le multifonction au
    personnel, par réseau ou par groupe, et vérifié qui entrait grâce à
    l'access_log. La LaserJet ne parle que le port 9100 : la file { $old }
    utilise un PPD, celui de HP (printer-driver-hpcups) ou un générique.

    BONNES PRATIQUES
    - Sans pilote d'abord (IPP Everywhere, AirPrint, Mopria) : aucun
      pilote à maintenir, et la seule façon dont CUPS 3 imprimera.
    - lpadmin -p NOM -E -v URI -m everywhere : -E après -p.
    - @LOCAL veut dire tous les réseaux sur lesquels le serveur a une
      interface : listez-les (ip -br addr) avant de lui faire confiance.
    - Restreindre par réseau dans un <Location /printers/NOM> (qui peut se
      connecter), par utilisateur·rice avec lpadmin -u (qui peut imprimer ;
      le nom vient du client, sauf si le serveur authentifie).
    - Jamais Allow all ; jamais printers.conf modifié pendant que cupsd
      tourne.
    - Les vieilles imprimantes : le paquet de pilotes du fabricant, ou un
      PPD générique, en attendant qu'une Printer Application le remplace.

    DOCUMENTATION
    - lpadmin : https://www.cups.org/doc/man-lpadmin.html
    - lpinfo : https://www.cups.org/doc/man-lpinfo.html
    - Partager des imprimantes : https://www.cups.org/doc/sharing.html
    - cupsd.conf (Location, Allow, Order) : https://www.cups.org/doc/man-cupsd.conf.html
    - L'impression sans pilote sur Debian : https://wiki.debian.org/CUPSDriverlessPrinting
