### Pistas graduales de El Fichero (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una dirección) y .solution
### (casi la respuesta).

## Capítulo 1 — Llegadas y salidas

hint-comings-and-goings-ous =
    .lead = Lee los tickets y las convenciones de Tomas (Documents), y luego mira las OU del dominio (Get-Command -Module ActiveDirectory, Get-Help Get-ADOrganizationalUnit).
    .solution = Get-ADOrganizationalUnit -Filter * | Select-Object DistinguishedName: Riverside es OU=Riverside,OU=Branches,DC=lending,DC=internal.
hint-comings-and-goings-colleague =
    .lead = RR. HH. dice «lo mismo que Amara»: mira de qué es miembro la cuenta de Amara antes de copiar nada (Get-Help Get-ADPrincipalGroupMembership).
    .solution = Get-ADPrincipalGroupMembership aokoye | Select-Object name: GG_Children, pero también GG_Management y DL_Finance_RW.
hint-comings-and-goings-agdlp =
    .lead = ¿Qué grupos contienen personas y cuáles contienen grupos? Mira dentro de un grupo DL_ (Get-Help Get-ADGroupMember).
    .solution = Get-ADGroupMember DL_Events_RW: GG_Children y GG_Management. Un bibliotecario infantil va solo en GG_Children.
hint-comings-and-goings-created =
    .lead = Crea la cuenta de Kofi con todo lo que piden el ticket y las convenciones, en un solo comando (Get-Help New-ADUser -Examples; un SecureString: Get-Help ConvertTo-SecureString).
    .solution = New-ADUser -Name 'Kofi Mensah' -GivenName Kofi -Surname Mensah -SamAccountName kmensah -Path 'OU=Riverside,OU=Branches,DC=lending,DC=internal' -Department Children -Title 'Youth Librarian' -Manager iduarte -AccountPassword (ConvertTo-SecureString 'A-long-2030-Phrase' -AsPlainText -Force) -ChangePasswordAtLogon $true -Enabled $true
hint-comings-and-goings-arrival =
    .lead = Ahora su grupo: el grupo global de su departamento, y nada más (Get-Help Add-ADGroupMember).
    .solution = Add-ADGroupMember GG_Children kmensah, luego Get-ADPrincipalGroupMembership kmensah para comprobarlo: Domain Users y GG_Children.
hint-comings-and-goings-leaver-disabled =
    .lead = Mateo: las convenciones dicen que una baja nunca se borra. Primero, asegúrate de que nadie pueda iniciar sesión con su cuenta (Get-Help Disable-ADAccount).
    .solution = Disable-ADAccount mrossi
hint-comings-and-goings-leaver-groups =
    .lead = ¿De qué sigue siendo miembro Mateo? Sácalo (Get-Help Remove-ADPrincipalGroupMembership, o Remove-ADGroupMember).
    .solution = Get-ADPrincipalGroupMembership mrossi, luego Remove-ADPrincipalGroupMembership mrossi -MemberOf GG_Lending -Confirm:$false (Domain Users, su grupo principal, se queda).
hint-comings-and-goings-end =
    .lead = Por último, donde esperan las bajas: una OU propia (Get-Help Move-ADObject). Comprueba también la cuenta de Kofi frente al ticket.
    .solution = Get-ADUser mrossi | Move-ADObject -TargetPath 'OU=Leavers,DC=lending,DC=internal'

## Capítulo 2 — La contraseña caducada

hint-stale-password-locked =
    .lead = ¿La cuenta de Rafael está bloqueada o desactivada? El módulo ActiveDirectory puede listar las cuentas bloqueadas (Get-Help Search-ADAccount).
    .solution = Search-ADAccount -LockedOut: rsilva.
hint-stale-password-bad-logons =
    .lead = ¿Cuántas contraseñas erróneas, y cuándo fue la última? Son propiedades que Get-ADUser solo muestra si se le piden (Get-Help Get-ADUser -Parameter Properties).
    .solution = Get-ADUser rsilva -Properties LockedOut, BadLogonCount, LastBadPasswordAttempt, PasswordLastSet
