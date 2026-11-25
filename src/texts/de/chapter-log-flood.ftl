### Geschichte „Die Musikschule“, Kapitel „Die Logflut“: Das Datenvolume
### ist voll mit den Logs der Buchungs-App, seit Juni auf der Stufe debug.
### Befehle, Cmdlets, Pfade und Ausgaben werden nicht übersetzt.

chapter-log-flood = Die Logflut
    .summary = Die Buchungs-App kann nichts speichern, und die Lehrkräfte können nicht in ihrer Freigabe speichern: Das Datenvolume ist voll. Finden, was es füllt, Platz schaffen, ohne die Logs zu verlieren, die das Sekretariat braucht, und verhindern, dass es wieder vollläuft.

## Dateien

log-flood-email-beatriz =
    Von:  Beatriz (Sekretariat)
    An:   dich

    Hallo,

    Seit gestern Abend antwortet die Agenda auf jede neue Buchung „Could
    not save the booking“, und heute Morgen konnte Samir seinen
    Orchesterplan nicht in der Freigabe Teachers speichern: „There is not
    enough space on the disk“.

    Gabriel hat uns im Juni gesagt, er habe „die Logs der Agenda
    hochgedreht“, um den Doppelbuchungen nachzugehen. Hat er sie je
    wieder heruntergedreht?

    Vorsicht: Ich kläre gerade noch die Familie, die am 4. Dezember
    doppelt belastet wurde, und brauche dafür die Logs der Agenda aus
    diesen Wochen. Mariams Regel ist, dass wir immer die letzten 30 Tage
    Logs behalten.

    Danke!
    Beatriz

## Ereignisse

log-flood-event-full =
    D: (Data) hat von 500 GB noch ein paar hundert Megabyte frei: Kein
    Wunder, dass nichts gespeichert werden kann. Was belegt den ganzen
    Platz? Durchsuch D:\ nach den größten Dateien (Get-ChildItem -Recurse
    -File, Sort-Object Length).
log-flood-event-culprit =
    D:\Logs\Agenda: eine Datei pro Tag seit dem 12. Juni,
    agenda-2029-06-12.log und so weiter, jede mehrere GB groß. Die Agenda
    beginnt um Mitternacht ein neues Log, und nichts löscht je die alten.
    Aber warum so groß? Ihre Konfiguration steht in
    C:\ProgramData\Agenda\agenda.ini.
log-flood-event-level =
    level=debug: Die Agenda schreibt jede Anfrage, jede SQL-Abfrage, jeden
    Cache-Zugriff. Die Datei wurde zuletzt am 12. Juni geändert: Gabriels
    Fehlersuche, nie rückgängig gemacht. Schaff zuerst etwas Platz, dann
    dreh die Stufe wieder herunter.
log-flood-event-whatif =
    -WhatIf listet auf, was gehen würde, ohne etwas zu löschen. Prüfe die
    Liste: nur Logs, die älter als 30 Tage sind, nichts aus den Wochen,
    die Beatriz braucht, nicht das aktuelle agenda.log.
log-flood-event-in-use =
    agenda.log ist das aktuelle Log der Agenda: Der Dienst hält es offen,
    und Windows weigert sich, eine Datei zu löschen, die ein anderer
    Prozess benutzt. Das ist eine Schutzmaßnahme: Das aktuelle Log ist das
    von heute, und der Platz steckt in den alten.
log-flood-event-recent-deleted =
    Logs der letzten 30 Tage sind weg, und Beatriz brauchte sie für die
    doppelte Belastung vom 4. Dezember. Ohne Kopie kommen sie nicht
    zurück: Starte das Kapitel neu (oder nimm den Rettungs-Snapshot) und
    lösch nur die älteren (Where-Object LastWriteTime -lt
    (Get-Date).AddDays(-30)).
log-flood-event-current-deleted =
    Das aktuelle agenda.log ist weg, mit den Fehlern von heute Morgen
    darin: die Beweise des Vorfalls. Hör nächstes Mal bei den alten Logs
    auf.
log-flood-event-backup-deleted =
    Das Backup in D:\Backup ist nicht das, was die Platte füllt, und es zu
    löschen lässt die Schule ohne Kopie ihrer Freigaben. Starte das Kapitel
    neu (oder nimm den Rettungs-Snapshot): Der Platz steckt in den alten
    Logs.
log-flood-event-compressed =
    NTFS-Komprimierung schrumpft Text-Logs stark und schafft tatsächlich
    Platz. Aber auf der Stufe debug schreibt die Agenda weiter mehrere GB
    am Tag: Die Platte läuft wieder voll, etwas später. Alte Logs jenseits
    der Aufbewahrungsfrist muss man nicht behalten; und die Stufe ist die
    eigentliche Ursache.
