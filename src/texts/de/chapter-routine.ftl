### Geschichte „Die Wache“, Kapitel „Eine Routine einrichten“:
### Sicherheitsupdates automatisieren (ohne dass alles von selbst
### geschieht) und einen wöchentlichen Termin planen. Schlüsselwörter von
### apt.conf, Befehle und Pfade werden nicht übersetzt.

chapter-routine = Eine Routine einrichten
    .summary = Automatisieren, was sich automatisieren lässt (Sicherheitsupdates, ein wöchentlicher Termin), ohne das menschliche Urteil zu ersetzen.

## Dateien

routine-email-salome =
    Von:     Salomé
    An:      dich
    Betreff: Das letzte Stück: eine Gewohnheit daraus machen

    Die Woche ist geschafft, aber eine Beobachtung macht man nicht nur
    einmal. Zwei Dinge sind einzurichten, bevor ich wirklich endgültig weg
    bin:

    1. unattended-upgrades ist installiert, aber nicht eingeschaltet (schau
       dir /etc/apt/apt.conf.d/20auto-upgrades an: Beide periodischen
       Aufgaben stehen auf „0“). Schalte sie ein. Und beschränk es NUR auf
       SICHERHEITSupdates (/etc/apt/apt.conf.d/50unattended-upgrades):
       Alles automatisch zu aktualisieren, würde eines Tages ohne Vorwarnung
       etwas kaputtmachen. Gönn dir einen Bericht per Mail
       (Unattended-Upgrade::Mail).
    2. Ein wöchentlicher Termin, der dich daran erinnert, das nächste
       Bulletin zu lesen: ein systemd-Timer oder eine cron-Aufgabe, die dir
       die Liste der Pakete mailt, die auf ein Update warten (man
       systemd.timer, man crontab).

    unattended-upgrades kümmert sich von selbst um Sicherheitsupdates; der
    Rest (eine CVE ohne Korrektur, ein Paket außerhalb von security) bleibt
    deine Aufgabe, jede Woche, mit dem nächsten Bulletin.

    Salomé
    (Für sudo ist dein Passwort immer noch: sauerteig-2028)

## Ereignisse

routine-event-syntax =
    In der Konfiguration von apt ist ein Syntaxfehler! Eine Zuweisung
    schreibt man „Key "value";“, eine Liste „Key {"{"} "a"; "b"; {"}"};“
    (man apt.conf). Korrigiere ihn, bevor es weitergeht: apt weigert sich,
    den Rest zu lesen, solange er da ist.
routine-event-active =
    Beide periodischen Aufgaben sind eingeschaltet. Bleibt, zu beschränken,
    was unattended-upgrades anfasst, und dir einen Bericht zu gönnen.
routine-event-security =
    unattended-upgrades ist aktiv, beschränkt auf Sicherheitsupdates
    (Debian-Security), und ein Bericht geht per Mail raus. Bleibt der
    wöchentliche Termin.
routine-event-periodic =
    Ein Termin existiert, und zwar einer, der einen Neustart übersteht. Er
    erinnert dich jede Woche daran, das nächste Bulletin zu lesen — auch für
    das, was unattended-upgrades nicht von selbst behebt.
routine-event-end =
    Salomé: „Na bitte. unattended-upgrades für das, was sich selbst behebt,
    ein Termin für den Rest. Dafür brauchst du mich nicht mehr.“

    Gut gemacht! Du hast das Kapitel „Eine Routine einrichten“ und die
    Geschichte „Die Wache“ abgeschlossen.

    WAS PASSIERT IST
    Eine Sicherheitsbeobachtung, die ganz vom Gedächtnis einer Person
    abhängt, lässt irgendwann eine Woche aus. Zwei Sicherheitsnetze, die
    sich ergänzen: Automatisierung für das, was kein Urteil braucht (ein
    schon veröffentlichtes, von Debian schon getestetes Sicherheitsupdate),
    und ein regelmäßiger Termin für das, was eins braucht (ein Bulletin
    lesen, über eine Priorität entscheiden, aufschreiben, was man gefunden
    hat).

    GUTE PRAXIS
    - Die Automatisierung auf Sicherheitsupdates beschränken: Der Rest
      (eine neue Hauptversion, eine Abhängigkeit, die ihr Verhalten
      ändert) verdient es, gesehen zu werden, bevor er eingespielt wird.
    - Sich einen Bericht gönnen (per Mail, oder auf einem anderen Weg, den
      man wirklich ansieht): Eine stille Automatisierung, die nie jemand
      beobachtet, ist so gut wie nichts getan zu haben.
    - Geplante Aufgaben unter /etc schreiben (Systemdateien, kein Skript,
      das in einem persönlichen Verzeichnis verloren geht): Sie müssen
      einen Neustart und einen Kontowechsel überstehen.
    - Eine Routine ersetzt kein Urteil: Sie macht Zeit frei, um sie dort
      einzusetzen, wo sie wirklich gebraucht wird.

    EIN ANDERER WEG
    Statt einer E-Mail kann ein wöchentlicher Termin auch eine Aufgabe in
    einer Projektverwaltung sein, ein Alarm in einem Monitoring-Werkzeug
    (wie die Plugins aus „Die Sonde“), oder einfach eine Erinnerung in
    einem gemeinsamen Teamkalender: Worauf es ankommt, ist, dass jemand sie
    wirklich sieht, nicht die genaue Form der Erinnerung.

    DOKUMENTATION
    - unattended-upgrades: https://wiki.debian.org/UnattendedUpgrades
    - systemd.timer: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - crontab: https://manpages.debian.org/bookworm/cron/crontab.5.en.html
