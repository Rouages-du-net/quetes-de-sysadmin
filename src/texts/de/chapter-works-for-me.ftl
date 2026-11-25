### Geschichte „Die Nachbarschaftsbriefe“, Kapitel 5 „Bei mir geht's“:
### DNS (BIND). Befehle, Pfade, Domainnamen, Zonendateien und die
### Meldungen von dig, named und rndc werden nicht übersetzt.

chapter-works-for-me = Bei mir geht's
    .summary = Die Website des Cafés funktioniert nur bei Kofi: DNS, BIND-Zone, Seriennummer, TTL.

## Dateien

works-for-me-email-kofi =
    Von:     Kofi (Verein Die Nachbarschaftsbriefe)
    An:      dich
    Betreff: Bei mir geht's!

    Ich verstehe es nicht. Die Website des Cafés funktioniert auf meinem
    Rechner einwandfrei, aber die Gäste des Cafés sagen, sie landen auf
    einer Fehlerseite des alten Hosters. Und www.cafe.example funktioniert
    nirgends, nicht einmal auf meinem Rechner.

    Dabei habe ich den Namen doch auf unseren Server „zeigen lassen“: Ich
    habe diese Zeile in /etc/hosts eingetragen, auf meinem Rechner:

      203.0.113.10   cafe.example

    Rania sagt, so macht man das nicht, und unser Server sei für die Zone
    cafe.example autoritativ (BIND, der Dienst named). Die Registry hat
    eine Kopie davon, auf ns2.registry.example.

    Kannst du mal schauen? Rania hat Hilfe in hilfe_dns.txt dagelassen.
    Für sudo: ameisen-2026
works-for-me-help-dns =
    DNS-HILFE — VON RANIA

    /etc/hosts ändert nur den Rechner, auf dem es liegt: Das ist eine
    „selbstgebastelte“ Antwort, die sonst niemand sieht.

    Das echte DNS, für unsere Domains:
      /etc/bind/named.conf.local      die Liste unserer Zonen
      /etc/bind/zones/db.NAME         eine Zone pro Datei
    Unsere Zone letters.example ist ein gutes Vorbild.

    Wer antwortet was?
      dig cafe.example                        der öffentliche Resolver (9.9.9.9)
      dig @localhost cafe.example             unser Server (ns1)
      dig @ns2.registry.example cafe.example  die Kopie der Registry (ns2)

    Nach einer Änderung: named-checkzone, dann rndc reload.
    Alles andere: man dig, man named-checkzone, man rndc.

## Ereignisse

# { $hours }: die verbleibende Zeit, bis der Resolver die alte Adresse vergisst
works-for-me-event-cache =
    Unser Server liefert die neue Adresse… aber der öffentliche Resolver
    antwortet noch mit der alten. Schau auf die Zahl vor IN: Das ist die
    verbleibende TTL. Der Resolver hat die Antwort von gestern in seinem
    Cache behalten und wird sie noch { $hours ->
        [one] etwa eine Stunde
       *[other] etwa { $hours } Stunden
    } behalten, wie jeder Resolver der Welt, der danach gefragt hat. Das
    nennt man fälschlich „Propagation“: Nichts verbreitet sich, Caches
    laufen ab. Leeren kannst du sie nicht; du kannst nur vorausplanen
    (eine kurze TTL vor einer Änderung). Prüfe in der Zwischenzeit direkt
    bei den beiden autoritativen Servern.
works-for-me-event-error-zone =
    named lehnt die Zone ab und behält die alte Version: Die Website geht
    nicht kaputt, aber nichts hat sich geändert. journalctl -u named sagt
    dir, warum; named-checkzone sagt es dir vor dem Neuladen.
works-for-me-event-serial =
    ns1 (unser Server) und ns2 (die Kopie der Registry) geben nicht mehr
    dieselbe Antwort: ns2 hat die Zone nicht kopiert. Ein sekundärer Server
    kopiert eine Zone nur, wenn ihre Seriennummer (die serial des SOA)
    gestiegen ist. journalctl -u named meldet es. Die übliche Gewohnheit:
    JJJJMMTTnn, das heutige Datum und eine Änderungsnummer.
works-for-me-event-point-final =
    Vorsicht: In einer Zone wird ein Name ohne Punkt am Ende um den
    Zonennamen ergänzt. cafe.example (ohne Punkt) wird zu
    cafe.example.cafe.example.: dig @localhost www.cafe.example zeigt es.
    Für einen vollständigen Namen: cafe.example. mit dem Punkt.
works-for-me-event-end =
    ns1 und ns2 geben dieselbe Antwort: cafe.example und www.cafe.example
    führen zum Server der Briefe. Die Resolver ziehen nach, spätestens wenn
    ihr Cache abläuft. Kofi löscht die Zeile aus seinem /etc/hosts:
    „So sehe ich, was alle sehen!“

    Gut gemacht! Du hast Kapitel 5 von „Die Nachbarschaftsbriefe“
    abgeschlossen. (Wie es weitergeht: Konzertabend.)

    WAS PASSIERT IST
    /etc/hosts gilt nur für die Maschine, auf der es liegt: Auf Kofis
    Rechner führte der Name zum richtigen Server; überall sonst gab DNS
    noch die alte Adresse. Die Zone cafe.example auf unserem Server war
    nie geändert worden, und für www gab es keinen Eintrag.

    GUTE PRAXIS
    - Immer wie alle anderen testen: dig, ohne „selbstgebasteltes“ /etc/hosts.
    - Die autoritativen Server fragen (dig @ns1, dig @ns2), um zu wissen,
      was veröffentlicht ist; der Resolver sagt dir nur, was er im Cache hat.
    - Die serial des SOA bei jeder Änderung erhöhen, sonst behalten die
      sekundären Server die alte Zone.
    - named-checkzone vor rndc reload; journalctl -u named danach.
    - Ein vollständiger Name endet in einer Zonendatei mit einem Punkt.
    - Vor einem Umzug die TTL einen Tag vorher senken (zum Beispiel auf
      300 Sekunden): Die Caches vergessen die alte Adresse dann schnell.

    DOKUMENTATION
    - BIND-Zonendateien: https://bind9.readthedocs.io/en/stable/chapter3.html
    - dig, named-checkzone, rndc: https://bind9.readthedocs.io/en/stable/manpages.html
    - DNS, seine Namen und sein Cache (RFC 1034): https://www.rfc-editor.org/rfc/rfc1034
