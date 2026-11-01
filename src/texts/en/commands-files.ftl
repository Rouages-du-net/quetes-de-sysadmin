### File commands (src/engine/commands/files.ts): error messages
### taken from coreutils (LANG=C). { $target }: path typed.
### Shared errors (no such file, Permission denied…) are
### in shell.ftl.

## ls

ls-access-missing = ls: cannot access '{ $target }': No such file or directory
ls-access-permission = ls: cannot access '{ $target }': Permission denied
ls-open-permission = ls: cannot open directory '{ $target }': Permission denied

## cd

cd-not-one-directory = cd: { $target }: Not a directory (it's an object: try cat)
# cd - with no previous directory (bash: "OLDPWD not set").
cd-old-missing = cd: OLDPWD not set

## cat, mv, cp, rm, touch, mkdir

cat-usage = Usage: cat file
mv-usage = Usage: mv source destination
mv-missing = mv: cannot stat '{ $target }': No such file or directory
# Game simplification: places are not moved.
mv-place = mv: { $target } is a place; in this game, you only move objects
mv-permission = mv: cannot move '{ $target }': Permission denied
cp-usage = Usage: cp source destination
cp-missing = cp: cannot stat '{ $target }': No such file or directory
cp-directory = cp: -r not specified; omitting directory '{ $target }'
cp-same-file = cp: '{ $source }' and '{ $destination }' are the same file
cp-read-permission = cp: cannot open '{ $target }' for reading: Permission denied
rm-usage = Usage: rm file
# ln (coreutils messages)
ln-operand-missing =
    ln: missing file operand
    Try 'ln --help' for more information.
ln-impossible-symbolic = ln: failed to create symbolic link '{ $target }': { $reason }
ln-impossible-physical = ln: failed to create hard link '{ $target }': { $reason }
ln-exists = File exists
ln-permission = Permission denied
ln-missing = No such file or directory
ln-access-impossible = ln: failed to access '{ $target }': No such file or directory
ln-physical-directory = ln: { $target }: hard link not allowed for directory
rm-missing = rm: cannot remove '{ $target }': No such file or directory
rm-directory = rm: cannot remove '{ $target }': Is a directory (you would need rm -r, and it's dangerous: we don't use it here)
rm-permission = rm: cannot remove '{ $target }': Permission denied
touch-usage = Usage: touch file
mkdir-usage = Usage: mkdir place
mkdir-exists = mkdir: cannot create directory '{ $target }': File exists

## chmod

chmod-usage = Usage: chmod mode file (e.g. chmod o-w memories, chmod 755 memories)
chmod-access-missing = chmod: cannot access '{ $target }': No such file or directory
chmod-access-permission = chmod: cannot access '{ $target }': Permission denied
chmod-not-allowed = chmod: changing permissions of '{ $target }': Operation not permitted
# { $permissions }: what was typed (e.g. o-w)
chmod-mode-incorrect = chmod: invalid mode: '{ $permissions }' (see man chmod)

## find

# { $predicate }: the unknown option typed
find-predicate-unknown = find: unknown predicate `{ $predicate }' (here: -name, -type, -mtime, -maxdepth, -delete)
# { $predicate }: -mtime, -maxdepth; { $value }: what was typed
find-argument-numeric = find: invalid argument `{ $value }' to `{ $predicate }'
find-missing = find: '{ $target }': No such file or directory
find-permission = find: '{ $target }': Permission denied
find-remove-not-empty = find: cannot delete '{ $target }': Directory not empty
find-remove-permission = find: cannot delete '{ $target }': Permission denied

## du, df

missing = du: cannot access '{ $target }': No such file or directory
# Column headers of df: the widths must stay aligned with
# the columns (18, 6, 7, 6 and 4 characters).
df-header = Filesystem           Size    Used  Avail Use% Mounted on
df-header-inodes = Filesystem          Inodes   IUsed   IFree IUse% Mounted on
depth = du: invalid maximum depth

## tar

tar-usage = Usage: tar -czf archive.tar.gz place  |  tar -tzf archive.tar.gz  |  tar -xzf archive.tar.gz [-C place]
tar-archive-empty = tar: Cowardly refusing to create an empty archive
tar-open-impossible = tar: { $target }: Cannot open: No such file or directory
tar-not-one-archive = tar: { $target }: This does not look like a tar archive
# An archive cut off while being written (gzip, then tar, like GNU tar).
tar-truncated =
    gzip: stdin: unexpected end of file
    tar: Unexpected EOF in archive
    tar: Error is not recoverable: exiting now
tar-place-missing = tar: { $target }: Cannot chdir: No such file or directory
tar-option-missing = tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options
