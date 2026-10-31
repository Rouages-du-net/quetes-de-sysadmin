# Sysadmin Quests — instructions for Claude

An educational browser game to learn Linux system administration (see
`README.md`, `CONTRIBUTING.md`, `docs/SCENARIOS.md` and `docs/ROADMAP.md`).
An **independent** project: all the code and documentation are in this
repository (it was born in Les rouages du net, but no longer depends on it).
It must embed in any website (`docs/EMBEDDING.md`): assume nothing about the
host page.

The game is published at **https://sysadmin.rouages.net**: a 100 % static
site (no Node server, no database), hosted like rouages.net. English at
`/en/`, French at `/fr/`; the root sends each browser to its language
(`public/.htaccess`).

These rules apply to every contributor, human or agent; `CONTRIBUTING.md`
presents them for people.

## Languages

- **English first.** English is the reference language of the game's texts
  (`LANGUE_DE_REFERENCE` in `src/textes/index.ts`): a text is written in
  English first, and every key exists in English (`tests/textes.test.ts`).
  English is also the default and fallback language.
- **The repository is in English**: documentation, code comments, commit
  messages and pull requests. French versions are kept for `README.fr.md`,
  `CONTRIBUTING.fr.md` and `docs/INTEGRER.md` (keep them in step with the
  English ones); every other document is in English only.
- **Code in English, over time.** Most identifiers are still French
  (`langue`, `chapitre`, `histoire`, `moteur/`, `Chapitre.evenements`…).
  Write new code (files, functions, variables, props, CSS classes, new
  `.ftl` keys) in English; rename what you touch when it stays focused,
  never a large rename mixed with a feature. A public name (attribute of
  the element, URL) gets its English form first and keeps the French one
  as an alias.
- Inclusive writing with the middle dot when natural, in French texts
  (« administrateur·rice »). Simulated command outputs stay in English when
  the real tool answers in English.
- Licences: code under **GPL v3 or later** (`LICENSE`), texts under
  **CC BY-SA 4.0** (`LICENSE-CONTENUS.txt`); every contribution complies.

## Structure and commands

- Site: **Astro** (`astro.config.mjs`, `output: 'static'`, `compressHTML`
  disabled as on rouages.net). Pages in `src/pages/` (`en/`, `fr/`, and the
  root `index.astro`, a language choice for servers without the `.htaccess`
  redirection), layout `src/layouts/Base.astro`, site styles
  `src/styles/site.css`, Apache config `public/.htaccess` (HTTPS, language
  at the root, redirects of the old French URLs, cache, CSP, CORS of the
  embeddable file).
- `src/moteur/` (the engine): simulated shell (`shell.ts`), commands
  (`commandes/`, including the manual: `manuel.ts`, `pages.ts`), world
  (`monde.ts`), stories (`chapitres/`). No dependency on the DOM.
- `src/moteur/systemd.ts`: a machine's services, journal and clock
  (`systemctl`, `journalctl`, `reboot` in `commandes/systemd.ts`).
- `src/moteur/sshd.ts`: a machine's SSH server (`sshd_config` read like
  OpenSSH, configuration applied on reload).
- `src/moteur/parefeu.ts`: a machine's firewall (ufw rules; `ssh` runs into
  it).
- `src/moteur/fail2ban.ts`: a machine's fail2ban (configuration, sshd,
  nginx-limit-req and recidive jails, bans, the jail's `port`; `ssh` runs
  into it). `src/moteur/apercu-nft.ts`: what `nft list ruleset` shows under
  ufw and fail2ban.
- `src/moteur/cron.ts`: crontabs (parsed like cron) and the simulated night.
- `src/moteur/nginx.ts`: a machine's nginx (configuration read and checked
  like `nginx -t`, applied on reload; `curl` talks to it); `apt` and the
  `nginx` command in `commandes/apt.ts`.
- `src/moteur/apache.ts`: a machine's Apache (Debian's configuration read
  like `apache2ctl configtest`, virtual hosts, `.htaccess` and
  `AllowOverride`, `mod_rewrite`); reached by nginx and `curl` like an app
  (`etat.applis`); the package's `/etc/apache2` in `apache-debian.ts`;
  `apache2ctl`, `a2ensite`, `a2enmod`… in `commandes/apache.ts`.
