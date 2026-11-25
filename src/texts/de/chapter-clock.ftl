### Geschichte „Bereitschaft“, Kapitel 4 „Die Uhr“: Zeitzone, NTP
### (systemd-timesyncd), timedatectl, cron, das die Zeitzone beim Start
### liest. Befehle, Optionen, Direktiven und die Meldungen der Werkzeuge
### werden nicht übersetzt.

chapter-clock = Die Uhr
    .summary = Montag, 9:12 Uhr: Das Morgenmagazin wurde erst ab 8:09 aufgenommen. Hat der Server, am Wochenende umgezogen, das Zeitgefühl verloren?

## Dateien

clock-message-zoe =
    Eine Nachricht von Zoé (Montag, 9:05 Uhr):

    „Das Morgenmagazin („morgenmagazin“, 6 bis 9 Uhr) wurde erst ab 8:09
    aufgenommen: Wir haben zwei Stunden Sendung verloren! Es ist der
    cron-Auftrag des Kontos radio, der die Aufnahme startet (sudo crontab
    -u radio -l), und der hat sich nicht geändert.

    Was sich geändert hat: Der Hoster hat den Server an diesem Wochenende
    auf eine neue Maschine umgezogen (seine E-Mail liegt in
    mail_hoster.txt). Und dabei sagt das Aufnahme-Log doch „06:00“…“
clock-mail-host =
    Von: support@hosting.example
    Betreff: Umzug Ihres Radioservers abgeschlossen

    Guten Tag,

    Ihr Server wurde am Samstagabend auf unsere neue Infrastruktur
    umgezogen, aus einem Standard-Systemabbild: Ihre Daten und Ihre
    Konfiguration wurden übernommen.

    Zur Erinnerung: Aus unserem Netz ist der Zugang zu öffentlichen
    NTP-Servern gefiltert. Benutzen Sie unseren Zeitserver:
    ntp.hosting.example
    (der alte, ntp.old-hosting.example, wurde abgeschaltet).

    Das Support-Team
clock-timesyncd-conf =
    #  This file is part of systemd.
    #
    # Entries in this file show the compile time defaults. Local configuration
    # should be created by either modifying this file (or a copy of it placed in
    # /etc/ if the original file is shipped in /usr/), or by creating "drop-ins" in
    # the /etc/systemd/timesyncd.conf.d/ directory. The latter is generally
    # recommended. Defaults can be restored by simply deleting the main
    # configuration file and all drop-ins located in /etc/.
    #
    # See timesyncd.conf(5) for details.

    {"[Time]"}
    NTP=ntp.old-hosting.example
    #FallbackNTP=0.debian.pool.ntp.org 1.debian.pool.ntp.org 2.debian.pool.ntp.org 3.debian.pool.ntp.org
    #RootDistanceMaxSec=5
    #PollIntervalMinSec=32
    #PollIntervalMaxSec=2048
clock-script-save =
    #!/bin/sh
    # record SENDUNG DAUER: nimmt den Livestream DAUER Minuten lang auf.
    # Die Uhrzeit im Log ist die der Maschine (date).
    echo "$(date '+%F %T') $1: start ($2 min)" >> /var/log/radio/record.log
    exec /usr/local/bin/stream-record --mount /live --minutes "$2" --out "/srv/radio/sendungen/$1-$(date +%F).ogg"
clock-journal-save =
    2027-08-26 06:00:01 morgenmagazin: start (180 min)
    2027-08-26 23:00:01 nachtprogramm: start (240 min)
    2027-08-27 06:00:01 morgenmagazin: start (180 min)
    2027-08-27 23:00:01 nachtprogramm: start (240 min)
    2027-08-28 23:00:01 nachtprogramm: start (240 min)
    2027-08-29 23:00:01 nachtprogramm: start (240 min)
    2027-08-30 06:00:01 morgenmagazin: start (180 min)

## Ereignisse

