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
