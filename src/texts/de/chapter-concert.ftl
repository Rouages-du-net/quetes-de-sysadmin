### Geschichte „Die Nachbarschaftsbriefe“, Kapitel 6 „Konzertabend“:
### Logs mit awk lesen, die Rate mit nginx begrenzen. Befehle, Pfade,
### Direktiven und Log-Zeilen werden nicht übersetzt.

chapter-concert = Konzertabend
    .summary = Der Veranstaltungskalender bricht am Konzertabend zusammen: Logs mit awk lesen, die Rate mit nginx begrenzen (limit_req).

## Dateien

concert-message-kofi =
    Eine Nachricht von Kofi, geschickt um 20:02 Uhr:

    „Hilfe! Heute Abend ist ein Konzert im Café, und alle schauen im
    Kalender nach der Uhrzeit… der nicht mehr lädt. Die Leute bekommen
    einen 504-Fehler. Rania sagt, der Kalender schafft nur etwa zwanzig
    Seiten pro Sekunde, aber so viele Leute hatten wir noch nie!

    Könntest du in den nginx-Logs nachsehen, wer was anfragt, und dafür
    sorgen, dass die echten Besucher durchkommen? Rania hat eine Anleitung
    dagelassen (hilfe_logs.txt). Und keine schnelle Bastelei, die nur
    heute Abend funktioniert: eine Regel, die hält.“
concert-help-logs =
    LOG-ANLEITUNG — VON RANIA

    Jeder Besuch schreibt eine Zeile in /var/log/nginx/access.log (Format
    „combined“):

      adresse - - [datum] "GET pfad HTTP/1.1" code bytes "verweisende seite" "browser"
      $1          $4 $5    $6  $7   $8        $9   $10

    awk zerlegt jede Zeile in Felder ($1, $7, $9…). Ein paar Rezepte:
      awk '{"{"}print $9{"}"}' DATEI | sort | uniq -c         die Antwortcodes
      awk '{"{"}print $1{"}"}' DATEI | sort | uniq -c | sort -n die Adressen
      awk '$9 == 504 {"{"}print $7{"}"}' DATEI | head          was scheitert

    Um die Rate zu begrenzen, hat nginx limit_req (man nginx): eine Zone im
    http-Block (limit_req_zone), dann limit_req dort, wo du begrenzen
    willst. Schau nach jedem Neuladen auf die nächste Minute im Log.

## Ereignisse

# Nach jedem Neuladen von nginx: eine Minute Verkehr.
concert-minute =
    Eine Minute vergeht. Besucher: { $served } Anfragen bedient von { $humans }.
    Roboter: { $refused } Anfragen abgewiesen von { $robot }. Zeitüberschreitungen
    (504): { $exceeded }. (Die Einzelheiten stehen am Ende von access.log.)
concert-event-robot =
    Drei benachbarte Adressen (198.51.100.23, .24, .25), derselbe
    „Browser“ (AgendaScraper), Hunderte Kalenderseiten pro Minute: Das ist
    ein Roboter, der die Website absaugt. Allein fragt er mehr an, als der
    Kalender ausliefern kann. Echte Menschen dagegen fragen eine Seite und
    ihre vier Dateien an und lesen dann.
concert-event-forbidden =
    Die Adressen des Roboters zu sperren (deny) funktioniert… heute Abend.
    Kofi: „Rania sagt, diese Roboter wechseln jede Woche die Adresse. Wir
    werden keine Liste von Hand führen!“ Eine Ratenbegrenzung pro Adresse
    gälte für jeden Roboter, bekannt oder nicht.
concert-event-humans-limits =
    Die Begrenzung weist auch echte Menschen ab! Ein Browser fragt eine
    Seite und ihre Dateien (Stylesheet, Skript, Bilder) fast gleichzeitig
    an: fünf Anfragen in derselben Sekunde. Ohne Spielraum weist die
    Begrenzung sie ab. limit_req akzeptiert einen Burst, und nodelay
    bedient ihn sofort (man nginx).
concert-event-still-too =
    Die Begrenzung bremst den Roboter, aber er kommt noch zu oft durch, und
    der Kalender kann überlaufen (504). Die pro Adresse erlaubte Rate, mal
    der Zahl der Adressen des Roboters, muss deutlich unter dem bleiben,
    was der Kalender ausliefern kann (etwa zwanzig Seiten pro Sekunde). Und
    gilt die Begrenzung wirklich für /agenda/?
concert-event-end =
    Alle menschlichen Besuche kommen durch, der Roboter wird gebremst, und
    der Kalender kann atmen. Kofi: „Die Uhrzeit wird angezeigt! Das
    Konzert beginnt um 21 Uhr.“ Der Fehler, den der Roboter bekommt
    (429 Too Many Requests, oder 503), sagt ihm, dass er langsamer machen soll.

    Gut gemacht! Du hast Kapitel 6 von „Die Nachbarschaftsbriefe“ abgeschlossen.

    WAS PASSIERT IST
    Ein Roboter fragte den Kalender dreimal schneller an, als dieser
    antworten konnte; die menschlichen Besuche warteten hinter ihm, bis
    zur Zeitüberschreitung von nginx (504). Die Zugriffslogs, gelesen mit
    awk, sort und uniq -c, zeigten, wer was anfragte.

    GUTE PRAXIS
    - Die Logs lesen, bevor man handelt: Antwortcodes, Adressen, Pfade
      (awk '{"{"}print $9{"}"}' | sort | uniq -c).
    - Die Rate pro Adresse begrenzen (limit_req_zone $binary_remote_addr),
      dort, wo es teuer ist (die App), nicht unbedingt überall.
    - Einen Burst erlauben (burst=10 nodelay): Eine Seite bedeutet mehrere
      Anfragen auf einmal.
    - limit_req_status 429 sagt dem Roboter klar, dass er langsamer machen soll.
    - Eine Adresse zu sperren (deny) ist eine Notlösung; eine Ratenregel
      hält auf Dauer.

    DOKUMENTATION
    - limit_req: https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
    - Das Format des Zugriffslogs: https://nginx.org/en/docs/http/ngx_http_log_module.html
    - awk (POSIX): https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html
