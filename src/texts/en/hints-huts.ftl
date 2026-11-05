### The graduated hints of the story "The Huts": a lead, then almost the
### answer, for each step (see src/engine/hints.ts).

## Chapter 1 — Gathering the Logs

hint-central-logs-silent =
    .lead = Does anything listen for the huts here? (man ss: -u, -l, -n, -p; the rsyslog configuration: /etc/rsyslog.conf)
    .solution = ss -ulnp shows nothing on 514; in /etc/rsyslog.conf, module(load="imudp") and input(type="imudp" port="514") are commented out.
hint-central-logs-listening =
    .lead = Enable UDP reception, check the configuration, restart rsyslog (man rsyslogd: -N1).
    .solution = Uncomment the two imudp lines in /etc/rsyslog.conf, sudo rsyslogd -N1, sudo systemctl restart rsyslog.
hint-central-logs-end =
    .lead = Let the huts through the firewall (man ufw), then a rule for their messages: one file per hut, and nothing in syslog (man rsyslog.conf: template, stop).
    .solution = sudo ufw allow from 198.51.100.0/24 to any port 514 proto udp; in /etc/rsyslog.d/10-remote.conf: a template "/var/log/remote/%HOSTNAME%.log", then if $fromhost-ip startswith '198.51.100.' then {"{"} action(type="omfile" dynaFile="…") stop {"}"}; restart rsyslog.

## Chapter 2 — The Full Journal

hint-journal-full-disk =
    .lead = Where does the space go? (man df, man du: -s, -h)
    .solution = df -h: / at 93 %; sudo du -sh /var/log/* /var/lib/*: /var/log/journal takes 6G.
hint-journal-full-journal =
    .lead = How much does the journal take, and how do you trim it? (man journalctl: --disk-usage, --vacuum-size)
    .solution = journalctl --disk-usage, then sudo journalctl --vacuum-size=500M.
hint-journal-full-end =
    .lead = For it to stay small: a limit for journald, read when it starts (man journald.conf: SystemMaxUse=).
    .solution = SystemMaxUse=500M under {"["}Journal] in /etc/systemd/journald.conf, then sudo systemctl restart systemd-journald.

## Chapter 3 — Failed Logins

hint-ssh-alerts-failures =
    .lead = What does a failed login look like in a hut's file? (grep in /var/log/remote)
    .solution = sudo grep Failed /var/log/remote/hut-lake.log: sshd[…]: Failed password for invalid user admin from…
hint-ssh-alerts-rule =
    .lead = A rule with a condition on the program and on the message (man rsyslog.conf: if … then).
    .solution = if $programname == 'sshd' and $msg contains 'Failed password' then /var/log/remote/ssh-failures.log
hint-ssh-alerts-end =
    .lead = The rules run in order, and the huts' messages stop at the per-hut rule (10-remote.conf): put yours before it, then restart rsyslog.
    .solution = Your rule in /etc/rsyslog.d/05-ssh-failures.conf, sudo rsyslogd -N1, sudo systemctl restart rsyslog.
