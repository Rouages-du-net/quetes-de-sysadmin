### Pistas graduales de La Escuela de Música (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una dirección) y
### .solution (casi la respuesta).

## Capítulo 1 — Dos cerraduras

hint-two-locks-powershell =
    .lead = ssh pentagrama llega a cmd.exe, que no conoce los cmdlets de PowerShell: arranca PowerShell (el traspaso de Gabriel dice cómo).
    .solution = Escribe powershell; el prompt pasa a ser PS C:\Users\tu>.
hint-two-locks-shares =
    .lead = Lista los recursos compartidos SMB del servidor (Get-Command -Noun Smb*, Get-Help).
    .solution = Get-SmbShare: Teachers es D:\Shares\Teachers.
hint-two-locks-share-access =
    .lead = Un recurso compartido tiene sus propios permisos, aparte de los de la carpeta (Get-Help Get-SmbShareAccess).
    .solution = Get-SmbShareAccess Teachers: Everyone, Read.
hint-two-locks-ntfs =
    .lead = Ahora los permisos NTFS de la carpeta (Get-Help Get-Acl, man icacls).
    .solution = icacls D:\Shares\Teachers, o Get-Acl D:\Shares\Teachers | Format-List: Teachers tiene Modify.
hint-two-locks-share-fixed =
    .lead = Deja que el grupo Teachers modifique archivos a través del recurso, y solo ese grupo (Get-Help Grant-SmbShareAccess).
    .solution = Grant-SmbShareAccess -Name Teachers -AccountName Teachers -AccessRight Change, luego Y.
hint-two-locks-lessons =
    .lead = LessonPlans sigue negándose: lee los permisos NTFS propios de esa carpeta (man icacls).
    .solution = icacls D:\Shares\Teachers\LessonPlans: ningún (I), solo Teachers:(OI)(CI)(RX).
hint-two-locks-end =
    .lead = Da a Teachers Modify sobre LessonPlans también para sus archivos y subcarpetas, o reactiva su herencia (man icacls: /grant con (OI)(CI), /inheritance:e).
    .solution = icacls D:\Shares\Teachers\LessonPlans /grant "Teachers:(OI)(CI)(M)" (las comillas importan en PowerShell), o icacls D:\Shares\Teachers\LessonPlans /inheritance:e.

## Capítulo 2 — Sin poder entrar

hint-service-logon-stopped =
    .lead = Mira el servicio de la Agenda (Get-Help Get-Service).
    .solution = Get-Service Agenda: Stopped.
hint-service-logon-start-failed =
    .lead = Intenta arrancarlo y lee la respuesta (Get-Help Start-Service).
    .solution = Start-Service Agenda (o sc.exe start Agenda: FAILED 1069).
hint-service-logon-events =
    .lead = El Service Control Manager escribe el porqué en el registro System (Get-Help Get-WinEvent: -FilterHashtable).
    .solution = Get-WinEvent -FilterHashtable @{"{"}LogName='System'; Id=7000,7038{"}"} | Format-List, o Get-EventLog System -EntryType Error -Newest 5.
hint-service-logon-account =
    .lead = ¿Con qué cuenta inicia sesión el servicio? Get-Service no lo dice; WMI y sc.exe sí (Get-Help Get-CimInstance, man sc.exe).
    .solution = Get-CimInstance Win32_Service -Filter "Name='Agenda'" | Select-Object Name, StartName, State, o sc.exe qc Agenda.
hint-service-logon-configured =
    .lead = Dale al servicio la nueva contraseña de la cuenta, de las entradas del gestor de contraseñas que están en Documents: la de la cuenta con la que inicia sesión el servicio (man sc.exe: config, obj=, password=; sc a secas es Set-Content en PowerShell).
    .solution = Get-Content Documents\caja-fuerte-cuentas-servicio.txt (la entrada svc_agenda), luego sc.exe config Agenda obj= .\svc_agenda password= Rondo-7kq-Vt29.
hint-service-logon-end =
    .lead = Arranca el servicio, con su propia cuenta, y comprueba que funciona y que arranca con el servidor.
    .solution = Start-Service Agenda, luego Get-Service Agenda | Select-Object Status, StartType.

## Capítulo 3 — La inundación de registros

hint-log-flood-full =
    .lead = ¿Cuánto están llenos los volúmenes del servidor? (Get-Help Get-Volume, Get-PSDrive)
    .solution = Get-Volume: a D: (Data) le quedan 180 MB de 500 GB.
