### Geschichte „Das Sprachcafé“, Kapitel „Ein Port und ein Boolean“: httpd
### darf nur an http_port_t binden und sich standardmäßig nicht mit anderen
### Ports verbinden. semanage port, setsebool -P, die Vorschläge von
### audit2why, eine Rich Rule von firewalld. Befehle, Optionen, Pfade,
### Labels und Ausgaben werden nicht übersetzt.

chapter-port-and-boolean = Ein Port und ein Boolean
    .summary = Ein Dienstplan der Ehrenamtlichen auf einem eigenen Port, eine Anmelde-App hinter httpd, und seit Freitag ist die ganze Website down. SELinux verweigert httpd einen Port und eine Verbindung: Gib ihm genau diese zwei, lass den Dienstplan im Netz des Cafés und sorge dafür, dass alles einen Neustart übersteht.

## Files

port-and-boolean-message-dilnoza =
    Von: Dilnoza
    Montag, 14. Dezember, 18:40

    Hallo noch einmal,

    die Website ist seit Freitagabend down: Der Bildschirm ist leer, und die
    Leute fragen, ob die Tische am Donnerstag ausfallen (tun sie nicht!).

    Am Freitag hat Tenzin zwei Dinge hinzugefügt, beide für unsere
    Ehrenamtlichen: eine Anmeldeseite (https://signup.commontongue.example,
    für alle, die helfen wollen) und den Dienstplan der Ehrenamtlichen, auf
    einem anderen „Port“, der nur aus dem eigenen Netz des Cafés zu sehen
    sein soll (den Computern des Cafés und der Pinnwand). Dann hat er
    irgendetwas neu gestartet und musste seinen Zug erwischen; er ist bis
    Mittwoch ohne Telefon in den Bergen. Seine Notizen liegen in deinem
    Home-Verzeichnis.

    Bitte bring alles zurück, auf die richtige Art, so wie Seun es mögen
    würde.

    Dilnoza

port-and-boolean-notes-tenzin =
    Notizen von Tenzin (Freitag, 11. Dezember, 17:55, in Eile)

    - signup: meine App, /opt/signup, ein systemd-Dienst (signup.service),
      lauscht auf 127.0.0.1:8086. httpd ist ihre Eingangstür:
      /etc/httpd/conf.d/signup.conf (ProxyPass).
    - Der Dienstplan: /var/www/volunteers, auf Port 8010:
      /etc/httpd/conf.d/volunteers.conf. Nur das Netz des Cafés
      (198.51.100.0/24) soll ihn sehen.
    - httpd -t sagte „Syntax OK“, dann ist systemctl restart httpd mit
      irgendeinem „Permission denied“ wegen eines Sockets gescheitert.
      Diesmal nicht die Dateien!
    - Ich habe audit2allow auf das Audit-Log losgelassen, und es hat mir ein
      Modul geschrieben, das alles erlauben würde (in meinem
      Home-Verzeichnis: /home/tenzin/httpd-fix.te). Ich habe es nicht
      geladen: Es sah nach ziemlich viel aus. Habe ich richtig gehandelt?

## Events

port-and-boolean-event-down =
    httpd konnte nicht starten: „make_sock: could not bind to address
    …:8010“, (13) Permission denied. Sonst lauscht dort nichts (ss -tlnp):
    Der Kernel hat httpd diesen Port verweigert. Welcher Teil des Kernels
    verweigert einem Programm einen Port? Das Audit-Log weiß es.

port-and-boolean-event-bind-avc =
    { "{" } name_bind { "}" } auf einem tcp_socket, tcontext
    unreserved_port_t: httpd_t darf nur auf Ports lauschen, denen die Policy
    den Typ http_port_t gibt (80, 443, 8008, 8009, 8443, 9000…: semanage
    port -l), und 8010 ist für die Policy kein Web-Port. Einem Port kann man
    einen Typ geben, wie einer Datei ein Label.

port-and-boolean-event-nis =
    nis_enabled lässt jedes Programm, das NSS benutzt (fast jeder Dienst),
    auf jedem nicht reservierten Port lauschen und sich verbinden: audit2why
    schlägt es vor, weil es funktionieren würde, nicht weil es passt.
    Schalte es ab (und mit -P ab) und gib httpd genau den Port, den es
    braucht.

port-and-boolean-event-module =
    Ein Modul von audit2allow ist geladen: httpd_t darf jetzt auf jedem
    nicht reservierten Port lauschen und sich verbinden, das ist weit mehr
    als 8010 und 8086. Tenzin hatte recht, es nicht zu laden: Entferne es
    (semodule -r) und nutze die Mittel der Policy selbst, einen Port-Typ
    und einen Boolean.

port-and-boolean-event-port =
    8010 ist für die Policy jetzt ein Web-Port (semanage port -l | grep
    http). httpd hat seine Konfiguration gelesen, als es zuletzt versucht
    hat zu starten: Starte es noch einmal.

port-and-boolean-event-up =
    httpd ist zurück, und mit ihm die Website des Cafés. Jetzt die zwei
    neuen Dinge: die Anmeldeseite (curl mit ihrem Namen: -H 'Host:
    signup.commontongue.example') und der Dienstplan auf 8010 (von der
    Pinnwand aus).

