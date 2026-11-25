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

## Manual wave 1 (a2dismod to journalctl)

- synopses: lowercase German placeholders as in the first pages (datei, ort, konto, gerät, muster); uppercase ones stay uppercase (DATEI, MUSTER, GERÄT, GRÖSSE, ZEICHENKETTE, JJJJ-MM-TT)
- Reserved for root / Root only → **Nur für root.**
- reload → **neu laden**; restart → **neu starten**; reboot → **Neustart**; boot → **Booten** (noun **Bootvorgang** where it is counted)
- package → **Paket**; update → **Aktualisierung**; upgrade → **Upgrade**; candidate → **Kandidat**; dependency → **Abhängigkeit**
- site (web) → **Site**; virtual host → **virtueller Host**; snippet (Apache conf) → **Konfigurationsschnipsel**; request → **Anfrage**; header → **Header** (HTTP), **Kopf der Antwort** for -I
- mail queue → **Warteschlange**; sender, recipient → **Absender**, **Empfänger**
- key pair → **Schlüsselpaar**; private / public key → **privater / öffentlicher Schlüssel**; passphrase → **Passphrase**; keyring → **Schlüsselbund**; fingerprint → **Fingerabdruck**
- certificate signing request → **Zertifikatsanforderung (CSR)**; issuer → **Aussteller**; holder (subject) → **Inhaber**; intermediate certificate → **Zwischenzertifikat**; revocation list → **Sperrliste (CRL)**; to revoke → **widerrufen**
- RAID array → **Verbund**; member → **Mitglied**; degraded → „degraded“; rebuild → **Wiederaufbau**
- physical volume, volume group, logical volume → **physisches Volume**, **Volume-Gruppe**, **logisches Volume**; extent → **Extent**
- file system → **Dateisystem**; device → **Gerät**; label → **Bezeichnung**; to unmount → **aushängen**; emergency mode → **Notfallmodus**
- unit file → **Unit-Datei**; override (drop-in) → **Override** (das); timer → **Timer**; start limit → **Startgrenze**; control groups → **Control Groups**
- link (network) → **Link**; interface → **Schnittstelle**; bring up / down → **hochbringen / herunternehmen**; gateway → **Gateway**; neighbour discovery → **Nachbarerkennung**; link-local → **Link-Local-Adresse**
- chain, table, policy (firewall) → **Kette**, **Tabelle**, **Richtlinie**; connection tracking → **Verbindungsverfolgung**; exchange (conntrack) → **Austausch**
- snapshot (restic, rsnapshot) → **Snapshot**; deduplication → **Deduplizierung**; dress rehearsal → **Generalprobe**
- replica → **Replikat**; primary → **Primärserver**; binary log → **Binärlog**; statement (SQL) → **Anweisung**; query → **Abfrage**; row → **Zeile**
- LDAP directory → **Verzeichnis** (LDAP-Verzeichnis); entry → **Eintrag**; access point → **Zugangspunkt**; shared secret → **gemeinsames Geheimnis**
- signal → **Signal**; parent process → **Elternprozess**; zombie → **Zombie**; load average → **Durchschnittslast**; snapshot (top) → **Momentaufnahme**
- supplementary groups → **zusätzliche Gruppen**; subordinate uids → **untergeordnete uids**; to lock / unlock (a password) → **sperren / entsperren**; to expire (an account) → **ablaufen lassen**
- here-document → **Here-Document**; subshell → **Subshell**; parameter expansion → **Parametererweiterung**; escape sequence → **Escape-Sequenz**
- monitoring plugin → **Überwachungs-Plugin**
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
## Manual wave 3

From `Remove-GPO` to `apparmor_d`: Group Policy, LUKS, shell builtins and
jobs, compression, small tools, CUPS, Forgejo, libvirt, keepalived/HAProxy,
Dovecot/rspamd, NUT, Garage/aws/rclone, OpenTofu, OpenBao, SOPS/age, the rhel
family (dnf, firewalld, SELinux), rootless Podman, AppArmor. Synopsis
placeholders are German capitals (DATEI, GERÄT, VERZEICHNIS, BENUTZER,
PASSWORT, SCHLÜSSELDATEI, ABBILD, GRÖSSE…), or lowercase where the English is
lowercase (datei, befehl, ziel).

