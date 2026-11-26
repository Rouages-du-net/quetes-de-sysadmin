### Geschichte „Das Sprachcafé“, Kapitel „Neue Nachbarschaft“: ein
### Debian-Admin auf einer Rocky-Linux-10-Maschine: /etc/os-release, dnf,
### systemctl, die Laufzeit- und die permanente Konfiguration von firewalld.
### Befehle, Optionen, Pfade, Konfigurationszeilen und Ausgaben werden nicht
### übersetzt.

chapter-new-neighbour = Neue Nachbarschaft
    .summary = Der kleine Server des Cafés läuft mit Rocky Linux, nicht mit Debian: kein apt, kein ufw. Finde den Paketmanager und die Firewall der anderen Familie, bring einen Webserver hoch und öffne ihn so, dass er auch nach einem reload offen bleibt.

## Files

new-neighbour-message-dilnoza =
    Von: Dilnoza (Koordination, Common Tongue)
    Montag, 7. Dezember, 18:30

    Hallo, und willkommen bei Common Tongue!

    Jeden Donnerstagabend bietet unser Café kostenlose Gesprächstische an:
    Arabisch, Dari, Spanisch, Tigrinya, Ukrainisch, Vietnamesisch, und
    Französisch und Englisch für alle. Der Bildschirm an der Tür (wir nennen
    ihn die Pinnwand) soll die Tische der Woche zeigen, von unserem eigenen
    kleinen Server, kessel, im Hinterzimmer.

    Seun, unser letzter Technikmensch, hat kessel installiert, bevor er für
    drei Monate zum Arbeiten ins Ausland gegangen ist. Er sagt, es ist
    „Rocky Linux, wie bei meiner Arbeit“, was mir nichts sagt, und er sagt,
    du kennst Debian. Ist das dasselbe?

    Könntest du heute Abend einen Webserver auf kessel einrichten und dafür
    sorgen, dass die Pinnwand ihn erreicht? Itzel macht gerade die Website
    fertig; sie legt sie diese Woche an ihren Platz. Seun hat dir ein paar
    Notizen hinterlassen. sudo geht mit deinem Passwort.

    Danke!
    Dilnoza

new-neighbour-notes-seun =
    Notizen von Seun (kessel, 30. November)

    - kessel ist Rocky Linux 10, ein Nachbau von Red Hat Enterprise Linux.
      Dasselbe Linux, dasselbe systemd und journalctl, dieselbe bash, aber
      es ist kein Debian: Schau in /etc/os-release.
    - Pakete: nicht apt. Ich habe dir nano installiert, sonst nichts.
    - Die Firewall ist firewalld, nicht ufw. Sie läuft, mit der
      Standardeinrichtung einer frischen Installation.
    - SELinux ist an (enforcing). Lass es bitte an. Bei der Arbeit schalten
      wir es nie ab, wir beheben, worüber es sich beschwert.
    - Die Pinnwand (der Bildschirm an der Tür) ist eine kleine Debian-Kiste
      im Netz des Cafés: ssh pinnwand von kessel aus, dein Schlüssel ist
      hinterlegt. Ihr Browser lädt alle fünf Minuten
      http://www.commontongue.example/; im Netz des Cafés ist dieser Name
      kessel.

## Events

new-neighbour-event-debian =
    bash kennt diesen Befehl nicht: kessel ist kein Debian. Seine Pakete,
    seine Firewall und sein Webserver haben andere Namen. Seuns Notizen
    sagen, wo du zuerst schauen sollst, und /etc/os-release sagt, zu welcher
    Familie kessel gehört.

new-neighbour-event-rocky =
    Rocky Linux 10: die Red-Hat-Familie, wie RHEL, AlmaLinux und, etwas
    weiter entfernt, Fedora. Pakete kommen aus Repositorys über dnf (sein
    Handbuch: man dnf), die Firewall ist firewalld (man firewall-cmd), und
    das Paket von Apache heißt nicht apache2, sondern httpd.

