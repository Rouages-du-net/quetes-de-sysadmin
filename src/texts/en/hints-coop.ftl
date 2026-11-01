### Graded hints for The Co-op (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Place names as in names.ftl.

## Chapter 1 — The departure

hint-departure-backup =
    .lead = Before closing anything: what does Marc run under his account? His crontab (as root) starts a script kept in his home directory. The job must outlive his departure: the script outside /home, and an account that stays to run it.
    .solution = sudo cp /home/marc/bin/till-backup.sh /usr/local/bin/, then sudo crontab -e and the line: 30 2 * * * /usr/local/bin/till-backup.sh (root's crontab)
hint-departure-closed =
    .lead = Closing access means closing it everywhere: his account (usermod -L only blocks the password, not the SSH key: read man usermod again), the sudo group, his key in the deploy account (only his line), and his session still open (who, ps -u marc).
    .solution = sudo usermod -e 1 marc (the account expires), sudo gpasswd -d marc sudo, sudo nano /home/deploy/.ssh/authorized_keys (delete only the marc@laptop line), then sudo pkill -u marc
hint-departure-end =
    .lead = One piece is missing: go through Awa's email point by point. Marc must not get in by any route, the CI and Lina keep their keys in deploy, and the nightly backup runs as root or deploy.
    .solution = sudo crontab -l (is the backup there?), sudo cat /home/deploy/.ssh/authorized_keys (deploy@ci and lina@workshop there, marc@laptop gone), sudo chage -l marc, groups marc, who

## Chapter 2 — Shared permissions

hint-shared-rights-directory =
    .lead = ls -l /srv/till/statements: the directory belongs to root, and each statement to its author's group. You need a directory of the till group, writable by the group, whose setgid bit hands its group to everything created in it (man chmod).
    .solution = sudo chgrp -R till /srv/till/statements, sudo chmod -R g+w /srv/till/statements, then sudo chmod g+s /srv/till/statements (ls -ld shows drwxrwsr-x)
hint-shared-rights-mask =
    .lead = Lina's and Karim's next files will be born rw-r--r--: that is their mask (umask 022). It is set at login, in their ~/.profile or for everyone in /etc/profile.d (man umask).
    .solution = sudo nano /home/lina/.profile and sudo nano /home/karim/.profile: replace #umask 022 with umask 002 (or a file /etc/profile.d/umask-team.sh containing umask 002)
hint-shared-rights-sudo =
    .lead = A sudo rule for the till group, in its own file in /etc/sudoers.d (no dot in the name), written with visudo, which checks before saving. The command is written with its full path (which) and its arguments, so nothing else is allowed (man sudoers).
    .solution = sudo visudo -f /etc/sudoers.d/till, with the line %till ALL=(root) /usr/bin/systemctl restart till — then sudo -l -U lina to check
hint-shared-rights-end =
    .lead = Directory, mask and sudo all set? Look at what was already in the directory: yesterday's statements must also belong to the till group and be writable by it.
    .solution = ls -l /srv/till/statements, then sudo chgrp -R till /srv/till/statements and sudo chmod -R g+w /srv/till/statements

## Chapter 3 — The secret

hint-secret-closed =
    .lead = Ask the site for /.env yourself with curl: nginx serves the whole app directory, hidden files included (.env, but also .git). In the site's configuration, a location with a regular expression can refuse any path containing "/." (the documentation of location and deny).
    .solution = sudo nano /etc/nginx/sites-available/coop: add location ~ /\. {"{"} deny all; {"}"} in the server block, then sudo nginx -t and sudo systemctl reload nginx
hint-secret-attacker =
    .lead = Who took the key? nginx's access log (/var/log/nginx/access.log) keeps every request for /.env, with the address and the 200 response. One nginx directive refuses an address.
    .solution = sudo grep '\.env' /var/log/nginx/access.log (it's 203.0.113.77), then deny 203.0.113.77; in the site's server block, and sudo systemctl reload nginx
hint-secret-key-written =
    .lead = The old key is disabled: the new one is in Awa's email, and it belongs in the .env file of the till app (/srv/till/app).
    .solution = sudo nano /srv/till/app/.env: replace the value of PAYMENT_KEY= with the new key from the email
hint-secret-end =
    .lead = The new key is written, but the app only reads its .env at startup. Its /health route tells you which key it uses.
    .solution = sudo systemctl restart till, then curl http://127.0.0.1:3000/health ("payment": "ok")

## Chapter 4 — The proxy

hint-proxy-end =
    .lead = Compare the two logs: nginx sees the robot (198.51.100.66), the till only sees 127.0.0.1. nginx must pass the client's address in a header (proxy_set_header), and the app must believe that header only when it comes from nginx (TRUST_PROXY, Express guide "behind proxies"): not true, the robot writes its own X-Forwarded-For.
    .solution = In the /till/ location of /etc/nginx/sites-available/coop: proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; — in /srv/till/app/.env: TRUST_PROXY=loopback — then sudo systemctl reload nginx and sudo systemctl restart till

## Chapter 5 — Updates

hint-updates-a-day =
    .lead = apt only knows about new versions once it has re-read the repositories (man apt: update first, then upgrade). The wifi will drop: a long operation goes in a session that outlives the connection (man tmux). If dpkg was interrupted, apt tells you what to run.
    .solution = sudo apt update, then tmux new -s upgrade and sudo apt upgrade; if the connection drops: ssh coop and tmux attach -t upgrade (without tmux: sudo dpkg --configure -a, then sudo apt upgrade)
hint-updates-till-down =
    .lead = The packages are installed, but uname -r still gives the old kernel. A file in /var/run says why you need to reboot.
    .solution = cat /var/run/reboot-required.pkgs, then sudo reboot (and ssh coop to come back)
hint-updates-end =
    .lead = After a reboot, only enabled services come back. Check the site and the till (systemctl --failed, systemctl status till: "disabled").
    .solution = sudo systemctl enable --now till (enabled at boot, and started right away)

## Chapter 6 — Automatic updates

hint-auto-updates-end =
    .lead = Everything is in /etc/apt/apt.conf.d: 20auto-upgrades switches the daily jobs on or off (at "0", nothing happens), 50unattended-upgrades sets the report (Mail), the reboot and its time (Automatic-Reboot-Time, at night). Leave Origins-Pattern as it is: nodejs comes from another repository. Then start the service that does the work every morning (systemctl list-timers).
    .solution = In 20auto-upgrades: both values to "1"; in 50unattended-upgrades, uncomment Unattended-Upgrade::Mail "root";, Automatic-Reboot "true"; and Automatic-Reboot-Time "02:00"; — then sudo systemctl start apt-daily-upgrade
