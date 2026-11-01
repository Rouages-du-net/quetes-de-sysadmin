### Text commands (src/engine/commands/text.ts): grep, head, tail,
### wc, sort, uniq, cut, less.

# { $command }: the command (grep, wc…)
text-without-input = { $command }: a file is needed (or text coming through a pipe |)
grep-usage = Usage: grep pattern file (e.g. grep poivre livre.txt)
# Deliberate difference: the real grep says nothing when it finds nothing.
grep-nothing = (no line contains "{ $pattern }")
cut-fields = cut: you must specify a list of fields with -f (e.g. cut -d " " -f 1)
cut-separator = cut: the delimiter must be a single character

awk-usage =
    usage: awk [-F value] [-v var=value] [--] 'program text' [file ...]
    (Example: awk '{"{"}print $1{"}"}' access.log; see man awk)

## diff (GNU diffutils, LANG=C messages)

# { $operand }: the last argument given
diff-usage =
    diff: missing operand after '{ $operand }'
    diff: Try 'diff --help' for more information.
diff-missing = diff: { $target }: No such file or directory
# { $a }, { $b }: the two paths compared
diff-under-directories = Common subdirectories: { $a } and { $b }
diff-types = File { $a } is a directory while file { $b } is a regular file
diff-different = Files { $a } and { $b } differ
# { $place }: a directory; { $name }: what exists only there
diff-only = Only in { $place }: { $name }