new-neighbour-event-installed =
    httpd ist installiert: seine Konfiguration liegt in /etc/httpd, seine
    Seiten in /var/www/html, seine Logs in /var/log/httpd. Anders als auf
    Debian startet das Installieren eines Dienstes ihn hier nicht: Auf
    Red-Hat-Systemen wartet ein neuer Dienst darauf, gestartet und aktiviert
    zu werden.

new-neighbour-event-running =
    httpd läuft und kommt nach einem Neustart wieder. curl http://localhost/
    auf kessel antwortet; die Pinnwand ist eine andere Geschichte: Zwischen
    ihnen steht die Firewall.

new-neighbour-event-not-enabled =
    httpd läuft, ist aber nicht aktiviert: Nach dem nächsten Neustart bliebe
    der Bildschirm des Cafés leer. systemctl kann beides auf einmal.

new-neighbour-event-blocked =
    Von der Pinnwand aus lehnt kessel sofort ab: Die Zone public von
    firewalld erlaubt ssh, cockpit und dhcpv6-client und weist den Rest
    zurück. firewall-cmd --list-all zeigt, was die Zone erlaubt; man
    firewall-cmd sagt, wie man einen Dienst hinzufügt.

new-neighbour-event-runtime-only =
    Die Regel wirkt jetzt: Sie ist in der Laufzeitkonfiguration von
    firewalld. In der permanenten ist sie nicht: Das nächste firewall-cmd
    --reload, oder der nächste Neustart, lädt die permanente Konfiguration
    und vergisst sie. Vergleiche firewall-cmd --list-all mit firewall-cmd
    --permanent --list-all.

new-neighbour-event-permanent-only =
    Die Regel ist in der permanenten Konfiguration, in
    /etc/firewalld/zones/public.xml. Aber firewalld filtert immer noch mit
    seiner Laufzeitkonfiguration, die sie noch nicht hat: Bis zu einem
    reload ändert sich nichts.

new-neighbour-event-lost =
    Der reload hat die permanente Konfiguration an die Stelle der
    Laufzeitkonfiguration geladen: Was nur zur Laufzeit da war, ist weg. Das
    ist der Sinn von --reload, und die Falle einer Änderung, die nur zur
    Laufzeit gemacht wurde.

new-neighbour-event-firewall-off =
    firewalld läuft nicht (oder startet beim Booten nicht): Jeder Port von
    kessel ist für das Netz des Cafés und für das Internet offen. Einen
    Dienst zu öffnen reicht; starte firewalld wieder (und aktiviere es).

new-neighbour-event-selinux-off =
    SELinux ist nicht mehr enforcing (setenforce, oder
    /etc/selinux/config). Es steht nicht zwischen der Pinnwand und httpd:
    Die Firewall tut es. Seun hat gebeten, es anzulassen: Schalte es wieder
    ein.

new-neighbour-event-reached =
    Die Pinnwand hat httpd erreicht: Was sie zeigt, ist die Testseite von
    Rocky, die Begrüßung, die httpd ausliefert, solange /var/www/html keine
    index.html hat (mit Status 403: welcome.conf macht aus dieser Ablehnung
    diese Seite). Die Website wird noch kommen.

