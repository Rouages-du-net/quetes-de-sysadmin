### Geschichte „Die Flotte“, Kapitel 1 „Das Inventar“: Erreicht Ansible
### die drei Stadtteilzentren? Die Befehle, Pfade und Ausgaben von Ansible
### werden nicht übersetzt.

chapter-inventory = Das Inventar
    .summary = Drei Server auf einmal verwalten: ein Ansible-Inventar, Host-Schlüssel, das richtige Konto, dann ansible -m ping.

## Dateien

inventory-email-theo =
    Von:     Théo
    An:      dich
    Betreff: Die drei Stadtteilzentren

    Hallo, und willkommen!

    Die drei Stadtteilzentren haben jedes ihren kleinen Server: north,
    south und east (north.centres.internal usw.). Bisher haben wir uns auf
    jedem angemeldet, um alles dreimal zu machen, und am Ende sahen sie
    sich nicht mehr ähnlich. Wir steigen auf Ansible um: von dieser
    Maschine aus ein Befehl für alle drei.

    Auf jedem Zentrum hat das Konto deploy deinen SSH-Schlüssel
    (~/.ssh/id_ed25519) und darf sudo ohne Passwort benutzen.

    Ich habe in ~/ansible angefangen: eine ansible.cfg und ein Inventar.
    Ich hatte keine Zeit, es fertigzumachen oder auszuprobieren. Der erste
    Test ist:
    ansible centres -m ping
    Er muss für alle drei mit „pong“ antworten.

    Das sudo-Passwort auf dieser Maschine: viertel-2027.

    Théo

## Ereignisse

inventory-event-without-config =
    „No inventory was parsed“: Ansible hat weder eine ansible.cfg noch ein
    Inventar gefunden. Es sucht ansible.cfg im Verzeichnis, in dem du bist,
    dann ~/.ansible.cfg, dann /etc/ansible/ansible.cfg. Théos Konfiguration
    liegt in ~/ansible: Geh dorthin (cd ~/ansible).
inventory-event-key-host =
    „Host key verification failed“: Ansible geht über ssh, fragt aber nie
    „Are you sure you want to continue connecting?“. Eine Maschine, deren
    Host-Schlüssel nicht in ~/.ssh/known_hosts steht, wird abgelehnt.
    Verbinde dich einmal mit jeder (ssh deploy@north, Fingerabdruck
    prüfen, yes, dann exit): Der Schlüssel wird gespeichert, und Ansible
    kommt durch.
inventory-event-account =
    „theo@…: Permission denied“: Ansible verbindet sich mit dem Konto
    remote_user aus ansible.cfg, theo, das es auf den Zentren nicht gibt.
    Das Konto mit deinem Schlüssel ist deploy (oder ansible_user im
    Inventar, oder -u deploy für einen einzelnen Befehl).
inventory-event-missing =
    Alle im Inventar antworten mit „pong“… aber das Inventar kennt nur
    zwei von ihnen. Théo hat von drei Stadtteilzentren gesprochen:
    ansible-inventory --graph zeigt, was Ansible gelesen hat.
inventory-event-end =
    north, south und east antworten mit „pong“: Ansible erreicht alle
    drei, mit dem richtigen Konto und geprüften Host-Schlüsseln. Théo:
    „Ein Befehl für drei Server, wir haben es!“

    Gut gemacht! Du hast das Kapitel „Das Inventar“ abgeschlossen.

    WAS PASSIERT IST
    Ansible installiert nichts auf den Servern: Es verbindet sich über ssh,
    mit einem Konto und einem Schlüssel, und führt dort kleine Programme
    aus (die Module). Das Inventar sagt, welche Maschinen es verwaltet,
    nach Gruppen sortiert ([centres]); ansible.cfg, aus dem aktuellen
    Verzeichnis gelesen, sagt, wo das Inventar liegt und mit welchem Konto
    es sich verbinden soll. ping macht keinen Netzwerk-Ping: Es prüft, dass
    Ansible sich verbinden und ein Modul ausführen kann.

    GUTE PRAXIS
    - Host-Schlüssel prüfen (known_hosts), statt die Prüfung abzuschalten
      (host_key_checking = False): Das schützt dich vor einer Maschine, die
      sich als eine andere ausgibt.
    - Ein eigenes Konto (deploy), mit einem Schlüssel, und sudo für das,
      was root braucht (become).
    - ansible-inventory --graph, um zu sehen, was Ansible vom Inventar
      verstanden hat.

    DOKUMENTATION
    - Das Inventar: https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html
    - Verbindungen: https://docs.ansible.com/ansible/latest/inventory_guide/connection_details.html
    - Das Modul ping: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/ping_module.html
