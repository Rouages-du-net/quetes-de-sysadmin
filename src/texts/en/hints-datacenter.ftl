### Graded hints for The Data Centre (see src/engine/hints.ts): one message
### per step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). File names as in names.ftl.

## Chapter 1 — First day

hint-first-day-account =
    .lead = The log is /var/log/nginx/access.log. Keep the lines with a 503 error, then count them: two tools from Awa's notes, joined by a pipe.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l (grep keeps the 503 lines, wc -l counts them).
hint-first-day-robot =
    .lead = The IP address is the first field of each line. Keep it alone, sort, count identical lines, then sort by number: Awa's notes give the chain.
    .solution = cut -d " " -f 1 /var/log/nginx/access.log | sort | uniq -c | sort -n | tail -3 (the last line is the chattiest address).
hint-first-day-override =
    .lead = The site is slow: some process must be eating the processor. One command lists every process on the machine, with its %CPU.
    .solution = ps aux (look at the %CPU column: php-fpm: pool catalogue is at 99%).
hint-first-day-rule =
    .lead = Block the robot in /etc/nginx/blocked.conf, in the format deny ADDRESS; without erasing the rules already there. The file belongs to root, and a >> redirection is done by your shell, not by sudo: tee can write for you.
    .solution = echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf (-a appends instead of overwriting).
hint-first-day-blocked =
    .lead = nginx does not reread its file on its own: you have to ask it, through the service manager.
    .solution = sudo systemctl reload nginx
hint-first-day-repaired =
    .lead = The overloaded process is still running (ps aux). Stop it: it belongs to www-data, so you need sudo. systemd will restart it, clean.
    .solution = ps aux to find its number, then sudo kill PID (4242 at first, or that of the restarted process at 99%).
hint-first-day-report =
    .lead = The report goes in ~/rapport.txt: the number of 503 errors and the robot's address. > creates the file, >> appends a line.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt, then echo "Culprit: 198.51.100.77" >> ~/rapport.txt

## Chapter 2 — Second day

hint-second-day-malo-reads =
    .lead = ls -l /var/log/nginx shows which group owns the logs, and what that group may do. Add Malo to that group, without removing him from his own (man usermod: beware of -G without -a). Do not give read access to everyone.
    .solution = sudo usermod -aG adm malo (-a adds the group without replacing his other groups; check with groups malo).
hint-second-day-share =
    .lead = /srv/team belongs to root. Give it to the web-team group, then permissions for the group and none for others (man chgrp, man chmod). No 777!
    .solution = sudo chgrp web-team /srv/team then sudo chmod 770 /srv/team (the group reads, writes, enters; others nothing).
hint-second-day-end =
    .lead = Check both tasks: Malo reads the logs (without them being open to all) and stays in web-team; the shared directory is closed to other accounts.
    .solution = groups malo must show adm and web-team (otherwise: sudo usermod -aG web-team malo); the logs in 640 (sudo chmod 640 /var/log/nginx/access.log /var/log/nginx/error.log); /srv/team in 770.

## Chapter 3 — The night of the reboot

hint-reboot-night-nginx =
    .lead = Which services have failed, or are stopped? systemctl can list them and give the state of each. Look at nginx's Loaded line too: starting it is not enough, it must come back with the machine (man systemctl).
    .solution = sudo systemctl enable --now nginx (enable: it will start with the machine; --now: it starts right away).
hint-reboot-night-catalogue =
    .lead = The catalogue refuses to start: its log says why (journalctl -u). Its log directory belongs to root, whereas php-fpm runs as www-data. Change the owner, do not open it to everyone.
    .solution = sudo chown www-data: /var/log/catalogue, then sudo systemctl restart catalogue
hint-reboot-night-end =
    .lead = The real test is the next boot: reboot the machine yourself, then check that everything came back without you.
    .solution = sudo reboot, then, once reconnected: systemctl --failed (or systemctl status nginx catalogue).

## Chapter 4 — The great fire

hint-fire-nginx =
    .lead = The machine is new: before installing, apt must download the list of available packages (man apt). The package is called nginx.
    .solution = sudo apt update, then sudo apt install nginx (curl http://localhost shows the welcome page).
hint-fire-end =
    .lead = Follow the DRP (/mnt/backup/DRP.txt): check each archive by listing it (tar -t) before extracting it, take the most recent one that reads to the end, extract it from the root (man tar, -C). Then nginx -t: two sites cannot both be default_server on the same port.
    .solution = sudo tar -xzf /mnt/backup/medialibrary-2026-10-22.tar.gz -C /, then sudo rm /etc/nginx/sites-enabled/default, sudo nginx -t, sudo systemctl reload nginx, and curl http://medialibrary.example

## Chapter 5 — The certificate has expired

hint-certificate-expires =
    .lead = Start by confirming the outage: request the site over HTTPS, or ask certbot about the state of its certificates.
    .solution = curl https://medialibrary.example (or sudo certbot certificates: INVALID: EXPIRED).
hint-certificate-challenge =
    .lead = Why did the automatic renewal fail? Replay it without breaking anything: man certbot mentions a dress rehearsal.
    .solution = sudo certbot renew --dry-run (and journalctl -u certbot for the log of previous nights).
hint-certificate-end =
    .lead = certbot puts the challenge in the directory from /etc/letsencrypt/renewal/medialibrary.example.conf, but nginx serves the site from /var/www/medialibrary. Fix the directory, renew for real, reload nginx, and have it reloaded automatically after each renewal (search for "hook" in man certbot).
    .solution = sudo certbot renew --webroot -w /var/www/medialibrary, then sudo certbot reconfigure --cert-name medialibrary.example --deploy-hook "systemctl reload nginx", then sudo systemctl reload nginx
