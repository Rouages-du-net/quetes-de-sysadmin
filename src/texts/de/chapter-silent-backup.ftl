### Geschichte „Die Musikschule“, Kapitel „Das stille Backup“: Die
### nächtliche Backup-Aufgabe zeigt Ready, hat aber seit Wochen nichts
### kopiert, und ihr Skript hat vorher seine Fehler versteckt. Befehle,
### Cmdlets, Pfade, Passwörter und Ausgaben werden nicht übersetzt.

chapter-silent-backup = Das stille Backup
    .summary = Eine Datei soll wiederhergestellt werden, und das Backup hat nichts Aktuelles: Die nächtliche Aufgabe sagt Ready und scheitert doch jede Nacht. In ihrem Ergebnis und den Logs finden, warum, ihr Konto reparieren und ihr Skript dann Fehler melden lassen, statt sie zu verstecken.

## Dateien

silent-backup-email-mariam =
    Von:  Mariam (Leitung)
    An:   dich

    Guten Morgen,

    Am Freitag hat Beatriz versehentlich den Kontoauszug vom November
    gelöscht, aus der Freigabe Office (Office\Bank). Könntest du ihn aus
    dem Backup zurückholen? Gabriels Übergabe sagt, dass die Aufgabe
    „Nightly Backup“ jede Nacht um 1:30 die Freigaben nach D:\Backup
    kopiert und in D:\Logs\Backup\backup.log schreibt, was sie getan hat.

    Und wenn du schon dabei bist, könntest du prüfen, ob das Backup
    wirklich funktioniert? Ich würde besser schlafen.

    Der Eintrag des Backup-Kontos aus dem Passwortmanager ist in
    Documents\tresor-svc_backup.txt exportiert (lösch ihn, wenn du fertig
    bist).

    Mariam

# { $password }: the account's password (not translated).
silent-backup-vault =
    Passwortmanager - ein Eintrag, exportiert von Mariam (14. Januar 2030)

    Titel:         notenlinien - svc_backup
    Benutzername:  svc_backup
    Passwort:      { $password }
    Geändert:      8. November 2029, 15:00 (Gabriel)
    Notizen:       Lokales Konto der Aufgabe Nightly Backup auf notenlinien.
                   Regel der Schule für Dienstkonten: Das Passwort läuft
                   nie ab; es wird einmal im Jahr von Hand geändert (Audit
                   der Versicherung, Punkt 4.2), und die Aufgabe bekommt es
                   am selben Tag.

## Ereignisse

silent-backup-event-ready =
    State: Ready. Das heißt nur, dass die Aufgabe aktiviert ist und auf
    ihren nächsten Auslöser wartet; es sagt nichts darüber, wie ihr letzter
    Lauf war. Frag dafür die Aufgabenplanung (Get-ScheduledTaskInfo).
silent-backup-event-result =
    LastTaskResult: 2147943730, also 0x80070532 hexadezimal
    ('{"{"}0:X{"}"}' -f 2147943730): „The password for this account has
    expired.“ Der Lauf von letzter Nacht hat nicht einmal angefangen. Seit
    wann? Das eigene Log des Skripts, D:\Logs\Backup\backup.log, sagt,
    wann es zuletzt kopiert hat.
silent-backup-event-own-log =
    Das letzte „copy done“ stammt vom 20. Dezember. Fast vier Wochen ohne
    Backup, und niemand hat es bemerkt: Die Aufgabe scheitert lautlos.
silent-backup-event-history-off =
    Der Verlauf der Aufgabenplanung ist deaktiviert, wie standardmäßig auf
    jedem Windows Server: Nichts wurde aufgezeichnet. Schalte ihn ein
    (wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true), dann
    werden die nächsten Läufe es. Inzwischen stehen fehlgeschlagene
    Anmeldungen im Protokoll Security (4625).
silent-backup-event-history-on =
    Der Verlauf der Aufgabenplanung ist an: Ab jetzt hinterlässt jeder
    Lauf seine Ereignisse (100 gestartet, 101 Start fehlgeschlagen, 104
    Anmeldung fehlgeschlagen, 201 Aktion abgeschlossen und ihr
    Rückgabewert).
silent-backup-event-events =
    „The specified account's password has expired.“: Das Konto, unter dem
    die Aufgabe läuft, kann sich nicht anmelden. Sieh dir svc_backup selbst
    an (Get-LocalUser, oder net user).
