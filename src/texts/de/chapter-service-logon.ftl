### Geschichte „Die Musikschule“, Kapitel „Ausgesperrt“: Der Dienst der
### Buchungs-App startet nicht mehr, nachdem das Passwort seines Kontos
### geändert und der Server neu gestartet wurde. Befehle, Cmdlets, Pfade,
### Passwörter und Ausgaben werden nicht übersetzt.

chapter-service-logon = Ausgesperrt
    .summary = Die Buchungs-App der Schule ist seit dem Neustart des Servers ausgefallen: Ihr Dienst startet nicht. Im Ereignisprotokoll finden, warum, und dem Dienst dann das neue Passwort seines Kontos geben, ohne ihm mehr Rechte zu geben, als er braucht.

## Dateien

service-logon-email-mariam =
    Von:  Mariam (Leitung)
    An:   dich

    Guten Morgen,

    Die Agenda ist ausgefallen: Seit heute Morgen bekommen die Lehrkräfte
    und das Sekretariat „Die Website ist nicht erreichbar“ auf
    http://notenlinien.internal:8080, und die Familien können ihre
    Probestunden nicht buchen.

    Der Server hat Sonntagnacht für Windows Update neu gestartet. Gabriel,
    der sich darum gekümmert hat, ist am Freitag gegangen; für alle Fälle
    habe ich dir die Einträge des Servers aus dem Passwortmanager
    exportiert, in Documents\tresor-dienstkonten.txt. Bitte lösch diese
    Datei, wenn du fertig bist.

    Könntest du die Agenda wieder zum Laufen bringen, ohne etwas anderes
    kaputt zu machen?

    Mariam

# { $agenda }, { $backup }, { $admin }: the passwords (not translated).
service-logon-vault =
    Passwortmanager - Ordner „notenlinien“, exportiert von Mariam (10. Dezember 2029)

    Titel:         notenlinien - svc_backup
    Benutzername:  svc_backup
    Passwort:      { $backup }
    Geändert:      3. Juni 2029 (Gabriel)
    Notizen:       Lokales Konto. Jedes Jahr geändert (Audit der
                   Versicherung, Punkt 4.2).

    Titel:         notenlinien - svc_agenda
    Benutzername:  svc_agenda
    Passwort:      { $agenda }
    Geändert:      7. Dezember 2029, 16:42 (Gabriel)
    Notizen:       Lokales Konto. Jedes Jahr geändert (Audit der
                   Versicherung, Punkt 4.2).

    Titel:         Agenda - Web-Admin
    Benutzername:  admin
    Passwort:      { $admin }
    Geändert:      2. September 2029 (Gabriel)
    Notizen:       http://notenlinien.internal:8080/admin

## Ereignisse

service-logon-event-stopped =
    Die Agenda ist Stopped, obwohl ihr Starttyp Automatic ist: Sie hätte
    Sonntagnacht mit dem Server starten sollen. Versuch, sie zu
    starten, und lies, was Windows antwortet.
service-logon-event-start-failed =
    Abgelehnt. Der Fehler selbst sagt wenig; Windows schreibt die Details
    in sein Ereignisprotokoll, unter dem Service Control Manager, dem Teil
    von Windows, der Dienste startet: das Protokoll System (Get-WinEvent,
    Get-EventLog).
service-logon-event-events =
    Ereignis 7038: Die Agenda „was unable to log on as .\svc_agenda with
    the currently configured password“, dann 7000: „logon failure“. Der
    Dienst startet unter seinem eigenen Konto, mit einem Passwort, das
    Windows beim Einrichten des Dienstes gespeichert hat. Welches Konto
    genau? (Get-CimInstance Win32_Service, oder sc.exe qc)
service-logon-event-account =
    StartName: .\svc_agenda, das lokale Konto (der Punkt bedeutet dieser
    Computer). Windows bewahrt das Passwort dieses Kontos beim Dienst auf:
    Hat jemand das Passwort des Kontos geändert, ist die Kopie des
    Dienstes nicht mitgegangen. Wann wurde es zuletzt gesetzt?
    (Get-LocalUser, PasswordLastSet)
service-logon-event-rotated =
    PasswordLastSet: Freitag, 16:42, Gabriels letzter Tag (das Audit der
    Versicherung verlangt jedes Jahr neue Dienstpasswörter). Der Dienst
    lief mit seiner Anmeldung bis zum Neustart am Sonntag weiter und hat
    dann das alte versucht. Das neue steht in den Einträgen, die Mariam
    exportiert hat: in dem des Kontos, unter dem sich der Dienst anmeldet.
service-logon-event-other-account =
    Die Agenda meldet sich jetzt als { $account } an: ein Konto für eine
    andere Aufgabe, mit Rechten, die die Buchungs-App nicht braucht
    (svc_backup ist Backup Operator: Es kann jede Datei des Servers
    lesen). Die Agenda hat ihr eigenes Konto, das ihr StartName nannte:
    svc_agenda.
service-logon-event-sc-alias =
    In PowerShell ist sc nicht sc.exe: Es ist ein Alias von Set-Content,
    das in Dateien schreibt und mit obj= nichts anfangen kann. Tipp sc.exe
    aus (in cmd.exe genügt sc).
