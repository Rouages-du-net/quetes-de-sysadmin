### The git command (src/engine/commands/git.ts): git's messages as
### the real git prints them with LANG=C, plus a few remarks from the
### game. Technical identifiers (main, HEAD, .git, options) are not
### translated.
### { $path }: path of a directory; { $file }: name of a file.

## git's messages

git-not-repo = fatal: not a git repository (or any of the parent directories): .git
git-init-existing = Reinitialized existing Git repository in { $path }/.git/
git-init-empty = Initialized empty Git repository in { $path }/.git/
git-write-permission = error: unable to create file { $file }: Permission denied
git-path-unknown = fatal: pathspec '{ $file }' did not match any files
git-nothing-a-validate =
    On branch main
    nothing to commit (create/copy files and use "git add" to track)
git-none-commit-branch = fatal: your current branch 'main' does not have any commits yet
# { $revision }: what the person typed (HEAD~9, an identifier…)
git-revision-ambiguous = fatal: ambiguous argument '{ $revision }': unknown revision or path not in the working tree.
git-restore-without-path = fatal: you must specify path(s) to restore
git-reference-invalid = fatal: invalid reference: { $revision }
git-restore-unknown = error: pathspec '{ $file }' did not match any file(s) known to git

git-not-tree = fatal: this operation must be run in a work tree
# { $option }: the unknown option
git-option-unknown =
    unknown option: { $option }
    usage: git [--version] [--help] [--git-dir=<path>] [--work-tree=<path>] <command> [<args>]

## Bare repositories, remotes, push and pull (https://git-scm.com/book/en/v2/Git-on-the-Server-Setting-Up-the-Server)

git-init-existing-bare = Reinitialized existing Git repository in { $path }/
git-init-empty-bare = Initialized empty Git repository in { $path }/
git-init-impossible = fatal: cannot mkdir { $path }: Permission denied
git-work-tree-missing = fatal: cannot chdir to '{ $path }'
# { $files }: one file per line, preceded by a tab
git-checkout-not-tracked =
    error: The following untracked working tree files would be overwritten by checkout:
    { $files }
    Please move or remove them before you switch branches.
    Aborting
git-checkout-changes-local =
    error: Your local changes to the following files would be overwritten by checkout:
    { $files }
    Please commit your changes or stash them before you switch branches.
    Aborting
git-rm-usage = fatal: No pathspec was given. Which files should I remove?
git-clone-usage = fatal: You must specify a repository to clone.
# { $repository }: the path or name of the remote repository
git-remote-missing =
    fatal: '{ $repository }' does not appear to be a git repository
    fatal: Could not read from remote repository.

    Please make sure you have the correct access rights
    and the repository exists.
git-clone-exists = fatal: destination path '{ $path }' already exists and is not an empty directory.
git-clone-in = Cloning into '{ $path }'...
git-done = done.
git-clone-empty = warning: You appear to have cloned an empty repository.
git-remote-usage =
    usage: git remote [-v | --verbose]
       or: git remote add <name> <url>
       or: git remote remove <name>
       or: git remote set-url <name> <newurl>
# { $name }: the name of the remote (origin, prod…)
git-remote-exists = error: remote { $name } already exists.
git-remote-unknown = error: No such remote: '{ $name }'
git-push-without-destination =
    fatal: No configured push destination.
    Either specify the URL from the command-line or configure a remote repository using

        git remote add <name> <url>

    and then push using the remote name

        git push <name>
git-to = To { $repository }
git-push-impossible = error: failed to push some refs to '{ $repository }'
# { $ref }: the requested branch
git-refspec-unknown = error: src refspec { $ref } does not match any
git-all-a-day = Everything up-to-date
git-push-rejected-tip =
    hint: Updates were rejected because the remote contains work that you do
    hint: not have locally. This is usually caused by another repository pushing
    hint: to the same ref. You may want to first integrate the remote changes
    hint: (e.g., 'git pull ...') before pushing again.
