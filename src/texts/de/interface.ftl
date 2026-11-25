### Game interface: choosing stories and chapters, terminal,
### progress. One whole sentence per message; variables between { }.

stories-title = Geschichten
# { $story }: title of the story
chapters-title = Kapitel von „{ $story }“
chapter-number = Kapitel { $number }
chapter-title-complete = { $story } — Kapitel { $number }: { $title }
state-story-finished = ✓ Abgeschlossen
state-chapters-done =
    { $finished ->
        [one] { $finished } Kapitel
       *[other] { $finished } Kapitel
    } von { $total }
state-chapter-finished = ✓ Abgeschlossen
state-locked = 🔒 Schließe das vorige Kapitel ab
state-key-missing = 🔒 Gesperrt
# { $chapters }: the titles of the chapters still to finish (formatted list)
state-key-after = 🔒 Nach { $chapters }
# { $title }: a chapter title, in the list above
state-key-chapter = „{ $title }“
key-help = 🔑 Diese Geschichten öffnen sich nach und nach: Unter jedem Namen stehen die Kapitel, die du abschließen musst, bevor du ihren Schlüssel bekommst. Die ersten öffnen sich nach „Die Wurzel“ (Der Radierer, Kapitel 3).
stories-locked = { $count ->
    [one] 🔒 Noch eine Geschichte gesperrt
   *[other] 🔒 Noch { $count } Geschichten gesperrt
}
button-next = Nächstes Kapitel →
button-restart = Dieses Kapitel neu starten
tips = Tipps: Tab vervollständigt Namen von Befehlen, Verzeichnissen und Dateien, ↑ holt frühere Befehle zurück, „hilfe“ listet die Befehle, die du kennst, „man befehl“ öffnet das Handbuch, „exit“ bringt dich zurück an deinen Rechner. Wie in den meisten Linux-Terminals kopiert das Markieren von Text, und ein Rechtsklick fügt ihn ein. Dein Fortschritt wird in diesem Browser gespeichert.
# { $lines }: number of lines not shown
output-cut =
    { $lines ->
        [one] (… { $lines } Zeile weiter oben, nicht angezeigt)
       *[other] (… { $lines } Zeilen weiter oben, nicht angezeigt)
    }
workstation-title = Dein Rechner
## The story menu: two views
view-title = Wie die Geschichten angezeigt werden
view-network = Netzwerkkarte
view-internet = Internet
input-label = Befehl
credit = Sysadmin-Quests, ein freies Spiel (GPL v3, Texte CC BY-SA 4.0), inspiriert von Terminus, erschaffen am MIT von Shawn Conrad und Michele Pratusevich.
credit-link-project = Das Projekt
credit-link-original = Terminus

## The sysadmin's notebook

notebook-title = Das Sysadmin-Notizbuch
# { $count }: the number of commands noted
notebook-account = { $count ->
    [0] (leer)
    [one] ({ $count } Befehl)
   *[other] ({ $count } Befehle)
}
notebook-help = Jeder Befehl, den du zum ersten Mal ausführst, wird hier eingetragen, mit dem, was er tut, und der Zeile, die du getippt hast. Dein Spickzettel zum Mitnehmen.
notebook-empty = Noch nichts: Führe einen Befehl aus (zum Beispiel ls), dann wird er hier notiert.
notebook-export = Herunterladen (Markdown)
notebook-copy-button = Kopieren
notebook-copy = In die Zwischenablage kopiert.
notebook-copy-impossible = Dieser Browser verweigert den Zugriff auf die Zwischenablage: Nutze stattdessen den Download.
# The name of the downloaded file: no spaces or hard-to-type characters.
notebook-file = sysadmin-notizbuch.md
# At the top of the Markdown file. { $count }: the number of commands
notebook-markdown-intro = { $count ->
    [one] Ein Befehl, gelernt beim Spielen von Sysadmin-Quests.
   *[other] { $count } Befehle, gelernt beim Spielen von Sysadmin-Quests.
}
notebook-progress = Fortschritt
notebook-progress-empty = Noch kein Kapitel abgeschlossen.
# { $story }: the title of the story; { $finished } and { $total }: chapters completed and in total
notebook-progress-story = { $story }: { $finished ->
    [one] { $finished } Kapitel abgeschlossen
   *[other] { $finished } Kapitel abgeschlossen
} von { $total }
# { $chapter }: the title of the chapter where the command was first used
notebook-discovery = Entdeckt in „{ $chapter }“.
# { $command }: the command that opens the manual (man ls)
notebook-manual = Zum Weiterlesen: { $command }

## Links to Les rouages du net (after a chapter)

