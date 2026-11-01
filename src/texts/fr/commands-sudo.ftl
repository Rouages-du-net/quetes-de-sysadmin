### sudo -l et visudo : la traduction française de sudo
### (plugins/sudoers/po/fr.po). { $file }, { $account } et { $host } sont
### des identifiants techniques.

visudo-usage = usage : visudo [-chqsV] [[-f] sudoers ]
visudo-permission = visudo : ouverture de { $file } impossible : Permission non accordée
visudo-missing = visudo : ouverture de { $file } impossible : Aucun fichier ou dossier de ce type
visudo-analysis-succeeded = { $file } : analyse réussie
visudo-and-now = Et maintenant ?
visudo-options =
    Les options sont :
      (e)dition du fichier sudoers (de nouveau)
      e(x)it sans sauvegarde des modifications apportées au fichier sudoers
      (Q)uitter et sauvegarder les modifications apportées au fichier sudoers (DANGER!)
sudoers-error-syntax = erreur de syntaxe
sudoers-error-path = nom de chemin totalement défini attendu
sudo-sources-invalid = sudo: aucune source sudoers valide n'a été trouvée, fin d'exécution
# { $defaults } : les options Defaults ; { $rules } : une règle par ligne, déjà en retrait
sudo =
    Entrées Defaults correspondant pour { $account } sur { $host } :
        { $defaults }

    L'utilisateur { $account } peut utiliser les commandes suivantes sur { $host } :
    { $rules }
sudo-none = L'utilisateur { $account } n'est pas autorisé à exécuter sudo sur { $host }.
