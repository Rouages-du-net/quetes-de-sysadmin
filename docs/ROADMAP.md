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

- [x] **Resources** ("The Observatory", story 21 in `docs/SCENARIOS.md`):
      a server that crawls. The load average and what it counts, `top`,
      `ps -o`, `pgrep`, a process that hogs the CPU (`nice`, `renice`),
      `CPUQuota=` and `systemd-cgtop` (`src/engine/cpu.ts`); "Too many open
      files" (`ulimit`, `prlimit`, `LimitNOFILE=`, `/proc/PID/limits`,
      `src/engine/limits.ts`); a stuck process (`kill` and its signals, a
      script's trap, a stale PID file).
- [x] **Incident response** ("The Bastion", story 25 in `docs/SCENARIOS.md`):
      the blue-team sequel to "The Watch". A compromised delivery server:
      detect (`ps`, `top`, `ss -tnp`, `netstat`, `journalctl`, `last`),
      contain (`iptables` INPUT and OUTPUT, the watchdog before the miner,
      `usermod -L` versus `-e 1`), eradicate (crontab, `authorized_keys`,
      `find -mtime`, `gpg --verify` of a signed release, `tar -x`), harden
      (the `sshd_config.d` drop-in that wins, default-deny `iptables` saved
      to `rules.v4`). Defensive only.
- [x] **File sharing** ("The Photo Club", story 24 in `docs/SCENARIOS.md`):
      an association's NAS. NFS (`/etc/exports`, `exportfs`, `showmount`,
      `mount -t nfs`, fstab, `root_squash`, the uids NFS carries;
      `src/engine/nfs.ts`) for the darkroom computer, and Samba for the
      Windows laptops (`smb.conf`, `testparm`, `smbpasswd`, masks,
      `smbclient`; `src/engine/samba.ts`).
- [x] **Monitoring and logs** ("The Huts", story 23 in
      `docs/SCENARIOS.md`): the logs of three machines gathered in one place
      (rsyslog as a central server: `imudp`, the firewall, a template per
      host, `stop`; `src/engine/rsyslog.ts`), the journal filling the disk
      (`journalctl --disk-usage`, `--vacuum-size`, `SystemMaxUse=`;
      `src/engine/journal-files.ts`), a filter for an alert on failed SSH
      logins (conditions, the order of the rules, `logger`).
- [x] **A database in production** ("The Theatre", story 22 in
      `docs/SCENARIOS.md`): connections exhausted (`max_connections`,
      `pg_stat_activity`, idle in transaction, a timeout), a slow query
      (`EXPLAIN`, `CREATE INDEX`), in `src/engine/pg-server.ts`;
      permissions (a read-only role, `GRANT`, default privileges,
      `src/engine/pg-roles.ts`); failover to a standby (`pg_lsclusters`,
      `pg_ctlcluster promote`).

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

---

## Phase 13 — Beyond Linux: the other machines a sysadmin meets

The game started with Linux, but its aim is system administration, and a
sysadmin meets Windows machines every week, other Unixes regularly, and
sometimes systems older than themselves. The basics belong in the game.
The Unix and mixed-fleet steps reuse the current engine; Windows and IBM i
each need an engine of their own.

- [x] **Another Unix: portability** ("The Other Unix", story 26 in
      `docs/SCENARIOS.md`, on a FreeBSD box: `src/engine/freebsd.ts`). A
      backup script written for Debian breaks (`#!/bin/bash`, `date -d`,
      `stat -c`, `sed -i` without a suffix), services without systemd
      (`pkg`, `/etc/rc.conf`, `service`, `sysrc`, `sockstat`), and `pf`,
      where the last matching rule wins. The lesson: "Linux" is not "Unix",
      read the manual of the machine you are on, write POSIX `sh`. Later:
      `pw useradd`, `ps` and `ls` in their BSD versions.
- [x] **Solaris: migrating off an old server** ("The Old Sun", story 27 in
      `docs/SCENARIOS.md`; `src/engine/solaris.ts`). A Solaris 10 SPARC box
      holds a PostgreSQL 8.4 database in LATIN1 that moves to a Debian
      server: reading the system first (SMF with `svcs`/`svcadm`/`svcprop`,
      `prstat`, `zfs` and a snapshot, `pkginfo`, `isainfo`, the old
      `/usr/bin` tools and `/usr/xpg4/bin`), then a dump rather than the data
      files (another version, another byte order), character sets
      (`file`, `iconv`, `SET client_encoding`), checks, and the old box
      frozen rather than erased.

### Legacy systems: old but valuable

Systems that run banks, insurers, retailers and public services, often for
decades, and that a sysadmin may inherit. The game can show them with
respect: why they are still there, how to read them, how to move data off
them safely.

- [x] **COBOL batch on Linux** ("The Night Batch", story 28 in
      `docs/SCENARIOS.md`; `src/engine/ebcdic.ts`, `src/engine/cobol.ts`). A nightly COBOL
      batch moved from a mainframe to Linux with GnuCOBOL: fixed-width
      record files described by a copybook, EBCDIC data to convert
      (`iconv -f EBCDIC-US`, `dd conv=ascii`, and why packed decimals,
      COMP-3, must not go through a text conversion), `cobc` to compile,
      the job chained by cron or a systemd timer, its return code checked,
      a file that arrives late. The lesson: the program is fine, the
      plumbing around it is what breaks.
