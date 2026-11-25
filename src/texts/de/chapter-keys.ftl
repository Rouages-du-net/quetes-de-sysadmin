### Geschichte „Das Bürgerhaus“, Kapitel „Die Schlüssel“: das eigene
### Schlüsselpaar erstellen, es auf den Server legen, dann Passwörter
### verweigern. Schlüsselwörter von sshd_config, Befehle, Pfade und die
### Meldungen von OpenSSH (auf Englisch) werden nie übersetzt.

chapter-keys = Die Schlüssel
    .summary = Dein Konto hat ein vorläufiges Passwort (flieder-2027): ssh-keygen, ssh-copy-id, dann überhaupt keine Passwörter mehr.

## Dateien

# { $password }: das vorläufige Passwort des Kontos
keys-email-yasmine =
    Von:     Yasmine (Koordinatorin des Bürgerhauses)
    An:      dich
    Betreff: Willkommen im Team!

    Danke, dass du die IT des Bürgerhauses übernimmst! Gaspard, der sich
    zehn Jahre lang darum gekümmert hat, ist nach Lyon gezogen; er ist
    noch erreichbar, kann aber nicht mehr vorbeikommen.

    Die Maschine „buergerhaus“ ist unser Gateway: Sie ist die einzige, die
    aus dem Internet sichtbar ist. Dahinter stehen das Wiki der Vereine
    und der Archivserver (du lernst sie bald kennen).

    Ich habe dir ein Konto angelegt (Benutzername: du) mit einem
    vorläufigen Passwort: { $password }. Damit kommst du vorerst hinein.
    Gaspard sagte immer, ein Passwort auf einem Server, der zum Internet
    offen ist, sei eine angelehnte Tür. Also vor allem anderen:

    1. Erstelle dein eigenes SSH-Schlüsselpaar, auf DEINEM Rechner
       (man ssh-keygen).
    2. Leg deinen öffentlichen Schlüssel auf buergerhaus (man ssh-copy-id)
       und verbinde dich dann neu: ssh darf dich nicht mehr nach einem
       Passwort fragen.
    3. Erst dann bring den SSH-Server dazu, Passwörter zu verweigern
       (/etc/ssh/sshd_config, man sshd_config), und prüfe, ob du noch
       hereinkommst.

    Für sudo ist es dasselbe vorläufige Passwort: sudo wird immer eins
    verlangen, auch wenn ssh keins mehr will.

## Ereignisse

# { $config }: der Pfad der Konfigurationsdatei
keys-event-error =
    In der SSH-Konfiguration ist ein Fehler. Vor dem Neuladen immer mit
    sudo sshd -t prüfen: Es nennt die schuldige Datei und Zeile. Solange
    sie falsch ist, weigert sich systemctl reload ssh, sie anzuwenden, und
    sshd behält die alte.
keys-event-locked-out =
    ACHTUNG: sshd verweigert jetzt Passwörter… und für dein Konto ist kein
    Schlüssel autorisiert (~/.ssh/authorized_keys). Deine aktuelle Sitzung
    bleibt offen, aber eine neue Verbindung würde abgewiesen!

    Stell PasswordAuthentication yes wieder ein und lade ssh neu, lange
    genug, um deinen Schlüssel einzurichten. Die Reihenfolge zählt: erst
    der Schlüssel, dann die Tür.
keys-event-key-game =
    Ein Schlüssel ist in ~/.ssh/authorized_keys angekommen… aber es ist
    ein Schlüssel, den dir das Spiel für eine andere Maschine gegeben hat
    (schau ans Ende der Zeile, und ls -lt ~/.ssh auf deinem Rechner). Ohne
    -i nimmt ssh-copy-id den neuesten öffentlichen Schlüssel in ~/.ssh;
    und ssh bietet ihn buergerhaus nicht an.

    Erstelle zuerst dein eigenes Paar (ssh-keygen) und führe dann
    ssh-copy-id noch einmal aus.
keys-event-copied =
    Dein öffentlicher Schlüssel liegt in ~/.ssh/authorized_keys auf
    buergerhaus. Schau dir die Datei an (cat): eine Zeile
    „ssh-ed25519 AAAA…“, die öffentliche Hälfte deines Paars. Die private
    Hälfte hat deinen Rechner nie verlassen.

    Verbinde dich neu (exit, dann ssh buergerhaus): diesmal ohne Passwort.
keys-event-by-key =
    Du bist mit deinem Schlüssel hereingekommen, ohne Passwort! Der Server
    hat dir eine Aufgabe geschickt, die nur dein privater Schlüssel
    signieren konnte.

    Schließ jetzt die Tür für Passwörter: Ein Bot könnte immer noch
    versuchen, eins zu erraten. Such in /etc/ssh/sshd_config die Zeile
    PasswordAuthentication (man sshd_config), dann sudo sshd -t und sudo
    systemctl reload ssh.
keys-event-closed =
    sshd akzeptiert jetzt nur noch Schlüssel. Bevor du diese Sitzung
    schließt, teste: exit, dann ssh buergerhaus. (Auf einem echten Server
    hält man die Sitzung offen und testet in einem zweiten Terminal.)
keys-event-end =
    Mit deinem Schlüssel drin, und Passwörter werden verweigert: Das
    Gateway ist für Bots geschlossen, aber nicht für dich. Yasmine:
    „Gaspard wird stolz auf dich sein!“

    Gut gemacht! Du hast das Kapitel „Die Schlüssel“ abgeschlossen.

    WAS PASSIERT IST
    Ein Schlüsselpaar sind zwei Dateien: der private Schlüssel
    (~/.ssh/id_ed25519), der auf deinem Rechner bleibt, und der
    öffentliche Schlüssel (id_ed25519.pub), den du jedem geben kannst. Der
    Server bewahrt die autorisierten öffentlichen Schlüssel in
    ~/.ssh/authorized_keys auf; beim Verbinden bittet er dich, eine
    Aufgabe mit dem privaten Schlüssel zu signieren. Nichts Geheimes reist
    durchs Netz, und nichts lässt sich erraten.

    GUTE PRAXIS
    - Den Schlüssel auf der eigenen Maschine erzeugen (ssh-keygen -t
      ed25519), mit einer Passphrase; einen privaten Schlüssel nie
      woandershin kopieren.
    - Den öffentlichen Schlüssel mit ssh-copy-id einrichten: Es legt ~/.ssh
      und authorized_keys mit den richtigen Rechten an (700 und 600).
    - In dieser Reihenfolge: der Schlüssel, der Test, dann
      PasswordAuthentication no.
    - Eine Sitzung offen halten und mit einer neuen Verbindung testen.

    DOKUMENTATION
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
    - ssh-copy-id: https://manpages.debian.org/bookworm/openssh-client/ssh-copy-id.1.en.html
    - sshd_config: https://man.openbsd.org/sshd_config
