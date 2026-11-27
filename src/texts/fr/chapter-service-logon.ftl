### Histoire « L'École de musique », chapitre « Le service à la porte » : le
### service de l'appli de réservation ne démarre plus après le changement
### du mot de passe de son compte et le redémarrage du serveur. Commandes,
### cmdlets, chemins, mots de passe et sorties ne sont pas traduits.

chapter-service-logon = Le service à la porte
    .summary = L'appli de réservation de l'école est en panne depuis le redémarrage du serveur : son service refuse de démarrer. Trouvez pourquoi dans le journal d'événements, puis donnez au service le nouveau mot de passe de son compte, sans lui donner plus de droits qu'il n'en faut.

## Fichiers

service-logon-email-mariam =
    De :   Mariam (directrice)
    À :    vous

    Bonjour,

    L'Agenda est en panne : depuis ce matin, les profs et le secrétariat
    ont « Ce site est inaccessible » sur http://portee.internal:8080, et
    les familles ne peuvent plus réserver leurs cours d'essai.

    Le serveur a redémarré dimanche dans la nuit pour Windows Update.
    Gabriel, qui s'en occupait, est parti vendredi ; au cas où, je vous
    ai exporté les entrées du serveur dans le gestionnaire de mots de
    passe, dans Documents\coffre-comptes-service.txt. Supprimez ce
    fichier quand vous aurez fini, s'il vous plaît.

    Pouvez-vous remettre l'Agenda en route, sans rien casser d'autre ?

    Mariam

