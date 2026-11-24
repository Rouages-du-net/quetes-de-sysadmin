### Windows (Windows al Lado): lo que el juego añade a la sesión de
### PowerShell, y el uso de dos2unix. Las salidas y los errores de PowerShell
### se quedan en inglés, como en un Windows Server en inglés.

# Un cmdlet que cambia algo (Remove-Item, Restart-Service…). { $command }: su nombre.
powershell-read-only = { $command }: el PowerShell del juego solo lee (este servidor Windows lo cambia otra persona). Mira y luego anota lo que encuentres.
# Where-Object con un bloque de script que el juego no lee.
powershell-filter-simple = El Where-Object del juego lee una comparación sobre $_: {"{"} $_.Length -gt 1GB {"}"}, o Where-Object Length -gt 1GB.
# Los títulos de Get-Help (la presentación de la ayuda de PowerShell, en inglés).
powershell-help-name = NAME
powershell-help-synopsis = SYNOPSIS
powershell-help-syntax = SYNTAX
powershell-help-description = DESCRIPTION
powershell-help-parameters = PARAMETERS
powershell-help-related = RELATED LINKS
powershell-help-remarks = REMARKS
powershell-help-aliases = ALIASES
# Una función sin ayuda en comentarios (el «None» de Get-Help).
powershell-help-none = None
# Una línea cuyos bucles dieron demasiadas vueltas: el juego la detiene. { $count }: el límite.
powershell-loop-limit = El juego ha detenido esta línea: sus bucles han dado más de { $count } vueltas (¿una condición que nunca se vuelve falsa?). En un Windows real, Ctrl+C detiene un bucle sin fin.
# { $number }: el número del ejemplo.
powershell-help-example = EXAMPLE { $number }
# { $name }: el cmdlet.
powershell-help-remarks-text =
    To see the examples, type: "get-help { $name } -examples".
    For more information, type: "get-help { $name } -detailed".
    For technical information, type: "get-help { $name } -full".
# Get-Help sin nombre (la ayuda de PowerShell, en inglés, con la explicación del juego).
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
    Sin archivo, dos2unix convierte lo que llega por una tubería.
unix2dos-usage =
    Usage: unix2dos [options] [file ...] [-n infile outfile ...]
     -i, --info            display file information (DOS, Unix and Mac line breaks)
     -k, --keepdate        keep output file date
     -n, --newfile         write to new file
     -q, --quiet           quiet mode, suppress all warnings
     -h, --help            display this help text
    Sin archivo, unix2dos convierte lo que llega por una tubería.

### El motor Windows (windows-*.ts): notas del juego, y los textos de uso de
### los programas de Windows (/?), en inglés como en un Windows Server en inglés.

# Get-Help sobre un programa en lugar de un cmdlet. { $name }: el programa.
powershell-help-native = { $name } es un programa, no un cmdlet: su ayuda es «{ $name } /?», y el manual del juego tiene su página (man en Linux).
# Get-WinEvent sin registro.
powershell-winevent-which = Indica un registro: Get-WinEvent -LogName System, o -ListLog * para verlos todos.
# net user NOMBRE * (una contraseña escrita en una pregunta: no se simula).
net-password-prompt = El net user del juego no pide la contraseña: dala en la línea, o usa Set-LocalUser con Read-Host -AsSecureString.
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
# netsh advfirewall firewall add rule sin sus valores obligatorios (name=, dir=, action=).
netsh-add-rule-usage =
    Usage: add rule name=<string> dir=in|out action=allow|block|bypass
          {"["}protocol=0-255|icmpv4|tcp|udp|any] [localport=0-65535|any] [remoteip=any|localsubnet|<address>]
          {"["}profile=public|private|domain|any] [enable=yes|no]
    (La forma corta de la ayuda de netsh, en el juego.)