- GPO link → **Verknüpfung**; link order → **Verknüpfungsreihenfolge**; enforced → **erzwungen**; block inheritance → **Vererbung blockieren**; security filtering → **Sicherheitsfilterung**; trustee → **Berechtigter (Trustee)**; resultant set of policy → **Richtlinienergebnissatz**; Group Policy → **Gruppenrichtlinien**; domain controller → **Domänencontroller**; workstation (Windows) → **Arbeitsplatz**
- device → **Gerät**; key slot → **Schlüsselplatz (Key Slot)**; key file → **Schlüsseldatei**; passphrase → **Passphrase**; mapping (dm-crypt) → **Zuordnung (Mapping)**; header → **Header**; label (file system) → **Label**
- fingerprint (checksum) → **Fingerabdruck**; to unmount → **aushängen**
- shell built-in → **eingebauter Befehl der Shell**; positional parameters → **Positionsparameter**; job → **Job**; to linger (loginctl) → **verweilen**; service manager → **Dienstmanager**; user namespace → **User-Namespace**; subordinate ids → **untergeordnete IDs**; to chown → **übereignen**
- print job → **Druckauftrag**, **Auftrag**; queue → **Warteschlange**; default destination → **Standardziel**; driverless → **treiberlos**; to enable/disable a queue → **aktivieren/deaktivieren**
- scrape (Prometheus) → **abfragen**; target → **Ziel**; alert → **Alarm**; firing → **feuernd**; silence → **Silence** (kept); receiver → **Empfänger**; sample → **Messwert**; recording/alerting rule → **Aufzeichnungsregel/Alarmregel**
- forge → **Forge**; collaborator → **Mitwirkende**; protected branch → **geschützter Branch**; run (CI) → **Lauf**; token, scope, secret → **Token**, **Scope**, **Secret** (kept)
- guest (VM) → **Gast**; disk image → **Abbild** (Plattenabbild); backing chain → **Backing-Kette**; overlay → **Overlay**; to flatten → **flachklopfen**; dry run → **Probelauf**
- advertisement (VRRP) → **Ankündigung (Advertisement)**; node → **Knoten** (Kubernetes: **Node**); check (health) → **Prüfung**; drain → kept
- mailbox → **Postfach**; envelope → **Umschlag (Envelope)**; Trash → **Papierkorb**
- UPS → **USV** (plural USVs); kill power command → **Abschaltbefehl**; forced shutdown → **erzwungenes Herunterfahren**; power restore policy → **Richtlinie bei Stromrückkehr**; primary/secondary (NUT) → kept
- bucket, layout, remote (rclone) → kept; web endpoint → **Web-Endpunkt**; website access → **Website-Zugriff**
- state (OpenTofu) → **State**; drift → **Drift**; to adopt (import) → **übernehmen**
- seal / unseal (OpenBao) → **Siegel**, **versiegeln**/**entsiegeln**; key share → **Schlüsselanteil**; vault → **Tresor**; policy (OpenBao) → **Policy**
- data key (SOPS) → **Datenschlüssel**; recipient (age) → **Empfänger**; identity → **Identität**
- runtime / permanent (firewalld) → **Laufzeitkonfiguration** / **permanente Konfiguration**; rich rule → **Rich Rule**
- denial (SELinux) → **Verstoß**; relabel → **Relabeling**, **neu labeln**; boolean → **Boolean**; policy (SELinux, AppArmor) → **Richtlinie**
- profile (AppArmor) → **Profil**; confined/unconfined → **eingeschränkt/uneingeschränkt**; enforce/complain mode → **Modus enforce/complain** (kept); attachment → **Anhang (Attachment)**
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
## Stories group 5

The Climbing Wall, The Dance Troupe, The Shelter, The Language Café, The
Mapping Party, The Walking Club, The Zine Library, The Tenants' Union, The
Hostel (with The Firewall and On Call's Memory, which their catalogue lists).

- drill (power, restore) → **Übung**; power cut → **Stromausfall**; flicker → **Flackern**; outage that lasts → **anhaltender Ausfall**
- UPS primary / secondary → kept as NUT's **primary** / **secondary**; power restore policy → **Power-Restore-Policy**; battery quick test / deep test → **Schnelltest** / **Tiefentest**; waiver → **Haftungsverzicht**
- bucket, website access, presigned URL → **Bucket**, **Website-Zugriff**, **vorsignierte URL**; node, zone, layout → **Knoten**, **Zone**, **Layout**; key (access key) → **Schlüssel**; dry run → **Probelauf**
- disaster recovery plan → **Notfallwiederherstellungsplan**; owner (of a service) → **verantwortliche Person**, column **Verantwortlich**; restore beside → **daneben wiederherstellen**; post-incident review → **Nachbetrachtung** (blameless: **ohne Schuldzuweisung**); timeline / actions → **Zeitleiste** / **Maßnahmen**
- the plan's durations: German units are read by the engine (`24h`, `2 Tage`, `1 Woche`, `4 Std`, `30 Minuten`)
- runtime / permanent configuration (firewalld) → **Laufzeitkonfiguration** / **permanente Konfiguration**; rich rule → **Rich Rule**; label, relabel → **Label**, **Relabel** / **neu kennzeichnen**; boolean → **Boolean**
- state, drift, lock (OpenTofu) → **State**, **Drift**, **Sperre**; record set → **Record Set**; mirror → **Mirror**
- subordinate ids → **untergeordnete IDs**; user namespace → **User-Namespace**; to linger → **lingern** (Linger); service manager → **Dienstmanager**
- confined / unconfined → **eingeschränkt** / **uneingeschränkt**; complain / enforce mode → **Complain-Modus** / **Enforce-Modus**
- recipient (sops) → **Empfänger**; data key → **Datenschlüssel**; creation rule → **Creation Rule**; to rotate → **rotieren**; leaked → **durchgesickert**
- sealed / unseal → **versiegelt** / **entsiegeln**; key share → **Schlüsselteil**, **Teil**; threshold → **Schwelle**; root token → **Root-Token**; policy → **Policy** (plural Policys); orphan token → **Orphan-Token**
- story titles: „Die Kletterhalle“, „Die Tanzgruppe“, „Das Tierheim“, „Das Sprachcafé“, „Die Mapping-Party“, „Der Wanderverein“, „Die Zine-Bibliothek“, „Die Mieterinitiative“, „Die Herberge“; chapters to check: „Der letzte Ausfall“, „Der Reihe nach“, „Die Kopie außer Haus“, „Keine Berechtigung, aber…“, „Ganz ohne root“, „Raus aus dem Offenen“, „Nur was nötig ist“
- proper names kept: Overhang (the hall), Kestrel Dance Company, Old Mill, Common Tongue, Hillside, Riverbend, Open Paths; the shelter's animals are given German names (Keks, Pfeffer…)
## Stories group 4

The Pool, The Staff Room, The Airwaves, The Tool Library, The Health
Centre, The Blood Drive, The Choir, The Allotments, The Lifeboat (and the
shared chapters The Public Bucket, The Firewall).

- Kubernetes words stay English: **Pod**, **Deployment**, **ReplicaSet**, **Service**, **Ingress**, **Secret**, **ConfigMap**, **Namespace**, **Node**, **Rolling Update**, **Rollout**; readiness probe → **Readiness-Probe**; requests and limits → **Requests**, **Limits**; manifest → **Manifest**
- print queue → **Warteschlange**; print job → **Auftrag**; driverless → **treiberlos**; MFP → **Multifunktionsgerät**; staff room → **Lehrerzimmer**; the staff → **das Kollegium**
- certificate authority → **Zertifizierungsstelle**; intermediate CA → **Zwischenzertifizierungsstelle**, its certificate **Zwischenzertifikat**; issuing CA → **ausstellende CA**; root → **Root**; revocation list → **Sperrliste** (CRL); to revoke → **sperren**; trust store → **Speicher** (of trusted authorities); leaf → **Blatt**
- forge → **Forge**; maintainer → **Maintainer** (plural Maintainer); collaborator → **Collaborator**; force-push → **Force-Push**; personal access token → **persönliches Zugriffstoken**; branch protection → **Schutzregel**; status check → **Status-Check**; supply chain → **Lieferkette**; typosquatting → **Typosquatting**; checksum → **Prüfsumme**; signed release → **signiertes Release**
- hypervisor → **Hypervisor**; guest → **Gast**; domain → **Domain**; disk image → **Image**; backing chain → **Backing-Kette**; overlay → **Overlay**; to merge (blockcommit) → **zusammenführen**; bridge → **Bridge**
- failover → **Umschaltung**; load balancer → **Load Balancer**; advertisement (VRRP) → **Advertisement**; to preempt → **präemptieren**; health check → **Health-Check**; to drain → **drainen**; split brain → **Split Brain**
- retention policy → **Aufbewahrungsrichtlinie**; GDPR → **DSGVO** (Artikel 5 Absatz 1 Buchstabe e); right of access → **Auskunftsrecht** (request: **Auskunftsersuchen**); right to erasure → **Recht auf Löschung**; data breach → **Datenpanne**; purge → **Bereinigung**; phone tree → **Telefonkette**; DPO → **Datenschutzbeauftragte**
- replica → **Replica**; primary → **Primary**; slow query log → **Slow Query Log**; least privilege → **geringste Rechte**; scratch database → **Schmierdatenbank**
- mailbox → **Postfach**; Trash → **Papierkorb**; bounce → **Rückläufer**, **abweisen**; out-of-office reply → **Abwesenheitsnotiz**; spam score → **Punktzahl**; threshold → **Schwelle**
- Places: Riverside Pool → **Uferbad**; Millbrook Health Centre → **Gesundheitszentrum Mühlbach**; Lindenvale Blood Service → **Blutspendedienst Lindental**; Riverside Community Choir → **Chor am Fluss** (addresses „…, Am Fluss“); Greenholme Allotments Association → **Kleingartenverein Grünholm**; Seaholme Lifeboat → **Rettungsstation Seaholme**; the Airwaves Federation → **Äther-Verbund**; Kestrel Dance Company → **Tanzkompanie Kestrel**, the Old Mill → **Alte Mühle**
- The Choir's members (`choir-members`): the people the plot names keep their names (Amara Okafor, Kenji Watanabe, Priya Raman id 27, Tomas Novak id 41), some others are German (Gesine Hartmann, Jonas Brandt, Clara Vogel, Bernd Kühn, Lukas Schäfer, Hannah Weiß, Ulrike Möller); phones stay in Ofcom's drama range (07700 900xxx), mail at mail.example, voices Alt, Bass, Sopran, Tenor
- The forge account `you` is **du** in German (`du@lendshed.example`)
