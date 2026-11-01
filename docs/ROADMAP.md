# Sysadmin Quests — roadmap

*Learn the job of a system administrator by playing, in the browser, with
real commands and real behaviours.*

A project that grew out of "Terminus en français"
([rouages.net](https://rouages.net/jeux/terminus/), code in
`src/scripts/terminus/` of the
[Rouages-du-net/rouages.net](https://github.com/Rouages-du-net/rouages.net)
repository), itself **inspired by
[Terminus](https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html),
created at MIT by Shawn Conrad and Michele Pratusevich**. The new project
keeps this credit and the link to the original.

---

## Principles

- **100 % static**, in the browser: no real machine, no real network.
  Everything is simulated (files, services, network, time), deterministically
  and testably.
- **Real commands, real behaviours**: same names, same common options, same
  outputs (in English when the real tool answers in English). Every
  deliberate difference is listed in a table.
- **One quest = one realistic incident or mission**: a ticket, a goal
  checkable on the state of the simulated system (not on the exact command
  typed), one or more accepted solutions.
- **You also learn the "why"**: every quest ends with a short debrief (what
  happened, the good practice, the link to the official documentation).
- **Safe**: documentation addresses (RFC 5737, 3849), `.example` domains, no
  real target; security quests stay defensive.
- **Accessible**: keyboard, screen readers (announced output), AA contrast,
  reduced motion, usable on mobile (virtual keyboard).
- **Local progress** (`localStorage`), no account, no tracker.
- **English first** (the game started in French), with the texts kept apart
  from the code so it can be translated (German, Spanish, Mandarin,
  Korean…).
- **Licences**: code under GPL v3 or later, texts under CC BY-SA 4.0.
- **Learning to help yourself**: `man`, `--help`, `man -k`/`apropos` and
  `whatis` everywhere, from the first quest; puzzles that can only be solved
  by reading the manual; faithful error messages that point to `--help`.

---

## Phase 0 — Foundations of the new repository

- [x] Take over the engine of Terminus en français (shell, commands, manual,
      world, five stories) in `src/engine/`: the project no longer depends
      on rouages.net
- [x] Standalone interface (`src/interface/`) and embeddable
      `<quetes-de-sysadmin>` element (Shadow DOM, attributes `story`,
      `save-key`, `theme`, `lang`, colours in CSS variables); guide
      `docs/EMBEDDING.md`
- [x] **Extract the texts** of the stories, commands, manual and interface
      into `.ftl` files, in the standard **Fluent** format (Weblate,
      Pontoon); no text in the code, checked by the tests; guide
      `docs/TRANSLATING.md`
- [x] Name, "inspired by Terminus (MIT)" credit, README, CLAUDE.md
      (instructions for the dedicated agent)
- [x] Licences: GPL v3 (code), CC BY-SA 4.0 (texts)
- [x] Contribution guide (format of a quest, tests, review):
      `CONTRIBUTING.md`
- [x] Stack: **Astro** site (static pages), game in TypeScript with no
      framework (the `<quetes-de-sysadmin>` element, also built alone by
      Vite for embedding); Vitest tests (each chapter replayed) and
      Playwright check (`tests/browser.mjs`, also in CI)
- [x] Static deployment to **sysadmin.rouages.net**: workflow
      `.github/workflows/deploy.yml` (FTPS from `main`, check of the live
      site), `.htaccess` (HTTPS, cache, CSP, CORS), 404 page; guide
      `docs/DEPLOYMENT.md`
- [x] Create the subdomain on cPanel and set the FTP secrets
- [x] Redirect the old `rouages.net/jeux/terminus/` page to
      sysadmin.rouages.net (or embed the element there)
- [x] Rewrite chapters 1 and 2 in a world of our own (done in rouages.net on
      17 October 2026: "Lighthouse Island" and "The Village")
- [x] Progress: rouages.net players (key `rouages-terminus`, another domain)
      start from scratch; announce it on the old page

## Phase 1 — An engine of simulated "machines"

The engine used to simulate **one** machine. Administration quests need
several.

- [x] **One world**: each story becomes a machine of the same simulated
      network, and you go from one to another with `ssh`
      (`ssh fourmiliere`). Finishing the Eraser gives the keys to the first
      machines; the others open in waves (`after`, `unlocking.ts`).
      The story menu stays available (accessibility, teachers, embedding
      with the `story` attribute); a single progress.
- [x] **Several hosts**: each with its file system and name, prompt
      `user@host:~$` (`console.ts`, `machines.ts`, `workstation.ts`)
- [x] Accounts specific to each machine; a machine's state is kept between
      two ssh connections (while the page is open)
- [x] Services and ports specific to each machine (`ss`, `nc`, systemd
      services and their sockets described by each chapter)
- [x] **Simulated network**: addresses, open ports, name resolution
      (`/etc/hosts`, DNS), routes, latency; what a firewall lets through
      (ufw, nftables), a router's local network (VLAN, DHCP, NAT, VPN)
- [x] **Services** (simulated `systemd`, `src/engine/systemd.ts`): state,
      start, failure, enabling at boot, `systemctl`, `journalctl`,
      `reboot`; quest "The night of the reboot" (Datacenter, chapter 3)
- [x] Dependencies between services (`After=`, `Requires=`, `Wants=`,
      `BindsTo=`, `PartOf=`), the order of a boot, `Restart=` and the start
      limit, editable unit files and drop-ins (`src/engine/units.ts`); "The
      Canteen", phase 12
- [x] **Simulated time**: systemd's clock, scheduled tasks (`cron`: a
      simulated night runs the tasks that fall in it)
- [ ] systemd timers (done: hand-written units, `OnCalendar=`,
      `list-timers`, "The Probe")
- [x] Scrolling logs and attacks "during" the quest: `tail -f`,
      `journalctl -f` and Ctrl-C; Premier jour (the robot live) and La
      sentinelle (robots, scanners, fail2ban banning and releasing)
- [x] **Users and groups**: real group rights, per-machine accounts
      (`/etc/passwd`, `/etc/group`), `id`, `groups`, `usermod -aG`, `chgrp`,
      `chown`; quest "Second day" (Datacenter, chapter 2)
- [x] `sudoers` (`visudo`, `sudo -l -U`, `/etc/sudoers.d`), `umask`, the
      setgid bit of shared directories; "Shared permissions" (La
      Coopérative, chapter 2)
- [x] **File editor** like `nano` (`^O`, `^X`, buttons on mobile), rights
      checked on save, quest goals updated; alternative solution in
      chapter 1 of the Datacenter
- [x] Per-service syntax check: `sshd -t`, `nginx -t` (and `nginx -T`),
      reload refused if the configuration is wrong
- [x] **Built-in manual**: full `man` pages generated from each command's
      definition, `--help`, `man -k`, `apropos`, `whatis`; unknown option →
      the real error message (taken from the work done in rouages.net)
- [x] **Goal checker**: predicates on the state ("port 22 no longer accepts
      passwords", "the site answers over HTTPS"…): each chapter's events

## Phase 2 — Connecting and moving around

- [x] **SSH**: `ssh`, keys (`ssh-keygen`, `ssh-copy-id`, `authorized_keys`,
      passphrase), `~/.ssh/config`, host fingerprint (`known_hosts`),
      password then password refused; "The keys" (The Community
      Centre, chapter 1)
- [x] **Jump hosts**: bastion host, `ssh -J` / `ProxyJump` ("The Jump"),
      local port forwarding `-L` with `-f -N` ("The tunnel"); still to do:
      `-R` and `-D`
- [x] **SSH hardening**: `PermitRootLogin no`, `PasswordAuthentication no`,
      `AllowUsers`, `sshd -t`, `sshd -T`, Debian's `Include`; quest "Fermer
      la porte" (The Neighbourhood Letters), where you can lock yourself out
      (the menu serves as a rescue console)
- [x] **Changing the SSH port**: two `Port` lines, ufw, `~/.ssh/config`,
      `known_hosts` as `[name]:port`, the fail2ban jail's `port` ("Le
      port", The Neighbourhood Letters, chapter 7)
- [x] **Transfers**: **`scp`**, remote `rsync` (`-a`, `--delete`, `-n`) and
      why clear-text FTP is to be avoided ("Transfers"); `sftp`, and
      **FTPS** with `lftp` for shared hosts that require it, rouages.net's
      case ("The web host", The Community Centre, chapter 5)
- [x] `tmux`: keeping a session alive when the connection drops; "Les mises
      à jour" (The Co-op, chapter 5)

## Phase 3 — Securing the server

- [x] **Firewall**: `ufw` (default policy, `allow`, `deny`, `reject`,
      `limit`, `delete`, application profiles, numbers), and `ssh` stopping
      at the firewall (timeout); quest "The firewall" (The Neighbourhood
      Letters, chapter 2)
- [x] A glimpse of `nftables` under `ufw`: `nft list ruleset` shows the
      `ufw-*` chains and fail2ban's table ("The port")
- [x] **fail2ban**: reading `fail2ban.log` and SSH's log, `jail.local`
      (never `jail.conf`), `bantime`, `maxretry`, `ignoreip` (CIDR),
      `fail2ban-client status`, `unbanip`, `-t`, `reload`; quest "La
      sentinelle" (The Neighbourhood Letters, chapter 3), where you can ban
      yourself
- [x] The `recidive` jail and the `nginx-limit-req` jail, enabled in their
      section ("Repeat offenders", The Neighbourhood Letters, chapter 8)
- [x] **Updates**: `apt update`, `list --upgradable`, `upgrade`,
      `dpkg --configure -a`, `/var/run/reboot-required`, `uname -r`, kernel
      ("Updates", The Co-op, chapter 5); automatic updates
      (`unattended-upgrades`: `20auto-upgrades`, `Origins-Pattern`, `Mail`,
      `Automatic-Reboot-Time`, `apt-config`, "Updates
      automatiques", chapter 6)
- [x] **Accounts**: deleting an account (`userdel`), disabling a former
      colleague's account (`usermod -e`, `chage -E`), keys to revoke
      (including in a shared account), `gpasswd -d`, `who`, `pkill -u`;
      "The departure" (The Co-op, chapter 1)
- [x] **Attack surface**: `ss -tlnp`, a service listening on `0.0.0.0`
      instead of `127.0.0.1` (the exposed database)
- [x] **TLS certificates**: Let's Encrypt (`certbot`), HTTP-01 challenge,
      automatic renewal, deploy hook, `openssl x509` and `s_client`,
      `curl https://`; quest "The certificate has expired" (Datacenter,
      chapter 5)
- [x] **Secrets**: a `.env` file (and `.git`) published by mistake, the
      access log, `location ~ /\.`, `deny`, rotating a key; "The secret" (La
      Coopérative, chapter 3)

## Phase 4 — Serving websites

- [x] **Web server**: **Nginx**, **virtual hosts** (several sites on one
      machine), `sites-available` and `ln -s`, `nginx -t` before reloading;
      quest "Sharing a home" (The Neighbourhood Letters, chapter 4)
- [x] **Apache**, to compare: `ports.conf`, `a2ensite`, `apache2ctl -S`,
      `.htaccess` and `AllowOverride`, `a2enmod rewrite`, behind nginx;
      quest "The Repair Café" (The Neighbourhood Letters, chapter 9)
- [x] **Reverse proxy** in front of an application (`proxy_pass`, trailing
      slash, 502 and `error.log`); simulated `return 301`
- [x] Headers passed to the app (`proxy_set_header`, `X-Forwarded-For`,
      Express's `trust proxy`); "The proxy" (The Co-op, chapter 4)
- [x] **DNS**: A, AAAA, CNAME, MX, TXT records, TTL and caches (the
      "propagation"), BIND zone, serial, secondary; quest "Ça marche chez
      moi" (The Neighbourhood Letters, chapter 5)
- [x] **Access logs**: finding who brings the site down (`awk`, `sort`,
      `uniq -c`), rate limiting (`limit_req`, burst, 429); quest "Le soir du
      concert" (The Neighbourhood Letters, chapter 6)

## Phase 5 — Containers

- [x] **Docker**: image, container, `docker run/ps/logs/exec/cp`, ports,
      volumes (and what you lose without a volume), `--restart`; quest "La
      mise à jour" (The Workshop, chapter 1)
- [x] **Docker Compose**: several services (app, database), internal
      network (the service's name), variables and `.env`, volumes, restart;
      quest "The Composition" (The Workshop, chapter 2)
- [x] Updating an image without losing the data ("The Update")
- [x] Cleaning the disk (`docker system df`, `prune`); "Le trou dans le
      pare-feu"
- [x] Security: not exposing the database, `ufw` and Docker (published
      ports bypass ufw); "The hole in the firewall" (The Workshop, chapter 3)
- [x] Not running as root in the container: `--user`, `user:`, the uid
      shared with the machine, `chown -R`; "Full powers" (La
      Fabrique, chapter 4)

## Phase 6 — Deploying

- [x] **Deploying with git**: a bare repository on the server, a
      `post-receive` hook; "The bare repository" (The Gazette, chapter 1)
- [x] **Continuous integration** (simulated): tests that block a deployment
      (`tests.sh` run by the hook before the switch); "Rolling back"
      (The Gazette, chapter 2)
- [x] **Blue/green**: two versions side by side, switching the proxy,
      instant rollback; "Blue and green" (The Gazette, chapter 3)
- [x] **Canary** and health checks (`/health`): `upstream` and `weight`,
      the 500s in `access.log`; "The canary" (The Gazette, chapter 4)
- [x] **Database migrations** that prevent rolling back; "The migration" (La
      Gazette, chapter 5)
- [x] **Rollback** after a failed deployment: `ln -sfn` to the previous
      version (chapter 2), switching the proxy back (chapters 3 and 4)

## Phase 7 — Backing up and restoring

- [x] **The 3-2-1 rule**, and why a copy on the same disk is not a backup
      (debrief of "The Backup")
- [x] **rsync**: `-a`, `-v`, `-n`, `--delete`, the trailing slash;
      scheduled with `cron`; quest "The Backup" (Eraser, chapter 4)
- [x] **rsnapshot** (snapshots with hard links, daily and weekly rotation,
      cron); "Snapshots" (The Game Library, chapter 2)
- [x] **restic** (encryption, deduplication, `snapshots`, `find`, `diff`,
      `dump`, `restore`, `forget --prune`, `check`); quest "The versions"
      (The Archives, chapter 2)
- [x] Backing up a database (`pg_dump`, `pg_restore`) rather than its
      files, a test restore; "The Database" (The Game Library, chapter 3)
- [x] **Service restoration**: quest "The great fire" (Datacenter,
      chapter 4): starting again from an empty machine with the backups and
      the recovery plan; a truncated archive to check with `tar -tzf`,
      `apt`, `nginx -t`, an SSH host key that changes (`ssh-keygen -R`)
- [x] **Restore drill**: an erased memory to restore from the backup ("La
      Sauvegarde")
- [x] Ransomware and offline backups (`mount -o ro`, restic); "The ransom"
      (The Game Library, chapter 1)
- [x] Load and resources: `top`, `free`, `df`, `du` done (On Call,
      chapters 1 and 2); `iostat`, `pidstat -d`, `ionice` and systemd's
      bandwidth limit (`IOWriteBandwidthMax=`): "The bottleneck" (chapter 7)
- [x] Classic failures: full disk and leaking logs ("The full disk"),
      memory exhausted (OOM) and zombie processes ("Memory"), inodes
      exhausted ("Inodes"), wrong clock and time zone ("The clock", NTP
      and `timedatectl`) done
- [x] Log rotation (`logrotate`); "The full disk" (On Call, chapter 1)
- [x] Monitoring and alerts (plugins `check_disk`, `check_http`,
      `check_procs`, `mail`, thresholds, failure drill); "The Probe"
      (On Call, chapter 5)
- [x] **Blameless post-mortem**: writing up what happened
      (`journalctl --since/--until`, `last`); "The Post-Mortem"
      (On Call, chapter 6)

## Phase 9 — The company network

- [x] Switches and **VLANs**: separating offices, guests and equipment; a
      "trunk" port (802.1Q) to the router, `ip link`,
      `/etc/network/interfaces`; "VLANs" (The Hive, chapter 1)
- [x] DHCP: dnsmasq, a range per VLAN, reservations; "DHCP" (The Hive,
      chapter 2)
- [x] Routing, NAT and firewall between zones: `sysctl`, nftables
      (`forward`, `masquerade`, `ct state`), `conntrack`; "The Zones" (La
      Ruche, chapter 3)
- [x] A DMZ: a public server in a separate VLAN, `dnat` in `prerouting`,
      the DMZ isolated from the internal network; "The DMZ" (The Hive,
      chapter 5)
- [x] WireGuard VPN for remote work: keys, `wg0.conf`, `wg-quick`, firewall;
      "Working from home" (The Hive, chapter 4)
- [x] VPN between two sites: one more peer on `wg0`, `AllowedIPs` as a
      routing table, `PersistentKeepalive` behind a home router; "The Annex"
      (The Hive, chapter 6)
- [x] Directory: OpenLDAP for the team's accounts (`ldapsearch`, LDIF,
      `ldapmodify`, `slappasswd`); "The Directory" (The Hive, chapter 7)
- [x] Enterprise Wi-Fi: 802.1X with FreeRADIUS, which checks accounts in the
      directory and puts each one in its VLAN; "The Office Wi-Fi" (La
      Ruche, chapter 8)

Set aside: network loops and Spanning Tree (too low-level for this game,
which works on machines rather than switches).

## Phase 11 — The audit (closing story)

- [x] **The Audit** (story 14, machine `fournil`): an audit mission in five
      chapters, bringing together what the other stories teach separately.
      "The Scope" (engagement letter, `nmap`, staying in scope), "Le
      rapport" (SSH without root, a forgotten account, passwordless sudo, a
      readable secret), "The Exposure" (port scan, `ufw`, Redis on
      localhost), "The Traces" (ssh's log, `last`, key fingerprints,
      `authorized_keys`, a `cron` job left by the intruder, the database
      password changed end to end) and "The Follow-up Visit" (`nmap`, `lynis`,
      updates, closing report).
- [x] **The Watch** (story 16, machine `kneader`): six months after
      "The Audit", the weekly security watch — reading a bulletin of
      fictitious CVEs, sorting by exposure as much as by severity, fixing
      without breaking, proving, then automating what can be
      (`unattended-upgrades` restricted to security, a timer or a cron job).
      No new tool, no exploitation.

## Phase 12 — Hardware, and the following stories

- [x] Gradual unlocking of the stories (`unlocking.ts`, `after`)
- [x] **The Lab** (story 15, machine `labo`): "The tired disk"
      (smartd, `smartctl`, `/proc/mdstat`, `mdadm --fail/--remove`, the
      serial number) and "The new disk" (`sfdisk -d | sfdisk`,
      `mdadm --add`, the rebuild, `grub-install`)
- [x] The Lab, chapter 3: "Running out of room" (`mdadm --create`,
      `pvcreate`, `vgextend`, `lvextend -r`, `resize2fs`, `mdadm.conf`,
      `update-initramfs`)
- [x] The Lab, chapter 4: "The stuck reboot" (`/etc/fstab` by
      UUID, `nofail`, emergency mode, `findmnt --verify`, `daemon-reload`)
- [x] Scrolling logs and attacks during a quest (defensive)
- [x] Story: mail that lands in spam (SPF, DKIM, DMARC, Postfix); "Le
      courrier indésirable", three chapters (The Postman, The Signature, La
      politique)
- [x] Story: automating with Ansible (inventory, playbook, idempotence,
      `--check`); "The Fleet", three chapters (The Inventory, The Playbook,
      The Rehearsal)
- [x] Caddy, as a short comparison chapter (automatic HTTPS); "The Patch",
      one chapter (The Padlock)
- [x] **The Canteen** (story 20, machine `canteen`): services that depend
      on each other, three chapters. "The Boot Order" (`After=` vs
      `Requires=`/`Wants=`, `systemctl cat`, `list-dependencies`, drop-ins,
      `systemd-analyze verify`), "The Restart Loop" (`Restart=`,
      `RestartSec=`, start-limit-hit, `reset-failed`, `PartOf=` vs
      `BindsTo=`), "The Slow Boot" (`systemd-analyze time` / `blame` /
      `critical-chain`, `network-online.target`,
      `systemd-networkd-wait-online`, `networkctl`, `RequiredForOnline=`)
- [x] The Canteen, chapter 4, "The Late Disk": a mount the app needs isn't
      there yet at boot (`nofail`, what a mount point hides,
      `RequiresMountsFor=`)

### Next stories (proposals)

- [ ] **Resources**: a server that crawls. The load average and what it
      counts, `top`, a process that hogs the CPU (`nice`, `renice`,
      `CPUQuota=`), "Too many open files" (`ulimit`, `LimitNOFILE=`), a stuck
      process (`kill` and its signals). The engine already has processes,
      memory (OOM killer) and systemd's limits.
- [ ] **File sharing**: an association's NAS. NFS (`/etc/exports`, mounting
      it, `root_squash`) and Samba for the Windows desktops, permissions and
      quotas. Needs network mounts, not simulated yet.
- [ ] **Monitoring and logs**: several machines' logs gathered in one place
      (rsyslog, remote journald), alerts on thresholds, a few metrics; a story
      across several machines.
- [ ] **A database in production**: PostgreSQL day to day. Connections
      exhausted (`max_connections`), a slow query (`EXPLAIN`), replication
      and failover, permissions (`GRANT`).

---

## Phase 10 — Translations

The architecture has prepared for it since phase 0 (see "Translations" in
`CLAUDE.md`).

- [x] English (`src/texts/en/`, page `/en/`, each quest replayed in
      English)
- [x] **English first**: English becomes the reference language of the
      texts, the root picks the language from the browser (`/en/`, `/fr/`),
      the element takes English attributes (`lang`, `story`, `save-key`),
      the repository's documentation is in English (`README.md`,
      `CONTRIBUTING.md`, `CLAUDE.md`, `docs/`), with French versions of the
      README, the contribution guide and the embedding guide
- [x] **The code in English**: files and folders, identifiers, `.ftl` keys
      and Fluent variables, a machine's state keys, CSS classes and
      `data-*` attributes, internal values, comments and test titles; the
      English game shows no French world content any more (file names,
      databases, groups, services, hosts, routes, passwords, organisation
      names: English identifiers, French through `names.ftl`,
      `passwords.ftl`, `machines.ftl` and the stories' texts)
- [ ] German, Spanish, Mandarin, Korean, then other languages (on hold:
      more playtesting of the English and French versions first)
- [x] Outputs of the simulated commands according to `LANG`, like the real
      tools (in English: the original messages, as with `LANG=C`)
- [x] Translated, easy-to-type names of places and objects (`names.ftl`, the
      Eraser and the workstation); completion tested in each language
- [x] Names of the other stories' documents (emails, messages, help notes,
      `LISEZMOI.txt`…: `names: true` everywhere)
- [x] Names of the servers' data, right down to what keeps them (restic and
      rsnapshot snapshots, rsync copies, files tracked by git, scripts,
      crontabs, logs): the Archives' collection and the town hall's disk,
      Inès's novel and poems, the Ludothèque's share and ransomware, the
      Maison des associations' share, backups and wiki, the Coopérative's
      statements and backups, the Datacenter team's folder, the radio's
      folders in On Call; technical names stay as they are (sites and
      addresses served over HTTP, databases, Docker images and projects,
      systemd units, programs and scripts in the PATH), and so do proper
      names (the radio's shows)
- [x] The player's account name (`vous`, in English `you`: prompt, `/home`,
      owners, logs…) and the Eraser's user (`effaceur`, `eraser`); machine
      names translated too (`royaume` → `kingdom`, `machines.ftl`)
