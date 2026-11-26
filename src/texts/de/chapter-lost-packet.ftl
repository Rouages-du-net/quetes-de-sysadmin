### Geschichte „Das verlorene Paket“: „Das Internet geht nicht mehr“ im
### Nachbarschaftscafé. Eine Netzwerkstörung Schritt für Schritt
### diagnostizieren mit ping, dig, traceroute und curl. Befehle, Domainnamen
### und IP-Adressen werden nicht übersetzt; die Ausgabe der Netzwerkwerkzeuge
### bleibt auf Englisch, wie auf einem echten System.

chapter-lost-packet = Das verlorene Paket
    .summary = Finden, wo eine Nachricht verloren geht, Schicht für Schicht: ping, dig, traceroute, curl.

## Dateien

lost-packet-note-kofi =
    Eine Notiz von Kofi, ehrenamtlich im Ameisenhaufen, dem Nachbarschaftscafé:

    „Hilfe! Auf dem Rechner des Cafés geht das Internet nicht mehr. Die
    Website der Nachbarschaftsbriefe (letters.example) lässt sich nicht
    öffnen, und dort veröffentlichen wir das Programm der Woche.

    Den Router habe ich schon neu gestartet. Nichts. Kannst du mal
    schauen? Das Passwort dieses Rechners, falls du es brauchst: ameisenhaufen

    Neben dem Bildschirm liegt ein Notizbuch:  cat notizbuch.txt  “
lost-packet-notebook =
    FEHLERSUCHE-NOTIZBUCH — finden, wo das Paket verloren geht

    Schritt für Schritt testen, vom Nächsten zum Entferntesten:

      1. Antwortet mein Router?          ping 192.168.1.1
      2. Antwortet das Internet?         ping 9.9.9.9   (ein öffentlicher DNS-Server)
      3. Funktionieren die Namen?        ping letters.example
                                         dig letters.example
      4. Welchen Weg nehmen die Pakete?  traceroute letters.example
      5. Antwortet die Website?          curl -I https://letters.example

    DNS übersetzt einen Namen (letters.example) in eine IP-Adresse (Zahlen).
    Der Rechner weiß, welchen DNS-Server er fragen soll, dank der Datei
    /etc/resolv.conf (die Zeile „nameserver“).

    Die Netzwerkbefehle antworten auf Englisch, wie auf einem echten System:
    „packet loss“ = verlorene Pakete, „timed out“ = keine Antwort rechtzeitig.
# Kommentare in den Dateien /etc/resolv.conf und /etc/resolv.conf.box (nach „#“)
lost-packet-resolv-comment = Bei der Installation geschrieben, mit dem alten Router
lost-packet-resolv-box-comment = Vom neuen Router empfohlene Einstellung

## Die Seite der Website, von curl geliefert (HTML)

lost-packet-site-title = Die Nachbarschaftsbriefe
lost-packet-site-text = Die Website funktioniert! Schreib uns.

## Ereignisse ({ $ip }: die IP-Adresse der Website)

lost-packet-event-box =
    Der Router antwortet, in kaum einer Millisekunde: Das lokale Netz (das
    Kabel oder das WLAN bis zum Router) funktioniert. ping schickt eine
    kleine ICMP-„Echo“-Nachricht; die Maschine spielt den Ball zurück, und
    die Hin- und Rückreise wird gemessen.

    Jetzt weiter: ein Server im Internet,  ping 9.9.9.9
lost-packet-event-internet =
    9.9.9.9 antwortet: Die Pakete gehen ins Internet hinaus und kommen
    zurück. „Das Internet“ funktioniert also! Das Problem liegt woanders.
    Probier den Namen der Website: ping letters.example
lost-packet-event-name =
    „Temporary failure in name resolution“: Der Rechner kann den Namen
    nicht in eine IP-Adresse übersetzen. Das ist die Aufgabe von DNS. Stell
    ihm die Frage direkt: dig letters.example
lost-packet-event-dns-silent =
    Der DNS-Server 192.168.1.250 antwortet nicht: „timed out“. Woher kommt
    diese Adresse? Schau in cat /etc/resolv.conf

    Und um zu prüfen, ob der Name wirklich existiert, frag einen anderen
    DNS-Server: dig @9.9.9.9 letters.example
lost-packet-event-dns-other =
    Mit einem anderen DNS-Server kommt die Antwort: letters.example = { $ip }.
    Der Name existiert; falsch ist die Einstellung des Rechners: Er fragt
    192.168.1.250, die Adresse des ALTEN Routers, den es nicht mehr gibt.

    Die richtige Einstellung steht in /etc/resolv.conf.box. Diese Datei
    gehört root: sudo cp /etc/resolv.conf.box /etc/resolv.conf
lost-packet-event-dns-repaired = DNS ist repariert: Der Rechner fragt jetzt den neuen Router. Versuch es noch einmal:  ping letters.example
lost-packet-event-ping-lost =
    Der Name wird übersetzt ({ $ip })… aber 100 % der Pakete gehen verloren!
    Ist die Website down? Oder verirren sich die Pakete unterwegs?
    Folge ihrer Spur:  traceroute letters.example
lost-packet-event-route =
    Hier die Reise des Pakets, Hop für Hop:
     1. dein Router;
     2-3. die Router deines Providers (ISP);
     4. ein Austauschknoten, an dem sich Netze miteinander verbinden;
     5. der Router des Hosters der Website.
    Danach nichts mehr: „* * *“. Die Pakete kommen bis vor die Tür des
    Hosters. Viele Server ignorieren ping und traceroute absichtlich (ihre
    Firewall filtert sie): Diese Stille beweist keine Störung.

    Der einzig echte Test ist, die Seite anzufordern:  curl -I https://letters.example
lost-packet-event-curl =
    HTTP/2 200: Die Website antwortet einwandfrei! Kofi kann das Programm veröffentlichen.

    Zusammenfassung der Ermittlung: Das lokale Netz funktionierte (ping
    Router), das Internet auch (ping 9.9.9.9). Die Störung lag beim DNS:
    Der Rechner fragte einen alten Router, der nicht mehr da war. Nach der
    Reparatur des DNS scheiterte ping zur Website… aber nur, weil ihre
    Firewall ping ignoriert. curl hat es bewiesen.

    ENDE DER GESCHICHTE „DAS VERLORENE PAKET“.

    Die Methode, die du dir merken solltest: Schritt für Schritt testen,
    und keine voreiligen Schlüsse ziehen. „Keine Antwort auf ping“ heißt
    nicht „down“.
