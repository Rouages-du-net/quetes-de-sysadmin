### Geschichte „Die Nachbarschaftsbriefe“, Kapitel „Der Wächter“:
### fail2ban. Befehle, Pfade, Adressen, Schlüsselwörter der Konfiguration
### (bantime, ignoreip…) und die Ausgabe von fail2ban (auf Englisch) werden
### nicht übersetzt.

chapter-sentinel = Der Wächter
    .summary = Die Roboter sperren, ohne die Freunde zu sperren: fail2ban, jail.local, ignoreip.

## Dateien

sentinel-email-kofi =
    Von:     Kofi (Der Ameisenhaufen)
    An:      dich
    Betreff: Rania kommt nicht mehr rein

    Rania, unsere Webmasterin, kann sich seit heute Morgen nicht mehr am
    Server anmelden: „Connection refused“. Sie sagt, sie habe sich
    mehrmals beim Benutzernamen vertippt. Yasmine meint, es sei fail2ban,
    der mit dem Server installierte Wächter, der sie für einen Roboter
    gehalten hat. Ihre Adresse: 198.51.100.40.

    Yasmine hat auch bemerkt, dass die Roboter alle zehn Minuten
    wiederkommen: Schau in /var/log/fail2ban.log. Sie klopfen gerade jetzt
    an die Tür; um ihnen live zuzusehen (Strg-C zum Stoppen):

      journalctl -fu ssh
      tail -f /var/log/fail2ban.log

    Könntest du:

    1. Rania ihren Zugang zurückgeben;
    2. dafür sorgen, dass weder Rania noch du je wieder gesperrt werdet;
    3. die Roboter länger sperren, mindestens eine Stunde?

    Laut Yasmine steht alles in man fail2ban-client und man jail.conf, und
    „was auch immer du tust, rühr jail.conf nicht an“. Das sudo-Passwort
    hat sich nicht geändert.

## Ereignisse

sentinel-event-jail-conf =
    Du hast /etc/fail2ban/jail.conf geändert. Es funktioniert… bis zum
    nächsten Update von fail2ban, das diese Datei ersetzt, und deine
    Einstellungen gleich mit. Die Datei sagt es selbst ganz oben: „YOU
    SHOULD NOT MODIFY THIS FILE“. Pack deine Einstellungen lieber in
    /etc/fail2ban/jail.local.
sentinel-event-error =
    Die Konfiguration von fail2ban hat einen Fehler. Prüfe sie vor dem
    Neuladen mit  sudo fail2ban-client -t: Es nennt die schuldige Datei
    und Zeile.
sentinel-event-rania =
    Rania ist nicht mehr gesperrt: Sie kann sich wieder anmelden. Aber
    wenn sie sich noch fünfmal vertippt, sperrt fail2ban sie wieder…
# { $address }: die Adresse des Rechners
sentinel-event-banned-self =
    ACHTUNG: fail2ban hat gerade { $address } gesperrt… die Adresse deines
    eigenen Rechners! Gestern hattest du drei fehlgeschlagene Anmeldungen
    (such nach „Failed publickey“ in journalctl -u ssh), und mit diesen
    Einstellungen reicht das. Entsperr dich und trag deine Adresse in
    ignoreip ein, bevor du dich trennst.
sentinel-event-set =
    fail2ban wendet deine Einstellungen an: Die Roboter bleiben länger
    gesperrt, und weder Rania noch du werdet wieder gesperrt. Prüfe den
    Zustand des Jails: sudo fail2ban-client status sshd.
sentinel-event-end =
    Die Roboter sind dauerhaft gesperrt, Rania kommt wieder rein, und dein
    Rechner ist nicht mehr in Gefahr. Kofi: „Rania sagt danke, sie konnte
    das Programm veröffentlichen!“

    Gut gemacht! Du hast das Kapitel „Der Wächter“ abgeschlossen.

    WAS PASSIERT IST
    fail2ban liest das SSH-Log und sperrt eine Adresse nach einer gewissen
    Zahl von Fehlschlägen. Mit den Standardeinstellungen dauerte die
    Sperre nur zehn Minuten: Die Roboter kamen sofort zurück. Und ein
    Mensch, der sich fünfmal vertippt, sieht aus wie ein Roboter.

    GUTE PRAXIS
    - Nie jail.conf ändern: Die Einstellungen gehören in jail.local.
    - ignoreip für die eigenen Adressen und die des Teams, BEVOR man
      maxretry verschärft.
    - Eine längere bantime für Wiederholungstäter (1h, 1d); um weiter zu
      gehen, sperrt das Jail „recidive“ diejenigen eine Woche lang, die
      wiederkommen.
    - fail2ban-client -t vor dem Neuladen, status sshd zum Prüfen, und
      set sshd unbanip, um einen Fehler rückgängig zu machen.
    - fail2ban ersetzt keine SSH-Schlüssel: Es verringert Lärm und Last;
      der echte Schutz bleibt PasswordAuthentication no.

    EIN ANDERER WEG
    ufw limit 22/tcp weist eine Adresse ab, die 6 oder mehr Verbindungen
    in 30 Sekunden öffnet, ohne ein Log zu lesen: einfach, aber blind (es
    sieht die fehlgeschlagenen Anmeldungen nicht, und es bremst auch eine
    Kollegin, die es eilig hat). fail2ban liest die Fehlschläge selbst.
    Noch besser: nur Schlüssel (PasswordAuthentication no), die Brute
    Force sinnlos machen.

    DOKUMENTATION
    - jail.conf: https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - fail2ban-client: https://manpages.debian.org/bookworm/fail2ban/fail2ban-client.1.en.html
