### Abgestufte Hinweise für Die Musikschule (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine Richtung)
### und .solution (fast die Antwort).

## Kapitel 1 — Zwei Schlösser

hint-two-locks-powershell =
    .lead = ssh notenlinien landet in cmd.exe, das die Cmdlets von PowerShell nicht kennt: Starte PowerShell (Gabriels Übergabe sagt, wie).
    .solution = Tipp powershell; die Eingabeaufforderung wird zu PS C:\Users\du>.
hint-two-locks-shares =
    .lead = Liste die SMB-Freigaben des Servers auf (Get-Command -Noun Smb*, Get-Help).
    .solution = Get-SmbShare: Teachers ist D:\Shares\Teachers.
hint-two-locks-share-access =
    .lead = Eine Freigabe hat eigene Berechtigungen, getrennt von denen des Verzeichnisses (Get-Help Get-SmbShareAccess).
    .solution = Get-SmbShareAccess Teachers: Everyone, Read.
hint-two-locks-ntfs =
    .lead = Jetzt die NTFS-Berechtigungen des Verzeichnisses (Get-Help Get-Acl, man icacls).
    .solution = icacls D:\Shares\Teachers, oder Get-Acl D:\Shares\Teachers | Format-List: Teachers hat Modify.
hint-two-locks-share-fixed =
    .lead = Lass die Gruppe Teachers über die Freigabe Dateien ändern, und nur diese Gruppe (Get-Help Grant-SmbShareAccess).
    .solution = Grant-SmbShareAccess -Name Teachers -AccountName Teachers -AccessRight Change, dann Y.
hint-two-locks-lessons =
    .lead = LessonPlans verweigert immer noch: Lies die eigenen NTFS-Berechtigungen dieses Verzeichnisses (man icacls).
    .solution = icacls D:\Shares\Teachers\LessonPlans: kein (I), nur Teachers:(OI)(CI)(RX).
hint-two-locks-end =
    .lead = Gib Teachers Modify auf LessonPlans, auch für seine Dateien und Unterverzeichnisse, oder schalte seine Vererbung wieder ein (man icacls: /grant mit (OI)(CI), /inheritance:e).
    .solution = icacls D:\Shares\Teachers\LessonPlans /grant "Teachers:(OI)(CI)(M)" (die Anführungszeichen zählen in PowerShell), oder icacls D:\Shares\Teachers\LessonPlans /inheritance:e.

## Kapitel 2 — Ausgesperrt

hint-service-logon-stopped =
    .lead = Sieh dir den Dienst der Agenda an (Get-Help Get-Service).
    .solution = Get-Service Agenda: Stopped.
hint-service-logon-start-failed =
    .lead = Versuch, ihn zu starten, und lies die Antwort (Get-Help Start-Service).
    .solution = Start-Service Agenda (oder sc.exe start Agenda: FAILED 1069).
hint-service-logon-events =
    .lead = Der Service Control Manager schreibt den Grund in das Protokoll System (Get-Help Get-WinEvent: -FilterHashtable).
    .solution = Get-WinEvent -FilterHashtable @{"{"}LogName='System'; Id=7000,7038{"}"} | Format-List, oder Get-EventLog System -EntryType Error -Newest 5.
hint-service-logon-account =
    .lead = Unter welchem Konto meldet sich der Dienst an? Get-Service sagt es nicht; WMI und sc.exe schon (Get-Help Get-CimInstance, man sc.exe).
    .solution = Get-CimInstance Win32_Service -Filter "Name='Agenda'" | Select-Object Name, StartName, State, oder sc.exe qc Agenda.
hint-service-logon-configured =
    .lead = Gib dem Dienst das neue Passwort des Kontos, aus dem Eintrag des Passwortmanagers in Documents (man sc.exe: config, obj=, password=; sc allein ist in PowerShell Set-Content).
    .solution = Get-Content Documents\tresor-svc_agenda.txt, dann sc.exe config Agenda obj= .\svc_agenda password= Rondo-7kq-Vt29.
hint-service-logon-end =
    .lead = Starte den Dienst, unter seinem eigenen Konto, und prüfe, dass er läuft und mit dem Server startet.
    .solution = Start-Service Agenda, dann Get-Service Agenda | Select-Object Status, StartType.

## Kapitel 3 — Die Logflut

hint-log-flood-full =
    .lead = Wie voll sind die Volumes des Servers? (Get-Help Get-Volume, Get-PSDrive)
    .solution = Get-Volume: D: (Data) hat noch 180 MB von 500 GB frei.
