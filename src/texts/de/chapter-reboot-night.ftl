### Geschichte „Das Rechenzentrum“, Kapitel „Die Nacht des Neustarts“:
### systemd-Dienste. Der Server hat letzte Nacht neu gestartet, und die
### Website ist ausgefallen. Befehle, Dienstnamen, Pfade und die Meldungen
### von systemd oder php-fpm (auf Englisch) werden nie übersetzt.

chapter-reboot-night = Die Nacht des Neustarts
    .summary = Dienste, die nicht zurückkommen: systemctl, journalctl, enable, und nach einem Neustart prüfen.

## Dateien

reboot-night-email-awa =
    Von:     Awa (Leiterin des Betriebs)
    An:      dich
    Betreff: Die Website ist letzte Nacht ausgefallen

    Letzte Nacht um 3:12 Uhr hat der Server von selbst neu gestartet: Die
    automatischen Updates hatten einen neuen Kernel installiert. Seitdem
    antwortet die Website der Mediathek nicht mehr.

    1. Finde heraus, welche Dienste nicht laufen, und warum. Das Journal
       von systemd weiß alles.
    2. Repariere sie.
    3. Das Wichtigste: Sorg dafür, dass beim nächsten Neustart alles VON
       SELBST zurückkommt. Der einzige Weg, sicher zu sein: neu starten
       (sudo reboot), dann prüfen. Während des Neustarts wirst du
       getrennt: Verbinde dich wieder mit ssh rechenzentrum.

    Meine Notizen stehen in ~/notes_awa.txt. Das sudo-Passwort hat sich
    nicht geändert.
reboot-night-notes-awa =
    AWAS NOTIZEN — WENN EIN DIENST NICHT STARTET

      systemctl --failed           die fehlgeschlagenen Dienste
      systemctl status name        der Zustand eines Dienstes und seine letzten Meldungen
      journalctl -u name           alle Meldungen eines Dienstes
      journalctl -xeu name         die klassische Formel: das Ende, mit Erklärungen

    Lies den ERSTEN Fehler: Die folgenden sind oft nur seine Folge.

    Vorsicht: „active“ (läuft gerade) und „enabled“ (startet mit der
    Maschine) sind zwei verschiedene Dinge. Alles steht in
    man systemctl.

## Ereignisse

# { $logs }: das Log-Verzeichnis des Katalogs
reboot-night-event-logs-open =
    Vorsicht: Jedes Konto kann jetzt in { $logs } schreiben und dort also
    die Logs löschen… oder falsche Meldungen einschleusen, um Spuren zu
    verwischen. Ein Log-Verzeichnis gehört dem Konto des Dienstes, der
    hineinschreibt, ohne Schreibrecht für die anderen.
reboot-night-event-nginx =
    nginx läuft: Die Website antwortet wieder… vorerst.

    Schau dir die Zeile Loaded von systemctl status nginx genau an:
    „disabled“. Was passiert beim nächsten Neustart?
reboot-night-event-nginx-active =
    nginx läuft, und es ist aktiviert (enabled): Es kommt beim nächsten
    Start der Maschine von selbst zurück.
reboot-night-event-catalogue =
    Der Katalog startet: php-fpm, das unter dem Konto www-data läuft, kann
    sein Log wieder schreiben. Die Suche auf der Website funktioniert wieder.
reboot-night-event-forgotten =
    Die Maschine hat neu gestartet… und nginx läuft nicht: Die Website ist
    wieder down. systemctl start hält nur bis zum nächsten Start. Damit
    ein Dienst mit der Maschine startet, lies noch einmal man systemctl.
reboot-night-event-end =
    Nach dem Neustart ist alles von selbst zurückgekommen: nginx und der
    Katalog laufen, und du hast es geprüft. Awa: „Genau das ist der Job:
    nicht nur reparieren, sondern sicherstellen, dass es hält.“

    Gut gemacht! Du hast Kapitel 3 von „Das Rechenzentrum“ abgeschlossen.
    (Als Nächstes: Der große Brand. Komm später mit ssh rechenzentrum zurück.)

    WAS PASSIERT IST
    Der Neustart letzte Nacht hat zwei Probleme ans Licht gebracht, die
    seit Freitag verborgen waren: nginx war bei einem Test deaktiviert
    worden (disable), und ein „chown -R root:“ hatte root das Verzeichnis
    gegeben, in das php-fpm, das als www-data läuft, sein Log schreibt.
    Solange die Maschine lief, fiel nichts auf.

    GUTE PRAXIS
    - Nach jedem Neustart: systemctl --failed.
    - Ein Dienst will nicht starten: journalctl -xeu name, und den ersten
      Fehler lesen.
    - start (jetzt) ist nicht enable (bei jedem Start);
      enable --now macht beides.
    - Das Verzeichnis eines Dienstes gehört dem Konto des Dienstes, nie 777.
    - Ein Server, der nie neu gestartet wurde, ist ein Server, von dem man
      nicht weiß, ob er wieder hochkommt: einen Neustart in ruhigen Zeiten
      testen.

    DOKUMENTATION
    - systemctl: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
