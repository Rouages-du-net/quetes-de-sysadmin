### Geschichte „Das Auftragsbuch“, Kapitel „Papier, das niemand druckt“: der
### System-ASP einer IBM i, gefüllt mit Spooldateien. CL-Befehle,
### Nachrichten-IDs und Objektnamen werden nicht übersetzt.

chapter-spooled = Papier, das niemand druckt
    .summary = Die Platte der IBM i ist über ihrem Schwellenwert, und keine Datei ist schuld: Tausende gedruckter Listen, die niemand druckt. Nur diese löschen, die Rechnungen behalten und die Ursache abstellen.

## Dateien

spooled-email-kwame =
    Von:  Kwame
    An:   dich

    Hallo noch einmal! Heute Morgen gibt es eine Nachricht für den
    Operator, die mir Sorgen macht, irgendwas mit „storage“ (in QSYSOPR,
    sagt Soraya). Die Platte der IBM i ist voll? Wir haben nichts Großes
    darauf, das Auftragsbuch ist winzig.

    Vorsicht mit der Druckerwarteschlange: Die Rechnungen von heute Morgen
    warten darin, Soraya druckt sie um 08:30, und sie gehen mit den
    Lieferungen raus.

    Könntest du finden, was den Platz belegt, aufräumen und dafür sorgen,
    dass es nicht wieder vollläuft?

    Kwame

## Ereignisse

spooled-event-storage =
    Der System-ASP (die Platten der IBM i, als ein Pool) ist über seinem
    Schwellenwert von 90 %: QSYSOPR hat CPF0907 bekommen. Bei 100 % hält
    das System an. Unter Linux würdest du mit du eine große Datei suchen;
    hier schau dir die Objekte an, die sich unbemerkt anhäufen: Druckausgabe,
    die in den Ausgabewarteschlangen wartet (WRKOUTQ, WRKSPLF).
spooled-event-culprit =
    DBGLIST, Benutzerdaten ORDPICKDBG, Status HLD: Debug-Listen von
    ORDPICK, eine pro Bestellung, jede Nacht, angehalten und nie gedruckt.
    Tausende davon, in QPRINT, der gemeinsamen Warteschlange, direkt neben
    den Rechnungen (INVOICE). Irgendetwas lässt ORDPICK sie schreiben:
    vielleicht ein Schalter eines Programms, in seiner Bibliothek.
spooled-event-flag =
    ORDDEBUG ist „Y“: ORDPICK schreibt für jede Bestellung seine
    Debug-Liste. Margit muss es eingeschaltet haben, um einen Fehler zu
    jagen, und hat es nie wieder ausgeschaltet. Solange es an ist, fügt
    jede Nacht sechshundert Listen hinzu.
spooled-event-invoices-lost =
    Die Rechnungen sind auch weg: Sie lagen in derselben Warteschlange und
    warteten darauf, um 08:30 gedruckt zu werden. Eine ganze
    Warteschlange oder alle Dateien eines Benutzers nimmt alles mit, was
    darin ist. Margits Notizen sagen, wie man sie noch einmal druckt.
spooled-event-cleaned =
    Die Debug-Listen sind gelöscht: Der ASP hat wieder Platz (WRKSYSSTS).
spooled-event-switched-off =
    ORDDEBUG ist aus: ORDPICK schreibt seine Liste nicht mehr. Heute Nacht
    füllt sich die Warteschlange nicht wieder.
spooled-event-end =
    Kwame: „Unter 85 %, und die Rechnungen werden gedruckt. Margit hat am
    Telefon gelacht: Sie hatte diesen Schalter seit 2027 vergessen!“

    Gut gemacht! Du hast das Kapitel „Papier, das niemand druckt“
    abgeschlossen.

    WAS PASSIERT IST
    Die Platte wurde nicht von Daten gefüllt, sondern von Druckausgabe:
    Spooldateien. Zwei Jahre lang hat ein Debug-Schalter (der Datenbereich
    ORDERS/ORDDEBUG) ORDPICK für jede Bestellung eine Liste schreiben
    lassen, über eine Druckerdatei, die sie anhält und aufbewahrt (HOLD,
    SAVE): 18.000 Spooldateien in QPRINT, der Warteschlange, durch die auch
    die Rechnungen gehen. Du hast sie gefunden (WRKSYSSTS, WRKOUTQ,
    WRKSPLF), nur sie gelöscht (DLTSPLF FILE(*SELECT) mit den
    Benutzerdaten, oder Job für Job) und den Schalter ausgeschaltet.

    GUTE PRAXIS
    - Spooldateien sind Objekte: Sie belegen Platte, sie haben Besitzer,
      sie überleben die Jobs, die sie erzeugt haben. Behalte WRKSYSSTS und
      die Warteschlangen im Auge.
    - Mit der engsten Auswahl löschen: Benutzer, Warteschlange,
      Benutzerdaten. CLROUTQ auf einer gemeinsamen Warteschlange oder alle
      Dateien eines Benutzers löschen, was noch gedruckt werden muss.
    - Die Ursache beseitigen, nicht nur das Symptom: den Schalter oder die
      Druckerdatei (CHGPRTF ... HOLD(*NO) SAVE(*NO), oder eine eigene
      Ausgabewarteschlange).
    - Das System aufräumen lassen: Die automatische Bereinigung des
      Operational Assistant (GO CLEANUP) löscht alte Jobprotokolle und
      Systemausgaben nach einer Anzahl von Tagen.

    DOKUMENTATION
    - DLTSPLF: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dltsplf.html
    - CLROUTQ: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/clroutq.html
    - Spooldateien und Ausgabewarteschlangen: https://www.ibm.com/docs/en/i/7.5?topic=concepts-spooled-files-output-queues
    - Automatische Bereinigung: https://www.ibm.com/docs/en/i/7.5?topic=cleanup-starting-automatic
