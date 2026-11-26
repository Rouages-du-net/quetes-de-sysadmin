### Geschichte „Das Sprachcafé“, Kapitel „Keine Berechtigung, aber…“: Eine
### mit mv verschobene Website behält das SELinux-Label ihres
### Home-Verzeichnisses; httpd darf sie nicht lesen. ls -Z, das Audit-Log
### (ausearch, audit2why), semanage fcontext und restorecon. Befehle,
### Optionen, Pfade, Labels und Ausgaben werden nicht übersetzt.

chapter-wrong-label = Keine Berechtigung, aber…
    .summary = Die neue Website ist an ihrem Platz, die Rechte sehen perfekt aus, und der Bildschirm des Cafés zeigt eine Testseite. httpd wird etwas verweigert, das die Unix-Rechte erlauben: Finde heraus, wer verweigert, lies, warum, und behebe es so, dass es auch nach dem nächsten Relabel hält, ohne SELinux abzuschalten.

## Files

wrong-label-message-thuy =
    Von: Thuy (vietnamesischer Tisch, und Hüterin der Pinnwand)
    Samstag, 12. Dezember, 10:15

    Hallo!

    Itzel hat heute Morgen die neue Website auf kessel gelegt, und seitdem
    zeigt der Bildschirm an der Tür wieder die graue „Test Page“ statt der
    Tische. Sie hat die Rechte zweimal geprüft; sie hat mir sogar einen
    Screenshot von ls -l geschickt, alles rw-r--r--. Am Donnerstag kamen 40
    Leute; am Samstag haben wir Tag der offenen Tür, und ich hätte so gern
    die Tische auf dem Bildschirm.

    Kaveh, vom Verein nebenan, kommt heute Abend um 22:00, um kessel für ein
    Kernel-Update neu zu starten. Seun hat kessel dafür vorbereitet, hat er
    gesagt.

    Thuy

wrong-label-message-itzel =
    Von: Itzel
    Samstag, 12. Dezember, 09:45

    Ich habe die neue Website in meinem Home-Verzeichnis auf kessel gebaut
    (~/site) und sie dann nach /srv/site verschoben, wo Websites hingehören,
    habe ich gelesen. Genau das habe ich gemacht:

        sudo mkdir /srv/site
        cd ~/site && sudo mv css index.html tables.html /srv/site/

    Dann eine Datei für httpd, /etc/httpd/conf.d/commontongue.conf, mit
    DocumentRoot "/srv/site", und sudo systemctl restart httpd. Kein Fehler.
    Die Dateien sind für alle lesbar. Was will httpd denn noch?

    Itzel

## Events

wrong-label-event-test-page =
    Diese Testseite ist httpd, das 403 für „/“ sagt: welcome.conf von Rocky
    zeigt sie, wann immer httpd die Startseite verweigert. httpd hat die
    Website gefunden, durfte sie aber nicht lesen. Sein Fehler-Log
    (/var/log/httpd/error_log) sagt, welche Datei.

wrong-label-event-error-log =
    „Permission denied“ für eine Datei, die jedes Konto lesen darf: Die
    Unix-Rechte sind auf kessel nicht die einzigen. Jede Datei hat auch ein
    SELinux-Label, das ls zeigen kann (man ls, -Z), und jeder Prozess eins
    (ps -Z): Das von httpd ist httpd_t.

wrong-label-event-labels =
    user_home_t: das Label der Dateien eines Home-Verzeichnisses. mv
    vergibt keine neuen Labels: Die Dateien haben das Label behalten, das
    sie in Itzels Home-Verzeichnis hatten, und httpd_t darf user_home_t
    nicht lesen. Vergleiche mit /var/www/html (ls -Zd). Wer verweigert hat,
    und wann, steht im Audit-Log.

wrong-label-event-avc =
    Eine AVC ist die Verweigerung von SELinux: wer (scontext, httpd_t), was
    (tcontext, der Typ der Datei; tclass) und welches Recht ({"{"} read {"}"}),
    permissive=0: verweigert. audit2why erklärt eine Verweigerung (sein
    Paket fehlt vielleicht: dnf findet, welches Paket einen Befehl hat).

wrong-label-event-tools-missing =
    semanage, audit2why und audit2allow sind nicht in einer
    Minimalinstallation: Sie kommen mit einem Paket. dnf kann sagen, mit
    welchem (man dnf: provides).

wrong-label-event-tools =
    Die Werkzeuge der Policy sind da. audit2why liest Verweigerungen und
    sagt, warum; semanage fcontext -l sagt, welches Label die Policy jedem
    Pfad gibt. Was gibt sie /srv/site?

wrong-label-event-permissive =
    Permissive: SELinux verweigert nichts mehr, also wird die Website
    angezeigt; das beweist, dass SELinux die Ursache ist, aber jeder
    eingeschränkte Dienst auf kessel hat seinen Schutz verloren, nicht nur
    httpd. Schalte enforcing wieder ein (setenforce 1) und korrigiere
    stattdessen die Labels.

wrong-label-event-config-off =
    /etc/selinux/config sagt nicht mehr SELINUX=enforcing: Beim nächsten
    Booten (heute Abend, mit Kaveh) würde kessel ohne den Schutz von SELinux
    starten. Schreib enforcing wieder in die Datei.