- [x] **IBM i (AS/400)** (needs its own small engine; done: story 29, "The Order Book"). An IBM i that has
      run a company's orders since the 1990s. A different world: everything
      is an object in a library (`WRKLIB`, `DSPLIB`, `WRKOBJ`), commands are
      CL with a fixed grammar and prompting (F4), jobs and subsystems
      (`WRKACTJOB`, `WRKSBS`, `WRKJOBQ`), spooled files (`WRKSPLF`), user
      profiles and authorities (`WRKUSRPRF`, `EDTOBJAUT`), DB2 for i, save
      files (`SAVLIB`, `RSTLIB`). The bridge from the familiar: `ssh` lands
      in PASE/QShell, a Unix-like shell on the same machine, with the IFS
      (`/QSYS.LIB/…`) linking both worlds. Possible stories: a job stuck in
      MSGW waiting for an answer, a full output queue, a nightly save that
      must be checked, an export of a DB2 table to the Linux side (CSV over
      `ssh`, CCSID conversions). Interface: a CL command line first; the
      5250 green screen (fixed 80×24 menus, function keys) is a later,
      optional step.
- [x] **A mixed fleet, seen from Linux** ("Next Door Windows", story 30 in
      `docs/SCENARIOS.md`; `src/engine/windows.ts`, `src/engine/powershell.ts`,
      `src/engine/cifs.ts`): the Windows machines a Linux
      admin deals with, without simulating Windows itself. A script copied
      from Windows that fails with `/bin/bash^M: bad interpreter` (CRLF,
      `file`, `dos2unix`, `.gitattributes`); a Windows file server through
      SMB (`smbclient`, `mount -t cifs`, credentials file, `vers=`); WSL;
      and a Windows Server reached through its built-in OpenSSH, where the
      prompt is PowerShell (a handful of read-only commands: the bridge to
      the next step).
- [x] **Windows administration: the basics** (cmd and PowerShell). A
      second engine beside the POSIX one: PowerShell's pipeline carries
      objects, not text (`Get-Process | Where-Object CPU -gt 50 | Sort-Object`),
      paths are `C:\…` and case-insensitive, rights are ACLs (`icacls`,
      `Get-Acl`), services are `Get-Service`/`Restart-Service`, the
      configuration lives partly in the registry (`Get-ItemProperty
      HKLM:\…`), logs in the Event Log (`Get-WinEvent`), the firewall is
      `Get-NetFirewallRule`, scheduled tasks replace cron, local users and
      groups (`Get-LocalUser`, `net user`), and `Get-Help` is the manual
      (the "manual first" rule holds). cmd and batch only where they still
      matter (`ipconfig`, `ping`, `net use`, reading an old `.bat`).
      Possible stories: a Windows file server whose share refuses a
      department (NTFS vs share permissions), a service that stops after a
      password change (the service account), a disk full of logs, a
      scheduled backup that silently stopped.
      Engine work, to plan as several PRs: a PowerShell parser and object
      pipeline, cmdlets with their `Get-Help` pages (texts in `.ftl` like
      every other page), an NTFS-like world (drives, ACLs, case-insensitive
      names), a registry, an event log; the workstation's `ssh` reaching a
      Windows machine. The interface stays the same (terminal, notebook,
      hints, map). The charter changed with it: "learn Linux system
      administration" became "learn system administration" (on Linux and
      Windows) in `README.md`, `CLAUDE.md` and the home pages.
      Engine step 1: a Windows PowerShell 5.1 language
      (variables, expressions, script blocks, hashtables, -WhatIf/-Confirm,
      Read-Host, scripts) and about 90 cmdlets with their Get-Help pages;
      FileSystem, Registry and Env: providers; NTFS permissions (Get-Acl,
      Set-Acl, icacls, takeown) and share permissions combined with them;
      local users and groups (net user); services under a logon account
      that break when its password changes (events 7038/7000, sc.exe);
      event logs (Get-WinEvent -FilterHashtable, wevtutil); scheduled tasks
      with LastTaskResult codes and a clock that runs (schtasks); cmd.exe
      where OpenSSH lands without DefaultShell; `windowsMachine()` builds a
      default Windows Server 2022 for a story (see the "Windows engine" rows
      of `docs/SCENARIOS.md`). The first story, "The Music School"
      (story 31 in `docs/SCENARIOS.md`, on `stave`, a Windows Server 2022
      reached by ssh), is complete: share vs NTFS permissions, a service
      locked out after its password changed, a disk full of debug logs
      (files in use, `compact`, `Register-ScheduledTask`), and a backup
      task that silently stopped (an expired password, then a script whose
      non-terminating errors left its exit code at 0: `try`/`catch`,
      `$ErrorActionPreference`, `-ErrorVariable` in the engine).
