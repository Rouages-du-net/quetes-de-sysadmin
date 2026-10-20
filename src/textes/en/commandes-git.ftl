### The git command (src/moteur/commandes/git.ts): git's messages as
### the real git prints them with LANG=C, plus a few remarks from the
### game. Technical identifiers (main, HEAD, .git, options) are not
### translated.
### { $chemin }: path of a directory; { $fichier }: name of a file.

## git's messages

git-pas-de-depot = fatal: not a git repository (or any of the parent directories): .git
git-init-existant = Reinitialized existing Git repository in { $chemin }/.git/
git-init-vide = Initialized empty Git repository in { $chemin }/.git/
git-ecriture-permission = error: unable to create file { $fichier }: Permission denied
git-chemin-inconnu = fatal: pathspec '{ $fichier }' did not match any files
git-rien-a-valider =
    On branch main
    nothing to commit (create/copy files and use "git add" to track)
git-aucun-commit-branche = fatal: your current branch 'main' does not have any commits yet
# { $revision }: what the person typed (HEAD~9, an identifier…)
git-revision-ambigue = fatal: ambiguous argument '{ $revision }': unknown revision or path not in the working tree.
git-restore-sans-chemin = fatal: you must specify path(s) to restore
git-reference-invalide = fatal: invalid reference: { $revision }
git-restore-inconnu = error: pathspec '{ $fichier }' did not match any file(s) known to git

git-pas-d-arbre = fatal: this operation must be run in a work tree
# { $option }: the unknown option
git-option-inconnue =
    unknown option: { $option }
    usage: git [--version] [--help] [--git-dir=<path>] [--work-tree=<path>] <command> [<args>]

## Bare repositories, remotes, push and pull (https://git-scm.com/book/en/v2/Git-on-the-Server-Setting-Up-the-Server)

git-init-existant-nu = Reinitialized existing Git repository in { $chemin }/
git-init-vide-nu = Initialized empty Git repository in { $chemin }/
git-init-impossible = fatal: cannot mkdir { $chemin }: Permission denied
git-work-tree-introuvable = fatal: cannot chdir to '{ $chemin }'
# { $fichiers }: one file per line, preceded by a tab
git-checkout-non-suivis =
    error: The following untracked working tree files would be overwritten by checkout:
    { $fichiers }
    Please move or remove them before you switch branches.
    Aborting
git-checkout-modifications-locales =
    error: Your local changes to the following files would be overwritten by checkout:
    { $fichiers }
    Please commit your changes or stash them before you switch branches.
    Aborting
git-rm-usage = fatal: No pathspec was given. Which files should I remove?
git-clone-usage = fatal: You must specify a repository to clone.
# { $depot }: the path or name of the remote repository
git-distant-introuvable =
    fatal: '{ $depot }' does not appear to be a git repository
    fatal: Could not read from remote repository.

    Please make sure you have the correct access rights
    and the repository exists.
git-clone-existe = fatal: destination path '{ $chemin }' already exists and is not an empty directory.
git-clone-dans = Cloning into '{ $chemin }'...
git-fait = done.
git-clone-vide = warning: You appear to have cloned an empty repository.
git-remote-usage =
    usage: git remote [-v | --verbose]
       or: git remote add <name> <url>
       or: git remote remove <name>
       or: git remote set-url <name> <newurl>
# { $nom }: the name of the remote (origin, prod…)
git-remote-existe = error: remote { $nom } already exists.
git-remote-inconnu = error: No such remote: '{ $nom }'
git-push-sans-destination =
    fatal: No configured push destination.
    Either specify the URL from the command-line or configure a remote repository using

        git remote add <name> <url>

    and then push using the remote name

        git push <name>
git-vers = To { $depot }
git-push-impossible = error: failed to push some refs to '{ $depot }'
# { $ref }: the requested branch
git-refspec-inconnue = error: src refspec { $ref } does not match any
git-tout-a-jour = Everything up-to-date
git-push-rejete-astuce =
    hint: Updates were rejected because the remote contains work that you do
    hint: not have locally. This is usually caused by another repository pushing
    hint: to the same ref. You may want to first integrate the remote changes
    hint: (e.g., 'git pull ...') before pushing again.
