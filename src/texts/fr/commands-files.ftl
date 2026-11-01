### Commandes de fichiers (src/engine/commands/files.ts) : messages
### d'erreur repris des coreutils en français. { $cible } : chemin tapé.
### Les erreurs communes (aucun fichier, Permission non accordée…) sont
### dans shell.ftl.

## ls

ls-access-missing = ls : impossible d'accéder à '{ $cible }' : aucun fichier ou dossier de ce nom
ls-access-permission = ls : impossible d'accéder à '{ $cible }' : Permission non accordée
ls-open-permission = ls : impossible d'ouvrir le répertoire '{ $cible }' : Permission non accordée

## cd

cd-not-one-directory = cd : { $cible } : n’est pas un dossier (c’est un objet : essaie cat)
# cd - sans dossier d'avant (bash : « OLDPWD non défini »).
cd-old-missing = cd : OLDPWD non défini

## cat, mv, cp, rm, touch, mkdir

cat-usage = Usage : cat fichier
mv-usage = Usage : mv source destination
mv-missing = mv : impossible d'évaluer '{ $cible }' : aucun fichier ou dossier de ce nom
# Simplification du jeu : on ne déplace pas les lieux.
mv-place = mv : { $cible } est un lieu ; dans ce jeu, on ne déplace que des objets
mv-permission = mv : impossible de déplacer '{ $cible }' : Permission non accordée
cp-usage = Usage : cp source destination
cp-missing = cp : impossible d'évaluer '{ $cible }' : aucun fichier ou dossier de ce nom
cp-directory = cp : -r non spécifié ; omission du répertoire '{ $cible }'
cp-same-file = cp : '{ $source }' et '{ $destination }' sont le même fichier
cp-read-permission = cp : impossible d'ouvrir '{ $cible }' en lecture : Permission non accordée
rm-usage = Usage : rm fichier
# ln (messages de coreutils en français)
ln-operand-missing =
    ln: opérande de fichier manquant
    Saisissez « ln --help » pour plus d'informations.
ln-impossible-symbolic = ln: impossible de créer le lien symbolique '{ $cible }': { $raison }
ln-impossible-physical = ln: impossible de créer le lien physique '{ $cible }': { $raison }
ln-exists = Le fichier existe
ln-permission = Permission non accordée
ln-missing = Aucun fichier ou dossier de ce nom
ln-access-impossible = ln: impossible d'accéder à '{ $cible }': Aucun fichier ou dossier de ce nom
ln-physical-directory = ln: { $cible } : les liens physiques ne sont pas permis pour un répertoire
rm-missing = rm : impossible de supprimer '{ $cible }' : aucun fichier ou dossier de ce nom
rm-directory = rm : impossible de supprimer '{ $cible }' : est un dossier (il faudrait rm -r, et c’est dangereux : on ne l’utilise pas ici)
rm-permission = rm : impossible de supprimer '{ $cible }' : Permission non accordée
touch-usage = Usage : touch fichier
mkdir-usage = Usage : mkdir lieu
mkdir-exists = mkdir : impossible de créer le répertoire '{ $cible }' : Le fichier existe

## chmod

chmod-usage = Usage : chmod droits fichier (ex. : chmod o-w souvenirs, chmod 755 souvenirs)
chmod-access-missing = chmod : impossible d'accéder à '{ $cible }' : aucun fichier ou dossier de ce nom
chmod-access-permission = chmod : impossible d'accéder à '{ $cible }' : Permission non accordée
chmod-not-allowed = chmod : modification des droits de '{ $cible }' : Opération non permise
# { $droits } : ce qui a été tapé (ex. o-w)
chmod-mode-incorrect = chmod : mode incorrect : « { $droits } » (voir man chmod)

## find

# { $predicat } : l'option inconnue tapée
find-predicate-unknown = find : prédicat inconnu « { $predicat } » (ici : -name, -type, -mtime, -maxdepth, -delete)
# { $predicat } : -mtime, -maxdepth ; { $valeur } : ce qui a été tapé
find-argument-numeric = find: argument « { $valeur } » non valable pour « { $predicat } »
find-missing = find : '{ $cible }' : aucun fichier ou dossier de ce nom
find-permission = find : '{ $cible }' : Permission non accordée
find-remove-not-empty = find : impossible de supprimer '{ $cible }' : Le dossier n'est pas vide
find-remove-permission = find : impossible de supprimer '{ $cible }' : Permission non accordée

## du, df

missing = du : impossible d'accéder à '{ $cible }' : aucun fichier ou dossier de ce nom
# En-tête des colonnes de df : les largeurs doivent rester alignées avec
# les colonnes (18, 6, 7, 6 et 4 caractères).
df-header = Sys. de fichiers   Taille Utilisé  Dispo Uti% Monté sur
df-header-inodes = Sys. de fichiers    Inœuds  IUtil.  ILibre IUti% Monté sur
depth = du: profondeur maximale non valable

## tar

tar-usage = Usage : tar -czf archive.tar.gz lieu  |  tar -tzf archive.tar.gz  |  tar -xzf archive.tar.gz [-C lieu]
tar-archive-empty = tar : refus de créer une archive vide
tar-open-impossible = tar : { $cible } : open impossible : aucun fichier ou dossier de ce nom
tar-not-one-archive = tar : { $cible } : ne ressemble pas à une archive tar
# Une archive coupée en cours d'écriture (gzip, puis tar, comme GNU tar).
tar-truncated =
    gzip: stdin : fin de fichier inattendue
    tar: Fin de fichier inattendue dans l'archive
    tar: Erreur non récupérable : arrêt immédiat
tar-place-missing = tar : { $cible } : chdir impossible : aucun fichier ou dossier de ce nom
tar-option-missing = tar : il faut une de ces options : -c, -t ou -x
