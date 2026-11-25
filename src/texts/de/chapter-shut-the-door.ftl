### Geschichte „Die Nachbarschaftsbriefe“, Kapitel „Tür zu“: SSH auf einem
### neuen Server unter Brute-Force-Angriff härten. Schlüsselwörter von
### sshd_config (PermitRootLogin…), Befehle, Pfade und die Meldungen von
### OpenSSH (auf Englisch) werden nicht übersetzt.

chapter-shut-the-door = Tür zu
    .summary = SSH härten: sshd_config, sshd -t, reload, und sich nicht aussperren.

## Dateien

door-email-kofi =
    Von:     Kofi (Der Ameisenhaufen)
    An:      dich
    Betreff: Der neue Server der Briefe

    Dank dir funktioniert die Website der Nachbarschaftsbriefe wieder! Der
    Verein hat deshalb einen kleinen Server nur für sie gemietet. Der
    Hoster hat ihn letzte Nacht installiert und dir ein Konto angelegt
    (Benutzername: du), mit deinem SSH-Schlüssel: So bist du gerade
    hereingekommen.

    Aber ein Freund hat mir gesagt, ein neuer Server werde innerhalb einer
    Stunde angegriffen. Könntest du nachsehen, wer an die Tür klopft (das
    Log des Dienstes ssh), und sie richtig zumachen?

    1. Niemand soll sich mehr direkt als root anmelden können.
    2. Für SSH überhaupt keine Passwörter mehr: nur Schlüssel.
    3. Und vor allem: Prüfe, ob DU noch hereinkommst!

    Die Konfiguration des SSH-Servers steht in /etc/ssh/sshd_config
    (man sshd_config). Für sudo ist dein Passwort: ameisen-2026
    (ja, für sudo brauchst du noch eins, auch ohne Passwörter für SSH).

## Ereignisse

# { $config }: der Pfad der Konfigurationsdatei
door-event-error =
    In der SSH-Konfiguration ist ein Fehler! Vor dem Neuladen immer mit
    sudo sshd -t prüfen: Es nennt die schuldige Datei und Zeile.

    (Gute Nachricht: Solange die Konfiguration falsch ist, weigert sich
    systemctl reload ssh, sie anzuwenden, und sshd behält die alte. Wegen
    eines Tippfehlers sperrst du dich nicht aus.)
door-event-locked-out =
    ACHTUNG: Mit der Konfiguration, die sshd gerade geladen hat, würde eine
    neue Verbindung deines Kontos abgewiesen. Deine aktuelle Sitzung
    bleibt aber offen: sshd kappt nie laufende Sitzungen.

    Jetzt ist der Moment, es zu reparieren, BEVOR du dich abmeldest. Darum
    hält man immer eine Sitzung offen, wenn man die SSH-Konfiguration ändert.
door-event-without-effect =
    Seltsam: Du hast PasswordAuthentication no geschrieben und ssh neu
    geladen… aber Passwörter werden immer noch akzeptiert. Frag sshd, was
    es wirklich anwendet:

      sudo sshd -T | grep -i password

    Lies dann noch einmal den Anfang von /etc/ssh/sshd_config, und
    man sshd_config: Welcher Wert gewinnt bei einem Schlüsselwort, das
    zweimal vorkommt?
door-event-closed =
    sshd wendet deine neue Konfiguration an: kein root mehr, keine
    Passwörter mehr. Im Log (journalctl -u ssh) werden die Bots jetzt
    abgewiesen, bevor sie überhaupt ein Passwort versuchen („[preauth]“).

    Das Wichtigste bleibt: prüfen, ob DU noch hereinkommst. Auf einem
    echten Server hält man diese Sitzung offen und öffnet eine zweite zum
    Testen. Hier: exit, dann ssh briefe.
door-event-end =
    Du bist mit deinem Schlüssel hereingekommen: Die Tür ist für die Bots
    zu, aber nicht für dich. Kofi: „Danke! Ich werde besser schlafen.“

    Gut gemacht! Du hast das Kapitel „Tür zu“ abgeschlossen.

    WAS PASSIERT IST
    Ein Server, der im Internet hängt, bekommt innerhalb von Minuten
    Anmeldeversuche: Bots probieren root und gängige Namen (admin, test,
    ubuntu) mit schwachen Passwörtern. Wer nur Schlüssel akzeptiert, und
    nie direkt root, macht ihnen die Tür zu: Einen Schlüssel kann man
    nicht erraten.

    GUTE PRAXIS
    - PermitRootLogin no und PasswordAuthentication no; root wird man mit
      sudo, vom eigenen Konto aus.
    - Immer sudo sshd -t vor dem Neuladen, und sudo sshd -T, um zu sehen,
      was wirklich angewendet wird.
    - Vorsicht bei eingebundenen Dateien (Include): Bei jedem
      Schlüsselwort gewinnt der ERSTE gelesene Wert.
    - Während der Änderungen eine Sitzung offen halten und mit einer neuen
      Verbindung testen, bevor man sie schließt.
    - Um weiter zu gehen: hartnäckige Bots sperren (fail2ban) und Ports
      filtern (Firewall), in den nächsten Kapiteln.

    DOKUMENTATION
    - sshd_config: https://man.openbsd.org/sshd_config
    - sshd: https://man.openbsd.org/sshd
