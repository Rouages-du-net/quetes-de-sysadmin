### Geschichte „Die Wache“, Kapitel „Das Bulletin“: die CVEs eines
### wöchentlichen Sicherheitsbulletins sortieren, sagen, welche diesen
### Server wirklich betreffen. Die CVE-Kennungen sind erfunden
### (CVE-2099-NNNNN, in der Form echter); Paketnamen, Befehle und Pfade
### werden nicht übersetzt. Die Abschnittstitel der Vorlage
### (bulletin-section-…) müssen die der Vorlage bleiben.

chapter-bulletin = Das Bulletin
    .summary = Ein Bulletin mit CVEs sortieren: was diesen Server wirklich betrifft und was nur falscher Alarm ist.

## Dateien

# The Bakery's website (/var/www/bakery/index.html), as curl shows it.
watch-site-index =
    <!DOCTYPE html>
    <html lang="de">
    <title>Die Bäckerei</title>
    <h1>Die Bäckerei</h1>
    <p>Bestell dein Brot online und hol es im Laden ab.</p>
    </html>

bulletin-email-salome =
    Von:      Salomé
    An:       dich
    Betreff:  Die Wache, sechs Monate danach

    Hallo!

    Das Audit ist jetzt sechs Monate her. Der Betrieb ist gewachsen: Ihr
    seid auf einen neuen Server umgezogen (kneter), und Nadia hat mich
    wieder gefragt, diesmal nicht, um alles noch einmal zu prüfen, sondern
    um dir zu helfen, eine Gewohnheit aufzubauen: die Sicherheitsbeobachtung.
    Ich komme nicht alle sechs Monate wieder, um immer alles für dich zu
    prüfen.

    Jede Woche schickt eine Mailingliste, der ich folge (wie die
    Sicherheitsankündigungen von Debian), ein Bulletin mit kürzlich
    behobenen Lücken. Das dieser Woche liegt in deinem Verzeichnis:
    sicherheitsbulletin.txt.

    Erste Regel, und die wichtigste: Eine Zeile im Bulletin ist nur dann
    ein Alarm, wenn sie diesen Server wirklich betrifft. Bevor du dir wegen
    einer CVE Sorgen machst, prüfe:
    - Ist das Paket hier überhaupt installiert? (apt list --installed)
    - Wenn ja, liegt die installierte Version im betroffenen Bereich, oder
      ist sie schon über die korrigierte Version hinaus?

    Sortiere, was du findest, in beobachtung.md: was diesen Server betrifft
    auf die eine Seite, worum du dir keine Sorgen machen musst auf die
    andere (mit Begründung).

    Salomé
    (Für sudo ist dein Passwort: sauerteig-2028)

bulletin-file =
    SICHERHEITSBULLETIN — Woche vom 8. September 2028
    (erfundene CVEs, zu Lehrzwecken: keine davon existiert wirklich)

    CVE-2099-41042 — nginx                                        [hoch, 8.2]
    Umgehung von Zugriffsbeschränkungen durch Verwechslung von
    HTTP/2-Anfragen. Ein Server, der als Reverse Proxy arbeitet, lässt
    möglicherweise eine Anfrage zu einem normalerweise geschützten Pfad
    durch.
    Betroffene Versionen: nginx < 1.26.3-3+deb13u3
    Behoben in:           nginx 1.26.3-3+deb13u3

    CVE-2099-37715 — rsync                                        [kritisch, 9.8]
    Das Entpacken eines speziell präparierten Archivs kann beliebigen Code
    mit den Rechten des Kontos ausführen, das rsync ausführt.
    Betroffene Versionen: rsync < 3.4.1+ds1-5
    Behoben in:           rsync 3.4.1+ds1-5

    CVE-2099-50288 — python3-certbot-nginx                        [mittel, 5.3]
    Während der Erneuerung eines Zertifikats ist der Kontoschlüssel kurz
    für jedes Konto des Systems lesbar (einen Sekundenbruchteil, die Zeit
    eines Dateischreibvorgangs).
    Betroffene Versionen: python3-certbot-nginx < 3.5.0

    CVE-2099-12003 — curl                                         [mittel, 6.1]
    Beim Folgen einer Weiterleitung mit einem speziell präparierten Header
    kann curl über den vorgesehenen Speicherbereich hinaus lesen (Denial of
    Service).
    Betroffene Versionen: curl ≤ 8.14.1-2
    Behoben in:           curl 8.14.1-3

    CVE-2099-29107 — openssh-server                                [mittel, 5.9]
    Timing-Seitenkanal in der „keyboard-interactive“-Authentifizierung
    (KbdInteractiveAuthentication): Die Antwortzeit des Servers kann
    Informationen über ein gerade geprüftes Passwort verraten. Noch keine
    Korrektur bei Debian; deaktiviere bis dahin
    KbdInteractiveAuthentication in sshd_config.
    Betroffene Versionen: openssh-server (alle, wenn die Option aktiviert ist)

