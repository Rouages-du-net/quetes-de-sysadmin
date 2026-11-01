### L'éditeur nano : messages de la ligne d'état et libellés de l'interface,
### proches de la traduction française de GNU nano. { $chemin } : chemin
### complet du fichier ; { $lignes } : nombre de lignes.

nano-usage = Usage : nano fichier (ex. : nano notes.txt ; voir man nano)
nano-dossier = « { $chemin } » est un répertoire
nano-nouveau = [ Nouveau fichier ]
nano-lignes-lues =
    {"["} { $lignes ->
        [one] { $lignes } ligne lue
       *[other] { $lignes } lignes lues
    } ]
nano-lignes-ecrites =
    {"["} { $lignes ->
        [one] { $lignes } ligne écrite
       *[other] { $lignes } lignes écrites
    } ]
nano-lecture-seule = [ Le fichier « { $chemin } » est protégé en écriture ]
nano-erreur-lecture = [ Erreur de lecture de { $chemin } : Permission non accordée ]
nano-erreur-ecriture = [ Erreur d'écriture de { $chemin } : Permission non accordée ]
nano-erreur-dossier = [ Erreur d'écriture de { $chemin } : Aucun fichier ou dossier de ce nom ]
nano-binaire = [ { $chemin } est un fichier binaire ]

## Interface de l'éditeur

nano-modifie = Modifié
# Les raccourcis : ^O = Ctrl+O, ^X = Ctrl+X, ^C = Ctrl+C
nano-ecrire = Écrire
nano-quitter = Quitter
nano-sauver = Sauver le tampon modifié ?
nano-oui = Oui
nano-non = Non
nano-annuler = Annuler
nano-zone = Contenu de { $chemin }