clock-event-utc =
    UTC: Die Maschine lebt nach Greenwich-Zeit, nicht nach Pariser Zeit
    (im Sommer zwei Stunden voraus). Und cron startet die Aufträge zur
    lokalen Zeit der Maschine: „6 Uhr“ in der crontab heißt 6 Uhr UTC,
    also 8 Uhr in Paris. Das Abbild des Hosters hat die
    Standard-Zeitzone behalten. Die Zeitzone stellt man mit timedatectl
    ein (man timedatectl).
clock-event-late =
    „System clock synchronized: no“: Niemand stellt die Uhr richtig. Eine
    Computeruhr driftet um ein paar Sekunden pro Tag… und diese geht schon
    neun Minuten nach (dein Rechner sagt 9:12). Das ist die Aufgabe von
    NTP (Network Time Protocol): hier der Dienst systemd-timesyncd, der
    gestoppt ist (NTP service: inactive).
clock-event-manual =
    Die Uhr ist gestellt… vorerst. Ohne NTP driftet sie weiter, und beim
    nächsten Mal korrigiert sie niemand. Überlass diese Aufgabe lieber
    systemd-timesyncd.
clock-event-silent =
    systemd-timesyncd läuft, aber die Uhr ist immer noch nicht
    synchronisiert: Der NTP-Server, den er fragt, antwortet nicht (sudo
    journalctl -u systemd-timesyncd, oder timedatectl timesync-status).
    Seine Konfiguration steht in /etc/systemd/timesyncd.conf; er liest sie
    nur beim Start neu. Die E-Mail des Hosters spricht zufällig von NTP.
clock-event-synced =
    „Contacted time server“: Die Uhr ist synchronisiert, und
    systemd-timesyncd hält sie pünktlich (timedatectl).
clock-event-not-active =
    systemd-timesyncd läuft, ist aber nicht aktiviert: Beim nächsten
    Neustart der Maschine startet er nicht wieder. timedatectl set-ntp
    true macht beides (oder systemctl enable).
clock-event-cron =
    Die Zeitzone hat sich geändert, aber cron hat sie beim Start gelesen,
    am Samstag: Bis zu seinem Neustart rechnet er weiter in UTC, und das
    Morgenmagazin von morgen würde immer noch um 8 Uhr starten. (Das gilt
    für viele Dienste, die schon lange laufen: Auf eine Änderung der
    Zeitzone sollte ein Neustart folgen.)
clock-event-end =
    Die Maschine ist auf Pariser Zeit, per NTP synchronisiert, und cron
    weiß es. Morgen wird das Morgenmagazin um 6 Uhr aufgenommen. Zoé: „Ich
    bitte den Hoster, die Zeitzone in seinem Abbild einzustellen…“

    Gut gemacht! Du hast Kapitel 4 von „Bereitschaft“ abgeschlossen.

    WAS PASSIERT IST
    Die neue Maschine lief in UTC, der Standard-Zeitzone des Abbilds: cron
    hat die Aufnahme um 6 Uhr UTC gestartet, 8 Uhr in Paris. Und ohne NTP
    (timesyncd gestoppt, und auf einen Server gerichtet, den es nicht mehr
    gibt) ging ihre Uhr neun Minuten nach. Die Logs schrieben „06:00“, ohne
    zu sagen, in welcher Zeitzone.

    GUTE PRAXIS
    - Zuerst timedatectl: Zeitzone, Synchronisation, NTP-Dienst.
    - Die Zeitzone: timedatectl set-timezone Europe/Paris, dann die Dienste
      neu starten, die etwas planen (cron).
    - NTP immer an: timedatectl set-ntp true, mit dem Server des Hosters,
      wenn öffentliche Server gefiltert sind (NTP= in
      /etc/systemd/timesyncd.conf, dann systemd-timesyncd neu starten).
    - Die Uhrzeit nicht von Hand stellen (date -s): Das hält nicht.
    - Viele Teams lassen Server in UTC und schreiben ihre crontabs
      entsprechend: Wichtig ist, es zu wissen und aufzuschreiben. Logs
      profitieren davon, die Zeitzone anzuzeigen (date +%z).

    DOKUMENTATION
    - timedatectl: https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html
    - timesyncd.conf: https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html
    - Die Zeitzone unter Debian ändern: https://wiki.debian.org/TimeZoneChanges
