### Graded hints for The Neighbourhood Letters (see src/moteur/indices.ts): one
### message per step, indice-<chapter>-<event>, with .piste (a lead, without
### the exact command) and .solution (almost the answer). Place names as in
### noms.ftl.

## Chapter 1 — Shut the Door

indice-fermer-la-porte-fermee =
    .piste = Two options in /etc/ssh/sshd_config (man sshd_config): PermitRootLogin and PasswordAuthentication. But look at the Include line at the top: for sshd, the first value read wins. sshd -t checks, then the service must be reloaded.
    .solution = sudo nano /etc/ssh/sshd_config: PermitRootLogin no; in /etc/ssh/sshd_config.d/50-cloud-init.conf: PasswordAuthentication no. Then sudo sshd -t and sudo systemctl reload ssh (sudo sshd -T shows the values in force).
indice-fermer-la-porte-fin =
    .piste = The door is shut; now prove that you can still get in. A session that is already open proves nothing: you need a new one.
    .solution = exit, then from your workstation: ssh letters (and ssh root@letters must be refused).

## Chapter 2 — The firewall

indice-pare-feu-ecoute =
    .piste = Before closing doors, look at which programs listen on which ports, on the server itself (man ss).
    .solution = ss -tlnp (listening TCP sockets, as numbers; 3306 is MariaDB).
indice-pare-feu-filtre =
    .piste = Once enabled, ufw denies incoming traffic by default; just allow what must stay open (SSH, http, https) BEFORE enabling it (man ufw, ufw app list).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", then sudo ufw enable (and sudo ufw status verbose to check).
indice-pare-feu-fin =
    .piste = The firewall is filtering; prove that SSH still gets through, with a new connection from your workstation.
    .solution = exit, then ssh letters.

## Chapter 3 — The sentinel

indice-sentinelle-rania =
    .piste = Rania (198.51.100.40) is in fail2ban's sshd jail. fail2ban-client can show a jail's status, and lift a ban.
    .solution = sudo fail2ban-client status sshd, then sudo fail2ban-client set sshd unbanip 198.51.100.40
indice-sentinelle-reglee =
    .piste = Leave jail.conf alone: settings go in /etc/fail2ban/jail.local (man jail.conf). You need a bantime of at least an hour, and ignoreip for Rania and for your workstation (its address is in journalctl -u ssh). Then reload fail2ban.
    .solution = sudo nano /etc/fail2ban/jail.local: [DEFAULT], bantime = 1h, ignoreip = 127.0.0.1/8 ::1 192.0.2.2 198.51.100.40; then sudo fail2ban-client -t and sudo systemctl reload fail2ban
indice-sentinelle-fin =
    .piste = After the reload, check the jail's status: the bots banned, neither Rania nor you.
    .solution = sudo fail2ban-client status sshd

## Chapter 4 — Sharing a home

indice-colocation-cafe =
    .piste = On Debian, an nginx site = a file in /etc/nginx/sites-available, enabled by a symbolic link in sites-enabled (see note_from_rania.txt). The café's site has its own server_name and its root /var/www/cafe, without default_server.
    .solution = sudo cp /etc/nginx/sites-available/letters /etc/nginx/sites-available/cafe, replace letters with cafe in it and remove default_server (sudo nano), then sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/, sudo nginx -t and sudo systemctl reload nginx
indice-colocation-fin =
    .piste = The calendar listens on 127.0.0.1:3000 and its pages start at /: nginx must pass /agenda/ to it, stripping that prefix (proxy_pass, and the trailing slash). And the agenda service must run, even after a reboot (man systemctl).
    .solution = In /etc/nginx/sites-available/letters: location /agenda/ {"{"} proxy_pass http://127.0.0.1:3000/; {"}"}; sudo nginx -t, sudo systemctl reload nginx, then sudo systemctl enable --now agenda

## Chapter 5 — Works on my machine

indice-chez-moi-fin =
    .piste = /etc/hosts only counts for one machine: the cafe.example zone must be fixed (/etc/bind/zones/db.cafe.example, see help_dns.txt). New address, a www, a higher serial number so that ns2 copies the zone again, and the final dot of full names.
    .solution = sudo nano /etc/bind/zones/db.cafe.example: 203.0.113.10 instead of 198.51.100.80, serial 2027032001, and the line www IN CNAME cafe.example. (with the dot); then named-checkzone cafe.example /etc/bind/zones/db.cafe.example and sudo rndc reload

## Chapter 6 — Concert night

indice-concert-robot =
    .piste = Who asks for what? nginx's access log has one line per request; awk splits it into fields (the address is the first one, see help_logs.txt), sort and uniq -c count them.
    .solution = awk '{"{"}print $1{"}"}' /var/log/nginx/access.log | sort | uniq -c | sort -n (three addresses in 198.51.100.x dominate).
