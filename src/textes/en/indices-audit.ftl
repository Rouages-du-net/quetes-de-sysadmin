### Graded hints for The Audit (see src/moteur/indices.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a direction, without the
### exact command) and .solution (almost the answer: the command, with what
### it does). The names of places are those in noms.ftl.

## Chapter 1 — The report

indice-rapport-ssh =
    .piste = Finding C1: an option in /etc/ssh/sshd_config (man sshd_config). After changing it, sshd must reread its configuration: check it first (man sshd), then have the service reload.
    .solution = sudo nano /etc/ssh/sshd_config: PermitRootLogin no. Then sudo sshd -t, sudo systemctl reload ssh (and sudo sshd -T | grep permitroot to see what is applied).
indice-rapport-compte =
    .piste = Finding C2: Lucas's account must be good for nothing any more. The cleanest is to delete it (man userdel); otherwise lock it, expire it AND take it out of the sudo group (man usermod, man chage, man gpasswd).
    .solution = sudo userdel lucas (add -r to erase the home folder). Or: sudo usermod -L -e 1 lucas, then sudo gpasswd -d lucas sudo.
indice-rapport-sudo =
    .piste = Finding C3: sudo -l shows your account's rules. One comes from a file in /etc/sudoers.d, written by cloud-init. A sudoers file is edited with visudo (man visudo, man sudoers).
    .solution = sudo grep -r NOPASSWD /etc/sudoers.d finds the file; sudo visudo -f /etc/sudoers.d/90-cloud-init-users, remove the NOPASSWD: (or delete the file with sudo rm: the sudo group keeps its right, with a password).
indice-rapport-secret =
    .piste = Finding C4: ls -l shows who can read /srv/commandes/.env (man chmod). Close it to the other accounts, but not to its owner: the app is what reads it.
    .solution = sudo chmod 600 /srv/commandes/.env (or 640 if the commandes group must read it), then ls -l to check the owner is still commandes.

## Chapter 2 — The exposure

indice-exposition-ecoute =
    .piste = Before closing doors, look at which programs listen on which ports, on the server itself (man ss). Salomé's scan is in audit_scan.txt.
    .solution = sudo ss -tlnp (the listening TCP sockets, numeric, with the program). 0.0.0.0: all interfaces; 127.0.0.1: this machine only.
indice-exposition-pare-feu =
    .piste = ufw denies inbound by default once active; you only need to allow what must stay open (SSH, http, https) BEFORE enabling it (man ufw).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", then sudo ufw enable (sudo ufw status verbose to check).
indice-exposition-redis-local =
    .piste = The firewall is one layer; Redis itself must also listen only to the machine: a directive in /etc/redis/redis.conf. A program rereads its configuration when it restarts.
    .solution = sudo nano /etc/redis/redis.conf: bind 127.0.0.1 -::1 (instead of bind * -::*). Then sudo systemctl restart redis-server, and sudo ss -tlnp to check.
indice-exposition-fin =
    .piste = The firewall filters and Redis is local; prove SSH still gets through, with a new connection from your workstation.
    .solution = exit, then ssh fournil.

## Chapter 3 — The traces

indice-traces-trouve =
    .piste = The ssh service's journal keeps successful logins, with the address and the key's fingerprint; last sums up who logged in, when and from where (man journalctl, man last).
    .solution = journalctl -u ssh | grep Accepted (or sudo grep, or last nadia): the 3:12 a.m. line, from 203.0.113.99.
indice-traces-cle-identifiee =
    .piste = ssh-keygen can show the fingerprint of every key in a file (man ssh-keygen, option -l). Nadia's file is readable only by her: you need sudo.
    .solution = sudo ssh-keygen -l -f /home/nadia/.ssh/authorized_keys, then compare with the SHA256 fingerprint in the journal.
indice-traces-cle-revoquee =
    .piste = Remove from authorized_keys the line whose fingerprint is the night login's, and only that one: Nadia's must stay.
    .solution = sudo nano /home/nadia/.ssh/authorized_keys: delete the "… nadia@portable" line (the second one), save.
indice-traces-cron-decouvert =
    .piste = What runs by itself for an account: its crontab (man crontab). To read another account's, you must be root.
    .solution = sudo crontab -u nadia -l
indice-traces-cron-nettoye =
    .piste = Remove the intruder's line from Nadia's crontab without erasing her backup: crontab -r erases everything, crontab -e lets you choose.
    .solution = sudo crontab -u nadia -e: delete the line containing curl … | sh, keep the sauvegarde.sh one.
