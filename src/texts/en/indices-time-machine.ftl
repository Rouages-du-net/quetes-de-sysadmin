### Graded hints for The Time Machine (see src/engine/hints.ts): one
### message per step, indice-<chapter>-<event>, with .piste (a lead, without
### the exact command) and .solution (almost the answer). Place names as in
### noms.ftl.

## Chapter 1 — The Time Machine

indice-manuscript-historique =
    .piste = The novel directory is tracked by git. Before repairing anything, look at its history: the list of its commits (help_git.txt, man git).
    .solution = cd novel, then git log (or git log --oneline: one commit per line).
indice-manuscript-restaure =
    .piste = The second-to-last commit dates from before the cat walked by. git can put a file back as it was in a given commit (HEAD~1: the commit before the last one).
    .solution = In novel: git restore --source=HEAD~1 novel.txt (git diff HEAD~1 novel.txt shows the damage first).
indice-manuscript-sauve =
    .piste = Only your working copy is repaired: the last commit still holds the gibberish. Stage the file for the next snapshot, then take it.
    .solution = git add novel.txt, then git commit -m "Restore chapter 3"
indice-manuscript-poemes =
    .piste = The poems are not tracked by anything. Turn the poems directory into a git repository, then take a first snapshot of all the poems.
    .solution = cd ../poems, git init, git add . (the dot: the whole directory), then git commit -m "First poems"
indice-manuscript-fin =
    .piste = You need both: the repaired novel in a new commit, and the three poems in a commit of their own repository. git log, in each directory, tells you where you are.
    .solution = In novel: git add novel.txt and git commit -m "…"; in poems: git init, git add . and git commit -m "…"
