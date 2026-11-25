### Der Fehlererklärer (src/engine/explainer.ts): eine kurze Erklärung, die
### unter der Ausgabe eines fehlgeschlagenen Befehls angeboten wird und die man
### öffnen kann. Sie sagt, was die Meldung bedeutet und wo man nachsehen kann
### (eine Handbuchseite, ein Diagnosebefehl), nie die Antwort des Kapitels.
###
### Das Attribut .match jeder Erklärung listet die Fehlermeldungen, auf die sie
### antwortet, eine pro Zeile, so wie das Spiel sie in dieser Sprache ausgibt:
### * steht für beliebigen Text, ein $ am Ende für das Zeilenende. Die
### englischen Marker werden immer mitgelesen (viele Werkzeuge antworten
### unabhängig von der Sprache auf Englisch): Hier stehen nur die Meldungen, die
### das Spiel auf Deutsch ausgibt (wie mit LANG=de_DE.UTF-8), sonst fehlt .match.
### Eine Zeile darf in Fluent nicht mit [, * oder . beginnen, und geschweifte
### Klammern sind zu vermeiden.

explainer-button = Was bedeutet dieser Fehler?
explainer-label = Der Fehler, erklärt:

explainer-sudo-password = sudo fragt nach deinem eigenen Passwort, dem des Kontos, mit dem du angemeldet bist, nicht nach dem von root. Beim Tippen erscheint nichts, keine Sternchen, keine Punkte: Das ist normal. Nach drei falschen Versuchen gibt sudo auf; führe den Befehl noch einmal aus, um eine neue Eingabeaufforderung zu bekommen.
    .match =
        Sorry, versuchen Sie es noch einmal.
        Fehlversuche bei der Passwort-Eingabe

explainer-sudoers = sudo weiß, wer du bist, und seine Richtlinie sagt, dass dein Konto diesen Befehl auf dieser Maschine nicht als root ausführen darf: Das ist eine Regel, kein falsches Passwort. Die Regeln stehen in /etc/sudoers und in den Dateien von /etc/sudoers.d. sudo -l listet, was du ausführen darfst; man sudoers erklärt, wie eine Regel geschrieben wird.
    .match =
        darf sudo auf * nicht ausführen
        darf * als * auf * nicht ausführen

explainer-ssh-denied = Der SSH-Server hat geantwortet, dich aber nicht hereingelassen: Konto, Schlüssel oder Passwort haben nicht gepasst. Die Wörter in Klammern sind die Methoden, die er akzeptiert (publickey, password). ssh -v zeigt jeden Schlüssel, den ssh probiert, und die Antworten des Servers; auf dem Server erzählt das Authentifizierungs-Log seine Seite der Geschichte.

explainer-config-test = Die Konfigurationsprüfung hat einen Fehler gefunden und die Konfiguration abgelehnt. Lies die mit [emerg] markierte Zeile (oder die vor „test failed“): Sie nennt die Datei und die Zeilennummer, wie in datei:12. Der Fehler steht oft in dieser Zeile oder direkt darüber, ein fehlendes Semikolon oder eine fehlende schließende Klammer. Steht dort stattdessen Permission denied, brauchte die Prüfung selbst die Rechte von root.

explainer-yaml = Die YAML-Datei konnte nicht gelesen werden. YAML ist streng bei der Einrückung: nur Leerzeichen, nie Tabulatoren, und die Einträge unter einem Schlüssel müssen genau untereinander stehen. Die Meldung nennt eine Zeilennummer, aber der eigentliche Fehler steht oft ein oder zwei Zeilen darüber; cat -A zeigt Tabulatoren als ^I.

explainer-unit-not-found = systemd kennt keine Unit mit diesem Namen. Prüf die Schreibweise: Es ist der Name der Unit-Datei, der sich von dem des Programms unterscheiden kann (apache2, nicht httpd, unter Debian). systemctl list-unit-files zeigt die Units, die es kennt; ein nicht installiertes Paket bringt keine Unit mit.

