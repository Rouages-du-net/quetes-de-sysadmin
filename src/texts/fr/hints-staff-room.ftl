### Indices gradués de La Salle des profs (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — La File bloquée

hint-stuck-queue-queue =
    .lead = Demandez à CUPS le tableau complet : l'ordonnanceur, les files, si chacune est active et accepte les travaux, et les travaux (man lpstat).
    .solution = lpstat -t
hint-stuck-queue-error-log =
    .lead = La file a été arrêtée pour une raison : le journal de cupsd est dans /var/log/cups.
    .solution = tail -n 30 /var/log/cups/error_log
hint-stuck-queue-jobs =
    .lead = Quel travail est en tête de la file office, et quelle taille fait-il ? (man lpq)
    .solution = lpq -P office, ou lpstat -o office
hint-stuck-queue-canceled =
    .lead = Annulez ce travail, et seulement lui : cancel prend un numéro de travail, pas seulement une imprimante (man cancel).
    .solution = cancel 117
hint-stuck-queue-purged =
    .lead = Un travail annulé garde un moment son document dans le spool : cancel a une option pour le purger.
    .solution = cancel -x 117
hint-stuck-queue-enabled =
    .lead = L'imprimante est rallumée, le travail fou parti : il faut réactiver la file (man cupsenable).
    .solution = cupsenable office
hint-stuck-queue-end =
    .lead = Vérifiez que les documents des collègues s'impriment, et que le spool a maigri.
    .solution = lpstat -p office ; lpq -P office ; df -h /var

## Chapitre 2 — La Nouvelle Imprimante

hint-new-printer-discover =
    .lead = Qu'offre le réseau ? CUPS sait lister les imprimantes qui s'annoncent, et celles qui impriment sans pilote (man lpinfo, man driverless).
    .solution = driverless, ou sudo lpinfo -v
hint-new-printer-added =
    .lead = Créez une file pour le multifonction avec lpadmin : son nom, activée, son URI IPP du bon de livraison, et le modèle IPP Everywhere (man lpadmin).
    .solution = lpadmin -p staffroom -E -v ipp://mfp-staffroom.internal/ipp/print -m everywhere
hint-new-printer-default =
    .lead = La destination par défaut du serveur se règle avec lpadmin, pas lpoptions.
    .solution = lpadmin -d staffroom
hint-new-printer-pupil-printed =
    .lead = Qui peut se connecter à quel chemin, c'est dans cupsd.conf : lisez <Location />, et comparez @LOCAL aux interfaces du serveur (ip -br addr). L'access_log montre qui imprime.
    .solution = grep -A4 '<Location />' /etc/cups/cupsd.conf ; ip -br addr ; tail /var/log/cups/access_log
hint-new-printer-restricted =
    .lead = Réservez le multifonction au personnel : un <Location /printers/NOM> qui n'autorise que le réseau du personnel (puis cupsd -t et un redémarrage), ou les utilisateur·rices autorisé·es de la file (lpadmin -u).
    .solution = ajouter dans cupsd.conf : <Location /printers/staffroom> Order allow,deny / Allow 198.51.100.0/24 </Location>, puis sudo systemctl restart cups (ou lpadmin -p staffroom -u allow:@staff)
hint-new-printer-everywhere-refused =
    .lead = Maintenant la LaserJet de l'accueil : son URI est socket://, port 9100 (le bon de livraison). Essayez d'abord sans pilote, et lisez ce que répond lpadmin.
    .solution = lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m everywhere
hint-new-printer-hpcups =
    .lead = Il lui faut un pilote : lpinfo -m liste ceux qui sont installés ; ceux des imprimantes HP sont dans un paquet Debian (apt search hpcups).
    .solution = sudo apt update, puis sudo apt install printer-driver-hpcups
hint-new-printer-old-added =
    .lead = Trouvez le modèle de la LaserJet 4250 dans lpinfo -m et donnez-le à lpadmin -m.
    .solution = lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m drv:///hpcups.drv/hp-laserjet_4250.ppd
hint-new-printer-end =
    .lead = Le multifonction sans pilote et par défaut, le personnel dedans, les Chromebooks dehors (mais toujours à la bibliothèque), la LaserJet avec son pilote, cupsd qui tourne avec la configuration du fichier.
    .solution = lpstat -t ; tail /var/log/cups/access_log

## Chapitre 3 — Les Traces sur papier

hint-paper-trail-big-log =
    .lead = Qu'est-ce qui remplit /var ? Regardez la taille des journaux (man du, man df).
    .solution = df -h /var ; sudo du -sh /var/log/cups/* /var/spool/cups
hint-paper-trail-names =
    .lead = Qu'écrit cupsd dans son error_log, et à quel niveau ?
    .solution = sudo tail /var/log/cups/error_log ; grep -E 'LogLevel|MaxLogSize' /etc/cups/cupsd.conf
hint-paper-trail-history =
    .lead = Jusqu'où CUPS se souvient-il des travaux, et de leurs documents ? (man lpstat : -W ; man cupsd.conf : PreserveJobHistory, PreserveJobFiles)
    .solution = lpstat -W completed -o ; sudo ls /var/spool/cups
hint-paper-trail-loglevel =
    .lead = Remettez le niveau de journalisation à la normale et appliquez-le : cupsctl fait les deux (man cupsctl).
    .solution = cupsctl --no-debug-logging
hint-paper-trail-rotation =
    .lead = Un journal a besoin d'une rotation : celle de cupsd (MaxLogSize) ou celle de logrotate.
    .solution = cupsctl MaxLogSize=1m
hint-paper-trail-small =
    .lead = L'ancien journal de 3,9 Go est toujours là (peut-être renommé error_log.O) : il ne sert plus à rien.
    .solution = sudo rm /var/log/cups/error_log.O (ou sudo truncate -s 0 /var/log/cups/error_log)
hint-paper-trail-kept =
    .lead = Une semaine d'historique, aucun document gardé : deux directives de cupsd.conf, appliquées par un redémarrage.
    .solution = cupsctl PreserveJobHistory=1w PreserveJobFiles=No
hint-paper-trail-private =
    .lead = Qui peut voir le nom et le propriétaire d'un travail : une valeur de la politique par défaut (man cupsd.conf, JobPrivateValues).
    .solution = cupsctl JobPrivateValues=default
hint-paper-trail-cancel-policy =
    .lead = Qui peut annuler un travail : la limite Cancel-Job de la politique par défaut ; cupsctl a une option pour ça.
    .solution = cupsctl --no-user-cancel-any
hint-paper-trail-admin-closed =
    .lead = Les pages d'administration : cupsctl sait arrêter de les servir au réseau.
    .solution = cupsctl --no-remote-admin
hint-paper-trail-end =
    .lead = Tout appliqué (cupsd qui tourne avec le fichier), des journaux légers, le personnel qui imprime toujours.
    .solution = cupsctl ; df -h /var ; lpstat -t
