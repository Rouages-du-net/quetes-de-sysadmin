### Story "The Time Machine", single chapter
### (src/engine/chapters/manuscript.ts): Inès, a novelist, damaged her
### manuscript; we repair it with git. The novel, its versions, the commit
### messages and the poems are story texts: they are translated
### (the commit identifiers then change with the language).

chapter-manuscript = The Time Machine
    .summary = Travel through the versions of a text with git: log, diff, restore, add, commit, init.

# Author of the commits (git log): name and address, in git's format
manuscript-author = Inès Haddad <ines@example.org>

## Inès's novel (novel.txt), chapter by chapter

manuscript-novel-chapter-1 =
    CHAPTER 1 — THE DEPARTURE

    The night coach left Marseille at ten o'clock.
    Yasmina held her grandmother's letter close.
    "Go and see the lighthouse," Grandma Zohra had written. "It's all there."
manuscript-novel-chapter-2 =
    CHAPTER 2 — THE CROSSING

    The boat to the island left at dawn.
    On deck, an old sailor was mending a net, humming to himself.
    He knew the lighthouse: "Nobody has gone up there since 1962."
manuscript-novel-chapter-3 =
    CHAPTER 3 — THE LIGHTHOUSE

    The door gave way at the third shove of her shoulder.
    At the very top, under the lantern, an iron box was waiting.
    Inside: notebooks, covered in Zohra's tight handwriting.
# Chapter 3 after the cat walked on the keyboard: keep the title,
# translate only the title; the lines of letters stay as they are.
manuscript-novel-chapter-3-abime =
    CHAPTER 3 — THE LIGHTHOUSE

    jjjjjjjjjjjjjjjjjjjjjjkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk;;;;;;;;;;;;;
    mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm

## Inès's commit messages (git log)

manuscript-commit-1 = Chapter 1: the departure
manuscript-commit-2 = Chapter 2: the crossing
manuscript-commit-3 = Chapter 3: the lighthouse
manuscript-commit-4 = Morning backup

## The poems (poems directory)

manuscript-poem-sea =
    The sea stitches up
    the edges of the world
    with a thread of foam.
manuscript-poem-lighthouse =
    An eye that turns
    in the sailors' night:
    it never sleeps.
manuscript-poem-zohra =
    My grandmother spoke
    three and a half languages,
    the half was silence.

## Files

manuscript-message-ines =
    A message from Inès, your novelist friend:

    "Disaster! This morning my cat walked across the keyboard while my
    novel was open… and I saved without looking. Chapter 3 is now
    nothing but a mush of letters. And worse: I made a commit right after!

    Luckily, my novel directory is tracked by git, a time machine
    for files: each "commit" is a snapshot of all the
    files, with a message and a date. Can you help me get my
    chapter back? Start by taking a look:

      cd novel
      cat novel.txt
      git log

    And while you're at it… my poems, in the poems directory, aren't tracked
    by anything at all. If my cat does it again, I lose everything."
manuscript-help-git =
    GIT CHEAT SHEET (see also:  man git)

      git log --oneline          the history, one commit per line (most recent at the top)
      git show ID                what a commit changed
      git diff ID novel.txt      the differences between this commit and the current file
                                 (- : the line before, + : the line now)
      git restore --source=ID novel.txt
                                 puts novel.txt back as it was in this commit
      git status                 what has changed since the last commit
      git add novel.txt          stages the file for the next commit
      git commit -m "message"    takes the snapshot, with a message

    A commit is referred to by the start of its identifier (7 characters are enough),
    or by HEAD (the latest), HEAD~1 (the one before), HEAD~2…

    To start tracking a directory:  git init , then  git add .  (the dot =
    the whole directory) and  git commit -m "…"

## Events

manuscript-event-history =
    Four commits, from most recent to oldest. The last one, "Morning
    backup", is the cat's. The one before, "Chapter 3: the lighthouse", dates
    from before the disaster. To see what the cat changed: git show HEAD
manuscript-event-restored =
    Chapter 3 is back! The file has travelled through time.
    But for now, only your working copy is repaired: the last
    commit still contains the mush. Look at git status , then save
    the repaired version:

      git add novel.txt
      git commit -m "Restore chapter 3 (thanks, cat)"
manuscript-event-saved =
    Commit saved. Notice: nothing was erased from history. The cat's
    commit is still there (git log); we simply added a new,
    repaired snapshot on top. With git, you almost never lose anything.

    There are still Inès's poems: turn the poems directory into a repository
    (git init), then take a first snapshot of all the poems.
manuscript-event-poems = The three poems are now in a commit: even if the cat comes back, they're safe in the history.
manuscript-event-end =
    Inès replies: "My chapter! My poems! You're a wizard, a
    sorceress, well… a wonderful person."

    END OF THE STORY "THE TIME MACHINE".

    You now know how to read a directory's history (git log, git show), see
    the differences (git diff), go back to a version (git restore) and take
    new snapshots (git add, git commit). git was created in 2005 by
    Linus Torvalds to develop the Linux kernel. It's also used for
    books, theses, websites… like the one you're reading.
