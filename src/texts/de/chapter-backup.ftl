### Geschichte „Der Radierer“, Kapitel 4 „Die Sicherung“: rsync und cron.
### Befehle, Systempfade und die Ausgaben von rsync und cron werden nicht
### übersetzt; die Namen der Orte und Dateien (erinnerungen, /mnt/sicherung,
### notiz_von_maelle.txt…) stammen aus names.ftl.

chapter-backup = Die Sicherung
    .summary = Nie wieder: mit rsync sichern, jede Nacht mit cron, und wissen, wie man wiederherstellt.

## Dateien

backup-word-maelle =
    Eine Notiz von Maëlle, der Wärterin des Leuchtturms:

    „Seit der Radierer gestoppt ist, hat das Königreich seine Erinnerungen
    zurück (sie liegen in ~/erinnerungen). Aber ich habe immer noch Angst:
    Was, wenn etwas sie wieder ausradiert?

    Jemand hat mir eine Backup-Platte angeschlossen, eingehängt unter
    /mnt/sicherung. Könntest du:

    1. die Erinnerungen nach /mnt/sicherung/erinnerungen kopieren;
    2. dafür sorgen, dass diese Kopie GANZ VON SELBST wiederholt wird, jede Nacht;
    3. und mir zeigen, dass wir sie zurückholen können, an dem Tag, an dem
       wir sie brauchen?

    Man hat mir von rsync und cron erzählt. Du findest alles in man rsync
    und man crontab.“
backup-memory-first-letter =
    Der erste Brief, der den Hafen erreichte, nachdem das Licht zurück war.
    Er beginnt so: „Liebe Maëlle, wir haben den Leuchtturm vom offenen Meer
    aus gesehen…“
backup-memory-lighthouse =
    Der Abend, an dem der Leuchtturm wieder leuchtete: ein Lichtstrahl über
    dem Meer, und Kapitänin Ana, die das Segel hisst.
backup-memory-village =
    Das Dorf feiert: der Sauerteig gerettet, die Uhr läuft wieder, die
    Schule wiedergefunden.
backup-memory-nour =
    Nour, im Tunnel gefunden, lacht und isst dabei Käse.
backup-memory-eraser =
    Der Radierer leert endlich den Mülleimer, wie am ersten Tag, und nichts
    anderes.
backup-memory-lighthouse-festival =
    Das Leuchtturmfest, heute: das ganze Königreich auf dem Steg, und
    Papierlaternen bis hinauf zur Laterne.

## Die Nacht (cron)

# { $file }: die Erinnerung, die tagsüber angekommen ist
backup-night-start =
    Der Abend senkt sich über das Königreich. Tagsüber ist eine neue
    Erinnerung angekommen: ~/erinnerungen/{ $file }.

    Die Nacht vergeht. Zwischen Mitternacht und 6 Uhr wacht cron auf und
    führt aus, was deine crontab von ihm verlangt…
backup-night-still =
    Wieder vergeht eine Nacht. Zwischen Mitternacht und 6 Uhr führt cron
    aus, was deine crontab von ihm verlangt…
backup-night-ok =
    Am Morgen ist das Backup aktuell: { $file } ist da, ohne dass du etwas
    getippt hast. Das ist ein automatisches Backup.
backup-morning =
    Aber Maëlle kommt ganz aufgelöst: „Ich wollte aufräumen… und ich habe
    ~/erinnerungen/{ $file } gelöscht!“ Unter Linux geht rm über keinen
    Papierkorb. Zum Glück hast du ein Backup. Stell diese Erinnerung wieder her.
backup-night-nothing =
    Am Morgen hat sich nichts geändert: Keine Aufgabe deiner crontab fiel in
    die Nacht, zwischen Mitternacht und 6 Uhr. Lies die fünf Zeitfelder noch
    einmal (man crontab): Minute, Stunde, Tag des Monats, Monat, Wochentag.
# { $mail }: was die Aufgaben geschrieben haben
backup-night-mail =
    Am Morgen ist das Backup nicht aktuell. cron hat dir diese Mail
    hinterlassen, mit dem, was deine Aufgabe geschrieben hat:

    { $mail }
backup-night-failure =
    Am Morgen ist das Backup nicht aktuell: Deine Aufgabe ist gelaufen, hat
    die Erinnerungen aber nicht an die richtige Stelle kopiert. Prüf den
    Befehl von Hand, mit rsync -n, um es auszuprobieren, ohne etwas anzufassen.

## Ereignisse

# { $backup }: das Verzeichnis des Backups
backup-event-nested =
    Schau genau hin: Du hast jetzt { $backup }/erinnerungen, ein Verzeichnis
    erinnerungen IM Verzeichnis erinnerungen. Für rsync zählt der Schrägstrich
    am Ende der Quelle: „erinnerungen/“ heißt „der Inhalt von erinnerungen“,
    „erinnerungen“ heißt „das Verzeichnis selbst“. Dieses zusätzliche
    Verzeichnis stört nicht, aber ziel von jetzt an genau: rsync -a
    ~/erinnerungen/ gefolgt vom Ziel.
backup-event-copy =
    Die Erinnerungen sind auf die Backup-Platte kopiert. Aber ein Backup, an
    das man von Hand denken muss, wird am Ende immer vergessen. Bitte cron,
    es jede Nacht zu wiederholen: crontab -e.
# { $file }: die gelöschte Erinnerung
backup-event-lost =
    { $file } ist verschwunden… auch aus dem Backup! Mit --delete hat rsync
    die Löschung mitkopiert: Ein Spiegel gibt Fehler genauso wieder wie alles
    andere. Deshalb behält man mehrere Versionen (rsnapshot, restic: das
    kommt später). Starte hier das Kapitel neu, um es noch einmal zu versuchen.
backup-event-end =
    Die Erinnerung ist zurück. Maëlle: „Das ist also ein echtes Backup: eine
    Kopie woanders, die sich von selbst erneuert und die wir schon einmal
    wiederherstellen konnten.“

    Gut gemacht! Du hast Kapitel 4 von „Der Radierer“ abgeschlossen.

    WAS PASSIERT IST
    rsync hat die Erinnerungen auf eine andere Platte kopiert; cron
    wiederholt die Kopie jede Nacht; und am Morgen wurde das Backup
    benutzt, wirklich.

    GUTE PRAXIS
    - Der Schrägstrich am Ende zählt: rsync -a quelle/ ziel/.
    - Erst mit -n (--dry-run) ausprobieren, besonders mit --delete.
    - Ein manuelles Backup wird vergessen: Plane es ein (cron).
    - Ein Backup, das nie wiederhergestellt wurde, ist kein Backup: Teste
      die Wiederherstellung.
    - Die 3-2-1-Regel: drei Kopien, auf zwei Medien, eine davon woanders;
      und mehrere Versionen, denn ein Spiegel (--delete) kopiert auch Fehler.

    EIN ANDERER WEG
    Ein systemd-Timer statt cron: das Ergebnis in journalctl, ein verpasster
    Lauf wird beim Booten nachgeholt (Persistent=true). Und rsync hält einen
    Spiegel: Eine gelöschte oder beschädigte Datei wird beim nächsten Lauf
    auch in der Kopie gelöscht oder beschädigt. Um mehrere Tage zu behalten,
    rsnapshot oder restic (Das Archiv, Die Ludothek).

    DOKUMENTATION
    - rsync: https://download.samba.org/pub/rsync/rsync.1
    - crontab: https://manpages.debian.org/bookworm/cron/crontab.5.en.html
