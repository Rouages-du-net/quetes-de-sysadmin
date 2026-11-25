### Story "The Blood Drive", chapter "The Sick Server": a backend that
### answers 500 still gets traffic (no health check); a backend to take out
### for maintenance without cutting sessions. option httpchk, http-check
### expect, check, fall, rise, the runtime API (socat, show stat, set
### server … state drain). Commands, options, paths and outputs are not
### translated.

chapter-sick-server = Der kranke Server
    .summary = Jede dritte Person, die spenden will, bekommt eine Fehlerseite, und ein Techniker wartet an der Tür, um einen Webserver zu reparieren. Bring HAProxy bei, einen gesunden Server von einem kranken zu unterscheiden, und nimm einen Server aus dem Pool, ohne irgendjemandes Buchung abzuschneiden.

## Files

sick-server-message-zainab =
    Von: Zainab (Spenderservice)
    Mittwoch, 22. Mai, 10:05
    
    Hallo noch einmal!
    
    Seit heute Morgen bekommt etwa jede dritte Person eine Fehlerseite, wenn
    sie einen Termin wählt („Server Error (500)“); wenn sie es noch einmal
    versucht, klappt es meistens. Wir hatten Beschwerden.
    
    Außerdem: der Techniker des Hosters ist hier, um ein Speichermodul in
    web2 zu tauschen (es meldet Speicherfehler). Er wartet auf dein Okay:
    er schaltet web2 aus, sobald niemand es benutzt, und mir wäre lieber,
    dass niemand eine halb fertige Buchung verliert.
    
    Zainab
sick-server-message-teodor =
    Von: Teodor (Buchungs-App)
    
    Hallo! Die App hat eine Health-Seite: GET /health auf Port 8080
    antwortet 200, wenn die App und ihre Datenbank in Ordnung sind, und 500,
    wenn nicht. Sie ist für die Load Balancer da, falls sie fragen.
    
    Der Runtime-Socket von HAProxy ist /run/haproxy/admin.sock (stats socket
    in haproxy.cfg). Bastien hat so etwas benutzt:
    echo "show stat" | sudo socat stdio /run/haproxy/admin.sock
    
    Teodor

## Events

sick-server-event-errors =
    Die 500-Fehler kommen von web3: HAProxy schickt ihm jede dritte Anfrage
    (balance roundrobin), und die App von web3 antwortet auf jede mit
    „Server Error (500)“. Warum schickt HAProxy ihm weiter Anfragen? Frag
    HAProxy, was es von seinen Servern hält.
sick-server-event-denied =
    Der Socket gehört root und der Gruppe haproxy (Modus 660): socat
    braucht sudo.
sick-server-event-no-check =
    „no check“: HAProxy prüft seine Server überhaupt nicht. Es hält jeden
    Server für up, egal was er antwortet. Die Server brauchen die Option
    check, und eine Prüfung, die sich die Anwendung ansieht, nicht nur den
    Port (man haproxy, und sein Konfigurationshandbuch: option httpchk).
sick-server-event-tcp-only =
    Die Server werden jetzt geprüft, aber web3 ist immer noch UP: „L4OK“.
    Ohne option httpchk öffnet eine Prüfung nur eine TCP-Verbindung zu Port
    8080, und die App von web3 nimmt sie an. Die App ist krank, nicht ihr
    Port: prüfe /health über HTTP (option httpchk GET /health, http-check
    expect status 200).
sick-server-event-http-check =
    web3 ist DOWN: „Layer7 wrong status, code: 500“ in
    /var/log/haproxy.log, L7STS in show stat. Nach `fall` gescheiterten
    Prüfungen schickt HAProxy ihm keine Anfragen mehr; nach `rise` guten
    (sobald Teodor seine Datenbank repariert) kommt er von selbst zurück.
sick-server-event-lb2-synced =
    lb2 prüft auf dieselbe Weise: wenn die Adresse morgen zu lb2 zieht,
    schickt auch sein HAProxy keine Spender·innen zu einem kranken Server.
