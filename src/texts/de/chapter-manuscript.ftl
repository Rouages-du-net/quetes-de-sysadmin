### Geschichte „Die Zeitmaschine“, einziges Kapitel
### (src/engine/chapters/manuscript.ts): Inès, eine Romanautorin, hat ihr
### Manuskript beschädigt; wir reparieren es mit git. Der Roman, seine
### Versionen, die Commit-Nachrichten und die Gedichte sind Texte der
### Geschichte: Sie werden übersetzt (die Commit-IDs ändern sich dann mit der Sprache).

chapter-manuscript = Die Zeitmaschine
    .summary = Durch die Versionen eines Textes reisen mit git: log, diff, restore, add, commit, init.

# Autorin der Commits (git log): Name und Adresse, im Format von git
manuscript-author = Inès Haddad <ines@example.org>

## Inès' Roman (roman.txt), Kapitel für Kapitel

manuscript-novel-chapter-1 =
    KAPITEL 1 — DIE ABREISE

    Der Nachtbus verließ Marseille um zehn Uhr.
    Yasmina hielt den Brief ihrer Großmutter fest an sich gedrückt.
    „Geh und sieh dir den Leuchtturm an“, hatte Oma Zohra geschrieben. „Dort ist alles.“
manuscript-novel-chapter-2 =
    KAPITEL 2 — DIE ÜBERFAHRT

    Das Boot zur Insel legte im Morgengrauen ab.
    An Deck flickte ein alter Seemann ein Netz und summte vor sich hin.
    Er kannte den Leuchtturm: „Seit 1962 ist niemand mehr hinaufgestiegen.“
manuscript-novel-chapter-3 =
    KAPITEL 3 — DER LEUCHTTURM

    Die Tür gab beim dritten Schulterstoß nach.
    Ganz oben, unter der Laterne, wartete eine eiserne Kiste.
    Darin: Hefte, bedeckt mit Zohras enger Handschrift.
# Kapitel 3, nachdem die Katze über die Tastatur gelaufen ist: nur den
# Titel übersetzen; die Buchstabenzeilen bleiben, wie sie sind.
manuscript-novel-chapter-3-damaged =
    KAPITEL 3 — DER LEUCHTTURM

    jjjjjjjjjjjjjjjjjjjjjjkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk;;;;;;;;;;;;;
    mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm

## Inès' Commit-Nachrichten (git log)

manuscript-commit-1 = Kapitel 1: die Abreise
manuscript-commit-2 = Kapitel 2: die Überfahrt
manuscript-commit-3 = Kapitel 3: der Leuchtturm
manuscript-commit-4 = Sicherung am Morgen

## Die Gedichte (Verzeichnis gedichte)

manuscript-poem-sea =
    Das Meer näht
    die Ränder der Welt
    mit einem Faden aus Schaum.
manuscript-poem-lighthouse =
    Ein Auge, das sich dreht
    in der Nacht der Seeleute:
    Es schläft nie.
manuscript-poem-zohra =
    Meine Großmutter sprach
    dreieinhalb Sprachen,
    die Hälfte war Schweigen.

## Dateien

manuscript-message-ines =
    Eine Nachricht von Inès, deiner Freundin, die Romane schreibt:

    „Katastrophe! Heute Morgen ist meine Katze über die Tastatur gelaufen,
    während mein Roman offen war… und ich habe gespeichert, ohne
    hinzuschauen. Kapitel 3 ist jetzt nur noch Buchstabensalat. Und
    schlimmer: Ich habe gleich danach einen Commit gemacht!

    Zum Glück wird mein Verzeichnis roman von git verfolgt, einer
    Zeitmaschine für Dateien: Jeder ‚Commit‘ ist ein Schnappschuss aller
    Dateien, mit einer Nachricht und einem Datum. Kannst du mir helfen,
    mein Kapitel zurückzubekommen? Schau dich erst einmal um:

      cd roman
      cat roman.txt
      git log

    Und wo du schon dabei bist… meine Gedichte, im Verzeichnis gedichte,
    werden von gar nichts verfolgt. Wenn meine Katze das noch mal macht,
    verliere ich alles.“
manuscript-help-git =
    GIT-SPICKZETTEL (siehe auch:  man git)

      git log --oneline          die Historie, ein Commit pro Zeile (der neueste oben)
      git show ID                was ein Commit geändert hat
      git diff ID roman.txt      die Unterschiede zwischen diesem Commit und der aktuellen Datei
                                 (- : die Zeile vorher, + : die Zeile jetzt)
      git restore --source=ID roman.txt
                                 setzt roman.txt auf den Stand dieses Commits zurück
      git status                 was sich seit dem letzten Commit geändert hat
      git add roman.txt          merkt die Datei für den nächsten Commit vor
      git commit -m "Nachricht"  macht den Schnappschuss, mit einer Nachricht

    Ein Commit wird über den Anfang seiner ID angesprochen (7 Zeichen reichen),
    oder über HEAD (den neuesten), HEAD~1 (den davor), HEAD~2…

    Um ein Verzeichnis zu verfolgen:  git init , dann  git add .  (der Punkt =
    das ganze Verzeichnis) und  git commit -m "…"

## Ereignisse

manuscript-event-history =
    Vier Commits, vom neuesten zum ältesten. Der letzte, „Sicherung am
    Morgen“, ist der der Katze. Der davor, „Kapitel 3: der Leuchtturm“,
    stammt von vor der Katastrophe. Um zu sehen, was die Katze geändert
    hat: git show HEAD
manuscript-event-restored =
    Kapitel 3 ist zurück! Die Datei ist durch die Zeit gereist.
    Aber bisher ist nur deine Arbeitskopie repariert: Der letzte
    Commit enthält noch den Salat. Schau dir git status an und sichere
    dann die reparierte Version:

      git add roman.txt
      git commit -m "Kapitel 3 wiederhergestellt (danke, Katze)"
manuscript-event-saved =
    Commit gesichert. Beachte: Aus der Historie wurde nichts gelöscht. Der
    Commit der Katze ist noch da (git log); wir haben einfach einen neuen,
    reparierten Schnappschuss obendrauf gelegt. Mit git verliert man fast nie etwas.

    Bleiben noch Inès' Gedichte: Mach aus dem Verzeichnis gedichte ein
    Repository (git init) und mach dann einen ersten Schnappschuss aller Gedichte.
manuscript-event-poems = Die drei Gedichte sind jetzt in einem Commit: Selbst wenn die Katze wiederkommt, sind sie in der Historie in Sicherheit.
manuscript-event-end =
    Inès antwortet: „Mein Kapitel! Meine Gedichte! Du kannst zaubern, du
    bist… ein wunderbarer Mensch.“

    ENDE DER GESCHICHTE „DIE ZEITMASCHINE“.

    Du kannst jetzt die Historie eines Verzeichnisses lesen (git log,
    git show), die Unterschiede sehen (git diff), zu einer Version
    zurückkehren (git restore) und neue Schnappschüsse machen (git add,
    git commit). git wurde 2005 von Linus Torvalds geschaffen, um den
    Linux-Kernel zu entwickeln. Man benutzt es auch für Bücher,
    Abschlussarbeiten, Websites… wie die, die du gerade liest.