- `src/moteur/courrier.ts`: a machine's mail (Postfix: `main.cf`, the
  queue, `/var/log/mail.log`; OpenDKIM: `opendkim.conf`, key, signing as
  mail goes through the milter; SPF, DKIM and DMARC checked by the servers
  on the other side with the simulated DNS); `postconf`, `postfix`,
  `postqueue`, `mailq`, `postsuper`, `opendkim-genkey`, `opendkim-testkey`
  in `commandes/courrier.ts`; `chapitres/jardins.ts`: what the chapters of
  "Le courrier indésirable" share.
- `src/moteur/ansible.ts`: Ansible (a subset of YAML, `ansible.cfg`, INI
  inventory, modules, `become`, `--check`, `--diff`, handlers, PLAY RECAP);
  connections go through `connecterSansQuestion` in `acces.ts` (like
  BatchMode); `ansible`, `ansible-playbook`, `ansible-inventory`,
  `ansible-doc` in `commandes/ansible.ts`; `chapitres/flotte.ts`: what the
  chapters of "La flotte" share.
- `src/moteur/caddy.ts`: a machine's Caddy (`etat.caddy`: Caddyfile read
  like the adapter, `caddy fmt`, automatic HTTPS with a simulated ACME
  authority that DNS and the firewall can block, JSON logs, what Caddy
  answers to `curl`); `caddy` in `commandes/caddy.ts`.
- `src/moteur/tls.ts`: certificates (PEM files the game can read);
  `certbot` and `openssl` in `commandes/certbot.ts` (the HTTP-01 challenge
  goes through the simulated nginx).
- `src/moteur/dns.ts`: DNS (BIND zones, primary, secondary, resolver
  cache); `dig`, `host`, `named-checkzone`, `rndc` in `commandes/bind.ts`.
