### The nano editor: status-line messages and interface labels, close
### to GNU nano's English messages. { $chemin }: full path of the file;
### { $lignes }: number of lines.

nano-usage = Usage: nano file (e.g. nano notes.txt; see man nano)
nano-directory = "{ $chemin }" is a directory
nano-new = [ New File ]
nano-lines-read =
    {"["} { $lignes ->
        [one] Read { $lignes } line
       *[other] Read { $lignes } lines
    } ]
nano-lines-written =
    {"["} { $lignes ->
        [one] Wrote { $lignes } line
       *[other] Wrote { $lignes } lines
    } ]
nano-read-only = [ File '{ $chemin }' is unwritable ]
nano-error-read = [ Error reading { $chemin }: Permission denied ]
nano-error-write = [ Error writing { $chemin }: Permission denied ]
nano-error-directory = [ Error writing { $chemin }: No such file or directory ]
nano-binary = [ { $chemin } is a binary file ]

## Editor interface

nano-modified = Modified
# The shortcuts: ^O = Ctrl+O, ^X = Ctrl+X, ^C = Ctrl+C
nano-write = Write Out
nano-quit = Exit
nano-save = Save modified buffer?
nano-yes = Yes
nano-not = No
nano-cancel = Cancel
nano-zone = Contents of { $chemin }
