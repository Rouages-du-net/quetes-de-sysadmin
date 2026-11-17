### Indices gradués pour Le traitement de nuit (voir src/engine/hints.ts) :
### un message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction) et .solution (presque la réponse).

## Chapitre 1 — Largeur fixe

hint-copybook-records =
    .lead = Le fichier n'a pas de lignes : compte ses octets, et compare avec la longueur d'enregistrement que donne le copybook (man wc ; /opt/batch/copybooks/CONTRIB.cpy).
    .solution = wc -c /srv/drop/contrib.ebc : 560 octets, donc 14 enregistrements de 40 (LRECL=40).
hint-copybook-bytes =
    .lead = Regarde les octets eux-mêmes, en hexadécimal ou en caractères (man od, man xxd, man hexdump).
    .solution = xxd /srv/drop/contrib.ebc | head, ou od -c, ou hexdump -C : C8 F0 F0… c'est « H00… » en EBCDIC ; les octets 34 à 38 de chaque enregistrement sont le montant condensé.
hint-copybook-converted =
    .lead = Une conversion du fichier entier abîme les montants condensés. Les notes de Ramón (/opt/batch/NOTES.txt) nomment l'outil qui convertit champ par champ.
    .solution = /opt/batch/bin/ebc2asc /srv/drop/contrib.ebc /srv/batch/in/contrib.dat, puis cat /srv/batch/in/contrib.dat.
hint-copybook-end =
    .lead = Remplis verification.txt : la taille, les enregistrements, et ce que dit l'enregistrement de fin (la dernière ligne du fichier converti).
    .solution = nano verification.txt : 560 octets, 14 enregistrements, 12 cotisations, total de contrôle 515.20 (T000012…+000051520).

## Chapitre 2 — Code retour

hint-return-code-compiled =
    .lead = cobc doit savoir où sont les copybooks, doit fabriquer un exécutable plutôt qu'un module, et lit le source par ses colonnes (man cobc).
    .solution = Mets les lignes d'Ayesha dans les colonnes (le code à partir de la colonne 8 : CHECK-TOTALS. après 7 espaces, les instructions après 11), puis cd /opt/batch/src et cobc -x -I /opt/batch/copybooks contrib.cob.
hint-return-code-report =
    .lead = Lance le programme compilé avec ses deux arguments : le fichier à lire, puis le relevé à écrire.
    .solution = ./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt, puis echo $? et cat /srv/batch/out/contrib.rpt.
hint-return-code-rc =
    .lead = Maintenant le fichier de test du centre, et son code retour.
    .solution = ./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt, puis echo $? (8).
hint-return-code-end =
    .lead = Il faut les deux passages : le fichier de la nuit (0) et le fichier de test (8), avec la vérification d'Ayesha compilée.
    .solution = ./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt et ./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt.

## Chapitre 3 — Le fichier en retard

hint-late-file-diagnosed =
    .lead = Qu'a traité le traitement cette nuit ? Sa sortie est dans le journal de son service (man journalctl).
    .solution = journalctl -u night-batch : deux passages sur RUN DATE 291122 ; stat /srv/drop/contrib.ebc : le nouveau fichier est arrivé à 02:39.
hint-late-file-first-night =
    .lead = Le script ne doit démarrer que si contrib.ebc.done est là, l'enlever une fois le fichier traité, et être relancé pendant la nuit (man systemd.timer, man test).
    .solution = Dans run-night.sh : set -e, puis test -f /srv/drop/contrib.ebc.done || exit 0, puis rm /srv/drop/contrib.ebc.done avant les deux programmes ; dans le minuteur, OnCalendar=*-*-* 02..06:00/10, puis sudo systemctl daemon-reload.
hint-late-file-second-night =
    .lead = Quand le programme se termine par 8, le script doit se terminer par 8 lui aussi (pas par l'echo), ou envoyer un courriel.
    .solution = set -e en haut de run-night.sh et enlever l'echo final : systemd marque night-batch en échec ; ou /opt/batch/bin/contrib … || echo "contrib en échec" | mail -s "traitement de nuit" vous.
hint-late-file-end =
    .lead = Les deux nuits d'une répétition doivent bien se passer : le fichier en retard traité une fois, l'incomplet arrêté avec quelqu'un de prévenu.
    .solution = set -e ; test -f /srv/drop/contrib.ebc.done || exit 0 ; rm /srv/drop/contrib.ebc.done ; ebc2asc ; contrib (sans echo) ; OnCalendar=*-*-* 02..06:00/10 et daemon-reload.
