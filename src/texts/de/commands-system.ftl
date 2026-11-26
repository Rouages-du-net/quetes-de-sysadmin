### Systembefehle (src/engine/commands/system.ts): ps, kill,
### systemctl. Die englischen Ausgaben von ps und systemctl bleiben im Code,
### wie auf einem echten System.

kill-usage = Aufruf: kill PID (die Nummer des Prozesses, von ps angezeigt)
# { $pid }: die getippte Nummer
kill-none = kill: ({ $pid }) - Kein passender Prozess gefunden
kill-not-allowed = kill: ({ $pid }) - Die Operation ist nicht erlaubt
systemctl-usage = Aufruf: systemctl status dienst (z. B. systemctl status nginx; siehe man systemctl)
# Erste Zeile: die Meldung von systemctl (auf Englisch); zweite: der Rat des Spiels.
systemctl-access-refuse =
    Failed to { $action } { $service }.service: Access denied
    (du musst root sein: sudo systemctl { $action } { $service })
journalctl-argument = journalctl: unerwartetes Argument '{ $argument }' (für einen Dienst: journalctl -u { $argument })
poweroff-refuse =
    Call to PowerOff failed: Access denied
    (du musst root sein: sudo poweroff)
shutdown-refuse =
    Call to ScheduleShutdown failed: Access denied
    (du musst root sein: sudo shutdown)
reboot-refuse =
    Failed to reboot system: Access denied
    (du musst root sein: sudo reboot)

## Logs (truncate, logrotate)

truncate-size = truncate: Sie müssen entweder „--size“ oder „--reference“ angeben
truncate-operand =
    truncate: Fehlender Dateioperand
    „truncate --help“ liefert weitere Informationen.
# { $size }: die angegebene Größe
truncate-size-incorrect = truncate: Ungültige Zahl: '{ $size }'
# { $file }: die Datei
truncate-directory = truncate: '{ $file }' kann nicht zum Schreiben geöffnet werden: Ist ein Verzeichnis
truncate-permission = truncate: '{ $file }' kann nicht zum Schreiben geöffnet werden: Keine Berechtigung
logrotate-usage =
    logrotate 3.21.0 - Copyright (C) 1995-2001 Red Hat, Inc.
    This may be freely redistributed under the terms of the GNU General Public License

    Usage: logrotate [-dfv?] [-d|--debug] [-f|--force] [-v|--verbose] <configfile>
pkill-usage =
    pkill: Keine passenden Kriterien angegeben
    Weitere Informationen mit »pkill --help«.
killall-usage = Aufruf: killall [-s SIGNAL | -SIGNAL] [-u Benutzer] [-v] Name...
# { $name }: der an killall übergebene Programmname
killall-none = killall: { $name }: Kein Prozess gefunden
# { $name }: der Programmname, { $pid }: die Nummer des Prozesses
killall-not-allowed = { $name }({ $pid }): Die Operation ist nicht erlaubt

# ionice gefolgt von einem Befehl: Das Spiel kann nur Prozesse einstellen, die schon laufen.
ionice-command = ionice: Hier nur für einen Prozess, der schon läuft (ionice -p PID oder ionice -c 3 -p PID). Siehe man ionice.
