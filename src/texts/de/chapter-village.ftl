### Der Radierer, Kapitel 2 — Das Dorf. Suchen, erstellen, kopieren, löschen:
### grep, touch, cp, mkdir, rm. Die Aushänge im Rathaus liest grep Zeile für
### Zeile: ein Satz pro Zeile. Die Kreatur heißt „der Radierer“ (die Hinweise
### schlagen „grep Radierer“ vor). Die Namen der Orte und Dateien (Kai,
### Baeckerei, sauerteig, zahnrad…) stammen aus names.ftl.

chapter-village = Das Dorf
    .summary = Suchen, erstellen, kopieren, löschen: grep, touch, cp, mkdir, rm.
village-crier =
    Das Boot von Kapitänin Ana setzt dich am Kai eines Dorfes ab. Ein
    Ausrufer schwenkt seine Glocke.

    „Hört, hört! Der Radierer ist durch das Dorf gekommen! Die Bäckerei hat
    keinen Sauerteig mehr, die Uhr ist stehen geblieben, die Schule hat kein
    Klassenzimmer, und die kleine Nour ist verschwunden! Wer hilft uns?“

    Er reicht dir eine Schriftrolle:  cat schriftrolle_der_zauber.txt
village-scroll-spells =
    DIE SCHRIFTROLLE DER ZAUBER — fünf neue Befehle

      grep muster datei     findet die Zeilen, die ein Muster enthalten
      touch name            erstellt ein Objekt (eine leere Datei)
      cp quelle ziel        kopiert ein Objekt (copy)
      mkdir Name            erstellt einen Ort (make directory)
      rm objekt             löscht ein Objekt (remove) — für immer!

    Zur Erinnerung: „man grep“ (oder man cp, man rm…) gibt die Anleitung, und
    „grep --help“ eine Kurzübersicht. Vergessen, welcher Befehl kopiert?
    „man -k kopiert“ durchsucht alle Handbücher.

    Die Leute im Dorf brauchen dich: die Bäckerei (Baeckerei), die Werkstatt,
    die Schule, das Rathaus… Fang an, wo du willst.
village-stallholder =
    „Nichts mehr zu verkaufen, der Radierer hat alles mitgenommen! Na ja,
    fast: Schau dir meine Stände an.“

    Sie senkt die Stimme: „Ein Rat. Bevor du etwas mit rm löschst, denk gut
    nach. rm legt nichts in einen Papierkorb: Was es löscht, ist für immer
    weg. Unser Mülleimer im Königreich (Muelleimer) ist nur ein Verzeichnis,
    in das alle werfen, was sie loswerden wollen; der Radierer ist es, der
    ihn leert, mit rm, rm, rm, ohne sich je umzudrehen.“
village-apple = Ein leicht schrumpeliger Apfel.
village-apple-2 = Noch ein Apfel, genauso schrumpelig.
village-cheese = Ein Laib sehr stark riechender Käse. „Das einzige Produkt, das der Radierer nicht anrühren wollte“, sagt die Händlerin.
village-cheese-protected-rm = „Finger weg von meinem letzten Käse!“, protestiert die Händlerin.
village-baker =
    Der Bäcker starrt in seinen leeren Backtrog.

    „Der Radierer hat alles mitgenommen. Ich habe nur noch einen Sauerteig,
    und ich brauche drei für die drei Backgänge am Morgen. Ach, wenn ich
    doch drei hätte!“

    (cp sauerteig sauerteig_2 erstellt eine Kopie des Sauerteigs.)
village-sourdough = Ein Glas Sauerteig, das leise blubbert. Er lebt, er frisst… und er lässt sich kopieren.
village-sourdough-protected-rm = „Nicht mein letzter Sauerteig!“, ruft der Bäcker.
village-craftswoman =
    Die Bastlerin wühlt in ihren leeren Schubladen.

    „Ach, Hilfe! Der Radierer hat alle meine Zahnräder ausradiert, und ohne
    sie dreht sich die Uhr des Dorfes nicht mehr. Weißt du, wie man ein
    Objekt herstellt? Es braucht nur einen Befehl:

      touch zahnrad

    Dann bräuchte ich insgesamt fünf. Herstellen dauert lange… Kopieren
    geht schnell.“