- [ ] Paragraph joining and typography per language (Chinese and Korean
      don't separate lines with a space)
- [ ] Simulated terminal compatible with wide characters (CJK)
- [ ] Review by native speakers, technical glossary per language
- [x] Quests replayed automatically in each language
      (`tests/quests.test.ts`)

## More ideas

- [ ] **An offensive story**: understanding an attack by replaying it, not
  just reading its outcome. Outside the game's usual scope ("Game rules" in
  `CLAUDE.md`: security quests stay defensive); a guide for whoever wants to
  build it is in `docs/OFFENSIVE-STORY.md`.
- [x] **Difficulty**: 1 to 5 stars per chapter (and a range per story),
  computed from what comes before it in the game and from its size
  (`src/engine/difficulty.ts`); in the menu, the learning paths and the
  teachers' sheets.
- [x] **On-call duty and the incident of the day** (`src/engine/on-call.ts`):
  every day, a chapter drawn from the date (the same for everyone, with no
  server) among those of the learning paths about failures, open after La
  Racine; an error budget of 30 minutes that melts with time (−3 min per
  hint, −20 s per failed command); at the end, a score card as text to copy
  (a five-box gauge); the day's best result is kept in the browser.
- [x] **End-of-chapter summary** (`src/engine/summary.ts`): time spent,
  commands typed (and failed), hints; the detail compares, step by step,
  the command that passed it with the reference solution (the hints'), and
  reminds that another way is just as right.
- [x] **Rescue snapshot** (Mission panel, `Console.restore`): take a
  snapshot, go back to it, undo the last input. The engine is
  deterministic: reopening the chapter and replaying the inputs (commands,
  answers, nano saves) gives back the machine as it was. No snapshot in exam
  mode, nor after going through the workstation.
- [x] **Learning paths** (`src/engine/paths.ts`, the menu's third view):
  first steps, security, web, networks, backups, containers and deployment,
  production, accounts and identities; each chapter is in at least one
  path; the next one to play is highlighted, and what is waiting says which
  chapter to finish first.
- [x] **Command-line highlighting**, like fish or zsh-syntax-highlighting:
  the command in green if the game's shell would run it, in red (with a wavy
  underline) otherwise, options, strings, globs that match something, pipes
  and redirections, existing paths underlined; the command stays coloured
  above its output. Nothing for an answer (yes/no, password, `sftp>`). AA
  contrast in all four themes; a "Colours" button to turn it off.
- [x] **Output colours**, like the real tools (ANSI sequences,
  `src/engine/colours.ts`): `ls --color=auto` and `grep --color=auto`
  (Debian's aliases), `diff --color`, `systemctl status` and `--failed`; on
  screen only, never in a pipe or a file (unless `--color=always`); events
  read the output without the codes, and each chapter is replayed with the
  colours. Also: `ip -c`, `journalctl`'s priorities (and the excerpt in
  `systemctl status`), `git` (`diff`, `log`, `show`, `status`,
  `--no-color`).
- [x] **Network map as a menu**: the workstation, the internet, then one
  machine per story (name and address), plugged into one cable; its branch
  is dashed while locked, amber while you play on it, green when the story
  is finished, and a packet runs along it (stopped if the system asks for
  less motion). The "Racks" view (the same buttons, with their summary)
  stays available; the choice is kept in the browser.
- [x] **Terminal display**: four themes (phosphor, amber, high contrast,
  paper), text size, full screen (Escape leaves it), kept in the browser;
  staging of a connection and of a reboot (turned off if the system asks
  for less motion).
- [x] **Class table** for teachers: drop the students' save files (or paste
  their codes); chapters, rank, achievements, best exam, progress per
  story; CSV export (with no injectable formula); everything stays in the
  browser.