rouages-intro = Um zu verstehen, was unter der Haube passiert, auf Les rouages du net (auf Französisch):
rouages-link-entree-nom = „Von der Eingabetaste zur Seite“: Der Name wird zur Adresse (DNS)
rouages-link-entree-box = „Von der Eingabetaste zur Seite“: dein Router und dein lokales Netz
rouages-link-entree-liaison = „Von der Eingabetaste zur Seite“: die Verbindung aufbauen (TCP, Ports)
rouages-link-entree-cadenas = „Von der Eingabetaste zur Seite“: das Schloss (TLS, Zertifikate)
rouages-link-entree-voyage = „Von der Eingabetaste zur Seite“: die Reise der Pakete
rouages-link-entree-serveur = „Von der Eingabetaste zur Seite“: Der Server antwortet
rouages-link-ordinateur-binaire = „Wie ein Computer funktioniert“: Alles ist eine Zahl
rouages-link-ordinateur-memoire = „Wie ein Computer funktioniert“: der Speicher
rouages-link-glossaire-ttl = Glossar: TTL
rouages-link-glossaire-port = Glossar: Port
rouages-link-glossaire-nat = Glossar: NAT
rouages-link-glossaire-routeur = Glossar: Router
rouages-link-glossaire-commutateur = Glossar: Switch
rouages-link-glossaire-hebergeur = Glossar: Hoster
rouages-link-glossaire-chiffrement = Glossar: Verschlüsselung
rouages-link-glossaire-autorite-certification = Glossar: Zertifizierungsstelle
rouages-link-glossaire-code-http = Glossar: HTTP-Statuscode
rouages-link-glossaire-requete = Glossar: Anfrage
rouages-link-glossaire-datacenter = Glossar: Rechenzentrum
rouages-link-glossaire-octet = Glossar: Byte

## Exam mode

exam-case = Prüfungsmodus: keine Hinweise, mit Stoppuhr (das Kapitel beginnt von vorn)
# { $time }: the elapsed time, in minutes:seconds
exam-timer = ⏱ { $time }
# The confirmation, when a chapter is in progress (exam mode restarts it).
exam-confirm-title = In den Prüfungsmodus wechseln?
exam-confirm-text = Das aktuelle Kapitel beginnt von vorn, auf einer frischen Maschine: Was du darin schon getan hast, geht verloren. Abgeschlossene Kapitel bleiben abgeschlossen.
exam-confirm = Im Prüfungsmodus neu starten
exam-quit-title = Den Prüfungsmodus verlassen?
exam-quit-text = Das aktuelle Kapitel beginnt von vorn, mit Hinweisen: Was du darin schon getan hast, geht verloren. Abgeschlossene Kapitel bleiben abgeschlossen.
exam-quit = Ohne Prüfungsmodus neu starten
exam-cancel = Abbrechen
exam-start = Prüfungsmodus: Es werden keine Hinweise angezeigt, die Stoppuhr läuft. Deine Mission steht in der Willkommensnachricht (lies sie mit cat noch einmal). Die Nachbesprechung kommt am Ende. Um ganz von vorn zu beginnen, Maschine und Stoppuhr: „Dieses Kapitel neu starten“ unter dem Terminal.
# { $time }: the time of this game; { $record }: the best time in this browser
exam-finished = Prüfung bestanden in { $time }. Deine beste Zeit in diesem Kapitel: { $record }.
exam-finished-record = Prüfung bestanden in { $time }: Das ist deine beste Zeit in diesem Kapitel.

## The map (a button next to the terminal; see src/engine/map.ts)

map-button = Karte
# { $machine }: the name of the machine you are on (kingdom, desk…).
map-title = Karte von { $machine }
map-caption = Die Orte (Verzeichnisse), die du auf dieser Maschine kennst: die, die du betreten hast, und kursiv die, die du nur kurz gesehen hast. Dateien werden nicht angezeigt: Dafür gibt es ls.
map-here = ← du bist hier
map-home = dein Home-Verzeichnis, ~
map-closed = vorerst verschlossen
map-preview = noch nicht besucht
map-close = Schließen

## The network plan ("Network" tab of the map; see src/engine/plan.ts)

