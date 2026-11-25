### Geschichte „Die Bastion“, Kapitel „Eindämmung“: den Miner und den
### Eindringling mit iptables abschneiden, ohne sich selbst auszusperren,
### den Miner und seinen Wachhund stoppen, das Konto deploy schließen.
### Befehle, Pfade und Adressen werden nicht übersetzt.

chapter-containment = Eindämmung
    .summary = Den Miner und den Eindringling abschneiden, ohne dich selbst auszusperren, stoppen, was läuft, und das benutzte Konto schließen.

## Dateien

containment-email-nadia =
    Von:      Nadia
    An:       dich
    Betreff:  AW: Abuse report

    Danke für die Notizen. Mein Cousin sagt, wir sollten den Server einfach
    ausstecken. Aber die Fahrerinnen und Fahrer brauchen die Touren um 11.
    Können wir den Schaden stoppen, ohne die Lieferungen zu stoppen?

    Nadia

containment-incident =
    # Incident — ofen (Lieferungen)

    ## Was läuft
    /tmp/.cache/kworkerd (deploy), bewacht von /bin/sh /tmp/.cache/.w.

    ## Wohin es spricht
    198.51.100.66, Port 3333 (der Pool).

    ## Wie es hereingekommen ist
    deploy, per Passwort, von 203.0.113.66, 13.04. um 02:40:57.

    ## Eindämmung
    (zu tun: den Pool und die Adresse des Eindringlings abschneiden, stoppen,
    was läuft, deploy schließen — ohne dein eigenes ssh abzuschneiden und
    ohne die Lieferungen zu stoppen)

## Ereignisse

# { $pool }: the pool's address
containment-event-pool =
    Der Miner erreicht { $pool } nicht mehr: Was er auch berechnet, er kann
    es nicht abliefern. Der Hoster wird sehen, dass die Verbindung abreißt.
# { $address }: the intruder's address
containment-event-attacker =
    { $address } kann keine Verbindung zu diesem Server mehr öffnen. Das
    hält niemanden auf, der die Adresse wechselt, aber es schließt den Weg,
    der benutzt wurde.
containment-event-locked-out =
    Vorsicht: Mit diesen Regeln würde deine nächste ssh-Verbindung von
    deinem Rechner abgewiesen. Deine aktuelle Sitzung bleibt offen (die
    Firewall kappt keine aufgebaute Verbindung), aber wenn du dich jetzt
    abmeldest, bist du ausgesperrt. Lass zuerst dein eigenes ssh zu
    (iptables -L --line-numbers zeigt die Reihenfolge).
# { $pid }: the new miner's PID
containment-event-respawn =
    kworkerd ist zurück, als PID { $pid }: Der Wachhund (/bin/sh
    /tmp/.cache/.w) startet ihn neu, sobald er fehlt. Stoppe zuerst den
    Wachhund oder friere ihn ein (kill -STOP), dann den Miner.
containment-event-app-down =
    Die Liefer-App ist gestoppt: Sie lief ebenfalls als deploy und ist mit
    dem Rest verschwunden. Die Fahrer·innen brauchen sie um 11: Starte sie
    wieder (systemctl).
containment-event-relaunched =
    Die App läuft wieder… und der Wachhund und der Miner auch. Der Start der
    App hat sie neu gestartet: Etwas in der App selbst tut das. Notiere es
    in incident.md, stoppe sie noch einmal und heb dir das für den nächsten
    Schritt auf.
containment-event-stopped =
    Nichts aus /tmp/.cache läuft mehr. Die Dateien sind noch da, und
    das, was sie neu startet, auch: Das ist die Arbeit des nächsten
    Schritts.
containment-event-password-only =
    usermod -L sperrt das Passwort von deploy, nicht das Konto: sshd nimmt
    weiterhin einen Schlüssel an, und der Eindringling hat vielleicht einen
    hinterlassen. Das Handbuch von usermod sagt, was man hinzufügen muss, um
    das Konto endgültig zu sperren (das EXPIRE_DATE).
containment-event-closed =
    deploy kann sich überhaupt nicht mehr anmelden, weder mit Schlüssel noch
    mit Passwort. Selma braucht das Konto am Montag wieder; dann wird es
    ordentlich wieder geöffnet.
containment-event-end =
    Nadia: „Die Touren sind da, und der Hoster sagt, die Verbindung ist
    abgebrochen. Danke. Und wir mussten nichts ausstecken.“

    Gut gemacht! Du hast das Kapitel „Eindämmung“ abgeschlossen.

    WAS PASSIERT IST
    Du hast den Schaden gestoppt, ohne den Betrieb zu stoppen: Der Pool und
    die Adresse des Eindringlings sind blockiert, der Miner und sein
    Wachhund in der richtigen Reihenfolge gestoppt, und deploy ist
    endgültig geschlossen, Schlüssel inklusive. Und die Liefer-App läuft
    weiter.

    GUTE PRAXIS
    - Erst eindämmen, dann aufräumen: Ziel ist, den Schaden zu stoppen und
      dabei die Beweise und den Dienst zu erhalten.
    - Denk vor einer Firewall-Regel an deinen eigenen Zugang: Eine
      aufgebaute Sitzung überlebt, die nächste nicht.
    - Ein Prozess, der wiederkommt, hat einen Elternprozess, der ihn neu
      startet: Schau dir den Baum an (ps -ef, die Spalte PPID) und stoppe
      zuerst den Elternprozess.
    - usermod -L sperrt das Passwort, nicht das Konto: Mit sshd und PAM
      öffnet ein Schlüssel es weiterhin. Lass das Konto ablaufen (usermod
      -e 1) oder gib ihm nologin.

    EIN ANDERER WEG
    Bei einer virtuellen Maschine kann der Host einen Snapshot von Speicher
    und Platte machen, bevor irgendetwas angefasst wird: der getreueste
    Beweis, den es gibt. Bei einem physischen Server leistet die Isolation
    im Netz (ein Switch-Port) dieselbe Arbeit wie die Firewall-Regeln, von
    außerhalb der Maschine.

    DOKUMENTATION
    - iptables: https://man7.org/linux/man-pages/man8/iptables.8.html
    - kill und Signale: https://man7.org/linux/man-pages/man7/signal.7.html
    - usermod (-L, -e): https://man7.org/linux/man-pages/man8/usermod.8.html
    - NIST SP 800-61r2, Eindämmung: https://csrc.nist.gov/pubs/sp/800/61/r2/final
