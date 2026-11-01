### Indices gradués des Archives (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 1 — Les Archives

hint-archives-cleanup =
    .piste = Le fonds ne tient pas sur la clé de 64 Mo. du montre où est la place, et Rosa parle de fichiers temporaires (.tmp) qu'on peut jeter : find sait les trouver dans tous les sous-dossiers, et les effacer.
    .solution = find fonds -name "*.tmp" pour les voir, puis find fonds -name "*.tmp" -delete (avec le -name, sinon tout part).
hint-archives-saved =
    .piste = Le ménage est fait : il reste à mettre tout le fonds dans UNE archive compressée, écrite directement sur la clé (/media/cle). Regarde man tar : -c crée, -z compresse, -f nomme l'archive.
    .solution = tar -czf /media/cle/fonds.tar.gz fonds (puis tar -tzf /media/cle/fonds.tar.gz pour vérifier).

## Chapitre 2 — Les versions

hint-versions-restored =
    .piste = Le journal de Marie a été abîmé il y a quelques nuits ; les instantanés plus anciens ont encore la bonne version. restic find --long montre quand le fichier a changé, snapshots donne les ID, et dump (ou restore) ressort un fichier d'un instantané. Toutes les commandes ont besoin de -r et --password-file (notes_restic.txt).
    .solution = restic -r /mnt/mairie/restic-bibliotheque --password-file ~/.config/restic/mot-de-passe snapshots, puis, avec les mêmes options et l'ID d'un instantané du 1er février ou d'avant : restic … dump ID /home/vous/fonds/manuscrits/journal_de_marie.txt > ~/fonds/manuscrits/journal_de_marie.txt
hint-versions-place =
    .piste = Trente instantanés remplissent le disque de la mairie. forget retire des instantanés selon une politique (--keep-daily, --keep-weekly…), mais seul prune libère la place. Garde au moins un instantané avec la bonne version, et essaie d'abord avec --dry-run.
    .solution = restic (avec -r et --password-file) forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune (puis df -h /mnt/mairie pour voir la place rendue).
hint-versions-end =
    .piste = Deux choses encore : le fichier du mot de passe est lisible par tous les comptes (ls -l), et après un prune, on vérifie que le dépôt est intact (man restic).
    .solution = chmod 600 ~/.config/restic/mot-de-passe, puis restic (avec -r et --password-file) check (il doit dire « no errors were found »).