- [x] **Later on Windows: Active Directory basics** (users, groups, GPO,
      `Get-ADUser`), the natural sequel to "The Directory" (OpenLDAP); the
      firewall (`Get-NetFirewallRule`); functions and loops in the
      PowerShell engine (`function`, `while`, `for`, `switch`).
      Engine step done: PowerShell functions (`param()`, advanced
      functions, begin/process/end, dot-sourcing, `Import-Module`) and
      loops (`while`, `do`, `for`, `switch`, `break`, `continue`); Windows
      Defender Firewall (profiles, rules, block wins, the NetSecurity
      cmdlets, `netsh advfirewall`; ssh, SMB and Test-NetConnection go
      through it); Active Directory (`domainController()`, member servers,
      users, groups and nesting, OUs, the lockout with events 4740/4625,
      domain groups in NTFS and share permissions, the ActiveDirectory
      module with `-Filter` and `-LDAPFilter`, `net user /domain`) and
      Group Policy (links, enforcement, blocked inheritance, security
      filtering, `gpupdate`, `gpresult`, the GroupPolicy module), tested on
      the HARBOUR fixture (see the "Windows engine" rows of
      `docs/SCENARIOS.md`). The story: "The Card Catalogue" (story 32 in
      `docs/SCENARIOS.md`, on `register`, a domain controller, with
      `stacks`, a member file server reached with Windows' OpenSSH
      client), chapters 1-2 done: accounts created and closed by the
      conventions (AGDLP, a leaver disabled and moved, not deleted), and a
      lockout whose source is a scheduled task holding an old password
      (tasks under domain accounts, a trigger's repetition, ssh.exe,
      Add-/Remove-ADPrincipalGroupMembership in the engine), and chapters
      3-4 done: a GPO linked to the wrong OU and filtered one group short
      (the domain's workstations and their RSoP: `gpresult /s /user`,
      Get-GPResultantSetOfPolicy, Invoke-GPUpdate `-Computer`), a Remote
      Desktop rule open to Any narrowed or disabled, dormant accounts
      closed by a loop or a function with a CSV report (Export-Csv,
      ConvertTo-Csv, Import-Csv); the AD Recycle Bin (Get-ADObject
      `-IncludeDeletedObjects`, Restore-ADObject, Get-ADOptionalFeature)
      makes chapter 1's deletion recoverable.

## More ideas

### New stories (defensive, within the charter)

- [x] **Encrypted backups**: a backup you can actually trust. LUKS on a
  backup disk (`cryptsetup luksFormat`/`luksOpen`, a keyfile vs a
  passphrase, `/etc/crypttab`), restic or borg to an encrypted repository
  already partly modelled (`commands/restic.ts`), a restore drill, and the
  key-management trap (a backup whose key is only on the machine it backs
  up). Extends the backups path. Done: story 33, "The Pantry" (LUKS,
  `cryptsetup`, crypttab and `cryptdisks_start`, `mkfs.ext4`; restic
  `init`, `key`, its environment variables, `check --read-data`;
  `sha256sum`; shell variables and `sudo -E`; a restore drill on an
  internal host with only escrowed secrets).
- [x] **IPv6**: the same services, two address families. SLAAC vs a static
  address, `ip -6`, a firewall that only covered IPv4 (ufw and nftables
  rules duplicated for v6, the classic "closed on v4, open on v6" hole),
  AAAA records in BIND, `ping6`/`curl -6`. Builds on the network engine
  (`src/engine/lan.ts`, `nftables.ts`, `dns.ts`). Done: story 34, "The
  Ferry" (`ipv6.ts`: SLAAC and EUI-64, link-local, `inet6` stanzas,
  `ip -6`, `ping6` and `%eth0`, AAAA records and the serial; a `table ip`
  firewall turned `inet` with ICMPv6; `nmap -6`, `nc -6`, `ss -6`;
  nginx's `listen [::]:80` and `ipv6only`, `curl -4`/`-6 -v`, localhost
  as `::1`; ufw's `IPV6=`).
- [x] **Metrics and alerting** (Prometheus/Alertmanager): reading a
  service the way "The Huts" reads logs. A node exporter and an app's
  `/metrics`, a scrape config, a PromQL threshold, an alert rule that
  fires and resolves, and silencing during maintenance. All simulated and
  deterministic, like the rest. Done: story 35, "The Bike Share"
  (`promql.ts`, `prometheus.ts`, `alertmanager.ts`: targets scraped
  through the story's network and its firewalls, the HTTP APIs answering
  curl, rules with `for:` tried on made-up days, routing, repeat interval
  and silences; `promtool`, `amtool`, `jq`, `sleep`).
- [x] **Containers in production, step 2** (a light Kubernetes, k3s):
  after Docker and Compose, one node. A Pod that won't start
  (`kubectl get`/`describe`/`logs`, an image or a probe failing), a
  Service and an Ingress, a ConfigMap and a Secret, resource limits and an
  OOMKilled pod. Done: the engine (`k8s.ts`, `kubectl`, `k3s`) and "The
  Pool" (story 36): a pod that won't start; a Service, an Ingress and a
  readiness probe; a database password moved from a ConfigMap and a git
  repository to a Secret (base64, `rollout restart`, rotation, `git log
  -p`); memory requests and limits under a swim meet's load (OOMKilled,
  `kubectl top`, a leaky release rolled back, `FailedScheduling`).

- [x] **A print server** (CUPS): a timeless chore. A stuck queue and its
  runaway job, a driverless queue and an old printer's PPD, sharing with
  one network only, logs and job history that keep too much. Done: story
  37, "The Staff Room" (`cups.ts`: `cupsd.conf` with its locations and
  policy, `printers.conf` written by cupsd, jobs and the spool, the logs
  and their rotation, the network's printers and clients; `lpstat`, `lp`,
  `lpr`, `lpq`, `cancel`, `lprm`, `cupsenable`, `cupsdisable`,
  `cupsaccept`, `cupsreject`, `lpadmin`, `lpoptions`, `lpinfo`, `cupsctl`,
  `cupsd -t`, `driverless`; `printer-driver-hpcups`).

