### Geschichte „Das andere Unix“, Kapitel „Hier gibt es kein systemd“:
### einen Dienst auf FreeBSD-Art installieren und starten (pkg, rc.conf,
### service, sysrc, sockstat). Befehle, Optionen, Pfade und Meldungen werden
### nicht übersetzt.

chapter-rc-services = Hier gibt es kein systemd
    .summary = Das Programm muss heute Abend online sein: nginx mit pkg installieren, in rc.conf einschalten, mit service starten und prüfen, wer lauscht.

## Dateien

rc-services-message-romy =
    Von:  Romy
    An:   dich

    Heute Abend ist die monatliche Vorführung, und das Programm ist immer
    noch nicht online! Laut Luciens Notizen wurde die Website von nginx
    ausgeliefert, aber auf dem Server gibt es kein nginx mehr (wir haben
    ihn letzten Frühling neu installiert, und niemand hat den Web-Teil
    wieder eingerichtet). Kannst du es vor 20 Uhr wieder hinbekommen? Die
    Website selbst liegt noch in /usr/local/www/club.

    Romy

rc-services-notes-lucien =
    Luciens Notizen (2024)
    - nginx aus den Paketen; seine Konfiguration in /usr/local/etc/nginx.
    - Alles, was beim Booten startet, steht in /etc/rc.conf.
    - Kein systemd, kein apt. man ist dein Freund.

## Ereignisse

rc-services-event-no-systemd =
    Nicht gefunden: FreeBSD hat weder systemd noch apt. Pakete kommen von
    pkg (man pkg), und Dienste sind rc-Skripte, gesteuert von service (man
    service).
rc-services-event-ps-ef =
    ps -ef heißt unter FreeBSD nicht „alle Prozesse, volles Format“: -e
    zeigt die Umgebung jedes Prozesses (diese HOME=, PATH=…), und ohne a
    oder x listet ps nur deine eigenen Prozesse, die an einem Terminal
    hängen. Der BSD-Weg: ps aux (oder ps -ax), und ps -axj für die
    Elternprozesse. man ps, auf dieser Maschine.
rc-services-event-installed =
    nginx ist installiert, unter /usr/local: seine Konfiguration in
    /usr/local/etc/nginx, sein rc-Skript in /usr/local/etc/rc.d/nginx.
    Installiert heißt weder laufend noch beim Booten gestartet.
rc-services-event-not-enabled =
    „Cannot 'start' nginx“: Unter FreeBSD startet ein Dienst nur, wenn
    /etc/rc.conf ihn einschaltet (nginx_enable="YES"). Die Meldung nennt
    sogar die Variable. sysrc schreibt sie, ohne einen Editor zu öffnen
    (man sysrc).
rc-services-event-onestart =
    nginx läuft… aber mit onestart, nicht weil rc.conf es sagt: Beim
    nächsten Neustart kommt es nicht wieder. Die Website würde eines Nachts
    verschwinden, ohne dass jemand etwas angefasst hat.
rc-services-event-enabled =
    nginx_enable="YES" steht in rc.conf: nginx startet bei jedem Booten.
rc-services-event-end =
    Romy: „Das Programm ist online! Yanis hat es von zu Hause geprüft, es
    funktioniert.“

    Gut gemacht! Du hast das Kapitel „Hier gibt es kein systemd“
    abgeschlossen.

    WAS PASSIERT IST
    nginx war nicht mehr installiert. pkg hat es unter /usr/local
    installiert, rc.conf schaltet es jetzt beim Booten ein
    (nginx_enable="YES"), und service hat es gestartet; sockstat zeigt, dass
    es auf Port 80 lauscht.

    GUTE PRAXIS
    - Unter FreeBSD läuft ein Dienst, weil /etc/rc.conf es sagt: eine Zeile
      pro Dienst, NAME_enable="YES", das Gegenstück zu systemctl enable.
    - sysrc bearbeitet rc.conf, ohne einen Tippfehler im Rest der Datei zu
      riskieren.
    - Pakete leben unter /usr/local: Ihre Konfiguration liegt in
      /usr/local/etc, nicht in /etc.
    - Lies, was pkg nach der Installation ausgibt: Pakete hinterlassen dort
      nützliche Nachrichten.

    EIN ANDERER WEG
    service nginx enable schreibt dieselbe Zeile in rc.conf (ab FreeBSD
    12). Die Ports (/usr/ports) bauen dieselbe Software aus dem Quellcode,
    mit Optionen deiner Wahl: langsamer, flexibler. Jails können einen
    Dienst in seinem eigenen kleinen System auf derselben Maschine
    isolieren.

    DOKUMENTATION
    - Das Handbuch, Pakete: https://docs.freebsd.org/en/books/handbook/ports/#pkgng-intro
    - Das Handbuch, Dienste starten: https://docs.freebsd.org/en/books/handbook/config/#configtuning-starting-services
    - rc.conf(5): https://man.freebsd.org/cgi/man.cgi?query=rc.conf
    - sysrc(8): https://man.freebsd.org/cgi/man.cgi?query=sysrc
