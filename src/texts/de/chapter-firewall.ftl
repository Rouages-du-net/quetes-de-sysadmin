### Geschichte „Die Nachbarschaftsbriefe“, Kapitel „Die Firewall“: ufw.
### Befehle, Ports, Adressen und die Schlüsselwörter von ufw (allow, deny…)
### werden nicht übersetzt; die Ausgaben von nmap und ss bleiben Englisch.

chapter-firewall = Die Firewall
    .summary = Wer lauscht, und wer darf herein: ss, ufw, und sich nie selbst aussperren.

## Dateien

firewall-email-kofi =
    Von:     Kofi (Der Ameisenhaufen)
    An:      dich
    Betreff: Eine Tür zu viel?

    Meine Freundin Yasmine, die in der IT-Sicherheit arbeitet, hat unseren
    Server von zu Hause aus „gescannt“ (mit unserer Erlaubnis!). Ihr
    Bericht liegt in ~/scan_yasmine.txt. Sie sagt, Port 3306 ist die
    Datenbank der Website, und die hat im Internet nichts zu suchen.

    Könntest du eine Firewall einrichten? Wir brauchen:

    1. dass die Website für alle erreichbar bleibt (http und https);
    2. dass du dich weiterhin von deinem Rechner aus per SSH verbinden kannst;
    3. dass alles andere abgelehnt wird, angefangen bei der Datenbank.

    Yasmine empfiehlt ufw, schon installiert (man ufw). Sie hat noch
    gesagt: „Und vor allem: SSH erlauben, BEVOR du die Firewall
    einschaltest.“ Für sudo gilt immer noch dasselbe Passwort.

## Ereignisse

firewall-event-listening =
    Schau dir die Spalte „Local Address“ an: 0.0.0.0:3306 heißt, dass
    MariaDB auf ALLEN Schnittstellen lauscht, also kann jede Person im
    Internet an diese Tür klopfen. php-fpm dagegen lauscht nur auf
    127.0.0.1: Es ist nur von der Maschine selbst aus erreichbar.
firewall-event-locked-out =
    ACHTUNG: Die Firewall ist aktiv und blockiert SSH. Deine Sitzung hält
    (die Firewall lässt bereits aufgebaute Verbindungen durch), aber jede
    neue Verbindung wird scheitern. Erlaube SSH jetzt, bevor du dich
    abmeldest!
firewall-event-site-cut =
    Die Firewall ist aktiv… und die Website der Briefe antwortet nicht
    mehr: http (80) und https (443) sind blockiert. Kofi wird beunruhigte
    Nachrichten bekommen.
firewall-event-base-open =
    Die Firewall ist aktiv, aber die Datenbank (3306) ist immer noch aus
    dem Internet erreichbar. Lies Kofis Anfrage noch einmal.
firewall-event-filter =
    Die Firewall filtert richtig: Die Website antwortet allen, SSH
    antwortet dir, und die Datenbank antwortet niemandem von außen. Prüf
    es mit sudo ufw status verbose.

    Letzter Schritt, wie bei SSH: Prüf, dass du noch hineinkommst.
    exit, dann ssh briefe.
firewall-event-end =
    Neue Verbindung erfolgreich: Die Firewall lässt SSH durch. Yasmine
    startet ihren Scan noch einmal: 22, 80 und 443 offen, 3306 gefiltert.
    Kofi: „Sie sagt, das ist super Arbeit!“

    Gut gemacht! Du hast das Kapitel „Die Firewall“ abgeschlossen.

    WAS PASSIERT IST
    Ein Programm, das auf 0.0.0.0 lauscht, ist aus dem ganzen Internet
    erreichbar, auch wenn es nur lokal benutzt wird: So war es bei der
    Datenbank. Die Firewall lehnt jetzt alles Eingehende ab, außer den
    nützlichen Türen.

    GUTE PRAXIS
    - Fang damit an, nachzusehen, wer lauscht: sudo ss -tlnp.
    - ufw default deny incoming, dann die nützlichen Türen eine nach der
      anderen erlauben.
    - SSH VOR ufw enable erlauben, und eine neue Verbindung testen.
    - Noch besser: ufw limit OpenSSH (bremst Brute-Force-Angriffe), oder
      SSH nur von deinen eigenen Adressen erlauben.
    - Die Firewall entschuldigt keine schlechte Konfiguration: Eine lokale
      Datenbank sollte auch nur auf 127.0.0.1 lauschen (bind-address).

    EIN ANDERER WEG
    nftables direkt, wie in „Der Bienenstock“: mehr Zeilen zu schreiben,
    aber die ganze Firewall vor Augen, in einer einzigen Datei
    (/etc/nftables.conf). ufw schreibt diese Regeln für dich (sudo nft list
    ruleset zeigt sie). firewalld (Fedora, RHEL) denkt in Zonen. ufw für
    einen einfachen Server; nftables für einen Router, NAT oder feine Regeln.

    DOKUMENTATION
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