log-flood-event-freed =
    D: hat wieder Platz, und die Logs der letzten 30 Tage sind noch da.
    Jetzt die Ursache: Auf der Stufe debug ist es in ein paar Monaten
    wieder voll. Senk die Stufe in agenda.ini.
log-flood-event-freed-quiet =
    D: hat wieder Platz, und die Logs der letzten 30 Tage sind noch da.
log-flood-event-not-applied =
    agenda.ini sagt jetzt eine niedrigere Stufe, aber die Agenda hat ihre
    Konfiguration beim Start gelesen, in debug: Sie schreibt weiter jede
    Anfrage, bis sie neu startet (Restart-Service).
log-flood-event-stopped =
    Die Agenda ist gestoppt: Niemand kann eine Stunde buchen. Starte sie
    wieder (Start-Service Agenda).
log-flood-event-quieter =
    Die Agenda läuft mit einer ruhigeren Log-Stufe: ein paar MB am Tag
    statt mehrerer GB. Bleibt noch der Platz, der auf D: freizumachen ist.
log-flood-event-quieter-freed =
    Die Agenda läuft mit einer ruhigeren Log-Stufe: ein paar MB am Tag
    statt mehrerer GB.
log-flood-event-cleanup-task =
    Eine geplante Aufräumaufgabe: eine gute zweite Schicht, damit sich
    alte Logs nie wieder anhäufen, egal auf welcher Stufe. Stell sicher,
    dass sie 30 Tage behält, und teste sie einmal (Start-ScheduledTask),
    bevor du ihr vertraust.
log-flood-event-end =
    Beatriz: „Die Agenda speichert wieder Buchungen, und Samir hat seinen
    Plan gespeichert. Und ich habe noch meine Logs von Anfang Dezember,
    danke!“

    Gut gemacht! Du hast das Kapitel „Die Logflut“ abgeschlossen.

    WAS PASSIERT IST
    Im Juni hat Gabriel die Log-Stufe der Agenda auf debug gesetzt, um
    einem Fehler nachzugehen, und sie nie zurückgesetzt. Die Agenda
    beginnt jede Mitternacht eine neue Log-Datei, und nichts löscht die
    alten: Sechs Monate Debug-Logs, ein paar GB am Tag, haben die 500 GB
    von D: gefüllt. Du hast den Schuldigen nach Größe gefunden, nur die
    Logs gelöscht, die älter als die 30 Tage sind, die die Schule
    aufbewahrt (nach einem -WhatIf), und die Stufe auf eine normale
    zurückgesetzt, mit einem Neustart des Dienstes, damit er sie liest.

    GUTE PRAXIS
    - Finden, bevor man löscht: Get-Volume für das Volume,
      Get-ChildItem -Recurse -File | Sort-Object Length -Descending für die
      größten Dateien, Measure-Object -Sum für die Summe eines
      Verzeichnisses.
    - Nach einem prüfbaren Kriterium löschen (LastWriteTime älter als die
      Aufbewahrungsfrist), zuerst mit -WhatIf.
    - Eine Datei, die ein Dienst offen hält, lässt sich nicht löschen, und
      das soll sie auch nicht: Es ist das aktuelle Log.
    - Debug-Logging ist für die Dauer einer Untersuchung: Notier es und
      schalte es ab, wenn du fertig bist. Ein Dienst liest seine
      Konfiguration beim Start.
    - Jedes Log braucht eine Aufbewahrungsfrist: eine Aufräumaufgabe
      (Register-ScheduledTask) oder die eigene Einstellung der App, und
      eine Überwachung des freien Platzes, die vor 100% warnt.

    EIN ANDERER WEG
    NTFS-Komprimierung (compact /c) schrumpft alte Text-Logs, wenn man sie
    behalten muss; sie stoppt nicht, was die Platte füllt. IIS hat eigene
    Log-Einstellungen (rollover), und auch dort löscht nichts die alten
    Logs: Eine geplante Aufgabe ist der übliche Weg.

    DOKUMENTATION
    - Get-Volume: https://learn.microsoft.com/powershell/module/storage/get-volume
    - Remove-Item: https://learn.microsoft.com/powershell/module/microsoft.powershell.management/remove-item?view=powershell-5.1
    - Where-Object: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/where-object?view=powershell-5.1
    - Register-ScheduledTask: https://learn.microsoft.com/powershell/module/scheduledtasks/register-scheduledtask
    - compact: https://learn.microsoft.com/windows-server/administration/windows-commands/compact
