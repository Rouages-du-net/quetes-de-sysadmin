### Graded hints for The Staff Room (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The Stuck Queue

hint-stuck-queue-queue =
    .lead = Ask CUPS for the whole picture: the scheduler, the queues, whether each is enabled and accepts jobs, and the jobs (man lpstat).
    .solution = lpstat -t
hint-stuck-queue-error-log =
    .lead = The queue was stopped for a reason: cupsd's log is in /var/log/cups.
    .solution = tail -n 30 /var/log/cups/error_log
hint-stuck-queue-jobs =
    .lead = Which job is at the head of the office queue, and how big is it? (man lpq)
    .solution = lpq -P office, or lpstat -o office
hint-stuck-queue-canceled =
    .lead = Cancel that job, and only that one: cancel takes a job id, not just a printer (man cancel).
    .solution = cancel 117
hint-stuck-queue-purged =
    .lead = A cancelled job keeps its document in the spool for a while: cancel has an option to purge it.
    .solution = cancel -x 117
hint-stuck-queue-enabled =
    .lead = The printer is on again, the runaway job gone: the queue must be enabled (man cupsenable).
    .solution = cupsenable office
hint-stuck-queue-end =
    .lead = Check that the colleagues' documents are printing, and that the spool has shrunk.
    .solution = lpstat -p office; lpq -P office; df -h /var

## Chapter 2 — The New Printer

hint-new-printer-discover =
    .lead = What does the network offer? CUPS can list the printers that announce themselves, and those that print driverless (man lpinfo, man driverless).
    .solution = driverless, or sudo lpinfo -v
hint-new-printer-added =
    .lead = Create a queue for the MFP with lpadmin: its name, enabled, its IPP URI from the delivery note, and the IPP Everywhere model (man lpadmin).
    .solution = lpadmin -p staffroom -E -v ipp://mfp-staffroom.internal/ipp/print -m everywhere
hint-new-printer-default =
    .lead = The server's default destination is set by lpadmin, not lpoptions.
    .solution = lpadmin -d staffroom
hint-new-printer-pupil-printed =
    .lead = Who may connect to which path is in cupsd.conf: read <Location />, and compare @LOCAL with the server's interfaces (ip -br addr). The access_log shows who prints.
    .solution = grep -A4 '<Location />' /etc/cups/cupsd.conf; ip -br addr; tail /var/log/cups/access_log
hint-new-printer-restricted =
    .lead = Restrict the MFP to the staff: a <Location /printers/NAME> that allows the staff network only (then cupsd -t and a restart), or the queue's allowed users (lpadmin -u).
    .solution = add to cupsd.conf: <Location /printers/staffroom> Order allow,deny / Allow 198.51.100.0/24 </Location>, then sudo systemctl restart cups (or lpadmin -p staffroom -u allow:@staff)
hint-new-printer-everywhere-refused =
    .lead = Now the reception's LaserJet: its URI is socket://, port 9100 (the delivery note). Try it the driverless way first, and read what lpadmin answers.
    .solution = lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m everywhere
hint-new-printer-hpcups =
    .lead = It needs a driver: lpinfo -m lists those installed; HP's printers have theirs in a Debian package (apt search hpcups).
    .solution = sudo apt update, then sudo apt install printer-driver-hpcups
hint-new-printer-old-added =
    .lead = Find the LaserJet 4250's model in lpinfo -m and give it to lpadmin -m.
    .solution = lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m drv:///hpcups.drv/hp-laserjet_4250.ppd
hint-new-printer-end =
    .lead = The MFP driverless and the default, the staff in, the Chromebooks out (but still in the library), the LaserJet with its driver, cupsd running the file's configuration.
    .solution = lpstat -t; tail /var/log/cups/access_log

## Chapter 3 — The Paper Trail

hint-paper-trail-big-log =
    .lead = What fills /var? Look at the size of the logs (man du, man df).
    .solution = df -h /var; sudo du -sh /var/log/cups/* /var/spool/cups
hint-paper-trail-names =
    .lead = What does cupsd write in its error_log, and at which level?
    .solution = sudo tail /var/log/cups/error_log; grep -E 'LogLevel|MaxLogSize' /etc/cups/cupsd.conf
hint-paper-trail-history =
    .lead = How far back does CUPS remember jobs, and their documents? (man lpstat: -W; man cupsd.conf: PreserveJobHistory, PreserveJobFiles)
    .solution = lpstat -W completed -o; sudo ls /var/spool/cups
hint-paper-trail-loglevel =
    .lead = Put the log level back to normal and apply it: cupsctl does both (man cupsctl).
    .solution = cupsctl --no-debug-logging
hint-paper-trail-rotation =
    .lead = A log needs a rotation: cupsd's own (MaxLogSize) or logrotate's.
    .solution = cupsctl MaxLogSize=1m
hint-paper-trail-small =
    .lead = The old 3.9 GB log is still there (maybe renamed error_log.O): it has no more use.
    .solution = sudo rm /var/log/cups/error_log.O (or sudo truncate -s 0 /var/log/cups/error_log)
hint-paper-trail-kept =
    .lead = A week of history, documents not kept: two directives of cupsd.conf, applied by a restart.
    .solution = cupsctl PreserveJobHistory=1w PreserveJobFiles=No
hint-paper-trail-private =
    .lead = Who may see a job's name and owner: a value of the default policy (man cupsd.conf, JobPrivateValues).
    .solution = cupsctl JobPrivateValues=default
hint-paper-trail-cancel-policy =
    .lead = Who may cancel a job: the Cancel-Job limit of the default policy; cupsctl has an option for it.
    .solution = cupsctl --no-user-cancel-any
hint-paper-trail-admin-closed =
    .lead = The admin pages: cupsctl can stop serving them to the network.
    .solution = cupsctl --no-remote-admin
hint-paper-trail-end =
    .lead = Everything applied (cupsd running the file), the logs small, the staff still printing.
    .solution = cupsctl; df -h /var; lpstat -t