- `src/moteur/docker.ts`: a machine's Docker (images, containers, layer,
  volumes, published ports, `--restart`, the container's user and rights on
  mounted directories); the apps of the images are declared by the chapters
  (`APPLIS`); the command in `commandes/docker.ts`. Docker Compose
  (`compose.yaml`, `.env`, the project's network) in `src/moteur/compose.ts`.
- `src/moteur/script.ts`: a small `/bin/sh` for git hooks and scripts
  (`sh`, `./script`, `test`, `date` in `commandes/scripts.ts`); git (bare
  repositories, `push`, hooks) in `commandes/git.ts`, `diff` in
  `commandes/diff.ts`.
- `chapitres/kiosque.ts`: the app of La Gazette's deployment chapters
  (blue/green, `/health`, migration, simulated visits); nginx can balance
  between several servers (`upstream`).
- `commandes/disques.ts` (`lsblk`, `mount`, `umount`, `etat.peripheriques`),
  `commandes/rsnapshot.ts`, `src/moteur/postgres.ts` and
  `commandes/postgres.ts` (`psql`, `pg_dump`, `pg_restore`, `createdb`,
  `dropdb`).
- `src/moteur/ouverts.ts` (files held open by a service: `lsof`, space of
  deleted files), `commandes/journaux.ts` (`lsof`, `truncate`,
  `logrotate`); `src/moteur/memoire.ts` (process memory, OOM killer,
  `MemoryMax=`) and `commandes/memoire.ts` (`free`, `top`, `dmesg`); systemd
  overrides (`systemctl edit`, `set-property`, `daemon-reload`) in
  `commandes/systemd.ts`. Disk I/O (`etat.io`: requests, scheduler,
  `IO*BandwidthMax=`, ionice classes) in `src/moteur/entrees-sorties.ts`,
  `iostat`, `pidstat`, `ionice` in `commandes/iostat.ts`. Inodes: a medium
  of `etat.montages` may declare `inodes` (and `inodesBase`); `df -i`,
  `du --inodes`, `find -mtime` (the files' `mtime`); the ARG_MAX limit in
  `shell.ts`. A machine's time (time zone, drifting clock, NTP) in
  `src/moteur/heure.ts`, `timedatectl` in `commandes/heure.ts`. Hand-written
  units and systemd timers, and time passing minute by minute
  (`passerTemps`, timers and cron) in `src/moteur/minuteries.ts`; the
  machine living while you play (`Chapitre.activite`, `vivre()`) in
  `src/moteur/activite.ts`, following with `tail -f`/`journalctl -f`
  (`Shell.suivi`, `Console.suivre()`, `interrompre()` for Ctrl-C);
  monitoring (`check_disk`, `check_http`, `check_procs`, outside the PATH),
  `mail` and `last` in `commandes/supervision.ts`. A command can set its
  exit code (`jeu.statut`).
- `src/moteur/stockage.ts`: a machine's storage (`etat.stockage`: disks and
  SMART, GPT partitions, RAID 1 arrays, `/proc/mdstat`, the rebuild that
  progresses before each command, `Chapitre.avantCommande`); `smartctl`,
  `mdadm`, `sfdisk`, `grub-install` and `lsblk` on this model in
  `commandes/stockage.ts` (including `mdadm --create`); LVM (`stockage.lvm`:
  PVs, VGs, LVs in segments, file system size) in `src/moteur/lvm.ts`,
  `pvs`, `vgs`, `lvs`, `pvcreate`, `pvremove`, `vgextend`, `vgreduce`,
  `pvmove`, `lvextend`, `resize2fs`, `update-initramfs` in
  `commandes/lvm.ts`; `/etc/fstab` (reading, `UUID=`/`LABEL=` sources, boot
  and emergency mode: `etat.demarrerMontages`, `etat.continuerDemarrage`
  called by `reboot`, `systemctl default` and `exit`) in
  `src/moteur/fstab.ts`, `mount -a` in `commandes/disques.ts`, `blkid` and
  `findmnt` in `commandes/fstab.ts`; `chapitres/labo.ts`: what Le Labo's
  chapters share.
- `commandes/restic.ts`: restic repositories (snapshots, deduplication,
  `forget` policies, `prune`), kept in `etat.restic`.
- `src/moteur/deverrouillage.ts`: stories open in waves; an added story
  declares in `chapitres/index.ts` (`apres`) the chapters to finish before
  receiving its key (`prerequis()` for tests).
- `src/moteur/difficulty.ts`: each chapter's difficulty, 1 to 5, computed
  from what comes before it in the game and from its size (nothing to set
  by hand); shown as stars in the menu, the learning paths and the
  teachers' sheets.
- `src/moteur/console.ts`, `machines.ts`, `poste.ts`: the simulated network
  (and the rescue snapshot, `Console.restaurer`: the engine stays
  deterministic, no `Date.now` nor `Math.random`); you start from the
  workstation and `ssh` to each story's machine (`commandes/ssh.ts`).
- `src/moteur/acces.ts`: the "real" ssh (machines with `etat.sshReel` and
  a story's internal machines, `Chapitre.hotes`): `~/.ssh/config`,
  `ProxyJump`, `known_hosts`, `authorized_keys`, passphrase, password;
  `ssh-copy-id` and `scp` in `commandes/transferts.ts`, remote `rsync` in
  `commandes/sauvegarde.ts`. `sftp` (interactive session) in
  `commandes/sftp.ts`; shared FTPS hosting (`src/moteur/hebergeur.ts`,
  declared by the story) and `lftp` in `commandes/lftp.ts`. The console
  keeps a stack of internal sessions (`interieur`);
  `Chapitre.surveillePoste` checks events after commands typed on the
  workstation.
- `src/moteur/sudoers.ts`: sudo's policy (`/etc/sudoers`, `@includedir`,
  rules); `visudo` and `sudo -l` in `commandes/sudoers.ts`; `userdel`,
  `gpasswd`, `chage` in `commandes/comptes.ts`; `umask` (the session's mask,
  `Shell.masque`) and setgid applied on creation (`placer`).
- `chapitres/caisse-web.ts`: La Coopérative's site and till app (simulated
  Express: `.env` read at start, `trust proxy`, locks per address); nginx
  passes `proxy_set_header` to the app (`Demande`), and `grep` reads
  regular expressions (`versRegexBasique`).
