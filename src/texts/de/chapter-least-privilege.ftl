### Story "The Allotments", chapter "Least Privilege": the app connects as
### root over the network, MariaDB listens on every address. Accounts
### 'user'@'host', CREATE USER, GRANT, REVOKE, DROP USER, unix_socket,
### mariadb-secure-installation, bind-address, ufw. Commands, options, paths,
### SQL and outputs are not translated.

chapter-least-privilege = Geringste Rechte
    .summary = Die Buchungs-App ist auf einen neuen Server umgezogen, und um sie wieder zum Laufen zu bringen, hat ihr jemand die Schlüssel zu allem gegeben: das root-Konto der Datenbank, aus dem ganzen Internet erreichbar. Gib der App, was sie braucht, und nicht mehr.

## Files

least-privilege-message-halima =
    Von: Halima (Vorsitzende, Kleingartenverein Grünholm)
    Dienstag, 20. Mai, 18:10
    
    Hallo noch einmal,
    
    Selin, die uns bei den Computern hilft, hat letzte Nacht unsere
    Adressen von ihrem Anschluss zu Hause aus gescannt (wir hatten sie
    darum gebeten), und sie macht sich Sorgen: siehe ihren Bericht, ich
    habe ihn neben diese Nachricht kopiert. Lwazi hat die App am Sonntag auf
    einen neuen Server umgezogen, barrow, und gibt zu, dass er „Sachen
    aufgemacht“ hat, damit es funktioniert. Seine Notiz liegt auch hier.
    
    Könntest du schließen, was geschlossen sein sollte, ohne die Site
    kaputtzumachen? Die Mitglieder buchen diese Woche ihre Sommerparzellen.
    
    Halima
least-privilege-scan-selin =
    Portscan der öffentlichen Adressen des Vereins, von außen (Selin)
    Montag, 19. Mai 2031, 22:41
    
    Nmap scan report for 192.0.2.131
    Host is up (0.012s latency).
    Not shown: 997 filtered tcp ports (no-response)
    PORT     STATE SERVICE VERSION
    22/tcp   open  ssh     OpenSSH 10.0p2 Debian 7 (protocol 2.0)
    3306/tcp open  mysql   MariaDB 11.8.9-MariaDB-0+deb13u1
    8080/tcp closed http-proxy
    
    Selin: 3306 ist die Datenbank. Jede Person im Internet kann dort
    Passwörter ausprobieren. Ist das Absicht?
least-privilege-note-lwazi =
    Lwazi, Sonntag, 18. Mai
    
    Sorry, ich hatte es eilig. Plotline läuft jetzt auf barrow
    (198.51.100.134): shed ist weg. Beim ersten Start bekam die App „Host
    '198.51.100.134' is not allowed to connect to this MariaDB server“, also:
    - habe ich root@'%' mit einem Passwort angelegt und es in die
      Einstellungen der App geschrieben (barrow: /srv/plotline/.env);
    - habe ich bind-address = 0.0.0.0 in 50-server.cnf gesetzt, „um sicher
      zu sein“.
    Es funktioniert. Ich weiß, es ist nicht schön. Du erreichst barrow mit
    ssh von trowel aus; sudo funktioniert dort auch.

## Events

least-privilege-event-scan =
    3306/tcp open, von Selins Zuhause aus: MariaDB antwortet allen im
    Internet, über den Büroanschluss von trowel. Das allein ist kein
    Einbruch, aber jedes Konto, das Verbindungen von '%' annimmt, kann von
    überall ausprobiert werden. Wer darf sich verbinden, von wo, mit welchen
    Rechten? (sudo mariadb; SELECT user, host, plugin FROM mysql.user; SHOW
    GRANTS FOR …)
least-privilege-event-accounts =
    Lies die Konten als 'user'@'host': ein Konto ist ein Name UND die
    Adresse, von der es kommen darf. root@'%' ist root von überall, mit
    allen Rechten; die Konten mit leerem Benutzernamen sind anonym (jede
    Person, jeder Name); plotline@198.51.100.133 gehört zu shed, das es
    nicht mehr gibt; die Datenbank test ist für alle offen. Die App braucht
    vier Arten von Anweisungen auf einer Datenbank: welches Konto wäre für
    sie gerade genug?
least-privilege-event-all-on-all =
    ON *.* gibt diesem Konto Rechte auf jede Datenbank, die Systemtabellen
    von mysql inklusive, und manche globale Rechte lassen es Dateien lesen,
    Verbindungen beenden oder die Einstellungen des Servers ändern. Eine
    App, in die eingebrochen wird, gibt all das weiter. Vergib nur auf
    plots.*, und nur, was die App tut (man mariadb: GRANT, REVOKE).
least-privilege-event-any-host =
    '%' als Host bedeutet „von jeder Adresse“: da trowel im Internet
    lauscht, kann jede Person das Passwort dieses Kontos ausprobieren. Die
    App kommt immer von barrow: nenne seine Adresse (oder das hintere
    Netzwerk, '198.51.100.%').
least-privilege-event-app-account =
    Dieses Konto passt zur App: sein Host ist der von barrow, seine Rechte
    sind SELECT, INSERT, UPDATE und DELETE auf plots, nichts Globales. Jetzt
    muss die App es benutzen: ihre Einstellungen liegen auf barrow.
