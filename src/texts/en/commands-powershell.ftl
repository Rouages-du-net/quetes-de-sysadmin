### Windows (Next Door Windows): what the game adds to the PowerShell
### session, and the usage of dos2unix. PowerShell's outputs and errors
### stay in English, like an English-language Windows Server.

# A cmdlet that changes something (Remove-Item, Restart-Service…). { $command }: its name.
powershell-read-only = { $command }: the game's PowerShell only reads (this Windows server is someone else's to change). Look, then write down what you found.
# Where-Object with a script block the game doesn't read.
powershell-filter-simple = The game's Where-Object reads one comparison on $_: {"{"} $_.Length -gt 1GB {"}"}, or Where-Object Length -gt 1GB.
# Get-Help's headings (PowerShell's help layout).
powershell-help-name = NAME
powershell-help-synopsis = SYNOPSIS
powershell-help-syntax = SYNTAX
powershell-help-description = DESCRIPTION
powershell-help-parameters = PARAMETERS
powershell-help-related = RELATED LINKS
powershell-help-remarks = REMARKS
# { $number }: the example's number.
powershell-help-example = EXAMPLE { $number }
# { $name }: the cmdlet.
powershell-help-remarks-text =
    To see the examples, type: "get-help { $name } -examples".
    For more information, type: "get-help { $name } -detailed".
    For technical information, type: "get-help { $name } -full".
# Get-Help without a name.
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
    Without a file, dos2unix converts what comes through a pipe.
unix2dos-usage =
    Usage: unix2dos [options] [file ...] [-n infile outfile ...]
     -i, --info            display file information (DOS, Unix and Mac line breaks)
     -k, --keepdate        keep output file date
     -n, --newfile         write to new file
     -q, --quiet           quiet mode, suppress all warnings
     -h, --help            display this help text
    Without a file, unix2dos converts what comes through a pipe.
