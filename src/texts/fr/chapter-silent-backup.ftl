### Histoire « L'École de musique », chapitre « La sauvegarde muette » : la
### tâche de sauvegarde de nuit affiche Ready mais ne copie plus rien
### depuis des semaines, et son script cachait déjà ses erreurs avant.
### Commandes, cmdlets, chemins, mots de passe et sorties ne sont pas
### traduits.

chapter-silent-backup = La sauvegarde muette
    .summary = Un fichier à restaurer, et la sauvegarde n'a rien de récent : la tâche de nuit dit Ready, pourtant elle échoue chaque nuit. Trouvez pourquoi dans son résultat et les journaux, réparez son compte, puis faites que son script signale ses échecs au lieu de les cacher.

## Fichiers

silent-backup-email-mariam =
    De :   Mariam (directrice)
    À :    vous

    Bonjour,

    Vendredi, Beatriz a supprimé par erreur le relevé bancaire de
    novembre, dans le partage Office (Office\Bank). Pouvez-vous le
    récupérer dans la sauvegarde ? La passation de Gabriel dit que la
    tâche « Nightly Backup » copie les partages dans D:\Backup chaque
    nuit à 1 h 30, et écrit ce qu'elle a fait dans
    D:\Logs\Backup\backup.log.

    Et tant que vous y êtes, pouvez-vous vérifier que la sauvegarde
    marche vraiment ? Je dormirais mieux.

    L'entrée du gestionnaire de mots de passe du compte de sauvegarde est
    exportée dans Documents\coffre-svc_backup.txt (supprimez-la quand
    vous aurez fini).

    Mariam

# { $password } : le mot de passe du compte (non traduit).
silent-backup-vault =
    Gestionnaire de mots de passe - une entrée, exportée par Mariam (14 janvier 2030)

    Titre :          portee - svc_backup
    Utilisateur :    svc_backup
    Mot de passe :   { $password }
    Modifié :        8 novembre 2029, 15 h 00 (Gabriel)
    Notes :          Compte local de la tâche Nightly Backup sur portee.
                     Règle de l'école pour les comptes de service : le mot
                     de passe n'expire jamais ; il est changé à la main une
                     fois par an (audit de l'assurance, point 4.2), et la
                     tâche le reçoit le jour même.

## Événements

silent-backup-event-ready =
    State : Ready. Cela veut seulement dire que la tâche est activée et
    attend son prochain déclencheur ; cela ne dit rien de sa dernière
    exécution. Demandez-le au planificateur (Get-ScheduledTaskInfo).
silent-backup-event-result =
    LastTaskResult : 2147943730, soit 0x80070532 en hexadécimal
    ('{"{"}0:X{"}"}' -f 2147943730) : « The password for this account has
    expired. » (le mot de passe de ce compte a expiré). L'exécution de
    cette nuit n'a même pas démarré. Depuis quand ? Le journal du script
    lui-même, D:\Logs\Backup\backup.log, dira quand il a copié pour la
    dernière fois.
silent-backup-event-own-log =
    Le dernier « copy done » date du 20 décembre. Près de quatre semaines
    sans sauvegarde, et personne n'a rien vu : la tâche échoue sans un
    bruit.
silent-backup-event-history-off =
    L'historique du planificateur de tâches est désactivé, comme sur tout
    Windows Server par défaut : rien n'a été enregistré. Activez-le
    (wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true), et
    les prochaines exécutions le seront. En attendant, les ouvertures de
    session ratées sont dans le journal Security (4625).
silent-backup-event-history-on =
    L'historique du planificateur est activé : désormais, chaque
    exécution laisse ses événements (100 démarrée, 101 n'a pas pu
    démarrer, 104 échec d'ouverture de session, 201 action terminée et
    son code de retour).
silent-backup-event-events =
    « The specified account's password has expired. » : le compte sous
    lequel tourne la tâche ne peut pas ouvrir de session. Regardez
    svc_backup lui-même (Get-LocalUser, ou net user).
silent-backup-event-expired =
    PasswordExpires : 20 décembre 2029. Le mot de passe a été défini le
    8 novembre et la stratégie locale donne 42 jours aux mots de passe :
    le 20, il a expiré, et la tâche échoue chaque nuit depuis. Pourtant,
    l'entrée du gestionnaire de mots de passe dit que les comptes de
    service de l'école n'expirent pas.
silent-backup-event-account-expires =
    /expires, c'est la date d'expiration du COMPTE, pas de son mot de
    passe : le compte svc_backup n'a jamais expiré. L'expiration du mot
    de passe se règle avec Set-LocalUser -PasswordNeverExpires.
silent-backup-event-task-password =
    Le mot de passe de svc_backup a changé, mais la tâche garde
    l'ancien : cette nuit, elle échouerait avec 0x8007052E (« The user
    name or password is incorrect »). Donnez aussi le nouveau à la tâche
    (Set-ScheduledTask -User -Password, ou schtasks /change /ru /rp).