- [x] **Graduated hints**, in the Mission: the manual first, then a lead,
  then almost the answer, for the first step not yet passed
  (`hints-<story>.ftl`); the debrief counts the hints asked for; none in
  exam mode; a "No safety net" achievement for a chapter without hints.
- [x] **Achievements and ranks**: 17 achievements checked on what really
  happened (ls -a, a pipe, a redirection, a restore, exam mode…), including
  3 hidden easter eggs (xyzzy, the sandwich of xkcd 149, sl); a rank, from
  Intern to SRE, according to the chapters finished, also in the notebook.
- [x] **Mission, mobile key bar, Ctrl-R and Ctrl-C**; the site's own
  **"machine room" style**.
- [x] **Taking your progress with you** (computer labs): "My progress" gives
  a short code to copy (the finished chapters, a checksum against typos, a
  frozen chapter order: `tests/progress/order.txt`) or a JSON file with
  the whole save; an optional name goes at the top of the notebook. No
  server, no encryption: it is not proof.
- [x] **The map**: a button above the terminal opens, in a window, the tree
  of the known places of the machine you are on (places visited, places
  glimpsed in italics, home, closed places), with "you are here". Nothing is
  revealed beyond what you have seen; no files.
- [x] **The network plan**: in the stories with several machines (The Community
  Centre, The Hive), a "Network" tab of the map shows the planned
  network (the diagram on the wall: router, VLANs, internal machines,
  WireGuard tunnels), as SVG and as a list, with "you are here" and the
  machines you have already connected to. It is the plan, not the state:
  checking it stays the job of the real commands.
