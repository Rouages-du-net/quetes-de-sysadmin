### Graded hints for The Audit (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a direction, without the
### exact command) and .solution (almost the answer: the command, with what
### it does). The names of places are those in names.ftl.

## Chapter 2 — The report

hint-report-ssh =
    .lead = Finding C1: an option in /etc/ssh/sshd_config (man sshd_config). After changing it, sshd must reread its configuration: check it first (man sshd), then have the service reload.
    .solution = sudo nano /etc/ssh/sshd_config: PermitRootLogin no. Then sudo sshd -t, sudo systemctl reload ssh (and sudo sshd -T | grep permitroot to see what is applied).
hint-report-account =
    .lead = Finding C2: Lucas's account must be good for nothing any more. The cleanest is to delete it (man userdel); otherwise lock it, expire it AND take it out of the sudo group (man usermod, man chage, man gpasswd).
    .solution = sudo userdel lucas (add -r to erase the home folder). Or: sudo usermod -L -e 1 lucas, then sudo gpasswd -d lucas sudo.
hint-report-sudo =
    .lead = Finding C3: sudo -l shows your account's rules. One comes from a file in /etc/sudoers.d, written by cloud-init. A sudoers file is edited with visudo (man visudo, man sudoers).
    .solution = sudo grep -r NOPASSWD /etc/sudoers.d finds the file; sudo visudo -f /etc/sudoers.d/90-cloud-init-users, remove the NOPASSWD: (or delete the file with sudo rm: the sudo group keeps its right, with a password).
hint-report-secret =
    .lead = Finding C4: ls -l shows who can read /srv/orders/.env (man chmod). Close it to the other accounts, but not to its owner: the app is what reads it.
    .solution = sudo chmod 600 /srv/orders/.env (or 640 if the orders group must read it), then ls -l to check the owner is still orders.

## Chapter 3 — The exposure

hint-exposure-listening =
    .lead = Before closing doors, look at which programs listen on which ports, on the server itself (man ss). Salomé's scan is in audit_scan.txt.
    .solution = sudo ss -tlnp (the listening TCP sockets, numeric, with the program). 0.0.0.0: all interfaces; 127.0.0.1: this machine only.
hint-exposure-firewall =
    .lead = ufw denies inbound by default once active; you only need to allow what must stay open (SSH, http, https) BEFORE enabling it (man ufw).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", then sudo ufw enable (sudo ufw status verbose to check).
hint-exposure-redis-local =
    .lead = The firewall is one layer; Redis itself must also listen only to the machine: a directive in /etc/redis/redis.conf. A program rereads its configuration when it restarts.
    .solution = sudo nano /etc/redis/redis.conf: bind 127.0.0.1 -::1 (instead of bind * -::*). Then sudo systemctl restart redis-server, and sudo ss -tlnp to check.
hint-exposure-end =
    .lead = The firewall filters and Redis is local; prove SSH still gets through, with a new connection from your workstation.
    .solution = exit, then ssh bakery.

## Chapter 4 — The traces

hint-traces-found =
    .lead = The ssh service's journal keeps successful logins, with the address and the key's fingerprint; last sums up who logged in, when and from where (man journalctl, man last).
    .solution = journalctl -u ssh | grep Accepted (or sudo grep, or last nadia): the 3:12 a.m. line, from 203.0.113.99.
hint-traces-key-identified =
    .lead = ssh-keygen can show the fingerprint of every key in a file (man ssh-keygen, option -l). Nadia's file is readable only by her: you need sudo.
    .solution = sudo ssh-keygen -l -f /home/nadia/.ssh/authorized_keys, then compare with the SHA256 fingerprint in the journal.
hint-traces-key-revoked =
    .lead = Remove from authorized_keys the line whose fingerprint is the night login's, and only that one: Nadia's must stay.
    .solution = sudo nano /home/nadia/.ssh/authorized_keys: delete the "… nadia@laptop" line (the second one), save.
hint-traces-cron-found =
    .lead = What runs by itself for an account: its crontab (man crontab). To read another account's, you must be root.
    .solution = sudo crontab -u nadia -l
