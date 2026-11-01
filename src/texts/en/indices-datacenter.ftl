### Graded hints for The Data Centre (see src/engine/hints.ts): one message
### per step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). File names as in noms.ftl.

## Chapter 1 — First day

indice-first-day-compte =
    .piste = The log is /var/log/nginx/access.log. Keep the lines with a 503 error, then count them: two tools from Awa's notes, joined by a pipe.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l (grep keeps the 503 lines, wc -l counts them).
indice-first-day-robot =
    .piste = The IP address is the first field of each line. Keep it alone, sort, count identical lines, then sort by number: Awa's notes give the chain.
    .solution = cut -d " " -f 1 /var/log/nginx/access.log | sort | uniq -c | sort -n | tail -3 (the last line is the chattiest address).
indice-first-day-surcharge =
    .piste = The site is slow: some process must be eating the processor. One command lists every process on the machine, with its %CPU.
    .solution = ps aux (look at the %CPU column: php-fpm: pool catalogue is at 99%).
indice-first-day-regle =
    .piste = Block the robot in /etc/nginx/blocked.conf, in the format deny ADDRESS; without erasing the rules already there. The file belongs to root, and a >> redirection is done by your shell, not by sudo: tee can write for you.
    .solution = echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf (-a appends instead of overwriting).
indice-first-day-bloque =
    .piste = nginx does not reread its file on its own: you have to ask it, through the service manager.
    .solution = sudo systemctl reload nginx
indice-first-day-repare =
    .piste = The overloaded process is still running (ps aux). Stop it: it belongs to www-data, so you need sudo. systemd will restart it, clean.
    .solution = ps aux to find its number, then sudo kill PID (4242 at first, or that of the restarted process at 99%).
indice-first-day-rapport =
    .piste = The report goes in ~/rapport.txt: the number of 503 errors and the robot's address. > creates the file, >> appends a line.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt, then echo "Culprit: 198.51.100.77" >> ~/rapport.txt

## Chapter 2 — Second day

indice-second-day-malo-lit =
    .piste = ls -l /var/log/nginx shows which group owns the logs, and what that group may do. Add Malo to that group, without removing him from his own (man usermod: beware of -G without -a). Do not give read access to everyone.
    .solution = sudo usermod -aG adm malo (-a adds the group without replacing his other groups; check with groups malo).
indice-second-day-partage =
    .piste = /srv/team belongs to root. Give it to the web-team group, then permissions for the group and none for others (man chgrp, man chmod). No 777!
    .solution = sudo chgrp web-team /srv/team then sudo chmod 770 /srv/team (the group reads, writes, enters; others nothing).
indice-second-day-fin =
    .piste = Check both tasks: Malo reads the logs (without them being open to all) and stays in web-team; the shared directory is closed to other accounts.
    .solution = groups malo must show adm and web-team (otherwise: sudo usermod -aG web-team malo); the logs in 640 (sudo chmod 640 /var/log/nginx/access.log /var/log/nginx/error.log); /srv/team in 770.

## Chapter 3 — The night of the reboot

indice-reboot-night-nginx =
    .piste = Which services have failed, or are stopped? systemctl can list them and give the state of each. Look at nginx's Loaded line too: starting it is not enough, it must come back with the machine (man systemctl).
    .solution = sudo systemctl enable --now nginx (enable: it will start with the machine; --now: it starts right away).
indice-reboot-night-catalogue =
    .piste = The catalogue refuses to start: its log says why (journalctl -u). Its log directory belongs to root, whereas php-fpm runs as www-data. Change the owner, do not open it to everyone.
    .solution = sudo chown www-data: /var/log/catalogue, then sudo systemctl restart catalogue
indice-reboot-night-fin =
    .piste = The real test is the next boot: reboot the machine yourself, then check that everything came back without you.
    .solution = sudo reboot, then, once reconnected: systemctl --failed (or systemctl status nginx catalogue).

## Chapter 4 — The great fire

indice-fire-nginx =
    .piste = The machine is new: before installing, apt must download the list of available packages (man apt). The package is called nginx.
    .solution = sudo apt update, then sudo apt install nginx (curl http://localhost shows the welcome page).
indice-fire-fin =
    .piste = Follow the DRP (/mnt/backup/DRP.txt): check each archive by listing it (tar -t) before extracting it, take the most recent one that reads to the end, extract it from the root (man tar, -C). Then nginx -t: two sites cannot both be default_server on the same port.
    .solution = sudo tar -xzf /mnt/backup/medialibrary-2026-10-22.tar.gz -C /, then sudo rm /etc/nginx/sites-enabled/default, sudo nginx -t, sudo systemctl reload nginx, and curl http://medialibrary.example

## Chapter 5 — The certificate has expired

indice-certificate-expire =
    .piste = Start by confirming the outage: request the site over HTTPS, or ask certbot about the state of its certificates.
    .solution = curl https://medialibrary.example (or sudo certbot certificates: INVALID: EXPIRED).
indice-certificate-defi =
    .piste = Why did the automatic renewal fail? Replay it without breaking anything: man certbot mentions a dress rehearsal.
    .solution = sudo certbot renew --dry-run (and journalctl -u certbot for the log of previous nights).
indice-certificate-fin =
    .piste = certbot puts the challenge in the directory from /etc/letsencrypt/renewal/medialibrary.example.conf, but nginx serves the site from /var/www/medialibrary. Fix the directory, renew for real, reload nginx, and have it reloaded automatically after each renewal (search for "hook" in man certbot).
    .solution = sudo certbot renew --webroot -w /var/www/medialibrary, then sudo certbot reconfigure --cert-name medialibrary.example --deploy-hook "systemctl reload nginx", then sudo systemctl reload nginx
