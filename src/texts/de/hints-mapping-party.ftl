### Abgestufte Hinweise für „Die Mapping-Party“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Der erste Plan

hint-first-plan-initialised =
    .lead = Der Code lebt in /srv/dns. Eine frische Kopie muss einmal initialisiert werden, bevor OpenTofu sie benutzen kann: Das installiert den Provider (man tofu, Yusras Notizen).
    .solution = cd /srv/dns; tofu init
hint-first-plan-formatted =
    .lead = Andiles Block ist schlecht eingerückt. OpenTofu hat einen eigenen Formatierer für das ganze Verzeichnis.
    .solution = tofu fmt (es listet die Dateien, die es neu geschrieben hat)
hint-first-plan-valid =
    .lead = Prüf die Konfiguration gegen das Schema des Providers, bevor du planst; lies bei jedem Fehler die Datei, die Zeile und den Vorschlag.
    .solution = tofu validate, dann nano records.tf: adresses → addresses; noch einmal tofu validate
hint-first-plan-planned =
    .lead = Der Plan bleibt bei einer Variable ohne Wert stehen. Wo leben die Werte dieser Konfiguration? Dann lies, was OpenTofu tun würde.
    .solution = tiles_address = "192.0.2.180" zu terraform.tfvars hinzufügen; tofu plan
hint-first-plan-applied =
    .lead = Wende den Plan an, und beantworte seine Frage erst, nachdem du die Zusammenfassungszeile gelesen hast.
    .solution = tofu apply, dann yes
hint-first-plan-checked =
    .lead = Frag den DNS-Server selbst, was er für den neuen Namen antwortet (man dig).
    .solution = dig @127.0.0.1 tiles.wayfinders.example
hint-first-plan-end =
    .lead = Prüfe jeden Teil: der Eintrag ausgeliefert, im State verwaltet, die Dateien formatiert, der Wert in einer Datei aufbewahrt.
    .solution = tofu plan (No changes), tofu fmt -check, dig tiles.wayfinders.example

## Kapitel 2 — Drift

hint-drift-locked =
    .lead = Fang dort an, wo Andile aufgehört hat: Frag OpenTofu, was es ändern würde, und lies, warum es ablehnt.
    .solution = cd /srv/dns; tofu plan (lies Lock Info: wer, welche Operation, seit wann)
hint-drift-freed =
    .lead = Die Sperre eines lokalen States gehört dem Prozess, der sie genommen hat. Läuft dieser Prozess noch? (man ps, man kill)
    .solution = ps aux | grep tofu, dann sudo kill 23817 (Femis tofu apply)
hint-drift-drift =
    .lead = Jetzt plane, und lies beide Teile: was sich außerhalb von OpenTofu geändert hat, und was das Anwenden des Codes daraus machen würde.
    .solution = tofu plan (Objects have changed outside of OpenTofu: www)
hint-drift-code =
    .lead = Welche Seite ist wahr, der Code oder der Server? Andiles Nachricht sagt es. Lass records.tf sagen, was wahr ist, dann plane noch einmal.
    .solution = nano records.tf: addresses = ["198.51.100.41"] für www (ttl 60, oder 300 mit einem Ersetzen); tofu plan; tofu apply
hint-drift-imported =
    .lead = status existiert in named, aber weder im Code noch im State. Beschreib es in records.tf, dann übernimm den vorhandenen Eintrag (man tofu: import).
    .solution = ein Block resource "dns_a_record_set" "status" (zone, name = "status", addresses = ["198.51.100.42"], ttl = 300), dann tofu import dns_a_record_set.status status.wayfinders.example.
hint-drift-end =
    .lead = Die Arbeit ist getan, wenn OpenTofu nichts mehr zu tun findet.
    .solution = tofu plan: No changes. Your infrastructure matches the configuration.
