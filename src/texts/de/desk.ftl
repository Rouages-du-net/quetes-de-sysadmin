### Der Rechner: die Startmaschine, von der aus du dich mit ssh mit den
### Maschinen der Geschichten verbindest. Und die Willkommensnachricht (motd) jeder Maschine.

workstation-welcome =
    Willkommen an deinem Rechner.

    Jede Geschichte spielt auf einer Maschine im Netzwerk. Um dich mit ihr
    zu verbinden, nutzt du ssh (Secure Shell), wie es Leute, die Server
    administrieren, jeden Tag tun. Fang mit dem Königreich an:

      ssh koenigreich

    Beim ersten Mal fragt ssh, ob du dieser Maschine vertraust: Antworte
    yes. Sobald du verbunden bist, ändert sich der Prompt (du@koenigreich).
    Um hierher zurückzukommen:

      exit

    Die Maschinen, die du kennst, stehen in ~/.ssh/config, und deine
    Schlüssel liegen im versteckten Verzeichnis ~/.ssh. Im Moment hast du nur
    den Schlüssel zum Königreich; schließ „Die Wurzel“ ab (Kapitel 3 von
    „Der Radierer“), um die anderen zu bekommen. Um sie zu sehen:

      ls -a ~/.ssh
# Kommentar oben in ~/.ssh/config (jede Zeile wird zu einem „#“-Kommentar)
workstation-config-comment =
    Die Maschinen, die du kennst. „ssh koenigreich“ verbindet sich mit
    koenigreich.internal als Benutzer du mit dem Schlüssel ~/.ssh/id_koenigreich.
    Handbuch: man ssh
# Kommentar oben in /etc/hosts des Rechners (jede Zeile wird zu einem „#“-Kommentar)
workstation-hosts-comment =
    Die Maschinen in diesem Spiel sind erfunden.
    Namen, die auf .internal enden, sind für private Netze reserviert (ICANN, 2024);
    Namen, die auf .example enden, für Beispiele (RFC 6761). Die Adressen 192.0.2.x,
    198.51.100.x und 203.0.113.x sind für die Dokumentation reserviert (RFC 5737).
    Keiner dieser Namen und keine dieser Adressen führt zu einer echten Person.
workstation-exit = (Du bist an deinem eigenen Rechner: exit würde dein Terminal schließen. Um dich mit einer Maschine zu verbinden: ssh name, zum Beispiel ssh koenigreich.)
# { $keys }: die Liste der neuen Schlüssel, durch Kommas getrennt
workstation-keys-received =
    🔑 Das Königreich dankt dir: Neue SSH-Schlüssel warten auf deinem
    Rechner auf dich ({ $keys }). Geh dorthin zurück (exit), sieh dir
    ~/.ssh/config an und verbinde dich mit der Maschine deiner Wahl.
workstation-keys-received-next =
    🔑 Eine weitere Etappe: Weitere Geschichten öffnen sich, ihre Schlüssel
    warten auf deinem Rechner ({ $keys }).

## Willkommensnachrichten der Maschinen (motd), beim Anmelden angezeigt