# { $objets }, { $octets }: numbers, already formatted
git-push-progression =
    Enumerating objects: { $objets }, done.
    Counting objects: 100% ({ $objets }/{ $objets }), done.
    Delta compression using up to 2 threads
    Compressing objects: 100% ({ $objets }/{ $objets }), done.
    Writing objects: 100% ({ $objets }/{ $objets }), { $octets } bytes | { $octets }.00 KiB/s, done.
    Total { $objets } (delta 0), reused 0 (delta 0), pack-reused 0
git-push-droits =
    error: insufficient permission for adding an object to repository database ./objects
    fatal: failed to write object
    error: unpack-objects abnormal exit
git-push-branche-extraite =
    remote: error: refusing to update checked out branch: refs/heads/main
    remote: error: By default, updating the current branch in a non-bare repository
    remote: error: is denied, because it will make the index and work tree inconsistent
    remote: error: with what you pushed, and will require 'git reset --hard' to match
    remote: error: the work tree to HEAD.
# { $crochet }: the path of the hook
git-crochet-ignore =
    hint: The '{ $crochet }' hook was ignored because it's not set as executable.
    hint: You can disable this warning with `git config advice.ignoredHook false`.
# { $distant }: the name of the remote
git-push-suivi = branch 'main' set up to track '{ $distant }/main'.
git-pull-sans-distant =
    There is no tracking information for the current branch.
    Please specify which branch you want to merge with.

        git pull <remote> <branch>
git-depuis = From { $depot }
git-deja-a-jour = Already up to date.
git-pull-diverge = fatal: Not possible to fast-forward, aborting.
# { $avant }, { $apres }: commit identifiers (7 characters)
git-mise-a-jour = Updating { $avant }..{ $apres }
git-avance-rapide = Fast-forward

## git status (the file labels are aligned on the same column)

git-status-branche = On branch main
git-status-aucun-commit = No commits yet
git-status-supprime = deleted:    { $fichier }
git-status-nouveau = new file:   { $fichier }
git-status-modifie = modified:   { $fichier }
git-status-indexes =
    Changes to be committed:
      (use "git restore --staged <file>..." to unstage)
git-status-non-indexes =
    Changes not staged for commit:
      (use "git add <file>..." to update what will be committed)
      (use "git restore <file>..." to discard changes in working directory)
git-status-non-suivis =
    Untracked files:
      (use "git add <file>..." to include in what will be committed)
git-status-propre = nothing to commit, working tree clean
git-status-seulement-non-suivis = nothing added to commit but untracked files present (use "git add" to track)
git-status-rien-ajoute = no changes added to commit (use "git add" and/or "git commit -a")

## git commit

# First line of a commit summary: { $id } (7 characters), { $message }
git-commit-entete = [main { $id }] { $message }
git-commit-entete-racine = [main (root-commit) { $id }] { $message }
# Summary: "1 file changed, 3 insertions(+), 3 deletions(-)"
git-commit-fichiers =
    { $nombre ->
        [one] { $nombre } file changed
       *[other] { $nombre } files changed
    }
git-commit-insertions =
    { $nombre ->
        [one] { $nombre } insertion(+)
       *[other] { $nombre } insertions(+)
    }
git-commit-suppressions =
    { $nombre ->
        [one] { $nombre } deletion(-)
       *[other] { $nombre } deletions(-)
    }

## Game remarks (where the real git behaves differently)

git-add-rien =
    Nothing specified, nothing added.
    (for example: git add roman.txt, or git add . for everything)
git-commit-sans-message =
    Write the message with -m, in quotes: git commit -m "What I changed"
    (the real git would open a text editor)
git-checkout-usage =
    In this game, git checkout is used to restore a file: git checkout ID -- file
    (nowadays, prefer: git restore --source=ID file),
    or to extract the files of a repository into a place: git --work-tree=place checkout -f main
git-usage =
    usage: git <command> [<args>]
    (see man git)
# { $commandes }: the game's subcommands, separated by commas
git-sous-commande-inconnue = git: '{ $commande }' is not a git command (in this game: { $commandes }).