wrong-label-event-chmod =
    Eine Datei der Website ist jetzt für alle beschreibbar (chmod 777 oder
    o+w): Die Unix-Rechte reichten httpd schon, sie waren nicht das Problem.
    Setz sie zurück (644 für Dateien, 755 für Verzeichnisse); was httpd
    fehlt, ist das Label.

wrong-label-event-home-boolean =
    httpd_read_user_content lässt httpd die Dateien jedes
    Home-Verzeichnisses lesen: Die Website würde angezeigt, aber auch alles,
    was irgendein Konto in seinem Home-Verzeichnis liegen lässt. Schalte es
    wieder ab; die Website sollte nicht wie ein Home-Verzeichnis aussehen.

wrong-label-event-module =
    Ein von audit2allow erstelltes Modul ist geladen: httpd_t darf jetzt
    alles lesen, was dieses Label hat, in /srv/site und in jedem
    Home-Verzeichnis. Es erlaubt, was verweigert wurde, nicht, was du
    gemeint hast. Entferne es (semodule -r) und gib den Dateien das richtige
    Label.

wrong-label-event-var-t =
    restorecon hat getan, was die Policy sagt: /srv/site ist var_t, wie
    alles unter /srv, das die Policy nicht kennt (semanage fcontext -l |
    grep /srv). httpd darf var_t auch nicht lesen. Die Policy muss erst
    lernen, was /srv/site ist; dann wendet restorecon es an.

wrong-label-event-rule =
    Die Policy kennzeichnet die Website jetzt als Webinhalt. Dateien
    behalten ihr aktuelles Label, bis etwas sie neu kennzeichnet:
    restorecon -Rv, dann prüf von der Pinnwand aus.

wrong-label-event-relabelled =
    22:00. Kaveh: „Ich habe kessel für das Kernel-Update neu gestartet. Das
    hat ewig gedauert: irgendwas mit ‚relabelling the file system‘? Thuy
    sagt, der Bildschirm zeigt wieder die Testseite.“

    Seun hatte /.autorelabel hinterlassen: Beim Booten wurde die ganze
    Platte nach der Policy neu gekennzeichnet. Mit chcon gesetzte Labels
    stehen nicht in der Policy: Sie sind weg, und /srv/site ist wieder
    var_t. Bring es der Policy bei (semanage fcontext), dann restorecon.

wrong-label-event-rebooted =
    22:00. Kaveh: „Ich habe kessel für das Kernel-Update neu gestartet.
    Sieht gut aus!“

    Diesmal lief kein Relabel (/.autorelabel war weg), also haben die von
    Hand gesetzten Labels überlebt. Sie stehen aber immer noch nicht in der
    Policy: Das nächste restorecon oder Relabel setzt wieder var_t. Bring
    es der Policy bei (semanage fcontext).

wrong-label-event-end =
    Thuy: „Die Tische sind auf dem Bildschirm, in sieben Sprachen. Itzel
    tanzt in der Küche.“

    Gut gemacht! Du hast „Keine Berechtigung, aber…“ abgeschlossen.

    WAS PASSIERT IST
    Itzel hat die Website mit mv aus ihrem Home-Verzeichnis verschoben, und
    mv behält das SELinux-Label einer Datei: Die Dateien blieben
    user_home_t, das httpd_t nicht lesen darf, also bekam httpd vom Kernel
    „Permission denied“, obwohl die Unix-Rechte es erlaubten (AH00132 in
    seinem Fehler-Log, eine AVC im Audit-Log). Die Policy selbst
    kennzeichnet /srv/site als var_t. Du hast der Policy beigebracht, dass
    /srv/site Webinhalt ist (semanage fcontext), und dann die Dateien danach
    neu gekennzeichnet (restorecon), sodass die Labels auch beim nächsten
    Relabel halten.

    GUTE PRAXIS
    - Ein „Permission denied“, das die Unix-Rechte nicht erklären können:
      Schau dir die Labels an (ls -Z, ps -Z) und das Audit-Log (ausearch -m
      avc -ts recent).
    - Kopiere an den Platz (cp, das der neuen Datei das Label ihres Platzes
      gibt) oder kennzeichne nach einem Verschieben neu: mv behält das alte
      Label.
    - Korrigiere die Policy, nicht die Datei: semanage fcontext -a -t
      httpd_sys_content_t "/srv/site(/.*)?" (oder -e /var/www /srv/site),
      dann restorecon -Rv /srv/site. chcon hält bis zum nächsten Relabel.
    - setenforce 0 ist eine Diagnose, die Sekunden dauert, nie eine Lösung;
      chmod 777 behebt nichts, was SELinux verweigert, und öffnet die
      Dateien für alle.
    - audit2allow schreibt eine Regel für das, was verweigert wurde: hier
      httpd, das Home-Verzeichnisse liest. Lies zuerst audit2why: Meist ist
      die Antwort ein Label, ein Port-Typ oder ein Boolean.
    - Oder nimm, was die Policy schon kennt: /var/www, oder /srv/www (die
      Policy kennzeichnet /srv/www, und /srv/irgendwas/www, als Webinhalt).

    DOKUMENTATION
    - RHEL 10, Using SELinux, Fehlersuche: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/troubleshooting-problems-related-to-selinux_using-selinux
    - semanage-fcontext(8): https://man7.org/linux/man-pages/man8/semanage-fcontext.8.html
    - restorecon(8): https://man7.org/linux/man-pages/man8/restorecon.8.html
    - Rocky Linux, SELinux lernen: https://docs.rockylinux.org/guides/security/learning_selinux/