port-and-boolean-event-proxy-503 =
    503 für die Anmeldeseite: httpd konnte die App dahinter nicht erreichen
    (AH01114 in seinem Fehler-Log). Die App läuft (systemctl status signup,
    curl 127.0.0.1:8086 auf kessel antwortet): Wer hat httpd die Verbindung
    verweigert?

port-and-boolean-event-connect-avc =
    { "{" } name_connect { "}" }: httpd_t wurde die Verbindung zu Port 8086 verweigert.
    Standardmäßig darf httpd sich mit gar keinem anderen Port verbinden; die
    Policy bietet einen Boolean für einen Reverse Proxy. audit2why nennt ihn
    (und noch einen, zu breit: Lies die Beschreibungen).

port-and-boolean-event-label-8086 =
    8086 ist jetzt http_port_t, aber httpd darf sich immer noch nicht damit
    verbinden: Standardmäßig darf httpd_t sich mit keinem Port verbinden,
    nicht einmal mit einem Web-Port (nur mit httpd_can_network_relay oder
    httpd_graceful_shutdown, beide aus). Port-Typen helfen beim Lauschen;
    Verbinden ist Sache eines Booleans.

port-and-boolean-event-boolean-runtime =
    httpd_can_network_connect ist an, bis zum nächsten Neustart: setsebool
    ohne -P ändert nur die laufende Policy. Beim nächsten Booten würde die
    Anmeldeseite wieder mit 503 antworten.

port-and-boolean-event-boolean =
    httpd_can_network_connect ist an, jetzt und beim nächsten Booten: httpd
    darf sich mit seinem Backend verbinden. Prüf die Anmeldeseite.

port-and-boolean-event-open-to-all =
    Port 8010 ist für alle offen: Der Dienstplan, mit Namen und Zeiten der
    Ehrenamtlichen, ist im Internet. Nur das Netz des Cafés
    (198.51.100.0/24) soll ihn erreichen: Die Rich Rules von firewalld
    können „nur von dieser Quelle“ sagen (man firewall-cmd, und
    firewalld.richlanguage).

port-and-boolean-event-rota-office =
    Der Dienstplan ist aus dem Netz des Cafés erreichbar, und nur von dort.
    Halte die Regel sowohl zur Laufzeit als auch in der permanenten
    Konfiguration.

port-and-boolean-event-end =
    Dilnoza: „Der Bildschirm zeigt die Tische, Hamza hat sich für Donnerstag
    angemeldet, und der Dienstplan ist wieder auf dem Computer des Cafés.
    Tenzin wird erleichtert sein.“

    Gut gemacht! Du hast „Ein Port und ein Boolean“ abgeschlossen.

    WAS PASSIERT IST
    Tenzins neuer virtueller Host lauschte auf 8010, einem Port, dem SELinux
    keinen Web-Typ gibt (unreserved_port_t): httpd_t wurde name_bind
    verweigert, und ein httpd, das einen seiner Sockets nicht öffnen kann,
    startet überhaupt nicht. Du hast 8010 den Typ http_port_t gegeben
    (semanage port -a), also startet httpd. Hinter der Anmeldeseite muss
    httpd sich mit der App auf 127.0.0.1:8086 verbinden, was httpd_t
    standardmäßig nicht darf: httpd_can_network_connect, mit -P gesetzt,
    erlaubt es dauerhaft. Und eine Rich Rule lässt nur das Netz des Cafés
    den Dienstplan erreichen.

    GUTE PRAXIS
    - Ein Dienst, der einen Port nicht binden kann, mit „Permission denied“,
      und sonst lauscht dort nichts: Such nach einer AVC (name_bind), dann
      semanage port -a -t mit dem Typ, den seine Domäne benutzen darf
      (http_port_t für httpd).
    - Ein Reverse Proxy, der mit 503 antwortet: name_connect. Die Policy hat
      Booleans für die üblichen Bedürfnisse (getsebool -a | grep httpd);
      setz sie mit -P, sonst sind sie beim nächsten Booten weg.
    - Lies die Vorschläge von audit2why: nis_enabled funktioniert und öffnet
      jeden nicht reservierten Port für jeden Dienst, der NSS benutzt. Wähl
      den engsten.
    - audit2allow -M schreibt, was verweigert wurde, so breit, wie es
      verweigert wurde: Es ist das letzte Mittel, nach den Labels, den
      Port-Typen und den Booleans; lies die .te-Datei vor jedem semodule -i.
    - Eine Rich Rule (Quelladresse, Port, accept) hält einen Dienst in einem
      Netz; firewall-cmd --add-port öffnet ihn für alle.

    DOKUMENTATION
    - RHEL 10, Using SELinux, nicht standardmäßige Konfigurationen: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/configuring-selinux-for-applications-and-services-with-non-standard-configurations_using-selinux
    - semanage-port(8): https://man7.org/linux/man-pages/man8/semanage-port.8.html
    - setsebool(8): https://man7.org/linux/man-pages/man8/setsebool.8.html
    - Die Rich Language von firewalld: https://firewalld.org/documentation/man-pages/firewalld.richlanguage.html
    - Apache, Leitfaden zum Reverse Proxy: https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html