# { $objects }, { $bytes }: numbers, already formatted
git-push-progress =
    Enumerating objects: { $objects }, done.
    Counting objects: 100% ({ $objects }/{ $objects }), done.
    Delta compression using up to 2 threads
    Compressing objects: 100% ({ $objects }/{ $objects }), done.
    Writing objects: 100% ({ $objects }/{ $objects }), { $bytes } bytes | { $bytes }.00 KiB/s, done.
    Total { $objects } (delta 0), reused 0 (delta 0), pack-reused 0
git-push-rights =
    error: insufficient permission for adding an object to repository database ./objects
    fatal: failed to write object
    error: unpack-objects abnormal exit
git-push-branch-extracted =
    remote: error: refusing to update checked out branch: refs/heads/main
    remote: error: By default, updating the current branch in a non-bare repository
    remote: error: is denied, because it will make the index and work tree inconsistent
    remote: error: with what you pushed, and will require 'git reset --hard' to match
    remote: error: the work tree to HEAD.
# { $hook }: the path of the hook
git-hook-ignore =
    hint: The '{ $hook }' hook was ignored because it's not set as executable.
    hint: You can disable this warning with `git config advice.ignoredHook false`.
# { $remote }: the name of the remote
git-push-follow = branch 'main' set up to track '{ $remote }/main'.
git-pull-without-remote =
    There is no tracking information for the current branch.
    Please specify which branch you want to merge with.

        git pull <remote> <branch>
git-since = From { $repository }
git-already-a-day = Already up to date.
git-pull-diverge = fatal: Not possible to fast-forward, aborting.
# { $before }, { $after }: commit identifiers (7 characters)
git-update = Updating { $before }..{ $after }
git-advance-fast = Fast-forward

## git status (the file labels are aligned on the same column)

git-status-branch = On branch main
git-status-none-commit = No commits yet
git-status-deleted = deleted:    { $file }
git-status-new = new file:   { $file }
git-status-modified = modified:   { $file }
git-status-indexes =
    Changes to be committed:
      (use "git restore --staged <file>..." to unstage)
git-status-not-indexes =
    Changes not staged for commit:
      (use "git add <file>..." to update what will be committed)
      (use "git restore <file>..." to discard changes in working directory)
git-status-not-tracked =
    Untracked files:
      (use "git add <file>..." to include in what will be committed)
git-status-own = nothing to commit, working tree clean
git-status-only-not-tracked = nothing added to commit but untracked files present (use "git add" to track)
git-status-nothing-added = no changes added to commit (use "git add" and/or "git commit -a")

## git commit

# First line of a commit summary: { $id } (7 characters), { $message }
git-commit-header = [main { $id }] { $message }
git-commit-header-root = [main (root-commit) { $id }] { $message }
# Summary: "1 file changed, 3 insertions(+), 3 deletions(-)"
git-commit-files =
    { $count ->
        [one] { $count } file changed
       *[other] { $count } files changed
    }
git-commit-insertions =
    { $count ->
        [one] { $count } insertion(+)
       *[other] { $count } insertions(+)
    }
git-commit-deletions =
    { $count ->
        [one] { $count } deletion(-)
       *[other] { $count } deletions(-)
    }

## Game remarks (where the real git behaves differently)

git-add-nothing =
    Nothing specified, nothing added.
    (for example: git add novel.txt, or git add . for everything)
git-commit-without-message =
    Write the message with -m, in quotes: git commit -m "What I changed"
    (the real git would open a text editor)
git-checkout-usage =
    In this game, git checkout is used to restore a file: git checkout ID -- file
    (nowadays, prefer: git restore --source=ID file),
    or to extract the files of a repository into a place: git --work-tree=place checkout -f main
git-usage =
    usage: git <command> [<args>]
    (see man git)
# { $commands }: the game's subcommands, separated by commas
git-under-command-unknown = git: '{ $command }' is not a git command (in this game: { $commands }).