explainer-unit-failed = systemd hat den Dienst gestartet, und das Programm hat mit einem Fehler aufgehört; der Grund steht nicht in dieser Meldung. systemctl status zeigt die letzten Zeilen des Logs des Dienstes, und journalctl -u mit dem Namen der Unit zeigt alle. Lies von unten nach oben: Der erste echte Fehler steht meist direkt über den Zeilen, die sagen, dass die Unit fehlgeschlagen ist.

explainer-db-access-denied = Der Datenbankserver hat geantwortet und dieses Konto abgelehnt. Ein MariaDB- oder MySQL-Konto ist ein Benutzername UND die Adresse, von der er kommt ('app'@'198.51.100.134'): Derselbe Name von einer anderen Adresse ist ein anderes Konto, oder gar keins („is not allowed to connect“). „using password: NO“ heißt, dass kein Passwort gesendet wurde (-p fragt danach); für root unter Debian meldet sich sudo mariadb ohne Passwort über den Socket an. „command denied“ heißt, das Konto ist hereingekommen, aber ihm fehlt dieses Privileg auf dieser Tabelle. SELECT user, host, plugin FROM mysql.user und SHOW GRANTS FOR 'user'@'host' zeigen, was existiert.

explainer-db-unreachable = Der Datenbank-Client konnte keinen Server erreichen. Über den Socket (ohne -h oder mit -h localhost) läuft der Server wahrscheinlich nicht: systemctl status mariadb, dann journalctl -u mariadb, um zu sehen, warum er aufgehört hat. Über das Netzwerk (-h mit einer Adresse) lauscht dort nichts, oder eine Firewall steht im Weg: Auf dem Server zeigt ss -tlnp, wo mariadbd lauscht (bind-address in seiner Konfiguration), und die Regeln der Firewall, wer Port 3306 erreichen darf.

explainer-db-too-many = Alle Verbindungsplätze des Datenbankservers sind belegt (max_connections). Bevor du die Grenze erhöhst, schau, wer sie hält: SHOW PROCESSLIST (als root, das einen zusätzlichen Platz behält) zeigt jede Verbindung, woher sie kommt und ob sie schläft. Viele schlafende Verbindungen einer App heißen meist, dass die App sie nicht schließt; wait_timeout bestimmt, wie lange der Server wartet, bevor er sie selbst schließt.

explainer-ups-unknown = upsd hat geantwortet, bedient aber keine USV mit diesem Namen. Der Name einer USV ist ihr Abschnitt in /etc/nut/ups.conf des Servers, geschrieben NAME@HOST (standardmäßig localhost): upsc -l HOST listet die Namen, die dieser Server kennt. In upsmon.conf überwacht eine MONITOR-Zeile mit einer USV, die es nicht gibt, gar nichts: upsmon wird nie sehen, dass sie auf Batterie läuft.

explainer-ups-denied = upsd hat dieses Konto abgelehnt. Jedes Konto in /etc/nut/upsd.users des Servers sagt, was es darf: instcmds (die Sofortbefehle für upscmd, oder ALL), actions = SET (um Variablen mit upsrw zu ändern), upsmon primary oder secondary (für upsmon). Ein falscher Benutzername oder ein falsches Passwort ergibt dieselbe Antwort. upsd liest upsd.users neu, wenn es neu geladen wird (systemctl reload nut-server).

explainer-ups-driver = upsd kennt diese USV, aber ihr Treiber läuft nicht oder hat die USV verloren: upsd hat keine Daten, die es geben könnte. Der Treiber ist unter Debian ein eigener Dienst (systemctl status nut-driver@NAME, journalctl -u nut-driver@NAME), gestartet aus dem Abschnitt der USV in /etc/nut/ups.conf; prüf auch das USB-Kabel.