hint-traces-cron-cleaned =
    .lead = Remove the intruder's line from Nadia's crontab without erasing her backup: crontab -r erases everything, crontab -e lets you choose.
    .solution = sudo crontab -u nadia -e: delete the line containing curl … | sh, keep the backup.sh one.
hint-traces-secret-seen =
    .lead = Nadia's command history (.bash_history, readable only by her) says what was typed during the night's session. To read it in her place, you need sudo.
    .solution = sudo cat /home/nadia/.bash_history: the person read /srv/orders/.env, so the database password is compromised.
hint-traces-password =
    .lead = A database password is changed on both sides: in PostgreSQL (psql, ALTER ROLE, from the postgres account: man psql) AND in DATABASE_URL of the .env file; the app rereads .env only when it restarts. At least twelve characters.
    .solution = sudo -u postgres psql -c "ALTER ROLE orders PASSWORD 'a-long-passphrase'", then sudo nano /srv/orders/.env (the same password in DATABASE_URL), then sudo systemctl restart orders and systemctl status orders.

## Chapter 1 — The scope

hint-scope-letter =
    .lead = Before scanning anything: the letter of engagement is in your folder. It says what you may probe, and what you may not touch.
    .solution = cat engagement_letter.txt: the scope is ONE machine, bakery.internal (192.0.2.22). The neighbour (192.0.2.24) is not in it.
hint-scope-scan =
    .lead = nmap scans a machine's ports (man nmap): give it the exact address or name of the machine in the scope, and ask for the service versions too.
    .solution = nmap -sV bakery.internal (not 192.0.2.0/24: that would probe the neighbour too).
hint-scope-trace =
    .lead = Proof is kept: nmap can write its result, as you read it, into a file (man nmap, the -oN option).
    .solution = nmap -sV -oN inventory.txt bakery.internal
hint-scope-end =
    .lead = Complete audit_notes.md with nano: what you found (the database and Redis ports have no business on the internet) and what you spotted without touching it (the neighbour's server).
    .solution = nano audit_notes.md: under "What I found", quote 5432 (PostgreSQL) and 6379 (Redis); under "Out of scope", quote neighbour.internal (192.0.2.24), out of scope, not probed.

## Chapter 5 — The follow-up visit

hint-follow-up-scan =
    .lead = Redo the inventory like on day one, with versions, on the server and only on it (man nmap).
    .solution = nmap -sV bakery.internal
hint-follow-up-lynis =
    .lead = Lynis audits the machine it runs on; it needs root to read everything (man lynis). It fixes nothing.
    .solution = sudo lynis audit system
hint-follow-up-update =
    .lead = Lynis's warning (PKGS-7392) is about vulnerable packages: apt knows what is waiting (man apt).
    .solution = sudo apt update, sudo apt upgrade (apt list --upgradable shows what is waiting).
hint-follow-up-hardened =
    .lead = Among the suggestions, the ones worth the effort: SSH (sshd_config, man sshd_config), the UMASK in /etc/login.defs, the banner /etc/issue. You need an index of at least 70, with no warning, and the SSH configuration applied.
    .solution = sudo grep suggestion /var/log/lynis-report.dat. For example: X11Forwarding no and MaxAuthTries 3 in /etc/ssh/sshd_config (then sudo sshd -t, sudo systemctl reload ssh), UMASK 027 in /etc/login.defs, a legal notice in /etc/issue.
hint-follow-up-proof-lynis =
    .lead = A fix that is not proven is only an intention: run Lynis again so that it reflects the current state.
    .solution = sudo lynis audit system
hint-follow-up-nmap-own =
    .lead = Redo the scan with versions, now that the updates are done: the SSH version shown has changed.
    .solution = nmap -sV bakery.internal
hint-follow-up-end =
    .lead = Complete closing_report.md with nano: a summary, the findings fixed (parts 1 to 4), the evidence (the exact index of your last Lynis run and the ports seen), and what remains with a Lynis identifier that is still open.
    .solution = nano closing_report.md: under "Evidence", the last audit's index and ports 22, 80, 443; under "Still to do", for example FINT-4350 (file integrity) or LOGG-2154 (remote logs).
