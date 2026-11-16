### Indices gradués de L'Autre Unix (voir src/engine/hints.ts) : un message
### par étape, hint-<chapitre>-<événement>, avec .lead (une piste) et
### .solution (presque la réponse).

## Chapitre 1 — Le script qui cassait

hint-portable-script-not-found =
    .lead = Lance le script, et lis ce que le système répond (./nightly-backup.sh). Puis regarde sa première ligne.
    .solution = ./nightly-backup.sh dit « not found » : sa première ligne, #!/bin/bash, nomme un interpréteur que FreeBSD n'a pas. nano nightly-backup.sh, et mets #!/bin/sh.
hint-portable-script-date =
    .lead = Le script s'arrête maintenant sur date. Ce date n'est pas celui de Debian : lis SON manuel (man date) pour obtenir la date d'hier.
    .solution = Remplace date -d yesterday par date -v-1d (dans nano), en gardant +%F.
hint-portable-script-stat =
    .lead = Vient ensuite stat : man stat, sur cette machine, dit quelle option prend un format, et comment demander la taille.
    .solution = Remplace stat -c %s par stat -f %z.
hint-portable-script-sed =
    .lead = Enfin, sed -i : sur BSD, -i veut toujours un mot après lui (man sed).
    .solution = Écris sed -i '' "s/^last=.*/last=$DAY/" /var/backups/state.conf (le '' est un suffixe vide : pas de copie de secours).
hint-portable-script-end =
    .lead = Lance le script jusqu'au bout : l'archive d'hier doit être dans /var/backups, et state.conf doit dire last=2029-10-05.
    .solution = ./nightly-backup.sh, puis ls -l /var/backups et cat /var/backups/state.conf.

## Chapitre 2 — Pas de systemd ici

hint-rc-services-installed =
    .lead = Pas d'apt ici : FreeBSD a son propre gestionnaire de paquets (man pkg).
    .solution = sudo pkg install nginx (réponds y).
hint-rc-services-not-enabled =
    .lead = Les services se pilotent avec service (man service) : essaie de démarrer nginx.
    .solution = sudo service nginx start (et lis pourquoi il refuse).
hint-rc-services-enabled =
    .lead = Le message nomme la variable de rc.conf. sysrc l'écrit pour toi (man sysrc).
    .solution = sudo sysrc nginx_enable=YES (ou sudo service nginx enable).
hint-rc-services-end =
    .lead = Démarre-le maintenant, et vérifie qu'il écoute sur le port 80 (man sockstat).
    .solution = sudo service nginx start, puis sockstat -4l.

## Chapitre 3 — La dernière règle gagne

hint-last-rule-checked =
    .lead = Lis /etc/pf.conf, et vérifie-le sans le charger (man pfctl).
    .solution = cat /etc/pf.conf, puis sudo pfctl -nf /etc/pf.conf.
hint-last-rule-on =
    .lead = Dans pf, c'est la DERNIÈRE règle qui correspond qui décide (man pf.conf). Mets les règles dans l'ordre de pf avant de l'activer.
    .solution = sudo nano /etc/pf.conf : « block in all » d'abord, puis « pass in proto tcp to port {"{"} 22 80 {"}"} », puis « pass out all keep state ». Ensuite sudo sysrc pf_enable=YES et sudo service pf start.
hint-last-rule-end =
    .lead = pf doit démarrer au boot, avec les règles du fichier : vérifie ce qui est en vigueur (pfctl -sr), et depuis ton poste, ce qui répond (nc -zv).
    .solution = sudo pfctl -f /etc/pf.conf après chaque modification, sudo pfctl -sr ; exit, puis nc -zv projecteur 3306 (il ne doit pas répondre) et nc -zv projecteur 80.
