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

## Manual wave 2

The manual pages from `reboot` to `New-GPO` (network and firewall, logs,
NFS and Samba, FreeBSD, Solaris, IBM i, bytes and character sets, Windows
and PowerShell, Active Directory). Placeholders in synopses are translated
when they are words (`datei`, `ADRESSE`, `KONTO`), kept when technical
(`PID`, `GLOB`, `<String[]>`); option and parameter names never.

- load average → **mittlere Last**; nice value → **nice-Wert**; soft/hard limit → **weiche/harte Grenze**
- jail (fail2ban) → **Jail**; ban → **Sperre**, **sperren**; letter of engagement → **Auftragsschreiben**; hardening index → **Härtungsindex**
- facility / severity (syslog) → **Facility** / **Schweregrad**; drop-in → **Drop-in**
- share (SMB, NFS) → **Freigabe**; export (NFS) → **Export**; to share → **freigeben**
- record (data) → **Datensatz**; packed decimal → **gepackte Zahl**; character set → **Zeichensatz**; encoding → **Codierung**
- IBM i (as in IBM's German CL documentation): job queue → **Jobwarteschlange**; message queue → **Nachrichtenwarteschlange**; output queue → **Ausgabewarteschlange**; spooled file → **Spooldatei**; data area → **Datenbereich**; save file → **Sicherungsdatei**; library → **Bibliothek**; member → **Teildatei**; history log → **Protokoll** (QHST); inquiry message → **Anfragenachricht**; save while active → **Sichern im aktiven Zustand**; operator → **Bediener**
- Windows, as Microsoft's German documentation says it: folder → **Ordner** (on Windows pages only); drive → **Laufwerk**; event log → **Ereignisprotokoll**; display name → **Anzeigename**; logon account → **Anmeldekonto**; Task Scheduler → **Aufgabenplanung**; scheduled task → **geplante Aufgabe**; registry key → **Registrierungsschlüssel** (the registry itself: **Registry**); security descriptor → **Sicherheitsbeschreibung**; provider → **Anbieter**; wildcard → **Platzhalter**; cmdlets „ruft … ab“ (Get-), „legt … an“ (New-)
- Active Directory: domain controller → **Domänencontroller**; forest → **Gesamtstruktur**; organizational unit → **Organisationseinheit** (OU); domain local group → **lokale Domänengruppe**; Recycle Bin → **Papierkorb**; resultant set of policy → **Richtlinienergebnissatz**; Group Policy object → **Gruppenrichtlinienobjekt** (GPO); lockout → **Sperre**
- The player's Windows profile `C:\Users\you` → `C:\Users\du`; the machine `cabinet` in commands and account names → `schrank`, `SCHRANK\alice`
- Kept in English, as the tools print them: messages and states of Windows, PowerShell, SMF, IBM i and OpenSSH quoted in the pages („Access is denied“, „completed normally“, „The property already exists.“)
