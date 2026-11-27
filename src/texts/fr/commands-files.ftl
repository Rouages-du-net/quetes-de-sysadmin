### Commandes de fichiers (src/engine/commands/files.ts) : messages
### d'erreur repris des coreutils en français. { $target } : chemin tapé.
### Les erreurs communes (aucun fichier, Permission non accordée…) sont
### dans shell.ftl.

## ls

ls-access-missing = ls : impossible d'accéder à '{ $target }' : aucun fichier ou dossier de ce nom
ls-access-permission = ls : impossible d'accéder à '{ $target }' : Permission non accordée
ls-open-permission = ls : impossible d'ouvrir le répertoire '{ $target }' : Permission non accordée

## cd

cd-not-one-directory = cd : { $target } : n’est pas un dossier (c’est un objet : essaie cat)
# cd - sans dossier d'avant (bash : « OLDPWD non défini »).
cd-old-missing = cd : OLDPWD non défini

## cat, mv, cp, rm, touch, mkdir

cat-usage = Usage : cat fichier
mv-usage = Usage : mv source destination
mv-missing = mv : impossible d'évaluer '{ $target }' : aucun fichier ou dossier de ce nom
# Simplification du jeu : on ne déplace pas les lieux.
mv-place = mv : impossible de déplacer '{ $target }' : un lieu de l’histoire s’y trouve, et le jeu garde les lieux de l’histoire à leur place
mv-permission = mv : impossible de déplacer '{ $target }' : Permission non accordée
cp-usage = Usage : cp source destination
cp-missing = cp : impossible d'évaluer '{ $target }' : aucun fichier ou dossier de ce nom
cp-directory = cp : -r non spécifié ; omission du répertoire '{ $target }'
cp-same-file = cp : '{ $source }' et '{ $destination }' sont le même fichier
cp-read-permission = cp : impossible d'ouvrir '{ $target }' en lecture : Permission non accordée
rm-usage = Usage : rm fichier
# ln (messages de coreutils en français)
ln-operand-missing =
    ln: opérande de fichier manquant
    Saisissez « ln --help » pour plus d'informations.
ln-impossible-symbolic = ln: impossible de créer le lien symbolique '{ $target }': { $reason }
ln-impossible-physical = ln: impossible de créer le lien physique '{ $target }': { $reason }
ln-exists = Le fichier existe
ln-permission = Permission non accordée
ln-missing = Aucun fichier ou dossier de ce nom
ln-access-impossible = ln: impossible d'accéder à '{ $target }': Aucun fichier ou dossier de ce nom
ln-physical-directory = ln: { $target } : les liens physiques ne sont pas permis pour un répertoire
rm-missing = rm : impossible de supprimer '{ $target }' : aucun fichier ou dossier de ce nom
rm-directory = rm : impossible de supprimer '{ $target }' : est un dossier
rm-permission = rm : impossible de supprimer '{ $target }' : Permission non accordée
touch-usage = Usage : touch fichier
mkdir-usage = Usage : mkdir lieu
mkdir-exists = mkdir : impossible de créer le répertoire '{ $target }' : Le fichier existe

## chmod

chmod-usage = Usage : chmod droits fichier (ex. : chmod o-w souvenirs, chmod 755 souvenirs)
chmod-access-missing = chmod : impossible d'accéder à '{ $target }' : aucun fichier ou dossier de ce nom
chmod-access-permission = chmod : impossible d'accéder à '{ $target }' : Permission non accordée
chmod-not-allowed = chmod : modification des droits de '{ $target }' : Opération non permise
# { $permissions } : ce qui a été tapé (ex. o-w)
chmod-mode-incorrect = chmod : mode incorrect : « { $permissions } » (voir man chmod)

## find

# { $predicate } : l'option inconnue tapée
find-predicate-unknown = find : prédicat inconnu « { $predicate } »
find-argument-missing = find: argument manquant pour « { $predicate } »
# { $predicate } : -mtime, -maxdepth ; { $value } : ce qui a été tapé
find-argument-numeric = find: argument « { $value } » non valable pour « { $predicate } »
find-missing = find : '{ $target }' : aucun fichier ou dossier de ce nom
find-permission = find : '{ $target }' : Permission non accordée
find-remove-not-empty = find : impossible de supprimer '{ $target }' : Le dossier n'est pas vide
find-remove-permission = find : impossible de supprimer '{ $target }' : Permission non accordée

## du, df

