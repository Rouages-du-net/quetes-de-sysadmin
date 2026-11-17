### Histoire « L'École de musique », chapitre « La crue des journaux » : le
### volume de données est plein des journaux de l'appli de réservation,
### laissée en niveau debug depuis juin. Commandes, cmdlets, chemins et
### sorties ne sont pas traduits.

chapter-log-flood = La crue des journaux
    .summary = L'appli de réservation ne peut plus rien enregistrer et les profs ne peuvent plus enregistrer dans leur partage : le volume de données est plein. Trouvez ce qui le remplit, libérez de la place sans perdre les journaux dont le secrétariat a besoin, et empêchez qu'il se remplisse à nouveau.

## Fichiers

log-flood-email-beatriz =
    De :   Beatriz (secrétariat)
    À :    vous

    Bonjour,

    Depuis hier soir, l'Agenda répond « Could not save the booking » à
    chaque nouvelle réservation, et ce matin Samir n'a pas pu
    enregistrer son plan d'orchestre dans le partage Teachers : « There
    is not enough space on the disk ».

    Gabriel nous avait dit en juin qu'il avait « monté les journaux de
    l'Agenda » pour traquer les doubles réservations. Les a-t-il jamais
    redescendus ?

    Attention : je suis encore en train de régler le cas de la famille
    débitée deux fois le 4 décembre, et j'ai besoin des journaux de
    l'Agenda de ces semaines-là. La règle de Mariam : on garde toujours
    les 30 derniers jours de journaux.

    Merci !
    Beatriz

## Événements

log-flood-event-full =
    D: (Data) n'a plus que quelques centaines de mégaoctets sur 500 Go :
    pas étonnant que rien ne s'enregistre. Qu'est-ce qui prend toute
    cette place ? Cherchez les plus gros fichiers de D:\
    (Get-ChildItem -Recurse -File, Sort-Object Length).
log-flood-event-culprit =
    D:\Logs\Agenda : un fichier par jour depuis le 12 juin,
    agenda-2029-06-12.log et ainsi de suite, de plusieurs Go chacun.
    L'Agenda commence un nouveau journal à minuit et rien ne supprime
    jamais les anciens. Mais pourquoi si gros ? Sa configuration est dans
    C:\ProgramData\Agenda\agenda.ini.
log-flood-event-level =
    level=debug : l'Agenda écrit chaque requête, chaque requête SQL,
    chaque consultation du cache. Le fichier a été modifié pour la
    dernière fois le 12 juin : le dépannage de Gabriel, jamais défait.
    D'abord libérer de la place, puis redescendre le niveau.
log-flood-event-whatif =
    -WhatIf liste ce qui partirait, sans rien supprimer. Vérifiez la
    liste : seulement des journaux de plus de 30 jours, rien des
    semaines dont Beatriz a besoin, pas l'agenda.log en cours.
log-flood-event-in-use =
    agenda.log est le journal en cours de l'Agenda : le service le tient
    ouvert, et Windows refuse de supprimer un fichier qu'un autre
    processus utilise. C'est une sécurité : le journal en cours est
    celui d'aujourd'hui, et la place est dans les anciens.
log-flood-event-recent-deleted =
    Des journaux des 30 derniers jours ont disparu, et Beatriz en avait
    besoin pour le double débit du 4 décembre. Sans copie, ils ne
    reviendront pas : recommencez le chapitre (ou utilisez l'instantané
    de secours) et ne supprimez que les plus anciens
    (Where-Object LastWriteTime -lt (Get-Date).AddDays(-30)).
log-flood-event-current-deleted =
    L'agenda.log en cours a disparu, avec les erreurs de ce matin :
    les traces de l'incident. La prochaine fois, arrêtez-vous aux
    anciens journaux.
