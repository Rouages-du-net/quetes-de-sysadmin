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

## Stories group 1

The Data Centre, The Lost Packet, The Time Machine, The Archives, The
Neighbourhood Letters, The Workshop, The Gazette, The Game Library, On Call,
The Community Centre, The Co-op.

- chapter titles: Erster Tag, Zweiter Tag, Die Nacht des Neustarts, Der große Brand, Das Zertifikat ist abgelaufen; Tür zu, Die Firewall, Der Wächter (sentinel), Eine Wohngemeinschaft (sharing a home), Bei mir geht's, Konzertabend, Der Port, Wiederholungstäter, Das Repair-Café; Das Update, Die Komposition, Das Loch in der Firewall, Alle Macht; Das nackte Repository, Zurückrollen, Blau und Grün, Der Kanarienvogel, Die Migration; Das Lösegeld, Die Snapshots, Die Datenbank; Die volle Platte, Der Speicher, Die Inodes, Die Uhr, Die Sonde, Das Post-Mortem, Der Engpass; Die Schlüssel, Der Sprung, Der Tunnel, Die Übertragungen, Der Webhoster; Der Abschied, Gemeinsame Rechte, Das Geheimnis, Der Proxy, Die Updates, Automatische Updates
- recovery plan (DRP) → **Notfallplan (NFP)** (file `NFP.txt`)
- release notes → **Versionshinweise**; health check → **Gesundheitsprüfung**; slot (blue/green) → **Slot**, blau/grün; canary → **Kanarienvogel**
- bare repository → **Bare-Repository**; working copy → **Arbeitskopie**; snapshot (git, the Time Machine) → **Schnappschuss**; snapshot (restic, rsnapshot) → **Snapshot**
- to fix forward → **nach vorn reparieren**; expand/contract → **erweitern/verkleinern**
- post-mortem → **Post-Mortem**; blameless → **ohne Schuldzuweisung**; timeline → **Zeitverlauf**; actions → **Maßnahmen** (the template's headings: Zusammenfassung, Zeitverlauf, Auswirkung, Ursachen, Was gut lief, Maßnahmen; placeholder „(zu ergänzen“)
- probe → **Sonde**; drill → **Übung** (Störungsübung); false alarm → **Fehlalarm**; threshold → **Schwelle**
- on-call shift → **Bereitschaft**; outage → **Störung**, **Ausfall**; bottleneck → **Engpass**; memory leak → **Speicherleck**; parent process → **Elternprozess**
- listeners (radio) → **Hörerschaft**; readers → **Leserschaft**; patrons (library) → **Leserschaft**
- gateway → **Gateway**; bastion → **Bastion-Host**; jump → **springen**; tunnel → **Tunnel**; web host → **Webhoster**; shared hosting → **Shared Hosting**
- key pair → **Schlüsselpaar**; passphrase → **Passphrase**; host key → **Hostschlüssel**; fingerprint → **Fingerabdruck**
- dry run → **Probelauf**; to roll back → **zurückrollen**; to switch over → **umschalten**
- jail (fail2ban) → **Jail**; ban → **sperren**, **Sperre**; repeat offender → **Wiederholungstäter**; rate limit → **Ratenbegrenzung**; burst → **Burst**
- virtual host → **virtueller Host**; reverse proxy → **Reverse Proxy**; trailing slash → **Schrägstrich am Ende**
- ransom note → **Lösegeldforderung**; encryptor → **Verschlüsseler**; offline backup → **Offline-Backup**; read-only → **nur lesend**
- statement (till) → **Abrechnung**; payment key → **Zahlungsschlüssel**; till → **Kasse**
- the radio → **Radio Viertel** (unit descriptions keep their English words, like French); the media library → **Mediathek im Viertel**; the newspaper's site → **Die Stadtteilzeitung** (typo „Stadtteilzeitunng“)
- identifiers kept in English as Spanish does: the Kiosk's migration `rename_subscribers_mail_to_email` and its columns `subscribers.mail`
- typed words of these stories (not in names.ftl): the till's `ZAHLUNG_SCHLUESSEL`, `anmelden`, `zahlung`, `schluessel_widerrufen`; the wiki admin's `/admin/freigeben/`, `/admin/ablehnen/`; the game library's columns `id,name,exemplare`, `id,karte,viertel`, `id,spiel_id,mitglied_id,ausgeliehen_am,zurueck_am`; the ransomware's option `--leise`, the USB label `SICHERUNG`; the post-mortem's alert subject `Radio-Alarm`; Lina's host `werkstatt`
