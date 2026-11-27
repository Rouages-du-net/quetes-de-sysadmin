### Geschichte „Die Wache“, Kapitel „Die Priorität“: zwei CVEs ebenso nach
### Exposition wie nach CVSS-Wert ordnen. Die CVE-Kennungen sind erfunden;
### Paketnamen, Befehle und Pfade werden nicht übersetzt.

chapter-priority = Die Priorität
    .summary = Entscheiden, was zuerst behoben wird: Die Exposition zählt ebenso viel wie der CVSS-Wert.

## Dateien

priority-email-salome =
    Von:     Salomé
    An:      dich
    Betreff: Zwei CVEs, in welcher Reihenfolge?

    Gut sortiert. Bleiben zwei CVEs zu behandeln: nginx (Wert 8.2) und
    rsync (Wert 9.8). Wenn du beim Wert stehen bleibst, kommt rsync zuerst,
    es ist der höchste. Aber der Wert allein erzählt nicht die ganze
    Geschichte.

    Stell dir die Frage, die ich mir immer stelle: Wer kann diesen Dienst
    erreichen, und wie? Schau dir an, was auf diesem Server tatsächlich
    lauscht (man ss, man nmap). Ein Wert sagt, wie schlimm es wird, sobald
    die Lücke erreicht ist; er sagt nichts darüber, wer sie erreichen kann.

    Schreib deine Entscheidung in prioritaet.md, mit dem Warum. Und sag
    mir auch, was wir mit der CVE von openssh-server machen: Sie trifft auf
    diesen Server zu, aber verlangt sie eine Maßnahme?

    Salomé

priority-template =
    # Priorität — Die Bäckerei

    (zu vervollständigen: die Reihenfolge, in der die zwei behaltenen CVEs behandelt werden, mit dem Warum;
    und was mit der CVE von openssh-server zu tun ist)

priority-a-complete = (zu vervollständigen
priority-words-expose = internet, erreichbar, exponiert, öffentlich, oeffentlich, von außen, von aussen, 80, 443
priority-words-local = kein port, lauscht nicht, lauscht auf keinem, lokal, kommandozeile, befehlszeile, werkzeug, kein dienst
priority-words-protected = schon geschützt, schon geschuetzt, bereits geschützt, schon auf „no“, schon auf "no", schon no, nichts zu tun, keine maßnahme, keine massnahme, kbdinteractiveauthentication

## Durchsicht

priority-review = Salomé sieht deine Entscheidung durch:
priority-missing-template = Die Zeile „(zu vervollständigen)“ der Vorlage ist noch da.
priority-missing-order = Beide verbleibenden CVEs müssen genannt werden, in der Reihenfolge, in der du sie behandelst.
priority-missing-exposure = Sag, warum: Was macht nginx aus dem Internet erreichbar, und warum rsync nicht (prüf ss -tlnp oder nmap)?
priority-missing-ssh = Vergiss die CVE von openssh-server nicht: Trifft sie zu? Braucht sie eine Maßnahme?
priority-missing-look = Deine Begründung hält auf dem Papier, aber hast du dir angesehen, was auf diesem Server wirklich lauscht (ss -tlnp oder nmap)?

## Ereignisse

priority-event-score-only =
    Du hast rsync vor nginx eingeordnet: Das ist die Reihenfolge der
    CVSS-Werte (9.8 gegen 8.2), aber schau dir die Exposition an. Ein Wert
    misst, wie schlimm es wird, WENN die Schwachstelle erreicht wird; er
    sagt nichts darüber, wie leicht sie zu erreichen ist. Lass ss -tlnp
    oder nmap -sV auf diesem Server noch einmal laufen: Wer kann mit
    welchem Dienst sprechen?
priority-event-expose =
    Das lauscht hier tatsächlich: 80 und 443 antworten jeder Adresse.
    rsync hat nie einen offenen Port: Es ist ein Werkzeug, das man startet,
    kein Dienst, der auf Verbindungen wartet.
priority-event-order =
    Deine Reihenfolge hält: nginx zuerst (exponiert), rsync danach (ein
    höherer Wert, aber kein Port, also kein Weg, es aus der Ferne zu
    erreichen).
priority-event-end =
    Salomé: „Genau so. Der Wert sagt ‚wenn es trifft‘, nicht ‚kann es mich
    treffen‘.“

    Gut gemacht! Du hast das Kapitel „Die Priorität“ abgeschlossen.

    WAS PASSIERT IST
    Ein CVSS-Wert misst die Auswirkung einer Schwachstelle, sobald sie
    erreicht ist (Datenverlust, Kontrolle über das System…), nicht wie
    leicht sie zu erreichen ist. Ein aus dem Internet erreichbarer Dienst
    mit mittlerem Wert ist oft dringender als ein lokales Werkzeug mit
    hohem Wert, weil niemand außer dir die zweite Schwachstelle auslösen
    kann.

    GUTE PRAXIS
    - Den Wert mit der echten Exposition abgleichen (ss -tlnp, nmap -sV),
      bevor man über eine Reihenfolge entscheidet.
    - Eine Schwachstelle, die einen Zugang braucht, den man schon hat
      (lokal, authentifiziert), ist fast immer weniger dringend als eine,
      die von außen erreichbar ist, selbst bei gleichem oder niedrigerem
      Wert.
    - Die Entscheidung und ihren Grund aufschreiben: Eine Reihenfolge, die
      sich nicht erklären lässt, lässt sich nicht verteidigen.

    EIN ANDERER WEG
    CVSS in Version 4.0 fügt dem Basiswert tatsächlich Metriken zur
    Exposition hinzu („Attack Requirements“, „Attack Complexity“), um einen
    Teil dieser Überlegung direkt in die Zahl einzurechnen; es lohnt sich
    trotzdem, die echte Exposition des eigenen Systems selbst zu prüfen,
    die der Wert nicht kennt.

    DOKUMENTATION
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - nmap: https://nmap.org/book/man.html
    - CVSS: https://www.first.org/cvss/
