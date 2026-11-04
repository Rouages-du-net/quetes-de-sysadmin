### Les indices gradués de l'histoire « L'Observatoire » : une piste, puis
### presque la réponse, pour chaque étape (voir src/engine/hints.ts).

## Chapitre 1 — Grosse charge

hint-heavy-load-load =
    .lead = À quel point la machine est-elle occupée ? (man uptime : la charge moyenne ; man nproc : combien de processeurs)
    .solution = uptime donne une charge d'environ 9 ; nproc dit 2 processeurs : sept processus attendent un processeur à chaque instant.
hint-heavy-load-workers =
    .lead = Qui prend le processeur ? (man top, man ps)
    .solution = top : huit processus stack-worker de jules, chacun à 22 % environ, et la galerie (node) avec la même part.
hint-heavy-load-end =
    .lead = Baisse la priorité des workers, tous, sans les arrêter (man renice : -n, -p, -u). Puis chronomètre la galerie comme Amara.
    .solution = sudo renice -n 19 -u jules, puis curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/

## Chapitre 2 — Le Quota

hint-quota-measure =
    .lead = Combien de processeur l'empilement prend-il ce matin, nice ou pas ? (man top, man systemd-cgtop)
    .solution = top : les huit workers à NI 19 prennent presque tout des deux processeurs ; systemd-cgtop montre stacking.service près de 200 %.
hint-quota-end =
    .lead = Nice ne plafonne pas : systemd peut limiter le temps processeur d'un service (man systemd.resource-control : CPUQuota=). 40 % de deux processeurs, c'est combien de pourcents d'UN seul ?
    .solution = sudo systemctl set-property stacking CPUQuota=80% (appliqué tout de suite, gardé sur le disque), puis systemd-cgtop.

## Chapitre 3 — Trop de fichiers ouverts

hint-too-many-files-emfile =
    .lead = Que dit la galerie quand les archives échouent ? (man journalctl : -u)
    .solution = journalctl -u gallery : « Error: EMFILE: too many open files ».
hint-too-many-files-limits =
    .lead = Quelle est la limite du processus de la galerie, pas celle de ton shell ? (man proc : /proc/PID/limits ; man prlimit)
    .solution = cat /proc/840/limits : Max open files 1024 (souple), 524288 (dure). Ou sudo prlimit --pid 840 --nofile.
hint-too-many-files-end =
    .lead = Un service reçoit ses limites de systemd, à son démarrage (man systemd.exec : LimitNOFILE=).
    .solution = sudo systemctl edit gallery : {"["}Service] LimitNOFILE=4096 ; puis sudo systemctl restart gallery, et curl -i http://localhost:8080/archive.

## Chapitre 4 — Le Processus coincé

hint-stuck-process-stuck =
    .lead = Quels processus forment la copie, et qui a lancé qui ? (man ps : -ef, la colonne PPID)
    .solution = ps -ef : /bin/bash /usr/local/bin/sync-photos (3301), et son enfant rsync (3302).
hint-stuck-process-ignored =
    .lead = kill envoie TERM. Le script l'accepte-t-il ? Lis-le (cat /usr/local/bin/sync-photos), et cherche les signaux que rien ne peut ignorer (man 7 signal).
    .solution = Le script a trap '' INT TERM HUP : sudo kill -KILL 3301 (ou kill -9).
hint-stuck-process-end =
    .lead = Après KILL : que reste-t-il de la copie, et qu'est-ce que le script n'a pas eu le temps de ranger ? (ps -ef, le LOCK du script)
    .solution = sudo kill sur le rsync qui reste, vérifier avec ps -p 3301 que le script est parti, puis sudo rm /run/sync-photos.pid.