map-tab-places = Orte
map-tab-network = Netzwerk
plan-caption = Das Netzwerk, wie das Team es geplant hat, wie das Schema an der Wand: was sein sollte, nicht unbedingt, was ist. Zum Prüfen: ip a, ip route, ping, wg show… Gestrichelte Verbindungen laufen durch einen WireGuard-Tunnel.
plan-version-text = Der Plan als Liste
plan-internet = Internet
plan-your-workstation = dein Rechner
plan-here = du bist hier
plan-visit = schon verbunden
plan-not-visit = noch nicht verbunden
plan-tunnel = durch den WireGuard-Tunnel
plan-dhcp = DHCP
plan-network-internal = internes Netz
plan-note-gateway = Gateway
plan-note-wiki = Wiki
plan-note-archives = Backups
plan-note-host = Website-Hoster
plan-note-router = Router
# { $id }: the VLAN number; { $name }: its name in the configuration (offices, guests…).
plan-vlan = VLAN { $id } · { $name }
plan-note-remote-work = Homeoffice
plan-annex = Router der Außenstelle
plan-note-annex = zweiter Standort
plan-network-annex = Netz der Außenstelle

## My progress (see src/engine/progress.ts)

# The notebook's title when a name is given.
notebook-title-of = Notizbuch von { $name }
progress-button = Mein Fortschritt
progress-title = Mein Fortschritt
progress-intro = Dein Fortschritt bleibt in diesem Browser. Um auf einem anderen Rechner weiterzumachen (einem anderen Computerraum, zu Hause), nimm ihn mit dem Code oder der Datei mit. Nichts wird irgendwohin gesendet.
progress-name = Dein Name (optional)
progress-name-help = Er steht oben in deinem Notizbuch („Notizbuch von …“) und in deinen Spielständen.
progress-code-title = Der Code zum Abschreiben
progress-code-help = Er enthält die abgeschlossenen Kapitel, sonst nichts: weder das Notizbuch noch die Schlüssel, die du erstellt hast. Schreib ihn auf und tippe ihn auf dem anderen Rechner ein.
progress-copy = Kopieren
progress-code-input = Mit einem Code fortsetzen:
progress-resume = Fortsetzen
progress-file-title = Die Datei, um alles mitzunehmen
progress-file-help = Kapitel, Notizbuch, erstellte Schlüssel, ssh-Konfiguration, Bestzeiten im Prüfungsmodus. Bewahre sie auf einem USB-Stick auf oder schick sie dir selbst.
progress-download = Meinen Spielstand herunterladen
progress-file-input = Aus einer Datei fortsetzen:
progress-name-file = quetes-de-sysadmin.json
progress-downloaded = Spielstand heruntergeladen.
# { $count }: the finished chapters in the file.
progress-confirm = Diesen Spielstand fortsetzen ({ $count ->
        [one] { $count } abgeschlossenes Kapitel
       *[other] { $count } abgeschlossene Kapitel
    })? Er ersetzt alles, was in diesem Browser gespeichert ist.
progress-nothing-new = Dieser Code fügt kein Kapitel zu denen hinzu, die du hier schon abgeschlossen hast.
progress-code-unreadable = Das ist kein Fortschrittscode: Er beginnt mit QDS, gefolgt von Gruppen aus Buchstaben und Ziffern.
progress-code-mistake = Dieser Code enthält einen Tippfehler: Prüfe ihn Zeichen für Zeichen.
progress-code-too-recent = Dieser Code stammt aus einer neueren Version des Spiels: Lade die Seite neu.
progress-file-unreadable = Diese Datei ist kein lesbarer Spielstand (JSON).
progress-file-other = Diese Datei ist kein Spielstand von Sysadmin-Quests.
progress-file-too-recent = Dieser Spielstand stammt aus einer neueren Version des Spiels: Lade die Seite neu.

## The mission, the key bar, Ctrl-R

