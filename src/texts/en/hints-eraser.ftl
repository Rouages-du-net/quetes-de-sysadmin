### Graded hints for The Eraser (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Place names as in names.ftl.

## Chapter 1 — Lighthouse Island

hint-lighthouse-crab =
    .lead = The exercise in the PracticeRoom (at the SignalSchool, on the Hill) asks you to put the crab away. Putting away is moving: which command moves an object into a place?
    .solution = From the PracticeRoom: mv crab Bucket (then ls Bucket to check).
hint-lighthouse-net =
    .lead = The net blocks the Lighthouse door, at the end of the Pier. Just move it somewhere else, to a place that can store it.
    .solution = From your home: mv Pier/net Harbour/Boathouse
hint-lighthouse-light =
    .lead = The Lantern, at the top of the Lighthouse, needs a bulb. A spare bulb exists, but it is hidden: ls -a shows files whose name starts with a dot. And mv can also rename.
    .solution = From your home: mv Harbour/Storeroom/.spare_bulb Pier/Lighthouse/Stairs/Lantern/bulb

## Chapter 2 — The Village

hint-village-sourdough =
    .lead = The baker wants three sourdoughs, without losing the original. A copy is a new, identical object.
    .solution = In the Bakery: cp sourdough sourdough_2 then cp sourdough sourdough_3
hint-village-gear =
    .lead = The maker in the Workshop needs gears, and there are none. touch creates an empty file.
    .solution = In the Workshop: touch gear
hint-village-gears =
    .lead = Five in all to get the clock going again: one original and copies.
    .solution = In the Workshop: cp gear gear_2, then _3, _4 and _5.
hint-village-barricade =
    .lead = A barricade blocks the Yard, in the Alley. Too heavy for mv. What is left, for an object nobody needs any more?
    .solution = In the Alley: rm barricade (careful, rm goes through no bin: it is gone for good).
hint-village-rats =
    .lead = The rats in the Sewer guard the Tunnel. What they like is sold at the Market. The Market's cheese cannot be deleted, but it can be copied.
    .solution = In the Sewer (Alley/Yard/Sewer): cp ~/Market/cheese .
hint-village-nour-without-class =
    .lead = Nour is at the end of the Tunnel, behind the rats. Read what she has to say.
    .solution = cat ~/Alley/Yard/Sewer/Tunnel/nour.txt
hint-village-class =
    .lead = The Eraser erased the School's Classroom. A place is a directory: which command creates a directory?
    .solution = mkdir ~/School/Classroom
hint-village-nour =
    .lead = Is the Classroom there? Go back to Nour: she is waiting to go home.
    .solution = cat ~/Alley/Yard/Sewer/Tunnel/nour.txt

## Chapter 3 — The Root

hint-root-alert =
    .lead = Start by reading the arrival file, in your home.
    .solution = cat arrival.txt
hint-root-protected =
    .lead = The Eraser erases your memories because it may write in that directory. ls -l shows the permissions: r, w and x, for you, your group and others.
    .solution = chmod o-w memories (others can no longer write in the directory)
hint-root-fixed =
    .lead = The Eraser's configuration targets the wrong place, because of an extra space. A fixed version is waiting for you, but /etc belongs to root: you need sudo, and its password hides in your journal (grep can search for a word).
    .solution = grep "my password" journal.txt, then sudo cp ~/eraser.conf.fixed /etc/eraser.conf

## Chapter 4 — The Backup

hint-backup-copy =
    .lead = Copy your memories to the backup disk, with rsync. Mind the trailing slash: with it, rsync copies the CONTENT of the directory.
    .solution = rsync -av ~/memories/ /mnt/backup/memories/
hint-backup-end =
    .lead = A backup must redo itself every night: that is cron's job (crontab -e). Then, in the morning, check that you can restore what was deleted.
    .solution = In crontab -e: 15 3 * * * rsync -a ~/memories/ /mnt/backup/memories/ — then, in the morning: rsync -av /mnt/backup/memories/first-letter.txt ~/memories/
