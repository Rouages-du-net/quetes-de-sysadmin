### Commande git (src/moteur/commandes/git.ts) : messages de git en français,
### tels que le vrai git les affiche avec LANG=fr (traduction officielle de
### git), plus quelques remarques du jeu. Les identifiants techniques (main,
### HEAD, .git, les options) ne se traduisent pas.
### { $chemin } : chemin d'un dossier ; { $fichier } : nom d'un fichier.

## Messages de git

git-pas-de-depot = fatal: ni ceci ni aucun de ses répertoires parents n'est un dépôt git : .git
git-init-existant = Dépôt Git existant réinitialisé dans { $chemin }/.git/
git-init-vide = Dépôt Git vide initialisé dans { $chemin }/.git/
git-ecriture-permission = error: impossible d'ouvrir '{ $fichier }' : Permission non accordée
git-chemin-inconnu = fatal: le chemin '{ $fichier }' ne correspond à aucun fichier
git-rien-a-valider =
    Sur la branche main
    rien à valider (utilisez "git add" pour indiquer ce qu’il faut valider)
git-aucun-commit-branche = fatal: votre branche actuelle 'main' ne contient encore aucun commit
# { $revision } : ce que la personne a tapé (HEAD~9, un identifiant…)
git-revision-ambigue = fatal: argument '{ $revision }' ambigu : révision inconnue ou chemin inexistant.
git-restore-sans-chemin = fatal: vous devez spécifier un ou plusieurs chemins à restaurer
git-reference-invalide = fatal: référence invalide : { $revision }
git-restore-inconnu = error: la spécification de chemin '{ $fichier }' ne correspond à aucun fichier connu de git

## git status (les libellés des fichiers sont alignés sur la même colonne)

git-status-branche = Sur la branche main
git-status-aucun-commit = Aucun commit
git-status-supprime = supprimé :        { $fichier }
git-status-nouveau = nouveau fichier : { $fichier }
git-status-modifie = modifié :         { $fichier }
git-status-indexes =
    Modifications qui seront validées :
      (utilisez "git restore --staged <fichier>..." pour désindexer)
git-status-non-indexes =
    Modifications qui ne seront pas validées :
      (utilisez "git add <fichier>..." pour mettre à jour ce qui sera validé)
      (utilisez "git restore <fichier>..." pour annuler les modifications dans le répertoire de travail)
git-status-non-suivis =
    Fichiers non suivis :
      (utilisez "git add <fichier>..." pour inclure dans ce qui sera validé)
git-status-propre = rien à valider, la copie de travail est propre
git-status-seulement-non-suivis = aucune modification ajoutée à la validation mais des fichiers non suivis sont présents (utilisez "git add" pour les suivre)
git-status-rien-ajoute = aucune modification n'a été ajoutée à la validation (utilisez "git add")

## git commit

# Première ligne du résumé d'un commit : { $id } (7 caractères), { $message }
git-commit-entete = [main { $id }] { $message }
git-commit-entete-racine = [main (commit racine) { $id }] { $message }
# Bilan : « 1 fichier modifié, 3 insertions(+), 3 suppressions(-) »
git-commit-fichiers =
    { $nombre ->
        [one] { $nombre } fichier modifié
       *[other] { $nombre } fichiers modifiés
    }
git-commit-insertions =
    { $nombre ->
        [one] { $nombre } insertion(+)
       *[other] { $nombre } insertions(+)
    }
git-commit-suppressions =
    { $nombre ->
        [one] { $nombre } suppression(-)
       *[other] { $nombre } suppressions(-)
    }

## Remarques du jeu (là où le vrai git se comporte autrement)

git-add-rien =
    Rien de spécifié, rien n'a été ajouté.
    (par exemple : git add roman.txt, ou git add . pour tout)
git-commit-sans-message =
    Écrire le message avec -m, entre guillemets : git commit -m "Ce que j’ai changé"
    (le vrai git ouvrirait un éditeur de texte)
git-checkout-usage =
    Dans ce jeu, git checkout sert à restaurer un fichier : git checkout ID -- fichier
    (on préfère aujourd’hui : git restore --source=ID fichier)
git-usage =
    usage : git <commande> [<args>]
    (voir man git)
# { $commandes } : les sous-commandes du jeu, séparées par des virgules
git-sous-commande-inconnue = git : '{ $commande }' n'est pas une commande git (dans ce jeu : { $commandes }).
