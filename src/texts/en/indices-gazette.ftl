### Graded hints for The Gazette (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Everything is typed on the
### gazette server.

## Chapter 1 — The bare repository

indice-bare-repo-en-ligne =
    .piste = You need a bare repository of your own in /srv/git (man git, git init --bare), an executable hooks/post-receive hook that extracts each push into /var/www/gazette, and Théo's fix carried over into ~/gazette first (diff -r compares the two directories).
    .solution = sudo git init --bare /srv/git/gazette.git then sudo chown -R you: /srv/git/gazette.git; in hooks/post-receive: #!/bin/sh then git --work-tree=/var/www/gazette checkout -f main, and chmod +x; in ~/gazette: "Gazzette" becomes "Gazette" in index.html, git commit -am "Title", git remote add prod /srv/git/gazette.git, git push prod main.
indice-bare-repo-fin =
    .piste = The yard sale date is fixed in ~/gazette/agenda.html (twice: the text and datetime), never on the server: what isn't in git disappears on the next push.
    .solution = In ~/gazette: nano agenda.html (2027-06-21 becomes 2027-06-12, and 21 becomes 12), git commit -am "Agenda", then git push prod.

## Chapter 2 — Rolling back

indice-rollback-retabli =
    .piste = nginx serves the link /srv/gazette/current, which points to the broken version. The previous version is intact in releases/: the link just has to point to it again. Careful, current points to a directory (man ln, option -n).
    .solution = ln -sfn /srv/gazette/releases/20270514101502 /srv/gazette/current (then curl -I http://gazette.example/ answers 200).
indice-rollback-garde-fou =
    .piste = The hook (/srv/git/gazette.git/hooks/post-receive) must run tests.sh in the new version's directory, BEFORE switching current; with set -e, a failure stops the script. Théo will push again as soon as the hook changes.
    .solution = In the hook, just before the ln -sfn line, add: cd /srv/gazette/releases/$VERSION then sh tests.sh
indice-rollback-fin =
    .piste = Théo's layout is on the server, but it lacks index.html: fetch his commits into ~/gazette, give his page the right name, then publish through git.
    .solution = cd ~/gazette, git pull prod main, mv accueil.html index.html, git add ., git commit -m "Home: index.html", git push prod main.

## Chapter 3 — Blue and green

indice-blue-green-fin =
    .piste = Prepare green (the /srv/kiosk/green link, the kiosk-green service), check its /health on port 3002 and read its release notes if it is unwell; only then point nginx's proxy_pass to green. Blue stays running.
    .solution = ln -sfn /srv/kiosk/versions/1.5.0 /srv/kiosk/green, sudo systemctl start kiosk-green; add KIOSK_SMTP=smtp.gazette.example to /etc/kiosk/kiosk.env, sudo systemctl restart kiosk-green, curl localhost:3002/health; then 3001 becomes 3002 in /etc/nginx/sites-available/gazette, sudo nginx -t, sudo systemctl reload nginx.

## Chapter 4 — The canary

indice-canary-canari-160 =
    .piste = 1.6.0 goes on blue (the link, then the service). To send it only one visit in ten, nginx shares the traffic between the servers of an upstream block, according to their weight (man nginx).
    .solution = ln -sfn /srv/kiosk/versions/1.6.0 /srv/kiosk/blue, sudo systemctl restart kiosk-blue; in /etc/nginx/sites-available/gazette: upstream kiosk {"{"} server 127.0.0.1:3002 weight=9; server 127.0.0.1:3001 weight=1; {"}"} and proxy_pass http://kiosk/; then sudo nginx -t and sudo systemctl reload nginx.
indice-canary-arrete =
    .piste = Look at the response codes in /var/log/nginx/access.log: which page answers 500? If it's the canary, cut its traffic (an upstream server can be marked down).
    .solution = grep " 500 " /var/log/nginx/access.log (500s on /kiosk/archives), then server 127.0.0.1:3001 weight=1 down; in the upstream, sudo nginx -t, sudo systemctl reload nginx.
indice-canary-canari-161 =
    .piste = 1.6.1 has arrived in /srv/kiosk/versions/: start again, on blue, with the same small canary, and look at the next batch of visits.
    .solution = ln -sfn /srv/kiosk/versions/1.6.1 /srv/kiosk/blue, sudo systemctl restart kiosk-blue, remove down from the 3001 line, sudo nginx -t, sudo systemctl reload nginx.
indice-canary-fin =
    .piste = The canary is clean: all the traffic can go to blue. Green stays running, just in case.
    .solution = In the upstream: server 127.0.0.1:3002 weight=9 down; (or proxy_pass http://127.0.0.1:3001/;), then sudo nginx -t and sudo systemctl reload nginx.

## Chapter 5 — The migration

indice-migration-repare =
    .piste = Query each instance's /health, then read the green service's journal and the 2.0.0 notes (/srv/kiosk/versions/2.0.0/): the database was migrated, so you fix forward. A configuration variable has been renamed.
    .solution = Add KIOSK_SMTP_URL=smtp://smtp.gazette.example:587 to /etc/kiosk/kiosk.env (sudo nano), then sudo systemctl restart kiosk-green.
indice-migration-fin =
    .piste = Blue runs a version that can no longer read the migrated database: to be a safety net again, it needs the same version as green.
    .solution = ln -sfn /srv/kiosk/versions/2.0.0 /srv/kiosk/blue then sudo systemctl restart kiosk-blue (curl localhost:3001/health answers ok).