hint-stale-password-caller =
    .lead = El controlador de dominio registra cada bloqueo en su registro Security, con el equipo del que vino la contraseña errónea (Get-Help Get-WinEvent: -FilterHashtable; el evento de bloqueo es el 4740).
    .solution = Get-WinEvent -FilterHashtable @{"{"}LogName='Security'; Id=4740{"}"} -MaxEvents 1 | Format-List Message: Caller Computer Name: ESTANTES.
hint-stale-password-on-stacks =
    .lead = Ve a mirar a ese equipo: Windows Server también tiene un cliente OpenSSH (man ssh).
    .solution = ssh estantes (yes a la clave del host), luego Get-WinEvent -FilterHashtable @{"{"}LogName='Security'; Id=4625{"}"} -MaxEvents 1 | Format-List Message.
hint-stale-password-task =
    .lead = El tipo de inicio de sesión 4 es un inicio por lotes: ¿qué se ejecuta allí de forma programada, y con qué cuenta (Get-Help Get-ScheduledTask; la cuenta está en su Principal)?
    .solution = Get-ScheduledTask | Select-Object TaskName, @{"{"}n='User';e={"{"}$_.Principal.UserId{"}"}{"}"}, o schtasks /query /v /fo list: Scan Import se ejecuta como LENDING\rsilva.
hint-stale-password-fixed =
    .lead = La tarea necesita una cuenta propia, no la de Rafael: Tomas creó una, su contraseña está en la entrada del gestor que exportó Nandini (Get-Help Set-ScheduledTask).
    .solution = Set-ScheduledTask 'Scan Import' -User 'LENDING\svc_scans' -Password '<la contraseña del gestor>' (o schtasks /change /tn "Scan Import" /ru LENDING\svc_scans /rp …).
hint-stale-password-end =
    .lead = El origen está arreglado: ahora devuelve a Rafael su cuenta, desde registro (Get-Help Unlock-ADAccount).
    .solution = exit (de vuelta a registro), luego Unlock-ADAccount rsilva.

## Capítulo 3 — La directiva que no se aplica

hint-unapplied-policy-josephine =
    .lead = ¿Qué aplicó la directiva de grupo en el puesto de Josephine? gpresult puede leer el resultado de otro equipo para un usuario (man gpresult: /s, /user).
    .solution = gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r: Staff Drives aplicada, Archives Drive filtrada, Events Drive en ninguna parte.
hint-unapplied-policy-links =
    .lead = Una GPO que gpresult ni siquiera lista no está vinculada por encima de la OU de la persona. ¿Dónde está vinculada Events Drive, y qué llega a OU=Hilltop (Get-Help Get-GPInheritance, Get-GPOReport)?
    .solution = Get-GPInheritance -Target 'OU=Hilltop,OU=Branches,DC=lending,DC=internal' (no está Events Drive), Get-GPOReport 'Events Drive' -ReportType Xml (LinksTo: Central).
hint-unapplied-policy-linked =
    .lead = Las convenciones de Tomas dicen dónde se vincula una GPO para el personal (Get-Help New-GPLink).
    .solution = New-GPLink 'Events Drive' -Target 'OU=Branches,DC=lending,DC=internal', luego Remove-GPLink 'Events Drive' -Target 'OU=Central,OU=Branches,DC=lending,DC=internal'.
hint-unapplied-policy-nandini =
    .lead = Nandini está en Central, donde el vínculo siempre ha estado. ¿Qué dice su puesto de Events Drive?
    .solution = gpresult /s CENTRAL-DESK1 /user LENDING\nmukherjee /r: Events Drive, Filtering: Denied (Security).
hint-unapplied-policy-filtering =
    .lead = Denied (Security) es el filtrado de seguridad: ¿quién tiene Apply Group Policy sobre la GPO (Get-Help Get-GPPermission)? ¿Y para quién es el recurso Events (Get-ADGroupMember DL_Events_RW)?
    .solution = Get-GPPermission 'Events Drive' -All: GpoApply solo para GG_Children; DL_Events_RW contiene GG_Children y GG_Management.
hint-unapplied-policy-filtered =
    .lead = Da al grupo que falta el derecho a aplicarla, sin abrirla a todo el mundo (Get-Help Set-GPPermission -Examples).
    .solution = Set-GPPermission 'Events Drive' -TargetName GG_Management -TargetType Group -PermissionLevel GpoApply