machine-kingdom-motd = Königreich — Server der Leuchtturmwärterin. Zugang nur für Reisende mit einem Schlüssel.
machine-datacenter-motd = Rechenzentrum — Webserver der Mediathek. Jeder Eingriff wird protokolliert.
machine-anthill-motd = Der Ameisenhaufen — der Computer des Nachbarschaftscafés. „Danke, dass du uns hilfst!“ (Kofi)
machine-manuscript-motd = Manuskript — der Computer von Inès. Den Roman nicht ohne Backup anfassen!
machine-library-motd = Stadtteilbibliothek — dieser Server wird heute Nacht um Mitternacht abgeschaltet.
machine-letters-motd = Die Nachbarschaftsbriefe — der Server des Vereins. Bitte geh gut mit ihm um!
machine-workshop-motd = Die Werkstatt — der Server des FabLabs. Hier wird repariert, verliehen und gebastelt.
machine-gazette-motd = Die Stadtteilzeitung — der Server der Zeitung. Wir veröffentlichen mit git push, nicht von Hand.
machine-games-motd = Die Ludothek im Viertel — der Server der Ehrenamtlichen. Wir spielen, wir verleihen, wir räumen die Figuren weg.
machine-radio-motd = Nachbarschaftsradio — der Server des Senders. Bereitschaft: ein Auge auf dem Stream, das andere auf den Logs.
machine-community-motd = Bürgerhaus — das Gateway. Dahinter: das Wiki und das Archiv.
machine-coop-motd = Die Lebensmittelgenossenschaft im Viertel — der Server der Kasse. Hier teilen wir alles außer Passwörtern.
machine-hive-motd = Der Bienenstock — der Router des Gemeinschaftsraums. eth0: die Box des Providers; eth1: der Switch.
machine-bakery-motd = Die Bäckerei — der Server der Bäckerei: die Website, die Bestell-App und ihre Datenbank. Hier war schon ein Audit.
machine-lab-motd = Das Labor — der Server des Fotoclubs: die Galerie und die Archive der Mitglieder. Zwei Platten im RAID 1.
machine-garden-motd = Die Gemeinschaftsgärten — Website und Mail des Vereins (gardens.example). Bitte pflegt die Setzlinge und den Server gleichermaßen!
machine-pilot-motd = Die Stadtteilzentren — die Steuermaschine: Von hier aus kümmert sich Ansible um die Server der drei Zentren.
machine-patch-motd = Der Flicken — die Fahrradselbsthilfewerkstatt (cycles.example). Ein nagelneuer Server, mit Caddy. Denk daran, deine Reifen aufzupumpen!
machine-canteen-motd = Die Kantine — der Server der Solidaritätskantine: das Menü des Tages und die Reservierungen. Zahl, was du kannst, iss in Gesellschaft.
machine-observatory-motd = Die Sternwarte — der Server des Astronomieclubs: die Fotogalerie und das Stacking der Bilder der Nacht. Klaren Himmel!
machine-theatre-motd = Das Theater — der Server des Stadtteiltheaters: die Kasse und ihre Datenbank. Toi, toi, toi!
machine-valley-motd = Die Hütten — der Server im Tal: die Logs der Berghütten, an einem Ort gesammelt.
machine-nas-motd = Der Fotoclub — das NAS des Clubs: die Fotos aller Alben, geteilt mit der Dunkelkammer.
machine-oven-motd = Die Bastion — der Lieferserver der Bäckerei: die Touren, die Fahrer·innen, die Bestellungen des Tages.
machine-projector-motd = Das andere Unix — der Server des Filmclubs: das Programm, die Tickets und das alte FreeBSD von Lucien.
machine-herbarium-motd = Die alte Sonne — der Katalog der Saatgutbibliothek seit 2009, auf einer Sun Fire V240. Bitte nicht ausstecken.
machine-abacus-motd = Der Nachtlauf — der Server der Versicherung auf Gegenseitigkeit: der nächtliche Beitragslauf in COBOL, vom Großrechner des Rechenzentrums geholt.
machine-mill-motd = Das Auftragsbuch — die IBM i der Mühle (PASE, die Unix-Seite). tn5250 muehle vom Rechner aus öffnet ihren grünen Bildschirm.
machine-kneader-motd = Die Bäckerei — neuer Server (Migration), sechs Monate nach dem Audit. Die Sicherheitsbeobachtung, jetzt ohne Salomé.

# Beim erneuten Verbinden mit einer Maschine, deren Kapitel läuft.
# { $file }: die Willkommensdatei des Kapitels (z. B. willkommen.txt)
resumed-chapter = Du setzt dieses Kapitel dort fort, wo du es verlassen hast. Um noch einmal zu lesen, was dich erwartet:   cat { $file }
machine-compass-motd = Windows nebenan — der Linux-Server des Zeichenbüros. Sein Nachbar, schrank, ist ein Windows Server.
machine-stave-motd = Die Musikschule — der Dateiserver der Schule, ein Windows Server 2022 (OpenSSH landet in cmd.exe).
machine-register-motd = Der Zettelkatalog — der Domänencontroller der Bibliotheken, ein Windows Server 2022 (Active Directory, lending.internal).
machine-crate-motd = Die Vorratskammer — der Debian-Server des Sozialladens (seine Dateien, seine App und die Backup-Platte, die freitags das Haus verlässt).
machine-quay-motd = Die Fähre — der Debian-Server der Fährgenossenschaft, in IPv4 und in IPv6 (ihre Site, ihre Buchungs-App, ihre DNS-Zone ferry.example).
machine-gauge-motd = Der Fahrradverleih — der Monitoring-Server der Genossenschaft (Prometheus, sein Node Exporter, der Alertmanager); sattel und nabe stehen dahinter.
machine-lane-motd = Das Schwimmbad — der Debian-Server des Schwimmbads, ein k3s-Cluster mit einem Knoten (die Buchungs-App, Namespace swim).