explainer-db-syntax = Der Datenbankserver konnte die SQL-Anweisung nicht lesen. Der Text nach „near“ ist die Stelle, an der er aufgehört hat zu verstehen: Der Fehler steht direkt davor, oft ein fehlendes Komma oder Anführungszeichen, ein falsch geschriebenes Wort oder eine Anweisung, die dieser Server nicht kennt. Eine in der Shell zwischen doppelten Anführungszeichen getippte Anweisung behält ihre einfachen Anführungszeichen: mariadb -e "SELECT … WHERE name = 'x'".

explainer-db-read-only = Der Datenbankserver ist schreibgeschützt (seine Variable read_only ist an): Er lehnt Schreibzugriffe gewöhnlicher Konten ab. Auf einer Replica ist das Absicht: Geschrieben wird auf dem Primary, und die Replica bekommt die Änderungen. SELECT @@read_only zeigt die Einstellung; verbinde dich zum Schreiben mit dem Primary.

explainer-sieve-compile = Das Sieve-Skript konnte nicht kompiliert werden, also kann es nicht laufen. Die Meldung nennt die Zeile des Skripts und nur das erste Problem: Ein unbekannter Befehl ist oft ein Tippfehler oder eine Erweiterung, die benutzt wird, ohne oben angefordert zu sein (require ["fileinto", "vacation"];); „expected end of command ';'“ heißt, dass am Ende der Zeile davor ein Semikolon fehlt. Korrigiere es und kompiliere dann mit sievec erneut, bevor du das Skript aktivierst.

explainer-dovecot-config = Dovecot kann seine Konfiguration nicht lesen: Datei und Zeile stehen in der Meldung. „Unknown setting“ ist eine falsch geschriebene Einstellung (oder eine aus einer anderen Dovecot-Version: 2.4 hat viele umbenannt), „Missing '{"}"}'“ ein offen gelassener Abschnitt. Solange die Datei falsch ist, brechen doveadm und doveconf ab, und ein Reload behält die alte Konfiguration. doveconf -n liest sie nach der Korrektur erneut.

explainer-mail-unknown-user = Der Benutzer steht nicht in der userdb von Dovecot. Die Benutzer von Dovecot sind das, was seine userdb liefert (hier eine passwd-file), nicht die Konten der Maschine, und der Name ist meist die ganze Adresse: benutzer@domain. doveadm user '*' listet die Benutzer, die Dovecot kennt.

explainer-search-query = doveadm hat die Suchanfrage nicht verstanden. Jeder Schlüssel nimmt seinen Wert direkt dahinter (mailbox Trash, savedbefore 2031-01-01, larger 5M); ein Datum ist JJJJ-MM-TT oder ein Intervall wie 30d oder 2w (eine Einheit für Jahre gibt es nicht); OR steht zwischen zwei Schlüsseln, und Klammern müssen für die Shell maskiert werden. man doveadm-search-query listet die Schlüssel.

explainer-refused = Die Maschine hat geantwortet, aber nichts hat die Verbindung auf diesem Port angenommen: Kein Programm lauscht dort, oder eine Firewall weist sie aktiv ab. Auf dem Server listet ss -tlnp die Ports, auf denen Programme lauschen, und systemctl status sagt, ob der Dienst läuft. Prüf auch die Adresse und den Port, die du benutzt hast.

explainer-timed-out = Keine Antwort kam zurück, bevor das Werkzeug aufgegeben hat. Die Pakete wurden wahrscheinlich unterwegs verworfen, oft von einer Firewall, die verwirft statt abzuweisen, oder die Maschine ist aus, oder die Adresse ist falsch. Vergleiche mit „Connection refused“, was heißt, dass die Maschine geantwortet hat.

explainer-no-route = Deine Maschine hat keinen Weg zu dieser Adresse gefunden: Keine Route führt dorthin, oder ein Router oder die Firewall auf der anderen Seite hat geantwortet, dass sie unerreichbar ist. ip route zeigt, wohin deine Maschine ihre Pakete schickt; prüf auch die Adresse selbst.