- [x] **The sysadmin's notebook**: each command discovered goes into a
  personal cheat sheet (its line from the manual, the first line typed, the
  chapter), kept in the browser, exportable as Markdown.
- [x] **Exam mode**: a checkbox above the terminal; the chapter starts again
  on a fresh machine, with no hint at all (only the debrief shows), with a
  timer and the best time kept in the browser. Still possible: random
  failures, specific to the exam.
- [x] **Quests with several right answers**: "ANOTHER WAY" in the debrief of
  fifteen chapters (`ufw` or `nftables`, `rsnapshot` or `restic`, fail2ban
  or `ufw limit`, certbot or acme.sh and DNS-01…). Still possible: chapters
  you do both ways.
- [x] **Community challenges**: a documented quest format so others can
  write some (`CONTRIBUTING.md`).
- [x] **Link with rouages.net**: after a chapter, the module steps or the
  glossary words that explain its concept (DNS, TLS, NAT…),
  `src/engine/rouages.ts`. The other direction remains, to be done on
  rouages.net.
- [x] **For teachers**: a sheet per quest (goal, prerequisites, commands
  discovered, difficulty, approximate time) at `/en/teachers/` and
  `/fr/enseignants/`, generated at build time (`src/engine/sheets.ts`);
  progress exportable with no account, at the top of the downloaded
  notebook.

---

## Organisation

- A **dedicated agent** on the repository, with a CLAUDE.md that takes over
  rouages.net's rules: accessibility, static, tests before pushing,
  automatic PR, differences with the real Linux documented, no personal
  data; English first since October 2026.
- Recommended order (followed): phase 0, then 1 (multi-host engine), then 2
  and 3 (the core of the job), then 7 (backups), before containers and
  deployment.