new-neighbour-event-end =
    Dilnoza: „Thuy sagt, der Bildschirm zeigt eine Seite, auf der in großen
    Buchstaben ‚Test Page‘ steht. Man sagt mir, das sei eine gute
    Nachricht!“

    Gut gemacht! Du hast „Neue Nachbarschaft“ abgeschlossen.

    WAS PASSIERT IST
    kessel läuft mit Rocky Linux 10, aus der Red-Hat-Familie: dnf statt apt,
    httpd statt apache2, firewalld statt ufw. Du hast httpd mit dnf
    installiert, mit systemctl gestartet und aktiviert und http und https in
    der Zone public von firewalld erlaubt, zur Laufzeit und in der
    permanenten Konfiguration, sodass die Pinnwand ihn jetzt erreicht, und
    auch nach einem reload oder einem Neustart.

    GUTE PRAXIS
    - Schau, bevor du tippst: /etc/os-release (oder hostnamectl) sagt, auf
      welchem System du bist, und damit, welche Werkzeuge es hat.
    - firewalld hat zwei Konfigurationen: Laufzeit (was jetzt filtert) und
      permanent (was --reload und der nächste Boot laden). Ändere beide: der
      Befehl mit und ohne --permanent, oder die permanente und dann
      --reload, oder die Laufzeit und dann --runtime-to-permanent.
    - Erlaube einen Dienst über seinen Namen (http, https: firewall-cmd
      --info-service zeigt seine Ports) statt eines nackten Ports: Die
      Regel sagt, warum.
    - Prüfe von dort, wo die Nutzer·innen sind (hier die Pinnwand): curl
      localhost auf dem Server geht nicht durch die Firewall.
    - Lass SELinux auf enforcing; in den nächsten Kapiteln geht es darum,
      damit zu leben.

    EIN ANDERER WEG
    nftables liegt unter ufw wie unter firewalld (nft list ruleset zeigt,
    was firewalld gebaut hat). nftables-Regeln von Hand zu schreiben geht
    auch, aber auf einer Rocky-Maschine gehören sie firewalld: Bleib bei
    einem Werkzeug.

    DOKUMENTATION
    - Rocky Linux, firewalld für Einsteiger·innen: https://docs.rockylinux.org/guides/security/firewalld-beginners/
    - firewall-cmd(1): https://firewalld.org/documentation/man-pages/firewall-cmd.html
    - Befehlsreferenz von DNF: https://dnf.readthedocs.io/en/latest/command_ref.html
    - RHEL 10, Software mit DNF verwalten: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_software_with_the_dnf_tool/

## What the three chapters of the story share: kept here so that they load with the story.

language-cafe-site-index =
    <!doctype html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Common Tongue: die Tische dieser Woche</title><link rel="stylesheet" href="/css/style.css"></head>
    <body class="common-tongue-site">
    <h1>Common Tongue</h1>
    <p>Kostenlose Gesprächstische, jeden Donnerstag ab 18:30 im Café. Komm, wie du bist: Neuankommende und Nachbar·innen, jedes Niveau willkommen.</p>
    <p><a href="/tables.html">Die Tische dieser Woche</a></p>
    </body>
    </html>

language-cafe-site-tables =
    <!doctype html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Tische dieser Woche</title><link rel="stylesheet" href="/css/style.css"></head>
    <body class="common-tongue-site">
    <h1>Die Tische am Donnerstag</h1>
    <table>
    <tr><th>Tisch</th><th>Gastgeber·in</th></tr>
    <tr><td>Arabisch</td><td>Hamza</td></tr>
    <tr><td>Dari</td><td>Farida</td></tr>
    <tr><td>Spanisch</td><td>Itzel</td></tr>
    <tr><td>Tigrinya</td><td>Selam</td></tr>
    <tr><td>Ukrainisch</td><td>Oksana</td></tr>
    <tr><td>Vietnamesisch</td><td>Thuy</td></tr>
    <tr><td>Französisch und Englisch</td><td>alle</td></tr>
    </table>
    </body>
    </html>

language-cafe-old-index =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Common Tongue</title></head>
    <body><p>Common Tongue: Unsere neue Website kommt bald.</p></body></html>

language-cafe-rota =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Dienstplan der Ehrenamtlichen</title></head>
    <body class="common-tongue-rota">
    <h1>Dienstplan der Ehrenamtlichen (nur im Netz des Cafés)</h1>
    <p>Donnerstag: Aufbau um 18:00 (Hamza, Thuy), Tee und Kaffee (Farida), Abschließen um 21:00 (Itzel).</p>
    </body></html>

language-cafe-signup-page =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Als Ehrenamtliche·r anmelden</title></head>
    <body class="common-tongue-signup">
    <h1>Mach mit bei Common Tongue</h1>
    <form method="post" action="/signup"><label>Dein Name <input name="name"></label> <label>Sprachen, die du sprichst <input name="languages"></label> <button>Anmelden</button></form>
    </body></html>

language-cafe-signup-readme =
    signup: die Anmelde-App der Ehrenamtlichen (Tenzin)

    Eine kleine Python-App, von systemd ausgeführt (signup.service) als
    Konto signup. Sie lauscht nur auf 127.0.0.1:{ $port }: httpd ist ihre
    Eingangstür (siehe /etc/httpd/conf.d/signup.conf).
