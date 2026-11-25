### Windows (Windows nebenan): was das Spiel der PowerShell-Sitzung
### hinzufügt, und der Aufruf von dos2unix. Ausgaben und Fehler von PowerShell
### bleiben auf Englisch, wie auf einem englischsprachigen Windows Server.

# Ein Cmdlet, das etwas ändert (Remove-Item, Restart-Service…). { $command }: sein Name.
powershell-read-only = { $command }: Die PowerShell des Spiels liest nur (diesen Windows-Server ändert jemand anderes). Schau hin und notiere dann, was du gefunden hast.
# Where-Object mit einem Skriptblock, den das Spiel nicht liest.
powershell-filter-simple = Das Where-Object des Spiels liest einen Vergleich auf $_: {"{"} $_.Length -gt 1GB {"}"}, oder Where-Object Length -gt 1GB.
# Die Überschriften von Get-Help (das Layout der PowerShell-Hilfe, auf Englisch).
powershell-help-name = NAME
powershell-help-synopsis = SYNOPSIS
powershell-help-syntax = SYNTAX
powershell-help-description = DESCRIPTION
powershell-help-parameters = PARAMETERS
powershell-help-related = RELATED LINKS
powershell-help-remarks = REMARKS
powershell-help-aliases = ALIASES
# Eine Funktion ohne kommentarbasierte Hilfe (das „None“ von Get-Help).
powershell-help-none = None
# Eine Zeile, deren Schleifen zu oft liefen: Das Spiel stoppt sie. { $count }: die Grenze.
powershell-loop-limit = Das Spiel hat diese Zeile gestoppt: Ihre Schleifen liefen mehr als { $count } Mal (eine Bedingung, die nie falsch wird?). Auf einem echten Windows stoppt Strg+C eine Endlosschleife.
# { $number }: die Nummer des Beispiels.
powershell-help-example = EXAMPLE { $number }
# { $name }: das Cmdlet.
powershell-help-remarks-text =
    To see the examples, type: "get-help { $name } -examples".
    For more information, type: "get-help { $name } -detailed".
    For technical information, type: "get-help { $name } -full".
# Get-Help ohne Namen (die Hilfe von PowerShell, auf Englisch).
powershell-help-intro =
    TOPIC
        Windows PowerShell Help System

    SHORT DESCRIPTION
        Displays help about Windows PowerShell cmdlets and concepts.

    LONG DESCRIPTION
        Get-Help NAME shows a cmdlet's help (help NAME and man NAME too):
        Get-Help Get-ChildItem, Get-Help ls (an alias), Get-Help
        Get-ChildItem -Examples. Get-Command lists the commands, Get-Alias
        the aliases. NAME -? also shows the help.

dos2unix-usage =
    Usage: dos2unix [options] [file ...] [-n infile outfile ...]
     -i, --info            display file information (DOS, Unix and Mac line breaks)
     -k, --keepdate        keep output file date
     -n, --newfile         write to new file
     -q, --quiet           quiet mode, suppress all warnings
     -h, --help            display this help text
    Ohne Datei wandelt dos2unix um, was durch eine Pipe kommt.
unix2dos-usage =
    Usage: unix2dos [options] [file ...] [-n infile outfile ...]
     -i, --info            display file information (DOS, Unix and Mac line breaks)
     -k, --keepdate        keep output file date
     -n, --newfile         write to new file
     -q, --quiet           quiet mode, suppress all warnings
     -h, --help            display this help text
    Ohne Datei wandelt unix2dos um, was durch eine Pipe kommt.

### Die Windows-Engine (windows-*.ts): Hinweise des Spiels und die Aufruftexte
### der Windows-Programme (/?), auf Englisch wie auf einem englischsprachigen Windows Server.

# Get-Help für ein Programm statt eines Cmdlets. { $name }: das Programm.
powershell-help-native = { $name } ist ein Programm, kein Cmdlet: Seine Hilfe ist „{ $name } /?“, und das Handbuch des Spiels hat seine Seite (man unter Linux).
# Get-WinEvent ohne Protokoll.
powershell-winevent-which = Nenne ein Protokoll: Get-WinEvent -LogName System, oder -ListLog *, um alle zu sehen.
# net user NAME * (ein an einer Eingabeaufforderung getipptes Passwort: nicht simuliert).
net-password-prompt = Das net user des Spiels fragt nicht nach dem Passwort: Gib es in der Zeile an oder benutze Set-LocalUser mit Read-Host -AsSecureString.
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
# netsh advfirewall firewall add rule ohne seine Pflichtwerte (name=, dir=, action=).
netsh-add-rule-usage =
    Usage: add rule name=<string> dir=in|out action=allow|block|bypass
          {"["}protocol=0-255|icmpv4|tcp|udp|any] [localport=0-65535|any] [remoteip=any|localsubnet|<address>]
          {"["}profile=public|private|domain|any] [enable=yes|no]
    (Die Kurzform der Hilfe von netsh, im Spiel.)
