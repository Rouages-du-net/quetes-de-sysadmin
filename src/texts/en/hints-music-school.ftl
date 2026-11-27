### Graded hints for The Music School (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction) and .solution
### (almost the answer).

## Chapter 1 — Two Locks

hint-two-locks-powershell =
    .lead = ssh stave lands in cmd.exe, which doesn't know PowerShell's cmdlets: start PowerShell (Gabriel's handover says how).
    .solution = Type powershell; the prompt becomes PS C:\Users\you>.
hint-two-locks-shares =
    .lead = List the server's SMB shares (Get-Command -Noun Smb*, Get-Help).
    .solution = Get-SmbShare: Teachers is D:\Shares\Teachers.
hint-two-locks-share-access =
    .lead = A share has its own permissions, apart from the folder's (Get-Help Get-SmbShareAccess).
    .solution = Get-SmbShareAccess Teachers: Everyone, Read.
hint-two-locks-ntfs =
    .lead = Now the folder's NTFS permissions (Get-Help Get-Acl, man icacls).
    .solution = icacls D:\Shares\Teachers, or Get-Acl D:\Shares\Teachers | Format-List: Teachers has Modify.
hint-two-locks-share-fixed =
    .lead = Let the Teachers group change files through the share, and only that group (Get-Help Grant-SmbShareAccess).
    .solution = Grant-SmbShareAccess -Name Teachers -AccountName Teachers -AccessRight Change, then Y.
hint-two-locks-lessons =
    .lead = LessonPlans still refuses: read that folder's own NTFS permissions (man icacls).
    .solution = icacls D:\Shares\Teachers\LessonPlans: no (I), Teachers:(OI)(CI)(RX) only.
hint-two-locks-end =
    .lead = Give Teachers Modify on LessonPlans for its files and subfolders too, or turn its inheritance back on (man icacls: /grant with (OI)(CI), /inheritance:e).
    .solution = icacls D:\Shares\Teachers\LessonPlans /grant "Teachers:(OI)(CI)(M)" (the quotes matter in PowerShell), or icacls D:\Shares\Teachers\LessonPlans /inheritance:e.

## Chapter 2 — Locked Out

hint-service-logon-stopped =
    .lead = Look at the Agenda's service (Get-Help Get-Service).
    .solution = Get-Service Agenda: Stopped.
hint-service-logon-start-failed =
    .lead = Try to start it, and read the answer (Get-Help Start-Service).
    .solution = Start-Service Agenda (or sc.exe start Agenda: FAILED 1069).
hint-service-logon-events =
    .lead = The Service Control Manager writes why in the System log (Get-Help Get-WinEvent: -FilterHashtable).
    .solution = Get-WinEvent -FilterHashtable @{"{"}LogName='System'; Id=7000,7038{"}"} | Format-List, or Get-EventLog System -EntryType Error -Newest 5.
hint-service-logon-account =
    .lead = Which account does the service log on as? Get-Service doesn't say; WMI and sc.exe do (Get-Help Get-CimInstance, man sc.exe).
    .solution = Get-CimInstance Win32_Service -Filter "Name='Agenda'" | Select-Object Name, StartName, State, or sc.exe qc Agenda.
hint-service-logon-configured =
    .lead = Give the service the account's new password, from the password manager's entries in Documents: the account the service logs on as (man sc.exe: config, obj=, password=; sc alone is Set-Content in PowerShell).
    .solution = Get-Content Documents\vault-service-accounts.txt (the svc_agenda entry), then sc.exe config Agenda obj= .\svc_agenda password= Rondo-7kq-Vt29.
hint-service-logon-end =
    .lead = Start the service, under its own account, and check it runs and starts with the server.
    .solution = Start-Service Agenda, then Get-Service Agenda | Select-Object Status, StartType.

## Chapter 3 — The Log Flood

hint-log-flood-full =
    .lead = How full are the server's volumes? (Get-Help Get-Volume, Get-PSDrive)
    .solution = Get-Volume: D: (Data) has 180 MB left of 500 GB.
hint-log-flood-culprit =
    .lead = Find the biggest files on D:, sorted by size (Get-Help Get-ChildItem: -Recurse, -File; Get-Help Sort-Object).
    .solution = Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 10 FullName, Length; then Get-ChildItem D:\Logs\Agenda | Measure-Object Length -Sum.
hint-log-flood-level =
    .lead = Why are the Agenda's logs so big? Read its configuration file (the service's path names it: Get-CimInstance Win32_Service).
    .solution = Get-Content C:\ProgramData\Agenda\agenda.ini: level=debug.