- [x] **An internal certificate authority** (defensive PKI hygiene):
  internal names no public authority certifies, an expiring certificate,
  machines that must trust the root, a chain served without its
  intermediate, a stolen client certificate. Done: story 38, "The
  Airwaves" (`pki.ts`: keys, requests, certificates with subjectAltName,
  basicConstraints, keyUsage and extendedKeyUsage, CRLs, the `openssl ca`
  database, OpenSSL's chain building and its errors, the trust store;
  `openssl genpkey`/`req`/`x509 -req`/`verify`/`s_client`/`ca`/`crl`,
  `update-ca-certificates`, curl and wget against an internal PKI, nginx's
  `ssl_verify_client` and `ssl_crl`; an expiry watch from cron or a
  timer).

- [x] **A self-hosted forge and its CI** (defending the software supply
  chain): an ex-maintainer's leftover access and an unprotected branch, a
  CI that hands a deploy key to forks' code and prints it, releases nobody
  can verify. Done: story 39, "The Tool Library" (`forge.ts`: Forgejo's
  accounts, tokens, collaborators, protected branches, secrets, workflows
  and their runs and logs, pull requests from forks, its HTTP API;
  `forgejo admin user`, `forgejo-runner`; `sshsig.ts` and `ssh-keygen -Y`;
  git's config, signed commits and tags, reflog, reset, `push --force`,
  archive; `jq -R`/`-s`).

- [x] **Virtualisation with KVM and libvirt** (the machines under the
  machines): a guest left behind after a power cut and frozen by a chain
  of forgotten snapshots, a guest on the wrong network and a hand-made
  clone with its original's MAC and machine-id, an overcommitted host and a
  full guest disk. Done: story 40, "The Health Centre" (`libvirt.ts`:
  domains and their XML, states, qcow2 images and backing chains,
  internal and external snapshots, block commits, the NAT network and the
  host's bridge, leases, QEMU's open files, the host's memory and swap;
  `virsh`, `qemu-img`, `virt-install`, `virt-clone`, `growpart`,
  `systemd-machine-id-setup`).

- [x] **High availability with keepalived and HAProxy** (a virtual address
  shared by two load balancers): a failover that didn't happen because
  nothing watched the service, a sick backend still receiving traffic and a
  server to take out for maintenance, a split brain after a firewall change
  and another VRRP group on the link. Done: story 41, "The Blood Drive"
  (`keepalived.ts`: the configuration, the VRRP election second by second,
  tracked checks, preemption, unicast, bogus adverts, the firewall between
  the nodes; `haproxy.ts`: the configuration and `haproxy -c`, health
  checks, balancing, the runtime API, the HTTP log; `keepalived`,
  `haproxy`, `socat`, `tcpdump`, `pidof`).

