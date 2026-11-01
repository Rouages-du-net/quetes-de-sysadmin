### L'éditeur nano : messages de la ligne d'état et libellés de l'interface,
### proches de la traduction française de GNU nano. { $chemin } : chemin
### complet du fichier ; { $lignes } : nombre de lignes.

nano-usage = Usage : nano fichier (ex. : nano notes.txt ; voir man nano)
nano-directory = « { $chemin } » est un répertoire
nano-new = [ Nouveau fichier ]
nano-lines-read =
    {"["} { $lignes ->
        [one] { $lignes } ligne lue
       *[other] { $lignes } lignes lues
    } ]
nano-lines-written =
    {"["} { $lignes ->
        [one] { $lignes } ligne écrite
       *[other] { $lignes } lignes écrites
    } ]
nano-read-only = [ Le fichier « { $chemin } » est protégé en écriture ]
nano-error-read = [ Erreur de lecture de { $chemin } : Permission non accordée ]
nano-error-write = [ Erreur d'écriture de { $chemin } : Permission non accordée ]
nano-error-directory = [ Erreur d'écriture de { $chemin } : Aucun fichier ou dossier de ce nom ]
nano-binary = [ { $chemin } est un fichier binaire ]

## Interface de l'éditeur

nano-modified = Modifié
# Les raccourcis : ^O = Ctrl+O, ^X = Ctrl+X, ^C = Ctrl+C
nano-write = Écrire
nano-quit = Quitter
nano-save = Sauver le tampon modifié ?
nano-yes = Oui
nano-not = Non
nano-cancel = Annuler
nano-zone = Contenu de { $chemin }
