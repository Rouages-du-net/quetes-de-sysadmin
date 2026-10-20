### Story "The Archives", single chapter (src/moteur/chapitres/archives.ts):
### save the collection of a neighbourhood library onto a small USB stick,
### with du, df, find and tar.

chapitre-archives = The Archives
    .resume = Measure, sort and pack a collection to save it onto a stick: du, df, find, tar.

## Files

archives-lettre-de-rosa =
    A letter from Rosa, librarian at the neighbourhood library:

    "The library server will be switched off tonight at midnight, for good:
    the town hall won't pay for it any more. Our whole collection is on it:
    the manuscripts donated by residents, the old maps, the gazette, the
    recordings from the market.

    All I have is an old 64 MB USB stick, plugged in at /media/cle. Can you
    put the collection on it, in ONE SINGLE compressed archive? An archive is
    easier to carry around, and compression saves space.

    Careful, copying isn't enough: everything has to fit. Measure first.
    My notes are in cat notes_rosa.txt"
archives-notes-rosa =
    ROSA'S NOTES

    How much space?
      du -sh fonds          the total size of the fonds directory
      du -h fonds           the size of each subdirectory
      df -h /media/cle      the free space on the stick

    Find files, anywhere in a directory and its subdirectories:
      find fonds -name "*.pdf"      all the PDFs
      find fonds -name "*.tmp"      all the temporary files
    The .tmp files are leftovers from our scanning software: we can throw
    them away without regret. To delete everything find finds, add
    -delete at the end (read the command again before pressing Enter!).

    Make a compressed archive (tar = tape archive, z = gzip):
      tar -czf /media/cle/fonds.tar.gz fonds
    Check what it contains:
      tar -tzf /media/cle/fonds.tar.gz
archives-lisezmoi = Collection of the neighbourhood library. Donations from residents, 1890-2026.
archives-journal-de-marie = Diary of Marie, seamstress, 1931-1940 (transcription).
archives-lettres-1914 = Letters from Ahmed to his sister, 1914-1918 (transcription).
archives-recettes-du-quartier = Recipes collected at the market, 1975-2020.
# Content shown by cat for files that are not text
archives-image-png = (PNG image)
archives-document-pdf = (PDF document)
archives-son-ogg = (Ogg Vorbis audio)
archives-fichier-temporaire = (temporary file)

## Events

archives-evenement-mesure =
    The collection weighs far more than the stick's 64 MB. But look where
    the space goes: a few big files… Rosa mentioned temporary files.
    find fonds -name "*.tmp"
archives-evenement-plein =
    "No space left on device": the archive doesn't fit on the stick. You
    need to make room BEFORE: what in the collection is not precious?
    (du -h fonds, then find fonds -name "*.tmp")
archives-evenement-tmp =
    Three temporary files, 120 MB between them! Rosa says we can throw
    them away. find can delete them in one go, with -delete at the end:

      find fonds -name "*.tmp" -delete

    (Read it again before Enter: without the -name, find would delete the WHOLE collection.)
archives-evenement-perte =
    Ouch: a precious file from the collection has disappeared, and there is no
    recycle bin… In real life, that's why you make backups BEFORE cleaning
    up. Here, you can restart the chapter (link below the terminal).
archives-evenement-menage =
    The cleanup is done. Check with du -sh fonds, then create the compressed
    archive directly on the stick:

      tar -czf /media/cle/fonds.tar.gz fonds
# { $taille }: size of the archive in MB (number, with one decimal)
archives-evenement-sauve =
    The archive is on the stick: { NUMBER($taille, minimumFractionDigits: 1, maximumFractionDigits: 1) } MB, with the whole collection. The texts were
    highly compressed; the images, sounds and PDFs, already compressed,
    hardly at all. To check its contents without extracting it:
    tar -tzf /media/cle/fonds.tar.gz

    Rosa unplugs the stick at 11:58 pm. "It's all there. Thank you!"

    (A second chapter awaits you: The Versions.)

    You now know how to measure (du, df), search and sort (find, -delete) and
    pack (tar). And a golden rule of archivists: a single copy is not a
    backup. Rosa will make a second one first thing tomorrow.
