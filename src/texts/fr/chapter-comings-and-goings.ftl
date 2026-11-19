### Histoire « Le Catalogue », chapitre « Arrivées et départs » : un
### nouveau bibliothécaire commence lundi, une autre personne est partie
### aujourd'hui. Les textes partagés de l'histoire (la passation de Tomas,
### les conventions) sont ici aussi. Commandes, cmdlets, noms de comptes,
### DN, chemins, mots de passe et sorties ne sont pas traduits.

chapter-comings-and-goings = Arrivées et départs
    .summary = Votre premier vendredi sur le contrôleur de domaine des bibliothèques : créez le compte du bibliothécaire qui commence lundi, avec les droits de son poste et pas plus, et fermez le compte de celui qui est parti aujourd'hui, sans le supprimer.

## Les fichiers partagés de l'histoire

card-catalogue-handover =
    registre - notes de passation (Tomas, 20 décembre 2029)

    Le domaine : lending.internal (nom NetBIOS LENDING), trois
    bibliothèques : Central, Riverside, Hilltop (la centrale, celle du
    bord de l'eau, celle de la colline).
      - registre.internal (192.0.2.46) : le contrôleur de domaine,
        Windows Server 2022 (Active Directory, DNS). OpenSSH arrive ici
        dans PowerShell, avec votre clé. Le module ActiveDirectory est
        installé : Get-Command -Module ActiveDirectory.
      - rayons (192.0.2.47) : le serveur de fichiers (partages Staff,
        Events, Archives, Finance, Scans). Depuis registre : ssh rayons
        (votre clé est dans %USERPROFILE%\.ssh, et autorisée là-bas).

    Vous êtes dans Domain Admins : tous les comptes, tous les groupes,
    tous les serveurs. Avec douceur. Lisez Documents\conventions.txt
    avant de créer quoi que ce soit.

    Ce que je n'ai pas fini :
      - svc_scans (OU=Service Accounts) : créé en décembre pour remplacer
        le compte de Rafael dans la tâche d'import des scans sur rayons.
        Pas encore basculé. Son mot de passe est dans le coffre (Nandini
        peut l'exporter).
      - Le lecteur Events (GPO « Events Drive ») n'est lié que là où je
        l'ai testé.
      - Un ménage des vieux comptes (certains ne se sont pas connectés
        depuis des mois).

    Bon courage. Je suis au service informatique de la ville
    maintenant, vous pouvez m'appeler.
    Tomas

card-catalogue-conventions =
    LENDING - comment le domaine est organisé (Tomas)

    COMPTES
      - Nom (sAMAccountName) : première lettre du prénom + nom de
        famille, en minuscules, sans accents : Thanh Nguyen -> tnguyen.
      - Nom complet (Name, CN) : « Prénom Nom ». GivenName et Surname
        remplis.
      - Où : OU=<bibliothèque>,OU=Branches,DC=lending,DC=internal
        (Central, Riverside ou Hilltop).
      - Department, Title et Manager : comme les RH les écrivent dans
        le ticket.
      - Premier mot de passe : choisi par nous, remis en main propre par
        le ou la responsable le premier matin, à changer à la première
        connexion. Le domaine veut au moins 10 caractères, trois sortes
        (majuscules, minuscules, chiffres, symboles), et pas le nom de
        la personne.

    GROUPES (AGDLP)
      - A comme Accounts (les comptes) dans G comme groupes Globaux, un
        par service : GG_Lending, GG_Children, GG_LocalHistory,
        GG_Management.
      - Les groupes globaux dans DL comme groupes de Domaine Locaux, un
        par partage et par niveau : DL_Staff_RW, DL_Events_RW,
        DL_Archives_RW, DL_Archives_RO, DL_Finance_RW.
      - P comme Permissions : seuls les groupes DL_ apparaissent dans les
        permissions NTFS de rayons.
      - Une personne va donc dans le groupe GG_ de son service, et nulle
        part ailleurs. Les exceptions sont écrites dans le ticket du
        compte.

    DÉPARTS
      - Jamais supprimés avant un an : leur SID possède des fichiers sur
        rayons, leur boîte mail est archivée, les auditeur·rices peuvent
        poser des questions.
      - Le dernier jour : désactivé, déplacé dans OU=Leavers, retiré de
        ses groupes. La description dit quand la personne est partie.

## Fichiers

comings-and-goings-email-nandini =
    De :   Nandini Mukherjee (directrice du réseau)
    À :    vous

    Bonjour, et bienvenue !

    Deux tickets RH pour vous avant le week-end, tous deux dans vos
    Documents :

      - rh-0112-arrivee.txt : Kofi Mensah commence lundi à Riverside.
        Ines lui donnera son mot de passe à 9 h.
      - rh-0113-depart.txt : Mateo Rossi a quitté Hilltop aujourd'hui.
        Son dernier jour s'est bien passé ; on reste en contact.

    Les conventions de Tomas sont dans Documents\conventions.txt. Bon
    week-end !

    Nandini

comings-and-goings-ticket-arrival =
    Ticket RH 0112 - ARRIVÉE
    Ouvert le 2 janvier 2030 par les RH (Rebecca Owusu)

    Nom :           Kofi Mensah
    Début :         lundi 7 janvier 2030
    Bibliothèque :  Riverside
    Department :    Children
    Title :         Youth Librarian
    Manager :       Ines Duarte (iduarte)

    Accès : « les mêmes qu'Amara Okoye, même poste, même bibliothèque ».
    Si c'est plus simple, copiez le compte d'Amara.

    Exceptions : aucune.

comings-and-goings-ticket-departure =
    Ticket RH 0113 - DÉPART
    Ouvert le 4 janvier 2030 par les RH (Rebecca Owusu)

    Nom :           Mateo Rossi (mrossi)
    Dernier jour :  vendredi 4 janvier 2030
    Bibliothèque :  Hilltop
    Department :    Lending

    Merci de fermer ses accès ce soir. Ses fichiers sur le partage Staff
    restent où ils sont : Bongani fera le tri.

## Événements

comings-and-goings-event-ous =
    L'arbre du domaine : OU=Branches contient une OU par bibliothèque,
    les gens y vivent ; Groups, Leavers, Servers, Service Accounts et
    Workstations à côté. Un DN se lit de l'objet jusqu'au domaine, comme
    dans « L'annuaire » : celui de Kofi serait
    CN=Kofi Mensah,OU=Riverside,OU=Branches,DC=lending,DC=internal.
comings-and-goings-event-colleague =
    Amara est plus qu'une bibliothécaire jeunesse : elle est dans
    GG_Management (adjointe par intérim à Riverside depuis l'automne)
    et, directement, dans DL_Finance_RW, une exception le temps qu'elle
    gère le budget. « Les mêmes qu'Amara » donnerait à Kofi le partage
    des finances dès son premier jour. Donnez-lui le groupe de son
    poste, pas l'historique de sa collègue.
comings-and-goings-event-agdlp =
    Le voilà, AGDLP : DL_Events_RW, le groupe des permissions NTFS du
    partage, ne contient pas des personnes mais des groupes globaux,
    GG_Children et GG_Management. Un nouveau bibliothécaire jeunesse n'a
    besoin que de GG_Children : l'imbrication fait le reste.
comings-and-goings-event-complexity =
    Refusé : la politique de mots de passe du domaine (Default Domain
    Policy) veut au moins 10 caractères, trois sortes de caractères, et
    rien du nom du compte ni du nom de la personne. Attention :
    New-ADUser a quand même créé le compte, sans mot de passe et
    désactivé. Donnez-lui un mot de passe avec Set-ADAccountPassword
    -Reset, ou supprimez ce compte à moitié fait et recommencez.
comings-and-goings-event-other-name =
    Ce compte n'est pas nommé comme le disent les conventions : la
    première lettre du prénom et le nom, en minuscules, kmensah. Tous
    les scripts et tous les collègues chercheront kmensah. Renommez-le
    (Set-ADUser -SamAccountName, et son UserPrincipalName), ou
    supprimez-le et recréez-le.
comings-and-goings-event-created =
    Le compte de Kofi existe. Vérifiez-le comme le ticket se lit :
    Get-ADUser kmensah -Properties Department, Title, Manager, Enabled.
comings-and-goings-event-created-disabled =
    Le compte est désactivé : New-ADUser crée un compte désactivé, sauf
    si on lui donne un mot de passe que le domaine accepte et -Enabled
    $true. Enable-ADAccount, une fois qu'il a un mot de passe.
comings-and-goings-event-wrong-ou =
    Kofi n'est pas dans OU=Riverside,OU=Branches : les stratégies et les
    délégations de la bibliothèque ne l'atteindront pas là. Move-ADObject
    déplace un objet dans une autre OU (-TargetPath, un DN).
comings-and-goings-event-copied =
    Kofi a maintenant les extras d'Amara : GG_Management, ou
    DL_Finance_RW, les budgets et les factures. C'est le piège de la
    copie d'une collègue : on copie son historique, ses exceptions, ses
    intérims, pas son poste. Retirez-le de ces groupes
    (Remove-ADGroupMember, ou Remove-ADPrincipalGroupMembership).
comings-and-goings-event-direct-dl =
    Kofi est directement dans un groupe DL_. Ça marche aujourd'hui, mais
    les conventions disent AGDLP : les personnes dans les groupes GG_
    seulement, les GG_ dans les DL_. Une personne dans un groupe DL_ est
    une exception que personne ne verra quand les droits du service
    changeront. Retirez-l'en, et mettez-le dans GG_Children.
comings-and-goings-event-admin =
    Kofi est maintenant administrateur du domaine, ou de ses serveurs. Un
    bibliothécaire jeunesse a besoin de l'heure du conte, pas des clés
    de tous les comptes. Retirez-le de ce groupe tout de suite.
comings-and-goings-event-no-change =
    Le compte de Kofi a un mot de passe, mais il n'aura pas à le
    changer : celui que vous avez choisi, qu'Ines remettra sur papier,
    resterait le sien. Set-ADUser kmensah -ChangePasswordAtLogon $true.
comings-and-goings-event-details =
    Presque : comparez le compte au ticket, champ par champ : GivenName,
    Surname, Department, Title, Manager (Get-ADUser kmensah -Properties
    Department, Title, Manager). Set-ADUser corrige ce qui diffère.
comings-and-goings-event-arrival =
    Kofi est prêt pour lundi : dans sa bibliothèque, le seul groupe de
    son poste, un premier mot de passe qu'il changera à 9 h 01. Au tour
    de Mateo.
comings-and-goings-event-deleted =
    Le compte de Mateo a disparu. Avec lui, son SID : les fichiers qu'il
    possède sur rayons affichent maintenant un propriétaire inconnu
    S-1-5-21-…, la question des auditeur·rices « qui avait accès en
    décembre ? » n'a plus de réponse, et un nouveau compte du même nom
    serait quelqu'un d'autre. (La corbeille AD n'est pas activée dans ce
    domaine.) Recommencez le chapitre depuis le menu, et cette fois,
    désactivez le compte.
comings-and-goings-event-leaver-disabled =
    Le compte de Mateo est désactivé : plus personne ne peut s'y
    connecter, et il existe toujours, avec son SID. Maintenant : de quoi
    est-il encore membre ?
comings-and-goings-event-leaver-groups =
    Mateo est sorti de ses groupes : si quelqu'un réactivait le compte
    par erreur un jour, il n'ouvrirait rien. Encore une chose : l'OU où
    attendent les départs.
comings-and-goings-event-leaver-groups-moved =
    Mateo est sorti de ses groupes, dans OU=Leavers.
comings-and-goings-event-leaver-moved =
    Mateo est dans OU=Leavers, mais toujours dans ses groupes :
    GG_Lending le compte encore. Get-ADPrincipalGroupMembership mrossi
    dit lesquels (Domain Users, son groupe principal, reste).
comings-and-goings-event-end =
    Nandini : « Kofi commence lundi, Mateo est fermé. Merci, et bon
    week-end ! »

    Bravo ! Vous avez terminé le chapitre « Arrivées et départs ».

    CE QUI S'EST PASSÉ
    Deux tickets RH un vendredi. Vous avez créé le compte de Kofi là où
    le domaine l'attend (OU=Riverside,OU=Branches), avec ce que dit le
    ticket (Department, Title, Manager), un premier mot de passe qu'il
    devra changer, et un seul groupe, GG_Children : celui de son
    service. Vous avez fermé le compte de Mateo sans le supprimer :
    désactivé, sorti de ses groupes, déplacé dans OU=Leavers.

    AGDLP
    Les comptes (Accounts) vont dans des groupes Globaux (un par
    service, GG_), les groupes globaux dans des groupes de Domaine Locaux
    (un par partage et par niveau, DL_), et seuls les groupes de domaine
    locaux reçoivent des Permissions sur les fichiers. Quand les droits
    d'un service changent, vous changez une imbrication, pas quarante
    comptes ; quand quelqu'un arrive, un seul groupe suffit. Copier une
    collègue copie ses exceptions avec son poste : partez du poste.

    COMME « L'ANNUAIRE », EN ACTIVE DIRECTORY
    Active Directory est un annuaire LDAP : le DN de Kofi,
    CN=Kofi Mensah,OU=Riverside,OU=Branches,DC=lending,DC=internal,
    se lit comme uid=…,ou=…,dc=… dans OpenLDAP, et les filtres LDAP que
    vous écriviez avec ldapsearch marchent ici aussi :
    Get-ADUser -LDAPFilter '(&(department=Children)(title=Youth*))'.
    Get-ADUser -Filter "Department -eq 'Children'" est la même recherche
    dans le langage propre de PowerShell.

    BONNES PRATIQUES
    - Créer à partir du ticket et des conventions, pas d'une collègue.
    - Un premier mot de passe que la personne change à la première
      connexion (-ChangePasswordAtLogon $true), remis en main propre.
    - Un départ est désactivé, pas supprimé : le SID possède des
      fichiers, les journaux le nomment, et un compte supprimé ne
      revient pas sans la corbeille AD.
    - Hors des groupes, avec une description qui dit quand et pourquoi.

    DOCUMENTATION
    - New-ADUser : https://learn.microsoft.com/powershell/module/activedirectory/new-aduser
    - Les groupes de sécurité et leur étendue : https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-security-groups
    - Exigences de complexité des mots de passe : https://learn.microsoft.com/windows-server/security/group-policy/password-must-meet-complexity-requirements
    - Disable-ADAccount : https://learn.microsoft.com/powershell/module/activedirectory/disable-adaccount
    - Move-ADObject : https://learn.microsoft.com/powershell/module/activedirectory/move-adobject
