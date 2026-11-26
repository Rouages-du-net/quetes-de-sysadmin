### Der Radierer, Kapitel 3 — Die Wurzel. Rechte und Administration:
### ls -l, chmod, whoami, sudo. Der Baum ist der eines echten Linux
### (/home, /etc, /var/log, /root): Diese Systempfade werden nicht
### übersetzt. Die anderen Namen von Orten und Dateien (erinnerungen,
### radierer.conf, /Koenigreich/Muelleimer…) und die Kontonamen (du, und der
### Benutzer des Daemons, „radierer“) stammen aus names.ftl.

chapter-root = Die Wurzel
    .summary = Rechte und Administration: ls -l, chmod, whoami, sudo.
root-arrival =
    Du saust die Rutsche hinunter und landest… in einem Raum, der dir
    bekannt vorkommt. An der Tür ein Schild: /home/du.

    Dein Zuhause. Das echte. Ganz unten im Königreich, an der Wurzel („/“),
    haben die Orte endlich ihre echten Linux-Namen: /home für die Home-
    Verzeichnisse der Benutzer, /etc für Einstellungen, /var/log für Logs,
    /root für die Administratorin.

    Lies das Handbuch, das auf dem Tisch liegt:  cat admin_handbuch.txt
root-manual-admin =
    DAS HANDBUCH DER ADMINISTRATION

    Jedes Objekt und jeder Ort hat einen BESITZER und RECHTE.
    Um sie zu sehen:  ls -l

      d rwx r-x r-x   du    du    4096  erinnerungen/
      │  │   │   │     └─ Besitzer
      │  │   │   └─ die anderen: r-x
      │  │   └─ die Gruppe: r-x
      │  └─ der Besitzer: rwx
      └─ d = ein Ort (Verzeichnis), - = ein Objekt (Datei)

    (ls -l schreibt die drei Gruppen zusammen: drwxr-xr-x.)

      r  lesen
      w  schreiben          bei einem Ort: darin anlegen, löschen, umbenennen
      x  ausführen          bei einem Ort: ihn betreten, durchqueren

    chmod ändert Rechte (nur der Besitzer kann es):
      chmod o-w ort     nimmt den anderen (o) das Recht zu schreiben (w)
      chmod 755 ort     rwx für den Besitzer, r-x für alle anderen

    whoami sagt dir, wer du bist. root hat ALLE Rechte. Um als root zu
    handeln, setzt du sudo vor den Befehl. sudo fragt nach DEINEM Passwort.

    Dein Passwort? Der Radierer hat es dich vergessen lassen, wie alles andere.
    Vielleicht hast du es irgendwo zu Hause aufgeschrieben… Dein tagebuch.txt ist
    lang: Dafür ist grep gemacht. (Anführungszeichen erhalten die Leerzeichen:
    grep "mein Passwort" …)
root-journal =
    TAGEBUCH

    Jahr 98: Man vertraut mir die Administration des Königreichs an. Eine große Verantwortung.
    Jahr 99: Die Uhr im Dorf installiert. Die Zahnräder drehen sich schön.
    Jahr 100: Der Mülleimer quillt über. Er ist nur ein Verzeichnis, in das alle werfen, was sie loswerden wollen: Wir brauchen ein Programm, das ihn endgültig leert.
    Jahr 101: Ich schreibe den Radierer, einen kleinen Daemon, der den Mülleimer leeren wird.
    Jahr 102: Die Konfiguration des Radierers in /etc geschrieben. Keine Zeit, sie gegenzulesen.
    Jahr 102: mein Passwort ändert sich. Ich schreibe es hier auf (sehr schlechte Idee!): sonnenblume
    Jahr 102: Den Radierer gestartet. Er läuft als eigener Benutzer, „radierer“.
    Jahr 103: Katastrophe. Der Sauerteig der Bäckerei verschwindet. Dann die Zahnräder.
    Jahr 103: Ich habe den Fehler in der Konfiguration gefunden. Ich habe eine korrigierte Fassung vorbereitet, hier, in meinem Zuhause.
    Jahr 103: Sie muss mit sudo installiert werden, bevor der Radierer mich erreicht.
# Konfigurationsdatei: die Zeile „ziel = /Koenigreich/Muelleimer“ so lassen
# (das Spiel prüft sie: name-target = /name-Kingdom/name-Bin in names.ftl).
root-eraser-conf-fixed =
    # Die Konfiguration des Radierers — korrigierte Fassung (Jahr 103)
    # Bei jedem Durchgang löscht der Daemon alles, was er im Ziel findet.
    ziel = /Koenigreich/Muelleimer
