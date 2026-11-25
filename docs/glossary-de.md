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

## Stories group 2

The Hive, The Audit, The Lab, The Watch, Junk Mail, The Fleet, The Patch,
The Canteen, The Observatory, The Theatre, The Huts, The Photo Club.

- e-mail headers: From / To / Subject → **Von: / An: / Betreff:**; the player as recipient → **dich**
- the end of a debrief: „Gut gemacht! Du hast das Kapitel „…“ abgeschlossen.“; sections **WAS PASSIERT IST, GUTE PRAXIS, EIN ANDERER WEG, DOKUMENTATION**
- finding (audit) → **Befund**; scope → **Rahmen** („außerhalb des Rahmens“); letter of engagement → **Auftragsschreiben**; auditor → **Auditorin** (Salomé), **Auditor·innen** in general
- follow-up visit → **Nachprüfung**; closing report → **Abschlussbericht**; hardening (index) → **Härtung**, **Härtungsindex**; evidence → **Beweise**
- exposure → **Exposition**; to probe (nmap) → **prüfen**; persistence (intrusion) → **Persistenz**; beacon → **Funkfeuer**; intruder → **Eindringling**
- security watch → **Sicherheitsbeobachtung**, **Beobachtung** (file `beobachtung.md`); bulletin → **Bulletin**; fix (a CVE) → **Korrektur**, **beheben**; score (CVSS) → **Wert**; not applicable → **Nicht zutreffend**
- template placeholder „(to complete…“ → **„(zu vervollständigen…“** (the reviews look for it)
- array (RAID) → **Array**; rebuild → **Neuaufbau**; serial number → **Seriennummer**; emergency mode → **Notfallmodus**; logical volume → **logisches Volume**; extent → **Extent**
- boot → **Bootvorgang**, **booten**; reboot → **Neustart**; drop-in → **Drop-in**; target (systemd) → **Target**; start limit → **Startlimit**
- load average → **Durchschnittslast**; nice value → **nice-Wert**; quota (CPUQuota) → **Kontingent**; soft / hard limit → **weiches / hartes Limit**; worker → **Worker**; stacking (astrophotography) → **Stacking**
- signal (TERM, KILL) → **Signal**; to catch → **abfangen**; stale PID file → **verwaiste PID-Datei**
- ticket office → **Ticketkasse**; seat map → **Saalplan**; opening night → **Premiere**; standby / primary (PostgreSQL) → **Standby / Primärserver**; to promote → **befördern**; failover → **Umschaltung**; default privileges → **Standardrechte**
- share (Samba) → **Freigabe**; export (NFS) → **Export**; mount (noun) → **Einhängen**; squashed (root_squash) → **gestutzt**
- rule order (rsyslog) → **der Reihe nach**; template (rsyslog) → **Vorlage**; journal limit → **Limit**
- trunk / tagged / native VLAN → **Trunk / getaggt / natives VLAN**; lease (DHCP) → **Lease**; range → **Bereich**; reservation → **Reservierung**; zone → **Zone**; chain (nft) → **Kette**; destination translation → **Zieladressübersetzung**; connection tracking → **Verbindungsverfolgung**; access point → **Zugangspunkt**; shared secret → **gemeinsames Geheimnis**; directory (LDAP) → **Verzeichnis**, **Verzeichnisdienst**; peer → **Peer**; site → **Standort**
- playbook, task, handler, inventory → **Playbook, Task, Handler, Inventar**; rehearsal (--check) → **Generalprobe**; idempotence → **Idempotenz**
- SPF / DKIM / DMARC: policy → **Richtlinie**; alignment → **Ausrichtung**; aggregate report → **Sammelbericht**; selector → **Selektor**; checker (mail) → **Prüfdienst**; junk folder → **Spam-Ordner**; serial (DNS zone) → **Seriennummer**

Names chosen in these stories (check with a native reviewer):

- Story chapters: „Der Rahmen“, „Der Bericht“, „Die Exposition“, „Die Spuren“, „Die Nachprüfung“ (The Audit); „Die müde Platte“, „Die neue Platte“, „Der Platz wird knapp“, „Der hängende Neustart“ (The Lab); „Das Bulletin“, „Die Priorität“, „Die Korrektur“, „Ohne Beweis keine Gewissheit“, „Eine Routine einrichten“ (The Watch); „Der Briefträger“, „Die Signatur“, „Die Richtlinie“ (Junk Mail); „Das Inventar“, „Das Playbook“, „Die Generalprobe“ (The Fleet); „Das Schloss“ (The Patch); „Die Startreihenfolge“, „Die Neustart-Schleife“, „Der langsame Start“, „Die verspätete Platte“ (The Canteen); „Hohe Last“, „Das Kontingent“, „Zu viele offene Dateien“, „Der hängende Prozess“ (The Observatory); „Premiere“, „Die langsame Abfrage“, „Nur lesen“, „Die Umschaltung“ (The Theatre); „Die Logs sammeln“, „Das volle Journal“, „Fehlgeschlagene Anmeldungen“ (The Huts); „Das geteilte Verzeichnis“, „Wem gehören die Dateien?“, „Die Laptops“ (The Photo Club); „VLANs“, „DHCP“, „Die Zonen“, „Homeoffice“, „Die DMZ“, „Die Nebenstelle“, „Der Verzeichnisdienst“, „Das WLAN der Büros“ (The Hive); shared chapters „Die Firewall“, „Der Abschied“ (The Co-op).
- Chapters of other stories quoted before their translation (to align when they are translated): „Die Sonde“ (The Probe), „Der Wächter“ (The Sentinel), „Automatische Updates“ (Automatic Updates).
- Plays of The Theatre: „Die Schneekönigin“, „Der Leuchtturmwärter“, „Die zwölf Geschworenen“.
- Ansible handler of The Fleet: `Neuladen ssh` / `neuladen ssh` (one word before „ssh“, as the test expects).
- Host name in The Co-op's keys: `lina@werkstatt`; the canteen's bookings header `uhrzeit;name;personen`.