hint-log-flood-culprit =
    .lead = Encuentra los archivos más grandes de D:, ordenados por tamaño (Get-Help Get-ChildItem: -Recurse, -File; Get-Help Sort-Object).
    .solution = Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 10 FullName, Length; luego Get-ChildItem D:\Logs\Agenda | Measure-Object Length -Sum.
hint-log-flood-level =
    .lead = ¿Por qué son tan grandes los registros de la Agenda? Lee su archivo de configuración (la ruta del servicio lo nombra: Get-CimInstance Win32_Service).
    .solution = Get-Content C:\ProgramData\Agenda\agenda.ini: level=debug.
hint-log-flood-whatif =
    .lead = Selecciona solo los registros de más de 30 días, y mira lo que se borraría antes de borrarlo (Get-Help Where-Object, Get-Help Remove-Item: -WhatIf; (Get-Date).AddDays()).
    .solution = Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item -WhatIf
hint-log-flood-freed =
    .lead = La lista es correcta: ejecuta la misma línea sin -WhatIf.
    .solution = Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item, luego Get-Volume.
hint-log-flood-end =
    .lead = Baja el nivel de registro en agenda.ini, y luego haz que el servicio lo vuelva a leer (Get-Help Set-Content, el operador -replace, Get-Help Restart-Service).
    .solution = (Get-Content C:\ProgramData\Agenda\agenda.ini) -replace 'level=debug', 'level=info' | Set-Content C:\ProgramData\Agenda\agenda.ini, luego Restart-Service Agenda.

## Capítulo 4 — La copia silenciosa

hint-silent-backup-ready =
    .lead = Mira la tarea de copia (Get-Help Get-ScheduledTask).
    .solution = Get-ScheduledTask: Nightly Backup, Ready.
hint-silent-backup-result =
    .lead = Ready no dice nada de la última ejecución: pide su resultado (Get-Help Get-ScheduledTaskInfo).
    .solution = Get-ScheduledTaskInfo "Nightly Backup": LastTaskResult 2147943730; '{"{"}0:X{"}"}' -f 2147943730 da 80070532.
hint-silent-backup-expired =
    .lead = La ejecución falla al iniciar sesión: mira la cuenta de la tarea y cuándo caduca su contraseña (Get-Help Get-LocalUser, man net).
    .solution = Get-LocalUser svc_backup | Select-Object Name, PasswordLastSet, PasswordExpires (o net user svc_backup): caducó el 20 de diciembre.
hint-silent-backup-logon-fixed =
    .lead = La entrada del gestor de contraseñas dice cuál es la política de la escuela para la contraseña de esta cuenta (Get-Help Set-LocalUser: -PasswordNeverExpires).
    .solution = Set-LocalUser svc_backup -PasswordNeverExpires $true (la tarea conserva la misma contraseña, que vuelve a funcionar).
hint-silent-backup-missing =
    .lead = Ejecuta la tarea ahora, y luego busca la carpeta de Beatriz en la copia (Get-Help Start-ScheduledTask, Test-Path).
    .solution = Start-ScheduledTask "Nightly Backup", luego Get-ChildItem D:\Backup\Shares\Office: no está Bank.
hint-silent-backup-loud =
    .lead = Lee el script: un error en Copy-Item no lo detiene ni cambia su código de salida. Haz que los errores lo detengan y que termine con un código distinto de cero (man powershell: -ErrorAction Stop, $ErrorActionPreference, try/catch, exit), y vuelve a ejecutar la tarea.
    .solution = Set-Content C:\Scripts\backup.ps1 con $ErrorActionPreference = 'Stop' al principio y la copia en try {"{"} … {"}"} catch {"{"} Add-Content D:\Logs\Backup\backup.log "$day FAILED: $_"; exit 1 {"}"}, luego Start-ScheduledTask "Nightly Backup".
hint-silent-backup-readable =
    .lead = ¿Qué carpeta no puede leer svc_backup? Mira los permisos NTFS de Bank (man icacls).
    .solution = icacls D:\Shares\Office\Bank /grant "svc_backup:(OI)(CI)(RX)"
hint-silent-backup-end =
    .lead = Vuelve a ejecutar la tarea y comprueba su resultado y la copia.
    .solution = Start-ScheduledTask "Nightly Backup", luego Get-ScheduledTaskInfo "Nightly Backup" (0) y Test-Path D:\Backup\Shares\Office\Bank.
