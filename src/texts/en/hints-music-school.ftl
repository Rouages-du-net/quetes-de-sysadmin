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
    .lead = Give the service the account's new password, from the password manager's entry in Documents (man sc.exe: config, obj=, password=; sc alone is Set-Content in PowerShell).
    .solution = Get-Content Documents\vault-svc_agenda.txt, then sc.exe config Agenda obj= .\svc_agenda password= Rondo-7kq-Vt29.
hint-service-logon-end =
    .lead = Start the service, under its own account, and check it runs and starts with the server.
    .solution = Start-Service Agenda, then Get-Service Agenda | Select-Object Status, StartType.