machine-chalk-motd = Das Lehrerzimmer — der Druckserver der Grundschule (CUPS): das Sekretariat, die Bibliothek, das Lehrerzimmer. Bitte das Jahrbuch nicht zweimal drucken.
machine-mast-motd = Der Äther — der Debian-Server des Verbands freier Radios: das Intranet, das Archiv, das Beitragsportal und die Zertifizierungsstelle des Verbands in /srv/ca.
machine-anvil-motd = Die Werkzeugbibliothek — die Forge von Lendshed: Forgejo (https://forge.lendshed.example), sein Actions-Runner und die Sites für Dokumentation und Downloads. Sei nett zu Beitragenden.
machine-hearth-motd = Das Gesundheitszentrum — der Hypervisor des Millbrook Health Centre (KVM, libvirt): ledger, agenda, records und ihre Freunde wohnen hier. virsh list --all vor allem anderen.
machine-lb1-motd = Die Blutspende — lb1, der erste Load Balancer des Lindenvale Blood Service (keepalived, HAProxy) vor donate.lindenvale.example. Sein Zwilling ist lb2. ip a vor allem anderen.
machine-baton-motd = Der Chor — taktstock, der Server des Riverside Community Choir: die Site, der Mitgliederbereich und seine Datenbank, und die Daten der Mitglieder. Die Aufbewahrungsrichtlinie liegt in /srv/choir/docs.
machine-trowel-motd = Die Kleingärten — kelle, der Datenbankserver der Greenholme Allotments Association (MariaDB): die Buchungen, Mitglieder und Warteliste von Plotline. sudo mariadb vor allem anderen.
machine-slipway-motd = Das Rettungsboot — helling, der Mailserver von Seaholme Lifeboat: Postfix empfängt, rspamd bewertet, Dovecot legt in /var/vmail ab. sudo tail /var/log/mail.log vor allem anderen.
machine-belay-motd = Die Kletterhalle — sicherung, der Server von Overhang, der Kletterhalle im Viertel: Buchungen, Mitgliedschaften, die Türbadges. Er hängt an einer USV im Büroschrank (Network UPS Tools: upsc, upsmon).
machine-wings-motd = Die Tanzgruppe — kulissen, der Server der Kestrel Dance Company und ein Knoten ihres Garage-Clusters. sudo garage status vor allem anderen; aws und rclone sprechen mit s3.kestrel.example.
machine-meadow-motd = Das Tierheim — wiese, der kleine Server der Hillside Animal Shelters bei einer Hosting-Genossenschaft: das restic-Repository (/srv/restic), der Notfallplan (/srv/drp) und das versteckte primäre DNS der Zone. koppel, der Hauptserver, steht im Keller von Hillside.
machine-kettle-motd = Das Sprachcafé — kessel, der kleine Server von Common Tongue im Hinterzimmer des Cafés: Rocky Linux 10 (kein Debian: dnf, firewalld, SELinux). Seine Site erscheint auf dem Bildschirm des Cafés, pinnwand.
machine-cairn-motd = Die Mapping-Party — steinmann, der DNS-Server des Wayfinders-Kollektivs (BIND, Zone wayfinders.example), seine Einträge als Code mit OpenTofu in /srv/dns. tofu plan vor allem anderen.
machine-stile-motd = Der Wanderverein — zaunstieg, der Server des Wandervereins Open Paths: Trailbook (Wanderungen und Anmeldungen) in einem Container hinter nginx, https://walks.openpaths.example. Sein Konto: trailbook.
machine-stapler-motd = Die Zine-Bibliothek — hefter, der Debian-Server der Zine-Bibliothek: nginx, die Katalog-App unter php-fpm (von AppArmor eingesperrt), die Scans der Zines in /srv/scans. sudo aa-status zeigt, was AppArmor einsperrt.
machine-latch-motd = Die Mieterinitiative — riegel, der Server der Larkspur Tenants' Union (Repairline, ihre Reparatur-App, und PostgreSQL). Der Code liegt in /srv/repairline, seine Geheimnisse mit sops und age verwahrt.
machine-padlock-motd = Die Herberge — schloss, der Server der genossenschaftlichen Herberge: OpenBao, der Tresor für die Geheimnisse von Bunks, ihrer Buchungs-Site. bao status vor allem anderen.
