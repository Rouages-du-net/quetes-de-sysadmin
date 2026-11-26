### Abgestufte Hinweise für „Der Radierer“ (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine Spur, ohne
### den genauen Befehl) und .solution (fast die Antwort). Ortsnamen wie in names.ftl.

## Kapitel 1 — Die Leuchtturminsel

hint-lighthouse-crab =
    .lead = Die Übung im Uebungsraum (in der SignalSchule, auf dem Huegel) bittet dich, die Krabbe wegzuräumen. Wegräumen heißt verschieben: Welcher Befehl verschiebt ein Objekt in einen Ort?
    .solution = Vom Uebungsraum aus: mv krabbe Eimer (dann ls Eimer zum Prüfen).
hint-lighthouse-net =
    .lead = Das Netz versperrt die Tür des Leuchtturms am Ende des Stegs. Verschieb es einfach woandershin, an einen Ort, der es aufbewahren kann.
    .solution = Von deinem Zuhause aus: mv Steg/netz Hafen/Bootshaus
hint-lighthouse-light =
    .lead = Die Laterne oben im Leuchtturm braucht eine Birne. Eine Ersatzbirne gibt es, aber sie ist versteckt: ls -a zeigt Dateien, deren Name mit einem Punkt beginnt. Und mv kann auch umbenennen.
    .solution = Von deinem Zuhause aus: mv Hafen/Lager/.ersatzbirne Steg/Leuchtturm/Treppe/Laterne/birne

## Kapitel 2 — Das Dorf

hint-village-sourdough =
    .lead = Der Bäcker will drei Sauerteige, ohne das Original zu verlieren. Eine Kopie ist ein neues, identisches Objekt.
    .solution = In der Baeckerei: cp sauerteig sauerteig_2, dann cp sauerteig sauerteig_3
hint-village-gear =
    .lead = Die Bastlerin in der Werkstatt braucht Zahnräder, und es gibt keine. touch erstellt eine leere Datei.
    .solution = In der Werkstatt: touch zahnrad
hint-village-gears =
    .lead = Insgesamt fünf, damit die Uhr wieder läuft: ein Original und Kopien.
    .solution = In der Werkstatt: cp zahnrad zahnrad_2, dann _3, _4 und _5.
hint-village-barricade =
    .lead = Eine Barrikade versperrt den Hof, in der Gasse. Zu schwer für mv. Was bleibt bei einem Objekt, das niemand mehr braucht?
    .solution = In der Gasse: rm barrikade (Vorsicht, rm geht über keinen Papierkorb: Sie ist für immer weg).
hint-village-manhole =
    .lead = Der Deckel der Kanalisation ist verschlossen. Sein Passwort steht in einer Zeile der Chronik im Archiv, einer langen Datei: grep findet darin ein Wort für dich.
    .solution = grep -i kanal ~/Rathaus/Archiv/chronik.txt, dann im Hof (Gasse/Hof): touch otter
hint-village-rats =
    .lead = Die Ratten in der Kanalisation bewachen den Tunnel. Was sie mögen, wird am Markt verkauft. Den Käse vom Markt kann man nicht löschen, aber kopieren.
    .solution = In der Kanalisation (Gasse/Hof/Kanalisation): cp ~/Markt/kaese .
hint-village-nour-without-class =
    .lead = Nour ist am Ende des Tunnels, hinter den Ratten. Lies, was sie zu sagen hat.
    .solution = cat ~/Gasse/Hof/Kanalisation/Tunnel/nour.txt
hint-village-class =
    .lead = Der Radierer hat das Klassenzimmer der Schule ausradiert. Ein Ort ist ein Verzeichnis: Welcher Befehl erstellt ein Verzeichnis?
    .solution = mkdir ~/Schule/Klassenzimmer
hint-village-nour =
    .lead = Ist das Klassenzimmer da? Geh zurück zu Nour: Sie wartet darauf, nach Hause zu gehen.
    .solution = cat ~/Gasse/Hof/Kanalisation/Tunnel/nour.txt

## Kapitel 3 — Die Wurzel

hint-root-alert =
    .lead = Fang damit an, die Ankunftsdatei in deinem Zuhause zu lesen.
    .solution = cat ankunft.txt
hint-root-protected =
    .lead = Der Radierer löscht deine Erinnerungen, weil er in diesem Verzeichnis schreiben darf. ls -l zeigt die Rechte: r, w und x, für dich, deine Gruppe und die anderen.
    .solution = chmod o-w erinnerungen (die anderen können nicht mehr im Verzeichnis schreiben)
hint-root-fixed =
    .lead = Die Konfiguration des Radierers zielt wegen eines Leerzeichens zu viel auf den falschen Ort. Eine korrigierte Fassung wartet auf dich, aber /etc gehört root: Du brauchst sudo, und sein Passwort versteckt sich in deinem Tagebuch (grep kann nach einem Wort suchen).
    .solution = grep "mein Passwort" tagebuch.txt, dann sudo cp ~/radierer.conf.korrigiert /etc/radierer.conf

## Kapitel 4 — Die Sicherung

hint-backup-copy =
    .lead = Kopiere deine Erinnerungen mit rsync auf die Backup-Platte. Achte auf den Schrägstrich am Ende: Damit kopiert rsync den INHALT des Verzeichnisses.
    .solution = rsync -av ~/erinnerungen/ /mnt/sicherung/erinnerungen/
hint-backup-end =
    .lead = Ein Backup muss sich jede Nacht erneuern: Das ist die Aufgabe von cron (crontab -e). Prüf dann am Morgen, dass du wiederherstellen kannst, was gelöscht wurde.
    .solution = In crontab -e: 15 3 * * * rsync -a ~/erinnerungen/ /mnt/sicherung/erinnerungen/ — dann am Morgen: rsync -av /mnt/sicherung/erinnerungen/erster-brief.txt ~/erinnerungen/