missing = du : impossible d'accéder à '{ $target }' : aucun fichier ou dossier de ce nom
# En-tête des colonnes de df : les largeurs doivent rester alignées avec
# les colonnes (18, 6, 7, 6 et 4 caractères).
df-header = Sys. de fichiers   Taille Utilisé  Dispo Uti% Monté sur
df-header-inodes = Sys. de fichiers    Inœuds  IUtil.  ILibre IUti% Monté sur
# df -T : le titre de la colonne du type.
df-type = Type
depth = du: profondeur maximale non valable

## tar

tar-usage = Usage : tar -czf archive.tar.gz lieu  |  tar -tzf archive.tar.gz  |  tar -xzf archive.tar.gz [-C lieu]
tar-archive-empty = tar : refus de créer une archive vide
tar-open-impossible = tar : { $target } : open impossible : aucun fichier ou dossier de ce nom
tar-not-one-archive = tar : { $target } : ne ressemble pas à une archive tar
# Une archive coupée en cours d'écriture (gzip, puis tar, comme GNU tar).
tar-truncated =
    gzip: stdin : fin de fichier inattendue
    tar: Fin de fichier inattendue dans l'archive
    tar: Erreur non récupérable : arrêt immédiat
tar-place-missing = tar : { $target } : chdir impossible : aucun fichier ou dossier de ce nom
tar-option-missing = tar : il faut une de ces options : -c, -t ou -x

## cp, mv, rm et rmdir : options (messages de coreutils 9.4 en français)

target-not-directory = { $command } : cible '{ $target }' : n'est pas un répertoire
target-missing = { $command } : cible '{ $target }' : aucun fichier ou dossier de ce nom
# -i : la question ; o (ou y) remplace le fichier.
cp-overwrite = cp : voulez-vous écraser '{ $target }' ? 
mv-overwrite = mv : voulez-vous écraser '{ $target }' ? 
# mv -v
mv-renamed = '{ $source }' renommé en '{ $destination }'
rm-ask = rm : supprimer '{ $target }' du type fichier ? 
rm-ask-empty = rm : supprimer '{ $target }' du type fichier vide ? 
rm-ask-link = rm : supprimer '{ $target }' du type lien symbolique ? 
rm-removed = '{ $target }' supprimé
rm-removed-directory = répertoire '{ $target }' supprimé
rm-ask-descend = rm : descendre dans le répertoire '{ $target }' ?
rm-ask-directory = rm : supprimer '{ $target }' du type répertoire ?
rm-dot = rm : refus de supprimer le répertoire '.' ou '..' : '{ $target }' ignoré
rm-preserve-root =
    rm : il est dangereux d'opérer récursivement sur '{ $target }'
    rm : utilisez --no-preserve-root pour inhiber cette mesure de sécurité
rm-busy = rm : impossible de supprimer '{ $target }' : Périphérique ou ressource occupé
rm-not-permitted = rm : impossible de supprimer '{ $target }' : Opération non permise
rm-other-device = rm : '{ $target }' ignoré, car il est sur un autre périphérique
# Différences voulues avec rm et mv de GNU : le jeu garde les lieux du système et ceux de l’histoire.
rm-system = rm : impossible de supprimer '{ $target }' : le jeu garde les lieux du système (/, /etc, /usr/lib, /var/log…), que root pourrait détruire sur un vrai serveur
rm-story-place = rm : impossible de supprimer '{ $target }' : un lieu de l’histoire s’y trouve, et le jeu garde les lieux de l’histoire
mv-system = mv : impossible de déplacer '{ $target }' : le jeu garde les lieux du système (/, /etc, /usr/lib, /var/log…) à leur place
mv-into-itself = mv : impossible de déplacer '{ $source }' vers un sous-répertoire de lui-même, '{ $target }'
mv-busy = mv : impossible de déplacer '{ $source }' vers '{ $target }' : Périphérique ou ressource occupé
mv-over-file = mv : impossible d'écraser le non-répertoire '{ $target }' par le répertoire '{ $source }'
mv-not-empty = mv : impossible de déplacer '{ $source }' vers '{ $target }' : Le dossier n'est pas vide
mv-over-directory = mv : impossible d'écraser le répertoire '{ $target }' par un non-répertoire
mv-denied = mv : impossible de déplacer '{ $source }' vers '{ $target }' : Permission non accordée
rmdir-usage =
    rmdir : opérande manquant
    Saisissez « rmdir --help » pour plus d'informations.
rmdir-failed = rmdir : impossible de supprimer '{ $target }' : { $reason }
rmdir-missing = aucun fichier ou dossier de ce nom
rmdir-not-directory = n'est pas un répertoire
rmdir-not-empty = Le dossier n'est pas vide
rmdir-permission = Permission non accordée
rmdir-removing = rmdir : suppression du répertoire, '{ $target }'
