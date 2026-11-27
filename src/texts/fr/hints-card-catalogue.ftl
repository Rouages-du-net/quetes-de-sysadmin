### Indices gradués du Catalogue (voir src/engine/hints.ts) : un message
### par étape, hint-<chapitre>-<événement>, avec .lead (une piste) et
### .solution (presque la réponse).

## Chapitre 1 — Arrivées et départs

hint-comings-and-goings-ous =
    .lead = Lisez les tickets et les conventions de Tomas (Documents), puis regardez les OU du domaine (Get-Command -Module ActiveDirectory, Get-Help Get-ADOrganizationalUnit).
    .solution = Get-ADOrganizationalUnit -Filter * | Select-Object DistinguishedName : Riverside, c'est OU=Riverside,OU=Branches,DC=lending,DC=internal.
hint-comings-and-goings-colleague =
    .lead = Les RH disent « les mêmes qu'Amara » : regardez de quoi le compte d'Amara est membre avant de copier quoi que ce soit (Get-Help Get-ADPrincipalGroupMembership).
    .solution = Get-ADPrincipalGroupMembership aokoye | Select-Object name : GG_Children, mais aussi GG_Management et DL_Finance_RW.
hint-comings-and-goings-agdlp =
    .lead = Quels groupes contiennent des personnes, lesquels contiennent des groupes ? Regardez dans un groupe DL_ (Get-Help Get-ADGroupMember).
    .solution = Get-ADGroupMember DL_Events_RW : GG_Children et GG_Management. Un bibliothécaire jeunesse va seulement dans GG_Children.
hint-comings-and-goings-created =
    .lead = Créez le compte de Kofi avec tout ce que demandent le ticket et les conventions, en une commande (Get-Help New-ADUser -Examples ; une SecureString : Get-Help ConvertTo-SecureString).
    .solution = New-ADUser -Name 'Kofi Mensah' -GivenName Kofi -Surname Mensah -SamAccountName kmensah -Path 'OU=Riverside,OU=Branches,DC=lending,DC=internal' -Department Children -Title 'Youth Librarian' -Manager iduarte -AccountPassword (ConvertTo-SecureString 'Une-longue-2030-Phrase' -AsPlainText -Force) -ChangePasswordAtLogon $true -Enabled $true
hint-comings-and-goings-arrival =
    .lead = Maintenant son groupe : le groupe global de son service, et rien d'autre (Get-Help Add-ADGroupMember).
    .solution = Add-ADGroupMember GG_Children kmensah, puis Get-ADPrincipalGroupMembership kmensah pour vérifier : Domain Users et GG_Children.
hint-comings-and-goings-leaver-disabled =
    .lead = Mateo : les conventions disent de ne jamais supprimer un départ. D'abord, que plus personne ne puisse se connecter avec son compte (Get-Help Disable-ADAccount).
    .solution = Disable-ADAccount mrossi
hint-comings-and-goings-leaver-groups =
    .lead = De quoi Mateo est-il encore membre ? Retirez-l'en (Get-Help Remove-ADPrincipalGroupMembership, ou Remove-ADGroupMember).
    .solution = Get-ADPrincipalGroupMembership mrossi, puis Remove-ADPrincipalGroupMembership mrossi -MemberOf GG_Lending -Confirm:$false (Domain Users, son groupe principal, reste).
hint-comings-and-goings-end =
    .lead = Enfin, l'endroit où attendent les départs : une OU à part (Get-Help Move-ADObject). Vérifiez aussi le compte de Kofi contre le ticket.
    .solution = Get-ADUser mrossi | Move-ADObject -TargetPath 'OU=Leavers,DC=lending,DC=internal'

## Chapitre 2 — Le mot de passe périmé

hint-stale-password-locked =
    .lead = Le compte de Rafael est-il verrouillé, ou désactivé ? Le module ActiveDirectory sait lister les comptes verrouillés (Get-Help Search-ADAccount).
    .solution = Search-ADAccount -LockedOut : rsilva.
hint-stale-password-bad-logons =
    .lead = Combien de mots de passe faux, et quand le dernier ? Ce sont des propriétés que Get-ADUser ne montre que si on les demande (Get-Help Get-ADUser -Parameter Properties).
    .solution = Get-ADUser rsilva -Properties LockedOut, BadLogonCount, LastBadPasswordAttempt, PasswordLastSet
