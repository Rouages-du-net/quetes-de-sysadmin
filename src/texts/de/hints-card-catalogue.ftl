### Abgestufte Hinweise für Der Zettelkatalog (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine
### Richtung) und .solution (fast die Antwort).

## Kapitel 1 — Kommen und Gehen

hint-comings-and-goings-ous =
    .lead = Lies die Tickets und Tomas' Konventionen (Documents) und sieh dir dann die OUs der Domäne an (Get-Command -Module ActiveDirectory, Get-Help Get-ADOrganizationalUnit).
    .solution = Get-ADOrganizationalUnit -Filter * | Select-Object DistinguishedName: Riverside ist OU=Riverside,OU=Branches,DC=lending,DC=internal.
hint-comings-and-goings-colleague =
    .lead = Die Personalabteilung sagt „dieselben wie Amara“: Sieh dir an, wovon Amaras Konto Mitglied ist, bevor du etwas kopierst (Get-Help Get-ADPrincipalGroupMembership).
    .solution = Get-ADPrincipalGroupMembership aokoye | Select-Object name: GG_Children, aber auch GG_Management und DL_Finance_RW.
hint-comings-and-goings-agdlp =
    .lead = Welche Gruppen enthalten Personen, welche Gruppen? Sieh in eine DL_-Gruppe hinein (Get-Help Get-ADGroupMember).
    .solution = Get-ADGroupMember DL_Events_RW: GG_Children und GG_Management. Ein Jugendbibliothekar kommt nur in GG_Children.
hint-comings-and-goings-created =
    .lead = Leg Kofis Konto mit allem an, was das Ticket und die Konventionen verlangen, in einem Befehl (Get-Help New-ADUser -Examples; ein SecureString: Get-Help ConvertTo-SecureString).
    .solution = New-ADUser -Name 'Kofi Mensah' -GivenName Kofi -Surname Mensah -SamAccountName kmensah -Path 'OU=Riverside,OU=Branches,DC=lending,DC=internal' -Department Children -Title 'Youth Librarian' -Manager iduarte -AccountPassword (ConvertTo-SecureString 'A-long-2030-Phrase' -AsPlainText -Force) -ChangePasswordAtLogon $true -Enabled $true
hint-comings-and-goings-arrival =
    .lead = Jetzt seine Gruppe: die globale Gruppe seiner Abteilung, und nichts sonst (Get-Help Add-ADGroupMember).
    .solution = Add-ADGroupMember GG_Children kmensah, dann Get-ADPrincipalGroupMembership kmensah zur Prüfung: Domain Users und GG_Children.
hint-comings-and-goings-leaver-disabled =
    .lead = Mateo: Die Konventionen sagen, Ausscheidende werden nie gelöscht. Sorg zuerst dafür, dass sich niemand mit seinem Konto anmelden kann (Get-Help Disable-ADAccount).
    .solution = Disable-ADAccount mrossi
hint-comings-and-goings-leaver-groups =
    .lead = Wovon ist Mateo noch Mitglied? Nimm ihn da heraus (Get-Help Remove-ADPrincipalGroupMembership, oder Remove-ADGroupMember).
    .solution = Get-ADPrincipalGroupMembership mrossi, dann Remove-ADPrincipalGroupMembership mrossi -MemberOf GG_Lending -Confirm:$false (Domain Users, seine primäre Gruppe, bleibt).
hint-comings-and-goings-end =
    .lead = Zuletzt, wo Ausscheidende warten: eine eigene OU (Get-Help Move-ADObject). Prüfe auch Kofis Konto gegen das Ticket.
    .solution = Get-ADUser mrossi | Move-ADObject -TargetPath 'OU=Leavers,DC=lending,DC=internal'

## Kapitel 2 — Das alte Passwort

hint-stale-password-locked =
    .lead = Ist Rafaels Konto gesperrt oder deaktiviert? Das Modul ActiveDirectory kann gesperrte Konten auflisten (Get-Help Search-ADAccount).
    .solution = Search-ADAccount -LockedOut: rsilva.
hint-stale-password-bad-logons =
    .lead = Wie viele falsche Passwörter, und wann war das letzte? Das sind Eigenschaften, die Get-ADUser nur auf Nachfrage zeigt (Get-Help Get-ADUser -Parameter Properties).
    .solution = Get-ADUser rsilva -Properties LockedOut, BadLogonCount, LastBadPasswordAttempt, PasswordLastSet