log-flood-event-backup-deleted =
    La sauvegarde dans D:\Backup n'est pas ce qui remplit le disque, et
    la supprimer laisse l'école sans copie de ses partages. Recommencez
    le chapitre (ou utilisez l'instantané de secours) : la place est
    dans les anciens journaux.
log-flood-event-compressed =
    La compression NTFS réduit beaucoup les journaux texte, et elle
    libère bien de la place. Mais en niveau debug, l'Agenda continue
    d'écrire plusieurs Go par jour : le disque se remplit à nouveau, un
    peu plus tard. Les journaux plus vieux que la durée de conservation
    n'ont aucune raison d'être gardés ; et la vraie cause, c'est le
    niveau.
log-flood-event-freed =
    D: a de nouveau de la place, et les 30 derniers jours de journaux
    sont toujours là. Reste la cause : en niveau debug, il sera de
    nouveau plein dans quelques mois. Baissez le niveau dans agenda.ini.
log-flood-event-freed-quiet =
    D: a de nouveau de la place, et les 30 derniers jours de journaux
    sont toujours là.
log-flood-event-not-applied =
    agenda.ini indique maintenant un niveau plus bas, mais l'Agenda a lu
    sa configuration à son démarrage, en debug : il continue d'écrire
    chaque requête jusqu'à son prochain démarrage (Restart-Service).
log-flood-event-stopped =
    L'Agenda est arrêté : plus personne ne peut réserver un cours.
    Relancez-le (Start-Service Agenda).
log-flood-event-quieter =
    L'Agenda tourne avec un niveau de journal plus discret : quelques Mo
    par jour au lieu de plusieurs Go. Reste la place à libérer sur D:.
log-flood-event-quieter-freed =
    L'Agenda tourne avec un niveau de journal plus discret : quelques Mo
    par jour au lieu de plusieurs Go.
log-flood-event-cleanup-task =
    Une tâche planifiée de nettoyage : une bonne deuxième barrière, pour
    que les anciens journaux ne s'accumulent plus jamais, quel que soit
    le niveau. Vérifiez qu'elle garde 30 jours, et testez-la une fois
    (Start-ScheduledTask) avant de lui faire confiance.
log-flood-event-end =
    Beatriz : « L'Agenda enregistre de nouveau les réservations, et Samir
    a enregistré son plan. Et j'ai toujours mes journaux de début
    décembre, merci ! »

    Bravo ! Vous avez terminé le chapitre « La crue des journaux ».

    CE QUI S'EST PASSÉ
    En juin, Gabriel a mis le niveau de journal de l'Agenda en debug pour
    traquer un bug, et ne l'a jamais remis. L'Agenda commence un nouveau
    fichier de journal chaque nuit à minuit, et rien ne supprime les
    anciens : six mois de journaux debug, quelques Go par jour, ont
    rempli les 500 Go de D:. Vous avez trouvé la cause par la taille,
    supprimé seulement les journaux plus vieux que les 30 jours que
    l'école garde (après un -WhatIf), et remis un niveau normal, en
    redémarrant le service pour qu'il le lise.

    BONNES PRATIQUES
    - Chercher avant de supprimer : Get-Volume pour le volume,
      Get-ChildItem -Recurse -File | Sort-Object Length -Descending pour
      les plus gros fichiers, Measure-Object -Sum pour le total d'un
      dossier.
    - Supprimer selon un critère vérifiable (LastWriteTime plus ancien
      que la durée de conservation), avec -WhatIf d'abord.
    - Un fichier qu'un service tient ouvert ne peut pas être supprimé,
      et ne doit pas l'être : c'est le journal en cours.
    - Le niveau debug, c'est pour le temps d'une enquête : notez-le, et
      coupez-le une fois fini. Un service lit sa configuration à son
      démarrage.
    - Chaque journal a besoin d'une durée de conservation : une tâche de
      nettoyage (Register-ScheduledTask) ou le réglage de l'appli, et une
      surveillance de l'espace libre qui prévient avant 100 %.

    UNE AUTRE FAÇON DE FAIRE
    La compression NTFS (compact /c) réduit les vieux journaux texte,
    s'il faut les garder ; elle n'arrête pas ce qui remplit le disque.
    IIS a ses propres réglages de journaux (rollover), et rien ne
    supprime ses anciens journaux non plus : une tâche planifiée est la
    méthode habituelle.

    DOCUMENTATION
    - Get-Volume : https://learn.microsoft.com/powershell/module/storage/get-volume
    - Remove-Item : https://learn.microsoft.com/powershell/module/microsoft.powershell.management/remove-item?view=powershell-5.1
    - Where-Object : https://learn.microsoft.com/powershell/module/microsoft.powershell.core/where-object?view=powershell-5.1
    - Register-ScheduledTask : https://learn.microsoft.com/powershell/module/scheduledtasks/register-scheduledtask
    - compact : https://learn.microsoft.com/windows-server/administration/windows-commands/compact