silent-backup-event-expired =
    PasswordExpires: 20. Dezember 2029. Das Passwort wurde am 8. November
    gesetzt, und die lokale Richtlinie gibt Passwörtern 42 Tage: Am 20.
    ist es abgelaufen, und die Aufgabe scheitert seitdem jede Nacht. Dabei
    sagt der Eintrag im Passwortmanager, dass die Dienstkonten der Schule
    nicht ablaufen.
silent-backup-event-account-expires =
    /expires ist das Ablaufdatum des KONTOS, nicht seines Passworts: Das
    Konto svc_backup ist nie abgelaufen. Den Ablauf des Passworts setzt man
    mit Set-LocalUser -PasswordNeverExpires.
silent-backup-event-task-password =
    Das Passwort von svc_backup hat sich geändert, aber die Aufgabe
    bewahrt immer noch das alte auf: Heute Nacht würde sie mit 0x8007052E
    scheitern („The user name or password is incorrect“). Gib auch der
    Aufgabe das neue (Set-ScheduledTask -User -Password, oder schtasks
    /change /ru /rp).
silent-backup-event-logon-fixed =
    Das Konto der Aufgabe kann sich wieder anmelden, und sein Passwort
    läuft nicht mehr ab, wie es die Regel der Schule sagt. Führe die
    Aufgabe jetzt aus, statt bis 1:30 zu warten (Start-ScheduledTask), und
    prüfe, was sie getan hat.
silent-backup-event-will-expire =
    Das Konto der Aufgabe kann sich wieder anmelden, aber sein Passwort
    läuft immer noch nach 42 Tagen ab: dasselbe stille Scheitern, in sechs
    Wochen. Die Regel der Schule sagt, dass die Passwörter ihrer
    Dienstkonten nicht ablaufen.
silent-backup-event-system =
    Die Aufgabe läuft jetzt als SYSTEM: Sie kann alles lesen, also
    „funktioniert“ sie. Aber ein Skript, das alle mit Schreibzugriff auf
    C:\Scripts ändern können, würde mit allen Rechten auf dem Server
    laufen. Gib sie svc_backup zurück.
silent-backup-event-admin-task =
    Die Aufgabe läuft jetzt als Admin: alle Rechte auf dem Server für ein
    Kopierskript, und dein eigenes Passwort, das aktuell gehalten werden
    muss. Gib sie svc_backup zurück.
silent-backup-event-admin =
    svc_backup ist jetzt in Administrators: Ein Backup-Konto muss die
    Freigaben lesen und das Backup schreiben, mehr nicht. Nimm es aus der
    Gruppe heraus.
silent-backup-event-disabled =
    Die Aufgabe läuft nicht mehr von selbst: kein Scheitern mehr, aber
    auch kein Backup. Sie muss jede Nacht laufen (Enable-ScheduledTask,
    und ihr täglicher Auslöser).
silent-backup-event-ran =
    LastTaskResult: 0, und backup.log sagt „copy done“. Jetzt der
    Kontoauszug von Beatriz: Such ihn in D:\Backup\Shares\Office.
silent-backup-event-missing =
    Kein Verzeichnis Bank im Backup, nicht einmal ein altes. Dabei hat die
    Aufgabe jede Nacht bis zum 20. Dezember 0 und „copy done“ gesagt. Beim
    Kopieren ist etwas gescheitert, und das Skript hat nichts gesagt. Lies
    es: C:\Scripts\backup.ps1.
silent-backup-event-by-hand =
    Du hast das Skript selbst ausgeführt: Als Admin kannst du alles lesen,
    also kann es dort gelingen, wo die Aufgabe scheitert. Die Aufgabe
    läuft als svc_backup: Was zählt, ist, was svc_backup kann
    (Start-ScheduledTask führt sie unter ihrem Konto aus).
silent-backup-event-loud =
    Diesmal ist das Ergebnis der Aufgabe nicht 0: Das Skript ist auf einen
    Fehler gestoßen und hat es gesagt. Das kann eine Überwachung, oder du,
    sehen. Was ist also gescheitert?
silent-backup-event-bank-acl =
    Bank erbt die Berechtigungen seines Elternverzeichnisses nicht: Beatriz
    hat sie nur der Gruppe Office und den Admins gegeben. svc_backup kann
    es nicht lesen, also hat Copy-Item es übersprungen, mit einem Fehler,
    den niemand gesehen hat.
