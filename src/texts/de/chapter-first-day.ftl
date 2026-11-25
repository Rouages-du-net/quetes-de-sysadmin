### Geschichte „Das Rechenzentrum“, Kapitel „Erster Tag“: erster Tag des
### Praktikums, die Website der Mediathek ist down. Ein nginx-Log lesen,
### Befehle mit | verketten, mit > und >> schreiben, einen Prozess
### stoppen, mit sudo tee in eine Datei von root schreiben.
### Befehle, Pfade und IP-Adressen werden nicht übersetzt.

chapter-first-day = Erster Tag
    .summary = Ein Server-Log lesen, Befehle mit | verketten, mit > und >> schreiben, einen Prozess stoppen.

## Dateien

first-day-email-awa =
    Von:     Awa (Leiterin des Betriebs)
    An:      dich, Praktikum
    Betreff: Willkommen… und es ist dringend!

    Willkommen im Team! Dein Timing ist perfekt: Seit 20:25 Uhr antwortet
    die Website der Mediathek mit 503-Fehlern („Service Unavailable“).

    Ich hänge in einer Besprechung fest. Kannst du nachforschen? Das Log
    des Webservers liegt hier:

      /var/log/nginx/access.log

    Jede Zeile ist ein Besuch: die IP-Adresse der Person, das Datum, die
    angeforderte Seite, dann der Antwortcode (200 = OK, 503 = down).

    1. Wie viele 503-Fehler stehen im Log?
    2. Wer schickt so viele Anfragen?
    3. Bring die Website wieder zum Laufen und schreib mir dann einen kurzen
       Bericht in ~/bericht.txt: die Zahl der 503-Fehler und die Adresse des
       Übeltäters.

    Das Log hat Hunderte von Zeilen: Zähl sie nicht von Hand! Lies zuerst
    meine Notizen, die Befehle, die du brauchst, stehen darin:

      cat notes_awa.txt

    Dein vorläufiges Passwort (für sudo): willkommen-2026
    Ändere es bald, und schreib es nirgendwo auf!
first-day-notes-awa =
    AWAS NOTIZEN — BEFEHLE FÜR JEDEN TAG

      head datei          der Anfang (10 Zeilen)     tail datei     das Ende
      tail -f datei       das Ende, dann die neuen Zeilen, live, sobald sie kommen (Strg-C zum Stoppen)
      wc -l datei         zählt die Zeilen
      grep muster datei   die Zeilen, die das Muster enthalten

    Die wahre Stärke von Unix: die PIPE |. Die Ausgabe eines Befehls wird
    zur Eingabe des nächsten. Zum Beispiel:

      grep " 503 " access.log | wc -l     zählt die Zeilen mit „503“

    (die Anführungszeichen behalten die Leerzeichen: Wir suchen „503“ mit
    Leerzeichen drumherum, damit wir keine 503 erwischen, die in einer
    Adresse oder einer Größe steckt).

    Um herauszufinden, wer die meisten Anfragen stellt:

      cut -d " " -f 1 datei       behält das 1. Feld jeder Zeile (die IP)
      sort                        sortiert die Zeilen
      uniq -c                     zählt gleiche aufeinanderfolgende Zeilen
      sort -n                     sortiert nach Zahl
      tail -3                     behält die letzten 3 (die größten)

    Verkette sie alle mit | . Probier's aus!

    In eine Datei schreiben:
      befehl > datei         ÜBERSCHREIBT die Datei mit dem Ergebnis
      befehl >> datei        HÄNGT das Ergebnis ans Ende AN

    sudo vergessen? Kein Grund, alles neu zu tippen: sudo !! führt den
    letzten Befehl noch einmal aus, mit sudo davor. Und history zeigt alles,
    was du getippt hast.

    Der Webserver (nginx) sperrt die Adressen, die in
    /etc/nginx/blocked.conf stehen, im Format: deny ADRESSE;
    Diese Datei gehört root. Nach einer Änderung musst du nginx bitten,
    sie neu zu laden: sudo systemctl reload nginx
# Kommentar oben in /etc/nginx/blocked.conf (nach „#“)
first-day-blocked-comment = Von nginx gesperrte Adressen (eine Regel pro Zeile)
# Beschreibung des Dienstes, angezeigt von „systemctl status catalogue“
first-day-service-catalogue = Online-Katalog der Mediathek (php-fpm)

## Dienst von systemd nach kill neu gestartet ({ $pid }: Nummer des neuen Prozesses)

first-day-restart-calm = systemd startet den Dienst catalogue neu: neuer Prozess { $pid }. Da der Roboter gesperrt ist, bleibt er ruhig.
first-day-restart-robot = systemd startet den Dienst catalogue sofort neu: neuer Prozess { $pid }… und der Roboter legt wieder los. Er ist schon bei 99 %!

## Ereignisse ({ $robot }: die IP-Adresse des Roboters; { $blocked }: Pfad von blocked.conf)

