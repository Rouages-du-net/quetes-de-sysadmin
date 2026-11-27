### Geschichte „Die Bastion“, Kapitel „Beseitigung“: die Hintertüren
### entfernen, die der Eindringling hinterlassen hat (crontab, Schlüssel,
### Dateien), ohne das Legitime mitzunehmen, finden, was verändert wurde,
### und es aus einem Release wiederherstellen, dessen Signatur geprüft ist.
### Befehle, Pfade, Schlüssel und Fingerabdrücke werden nicht übersetzt.

chapter-eradication = Beseitigung
    .summary = Die Hintertüren des Eindringlings entfernen, finden, was verändert wurde, und es aus einem signierten Release wiederherstellen, das du geprüft hast.

## Dateien

# { $fingerprint }: Selma's ssh key fingerprint
eradication-email-selma =
    Von:      Selma
    An:       dich
    Betreff:  AW: Konto deploy

    Nadia hat mich angerufen. Es tut mir leid, das Passwort sollte nur
    vorübergehend sein, nur für meine ersten Deployments im März. Mein
    Schlüssel ist der einzige, der auf deploy sein sollte; sein
    Fingerabdruck ist:

        { $fingerprint }

    In der crontab steht ein Job von mir, sync-orders, jede Viertelstunde:
    Bitte behalte ihn, die Bestellungen des Ladens laufen darüber.

    Meine Releases sind mit meinem gpg-Schlüssel signiert (schon im
    Schlüsselbund des Servers, gpg --list-keys). Das Release 2.3.1 liegt in
    /srv/releases, mit seiner Signatur. Trau nichts anderem.

    Selma

eradication-incident =
    # Incident — ofen (Lieferungen)

    ## Eingedämmt (14.04., 9:30)
    Pool und 203.0.113.66 blockiert (iptables), Miner und Wachhund gestoppt,
    deploy abgelaufen.

    ## Noch zu tun
    - Was wurde hinterlassen, um wiederzukommen? (crontab, Schlüssel, Dateien)
    - Was wurde verändert? Die App hat den Miner bei ihrem Start neu gestartet.
    - Die History von deploy (/home/deploy/.bash_history) verrät vielleicht viel.

## Ereignisse

# { $line }: Selma's job
eradication-event-cron-all =
    Selmas Job ist aus der crontab von deploy verschwunden ({ $line }): Die
    Bestellungen des Ladens werden nicht mehr synchronisiert. Stell ihn
    wieder her (crontab -u deploy -e).
# { $line }: the line removed
eradication-event-cron =
    Die Zeile @reboot ist weg ({ $line }): Beim nächsten Start startet nichts
    mehr den Wachhund. Und Selmas Job ist noch da.
eradication-event-key-all =
    Selmas Schlüssel ist auch weg: Sie kann nicht mehr deployen. Nur der
    Schlüssel des Eindringlings musste weg: Vergleiche die Fingerabdrücke
    (ssh-keygen -lf) mit dem aus ihrer E-Mail.
eradication-event-key =
    Der Schlüssel des Eindringlings ist entfernt, Selmas ist geblieben. Beide
    trugen selma@studio: Ein Kommentar ist freier Text, nur der Fingerabdruck
    hat sie unterschieden.
eradication-event-files =
    Der Miner und sein Wachhund sind aus /tmp/.cache verschwunden.
eradication-event-bad-signature =
    FALSCHE Signatur: Dieses Archiv ist nicht das, das Selma signiert hat.
    Sein Inhalt wurde nach der Signatur verändert: Es ist die Kopie, die der
    Eindringling neu gebaut hat, mit seiner Zeile darin. Stell nichts daraus
    wieder her.
eradication-event-verified =
    Gültige Signatur, von Selmas Schlüssel: Dieses Archiv ist genau das, das
    sie veröffentlicht hat. Du kannst daraus wiederherstellen.
eradication-event-restored =
    server.js ist wieder identisch mit dem Release: Die hinzugefügte Zeile
    ist weg.
eradication-event-unverified =
    server.js sieht wieder wie das Release aus, aber nichts beweist es: Der
    Eindringling kann mehr als eine Zeile geändert haben. Prüfe die
    Signatur von Selmas Release (gpg --verify), bevor du ihm vertraust.
eradication-event-relaunched =
    Die App ist wieder gestartet, und mit ihr der Wachhund und der Miner:
    server.js startet sie immer noch, und sein Skript ist noch da. Stoppe
    sie und kümmere dich dann um die Ursache.
eradication-event-end =
    Selma: „Danke. Ich ändere meine Gewohnheiten: keine Passwörter mehr,
    auch nicht ‚nur für eine Woche‘.“

    Gut gemacht! Du hast das Kapitel „Beseitigung“ abgeschlossen.

    WAS PASSIERT IST
    Der Eindringling hatte drei Wege zurück hinterlassen: eine
    crontab-Zeile bei jedem Boot, seinen eigenen Schlüssel in den
    authorized_keys von deploy und eine Zeile in der App, die den Miner bei
    jedem Start neu startete. Du hast jeden davon entfernt, ohne das
    Legitime mitzunehmen, und die App aus einem Release wiederhergestellt,
    dessen Signatur du zuerst geprüft hast, nicht aus der Kopie, die
    daneben lag.

    GUTE PRAXIS
    - Such nach Persistenz überall, wo ein Konto schreiben kann: seine
      crontab, seine Schlüssel, seine Dateien, was seine Dienste ausführen.
      Die History von deploy hat viel verraten, aber ein Eindringling kann
      sie löschen: Verlass dich nicht allein darauf.
    - Zeile für Zeile entfernen: crontab -r oder eine geleerte
      authorized_keys nehmen das Legitime mit dem Rest mit.
    - Aus einer Quelle wiederherstellen, der du vertraust und die du prüfen
      kannst (ein signiertes Release, ein Backup von vor dem Einbruch), nie
      aus einer Kopie, die der Eindringling angefasst haben könnte.

    EIN ANDERER WEG
    Im Zweifel darüber, was noch verändert wurde: neu installieren. Ein
    neuer Server, aus bekannten Quellen gebaut (Pakete, signiertes Release,
    Backup der Daten), dann die Daten geprüft, bevor sie zurückkommen. Das
    dauert länger, ist aber der einzige Weg, sicher zu sein. Hier hatte der
    Eindringling nie root, was eine gezielte Bereinigung vertretbar machte.

    DOKUMENTATION
    - crontab: https://man7.org/linux/man-pages/man5/crontab.5.html
    - ssh-keygen (-l): https://man.openbsd.org/ssh-keygen
    - gpg --verify: https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html
    - NIST SP 800-61r2, Beseitigung und Wiederherstellung: https://csrc.nist.gov/pubs/sp/800/61/r2/final
