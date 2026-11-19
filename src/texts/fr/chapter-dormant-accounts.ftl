### Histoire « Le Catalogue », chapitre « Portes et comptes dormants » :
### l'audit annuel de la ville : le Bureau à distance ouvert sur Internet
### sur le serveur de fichiers, et les comptes que personne n'a utilisés
### depuis 90 jours, fermés avec un petit script et listés dans un
### rapport CSV.
### Les commandes, cmdlets, comptes, adresses, chemins et sorties ne sont
### pas traduits.

chapter-dormant-accounts = Portes et comptes dormants
    .summary = L'équipe sécurité informatique de la ville a trouvé le Bureau à distance ouvert sur Internet sur le serveur de fichiers, et veut que les comptes inutilisés depuis 90 jours soient fermés, avec un rapport. Fermez la porte sans vous enfermer dehors, puis écrivez un petit script qui ferme les comptes dormants, et seulement eux.

## Fichiers

dormant-accounts-email-nandini =
    De :  Nandini Mukherjee (directrice du réseau)
    À :   vous

    Bonjour,

    L'équipe sécurité informatique de la ville nous a envoyé son audit
    annuel (dans vos Documents). Deux choses pour nous, d'ici vendredi.
    Attention à la deuxième : l'an dernier, Tomas a fermé un compte dont
    les archives avaient encore besoin, et on ne l'a su qu'en avril.

    Le rapport qu'ils demandent va aussi dans vos Documents, en fichier
    CSV : il part directement dans leur tableur.

    Nandini

# { $scanner } : l'adresse du scanner (non traduite).
dormant-accounts-audit =
    Ville - sécurité informatique - audit annuel 2030
    Réseau : bibliothèques publiques (LENDING)

    1. SCAN EXTERNE (trimestriel, depuis { $scanner })
       L'adresse publique des bibliothèques répond sur TCP 3389 (Bureau
       à distance). Le routeur le redirige vers un serveur interne.
       Le Bureau à distance ne doit jamais être joignable depuis
       Internet, ni depuis les bornes publiques. Administration
       seulement depuis le poste informatique (192.0.2.2).

    2. COMPTES DORMANTS
       Comptes de personnes sans connexion depuis 90 jours ou plus :
         - les désactiver, les déplacer dans votre OU des départs, les
           retirer de tous leurs groupes (sauf le groupe principal) ;
         - nous envoyer la liste en fichier CSV (nom de compte, nom,
           dernière connexion).
       Ne touchez pas aux comptes de service sans vérifier ce qui les
       utilise. Vérifiez aussi que vos départs sont vraiment sortis de
       leurs groupes.