hint-unapplied-policy-end =
    .lead = El directorio es correcto; los puestos la aplican en su próxima actualización. Pídeselo ahora a uno, y comprueba (Get-Help Invoke-GPUpdate).
    .solution = Invoke-GPUpdate -Computer HILL-DESK1 -Target User, luego gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r: Events Drive aplicada.

## Capítulo 4 — Puertas y cuentas dormidas

hint-dormant-accounts-rdp-found =
    .lead = Lee la auditoría en Documents, y luego ve a mirar el cortafuegos de estantes: ¿qué regla de entrada activada deja pasar el 3389 (Get-Help Get-NetFirewallRule, Get-NetFirewallPortFilter)?
    .solution = ssh estantes, luego Get-NetFirewallPortFilter | Where-Object LocalPort -eq 3389 | Get-NetFirewallRule | Where-Object Enabled -eq True: «Remote Desktop - Any»; Get-NetFirewallAddressFilter muestra RemoteAddress Any.
hint-dormant-accounts-rdp-closed =
    .lead = Nadie usa ya el Escritorio remoto: cierra esa regla, no el perfil, y conserva tu propia forma de entrar (Get-Help Disable-NetFirewallRule, Set-NetFirewallRule).
    .solution = Disable-NetFirewallRule -DisplayName 'Remote Desktop - Any' (o Set-NetFirewallRule -DisplayName 'Remote Desktop - Any' -RemoteAddress 192.0.2.2), luego exit.
hint-dormant-accounts-inactive =
    .lead = De vuelta en registro: ¿qué cuentas llevan 90 días sin iniciar sesión (Get-Help Search-ADAccount; un TimeSpan se escribe días.horas:minutos:segundos)?
    .solution = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object SamAccountName, Enabled, LastLogonDate, DistinguishedName
hint-dormant-accounts-service-account =
    .lead = Antes de cerrar nada: ¿para qué sirve svc_backup? Su descripción, y lo que se ejecuta con ella en estantes.
    .solution = Get-ADUser svc_backup -Properties Description, o en estantes: Get-ScheduledTask | Select-Object TaskName, @{"{"}n='User';e={"{"}$_.Principal.UserId{"}"}{"}"} (Offsite Copy, cada 1 de abril).
hint-dormant-accounts-closed =
    .lead = Limita la búsqueda a las personas (-SearchBase), y luego para cada cuenta: desactivar, quitar de sus grupos salvo Domain Users, mover a Leavers. Una función o un bucle foreach (Get-Help ForEach-Object).
    .solution = $old = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly -SearchBase 'OU=Branches,DC=lending,DC=internal'; foreach ($a in $old) {"{"} Disable-ADAccount $a; Get-ADPrincipalGroupMembership $a | Where-Object Name -ne 'Domain Users' | ForEach-Object {"{"} Remove-ADGroupMember $_ $a -Confirm:$false {"}"}; Move-ADObject $a -TargetPath 'OU=Leavers,DC=lending,DC=internal' {"}"}
hint-dormant-accounts-leftover =
    .lead = La auditoría pregunta si tus bajas están de verdad fuera de sus grupos. Mira las cuentas de Leavers (Get-ADPrincipalGroupMembership).
    .solution = Remove-ADPrincipalGroupMembership oadeyemi -MemberOf GG_Lending, DL_Staff_RW -Confirm:$false
hint-dormant-accounts-report =
    .lead = La auditoría quiere un archivo CSV: la misma búsqueda, las columnas que piden (Get-Help Export-Csv -Examples).
    .solution = $old | Select-Object SamAccountName, Name, LastLogonDate | Export-Csv C:\Users\tu\Documents\dormant-accounts.csv -NoTypeInformation, luego Import-Csv para comprobarlo.
hint-dormant-accounts-end =
    .lead = Comprueba cada punto de la auditoría: el 3389 de estantes cerrado (y tu ssh abierto), las dos personas cerradas, los grupos de Olu, el informe; nada más cambiado.
    .solution = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object SamAccountName, Enabled, DistinguishedName; Get-ADPrincipalGroupMembership para cada una; Import-Csv sobre el informe.