least-privilege-event-env-not-loaded =
    Die Datei .env nennt das neue Konto, aber die App verbindet sich immer
    noch als root: sie hat ihre Einstellungen beim Start gelesen und behält
    sie im Speicher (siehe /srv/plotline/README.txt).
least-privilege-event-app-denied =
    Die App kann mit ihren neuen Einstellungen nicht arbeiten: { $error }.
    Ihr Log sagt dasselbe (barrow: /var/log/plotline/app.log). Prüfe den
    Host des Kontos, sein Passwort (IDENTIFIED BY) gegen die .env, und seine
    Rechte (SHOW GRANTS FOR …).
least-privilege-event-app-switched =
    Plotline verbindet sich jetzt mit seinem eigenen Konto (das Log von
    barrow sagt es) und kann nur plots anfassen, mit den vier Anweisungen,
    die es benutzt. root@'%' braucht niemand mehr.
least-privilege-event-locked-out =
    root@localhost kann sich nicht mehr über den Socket anmelden. Wenn
    nichts anderes die Rechte hat, kann niemand den Server mehr verwalten.
    Debian behält einen zweiten Zugang: mysql@localhost, mit unix_socket,
    für das Systemkonto mysql (sudo -u mysql mariadb). Setz root zurück:
    ALTER USER root@localhost IDENTIFIED VIA unix_socket;
least-privilege-event-sys-dropped =
    mariadb.sys ist kein Überbleibsel: es ist ein gesperrtes Konto, dem die
    System-Views gehören, darunter mysql.user. Ohne es scheitern sie mit
    „The user specified as a definer does not exist“. Leg es wieder an:
    CREATE USER 'mariadb.sys'@'localhost' ACCOUNT LOCK;
least-privilege-event-root-local =
    root ist jetzt nur für diese Maschine, über unix_socket: nur der root
    des Systems (sudo mariadb) kommt herein, ohne Passwort zum Erraten.
least-privilege-event-cleanup =
    Kein anonymes Konto, keine für alle offene Testdatenbank, kein Konto
    für einen Server, den es nicht mehr gibt: was bleibt, wird benutzt.
least-privilege-event-still-open =
    MariaDB ist neu gestartet, lauscht aber immer noch auf jeder Adresse,
    und nichts davor filtert: Selins Scan würde 3306 immer noch offen
    finden. Wo es lauscht, ist bind-address; wer den Port erreichen darf,
    kann auch Aufgabe der Firewall sein (ufw).
least-privilege-event-app-cut =
    Die App erreicht den Server nicht mehr („Can't connect to server“). Die
    Datenbank muss von barrow aus erreichbar bleiben, über das hintere
    Netzwerk: 127.0.0.1 ist nur trowel selbst, und eine Firewall-Regel muss
    barrow hereinlassen.
least-privilege-event-network =
    Port 3306 ist vom Internet aus geschlossen, und barrow erreicht ihn
    weiterhin über das hintere Netzwerk.
least-privilege-event-end =
    Halima: „Selin hat noch einmal gescannt: nur ssh antwortet. Und die
    Buchungen haben keine Sekunde aufgehört. Danke!“
    
    Gut gemacht! Du hast „Geringste Rechte“ abgeschlossen.
    
    WAS PASSIERT IST
    Um die App auf ihrem neuen Server zum Laufen zu bringen, hatte sie das
    root-Konto bekommen, von jeder Adresse aus, mit einem Passwort in einer
    Datei, und MariaDB lauschte auf jeder Adresse, das Internet inklusive.
    Du hast der App ein eigenes Konto gegeben, nur von barrow aus, mit den
    vier Anweisungen, die sie auf ihrer Datenbank braucht; root für die
    Maschine selbst behalten, über den Socket; entfernt, was eine alte
    Installation hinterlassen hatte (anonyme Konten, die Testdatenbank, das
    Konto eines Servers, den es nicht mehr gibt); und den Port zum Internet
    geschlossen.
    
    GUTE PRAXIS
    - Ein Konto pro Anwendung, benannt mit der Adresse, von der sie kommt,
      mit den Rechten, die ihre Anweisungen auf ihrer Datenbank brauchen,
      nichts ON *.*.
    - Unter Debian benutzt root@localhost unix_socket: der root des Systems
      meldet sich ohne Passwort an, und niemand kann eines erraten. Lass es
      so.
    - mariadb-secure-installation entfernt die anonymen Konten, die
      Testdatenbank und das entfernte root in einem Zug, auf einem neuen
      Server.
    - Nur dort lauschen, wo die Clients sind (bind-address), und davor
      filtern (ufw): zwei Schlösser statt einem.
    - Ein Passwort in einer Datei ist immer noch ein Geheimnis: mach diese
      Datei nur für die App lesbar (chmod 640, Besitzer root, Gruppe der
      App).
    
    DOKUMENTATION
    - CREATE USER und Kontonamen: https://mariadb.com/kb/en/create-user/
    - GRANT: https://mariadb.com/kb/en/grant/
    - Authentifizierung mit unix_socket: https://mariadb.com/kb/en/authentication-plugin-unix-socket/
    - mariadb-secure-installation: https://mariadb.com/kb/en/mariadb-secure-installation/
    - MariaDB für entfernten Zugriff konfigurieren: https://mariadb.com/kb/en/configuring-mariadb-for-remote-client-access/
    - Das Konto mariadb.sys: https://mariadb.com/kb/en/mariadbsys-user/