root-memory-school = Ein Klassenzimmer. Jemand bringt dir bei, an den Fingern binär zu zählen: bis 31 mit nur einer Hand.
root-memory-first-program = Dein allererstes Programm. Es gab „Hallo“ aus, und du hast vor Freude geschrien.
root-memory-garden = Ein Garten voller Sonnenblumen. Du hast ihre Farbe geliebt.
root-memory-song = Ein Lied, das du gesummt hast, während du Server repariert hast.
root-memory-journey = Eine Zugfahrt, die Nase an die Scheibe gedrückt.
root-memory-friend = Eine Freundin, die dir immer sagte: „Lies es noch einmal, bevor du die Eingabetaste drückst.“
root-memory-library = Eine riesige Bibliothek, in der du das Wort „Unix“ gelernt hast.
root-memory-first-server = Der erste Server, für den du verantwortlich warst. Er schnurrte wie eine Katze.
root-journal-private-root =
    Du könntest es lesen: root hat alle Rechte. Aber es ist das private Tagebuch von Nour. Du klappst es zu, ohne es zu lesen.
    (#1: die Privatsphäre anderer respektieren.)
# Fehlerhafte Konfiguration: die Zeile „ziel = /Koenigreich /Muelleimer“ (mit dem Leerzeichen) so lassen.
root-eraser-conf =
    # Die Konfiguration des Radierers — geschrieben von: du (Jahr 102)
    # Bei jedem Durchgang löscht der Daemon alles, was er im Ziel findet.
    ziel = /Koenigreich /Muelleimer
root-sudoers =
    # Wer sudo benutzen darf, und wofür.
    root    ALL=(ALL:ALL) ALL
    du      ALL=(ALL:ALL) ALL   # du: Administrator·in des Königreichs
# Log des Daemons: ein Eintrag pro Zeile (mit grep zu lesen).
root-eraser-log =
    {"["}Jahr 102] Start des Daemons radierer (Benutzer: radierer)
    {"["}Jahr 102] lese /etc/radierer.conf
    {"["}Jahr 102] ziel = /Koenigreich /Muelleimer
    {"["}Jahr 102] 2 Ziele gefunden: „/Koenigreich“ und „/Muelleimer“
    {"["}Jahr 102] lösche /Koenigreich/Muelleimer/alte_papiere
    {"["}Jahr 102] lösche /Koenigreich/Dorf/Baeckerei/sauerteig_4
    {"["}Jahr 103] lösche /Koenigreich/Dorf/Baeckerei/sauerteig_5
    {"["}Jahr 103] lösche /Koenigreich/Dorf/Werkstatt/zahnrad_12
    {"["}Jahr 104] lösche /Koenigreich/Insel/Leuchtturm/birne
    {"["}Jahr 131] neues Ziel erreichbar: /home/du/erinnerungen (Rechte: rwxrwxrwx)
root-notes-root =
    Wenn du das liest, bist du root (oder du hast sudo benutzt).

    root kann alles lesen, alles ändern, alles löschen, auch das System
    selbst. Deshalb arbeitet man im Alltag nie als root: Man benutzt sudo,
    für einen einzelnen Befehl, wenn es nötig ist.
root-event-alert =
    Plötzlich knistert es im Ort erinnerungen… Der Radierer ist da! Mit
    jedem deiner Befehle wird er eine deiner Erinnerungen löschen.

    Schau dir die Rechte an:  ls -l
    Der Ort erinnerungen ist rwxrwxrwx: Alle, auch der Benutzer
    „radierer“, dürfen darin schreiben und damit darin löschen. Nimm den
    anderen (o) dieses Recht, schnell:

      chmod o-w erinnerungen
root-event-conf-erased =
    Der Daemon sucht seine Konfiguration… und findet sie nicht mehr. Er hält an.
    Das ist besser als nichts, aber jetzt leert niemand den Mülleimer. In /etc
    fehlt eine korrekte Konfiguration: Der Daemon liest nur die Datei
    /etc/radierer.conf, unter genau diesem Namen.

# { $memory }: Name der gelöschten Datei (technischer Bezeichner)
root-memory-erases = ✗ Eine Erinnerung verblasst: { $memory }
# { $saved }: gerettete Erinnerungen; { $total }: Zahl der Erinnerungen am Anfang
root-event-protected =
    Der Radierer greift deine Erinnerungen weiter an… „Keine Berechtigung“. Er
    weicht zurück. Unter Linux bedeutet das Löschen einer Datei, den Ort zu
    ändern, der sie enthält: Ohne das Recht, an diesem Ort zu schreiben, kann
    dort nichts gelöscht werden.

    Du hast { $saved ->
        [one] { $saved } Erinnerung
       *[other] { $saved } Erinnerungen
    } von { $total } gerettet. Aber der Radierer macht anderswo weiter, im
    ganzen Königreich. Woher kommen seine Befehle? Daemons schreiben, was sie
    tun, in ein Log:

      cat /var/log/radierer.log
# { $loss }: "yes" wenn Erinnerungen gelöscht wurden, sonst "no"
root-event-fixed =
    Der Daemon liest seine Konfiguration neu: „ziel = /Koenigreich/Muelleimer“.
    Diesmal nur ein Ziel. Der Radierer bleibt wie angewurzelt stehen… und
    beginnt dann, den Mülleimer zu leeren, genau wie am ersten Tag.

    Und alles kommt zu dir zurück. Du warst die Administration des
    Königreichs. Du hast diese Konfiguration geschrieben, mit einem
    Leerzeichen zu viel: „/Koenigreich /Muelleimer“ statt
    „/Koenigreich/Muelleimer“. Für den Radierer waren das zwei Ziele, und
    eines davon das ganze Königreich. Er war nicht böse: Er hat genau das
    getan, was man ihm gesagt hatte.

    Du hast { $saved ->
        [one] { $saved } Erinnerung
       *[other] { $saved } Erinnerungen
    } von { $total } gerettet.{ $loss ->
        [yes] {" "}Die verlorenen kommen nicht zurück: rm geht über keinen Papierkorb… außer du hattest Backups gemacht. Aber das ist eine andere Geschichte.
       *[no] {""}
    }

    DAS KÖNIGREICH IST GERETTET. (Ein letztes Kapitel erwartet dich: Die
    Sicherung, damit nie wieder etwas verloren geht.)

    Du kennst jetzt die Rechte (ls -l, chmod), den Unterschied zwischen
    einem Benutzer und root, und sudo — mit seinen drei Regeln. Die zweite
    ist die wichtigste: Denk nach, bevor du tippst.