hint-stale-password-caller =
    .lead = Le contrôleur de domaine note chaque verrouillage dans son journal Security, avec l'ordinateur d'où venait le mot de passe faux (Get-Help Get-WinEvent : -FilterHashtable ; l'événement de verrouillage est le 4740).
    .solution = Get-WinEvent -FilterHashtable @{"{"}LogName='Security'; Id=4740{"}"} -MaxEvents 1 | Format-List Message : Caller Computer Name: RAYONS.
hint-stale-password-on-stacks =
    .lead = Allez voir sur cet ordinateur : Windows Server a aussi un client OpenSSH (man ssh).
    .solution = ssh rayons (yes pour la clé d'hôte), puis Get-WinEvent -FilterHashtable @{"{"}LogName='Security'; Id=4625{"}"} -MaxEvents 1 | Format-List Message.
hint-stale-password-task =
    .lead = Le type de connexion 4, c'est un traitement par lots : qu'est-ce qui tourne à heure fixe là-bas, et sous quel compte (Get-Help Get-ScheduledTask ; le compte est dans son Principal) ?
    .solution = Get-ScheduledTask | Select-Object TaskName, @{"{"}n='User';e={"{"}$_.Principal.UserId{"}"}{"}"}, ou schtasks /query /v /fo list : Scan Import tourne en LENDING\rsilva.
hint-stale-password-fixed =
    .lead = La tâche a besoin d'un compte à elle, pas de celui de Rafael : Tomas en a créé un pour ce travail (les descriptions des comptes de service disent lequel, Get-ADUser -Properties Description), son mot de passe est dans le coffre exporté par Nandini (Get-Help Set-ScheduledTask).
    .solution = Set-ScheduledTask 'Scan Import' -User 'LENDING\svc_scans' -Password '<le mot de passe du coffre>' (ou schtasks /change /tn "Scan Import" /ru LENDING\svc_scans /rp …).
hint-stale-password-end =
    .lead = La source est corrigée : rendez maintenant son compte à Rafael, depuis registre (Get-Help Unlock-ADAccount).
    .solution = exit (retour sur registre), puis Unlock-ADAccount rsilva.

## Chapitre 3 — La stratégie qui ne s'applique pas

hint-unapplied-policy-josephine =
    .lead = Qu'est-ce que la stratégie de groupe a appliqué sur le poste de Josephine ? gpresult sait lire le résultat d'un autre ordinateur pour une personne (man gpresult : /s, /user).
    .solution = gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r : Staff Drives appliquée, Archives Drive filtrée, Events Drive nulle part.
hint-unapplied-policy-links =
    .lead = Une GPO que gpresult ne cite même pas n'est pas liée au-dessus de l'OU de la personne. Où Events Drive est-elle liée, et qu'est-ce qui atteint OU=Hilltop (Get-Help Get-GPInheritance, Get-GPOReport) ?
    .solution = Get-GPInheritance -Target 'OU=Hilltop,OU=Branches,DC=lending,DC=internal' (pas d'Events Drive), Get-GPOReport 'Events Drive' -ReportType Xml (LinksTo : Central).
hint-unapplied-policy-linked =
    .lead = Les conventions de Tomas disent où se lie une GPO pour le personnel (Get-Help New-GPLink).
    .solution = New-GPLink 'Events Drive' -Target 'OU=Branches,DC=lending,DC=internal', puis Remove-GPLink 'Events Drive' -Target 'OU=Central,OU=Branches,DC=lending,DC=internal'.
hint-unapplied-policy-nandini =
    .lead = Nandini est à Central, là où le lien a toujours été. Que dit son poste d'Events Drive ?
    .solution = gpresult /s CENTRAL-DESK1 /user LENDING\nmukherjee /r : Events Drive, Filtering: Denied (Security).
hint-unapplied-policy-filtering =
    .lead = Denied (Security), c'est le filtrage de sécurité : qui a Apply Group Policy sur la GPO (Get-Help Get-GPPermission) ? Et pour qui est le partage Events (Get-ADGroupMember DL_Events_RW) ?
    .solution = Get-GPPermission 'Events Drive' -All : GpoApply pour GG_Children seulement ; DL_Events_RW contient GG_Children et GG_Management.
hint-unapplied-policy-filtered =
    .lead = Donnez au groupe manquant le droit de l'appliquer, sans l'ouvrir à tout le monde (Get-Help Set-GPPermission -Examples).
    .solution = Set-GPPermission 'Events Drive' -TargetName GG_Management -TargetType Group -PermissionLevel GpoApply
hint-unapplied-policy-end =
    .lead = L'annuaire est juste ; les postes l'appliquent à leur prochaine actualisation. Demandez-le à l'un d'eux maintenant, puis vérifiez (Get-Help Invoke-GPUpdate).
    .solution = Invoke-GPUpdate -Computer HILL-DESK1 -Target User, puis gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r : Events Drive appliquée.

## Chapitre 4 — Portes et comptes dormants

hint-dormant-accounts-rdp-found =
    .lead = Lisez l'audit dans Documents, puis allez voir le pare-feu de rayons : quelle règle entrante activée laisse passer 3389 (Get-Help Get-NetFirewallRule, Get-NetFirewallPortFilter) ?
    .solution = ssh rayons, puis Get-NetFirewallPortFilter | Where-Object LocalPort -eq 3389 | Get-NetFirewallRule | Where-Object Enabled -eq True : « Remote Desktop - Any » ; Get-NetFirewallAddressFilter montre RemoteAddress Any.
hint-dormant-accounts-rdp-closed =
    .lead = Personne n'utilise plus le Bureau à distance : fermez cette règle, pas le profil, et gardez votre propre accès (Get-Help Disable-NetFirewallRule, Set-NetFirewallRule).
    .solution = Disable-NetFirewallRule -DisplayName 'Remote Desktop - Any' (ou Set-NetFirewallRule -DisplayName 'Remote Desktop - Any' -RemoteAddress 192.0.2.2), puis exit.
hint-dormant-accounts-inactive =
    .lead = De retour sur registre : quels comptes ne se sont pas connectés depuis 90 jours (Get-Help Search-ADAccount ; un TimeSpan s'écrit jours.heures:minutes:secondes) ?
    .solution = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object SamAccountName, Enabled, LastLogonDate, DistinguishedName
hint-dormant-accounts-service-account =
    .lead = Avant de fermer quoi que ce soit : à quoi sert svc_backup ? Sa description, et ce qui tourne sous ce compte sur rayons.
    .solution = Get-ADUser svc_backup -Properties Description, ou sur rayons : Get-ScheduledTask | Select-Object TaskName, @{"{"}n='User';e={"{"}$_.Principal.UserId{"}"}{"}"} (Offsite Copy, chaque 1er avril).
hint-dormant-accounts-closed =
    .lead = Limitez la recherche aux personnes (-SearchBase), puis pour chaque compte : désactiver, retirer de ses groupes sauf Domain Users, déplacer dans Leavers. Une fonction ou une boucle foreach (Get-Help ForEach-Object).
    .solution = $old = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly -SearchBase 'OU=Branches,DC=lending,DC=internal'; foreach ($a in $old) {"{"} Disable-ADAccount $a; Get-ADPrincipalGroupMembership $a | Where-Object Name -ne 'Domain Users' | ForEach-Object {"{"} Remove-ADGroupMember $_ $a -Confirm:$false {"}"}; Move-ADObject $a -TargetPath 'OU=Leavers,DC=lending,DC=internal' {"}"}
hint-dormant-accounts-leftover =
    .lead = L'audit demande si vos départs sont vraiment sortis de leurs groupes. Regardez les comptes de Leavers (Get-ADPrincipalGroupMembership).
    .solution = Remove-ADPrincipalGroupMembership oadeyemi -MemberOf GG_Lending, DL_Staff_RW -Confirm:$false
hint-dormant-accounts-report =
    .lead = Les auditeur·rices veulent un fichier CSV : la même recherche, les colonnes qu'ils demandent (Get-Help Export-Csv -Examples).
    .solution = $old | Select-Object SamAccountName, Name, LastLogonDate | Export-Csv C:\Users\vous\Documents\comptes-dormants.csv -NoTypeInformation, puis Import-Csv pour vérifier.
hint-dormant-accounts-end =
    .lead = Vérifiez chaque point de l'audit : le 3389 de rayons fermé (et votre ssh ouvert), les deux personnes fermées, les groupes d'Olu, le rapport ; rien d'autre de changé.
    .solution = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object SamAccountName, Enabled, DistinguishedName ; Get-ADPrincipalGroupMembership pour chacun ; Import-Csv sur le rapport.
