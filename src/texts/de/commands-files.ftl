### Dateibefehle (src/engine/commands/files.ts): Fehlermeldungen aus
### coreutils auf Deutsch (Translation Project). { $target }: getippter Pfad.
### Gemeinsame Fehler (Datei nicht gefunden, Keine Berechtigung…) stehen
### in shell.ftl.

## ls

ls-access-missing = ls: Zugriff auf '{ $target }' nicht möglich: Datei oder Verzeichnis nicht gefunden
ls-access-permission = ls: Zugriff auf '{ $target }' nicht möglich: Keine Berechtigung
ls-open-permission = ls: Verzeichnis '{ $target }' kann nicht geöffnet werden: Keine Berechtigung

## cd

cd-not-one-directory = cd: { $target }: Ist kein Verzeichnis (es ist ein Objekt: versuch es mit cat)
# cd - ohne vorheriges Verzeichnis (bash: „OLDPWD not set“).
cd-old-missing = cd: OLDPWD ist nicht gesetzt.

## cat, mv, cp, rm, touch, mkdir

cat-usage = Aufruf: cat datei
mv-usage = Aufruf: mv quelle ziel
mv-missing = mv: der Aufruf von stat für '{ $target }' ist nicht möglich: Datei oder Verzeichnis nicht gefunden
# Vereinfachung des Spiels: Orte werden nicht verschoben.
mv-place = mv: das Verschieben von '{ $target }' ist nicht möglich: Darin liegt ein Ort der Geschichte, und das Spiel lässt die Orte der Geschichte, wo sie sind
mv-permission = mv: das Verschieben von '{ $target }' ist nicht möglich: Keine Berechtigung
cp-usage = Aufruf: cp quelle ziel
cp-missing = cp: der Aufruf von stat für '{ $target }' ist nicht möglich: Datei oder Verzeichnis nicht gefunden
cp-directory = cp: -r nicht angegeben; Verzeichnis '{ $target }' wird ausgelassen
cp-same-file = cp: '{ $source }' und '{ $destination }' sind dieselbe Datei
cp-read-permission = cp: '{ $target }' kann nicht zum Lesen geöffnet werden: Keine Berechtigung
rm-usage = Aufruf: rm datei
# ln (Meldungen von coreutils)
ln-operand-missing =
    ln: Fehlender Dateioperand
    „ln --help“ liefert weitere Informationen.
ln-impossible-symbolic = ln: symbolische Verknüpfung '{ $target }' konnte nicht angelegt werden: { $reason }
ln-impossible-physical = ln: harte Verknüpfung '{ $target }' konnte nicht angelegt werden: { $reason }
ln-exists = Die Datei existiert bereits
ln-permission = Keine Berechtigung
ln-missing = Datei oder Verzeichnis nicht gefunden
ln-access-impossible = ln: Zugriff auf '{ $target }' fehlgeschlagen: Datei oder Verzeichnis nicht gefunden
ln-physical-directory = ln: { $target }: Harte Verknüpfung auf ein Verzeichnis nicht erlaubt
rm-missing = rm: das Entfernen von '{ $target }' ist nicht möglich: Datei oder Verzeichnis nicht gefunden
rm-directory = rm: das Entfernen von '{ $target }' ist nicht möglich: Ist ein Verzeichnis
rm-permission = rm: das Entfernen von '{ $target }' ist nicht möglich: Keine Berechtigung
touch-usage = Aufruf: touch datei
mkdir-usage = Aufruf: mkdir ort
mkdir-exists = mkdir: Verzeichnis '{ $target }' kann nicht angelegt werden: Die Datei existiert bereits

## chmod

chmod-usage = Aufruf: chmod modus datei (z. B. chmod o-w erinnerungen, chmod 755 erinnerungen)
chmod-access-missing = chmod: Zugriff auf '{ $target }' nicht möglich: Datei oder Verzeichnis nicht gefunden
chmod-access-permission = chmod: Zugriff auf '{ $target }' nicht möglich: Keine Berechtigung
chmod-not-allowed = chmod: Ändern der Zugriffsrechte von '{ $target }': Die Operation ist nicht erlaubt
# { $permissions }: was getippt wurde (z. B. o-w)
chmod-mode-incorrect = chmod: ungültiger Modus: '{ $permissions }' (siehe man chmod)

## find

# { $predicate }: die getippte unbekannte Option
find-predicate-unknown = find: Unbekanntes Prädikat »{ $predicate }«
find-argument-missing = find: Fehlendes Argument für »{ $predicate }«
# { $predicate }: -mtime, -maxdepth; { $value }: was getippt wurde
find-argument-numeric = find: Ungültiges Argument »{ $value }« für »{ $predicate }«
find-missing = find: '{ $target }': Datei oder Verzeichnis nicht gefunden
find-permission = find: '{ $target }': Keine Berechtigung
find-remove-not-empty = find: '{ $target }' kann nicht gelöscht werden: Das Verzeichnis ist nicht leer
find-remove-permission = find: '{ $target }' kann nicht gelöscht werden: Keine Berechtigung

## du, df

missing = du: Zugriff auf '{ $target }' nicht möglich: Datei oder Verzeichnis nicht gefunden
# Spaltenköpfe von df: Die Breiten müssen zu den Spalten passen
# (18, 6, 7, 6 und 4 Zeichen).
df-header = Dateisystem         Größe Benutzt  Verf. Verw% Eingehängt auf
df-header-inodes = Dateisystem         Inodes  IBenut   IFrei IVerw% Eingehängt auf
# df -T: der Titel der Spalte für den Typ.
df-type = Typ
depth = du: Ungültige maximale Tiefe

