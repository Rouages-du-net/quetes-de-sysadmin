### Der Radierer, Kapitel 1 — Die Leuchtturminsel. Sich zurechtfinden und
### bewegen: ls, cd, pwd, cat, less, mv, versteckte Dateien. Die Namen der
### Orte und Dateien (Huette, Steg, .ersatzbirne…) stammen aus names.ftl.

chapter-lighthouse = Die Leuchtturminsel
    .summary = Sich zurechtfinden und bewegen: ls, cd, pwd, cat, mv, versteckte Dateien.
lighthouse-welcome =
    Du wachst in der Hütte eines Fischers auf (Huette), auf einer kleinen
    Insel. Vor dir ein schwarzer Bildschirm und ein blinkender Cursor.

    In dieser Welt ist jeder ORT ein Verzeichnis und jedes OBJEKT eine Datei.
    Genau so organisiert Linux alles.

    Um dich umzusehen, tippe:             ls
    Um einen Ort zu betreten, tippe:      cd NameDesOrtes
    Um ein Objekt zu lesen, tippe:        cat dateiname

    Und wenn du vergisst, wie ein Befehl funktioniert, frag das Handbuch:
      man ls
    Das ist der erste Reflex aller, die Server betreiben: im Handbuch
    nachsehen, bevor man fragt.

    Fang damit an, die Nachricht zu lesen:  cat nachricht.txt
lighthouse-message =
    „Wenn du das liest, ist der Radierer auf die Insel gekommen.

    Eine Kreatur streift durch das Königreich und radiert alles aus, was
    sie berührt. Letzte Nacht hat sie die Birne des Leuchtturms ausradiert.
    Ohne Licht kann kein Boot in den Hafen einlaufen, und niemand kann die
    Insel verlassen, um das Dorf zu erreichen, wo Hilfe gebraucht wird.

    Steig zuerst zur Signalschule (SignalSchule) auf dem Hügel (Huegel)
    hinauf: Dort bringen sie dir die Befehle bei. Dann komm zu mir in den
    Leuchtturm, am Ende des Stegs.

                                  — Maëlle, Leuchtturmwärterin“
lighthouse-panel =
    „Kieselstrand.“

    Du kannst immer zurück: „..“ bedeutet den übergeordneten Ort.
    Versuch:  cd ..

    Und wenn du dich verläufst, sagt dir „pwd“ (print working directory),
    wo du bist.
lighthouse-ravaudeuse =
    Eine Frau flickt Netze neben einem alten ternären Computer.

    „Hallo und willkommen auf der Insel. Ich habe schon programmiert, bevor irgendwer
    ‚Software‘ sagte. Zwei Tipps:

      - die Tab-Taste vervollständigt Namen für dich: tippe „cat na“ und dann Tab;
      - die Pfeiltaste nach oben holt deine vorherigen Befehle zurück.

    Und hüte dich vor dem Radierer. Er zerstört nicht aus Bosheit: Er
    gehorcht einem Befehl, den ihm jemand vor langer Zeit gegeben hat.“
lighthouse-seashell = Eine perlmuttschimmernde Muschel. Wenn du sie ans Ohr hältst, hörst du… einen Serverlüfter.
lighthouse-wind = Der Wind bläst kräftig auf dem Hügel. Unten der Steg und der dunkle Leuchtturm.
lighthouse-headteacher =
    Die Leiterin der Signalschule empfängt dich zwischen zwei bunten
    Flaggen.

    „Willkommen! Du weißt schon, wie man schaut (ls), sich bewegt (cd) und
    liest (cat). Dir fehlt noch ein wesentlicher Befehl: mv (move), der ein
    Objekt verschiebt.

      mv objekt Ort

    Geh zum Üben in den Übungsraum (Uebungsraum). Die Lektionen sind für
    alle offen, und die Bibliothek bewahrt das Buch der Befehle auf.

    Und denk an das Motto der Schule: „Im Zweifel lies das Handbuch.“
    man mv sagt dir alles über mv.“
