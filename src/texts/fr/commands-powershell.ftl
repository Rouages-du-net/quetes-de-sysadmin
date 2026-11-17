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

### Le moteur Windows (windows-*.ts) : remarques du jeu, et les textes d'aide des
### programmes de Windows (/?), en anglais comme un Windows Server anglophone.

# Get-Help sur un programme plutôt qu'une cmdlet. { $name } : le programme.
powershell-help-native = { $name } est un programme, pas une cmdlet : son aide est « { $name } /? », et le manuel du jeu a sa page (man sous Linux).
# Get-WinEvent sans journal.
powershell-winevent-which = Nommez un journal : Get-WinEvent -LogName System, ou -ListLog * pour les voir tous.
# net user NOM * (un mot de passe tapé à une invite : non simulé).
net-password-prompt = Le net user du jeu ne demande pas le mot de passe : donnez-le sur la ligne, ou utilisez Set-LocalUser avec Read-Host -AsSecureString.
icacls-usage =
    ICACLS name /save aclfile [/T] [/C] [/L] [/Q]
    ICACLS name [/grant[:r] Sid:perm[...]] [/deny Sid:perm [...]] [/remove[:g|:d]] Sid[...]] [/T] [/C] [/L] [/Q] [/setintegritylevel Level:policy[...]]
    ICACLS name /inheritance:e|d|r
    ICACLS name /setowner user [/T] [/C] [/L] [/Q]
    ICACLS name /reset [/T] [/C] [/L] [/Q]

        perm is a permission mask: F (full access), M (modify access), RX (read and execute access), R (read-only access), W (write-only access), D (delete access), or a comma-separated list of specific rights in parentheses (RD, WD, AD, X, DC…).
        Inheritance rights may precede either form: (I) inherit, (OI) object inherit, (CI) container inherit, (IO) inherit only, (NP) don't propagate inherit.
takeown-usage =
    TAKEOWN [/S system] /F filename [/A] [/R [/D prompt]]

    Description:
        This tool allows an administrator to recover access to a file that was denied by re-assigning file ownership.

    Parameter List:
        /F    filename      Specifies the filename or directory name pattern.
        /A                  Gives ownership to the administrators group instead of the current user.
        /R                  Recurse: instructs the tool to operate on files in specified directory and all subdirectories.
sc-usage =
    DESCRIPTION:
            SC is a command line program used for communicating with the Service Control Manager and services.
    USAGE:
            sc <server> [command] [service name] <option1> <option2>...

            query-----------Queries the status for a service.
            qc--------------Queries the configuration information for a service.
            start-----------Starts a service.
            stop------------Sends a STOP request to a service.
            config----------Changes the configuration of a service (persistent).
sc-config-usage =
    DESCRIPTION:
            Modifies a service entry in the registry and Service Database.
    USAGE:
            sc <server> config [service name] <option1> <option2>...

    OPTIONS:
    NOTE: The option name includes the equal sign.
          A space is required between the equal sign and the value.
     start= <boot|system|auto|demand|disabled|delayed-auto>
     binPath= <BinaryPathName to the .exe file>
     DisplayName= <display name>
     obj= <AccountName|ObjectName>
     password= <password>
net-usage =
    The syntax of this command is:

    NET [ ACCOUNTS | COMPUTER | CONFIG | CONTINUE | FILE | GROUP | HELP |
          HELPMSG | LOCALGROUP | PAUSE | SESSION | SHARE | START |
          STATISTICS | STOP | TIME | USE | USER | VIEW ]
schtasks-usage =
    SCHTASKS /parameter [arguments]

    Description:
        Enables an administrator to create, delete, query, change, run and end scheduled tasks on a local or remote system.

    Parameter List:
        /Create         Creates a new scheduled task.
        /Delete         Deletes the scheduled task(s).
        /Query          Displays all scheduled tasks.
        /Change         Changes the properties of scheduled task.
        /Run            Runs the scheduled task on demand.
        /End            Stops the currently running scheduled task.
reg-usage =
    REG Operation [Parameter List]

      Operation  [ QUERY   | ADD    | DELETE  | COPY    |
                   SAVE    | LOAD   | UNLOAD  | RESTORE |
                   COMPARE | EXPORT | IMPORT  | FLAGS ]

    Return Code: (Except for REG COMPARE)

      0 - Successful
      1 - Failed
wevtutil-usage =
    Windows Events Command Line Utility.

    Enables you to retrieve information about event logs and publishers, install
    and uninstall event manifests, run queries, and export, archive, and clear logs.

    Usage:

    wevtutil COMMAND [ARGUMENT [ARGUMENT] ...] [/OPTION:VALUE [/OPTION:VALUE] ...]

    Commands:

    el | enum-logs          List log names.
    gl | get-log            Get log configuration information.
    sl | set-log            Modify configuration of a log.
ping-windows-usage =
    Usage: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS] [-r count] [-s count] [[-j host-list] | [-k host-list]] [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p] [-4] [-6] target_name
