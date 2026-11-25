### Geschichte „Das Audit“, Kapitel „Die Exposition“: Der Portscan der
### Auditorin findet die Datenbank und Redis aus dem Internet erreichbar.
### ufw und die Konfiguration von Redis. Die Befehle, die Pfade, die
### Schlüsselwörter von redis.conf und die Meldungen der Werkzeuge werden
### nicht übersetzt.

chapter-exposure = Die Exposition
    .summary = Schließen, was ein Portscan offen findet: ufw, und Redis nur auf der lokalen Maschine lauschen lassen.

## Dateien

exposure-email-salome =
    Von:     Salomé (Auditorin)
    An:      dich
    Betreff: Audit der Bäckerei — zweiter Teil: Exposition

    Hallo,

    Danke, dass du den ersten Teil erledigt hast: SSH, die Konten, sudo und
    die Datei mit den Geheimnissen sind in Ordnung. Der zweite Teil
    betrifft das, was man vom Server aus dem Internet sieht.

    Mein Portscan liegt in auditscan.txt. Zwei Zeilen stören mich: Die
    Datenbank (5432) und Redis (6379) antworten allen. Redis hat nicht
    einmal ein Passwort, und es wurde so installiert, dass es auf jeder
    Schnittstelle lauscht.

    Was ich erwarte:
    1. Nur SSH (von deinem Admin-Rechner aus) und die Website (80 und 443)
       aus dem Internet erreichbar. Eine Firewall ist installiert (ufw),
       aber sie ist ausgeschaltet.
    2. Redis soll zusätzlich nur auf der Maschine selbst lauschen: Eine
       Firewall wird abgeschaltet, vergessen oder falsch konfiguriert; ein
       Dienst, der nur sich selbst zuhört, ist sicherer.
    3. Die Bestell-App soll weiter funktionieren: Sie benutzt die Datenbank
       und Redis, lokal.

    Bitte teste mit einer neuen SSH-Verbindung, bevor du die Sitzung
    schließt, die du geöffnet hast.

    Salomé
    (Für sudo ist dein Passwort immer noch: mehl-2028)

## Ereignisse

exposure-event-listening =
    Da steht, wer lauscht, und wo. Schau dir die Spalte „Local
    Address:Port“ an: 0.0.0.0 heißt „alle Schnittstellen“, also von überall
    erreichbar (wenn nichts filtert); 127.0.0.1 heißt „nur diese Maschine“.
    Port 3000 (die App) ist schon lokal: Das ist das richtige Beispiel.
exposure-event-locked-out =
    ACHTUNG: Die Firewall ist aktiv und lässt SSH von deinem Rechner nicht
    mehr herein. Deine aktuelle Sitzung hält (aufgebaute Verbindungen werden
    nicht getrennt), aber die nächste nicht. Erlaube SSH sofort (sudo ufw
    status zum Nachsehen, man ufw für die Regel).
exposure-event-site-cut =
    Die Firewall blockiert jetzt die Website: Die Kundschaft kann nicht
    mehr bestellen. Erlaube die Ports 80 und 443 (ein Profil von ufw
    benennt sie: ufw app list, oder einfach die Nummern).
exposure-event-base-open =
    Die Firewall ist aktiv, aber ein Port der Datenbank oder von Redis
    kommt noch durch: eine zu weite Regel („allow“ ohne Port, ein
    Bereich…) oder eine Standardrichtlinie auf „allow“. Lies
    sudo ufw status verbose  noch einmal: Standardmäßig muss eingehend
    abgelehnt werden, was nicht erlaubt ist.
exposure-event-redis-stopped =
    Redis ist gestoppt: Die Bestell-App braucht es (Sitzungen und
    Warteschlange), Online-Bestellungen gehen nicht mehr durch! Einen
    Dienst abzuschalten heißt nicht, ihn zu reparieren: Starte ihn wieder,
    und ändere stattdessen seine Lauschadresse.
exposure-event-without-effect =
    In redis.conf steht zwar „bind 127.0.0.1“… aber Redis lauscht immer
    noch auf allen Schnittstellen: Ein Programm liest seine Konfiguration,
    wenn es startet, nicht wenn sich die Datei ändert. Lass es neu starten,
    dann
      ss -tln
    um die neue Adresse zu sehen.
exposure-event-firewall =
    Die Firewall ist aktiv: SSH (von deinem Rechner), 80 und 443 kommen
    durch; die Datenbank und Redis sind vom Internet aus geschlossen. Aber
    das ist nur eine Schicht: Redis lauscht immer noch auf allen
    Schnittstellen.
exposure-event-redis-local =
    Redis lauscht jetzt nur noch auf 127.0.0.1: Selbst ohne Firewall wäre
    es von außen nicht mehr erreichbar, und die App erreicht es weiterhin.
exposure-event-end =
    Du bist mit aktiver Firewall hereingekommen: SSH kommt durch, die
    Website auch, und die Datenbank und Redis sind geschlossen. Salomé:
    „Mein Scan sieht jetzt nur noch drei Ports. Danke! Bleibt der dritte
    Teil, die Anmeldespuren.“

    Gut gemacht! Du hast das Kapitel „Die Exposition“ abgeschlossen.

    WAS PASSIERT IST
    Ein Dienst, der auf 0.0.0.0 lauscht, ist für alles erreichbar, was die
    Maschine erreicht. Viel Software (Datenbanken, Caches wie Redis) wird
    offen installiert, „damit es funktioniert“; ohne Passwort lässt Redis
    jeden alle seine Daten lesen und schreiben, und Bots scannen das
    Internet, um solche Instanzen zu finden. Ein Portscan (nmap) ist der
    erste Zug eines Audits, wie eines Angriffs: sehen, was von außen
    sichtbar ist.

    GUTE PRAXIS
    - Zwei Schichten: eine Firewall, die eingehend standardmäßig ablehnt
      und nur erlaubt, was erlaubt sein muss (SSH, 80, 443), UND Dienste,
      die nur dort lauschen, wo sie sollen (bind 127.0.0.1,
      listen_addresses = 'localhost' für PostgreSQL).
    - ss -tlnp, um zu wissen, wer lauscht; den Scan nach jeder Änderung
      wiederholen.
    - SSH VOR dem Einschalten der Firewall erlauben, und mit einer neuen
      Verbindung testen. Den Dienst neu starten, damit er seine
      Konfiguration neu liest.
    - Für einen Dienst, der für eine bestimmte Maschine erreichbar bleiben
      muss: eine ufw-Regel, die auf ihre Adresse begrenzt ist (ufw allow
      from 192.0.2.30 to any port 5432).

    EIN ANDERER WEG
    nftables (oder iptables) erledigt dieselbe Arbeit wie ufw, feiner, und
    ufw ist nur eine Oberfläche davor: Das Prinzip bleibt dasselbe
    (Standardrichtlinie, Regeln, Reihenfolge). Redis kann auch nur auf
    einem Unix-Socket lauschen (unixsocket, port 0), ganz ohne
    Netzwerkport.

    DOKUMENTATION
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - Sicherheit von Redis: https://redis.io/docs/latest/operate/oss_and_stack/management/security/
    - Verbindungen zu PostgreSQL: https://www.postgresql.org/docs/current/runtime-config-connection.html
