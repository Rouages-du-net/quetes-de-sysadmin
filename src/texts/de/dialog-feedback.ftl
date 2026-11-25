### The dialog of "Report a problem or an idea" (src/engine/feedback.ts),
### loaded when it first opens (src/texts/plugin.mjs: dialog-*.ftl).
### Its buttons are in feedback.ftl.

feedback-title = Ein Problem oder eine Idee melden
feedback-intro = Das Spiel sendet von sich aus nichts. Schreib deine Nachricht, kreuze an, was uns beim Verstehen helfen kann, prüf den Text unten und schick ihn dann selbst ab.

## The kind of report (a group of choices)
feedback-kind-legend = Worum geht es?
feedback-kind-bug = Ein Befehl, der sich falsch verhält
feedback-kind-text = Ein Text oder Hinweis, der unklar ist
feedback-kind-idea = Eine Idee
feedback-kind-other = Etwas anderes

## The message
feedback-message-label = Deine Nachricht
feedback-message-help = Was passiert ist, was du erwartet hast, oder deine Idee. Schreib nichts Persönliches: Die Meldung kann öffentlich werden.

## What to include (each box shows exactly what it adds)
feedback-parts-legend = Was mitgeschickt wird
feedback-parts-help = Jedes Kästchen zeigt genau, was es der Meldung hinzufügt.
feedback-part-version = Die Version des Spiels
feedback-part-language = Die Sprache
feedback-part-chapter = Wo du bist (Geschichte, Kapitel, Maschine, Verzeichnis, erreichte Ereignisse)
feedback-part-commands = Deine letzten Befehle in diesem Kapitel und was sie geantwortet haben
feedback-part-browser = Dein Browser und deine Bildschirmgröße
feedback-part-settings = Deine Anzeigeeinstellungen
feedback-part-notebook = Die Befehle in deinem Notizbuch
feedback-commands-help = Du kannst Zeilen unten vor dem Absenden bearbeiten oder löschen. Getippte Passwörter werden nie mitgeschickt. Befehle können allen, die das Issue lesen, die Lösung des Kapitels verraten.
feedback-commands-label = Die Befehle, die mitgeschickt werden
feedback-commands-none = In diesem Kapitel wurde noch kein Befehl getippt.
feedback-commands-exam = Nicht im Prüfungsmodus: Die Befehle einer Prüfung bleiben im Spiel.
feedback-never = Nie mitgeschickt: dein Fortschrittscode, dein Spielstand, dein Name und nichts, was du nicht angekreuzt hast.

## The preview and how to send it
feedback-preview = Der genaue Text der Meldung
feedback-send = Selbst absenden
feedback-github = Ein GitHub-Issue öffnen
feedback-github-help = Ein GitHub-Issue ist öffentlich, und du brauchst ein GitHub-Konto, um eines anzulegen. Der Link öffnet das Formular von GitHub in einem neuen Tab, schon ausgefüllt; nichts wird gesendet, bis du es dort abschickst.
feedback-new-tab = (öffnet sich in einem neuen Tab)
feedback-copy = Text kopieren
feedback-copy-help = Oder kopiere den Text und füge ihn ein, wo du willst.
feedback-copied = Der Text ist kopiert.
feedback-copy-selected = Der Text ist markiert: Drück Strg+C (oder ⌘+C), um ihn zu kopieren.
feedback-link-truncated =
    { $count ->
        [one] Die Meldung ist zu lang für einen Link: Das GitHub-Formular bekommt sie ohne die älteste Befehlszeile. Kopiere den Text und füge ihn in das Issue ein, um alles mitzugeben.
       *[other] Die Meldung ist zu lang für einen Link: Das GitHub-Formular bekommt sie ohne die { $count } ältesten Befehlszeilen. Kopiere den Text und füge ihn in das Issue ein, um alles mitzugeben.
    }
feedback-link-message-cut = Die Meldung ist zu lang für einen Link: Das GitHub-Formular bekommt deine Nachricht gekürzt. Kopiere den Text und füge ihn in das Issue ein, um alles mitzugeben.
feedback-close = Schließen

## In the report itself (the headings; the labels under them stay in English)
feedback-heading-kind = Art
feedback-heading-message = Nachricht
feedback-heading-context = Kontext
feedback-heading-commands = Letzte Befehle
feedback-no-message = (keine Nachricht)
feedback-redacted = [Fortschrittscode entfernt]
feedback-output-cut =
    { $count ->
        [one] [… eine weitere Zeile]
       *[other] [… { $count } weitere Zeilen]
    }
feedback-truncated =
    { $count ->
        [one] (Die älteste Zeile wurde weggelassen, damit sie in den Link passt.)
       *[other] (Die { $count } ältesten Zeilen wurden weggelassen, damit sie in den Link passen.)
    }
feedback-message-cut = (Die Nachricht wurde gekürzt, damit sie in den Link passt.)
