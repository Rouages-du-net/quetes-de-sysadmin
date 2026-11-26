### Textbefehle (src/engine/commands/text.ts): grep, head, tail,
### wc, sort, uniq, cut, less.

# { $command }: der Befehl (grep, wc…)
text-without-input = { $command }: Es braucht eine Datei (oder Text, der durch eine Pipe | kommt)
grep-usage = Aufruf: grep muster datei (z. B. grep pfeffer buch.txt)
# Bewusster Unterschied: Das echte grep sagt nichts, wenn es nichts findet.
grep-nothing = (keine Zeile enthält „{ $pattern }“)
cut-fields = cut: Du musst mit -f eine Liste von Feldern angeben (z. B. cut -d " " -f 1)
cut-separator = cut: Das Trennzeichen muss ein einzelnes Zeichen sein

awk-usage =
    usage: awk [-F value] [-v var=value] [--] 'program text' [file ...]
    (Beispiel: awk '{"{"}print $1{"}"}' access.log; siehe man awk)

## diff (GNU diffutils, Meldungen auf Deutsch)

# { $operand }: das letzte angegebene Argument
diff-usage =
    diff: Fehlender Operand nach '{ $operand }'
    diff: „diff --help“ liefert weitere Informationen.
diff-missing = diff: { $target }: Datei oder Verzeichnis nicht gefunden
# { $a }, { $b }: die beiden verglichenen Pfade
diff-under-directories = Gemeinsame Unterverzeichnisse: { $a } und { $b }
diff-types = Datei { $a } ist ein Verzeichnis, während Datei { $b } eine reguläre Datei ist
diff-different = Dateien { $a } und { $b } sind verschieden
# { $place }: ein Verzeichnis; { $name }: was nur dort existiert
diff-only = Nur in { $place }: { $name }
