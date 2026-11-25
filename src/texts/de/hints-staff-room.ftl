### Graded hints for The Staff Room (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).


## Chapter 1 — The Stuck Queue

hint-stuck-queue-queue =
    .lead = Frag CUPS nach dem ganzen Bild: der Scheduler, die Warteschlangen, ob jede aktiviert ist und Aufträge annimmt, und die Aufträge (man lpstat).
    .solution = lpstat -t
hint-stuck-queue-error-log =
    .lead = Die Warteschlange wurde aus einem Grund gestoppt: das Log von cupsd liegt in /var/log/cups.
    .solution = tail -n 30 /var/log/cups/error_log
hint-stuck-queue-jobs =
    .lead = Welcher Auftrag steht an der Spitze der Warteschlange office, und wie groß ist er? (man lpq)
    .solution = lpq -P office, oder lpstat -o office
hint-stuck-queue-canceled =
    .lead = Brich diesen Auftrag ab, und nur diesen: cancel nimmt eine Auftragsnummer, nicht nur einen Drucker (man cancel).
    .solution = cancel 117
hint-stuck-queue-purged =
    .lead = Ein abgebrochener Auftrag behält sein Dokument eine Weile im Spool: cancel hat eine Option, um es zu löschen.
    .solution = cancel -x 117
hint-stuck-queue-enabled =
    .lead = Der Drucker ist wieder an, der ausgeuferte Auftrag weg: die Warteschlange muss aktiviert werden (man cupsenable).
    .solution = cupsenable office
hint-stuck-queue-end =
    .lead = Prüfe, dass die Dokumente des Kollegiums gedruckt werden und dass der Spool geschrumpft ist.
    .solution = lpstat -p office; lpq -P office; df -h /var

## Chapter 2 — The New Printer

hint-new-printer-discover =
    .lead = Was bietet das Netzwerk an? CUPS kann die Drucker auflisten, die sich ankündigen, und die, die treiberlos drucken (man lpinfo, man driverless).
    .solution = driverless, oder sudo lpinfo -v
hint-new-printer-added =
    .lead = Leg mit lpadmin eine Warteschlange für das Multifunktionsgerät an: ihr Name, aktiviert, ihre IPP-URI vom Lieferschein und das Modell IPP Everywhere (man lpadmin).
    .solution = lpadmin -p staffroom -E -v ipp://mfp-staffroom.internal/ipp/print -m everywhere
hint-new-printer-default =
    .lead = Das Standardziel des Servers setzt lpadmin, nicht lpoptions.
    .solution = lpadmin -d staffroom
hint-new-printer-pupil-printed =
    .lead = Wer sich mit welchem Pfad verbinden darf, steht in cupsd.conf: lies <Location /> und vergleiche @LOCAL mit den Schnittstellen des Servers (ip -br addr). Das access_log zeigt, wer druckt.
    .solution = grep -A4 '<Location />' /etc/cups/cupsd.conf; ip -br addr; tail /var/log/cups/access_log
hint-new-printer-restricted =
    .lead = Beschränke das Multifunktionsgerät aufs Kollegium: eine <Location /printers/NAME>, die nur das Netz des Kollegiums erlaubt (dann cupsd -t und ein Neustart), oder die erlaubten Benutzer der Warteschlange (lpadmin -u).
    .solution = in cupsd.conf hinzufügen: <Location /printers/staffroom> Order allow,deny / Allow 198.51.100.0/24 </Location>, dann sudo systemctl restart cups (oder lpadmin -p staffroom -u allow:@staff)
hint-new-printer-everywhere-refused =
    .lead = Jetzt der LaserJet vom Empfang: seine URI ist socket://, Port 9100 (der Lieferschein). Versuch es zuerst treiberlos, und lies, was lpadmin antwortet.
    .solution = lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m everywhere
hint-new-printer-hpcups =
    .lead = Er braucht einen Treiber: lpinfo -m listet die installierten; die Drucker von HP haben ihre in einem Debian-Paket (apt search hpcups).
    .solution = sudo apt update, dann sudo apt install printer-driver-hpcups
hint-new-printer-old-added =
    .lead = Finde das Modell des LaserJet 4250 in lpinfo -m und gib es lpadmin -m.
    .solution = lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m drv:///hpcups.drv/hp-laserjet_4250.ppd
hint-new-printer-end =
    .lead = Das Multifunktionsgerät treiberlos und als Standard, das Kollegium drin, die Chromebooks draußen (aber weiter in der Bibliothek), der LaserJet mit seinem Treiber, cupsd mit der Konfiguration der Datei.
    .solution = lpstat -t; tail /var/log/cups/access_log

## Chapter 3 — The Paper Trail

hint-paper-trail-big-log =
    .lead = Was füllt /var? Schau dir die Größe der Logs an (man du, man df).
    .solution = df -h /var; sudo du -sh /var/log/cups/* /var/spool/cups
hint-paper-trail-names =
    .lead = Was schreibt cupsd in sein error_log, und auf welcher Stufe?
    .solution = sudo tail /var/log/cups/error_log; grep -E 'LogLevel|MaxLogSize' /etc/cups/cupsd.conf
hint-paper-trail-history =
    .lead = Wie weit zurück erinnert sich CUPS an Aufträge und ihre Dokumente? (man lpstat: -W; man cupsd.conf: PreserveJobHistory, PreserveJobFiles)
    .solution = lpstat -W completed -o; sudo ls /var/spool/cups
hint-paper-trail-loglevel =
    .lead = Setz die Log-Stufe wieder auf normal und wende sie an: cupsctl macht beides (man cupsctl).
    .solution = cupsctl --no-debug-logging
hint-paper-trail-rotation =
    .lead = Ein Log braucht eine Rotation: die von cupsd selbst (MaxLogSize) oder die von logrotate.
    .solution = cupsctl MaxLogSize=1m
hint-paper-trail-small =
    .lead = Das alte Log von 3,9 GB ist noch da (vielleicht umbenannt in error_log.O): es hat keinen Nutzen mehr.
    .solution = sudo rm /var/log/cups/error_log.O (oder sudo truncate -s 0 /var/log/cups/error_log)
hint-paper-trail-kept =
    .lead = Eine Woche Historie, Dokumente nicht aufbewahrt: zwei Direktiven von cupsd.conf, durch einen Neustart angewendet.
    .solution = cupsctl PreserveJobHistory=1w PreserveJobFiles=No
hint-paper-trail-private =
    .lead = Wer Name und Besitzer eines Auftrags sehen darf: ein Wert der Standard-Policy (man cupsd.conf, JobPrivateValues).
    .solution = cupsctl JobPrivateValues=default
hint-paper-trail-cancel-policy =
    .lead = Wer einen Auftrag abbrechen darf: das Cancel-Job-Limit der Standard-Policy; cupsctl hat eine Option dafür.
    .solution = cupsctl --no-user-cancel-any
hint-paper-trail-admin-closed =
    .lead = Die Verwaltungsseiten: cupsctl kann aufhören, sie ans Netzwerk auszuliefern.
    .solution = cupsctl --no-remote-admin
hint-paper-trail-end =
    .lead = Alles angewendet (cupsd läuft mit der Datei), die Logs klein, das Kollegium druckt weiter.
    .solution = cupsctl; df -h /var; lpstat -t
