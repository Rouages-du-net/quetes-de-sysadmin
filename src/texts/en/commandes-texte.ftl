### Text commands (src/engine/commands/text.ts): grep, head, tail,
### wc, sort, uniq, cut, less.

# { $commande }: the command (grep, wc…)
texte-sans-entree = { $commande }: a file is needed (or text coming through a pipe |)
grep-usage = Usage: grep pattern file (e.g. grep poivre livre.txt)
# Deliberate difference: the real grep says nothing when it finds nothing.
grep-rien = (no line contains "{ $motif }")
cut-champs = cut: you must specify a list of fields with -f (e.g. cut -d " " -f 1)
cut-separateur = cut: the delimiter must be a single character

awk-usage =
    usage: awk [-F value] [-v var=value] [--] 'program text' [file ...]
    (Example: awk '{"{"}print $1{"}"}' access.log; see man awk)

## diff (GNU diffutils, LANG=C messages)

# { $operande }: the last argument given
diff-usage =
    diff: missing operand after '{ $operande }'
    diff: Try 'diff --help' for more information.
diff-introuvable = diff: { $cible }: No such file or directory
# { $a }, { $b }: the two paths compared
diff-sous-dossiers = Common subdirectories: { $a } and { $b }
diff-types = File { $a } is a directory while file { $b } is a regular file
diff-differents = Files { $a } and { $b } differ
# { $lieu }: a directory; { $nom }: what exists only there
diff-seulement = Only in { $lieu }: { $nom }
