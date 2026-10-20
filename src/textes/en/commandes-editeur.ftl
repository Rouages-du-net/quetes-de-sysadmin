### The nano editor: status-line messages and interface labels, close
### to GNU nano's English messages. { $chemin }: full path of the file;
### { $lignes }: number of lines.

nano-usage = Usage: nano file (e.g. nano notes.txt; see man nano)
nano-dossier = "{ $chemin }" is a directory
nano-nouveau = [ New File ]
nano-lignes-lues =
    {"["} { $lignes ->
        [one] Read { $lignes } line
       *[other] Read { $lignes } lines
    } ]
nano-lignes-ecrites =
    {"["} { $lignes ->
        [one] Wrote { $lignes } line
       *[other] Wrote { $lignes } lines
    } ]
nano-lecture-seule = [ File '{ $chemin }' is unwritable ]
nano-erreur-lecture = [ Error reading { $chemin }: Permission denied ]
nano-erreur-ecriture = [ Error writing { $chemin }: Permission denied ]
nano-erreur-dossier = [ Error writing { $chemin }: No such file or directory ]
nano-binaire = [ { $chemin } is a binary file ]

## Editor interface

nano-modifie = Modified
# The shortcuts: ^O = Ctrl+O, ^X = Ctrl+X, ^C = Ctrl+C
nano-ecrire = Write Out
nano-quitter = Exit
nano-sauver = Save modified buffer?
nano-oui = Yes
nano-non = No
nano-annuler = Cancel
nano-zone = Contents of { $chemin }