hint-stale-password-caller =
    .lead = Der Domänencontroller protokolliert jede Sperre in seinem Protokoll Security, mit dem Computer, von dem das falsche Passwort kam (Get-Help Get-WinEvent: -FilterHashtable; das Sperrereignis ist 4740).
    .solution = Get-WinEvent -FilterHashtable @{"{"}LogName='Security'; Id=4740{"}"} -MaxEvents 1 | Format-List Message: Caller Computer Name: REGALE.
hint-stale-password-on-stacks =
    .lead = Sieh auf diesem Computer nach: Windows Server hat auch einen OpenSSH-Client (man ssh).
    .solution = ssh regale (yes zum Host-Schlüssel), dann Get-WinEvent -FilterHashtable @{"{"}LogName='Security'; Id=4625{"}"} -MaxEvents 1 | Format-List Message.
hint-stale-password-task =
    .lead = Anmeldetyp 4 ist eine Batch-Anmeldung: Was läuft dort nach Zeitplan, und als wer (Get-Help Get-ScheduledTask; das Konto steht in ihrem Principal)?
    .solution = Get-ScheduledTask | Select-Object TaskName, @{"{"}n='User';e={"{"}$_.Principal.UserId{"}"}{"}"}, oder schtasks /query /v /fo list: Scan Import läuft als LENDING\rsilva.
hint-stale-password-fixed =
    .lead = Die Aufgabe braucht ein eigenes Konto, nicht Rafaels: Tomas hat eines angelegt, sein Passwort steht im Tresor, den Nandini exportiert hat (Get-Help Set-ScheduledTask).
    .solution = Set-ScheduledTask 'Scan Import' -User 'LENDING\svc_scans' -Password '<das Passwort aus dem Tresor>' (oder schtasks /change /tn "Scan Import" /ru LENDING\svc_scans /rp …).
hint-stale-password-end =
    .lead = Die Quelle ist repariert: Gib Rafael jetzt sein Konto zurück, von register aus (Get-Help Unlock-ADAccount).
    .solution = exit (zurück auf register), dann Unlock-ADAccount rsilva.

## Kapitel 3 — Die Richtlinie, die nicht greift

hint-unapplied-policy-josephine =
    .lead = Was hat die Gruppenrichtlinie auf Josephines Arbeitsplatz angewendet? gpresult kann das Ergebnis eines anderen Computers für einen Benutzer lesen (man gpresult: /s, /user).
    .solution = gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r: Staff Drives angewendet, Archives Drive herausgefiltert, Events Drive nirgends.
hint-unapplied-policy-links =
    .lead = Eine GPO, die gpresult nicht einmal auflistet, ist nicht über der OU der Person verknüpft. Wo ist Events Drive verknüpft, und was erreicht OU=Hilltop (Get-Help Get-GPInheritance, Get-GPOReport)?
    .solution = Get-GPInheritance -Target 'OU=Hilltop,OU=Branches,DC=lending,DC=internal' (kein Events Drive), Get-GPOReport 'Events Drive' -ReportType Xml (LinksTo: Central).
hint-unapplied-policy-linked =
    .lead = Tomas' Konventionen sagen, wo eine GPO für das Personal verknüpft wird (Get-Help New-GPLink).
    .solution = New-GPLink 'Events Drive' -Target 'OU=Branches,DC=lending,DC=internal', dann Remove-GPLink 'Events Drive' -Target 'OU=Central,OU=Branches,DC=lending,DC=internal'.
hint-unapplied-policy-nandini =
    .lead = Nandini sitzt in Central, wo die Verknüpfung schon immer war. Was sagt ihr Arbeitsplatz über Events Drive?
    .solution = gpresult /s CENTRAL-DESK1 /user LENDING\nmukherjee /r: Events Drive, Filtering: Denied (Security).
hint-unapplied-policy-filtering =
    .lead = Denied (Security) ist Sicherheitsfilterung: Wer hat Apply Group Policy auf der GPO (Get-Help Get-GPPermission)? Und für wen ist die Freigabe Events (Get-ADGroupMember DL_Events_RW)?
    .solution = Get-GPPermission 'Events Drive' -All: GpoApply nur für GG_Children; DL_Events_RW enthält GG_Children und GG_Management.
hint-unapplied-policy-filtered =
    .lead = Gib der fehlenden Gruppe das Recht, sie anzuwenden, ohne sie für alle zu öffnen (Get-Help Set-GPPermission -Examples).
    .solution = Set-GPPermission 'Events Drive' -TargetName GG_Management -TargetType Group -PermissionLevel GpoApply