## tar

tar-usage = Aufruf: tar -czf archiv.tar.gz ort  |  tar -tzf archiv.tar.gz  |  tar -xzf archiv.tar.gz [-C ort]
tar-archive-empty = tar: Es wird feige abgelehnt, ein leeres Archiv anzulegen
tar-open-impossible = tar: { $target }: Funktion open fehlgeschlagen: Datei oder Verzeichnis nicht gefunden
tar-not-one-archive = tar: { $target }: Das sieht nicht wie ein „tar“-Archiv aus
# Ein beim Schreiben abgeschnittenes Archiv (gzip, dann tar, wie GNU tar).
tar-truncated =
    gzip: stdin: unexpected end of file
    tar: Unerwartetes Dateiende im Archiv
    tar: Fehler nicht behebbar: Programmabbruch
tar-place-missing = tar: { $target }: Funktion chdir fehlgeschlagen: Datei oder Verzeichnis nicht gefunden
tar-option-missing = tar: Sie müssen eine der Optionen „-Acdtrux“, „--delete“ oder „--test-label“ angeben

## cp, mv, rm und rmdir: Optionen (Meldungen von coreutils 9.4)

target-not-directory = { $command }: Ziel '{ $target }': Ist kein Verzeichnis
target-missing = { $command }: Ziel '{ $target }': Datei oder Verzeichnis nicht gefunden
# -i: die Frage (der Code fügt das Leerzeichen dahinter an); j (oder y) ersetzt die Datei.
cp-overwrite = cp: '{ $target }' überschreiben?
mv-overwrite = mv: '{ $target }' überschreiben?
# mv -v
mv-renamed = '{ $source }' -> '{ $destination }' umbenannt
rm-ask = rm: reguläre Datei '{ $target }' entfernen?
rm-ask-empty = rm: reguläre leere Datei '{ $target }' entfernen?
rm-ask-link = rm: symbolische Verknüpfung '{ $target }' entfernen?
rm-removed = '{ $target }' wurde entfernt
rm-removed-directory = Verzeichnis '{ $target }' wurde entfernt
rm-ask-descend = rm: in Verzeichnis '{ $target }' absteigen?
rm-ask-directory = rm: Verzeichnis '{ $target }' entfernen?
rm-dot = rm: Entfernen von '.' Verzeichnis '..' nicht möglich: '{ $target }' wird übersprungen
rm-preserve-root =
    rm: Es ist gefährlich, rekursiv auf '{ $target }' zu arbeiten.
    rm: Verwenden Sie --no-preserve-root, um diese Sicherheitsmaßnahme zu umgehen.
rm-busy = rm: das Entfernen von '{ $target }' ist nicht möglich: Das Gerät oder die Ressource ist belegt
rm-not-permitted = rm: das Entfernen von '{ $target }' ist nicht möglich: Die Operation ist nicht erlaubt
rm-other-device = rm: überspringe '{ $target }', da es auf einem anderen Gerät ist
# Gewollte Unterschiede zu rm und mv von GNU: Das Spiel bewahrt die Orte des Systems und die der Geschichte.
rm-system = rm: das Entfernen von '{ $target }' ist nicht möglich: Das Spiel bewahrt die eigenen Orte des Systems (/, /etc, /usr/lib, /var/log…), die root auf einem echten Server zerstören könnte
rm-story-place = rm: das Entfernen von '{ $target }' ist nicht möglich: Darin liegt ein Ort der Geschichte, und das Spiel bewahrt die Orte der Geschichte
mv-system = mv: das Verschieben von '{ $target }' ist nicht möglich: Das Spiel lässt die eigenen Orte des Systems (/, /etc, /usr/lib, /var/log…), wo sie sind
mv-into-itself = mv: das Verschieben von '{ $source }' in ein Unterverzeichnis seiner selbst ('{ $target }') ist nicht möglich
mv-busy = mv: das Verschieben von '{ $source }' nach '{ $target }' ist nicht möglich: Das Gerät oder die Ressource ist belegt
mv-over-file = mv: Nicht-Verzeichnis '{ $target }' kann nicht mit Verzeichnis '{ $source }' überschrieben werden
mv-not-empty = mv: das Verschieben von '{ $source }' nach '{ $target }' ist nicht möglich: Das Verzeichnis ist nicht leer
mv-over-directory = mv: Verzeichnis '{ $target }' kann nicht mit einem Nicht-Verzeichnis überschrieben werden
mv-denied = mv: das Verschieben von '{ $source }' nach '{ $target }' ist nicht möglich: Keine Berechtigung
rmdir-usage =
    rmdir: Fehlender Operand
    „rmdir --help“ liefert weitere Informationen.
rmdir-failed = rmdir: Entfernen von '{ $target }' fehlgeschlagen: { $reason }
rmdir-missing = Datei oder Verzeichnis nicht gefunden
rmdir-not-directory = Ist kein Verzeichnis
rmdir-not-empty = Das Verzeichnis ist nicht leer
rmdir-permission = Keine Berechtigung
rmdir-removing = rmdir: Verzeichnis '{ $target }' wird entfernt