explainer-resolve = Der Name konnte nicht in eine Adresse umgewandelt werden: Das ist ein DNS-Problem (oder eines in /etc/hosts), kein Problem des Servers selbst. Prüf zuerst die Schreibweise; dann zeigt dig oder host, was DNS für den Namen antwortet, und /etc/resolv.conf, welchen Server deine Maschine fragt.

explainer-address-in-use = Das Programm wollte auf einem Port lauschen, den schon ein anderes Programm belegt: Nur ein Programm gleichzeitig kann auf einer Adresse und einem Port lauschen. ss -tlnp zeigt, welches Programm ihn hat. Zwei Dienste, die auf denselben Port eingerichtet sind, oder eine alte Kopie, die noch läuft, sind die üblichen Ursachen.

explainer-read-only = Dieses Dateisystem ist schreibgeschützt eingehängt: Niemand kann darauf schreiben, nicht einmal root, egal welche Rechte. mount oder findmnt zeigt die Option ro. Das System hängt eine Platte nach schweren Fehlern manchmal von selbst schreibgeschützt neu ein, deshalb lohnt es sich, zuerst dmesg und das Journal zu lesen.
    .match =
        Das Dateisystem ist nur lesbar

explainer-no-space = Der Speicher, auf dem diese Datei liegt, ist voll, oder es ist kein Inode mehr frei (einer pro Datei). df -h zeigt den freien Platz jedes Dateisystems und df -i seine Inodes; du hilft zu finden, was den Platz belegt. Eine gelöschte Datei, die ein Programm noch offen hält, behält ihren Platz, bis das Programm sie schließt (lsof).
    .match =
        kein Speicherplatz mehr verfügbar

explainer-syntax = Die Shell konnte die Zeile nicht lesen, also lief nichts: Ein Zeichen, das für sie etwas bedeutet, steht an einer Stelle, wo es nicht passt (ein |, ein ;, eine Klammer, ein Wort wie then oder done), oder ein Anführungszeichen oder ein Block wurde offen gelassen. Schau dir das Symbol an, das die Meldung nennt, und prüf, dass jedes Anführungszeichen geschlossen ist. man bash, Abschnitt SHELL GRAMMAR, gibt die Regeln.
    .match =
        Syntaxfehler beim unerwarteten Symbol
        Syntaxfehler: Unerwartetes Dateiende

explainer-ps-not-recognized = PowerShell (oder cmd.exe) hat kein Cmdlet, keine Funktion und kein Programm mit diesem Namen gefunden. Prüf die Schreibweise: Cmdlets heißen Verb-Nomen, wie Get-Service, und ein Skript im aktuellen Verzeichnis läuft mit .\ vor seinem Namen. Get-Command listet die Befehle, die diese Maschine kennt; manche stammen aus einem Modul, das nur bestimmte Maschinen haben.

explainer-not-found = Die Shell hat kein Programm mit diesem Namen gefunden. Prüf die Schreibweise und die Groß- und Kleinschreibung (ls, nicht LS). Vielleicht ist das Programm auf dieser Maschine nicht installiert oder in diesem Kapitel noch nicht freigeschaltet: hilfe listet die Befehle, die du hast, und man -k durchsucht das Handbuch nach Stichwort.
    .match =
        Befehl nicht gefunden
        Diesen Befehl hast du in diesem Kapitel noch nicht

explainer-access-denied = Windows hat den Zugriff verweigert: Dein Konto hat keine Berechtigung auf diese Datei, dieses Verzeichnis, diesen Schlüssel oder diesen Dienst. Bei einer Freigabe gelten die Rechte der Freigabe und die NTFS-Rechte zugleich, und die strengeren gewinnen. Get-Acl (oder icacls) zeigt, wer was darf, und whoami /groups die Gruppen, die dein Konto mitbringt.

