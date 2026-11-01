### Indices gradués de L'Astreinte (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Les noms des lieux sont ceux de names.ftl.

## Chapitre 1 — Le disque plein

hint-full-disk-full =
    .lead = Zoé parle d'un disque plein. Avant de chercher quoi que ce soit, regarde l'occupation des systèmes de fichiers (man df, l'option qui affiche des tailles lisibles).
    .solution = df -h (le / est à 100 %)
hint-full-disk-culprit =
    .lead = Qu'est-ce qui prend la place ? du mesure, dossier par dossier : commence par les journaux, dans /var/log, puis descends là où ça pèse.
    .solution = sudo du -sh /var/log/* (mot de passe dans le message de Zoé), puis sudo du -sh /var/log/radio/* : stream.log pèse plus de 15 Go.
hint-full-disk-debug =
    .lead = Avant d'effacer ce journal géant, regarde ce qu'il contient : ses dernières lignes disent pourquoi il grossit si vite.
    .solution = sudo tail /var/log/radio/stream.log (des lignes DEBUG à chaque paquet)
hint-full-disk-breathes =
    .lead = Il faut rendre la place, mais rm ne suffit pas : le relais tient le fichier ouvert. Vide-le sans l'effacer (man truncate), ou fais redémarrer le programme qui le tient.
    .solution = sudo truncate -s 0 /var/log/radio/stream.log (puis df -h pour vérifier ; si tu l'as déjà effacé : sudo systemctl restart radio-stream)
hint-full-disk-end =
    .lead = Pour que ça ne recommence pas : remettre le niveau de journal normal dans /etc/radio/stream.conf (le relais ne le relit qu'au démarrage), et confier le journal à logrotate, dans /etc/logrotate.d, avec une façon de le faire rouvrir (man logrotate).
    .solution = sudo nano /etc/radio/stream.conf (loglevel = info), sudo systemctl restart radio-stream, puis sudo nano /etc/logrotate.d/radio : /var/log/radio/*.log {"{"} daily, rotate 7, compress, missingok, copytruncate {"}"} (une directive par ligne ; sudo logrotate -d /etc/logrotate.d/radio pour vérifier).

## Chapitre 2 — La mémoire

hint-memory-oom =
    .lead = La playlist s'est arrêtée toute seule. Que dit systemctl status à son sujet ? Et le journal du noyau, qui garde trace des processus qu'il a dû tuer ?
    .solution = systemctl status radio-playlist (Result: oom-kill), puis sudo dmesg -T (Out of memory: Killed process…)
hint-memory-zombies =
    .lead = Regarde la liste de tous les processus et leur état : certains sont marqués <defunct>. La colonne PPID dit qui est leur parent.
    .solution = ps -ef (ou ps aux) : des zombies [convertir] <defunct>, enfants du PID 2305 (le service radio-podcast)
hint-memory-contained =
    .lead = La playlist fuit : relancée telle quelle, elle regrossit. systemd peut limiter la mémoire d'un service et le relancer s'il meurt, par une surcharge (man systemctl : edit ; man systemd.resource-control : MemoryMax=). Puis observe-la grossir avec top.
    .solution = sudo systemctl edit radio-playlist, écrire [Service] puis MemoryMax=600M et Restart=on-failure ; sudo systemctl start radio-playlist, puis top (ou free -h) plusieurs fois : systemd la tue et la relance.
hint-memory-without-zombies =
    .lead = Un zombie ne se tue pas : il est déjà mort. Seul son parent peut le faire disparaître, ou disparaître lui-même (init récupère alors les zombies).
    .solution = sudo systemctl restart radio-podcast (le service du parent, PID 2305)
hint-memory-end =
    .lead = Pour finir, il faut tout à la fois : la playlist qui tourne, une limite de mémoire raisonnable (quelques centaines de Mo), une relance automatique, plus aucun zombie, et le relais actif. Si tu as écrit un fichier d'unité à la main, systemd doit le relire.
    .solution = systemctl status radio-playlist (Memory … max), ps aux sans <defunct> ; après un fichier écrit à la main : sudo systemctl daemon-reload, puis sudo systemctl start radio-playlist

## Chapitre 3 — Les inodes

hint-inodes-almost-empty =
    .lead = « No space left on device » à nouveau : commence par regarder la place libre sur le volume des données, /srv/radio.
    .solution = df -h (/srv/radio n'est presque pas rempli)
hint-inodes-more-inodes =
    .lead = La place n'est pas la seule ressource d'un système de fichiers : chaque fichier a besoin d'un inode, et leur nombre est fixé. Une option de df les compte (man df).
    .solution = df -i (ou df -ih) : 100 % des inodes de /srv/radio sont pris
hint-inodes-culprit =
    .lead = Qui a créé autant de fichiers ? du sait compter les inodes au lieu des octets (man du), dossier par dossier.
    .solution = sudo du --inodes -d 1 /srv/radio (le dossier stats compte plus de 65 000 fichiers)
hint-inodes-restarts =
    .lead = Zoé veut garder les 30 derniers jours. rm * échouera (trop d'arguments) ; find parcourt le dossier lui-même, choisit les fichiers selon leur âge et sait les effacer (man find : -mtime, -delete).
    .solution = sudo find /srv/radio/stats -type f -mtime +30 -delete (essaie d'abord sans -delete, avec | wc -l)
hint-inodes-end =
    .lead = Pour que ça ne recommence pas, le ménage doit se faire chaque nuit : une tâche cron, dans la crontab d'un compte qui a le droit d'effacer ces fichiers (root, ou radio).
    .solution = sudo crontab -e, et ajouter : 15 4 * * * find /srv/radio/stats -type f -mtime +30 -delete

## Chapitre 4 — L'horloge

hint-clock-utc =
    .lead = La tâche cron n'a pas changé, mais elle part deux heures trop tard. À quelle heure, et dans quel fuseau, la machine croit-elle vivre ?
    .solution = date, ou timedatectl (Time zone: Etc/UTC)
hint-clock-late =
    .lead = timedatectl dit aussi si l'horloge est synchronisée, et si le service NTP tourne. Compare avec l'heure de ton poste.
    .solution = timedatectl (System clock synchronized: no, NTP service: inactive)
hint-clock-synchro =
    .lead = La synchronisation est le travail de systemd-timesyncd : il faut l'activer, et lui donner un serveur NTP qui répond. Le mail de l'hébergeur dit lequel ; la configuration est dans /etc/systemd/timesyncd.conf (relue au démarrage).
    .solution = sudo nano /etc/systemd/timesyncd.conf (NTP=ntp.hosting.example), puis sudo timedatectl set-ntp true (ou sudo systemctl restart systemd-timesyncd s'il tourne déjà)
hint-clock-cron =
    .lead = La machine doit vivre à l'heure de Paris. Le fuseau se règle avec timedatectl (man timedatectl : set-timezone, list-timezones).
    .solution = sudo timedatectl set-timezone Europe/Paris
hint-clock-end =
    .lead = cron a lu le fuseau à son démarrage, samedi : il compte toujours en UTC. Et timesyncd doit être activé, pour repartir au prochain démarrage de la machine.
    .solution = sudo systemctl restart cron (et, si ce n'est pas fait, sudo timedatectl set-ntp true)

## Chapitre 5 — La sonde

hint-probe-end =
    .lead = La sonde de Zoé (/usr/local/bin/probe) a trois « À FAIRE » : surveiller /srv/radio, place ET inodes (man check_disk : -W, -K), vérifier que le direct répond (man check_http, port 8000, /direct), et la lancer toutes les 5 minutes (un timer systemd ou cron). Des seuils trop serrés donnent des alertes pour rien.
    .solution = Dans sudo nano /usr/local/bin/probe, ajouter : $P/check_disk -w 20% -c 10% -W 20% -K 10% -p /srv/radio | grep -v " OK" | $ALERTE et $P/check_http -H localhost -p 8000 -u /direct | grep -v " OK" | $ALERTE ; puis sudo crontab -e : */5 * * * * /usr/local/bin/probe (ou probe.service + probe.timer avec OnCalendar=*:0/5, et sudo systemctl enable --now probe.timer).

## Chapitre 6 — Le post-mortem

hint-post-mortem-notes =
    .lead = Commence par ce que Théo a noté cette nuit-là, dans ta maison. Ce sont des pistes à vérifier, pas des faits.
    .solution = cat notes_theo.txt
hint-post-mortem-reboot =
    .lead = Les journaux sont précis à la seconde. Lis ceux de la nuit du 11 au 12 septembre, entre 2 h et 3 h 30 (man journalctl : --since, --until) : qu'est-ce qui a démarré juste avant que le relais ne s'arrête ?
    .solution = sudo journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30" (apt-daily-upgrade, puis Stopping radio-stream.service) ; puis sudo cat /var/log/unattended-upgrades/unattended-upgrades-dpkg.log et last
hint-post-mortem-origin =
    .lead = L'option inconnue attendait dans stream.conf. Depuis quand ? Le journal garde aussi la trace des commandes lancées avec sudo : cherche qui a ouvert ce fichier, et quand.
    .solution = sudo journalctl | grep stream.conf (le 20 août, sudo nano /etc/radio/stream.conf, jamais relancé)
hint-post-mortem-end =
    .lead = Complète postmortem.md (nano), en gardant les titres « ## » du modèle et sans laisser de « (à compléter » : Résumé ; Chronologie avec les heures des journaux (coupure, première alerte, retour du direct) ; Impact en minutes ; Causes (le déclencheur et depuis quand l'erreur attendait) ; Ce qui a bien marché ; Actions (au moins deux lignes « - »). Sans reproche : pas de « faute » ni de « coupable ».
    .solution = Chronologie : 02:13 (la mise à jour relance le relais), 02:15 (première alerte), 02:58 (le relais repart) ; Impact : 45 minutes ; Causes : unattended-upgrades (needrestart) a relancé le relais, une option inconnue (bitrate_max) attendait dans stream.conf depuis le 20 août ; Ce qui a bien marché : la sonde a alerté en 2 minutes ; Actions : - vérifier la configuration avant chaque redémarrage (ExecStartPre=) - relancer le relais après chaque modification.

## Chapitre 7 — Le goulot

hint-bottleneck-iowait =
    .lead = Zoé dit que le processeur ne fait presque rien. Regarde la ligne %Cpu(s) de top : chaque colonne a son sens (man top), l'une d'elles compte le temps passé à attendre le disque.
    .solution = top (« wa » est énorme : c'est l'iowait) ; puis iostat -x et sudo pidstat -d pour voir le disque saturé et qui l'occupe
hint-bottleneck-end =
    .lead = L'archivage (radio-archives) sature le disque, mais il ne faut pas l'arrêter. ionice ne sert à rien avec l'ordonnanceur « none » ; une limite de débit posée par systemd marche toujours (man systemd.resource-control : IOWriteBandwidthMax=), sur le bon disque (iostat le nomme), ni trop basse ni trop haute.
    .solution = sudo systemctl set-property radio-archives "IOWriteBandwidthMax=/dev/vda 20M" (enregistré dans /etc), puis iostat -x pour vérifier ; si l'archivage est arrêté : sudo systemctl start radio-archives