silent-backup-event-logon-fixed =
    Le compte de la tâche peut de nouveau ouvrir une session, et son mot
    de passe n'expirera plus, comme le veut la règle de l'école. Lancez
    la tâche maintenant plutôt que d'attendre 1 h 30
    (Start-ScheduledTask), et vérifiez ce qu'elle a fait.
silent-backup-event-will-expire =
    Le compte de la tâche peut de nouveau ouvrir une session, mais son
    mot de passe expire toujours au bout de 42 jours : la même panne
    muette, dans six semaines. La règle de l'école dit que les mots de
    passe de ses comptes de service n'expirent pas.
silent-backup-event-system =
    La tâche tourne maintenant en SYSTEM : elle peut tout lire, donc elle
    « marche ». Mais un script que n'importe qui ayant l'écriture sur
    C:\Scripts peut modifier tournerait avec tous les droits sur le
    serveur. Rendez-la à svc_backup.
silent-backup-event-admin-task =
    La tâche tourne maintenant en administrateur·rice : tous les droits
    sur le serveur pour un script de copie, et votre propre mot de passe
    à tenir à jour. Rendez-la à svc_backup.
silent-backup-event-admin =
    svc_backup est maintenant dans Administrators : un compte de
    sauvegarde a besoin de lire les partages et d'écrire la sauvegarde,
    pas plus. Retirez-le du groupe.
silent-backup-event-disabled =
    La tâche ne se lance plus toute seule : plus d'échec, et plus de
    sauvegarde non plus. Elle doit tourner chaque nuit
    (Enable-ScheduledTask, et son déclencheur quotidien).
silent-backup-event-ran =
    LastTaskResult : 0, et backup.log dit « copy done ». Maintenant, le
    relevé de Beatriz : cherchez-le dans D:\Backup\Shares\Office.
silent-backup-event-missing =
    Pas de dossier Bank dans la sauvegarde, pas même un ancien. Pourtant
    la tâche a dit 0 et « copy done », chaque nuit jusqu'au 20 décembre.
    Quelque chose a échoué dans la copie, et le script n'a rien dit.
    Lisez-le : C:\Scripts\backup.ps1.
silent-backup-event-by-hand =
    Vous avez lancé le script vous-même : en administrateur·rice, vous
    pouvez tout lire, il peut donc réussir là où la tâche échoue. La
    tâche tourne sous svc_backup : ce qui compte, c'est ce que svc_backup
    peut faire (Start-ScheduledTask la lance sous son compte).
silent-backup-event-loud =
    Cette fois, le résultat de la tâche n'est pas 0 : le script a
    rencontré une erreur et l'a dit. C'est ce qu'une supervision, ou
    vous, peut voir. Alors, qu'est-ce qui a échoué ?
silent-backup-event-bank-acl =
    Bank n'hérite pas des autorisations de son parent : Beatriz l'a
    donné au groupe Office et aux administrateur·rices seulement.
    svc_backup ne peut pas le lire, donc Copy-Item l'a sauté, avec une
    erreur que personne n'a vue.