lighthouse-instructions =
    ÜBUNG: Eine Krabbe ist aus dem Aquarium entwischt. Setz sie zurück in
    den Eimer.

      mv krabbe Eimer

    Prüf es dann mit  ls  und  ls Eimer
lighthouse-crab = Eine kleine grüne Krabbe. Sie läuft seitwärts und wirkt sehr beschäftigt.
lighthouse-course-1-manual =
    LEKTION 1 — DAS HANDBUCH

    Jeder Befehl hat sein Handbuch. Tippe  man  gefolgt vom Namen des Befehls:

      man ls
      man mv

    Eine Handbuchseite hat immer dieselben Teile: BEZEICHNUNG (wofür er ist),
    ÜBERSICHT (wie man ihn schreibt; was in eckigen Klammern [ ] steht, ist
    optional), BESCHREIBUNG, OPTIONEN (die Buchstaben nach einem Strich, wie
    -a), BEISPIELE und SIEHE AUCH (verwandte Befehle).

    Zwei Abkürzungen:
      ls --help           eine schnelle Kurzübersicht des Befehls
      man -k versteckt    welche Befehle sprechen von „versteckt“?

    Auf einem echten Linux öffnet sich das Handbuch im Vollbild: Du blätterst
    mit den Pfeiltasten, suchst mit /wort und beendest mit q.
lighthouse-course-2-paths =
    LEKTION 2 — PFADE

    Ein Pfad sagt, wo ein Ort oder ein Objekt ist.

      {"."}.            der übergeordnete Ort (eine Ebene höher)
      {"."}             der Ort, an dem du bist
      ~             dein Zuhause
      /             die Wurzel, ganz oben

    Ein RELATIVER Pfad geht von dort aus, wo du bist:  cd Lektionen
    Ein ABSOLUTER Pfad geht von der Wurzel aus:        cd /Huette/Strand
    Du kannst Orte mit / verketten:                    cat ../schulleiterin.txt
    Und ~/ geht von deinem Zuhause aus:                ls ~/Hafen

    Versuch:  cd ~  dann  pwd
lighthouse-course-3-caches =
    LEKTION 3 — WAS MAN NICHT SIEHT

    Unter Linux ist eine Datei, deren Name mit einem Punkt beginnt,
    VERSTECKT: Ein einfaches „ls“ zeigt sie nicht. Das ist kein Schutz, nur
    eine Art, Einstellungen so aufzubewahren, dass sie nicht stören.

    Um alles zu sehen, hat ls eine Option. Welche? Das verrate ich nicht:
    Sie steht im Handbuch.  man ls

    In diesem Klassenraum gibt es eine versteckte Datei. Finde sie selbst.
lighthouse-note-secret =
    Gut entdeckt! Du hast eine versteckte Datei gefunden.

    Merk dir das: Auf einer Insel werden wertvolle Dinge sicher und außer
    Sichtweite aufbewahrt. Und Dinge, die außer Sichtweite liegen, bekommen
    oft einen Namen, der mit einem Punkt beginnt.
lighthouse-course-4-rename =
    LEKTION 4 — UMBENENNEN

    mv ist nicht nur zum Verschieben da: Wenn das Ziel kein bestehender Ort
    ist, BENENNT mv das Objekt UM.

      mv entwurf.txt brief.txt     (entwurf.txt heißt jetzt brief.txt)

    Du kannst sogar in einem Zug verschieben UND umbenennen, indem du den
    neuen Namen am Ende des Pfads angibst:

      mv entwurf.txt ~/Hafen/brief.txt

    Unter Linux sind Verschieben und Umbenennen dieselbe Operation: den
    Pfad einer Datei ändern.
lighthouse-book-commands =
    DAS BUCH DER BEFEHLE

      ls       listet, was hier ist (list); ls -a zeigt auch Verstecktes
      cd       wechselt den Ort (change directory)
      pwd      zeigt, wo du bist (print working directory)
      cat      zeigt den Inhalt einer Datei (concatenate)
      less     dasselbe, Seite für Seite (für lange Dateien)
      mv       verschiebt oder benennt um (move)
      man      das Handbuch eines Befehls, z. B.: man ls
      clear    leert den Bildschirm

    Diese Befehle gibt es seit den 1970er-Jahren: Sie stammen aus Unix, dem
    Vorfahren von Linux und macOS. Die Leute, die die Server des Internets
    betreiben, tippen sie jeden Tag.