mission-button = Mission
# { $chapter }: "Chapter 2"; { $title }: its title.
mission-title = { $chapter }: { $title }
mission-instructions = Die Anweisungen
mission-journal = Was bisher geschah
mission-nothing = Noch nichts: Die Geschichte geht weiter, während du handelst.
# During tail -f or journalctl -f: the button that does Ctrl-C.
follow-stop = Stopp (Strg-C)
follow-suspend = Anhalten (Strg-Z)
keys-title = Terminal-Tasten
key-up = Vorheriger Befehl
key-down = Nächster Befehl
# What bash shows during Ctrl-R (readline).
search-history = (reverse-i-search)`{ $pattern }': { $command }

## Achievements and ranks (see src/engine/achievements.ts)

achievements-title = Erfolge
# { $earned } of { $total }: the count shown on the link.
achievements-button = Erfolge ({ $earned }/{ $total })
# Announced in the terminal when an achievement is earned.
achievements-obtained = 🏆 Erfolg: { $name }
achievements-grade = Dein Rang: { $grade }.
achievements-grade-next = Nächster Rang, { $grade }, bei { $chapters } abgeschlossenen Kapiteln.
achievements = ({ $date })
achievements-cache = Versteckter Erfolg
    .description = Eine Anspielung auf die Terminal-Kultur. Finde ihn selbst.
notebook-grade = Rang: { $grade }.
grade-intern = Praktikant·in
grade-apprentice = Sysadmin in Ausbildung
grade-junior = Junior-Admin
grade-admin = Systemadministrator·in
grade-confirmed = Erfahrene·r Admin
grade-senior = Senior-Admin
grade-sre = SRE (Site Reliability Engineer)
achievements-first-command = Erster Schritt
    .description = Führe einen ersten Befehl aus.
achievements-manual = Das Handbuch gelesen
    .description = Öffne das Handbuch (man oder apropos): der erste Reflex der Profis.
achievements-cache-ls = Was verborgen ist
    .description = Zeige die versteckten Dateien an (ls -a).
achievements-pipe = Erste Pipe
    .description = Verbinde zwei Befehle mit einer Pipe (|).
achievements-redirection = Ab in die Datei
    .description = Leite die Ausgabe eines Befehls in eine Datei um (> oder >>).
achievements-first-chapter = Erstes Kapitel
    .description = Schließe ein Kapitel ab.
achievements-eraser = Der Radierer ist gestoppt
    .description = Schließe die Geschichte des Radierers ab.
achievements-restore = Wiederherstellung getestet
    .description = Stelle ein Backup wirklich wieder her: Ein Backup, das du nie wiederhergestellt hast, ist kein Backup.
achievements-network = Der ganze Bienenstock
    .description = Schließe „Der Bienenstock“ ab: VLANs, DHCP, Firewall, VPN, Verzeichnisdienst und WLAN.
achievements-three-stories = Drei Geschichten
    .description = Schließe drei Geschichten ab.
achievements-all-stories = Die große Runde
    .description = Schließe alle Geschichten ab.
achievements-fifty-commands = Werkzeugkasten
    .description = Habe 50 Befehle in deinem Notizbuch.
achievements-exam = Prüfung bestanden
    .description = Schließe ein Kapitel im Prüfungsmodus ab.
achievements-exam-lightning = Blitzschnell
    .description = Schließe ein Kapitel im Prüfungsmodus in weniger als 5 Minuten ab.
achievements-xyzzy = Zauberwort
    .description = Das Passwort von Colossal Cave Adventure (1976), einem der ersten Textadventures.
achievements-sandwich = Mit den Rechten
    .description = Mit sudo bekommst du alles, sogar ein Sandwich (xkcd 149).
achievements-sl = Lokomotive
    .description = sl statt ls: der berühmteste Tippfehler, bestraft mit einem Zug.

## Graded hints (see src/engine/hints.ts; the hints themselves: hints-<story>.ftl)

hint-title = Brauchst du Hilfe?
hint-intro = Drei Stufen, eine nach der anderen zu öffnen: zuerst das Handbuch, wie bei der Arbeit. Die Nachbesprechung sagt, wie viele du angefordert hast.
hint-button-manual = Das Handbuch
hint-button-lead = Eine Spur
hint-button-solution = Fast die Antwort
# { $pages }: "man mv, man cp".
hint-manual = Zu lesende Seiten: { $pages }. Suche auch mit man -k und einem Stichwort.
hint-more-nothing = Keine weiteren Hinweise für dieses Kapitel: Lies die Anweisungen und das bisher Geschehene noch einmal.
## The end-of-chapter summary (see src/engine/summary.ts)
# { $time }: "6:12"; { $commands }, { $errors }, { $hints }: numbers
summary-summary = Bilanz: { $time } · { $commands ->
        [one] ein Befehl
       *[other] { $commands } Befehle
    }{ $errors ->
        [0] {""}
       *[other] {" "}({ $errors } mit Fehler)
    } · { $hints ->
        [0] keine Hinweise
        [one] ein Hinweis
       *[other] { $hints } Hinweise
    }
summary-button = Details ansehen
# { $chapter }: the chapter's title
summary-title = Bilanz: { $chapter }
summary-intro = Dein Befehl neben der Referenzlösung, Schritt für Schritt. Das Spiel prüft den Zustand der Maschine, nicht den Befehl, den du getippt hast: Ein anderer Weg ist genauso richtig, wenn er zum selben Ergebnis führt.
summary-col-step = Schritt
summary-col-you = Dein Befehl
summary-col-reference = Die Referenzlösung
summary-otherwise = (auf anderem Weg erreicht)
summary-encourage = { $hints ->
        [0] Keine Hinweise: gut gemacht. Spielst du es im Prüfungsmodus noch einmal, um deine Zeit zu schlagen?
       *[other] Nächstes Mal mit weniger Hinweisen?
    }
# Replay and compare (see src/engine/runs.ts); the comparison itself is in dialog-compare.ftl.
replay-button = Dieses Kapitel noch einmal spielen
# { $before }: the commands of the previous run of this chapter
summary-compare = Letztes Mal: { $before ->
        [one] ein Befehl
       *[other] { $before } Befehle
    }. Die Details vergleichen beide Durchgänge.
## The restore point (Mission panel; see Console.restaurer)
rescue-title = Wiederherstellungspunkt
rescue-intro = Wie ein Snapshot einer virtuellen Maschine vor einem riskanten Eingriff: Nimm einen auf, probiere deinen Schritt und kehre dorthin zurück, wenn etwas schiefgeht. Das Kapitel wird bis zu diesem Punkt nachgespielt, ohne dass sonst etwas verloren geht.
rescue-take = Snapshot aufnehmen
rescue-go-back = Zum Snapshot zurückkehren
rescue-cancel = Letzte Eingabe rückgängig machen
rescue-none = Noch kein Snapshot in diesem Kapitel.
# { $steps }: the number of inputs (commands, answers, nano saves) since the chapter started
rescue-taken = { $steps ->
        [0] Snapshot am Anfang des Kapitels aufgenommen.
        [one] Snapshot nach einer Eingabe aufgenommen.
       *[other] Snapshot nach { $steps } Eingaben aufgenommen.
    }
rescue-impossible = Hier ist kein Snapshot möglich: Das Kapitel wurde fortgesetzt oder du bist über deinen Rechner gegangen. „Dieses Kapitel neu starten“ beginnt ganz von vorn.
rescue-exam = Keine Snapshots im Prüfungsmodus.
rescue-restored = { $steps ->
        [0] ↺ Maschine wie am Anfang des Kapitels wiederhergestellt.
        [one] ↺ Maschine wie nach der ersten Eingabe des Kapitels wiederhergestellt.
       *[other] ↺ Maschine wie nach { $steps } Eingaben des Kapitels wiederhergestellt.
    }
## The autosave inside a chapter (banner above the terminal; see src/engine/autosave.ts)
autosave-title = Kapitel in Arbeit
# { $chapter }: the chapter's title; { $story }: its story's; { $steps }: the inputs (commands, answers, nano saves) kept
autosave-text = { $steps ->
        [one] Du hast „{ $chapter }“ ({ $story }) nach einer Eingabe unterbrochen. Sie wurde in diesem Browser gespeichert: Setze fort, und die Maschine ist wieder so, wie du sie verlassen hast.
       *[other] Du hast „{ $chapter }“ ({ $story }) nach { $steps } Eingaben unterbrochen. Sie wurden in diesem Browser gespeichert: Setze fort, und die Maschine ist wieder so, wie du sie verlassen hast.
    }
autosave-resume = { $steps ->
        [one] Dort weitermachen, wo ich aufgehört habe (eine Eingabe)
       *[other] Dort weitermachen, wo ich aufgehört habe ({ $steps } Eingaben)
    }
autosave-restart = Das Kapitel neu beginnen
autosave-resumed = { $steps ->
        [one] ↺ Kapitel dort fortgesetzt, wo du aufgehört hast: eine Eingabe nachgespielt.
       *[other] ↺ Kapitel dort fortgesetzt, wo du aufgehört hast: { $steps } Eingaben nachgespielt.
    }
# Above the end of the terminal shown after a resume
autosave-earlier = { $steps ->
        [one] (eine frühere Eingabe nicht angezeigt)
       *[other] ({ $steps } frühere Eingaben nicht angezeigt)
    }
autosave-changed = Das Spiel hat sich seit deinem letzten Besuch geändert: Dieses Kapitel konnte nicht so fortgesetzt werden, wie du es verlassen hast. Es beginnt von vorn.
autosave-failed = Dieses Kapitel konnte nicht fortgesetzt werden. Es beginnt von vorn.
## Themed paths ("Paths" menu; see src/engine/paths.ts)
view-paths = Lernpfade
path-choice = Wähle einen Lernpfad
path-start = Erste Schritte
    .description = Sich bewegen, lesen, suchen, aufräumen, dann das Netzwerk, git und Archive: für alle, die noch nie ein Terminal geöffnet haben.
path-security = Einen Server schützen
    .description = SSH, Firewall, fail2ban, Konten und Rechte, Geheimnisse, Updates, dann das Abschlussaudit: die Türen schließen, Ordnung halten und es beweisen.
path-web = Das Web ausliefern
    .description = nginx, Logs, Notfall-Backups, Zertifikate, gemeinsam genutzte Sites, Last und Proxys.
path-network = Netzwerke
    .description = DNS, SSH-Sprünge und Tunnel, VLANs, DHCP, nftables-Firewall, WireGuard-VPN und DMZ.
path-backups = Sichern und wiederherstellen
    .description = rsync, Archive, restic, rsnapshot, PostgreSQL-Datenbanken, Übertragungen: und immer prüfen, ob du wiederherstellen kannst.
path-deployment = Container und Deployment
    .description = git, Docker und Compose, Bare-Repositorys und Hooks, Rollback, Blue/Green, Canary und Migration.
path-production = Fehlersuche in Produktion
    .description = Ein Dienst, der nicht neu startet, eine volle Platte, Speicher, Inodes, Uhrzeit, Monitoring und das Post-Mortem.
path-identities = Konten und Identitäten
    .description = Gruppen, eine Kollegin, die geht, gemeinsame Rechte, SSH-Schlüssel, LDAP-Verzeichnis und WLAN im Unternehmen.
# { $finished } / { $total }: numbers
path-progress = { $finished } von { $total } Kapiteln erledigt
path-finished = ✓ Lernpfad abgeschlossen
# { $story }: the story's title
path-in = in „{ $story }“
path-done = ✓ Erledigt
path-open = Zu erledigen
path-next = ▶ Als Nächstes
# { $chapter }: the title of the chapter to finish first
path-locked = 🔒 Zuerst: { $chapter }
path-without-key = 🔒 Geschichte gesperrt
## On-call and the incident of the day (see src/engine/on-call.ts)
on-call-button = 🚨 Vorfall des Tages
# { $chapter }: chapter title; { $story }: story title
on-call-today = Heute: „{ $chapter }“ ({ $story })
# { $percent }: budget left
on-call-already = Heute erledigt: { $percent } % des Budgets erhalten.
# { $date }: today's date, spelled out
on-call-title = Bereitschaft, { $date }
on-call-intro = Das Bereitschaftstelefon klingelt: ein Vorfall, der behoben werden muss. Heute für alle derselbe, morgen ein anderer.
on-call-rules = Du hast ein Fehlerbudget von 30 Minuten, wie das Verfügbarkeitsziel eines Dienstes (SLA): Es schmilzt mit der Zeit, jeder Hinweis kostet 3 Minuten, jeder fehlgeschlagene Befehl 20 Sekunden. Kein Prüfungsmodus; der Wiederherstellungspunkt bleibt erlaubt (die Zeit kommt allerdings nicht zurück).
on-call-take = Den Anruf annehmen
on-call-cancel = Nicht jetzt
on-call-start = 🚨 Bereitschaft: Das Fehlerbudget beginnt zu schmelzen.
# { $time }: "24:10"; { $percent }: a number
on-call-gauge = Budget: { $time } ({ $percent } %)
on-call-exhausted = Budget aufgebraucht: SLA verletzt. Mach trotzdem fertig, der Vorfall muss behoben werden.
on-call-abandon = Bereitschaft abgebrochen: Du hast den Vorfall verlassen.
on-call-end-title = Ende der Bereitschaft
on-call-end-intro = Der Vorfall ist behoben. Hier ist deine Ergebniskarte zum Teilen (nichts wird gesendet: Du kopierst sie, wohin du willst).
on-call-copy = Karte kopieren
on-call-copied = Karte kopiert.
# The score card, like a shared word grid.
# { $date } (YYYY-MM-DD), { $chapter }, { $gauge } (five squares), { $percent }, { $time }, { $hints }, { $errors }, { $address }
on-call-map =
    Sysadmin-Quests · Bereitschaft, { $date }
    „{ $chapter }“ behoben in { $time }
    { $gauge } { $percent } % des Budgets
    { $hints ->
        [0] keine Hinweise
        [one] ein Hinweis
       *[other] { $hints } Hinweise
    } · { $errors ->
        [0] keine Fehler
        [one] ein Fehler
       *[other] { $errors } Fehler
    }
    { $address }
# The daily reminder (see src/engine/reminder.ts): the menu's button; its dialog is in dialog-reminder.ftl.
reminder-button = 📅 Tägliche Erinnerung
# A story released since the last visit (see src/engine/releases.ts): its badge in the menu.
story-new = Neu
## The on-call streak (see src/engine/streak.ts): kind, never a guilt trip.
# { $days }: the current streak, in days; { $best }: the best one
streak-today = 🔥 { $days ->
        [one] Ein Tag Bereitschaft
       *[other] { $days } Tage Bereitschaft in Folge
    } (Bestwert: { $best }). Bis morgen, wenn du Lust hast.
streak-going = 🔥 { $days ->
        [one] Ein Tag Bereitschaft
       *[other] { $days } Tage Bereitschaft in Folge
    } (Bestwert: { $best }). Der Vorfall von heute setzt die Serie fort.
# Shown with streak-going when a missed day would not break the streak.
streak-rest-ready = Kein Druck: Ein Ruhetag pro Woche unterbricht die Serie nicht.
streak-rest-used = Gestern war dein Ruhetag für diese Woche.
streak-best = Beste Serie: { $best ->
        [one] ein Tag
       *[other] { $best } Tage
    }. Eine neue beginnt mit dem Vorfall von heute.
achievements-streak-3 = Drei Nächte Bereitschaft
    .description = Löse den Vorfall des Tages drei Tage in Folge (ein Ruhetag pro Woche unterbricht die Serie nicht).
achievements-streak-7 = Eine Woche Bereitschaft
    .description = Löse den Vorfall des Tages sieben Tage in Folge (ein Ruhetag pro Woche unterbricht die Serie nicht).
achievements-streak-30 = Ein Monat Bereitschaft
    .description = Löse den Vorfall des Tages dreißig Tage in Folge (ein Ruhetag pro Woche unterbricht die Serie nicht).
achievements-without-hint = Ohne Netz
    .description = Schließe ein Kapitel ab, ohne einen Hinweis anzufordern.

## The class table (teachers' page; see src/engine/classroom.ts)

class-files = Die Spielstände der Lernenden:
class-slide = Oder zieh sie hierher, mehrere auf einmal.
class-codes = Oder ihre Codes, einer pro Zeile, nach dem Namen:
class-codes-example = Lina QDS-047G-0000-000M-G
class-codes-add = Codes hinzufügen
class-export = Tabelle herunterladen (CSV)
class-empty = Tabelle leeren
class-name-file = klassenuebersicht.csv
class-table = Die Klasse
class-account = { $count ->
        [0] Noch keine Lernenden.
        [one] Eine Person.
       *[other] { $count } Personen.
    }
# { $source }: the file or line; { $reason }: what is wrong.
class-error = { $source }: { $reason }
class-col-student = Name
class-col-chapters = Kapitel
class-col-grade = Rang
class-col-achievements = Erfolge
class-col-exam = Beste Prüfung
class-col-date = Gespeichert
class-col-streak = Bereitschaftsserie
class-col-best-streak = Beste Bereitschaftsserie
class-separator = Trennzeichen:
class-separator-comma = Komma (,)
class-separator-semicolon = Semikolon (;)
class-print = Tabelle drucken
class-local = Die CSV-Datei und der Ausdruck entstehen in diesem Browser aus der Tabelle unten: Nichts wird irgendwohin gesendet.
# CSV headers: the chapters finished (a number), a story's (a number), a chapter's (1 finished, 0 not).
class-csv-chapters = Abgeschlossene Kapitel (von { $total })
class-csv-story = { $story } (von { $total })
class-csv-chapter = { $story } { $number }: { $chapter } (1 = abgeschlossen)

## The terminal display

display-theme = Terminal-Design
display-theme-phosphor = Phosphor
display-theme-amber = Bernstein
display-theme-contrast = Hoher Kontrast
display-theme-paper = Papier
display-more-small = A− (kleinere Schrift)
display-more-big = A+ (größere Schrift)
display-colours = Farben
display-focus = Vollbild
display-quit-focus = Vollbild verlassen (Esc)

## Difficulty of a chapter or a story (1 to 5, see difficulty.ts)
difficulty = Schwierigkeit: { $level } von 5
difficulty-tidy = Schwierigkeit: { $min } bis { $max } von 5

## Tips: one-time advice, shown when a shortcut or a habit would help (see tips.ts)

tip-label = Tipp
tip-silence = Keine Meldung? Unter Linux sagt ein erfolgreicher Befehl meistens nichts. Prüfe das Ergebnis selbst: ls zeigt, wo die Dinge jetzt sind.
tip-up-twice = Mehrere Ebenen nach oben? cd ../.. geht zwei auf einmal hoch (und ../../.. drei).
tip-cd-back = Zurück dorthin, wo du gerade warst? cd - bringt dich ins vorherige Verzeichnis, egal welcher Pfad.
tip-cd-home = Nach Hause? cd allein, oder cd ~, bringt dich von überall dorthin.
tip-tab = Lange Namen zu tippen? Drück Tab: Es vervollständigt den Namen für dich. Zweimal gedrückt, listet es die möglichen Varianten auf.
tip-net-tools = ifconfig, route und netstat gehören zu net-tools, das unter Debian nicht mehr installiert ist: ip a zeigt die Adressen, ip r die Routen, ss -tlnp, wer lauscht.
display-tips = Tipps
display-tour = Einführung
display-autosave = Automatisch speichern
display-autosave-title = Das laufende Kapitel in diesem Browser behalten, um es fortzusetzen, falls die Seite geschlossen wird

## The notebook's button and window

notebook-button = Notizbuch
notebook-close = Schließen

## The navigation cheat sheet, at the top of the notebook

shortcuts-title = Nützliche Abkürzungen
shortcuts-home = dein Home-Verzeichnis (cd ~, oder cd allein)
shortcuts-back = das vorherige Verzeichnis (cd -)
shortcuts-up = das Verzeichnis darüber (cd ..); zwei Ebenen höher: cd ../..
shortcuts-tab = vervollständigt einen Namen; zweimal gedrückt, listet es die Varianten
shortcuts-history = die vorherigen Befehle; Strg-R durchsucht sie
shortcuts-cancel = verwirft die Zeile oder stoppt einen Befehl, der weiterläuft

## The intro tour, on a first visit

tour-label = Erste Schritte
tour-step = { $step } von { $total }
tour-next = Weiter
tour-done = Los geht's
tour-skip = Einführung überspringen
tour-input = Tippe deine Befehle hier ein und drück dann die Eingabetaste. Es ist ein echtes Terminal: Der Text darüber sagt dir, was du zuerst tippen sollst.
tour-mission = Mission: was du in diesem Kapitel tun musst, was schon passiert ist, und Hinweise, wenn du nicht weiterkommst.
tour-map = Karte: die Orte, die du schon besucht hast, um den Weg zurückzufinden.
tour-notebook = Notizbuch: Jeder Befehl, den du ausführst, wird hier notiert, mit dem, was er tut. Dein Spickzettel.
tour-tab = Tab vervollständigt die Namen von Befehlen, Verzeichnissen und Dateien für dich: Tippe die ersten Buchstaben, dann Tab. Zweimal gedrückt, listet es die Varianten.

# A story loads the first time it is opened (its chapters and texts).
loading-story = {$story} wird geladen…
loading-failed = Dieser Teil des Spiels konnte nicht geladen werden: Prüfe deine Verbindung und versuche es dann noch einmal.

## Screen readers (see docs/ACCESSIBILITY.md and src/engine/announce.ts)
# The name of the terminal's output (a log: each new output is read once)
output-label = Terminal-Ausgabe
# A heading for screen readers (visually hidden) before the terminal
terminal-heading = Terminal
# Read with the command line, after its name and the prompt
input-help = Tab vervollständigt; Escape und dann Tab verlässt die Zeile nach vorn, Umschalt+Tab nach hinten; Alt+R liest die letzte Ausgabe noch einmal vor.
# A button shown when it has the focus, at the top of the terminal
reread-button = Die letzte Ausgabe noch einmal vorlesen (Alt+R)
reread-empty = Der letzte Befehl hat nichts ausgegeben.
# Before a long output read again: only its end is read
reread-cut = { $lines } Zeilen; hier die letzten { $shown }:
follow-announce-start = Der Befehl läuft weiter und zeigt neue Zeilen: alle zehn Sekunden eine Zusammenfassung. Strg-C oder Escape stoppt ihn.
follow-announce-watch = Der Bildschirm aktualisiert sich selbst: Alt+R liest ihn vor. Strg-C oder Escape stoppt ihn.
follow-announce-lines =
    { $count ->
        [one] Eine neue Zeile: { $line }
       *[other] { $count } neue Zeilen; die letzte: { $line }
    }
follow-announce-screen = Der Bildschirm hat sich geändert: Alt+R liest ihn vor.
chapter-done-announce = Kapitel abgeschlossen: { $chapter }. Seine Bilanz steht am Ende des Terminals; Escape und dann Tab erreicht die Schaltflächen danach.
continuation-announce = Der Befehl ist nicht fertig: Tippe seine nächste Zeile oder Strg-C, um ihn zu verwerfen.
# The network diagram's box (it scrolls sideways on a narrow screen); its text version follows it
plan-diagram-label = Netzwerkschema (seine Textfassung folgt)
shortcuts-escape-tab = verlässt die Befehlszeile zu dem, was nach dem Terminal kommt (Tab allein vervollständigt)
shortcuts-shift-tab = verlässt die Befehlszeile zu dem, was davor kommt
shortcuts-reread = liest die letzte Ausgabe noch einmal vor, für Screenreader