silent-backup-event-readable =
    svc_backup kann Bank jetzt lesen. Führe die Aufgabe noch einmal aus
    und prüfe ihr Ergebnis.
silent-backup-event-too-open =
    Jetzt können die Lehrkräfte die Kontoauszüge der Schule lesen. Bank
    muss für das Sekretariat und das Backup-Konto lesbar sein, nicht für
    alle.
silent-backup-event-quiet-script =
    Das Backup hat diesmal alles kopiert. Aber wenn morgen ein Verzeichnis
    scheitert, antwortet das Skript immer noch 0. Lass es Fehler melden
    ($ErrorActionPreference = 'Stop', oder try/catch mit exit 1), damit
    LastTaskResult die Wahrheit sagt.
silent-backup-event-end =
    Mariam: „Der Auszug vom November war also nie im Backup... Die Bank
    schickt uns eine Kopie. Aber jetzt weiß ich: Wenn das Backup scheitert,
    sehen wir es. Danke!“

    Gut gemacht! Du hast das Kapitel „Das stille Backup“ abgeschlossen.
    Und die Geschichte „Die Musikschule“ ist vollständig.

    WAS PASSIERT IST
    Zwei Fehler haben sich hintereinander versteckt. Seit dem 20. Dezember
    war das Passwort von svc_backup abgelaufen („Passwort läuft nie ab“
    war aus, entgegen der Regel der Schule): Die Aufgabenplanung konnte
    sich jede Nacht nicht anmelden, LastTaskResult 0x80070532, während
    Get-ScheduledTask weiter Ready sagte. Und davor, seit dem 12. Dezember,
    hat das Skript alles kopiert außer Beatriz' Verzeichnis Bank, das
    svc_backup nicht lesen konnte: Copy-Item schrieb einen nicht
    abbrechenden Fehler, das Skript lief weiter, und powershell.exe -File
    gab 0 zurück. „copy done“, jede Nacht.

    GUTE PRAXIS
    - Ready ist kein Ergebnis: Lies LastRunTime und LastTaskResult
      (Get-ScheduledTaskInfo) und schalte den Verlauf der Aufgabenplanung
      ein.
    - Das Passwort eines Dienstkontos: Entweder es läuft nie ab und wird
      von Hand geändert, nach Plan, überall, wo es gespeichert ist; oder es
      läuft ab, und etwas erinnert dich vorher daran. Ein Ablauf, von dem
      niemand weiß, ist ein stiller Ausfall.
    - Ein Skript, das von einer Aufgabe ausgeführt wird, muss laut
      scheitern: $ErrorActionPreference = 'Stop' oder -ErrorAction Stop,
      try/catch und exit 1 bei einem Fehler; sonst sind Fehler nur Zeilen,
      die niemand liest.
    - Als das Konto testen, unter dem die Aufgabe läuft
      (Start-ScheduledTask), nicht als Admin; diesem Konto geben, was es
      lesen muss, mehr nicht: nicht SYSTEM, nicht Administrators.
    - Ein Backup ist erst geprüft, wenn eine Wiederherstellung es ist: Such
      ab und zu nach einer aktuellen Datei darin.

    EIN ANDERER WEG
    In einer Domäne ändert ein gruppenverwaltetes Dienstkonto (gMSA) sein
    Passwort selbst, und die Aufgabe folgt. robocopy /B, ausgeführt von
    einem Mitglied von Backup Operators, liest Dateien unabhängig von
    ihren Berechtigungen, mit dem Sicherungsprivileg; Windows Server Backup
    (wbadmin) sichert ganze Volumes.

    DOKUMENTATION
    - Get-ScheduledTaskInfo: https://learn.microsoft.com/powershell/module/scheduledtasks/get-scheduledtaskinfo
    - Fehler- und Erfolgskonstanten der Aufgabenplanung: https://learn.microsoft.com/windows/win32/taskschd/task-scheduler-error-and-success-constants
    - about_Try_Catch_Finally: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_try_catch_finally?view=powershell-5.1
    - about_Preference_Variables ($ErrorActionPreference): https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_preference_variables?view=powershell-5.1
    - Set-LocalUser: https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/set-localuser?view=powershell-5.1
    - Gruppenverwaltete Dienstkonten: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