hint-log-flood-whatif =
    .lead = Select only the logs older than 30 days, and see what would be deleted before deleting it (Get-Help Where-Object, Get-Help Remove-Item: -WhatIf; (Get-Date).AddDays()).
    .solution = Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item -WhatIf
hint-log-flood-freed =
    .lead = The list is right: run the same line without -WhatIf.
    .solution = Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item, then Get-Volume.
hint-log-flood-end =
    .lead = Lower the log level in agenda.ini, then make the service read it again (Get-Help Set-Content, the -replace operator, Get-Help Restart-Service).
    .solution = (Get-Content C:\ProgramData\Agenda\agenda.ini) -replace 'level=debug', 'level=info' | Set-Content C:\ProgramData\Agenda\agenda.ini, then Restart-Service Agenda.

## Chapter 4 — The Silent Backup

hint-silent-backup-ready =
    .lead = Look at the backup task (Get-Help Get-ScheduledTask).
    .solution = Get-ScheduledTask: Nightly Backup, Ready.
hint-silent-backup-result =
    .lead = Ready says nothing about the last run: ask for its result (Get-Help Get-ScheduledTaskInfo).
    .solution = Get-ScheduledTaskInfo "Nightly Backup": LastTaskResult 2147943730; '{"{"}0:X{"}"}' -f 2147943730 gives 80070532.
hint-silent-backup-expired =
    .lead = The run fails at the logon: look at the task's account and when its password expires (Get-Help Get-LocalUser, man net).
    .solution = Get-LocalUser svc_backup | Select-Object Name, PasswordLastSet, PasswordExpires (or net user svc_backup): expired on 20 December.
hint-silent-backup-logon-fixed =
    .lead = The password manager's entry says what the school's policy is for this account's password (Get-Help Set-LocalUser: -PasswordNeverExpires).
    .solution = Set-LocalUser svc_backup -PasswordNeverExpires $true (the task keeps the same password, which works again).
hint-silent-backup-missing =
    .lead = Run the task now, then look for Beatriz's folder in the backup (Get-Help Start-ScheduledTask, Test-Path).
    .solution = Start-ScheduledTask "Nightly Backup", then Get-ChildItem D:\Backup\Shares\Office: no Bank.
hint-silent-backup-loud =
    .lead = Read the script: an error in Copy-Item doesn't stop it nor change its exit code. Make errors stop it and end with a non-zero code (man powershell: -ErrorAction Stop, $ErrorActionPreference, try/catch, exit), then run the task again.
    .solution = Set-Content C:\Scripts\backup.ps1 with $ErrorActionPreference = 'Stop' at the top and the copy in try {"{"} … {"}"} catch {"{"} Add-Content D:\Logs\Backup\backup.log "$day FAILED: $_"; exit 1 {"}"}, then Start-ScheduledTask "Nightly Backup".
hint-silent-backup-readable =
    .lead = Which folder can't svc_backup read? Look at Bank's NTFS permissions (man icacls).
    .solution = icacls D:\Shares\Office\Bank /grant "svc_backup:(OI)(CI)(RX)"
hint-silent-backup-end =
    .lead = Run the task again and check its result and the backup.
    .solution = Start-ScheduledTask "Nightly Backup", then Get-ScheduledTaskInfo "Nightly Backup" (0) and Test-Path D:\Backup\Shares\Office\Bank.