service-logon-event-local-system =
    Die Agenda läuft jetzt als LocalSystem: Sie startet, aber mit allen
    Rechten auf dem Server, den Dateien des Systems, den Freigaben, den
    anderen Diensten. Eine Lücke in der Buchungs-App würde zu einer Lücke
    im ganzen Server. Setz sie wieder auf ihr eigenes Konto, svc_agenda,
    mit seinem Passwort (sc.exe config … obj= … password= …).
service-logon-event-reset =
    Du hast das Passwort von svc_agenda noch einmal geändert. Der
    Passwortmanager hat jetzt ein altes, und der Dienst ein noch älteres:
    Alles, was dieses Konto benutzt, muss das neue Passwort bekommen (der
    Dienst, der Passwortmanager), sonst scheitert der nächste Start
    genauso.
service-logon-event-wrong-password =
    Der Dienst hat jetzt ein Passwort, das nicht das des Kontos ist: Sein
    nächster Start scheitert mit demselben 7038. Kopier es genau aus dem
    Eintrag des Passwortmanagers.
service-logon-event-start-type =
    Die Agenda startet nicht mehr mit dem Server: Nach dem nächsten
    Neustart durch Windows Update wäre sie wieder ausgefallen. Ihr
    Starttyp sollte Automatic sein (Set-Service -StartupType, oder sc.exe
    config … start= auto).
service-logon-event-admin =
    svc_agenda ist jetzt in Administrators: Die Buchungs-App hätte alle
    Rechte auf dem Server. Ein Dienstkonto bekommt die Rechte, die seine
    App braucht, nicht mehr. Nimm es aus der Gruppe heraus
    (Remove-LocalGroupMember).
service-logon-event-configured =
    Der Dienst hat jetzt das neue Passwort des Kontos. Starte ihn und
    prüfe, dass er läuft.
service-logon-event-vault-deleted =
    Der exportierte Eintrag ist gelöscht: Das Passwort bleibt im
    Passwortmanager und nirgendwo sonst auf dem Server. Danke, sagt Mariam.
service-logon-event-end =
    Mariam: „Die Agenda ist zurück, die Familien buchen wieder. Danke! Ich
    schreibe es ins Verfahren: Wenn sich ein Dienstpasswort ändert,
    bekommt der Dienst es am selben Tag, und wir starten ihn zur Probe
    neu.“

    Gut gemacht! Du hast das Kapitel „Ausgesperrt“ abgeschlossen.

    WAS PASSIERT IST
    Ein Windows-Dienst startet unter einem Anmeldekonto; bei einem lokalen
    Konto bewahrt der Service Control Manager dessen Passwort mit der
    Konfiguration des Dienstes auf. Gabriel hat zu Recht das Passwort von
    svc_agenda geändert, aber nicht die Kopie, die der Dienst aufbewahrt
    hat. Die Agenda lief bis zum Update-Neustart am Sonntag weiter und
    konnte sich dann nicht anmelden: 7038 und 7000 im Protokoll System,
    Fehler 1069. Du hast dem Dienst das neue Passwort aus dem
    Passwortmanager gegeben (sc.exe config) und ihn unter seinem eigenen
    Konto gestartet.

    GUTE PRAXIS
    - Das Passwort eines Dienstkontos zu ändern heißt, alles zu
      aktualisieren, was es speichert: Dienste (Get-CimInstance
      Win32_Service, StartName), geplante Aufgaben (Get-ScheduledTask, ihr
      Principal), Skripte.
    - Den Dienst gleich nach der Änderung neu starten: Ein Fehler zeigt
      sich am selben Tag, nicht beim nächsten Neustart um 3 Uhr morgens.
    - Das Protokoll System sagt, warum: Ereignis 7038 nennt das Konto, 7000
      den Dienst.
    - Geringste Rechte: Ein Dienst läuft als eigenes Konto mit den Rechten,
      die er braucht, nicht als LocalSystem und nicht als Admin.
    - Passwörter leben im Passwortmanager; ein Export wird nach Gebrauch
      gelöscht.

    EIN ANDERER WEG
    In einer Domäne ändert ein gruppenverwaltetes Dienstkonto (gMSA) sein
    Passwort selbst, und die Dienste folgen, ohne dass man etwas neu
    eintippen muss. Auf einem einzelnen Server braucht ein virtuelles
    Konto (NT SERVICE\Agenda) überhaupt kein Passwort, wenn die App nur
    lokale Rechte braucht. Die Dienstekonsole (services.msc), Reiter
    Anmelden, tut, was sc.exe config tut.

    DOKUMENTATION
    - Benutzerkonten für Dienste: https://learn.microsoft.com/windows/win32/services/service-user-accounts
    - sc.exe config: https://learn.microsoft.com/windows-server/administration/windows-commands/sc-config
    - Ereignisse 7000, 7011, 7009: https://learn.microsoft.com/troubleshoot/windows-server/system-management-components/event-id-7000-7011-7009
    - Get-WinEvent: https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1
    - Gruppenverwaltete Dienstkonten: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