dormant-accounts-gpo-refresh =
    Quatre-vingt-dix minutes plus tard, rayons actualise sa stratégie en
    arrière-plan : la règle de la GPO des serveurs laisse de nouveau
    entrer registre sur le port 22. (Dans la vraie vie, il aurait
    peut-être fallu aller jusqu'à la salle serveur.)

## Événements

dormant-accounts-event-rdp-found =
    « Remote Desktop - Any » : TCP 3389, depuis n'importe quelle adresse
    (Any), sur tous les profils. Tomas l'a créée en 2028 pour travailler
    de chez lui, et le routeur redirige toujours le port : n'importe qui
    sur Internet peut essayer des mots de passe sur le Bureau à distance
    de rayons, et n'importe qui devant une borne publique aussi. Les
    règles Remote Desktop d'origine sont désactivées ; celle-ci non.
    Quelqu'un utilise-t-il encore le Bureau à distance ? Vous, vous
    entrez par ssh.
dormant-accounts-event-profile-off =
    Un profil du pare-feu est désactivé : sur ce réseau, rayons accepte
    maintenant tout, tous les ports, de tout le monde. La porte qu'on
    vous demandait de fermer est grande ouverte, et toutes les autres
    aussi. Réactivez-le (Set-NetFirewallProfile -Enabled True) et
    occupez-vous de la seule règle.
dormant-accounts-event-ssh-cut =
    Attention : le pare-feu de rayons ne laisse plus entrer registre sur
    le port 22. Votre session tient (une connexion ouverte le reste),
    mais le prochain ssh rayons expirera. Rétablissez-le maintenant
    (Get-NetFirewallRule -Name OpenSSH-Server-In-TCP,
    Enable-NetFirewallRule, Set-NetFirewallRule -RemoteAddress), avant
    de sortir.
# { $kiosk } : l'adresse d'une borne (non traduite).
dormant-accounts-event-lan-wide =
    Depuis Internet, fermé. Mais { $kiosk }, une borne du catalogue
    public, entre encore : elle est sur le même réseau (192.0.2.0/24) que
    le personnel. LocalSubnet ou tout le /24, ce n'est pas « le poste
    informatique ».
dormant-accounts-event-rdp-closed =
    Port 3389 fermé à tout le monde : depuis Internet et depuis les
    bornes. Vous entrez toujours par ssh. (La redirection du routeur
    devrait disparaître aussi : une note pour le fournisseur de Nandini.)
dormant-accounts-event-rdp-narrowed =
    Port 3389 ouvert seulement au poste informatique : pas depuis
    Internet, pas depuis les bornes. Vous entrez toujours par ssh.
dormant-accounts-event-inactive =
    Les comptes inactifs du domaine. Regardez bien avant d'agir : Guest
    et krbtgt sont des comptes intégrés (désactivés, jamais
    « connectés »), oadeyemi est parti en mai, svc_backup est un compte
    de service. Les personnes sont ychen et pmorel. -SearchBase peut
    limiter la recherche aux personnes des bibliothèques.
dormant-accounts-event-too-short =
    lhassan dans la liste : Leila est en congé parental depuis décembre,
    de retour en mars. Avec un -TimeSpan trop court, l'audit ferme des
    personnes qui reviennent. L'audit dit 90 jours.
dormant-accounts-event-service-account =
    svc_backup fait la copie hors site des Archives, le 1er octobre et
    le 1er avril. Sa dernière connexion date d'octobre : inactif depuis
    90 jours, et de nouveau nécessaire dans neuf semaines. Le
    LastLogonDate d'un compte de service dit quand il s'est connecté
    pour la dernière fois, pas si quelque chose dépend de lui.
dormant-accounts-event-service-touched =
    Un compte de service a été modifié. svc_backup a l'air inactif, mais
    la tâche Offsite Copy de rayons tourne sous svc_backup le 1er avril :
    désactivé, sorti de son groupe ou déplacé, la copie échoue
    (0x80070533, le compte est désactivé), et les Archives ne sont plus
    sauvegardées hors site. Remettez-le comme il était :
    Enable-ADAccount, son groupe, OU=Service Accounts.
dormant-accounts-event-builtin-touched =
    Un compte intégré a été déplacé ou modifié (Guest, krbtgt,
    Administrator…). Ils sont désactivés ou nécessaires au domaine
    lui-même : l'audit concerne les personnes. Remettez-le où il était
    (Move-ADObject).
# { $accounts } : des noms de comptes (non traduits).
dormant-accounts-event-active-touched =
    Le compte d'une personne active a été modifié : { $accounts }. Elle
    s'est connectée dans les 90 derniers jours : remettez le compte comme
    il était (activé, son OU, ses groupes).
# { $accounts } : des noms de comptes (non traduits).
dormant-accounts-event-deleted =
    Supprimé : { $accounts }. L'audit demande de désactiver, pas de
    supprimer : le SID possède des fichiers, les auditeur·rices veulent
    le nom. La corbeille l'a encore (Get-ADObject
    -IncludeDeletedObjects, Restore-ADObject).
dormant-accounts-event-closed =
    ychen et pmorel : désactivés, dans Leavers, hors de leurs groupes. Si
    l'une ou l'un revient, Enable-ADAccount, un groupe GG_ et un
    Move-ADObject les ramènent.