silent-backup-event-readable =
    svc_backup peut lire Bank maintenant. Relancez la tâche et vérifiez
    son résultat.
silent-backup-event-too-open =
    Maintenant les profs peuvent lire les relevés bancaires de l'école.
    Bank doit être lisible par le secrétariat et par le compte de
    sauvegarde, pas par tout le monde.
silent-backup-event-quiet-script =
    La sauvegarde a tout copié cette fois. Mais si un dossier échoue
    demain, le script répondra encore 0. Faites-lui signaler les erreurs
    ($ErrorActionPreference = 'Stop', ou try/catch avec exit 1), pour que
    LastTaskResult dise la vérité.
silent-backup-event-end =
    Mariam : « Donc le relevé de novembre n'a jamais été dans la
    sauvegarde… La banque va nous en envoyer une copie. Mais maintenant
    je sais que si la sauvegarde échoue, on le verra. Merci ! »

    Bravo ! Vous avez terminé le chapitre « La sauvegarde muette ». Et
    l'histoire « L'École de musique » est complète.

    CE QUI S'EST PASSÉ
    Deux pannes se cachaient l'une derrière l'autre. Depuis le
    20 décembre, le mot de passe de svc_backup avait expiré (« le mot de
    passe n'expire jamais » était décoché, contrairement à la règle de
    l'école) : le planificateur ne pouvait pas ouvrir de session, chaque
    nuit, LastTaskResult 0x80070532, pendant que Get-ScheduledTask
    disait toujours Ready. Et avant cela, depuis le 12 décembre, le
    script copiait tout sauf le dossier Bank de Beatriz, que svc_backup
    ne pouvait pas lire : Copy-Item écrivait une erreur non bloquante, le
    script continuait, et powershell.exe -File rendait 0. « copy done »,
    chaque nuit.

    BONNES PRATIQUES
    - Ready n'est pas un résultat : lisez LastRunTime et LastTaskResult
      (Get-ScheduledTaskInfo), et activez l'historique du planificateur.
    - Le mot de passe d'un compte de service : soit il n'expire jamais
      et on le change à la main, à date fixe, partout où il est gardé ;
      soit il expire, et quelque chose vous prévient avant. Une
      expiration que personne ne connaît, c'est une panne muette.
    - Un script lancé par une tâche doit échouer bruyamment :
      $ErrorActionPreference = 'Stop' ou -ErrorAction Stop, try/catch,
      et exit 1 en cas d'erreur ; sinon les erreurs ne sont que des
      lignes que personne ne lit.
    - Testez sous le compte de la tâche (Start-ScheduledTask), pas en
      administrateur·rice ; donnez à ce compte ce qu'il doit lire, pas
      plus : ni SYSTEM, ni Administrators.
    - Une sauvegarde n'est vérifiée que par une restauration : cherchez-y
      de temps en temps un fichier récent.

    UNE AUTRE FAÇON DE FAIRE
    Dans un domaine, un compte de service géré de groupe (gMSA) change
    son mot de passe lui-même et la tâche suit. robocopy /B, lancé par
    un membre de Backup Operators, lit les fichiers quelles que soient
    leurs autorisations, avec le privilège de sauvegarde ; Windows Server
    Backup (wbadmin) sauvegarde des volumes entiers.

    DOCUMENTATION
    - Get-ScheduledTaskInfo : https://learn.microsoft.com/powershell/module/scheduledtasks/get-scheduledtaskinfo
    - Codes d'erreur et de succès du planificateur : https://learn.microsoft.com/windows/win32/taskschd/task-scheduler-error-and-success-constants
    - about_Try_Catch_Finally : https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_try_catch_finally?view=powershell-5.1
    - about_Preference_Variables ($ErrorActionPreference) : https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_preference_variables?view=powershell-5.1
    - Set-LocalUser : https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/set-localuser?view=powershell-5.1
    - Comptes de service gérés de groupe : https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
