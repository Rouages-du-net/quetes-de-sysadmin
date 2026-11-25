### Geschichte „Das Audit“, Kapitel „Der Rahmen“: das Auftragsschreiben
### lesen, mit nmap eine Bestandsaufnahme des Servers aus Sicht des
### Internets machen, im Rahmen bleiben. Befehle, Optionen, Pfade und die
### Ausgabe von nmap werden nicht übersetzt.

chapter-scope = Der Rahmen
    .summary = Vor dem Scannen: das Auftragsschreiben lesen, eine Bestandsaufnahme mit nmap machen, und in Ruhe lassen, was nicht im Rahmen liegt.

## Dateien

scope-email-salome =
    Von:     Salomé (Auditorin)
    An:      dich
    Betreff: Audit der Bäckerei — wo anfangen

    Hallo,

    Nadia hat mir das Sicherheitsaudit ihres Servers anvertraut. Ich
    fange immer gleich an, und ich bitte dich, es mit mir zu machen: zuerst
    das Auftragsschreiben (auftragsschreiben.txt, von uns beiden
    unterschrieben), dann die Bestandsaufnahme. Ein Audit beginnt mit „was
    ist sichtbar, und was darf ich mir ansehen?“.

    Was ich von dir erwarte:
    1. Lies das Auftragsschreiben: Es legt den Rahmen fest, und was
       erlaubt ist.
    2. Mach eine Bestandsaufnahme des Servers aus Sicht des Internets, mit
       nmap (man nmap): die offenen Ports UND die Version dessen, was
       antwortet. Bewahr die Spur in einer Datei auf (die Option -oN): Sie
       ist der Beweis dessen, was du gesehen hast.
    3. Vervollständige auditnotizen.md: der Rahmen, was du gefunden hast,
       und was du bemerkt hast, ohne es anzufassen.

    Eine Vorsichtsmaßnahme: Nadia hat mich gewarnt, dass der Server der
    Pizzeria nebenan (nachbar.internal, 192.0.2.24) an derselben Box hängt.
    Er gehört nicht zu unserem Auftrag.

    Salomé
    (Für sudo ist dein Passwort: mehl-2028)

scope-letter-mission =
    AUFTRAGSSCHREIBEN

    Zwischen: Die Bäckerei, vertreten durch Nadia, Geschäftsführerin
              („die Auftraggeberin“)
    Und:      Salomé, unabhängige Auditorin

    Gegenstand: externes Sicherheitsaudit des Online-Bestelldienstes.

    Zugelassener Rahmen:
      - der Server baeckerei.internal (192.0.2.22), der auch die
        öffentliche Website baeckerei.example trägt.

    Außerhalb des Rahmens (nicht zu prüfen, auch wenn technisch möglich):
      - jedes andere Gerät, insbesondere das der Nachbarn, die die Box der
        Auftraggeberin mitbenutzen.

    Erlaubt:
      - die Ports des Servers scannen und die Versionen der Dienste lesen
        (nmap);
      - harmlose Anfragen (ein Antwortcode, ein Header);
      - die Konfiguration lesen, mit Zustimmung der Administration.

    Verboten:
      - eine Schwachstelle ausnutzen, Daten der Kundschaft lesen oder
        kopieren;
      - Passwörter erraten;
      - den Dienst stören;
      - irgendetwas außerhalb des Rahmens prüfen.

    Zeitraum: vom 6. bis 17. März 2028, 9 bis 18 Uhr.
    Die Ergebnisse gehen nur an die Auftraggeberin.

    Unterschrieben: Nadia (Geschäftsführerin) und Salomé, 3. März 2028.

scope-notes-template =
    # Auditnotizen — Die Bäckerei

    ## Rahmen
    (zu vervollständigen: was das Auftragsschreiben erlaubt)

    ## Was ich gefunden habe
    (zu vervollständigen: die offenen Ports aus Sicht des Internets, die Dienste und ihre Versionen)

    ## Außerhalb des Rahmens
    (zu vervollständigen: was ich bemerkt und NICHT geprüft habe, und warum)

