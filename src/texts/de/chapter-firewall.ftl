### Story "The Neighbourhood Letters", chapter "The firewall": ufw.
### Commands, ports, addresses and ufw keywords (allow, deny…) are not
### translated; the output of nmap and ss stays in English.

chapter-firewall = Die Firewall
    .summary = Wer lauscht, und wer kommt herein: ss, ufw, und sich nie selbst aussperren.

## Files

firewall-email-kofi =
    Von:     Kofi (Der Ameisenhaufen)
    An:      du
    Betreff: Eine Tür zu viel?
    
    Meine Freundin Yasmine, die in der IT-Sicherheit arbeitet, hat unseren
    Server von zu Hause aus „gescannt“ (mit unserer Erlaubnis!). Ihr Bericht
    liegt in ~/scan_yasmine.txt. Sie sagt, Port 3306 ist die Datenbank der
    Website, und die hat im Internet nichts verloren.
    
    Könntest du eine Firewall einrichten? Wir brauchen:
    
    1. dass die Website für alle erreichbar bleibt (http und https);
    2. dass du dich weiter über SSH von deinem Rechner aus verbinden kannst;
    3. dass alles andere abgelehnt wird, angefangen mit der Datenbank.
    
    Yasmine empfiehlt ufw, schon installiert (man ufw). Sie hat noch gesagt:
    „Und vor allem: SSH erlauben, BEVOR du die Firewall einschaltest.“ Für
    sudo ist es immer noch dasselbe Passwort.

## Events

firewall-event-listening =
    Schau dir die Spalte „Local Address“ an: 0.0.0.0:3306 bedeutet, dass
    MariaDB auf ALLEN Schnittstellen lauscht, also kann jede Person im
    Internet an diese Tür klopfen. php-fpm dagegen lauscht nur auf
    127.0.0.1: es ist nur von der Maschine selbst aus erreichbar.
firewall-event-locked-out =
    ACHTUNG: die Firewall ist aktiv und blockiert SSH. Deine Sitzung hält
    (die Firewall lässt schon aufgebaute Verbindungen durch), aber jede neue
    Verbindung wird scheitern. Erlaube SSH jetzt, bevor du dich abmeldest!
firewall-event-site-cut =
    Die Firewall ist aktiv… und die Website der Briefe antwortet nicht mehr:
    http (80) und https (443) sind blockiert. Kofi wird besorgte Nachrichten
    bekommen.
firewall-event-base-open =
    Die Firewall ist aktiv, aber die Datenbank (3306) ist immer noch aus dem
    Internet erreichbar. Lies Kofis Bitte noch einmal.
firewall-event-filter =
    Die Firewall filtert richtig: die Website antwortet allen, SSH antwortet
    dir, und die Datenbank antwortet niemandem von außen. Prüfe mit sudo ufw
    status verbose.
    
    Letzter Schritt, wie bei SSH: prüfe, dass du noch hereinkommst.
    exit, dann ssh letters.
firewall-event-end =
    Neue Verbindung erfolgreich: die Firewall lässt SSH durch. Yasmine lässt
    ihren Scan noch einmal laufen: 22, 80 und 443 offen, 3306 gefiltert.
    Kofi: „Sie sagt, das ist super Arbeit!“
    
    Gut gemacht! Du hast das Kapitel „Die Firewall“ abgeschlossen.
    
    WAS PASSIERT IST
    Ein Programm, das auf 0.0.0.0 lauscht, ist aus dem ganzen Internet
    erreichbar, auch wenn es nur lokal benutzt wird: so war es bei der
    Datenbank. Die Firewall lehnt jetzt alles ab, was hereinkommt, außer den
    nützlichen Türen.
    
    GUTE PRAXIS
    - Zuerst schauen, wer lauscht: sudo ss -tlnp.
    - ufw default deny incoming, dann die nützlichen Türen eine nach der
      anderen erlauben.
    - SSH erlauben, BEVOR ufw enable, und eine neue Verbindung testen.
    - Noch besser: ufw limit OpenSSH (bremst Brute Force), oder SSH nur von
      deinen eigenen Adressen erlauben.
    - Die Firewall entschuldigt keine schlechte Konfiguration: eine lokale
      Datenbank sollte auch nur auf 127.0.0.1 lauschen (bind-address).
    
    EIN ANDERER WEG
    nftables direkt, wie im Bienenstock: mehr Zeilen zu schreiben, aber die
    ganze Firewall vor Augen, in einer einzigen Datei (/etc/nftables.conf).
    ufw schreibt diese Regeln für dich (sudo nft list ruleset zeigt sie).
    firewalld (Fedora, RHEL) denkt in Zonen. ufw für einen einfachen Server;
    nftables für einen Router, NAT oder feine Regeln.
    
    DOKUMENTATION
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