bulletin-template =
    # Beobachtung — Die Bäckerei

    ## Betrifft diesen Server
    (zu ergänzen: die CVEs, die wirklich zutreffen, mit ihrer Kennung)

    ## Nicht zutreffend
    (zu ergänzen: die CVEs, die nicht zutreffen, mit ihrer Kennung und warum)

bulletin-section-affected = Betrifft diesen Server
bulletin-section-not-applicable = Nicht zutreffend
bulletin-a-complete = (zu ergänzen
bulletin-words-missing = ist nicht installiert, nicht installiert, nicht vorhanden, fehlt, kein solches paket, gibt es auf diesem server nicht, existiert nicht
bulletin-words-fixed = schon behoben, bereits behoben, schon korrigiert, bereits korrigiert, schon aktuell, bereits aktuell, installierte version, über der korrigierten version, ueber der korrigierten version, neuer als die korrigierte version, neuer, aktueller

## Durchsicht

bulletin-review = Salomé sieht deine Sortierung durch:
bulletin-missing-template = Einige „(zu ergänzen)“-Zeilen der Vorlage sind noch da.
bulletin-missing-concerns = Unter „Betrifft diesen Server“ müssen genau nginx, rsync und openssh-server stehen (letzteres trifft zu, auch wenn hier nichts mehr zu tun ist) — weder certbot noch curl gehören dorthin.
bulletin-missing-not-applicable = Unter „Nicht zutreffend“ erkläre für jede, warum: certbot (prüfe, ob es überhaupt installiert ist) und curl (vergleiche die installierte Version mit der korrigierten Version des Bulletins).

## Ereignisse

bulletin-event-read =
    Fünf Zeilen, fünf CVEs. Bevor du etwas behebst: Welche betreffen diesen
    Server WIRKLICH? apt list --installed sagt dir, was hier installiert
    ist, und in welcher Version (man apt).
bulletin-event-sort =
    Deine Sortierung trennt, was Aufmerksamkeit verdient, von dem, was dich
    nicht beunruhigen muss: certbot ist nicht auf diesem Server, curl ist
    schon über die korrigierte Version hinaus. Übrig bleiben nginx, rsync
    und openssh-server (schon durch die Konfiguration geschützt, aber ein
    Auge wert).
bulletin-event-end =
    Salomé: „Das ist der richtige Reflex: lesen, bevor man in Panik gerät.
    Die Hälfte eines Sicherheitsbulletins betrifft dich normalerweise
    nicht.“

    Gut gemacht! Du hast das Kapitel „Das Bulletin“ abgeschlossen.

    WAS PASSIERT IST
    Ein Sicherheitsbulletin listet Lücken auf, die in verbreiteter Software
    behoben wurden; die meisten betreffen einen bestimmten Server nicht
    (das Paket ist nicht da, oder die installierte Version liegt nicht im
    betroffenen Bereich). Vor dem Handeln zu sortieren vermeidet Panik um
    nichts und hält die Aufmerksamkeit für das frei, was wirklich zählt.

    GUTE PRAXIS
    - Prüfe Installation UND Version, bevor du eine CVE behältst
      (apt list --installed, nie nur den Paketnamen).
    - Eine CVE, die theoretisch zutrifft, kann dank einer schon vorsichtigen
      Konfiguration bereits harmlos sein (hier
      KbdInteractiveAuthentication).
    - Halte die Sortierung schriftlich fest: Die nächste Beobachtung baut
      darauf auf, und jemand anderes muss sie nachlesen können.

    EIN ANDERER WEG
    Große Organisationen nutzen einen Schwachstellenscanner (OpenVAS,
    Nessus oder das schon in „Das Audit“ gesehene Lynis), der die
    installierten Versionen automatisch mit einer CVE-Datenbank abgleicht:
    Das nimmt einen Teil der Handarbeit dieses Kapitels ab, aber nicht die
    Entscheidung, was eine Korrektur wert ist.

    DOKUMENTATION
    - Sicherheitsankündigungen von Debian: https://www.debian.org/security/
    - CVE: https://www.cve.org/
    - CVSS (der Rechner für die Bewertung): https://www.first.org/cvss/calculator/4-0