hint-unapplied-policy-end =
    .lead = Das Verzeichnis stimmt; die Arbeitsplätze wenden es bei ihrer nächsten Aktualisierung an. Bitte jetzt einen darum und prüfe dann (Get-Help Invoke-GPUpdate).
    .solution = Invoke-GPUpdate -Computer HILL-DESK1 -Target User, dann gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r: Events Drive angewendet.

## Kapitel 4 — Türen und schlafende Konten

hint-dormant-accounts-rdp-found =
    .lead = Lies das Audit in Documents und sieh dir dann die Firewall von regale an: Welche aktivierte eingehende Regel lässt 3389 herein (Get-Help Get-NetFirewallRule, Get-NetFirewallPortFilter)?
    .solution = ssh regale, dann Get-NetFirewallPortFilter | Where-Object LocalPort -eq 3389 | Get-NetFirewallRule | Where-Object Enabled -eq True: „Remote Desktop - Any“; Get-NetFirewallAddressFilter zeigt RemoteAddress Any.
hint-dormant-accounts-rdp-closed =
    .lead = Niemand benutzt mehr Remote Desktop: Schließ diese Regel, nicht das Profil, und behalte deinen eigenen Weg herein (Get-Help Disable-NetFirewallRule, Set-NetFirewallRule).
    .solution = Disable-NetFirewallRule -DisplayName 'Remote Desktop - Any' (oder Set-NetFirewallRule -DisplayName 'Remote Desktop - Any' -RemoteAddress 192.0.2.2), dann exit.
hint-dormant-accounts-inactive =
    .lead = Zurück auf register: Welche Konten haben sich seit 90 Tagen nicht angemeldet (Get-Help Search-ADAccount; ein TimeSpan schreibt sich Tage.Stunden:Minuten:Sekunden)?
    .solution = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object SamAccountName, Enabled, LastLogonDate, DistinguishedName
hint-dormant-accounts-service-account =
    .lead = Bevor du etwas schließt: Wofür ist svc_backup da? Seine Beschreibung, und was auf regale als es läuft.
    .solution = Get-ADUser svc_backup -Properties Description, oder auf regale: Get-ScheduledTask | Select-Object TaskName, @{"{"}n='User';e={"{"}$_.Principal.UserId{"}"}{"}"} (Offsite Copy, jeden 1. April).
hint-dormant-accounts-closed =
    .lead = Beschränk die Suche auf die Personen (-SearchBase), dann für jedes Konto: deaktivieren, aus seinen Gruppen außer Domain Users nehmen, nach Leavers verschieben. Eine Funktion oder eine foreach-Schleife (Get-Help ForEach-Object).
    .solution = $old = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly -SearchBase 'OU=Branches,DC=lending,DC=internal'; foreach ($a in $old) {"{"} Disable-ADAccount $a; Get-ADPrincipalGroupMembership $a | Where-Object Name -ne 'Domain Users' | ForEach-Object {"{"} Remove-ADGroupMember $_ $a -Confirm:$false {"}"}; Move-ADObject $a -TargetPath 'OU=Leavers,DC=lending,DC=internal' {"}"}
hint-dormant-accounts-leftover =
    .lead = Das Audit fragt, ob eure Ausgeschiedenen wirklich aus ihren Gruppen heraus sind. Sieh dir die Konten in Leavers an (Get-ADPrincipalGroupMembership).
    .solution = Remove-ADPrincipalGroupMembership oadeyemi -MemberOf GG_Lending, DL_Staff_RW -Confirm:$false
hint-dormant-accounts-report =
    .lead = Die Prüfer·innen wollen eine CSV-Datei: dieselbe Suche, die Spalten, nach denen sie fragen (Get-Help Export-Csv -Examples).
    .solution = $old | Select-Object SamAccountName, Name, LastLogonDate | Export-Csv C:\Users\du\Documents\dormant-accounts.csv -NoTypeInformation, dann Import-Csv zur Prüfung.
hint-dormant-accounts-end =
    .lead = Prüfe jeden Punkt des Audits: 3389 auf regale zu (und dein ssh offen), die beiden Personen geschlossen, Olus Gruppen, der Bericht; sonst nichts geändert.
    .solution = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object SamAccountName, Enabled, DistinguishedName; Get-ADPrincipalGroupMembership für jedes; Import-Csv auf den Bericht.
