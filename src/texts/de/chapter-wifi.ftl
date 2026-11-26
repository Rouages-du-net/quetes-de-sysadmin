### Geschichte „Der Bienenstock“, Kapitel „Das WLAN der Büros“: 802.1X mit
### FreeRADIUS und dem LDAP-Verzeichnis. Die Befehle, die Dateinamen und die
### Namen der RADIUS-Attribute werden nicht übersetzt.

chapter-wifi = Das WLAN der Büros
    .summary = Kein gemeinsames WLAN-Passwort mehr: Alle verbinden sich mit ihrem Konto aus dem Verzeichnis, und der RADIUS-Server steckt jede Person in ihr VLAN.

## Dateien

wifi-email-malik =
    Von:     Malik
    An:      dich
    Betreff: Das WLAN der Büros

    Das WLAN-Passwort der Büros klebt seit drei Jahren auf einem Zettel,
    und Camille kennt es immer noch. Der Elektriker hat einen
    „Enterprise“-Zugangspunkt installiert (WPA2-Enterprise, 802.1X): Alle
    verbinden sich mit ihrem eigenen Konto aus dem Verzeichnis, und der
    Zugangspunkt steckt die Person in das VLAN, das ihm der RADIUS-Server
    sagt. Seine Einstellungen stehen in ap-bueros.txt.

    Der RADIUS-Server ist FreeRADIUS, schon auf dem Router installiert
    (/etc/freeradius/3.0, man freeradius). Was wir wollen:
    - die Mitglieder der Gruppe „bueros“ (Malik, Inès, Sami): VLAN 10;
    - die anderen Konten des Verzeichnisses (Léo, im Café): VLAN 20;
    - gelöschte Konten (Camille): draußen.

    Zum Testen ohne Zugangspunkt: radtest (man radtest). Und das Log des
    Servers: journalctl -u freeradius.

    Für sudo: biene-2027

# { $secret }: das gemeinsame Geheimnis des Zugangspunkts; { $address }: seine Adresse
wifi-bound =
    WLAN-ZUGANGSPUNKT „BÜROS“ — Einstellungen (der Elektriker, Februar 2028)

    Adresse des Zugangspunkts : { $address } (VLAN 30, Geräte)
    WLAN-Netz (SSID)          : TheHive-Offices
    Sicherheit                : WPA2-Enterprise (802.1X), EAP-TTLS / PAP
    RADIUS-Server             : 10.10.30.1, Port 1812 (UDP)
    Gemeinsames Geheimnis     : { $secret }
    Dynamisches VLAN          : ja (Attribut Tunnel-Private-Group-Id)
    Switch-Port               : 22, Trunk: VLAN 10, 20, 30

## Ereignisse

wifi-event-filter =
    Der Zugangspunkt schickt seine Anfragen an den Router (UDP 1812)… und
    die Kette input verwirft sie: Nichts lässt sie aus dem VLAN der Geräte
    herein. Das Log von freeradius bleibt still: Es empfängt sie nicht
    einmal.
wifi-event-not-reread =
    Die Konfiguration hat sich auf der Platte geändert, aber freeradius
    läuft noch mit der alten: Es liest seine Dateien nur beim Start neu
    (sudo freeradius -XC zum Prüfen, dann systemctl restart freeradius).
wifi-event-unknown =
    Die Anfragen kommen an, aber freeradius antwortet nicht (journalctl -u
    freeradius): Der Zugangspunkt ist kein Client, den es kennt, oder sein
    gemeinsames Geheimnis ist falsch. Jeder Zugangspunkt wird in
    clients.conf eingetragen, mit seiner Adresse und demselben Geheimnis
    wie in seinen Einstellungen.
wifi-event-without-ldap =
    freeradius antwortet… nein, allen: Es kennt kein Passwort („No known
    good password“). Die Konten liegen im Verzeichnis, aber das Modul ldap
    ist nicht aktiviert: Aktivierte Module sind Links in mods-enabled, die
    auf mods-available zeigen.
wifi-event-anonymous =
    Das Modul ldap findet die Konten zwar… aber nicht ihre Passwörter: Es
    bindet sich anonym, und das Verzeichnis zeigt userPassword nur Konten,
    die es sehen dürfen. Das Modul braucht eine Identität (identity,
    password). Und seine Basis (base_dn) muss die des Bienenstocks sein.
wifi-event-groups =
    Malik kommt herein, bekommt aber nicht VLAN 10: Ldap-Group findet ihn
    in keiner Gruppe. Standardmäßig sucht das Modul ldap das Attribut
    memberOf im Eintrag der Person… das dieses Verzeichnis nicht hat:
    Seine Gruppen vom Typ posixGroup listen ihre Mitglieder in memberUid
    auf. Das Modul kann auf eine andere Art suchen (membership_filter).
wifi-event-order =
    Malik bekommt VLAN 20, wie Léo. In der Datei users gewinnt der erste
    passende Eintrag: Wenn der Eintrag für alle vor dem für die Gruppe der
    Büros kommt, erreicht niemand je den zweiten.
wifi-event-in-place =
    Das WLAN der Büros funktioniert… gerade jetzt. Beim nächsten Booten?
    Die Firewall-Regel muss in /etc/nftables.conf stehen (freeradius
    seinerseits liest seine Dateien neu).
wifi-event-end =
    Malik, Inès und Sami kommen mit ihren eigenen Konten ins VLAN der
    Büros, Léo in das des Cafés, und Camille bleibt draußen: Dafür hat es
    gereicht, ihr Konto zu löschen. Malik zieht den Zettel ab.

    Gut gemacht! Du hast das Kapitel „Das WLAN der Büros“ und die
    Geschichte „Der Bienenstock“ abgeschlossen.

    WAS PASSIERT IST
    Mit 802.1X entscheidet der Zugangspunkt nichts: Er fragt den
    RADIUS-Server (Access-Request), der das Konto prüft (hier im
    LDAP-Verzeichnis) und mit ja oder nein antwortet, mit Attributen:
    Tunnel-Type = VLAN, Tunnel-Medium-Type = IEEE-802 und
    Tunnel-Private-Group-Id = 10 stecken die Person in VLAN 10. Der
    Zugangspunkt muss eingetragen sein (clients.conf) und ein Geheimnis mit
    dem Server teilen.

    GUTE PRAXIS
    - Ein Konto pro Person: Wenn jemand geht, löscht man ein Konto, statt
      das Passwort aller zu ändern.
    - Um das Verzeichnis zu lesen, ein eigenes Dienstkonto, nur lesend,
      statt der Administration (und die Rechte von slapd passend dazu).
    - freeradius -XC vor dem Neustart, freeradius -X (Dienst gestoppt), um
      eine Ablehnung zu verstehen, radtest zum Testen.

    DOKUMENTATION
    - Das Modul ldap: https://wiki.freeradius.org/modules/Rlm_ldap
    - Die Datei users: https://wiki.freeradius.org/config/Users
    - VLAN über RADIUS (RFC 3580): https://www.rfc-editor.org/rfc/rfc3580
