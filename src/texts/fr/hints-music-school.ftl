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

## Chapitre 3 — La crue des journaux

hint-log-flood-full =
    .lead = À quel point les volumes du serveur sont-ils pleins ? (Get-Help Get-Volume, Get-PSDrive)
    .solution = Get-Volume : il reste 180 Mo sur les 500 Go de D: (Data).
hint-log-flood-culprit =
    .lead = Trouvez les plus gros fichiers de D:, triés par taille (Get-Help Get-ChildItem : -Recurse, -File ; Get-Help Sort-Object).
    .solution = Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 10 FullName, Length ; puis Get-ChildItem D:\Logs\Agenda | Measure-Object Length -Sum.
hint-log-flood-level =
    .lead = Pourquoi les journaux de l'Agenda sont-ils si gros ? Lisez son fichier de configuration (le chemin du service le nomme : Get-CimInstance Win32_Service).
    .solution = Get-Content C:\ProgramData\Agenda\agenda.ini : level=debug.
hint-log-flood-whatif =
    .lead = Ne sélectionnez que les journaux de plus de 30 jours, et voyez ce qui serait supprimé avant de le supprimer (Get-Help Where-Object, Get-Help Remove-Item : -WhatIf ; (Get-Date).AddDays()).
    .solution = Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item -WhatIf
hint-log-flood-freed =
    .lead = La liste est bonne : relancez la même ligne sans -WhatIf.
    .solution = Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item, puis Get-Volume.
hint-log-flood-end =
    .lead = Baissez le niveau de journal dans agenda.ini, puis faites-le relire au service (Get-Help Set-Content, l'opérateur -replace, Get-Help Restart-Service).
    .solution = (Get-Content C:\ProgramData\Agenda\agenda.ini) -replace 'level=debug', 'level=info' | Set-Content C:\ProgramData\Agenda\agenda.ini, puis Restart-Service Agenda.

## Chapitre 4 — La sauvegarde muette

hint-silent-backup-ready =
    .lead = Regardez la tâche de sauvegarde (Get-Help Get-ScheduledTask).
    .solution = Get-ScheduledTask : Nightly Backup, Ready.
hint-silent-backup-result =
    .lead = Ready ne dit rien de la dernière exécution : demandez son résultat (Get-Help Get-ScheduledTaskInfo).
    .solution = Get-ScheduledTaskInfo "Nightly Backup" : LastTaskResult 2147943730 ; '{"{"}0:X{"}"}' -f 2147943730 donne 80070532.
hint-silent-backup-expired =
    .lead = L'exécution échoue à l'ouverture de session : regardez le compte de la tâche et quand son mot de passe expire (Get-Help Get-LocalUser, man net).
    .solution = Get-LocalUser svc_backup | Select-Object Name, PasswordLastSet, PasswordExpires (ou net user svc_backup) : expiré le 20 décembre.
hint-silent-backup-logon-fixed =
    .lead = L'entrée du gestionnaire de mots de passe dit quelle est la règle de l'école pour le mot de passe de ce compte (Get-Help Set-LocalUser : -PasswordNeverExpires).
    .solution = Set-LocalUser svc_backup -PasswordNeverExpires $true (la tâche garde le même mot de passe, qui marche de nouveau).
hint-silent-backup-missing =
    .lead = Lancez la tâche maintenant, puis cherchez le dossier de Beatriz dans la sauvegarde (Get-Help Start-ScheduledTask, Test-Path).
    .solution = Start-ScheduledTask "Nightly Backup", puis Get-ChildItem D:\Backup\Shares\Office : pas de Bank.
hint-silent-backup-loud =
    .lead = Lisez le script : une erreur de Copy-Item ne l'arrête pas et ne change pas son code de sortie. Faites que les erreurs l'arrêtent et qu'il finisse avec un code non nul (man powershell : -ErrorAction Stop, $ErrorActionPreference, try/catch, exit), puis relancez la tâche.
    .solution = Set-Content C:\Scripts\backup.ps1 avec $ErrorActionPreference = 'Stop' en tête et la copie dans try {"{"} … {"}"} catch {"{"} Add-Content D:\Logs\Backup\backup.log "$day FAILED: $_"; exit 1 {"}"}, puis Start-ScheduledTask "Nightly Backup".
hint-silent-backup-readable =
    .lead = Quel dossier svc_backup ne peut-il pas lire ? Regardez les autorisations NTFS de Bank (man icacls).
    .solution = icacls D:\Shares\Office\Bank /grant "svc_backup:(OI)(CI)(RX)"
hint-silent-backup-end =
    .lead = Relancez la tâche et vérifiez son résultat et la sauvegarde.
    .solution = Start-ScheduledTask "Nightly Backup", puis Get-ScheduledTaskInfo "Nightly Backup" (0) et Test-Path D:\Backup\Shares\Office\Bank.