explainer-permission = Das System hat abgelehnt: Deinem Konto fehlt das Recht, das dafür auf dieser Datei oder diesem Verzeichnis nötig ist (r zum Lesen, w zum Schreiben, x zum Betreten eines Verzeichnisses oder zum Ausführen eines Programms). ls -l zeigt den Besitzer, die Gruppe und die Rechte für jeden von ihnen und für die anderen, und jedes Verzeichnis auf dem Weg muss dich durchlassen. Manche Dateien gehören absichtlich root: Lies die Rechte, bevor du zu sudo greifst.
    .match =
        Keine Berechtigung
        Zugriff verweigert

explainer-not-permitted = Die Operation selbst ist für dein Konto nicht erlaubt, egal welche Rechte: Nur der Besitzer einer Datei (oder root) darf ihre Rechte oder ihren Besitzer ändern, und nur root darf den Prozessen eines anderen Kontos ein Signal schicken. Sogar root bekommt diese Meldung bei einer unveränderlich gemachten Datei: lsattr zeigt das Flag i. man chmod, man kill und man chattr erklären jeden Fall.
    .match =
        Die Operation ist nicht erlaubt

explainer-not-directory = Ein Teil des angegebenen Pfads ist eine Datei, kein Verzeichnis: Darin kann nichts liegen, und cd kann nicht hinein. ls -l unterscheidet sie: Die Zeile eines Verzeichnisses beginnt mit d. Prüf den Pfad Stück für Stück.
    .match =
        Ist kein Verzeichnis

explainer-is-directory = Der Befehl erwartete eine Datei und hat ein Verzeichnis bekommen. ls zeigt, was ein Verzeichnis enthält; cat, nano und eine Umleitung (>) funktionieren nur mit Dateien. Ein ganzes Verzeichnis zu löschen oder zu kopieren braucht eine Option: siehe man rm und man cp.
    .match =
        Ist ein Verzeichnis

explainer-no-such-file = Unter diesem Pfad existiert nichts, so wie er geschrieben ist. Ein Pfad, der nicht mit / beginnt, ist relativ: Er geht vom aktuellen Verzeichnis aus, das pwd anzeigt; einer, der mit / beginnt, geht von der Wurzel aus. Namen unterscheiden Groß- und Kleinschreibung (Notizen ist nicht notizen), und Tab vervollständigt nur einen Namen, der existiert: ein guter Test.
    .match =
        Datei oder Verzeichnis nicht gefunden

## The setting, next to Tips and Autosave.
display-explainer = Fehlerhilfe
display-explainer-title = Unter häufigen Fehlermeldungen eine kurze Erklärung anbieten

explainer-s3-date = Der Objektspeicher hat die Anfrage wegen ihres Datums abgelehnt. Jede S3-Anfrage wird mit Datum und Uhrzeit der Maschine signiert, die sie sendet: Amazon S3 lehnt eine ab, die mehr als 15 Minuten von seiner eigenen Uhr abweicht (RequestTimeTooSkewed), Garage eine, die mehr als 24 Stunden vor seiner Uhr datiert ist („Date is too old“); eine vorsignierte URL wird abgelehnt, sobald ihr X-Amz-Expires abgelaufen ist. Der Server ist nicht das Problem: date und timedatectl zeigen die Uhr dieser Maschine und ob NTP sie richtig hält.

explainer-s3-region = Die Anfrage wurde für eine andere Region signiert als die des Speichers. Die Region ist Teil der Signatur (ihr Scope: datum/region/s3/aws4_request), daher macht eine falsche Region die Signatur ungültig, selbst mit dem richtigen Schlüssel. Die Meldung nennt den Scope, den der Server erwartet hat: Trag diese Region in die Konfiguration des Clients ein (region in ~/.aws/config oder rclone.conf, oder --region).