dormant-accounts-event-leftover-seen =
    Olu est parti en mai 2029. Désactivé, dans Leavers... mais toujours
    dans GG_Lending et DL_Staff_RW. Désactivé, il ne peut pas se
    connecter ; mais quiconque réactive son compte (par erreur, ou
    « pour vérifier un truc ») lui rend d'un coup tous ses accès, et
    chaque rapport sur le partage Staff le liste.
dormant-accounts-event-leftover =
    Olu est sorti de ses groupes aussi : Leavers est propre.
dormant-accounts-event-report-active =
    Un rapport CSV liste une personne active : les auditeur·rices
    fermeraient un compte utilisé. Écrivez-le à partir de la bonne
    recherche (-TimeSpan 90.00:00:00, les personnes des bibliothèques).
dormant-accounts-event-report =
    Le rapport est là, et Import-Csv le relit : les auditeur·rices
    peuvent le coller dans leur tableur.
dormant-accounts-event-end =
    Nandini : « Le scan est propre, l'audit a sa liste, et les archives
    seront copiées en avril. Merci ! »

    Bravo ! Vous avez terminé le chapitre « Portes et comptes dormants »,
    et l'histoire « Le Catalogue ».

    CE QUI S'EST PASSÉ
    Tomas avait ouvert le Bureau à distance à tous (Any) sur rayons en
    2028 pour travailler de chez lui ; le routeur redirigeait toujours
    le port, et le scan de la ville l'a trouvé depuis Internet. Personne
    n'utilise plus le Bureau à distance : vous avez fermé la règle sans
    toucher aux profils ni à votre propre ssh. Puis l'audit :
    Search-ADAccount a trouvé les comptes inutilisés depuis 90 jours,
    mais parmi eux des comptes intégrés, un départ, et un compte de
    service qui ne travaille que deux fois par an. Vous avez fermé les
    comptes des deux personnes avec un script, nettoyé les groupes de
    l'ancien départ, et écrit la liste avec Export-Csv.

    BONNES PRATIQUES
    - Le Bureau à distance ne fait jamais face à Internet : un VPN ou une
      passerelle devant, et au minimum une règle de pare-feu limitée aux
      adresses des admins (-RemoteAddress). Préférez désactiver une
      règle que personne n'utilise : elle dit ce qu'elle était, et peut
      revenir.
    - Restreindre une règle, jamais un profil entier. Avant de modifier
      la règle par laquelle vous êtes entré·e, vérifiez ce qui vous
      laisse encore entrer.
    - Un script d'audit lit d'abord et agit ensuite : garder la
      recherche dans une variable, la regarder, l'exporter (Export-Csv
      -NoTypeInformation), puis agir dessus, avec -WhatIf la première
      fois.
    - LastLogonDate, c'est lastLogonTimestamp : répliqué avec jusqu'à 14
      jours de retard, et seule une connexion compte. Excluez ce qui
      n'est pas une personne : -SearchBase sur l'OU des personnes, les
      comptes de service dans leur propre OU, les comptes intégrés.
    - Désactiver, pas supprimer : un compte désactivé revient en une
      commande ; un compte supprimé a besoin de la corbeille, pendant
      180 jours.

    COMME « L'ANNUAIRE », EN ACTIVE DIRECTORY
    Search-ADAccount -AccountInactive est une recherche LDAP sur
    l'attribut lastLogonTimestamp : Get-ADUser -LDAPFilter
    '(lastLogonTimestamp<=…)' fait la même chose, avec la date écrite
    en FILETIME (des intervalles de 100 nanosecondes depuis 1601), comme
    ldapsearch le ferait.

    DOCUMENTATION
    - Search-ADAccount : https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount
    - Export-Csv : https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/export-csv?view=powershell-5.1
    - Set-NetFirewallRule : https://learn.microsoft.com/powershell/module/netsecurity/set-netfirewallrule
    - Le Bureau à distance accessible de partout, en sécurité : https://learn.microsoft.com/windows-server/remote/remote-desktop-services/rds-plan-access-from-anywhere
    - La corbeille AD : https://learn.microsoft.com/windows-server/identity/ad-ds/get-started/adac/advanced-ad-ds-management-using-active-directory-administrative-center--level-200-