- `commandes/tmux.ts`: a machine's tmux sessions (`etat.tmux`,
  `Shell.tmux`; the console copies what is displayed) and `uname`;
  `apt upgrade` and `dpkg --configure -a` in `commandes/apt.ts`
  (`etat.apt.mises`, `etat.noyau`, `etat.coupureReseau`: the connection
  drops, `Shell.coupure`); `unattended-upgrade` and `apt-config` in
  `commandes/unattended.ts`, apt's configuration (`apt.conf.d`) in
  `src/moteur/aptconf.ts`.
- `src/moteur/lan.ts`: a router's local network (`etat.lan`: interfaces,
  802.1Q VLANs on a trunk, the switch's devices, `/etc/network/interfaces`
  read like ifupdown); `ip`, `ifup`, `ifdown`, `dnsmasq --test` in
  `commandes/lan.ts`; DHCP (`dnsmasq.ts`: configuration, leases, log);
  `ping` goes through this model when the machine has one.
- `src/moteur/nftables.ts`: a router's nftables firewall (`etat.nft`:
  tables, chains, rules read like `nft`, a packet's path, NAT, the devices'
  traffic `Lan.flux`); `nft`, `sysctl` (`/proc/sys` is a directory of the
  world) and `conntrack` in `commandes/nftables.ts`.
- `src/moteur/wireguard.ts`: a router's WireGuard (`etat.wg`: keys,
  `wg0.conf` read like wg-quick, remote peers `Lan.distants` and their
  handshake); `wg`, `wg-quick` and the `wg-quick@NAME` service in
  `commandes/wireguard.ts`.
- `src/moteur/ldap.ts`: an OpenLDAP directory (`etat.ldap`: entries, LDIF,
  reduced schema, filters, `{SSHA}`); `ldapsearch`, `ldapadd`,
  `ldapmodify`, `ldapdelete`, `ldappasswd`, `ldapwhoami`, `slappasswd`,
  `slapcat` in `commandes/ldap.ts`.
- `src/moteur/radius.ts`: FreeRADIUS (`etat.radius`: configuration read at
  start, `clients.conf`, ldap module, `users` file, access points' requests
  and VLANs); `freeradius` and `radtest` in `commandes/radius.ts`.
