### Abgestufte Hinweise für „Das Archiv“ (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine Spur, ohne
### den genauen Befehl) und .solution (fast die Antwort). Ortsnamen wie in names.ftl.

## Kapitel 1 — Das Archiv

hint-archives-cleanup =
    .lead = Der Bestand passt nicht auf den 64-MB-Stick. du zeigt, wohin der Platz geht, und Rosa erwähnt temporäre Dateien (.tmp), die weg dürfen: find spürt sie in jedem Unterverzeichnis auf und kann sie löschen.
    .solution = find bestand -name "*.tmp", um sie zu sehen, dann find bestand -name "*.tmp" -delete (mit dem -name, sonst geht alles).
hint-archives-saved =
    .lead = Aufgeräumt: Jetzt den ganzen Bestand in EIN komprimiertes Archiv packen, direkt auf den Stick geschrieben (/media/stick). Siehe man tar: -c erstellt, -z komprimiert, -f benennt das Archiv.
    .solution = tar -czf /media/stick/bestand.tar.gz bestand (dann tar -tzf /media/stick/bestand.tar.gz zum Prüfen).

## Kapitel 2 — Die Versionen

hint-versions-restored =
    .lead = Maries Tagebuch wurde vor ein paar Nächten beschädigt; ältere Snapshots enthalten noch die gute Version. restic find --long zeigt, wann sich die Datei geändert hat, snapshots liefert die IDs, und dump (oder restore) holt eine Datei aus einem Snapshot heraus. Jeder Befehl braucht -r und --password-file (notes_restic.txt).
    .solution = restic -r /mnt/rathaus/restic-bibliothek --password-file ~/.config/restic/passwort snapshots, dann mit denselben Optionen und der ID eines Snapshots vom 1. Februar oder früher: restic … dump ID /home/du/bestand/manuskripte/tagebuch_marie.txt > ~/bestand/manuskripte/tagebuch_marie.txt
hint-versions-place =
    .lead = Dreißig Snapshots füllen die Platte des Rathauses. forget entfernt Snapshots nach einer Regel (--keep-daily, --keep-weekly…), aber erst prune gibt den Platz frei. Behalte mindestens einen Snapshot mit der guten Version, und probier zuerst --dry-run.
    .solution = restic (mit -r und --password-file) forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune (dann df -h /mnt/rathaus, um den frei gewordenen Platz zu sehen).
hint-versions-end =
    .lead = Noch zwei Dinge: Die Passwortdatei ist für jedes Konto lesbar (ls -l), und nach einem prune prüft man, ob das Repository intakt ist (man restic).
    .solution = chmod 600 ~/.config/restic/passwort, dann restic (mit -r und --password-file) check (es sollte „no errors were found“ sagen).
