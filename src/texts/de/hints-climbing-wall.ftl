### Abgestufte Hinweise für „Die Kletterhalle“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Der letzte Ausfall

hint-last-cut-blind =
    .lead = Was hat upsmon (der Dienst nut-monitor) vor und nach dem Absturz am Dienstag ins Journal geschrieben? journalctl kann eine Unit und einen früheren Boot zeigen.
    .solution = journalctl --list-boots; sudo journalctl -u nut-monitor -b -1 | tail
hint-last-cut-renamed =
    .lead = Welche USV-Namen stellt upsd bereit? Frag ihn (man upsc), oder lies die Abschnitte von ups.conf.
    .solution = upsc -l; upsc hallups; sudo cat /etc/nut/ups.conf
hint-last-cut-watching =
    .lead = Lass die MONITOR-Zeile von upsmon die USV nennen, die upsd bereitstellt, dann lass upsmon seine Konfiguration neu lesen und prüfe, dass er angemeldet ist.
    .solution = sudo nano /etc/nut/upsmon.conf: MONITOR hallups@localhost 1 upsmon … primary; sudo systemctl reload nut-monitor; upsc -c hallups
hint-last-cut-drill =
    .lead = Die Halle ist geschlossen: Die Doku von NUT testet das ganze Herunterfahren, indem sie upsmon ein erzwungenes Herunterfahren schickt (man upsmon, -c). Dann verbinde dich neu und lies das Ende des vorherigen Boots.
    .solution = sudo upsmon -c fsd; dann wieder ssh sicherung und sudo journalctl -b -1 | tail -20
hint-last-cut-stayed-off =
    .lead = Was macht die Firmware von sicherung, wenn der Strom zurückkommt? Der BMC weiß es (man ipmitool: chassis).
    .solution = sudo ipmitool chassis status; sudo ipmitool chassis policy list
hint-last-cut-policy =
    .lead = Stell die Power-Restore-Policy so ein, dass sicherung startet, sobald sein Strom zurückkommt.
    .solution = sudo ipmitool chassis policy always-on
hint-last-cut-end =
    .lead = Alles an seinem Platz? upsmon beobachtet hallups als primary, MINSUPPLIES 1, ein SHUTDOWNCMD, das anhält, always-on, und noch eine Übung, nach der sicherung von selbst wiederkommt.
    .solution = upsc -c hallups; grep -E 'MONITOR|MINSUPPLIES|SHUTDOWNCMD' /etc/nut/upsmon.conf; sudo ipmitool chassis status; sudo upsmon -c fsd

## Kapitel 2 — Der Reihe nach

hint-down-in-order-listen =
    .lead = Wo lauscht upsd? harness muss ihn auf der Büroadresse von sicherung erreichen (man upsd.conf: LISTEN; nur beim Start gelesen).
    .solution = sudo ss -tlnp | grep 3493; sudo nano /etc/nut/upsd.conf: LISTEN 127.0.0.1 3493 und LISTEN 198.51.100.141 3493; sudo systemctl restart nut-server
hint-down-in-order-secondary-user =
    .lead = harness braucht ein eigenes Konto in upsd.users, mit nur dem, was ein secondary-upsmon braucht (man upsd.users).
    .solution = sudo nano /etc/nut/upsd.users: [harness], password = …, upsmon secondary; sudo systemctl reload nut-server
hint-down-in-order-firewall =
    .lead = Die Firewall von sicherung verwirft, was sie nicht erlaubt: Lass harness, und nur harness, Port 3493 erreichen.
    .solution = sudo ufw allow from 198.51.100.142 to any port 3493 proto tcp
hint-down-in-order-secondary =
    .lead = Auf harness: Sag, welcher USV es folgen soll, auf welchem Server, als was (man upsmon.conf: MONITOR); den Modus in nut.conf; dann den Dienst, gestartet und aktiviert.
    .solution = ssh harness; sudo nano /etc/nut/upsmon.conf: MONITOR hallups@sicherung 1 harness … secondary; nut.conf: MODE=netclient; sudo systemctl enable --now nut-monitor; upsc hallups@sicherung
hint-down-in-order-drill-crash =
    .lead = harness braucht 150 s zum Anhalten, aber die USV schaltet ihre Steckdosen kurz nach dem Anhalten von sicherung ab. Welche Frist ist das, und wo wird sie eingestellt (man usbhid-ups)?
    .solution = sudo nano /etc/nut/ups.conf: unter [hallups] offdelay = 180 und ondelay = 240; dann noch einmal üben: sudo upsmon -c fsd
hint-down-in-order-end =
    .lead = Noch eine Übung, wenn alles an seinem Platz ist: beide Maschinen vor der Abschaltung angehalten, beide von selbst zurück, upsmon auf harness wieder angemeldet.
    .solution = sudo upsmon -c fsd; dann ssh sicherung, upsc -c hallups, und ssh harness: sudo journalctl -b -1 | tail

## Kapitel 3 — Alte Batterie

hint-old-battery-runtime =
    .lead = Was sagt die USV über ihre Batterie: Ladung, Laufzeit, Datum, ihren letzten Test (man upsc)?
    .solution = upsc hallups | grep -E 'battery|test'
hint-old-battery-denied =
    .lead = Welchen Test kann die USV ausführen, und welcher leert sie nicht? Dann führ ihn mit einem Konto aus, das upsd erlaubt (man upscmd, man upsd.users: instcmds).
    .solution = upscmd -l hallups; sudo nano /etc/nut/upsd.users: unter [admin] instcmds = test.battery.start.quick; sudo systemctl reload nut-server; upscmd -u admin -p … hallups test.battery.start.quick
hint-old-battery-warning =
    .lead = Ein Schnelltest dauert ein paar Sekunden: Lies sein Ergebnis.
    .solution = upsc hallups ups.test.result; upsc hallups ups.status
hint-old-battery-date =
    .lead = Sag der USV, wann ihre Batterie hergestellt wurde: Welche Variablen lassen sich schreiben (man upsrw)?
    .solution = upsrw -l hallups; upsrw -s battery.mfr.date=2032/12/02 -u admin -p … hallups (actions = SET ist schon da)
hint-old-battery-passed =
    .lead = Teste die neue Batterie genauso wie die alte.
    .solution = upscmd -u admin -p … hallups test.battery.start.quick; dann upsc hallups ups.test.result
hint-old-battery-alerts =
    .lead = Lass upsmon ONBATT und ONLINE an upssched weitergeben, und lass upssched nur mailen, wenn der Strom nach einer Weile immer noch weg ist (man upssched, man upssched.conf; Haruto hat ein CMDSCRIPT hinterlassen).
    .solution = upsmon.conf: NOTIFYCMD /usr/sbin/upssched; upssched.conf: CMDSCRIPT /usr/local/bin/ups-alert, PIPEFN und LOCKFN einkommentiert, AT ONBATT * START-TIMER onbatt 60, AT ONLINE * CANCEL-TIMER onbatt online; sudo systemctl reload nut-monitor
hint-old-battery-end =
    .lead = Alles zusammen: ein bestandener Test nach dem Tausch, das neue Datum, Alarme, die ein Flackern ignorieren und vor einem Ausfall warnen, kein laufender Tiefentest.
    .solution = upsc hallups | grep -E 'mfr.date|test.result|status'; sudo grep -v '^#' /etc/nut/upssched.conf | grep .
