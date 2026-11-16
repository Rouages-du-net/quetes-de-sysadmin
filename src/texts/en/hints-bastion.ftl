### Graded hints for The Bastion (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the exact
### command) and .solution (almost the answer: the command, with what it
### does).

## Chapter 1 — The Alarm

hint-alarm-process =
    .lead = Something takes the processor: look at what runs, as which account, from which folder (man ps, man top).
    .solution = ps aux (or top): a "kworkerd" at almost 200 % CPU, owned by deploy, started from /tmp/.cache.
hint-alarm-connection =
    .lead = The host names an address and a port: find which program holds that connection (man ss, or man netstat). The process column needs root.
    .solution = sudo ss -tnp (or sudo netstat -tnp): kworkerd, connected to 198.51.100.66:3333.
hint-alarm-entry =
    .lead = How did they come in? ssh's log keeps every attempt and every login (man journalctl); last lists the sessions.
    .solution = sudo journalctl -u ssh | grep deploy: failed passwords, then "Accepted password for deploy from 203.0.113.66" at 02:40:57.
hint-alarm-end =
    .lead = Complete incident.md: the program and its folder, the pool's address, the account, the intruder's address and the time of the login.
    .solution = nano incident.md: /tmp/.cache/kworkerd (deploy), 198.51.100.66 port 3333, deploy by password from 203.0.113.66 at 02:40.

## Chapter 2 — Containment

hint-containment-pool =
    .lead = Stop the miner from reaching the pool: a firewall rule on what leaves the machine (man iptables, the OUTPUT chain).
    .solution = sudo iptables -A OUTPUT -d 198.51.100.66 -j DROP
hint-containment-attacker =
    .lead = Close the door to the address they came from: a rule on what comes in (INPUT, by source). Mind your own ssh.
    .solution = sudo iptables -A INPUT -s 203.0.113.66 -j DROP (an append doesn't touch your own access; check with sudo iptables -L -n).
hint-containment-stopped =
    .lead = The miner comes back when you stop it: something watches it. Look at its parent (ps -ef, the PPID column) and stop that first (man kill).
    .solution = sudo kill 4410 (the watchdog, /bin/sh /tmp/.cache/.w), then sudo kill on kworkerd's PID (or sudo killall kworkerd once the watchdog is gone).
hint-containment-closed =
    .lead = Close deploy for good, key included: man usermod says what -L does not cover.
    .solution = sudo usermod -L -e 1 deploy (password locked AND account expired; sudo chage -E 0 deploy expires it too).
hint-containment-end =
    .lead = Check it all: pool and address blocked, your ssh still accepted, nothing from /tmp/.cache running, deploy closed, and the delivery app running.
    .solution = sudo iptables -L -n, ps aux | grep cache, systemctl status delivery (sudo systemctl start delivery if it stopped, then stop what it relaunched).

## Chapter 3 — Eradication

hint-eradication-cron =
    .lead = An account can leave a job that starts at every boot: read deploy's crontab, and remove only what isn't Selma's (man crontab, -u).
    .solution = sudo crontab -u deploy -e: delete the "@reboot /bin/sh /tmp/.cache/.w" line, keep sync-orders.
hint-eradication-key =
    .lead = Two keys on deploy: compare their fingerprints with the one in Selma's email (man ssh-keygen, -l).
    .solution = sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys, then sudo nano /home/deploy/.ssh/authorized_keys: remove the line whose fingerprint isn't Selma's.
hint-eradication-files =
    .lead = The miner and its watchdog are still on disk (man rm).
    .solution = sudo ls -la /tmp/.cache, then sudo rm /tmp/.cache/kworkerd /tmp/.cache/.w (the hidden .w too).
hint-eradication-verified =
    .lead = What did they change? find can list recently modified files (man find, -mtime); deploy's history says it too. Before restoring, check the release's signature (man gpg, --verify).
    .solution = sudo find /srv/delivery -type f -mtime -3 (server.js), then gpg --verify /srv/releases/delivery-2.3.1.tar.gz.asc /srv/releases/delivery-2.3.1.tar.gz (Good signature; the copy in /home/deploy is BAD).
hint-eradication-restored =
    .lead = Restore server.js from the archive whose signature is good (man tar, -x and -C).
    .solution = sudo tar -xzf /srv/releases/delivery-2.3.1.tar.gz -C /srv (it rewrites /srv/delivery/server.js; diff it with the archive's if in doubt).
hint-eradication-end =
    .lead = Check: no @reboot, sync-orders kept, only Selma's key, /tmp/.cache gone, server.js as released, the app running and nothing relaunched.
    .solution = sudo crontab -u deploy -l, sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys, sudo ls -la /tmp/.cache, sudo systemctl restart delivery, ps aux | grep cache.

## Chapter 4 — Hardening

hint-hardening-passwords =
    .lead = sshd_config says no to passwords, yet they were accepted: ask sshd what it applies (man sshd, -T), and look at what it includes first.
    .solution = sudo sshd -T | grep passwordauthentication, then sudo rm /etc/ssh/sshd_config.d/50-delivery.conf and sudo systemctl reload ssh.
hint-hardening-firewall =
    .lead = Deny by default (iptables -P INPUT DROP), but first accept lo, the replies (-m state --state ESTABLISHED,RELATED), and ports 22, 80, 443 (man iptables).
    .solution = sudo iptables -A INPUT -i lo -j ACCEPT; sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT; sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT (same for 80 and 443); then sudo iptables -P INPUT DROP.
hint-hardening-saved =
    .lead = Rules live in memory: write them where iptables-persistent reads them at boot (man iptables-save). Mind that a redirection runs as you, not as root.
    .solution = sudo iptables-save | sudo tee /etc/iptables/rules.v4
hint-hardening-deploy =
    .lead = Selma needs deploy back: lift what closed it (man usermod, -e; man chage).
    .solution = sudo usermod -e "" deploy (or sudo chage -E -1 deploy); with passwords off, only her key opens it.
hint-hardening-end =
    .lead = Check: sshd -T says no, iptables -L shows policy DROP with lo, ESTABLISHED, 22, 80, 443, the rules saved, deploy usable.
    .solution = sudo sshd -T | grep password, sudo iptables -L -n, sudo cat /etc/iptables/rules.v4, sudo chage -l deploy.
