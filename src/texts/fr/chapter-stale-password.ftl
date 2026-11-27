### Histoire « Le Catalogue », chapitre « Le mot de passe périmé » : un
### compte se verrouille tous les matins ; les événements du contrôleur
### de domaine désignent le serveur de fichiers, où une tâche planifiée
### garde l'ancien mot de passe. Commandes, cmdlets, noms de comptes,
### chemins, mots de passe et sorties ne sont pas traduits.

chapter-stale-password = Le mot de passe périmé
    .summary = Le compte de Rafael se verrouille tous les matins, et le déverrouiller ne tient qu'une heure. Trouvez quel ordinateur essaie encore son ancien mot de passe, corrigez ce qui l'a gardé, puis déverrouillez-le, sans affaiblir la stratégie de verrouillage.

## Fichiers

stale-password-email-nandini =
    De :   Nandini Mukherjee (directrice du réseau)
    À :    vous

    Bonjour,

    Rafael (archives, Central) est ENCORE verrouillé. Troisième matin
    d'affilée. Lundi, Windows lui a dit que son mot de passe avait
    expiré, il l'a changé à son poste, et depuis il est verrouillé dans
    l'heure. Je l'ai déverrouillé lundi et hier (Tomas m'avait montré) :
    ça tient un moment, puis ça recommence.

    Il jure qu'il tape le bon mot de passe, seulement sur son PC de la
    banque d'accueil de Central, et qu'il n'a noté l'ancien nulle part.

    Pouvez-vous trouver ce qui se passe ? Tomas m'a dit que les mots de
    passe des comptes de service pourraient servir, alors j'ai exporté
    leurs entrées du coffre : Documents\coffre-comptes-service.txt.
    Supprimez-le quand vous aurez fini.

    Nandini

# { $scans }, { $backup } : les mots de passe des comptes (non traduits).
stale-password-vault =
    Gestionnaire de mots de passe - dossier « Comptes de service », exporté par Nandini (9 janvier 2030)

    Titre :          LENDING - svc_backup
    Utilisateur :    LENDING\svc_backup
    Mot de passe :   { $backup }
    Modifié :        15 mars 2029 (Tomas)
    Notes :          Compte de service. OU=Service Accounts, mot de
                     passe sans expiration.

    Titre :          LENDING - svc_scans
    Utilisateur :    LENDING\svc_scans
    Mot de passe :   { $scans }
    Modifié :        12 décembre 2029 (Tomas)
    Notes :          Compte de service. OU=Service Accounts, mot de
                     passe sans expiration.

## Le temps qui passe

stale-password-relocked =
    Une demi-heure plus tard, le téléphone : Rafael est de nouveau
    verrouillé. Déverrouiller remet le compteur à zéro, pas sa cause :
    quelque chose essaie toujours son ancien mot de passe, et cinq
    essais faux verrouillent le compte pour 30 minutes.
stale-password-holds =
    Une demi-heure plus tard, Rafael est toujours connecté, et aucun
    nouveau 4740 sur registre.

## Événements

stale-password-event-locked =
    rsilva, LockedOut. Un compte verrouillé n'est pas un compte
    désactivé : le domaine refuse même le bon mot de passe pendant 30
    minutes (la Default Domain Policy), après cinq faux. Combien, et
    quand ?
stale-password-event-bad-logons =
    PasswordLastSet : lundi, 8 h 52. Des mots de passe faux depuis, à un
    rythme régulier : une personne qui se trompe en tapant ne garde pas
    cette cadence. Quel ordinateur les envoie ? Le contrôleur de domaine
    l'écrit dans son journal Security, dans l'événement de verrouillage :
    4740.
stale-password-event-caller =
    « Caller Computer Name » : l'ordinateur qui a demandé au contrôleur
    de domaine de vérifier le mot de passe. Ce n'est pas le PC de Rafael :
    c'est le serveur de fichiers. Quelque chose, sur ce serveur, se
    connecte en tant que Rafael. Depuis registre, le client OpenSSH de
    Windows y va : ssh suivi de son nom.
stale-password-event-on-stacks =
    Vous êtes sur le serveur de fichiers, en Domain Admin. Son propre
    journal Security a les connexions échouées (4625), avec leur type de
    connexion (Logon Type) : 2 au clavier, 3 depuis le réseau, 4 un
    traitement par lots, 5 un service.
stale-password-event-logon-type =
    Logon Type 4 : une connexion de traitement par lots, celle que fait
    une tâche planifiée. Une tâche qui tourne en tant que Rafael, avec un
    mot de passe enregistré quand elle a été créée.
stale-password-event-task =
    L'import des scans : Tomas l'a mis en place en septembre sous le
    compte de Rafael lui-même, « Exécuter même si l'utilisateur n'est pas
    connecté », toutes les 5 minutes. Le Planificateur de tâches a gardé
    le mot de passe qu'il avait alors. Lundi, Rafael l'a changé ; la
    tâche a gardé l'ancien, et l'essaie douze fois par heure. Cinq essais
    faux : verrouillé.
stale-password-event-policy =
    La stratégie de verrouillage est plus faible maintenant. Elle
    cacherait le symptôme pour tous les comptes du domaine, et laisserait
    libre le devinement de mots de passe sur tous ; la tâche échouerait
    toujours. Remettez-la comme elle était (5 essais, 30 minutes) :
    Set-ADDefaultDomainPasswordPolicy.
stale-password-event-reset =
    Vous avez réinitialisé le mot de passe de Rafael : il ne connaît pas
    le nouveau, une réinitialisation ne déverrouille pas le compte, et la
    tâche garde toujours l'ancien, qui a maintenant deux mots de passe de
    retard. Ce qui garde un mot de passe doit être mis à jour, pas la
    personne.
stale-password-event-system =
    L'import tourne maintenant en SYSTEM : il ne verrouille plus personne,
    mais il peut tout faire sur le serveur de fichiers, chaque partage,
    chaque fichier. La tâche n'a qu'à déplacer des scans dans Archives :
    c'est pour ça que svc_scans a été créé.
stale-password-event-person =
    L'import tourne de nouveau sous le compte d'une personne (ou d'un
    administrateur). La prochaine fois que cette personne changera de
    mot de passe, ou partira, l'import cassera, ou la verrouillera. Une
    tâche a son propre compte de service : svc_scans, son mot de passe
    dans le coffre.
stale-password-event-read-only =
    L'import tourne maintenant en svc_backup : un compte de service, mais
    celui de la copie hors site, qui ne peut que lire Archives
    (DL_Archives_RO). Les scans resteraient dans D:\Scans. Quel compte a
    été créé pour l'import ? Sa description le dit (Get-ADUser
    -Properties Description).
