### Graded hints for The Climbing Wall (see src/engine/hints.ts): one
### message per step, hint-<chapter>-<event>, with .lead (a direction,
### without the exact command) and .solution (almost the answer).

## Chapter 1 — The Last Cut

hint-last-cut-blind =
    .lead = What did upsmon (the nut-monitor service) write in the journal, before and after Tuesday's crash? journalctl can show one unit and an earlier boot.
    .solution = journalctl --list-boots; sudo journalctl -u nut-monitor -b -1 | tail
hint-last-cut-renamed =
    .lead = Which UPS names does upsd serve? Ask it (man upsc), or read the sections of ups.conf.
    .solution = upsc -l; upsc hallups; sudo cat /etc/nut/ups.conf
hint-last-cut-watching =
    .lead = Make upsmon's MONITOR line name the UPS upsd serves, then have upsmon reread its configuration and check it logged in.
    .solution = sudo nano /etc/nut/upsmon.conf: MONITOR hallups@localhost 1 upsmon … primary; sudo systemctl reload nut-monitor; upsc -c hallups
hint-last-cut-drill =
    .lead = The hall is closed: NUT's documentation tests the whole shutdown by sending upsmon a forced shutdown (man upsmon, -c). Then reconnect and read the previous boot's end.
    .solution = sudo upsmon -c fsd; then ssh belay again and sudo journalctl -b -1 | tail -20
hint-last-cut-stayed-off =
    .lead = What does belay's firmware do when power comes back? The BMC knows (man ipmitool: chassis).
    .solution = sudo ipmitool chassis status; sudo ipmitool chassis policy list
hint-last-cut-policy =
    .lead = Set the power restore policy so that belay starts whenever its power returns.
    .solution = sudo ipmitool chassis policy always-on
hint-last-cut-end =
    .lead = Everything in place? upsmon watching hallups as a primary, MINSUPPLIES 1, a SHUTDOWNCMD that halts, always-on, and one more drill where belay comes back by itself.
    .solution = upsc -c hallups; grep -E 'MONITOR|MINSUPPLIES|SHUTDOWNCMD' /etc/nut/upsmon.conf; sudo ipmitool chassis status; sudo upsmon -c fsd

## Chapter 2 — Down in Order

hint-down-in-order-listen =
    .lead = Where does upsd listen? harness must reach it on belay's office address (man upsd.conf: LISTEN; read only at start).
    .solution = sudo ss -tlnp | grep 3493; sudo nano /etc/nut/upsd.conf: LISTEN 127.0.0.1 3493 and LISTEN 198.51.100.141 3493; sudo systemctl restart nut-server
hint-down-in-order-secondary-user =
    .lead = harness needs its own account in upsd.users, with only what a secondary upsmon needs (man upsd.users).
    .solution = sudo nano /etc/nut/upsd.users: [harness], password = …, upsmon secondary; sudo systemctl reload nut-server
hint-down-in-order-firewall =
    .lead = belay's firewall drops what it doesn't allow: let harness, and only harness, reach port 3493.
    .solution = sudo ufw allow from 198.51.100.142 to any port 3493 proto tcp
hint-down-in-order-secondary =
    .lead = On harness: say which UPS to follow, on which server, as what (man upsmon.conf: MONITOR); the mode in nut.conf; then the service, started and enabled.
    .solution = ssh harness; sudo nano /etc/nut/upsmon.conf: MONITOR hallups@belay 1 harness … secondary; nut.conf: MODE=netclient; sudo systemctl enable --now nut-monitor; upsc hallups@belay
hint-down-in-order-drill-crash =
    .lead = harness needs 150 s to stop, but the UPS cuts its outlets a short delay after belay's halt. Which delay is that, and where is it set (man usbhid-ups)?
    .solution = sudo nano /etc/nut/ups.conf: under [hallups], offdelay = 180 and ondelay = 240; then drill again: sudo upsmon -c fsd
hint-down-in-order-end =
    .lead = One more drill, once everything is in place: both machines halted before the cut, both back by themselves, harness's upsmon logged in again.
    .solution = sudo upsmon -c fsd; then ssh belay, upsc -c hallups, and ssh harness: sudo journalctl -b -1 | tail

## Chapter 3 — Old Battery

hint-old-battery-runtime =
    .lead = What does the UPS say about its battery: charge, runtime, date, its last test (man upsc)?
    .solution = upsc hallups | grep -E 'battery|test'
hint-old-battery-denied =
    .lead = Which test can the UPS run, and which one doesn't drain it? Then run it as an account upsd allows (man upscmd, man upsd.users: instcmds).
    .solution = upscmd -l hallups; sudo nano /etc/nut/upsd.users: under [admin], instcmds = test.battery.start.quick; sudo systemctl reload nut-server; upscmd -u admin -p … hallups test.battery.start.quick
hint-old-battery-warning =
    .lead = A quick test takes a few seconds: read its result.
    .solution = upsc hallups ups.test.result; upsc hallups ups.status
hint-old-battery-date =
    .lead = Tell the UPS when its battery was made: which variables can be written (man upsrw)?
    .solution = upsrw -l hallups; upsrw -s battery.mfr.date=2032/12/02 -u admin -p … hallups (actions = SET is already there)
hint-old-battery-passed =
    .lead = Test the new battery the same way as the old one.
    .solution = upscmd -u admin -p … hallups test.battery.start.quick; then upsc hallups ups.test.result
hint-old-battery-alerts =
    .lead = Let upsmon hand ONBATT and ONLINE to upssched, and let upssched mail only if the power is still out after a while (man upssched, man upssched.conf; Haruto left a CMDSCRIPT).
    .solution = upsmon.conf: NOTIFYCMD /usr/sbin/upssched; upssched.conf: CMDSCRIPT /usr/local/bin/ups-alert, PIPEFN and LOCKFN uncommented, AT ONBATT * START-TIMER onbatt 60, AT ONLINE * CANCEL-TIMER onbatt online; sudo systemctl reload nut-monitor
hint-old-battery-end =
    .lead = All of it: a passed test after the swap, the new date, alerts that ignore a flicker and warn of an outage, no deep test running.
    .solution = upsc hallups | grep -E 'mfr.date|test.result|status'; sudo grep -v '^#' /etc/nut/upssched.conf | grep .