village-teacher =
    Der Lehrer hält Unterricht… auf dem Schulhof, mangels Raum.

    „Der Radierer hat unser Klassenzimmer ausradiert! Ein Klassenzimmer ist
    ein Ort. Weißt du, wie man einen baut?“

    (mkdir Name erstellt einen Ort.)
village-clerk =
    Der Schreiber versinkt unter Plakaten.

    „Seit der Radierer hier war, hat jeder Einwohner einen Aushang gemacht.
    Einer davon sagt, wohin er gegangen ist, aber welcher? Ich habe keine
    Zeit, alle zu lesen. Du auch nicht.

    Benutze grep: Es sucht ein Wort in Dateien und gibt die Zeilen aus, die
    es enthalten. Das Sternchen * bedeutet „alle Dateien hier“:

      grep Radierer *
village-notice-ball =
    AUSHANG: Der Tanz am Samstag findet statt.
    Bringt Papierlaternen mit.
village-notice-cat =
    VERMISST: roter Kater, hört auf den Namen Pixel.
    Belohnung: ein Käse.
village-notice-sewers =
    AUSHANG DER KANALARBEITER
    Wir haben gesehen, wie der Radierer in die Kanalisation hinabgestiegen ist, ganz hinten im Hof an der Gasse.
    Die kleine Nour ist ihm gefolgt. Die Ratten lassen niemanden durch.
    Der Schlüssel zum Archiv liegt unter der Fußmatte des Rathauses (ein verstecktes Objekt, natürlich).
village-notice-works =
    MARKT: donnerstags geöffnet.
    Käse, Äpfel, und das war's auch schon.
village-notice-clock =
    AUSHANG: Die Uhr ist stehen geblieben.
    Solange sie sich nicht dreht, bleibt das Tor der Gasse geschlossen.
village-doormat = Unter der Fußmatte ein kleiner Schlüssel. Du nimmst ihn.
village-doormat-read = Die Tür des Archivs ist offen.
village-archivist =
    Eine Archivarin arbeitet bei Kerzenlicht.

    „Du hast den Schlüssel gefunden! Dann kannst du mit grep umgehen. Ich
    studiere den Radierer seit Jahren. Es steht alles in der Chronik, aber
    sie ist lang. Such die Zeilen, die von ihm sprechen:

      grep Radierer chronik.txt

    Und wenn du nicht sicher bist, ob er großgeschrieben ist, füge -i hinzu:

      grep -i radierer chronik.txt
village-column =
    CHRONIK DES KÖNIGREICHS

    Jahr 1: Das Dorf wird am Meer gegründet.
    Jahr 12: Der Kai wird gebaut, mit Stein von der Insel.
    Jahr 40: Der Radierer wird an der Wurzel erschaffen, um den Mülleimer zu leeren.
    Jahr 41: Ein großer Brotbackgang für das Sauerteigfest.
    Jahr 77: Das Haus des Uhrmachers wird erweitert.
    Jahr 102: Der Radierer gehorcht nur noch einem Befehl: alles ausradieren.
    Jahr 103: Man sagt, nur wer ihn gestartet hat, kann ihn aufhalten.
    Jahr 104: Der Apfelmarkt fällt aus (es regnet).
    Jahr 130: Der Leuchtturm der Insel wird entzündet, um die Boote zu leiten.
    Jahr 131: Der Radierer lebt an der Wurzel, ganz unten, unter der Kanalisation des Dorfes.
    Jahr 133: Die Bäckerei gewinnt den regionalen Brotpreis.
    Jahr 136: Ein Sturm reißt das Vordach des Markts mit.
    Jahr 140: Die Kanalarbeiter hängen ein Vorhängeschloss an den Deckel der Kanalisation. Ihr Passwort: otter. Leg ein Objekt mit diesem Namen neben den Deckel, im Hof, und er geht auf.
    Jahr 145: Die Schule bekommt eine zweite Tafel.
    Jahr 150: Die Uhr wird zum ersten Mal repariert.
    Jahr 152: Das Archiv zieht unter das Rathaus.
    Jahr 160: Der Apfelmarkt findet statt (Sonnenschein).
