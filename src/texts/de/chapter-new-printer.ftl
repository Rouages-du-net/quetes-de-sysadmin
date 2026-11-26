### Story "The Staff Room", chapter "The New Printer": a driverless queue
### for the staff room's MFP, the school's default, shared with the staff
### only; the reception's old LaserJet and its driver. lpadmin, lpinfo,
### driverless, cupsd.conf's Location blocks. Commands, options, paths and
### outputs are not translated.

chapter-new-printer = Der neue Drucker
    .summary = Der neue Multifunktionsdrucker fürs Lehrerzimmer ist angekommen, und der alte LaserJet vom Empfang will ein zweites Leben. Füge beide zu CUPS hinzu, auf die moderne Art, wenn du kannst, auf die alte, wenn du musst, und sorg dafür, dass die Chromebooks der Kinder auf ihrer Seite bleiben.

## Files

new-printer-message-ines =
    Von: Ines (Sekretariat)
    Mittwoch, 28. November, 13:30
    
    Hallo!
    
    Der neue Multifunktionsdrucker fürs Lehrerzimmer ist angeschlossen (der
    Lieferschein liegt in deinem Verzeichnis). Könntest du ihn auf kreide
    hinzufügen und ihn für alle zum Standarddrucker machen? Das Kollegium
    soll von seinen PCs und Macs darauf drucken, so wie auf dem
    Bürodrucker.
    
    Aber Vorsicht: er ist nur fürs Kollegium. Die Chromebooks der
    Bibliothek sehen den Bibliotheksdrucker, und mehr sollen sie nicht
    sehen. Ich will nicht, dass die „Kreationen“ der Kinder im
    Lehrerzimmer herauskommen.
    
    Und der Empfang hätte gern den alten HP LaserJet 4250 zurück: er
    funktioniert perfekt, er ist nur alt. Er ist auch angeschlossen.
    
    Ines
new-printer-delivery-note =
    LIEFERSCHEIN
    
    1 x RICOH IM C3010 Multifunktionsdrucker (Farbe, A4/A3)
    Aufgestellt in: Lehrerzimmer
    Netzwerk: VLAN staff, Adresse 198.51.100.21 (mfp-staffroom.internal)
    Drucken: zertifiziert für IPP Everywhere / AirPrint / Mopria
    (treiberlos), Port 631, Pfad /ipp/print. Kein Treiber nötig für
    aktuelle Systeme.
    
    Alter Drucker wieder angeschlossen: HP LaserJet 4250, Adresse
    198.51.100.22 (laserjet-reception.internal). Netzwerkdruck: roher Port
    9100 (JetDirect).

## Events

new-printer-event-discover =
    Das Multifunktionsgerät kündigt sich im Netzwerk an (DNS-SD, die Namen
    auf .local): IPP Everywhere, der Standard hinter dem treiberlosen
    Drucken. CUPS fragt es über IPP nach seinen Fähigkeiten und baut das
    PPD selbst: -m everywhere von lpadmin, kein Treiber zu installieren
    (man lpadmin).
new-printer-event-not-enabled =
    Die Warteschlange existiert, ist aber deaktiviert und lehnt Aufträge ab:
    so legt lpadmin eine neue Warteschlange an, außer -E steht nach -p (vor
    -p bedeutet -E „die Verbindung verschlüsseln“). cupsenable und
    cupsaccept gehen auch.
new-printer-event-added =
    Die Warteschlange { $queue } ist bereit, treiberlos. Ist sie der
    Standard, den die Rechner des Kollegiums sehen werden (lpstat -d)? Und
    wer kann sie erreichen: ein Blick auf <Location /> in cupsd.conf wäre
    klug.
new-printer-event-lpoptions-only =
    lpoptions -d hat deinen eigenen Standarddrucker gesetzt, in
    ~/.cups/lpoptions: es ändert nichts für den Server und nichts für die
    Rechner des Kollegiums. Den Standard des Servers setzt -d von lpadmin.
new-printer-event-default =
    Das Multifunktionsgerät ist das Standardziel des Servers: die Rechner
    des Kollegiums bieten es zuerst an.
new-printer-event-pupil-printed =
    Ines: „Gerade sind dreißig Seiten Spiel-Skins im Lehrerzimmer
    herausgekommen!“
    
    Ein Chromebook hat auf dem Multifunktionsgerät gedruckt. cupsd.conf
    teilt alles mit „Allow @LOCAL“ in <Location />, und @LOCAL bedeutet
    jedes Netzwerk, in dem kreide eine Schnittstelle hat: ip -br addr zeigt
    drei, darunter das VLAN der Kinder, für den Bibliotheksdrucker. Neue
    Warteschlangen werden standardmäßig geteilt (DefaultShared). Wer was
    schickt: /var/log/cups/access_log.
new-printer-event-remote-any =
    „Allow all“: jetzt darf jede Person drucken, die Port 631 erreicht, aus
    jedem Netzwerk. Das ist das Gegenteil von dem, was Ines verlangt hat.
    Eine Location kann Netzwerke nennen (Allow 198.51.100.0/24, Allow
    @IF(eth1)), und eine Warteschlange kann ihre Benutzer nennen (lpadmin -u
    allow:@staff).
