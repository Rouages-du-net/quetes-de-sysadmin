### Geschichte „Die Bastion“, Kapitel „Härtung“: Passwort-Logins endgültig
### abschalten (das Drop-in, das gewinnt), eine Firewall, die standardmäßig
### verweigert und einen Neustart übersteht, und deploy per Schlüssel
### zurückgeben. Befehle, Pfade und Optionen werden nicht übersetzt.

chapter-hardening = Härtung
    .summary = Passwort-Logins endgültig abschalten, eine Firewall, die standardmäßig verweigert und einen Neustart übersteht, und Selma ihr Konto zurückgeben, nur per Schlüssel.

## Dateien

hardening-email-nadia =
    Von:      Nadia
    An:       dich
    Betreff:  Montag

    Selma würde heute Nachmittag gern deployen. Kann sie das, ohne Risiko?
    Und wie sorgen wir dafür, dass das nicht wieder passiert? Der Hoster
    fragt, was wir geändert haben.

    Nadia

hardening-incident =
    # Incident — ofen (Lieferungen)

    ## Bereinigt (14.04.)
    Crontab, Schlüssel, /tmp/.cache, server.js aus dem signierten Release wiederhergestellt.

    ## Warum es möglich war
    - Passwörter bei ssh angenommen, obwohl sshd_config „no“ sagt.
    - Keine Firewall: jeder Port offen, auch 3000 der App.

    ## Lektionen (zu tun)
    - Passwörter aus, wirklich.
    - Firewall: standardmäßig verweigern, nur Nötiges öffnen, und nach
      einem Neustart behalten (/etc/iptables/rules.v4).
    - deploy zurück für Selma, nur per Schlüssel.

## Ereignisse

hardening-event-looked =
    sshd -T sagt „passwordauthentication yes“, während sshd_config no sagt.
    sshd_config beginnt mit einem Include von sshd_config.d/*.conf, und für
    jedes Schlüsselwort gewinnt der zuerst gelesene Wert: Das Drop-in, das
    zuerst gelesen wird, gewinnt.
hardening-event-not-reloaded =
    Die Dateien sagen jetzt no, aber sshd wendet immer noch die
    Konfiguration an, die es bei seinem letzten Start oder Reload gelesen
    hat: Lade ssh neu (systemctl).
hardening-event-passwords =
    Passwort-Logins sind in der Konfiguration, die sshd anwendet,
    abgeschaltet: Nur noch Schlüssel öffnen eine Sitzung.
hardening-event-locked-out =
    Vorsicht: Mit diesen Regeln würde deine nächste ssh-Verbindung
    abgewiesen. Deine aktuelle Sitzung ist sicher, aber lass Port 22 zu,
    bevor du dich abmeldest.
hardening-event-no-loopback =
    Die Policy verwirft standardmäßig, aber nichts lässt das Loopback (lo)
    zu: nginx erreicht die App über 127.0.0.1, und das würde auch verworfen.
    Die erste Regel einer Firewall, die standardmäßig verweigert, lässt
    normalerweise lo durch.
# { $port }: the app's port
hardening-event-firewall =
    Standardmäßiges Verweigern ist eingerichtet: lo, die Antworten auf die
    eigenen Verbindungen des Servers, ssh, http und https sind zugelassen;
    der Rest wird verworfen, auch { $port }, der für die ganze Welt offen
    war.
hardening-event-saved =
    Die Regeln sind in /etc/iptables/rules.v4 gespeichert:
    iptables-persistent lädt sie beim Booten wieder. Ohne das hätte ein
    Neustart alles wieder der Welt geöffnet.
hardening-event-deploy =
    deploy ist wieder benutzbar, und da Passwörter aus sind, öffnet nur
    Selmas Schlüssel das Konto.
hardening-event-end =
    Nadia: „Ich habe dem Hoster deine Notizen geschickt. Sie sagen, es ist
    das erste Mal, dass ihnen jemand mit einer Zeitlinie antwortet.“

    Gut gemacht! Du hast das Kapitel „Härtung“ und die Geschichte „Die
    Bastion“ abgeschlossen.

    WAS PASSIERT IST
    Der Weg hinein war ein Drop-in, „für eine Weile“ liegen gelassen: eine
    einzige Zeile in sshd_config.d, vor sshd_config gelesen, die Passwörter
    wieder annahm. Du hast sie wirklich abgeschaltet, jeden Port, der nicht
    offen sein musste, mit einer standardmäßig verweigernden Firewall
    geschlossen, die für den nächsten Boot gespeichert ist, und Selma ihr
    Konto zurückgegeben, nur per Schlüssel.

    GUTE PRAXIS
    - Prüfe, was gilt, nicht, was du glaubst: sshd -T für ssh, iptables -L
      oder nmap von außen für die Firewall.
    - Eine vorübergehende Ausnahme braucht ein Enddatum und jemanden, der
      sie entfernt: Schreib es in die Datei selbst und in eine Erinnerung.
    - Standardmäßig verweigern, dann öffnen, was nötig ist: lo, die
      Antworten (ESTABLISHED, RELATED), dann jeden Dienst. Und speichern,
      sonst macht der nächste Neustart es rückgängig.
    - Schließ den Vorfall mit einem Bericht ab: was passiert ist, wann, was
      getan wurde, was sich ändert. incident.md ist bereit zum Verschicken.

    EIN ANDERER WEG
    fail2ban (gesehen in „Der Wächter“) hätte 203.0.113.66 nach ein paar
    Fehlschlägen gesperrt. ufw schreibt dieselben iptables-Regeln mit
    einfacheren Befehlen, und nftables ist ihr Nachfolger. Und eine
    Durchsicht der Drop-ins (sshd_config.d, sudoers.d…) gehört in die
    wöchentliche Beobachtung aus „Die Wache“.

    DOKUMENTATION
    - sshd_config (Include, erster Wert): https://man.openbsd.org/sshd_config
    - iptables: https://man7.org/linux/man-pages/man8/iptables.8.html
    - iptables-save: https://man7.org/linux/man-pages/man8/iptables-save.8.html
    - iptables unter Debian (iptables-persistent): https://wiki.debian.org/iptables
    - NIST SP 800-61r2, Aktivitäten nach dem Vorfall: https://csrc.nist.gov/pubs/sp/800/61/r2/final
