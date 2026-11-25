### Geschichte „Das Bürgerhaus“, Kapitel „Der Sprung“: eine interne Maschine
### über das Gateway erreichen (ssh -J, ProxyJump). Die Optionen von
### ssh_config, die Befehle, die Pfade und die Meldungen von OpenSSH (auf
### Englisch) werden nicht übersetzt.

chapter-jump = Der Sprung
    .summary = Das Wiki ist nur über das Gateway erreichbar: ssh -J, dann eine Abkürzung ProxyJump in ~/.ssh/config.

## Dateien

jump-email-yasmine =
    Von:      Yasmine
    An:       dich
    Betreff:  Das Wiki

    Gut gemacht mit dem Gateway! Nächster Schritt: das Wiki der Vereine.
    Es ist die Maschine „wiki“ (wiki.buergerhaus.internal, 10.20.0.11), in
    unserem internen Netz: Aus dem Internet ist sie nicht erreichbar, nur
    von buergerhaus aus. Schau dir hier /etc/hosts an: Das sind die Namen,
    die buergerhaus kennt.

    Gaspard hat es so gemacht: ssh buergerhaus, dann, einmal auf
    buergerhaus, ssh wiki. Aber damit das zweite ssh funktionierte, hatte
    er seinen PRIVATEN Schlüssel auf buergerhaus kopiert. Ich habe ihn
    gelöscht: Käme jemand auf das Gateway, ginge er mit dem Schlüssel zum
    ganzen Netz davon.

    Angeblich kann ssh über eine Maschine „springen“, direkt von deinem
    Rechner aus, ohne dass dein privater Schlüssel ihn verlässt (man ssh,
    Option -J). Und damit du das nicht jedes Mal tippen musst, kann man es
    ein für alle Mal in ~/.ssh/config schreiben, auf deinem Rechner (man
    ssh_config, ProxyJump): Ich hätte gern, dass ein einfaches „ssh wiki“
    reicht.

    Ich habe deinen öffentlichen Schlüssel schon auf unseren Maschinen
    eingetragen, neben meinem.

jump-note-gaspard =
    Notiz von Gaspard (März 2019)

    Das Wiki läuft hier, in /srv/wiki. Die Seiten sind einfache
    Markdown-Dateien; man bearbeitet sie im Browser.

    Um hierherzukommen: ssh buergerhaus, dann ssh wiki. (Ich habe meinen
    Schlüssel in ~/.ssh auf buergerhaus gelegt, das ist bequemer.)

jump-wiki-welcome =
    # Wiki der Vereine

    Willkommen im Wiki des Bürgerhauses! Jeder Verein hat seine Seite:
    Öffnungszeiten, Kontakte, gebuchte Räume.

    - Die Gemeinschaftsgärten
    - Der Dienstagschor
    - Der Schachclub
    - Die Fahrradwerkstatt

## Ereignisse

jump-event-key-private =
    ACHTUNG: In ~/.ssh auf buergerhaus liegt ein privater Schlüssel (eine
    Zeile „BEGIN OPENSSH PRIVATE KEY“). Genau das wollte Yasmine vermeiden:
    Das Gateway ist die am meisten exponierte Maschine des Netzes.

    Lösch ihn (rm) und spring stattdessen von deinem Rechner aus: man ssh,
    Option -J.
jump-event-to-wiki =
    Da bist du auf dem Wiki! Deine Verbindung ging über buergerhaus, aber
    dein privater Schlüssel ist auf deinem Rechner geblieben: buergerhaus
    hat nur einen Tunnel weitergeleitet, der zwischen deinem Rechner und
    dem Wiki durchgehend verschlüsselt ist.

    (Schau auf deine Eingabeaufforderung: du@wiki. hostname bestätigt es.)

    Bleibt die Abkürzung: auf deinem Rechner ein Block in ~/.ssh/config,
    damit ein einfaches „ssh wiki“ reicht (man ssh_config, ProxyJump).
jump-event-shortcut =
    Die Abkürzung steht in der ~/.ssh/config deines Rechners: ssh findet
    dort den Weg zum Wiki, über buergerhaus. (Um zu sehen, was ssh daraus
    macht: ssh -G wiki.)
jump-event-end =
    Ein einfaches „ssh wiki“ von deinem Rechner aus, und kein privater
    Schlüssel auf dem Gateway. Yasmine: „Das ist sauberer als zu Gaspards
    Zeiten… aber sag es ihm nicht!“

    Gut gemacht! Du hast das Kapitel „Der Sprung“ abgeschlossen.

    WAS PASSIERT IST
    Mit -J (oder ProxyJump) verbindet sich ssh zuerst mit dem Gateway und
    bittet es, eine einfache Leitung zum Wiki zu öffnen. Durch diese
    Leitung spricht dein Rechner direkt mit dem Wiki: Die Prüfung seines
    Hostschlüssels und deine Authentifizierung laufen durchgehend. Das
    Gateway sieht nur verschlüsselten Verkehr vorbeiziehen, und dein
    privater Schlüssel verlässt deinen Rechner nie.

    GUTE PRAXIS
    - Nie einen privaten Schlüssel auf einen Server kopieren, am wenigsten
      auf das Gateway (den „Bastion-Host“), die am meisten exponierte Maschine.
    - Mit ssh -J oder ProxyJump springen statt mit zwei ssh hintereinander
      (oder der Option ForwardAgent, die deinen Agent dem Gateway aussetzt).
    - Abkürzungen in ~/.ssh/config schreiben (Host, HostName, User,
      ProxyJump); mit ssh -G prüfen.
    - HostName wird aus Sicht des Gateways verstanden: Das Gateway sucht
      „wiki“ in seiner /etc/hosts (oder seinem DNS).

    DOKUMENTATION
    - ssh, Option -J: https://man.openbsd.org/ssh#J
    - ssh_config, ProxyJump: https://man.openbsd.org/ssh_config#ProxyJump
