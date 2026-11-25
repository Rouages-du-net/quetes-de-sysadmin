### Geschichte „Die Musikschule“, Kapitel „Zwei Schlösser“: Die Lehrkräfte
### können in ihrer Freigabe auf dem Windows Server der Schule nichts
### speichern; Freigabeberechtigungen und NTFS-Berechtigungen, beide zu
### eng. Dazu die gemeinsamen Texte der Geschichte (Gabriels Übergabe).
### Befehle, Cmdlets, Pfade und Ausgaben werden nicht übersetzt.

chapter-two-locks = Zwei Schlösser
    .summary = Die Lehrkräfte können ihre Freigabe auf dem Windows Server der Musikschule öffnen, aber nichts darin speichern: die Berechtigungen der Freigabe und die NTFS-Berechtigungen der Verzeichnisse lesen und beide Schlösser für die Lehrkräfte öffnen, und nur für sie.

## Dateien

music-school-handover =
    notenlinien - Übergabenotizen (Gabriel, 30. November 2029)

    Der Server: notenlinien.internal (192.0.2.42), Windows Server 2022.
    Fernzugriff: OpenSSH, in Windows eingebaut, mit deinem Schlüssel. Man
    landet in cmd.exe: Tipp powershell, um PowerShell zu bekommen (exit
    führt zurück).

    Lokale Gruppen:
      Teachers   samir, lucia, yuki (die Lehrkräfte)
      Office     beatriz, tomasz (das Sekretariat)

    Freigaben (D:\Shares auf dem Server):
      Teachers   Unterricht, Noten, Aufnahmen (die Lehrkräfte)
      Office     Anmeldungen und Gebühren (das Sekretariat)
      Public     Plakate und Stundenpläne (alle lesen)

    Im Sommer habe ich die Freigaben auf die neue Platte (D:) verschoben
    und sie mit New-SmbShare neu angelegt. Während des Kopierens habe ich
    LessonPlans eingefroren, damit niemand mittendrin eine Datei ändert.

    Dienst:
      Agenda     Buchungen von Unterricht und Räumen
                 (http://notenlinien.internal:8080), läuft unter einem
                 eigenen lokalen Konto, svc_agenda.

    Geplante Aufgabe:
      Nightly Backup   jede Nacht um 1:30, C:\Scripts\backup.ps1 als
                       svc_backup: kopiert D:\Shares nach D:\Backup\Shares.

    Logs: D:\Logs (Agenda, Backup). Windows Update startet den Server
    sonntagnachts um 3:00 neu, wenn ein Update es verlangt.

    Passwörter: im Passwortmanager der Schule (Mariam öffnet ihn).

    Danke, dass du übernimmst, und viel Erfolg!
    Gabriel

two-locks-email-samir =
    Von:  Samir (Koordination der Lehrkräfte)
    An:   dich
    Cc:   Mariam

    Hallo, und willkommen in der Schule!

    Seit Schuljahresbeginn können wir Lehrkräfte unsere Freigabe öffnen
    (\\notenlinien\Teachers), aber nichts darin speichern: Word sagt, wir
    hätten keine Berechtigung, an diesem Ort zu speichern, und eine Datei
    dorthin zu kopieren ergibt „Access is denied“. Dasselbe für Lucia, Yuki
    und mich, in Scores wie in LessonPlans. Das Sekretariat hat mit seiner
    eigenen Freigabe keine Probleme.

    Gabriel hat dir eine Übergabe geschrieben (Documents\uebergabe.txt).
    Bevor er ging, sagte er „das müssen die Berechtigungen sein“, aber er
    hatte keine Zeit nachzusehen.

    Wir müssen die Stimmen fürs Konzert vor der Probe am Freitag in Scores
    ablegen, und die Dezemberpläne in LessonPlans. Und bitte: nur wir
    Lehrkräfte. Das Sekretariat soll unsere Dateien nicht ändern können
    (und wir nicht seine).

    Samir

## Ereignisse

two-locks-event-cmd =
    Du bist in cmd.exe, dem alten Befehlsinterpreter von Windows: Sein
    OpenSSH startet ihn, wenn keine DefaultShell gesetzt ist. Er kennt dir,
    cd, type und die Programme (icacls, net, sc, whoami), nicht die Cmdlets
    von PowerShell. Tipp powershell, um darin Windows PowerShell zu starten
    (exit führt zurück).
two-locks-event-powershell =
    PS C:\Users\du>: Windows PowerShell. Seine Befehle, die Cmdlets, sind
    nach dem Muster Verb-Substantiv benannt; Get-Help NAME ist das
    Handbuch, und Get-Command -Noun Smb* listet die auf, die mit Freigaben
    zu tun haben. Von wo werden die Dateien der Lehrkräfte freigegeben?
two-locks-event-shares =
    Get-SmbShare listet die Freigaben auf: Teachers ist D:\Shares\Teachers
    auf dem Server (die mit $ am Ende sind die administrativen Freigaben
    von Windows). Um eine Datei über eine Freigabe zu erreichen, gehst du
    durch zwei Schlösser: die Berechtigungen der Freigabe
    (Get-SmbShareAccess), dann die NTFS-Berechtigungen des Verzeichnisses
    (Get-Acl, icacls).
two-locks-event-share-access =
    Da: Auf der Freigabe darf Everyone lesen (Read), und nichts weiter. Das
    vergibt New-SmbShare, wenn es kein -ChangeAccess oder -FullAccess
    bekommt: Als Gabriel die Freigabe im Sommer neu angelegt hat, bekam sie
    die Voreinstellung. Über die Freigabe schreibt niemand, was auch immer
    NTFS sagt. Sieh dir auch NTFS an, bevor du etwas änderst.
two-locks-event-ntfs =
    NTFS gibt der Gruppe Teachers Modify auf D:\Shares\Teachers, vererbt an
    den Inhalt ((OI)(CI): Dateien und Verzeichnisse), und das Verzeichnis
    erbt nicht von D:\Shares (keine (I)-Zeile): nur SYSTEM, die Admins, die
    Lehrkräfte und svc_backup (für das Backup). Auf dieser Seite dürfen die
    Lehrkräfte schreiben. Wer ist in Teachers?
two-locks-event-members =
    Teachers: samir, lucia, yuki, alle drei. Einer Gruppe Rechte zu geben
    ist das Richtige: Wenn eine Lehrkraft kommt oder geht, änderst du die
    Gruppe, nicht jedes Verzeichnis.
two-locks-event-share-fixed =
    Samir: „Scores funktioniert! Ich habe gerade die Stimmen fürs Konzert
    dort abgelegt. Aber LessonPlans sagt immer noch Access is denied, für
    uns alle drei.“ Die Freigabe lässt die Lehrkräfte jetzt Dateien ändern:
    In LessonPlans sagt NTFS nein. Sieh dir die Berechtigungen dieses
    Verzeichnisses an.
two-locks-event-share-fixed-all =
    Samir: „Scores und LessonPlans funktionieren jetzt beide!“
two-locks-event-lessons =
    LessonPlans hat eigene Berechtigungen: kein (I), also ist seine
    Vererbung aus, und die Lehrkräfte haben nur (RX), Lesen und Ausführen.
    Gabriels Einfrieren während des Kopierens im Sommer, nie aufgehoben.
    Gib Teachers wieder Modify auf dieses Verzeichnis, auch für seine
    Dateien und Unterverzeichnisse, oder schalte seine Vererbung wieder
    ein, damit es die Einträge von D:\Shares\Teachers bekommt (man icacls:
    /grant, /inheritance).
two-locks-event-folder-only =
    Die Lehrkräfte können jetzt Dateien in LessonPlans anlegen, aber die
    vorhandenen nicht ändern: Der Eintrag, den du hinzugefügt hast, gilt
    nur für das Verzeichnis. Ohne (OI)(CI) (object inherit, container
    inherit) bekommen seine Dateien und Unterverzeichnisse ihn nicht. Bei
    icacls stehen die Flags vor dem Recht.
two-locks-event-too-broad =
    Vorsicht: Leute, die keine Lehrkräfte sind, können jetzt Dateien in der
    Freigabe der Lehrkräfte ändern (das Sekretariat oder alle, je nachdem,
    was du geöffnet hast). Über eine Freigabe ist der Zugriff das
    Restriktivere aus Freigabe und NTFS: Wenn beide für alle offen sind,
    schreiben alle. Gib die Rechte der Gruppe Teachers und halte
    mindestens ein Schloss für alle anderen geschlossen.
two-locks-event-admin =
    Eine Lehrkraft in Administrators kommt durch jedes Schloss, überall auf
    dem Server: ihre Dateien, die des Sekretariats, die des Systems. Das
    ist keine Korrektur, das heißt, die Schlösser abzumontieren. Nimm sie
    aus Administrators heraus (Remove-LocalGroupMember) und gib die Rechte
    der Gruppe Teachers.
two-locks-event-full-control =
    Über Freigabe und NTFS haben die Lehrkräfte jetzt Full Control: Sie
    könnten die Berechtigungen selbst ändern oder den Besitz der Dateien
    übernehmen. Change auf der Freigabe und Modify auf NTFS genügen zum
    Arbeiten.
two-locks-event-end =
    Samir: „Lucia hat die Dezemberpläne in LessonPlans gespeichert, ich habe
    die Stimmen in Scores gelegt, und Beatriz hat geprüft: Sie kann unser
    Verzeichnis nicht anrühren. Perfekt, danke! Sehen wir uns beim
    Konzert?“

    Gut gemacht! Du hast das Kapitel „Zwei Schlösser“ abgeschlossen.

    WAS PASSIERT IST
    Die Lehrkräfte erreichen ihre Dateien über \\notenlinien\Teachers, und
    dort entscheiden zwei Sätze von Berechtigungen: die der Freigabe und
    die von NTFS. Windows behält das Restriktivere der beiden. Die mit der
    Voreinstellung von New-SmbShare neu angelegte Freigabe gab Everyone nur
    Read; und LessonPlans, während des Kopierens im Sommer eingefroren,
    hatte seine Vererbung verloren und den Lehrkräften nur Leserechte
    gelassen. Zwei Schlösser, beide zu: Du hast jedes geöffnet, nur für
    die Gruppe Teachers.

    GUTE PRAXIS
    - Über eine Freigabe ist der effektive Zugriff Freigabeberechtigungen
      UND NTFS-Berechtigungen: Das Restriktivere gewinnt. Lies beide:
      Get-SmbShareAccess, dann Get-Acl oder icacls.
    - Rechte an Gruppen geben (Teachers), nicht an Personen, und nie
      Schreibzugriff an Everyone.
    - Eine verbreitete Wahl: breite Freigabeberechtigungen (Authenticated
      Users, Change) und präzises NTFS, oder präzise auf beiden Seiten; nie
      breit auf beiden.
    - (OI)(CI), damit Dateien und Unterverzeichnisse erben; ein
      Verzeichnis, dessen Vererbung aus ist (kein (I)), behält nur seine
      eigenen Einträge.
    - Administrators ist keine Korrektur von Berechtigungen, und Full
      Control lässt Leute die Berechtigungen selbst ändern: Change und
      Modify genügen.
    - Ein „vorübergehendes“ Einfrieren wird mit Enddatum aufgeschrieben und
      wieder aufgehoben.

    EIN ANDERER WEG
    New-SmbShare -Name Teachers -Path D:\Shares\Teachers -ChangeAccess
    NOTENLINIEN\Teachers hätte die Freigabe gleich beim ersten Mal richtig
    angelegt. Set-Acl mit einer FileSystemAccessRule tut, was icacls tut.
    Im Explorer zeigt Eigenschaften > Sicherheit > Erweitert > Effektiver
    Zugriff den Zugriff eines Benutzers. Und um über ssh direkt in
    PowerShell zu landen, liest das OpenSSH von Windows DefaultShell unter
    HKLM:\SOFTWARE\OpenSSH (New-ItemProperty).

    DOKUMENTATION
    - Freigabe- und NTFS-Berechtigungen: https://learn.microsoft.com/troubleshoot/windows-server/networking/permissions-on-shared-folders-and-ntfs
    - Grant-SmbShareAccess: https://learn.microsoft.com/powershell/module/smbshare/grant-smbshareaccess
    - icacls: https://learn.microsoft.com/windows-server/administration/windows-commands/icacls
    - Get-Acl: https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl?view=powershell-5.1
    - DefaultShell von OpenSSH: https://learn.microsoft.com/windows-server/administration/openssh/openssh-server-configuration
