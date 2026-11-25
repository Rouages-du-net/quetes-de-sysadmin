### Abgestufte Hinweise für „Die Zeitmaschine“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).
### Ortsnamen wie in names.ftl.

## Kapitel 1 — Die Zeitmaschine

hint-manuscript-history =
    .lead = Das Verzeichnis roman wird von git verfolgt. Bevor du etwas reparierst, schau dir seine Historie an: die Liste seiner Commits (hilfe_git.txt, man git).
    .solution = cd roman, dann git log (oder git log --oneline: ein Commit pro Zeile).
hint-manuscript-restored =
    .lead = Der vorletzte Commit stammt von vor dem Besuch der Katze. git kann eine Datei auf den Stand eines bestimmten Commits zurücksetzen (HEAD~1: der Commit vor dem letzten).
    .solution = In roman: git restore --source=HEAD~1 roman.txt (git diff HEAD~1 roman.txt zeigt vorher den Schaden).
hint-manuscript-saved =
    .lead = Nur deine Arbeitskopie ist repariert: Der letzte Commit enthält noch den Buchstabensalat. Merk die Datei für den nächsten Schnappschuss vor und mach ihn dann.
    .solution = git add roman.txt, dann git commit -m "Kapitel 3 wiederhergestellt"
hint-manuscript-poems =
    .lead = Die Gedichte werden von nichts verfolgt. Mach aus dem Verzeichnis gedichte ein git-Repository und mach dann einen ersten Schnappschuss aller Gedichte.
    .solution = cd ../gedichte, git init, git add . (der Punkt: das ganze Verzeichnis), dann git commit -m "Erste Gedichte"
hint-manuscript-end =
    .lead = Du brauchst beides: den reparierten Roman in einem neuen Commit und die drei Gedichte in einem Commit ihres eigenen Repositorys. git log zeigt dir in jedem Verzeichnis, wo du stehst.
    .solution = In roman: git add roman.txt und git commit -m "…"; in gedichte: git init, git add . und git commit -m "…"
