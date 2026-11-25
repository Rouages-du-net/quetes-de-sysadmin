### Geschichte „Das andere Unix“, Kapitel „Die letzte Regel gewinnt“: eine
### pf-Konfiguration, mit iptables-Gewohnheiten geschrieben. Befehle,
### Optionen, Regeln und Pfade werden nicht übersetzt.

chapter-last-rule = Die letzte Regel gewinnt
    .summary = Die Datenbank des Clubs antwortet dem ganzen Internet: pf einschalten, ohne dich auszusperren, und lernen, dass bei pf die letzte passende Regel gewinnt.

## Dateien

last-rule-message-romy =
    Von:  Romy
    An:   dich

    Ein Mitglied, das in der IT arbeitet, hat unseren Server gescannt (mit
    unserer Erlaubnis): Die Datenbank, Port 3306, antwortet dem ganzen
    Internet. Nur die Website sollte mit ihr sprechen, vom Server selbst
    aus.

    Yanis hat eine Firewall-Konfiguration geschrieben, /etc/pf.conf, „wie
    bei iptables“, sagt er. Er hat sich nicht getraut, sie einzuschalten:
    Als er das letzte Mal eine Firewall angefasst hat, konnte sich zwei
    Tage lang niemand verbinden.

    Kannst du sie einschalten, ohne uns auszusperren?

    Romy

## Ereignisse

last-rule-event-checked =
    pfctl -n liest die Konfiguration und hört dort auf: Die Syntax stimmt,
    wenn es nichts sagt. Aber eine korrekte Syntax heißt nicht, dass die
    Regeln tun, was du willst: pfctl -sr zeigt sie so, wie pf sie versteht,
    sobald sie geladen sind.
last-rule-event-locked-out =
    Vorsicht: Mit diesen Regeln würde deine nächste ssh-Verbindung
    abgewiesen, und die Website antwortet nicht mehr. Bei pf wird JEDE
    Regel gelesen, und die letzte passende gewinnt: „block in all“ am Ende
    blockiert auch ssh und das Web. Deine aktuelle Sitzung bleibt offen (pf
    behält die Verbindungen, die es schon kennt): Korrigiere pf.conf und
    lade es dann neu.
last-rule-event-on =
    pf ist eingeschaltet, und ssh kommt weiterhin herein.
last-rule-event-not-at-boot =
    pf filtert, wie es soll… bis zum nächsten Neustart: Ohne
    pf_enable="YES" in rc.conf startet es nicht wieder.
last-rule-event-file-differs =
    Die geltenden Regeln sind nicht mehr die aus /etc/pf.conf: Lade die
    Datei nach dem Bearbeiten neu (pfctl -f), sonst würde ein Neustart
    etwas anderes zurückbringen.
last-rule-event-end =
    Romy: „Der Scan sagt 22 und 80, sonst nichts. Und wir können uns
    weiterhin verbinden!“

    Gut gemacht! Du hast das Kapitel „Die letzte Regel gewinnt“ und die
    Geschichte „Das andere Unix“ abgeschlossen.

    WAS PASSIERT IST
    Yanis hat seine Regeln in der Reihenfolge geschrieben, in der iptables
    sie liest: zulassen, dann den Rest blockieren. pf liest sie alle, und
    die LETZTE passende Regel entscheidet: Sein abschließendes „block in
    all“ hat alles blockiert, ssh inklusive. Zuerst blockieren, dann öffnen
    (oder „quick“ bei den pass-Regeln) sagt dasselbe in der Sprache von pf.
    pf startet jetzt beim Booten, mit den Regeln aus der Datei.

    GUTE PRAXIS
    - Eine Konfiguration prüfen, bevor man sie lädt (pfctl -nf), dann
      prüfen, was wirklich gilt (pfctl -sr), und von außen testen.
    - Bei pf: erst block, dann die pass-Regeln; oder quick bei den Regeln,
      die sofort entscheiden müssen.
    - Über ssh: deine Sitzung offen lassen, während du eine neue Firewall
      testest, und eine zweite öffnen, um zu prüfen, dass du noch
      hereinkommst.
    - Noch besser für eine Datenbank: Lass sie nur auf 127.0.0.1 lauschen.
      Die Firewall ist eine zweite Linie, nicht die einzige.

    EIN ANDERER WEG
    pf kann auch Adresslisten führen (tables), Angreifer bremsen
    (max-src-conn-rate mit overload, das pf-Gegenstück zu fail2ban) und NAT
    für einen Router zu Hause oder im Büro machen. FreeBSD bringt auch ipfw
    mit, seine andere Firewall, mit eigener Syntax (bei der die erste Regel
    gewinnt).

    DOKUMENTATION
    - pf.conf(5): https://man.freebsd.org/cgi/man.cgi?query=pf.conf
    - pfctl(8): https://man.freebsd.org/cgi/man.cgi?query=pfctl
    - Das Handbuch, PF: https://docs.freebsd.org/en/books/handbook/firewalls/#firewalls-pf
