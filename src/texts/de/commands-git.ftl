### Der Befehl git (src/engine/commands/git.ts): die Meldungen von git auf
### Deutsch, wie das echte git sie mit LANG=de ausgibt (offizielle Übersetzung
### von git, po/de.po), plus einige Bemerkungen des Spiels. Was git hier nicht
### übersetzt (die Zusammenfassung eines Commits, „To“, „Everything up-to-date“),
### bleibt auf Englisch. Technische Bezeichner (main, HEAD, .git, Optionen)
### werden nicht übersetzt. { $path }: Pfad eines Verzeichnisses; { $file }: Name einer Datei.

## Die Meldungen von git

git-not-repo = fatal: Kein Git-Repository (oder irgendeines der Elternverzeichnisse): .git
git-init-existing = Bestehendes Git-Repository in { $path }/.git/ neu initialisiert
git-init-empty = Leeres Git-Repository in { $path }/.git/ initialisiert
git-write-permission = error: Konnte Datei { $file } nicht erstellen: Keine Berechtigung
git-path-unknown = fatal: Pfadspezifikation '{ $file }' stimmt mit keinen Dateien überein
git-nothing-a-validate =
    Auf Branch main
    nichts zu committen (erstellen/kopieren Sie Dateien und benutzen Sie "git add" zum Versionieren)
git-none-commit-branch = fatal: Ihr aktueller Branch 'main' hat noch keine Commits.
# { $revision }: was die Person getippt hat (HEAD~9, ein Bezeichner…)
git-revision-ambiguous = fatal: Mehrdeutiges Argument '{ $revision }': unbekannter Commit oder Pfad existiert nicht im Arbeitsverzeichnis.
git-restore-without-path = fatal: Sie müssen Pfad(e) zur Wiederherstellung angeben.
git-reference-invalid = fatal: Ungültige Referenz: { $revision }
git-restore-unknown = error: Pfadspezifikation '{ $file }' stimmt mit keiner git-bekannten Datei überein

git-not-tree = fatal: Diese Operation muss in einem Arbeitsverzeichnis ausgeführt werden.
# { $option }: die unbekannte Option
git-option-unknown =
    unknown option: { $option }
    usage: git [--version] [--help] [--git-dir=<path>] [--work-tree=<path>] <command> [<args>]

## Bare-Repositorys, Remotes, push und pull (https://git-scm.com/book/de/v2/Git-auf-dem-Server-Einrichten-des-Servers)

git-init-existing-bare = Bestehendes Git-Repository in { $path }/ neu initialisiert
git-init-empty-bare = Leeres Git-Repository in { $path }/ initialisiert
git-init-impossible = fatal: Kann Verzeichnis { $path } nicht erstellen: Keine Berechtigung
git-work-tree-missing = fatal: Kann nicht in Verzeichnis '{ $path }' wechseln
# { $files }: eine Datei pro Zeile, mit einem Tabulator davor
git-checkout-not-tracked =
    error: Die folgenden unversionierten Dateien im Arbeitsverzeichnis würden beim Auschecken überschrieben werden:
    { $files }
    Bitte verschieben oder entfernen Sie diese, bevor Sie Branches wechseln.
    Abbruch
git-checkout-changes-local =
    error: Ihre lokalen Änderungen in den folgenden Dateien würden beim Auschecken überschrieben werden:
    { $files }
    Bitte committen oder stashen Sie Ihre Änderungen, bevor Sie Branches wechseln.
    Abbruch
git-rm-usage = fatal: Keine Pfadspezifikation angegeben. Welche Dateien sollen entfernt werden?
git-clone-usage = fatal: Sie müssen ein Repository zum Klonen angeben.
# { $repository }: der Pfad oder Name des Remote-Repositorys
git-remote-missing =
    fatal: '{ $repository }' scheint kein Git-Repository zu sein
    fatal: Konnte nicht vom Remote-Repository lesen.

    Bitte stellen Sie sicher, dass die korrekten Zugriffsberechtigungen bestehen
    und das Repository existiert.
