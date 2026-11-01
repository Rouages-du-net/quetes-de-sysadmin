### Indices gradués de La Veille (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction,
### sans la commande exacte) et .solution (presque la réponse : la commande,
### avec ce qu'elle fait). Les noms des lieux sont ceux de names.ftl.

## Chapitre 1 — Le bulletin

hint-bulletin-read =
    .lead = Le bulletin de la semaine est dans ton dossier. Pour chaque CVE, vérifie si le paquet est seulement installé ici, et à quelle version (man apt, l'option list).
    .solution = cat bulletin-securite.txt, puis apt list --installed pour voir ce qui est posé sur ce serveur, et avec quelle version.
hint-bulletin-sort =
    .lead = Écris ton tri dans veille.md : certbot n'est sur ce serveur ? curl est-il déjà au-delà de la version corrigée du bulletin ?
    .solution = sudo nano veille.md : sous « Sans objet », certbot (absent) et curl (déjà à jour) ; sous « Concerne ce serveur », nginx, rsync et openssh-server.
hint-bulletin-end =
    .lead = Vérifie que ton tri ne mélange rien : seuls nginx, rsync et openssh-server doivent être sous « Concerne ce serveur ».
    .solution = Relis veille.md en entier : rien de certbot ni de curl sous « Concerne ce serveur », rien de nginx ni de rsync sous « Sans objet ».

## Chapitre 2 — La priorité

hint-priority-expose =
    .lead = Avant de classer, regarde ce qui écoute vraiment sur ce serveur, et ce qui n'a aucun port du tout (man ss, man nmap).
    .solution = ss -tlnp (ou nmap -sV petrin.internal) : 80 et 443 répondent à toutes les adresses, rien n'écoute pour rsync.
hint-priority-order =
    .lead = Le score de rsync est plus haut, mais un score mesure la gravité SI on atteint le service, pas la facilité à l'atteindre. Écris ta décision dans priorite.md, nginx d'abord, avec pourquoi.
    .solution = sudo nano priorite.md : nginx en premier (exposé sur internet, 80/443), rsync ensuite (score plus haut, mais aucun port en écoute) ; et un mot sur openssh-server (déjà protégé, KbdInteractiveAuthentication à no).
hint-priority-end =
    .lead = Vérifie que ton texte dit POURQUOI, pas seulement l'ordre : qu'est-ce qui rend nginx joignable, qu'est-ce qui ne rend pas rsync joignable ?
    .solution = Relis priorite.md : la raison de l'ordre doit citer l'exposition (internet, port), pas seulement le score.

## Chapitre 3 — Le correctif

hint-fix-fixed =
    .lead = apt upgrade installe les correctifs disponibles, mais seulement ceux que apt connaît : rafraîchis la liste des paquets avant (man apt).
    .solution = sudo apt update, puis sudo apt upgrade (les deux correctifs, nginx et rsync, s'installent ensemble).
hint-fix-checked =
    .lead = Avant de continuer : le site répond-il toujours ? (man curl)
    .solution = curl -I http://fournil.example/ (code 200 attendu).
hint-fix-end =
    .lead = Les deux paquets doivent être à la version corrigée du bulletin, et le site doit toujours répondre.
    .solution = apt list --installed | grep -E 'nginx|rsync' pour vérifier les versions, puis curl -I http://fournil.example/.

## Chapitre 4 — Sans preuve, pas de certitude

hint-proof-versions =
    .lead = Un correctif se reprouve : demande à apt ce qu'il reste à mettre à jour (man apt).
    .solution = apt list --upgradable (rien ne doit plus apparaître pour nginx ni rsync).
hint-proof-found =
    .lead = Le journal d'accès de nginx garde une trace de chaque requête. La faille de nginx était en HTTP/2 : cherche une requête de ce genre (man grep).
    .solution = grep "HTTP/2" /var/log/nginx/access.log (une ligne en 400, sans navigateur déclaré, quelques jours avant le correctif).
hint-proof-end =
    .lead = Il te faut deux choses : la preuve que les paquets sont à jour, et avoir regardé le journal d'accès pour une tentative antérieure.
    .solution = apt list --upgradable (vide), puis grep "HTTP/2" /var/log/nginx/access.log.

## Chapitre 5 — Mettre en veille

hint-routine-active =
    .lead = unattended-upgrades est installé mais éteint : regarde /etc/apt/apt.conf.d/20auto-upgrades (man apt.conf).
    .solution = sudo nano /etc/apt/apt.conf.d/20auto-upgrades : mets les deux lignes à "1".
hint-routine-security =
    .lead = Dans /etc/apt/apt.conf.d/50unattended-upgrades, une ligne Origins-Pattern autorise TOUTES les mises à jour, pas seulement la sécurité ; et Unattended-Upgrade::Mail est commentée.
    .solution = sudo nano /etc/apt/apt.conf.d/50unattended-upgrades : commente la ligne « label=Debian » (sans -Security), garde les deux lignes « label=Debian-Security », et décommente Unattended-Upgrade::Mail avec une adresse (ex. "root").
hint-routine-periodic =
    .lead = Il te faut un rendez-vous hebdomadaire qui survit à un redémarrage : un timer systemd dans /etc/systemd/system, ou une tâche cron, qui regarde les mises à jour en attente et t'envoie le résultat par courrier (man systemd.timer, man crontab).
    .solution = Un timer : sudo nano /etc/systemd/system/veille.service (ExecStart=/bin/sh -c "apt list --upgradable | mail -s Veille root") et /etc/systemd/system/veille.timer (OnCalendar=weekly), puis sudo systemctl daemon-reload && sudo systemctl enable --now veille.timer. Ou une tâche cron : sudo crontab -e, une ligne hebdomadaire qui fait la même chose.
hint-routine-end =
    .lead = Trois choses à vérifier : les deux tâches de 20auto-upgrades activées, 50unattended-upgrades limité à la sécurité avec un rapport, et un rendez-vous périodique actif.
    .solution = sudo apt-config dump | grep Periodic, cat /etc/apt/apt.conf.d/50unattended-upgrades, systemctl list-timers (ou crontab -l).
