### Graded hints for The Eraser (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Place names as in noms.ftl.

## Chapter 1 — Lighthouse Island

indice-lighthouse-crabe =
    .piste = The exercise in the PracticeRoom (at the SignalSchool, on the Hill) asks you to put the crab away. Putting away is moving: which command moves an object into a place?
    .solution = From the PracticeRoom: mv crab Bucket (then ls Bucket to check).
indice-lighthouse-filet =
    .piste = The net blocks the Lighthouse door, at the end of the Pier. Just move it somewhere else, to a place that can store it.
    .solution = From your home: mv Pier/net Harbour/Boathouse
indice-lighthouse-lumiere =
    .piste = The Lantern, at the top of the Lighthouse, needs a bulb. A spare bulb exists, but it is hidden: ls -a shows files whose name starts with a dot. And mv can also rename.
    .solution = From your home: mv Harbour/Storeroom/.spare_bulb Pier/Lighthouse/Stairs/Lantern/bulb

## Chapter 2 — The Village

indice-village-levain =
    .piste = The baker wants three sourdoughs, without losing the original. A copy is a new, identical object.
    .solution = In the Bakery: cp sourdough sourdough_2 then cp sourdough sourdough_3
indice-village-engrenage =
    .piste = The maker in the Workshop needs gears, and there are none. touch creates an empty file.
    .solution = In the Workshop: touch gear
indice-village-engrenages =
    .piste = Five in all to get the clock going again: one original and copies.
    .solution = In the Workshop: cp gear gear_2, then _3, _4 and _5.
indice-village-barricade =
    .piste = A barricade blocks the Yard, in the Alley. Too heavy for mv. What is left, for an object nobody needs any more?
    .solution = In the Alley: rm barricade (careful, rm goes through no bin: it is gone for good).
indice-village-rats =
    .piste = The rats in the Sewer guard the Tunnel. What they like is sold at the Market. The Market's cheese cannot be deleted, but it can be copied.
    .solution = In the Sewer (Alley/Yard/Sewer): cp ~/Market/cheese .
indice-village-nour-sans-classe =
    .piste = Nour is at the end of the Tunnel, behind the rats. Read what she has to say.
    .solution = cat ~/Alley/Yard/Sewer/Tunnel/nour.txt
indice-village-classe =
    .piste = The Eraser erased the School's Classroom. A place is a directory: which command creates a directory?
    .solution = mkdir ~/School/Classroom
indice-village-nour =
    .piste = Is the Classroom there? Go back to Nour: she is waiting to go home.
    .solution = cat ~/Alley/Yard/Sewer/Tunnel/nour.txt

## Chapter 3 — The Root

indice-root-alerte =
    .piste = Start by reading the arrival file, in your home.
    .solution = cat arrival.txt
indice-root-protege =
    .piste = The Eraser erases your memories because it may write in that directory. ls -l shows the permissions: r, w and x, for you, your group and others.
    .solution = chmod o-w memories (others can no longer write in the directory)
indice-root-corrige =
    .piste = The Eraser's configuration targets the wrong place, because of an extra space. A fixed version is waiting for you, but /etc belongs to root: you need sudo, and its password hides in your journal (grep can search for a word).
    .solution = grep "my password" journal.txt, then sudo cp ~/eraser.conf.fixed /etc/eraser.conf

## Chapter 4 — The Backup

indice-backup-copie =
    .piste = Copy your memories to the backup disk, with rsync. Mind the trailing slash: with it, rsync copies the CONTENT of the directory.
    .solution = rsync -av ~/memories/ /mnt/backup/memories/
indice-backup-fin =
    .piste = A backup must redo itself every night: that is cron's job (crontab -e). Then, in the morning, check that you can restore what was deleted.
    .solution = In crontab -e: 15 3 * * * rsync -a ~/memories/ /mnt/backup/memories/ — then, in the morning: rsync -av /mnt/backup/memories/first-letter.txt ~/memories/