explainer-s3-access-denied = Der Objektspeicher kennt den Schlüssel (oder hat eine Anfrage ohne Schlüssel abgelehnt) und lässt ihn das nicht tun. „Operation is not allowed for this key“ heißt, dem Schlüssel fehlt die Berechtigung auf diesem Bucket (read zum Auflisten und Holen, write zum Ablegen und Löschen, owner für die Einstellungen des Buckets); „No such key“ eine Access-Key-ID, die er nicht kennt; „Invalid signature“ ein falsches Secret; „anonymous access“ eine Anfrage ohne Schlüssel. Bei Garage zeigt sudo garage bucket info BUCKET die Berechtigungen jedes Schlüssels; aws configure list zeigt, welchen Schlüssel der Client benutzt.

explainer-s3-no-bucket = Kein Bucket hat diesen Namen in diesem Speicher. Prüf die Schreibweise (Bucket-Namen sind kleingeschrieben) und dass der Client mit dem richtigen Endpunkt spricht (--endpoint-url, endpoint_url in ~/.aws/config, endpoint in rclone.conf): Ein anderer Speicher hat andere Buckets. aws s3 ls listet die Buckets, die dieser Schlüssel benutzen darf; bei Garage listet sudo garage bucket list alle.

explainer-s3-credentials = Das AWS-Kommandozeilenwerkzeug hat keinen Schlüssel zum Signieren gefunden. Es sucht auf der Kommandozeile (--profile), in der Umgebung (AWS_ACCESS_KEY_ID und AWS_SECRET_ACCESS_KEY, AWS_PROFILE), dann in ~/.aws/credentials und ~/.aws/config, im Home-Verzeichnis des Benutzers, der es ausführt: unter sudo ist das das Home von root, nicht deins. aws configure list zeigt, was es gefunden hat und wo.

explainer-garage-layout = Garage hat die Layout-Änderung nicht angewendet. Ein Layout wird in zwei Schritten geändert: Änderungen werden vorgemerkt (garage layout assign, remove) und dann mit garage layout apply --version N angewendet, wobei N die nächste Version ist, die garage layout show ausgibt, damit niemand ein Layout anwendet, das er nicht gelesen hat. Ein Layout muss außerdem mindestens so viele Knoten mit einer Kapazität behalten, wie der Replikationsfaktor beträgt.

explainer-firewalld-auth = firewall-cmd darf die Konfiguration von firewalld als jeder Benutzer lesen, aber sie zu ändern braucht root: Über ssh kann kein polkit-Agent nach einem Passwort fragen. Führe den Befehl mit sudo aus.

explainer-firewalld-not-running = Der Daemon firewalld läuft nicht, also hat firewall-cmd niemanden zum Reden (und nichts filtert). systemctl status firewalld sagt, warum; systemctl enable --now firewalld startet ihn und behält ihn beim Booten.

explainer-dnf-root = Pakete zu installieren oder zu entfernen verändert das System: dnf braucht root. Führe es mit sudo noch einmal aus (search, info und list funktionieren ohne).

explainer-httpd-bind = httpd konnte keinen Socket öffnen. Mit (98) Address already in use lauscht ein anderes Programm auf diesem Port (ss -tlnp). Mit (13) Permission denied und sonst nichts dort darf httpd_t auf einem System mit SELinux nur die Ports mit dem Typ http_port_t binden: Such nach einem AVC (ausearch -m avc) und gib dem Port diesen Typ mit semanage port -a -t http_port_t -p tcp PORT. Solange ein Socket scheitert, startet httpd überhaupt nicht.

explainer-selinux-denied = „Permission denied“, obwohl die Unix-Rechte es erlauben: Auf einem System mit SELinux kann der Kernel verweigern, was das Label der Datei der Domäne des Programms nicht erlaubt. Vergleiche die Labels (ls -Z, ps -Z), lies die Verweigerungen (sudo ausearch -m avc -ts recent | audit2why) und korrigiere das Label in der Richtlinie (semanage fcontext, dann restorecon), statt SELinux abzuschalten.
explainer-tofu-lock = OpenTofu konnte den State nicht sperren: Ein anderer Lauf hält die Sperre, und OpenTofu wartet auf niemanden. Lock Info sagt, wer sie genommen hat, für welche Operation und wann. Bei einem lokalen State (terraform.tfstate) gehört die Sperre diesem Prozess: Prüf, ob er noch läuft (ps), und lass ihn fertig werden oder stoppe ihn; tofu force-unlock hilft nur bei entfernten States, und -lock=false riskiert, dass zwei Läufe gleichzeitig den State schreiben.

