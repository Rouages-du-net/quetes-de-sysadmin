### File commands (src/moteur/commandes/fichiers.ts): error messages
### taken from coreutils (LANG=C). { $cible }: path typed.
### Shared errors (no such file, Permission denied…) are
### in shell.ftl.

## ls

ls-acces-introuvable = ls: cannot access '{ $cible }': No such file or directory
ls-acces-permission = ls: cannot access '{ $cible }': Permission denied
ls-ouvrir-permission = ls: cannot open directory '{ $cible }': Permission denied

## cd

cd-pas-un-dossier = cd: { $cible }: Not a directory (it's an object: try cat)

## cat, mv, cp, rm, touch, mkdir

cat-usage = Usage: cat file
mv-usage = Usage: mv source destination
mv-introuvable = mv: cannot stat '{ $cible }': No such file or directory
# Game simplification: places are not moved.
mv-lieu = mv: { $cible } is a place; in this game, you only move objects
mv-permission = mv: cannot move '{ $cible }': Permission denied
cp-usage = Usage: cp source destination
cp-introuvable = cp: cannot stat '{ $cible }': No such file or directory
cp-repertoire = cp: -r not specified; omitting directory '{ $cible }'
cp-meme-fichier = cp: '{ $source }' and '{ $destination }' are the same file
cp-lecture-permission = cp: cannot open '{ $cible }' for reading: Permission denied
rm-usage = Usage: rm file
# ln (coreutils messages)
ln-operande-manquant =
    ln: missing file operand
    Try 'ln --help' for more information.
ln-impossible-symbolique = ln: failed to create symbolic link '{ $cible }': { $raison }
ln-impossible-physique = ln: failed to create hard link '{ $cible }': { $raison }
ln-existe = File exists
ln-permission = Permission denied
ln-introuvable = No such file or directory
ln-acces-impossible = ln: failed to access '{ $cible }': No such file or directory
ln-physique-dossier = ln: { $cible }: hard link not allowed for directory
rm-introuvable = rm: cannot remove '{ $cible }': No such file or directory
rm-dossier = rm: cannot remove '{ $cible }': Is a directory (you would need rm -r, and it's dangerous: we don't use it here)
rm-permission = rm: cannot remove '{ $cible }': Permission denied
touch-usage = Usage: touch file
mkdir-usage = Usage: mkdir place
mkdir-existe = mkdir: cannot create directory '{ $cible }': File exists

## chmod

chmod-usage = Usage: chmod mode file (e.g. chmod o-w memories, chmod 755 memories)
chmod-acces-introuvable = chmod: cannot access '{ $cible }': No such file or directory
chmod-acces-permission = chmod: cannot access '{ $cible }': Permission denied
chmod-non-permise = chmod: changing permissions of '{ $cible }': Operation not permitted
# { $droits }: what was typed (e.g. o-w)
chmod-mode-incorrect = chmod: invalid mode: '{ $droits }' (see man chmod)

## find

# { $predicat }: the unknown option typed
find-predicat-inconnu = find: unknown predicate `{ $predicat }' (here: -name, -type, -mtime, -maxdepth, -delete)
# { $predicat }: -mtime, -maxdepth; { $valeur }: what was typed
find-argument-numerique = find: invalid argument `{ $valeur }' to `{ $predicat }'
find-introuvable = find: '{ $cible }': No such file or directory
find-permission = find: '{ $cible }': Permission denied
find-supprimer-non-vide = find: cannot delete '{ $cible }': Directory not empty
find-supprimer-permission = find: cannot delete '{ $cible }': Permission denied

## du, df

du-introuvable = du: cannot access '{ $cible }': No such file or directory
# Column headers of df: the widths must stay aligned with
# the columns (18, 6, 7, 6 and 4 characters).
df-entete = Filesystem           Size    Used  Avail Use% Mounted on
df-entete-inodes = Filesystem          Inodes   IUsed   IFree IUse% Mounted on
du-profondeur = du: invalid maximum depth

## tar

tar-usage = Usage: tar -czf archive.tar.gz place  |  tar -tzf archive.tar.gz  |  tar -xzf archive.tar.gz [-C place]
tar-archive-vide = tar: Cowardly refusing to create an empty archive
tar-open-impossible = tar: { $cible }: Cannot open: No such file or directory
tar-pas-une-archive = tar: { $cible }: This does not look like a tar archive
# An archive cut off while being written (gzip, then tar, like GNU tar).
tar-tronquee =
    gzip: stdin: unexpected end of file
    tar: Unexpected EOF in archive
    tar: Error is not recoverable: exiting now
tar-lieu-introuvable = tar: { $cible }: Cannot chdir: No such file or directory
tar-option-manquante = tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options
