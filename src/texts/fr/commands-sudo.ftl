### sudo -l et visudo : la traduction française de sudo
### (plugins/sudoers/po/fr.po). { $fichier }, { $compte } et { $hote } sont
### des identifiants techniques.

visudo-usage = usage : visudo [-chqsV] [[-f] sudoers ]
visudo-permission = visudo : ouverture de { $fichier } impossible : Permission non accordée
visudo-missing = visudo : ouverture de { $fichier } impossible : Aucun fichier ou dossier de ce type
visudo-analysis-succeeded = { $fichier } : analyse réussie
visudo-and-now = Et maintenant ?
visudo-options =
    Les options sont :
      (e)dition du fichier sudoers (de nouveau)
      e(x)it sans sauvegarde des modifications apportées au fichier sudoers
      (Q)uitter et sauvegarder les modifications apportées au fichier sudoers (DANGER!)
sudoers-error-syntax = erreur de syntaxe
sudoers-error-path = nom de chemin totalement défini attendu
sudo-sources-invalid = sudo: aucune source sudoers valide n'a été trouvée, fin d'exécution
# { $defauts } : les options Defaults ; { $regles } : une règle par ligne, déjà en retrait
sudo =
    Entrées Defaults correspondant pour { $compte } sur { $hote } :
        { $defauts }

    L'utilisateur { $compte } peut utiliser les commandes suivantes sur { $hote } :
    { $regles }
sudo-none = L'utilisateur { $compte } n'est pas autorisé à exécuter sudo sur { $hote }.
