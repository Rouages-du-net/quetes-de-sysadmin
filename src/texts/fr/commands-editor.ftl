### L'éditeur nano : messages de la ligne d'état et libellés de l'interface,
### proches de la traduction française de GNU nano. { $path } : chemin
### complet du fichier ; { $lines } : nombre de lignes.

nano-usage = Usage : nano fichier (ex. : nano notes.txt ; voir man nano)
nano-directory = « { $path } » est un répertoire
nano-new = [ Nouveau fichier ]
nano-lines-read =
    {"["} { $lines ->
        [one] { $lines } ligne lue
       *[other] { $lines } lignes lues
    } ]
nano-lines-written =
    {"["} { $lines ->
        [one] { $lines } ligne écrite
       *[other] { $lines } lignes écrites
    } ]
nano-read-only = [ Le fichier « { $path } » est protégé en écriture ]
nano-error-read = [ Erreur de lecture de { $path } : Permission non accordée ]
nano-error-write = [ Erreur d'écriture de { $path } : Permission non accordée ]
nano-error-directory = [ Erreur d'écriture de { $path } : Aucun fichier ou dossier de ce nom ]
nano-binary = [ { $path } est un fichier binaire ]

## Interface de l'éditeur

nano-modified = Modifié
# Les raccourcis : ^O = Ctrl+O, ^X = Ctrl+X, ^C = Ctrl+C
nano-write = Écrire
nano-quit = Quitter
nano-save = Sauver le tampon modifié ?
nano-yes = Oui
nano-not = Non
nano-cancel = Annuler
nano-zone = Contenu de { $path }
