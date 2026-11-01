### Indices gradués de La Gazette (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Tout se tape sur le serveur gazette.

## Chapitre 1 — Le dépôt nu

indice-depot-nu-en-ligne =
    .piste = Il faut un dépôt nu à toi dans /srv/git (man git, git init --bare), un crochet hooks/post-receive exécutable qui extrait chaque push dans /var/www/gazette, et la correction de Théo d'abord reportée dans ~/gazette (diff -r compare les deux dossiers).
    .solution = sudo git init --bare /srv/git/gazette.git puis sudo chown -R vous: /srv/git/gazette.git ; dans hooks/post-receive : #!/bin/sh puis git --work-tree=/var/www/gazette checkout -f main, et chmod +x ; dans ~/gazette : « Gazzette » devient « Gazette » dans index.html, git commit -am "Titre", git remote add prod /srv/git/gazette.git, git push prod main.
indice-depot-nu-fin =
    .piste = La date du vide-grenier se corrige dans ~/gazette/agenda.html (deux fois : le texte et datetime), jamais sur le serveur : ce qui n'est pas dans git disparaît au prochain push.
    .solution = Dans ~/gazette : nano agenda.html (2027-06-21 devient 2027-06-12, et 21 devient 12), git commit -am "Agenda", puis git push prod.

## Chapitre 2 — Le retour arrière

indice-retour-arriere-retabli =
    .piste = nginx sert le lien /srv/gazette/current, qui vise la version cassée. La version d'avant est intacte dans releases/ : il suffit que le lien la désigne de nouveau. Attention, current vise un dossier (man ln, option -n).
    .solution = ln -sfn /srv/gazette/releases/20270514101502 /srv/gazette/current (puis curl -I http://gazette.example/ répond 200).
indice-retour-arriere-garde-fou =
    .piste = Le crochet (/srv/git/gazette.git/hooks/post-receive) doit lancer tests.sh dans le dossier de la nouvelle version, AVANT de basculer current ; avec set -e, un échec arrête le script. Théo repoussera dès que le crochet changera.
    .solution = Dans le crochet, juste avant la ligne ln -sfn, ajoute : cd /srv/gazette/releases/$VERSION puis sh tests.sh
indice-retour-arriere-fin =
    .piste = La mise en page de Théo est sur le serveur, mais il lui manque index.html : récupère ses commits dans ~/gazette, donne à sa page le bon nom, puis publie par git.
    .solution = cd ~/gazette, git pull prod main, mv accueil.html index.html, git add ., git commit -m "Accueil : index.html", git push prod main.

## Chapitre 3 — Bleu et vert

indice-bleu-vert-fin =
    .piste = Prépare green (le lien /srv/kiosk/green, le service kiosk-green), vérifie son /health sur le port 3002 et lis ses notes de version s'il va mal ; seulement ensuite, fais pointer proxy_pass de nginx vers green. Blue reste allumé.
    .solution = ln -sfn /srv/kiosk/versions/1.5.0 /srv/kiosk/green, sudo systemctl start kiosk-green ; ajoute KIOSK_SMTP=smtp.gazette.example à /etc/kiosk/kiosk.env, sudo systemctl restart kiosk-green, curl localhost:3002/health ; puis 3001 devient 3002 dans /etc/nginx/sites-available/gazette, sudo nginx -t, sudo systemctl reload nginx.

## Chapitre 4 — Le canari

indice-canari-canari-160 =
    .piste = La 1.6.0 va sur blue (le lien, puis le service). Pour lui envoyer une visite sur dix seulement, nginx répartit entre les serveurs d'un bloc upstream, selon leur weight (man nginx).
    .solution = ln -sfn /srv/kiosk/versions/1.6.0 /srv/kiosk/blue, sudo systemctl restart kiosk-blue ; dans /etc/nginx/sites-available/gazette : upstream kiosk {"{"} server 127.0.0.1:3002 weight=9; server 127.0.0.1:3001 weight=1; {"}"} et proxy_pass http://kiosk/; puis sudo nginx -t et sudo systemctl reload nginx.
indice-canari-arrete =
    .piste = Regarde les codes de réponse dans /var/log/nginx/access.log : quelle page répond 500 ? Si c'est le canari, coupe-lui le trafic (un serveur d'upstream peut être marqué down).
    .solution = grep " 500 " /var/log/nginx/access.log (des 500 sur /kiosk/archives), puis server 127.0.0.1:3001 weight=1 down; dans l'upstream, sudo nginx -t, sudo systemctl reload nginx.
indice-canari-canari-161 =
    .piste = La 1.6.1 est arrivée dans /srv/kiosk/versions/ : on recommence, sur blue, avec le même petit canari, et on regarde le lot de visites suivant.
    .solution = ln -sfn /srv/kiosk/versions/1.6.1 /srv/kiosk/blue, sudo systemctl restart kiosk-blue, retire down de la ligne 3001, sudo nginx -t, sudo systemctl reload nginx.
indice-canari-fin =
    .piste = Le canari est propre : tout le trafic peut aller à blue. Green reste allumé, au cas où.
    .solution = Dans l'upstream : server 127.0.0.1:3002 weight=9 down; (ou proxy_pass http://127.0.0.1:3001/;), puis sudo nginx -t et sudo systemctl reload nginx.

## Chapitre 5 — La migration

indice-migration-repare =
    .piste = Interroge le /health de chaque instance, puis lis le journal du service green et les notes de la 2.0.0 (/srv/kiosk/versions/2.0.0/) : la base a été migrée, alors on répare en avant. Une variable de configuration a changé de nom.
    .solution = Ajoute KIOSK_SMTP_URL=smtp://smtp.gazette.example:587 à /etc/kiosk/kiosk.env (sudo nano), puis sudo systemctl restart kiosk-green.
indice-migration-fin =
    .piste = Blue tourne une version qui ne sait plus lire la base migrée : pour qu'il redevienne un filet de sécurité, il lui faut la même version que green.
    .solution = ln -sfn /srv/kiosk/versions/2.0.0 /srv/kiosk/blue puis sudo systemctl restart kiosk-blue (curl localhost:3001/health répond ok).