git-clone-exists = fatal: Zielpfad '{ $path }' existiert bereits und ist kein leeres Verzeichnis.
git-clone-in = Klone nach '{ $path }'...
git-done = Fertig.
git-clone-empty = warning: Sie scheinen ein leeres Repository geklont zu haben.
git-remote-usage =
    usage: git remote [-v | --verbose]
       or: git remote add <name> <url>
       or: git remote remove <name>
       or: git remote set-url <name> <newurl>
# { $name }: der Name des Remotes (origin, prod…)
git-remote-exists = error: Remote-Repository { $name } existiert bereits.
git-remote-unknown = error: Kein solches Remote-Repository: '{ $name }'
git-push-without-destination =
    fatal: Kein Ziel für "push" konfiguriert.
    Entweder geben Sie die URL über die Kommandozeile an oder konfigurieren ein Remote-Repository mit

        git remote add <Name> <URL>

    und führen "push" dann unter Benutzung dieses Namens aus

        git push <Name>
git-to = To { $repository }
git-push-impossible = error: Fehler beim Versenden einiger Referenzen nach '{ $repository }'
# { $ref }: der verlangte Branch
git-refspec-unknown = error: Src-Refspec { $ref } entspricht keiner Referenz
git-all-a-day = Everything up-to-date
git-push-rejected-tip =
    Hinweis: Aktualisierungen wurden zurückgewiesen, weil das Remote-Repository Commits enthält,
    Hinweis: die lokal nicht vorhanden sind. Das wird üblicherweise durch einen "push" von
    Hinweis: Commits auf dieselbe Referenz von einem anderen Repository aus verursacht.
    Hinweis: Sie sollten erst die Remote-Änderungen integrieren (z.B. 'git pull ...'),
    Hinweis: bevor Sie erneut "push" ausführen.
# { $objects }, { $bytes }: Zahlen, schon formatiert
git-push-progress =
    Objekte aufzählen: { $objects }, fertig.
    Zähle Objekte: 100% ({ $objects }/{ $objects }), fertig.
    Delta-Kompression verwendet bis zu 2 Threads.
    Komprimiere Objekte: 100% ({ $objects }/{ $objects }), fertig.
    Schreibe Objekte: 100% ({ $objects }/{ $objects }), { $bytes } bytes | { $bytes }.00 KiB/s, fertig.
    Gesamt { $objects } (Delta 0), Wiederverwendet 0 (Delta 0), Pack wiederverwendet 0
git-push-rights =
    error: Unzureichende Berechtigung zum Hinzufügen eines Objektes zur Repository-Datenbank ./objects
    fatal: Fehler beim Schreiben des Objektes
    error: unpack-objects abnormal exit
git-push-branch-extracted =
    remote: error: refusing to update checked out branch: refs/heads/main
    remote: error: By default, updating the current branch in a non-bare repository
    remote: error: is denied, because it will make the index and work tree inconsistent
    remote: error: with what you pushed, and will require 'git reset --hard' to match
    remote: error: the work tree to HEAD.
# { $hook }: der Pfad des Hooks
git-hook-ignore =
    Hinweis: Der '{ $hook }' Hook wurde ignoriert, weil er nicht als ausführbar markiert ist.
    Hinweis: Sie können diese Warnung mit `git config advice.ignoredHook false` deaktivieren.
# { $remote }: der Name des Remotes
git-push-follow = Branch 'main' folgt nun '{ $remote }/main'.
git-pull-without-remote =
    Es gibt keine Tracking-Informationen für den aktuellen Branch.
    Bitte geben Sie an, welchen Branch Sie mergen möchten.

        git pull <Remote> <Branch>
git-since = Von { $repository }
git-already-a-day = Bereits aktuell.
git-pull-diverge = fatal: Vorspulen nicht möglich, breche ab.
# { $before }, { $after }: Commit-Bezeichner (7 Zeichen)
git-update = Aktualisiere { $before }..{ $after }
git-advance-fast = Vorspulen

## git status (die Beschriftungen der Dateien stehen in derselben Spalte)