indice-concert-fin =
    .piste = Blocking addresses will not last: limit the rate per address (limit_req_zone in the http context, limit_req in the calendar's location). A browser asks for a page and its four files at once: without a burst, real visitors are refused too.
    .solution = At the top of /etc/nginx/sites-available/letters: limit_req_zone $binary_remote_addr zone=agenda:10m rate=2r/s; and in location /agenda/: limit_req zone=agenda burst=10 nodelay; then sudo nginx -t and sudo systemctl reload nginx

## Chapter 7 — The port

indice-port-deux-ports =
    .piste = Open the new door without closing the old one: sshd can listen on several ports (several Port lines, man sshd_config), and the firewall must let the new one through.
    .solution = In /etc/ssh/sshd_config: Port 22 and Port 2222; then sudo sshd -t, sudo ufw allow 2222/tcp and sudo systemctl reload ssh
indice-port-essai =
    .piste = Test the new door from your workstation. For ssh letters to go there on its own, the workstation's ~/.ssh/config has a Port option (man ssh_config).
    .solution = exit, then on the workstation: nano ~/.ssh/config, add Port 2222 under Host letters, and ssh letters (accept the server's key on that port: yes).
indice-port-fin =
    .piste = The new door works: close the old one, in sshd and in ufw. Then fail2ban: its sshd jail still watches the "ssh" port (22). A port set in [DEFAULT] is not enough, it takes the jail's own section.
    .solution = Remove Port 22 from sshd_config, sudo systemctl reload ssh, sudo ufw delete allow OpenSSH; in /etc/fail2ban/jail.local, [sshd] port = 2222, then sudo systemctl reload fail2ban

## Chapter 8 — Repeat offenders

indice-recidive-recidive =
    .piste = jail.conf describes a recidive jail, disabled: it reads fail2ban.log and bans for a long time the addresses already banned several times. Enable it in its own section of jail.local, not in [DEFAULT].
    .solution = Add to /etc/fail2ban/jail.local: [recidive] then enabled = true; sudo fail2ban-client -t and sudo systemctl reload fail2ban
indice-recidive-agenda =
    .piste = The calendar's bot fills /var/log/nginx/error.log with "limiting requests". One jail in jail.conf reads exactly those lines: look for the nginx jails (grep "^\[" /etc/fail2ban/jail.conf).
    .solution = Add to /etc/fail2ban/jail.local: [nginx-limit-req] then enabled = true; sudo systemctl reload fail2ban
indice-recidive-fin =
    .piste = The jails are loaded: check whom they ban (the repeat offenders and the bot, but neither Rania nor the visitors).
    .solution = sudo fail2ban-client status, then sudo fail2ban-client status recidive and sudo fail2ban-client status nginx-limit-req

## Chapter 9 — The Repair Café

indice-atelier-occupe =
    .piste = apt said "Job for apache2.service failed". systemctl status apache2 and journalctl -u apache2 say why; sudo ss -tlnp shows who listens on which port.
    .solution = journalctl -u apache2: "Address already in use" on port 80; sudo ss -tlnp: nginx holds it.
indice-atelier-ecoute =
    .piste = Apache's ports are in /etc/apache2/ports.conf (Listen). Rania expects it on 127.0.0.1:8080, like the calendar. Then start the service.
    .solution = sudo nano /etc/apache2/ports.conf: Listen 127.0.0.1:8080 instead of Listen 80; sudo apache2ctl configtest; sudo systemctl restart apache2
indice-atelier-site =
    .piste = sudo apache2ctl -S lists the sites Apache has read: is the café's there? Apache only reads files ending in .conf from sites-enabled (man a2ensite). And the site's VirtualHost must be on the port Apache listens on.
    .solution = sudo a2ensite repair; in /etc/apache2/sites-available/repair.conf, <VirtualHost 127.0.0.1:8080> (or *:8080); sudo apache2ctl configtest; sudo systemctl reload apache2; curl -H "Host: repair.example" http://127.0.0.1:8080/
indice-atelier-proxy =
    .piste = The café's nginx site is ready in /etc/nginx/sites-available/repair, but not enabled (like the café's, in "Sharing a home").
    .solution = sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/; sudo nginx -t; sudo systemctl reload nginx; curl http://repair.example/
indice-atelier-reecriture =
    .piste = /guide/42 isn't a file: a rule in /var/www/repair's .htaccess transforms the address. Apache only reads .htaccess files if AllowOverride allows it (man apache2ctl), and RewriteRule comes from a module (man a2enmod). The site's error log says what's wrong.
    .solution = In repair.conf's VirtualHost: <Directory /var/www/repair>, AllowOverride All, </Directory> (three lines); sudo a2enmod rewrite; sudo apache2ctl configtest; sudo systemctl restart apache2; curl http://repair.example/guide/42
indice-atelier-fin =
    .piste = Check everything: Apache enabled at boot and only on 127.0.0.1, http://repair.example/ and /guide/42 through nginx, letters.example intact.
    .solution = systemctl is-enabled apache2; sudo ss -tlnp; curl http://repair.example/guide/42; curl http://letters.example/
