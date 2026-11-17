### Indices gradués de L'École de musique (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une piste) et
### .solution (presque la réponse).

## Chapitre 1 — Deux serrures

hint-two-locks-powershell =
    .lead = ssh portee arrive dans cmd.exe, qui ne connaît pas les cmdlets de PowerShell : lancez PowerShell (la passation de Gabriel dit comment).
    .solution = Tapez powershell ; l'invite devient PS C:\Users\vous>.
hint-two-locks-shares =
    .lead = Listez les partages SMB du serveur (Get-Command -Noun Smb*, Get-Help).
    .solution = Get-SmbShare : Teachers, c'est D:\Shares\Teachers.
hint-two-locks-share-access =
    .lead = Un partage a ses propres permissions, à part de celles du dossier (Get-Help Get-SmbShareAccess).
    .solution = Get-SmbShareAccess Teachers : Everyone, Read.
hint-two-locks-ntfs =
    .lead = Maintenant les permissions NTFS du dossier (Get-Help Get-Acl, man icacls).
    .solution = icacls D:\Shares\Teachers, ou Get-Acl D:\Shares\Teachers | Format-List : Teachers a Modify.
hint-two-locks-share-fixed =
    .lead = Laissez le groupe Teachers modifier des fichiers par le partage, et ce groupe seulement (Get-Help Grant-SmbShareAccess).
    .solution = Grant-SmbShareAccess -Name Teachers -AccountName Teachers -AccessRight Change, puis Y.
hint-two-locks-lessons =
    .lead = LessonPlans refuse toujours : lisez les permissions NTFS propres à ce dossier (man icacls).
    .solution = icacls D:\Shares\Teachers\LessonPlans : aucun (I), seulement Teachers:(OI)(CI)(RX).
hint-two-locks-end =
    .lead = Donnez Modify à Teachers sur LessonPlans, pour ses fichiers et sous-dossiers aussi, ou rétablissez son héritage (man icacls : /grant avec (OI)(CI), /inheritance:e).
    .solution = icacls D:\Shares\Teachers\LessonPlans /grant "Teachers:(OI)(CI)(M)" (les guillemets comptent dans PowerShell), ou icacls D:\Shares\Teachers\LessonPlans /inheritance:e.

## Chapitre 2 — Le service à la porte

hint-service-logon-stopped =
    .lead = Regardez le service de l'Agenda (Get-Help Get-Service).
    .solution = Get-Service Agenda : Stopped.
hint-service-logon-start-failed =
    .lead = Essayez de le démarrer, et lisez la réponse (Get-Help Start-Service).
    .solution = Start-Service Agenda (ou sc.exe start Agenda : FAILED 1069).
hint-service-logon-events =
    .lead = Le Service Control Manager écrit pourquoi dans le journal System (Get-Help Get-WinEvent : -FilterHashtable).
    .solution = Get-WinEvent -FilterHashtable @{"{"}LogName='System'; Id=7000,7038{"}"} | Format-List, ou Get-EventLog System -EntryType Error -Newest 5.
hint-service-logon-account =
    .lead = Sous quel compte le service ouvre-t-il sa session ? Get-Service ne le dit pas ; WMI et sc.exe, si (Get-Help Get-CimInstance, man sc.exe).
    .solution = Get-CimInstance Win32_Service -Filter "Name='Agenda'" | Select-Object Name, StartName, State, ou sc.exe qc Agenda.
hint-service-logon-configured =
    .lead = Donnez au service le nouveau mot de passe du compte, tiré de l'entrée du gestionnaire dans Documents (man sc.exe : config, obj=, password= ; sc tout court, c'est Set-Content dans PowerShell).
    .solution = Get-Content Documents\coffre-svc_agenda.txt, puis sc.exe config Agenda obj= .\svc_agenda password= Rondo-7kq-Vt29.
hint-service-logon-end =
    .lead = Démarrez le service, sous son propre compte, et vérifiez qu'il tourne et qu'il démarre avec le serveur.
    .solution = Start-Service Agenda, puis Get-Service Agenda | Select-Object Status, StartType.