- `chapitres/audit.ts`: what the chapters of "L'Audit" share (Le Fournil's
  server: accounts, `sshd_config`, sudoers, `mondeFournil`, the network nmap
  sees, `sectionsMd` to reread a player's document); `perimetre.ts`,
  `rapport.ts`, `exposition.ts` (Redis's `bind` read on restart, by the
  service), `traces.ts` (ssh's log and `last` written by `initialiser`, key
  fingerprints, Nadia's crontab, the database password: `ALTER ROLE` and
  `.env` read when the app starts) and `contre-visite.ts`.
- `src/moteur/scan.ts` and `commandes/nmap.ts`: nmap on the network declared
  by the story (`etat.scan`: machines, services, scope; `etat.scans` keeps
  each scan); `src/moteur/lynis.ts` and `commandes/lynis.ts`: Lynis
  (findings read from the machine's state, `/var/log/lynis-report.dat`).
- `chapitres/veille.ts`: what the chapters of "La Veille" share (the
  `petrin` server, six months after "L'Audit": accounts, `mondeVeille`, the
  fictitious `CVE-2099-NNNNN` of the bulletin); `bulletin.ts`,
  `priorite.ts`, `correctif.ts`, `preuve.ts` (an earlier attempt in nginx's
  access log) and `routine.ts` (`unattended-upgrades` restricted to
  security via `src/moteur/aptconf.ts`, a hand-written timer or cron job,
  `src/moteur/minuteries.ts`).
- `src/interface/`: the interface (`jeu.ts`, function `monter()`, the
  `nano` editor in `editeur.ts`, the sysadmin's notebook whose logic is in
  `src/moteur/carnet.ts`, the links to rouages.net after a chapter in
  `src/moteur/rouages.ts`, the map of known places whose logic is in
  `src/moteur/carte.ts`, and its "Network" tab: the planned network
  diagram, declared by each chapter in `Chapitre.plan`, see
  `src/moteur/plan.ts`; "My progress", the short code and the save file, in
  `src/moteur/progression.ts`: an added chapter goes at the end of
  `ORDRE_DU_CODE` and of `tests/progression/ordre.txt`; achievements and
  rank in `src/moteur/succes.ts`, easter eggs in `OEUFS` of `shell.ts`;
  command-line highlighting in `src/moteur/coloration.ts` (it follows the
  game's shell: `decouper()`, `connues()`), output colours (ANSI
  sequences, `Shell.couleurs`, `--color`) in `src/moteur/couleurs.ts`: an
  event condition reads `derniere.sortie`, already without colours; on-call
  duty and the incident of the day in `src/moteur/astreinte.ts` (drawn from
  the date by the interface; the engine doesn't read the time), the
  learning paths in `src/moteur/parcours.ts` (an added chapter goes in at
  least one path, `tests/parcours.test.ts` checks it), the end-of-chapter
  summary in `src/moteur/bilan.ts` (`Shell.franchies`, `commandesTapees`),
  graduated hints in `src/moteur/indices.ts`, their texts in
  `src/textes/<language>/indices-<story>.ftl`: every new chapter has some,
  `tests/indices.test.ts` checks it) and styles (`styles.css`, everything
  under `.qds`, colours in `--qds-*` variables).
- `src/element.ts`: the `<quetes-de-sysadmin>` element (Shadow DOM);
  attributes `lang`, `story`, `save-key`, `theme="light|dark"` (the French
  names `langue`, `histoire`, `cle`, `theme="clair|sombre"` still work).
- `src/pages/en/teachers.astro` and `src/pages/fr/enseignants.astro`: the
  quest sheets (component `src/components/Fiches.astro`), computed by
  `src/moteur/fiches.ts` (new commands, prerequisites, time) and
  `src/moteur/difficulty.ts`. The class table (`/en/teachers/class/`,
  `/fr/enseignants/classe/`, component `Classe.astro`,
  `src/interface/classe.ts`, logic in `src/moteur/classe.ts`) reads the
  students' saves in the browser.
- `src/textes/<language>/*.ftl`: every text (Fluent), loaded by
  `src/textes/index.ts` (`traducteur()`, `typographie()`); `noms.ftl`: the
  names of places and objects of chapters with `noms: true` (in the code,
  `chemin()` and `nom()` of `monde.ts`; in tests, `dansLaLangue()`);
  `machines.ftl`: the machines' names (royaume → kingdom; `nomMachine()`,
  `hoteDansLaLangue()` of `machines.ts`, `Shell.nomHote`; in tests,
  `machinesDansLaLangue()`); `mots-de-passe.ftl`: the stories' passwords
  (`motDePasse()` of `monde.ts`). Internal names (chapter, place and machine
  identifiers) are the French ones.
- `tests/quetes.test.ts`: each chapter replayed; `tests/navigateur.mjs`:
  Chromium, 1000 and 375 px, the CSP of `.htaccess` applied, the root's
  language choice, the 404 page, embedding in another page.
- Deployment: `.github/workflows/deploy.yml` (tests on each PR, FTPS and a
  check of the live site from `main`, including the root's redirections);
  see `docs/DEPLOYMENT.md`. Every new resource must respect the CSP (no
  inline script).

```bash
npm install
npm test                    # Vitest
npm run dev                 # http://localhost:4321
npm run build               # Astro site (dist/) + embeddable file (dist/integration/) + tsc
npm run preview &           # http://localhost:4340, then:
npm run test:navigateur
```

**Texts**: every displayed text (story, dialogue, debrief, message, `man`
page) goes in `src/textes/en/*.ftl` first, then its translations
(`src/textes/fr/*.ftl`…) (Fluent format), never in the code; the code calls
`t('id', { variable })` or `jeu.t(...)`. How-to: `docs/TRANSLATING.md`.
`tests/textes.test.ts` fails if accented French remains in `src/moteur/` or
`src/interface/`, or if a key is missing in a language.

## Workflow

- **Open a PR automatically at the end of each piece of work**, to `main`.
- If the branch's previous PR was merged, start again from an up-to-date
  `main`.
- Before pushing: `npm test` and `npm run build` must pass; for any visible
  change, check in Chromium (Playwright,
  `executablePath: '/opt/pw-browsers/chromium'`, `args: ['--headless=new']`),
  including at 375 px wide, with no console error.
- Every quest has a **test that replays it** to the end (the expected
  solution), plus at least one false lead. The tests' scenarios use the
  French names (translated by `dansLaLangue()`) and check texts in French.
- Never run `pkill -f` with a pattern that appears in its own command line;
  stop a server by its PID.

## Game rules

- **100 % static**, simulated and deterministic: no real machine, no real
  network, no request to the outside.
- **Real commands, real behaviours**: names, common options, exit codes and
  messages faithful to the tool. Every deliberate difference goes in the
  documentation's table of differences.
- **The manual first**: every simulated command has its `man` page (NAME,
  SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, SEE ALSO), answers `--help`, and
  appears in `man -k` / `apropos`. An unknown option gives the real message
  ("Try 'ls --help' for more information"). The game's hints point to the
  manual rather than giving the answer.
- **Objectives checked on the state of the simulated system**, not on the
  exact command typed: several correct solutions must pass.
- **Every quest ends with a debrief**: what happened, the good practice, a
  link to the tool's official documentation.
- **Safe examples**: documentation addresses (RFC 5737, RFC 3849),
  `.internal` names for internal machines and networks (ICANN, 2024),
  `.example` for anything public: sites, DNS, email (RFC 6761); never an
  invented name that could exist. Security quests stay defensive: protect,
  detect, repair.
- **Credit**: keep the mention "inspired by Terminus, created at MIT by
  Shawn Conrad and Michele Pratusevich" and the link to the original. Don't
  reuse the original's places, texts or puzzles.

## Translations (planned: German, Spanish, Mandarin, Korean…)

The game will be translated into more languages. All code must allow it:

- **No text in the code**: stories, dialogues, debriefs, game messages and
  `man` pages live in `src/textes/<language>/*.ftl` (**Fluent** format,
  English the reference, default and fallback language); the code only uses
  identifiers (see `docs/TRANSLATING.md`).
- **Plurals, numbers and dates** through Fluent (selectors, which rely on
  `Intl`) or `Intl` directly, never by concatenation. A technical number
  (PID, port, raw size) is passed as text: `String(pid)`.
- **No sentence built from pieces**: one whole sentence per key, with named
  variables (`{ $file }`), because word order changes from one language to
  another.
- **Translatable names of places and objects**, but always easy to type:
  plan for each language names with no hard-to-type character, and test
  Tab completion.
- **Command outputs**: they imitate the real tool in the system's language
  (`LANG`), as on a real Linux; technical identifiers (commands, options,
  system paths) are never translated.
- **Non-Latin scripts** (Chinese, Korean…): a layout that supports wide
  characters in the simulated terminal (column alignment), fonts served by
  the site or system fonts, never a third-party font.
- **Layout**: allow for texts up to 40 % longer than in English; correct
  `lang` on the page; plan for the writing direction if a right-to-left
  language is added.
- The tests replay every quest in every available language.

## Accessibility and privacy

- Playable with the keyboard; outputs announced to screen readers; AA
  contrast; `prefers-reduced-motion` respected; usable on mobile.
- No tracker, no ads, no third-party resource (fonts and scripts served by
  the site). Progress in `localStorage`, with no account.
- Never put real personal data in the quests.

## Accuracy

- The behaviour of the simulated tools (ufw, fail2ban, nginx, docker,
  restic…) is based on their **official documentation**; cite the page used
  in a comment or in the debrief.
- Note in the documentation what is simplified.