sick-server-event-wrong-node =
    web2 ist auf dem Load Balancer aus dem Pool, der die Adresse nicht hält:
    die Anfragen der Spender·innen gehen über den anderen. Mach es auf dem
    Master (ip a sagt, welcher).
sick-server-event-removed =
    Die server-Zeile von web2 ist aus einer haproxy.cfg verschwunden. Er
    kommt nach der Reparatur zurück, also müsste sie wieder geschrieben,
    neu geladen und auf beiden Load Balancern gleich gehalten werden. Die
    Runtime-API ist dafür gemacht: sie nimmt einen Server heraus und setzt
    ihn wieder ein, ohne die Datei anzufassen.
sick-server-event-drained =
    web2 bekommt keine neuen Anfragen (drain: die schon offenen Sitzungen
    laufen zu Ende; maint: kein Traffic und keine Prüfungen). Sieh zu, wie
    seine Sitzungen zurückgehen (scur in show stat), bevor der Techniker
    ihn ausschaltet.
sick-server-event-cut =
    Die App von web2 hat gestoppt, während noch Spender·innen darauf waren:
    ihre Buchungen sind auf halbem Weg abgebrochen. Zuerst drainen, warten,
    bis die Sitzungen enden, dann ausschalten.
sick-server-event-tech-working =
    Zainab: „Der Techniker hat web2 ausgeschaltet, er braucht etwa eine
    Minute.“ Die Prüfung von HAProxy auf web2 scheitert währenddessen, das
    ist zu erwarten.
sick-server-event-tech-done =
    Zainab: „web2 ist zurück, mit seinem neuen Speicher.“ Er läuft, aber
    HAProxy hält ihn noch aus dem Pool (drain oder maint): setz ihn wieder
    ein (set server … state ready).
sick-server-event-end =
    Zainab: „Keine Fehlerseiten mehr, und der Techniker sagt, web2 ist
    zufrieden. Teodor repariert die Datenbankverbindungen von web3.“
    
    Gut gemacht! Du hast „Der kranke Server“ abgeschlossen.
    
    WAS PASSIERT IST
    Die App von web3 hatte ihre Datenbankverbindungen verloren und
    antwortete auf jede Anfrage mit 500, aber HAProxy hatte keine
    Health-Checks: es schickte web3 weiter ein Drittel der Spender·innen. Du
    hast auf beiden Load Balancern eine HTTP-Prüfung von /health
    hinzugefügt: web3 ging DOWN und bekam keinen Traffic mehr. Dann hast du
    web2 über die Runtime-API von HAProxy aus dem Pool genommen, gewartet,
    bis seine Sitzungen endeten, den Techniker arbeiten lassen und ihn
    wieder eingesetzt, ohne die Konfiguration anzufassen.
    
    GUTE PRAXIS
    - Ein Health-Check muss die Anwendung fragen, nicht nur ihren Port:
      option httpchk auf eine Seite, die prüft, was die App braucht (hier
      ihre Datenbank).
    - fall und rise verhindern Flattern: ein Server verlässt den Pool nach
      ein paar Fehlschlägen und kommt nach ein paar Erfolgen zurück.
    - Die Konfigurationen der Load Balancer identisch halten (diff, oder
      besser: Konfigurationsmanagement).
    - Wartung: drain (keine neuen Anfragen), warten, bis scur 0 erreicht,
      dann stoppen. Die Runtime-API ändert den laufenden Zustand; die Datei
      bleibt die Referenz. Ein Neuladen startet wieder von der Datei.
    
    DOKUMENTATION
    - Konfigurationshandbuch von HAProxy (option httpchk, http-check, server):
      https://docs.haproxy.org/3.0/configuration.html
    - Betriebshandbuch von HAProxy (die Runtime-API): https://docs.haproxy.org/3.0/management.html
    - socat: http://www.dest-unreach.org/socat/doc/socat.html
