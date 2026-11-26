### Abgestufte Hinweise für „Die Zeitung“ (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine Spur,
### ohne den genauen Befehl) und .solution (fast die Antwort). Alles wird
### auf dem Server zeitung getippt.

## Kapitel 1 — Das nackte Repository

hint-bare-repo-in-line =
    .lead = Du brauchst ein eigenes Bare-Repository in /srv/git (man git, git init --bare), einen ausführbaren Hook hooks/post-receive, der jeden push nach /var/www/gazette entpackt, und zuerst Théos Korrektur, übertragen nach ~/gazette (diff -r vergleicht die beiden Verzeichnisse).
    .solution = sudo git init --bare /srv/git/gazette.git, dann sudo chown -R du: /srv/git/gazette.git; in hooks/post-receive: #!/bin/sh, dann git --work-tree=/var/www/gazette checkout -f main, und chmod +x; in ~/gazette: „Zeitunng“ wird in index.html zu „Zeitung“, git commit -am "Titel", git remote add prod /srv/git/gazette.git, git push prod main.
hint-bare-repo-end =
    .lead = Das Datum des Flohmarkts wird in ~/gazette/agenda.html korrigiert (zweimal: der Text und datetime), nie auf dem Server: Was nicht in git ist, verschwindet beim nächsten push.
    .solution = In ~/gazette: nano agenda.html (2027-06-21 wird zu 2027-06-12, und 21 wird zu 12), git commit -am "Kalender", dann git push prod.

## Kapitel 2 — Zurückrollen

hint-rollback-restored =
    .lead = nginx liefert den Link /srv/gazette/current aus, der auf die kaputte Version zeigt. Die vorige Version liegt unversehrt in releases/: Der Link muss nur wieder auf sie zeigen. Vorsicht, current zeigt auf ein Verzeichnis (man ln, Option -n).
    .solution = ln -sfn /srv/gazette/releases/20270514101502 /srv/gazette/current (danach antwortet curl -I http://gazette.example/ mit 200).
hint-rollback-safeguard =
    .lead = Der Hook (/srv/git/gazette.git/hooks/post-receive) muss tests.sh im Verzeichnis der neuen Version ausführen, BEVOR er current umstellt; mit set -e hält ein Fehlschlag das Skript an. Théo pusht wieder, sobald sich der Hook ändert.
    .solution = Im Hook direkt vor der Zeile ln -sfn ergänzen: cd /srv/gazette/releases/$VERSION, dann sh tests.sh
hint-rollback-end =
    .lead = Théos Layout ist auf dem Server, aber ihm fehlt index.html: Hol seine Commits nach ~/gazette, gib seiner Seite den richtigen Namen und veröffentliche dann über git.
    .solution = cd ~/gazette, git pull prod main, mv start.html index.html, git add ., git commit -m "Startseite: index.html", git push prod main.

## Kapitel 3 — Blau und Grün

hint-blue-green-end =
    .lead = Bereite grün vor (den Link /srv/kiosk/green, den Dienst kiosk-green), prüfe sein /health auf Port 3002 und lies seine Versionshinweise, wenn es ihm schlecht geht; erst dann lass das proxy_pass von nginx auf grün zeigen. Blau läuft weiter.
    .solution = ln -sfn /srv/kiosk/versions/1.5.0 /srv/kiosk/green, sudo systemctl start kiosk-green; KIOSK_SMTP=smtp.gazette.example in /etc/kiosk/kiosk.env ergänzen, sudo systemctl restart kiosk-green, curl localhost:3002/health; dann wird 3001 in /etc/nginx/sites-available/gazette zu 3002, sudo nginx -t, sudo systemctl reload nginx.

## Kapitel 4 — Der Kanarienvogel

hint-canary-canary-160 =
    .lead = 1.6.0 kommt auf blau (der Link, dann der Dienst). Um ihm nur einen Besuch von zehn zu schicken, verteilt nginx den Verkehr auf die Server eines upstream-Blocks, nach ihrem Gewicht (man nginx).
    .solution = ln -sfn /srv/kiosk/versions/1.6.0 /srv/kiosk/blue, sudo systemctl restart kiosk-blue; in /etc/nginx/sites-available/gazette: upstream kiosk {"{"} server 127.0.0.1:3002 weight=9; server 127.0.0.1:3001 weight=1; {"}"} und proxy_pass http://kiosk/; dann sudo nginx -t und sudo systemctl reload nginx.
hint-canary-stopped =
    .lead = Schau dir die Antwortcodes in /var/log/nginx/access.log an: Welche Seite antwortet mit 500? Ist es der Kanarienvogel, kapp seinen Verkehr (ein Server im upstream kann als down markiert werden).
    .solution = grep " 500 " /var/log/nginx/access.log (500er auf /kiosk/archives), dann server 127.0.0.1:3001 weight=1 down; im upstream, sudo nginx -t, sudo systemctl reload nginx.
hint-canary-canary-161 =
    .lead = 1.6.1 ist in /srv/kiosk/versions/ angekommen: Fang neu an, auf blau, mit demselben kleinen Kanarienvogel, und schau dir den nächsten Schwung Besuche an.
    .solution = ln -sfn /srv/kiosk/versions/1.6.1 /srv/kiosk/blue, sudo systemctl restart kiosk-blue, down aus der Zeile 3001 entfernen, sudo nginx -t, sudo systemctl reload nginx.
hint-canary-end =
    .lead = Der Kanarienvogel ist sauber: Der ganze Verkehr kann an blau gehen. Grün läuft für alle Fälle weiter.
    .solution = Im upstream: server 127.0.0.1:3002 weight=9 down; (oder proxy_pass http://127.0.0.1:3001/;), dann sudo nginx -t und sudo systemctl reload nginx.

## Kapitel 5 — Die Migration

hint-migration-repaired =
    .lead = Frag das /health jeder Instanz ab, lies dann das Journal des Dienstes grün und die Hinweise zu 2.0.0 (/srv/kiosk/versions/2.0.0/): Die Datenbank wurde migriert, also repariert man nach vorn. Eine Konfigurationsvariable wurde umbenannt.
    .solution = KIOSK_SMTP_URL=smtp://smtp.gazette.example:587 in /etc/kiosk/kiosk.env ergänzen (sudo nano), dann sudo systemctl restart kiosk-green.
hint-migration-end =
    .lead = Auf blau läuft eine Version, die die migrierte Datenbank nicht mehr lesen kann: Um wieder ein Sicherheitsnetz zu sein, braucht es dieselbe Version wie grün.
    .solution = ln -sfn /srv/kiosk/versions/2.0.0 /srv/kiosk/blue, dann sudo systemctl restart kiosk-blue (curl localhost:3001/health antwortet mit ok).