git-status-branch = Auf Branch main
git-status-none-commit = Noch keine Commits
git-status-deleted = gelöscht:       { $file }
git-status-new = neue Datei:     { $file }
git-status-modified = geändert:       { $file }
git-status-indexes =
    Zum Commit vorgemerkte Änderungen:
      (benutzen Sie "git restore --staged <Datei>..." zum Entfernen aus der Staging-Area)
git-status-not-indexes =
    Änderungen, die nicht zum Commit vorgemerkt sind:
      (benutzen Sie "git add <Datei>...", um die Änderungen zum Commit vorzumerken)
      (benutzen Sie "git restore <Datei>...", um die Änderungen im Arbeitsverzeichnis zu verwerfen)
git-status-not-tracked =
    Unversionierte Dateien:
      (benutzen Sie "git add <Datei>...", um die Änderungen zum Commit vorzumerken)
git-status-own = nichts zu committen, Arbeitsverzeichnis unverändert
git-status-only-not-tracked = nichts zum Commit vorgemerkt, aber es gibt unversionierte Dateien (benutzen Sie "git add" zum Versionieren)
git-status-nothing-added = keine Änderungen zum Commit vorgemerkt (benutzen Sie "git add" und/oder "git commit -a")

## git commit

# Erste Zeile der Zusammenfassung eines Commits: { $id } (7 Zeichen), { $message }
git-commit-header = [main { $id }] { $message }
git-commit-header-root = [main (Root-Commit) { $id }] { $message }
# Zusammenfassung (wie im Spanischen auf Englisch gelassen): „1 file changed, 3 insertions(+), 3 deletions(-)“
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

## Bemerkungen des Spiels (wo sich das echte git anders verhält)

git-add-nothing =
    Nichts angegeben, nichts hinzugefügt.
    (zum Beispiel: git add roman.txt, oder git add . für alles)
git-commit-without-message =
    Schreib die Nachricht mit -m, in Anführungszeichen: git commit -m "Was ich geändert habe"
    (das echte git würde einen Texteditor öffnen)
git-checkout-usage =
    In diesem Spiel dient git checkout dazu, eine Datei wiederherzustellen: git checkout ID -- datei
    (heute besser: git restore --source=ID datei),
    oder die Dateien eines Repositorys in einen Ort auszupacken: git --work-tree=ort checkout -f main
git-usage =
    usage: git <command> [<args>]
    (siehe man git)
# { $commands }: die Unterbefehle des Spiels, durch Kommas getrennt
git-under-command-unknown = git: '{ $command }' ist kein git-Befehl (in diesem Spiel: { $commands }).

## Signieren, Tags, config, reset, archive (https://git-scm.com/docs/git-config, git-tag, git-reset, git-archive)

git-sign-failed = fatal: Fehler beim Schreiben des Commit-Objektes.
git-tag-sign-failed = error: Konnte Tag nicht signieren
git-sign-no-key = either user.signingkey or gpg.ssh.defaultKeyCommand needs to be configured
git-allowed-signers-missing = gpg.ssh.allowedSignersFile needs to be configured and exist for ssh signature verification
git-amend-nothing = fatal: Sie haben nichts für "--amend".
git-config-usage = usage: git config [<options>]
git-tag-without-message =
    Schreib die Nachricht des Tags mit -m, in Anführungszeichen: git tag -a v1.0 -m "Version 1.0"
    (das echte git würde einen Texteditor öffnen)
git-reset-unstaged = Nicht zum Commit vorgemerkte Änderungen nach Zurücksetzung:
git-archive-to-terminal =
    fatal: refusing to write an archive to the terminal: use -o FILE (--output=FILE)
git-push-behind-tip =
    Hinweis: Aktualisierungen wurden zurückgewiesen, weil die Spitze Ihres aktuellen
    Hinweis: Branches hinter seinem Remote-Gegenstück zurückgefallen ist. Integrieren Sie
    Hinweis: die Remote-Änderungen (z.B. 'git pull ...') bevor Sie erneut "push" ausführen.
    Hinweis: Siehe auch die Sektion 'Note about fast-forwards' in 'git push --help'
    Hinweis: für weitere Details.
git-push-tag-exists-tip = Hinweis: Aktualisierungen wurden zurückgewiesen, weil das Tag bereits im Remote-Repository existiert.