stale-password-event-task-off =
    L'import des scans ne tourne plus : Rafael ne sera plus verrouillé,
    mais les PDF du scanner des archives s'entassent dans D:\Scans sans
    jamais arriver dans Archives. Réparez la tâche plutôt que de
    l'arrêter : sous svc_scans.
stale-password-event-fixed =
    L'import tourne en svc_scans maintenant, avec son propre mot de
    passe : plus rien, sur rayons, n'essaie le mot de passe de Rafael. Il
    est encore verrouillé, cependant : le verrouillage dure 30 minutes,
    ou jusqu'à ce qu'un·e administrateur·rice déverrouille le compte.
stale-password-event-fixed-unlocked =
    L'import tourne en svc_scans maintenant, avec son propre mot de
    passe : plus rien, sur rayons, n'essaie le mot de passe de Rafael.
stale-password-event-vault-deleted =
    L'entrée exportée est supprimée : le mot de passe reste dans le
    coffre et dans la tâche, nulle part ailleurs. Merci, dit Nandini.
stale-password-event-end =
    Rafael : « Une demi-heure, et toujours connecté ! Et mes scans sont
    dans Archives. Merci ! »

    Bravo ! Vous avez terminé le chapitre « Le mot de passe périmé ».

    CE QUI S'EST PASSÉ
    En septembre, Tomas a mis en place l'import des scans sur rayons,
    une tâche planifiée sous le compte de Rafael ; le Planificateur de
    tâches a gardé son mot de passe. Lundi, le mot de passe de Rafael a
    expiré et il l'a changé ; la tâche a continué d'essayer l'ancien
    toutes les 5 minutes. Après cinq essais faux, le domaine verrouille
    un compte pour 30 minutes : déverrouillé ou non, Rafael l'était de
    nouveau dans l'heure. L'événement 4740 du contrôleur de domaine a
    nommé l'ordinateur (RAYONS), les 4625 de celui-ci le type de
    connexion (4, par lots), et la tâche a montré son principal. Vous
    avez donné à la tâche son propre compte de service, puis déverrouillé
    Rafael.

    BONNES PRATIQUES
    - Un verrouillage qui revient a une source : Search-ADAccount
      -LockedOut, Get-ADUser -Properties BadLogonCount,
      LastBadPasswordAttempt, puis l'événement 4740 sur le contrôleur
      de domaine (l'émulateur PDC) pour l'ordinateur appelant, et 4625
      sur celui-ci pour le type de connexion.
    - Les sources habituelles : tâches planifiées, services, lecteurs
      réseau avec des identifiants enregistrés (cmdkey), un téléphone qui
      synchronise encore les mails.
    - Corriger la source d'abord, déverrouiller ensuite : l'ordre inverse
      n'achète qu'une demi-heure.
    - Les tâches tournent sous des comptes de service, jamais sous celui
      d'une personne : les gens changent de mot de passe et partent. Dans
      un domaine, un compte de service administré de groupe (gMSA) change
      même son mot de passe tout seul.
    - Ne pas affaiblir la stratégie de verrouillage pour faire taire un
      symptôme : elle protège tous les comptes contre le devinement de
      mots de passe.

    COMME « L'ANNUAIRE », EN ACTIVE DIRECTORY
    LockedOut, BadLogonCount et LastBadPasswordAttempt sont des attributs
    de l'annuaire (lockoutTime, badPwdCount, badPasswordTime), qu'un
    filtre LDAP sait chercher, comme avec ldapsearch :
    Get-ADUser -LDAPFilter '(lockoutTime>=1)'.

    DOCUMENTATION
    - Événement 4740 : https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4740
    - Événement 4625 et les types de connexion : https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4625
    - Search-ADAccount : https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount
    - Unlock-ADAccount : https://learn.microsoft.com/powershell/module/activedirectory/unlock-adaccount
    - Set-ScheduledTask : https://learn.microsoft.com/powershell/module/scheduledtasks/set-scheduledtask
    - Seuil de verrouillage de compte : https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/account-lockout-threshold
    - Comptes de service administrés de groupe : https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