village-archives-blocked = Die Tür des Archivs ist verschlossen. Die Plakate im Rathaus verraten dir vielleicht mehr.
village-barricade = Eine Barrikade aus Brettern, Fässern und kaputten Stühlen, in aller Eile errichtet. Viel zu schwer, um sie zu verschieben.
village-barricade-protected-mv = Du ziehst mit aller Kraft… nichts. Die Barrikade ist zu schwer für mv. Aber du kennst einen radikaleren Zauber.
village-wall = Ein gepflasterter Hof. Ganz hinten der Deckel der Kanalisation, mit einem Vorhängeschloss. Ein Schild: „Nur für Kanalarbeiter. Unser Passwort steht in der Chronik des Dorfs, im Archiv.“
village-rats =
    Ein Heer von Ratten versperrt den Weg.

    „Piep! Niemand kommt durch, ohne zu bezahlen. Wir wollen KÄSE, hier,
    sofort!“

    Am Markt gibt es Käse. Um einen hierher zu kopieren, ohne zurückzugehen,
    gib seinen vollständigen Pfad an und . (den Ort, an dem du bist) als Ziel:

      cp ~/Markt/kaese .
village-nour =
    Nour sitzt am Rand einer großen Rutsche, die ins Dunkel hinabführt.

    „Danke, dass du gekommen bist! Ich bin dem Radierer bis hierher gefolgt.
    Er ist diese Rutsche hinuntergerutscht, Richtung Wurzel, und hat dabei
    gemurmelt: „ausradieren, ausradieren, der Befehl der Wurzel…“ Dann
    haben mir die Ratten den Weg versperrt.“
village-manhole-blocked = Der Kanaldeckel ist mit einem Vorhängeschloss gesichert. Das Passwort der Kanalarbeiter steht in der Chronik des Dorfs, im Archiv. Sie ist lang: grep findet die Zeile, die du brauchst.
village-gallery-blocked = „Piep!“ Die Ratten versperren den Tunnel.
village-yard-blocked = Eine Barrikade versperrt den Eingang zum Hof.
village-alley-blocked = Das Tor der Gasse ist geschlossen. Es öffnet sich zu einer festen Uhrzeit… aber die Uhr des Dorfes ist stehen geblieben.
village-event-sourdough = „Drei Sauerteige!“ Der Bäcker kann es kaum glauben. „Eine Kopie ist ein neues Objekt, identisch mit dem Original. Danke!“
village-event-gear = „Ein Zahnrad! Perfekt. Nur noch vier… mit cp geht das schnell.“
village-event-gears = Tick, tack… Die Uhr des Dorfes dreht sich wieder! Beim ersten Mittagsschlag öffnet sich knarrend das Tor der Gasse.
village-event-class = An der Schule entsteht ein Klassenzimmer. Die Kinder stürmen hinein.
village-event-class-without-nour = An der Schule entsteht ein Klassenzimmer. Die Kinder stürmen hinein. „Nur eine Schülerin fehlt“, seufzt der Lehrer: „Nour.“
village-event-barricade =
    Puff! Die Barrikade verschwindet. Der Hof ist zugänglich.
    (rm geht über keinen Papierkorb: Sie kommt nie wieder.)
village-event-manhole = Klick! Das Schloss erkennt das Passwort: Der Deckel gleitet zur Seite. Die Kanalisation ist offen.
village-event-rats = Die Ratten stürzen sich auf den Käse und schleppen ihn in ein Loch. Der Tunnel ist frei.
village-event-nour-without-class = „Ich würde gern zurück“, sagt Nour, „aber der Radierer hat mein Klassenzimmer ausradiert. Kannst du es an der Schule wieder aufbauen?“ (mkdir)
village-event-nour =
    Nour läuft zu ihrem nagelneuen Klassenzimmer.

    Gut gemacht! Du hast Kapitel 2 abgeschlossen.

    Du kannst jetzt suchen (grep), erstellen (touch, mkdir), kopieren (cp) und
    löschen (rm) — mit Vorsicht, denn rm geht über keinen Papierkorb.

    Der Radierer versteckt sich an der Wurzel, unten an der Rutsche: Kapitel 3
    erwartet dich.