new-printer-event-not-applied =
    cupsd.conf hat sich geändert, aber cupsd läuft noch mit der
    Konfiguration, die es beim Start gelesen hat. cupsd -t prüft die Datei;
    ein Neustart (oder cupsctl, das ihn neu startet) wendet sie an.
new-printer-event-staff-blocked =
    Jetzt kann auch das Kollegium nicht mehr auf dem Multifunktionsgerät
    drucken: ein PC des Kollegiums wird abgewiesen (das access_log zeigt 403
    oder client-error-not-possible). Geteilt und offen fürs Netz des
    Kollegiums: beides ist nötig.
new-printer-event-library-broken =
    Die Chromebooks der Bibliothek können nicht mehr auf dem
    Bibliotheksdrucker drucken: die Einschränkung ist zu weit. Schränke die
    Warteschlange des Lehrerzimmers ein, nicht den ganzen Server.
new-printer-event-printers-conf =
    printers.conf bearbeitet, während cupsd läuft: cupsd wird darüber
    schreiben, und eine Warteschlange ohne ihr PPD in /etc/cups/ppd druckt
    roh. lpadmin ist das Werkzeug für Warteschlangen.
new-printer-event-restricted =
    Das Kollegium druckt auf dem Multifunktionsgerät, die Chromebooks werden
    abgewiesen (403 im access_log, oder client-error-not-authorized), und in
    der Bibliothek drucken sie weiterhin. Jetzt der alte LaserJet.
new-printer-event-everywhere-refused =
    „IPP Everywhere driver requires an IPP connection“: der LaserJet 4250
    (2004) kennt nur den rohen Port 9100, socket://. CUPS kann ihn nichts
    fragen: es braucht ein PPD, eine Beschreibung des Druckers, und die
    Filter dahinter. lpinfo -m listet die installierten Treiber; die von HP
    sind in einem Debian-Paket (apt search hpcups).
new-printer-event-raw =
    Eine rohe Warteschlange schickt das Dokument so, wie es ist: der
    LaserJet versteht kein PDF. Und CUPS sagt es: rohe Warteschlangen sind
    veraltet. Es braucht einen Treiber.
new-printer-event-hpcups =
    printer-driver-hpcups ist installiert: lpinfo -m kennt jetzt den
    LaserJet 4250 (lpinfo -m | grep 4250).
new-printer-event-old-added =
    Der LaserJet vom Empfang hat seine Warteschlange, mit { $model }. CUPS
    warnt, dass Druckertreiber veraltet sind: CUPS 3 wird nur noch
    treiberlos drucken, und alte Drucker werden eine Printer Application
    brauchen.
new-printer-event-end =
    Ines: „Das Lehrerzimmer druckt, der Empfang druckt, und die Chromebooks
    der Bibliothek sehen nur die Bibliothek. Perfekt!“
    
    Gut gemacht! Du hast „Der neue Drucker“ abgeschlossen.
    
    WAS PASSIERT IST
    Das Multifunktionsgerät spricht IPP Everywhere: die Warteschlange
    { $queue } ist treiberlos (-m everywhere), bei der Anlage aktiviert (-E
    nach -p) und Standard des Servers (lpadmin -d). cupsd.conf teilte alles
    mit „Allow @LOCAL“, und @LOCAL umfasst das VLAN der Kinder, wo kreide die
    Bibliothek bedient: du hast das Multifunktionsgerät aufs Kollegium
    beschränkt, nach Netzwerk oder nach Gruppe, und im access_log geprüft,
    wer hereinkam. Der LaserJet spricht nur Port 9100: die Warteschlange
    { $old } benutzt ein PPD, das von HP aus printer-driver-hpcups oder ein
    generisches.
    
    GUTE PRAXIS
    - Zuerst treiberlos (IPP Everywhere, AirPrint, Mopria): kein Treiber zu
      pflegen, und die einzige Art, wie CUPS 3 drucken wird.
    - lpadmin -p NAME -E -v URI -m everywhere: -E nach -p.
    - @LOCAL bedeutet jedes Netzwerk, in dem der Server eine Schnittstelle
      hat: liste sie auf (ip -br addr), bevor du dich darauf verlässt.
    - Nach Netzwerk einschränken in einer <Location /printers/NAME> (wer
      sich verbinden kann), nach Benutzer mit lpadmin -u (wer drucken kann;
      der Benutzername kommt vom Client, außer der Server authentifiziert).
    - Nie Allow all; nie printers.conf bearbeiten, während cupsd läuft.
    - Alte Drucker: das Treiberpaket des Herstellers oder ein generisches
      PPD, bis eine Printer Application es ersetzt.
    
    DOKUMENTATION
    - lpadmin: https://www.cups.org/doc/man-lpadmin.html
    - lpinfo: https://www.cups.org/doc/man-lpinfo.html
    - Druckerfreigabe: https://www.cups.org/doc/sharing.html
    - cupsd.conf (Location, Allow, Order): https://www.cups.org/doc/man-cupsd.conf.html
    - Treiberloses Drucken unter Debian: https://wiki.debian.org/CUPSDriverlessPrinting