explainer-tofu-init = Dieses Arbeitsverzeichnis ist nicht initialisiert oder passt nicht mehr zu seiner Konfiguration: Der benötigte Provider ist nicht installiert oder nicht in .terraform.lock.hcl festgehalten. tofu init installiert die Provider und schreibt die Lock-Datei; nach einer Änderung der Versionsbedingung tofu init -upgrade.

explainer-tofu-variable = Eine Variable ist deklariert (ein variable-Block), aber nichts gibt ihr einen Wert: kein default, keine .tfvars-Datei, kein -var. Ein mit -var gegebener Wert gilt nur für diesen Befehl; terraform.tfvars und *.auto.tfvars-Dateien werden jedes Mal gelesen, ebenso TF_VAR_name-Variablen der Umgebung.

explainer-tofu-argument = Die Konfiguration passt nicht zum Schema des Providers: ein Argument, das er nicht kennt (oft ein Tippfehler, dann schlägt OpenTofu den richtigen Namen vor), ein fehlendes Pflichtargument oder ein Block an der falschen Stelle. Die Meldung nennt Datei und Zeile; tofu validate prüft alles, ohne etwas anzufassen, und die Dokumentation des Providers listet die Argumente jeder Ressource.
explainer-podman-subids = Rootless Podman baut für das Konto einen User Namespace: Darin ist 0 das Konto selbst, und 1, 2, 3… sind seine untergeordneten IDs, gelesen aus /etc/subuid und /etc/subgid (KONTO:ERSTE:ANZAHL). Ein Konto ohne Bereich bekommt einen Namespace mit einer einzigen ID, und kein Image, dessen Dateien anderen IDs gehören, kann darin entpackt werden. Schau dir beide Dateien an (man subuid); usermod --add-subuids und --add-subgids fügen einen Bereich hinzu. Podman behält den Namespace des Kontos: Nach einer Änderung der Dateien baut podman system migrate ihn neu.

explainer-privileged-port = Ein Programm, das nicht root ist, kann nicht auf einem Port unterhalb von net.ipv4.ip_unprivileged_port_start lauschen (standardmäßig 1024): Bei rootless Podman läuft das Programm, das den Port veröffentlicht (pasta oder rootlessport), unter deinem Konto. Veröffentliche einen Port ab 1024 und überlass 80 und 443 einem Reverse Proxy (nginx, Caddy), der dorthin weiterleitet. Den sysctl herabzusetzen öffnet diese Ports für die Programme aller Konten, nicht nur für deine.

explainer-user-bus = systemctl --user (und journalctl --user) sprechen mit dem eigenen Dienstmanager deines Kontos über seinen Bus, den sie über $XDG_RUNTIME_DIR finden (/run/user/UID). Eine Anmeldung setzt ihn (pam_systemd); sudo, su und cron nicht. Der Manager muss außerdem laufen: Er startet mit der ersten Sitzung des Kontos, oder beim Booten, wenn das Konto lingert (loginctl enable-linger). Von root aus erreicht systemctl --user -M KONTO@ den Manager eines anderen Kontos.
explainer-apparmor-root = Die Richtlinie von AppArmor zu lesen oder zu ändern ist Sache von root: die im Kernel geladenen Profile, welche Prozesse sie einsperren, eines laden oder entfernen. Führe den Befehl mit sudo aus. (aa-status --enabled allein funktioniert ohne.)

