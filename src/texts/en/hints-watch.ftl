### Graded hints for The Watch (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a direction, without the
### exact command) and .solution (almost the answer: the command, with what
### it does). The names of places are those in names.ftl.

## Chapter 1 — The bulletin

hint-bulletin-read =
    .lead = This week's bulletin is in your folder. For each CVE, check whether the package is even installed here, and at which version (man apt, the list option).
    .solution = cat security_bulletin.txt, then apt list --installed to see what's installed on this server, and at which version.
hint-bulletin-sort =
    .lead = Write your sort in watch.md: is certbot even on this server? Is curl already past the bulletin's fixed version?
    .solution = sudo nano watch.md: under "Not applicable", certbot (absent) and curl (already up to date); under "Concerns this server", nginx, rsync and openssh-server.
hint-bulletin-end =
    .lead = Check your sort doesn't mix anything up: only nginx, rsync and openssh-server belong under "Concerns this server".
    .solution = Reread watch.md fully: nothing about certbot or curl under "Concerns this server", nothing about nginx or rsync under "Not applicable".

## Chapter 2 — The priority

hint-priority-expose =
    .lead = Before ranking, look at what actually listens on this server, and what has no port at all (man ss, man nmap).
    .solution = ss -tlnp (or nmap -sV kneader.internal): 80 and 443 answer any address, nothing listens for rsync.
hint-priority-order =
    .lead = rsync's score is higher, but a score measures how bad things get IF the service is reached, not how easy it is to reach. Write your decision in priority.md, nginx first, with why.
    .solution = sudo nano priority.md: nginx first (exposed to the internet, 80/443), rsync next (higher score, but no listening port); and a word on openssh-server (already protected, KbdInteractiveAuthentication set to no).
hint-priority-end =
    .lead = Check your text says WHY, not just the order: what makes nginx reachable, what keeps rsync from being reachable?
    .solution = Reread priority.md: the reason for the order must cite exposure (internet, port), not just the score.

## Chapter 3 — The fix

hint-fix-fixed =
    .lead = apt upgrade installs the available fixes, but only the ones apt knows about: refresh the package list first (man apt).
    .solution = sudo apt update, then sudo apt upgrade (both fixes, nginx and rsync, install together).
hint-fix-checked =
    .lead = Before moving on: does the site still answer? (man curl)
    .solution = curl -I http://bakery.example/ (expect code 200).
hint-fix-end =
    .lead = Both packages must be at the bulletin's fixed version, and the site must still answer.
    .solution = apt list --installed | grep -E 'nginx|rsync' to check the versions, then curl -I http://bakery.example/.

## Chapter 4 — No proof, no certainty

hint-proof-versions =
    .lead = A fix is reproven: ask apt what's still left to update (man apt).
    .solution = apt list --upgradable (nothing should show for nginx or rsync any more).
hint-proof-found =
    .lead = nginx's access log keeps a record of every request. The nginx flaw was in HTTP/2: look for a request of that kind (man grep).
    .solution = grep "HTTP/2" /var/log/nginx/access.log (a line with code 400, no declared browser, a few days before the fix).
hint-proof-end =
    .lead = You need two things: proof the packages are up to date, and to have checked the access log for an earlier attempt.
    .solution = apt list --upgradable (empty), then grep "HTTP/2" /var/log/nginx/access.log.

## Chapter 5 — Settling into a routine

hint-routine-active =
    .lead = unattended-upgrades is installed but switched off: look at /etc/apt/apt.conf.d/20auto-upgrades (man apt.conf).
    .solution = sudo nano /etc/apt/apt.conf.d/20auto-upgrades: set both lines to "1".
hint-routine-security =
    .lead = In /etc/apt/apt.conf.d/50unattended-upgrades, one Origins-Pattern line allows ALL updates, not just security; and Unattended-Upgrade::Mail is commented out.
    .solution = sudo nano /etc/apt/apt.conf.d/50unattended-upgrades: comment out the "label=Debian" line (without -Security), keep both "label=Debian-Security" lines, and uncomment Unattended-Upgrade::Mail with an address (e.g. "root").
hint-routine-periodic =
    .lead = You need a weekly check-in that survives a reboot: a systemd timer in /etc/systemd/system, or a cron job, that looks at pending updates and mails you the result (man systemd.timer, man crontab).
    .solution = A timer: sudo nano /etc/systemd/system/watch.service (ExecStart=/bin/sh -c "apt list --upgradable | mail -s Watch root") and /etc/systemd/system/watch.timer (OnCalendar=weekly), then sudo systemctl daemon-reload && sudo systemctl enable --now watch.timer. Or a cron job: sudo crontab -e, a weekly line doing the same thing.
hint-routine-end =
    .lead = Three things to check: both 20auto-upgrades tasks enabled, 50unattended-upgrades limited to security with a report, and an active periodic check-in.
    .solution = sudo apt-config dump | grep Periodic, cat /etc/apt/apt.conf.d/50unattended-upgrades, systemctl list-timers (or crontab -l).
