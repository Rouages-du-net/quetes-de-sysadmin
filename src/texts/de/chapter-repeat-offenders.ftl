### Geschichte „Die Nachbarschaftsbriefe“, Kapitel 8 „Wiederholungstäter“:
### weitere fail2ban-Jails (recidive, nginx-limit-req). Befehle, Pfade,
### Namen der Jails und Log-Zeilen werden nie übersetzt.

chapter-repeat-offenders = Wiederholungstäter
    .summary = Dieselben Bots kommen jede Stunde wieder, und der Bot des Kalenders lässt nicht locker: die Jails recidive und nginx-limit-req von fail2ban aktivieren.

## Dateien

repeat-offenders-email-rania =
    Von:     Rania
    An:      dich
    Betreff: Immer dieselben

    Hallo!

    Seit SSH auf Port 2222 umgezogen ist, ist es ruhiger, aber schau dir
    /var/log/fail2ban.log an: Zwei Adressen werden für eine Stunde
    gesperrt, entsperrt, wieder gesperrt… seit gestern neunmal bei einer
    von ihnen. Sie haben den neuen Port gefunden, und eine Sperre von einer
    Stunde schreckt sie nicht ab.

    Und der Bot, der in der Konzertnacht den Kalender abgesaugt hat, ist
    zurück. nginx begrenzt ihn zwar (er bekommt Absagen), aber er lässt
    nicht locker: Das Fehlerlog von nginx (/var/log/nginx/error.log) ist
    voller „limiting requests“.

    fail2ban hat für beide Fälle fertige Jails, sie sind in
    /etc/fail2ban/jail.conf beschrieben (such nach recidive und den
    nginx-Jails). Sie sind einfach deaktiviert. Denk dran: jail.conf
    rühren wir nicht an, wir konfigurieren in jail.local.

    Pass auf mich auf: Beim Testen der Begrenzung habe ich den Kalender
    selbst ein bisschen zu schnell neu geladen.

    Zum Prüfen: sudo fail2ban-client status, dann den Status jedes Jails.
    Und sudo nft list ruleset zeigt, was jedes Jail blockiert.

## Ereignisse

repeat-offenders-event-all-active =
    fail2ban weigert sich zu starten: „Have not found any log file“. Mit
    enabled = true in [DEFAULT] hast du ALLE Jails von jail.conf
    aktiviert, auch die für apache und postfix, die hier nicht laufen:
    fail2ban findet ihre Logs nicht und hält an. Ein Jail aktiviert man in
    seinem eigenen Abschnitt: [recidive], [nginx-limit-req]…
repeat-offenders-event-short =
    Das Jail recidive ist aktiv, aber es sperrt nicht länger als das Jail
    sshd. Genau darum geht es dabei: Eine mehrfach gesperrte Adresse wird
    dann für lange Zeit gesperrt (eine Woche, in jail.conf). Behalte für
    recidive eine viel längere bantime.
repeat-offenders-event-repeat-offence =
    Das Jail recidive hat fail2ban.log gelesen, die Sperren jeder Adresse
    gezählt und die Wiederholungstäter für eine Woche gesperrt, auf allen
    Ports (banaction_allports): SSH, aber auch die Website.
repeat-offenders-event-agenda =
    Das Jail nginx-limit-req hat das Fehlerlog von nginx gelesen und die
    Adressen des Kalender-Bots gesperrt. nginx sieht sie nicht einmal mehr
    ankommen: Die Firewall weist sie vorher ab.
repeat-offenders-event-end =
    Die Wiederholungstäter sind für eine Woche gesperrt, der Kalender-Bot
    auch, und weder Rania noch die Besucher waren betroffen. Rania:
    „fail2ban.log passt jetzt auf einen Bildschirm!“

    Gut gemacht! Du hast das Kapitel „Wiederholungstäter“ abgeschlossen.

    WAS PASSIERT IST
    Ein fail2ban-Jail ist ein zu lesendes Log, ein Filter (was als
    Fehlschlag zählt) und eine Aktion (was blockiert wird, und wie lange).
    nginx-limit-req liest die Absagen der Ratenbegrenzung von nginx;
    recidive liest das eigene Log von fail2ban: Eine Adresse, die an einem
    Tag fünfmal gesperrt wurde, wird dann für eine Woche gesperrt, auf
    allen Ports. ignoreip, gesetzt in [DEFAULT], schützt Rania in jedem Jail.

    GUTE PRAXIS
    - Ein Jail in seinem Abschnitt von jail.local aktivieren
      (enabled = true), nie in [DEFAULT], nie in jail.conf.
    - fail2ban-client -t vor dem Neuladen, dann fail2ban-client status für
      jedes Jail.
    - recidive sperrt länger als die anderen Jails; die Datenbank von
      fail2ban (dbpurgeage) muss die Sperren mindestens so lange behalten
      wie dessen findtime.
    - Ein anderer Ansatz, seit fail2ban 0.11: bantime.increment = true
      verlängert die Sperre bei jeder Wiederholung, in jedem Jail.

    DOKUMENTATION
    - jail.conf (fail2ban): https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - Die mit fail2ban gelieferten Jails: https://github.com/fail2ban/fail2ban/blob/master/config/jail.conf
    - limit_req (nginx): https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
