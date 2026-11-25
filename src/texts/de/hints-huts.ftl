### Die gestuften Hinweise der Geschichte „Die Hütten“: eine Spur, dann
### fast die Antwort, für jeden Schritt (siehe src/engine/hints.ts).

## Kapitel 1 — Die Logs sammeln

hint-central-logs-silent =
    .lead = Lauscht hier irgendetwas auf die Hütten? (man ss: -u, -l, -n, -p; die Konfiguration von rsyslog: /etc/rsyslog.conf)
    .solution = ss -ulnp zeigt nichts auf 514; in /etc/rsyslog.conf sind module(load="imudp") und input(type="imudp" port="514") auskommentiert.
hint-central-logs-listening =
    .lead = Schalte den Empfang über UDP ein, prüf die Konfiguration, starte rsyslog neu (man rsyslogd: -N1).
    .solution = Die beiden imudp-Zeilen in /etc/rsyslog.conf einkommentieren, sudo rsyslogd -N1, sudo systemctl restart rsyslog.
hint-central-logs-end =
    .lead = Lass die Hütten durch die Firewall (man ufw), dann eine Regel für ihre Nachrichten: eine Datei pro Hütte, und nichts in syslog (man rsyslog.conf: template, stop).
    .solution = sudo ufw allow from 198.51.100.0/24 to any port 514 proto udp; in /etc/rsyslog.d/10-remote.conf: eine Vorlage "/var/log/remote/%HOSTNAME%.log", dann if $fromhost-ip startswith '198.51.100.' then {"{"} action(type="omfile" dynaFile="…") stop {"}"}; rsyslog neu starten.

## Kapitel 2 — Das volle Journal

hint-journal-full-disk =
    .lead = Wohin geht der Platz? (man df, man du: -s, -h)
    .solution = df -h: / bei 93 %; sudo du -sh /var/log/* /var/lib/*: /var/log/journal belegt 6G.
hint-journal-full-journal =
    .lead = Wie viel belegt das Journal, und wie kürzt man es? (man journalctl: --disk-usage, --vacuum-size)
    .solution = journalctl --disk-usage, dann sudo journalctl --vacuum-size=500M.
hint-journal-full-end =
    .lead = Damit es klein bleibt: ein Limit für journald, beim Start gelesen (man journald.conf: SystemMaxUse=).
    .solution = SystemMaxUse=500M unter {"["}Journal] in /etc/systemd/journald.conf, dann sudo systemctl restart systemd-journald.

## Kapitel 3 — Fehlgeschlagene Anmeldungen

hint-ssh-alerts-failures =
    .lead = Wie sieht eine fehlgeschlagene Anmeldung in der Datei einer Hütte aus? (grep in /var/log/remote)
    .solution = sudo grep Failed /var/log/remote/huette-see.log: sshd[…]: Failed password for invalid user admin from…
hint-ssh-alerts-rule =
    .lead = Eine Regel mit einer Bedingung auf das Programm und auf die Nachricht (man rsyslog.conf: if … then).
    .solution = if $programname == 'sshd' and $msg contains 'Failed password' then /var/log/remote/ssh-failures.log
hint-ssh-alerts-end =
    .lead = Die Regeln laufen der Reihe nach, und die Nachrichten der Hütten halten bei der Regel pro Hütte an (10-remote.conf): Stell deine davor, und starte dann rsyslog neu.
    .solution = Deine Regel in /etc/rsyslog.d/05-ssh-failures.conf, sudo rsyslogd -N1, sudo systemctl restart rsyslog.
