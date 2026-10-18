### Commandes de texte (src/moteur/commandes/texte.ts) : grep, head, tail,
### wc, sort, uniq, cut, less.

# { $commande } : la commande (grep, wc…)
texte-sans-entree = { $commande } : il faut un fichier (ou du texte qui arrive par un tube |)
grep-usage = Usage : grep motif fichier (ex. : grep poivre livre.txt)
# Écart volontaire : le vrai grep ne dit rien quand il ne trouve rien.
grep-rien = (aucune ligne ne contient « { $motif } »)
cut-champs = cut : il faut préciser les champs avec -f (ex. : cut -d " " -f 1)
cut-separateur = cut : le séparateur doit être un seul caractère

awk-usage =
    usage: awk [-F value] [-v var=value] [--] 'program text' [file ...]
    (Exemple : awk '{"{"}print $1{"}"}' access.log ; voir man awk)