hint-log-flood-culprit =
    .lead = Finde die größten Dateien auf D:, nach Größe sortiert (Get-Help Get-ChildItem: -Recurse, -File; Get-Help Sort-Object).
    .solution = Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 10 FullName, Length; dann Get-ChildItem D:\Logs\Agenda | Measure-Object Length -Sum.
hint-log-flood-level =
    .lead = Warum sind die Logs der Agenda so groß? Lies ihre Konfigurationsdatei (der Pfad des Dienstes nennt sie: Get-CimInstance Win32_Service).
    .solution = Get-Content C:\ProgramData\Agenda\agenda.ini: level=debug.
hint-log-flood-whatif =
    .lead = Wähl nur die Logs aus, die älter als 30 Tage sind, und sieh dir an, was gelöscht würde, bevor du es löschst (Get-Help Where-Object, Get-Help Remove-Item: -WhatIf; (Get-Date).AddDays()).
    .solution = Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item -WhatIf
hint-log-flood-freed =
    .lead = Die Liste stimmt: Führe dieselbe Zeile ohne -WhatIf aus.
    .solution = Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item, dann Get-Volume.
hint-log-flood-end =
    .lead = Senk die Log-Stufe in agenda.ini und lass den Dienst sie dann neu lesen (Get-Help Set-Content, der Operator -replace, Get-Help Restart-Service).
    .solution = (Get-Content C:\ProgramData\Agenda\agenda.ini) -replace 'level=debug', 'level=info' | Set-Content C:\ProgramData\Agenda\agenda.ini, dann Restart-Service Agenda.

## Kapitel 4 — Das stille Backup

hint-silent-backup-ready =
    .lead = Sieh dir die Backup-Aufgabe an (Get-Help Get-ScheduledTask).
    .solution = Get-ScheduledTask: Nightly Backup, Ready.
hint-silent-backup-result =
    .lead = Ready sagt nichts über den letzten Lauf: Frag nach seinem Ergebnis (Get-Help Get-ScheduledTaskInfo).
    .solution = Get-ScheduledTaskInfo "Nightly Backup": LastTaskResult 2147943730; '{"{"}0:X{"}"}' -f 2147943730 ergibt 80070532.
hint-silent-backup-expired =
    .lead = Der Lauf scheitert bei der Anmeldung: Sieh dir das Konto der Aufgabe an und wann sein Passwort abläuft (Get-Help Get-LocalUser, man net).
    .solution = Get-LocalUser svc_backup | Select-Object Name, PasswordLastSet, PasswordExpires (oder net user svc_backup): abgelaufen am 20. Dezember.
hint-silent-backup-logon-fixed =
    .lead = Der Eintrag im Passwortmanager sagt, was die Regel der Schule für das Passwort dieses Kontos ist (Get-Help Set-LocalUser: -PasswordNeverExpires).
    .solution = Set-LocalUser svc_backup -PasswordNeverExpires $true (die Aufgabe behält dasselbe Passwort, das wieder funktioniert).
hint-silent-backup-missing =
    .lead = Führe die Aufgabe jetzt aus und such dann Beatriz' Verzeichnis im Backup (Get-Help Start-ScheduledTask, Test-Path).
    .solution = Start-ScheduledTask "Nightly Backup", dann Get-ChildItem D:\Backup\Shares\Office: kein Bank.
hint-silent-backup-loud =
    .lead = Lies das Skript: Ein Fehler in Copy-Item hält es weder an noch ändert er seinen Exit-Code. Lass Fehler es anhalten und mit einem Code ungleich null enden (man powershell: -ErrorAction Stop, $ErrorActionPreference, try/catch, exit), dann führe die Aufgabe noch einmal aus.
    .solution = Set-Content C:\Scripts\backup.ps1 mit $ErrorActionPreference = 'Stop' oben und dem Kopieren in try {"{"} … {"}"} catch {"{"} Add-Content D:\Logs\Backup\backup.log "$day FAILED: $_"; exit 1 {"}"}, dann Start-ScheduledTask "Nightly Backup".
hint-silent-backup-readable =
    .lead = Welches Verzeichnis kann svc_backup nicht lesen? Sieh dir die NTFS-Berechtigungen von Bank an (man icacls).
    .solution = icacls D:\Shares\Office\Bank /grant "svc_backup:(OI)(CI)(RX)"
hint-silent-backup-end =
    .lead = Führe die Aufgabe noch einmal aus und prüfe ihr Ergebnis und das Backup.
    .solution = Start-ScheduledTask "Nightly Backup", dann Get-ScheduledTaskInfo "Nightly Backup" (0) und Test-Path D:\Backup\Shares\Office\Bank.
