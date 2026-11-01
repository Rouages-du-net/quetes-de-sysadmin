### The nano editor: status-line messages and interface labels, close
### to GNU nano's English messages. { $path }: full path of the file;
### { $lines }: number of lines.

nano-usage = Usage: nano file (e.g. nano notes.txt; see man nano)
nano-directory = "{ $path }" is a directory
nano-new = [ New File ]
nano-lines-read =
    {"["} { $lines ->
        [one] Read { $lines } line
       *[other] Read { $lines } lines
    } ]
nano-lines-written =
    {"["} { $lines ->
        [one] Wrote { $lines } line
       *[other] Wrote { $lines } lines
    } ]
nano-read-only = [ File '{ $path }' is unwritable ]
nano-error-read = [ Error reading { $path }: Permission denied ]
nano-error-write = [ Error writing { $path }: Permission denied ]
nano-error-directory = [ Error writing { $path }: No such file or directory ]
nano-binary = [ { $path } is a binary file ]

## Editor interface

nano-modified = Modified
# The shortcuts: ^O = Ctrl+O, ^X = Ctrl+X, ^C = Ctrl+C
nano-write = Write Out
nano-quit = Exit
nano-save = Save modified buffer?
nano-yes = Yes
nano-not = No
nano-cancel = Cancel
nano-zone = Contents of { $path }