# { $agenda }, { $backup }, { $admin } : les mots de passe (non traduits).
service-logon-vault =
    Gestionnaire de mots de passe - dossier « portee », exporté par Mariam (10 décembre 2029)

    Titre :          portee - svc_backup
    Utilisateur :    svc_backup
    Mot de passe :   { $backup }
    Modifié :        3 juin 2029 (Gabriel)
    Notes :          Compte local. Changé chaque année (audit de
                     l'assurance, point 4.2).

    Titre :          portee - svc_agenda
    Utilisateur :    svc_agenda
    Mot de passe :   { $agenda }
    Modifié :        7 décembre 2029, 16 h 42 (Gabriel)
    Notes :          Compte local. Changé chaque année (audit de
                     l'assurance, point 4.2).

    Titre :          Agenda - admin web
    Utilisateur :    admin
    Mot de passe :   { $admin }
    Modifié :        2 septembre 2029 (Gabriel)
    Notes :          http://portee.internal:8080/admin

## Événements

service-logon-event-stopped =
    L'Agenda est arrêté (Stopped), alors que son type de démarrage est
    Automatic : il aurait dû démarrer avec le serveur dimanche dans la
    nuit. Essayez de le démarrer, et lisez ce que Windows répond.
service-logon-event-start-failed =
    Refusé. L'erreur elle-même en dit peu ; Windows écrit les détails dans
    son journal d'événements, au nom du Service Control Manager, la partie
    de Windows qui démarre les services : le journal System
    (Get-WinEvent, Get-EventLog).
service-logon-event-events =
    Événement 7038 : l'Agenda « was unable to log on as .\svc_agenda with
    the currently configured password » (n'a pas pu ouvrir de session avec
    le mot de passe configuré), puis 7000 : « logon failure ». Le service
    démarre sous son propre compte, avec un mot de passe que Windows a
    gardé quand on a configuré le service. Quel compte, exactement ?
    (Get-CimInstance Win32_Service, ou sc.exe qc)
service-logon-event-account =
    StartName : .\svc_agenda, le compte local (le point veut dire cet
    ordinateur). Windows garde le mot de passe de ce compte avec le
    service : si quelqu'un a changé le mot de passe du compte, la copie
    du service n'a pas suivi. Quand a-t-il été défini pour la dernière
    fois ? (Get-LocalUser, PasswordLastSet)
service-logon-event-rotated =
    PasswordLastSet : vendredi, 16 h 42, le dernier jour de Gabriel
    (l'audit de l'assurance demande de nouveaux mots de passe de service
    chaque année). Le service a continué de tourner sur sa connexion
    jusqu'au redémarrage de dimanche, puis a essayé l'ancien. Le nouveau
    est dans les entrées que Mariam a exportées : celle du compte sous
    lequel le service se connecte.
service-logon-event-other-account =
    L'Agenda se connecte maintenant en { $account } : un compte fait pour
    un autre travail, avec des droits dont l'application de réservation
    n'a pas besoin (svc_backup est Backup Operator : il peut lire tous les
    fichiers du serveur). L'Agenda a son propre compte, celui que donnait
    son StartName : svc_agenda.
service-logon-event-sc-alias =
    Dans PowerShell, sc n'est pas sc.exe : c'est un alias de Set-Content,
    qui écrit dans des fichiers, et qui ne sait que faire de obj=. Tapez
    sc.exe en entier (dans cmd.exe, sc suffit).
service-logon-event-local-system =
    L'Agenda tourne maintenant en LocalSystem : il démarre, mais avec tous
    les droits sur le serveur, les fichiers du système, les partages, les
    autres services. Une faille dans l'appli de réservation deviendrait
    une faille de tout le serveur. Remettez-le sur son propre compte,
    svc_agenda, avec son mot de passe (sc.exe config … obj= … password= …).
service-logon-event-reset =
    Vous avez encore changé le mot de passe de svc_agenda. Le gestionnaire
    de mots de passe en a maintenant un ancien, et le service un plus
    ancien encore : tout ce qui utilise ce compte doit recevoir le nouveau
    mot de passe (le service, le gestionnaire), sinon le prochain
    démarrage échouera de la même façon.
service-logon-event-wrong-password =
    Le service a maintenant un mot de passe qui n'est pas celui du compte :
    son prochain démarrage échouera avec le même 7038. Recopiez-le
    exactement depuis l'entrée du gestionnaire de mots de passe.
service-logon-event-start-type =
    L'Agenda ne démarre plus avec le serveur : il serait de nouveau en
    panne au prochain redémarrage de Windows Update. Son type de démarrage
    doit être Automatic (Set-Service -StartupType, ou sc.exe config …
    start= auto).
service-logon-event-admin =
    svc_agenda est maintenant dans Administrators : l'appli de réservation
    aurait tous les droits sur le serveur. Un compte de service reçoit les
    droits dont son appli a besoin, pas plus. Retirez-le du groupe
    (Remove-LocalGroupMember).
service-logon-event-configured =
    Le service a maintenant le nouveau mot de passe du compte. Démarrez-le,
    et vérifiez qu'il tourne.
service-logon-event-vault-deleted =
    L'entrée exportée est supprimée : le mot de passe reste dans le
    gestionnaire, et nulle part ailleurs sur le serveur. Merci, dit Mariam.
service-logon-event-end =
    Mariam : « L'Agenda est revenu, les familles réservent de nouveau.
    Merci ! Je l'écris dans la procédure : quand le mot de passe d'un
    service change, le service le reçoit le jour même, et on le
    redémarre pour vérifier. »

    Bravo ! Vous avez terminé le chapitre « Le service à la porte ».

    CE QUI S'EST PASSÉ
    Un service Windows démarre sous un compte d'ouverture de session ;
    pour un compte local, le Service Control Manager garde son mot de
    passe avec la configuration du service. Gabriel a eu raison de changer
    le mot de passe de svc_agenda, mais pas la copie qu'en gardait le
    service. L'Agenda a continué de tourner jusqu'au redémarrage des mises
    à jour de dimanche, puis n'a pas pu ouvrir de session : 7038 et 7000
    dans le journal System, erreur 1069. Vous avez donné au service le
    nouveau mot de passe tiré du gestionnaire (sc.exe config), et l'avez
    démarré sous son propre compte.

    BONNES PRATIQUES
    - Changer le mot de passe d'un compte de service, c'est mettre à jour
      tout ce qui le garde : services (Get-CimInstance Win32_Service,
      StartName), tâches planifiées (Get-ScheduledTask, leur Principal),
      scripts.
    - Redémarrez le service juste après le changement : un échec se voit
      le jour même, pas au prochain redémarrage, à 3 h du matin.
    - Le journal System dit pourquoi : l'événement 7038 nomme le compte,
      7000 le service.
    - Moindre privilège : un service tourne sous son propre compte, avec
      les droits dont il a besoin, ni en LocalSystem ni en administrateur.
    - Les mots de passe vivent dans le gestionnaire ; un export se
      supprime une fois utilisé.

    UNE AUTRE FAÇON DE FAIRE
    Dans un domaine, un compte de service géré de groupe (gMSA) change
    son mot de passe lui-même et les services suivent, sans rien
    retaper. Sur un serveur seul, un compte virtuel (NT SERVICE\Agenda)
    n'a pas de mot de passe du tout, quand l'appli n'a besoin que de
    droits locaux. La console Services (services.msc), onglet Connexion,
    fait ce que fait sc.exe config.

    DOCUMENTATION
    - Comptes des services : https://learn.microsoft.com/windows/win32/services/service-user-accounts
    - sc.exe config : https://learn.microsoft.com/windows-server/administration/windows-commands/sc-config
    - Événements 7000, 7011, 7009 : https://learn.microsoft.com/troubleshoot/windows-server/system-management-components/event-id-7000-7011-7009
    - Get-WinEvent : https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1
    - Comptes de service gérés de groupe : https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
