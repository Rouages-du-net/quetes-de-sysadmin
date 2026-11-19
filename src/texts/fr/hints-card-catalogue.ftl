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
    .lead = La tâche a besoin d'un compte à elle, pas de celui de Rafael : Tomas en a créé un, son mot de passe est dans le coffre exporté par Nandini (Get-Help Set-ScheduledTask).
    .solution = Set-ScheduledTask 'Scan Import' -User 'LENDING\svc_scans' -Password '<le mot de passe du coffre>' (ou schtasks /change /tn "Scan Import" /ru LENDING\svc_scans /rp …).
hint-stale-password-end =
    .lead = La source est corrigée : rendez maintenant son compte à Rafael, depuis registre (Get-Help Unlock-ADAccount).
    .solution = exit (retour sur registre), puis Unlock-ADAccount rsilva.
