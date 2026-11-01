### Commande git (src/engine/commands/git.ts) : messages de git en français,
### tels que le vrai git les affiche avec LANG=fr (traduction officielle de
### git), plus quelques remarques du jeu. Les identifiants techniques (main,
### HEAD, .git, les options) ne se traduisent pas.
### { $chemin } : chemin d'un dossier ; { $fichier } : nom d'un fichier.

## Messages de git

git-not-repo = fatal: ni ceci ni aucun de ses répertoires parents n'est un dépôt git : .git
git-init-existing = Dépôt Git existant réinitialisé dans { $chemin }/.git/
git-init-empty = Dépôt Git vide initialisé dans { $chemin }/.git/
git-write-permission = error: impossible d'ouvrir '{ $fichier }' : Permission non accordée
git-path-unknown = fatal: le chemin '{ $fichier }' ne correspond à aucun fichier
git-nothing-a-validate =
    Sur la branche main
    rien à valider (utilisez "git add" pour indiquer ce qu’il faut valider)
git-none-commit-branch = fatal: votre branche actuelle 'main' ne contient encore aucun commit
# { $revision } : ce que la personne a tapé (HEAD~9, un identifiant…)
git-revision-ambiguous = fatal: argument '{ $revision }' ambigu : révision inconnue ou chemin inexistant.
git-restore-without-path = fatal: vous devez spécifier un ou plusieurs chemins à restaurer
git-reference-invalid = fatal: référence invalide : { $revision }
git-restore-unknown = error: la spécification de chemin '{ $fichier }' ne correspond à aucun fichier connu de git

git-not-tree = fatal: cette opération doit être effectuée dans un arbre de travail
# { $option } : l'option inconnue
git-option-unknown =
    unknown option: { $option }
    usage: git [--version] [--help] [--git-dir=<chemin>] [--work-tree=<chemin>] <commande> [<args>]

## Dépôts nus, distants, push et pull (https://git-scm.com/book/fr/v2/Git-sur-le-serveur-Mise-en-place-du-serveur)

git-init-existing-bare = Dépôt Git existant réinitialisé dans { $chemin }/
git-init-empty-bare = Dépôt Git vide initialisé dans { $chemin }/
git-init-impossible = fatal: impossible de créer le répertoire '{ $chemin }' : Permission non accordée
git-work-tree-missing = fatal: impossible de se déplacer dans '{ $chemin }'
# { $fichiers } : un fichier par ligne, précédé d'une tabulation
git-checkout-not-tracked =
    error: Les fichiers suivants non suivis de la copie de travail seraient écrasés par l'extraction :
    { $fichiers }
    Veuillez renommer ou déplacer ces fichiers avant de basculer de branche.
    Abandon
git-checkout-changes-local =
    error: Vos modifications locales aux fichiers suivants seraient écrasées par l'extraction :
    { $fichiers }
    Veuillez valider ou remiser vos modifications avant de basculer de branche.
    Abandon
git-rm-usage = fatal: Aucune spécification de chemin fournie. Que faut-il supprimer ?
git-clone-usage = fatal: Vous devez spécifier un dépôt à cloner.
# { $depot } : le chemin ou le nom du dépôt distant
git-remote-missing =
    fatal: '{ $depot }' ne semble pas être un dépôt git
    fatal: Impossible de lire le dépôt distant.

    Veuillez vérifier que vous avez les droits d'accès
    et que le dépôt existe.
git-clone-exists = fatal: le chemin de destination '{ $chemin }' existe déjà et n'est pas un répertoire vide.
git-clone-in = Clonage dans '{ $chemin }'...
git-done = fait.
git-clone-empty = warning: Vous semblez avoir cloné un dépôt vide.
git-remote-usage =
    usage: git remote [-v | --verbose]
       ou : git remote add <nom> <url>
       ou : git remote remove <nom>
       ou : git remote set-url <nom> <nouvelle-url>
# { $nom } : le nom du dépôt distant (origin, prod…)
git-remote-exists = error: le distant { $nom } existe déjà.
git-remote-unknown = error: Pas de serveur remote : '{ $nom }'
git-push-without-destination =
    fatal: Pas de destination pour pousser.
    Spécifiez une URL depuis la ligne de commande ou configurez un dépôt distant en utilisant

        git remote add <nom> <url>

    puis poussez en utilisant le dépôt distant

        git push <nom>
git-to = Vers { $depot }
git-push-impossible = error: impossible de pousser des références vers '{ $depot }'
# { $ref } : la branche demandée
git-refspec-unknown = error: le spécificateur de référence source { $ref } ne correspond à aucune référence
git-all-a-day = Tout est à jour
git-push-rejected-tip =
    astuce: Les mises à jour ont été rejetées car la branche distante contient du travail que
    astuce: vous n'avez pas en local. Ceci est généralement causé par un autre dépôt poussé
    astuce: vers la même référence. Vous pourriez intégrer d'abord les changements distants
    astuce: (par exemple 'git pull ...') avant de pousser à nouveau.
