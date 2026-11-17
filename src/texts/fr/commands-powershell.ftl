### Windows (Les voisins Windows) : ce que le jeu ajoute à la session
### PowerShell, et l'usage de dos2unix. Les sorties et erreurs de PowerShell
### restent en anglais, comme sur un Windows Server en anglais.

# Une cmdlet qui change quelque chose (Remove-Item, Restart-Service…). { $command } : son nom.
powershell-read-only = { $command } : le PowerShell du jeu ne fait que lire (ce serveur Windows, c'est à quelqu'un d'autre de le modifier). Regardez, puis notez ce que vous avez trouvé.
# Where-Object avec un bloc de script que le jeu ne lit pas.
powershell-filter-simple = Le Where-Object du jeu lit une seule comparaison sur $_ : {"{"} $_.Length -gt 1GB {"}"}, ou Where-Object Length -gt 1GB.
# Les titres de Get-Help (la mise en page de l'aide de PowerShell).
powershell-help-name = NOM
powershell-help-synopsis = RÉSUMÉ
powershell-help-syntax = SYNTAXE
powershell-help-description = DESCRIPTION
powershell-help-parameters = PARAMÈTRES
powershell-help-related = LIENS CONNEXES
powershell-help-remarks = REMARQUES
# { $number } : le numéro de l'exemple.
powershell-help-example = EXEMPLE { $number }
# { $name } : la cmdlet.
powershell-help-remarks-text =
    Pour afficher les exemples, tapez : « get-help { $name } -examples ».
    Pour plus d'informations, tapez : « get-help { $name } -detailed ».
    Pour obtenir des informations techniques, tapez : « get-help { $name } -full ».
# Get-Help sans nom.
powershell-help-intro =
    RUBRIQUE
        Système d'aide de Windows PowerShell

    DESCRIPTION COURTE
        Affiche l'aide sur les cmdlets et les concepts de Windows PowerShell.

    DESCRIPTION LONGUE
        Get-Help NOM affiche l'aide d'une cmdlet (help NOM et man NOM aussi) :
        Get-Help Get-ChildItem, Get-Help ls (un alias), Get-Help
        Get-ChildItem -Examples. Get-Command liste les commandes, Get-Alias
        les alias. NOM -? affiche aussi l'aide.

dos2unix-usage =
    Utilisation : dos2unix [options] [fichier ...] [-n entrée sortie ...]
     -i, --info            affiche les informations du fichier (sauts de ligne DOS, Unix et Mac)
     -k, --keepdate        garde la date du fichier de sortie
     -n, --newfile         écrit dans un nouveau fichier
     -q, --quiet           mode silencieux, supprime les avertissements
     -h, --help            affiche cette aide
    Sans fichier, dos2unix convertit ce qui arrive par un tube.
unix2dos-usage =
    Utilisation : unix2dos [options] [fichier ...] [-n entrée sortie ...]
     -i, --info            affiche les informations du fichier (sauts de ligne DOS, Unix et Mac)
     -k, --keepdate        garde la date du fichier de sortie
     -n, --newfile         écrit dans un nouveau fichier
     -q, --quiet           mode silencieux, supprime les avertissements
     -h, --help            affiche cette aide
    Sans fichier, unix2dos convertit ce qui arrive par un tube.
