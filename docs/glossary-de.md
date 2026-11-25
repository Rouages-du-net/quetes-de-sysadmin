# German glossary (de)

The term choices of the German translation, one line each, so that every
translator writes the same word for the same thing, and a native reviewer
can check them in one place. Add to it when you choose a term; change a
choice here first, then everywhere it is used (`grep -rn` in `src/texts/de/`).

Register: standard German, informal **du** (capitalised only at the start of
a sentence: „Du hast …“, „… wenn du willst“). Inclusive through neutral
phrasing first (Lehrkräfte, Lernende, die Person, Admins, Ehrenamtliche),
the middle dot only where nothing neutral exists (Administrator·in,
Spender·innen). Prose quotes are „…“, nested ‚…‘. Typed names (files,
places, machines, passwords) have no ä, ö, ü or ß: ae, oe, ue, ss.

## The game

- Sysadmin Quests → **Sysadmin-Quests** (the product name)
- story → **Geschichte**; chapter → **Kapitel**; quest sheet → **Steckbrief** (teachers' page); handout → **Arbeitsblatt**
- debrief → **Nachbesprechung**; summary (end of chapter) → **Bilanz**
- hint → **Hinweis**; lead → **Spur**; learning path → **Lernpfad**
- achievement → **Erfolg**; rank → **Rang**; exam mode → **Prüfungsmodus**
- notebook → **Notizbuch** („Sysadmin-Notizbuch“); progress → **Fortschritt**; save (file) → **Spielstand**
- incident of the day → **Vorfall des Tages**; on call → **Bereitschaft**; error budget → **Fehlerbudget**; streak → **Serie**
- restore point → **Wiederherstellungspunkt**; snapshot → **Snapshot**
- workstation (the player's machine) → **Rechner** (host name `rechner`)
- class table → **Klassenübersicht**; teachers → **Lehrkräfte**; students → **Lernende**, **Schüler·innen** where it is a school
- translation in progress (banner) → **Übersetzung in Arbeit**
- The Eraser → **Der Radierer** (account `radierer`); the player's account `you` → **du**
- place (a directory in the Eraser's world) → **Ort**; object (a file there) → **Objekt**

## Systems vocabulary

- file → **Datei**; directory, folder → **Verzeichnis** (never „Ordner“ in prose, except for Windows' graphical side)
- path → **Pfad**; home directory → **Home-Verzeichnis** („dein Zuhause“ in the Eraser's world)
- permissions → **Rechte**; owner → **Besitzer**; group → **Gruppe**; the others → **die anderen**
- user (an account) → **Benutzer**; account → **Konto**; password → **Passwort** (Kennwort only when quoting Windows)
- log → **Log** (plural Logs); the journal (systemd) → **Journal**
- backup → **Backup** (noun), **sichern** (verb); restore → **wiederherstellen**; the Eraser's chapter 4 „The Backup“ → **Die Sicherung**
- server, service → **Server**, **Dienst**; daemon → **Daemon**; unit → **Unit**
- firewall → **Firewall**; rule → **Regel**; port → **Port**; to listen → **lauschen**
- deployment → **Deployment**, to deploy → **deployen**; release → **Release**; rollback → **Rollback**
- repository → **Repository** (plural Repositorys); branch → **Branch**; commit → **Commit**
- pipe → **Pipe**; redirection → **Umleitung**; exit code → **Rückgabewert**
- manual page → **Handbuchseite**; the manual → **das Handbuch**
- disk → **Platte**; to mount → **einhängen**; mount point → **Einhängepunkt**
- certificate → **Zertifikat**; certificate authority → **Zertifizierungsstelle**
- hosting provider → **Hoster**; load balancer → **Load Balancer**; UPS → **USV**
- terminal keys: Ctrl → **Strg**, Shift → **Umschalt**, Enter → **Eingabetaste**

## Tools' own messages

The game prints, in German, what the real tools print with `LANG=de_DE.UTF-8`
(Translation Project catalogues, git's po/de.po), and keeps English where
the tool does or where the other drafts do (systemctl, OpenSSH, apt, docker,
adduser, git's commit summary „1 file changed“). Main forms:

- No such file or directory → **Datei oder Verzeichnis nicht gefunden**
- Permission denied → **Keine Berechtigung**; Is a directory → **Ist ein Verzeichnis**; Not a directory → **Ist kein Verzeichnis**
- Operation not permitted → **Die Operation ist nicht erlaubt**
- command not found → **Befehl nicht gefunden**
- Try 'ls --help' for more information. → **„ls --help“ liefert weitere Informationen.**
- ls: cannot access 'x' → **ls: Zugriff auf 'x' nicht möglich**
- syntax error near unexpected token → **Syntaxfehler beim unerwarteten Symbol »x«**
- [sudo] password for → **[sudo] Passwort für**; Sorry, try again. → **Sorry, versuchen Sie es noch einmal.**
- Usage: → **Aufruf:** (the game's own usage lines too)
- man page sections → **BEZEICHNUNG, ÜBERSICHT, BESCHREIBUNG, OPTIONEN, BEISPIELE, SIEHE AUCH**
- yes in answers: **j** / **ja** accepted next to y (coreutils' `-i`, ufw, nano's „Ja“ key J)
- `help`, the game's list of commands → **hilfe** (`command-help`)
- dates: `ls -l` as GNU ls in German („20. Nov 14:54“, glibc's month abbreviations), `date` „Mi 25. Nov 14:54:00 CET 2026“, sysstat's header „25.11.2026“; numbers through Intl („1,5K“)

## Names to check with a native reviewer

- Machine names: `rechner` (desk), `koenigreich`, `ameisenhaufen`, `buergerhaus`, `genossenschaft`, `notenlinien` (stave), `zaunstieg` (stile), `steinmann` (cairn), `helling` (slipway), `sicherung` (belay), `kessel` (kettle), `schloss` (padlock).
- Story titles: „Der Radierer“, „Der Äther“ (The Airwaves), „Der Zettelkatalog“, „Der Nachtlauf“ (The Night Batch), „Die alte Sonne“, „Die Mieterinitiative“ (The Tenants' Union), „Die Werkzeugbibliothek“ (The Tool Library), „Spam“ (Junk Mail).
- The Eraser's world: `Huette`, `Huegel`, `SignalSchule`, `Uebungsraum`, `Muelleimer` (the Bin), `ziel = /Koenigreich/Muelleimer`, `flickerin.txt` (mender), `.ersatzbirne`.
- Passwords: `sonnenblume`, `butter-brezel-91` (butter-brioche), `expressschlinge-42` (quickdraw), `vorsicht-feuchtigkeit-24` (mind-the-damp).

## Stories group 3

(The Bastion, The Other Unix, The Old Sun, The Night Batch, The Order Book,
Next Door Windows, The Music School, The Card Catalogue, The Pantry, The
Ferry, The Bike Share; also the shared chapters The Bulletin, The Departure,
The Report.)

- email headers → **Von:**, **An:**, **Betreff:**; forwarded → **WG:**, reply → **AW:**
- incident (the write-up) → **Incident** in file headings, **Vorfall** in prose; containment → **Eindämmung**; eradication → **Beseitigung**; hardening → **Härtung**
- watchdog (a process) → **Wachhund**; miner → **Miner**; way back (persistence) → **Hintertür**
- drop-in (a configuration fragment) → **Drop-in**; default-deny → **standardmäßig verweigern**
- fingerprint (key) → **Fingerabdruck**; signature → **Signatur**; keyring → **Schlüsselbund**
- finding (audit) → **Befund**; leaver → **ausscheidende Person**, plural **Ausscheidende**
- service bureau (mainframe) → **Rechenzentrum**; record (fixed-width) → **Satz**; header / trailer record → **Kopfsatz** / **Schlusssatz**; packed decimal → **gepackte Dezimalzahl**; wrapper script → **Wrapper-Skript**; rehearsal → **Probe**
- return code → **Rückgabewert** (also the chapter title); exit code → **Exit-Code**
- IBM i: inquiry message → **Abfragenachricht**; job log → **Jobprotokoll**; job queue → **Jobwarteschlange**; spooled file → **Spooldatei**; output queue → **Ausgabewarteschlange**; save file → **Sicherungsdatei**; save-while-active → **Sichern bei aktivem System**; history log → **Protokoll (History Log)**; library → **Bibliothek**; green screen → **grüner Bildschirm**
- Windows: share → **Freigabe**; share/NTFS permissions → **Freigabe-/NTFS-Berechtigungen**; inheritance → **Vererbung**; scheduled task → **geplante Aufgabe**; Task Scheduler → **Aufgabenplanung**; event log → **Ereignisprotokoll**; logon type → **Anmeldetyp**; service account → **Dienstkonto**; password manager → **Passwortmanager**; vault → **Tresor**; Recycle Bin (AD) → **AD-Papierkorb**; domain controller → **Domänencontroller**; Group Policy → **Gruppenrichtlinie**; security filtering → **Sicherheitsfilterung**; link (GPO) → **Verknüpfung**; global / domain local group → **globale / domänenlokale Gruppe**. Values, group, share and folder names, cmdlets and their outputs stay English, as the English-language Windows prints them (as fr and es do).
- HR ticket → **Personalticket**; arrival / departure → **Eintritt** / **Austritt**
- LUKS: key slot → **Schlüsselplatz**; key file → **Schlüsseldatei**; passphrase → **Passphrase**; mapping → **Mapping**; treasurer → **Kassenwartin**; restore drill → **Wiederherstellungsübung**
- IPv6: link-local → **link-lokal**; router advertisement → **Router-Ankündigung**; neighbour discovery → **Nachbarerkennung**; serial (DNS zone) → **Seriennummer**; secondary → **Secondary**
- Prometheus: target → **Target**; scrape → **scrapen**; alerting rule → **Alarmregel**; alert fires → **geht los (firing)**; silence → **Stummschaltung**; on call → **Bereitschaft**; to page → **anpiepen**
- Chapter titles: „Der Alarm“, „Eindämmung“, „Beseitigung“, „Härtung“, „Das Bulletin“, „Der Abschied“, „Der Bericht“, „Das Skript, das nicht mehr lief“, „Hier gibt es kein systemd“, „Die letzte Regel gewinnt“, „Erst lesen, dann anfassen“, „Bytes in falscher Reihenfolge“, „Erst vertrauen, dann umschalten“, „Feste Breite“, „Rückgabewert“, „Die verspätete Datei“, „Warten auf Antwort“, „Papier, das niemand druckt“, „Gesichert, bis auf eine“, „Unsichtbare Zeichen“, „Die Freigabe nebenan“, „Die andere Seite“, „Zwei Schlösser“, „Ausgesperrt“, „Die Logflut“, „Das stille Backup“, „Kommen und Gehen“, „Das alte Passwort“, „Die Richtlinie, die nicht greift“, „Türen und schlafende Konten“, „Die verlorene Platte“, „Der Zweitschlüssel“, „Die Wiederherstellungsübung“, „Die neue Karte“, „Die andere Tür“, „In beide Richtungen“, „Der tote Winkel“, „Der Schwellenwert“, „Ruhezeiten“. Cross-references used: „Der Wächter“ (The Sentinel), „Das Verzeichnis“ (The Directory), „Die Wache“, „Das Audit“.
- Shared with groups 1 and 2: chapter-firewall.ftl is taken unchanged from group 1; chapter-bulletin, chapter-departure and chapter-report (also in The Watch, The Co-op, The Audit) are translated here.