- [x] **Personal data and retention** (the GDPR from the sysadmin's side):
  logs kept for years against a written policy, a member's access request,
  an erasure that keeps the accounting records, a purge that really runs and
  backups that age out. Done: story 42, "The Choir" (logrotate's `maxage`,
  nginx's `map` and `log_format`, journald's `MaxRetentionSec=`, psql's
  WHERE with dates, `INSERT`, `--csv`, restic's `--keep-within`).

- [x] **A Red Hat family machine** (Rocky Linux 10): the other family's
  tools for a Debian sysadmin (dnf, rpm, firewalld's two configurations),
  then SELinux (labels kept by mv, semanage fcontext and restorecon, a port
  type, a boolean with -P, audit2why's suggestions and audit2allow's
  modules as false leads). Done: story 48, "The Language Café"
  (`rhel.ts`, `selinux.ts`, `firewalld.ts`, `rpm.ts`, `httpd-rhel.ts`;
  the `rhel` family). Later: updates (`dnf updateinfo`, `--security`,
  `dnf history undo`, `dnf needs-restarting -r`).
- [x] **Rootless containers** (Podman 5.4, Debian 13): an app moved from
  Docker as root to Podman under its own account (subordinate ids, the
  namespace's mapping and the data's owner, unprivileged ports behind a
  reverse proxy), then kept running with nobody logged in (Quadlet, linger,
  a reboot). Done: story 50, "The Walking Club" (`podman.ts`; `podman`,
  `loginctl`, Quadlet's dry run and `systemctl --user` in the `podman`
  family; `usermod --add-subuids`; three errors in the error explainer).
- [x] **AppArmor** (Debian 13's mandatory access control): a web app's
  data moved and refused by its profile, and a profile of one's own for a
  script that runs as root. Done: story 51, "The Zine Library"
  (`apparmor.ts`: profiles, the kernel's policy, attachment at exec, enforce
  and complain, audit records in the kernel's log or audit.log;
  `aa-status`, `apparmor_parser`, `aa-enforce`, `aa-complain`,
  `aa-disable`, `aa-autodep`, `aa-logprof`, `aa-genprof` in the `apparmor`
  family; two errors in the error explainer).

- [x] **The disaster recovery plan** (the series' finale, on existing
  models): a written plan made true (RPO, RTO, owners, backups within
  their RPO), a rebuild on a spare machine after a flood, the switch, the
  review and the next drill. Done: story 47, "The Shelter" (restic's
  `sftp:` repositories and `snapshots --path/--host/--latest/--json`, the
  `postgresql` package, a story's own curl between its machines through
  `state.storyCurl`).

- [x] **Infrastructure as code** (OpenTofu): a record added through the
  code (init, fmt, validate, a variable, plan, apply), then the drift of an
  incident: a forgotten run holding the state lock, a hand change the code
  must follow, a record adopted with import. Done: story 49, "The Mapping
  Party" (`hcl.ts`: HCL and `tofu fmt`; `tofu.ts`: the hashicorp/dns
  provider on the game's BIND, the local state and its lock, plans and
  drift, import; the `iac` family; four errors in the error explainer).

- [x] **Secrets in git** (SOPS and age): a `.env` committed in clear and
  leaked, encrypted with a creation rule, its password rotated and
  decrypted at deploy time; then a volunteer's key added, a leaver's
  removed, the data key and the secret rotated. Done: story 52, "The
  Tenants' Union" (`sops.ts`: age keys in Bech32, the dotenv store, the
  ENC[…] values, the MAC, `.sops.yaml`; `sops` and `age-keygen` in the
  `secrets` family; `.gitignore` in git; four errors in the error
  explainer).

- [x] **Self-hosted object storage** (Garage, S3 clients): a website
  bucket that also served private documents, a backup that failed on a
  clock, a region and a key, a big file shared for a week while a node lay
  dead. Done: story 46, "The Dance Troupe" (`garage.ts`: nodes, layout,
  buckets, website access, keys and permissions, Garage's request checks,
  presigned URLs; `objects-client.ts`: `garage`, `aws`, `rclone` and curl
  in the `objects` family; six errors in the error explainer).

- [x] **UPS and power cuts** (Network UPS Tools 2.8.1, Debian 13): a
  monitor watching a UPS that no longer exists, a NAS nobody warns, a worn
  battery and alerts that cry wolf. Done: story 45, "The Climbing Wall"
  (`nut.ts`: the mains, the UPS and its battery, the machines' halts and
  power restore policy, upsd, upsmon, upssched; `upsc`, `upscmd`, `upsrw`,
  `upsmon`, `upsd`, `upsdrvctl`, `ipmitool` in the `nut` family).

- [x] **Running MariaDB** (Debian 13's 11.8 LTS): connections that pile up
  and a query without an index, an app given root over the network, a
  replica stopped on a duplicate key and backups nobody restored. Done:
  story 43, "The Allotments" (`mariadb.ts`: option files, variables,
  accounts and unix_socket, privileges, connections, the slow query log,
  the binary log and a replica's threads; `mariadb-sql.ts`; `mariadb`,
  `mariadb-dump`, `mariadb-admin`, `mariadb-check`,
  `mariadb-secure-installation`; five MariaDB errors in the error explainer).

- [x] **An inbound mail server** (Postfix receiving, Dovecot 2.4 with
  Pigeonhole's Sieve, rspamd 3.12): a mailbox over quota, spam thresholds,
  a whitelist and Bayes, Sieve sorting and a vacation reply. Done: story 44,
  "The Lifeboat" (`dovecot.ts`: configuration, passwd-file userdb, Maildir,
  quota and warnings, LMTP; `sieve.ts`; `rspamd.ts`: UCL, actions,
  multimap, settings, Bayes, greylisting; `inbound.ts`; `doveadm`,
  `doveconf`, `sievec`, `sieve-test`, `rspamc`, `rspamadm` in the `inbound`
  family; four errors in the error explainer).

### Other ideas

- [ ] **Everyday commands still missing.** A review of about 400 forms a
  sysadmin types by reflex (November 2026) filled the biggest gaps:
  redirections (`2>`, `&>`, `2>&1`, `<`, `<<<`, `/dev/null`), `$HOME` and
  the login's variables, `~`, `$(…)`, braces, `[…]`, `!$`, the backslash,
  `true`/`false`/`[`, `type`, `command`, `alias`, `printf`, `echo -e`,
  `id -u`, `ls -t/-r/-S/-R/-1`, `cp -a/-i/-v`, `mv -i/-v`, `rm -f/-i/-v`,
  `rmdir`, `find` (`-exec`, `-size`, `-perm`, `-newer`, `-o`, `!`…),
  `xargs`, `env`, `printenv`, `sort -k/-t/-u/-h/-V`, `uniq -d/-u`, `cut`
  ranges and `-c`, `head -n -N`, `tail -n +N`, `sed` ranges, `tar czf`,
  `tar -xv`, `df -T`, `du -a/-c`, `curl -o/-O`, `ping -c1`, and `vim`
  pointing to nano. Still missing, roughly by how often they are typed:
  - [x] **A chapter's commands**: a chapter keeps the commands of every
    chapter it assumes (`src/engine/availability.ts`), when its machine's
    system has them and the tool is installed there; The Watch's "fix"
    went from 14 commands to more than 50. The teachers' sheets still list
    only the chapter's new ones, and `help` shows the inherited ones on a
    line of their own. Left: a command no assumed chapter teaches is still
    "not learned yet" (`ps` in a chapter whose path never met it).
  - [x] **A Debian machine's default state**: a chapter that models no
    mounts, processes, memory or network gets those of a small Debian 13
    virtual machine (`src/engine/debian.ts`): `df -h`, `mount`, `findmnt`,
    `ps aux` (systemd, journald, cron, sshd, the session's bash, `ps`
    itself, the chapter's running services), `free`, `top`, `ip a`, `ip r`,
    `hostname -I`, `/etc/os-release`, `hostnamectl`; `lsb_release` stays
    "command not found" (lsb-release isn't installed by default).
  - [x] **Package management**: `apt remove`/`purge`/`autoremove`/
    `search`/`show`/`policy`/`list`, `apt-get` and `apt-cache` (the
    scripts' forms), `dpkg -l`, `-L`, `-S`, `-s`, on a base of about sixty
    trixie packages (`src/engine/packages.ts`); `lsb_release` comes with
    the lsb-release package. Left: `apt-mark`, `dpkg -i`.
  - [x] **Shell control flow on the line**: `for`, `if`, `while`/`until`
    (and `while read`), `case`, `break`/`continue`, `{ …; }` and `( … )`,
    here-documents, `$((…))` and `((…))`, `${VAR:-x}` and the other
    parameter expansions, the secondary prompt `>` for an unfinished input,
    `seq`, `read`; an unset variable is empty (`compound.ts`, `control.ts`,
    `arith.ts`); functions, `[[ … ]]`, `$'…'`, `source`. Left: arrays,
    `select`, `eval`.
  - [x] **Scripts in the real shells**: `/bin/sh` scripts, `bash` scripts,
    git hooks, `postrotate`, cron lines and `ExecStart=` read by the same
    parser and runner as the interactive line (`script.ts`, `dialect.ts`):
    every compound, functions with `$1`, `$#`, `"$@"`, `shift`, `local`,
    `return`; `set -e`, `-u`, `-x`, `-o pipefail`, `trap … EXIT`,
    `getopts`, `.`; the `#!` line picks bash or dash, and each shell gives
    its own errors (`[[: not found`, `Syntax error: "(" unexpected`,
    `line 3: … command not found`), checked against the real dash and bash
    (`tests/scripts-compound.test.ts`); `sh -c`, `-x`, `-n`.
  - [x] **Becoming root**: `sudo -i`, `sudo -s`, `sudo su`, `sudo su -`,
    `su -` (root's password: "Authentication failure" on Debian), a root
    shell with its `#` prompt, `/root`, root's `PATH`, `exit` or Ctrl-D
    back; `sudo !!` works (`Shell.shells`, `su` in
    `commands/shell-control.ts`).
  - [x] **Compressed files**: `gzip`, `gunzip`, `zcat`, `zgrep`, `zless`,
    `zmore`, `zdiff`, `bzip2`, `xz` and their `cat`s, `zip`/`unzip` (after
    `apt install`), `tar -j/-J/-a` and `tar -tv` with the directories
    (`compression.ts`, `commands/compress.ts`); logrotate writes real `.gz`
    files, The Full Disk's `syslog.2.gz` reads with `zcat`.
  - [x] **Jobs**: `&`, `jobs`, `fg`, `bg`, `wait`, `disown`, `kill %1`,
    Ctrl-Z, `nohup`, `watch` (`jobs.ts`). Left: `screen` (tmux exists).
  - [x] **systemd and the journal**: `systemctl list-unit-files`,
    `systemctl status` without a unit, `is-enabled` of a static unit,
    `journalctl --since "1 hour ago"`, `-p warning..err`, `-b -1`,
    `--list-boots`, `-r`, `-g`, `-o short-iso`/`cat`; a Debian machine
    without a systemd model gets the base services (`debian.ts`).
  - [x] **Accounts**: `useradd -m -s /bin/bash -G grp` with Debian's
    defaults, `adduser` and its questions, `passwd` (one's own, root's,
    `-l`, `-u`, `-S`), `su ACCOUNT` with its password, `getent passwd`/
    `group`/`hosts`/`shadow`, `w`, `lastlog2` (Debian 13 dropped
    `lastlog`). Left: `groupadd`, `deluser`, `chpasswd`.
  - [x] **Small tools**: `basename`, `dirname`, `realpath`, `yes`, `tac`,
    `nl`, `column -t`, `paste`, `md5sum`, `sha1sum`, `cmp`, `whereis`,
    `more`, `vmstat`, `lscpu`, `sync`, `timeout`, `install`,
    `shutdown`/`poweroff`/`halt`, `chattr`/`lsattr` (`+i`, `+a` honoured),
    `ss -s` (`commands/small-tools.ts`); `htop` and `cal` stay "command
    not found", as on a minimal Debian.
  - [x] **Network clients**: `wget` (`-O`, `-qO-`, `-q`, `--spider`, on
    top of the game's curl), `nslookup`, `host` without a DNS model (the
    story's network, else a timeout) (`commands/net-clients.ts`);
    `tracepath`, `mtr`, `ifconfig`, `route` stay "command not found" as on
    Debian, and `ifconfig` earns a tip pointing to `ip a`, `ip r`, `ss`.
  - [x] **Finer points**: `du` counts 4 KiB blocks (apparent sizes with
    `-b`, `--apparent-size`); `ls -l` with links, dates (the six months
    rule, the language's months) and `total`, aligned like GNU ls; `tar`
    lists directories; `curl -o` shows its progress meter (`-s` silences
    it); `cp -u`, `ls -F`, `touch` on an existing file, `find -prune`/
    `-xdev`/`-ls`. Left: `mv` of a directory and `rm -r` (refused by
    design), hard links' count in `ls -l`.
- [ ] **An offensive story**: understanding an attack by replaying it, not
  just reading its outcome. Outside the game's usual scope ("Game rules" in
  `CLAUDE.md`: security quests stay defensive); a guide for whoever wants to
  build it is in `docs/OFFENSIVE-STORY.md`.
- [x] **Difficulty**: 1 to 5 stars per chapter (and a range per story),
  computed on an absolute scale from the chapters it assumes and from its
  size (`src/engine/difficulty.ts`), so that adding a story changes no
  other story's levels; in the menu, the learning paths and the teachers'
  sheets.
- [x] **On-call duty and the incident of the day** (`src/engine/on-call.ts`):
  every day, a chapter drawn from the date (the same for everyone, with no
  server) among the chapters of the learning paths about failures that
  the player can already open (the button stays hidden until there is
  one); an error budget of 30 minutes that melts with time (−3 min per
  hint, −20 s per failed command); at the end, a score card as text to copy
  (a five-box gauge); the day's best result is kept in the browser.
- [x] **On-call streak** (`src/engine/streak.ts`): the consecutive days
  whose incident was solved, counted on calendar dates in the player's
  time zone (the interface passes them; a 23- or 25-hour day is one day),
  one rest day in any seven that doesn't break it, today never counted
  against the player before it ends, dates after today (a clock set back)
  ignored until they come. Shown under the menu's entry and at the end of
  on-call, in kind words; achievements at 3, 7 and 30 days. Computed from
  the on-call results (`KEY-on-call`), which the save file now carries
  (`onCall`, the best of each day, merged on import) so the streak follows
  a player to another device; not in the short code (it holds finished
  chapters only and must stay short).
- [x] **End-of-chapter summary** (`src/engine/summary.ts`): time spent,
  commands typed (and failed), hints; the detail compares, step by step,
  the command that passed it with the reference solution (the hints'), and
  reminds that another way is just as right.
- [x] **Replay and compare** (`src/engine/runs.ts`): the summary offers
  "Replay this chapter" (the same chapter from the start, on a fresh
  machine); each finished run is kept in the browser (`KEY-runs`: the last
  three per chapter, the 30 chapters played last, 60 lines of 120
  characters per run at most), and a run that has earlier ones gets a
  comparison in the summary's dialog: a table (a column per run) of
  commands, distinct commands, failed commands, hints and time, with the
  trend since the last run, then both runs' commands diff-like (−/+, words
  for screen readers). The expected route stays the summary's reference
  solution (the hints'): nothing more. In exam mode, runs are recorded
  (marked "exam mode") and compared like the others, only once the chapter
  is finished, as the summary itself: nothing is shown during a chapter,
  so a run kept on a shared computer can't serve as a crib. Not in the save
  file (a log of commands, not progress).
- [x] **Reminders and new-content notices, static only** (no server, no
  push):
  - a **daily reminder** (`src/engine/reminder.ts`): "📅 Daily reminder"
    in the menu makes an iCalendar file (RFC 5545) in the browser, a daily
    event (`RRULE:FREQ=DAILY`) with an alert (`VALARM`), at a floating
    local time (no `TZID`: it would need a `VTIMEZONE` the browser can't
    write faithfully; a UTC time would move with daylight saving time),
    a stable `UID` per language (importing again updates the event in the
    calendars that honour it), a link to the game; downloaded as a Blob
    (the dialog's texts in `dialog-reminder.ftl`);
  - **Atom feeds** of new stories, `/en/feed.xml` and `/fr/feed.xml`
    (`src/engine/feed.ts`, `src/feeds.ts`), written by the build from a
    release date per story (`src/engine/releases.ts`, written when a
    story is added, checked by `tests/releases.test.ts`: deterministic,
    unlike dates read from git in a shallow clone), announced by `<link
    rel="alternate">` on every page and linked in the footer;
  - **"New" badges** in the menu (`whatsNew`, `KEY-whats-new`): the stories
    released after the newest date seen at the last visit, until opened or
    for 30 days; nothing on a first visit; and, in the installed game only,
    the **app badge** (`src/pwa/badge.ts`, Badging API, feature-detected):
    the new stories plus today's incident not solved yet, shown once the
    app is in the background, cleared when it is seen;
  - **no background check** (Periodic Background Sync): Chromium only, for
    installed apps with enough engagement, at an interval the browser
    chooses (often a day or more, sometimes never); the service worker
    would also need a copy of the game's state (localStorage is out of its
    reach). It could only refresh a badge the game already sets when it is
    left, while the calendar reminder covers the daily nudge on every
    platform: not worth the complexity for now.
- [x] **Rescue snapshot** (Mission panel, `Console.restore`): take a
  snapshot, go back to it, undo the last input. The engine is
  deterministic: reopening the chapter and replaying the inputs (commands,
  answers, nano saves) gives back the machine as it was. No snapshot in exam
  mode, nor after going through the workstation.
- [x] **Autosave inside a chapter** (`src/engine/autosave.ts`): after each
  input, the chapter and its inputs (compact: a run of follow seconds kept
  as one) go to `localStorage` (`KEY-autosave-LANGUAGE`: names and passwords
  are typed in the language); on opening the game, a banner offers to
  resume (the inputs replayed, the end of the terminal shown again) or to
  start the chapter again. Forgotten when the chapter is finished or
  restarted. A new version of the game that changed the chapter is
  detected (its opening text, and a fingerprint of the machine after the
  replay) and the chapter starts again with a message. In exam mode, the
  timer goes on from the chapter's start; an autosave from outside exam mode
  is not offered in it. Not during on-call duty. What follows a passage
  through the workstation (exit, a reboot, a resumed session) or a 5250
  session is not recorded: the autosave keeps its last replayable point. A
  setting turns it off; capped at 4,000 inputs or 1 MB.
- [x] **Error explainer** (`src/engine/explainer.ts`): under the output of
  a command that failed with a message beginners often misread ("Permission
  denied", "No such file or directory", "command not found", "Connection
  refused" or "timed out", "Could not resolve host", "Address already in
  use", a systemd unit not found or failed, `nginx -t`, a shell syntax
  error, YAML, sudo, PowerShell's "is not recognized"…), a discreet "What
  does this error mean?" button unfolds 2–4 sentences in plain words: what
  the message means and which manual page or diagnostic command to turn to,
  never the chapter's answer. The output itself never changes. The messages
  it recognises are listed in `explainer.ftl` (`.match`), as the game
  prints them in each language, English's always read too; only the line's
  own errors are read (a log shown by `cat` is never explained). Announced
  to screen readers only when opened. Never in exam mode (like hints and
  tips: the exam measures what the player knows alone); a setting ("Error
  help") turns it off. No `explain` command: the game's commands are real
  ones.
- [x] **Learning paths** (`src/engine/paths.ts`, the menu's third view):
  first steps, security, web, networks, backups, containers and deployment,
  production, accounts and identities; each chapter is in at least one
  path; the next one to play is highlighted, and what is waiting says which
  chapter to finish first.
- [x] **Report a problem or an idea** (`src/engine/feedback.ts`): a dialog
  under the menu, among a chapter's actions and from the site's footer
  (`src/pwa/feedback-link.ts`, the element's `openFeedback()`): the kind,
  a message, the context parts to include, each showing exactly what it
  adds (the version written at build time by `src/version.mjs`, the
  language, where the player is, the chapter's last commands and outputs,
  editable, never a password, the browser, the settings, the notebook's
  commands), the exact text, then a prefilled GitHub issue (a link in a new
  tab, under 8 KB: the oldest commands dropped, said) or a copy. Progress
  codes are removed; nothing is sent. In exam mode, without the commands.
  Issue template `.github/ISSUE_TEMPLATE/feedback.md`.
- [x] **Where do I start?** (`src/engine/start-here.ts`): four quick
  questions (experience with a terminal, goal, systems of interest, time
  per session) and a suggestion computed from them and the player's
  progress: a learning path, the chapter to play first (always one that
  opens now; when the path's first chapter is locked, how many chapters
  open it), one or two other ways in, each with its reason and difficulty
  stars, and a Start button. Teachers are pointed to the quest sheets. A
  first visit gets a card above the menu (not a window) and the intro
  tour's last step points at it; the menu's button is always there, except
  in exam mode. The answers stay in this browser with the display
  settings, never in the progress code or the save file.
- [x] **Accessibility pass, WCAG 2.2 AA** (`docs/ACCESSIBILITY.md`,
  `tests/a11y.mjs`): axe-core on every page and state of the game (light
  and dark, 1000 and 375 px) fails the browser tests on a serious or
  critical violation; the command line named with its prompt, Shift+Tab and
  Escape then Tab to leave it, Alt+R (or a button shown on focus) to read
  the last output again, a follow's digest every ten seconds instead of
  every line (`src/engine/announce.ts`), a chapter's end announced
  politely; wide outputs reachable with the keyboard, a skip link, no
  ligatures in monospace text, forced colours, reduced motion everywhere,
  reflow at 320 px with text spacing, the terminal colours' contrast
  checked in every theme (`tests/terminal-contrast.test.ts`). The texts of
  "Where do I start?" and "Report a problem" load when their dialog first
  opens (`dialog-*.ftl`).
  - [ ] Test with real screen readers (NVDA, JAWS, VoiceOver, TalkBack) and
    note what they do with the log and the digests.
  - [ ] A "screen reader mode" that reads tables (ls -l, ps, ss) by rows
    with their column names.
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
  less motion). Only the open stories are on the map; the locked ones wait
  in a folded list under it (after playtesting, the "Racks" view was
  removed: three views of the same list were too much). The other view is
  the learning paths, one row per chapter; the choice is kept in the
  browser.
- [x] **Terminal display**: four themes (phosphor, amber, high contrast,
  paper), text size, full screen (Escape leaves it), kept in the browser;
  staging of a connection and of a reboot (turned off if the system asks
  for less motion).
- [x] **Class table** for teachers: drop the students' save files (or paste
  their codes); chapters, rank, achievements, best exam, progress per
  story; CSV export (with no injectable formula); everything stays in the
  browser.
- [x] **Teachers' printouts**: the class table's CSV with one column per
  chapter (1 finished, 0 not), each story's count, the last save and the
  on-call streak, a byte order mark for spreadsheets and the separator
  they expect in the page's language (`,` in English, `;` in French, which
  the teacher can change); a print view of the table (landscape). A
  printable sheet per story (`/en/teachers/sheets/<story>/`,
  `/fr/enseignants/fiches/<story>/`): goals without solutions, new
  commands, the manual pages to read, the debrief's documentation,
  questions to check what was learnt, and, folded, a teacher's version
  with the solution route (the game's own third hints), printed only when
  opened; A4 and Letter, black and white, links written out. Still
  possible: questions written for each chapter from its debrief.
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
- [x] **Install the game** (Progressive Web App), to play on mobile more
  often: "Install the game" in the site's footer when the browser offers
  it (Safari's "Add to Home Screen" explained on iOS), a manifest per
  language, and a service worker that keeps the game playable offline
  (`src/pwa/`); never in the embeddable element.
- [x] **Fast first load on mobile**: the game in chunks (each story's
  chapters, each group of texts, the manual's pages) loaded when needed,
  the menu from a generated catalogue, an empty frame while the game loads,
  a budget checked by the build (`tests/budget.mjs`); on a throttled phone,
  the terminal answers in about 5.7 s instead of 12.3 s. The service worker
  precaches only the shell and keeps the stories played.

---

## Organisation

- A **dedicated agent** on the repository, with a CLAUDE.md that takes over
  rouages.net's rules: accessibility, static, tests before pushing,
  automatic PR, differences with the real Linux documented, no personal
  data; English first since October 2026.
- Recommended order (followed): phase 0, then 1 (multi-host engine), then 2
  and 3 (the core of the job), then 7 (backups), before containers and
  deployment.