# Schubser, wenn die Person einen zu langen Weg einschlägt (ohne den Befehl zu verraten).
first-day-event-all-read =
    Das sind viele Zeilen! Sie von Hand zu zählen würde ewig dauern, und du
    würdest dich verzählen. Ein Sysadmin lässt die Maschine zählen: In
    ~/notes_awa.txt hat Awa ein Werkzeug notiert, das nur die Zeilen
    behält, die dich interessieren, und ein anderes, das Zeilen zählt.
first-day-event-grep-only =
    Gut gesehen: grep hat nur die Zeilen mit 503-Fehlern behalten. Aber das
    ist immer noch viel zu zählen. Was, wenn die Ausgabe von grep direkt in
    einen Befehl ginge, der Zeilen zählt? Schau dir die Pipe | in
    ~/notes_awa.txt an.
first-day-event-addresses-only =
    Eine Adresse pro Zeile… unmöglich zu sehen, welche am häufigsten
    vorkommt. Sortiere sie, damit gleiche aufeinanderfolgen, und zähl dann
    die Doppelten: Awas Notizen verketten dafür vier kleine Befehle.

# { $errors }: Zahl der 503-Fehler im Log
first-day-event-account =
    Richtig: { $errors } 503-Fehler. Du hast gerade zwei kleine Werkzeuge
    verkettet: grep filtert die Zeilen, wc zählt sie. Das ist die ganze
    Unix-Philosophie: einfache Werkzeuge, die man ineinandersteckt.

    Nächste Frage: Wer schickt so viele Anfragen? (siehe ~/notes_awa.txt)
# { $requests }: Zahl der Anfragen des Roboters
first-day-event-robot =
    { $robot }: { $requests } Anfragen in wenigen Minuten, alle an
    /catalogue/suche. Das ist kein Mensch: Es ist ein Roboter, der den
    Katalog absaugt, und der Dienst „catalogue“ kommt nicht mehr hinterher.

    Schau, was auf der Maschine passiert:  ps aux
first-day-event-override =
    Der Prozess 4242 (php-fpm: pool catalogue) braucht 99 % der CPU.
    Du könntest ihn mit kill stoppen… aber wenn der Roboter weitermacht,
    bricht er sofort wieder zusammen. Sperr zuerst den Roboter in
    /etc/nginx/blocked.conf.

    Diese Datei gehört root, und  sudo echo … >> datei  funktioniert nicht:
    Die Umleitung >> macht DEINE Shell, nicht sudo. Der klassische Trick
    ist tee, das alles, was es bekommt, in eine Datei schreibt:

      echo "deny { $robot };" | sudo tee -a { $blocked }
first-day-event-overwritten =
    Hoppla! Die alten Regeln in blocked.conf sind weg: Die Datei wurde
    ÜBERSCHRIEBEN (> oder tee ohne -a), statt ergänzt zu werden (>> oder
    tee -a). Keine Panik: Es gibt eine Sicherungskopie. Stell sie wieder her
    mit sudo cp /etc/nginx/blocked.conf.bak { $blocked } und versuch es
    dann noch einmal mit -a.
first-day-event-rule = Die Regel steht drin. Aber nginx liest seine Datei nicht von selbst neu: sudo systemctl reload nginx
first-day-event-blocked =
    nginx hat seine Konfiguration neu geladen: { $robot } bekommt jetzt
    „403 Forbidden“ statt Seiten.
# Variante, wenn der überlastete Prozess noch läuft ({ $pid }: seine Nummer)
first-day-event-blocked-process =
    nginx hat seine Konfiguration neu geladen: { $robot } bekommt jetzt
    „403 Forbidden“ statt Seiten. Bleibt noch der Prozess { $pid }, der bei
    99 % festhängt: Stopp ihn (er gehört www-data, also… sudo). systemd
    startet ihn sauber neu.
first-day-event-repaired =
    Die Website der Mediathek antwortet wieder! Eine letzte Sache: der
    Bericht für Awa, in ~/bericht.txt. Mit > legst du die Datei an, mit >>
    hängst du eine Zeile an. Zum Beispiel:

      grep " 503 " /var/log/nginx/access.log | wc -l > ~/bericht.txt
      echo "Verursacher: { $robot }" >> ~/bericht.txt
first-day-event-report =
    Awa kommt aus ihrer Besprechung und liest deinen Bericht: „{ $errors }
    Fehler, Roboter erkannt, gesperrt, Dienst neu gestartet. Für einen
    ersten Tag… gut gemacht!“

    ENDE DES KAPITELS „ERSTER TAG“.

    Du kannst jetzt ein Log lesen (head, tail, grep), zählen und sortieren
    (wc, cut, sort, uniq), Werkzeuge mit | verketten, in eine Datei
    schreiben (> überschreibt, >> hängt an) und Prozesse und Dienste
    verwalten (ps, kill, systemctl). Das sind die alltäglichen Handgriffe
    der Leute, die die Server des Internets am Laufen halten.
