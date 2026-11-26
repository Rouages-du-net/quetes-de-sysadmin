### Der Editor nano: Meldungen der Statuszeile und Beschriftungen der
### Oberfläche, nah an denen von GNU nano auf Deutsch. { $path }: voller Pfad
### der Datei; { $lines }: Zahl der Zeilen.

nano-usage = Aufruf: nano datei (z. B. nano notizen.txt; siehe man nano)
nano-directory = „{ $path }“ ist ein Verzeichnis
nano-new = [ Neue Datei ]
nano-lines-read =
    {"["} { $lines ->
        [one] { $lines } Zeile gelesen
       *[other] { $lines } Zeilen gelesen
    } ]
nano-lines-read-dos =
    {"["} { $lines ->
        [one] { $lines } Zeile gelesen (vom DOS-Format konvertiert)
       *[other] { $lines } Zeilen gelesen (vom DOS-Format konvertiert)
    } ]
nano-lines-written =
    {"["} { $lines ->
        [one] { $lines } Zeile geschrieben
       *[other] { $lines } Zeilen geschrieben
    } ]
nano-read-only = [ Datei „{ $path }“ ist nicht beschreibbar ]
nano-error-read = [ Fehler beim Lesen von { $path }: Keine Berechtigung ]
nano-error-write = [ Fehler beim Schreiben von { $path }: Keine Berechtigung ]
nano-error-directory = [ Fehler beim Schreiben von { $path }: Datei oder Verzeichnis nicht gefunden ]
nano-binary = [ { $path } ist eine Binärdatei ]

## Oberfläche des Editors

nano-modified = Verändert
# Die Kürzel: ^O = Strg+O, ^X = Strg+X, ^C = Strg+C
nano-write = Speichern
nano-quit = Beenden
nano-save = Veränderten Puffer speichern?
nano-yes = Ja
nano-yes-key = J
nano-not = Nein
nano-cancel = Abbrechen
nano-zone = Inhalt von { $path }