# { $objets }, { $octets } : des nombres, déjà écrits
git-push-progress =
    Énumération des objets: { $objets }, fait.
    Décompte des objets: 100% ({ $objets }/{ $objets }), fait.
    Compression par delta en utilisant jusqu'à 2 fils d'exécution
    Compression des objets: 100% ({ $objets }/{ $objets }), fait.
    Écriture des objets: 100% ({ $objets }/{ $objets }), { $octets } octets | { $octets }.00 Kio/s, fait.
    Total { $objets } (delta 0), réutilisés 0 (delta 0), réutilisés du pack 0
git-push-rights =
    error: droits insuffisants pour ajouter un objet à la base de données ./objects du dépôt
    fatal: échec d'écriture de l'objet
    error: unpack-objects a quitté anormalement
git-push-branch-extracted =
    remote: error: refus de mettre à jour la branche extraite : refs/heads/main
    remote: error: Par défaut, la mise à jour de la branche actuelle dans un dépôt non-nu
    remote: error: est refusée, car cela rendrait l'index et l'arbre de travail incohérents
    remote: error: avec ce que vous avez poussé, et nécessiterait 'git reset --hard' pour
    remote: error: retrouver un arbre de travail cohérent avec HEAD.
# { $crochet } : le chemin du crochet
git-hook-ignore =
    astuce: Le crochet '{ $crochet }' a été ignoré parce qu'il n'est pas marqué comme exécutable.
    astuce: Vous pouvez désactiver cet avertissement avec `git config advice.ignoredHook false`.
# { $distant } : le nom du dépôt distant
git-push-follow = la branche 'main' est paramétrée pour suivre '{ $distant }/main'.
git-pull-without-remote =
    Il n'y a pas d'information de suivi pour la branche actuelle.
    Veuillez spécifier une branche avec laquelle fusionner :

        git pull <distant> <branche>
git-since = Depuis { $depot }
git-already-a-day = Déjà à jour.
git-pull-diverge = fatal: Pas possible d'avancer rapidement, abandon.
# { $avant }, { $apres } : des identifiants de commit (7 caractères)
git-update = Mise à jour { $avant }..{ $apres }
git-advance-fast = Avance rapide

## git status (les libellés des fichiers sont alignés sur la même colonne)

git-status-branch = Sur la branche main
git-status-none-commit = Aucun commit
git-status-deleted = supprimé :        { $fichier }
git-status-new = nouveau fichier : { $fichier }
git-status-modified = modifié :         { $fichier }
git-status-indexes =
    Modifications qui seront validées :
      (utilisez "git restore --staged <fichier>..." pour désindexer)
git-status-not-indexes =
    Modifications qui ne seront pas validées :
      (utilisez "git add <fichier>..." pour mettre à jour ce qui sera validé)
      (utilisez "git restore <fichier>..." pour annuler les modifications dans le répertoire de travail)
git-status-not-tracked =
    Fichiers non suivis :
      (utilisez "git add <fichier>..." pour inclure dans ce qui sera validé)
git-status-own = rien à valider, la copie de travail est propre
git-status-only-not-tracked = aucune modification ajoutée à la validation mais des fichiers non suivis sont présents (utilisez "git add" pour les suivre)
git-status-nothing-added = aucune modification n'a été ajoutée à la validation (utilisez "git add")

## git commit

# Première ligne du résumé d'un commit : { $id } (7 caractères), { $message }
git-commit-header = [main { $id }] { $message }
git-commit-header-root = [main (commit racine) { $id }] { $message }
# Bilan : « 1 fichier modifié, 3 insertions(+), 3 suppressions(-) »
git-commit-files =
    { $nombre ->
        [one] { $nombre } fichier modifié
       *[other] { $nombre } fichiers modifiés
    }
git-commit-insertions =
    { $nombre ->
        [one] { $nombre } insertion(+)
       *[other] { $nombre } insertions(+)
    }
git-commit-deletions =
    { $nombre ->
        [one] { $nombre } suppression(-)
       *[other] { $nombre } suppressions(-)
    }

## Remarques du jeu (là où le vrai git se comporte autrement)

git-add-nothing =
    Rien de spécifié, rien n'a été ajouté.
    (par exemple : git add roman.txt, ou git add . pour tout)
git-commit-without-message =
    Écrire le message avec -m, entre guillemets : git commit -m "Ce que j’ai changé"
    (le vrai git ouvrirait un éditeur de texte)
git-checkout-usage =
    Dans ce jeu, git checkout sert à restaurer un fichier : git checkout ID -- fichier
    (on préfère aujourd’hui : git restore --source=ID fichier),
    ou à extraire les fichiers d'un dépôt dans un lieu : git --work-tree=lieu checkout -f main
git-usage =
    usage : git <commande> [<args>]
    (voir man git)
# { $commandes } : les sous-commandes du jeu, séparées par des virgules
git-under-command-unknown = git : '{ $commande }' n'est pas une commande git (dans ce jeu : { $commandes }).
