### Commandes de texte (src/engine/commands/text.ts) : grep, head, tail,
### wc, sort, uniq, cut, less.

# { $command } : la commande (grep, wc…)
text-without-input = { $command } : il faut un fichier (ou du texte qui arrive par un tube |)
grep-usage = Usage : grep motif fichier (ex. : grep poivre livre.txt)
# Écart volontaire : le vrai grep ne dit rien quand il ne trouve rien.
grep-nothing = (aucune ligne ne contient « { $pattern } »)
cut-fields = cut : il faut préciser les champs avec -f (ex. : cut -d " " -f 1)
cut-separator = cut : le séparateur doit être un seul caractère

awk-usage =
    usage: awk [-F value] [-v var=value] [--] 'program text' [file ...]
    (Exemple : awk '{"{"}print $1{"}"}' access.log ; voir man awk)

## diff (GNU diffutils, messages en français)

# { $operand } : le dernier argument donné
diff-usage =
    diff: opérande manquant après « { $operand } »
    diff: Saisissez « diff --help » pour plus d'informations.
diff-missing = diff: { $target }: Aucun fichier ou dossier de ce nom
# { $a }, { $b } : les deux chemins comparés
diff-under-directories = Sous-répertoires communs : { $a } et { $b }
diff-types = Le fichier { $a } est un répertoire alors que le fichier { $b } est un fichier normal
diff-different = Les fichiers { $a } et { $b } sont différents
# { $place } : un dossier ; { $name } : ce qui n'existe que là
diff-only = Seulement dans { $place } : { $name }
