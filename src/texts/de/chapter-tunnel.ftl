### Geschichte „Das Bürgerhaus“, Kapitel „Der Tunnel“: einen Dienst
### erreichen, der nur auf 127.0.0.1 einer internen Maschine lauscht
### (ssh -L). Befehle, Optionen, Pfade und die Meldungen von OpenSSH und
### curl (auf Englisch) werden nicht übersetzt.

chapter-tunnel = Der Tunnel
    .summary = Die Verwaltung des Wikis lauscht nur auf 127.0.0.1: ein Tunnel ssh -L, curl, dann den Tunnel schließen.

## Dateien

tunnel-email-yasmine =
    Von:      Yasmine
    An:       dich
    Betreff:  Wartende Anmeldungen

    Drei Anmeldungen warten im Wiki auf Freigabe. Da ist die von Samir
    (die Fahrradwerkstatt) und die von Léa (der Chor). Die dritte ist
    sicher Werbung: Die bloß nicht freigeben.

    Das Problem: Die Admin-Seite des Wikis ist nicht im Internet. Gaspard
    hat das absichtlich so gemacht, sie lauscht nur auf 127.0.0.1, Port
    8080, DES WIKIS. Auf dem Wiki gibt es keinen Browser (nicht einmal
    curl): Er hat sie von seinem Rechner aus geöffnet, mit einem
    ssh-„Tunnel“ (man ssh, Option -L; und -f -N, damit er ohne Sitzung
    offen bleibt).

    Auf der Seite hat jede Anmeldung ihre eigene Adresse, um sie
    freizugeben oder abzulehnen.

    Und wenn du fertig bist, schließ den Tunnel: Ein Port auf deinem
    Rechner, der in unser internes Netz führt, sollte nicht herumliegen.

tunnel-note-gaspard =
    Notiz von Gaspard (Juni 2021)

    Die Admin-Oberfläche des Wikis läuft hier (Dienst wiki-admin, Port
    8080). Sie lauscht nur auf 127.0.0.1: Niemand kann sie von außen
    erreichen, nicht einmal von buergerhaus aus. Zum Prüfen:

      ss -tln
      systemctl status wiki-admin

## Die Admin-Seite (vom Wiki ausgeliefert)

# { $lines }: eine Zeile pro Anmeldung (tunnel-admin-line)
tunnel-admin-page =
    Wiki des Bürgerhauses — Verwaltung

    Anmeldungen:
    { $lines }

    Freigeben:   /admin/freigeben/<konto>
    Ablehnen:    /admin/ablehnen/<konto>
# { $name }: das Konto; { $state }: pending, approved oder refused
tunnel-admin-line = { $state ->
        [approved] - { $name }: freigegeben
        [refused] - { $name }: abgelehnt
       *[pending] - { $name }: wartet
    }
tunnel-admin-approve = Anmeldung von { $name } freigegeben.
tunnel-admin-reject = Anmeldung von { $name } abgelehnt.
tunnel-admin-not-found = Seite nicht gefunden.

## Ereignisse

# { $account }: das Werbekonto
tunnel-event-advert =
    Hoppla: Das Konto { $account } ist freigegeben. Yasmine: „Das wird das
    Wiki mit Werbung füllen!“ Lehn es ab (die Adresse steht auf der
    Admin-Seite).
tunnel-event-approved =
    Samir und Léa sind angemeldet, und die Werbung bleibt draußen.

    Bleibt nur noch, den Tunnel zu schließen: Er läuft im Hintergrund auf
    deinem Rechner. Finde seinen Prozess (ps) und stopp ihn dann (kill).
tunnel-event-end =
    Anmeldungen freigegeben, Tunnel geschlossen. Yasmine: „Samir hat schon
    die Seite der Fahrradwerkstatt angelegt!“

    Gut gemacht! Du hast das Kapitel „Der Tunnel“ abgeschlossen.

    WAS PASSIERT IST
    Mit ssh -L 8080:localhost:8080 wiki öffnet ssh Port 8080 auf deinem
    Rechner. Alles, was hineingeht, reist verschlüsselt in der
    ssh-Verbindung und kommt auf der Seite des Wikis in Richtung
    „localhost:8080“ heraus. Dieses localhost ist aus Sicht des WIKIS
    gemeint: seine eigene Adresse 127.0.0.1, auf der die Admin-Oberfläche
    lauscht. Der Dienst war nie dem Internet ausgesetzt; nur ssh war es.

    GUTE PRAXIS
    - Admin-Oberflächen auf 127.0.0.1 lassen und sie über einen ssh-Tunnel
      erreichen, statt einen weiteren Port in der Firewall zu öffnen.
    - Der Name in -L wird von der Maschine am anderen Ende aufgelöst: -L
      8080:localhost:8080 buergerhaus führt zu buergerhaus, nicht zum Wiki.
    - -f -N: ein Tunnel ohne Sitzung; denk daran, ihn zu schließen (ps,
      kill), oder lass ihn im Vordergrund und stopp ihn mit Strg+C.

    DOKUMENTATION
    - ssh, Option -L: https://man.openbsd.org/ssh#L
    - ssh, Optionen -f und -N: https://man.openbsd.org/ssh#f