explainer-apparmor-parser = apparmor_parser konnte das Profil nicht lesen, also hat es nichts geladen: Der Kernel behält die Version, die er hatte. Die Meldung nennt die Datei und die Zeile („in profile“ gibt die Datei an, in der der Fehler steht, vielleicht eine eingebundene); jede Regel endet mit einem Komma, und ein fehlendes Komma wird in der nächsten Zeile gemeldet. Eine Datei aus local/ oder abstractions/ ist kein Profil: Lade das Profil, das sie einbindet. man apparmor.d gibt die Syntax; apparmor_parser -Q prüft eine Datei, ohne sie zu laden.

explainer-sops-no-key = sops konnte den Datenschlüssel der Datei nicht entschlüsseln: Keine der gefundenen age-Identitäten passt zu den Empfängern der Datei (unter Group 0 aufgeführt), oder es hat gar keine gefunden. Es liest SOPS_AGE_KEY, SOPS_AGE_KEY_FILE und ~/.config/sops/age/keys.txt des Kontos, das es ausführt (unter sudo die von root). Entweder wurde die Datei nicht für deinen Schlüssel verschlüsselt, oder sops sucht nicht dort, wo dein Schlüssel liegt: sops kann nur für einen Empfänger entschlüsseln, der beim Verschlüsseln gewählt wurde (.sops.yaml, --age, updatekeys).

explainer-sops-mac = Die Datei wurde außerhalb von sops geändert: Der MAC, den sops beim letzten Schreiben über alle Werte berechnet hat, passt nicht mehr zu ihnen (oder das eigene Tag eines Werts schlägt fehl). Ein von Hand bearbeiteter ENC[…]-Wert, eine entfernte Zeile oder ein geänderter Klartextwert reicht. Hol die Datei aus git zurück und ändere Werte mit sops edit oder sops set; --ignore-mac hilft nur, eine beschädigte Datei zu retten.

explainer-sops-no-rule = sops weiß nicht, für wen es diese neue Datei verschlüsseln soll: kein --age auf der Kommandozeile, keine .sops.yaml im aktuellen Verzeichnis oder darüber, oder keine creation rule, deren path_regex zur Datei passt (dem Pfad relativ zum Verzeichnis von .sops.yaml). Führe sops im Repository aus und prüf den regulären Ausdruck der Regel.

explainer-age-keygen-exists = age-keygen überschreibt nie eine Datei: Einen geheimen Schlüssel zu verlieren, würde alles unlesbar machen, was für ihn verschlüsselt wurde. Nutze den Schlüssel, der schon da ist (age-keygen -y DATEI gibt seinen öffentlichen Schlüssel aus), oder wähle bewusst einen anderen Dateinamen. Es scheitert auch, wenn das Verzeichnis der Datei noch nicht existiert (mkdir -p).

explainer-bao-sealed = OpenBao ist versiegelt: Es hält seine Daten verschlüsselt und kann sie erst lesen, wenn es seinen Root-Schlüssel aus genügend Schlüsselanteilen wieder zusammengesetzt hat. bao status zeigt die Schwelle und den Fortschritt; jede Person mit einem Anteil gibt ihren mit bao operator unseal ein. Ein Server startet immer versiegelt, nach einem Reboot oder einem Neustart (außer Auto-Unseal ist eingerichtet).

explainer-bao-preflight = Die Befehle bao kv fragen zuerst, welche KV-Engine unter diesem Pfad eingehängt ist, und diese Anfrage braucht ein Token, dessen Policies unter dem Mount etwas gewähren. Prüf, welches Token benutzt wird (bao token lookup, BAO_TOKEN, ~/.vault-token), und seine Policies.

explainer-bao-denied = OpenBao hat die Anfrage abgelehnt: Das benutzte Token hat keine Policy, die diese Fähigkeit auf diesem Pfad gewährt, oder das Token selbst ist ungültig (widerrufen, abgelaufen). bao token lookup zeigt das Token und seine Policies; bao token capabilities PFAD zeigt, was es dort darf. Bei einer KV-Engine der Version 2 müssen Policies den API-Pfad nennen (secret/data/..., secret/metadata/...), nicht den, den bao kv nimmt.
