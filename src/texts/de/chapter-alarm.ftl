### Geschichte „Die Bastion“, Kapitel „Der Alarm“: eine Abuse-Meldung des
### Hosters; herausfinden, was läuft, wohin es spricht und wie es
### hereingekommen ist, und es aufschreiben, bevor man handelt. Befehle,
### Pfade, Adressen und Logzeilen werden nicht übersetzt.

chapter-alarm = Der Alarm
    .summary = Der Hoster sagt, der Server spricht mit einem Mining-Pool: herausfinden, was läuft, wohin es spricht und wie es hereingekommen ist, bevor man irgendetwas anrührt.

## Dateien

alarm-email-nadia =
    Von:      Nadia
    An:       dich
    Betreff:  WG: Abuse report for 192.0.2.33

    Entschuldige, dass es Samstag ist. Unser Hoster hat das um 7 Uhr
    geschickt, ich verstehe die Hälfte nicht. Die Lieferseite ist heute
    Morgen auch langsam. Kannst du mal schauen? Selma (die Entwicklerin der
    Liefer-App) ist bis Montag weg.

    ---------- Weitergeleitete Nachricht ----------
    Von:      abuse@host.example
    Betreff:  Abuse report for 192.0.2.33

    Our monitoring shows that your server 192.0.2.33 has kept a connection
    open to 198.51.100.66, port 3333, since 13 April around 02:41 UTC. This
    address is a known cryptocurrency mining pool. This activity usually
    means a compromised machine. Please investigate and reply within 48
    hours.

    Nadia

    PS: Die Incident-Notizen, die wir bei Salomé gelernt haben, liegen in
    incident.md.

alarm-incident-template =
    # Incident — ofen (Lieferungen)

    Eröffnet am Samstag, 14. April 2029, 8:20 Uhr, nach der Abuse-Meldung des Hosters.

    ## Was läuft
    (zu ergänzen: welches Programm, unter welchem Konto, aus welchem Verzeichnis)

    ## Wohin es spricht
    (zu ergänzen: welche Adresse und welcher Port)

    ## Wie es hereingekommen ist
    (zu ergänzen: welches Konto, von welcher Adresse, um welche Uhrzeit, wie)

    ## Zeitlinie
    - 13.04. 02:41 — erste Verbindung zum Pool, laut Hoster.

## Ereignisse

alarm-event-process =
    Ein „kworkerd“ belegt fast zwei ganze Prozessoren, als deploy, und läuft
    aus /tmp/.cache. Sein Name ahmt einen Kernel-Thread nach, aber ein
    echter erscheint in eckigen Klammern ([kworker/0:1]), gehört root und
    hat keinen Pfad auf der Platte. Und sein Elternprozess, eine Shell, die
    /tmp/.cache/.w ausführt, ist nichts, was die App starten sollte.
# { $pool }: the pool's address
alarm-event-connection =
    Da ist es: kworkerd hat eine aufgebaute Verbindung zu { $pool }, Port
    3333, die Adresse aus der Meldung des Hosters. Das Programm und die
    Verbindung sind ein und dasselbe.
alarm-event-connection-anonymous =
    Eine aufgebaute Verbindung zu { $pool }, Port 3333: die Adresse des
    Hosters. Aber welches Programm hält sie? Die Prozessspalte erscheint nur
    mit -p, und bei Sockets anderer Konten nur für root.
# { $address }: the intruder's address
alarm-event-entry =
    Im Log von ssh: vierzehn falsche Passwörter für deploy von { $address },
    dann „Accepted password“ von derselben Adresse um 02:40:57. Jemand hat
    das Passwort von deploy erraten. Dabei nimmt dieser Server doch nur
    Schlüssel an… dachtest du jedenfalls.
alarm-event-stopped-early =
    Du hast ihn gestoppt, und er ist sofort mit einer anderen PID
    zurückgekommen: Irgendetwas startet ihn neu. Das ist etwas für den
    nächsten Schritt; notiere erst einmal, was du siehst, bevor sich etwas
    ändert.
alarm-event-end =
    Nadia: „Da benutzt also jemand unseren Server, um Geld zu verdienen. Du
    hast recht, ich will lieber genau wissen, was los ist, bevor wir etwas
    anfassen.“

    Gut gemacht! Du hast das Kapitel „Der Alarm“ abgeschlossen.

    WAS PASSIERT IST
    In der Nacht vom 12. auf den 13. April hat jemand von 203.0.113.66 aus
    Passwörter am Konto deploy ausprobiert und um 02:40 das richtige
    gefunden. Zurückgelassen wurde ein als Kernel-Thread getarnter Miner
    (kworkerd, in /tmp/.cache) und eine kleine Shell-Schleife, die über ihn
    wacht. Seitdem arbeitet der Server für die Eindringlinge, und der
    Hoster hat es bemerkt.

    GUTE PRAXIS
    - Beobachten, bevor man handelt: was läuft (ps, top), wohin es spricht
      (ss -tnp oder netstat -tnp, mit sudo, um die Prozesse zu sehen), wie
      es hereingekommen ist (journalctl -u ssh, last).
    - Unterwegs mitschreiben, mit Uhrzeiten: incident.md ist das Gedächtnis
      des Vorfalls und die Grundlage dessen, was du Nadia, dem Hoster und
      vielleicht anderen sagen wirst.
    - Die Maschine nicht reflexartig ausschalten: Was im Speicher läuft und
      die offenen Verbindungen gehören zu den Beweisen.

    EIN ANDERER WEG
    Ein hostbasiertes Intrusion-Detection-Werkzeug (auditd, AIDE oder eine
    Überwachung der Prozesse und ausgehenden Verbindungen) hätte vor dem
    Hoster Alarm geschlagen. Die Meldung des Hosters ist eine zweite
    Verteidigungslinie, nicht die erste.

    DOKUMENTATION
    - ps: https://man7.org/linux/man-pages/man1/ps.1.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    - NIST SP 800-61r2, Incident Handling: https://csrc.nist.gov/pubs/sp/800/61/r2/final