scope-section-scope = Rahmen
scope-section-found = Was ich gefunden habe
scope-section-outside = Außerhalb des Rahmens
scope-a-complete = (zu vervollständigen
scope-words-outside = außerhalb des Rahmens, ausserhalb des Rahmens, nicht im Rahmen, nicht im Schreiben, nicht im Auftrag, nicht geprüft, nicht gescannt, nicht angefasst, nicht berührt, ohne es anzufassen, in Ruhe gelassen

## Durchsicht

scope-review = Salomé liest deine Notizen:
scope-missing-template = Einige Zeilen „(zu vervollständigen)“ der Vorlage sind noch da.
scope-missing-ports = Unter „Was ich gefunden habe“ fehlt, was im Internet nichts zu suchen hat: die Portnummern der Datenbank und von Redis (was nmap gezeigt hat).
scope-missing-neighbour = Die Maschine, die du bemerkt hast, ohne sie anzufassen, fehlt: der Server des Nachbarn (Name oder Adresse).
scope-missing-outside = Du erwähnst den Server des Nachbarn: Sag auch, dass er außerhalb des Rahmens liegt (und dass du ihn nicht geprüft hast).

## Ereignisse

scope-event-letter =
    Das Auftragsschreiben ist das Dokument, das dich genauso schützt wie
    die Auftraggeberin: Es sagt, wohin du gehen darfst. Merk dir zwei
    Dinge: den Rahmen (EINE Maschine: baeckerei, 192.0.2.22) und die Liste
    dessen, was verboten ist. Ohne schriftliche Erlaubnis ist ein Portscan
    bestenfalls schlecht angesehen, schlimmstenfalls eine Straftat.

    Weiter zur Bestandsaufnahme: nmap, mit Versionen (man nmap).
scope-event-scan =
    Das sieht das Internet von der Bäckerei. Lies die Spalte STATE: „open“
    heißt, ein Programm antwortet; „filtered“, dass eine Firewall das Paket
    verwirft; „closed“, dass niemand lauscht. Und die Spalte VERSION: Eine
    veraltete Version ist eine Spur mehr für Angreifende.

    Eine Frage für Auditor·innen: Welche dieser offenen Dienste haben einen
    Grund, für alle erreichbar zu sein? Bewahr die Spur in einer Datei auf
    (die Option -oN): Ein Befund ohne Beweis ist nur eine Meinung.
# { $addresses }: die außerhalb des Auftragsschreibens geprüften Adressen; { $neighbour }: „yes“, wenn der Server des Nachbarn darunter ist
scope-event-outside-scope =
    ACHTUNG: Du hast gerade eine Adresse geprüft, die nicht in deinem
    Auftragsschreiben steht ({ $addresses }{ $neighbour ->
        [yes] , darunter den Server des Nachbarn
       *[no] {""}
    }). Hier ist nichts passiert;
    in Wirklichkeit ist das ein beruflicher Fehler und je nach Land eine
    Straftat: Die Erlaubnis der Auftraggeberin deckt nicht die Geräte
    anderer Leute. Die richtige Antwort auf eine Maschine, die
    „interessant“ aussieht: in Ruhe lassen, und melden.

    (Ein ganzes Netz zu scannen, wie 192.0.2.0/24, prüft auch alles darin:
    Gib immer die genauen Adressen des Rahmens an.)
scope-event-trace =
    Du hast einen Beweis: eine Datei mit dem genauen Befehl, dem Datum, den
    Ports und den Versionen. Im Bericht kannst du sagen „am 6. März, aus dem
    Internet, antwortete die Datenbank auf Port 5432“ und es zeigen.

    Bleiben deine Notizen (auditnotizen.md): was du gefunden hast, und was
    du gesehen hast, ohne es anzufassen.
# { $mistake }: „yes“, wenn der Scan über den Rahmen hinausging, sonst „no“
scope-event-end =
    Salomé: „Das ist eine saubere Bestandsaufnahme: ein Rahmen, ein Beweis,
    und ehrliche Notizen. Damit können wir den Bericht machen.“

    Gut gemacht! Du hast das Kapitel „Der Rahmen“ abgeschlossen.

    WAS PASSIERT IST
    Du hast das Auftragsschreiben gelesen, bevor du irgendetwas angefasst
    hast, und dann eine Bestandsaufnahme der Bäckerei aus Sicht des
    Internets gemacht: SSH, die Website, aber auch PostgreSQL und Redis,
    deren Erreichbarkeit nichts rechtfertigt, und eine SSH-Version, die
    nicht die neueste ist. Du hast die Spur des Scans in einer Datei
    aufbewahrt. Und du hast, ohne sie anzufassen, eine „interessante“
    Maschine notiert, die nicht deine ist: den Server des Nachbarn.
    { $mistake ->
        [yes] Aber dein Scan hat auch die Adresse des Nachbarn geprüft: der häufigste Fehler, weil „das ganze Netz“ zu scannen ein Reflex ist. Hier kostet es nichts; in Wirklichkeit ist es der Fehler, der einen Auftrag beendet, manchmal eine Karriere.
       *[no] Dein Scan ist im Rahmen geblieben: Genau das erwartet man von Auditor·innen.
    }

    GUTE PRAXIS
    - Kein Audit ohne schriftliche Erlaubnis: wer, was (die genauen
      Adressen), wann, was erlaubt ist, was verboten ist.
    - Im Rahmen bleiben, auch wenn der Rest des Netzes in Reichweite ist.
      Was du außerhalb des Rahmens siehst, wird gemeldet, nicht getestet.
    - Den genauen Befehl notieren und die Ausgabe aufbewahren (nmap -oN):
      Ein Befund ist bewiesen und lässt sich wiederholen.
    - Beobachten, nicht ausnutzen: Zu sehen, dass eine Datenbank antwortet,
      erlaubt dir nicht, dich mit ihr zu verbinden.
    - Ein offener Port ist nicht unbedingt ein Problem: Er ist eine Frage
      („ist das so gewollt?“). Der Bericht sagt, welche, und warum.

    EIN ANDERER WEG
    Ohne nmap listet ss -tlnp auf dem Server die Dienste auf, die lauschen,
    aber nicht, was von außen sichtbar ist: Eine Firewall kann manche
    verbergen. Beides ergänzt sich: ss sagt, was lauscht, nmap sagt, was
    durchkommt.

    DOKUMENTATION
    - nmap: https://nmap.org/book/man.html
    - Rechtliche Fragen: https://nmap.org/book/legal-issues.html
    - Leitfäden zu Grundschutz und Audit von nationalen Behörden: BSI (Deutschland, bsi.bund.de), NCSC (Schweiz, ncsc.admin.ch), ANSSI (Frankreich, cyber.gouv.fr), NCSC (Vereinigtes Königreich, ncsc.gov.uk), CCN-CERT (Spanien, ccn-cert.cni.es), CCB (Belgien, ccb.belgium.be), CISA (Vereinigte Staaten, cisa.gov)