lighthouse-captain =
    Kapitänin Ana läuft auf dem Kai auf und ab.

    „Mein Boot kann dich ins Dorf bringen. Aber ohne den Leuchtturm kommt
    nach Einbruch der Dunkelheit niemand an den Riffen vorbei. Bring ihn
    wieder zum Leuchten, dann legen wir ab!“
lighthouse-inventory = Das Bootshaus des Hafens: Ruder, Bojen, ein Anker. Es ist noch Platz.
lighthouse-label = Das Lager der Wärterin. Kisten mit Ersatzteilen… fast alle leer: Der Radierer war hier.
lighthouse-bulb-rescue = Eine große Leuchtturmbirne, sicher aufbewahrt. Ein Etikett sagt: „Für die Laterne.“
lighthouse-net = Ein riesiges, verheddertes Fischernetz, das die Tür des Leuchtturms versperrt. Es wäre besser im Bootshaus des Hafens aufgehoben.
lighthouse-hint =
    In einen Steinpfosten geritzt:

      „Was den Steg verstopft, gehört ins Bootshaus.
        ~ bringt dich immer nach Hause, wo der Weg zum Hafen beginnt.“

    (Versuch:  mv netz ~/Hafen/Bootshaus)
lighthouse-keeper =
    Maëlle, die Leuchtturmwärterin, wartet am Fuß der Treppe auf dich.

    „Da bist du ja! Die Laterne leuchtet nur mit einem Objekt, das genau
    birne heißt und in der Laterne liegt. Der Radierer hat unsere ausradiert.

    Ich habe noch eine Ersatzbirne, sicher im Lager des Hafens aufbewahrt.
    Mit einem einfachen ls siehst du sie nicht: Wie alles, was außer
    Sichtweite liegt, beginnt ihr Name mit einem Punkt. (Das Handbuch von ls
    sagt, wie man alles sieht.)

    Bring sie in die Laterne, unter ihrem richtigen Namen. mv kann
    verschieben und umbenennen: Sieh dir die BEISPIELE in man mv an.“
lighthouse-steps = Hundertzwanzig Stufen einer Wendeltreppe. Ganz oben die Laterne.
lighthouse-lantern =
    Die große Linse des Leuchtturms, ganz aus Glasringen. In der Mitte ist
    die Fassung leer. Auf einem Schild steht:

      „Birne — genauer Name: birne“
lighthouse-lighthouse-blocked = Ein riesiges verheddertes Netz versperrt die Tür des Leuchtturms. Es müsste woandershin verschoben werden (mv)…
lighthouse-event-crab = Die Krabbe ist zurück in ihrem Eimer. Die Schulleiterin applaudiert: Du kannst mit mv ein Objekt verschieben.
lighthouse-event-net = Das Netz ist weggeräumt. Die Tür des Leuchtturms ist frei.
lighthouse-event-bad-name = Die Birne ist zwar in der Laterne… aber die Fassung nimmt kein Objekt an, das nicht genau birne heißt. Benenne sie mit mv um.
lighthouse-event-light =
    Der Leuchtturm leuchtet! Ein Lichtstrahl streicht über das Meer, und im
    Hafen hisst Kapitänin Ana das Segel.

    Gut gemacht! Du hast Kapitel 1 abgeschlossen.

    Du kannst dich jetzt bewegen (cd, .., ~), schauen (ls, ls -a), lesen
    (cat, less), herausfinden, wo du bist (pwd), verschieben und umbenennen
    (mv). Das sind dieselben Befehle wie auf den echten Servern, die das
    Internet am Laufen halten.

    Das Boot bringt dich zu Kapitel 2, „Das Dorf“.
