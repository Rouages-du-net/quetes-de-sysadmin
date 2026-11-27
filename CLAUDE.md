# Sysadmin Quests — instructions for Claude

An educational browser game to learn system administration, on Linux and
on Windows (see `README.md`, `CONTRIBUTING.md`, `docs/SCENARIOS.md` and
`docs/ROADMAP.md`).
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
  (`REFERENCE_LANGUAGE` in `src/texts/index.ts`): a text is written in
  English first, and every key exists in English (`tests/texts.test.ts`).
  English is also the default and fallback language.
- **The repository is in English**: documentation, code comments, commit
  messages and pull requests. French versions are kept for `README.fr.md`,
  `CONTRIBUTING.fr.md` and `docs/INTEGRER.md` (keep them in step with the
  English ones); every other document is in English only.
- **Code in English.** Files and identifiers (functions, variables,
  types, props), and the world (places, machines, accounts, passwords) are
  in English, and so are the `.ftl` files, keys and variables (`{ $target }`)
  and the keys of a machine's state (`state.mounts`, `state.apps`…), CSS
  classes, `data-*` attributes, internal values and comments. Write all
  new code in English; never mix a large rename with a feature. A public name (attribute of
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
- `src/engine/` (the engine): simulated shell (`shell.ts`), commands
  (`commands/`, including the manual: `manuel.ts`, `pages.ts`, `examples.ts`), world
  (`world.ts`), stories (`chapters/`). No dependency on the DOM.
- `src/engine/systemd.ts`: a machine's services, journal and clock
  (`systemctl`, `journalctl`, `reboot` in `commands/systemd.ts`).
- `src/engine/units.ts`: dependencies between units, read from the unit
  files and their drop-ins (`After=`, `Requires=`, `Wants=`, `BindsTo=`,
  `PartOf=`, `Restart=`, `RestartSec=`, the start limit), the order and
  timing of a boot (`Systemd.ordered`, `bootUnits`; the mounts of
  `/etc/fstab` on `state.devices` become units, `RequiresMountsFor=`),
  restarts scheduled by
  `Restart=` (`runPending`); `systemctl cat`, `list-dependencies`,
  `reset-failed`, `systemd-analyze time`/`blame`/`critical-chain`/`verify`
  and `networkctl` in `commands/systemd.ts` (with `systemctl status` of the
  whole machine, `list-unit-files`, and journalctl's `-b N`, `--list-boots`,
  `-o`, `-r`, `-g`, relative `--since`); `chapters/canteen.ts`: what
  The Canteen's chapters share.
- `src/engine/sshd.ts`: a machine's SSH server (`sshd_config` read like
  OpenSSH, configuration applied on reload).
- `src/engine/firewall.ts`: a machine's firewall (ufw rules; `ssh` runs into
  it).
- `src/engine/fail2ban.ts`: a machine's fail2ban (configuration, sshd,
  nginx-limit-req and recidive jails, bans, the jail's `port`; `ssh` runs
  into it). `src/engine/nft-preview.ts`: what `nft list ruleset` shows under
  ufw and fail2ban.
- `src/engine/cron.ts`: crontabs (parsed like cron) and the simulated night.
- `src/engine/nginx.ts`: a machine's nginx (configuration read and checked
  like `nginx -t`, applied on reload; `curl` talks to it); `apt` and the
  `nginx` command in `commands/apt.ts`.
- `src/engine/apache.ts`: a machine's Apache (Debian's configuration read
  like `apache2ctl configtest`, virtual hosts, `.htaccess` and
  `AllowOverride`, `mod_rewrite`); reached by nginx and `curl` like an app
  (`state.apps`); the package's `/etc/apache2` in `apache-debian.ts`;
  `apache2ctl`, `a2ensite`, `a2enmod`… in `commands/apache.ts`.
- `src/engine/mail.ts`: a machine's mail (Postfix: `main.cf`, the
  queue, `/var/log/mail.log`; OpenDKIM: `opendkim.conf`, key, signing as
  mail goes through the milter; SPF, DKIM and DMARC checked by the servers
  on the other side with the simulated DNS); `postconf`, `postfix`,
  `postqueue`, `mailq`, `postsuper`, `opendkim-genkey`, `opendkim-testkey`
  in `commands/mail.ts`; `chapters/gardens.ts`: what the chapters of
  "Junk Mail" share.
- `src/engine/ansible.ts`: Ansible (a subset of YAML, `ansible.cfg`, INI
  inventory, modules, `become`, `--check`, `--diff`, handlers, PLAY RECAP);
  connections go through `connectWithoutQuestion` in `access.ts` (like
  BatchMode); `ansible`, `ansible-playbook`, `ansible-inventory`,
  `ansible-doc` in `commands/ansible.ts`; `chapters/fleet.ts`: what the
  chapters of "The Fleet" share.
- `src/engine/caddy.ts`: a machine's Caddy (`state.caddy`: Caddyfile read
  like the adapter, `caddy fmt`, automatic HTTPS with a simulated ACME
  authority that DNS and the firewall can block, JSON logs, what Caddy
  answers to `curl`); `caddy` in `commands/caddy.ts`.
- `src/engine/tls.ts`: certificates (PEM files the game can read);
  `certbot` in `commands/certbot.ts` (the HTTP-01 challenge goes through
  the simulated nginx), `openssl` in `commands/openssl.ts` (see `pki.ts`).
- `src/engine/dns.ts`: DNS (BIND zones, primary, secondary, resolver
  cache); `dig`, `host`, `named-checkzone`, `rndc` in `commands/bind.ts`.
- `src/engine/docker.ts`: a machine's Docker (images, containers, layer,
  volumes, published ports, `--restart`, the container's user and rights on
  mounted directories); the apps of the images are declared by the chapters
  (`APPS`); the command in `commands/docker.ts`. Docker Compose
  (`compose.yaml`, `.env`, the project's network) in `src/engine/compose.ts`.
- The interactive line's redirections (`2>`, `&>`, `2>&1`, `>&2`, `<`,
  `<<<`, `/dev/null`: `split`/`redirectionAt` in `tools.ts`, routed per
  command by `Shell.tube`), expansions (`Shell.expandLine`: variables a
  login sets, `Shell.defaults()`, `$(…)` and backticks run by `capture`;
  `braces()`, `Shell.tilde`, `glob()` in every part of a path,
  `Shell.expand`), history's `!$`/`!^`/`!*`; bash's builtins `true`,
  `false`, `type`, `command`, `printf` in `commands/builtins.ts` (`[ … ]`
  becomes `test` in `tube`); `ALWAYS_THERE` and `COMPANIONS` in `shell.ts`:
  what every chapter knows, and the companions a chapter's command brings.
  `find` (an expression of tests, operators and actions, `-exec`) in
  `commands/files.ts`; `xargs`, `env`, `printenv` in `commands/everyday.ts`.
- Command lists on the interactive line (`a && b || c; d`): `splitList`
  and `listRuns` in `src/engine/tools.ts`, run by `Shell.runLine`/`runList`
  in `shell.ts` (each command as if typed alone: events, `afterCommand`;
  paused by sudo's password, a question or nano, `Shell.pendingList`;
  `Shell.listContinues` tells a chapter another command follows, as
  `new-card.ts` does for `ifdown eth0 && ifup eth0`); cron and
  `underCommand` go through `script.ts` (`sh -c`); cmd.exe's `&`, `&&`, `||` in
  `commands/cmd.ts`; PowerShell 5.1 refuses `&&`/`||` (`powershell-parse.ts`).
- Compound commands on the interactive line: `src/engine/compound.ts`
  parses an input (for, `for ((…))`, if, while, until, case, `{ …; }`,
  `( … )`, `((…))`, `&`, newlines, comments, here-documents, functions
  `name() { …; }`, bash's `[[ … ]]`; a script's lines: `parseScript`) and says when
  it is unfinished (`Shell.continuation`, the PS2 prompt `>`, Ctrl-C
  `dropInput`, Ctrl-D `endOfInput`); `src/engine/control.ts` runs it as a
  generator (each simple command through `Shell.runSimple`, as if typed;
  a question pauses it, `Shell.program`; `MAX_ITERATIONS` guards loops;
  `read`, `break`, `continue`); `src/engine/arith.ts`: `$((…))`; parameter
  expansion in `Shell.parameter`; `seq`, `read`, `break`, `continue` in
  `commands/shell-control.ts`.
- Root shells: `sudo -i`, `sudo -s`, `sudo su [-]` (parsed in `Shell.tube`,
  sudo's policy decides) and `su` (`commands/shell-control.ts`) open a
  shell on top of the login one (`Shell.shells`, `openShell`; `shellUser`,
  `shellHome` for the prompt, `~`, `$HOME`, `cd`); `exit`/Ctrl-D leave it,
  a new connection closes them (`closeShells`).
- Jobs: `src/engine/jobs.ts` (`Shell.jobs`, `cmd &` through
  `Shell.background`, reported after the next input by `notices`; `jobs`,
  `fg`, `bg`, `wait`, `disown`, `kill %N`, Ctrl-Z `Shell.suspend` and
  `Console.suspend`); `nohup` and `watch` (a follow with `screen: true`,
  redrawn by the interface) in `commands/shell-control.ts`.
- `src/engine/debian.ts`: a Debian machine's default state, given by the
  Shell's constructor when the chapter models none (`debianDefaults`):
  base mounts (`pseudo` ones only for `mount`/`findmnt`, `bytesBase`),
  base processes (`base`, kept by a reboot; `state.baseProcesses`: `ps`
  shows itself), a systemd with the base services (`BASE_SERVICES`,
  `Service.static`) and their journal (`state.baseSystemd`), memory, `/etc/os-release` and `/etc/debian_version`;
  `baseLan` (lo, eth0 with the machine's address, `state.baseLan`) for `ip`
  and `hostname -I`; `hostnamectl` in `commands/hostnamectl.ts`.
- `src/engine/script.ts`: shell scripts (`sh`, `bash`, `./script` by its
  `#!` line, git hooks, `postrotate`, cron lines through `runTask`,
  `underCommand` for `ExecStart=`, ssh remote commands, Ansible's shell)
  read by `parseScript` of `compound.ts` and run by `control.ts` in a child
  shell (`Shell.isolated`), without the story's events;
  `src/engine/dialect.ts`: bash, dash (Debian's `/bin/sh`), FreeBSD's sh,
  Solaris's sh and their error messages (`rewrite`, `syntaxError`,
  `notFound`), `ScriptRun` (`Shell.script`); functions (`Shell.functions`,
  `positional`, `locals`), `return`, `exit`, `source`/`.` and `set -e` in
  `control.ts`; `set`, `shift`, `local`, `trap`, `getopts`, `[[ … ]]`
  (`conditional`) in `commands/shell-builtins.ts`; `sh -c`/`-x`/`-n`,
  `test`, `date` in `commands/scripts.ts`; git (bare repositories, `push`,
  hooks) in `commands/git.ts`, `diff` in `commands/diff.ts`.
- `chapters/kiosk.ts`: the app of The Gazette's deployment chapters
  (blue/green, `/health`, migration, simulated visits); nginx can balance
  between several servers (`upstream`).
- `commands/disks.ts` (`lsblk`, `mount`, `umount`, `state.devices`),
  `commands/rsnapshot.ts`, `src/engine/postgres.ts` and
  `commands/postgres.ts` (`psql`, `pg_dump`, `pg_restore`, `createdb`,
  `dropdb`); a running PostgreSQL server (`state.postgres.server`:
  settings read from `postgresql.conf`/`postgresql.auto.conf` on reload or
  restart, sessions, the connection limit, indexes) in
  `src/engine/pg-server.ts`, its SQL (`pg_stat_activity`, `SHOW`,
  `ALTER SYSTEM`, `EXPLAIN`, `CREATE INDEX`, `pg_promote()`…) in
  `commands/pg-admin.ts`; roles and privileges (`server.acl`, `SET ROLE`,
  `GRANT`, default privileges) in `src/engine/pg-roles.ts` and
  `commands/pg-roles.ts`; a standby (`server.recovery`, `server.standby`,
  `standby.signal`), `pg_lsclusters`, `pg_ctlcluster`, `pg_isready` in
  `commands/pg-cluster.ts`;
  `chapters/theatre.ts`: what The Theatre's chapters share.
- `src/engine/open-files.ts` (files held open by a service: `lsof`, space of
  deleted files), `commands/logs.ts` (`lsof`, `truncate`,
  `logrotate`); `src/engine/memory.ts` (process memory, OOM killer,
  `MemoryMax=`) and `commands/memory.ts` (`free`, `top`, `dmesg`); systemd
  overrides (`systemctl edit`, `set-property`, `daemon-reload`) in
  `commands/systemd.ts`. Disk I/O (`state.io`: requests, scheduler,
  `IO*BandwidthMax=`, ionice classes) in `src/engine/disk-io.ts`,
  the processor (`state.cpu`: each process's demand, shares by nice
  weight, `Nice=`, `CPUQuota=`, `CPUWeight=`, the load average) in
  `src/engine/cpu.ts`, `uptime`, `nproc`, `nice`, `renice`, `pgrep`,
  `systemd-cgtop` in `commands/cpu.ts` (`chapters/observatory.ts`: what
  The Observatory's chapters share), a process's open-files limit
  (`Process.nofile`, `LimitNOFILE=`, `/proc/PID/limits`) in
  `src/engine/limits.ts`, `ulimit` and `prlimit` in `commands/limits.ts`,
  signals (`kill -SIGNAL`, `Process.ignores`, `state.onSignal`,
  `sendSignal`) in `commands/system.ts`,
  `iostat`, `pidstat`, `ionice` in `commands/iostat.ts`. Inodes: a medium
  of `state.mounts` may declare `inodes` (and `inodesBase`); `df -i`,
  `du --inodes`, `find -mtime` (the files' `mtime`); the ARG_MAX limit in
  `shell.ts`. A machine's time (time zone, drifting clock, NTP) in
  `src/engine/time.ts`, `timedatectl` in `commands/time.ts`. Hand-written
  units and systemd timers, and time passing minute by minute
  (`passTime`, timers and cron) in `src/engine/timers.ts`; the
  machine living while you play (`Chapter.activity`, `live()`) in
  `src/engine/activity.ts`, following with `tail -f`/`journalctl -f`
  (`Shell.follow`, `Console.follow()`, `interrupt()` for Ctrl-C);
  monitoring (`check_disk`, `check_http`, `check_procs`, outside the PATH),
  `mail` and `last` in `commands/monitoring.ts`. A command can set its
  exit code (`game.status`).
- `src/engine/storage.ts`: a machine's storage (`state.storage`: disks and
  SMART, GPT partitions, RAID 1 arrays, `/proc/mdstat`, the rebuild that
  progresses before each command, `Chapter.beforeCommand`); `smartctl`,
  `mdadm`, `sfdisk`, `grub-install` and `lsblk` on this model in
  `commands/storage.ts` (including `mdadm --create`); LVM (`storage.lvm`:
  PVs, VGs, LVs in segments, file system size) in `src/engine/lvm.ts`,
  `pvs`, `vgs`, `lvs`, `pvcreate`, `pvremove`, `vgextend`, `vgreduce`,
  `pvmove`, `lvextend`, `resize2fs`, `update-initramfs` in
  `commands/lvm.ts`; `/etc/fstab` (reading, `UUID=`/`LABEL=` sources, boot
  and emergency mode: `state.startMounts`, `state.continueBoot`
  called by `reboot`, `systemctl default` and `exit`) in
  `src/engine/fstab.ts`, `mount -a` in `commands/disks.ts`, `blkid` and
  `findmnt` in `commands/fstab.ts`; `chapters/lab.ts`: what The Lab's
  chapters share.
- `src/engine/compression.ts`: compressed files (a binary file with the
  real gzip, bzip2, xz or zip header, the text scrambled behind it, gzip's
  CRC-32 and ISIZE trailer; `packedFile` for a story's world, estimated
  sizes); `gzip`, `gunzip`, `zcat`, `zgrep`, `zless`, `zmore`, `zdiff`,
  `bzip2`, `xz` and their cousins, `zip`/`unzip` (package `zip`/`unzip`)
  in `commands/compress.ts`; `tar -j/-J/-a`, `-tv` and directories in
  `commands/files.ts` (`File.archive.format`, `dirs`, `entries`).
- `commands/small-tools.ts`: `basename`, `dirname`, `realpath`
  (`canonical()`), `yes`, `tac`, `nl`, `column`, `paste`, `cmp`, `whereis`,
  `more`, `vmstat`, `lscpu`, `sync`, `timeout`, `install`, `chattr`/`lsattr`
  (`Rights.attributes`; `immutable()`/`appendOnly()` of `tools.ts` checked by
  `rm`, `mv`, `chmod`, `touch`, `tee`, `Shell.place`, redirections, nano),
  `shutdown`/`poweroff`/`halt` (like `reboot`), `ss -s`; `md5sum` and
  `sha1sum` in `commands/checksums.ts`.
- `commands/net-clients.ts`: `wget` (through the game's `curl`),
  `nslookup`, and `host` without the simulated DNS (`hostWithoutDns`);
  the `net-tools` tip of `tips.ts` for `ifconfig`, `route`, `netstat`.
- `ls -l` (`longRow`, `longLines`, `lsDate`: links, dates by the six
  months rule, `total`), `ls -F`, `du` in 4 KiB blocks, `cp -u`, `touch`,
  `find -prune`/`-xdev`/`-ls`, `rm -r` (`removeSteps`: a generator for
  `-i`'s questions; `systemPlace`, `storyPlace` kept whole) and `mv` of a
  place in `commands/files.ts`; `nowOf()` of
  `time.ts`: the date a file without `mtime` has; curl's progress meter
  (`progressMeter`) in `commands/network.ts`.
- `commands/restic.ts`: restic repositories (snapshots, deduplication, keys,
  `forget` policies, `prune`), kept in `state.restic`.
- `src/engine/unlocking.ts`: stories open in waves; an added story
  declares in `chapters/index.ts` (`after`) the chapters to finish before
  receiving its key (`prerequisites()` for tests).
- Lazy loading (fast first load on mobile): the game is split in chunks.
  `src/element.ts` shows an empty frame, then fetches side by side the
  game (`interface/game.ts` and the engine), its core texts and the story
  it will open. Each story's chapters are a module, `src/engine/stories/<id>.ts`,
  loaded by `src/engine/story-registry.ts` (`loadStory`, `loadedStory`,
  `storyById`) when the story is opened, its machine named on the line,
  or its button hovered; the menu, unlocking, difficulty, paths, progress,
  hints' manual pages and on-call duty read `src/engine/catalogue.json`
  (`catalogue.ts`: ids, `after`, commands, size, each story's text files),
  generated from `chapters/index.ts` by `npm run catalogue` and checked by
  `tests/catalogue.test.ts`. The texts come in groups made by the Vite
  plugin `src/texts/plugin.mjs` (`<language>/core` with every chapter's
  title alone, `summaries` with their `.summary`, `shared` read in every
  language, `manual`, `story-<id>`): `loadTexts()` fetches one,
  `translator()` stays synchronous; a translation's core doesn't wait for
  English's (`loadTexts(language, 'fallbacks')`). Once the terminal is
  ready (`idle()` at the end of `mount()`), the interface fetches the
  summaries (the menu's `lazy()` nodes, the mission waits with
  `withTexts`), English's core, the manual's pages and their examples (the
  notebook shows a command's sentence once they are there). The interface
  loads what a line needs before running it (`needs()` in
  `interface/run-line.ts`);
  otherwise the engine throws `NeedsLoading` (`src/engine/loading.ts`) and
  the line runs again. The engine's families (`src/engine/families.ts`):
  the tools only some stories use (Windows' shells and cmdlets, k8s,
  libvirt, CUPS, Prometheus, keepalived/HAProxy, Forgejo, IBM i, COBOL,
  Ansible, Caddy, LDAP/RADIUS, MariaDB, Dovecot/rspamd (`inbound`), NUT,
  Garage (`objects`), OpenTofu (`iac`), rootless Podman (`podman`), AppArmor (`apparmor`), SOPS and age (`secrets`), OpenBao (`openbao`); `tls`: openssl, certbot and `pki.ts`; `docker`
  (with Compose); `apache`; `postfix` (`mail.ts`; `mail` asks it for
  `submit`); `postgres` (psql, pg_dump, the cluster's tools); `security`:
  nmap, Lynis, gpg; `samba`; `storage`: smartctl, mdadm, sfdisk, LVM's
  tools, lsblk on described disks; `luks`: cryptsetup; `lftp`;
  `rsnapshot`; `jq`) are modules of `families/` that
  `registerFamily` their commands and hooks; a story module imports the
  ones its chapters use (`import '../families/k8s'`, checked by
  `tests/families.test.ts`, plus those its world needs by itself,
  `RUN_BY_THE_WORLD` there: The Pantry's cron runs pg_dump); the table of commands keeps their entries
  from `families.json` (generated by `npm run catalogue`) and runs them
  through `familyCommand`; the core calls a family only through
  `family('windows').runPowerShell(…)` (NeedsLoading while it isn't
  there) or `familyIfLoaded()`, never by importing its modules. The
  manual's examples and SEE ALSO are in `commands/examples.ts`, loaded with
  the manual's texts (`loadExamples` in `manual.ts`); `pages.ts` keeps the
  options. No chapter module may call `t()` when it is imported (its texts
  load with it). Tests load everything first (`tests/setup.ts`). Adding a
  story: its chapters, then `src/engine/stories/<id>.ts` (its chapters in
  order, and the families it uses), its entry in `chapters/index.ts`, its
  release date in `releases.ts`, then `npm run catalogue`; adding a chapter to a story: also `npm run
  catalogue`. A story's own tool goes in a family (see `CONTRIBUTING.md`,
  "A story's own commands"). `npm run build` ends with `tests/budget.mjs`,
  the first visit's weight against a budget (see `docs/DEPLOYMENT.md`,
  "Chunks and budget").
- `src/engine/availability.ts`: the commands a chapter has: its own
  `commands`, plus those of the chapters it assumes (`assumed()` in
  `unlocking.ts`, the same as difficulty's) that exist on the machine (its
  system: `Machine.os`, POSIX utilities on every Unix-like; the tool
  installed: its model or configuration), minus `Chapter.withhold`; sudo
  only with the chapter's password; read by `Shell.known()` (help, Tab,
  highlighting, `type`, `man`); an internal host with its own `commands`
  inherits nothing. `EVERYDAY` (ps, df, free, uptime, whoami, id, groups,
  date, hostname, uname, which, pwd, echo): every chapter has them where its
  machine's system does (`everydayHere`), unless withheld. The teachers'
  sheets keep only the new own commands.
- `src/engine/difficulty.ts`: each chapter's difficulty, 1 to 5, computed
  on an absolute scale from the chapters it assumes (its prerequisites) and
  from its size (nothing to set by hand): adding a story never changes the
  level of the chapters it doesn't come after (`levelsOf()` for tests);
  shown as stars in the menu, the learning paths and the teachers' sheets.
- `src/engine/console.ts`, `machines.ts`, `workstation.ts`: the simulated network
  (and the rescue snapshot, `Console.restore`: the engine stays
  deterministic, no `Date.now` nor `Math.random`); you start from the
  workstation and `ssh` to each story's machine (`commands/ssh.ts`).
  The autosave inside a chapter in `src/engine/autosave.ts` (the inputs,
  `Console.journal`, kept in `localStorage` under `KEY-autosave-LANGUAGE`,
  replayed by `Console.replay`; the opening's hash and a `fingerprint` of
  the machine detect a chapter changed since; the banner in
  `interface/autosave-banner.ts`, the setting in `interface/settings.ts`;
  tests `tests/autosave.test.ts`).
- `src/engine/access.ts`: the "real" ssh (machines with `state.realSsh` and
  a story's internal machines, `Chapter.hosts`): `~/.ssh/config`,
  `ProxyJump`, `known_hosts`, `authorized_keys`, passphrase, password;
  `ssh-copy-id` and `scp` in `commands/transfers.ts`, remote `rsync` in
  `commands/backup.ts`. `sftp` (interactive session) in
  `commands/sftp.ts`; shared FTPS hosting (`src/engine/web-host.ts`,
  declared by the story) and `lftp` in `commands/lftp.ts`. The console
  keeps a stack of internal sessions (`inside`);
  `Chapter.watchesWorkstation` checks events after commands typed on the
  workstation.
- `src/engine/sudoers.ts`: sudo's policy (`/etc/sudoers`, `@includedir`,
  rules); `visudo` and `sudo -l` in `commands/sudoers.ts`; `userdel`,
  `gpasswd`, `chage`, `useradd`, `adduser` (its questions), `passwd`,
  `getent`, `w`, `lastlog2` in `commands/accounts.ts` (passwords:
  `passwordOf`, `state.passwords`, `state.unsetPasswords`,
  `state.lockedAccounts`; `su` opens an account with its password;
  `REPLACED` in `shell.ts` points lastlog to lastlog2); `umask` (the session's mask,
  `Shell.mask`) and setgid applied on creation (`place`).
- `chapters/till-web.ts`: The Co-op's site and till app (simulated
  Express: `.env` read at start, `trust proxy`, locks per address); nginx
  passes `proxy_set_header` to the app (`Request`), and `grep` reads
  regular expressions (`toBasicRegex`).
- `src/engine/packages.ts`: a Debian 13 machine's base packages (`BASE`:
  version, section, description, files) and the archive's others
  (`ARCHIVE`); `installedSet()` (base less `state.apt.removed`, plus
  `state.apt.installed`), `packageInfo()`, `apt remove`/`purge`/
  `autoremove` (`state.apt.configs`: dpkg's `rc`, `state.apt.auto`),
  `search`, `show`, `policy`, `list`, `apt-get`, `apt-cache` and `dpkg -l`/
  `-L`/`-S`/`-s` in `commands/apt.ts`; `lsb_release` in
  `commands/hostnamectl.ts`.
- `commands/tmux.ts`: a machine's tmux sessions (`state.tmux`,
  `Shell.tmux`; the console copies what is displayed) and `uname`;
  `apt upgrade` and `dpkg --configure -a` in `commands/apt.ts`
  (`state.apt.updates`, `state.kernel`, `state.networkCut`: the connection
  drops, `Shell.cut`); `unattended-upgrade` and `apt-config` in
  `commands/unattended.ts`, apt's configuration (`apt.conf.d`) in
  `src/engine/apt-conf.ts`.
- `src/engine/lan.ts`: a router's local network (`state.lan`: interfaces,
  802.1Q VLANs on a trunk, the switch's devices, `/etc/network/interfaces`
  read like ifupdown, `inet6` stanzas included); `ip`, `ifup`, `ifdown`,
  `dnsmasq --test` in `commands/lan.ts`; DHCP (`dnsmasq.ts`: configuration, leases, log);
  `ping` goes through this model when the machine has one.
- `src/engine/nftables.ts`: a router's nftables firewall (`state.nft`:
  tables, chains, rules read like `nft`, a packet's path, NAT, the devices'
  traffic `Lan.flux`); `nft`, `sysctl` (`/proc/sys` is a directory of the
  world) and `conntrack` in `commands/nftables.ts`.
- `src/engine/wireguard.ts`: a router's WireGuard (`state.wg`: keys,
  `wg0.conf` read like wg-quick, remote peers `Lan.remotes` and their
  handshake); `wg`, `wg-quick` and the `wg-quick@NAME` service in
  `commands/wireguard.ts`.
- `src/engine/ldap.ts`: an OpenLDAP directory (`state.ldap`: entries, LDIF,
  reduced schema, filters, `{SSHA}`); `ldapsearch`, `ldapadd`,
  `ldapmodify`, `ldapdelete`, `ldappasswd`, `ldapwhoami`, `slappasswd`,
  `slapcat` in `commands/ldap.ts`.
- `src/engine/radius.ts`: FreeRADIUS (`state.radius`: configuration read at
  start, `clients.conf`, ldap module, `users` file, access points' requests
  and VLANs); `freeradius` and `radtest` in `commands/radius.ts`.
- `chapters/audit.ts`: what the chapters of "The Audit" share (The Bakery's
  server: accounts, `sshd_config`, sudoers, `bakeryWorld`, the network nmap
  sees, `sectionsMd` to reread a player's document); `scope.ts`,
  `report.ts`, `exposure.ts` (Redis's `bind` read on restart, by the
  service), `traces.ts` (ssh's log and `last` written by `initialiser`, key
  fingerprints, Nadia's crontab, the database password: `ALTER ROLE` and
  `.env` read when the app starts) and `follow-up.ts`.
- `src/engine/rsyslog.ts`: a machine's rsyslog (`state.rsyslog`:
  `/etc/rsyslog.conf` and `rsyslog.d` read when it starts, inputs, templates,
  selectors, filters, `if … then`, `stop`; `route()` tells where a message
  goes; remote senders `deliver()`ed one message per command through ufw);
  `logger` and `rsyslogd -N1` in `commands/syslog.ts`. The journal on disk
  (`/var/log/journal`, `SystemMaxUse=`, vacuuming, `journalctl
  --disk-usage`/`--vacuum-*`) in `src/engine/journal-files.ts`;
  `chapters/huts.ts`: what The Huts' chapters share.
- `src/engine/nfs.ts`: NFS (a server's exports, `state.nfs.table` loaded by
  `exportfs -r` or nfs-server; a client's mount grafts the server's
  directory; `access()` decides with the client's uid and gids, squashing
  root; `Shell.can`, `place` and `ls` go through it); `exportfs`,
  `showmount` in `commands/nfs.ts`, `mount -t nfs` in `commands/disks.ts`.
  `src/engine/samba.ts`: Samba (`smb.conf` read for each connection,
  shares, `valid users`, masks, `state.samba.passdb`); `testparm`,
  `smbpasswd`, `pdbedit`, `smbclient` in `commands/samba.ts`;
  `chapters/photo-club.ts`: what The Photo Club's chapters share.
- `src/engine/scan.ts` and `commands/nmap.ts`: nmap on the network declared
  by the story (`state.scan`: machines, services, scope; `state.scans` keeps
  each scan); `src/engine/lynis.ts` and `commands/lynis.ts`: Lynis
  (findings read from the machine's state, `/var/log/lynis-report.dat`).
- `chapters/watch.ts`: what the chapters of "The Watch" share (the
  `kneader` server (`petrin` in French), six months after "The Audit": accounts, `watchWorld`, the
  fictitious `CVE-2099-NNNNN` of the bulletin); `bulletin.ts`,
  `priority.ts`, `fix.ts`, `proof.ts` (an earlier attempt in nginx's
  access log) and `routine.ts` (`unattended-upgrades` restricted to
  security via `src/engine/apt-conf.ts`, a hand-written timer or cron job,
  `src/engine/timers.ts`).
- `chapters/bastion.ts`: what the chapters of "The Bastion" share (the
  `oven` server (`four` in French), a year after "The Watch": the deploy
  account, the miner and its watchdog (`state.onKill`), the delivery
  service, ssh's log, the signed release); `alarm.ts`, `containment.ts`,
  `eradication.ts`, `hardening.ts`. A chapter's outgoing connections go in
  `state.established` (`ss`, `netstat`); iptables' OUTPUT chain decides
  them (`outVerdict`).
- `src/engine/freebsd.ts`: a FreeBSD machine (`state.os = 'freebsd'`):
  Linux-only commands "not found", `#!` checked, BSD man pages
  (`man-<command>-bsd`), `/etc/rc.conf`, packages (`state.pkg`), rc services
  (`state.rc`), pf (`state.pf`: `pf.conf` parsed, the last matching rule
  wins); `service`, `sysrc`, `pkg`, `sockstat`, `pfctl`, `freebsd-version`
  in `commands/freebsd.ts`; `sed` and `stat` (GNU and BSD) in
  `commands/sed.ts`, `date -d`/`-v` in `commands/scripts.ts`;
  `chapters/film-club.ts`: what the chapters of "The Other Unix" share
  (`portable-script.ts`, `rc-services.ts`, `last-rule.ts`).
- `src/engine/solaris.ts`: a Solaris 10 machine (`state.os = 'solaris'`):
  SMF (`state.smf`: services by FMRI, `matchFmri`), ZFS (`state.zfs`),
  Debian and FreeBSD commands "not found"; `svcs`, `svcadm`, `svcprop`,
  `prstat`, `zfs`, `zpool`, `zoneadm`, `zonename`, `pkginfo`, `isainfo` in
  `commands/solaris.ts`; the old `/usr/bin` tools' refusals and the
  `/usr/xpg4/bin`, `/usr/ucb` paths in `commands/solaris-tools.ts`;
  character sets (`File.charset`, `Shell.outputCharset`) in
  `src/engine/charset.ts`, `iconv` and `file` in `commands/iconv.ts`;
  PostgreSQL encodings, an 8.4 server, `pg_ctl` in `commands/postgres.ts`;
  `chapters/seed-bank.ts`: what the chapters of "The Old Sun" share
  (`read-first.ts`, `byte-order.ts`, `switch-over.ts`; greenhouse is an
  internal host).
- `src/engine/ebcdic.ts`: EBCDIC (IBM-037, glibc's EBCDIC-US gaps, GNU dd's
  tables), binary files (`File.charset = 'binary'`: one character per byte,
  shown with � on the terminal), packed decimals (COMP-3); `od`, `xxd`,
  `hexdump`, `dd` in `commands/bytes.ts`, `iconv` (ASCII, EBCDIC, `-c`,
  `-o`) in `commands/iconv.ts`; `$?` in the shell (`Shell.lastStatus`).
  GnuCOBOL in `src/engine/cobol.ts` (`cobc`'s checks: reference format,
  COPY and `-I`, PERFORM targets; compiled programs, `File.program`, run
  by the shell: the story's EBC2ASC and CONTRIB, their runs in
  `state.batchRuns`), `cobc` in `commands/cobol.ts`;
  `chapters/night-batch.ts`: what the chapters of "The Night Batch" share
  (`copybook.ts`, `return-code.ts`, `late-file.ts`: the bureau's uploads and
  the two-night rehearsal through `passTime`).
- `src/engine/ibmi.ts`: an IBM i (`state.os = 'ibmi'`, `state.ibmi`):
  libraries and objects, DB2 tables, jobs in subsystems (status, job log,
  locks), job queues (`runQueues`), message queues and inquiry messages
  (`onReply`), spooled files and output queues, the system ASP, save files,
  the history log; PASE (Linux tools "command not found"). The CL parser
  (keywords, positional values, quotes, lists, the CPD messages) in
  `src/engine/cl.ts`; the CL commands (`CL`), the 5250 session
  (`tn5250` from the workstation, `signOn`, the `===>` loop), `system` and
  `db2` in `commands/ibmi.ts` (a CL command's manual page: `cl: true`,
  `man WRKACTJOB`); `chapters/order-book.ts`: what the chapters of "The
  Order Book" share (`inquiry.ts`, `spooled.ts`, `save-file.ts`; sieve is
  an internal host).
- `src/engine/windows.ts`: a Windows Server (`state.os = 'windows'`,
  `state.windows`: drives as `/C`, `/D`, names without case, volumes,
  services, SMB shares and their permissions, the event logs (`logEvent`,
  `winLog`), the clock, the session's shells: `windowsPrompt`,
  `currentShell`); `readOnly` keeps story 30's cabinet look-only. The model:
  NTFS permissions (`Node.acl`: owner and explicit entries, inherited ones
  computed, the access check, `shareAccess` = share AND NTFS, icacls'
  forms) in `windows-acl.ts`; local users and groups, password policy,
  logon errors, `windowsLogin` (OpenSSH lands in cmd.exe or, with
  `HKLM:\SOFTWARE\OpenSSH` DefaultShell, PowerShell) in
  `windows-accounts.ts`; the registry in `windows-registry.ts`; services
  under a logon account (7038/7000 when its password changed) in
  `windows-services.ts`; scheduled tasks (`runTask`, `advanceWindows`
  minute by minute, LastTaskResult codes, the Task Scheduler's history) in
  `windows-tasks.ts`; a default Windows Server 2022 for a story
  (`windowsMachine()`: tree and ACLs, accounts, services, registry, logs)
  in `windows-world.ts`. Windows PowerShell 5.1: the runtime (objects,
  hashtables, script blocks, SecureString, `Cmdlet`/`Run`/`Native`,
  Out-Default's views, 5.1's error layout) in `src/engine/powershell.ts`,
  the parser (`powershell-parse.ts`), the interpreter (variables, operators,
  binding with types, -WhatIf/-Confirm, questions that re-run the
  statement, scripts, Tab completion, the pipeline's own cmdlets, Get-Help
  from the manual: `cmdlet: true`, `man Get-ChildItem`) in
  `commands/powershell.ts`; the cmdlets by family in
  `commands/windows-files.ts` (FileSystem, Registry, Env: providers, `reg`),
  `windows-acl.ts` (`Get-Acl`, `Set-Acl`, `icacls`, `takeown`),
  `windows-accounts.ts` (`*-LocalUser`, `*-LocalGroup*`, `net user`,
  `whoami`), `windows-services.ts` (`*-Service`, `Get-CimInstance`,
  `Get-Process`, `sc.exe`, `net start`), `windows-events.ts`
  (`Get-WinEvent`, `Get-EventLog`, `wevtutil`), `windows-tasks.ts`
  (`*-ScheduledTask*`, `schtasks`), `windows-system.ts` (volumes, SMB
  shares and their access, network, `ipconfig`, `ping`); the native
  programs (a page: `winexe: true`, section CMD) in `windows-natives.ts`;
  cmd.exe in `commands/cmd.ts`; number and date formats in
  `windows-format.ts`. A Windows share mounted with `mount -t cifs`
  or `mount.cifs` (`src/engine/cifs.ts`: credentials file, `uid=`/`gid=`,
  `vers=`, owners shown from the options, `df` on the server's volume,
  access through `shareAccess`);
  `dos2unix`, `unix2dos`, `tr` and the `gitattributes` page in
  `commands/line-endings.ts` (CR LF symptoms in `script.ts`, `file`,
  `cat -A`, nano's DOS format, git's `.gitattributes`);
  `chapters/mixed-fleet.ts`: what the chapters of "Next Door Windows"
  share (`line-endings.ts`, `smb-mount.ts`, `full-volume.ts`; cabinet is
  an internal host). Tests: `tests/windows*.test.ts` (fixture LEDGER).
  `chapters/music-school.ts`: what the chapters of "The Music School"
  share (`stave`, a Windows Server as the story's main machine, built by
  `stave()`/`staveOptions()`: users, groups, shares and NTFS permissions,
  the Agenda service under `svc_agenda`, the nightly backup task, the logs
  on D:, the update restart's events); `two-locks.ts` (share AND NTFS,
  checked with `shareAccess`), `service-logon.ts` (the service's stored
  password), `log-flood.ts` (D: full of debug logs: a file a service
  holds open, `WinService.opens`, its configuration read at start,
  `onStart`), `silent-backup.ts` (the nights replayed with
  `advanceWindows`, an expired password, a script whose runs are kept in
  `state.psScriptRuns`). PowerShell's `try`/`catch`/`finally`, script
  scopes and script-terminating errors (`Terminate.fatal`),
  `-ErrorVariable` in `commands/powershell.ts`; `Register-ScheduledTask`
  and `New-ScheduledTask*` in `commands/windows-tasks.ts`; `compact`
  (NTFS compression, `File.onDisk`) in `commands/windows-files.ts`.
  PowerShell's functions (`function`, `param()`, `[CmdletBinding()]`,
  `[Parameter()]`, `[ValidateSet()]`, begin/process/end, `return`,
  `$args`, dot-sourcing, `Import-Module` of a `.psm1`) and loops (`while`,
  `do`, `for`, `switch`, `break`, `continue`; a guard stops endless loops)
  in `powershell-parse.ts` and `commands/powershell.ts`; a cmdlet's module
  may exist only on some machines (`Cmdlet.available`). Windows Defender
  Firewall (`state.windows.firewall`: profiles, rules, the decision
  `firewallAllows`, `reaches` used by ssh, smbclient, mount.cifs,
  Test-NetConnection and ping towards a Windows machine of the story,
  `machineAt`) in `src/engine/windows-firewall.ts`, its cmdlets
  (`*-NetFirewallRule`, `Get-NetFirewall*Filter`, `*-NetFirewallProfile`,
  `*-NetConnectionProfile`) and `netsh advfirewall` in
  `commands/windows-firewall.ts`. Active Directory (`state.ad` on the
  domain controller, `state.windows.domain` on a member: objects, DNs,
  SIDs, users, groups and nesting, OUs, computers, the password and lockout
  policy, `adLogon` with badPwdCount, lockout and events 4740/4625, the
  `-Filter` language and LDAP filters, domain principals in tokens through
  `DOMAIN_HOOKS` of `windows-acl.ts` and logons through `domainLogon` of
  `windows-accounts.ts`, `buildDomain`) in `src/engine/windows-ad.ts`, the
  ActiveDirectory module and `net user /domain` in `commands/windows-ad.ts`;
  Group Policy (GPOs in `state.ad.gpos`, links, blocked inheritance,
  enforcement, security filtering, the resulting policy `resultant`,
  `applyPolicy` at logon and by gpupdate: firewall rules, drive maps) in
  `src/engine/windows-gpo.ts`, the GroupPolicy module, `gpupdate`,
  `gpresult` and `net use` in `commands/windows-gpo.ts`; `domainController()`
  and `windowsMachine({ domain })` (a member server) in `windows-world.ts`.
  A scheduled task may run as a domain account (the domain controller
  checks its stored password, a stale one counts towards the lockout) and
  repeat within its day (`TaskTrigger.repeat`, `duration`); `ssh` (ssh.exe)
  from a Windows machine to the story's others (names: hosts file, then
  `windowsResolve` of `windows-firewall.ts`).
  Tests: `tests/ad.test.ts` (fixture HARBOUR, `tests/ad-fixture.ts`),
  `tests/windows-firewall.test.ts`, `tests/powershell-language.test.ts`.
  `chapters/card-catalogue.ts`: what the chapters of "The Card Catalogue"
  share (the domain `lending.internal`: `register`, its domain controller,
  as the story's machine, built by `register()`; `stacks`, a member file
  server, an internal host built by `stacksHost()`; `domainSpec()`: OUs per
  branch, users by department, AGDLP groups GG_/DL_, a leaver and inactive
  accounts, computers, GPOs (Events Drive on the wrong OU), the scan import
  task; `passMinutes` lets the domain's time pass with stacks' tasks);
  `comings-and-goings.ts` (an arrival and a departure checked on the
  directory), `stale-password.ts` (a lockout from a task's stale password,
  `afterCommand` lets half an hour pass after an unlock),
  `unapplied-policy.ts` (a GPO's link and security filtering, checked
  with `resultant()` for every account; the domain's workstations as RSoP
  sources: `ad.clients`, `logonClients`, `refreshClient` of
  `windows-gpo.ts`, `gpresult /s /user`, Get-GPResultantSetOfPolicy) and
  `dormant-accounts.ts` (a local firewall rule of stacks,
  `WindowsOptions.firewallRules`; dormant accounts compared with a
  snapshot taken by `initialise`; the CSV report read with `csvObjects`).
  The AD Recycle Bin (`ad.recycleBin`, `ad.deleted`, `removeObject`,
  `restoreObject`; Get-ADObject `-IncludeDeletedObjects`,
  Restore-ADObject, Get-ADOptionalFeature) in `windows-ad.ts` and
  `commands/windows-ad.ts`; Export-Csv, ConvertTo-Csv and Import-Csv in
  `commands/windows-files.ts`.
- `src/engine/luks.ts`: LUKS2 on a machine's storage (`storage.luks`: the
  header and its key slots, a passphrase or a key file's content;
  `storage.crypt`: the open mappings, `/dev/mapper/NAME`, the clear file
  system kept in the header while closed; `/etc/crypttab` read by
  `readCrypttab`); `cryptsetup` (`luksFormat` with the real YES question,
  `open`, `close`, `status`, `luksDump`, `luksAddKey`, `luksRemoveKey`,
  `luksKillSlot`, `luksUUID`, `luksHeaderBackup`), `cryptdisks_start` and
  `cryptdisks_stop` in `commands/cryptsetup.ts`; `lsblk` (`crypt`), `blkid`
  (`crypto_LUKS`) and `mount` know them; `mkfs.ext4` in
  `commands/disks.ts`; `sha256sum` (a real SHA-256, `-c`) in
  `commands/checksums.ts`; `dd if=/dev/urandom` (deterministic bytes).
  Shell variables: `Shell.vars`, `Shell.exported`, `Shell.environment`
  (a command's environment: `NAME=value command`; sudo resets it, except
  `sudo NAME=value` and `sudo -E`), `$NAME` expanded, `export` and `unset`
  in `commands/environment.ts`. restic: `init`, `key list/add/remove/passwd`
  (`Repo.keys`), `RESTIC_REPOSITORY`/`RESTIC_PASSWORD_FILE`/
  `RESTIC_PASSWORD`, `check --read-data`, what was run in
  `state.resticDone`. `chapters/pantry.ts`: what the chapters of "The
  Pantry" share (`crate`, the community grocery's server: its files and
  their SHA256SUMS, the USB disk in clear or encrypted, the restic
  repository with Noor's key and Mei's, the nightly job and its log;
  `spare`, the restore drill's laptop, an internal host built by
  `spareHost()`; `filesOf` finds a secret wherever it was written);
  `lost-disk.ts`, `spare-key.ts`, `restore-drill.ts`. Tests:
  `tests/pantry.test.ts`.
- `src/engine/ipv6.ts`: IPv6 on a machine whose link has a router
  (`Lan.ra`): addresses (`parse6`, `format6`, prefixes), link-local and
  SLAAC addresses from the MAC (modified EUI-64), static ones
  (`Interface.addresses6`), `/proc/sys/net/ipv6/conf/*/` (`accept_ra`,
  `autoconf`, `disable_ipv6`), the IPv6 default route (`Lan.gateway6`),
  `boot6` (what the next boot brings up), `resolve` (`/etc/hosts`, then the
  story's DNS), and the outside view (`state.vantage`: neighbour discovery,
  the firewall's verdict over nftables families and ufw's `IPV6=`, who
  listens: `0.0.0.0`, `[::]`, `*`); `ip -6`, `ip neigh` and `inet6`
  stanzas in `lan.ts` and `commands/lan.ts`; `curl` (`-4`, `-6`, `-v`),
  `ping`/`ping6` (`%eth0`) and `nc` in both families in
  `commands/ipv6.ts`; `nmap -6` (`ScanHost.probe`); nginx's `listen [::]`,
  `ipv6only=off` and `nginxSockets`. `chapters/ferry.ts`: what the chapters
  of "The Ferry" share (`quay`, the ferry cooperative's server: its link,
  its zone `ferry.example`, nginx and the booking app whose sockets follow
  their configuration, `syncSockets`; `lookout`, islenet's box on the
  internet, an internal host; `audit` checks a ruleset in both families);
  `new-card.ts`, `other-door.ts`, `both-ways.ts`. Tests:
  `tests/ferry.test.ts`.
- `src/engine/promql.ts`: PromQL (parser with Prometheus's messages,
  evaluator over a `Storage`: selectors, ranges, `rate` and its
  extrapolation, aggregations, operators and one-to-one matching, values
  written like Go); `src/engine/prometheus.ts`: a machine's Prometheus
  (`state.prometheus`: `prometheus.yml` and rule files read like
  Prometheus, targets scraped through the story's network
  `state.metricsNet` (`MetricsNet`: names, firewalls, what each port
  answers), the series, rules and alerts' states, `advance()` tick by tick,
  the HTTP API `promHttp`); `src/engine/alertmanager.ts`
  (`state.alertmanager`: routes, groups, webhooks, silences, inhibition);
  `promtool`, `amtool`, the daemons' binaries, the Alertmanager's API, curl
  on a machine with `state.metricsHere` and `sleep` (`state.slept`) in
  `commands/prometheus.ts`; `jq` in `commands/jq.ts`. An internal host
  may pass time too (`InternalHost.afterCommand`). `chapters/bike-share.ts`:
  what the chapters of "The Bike Share" share (`gauge`, the monitoring
  server; `saddle` and `hub`, internal hosts with their ufw and exporters;
  the metrics computed from the machines' files and the app's traffic;
  `passTime`; `trial()` tries a rule on made-up days); `blind-spot.ts`,
  `threshold.ts`, `quiet-hours.ts`. Tests: `tests/bike-share.test.ts`.
- `src/engine/k8s.ts`: a single-node k3s cluster (`state.k8s`: the
  objects, their schemas for kubectl's strict decoding, the API server's
  defaults and validation, `plan`/`carryOut` for `kubectl apply` and
  `inSync` (the files are what runs); the Deployment controller (rolling
  update, revisions, progress deadline), the ReplicaSet controller, the
  scheduler (requests, `FailedScheduling`), the kubelet (image pulls and
  back-off, `CreateContainerConfigError`, restarts and `CrashLoopBackOff`,
  `OOMKilled` from `limits.memory`, httpGet/tcpSocket/exec probes), events,
  Endpoints and EndpointSlices, Traefik's routes from the Ingresses and its
  log, `request()` for curl and pods, `containerExec` (BusyBox's applets),
  `bootstrap` for kube-system as k3s installs it; `tick()` is one second,
  `advance()` lets time pass). The images' apps are declared by the story
  (`K8sApp`: ports, start, http, memory, cpu, files). `kubectl` in
  `commands/kubectl.ts` (get with its printers and Go's tabwriter, describe,
  logs, apply, create, delete, edit, rollout, scale, set image, exec,
  port-forward, run, expose, top, explain, config, jsonpath), `k3s` and
  `base64` in `commands/k3s.ts`; curl reaches the cluster through
  `state.metricsNet` (the Host header). `chapters/pool.ts`: what the
  chapters of "The Pool" share (`lane`, the pool's server: its cluster's
  past replayed by `initialiseLane`, the booking app of each release,
  `~/manifests`, ten seconds per command in `passTime`; `k.story`: the
  outside database's password, the swim meet's hours and the memory that
  follows them, 2.4.0's leak; chapter 3's git repository and its shared
  bare one, `manifestsHistory`); `wont-start.ts`, `front-desk.ts`,
  `locker-room.ts` (a password from a ConfigMap and git to a Secret,
  checked on the pods' environment and both repositories' last commit),
  `deep-end.ts` (OOMKilled, `kubectl top`, requests and limits, a rollback).
  `git log -p` in `commands/git.ts`. Tests: `tests/pool.test.ts`.
- `src/engine/cups.ts`: a machine's CUPS (`state.cups`: `cupsd.conf` read
  when cupsd starts, `parseConf`, its `<Location>` blocks and `@LOCAL` from
  the server's interfaces decided by `reaches`, the default policy's
  limits by `mayCancel` and `privateValues`; queues kept in memory and
  written to `printers.conf` on change and on stop (`writePrinters`, a hand
  edit lost), read at start; jobs and their spool files (`syncSpool`, a
  document removed by hand aborts its job), `PreserveJobHistory` and
  `PreserveJobFiles` (`purgeExpired`), `error_log` by `LogLevel` and
  rotated at `MaxLogSize` (`appendLog`), `access_log`, `page_log`; the
  network's devices and the models of `lpinfo -m`; `submit` and `verdict`
  for a print request; `advance` prints at each device's speed; `attach`
  hooks the cups service); `lpstat`, `lp`, `lpr`, `lpq`, `cancel`, `lprm`,
  `cupsenable`, `cupsdisable`, `cupsaccept`, `cupsreject`, `lpadmin`,
  `lpoptions`, `lpinfo`, `cupsctl`, `cupsd -t`, `driverless` and the web
  pages on port 631 (`webAnswer`) in `commands/cups.ts`;
  `printer-driver-hpcups` in `commands/apt.ts`. `chapters/staff-room.ts`:
  what the chapters of "The Staff Room" share (`chalk`, a primary school's
  print server with a leg on the staff and the pupils' VLANs: its
  printers, `cupsdConf()`, the staff's and pupils' requests each minute in
  `passTime`); `stuck-queue.ts`, `new-printer.ts`, `paper-trail.ts`.
  Tests: `tests/staff-room.test.ts`.
- `src/engine/pki.ts`: an internal certificate authority's world (keys
  derived, never random: `KeyInfo`, `keyPem`, `readKey`; requests
  `readCsr`; certificates with subjectAltName, basicConstraints, keyUsage,
  extendedKeyUsage, the signer's key, in `tls.ts`'s `Certificate`; CRLs
  `readCrls`; `openssl.cnf` sections `readConf`; the `openssl ca` database
  `readIndex`/`writeIndex`; `verify()`: OpenSSL's chain building and checks,
  its error numbers `VERIFY_ERRORS`; the trust store `trustStore`,
  `/etc/ssl/certs/ca-certificates.crt`); `commands/openssl.ts`: `openssl`
  (`genpkey`, `genrsa`, `ecparam`, `pkey`, `rsa`, `req`, `x509` with
  `-req`, `verify`, `s_client`, `ca`, `crl`), `update-ca-certificates`,
  curl on a story with an internal PKI (`pkiNet`: which machine answers
  for a name, `pkiCurl`, `tlsRequest`, `servedOk`); nginx's client
  certificates (`ssl_verify_client`, `ssl_client_certificate`,
  `ssl_verify_depth`, `ssl_crl`) and its key check in `nginx.ts`;
  `logger` writes to the journal on a machine without rsyslog.
  `chapters/airwaves.ts`: what the chapters of "The Airwaves" share
  (`mast`, the community radio federation's server: its CA in `/srv/ca`
  (root, then the issuing CA), nginx's sites, the trust store
  `trustFiles`, Mateo's monitoring; `booth`, the studio PC, an internal
  host built by `boothHost()`; the uploaders on `contrib` each minute in
  `passTime`); `expiry-date.ts`, `chain-of-trust.ts`, `stolen-laptop.ts`
  (an expiry watch found in cron or timers and run as it will run:
  `expiryWatch`). Tests: `tests/airwaves.test.ts`.
- `src/engine/forge.ts`: a machine's Forgejo and its Actions runner
  (`state.forge`: accounts, tokens and scopes, Sudo, `prohibit_login`;
  repositories as bare repositories of the machine, team and direct
  collaborators; protected branches checked by `forgeReceive`, Forgejo's
  pre-receive hook, called by git's push for a forge URL `forgeRemote`;
  secrets; workflows `.forgejo/workflows/*.yml` run by `runWorkflows`
  (`on:`, jobs, `if:` expressions `evaluate`, `env:`, `actions/checkout`,
  `run:` read line by line, secrets masked, a fork's `pull_request`
  without secrets, the deploy over rsync checked by `deployVerdict`
  against authorized_keys' options), commit statuses, pull requests; the
  HTTP API and web routes `forgeHttp`); `forgejo admin user …`,
  `forgejo-runner`, the `forgejo-api(7)` page and curl towards the forge
  (`forgeCurl`) in `commands/forge.ts`; SSH signatures and
  allowed_signers in `src/engine/sshsig.ts`, `ssh-keygen -Y` in
  `commands/ssh.ts`; git's config (`configValue`), signed commits and tags
  (`signWith`, `checkSignature`), tags, `reset`, `--amend`, the reflog
  (`logRef`, `HEAD@{N}`), `push --force`, `archive`, `-C` and
  subdirectories (`Repo.deep`) in `commands/git.ts`; `jq -R`/`-s`.
  `chapters/tool-library.ts`: what the chapters of "The Tool Library"
  share (`anvil`, the nonprofit's forge: Lendshed's history and the forced
  push of 14 October, the forge's accounts and tokens, the deploy
  account, the past runs replayed by `initialiseAnvil`, Kwame's pull
  request rebased by `kwameSync`); `who-can-push.ts`, `leaky-pipeline.ts`,
  `signed-release.ts`. Tests: `tests/tool-library.test.ts`.
- `src/engine/libvirt.ts`: a Debian hypervisor's KVM and libvirt
  (`state.libvirt` on the host: domains with their definition, written and
  read as domain XML (`domainXml`, `parseXml` with libxml2's messages,
  `configFromXml` with the schema's), states and reasons, autostart, the
  running definition (`Domain.live`) applied at a start, not a guest
  reboot; disks as qcow2 images in the host's files (`File.disk`: virtual
  size, backing file, internal snapshots; `File.size` is what they take),
  backing chains (`chainOf`), QEMU holding its chain's files (`Domain.held`,
  open files with `Open.alive`: `lsof`, the space of a removed file);
  internal and external snapshots, block commits (`commit`), a guest paused
  by a full file system (`advance`, `werror=enospc`); the default NAT
  network's leases and the office's DHCP by client identifier from
  `/etc/machine-id` (`bootGuest`), who answers at an address
  (`answering`), the host's memory and swap (`Memory.swap`, `free`,
  `top`)); `virsh`, `qemu-img`, `virt-install`, `virt-clone`, `growpart`,
  `systemd-machine-id-setup` and `resize2fs` on a guest's partition in
  `commands/libvirt.ts`. A story may resolve names and route ssh itself
  (`state.resolve`, `state.reach` in `access.ts`); an internal host has
  `beforeCommand` and `attached` (called once its main machine is known);
  an internal machine that reboots drops only its own session.
  `chapters/health-centre.ts`: what the chapters of "The Health Centre"
  share (`hearth`, the practice's hypervisor, built by `hearthState()` and
  `hearthWorld()`; its guests `ledger`, `agenda`, `records`, `portal`,
  `agenda-training` as internal hosts (`guestHost()`: their disk and
  address follow the host's model, a poweroff or reboot inside reaches
  libvirt), `reception` the reception's PC; each machine's view of the
  network, `networkView`, `resolve`, `reach`); `cold-start.ts`,
  `wrong-side.ts`, `tight-fit.ts`. Tests: `tests/health-centre.test.ts`.
- `src/engine/keepalived.ts`: keepalived's VRRP (`state.vrrp` on the
  story's main machine: the nodes, each one's `keepalived.conf` read at
  start and reload, `vrrp_script` checks run as root (`runCheck`), the
  election second by second `tick` (master down interval, preemption,
  `nopreempt`, FAULT, weights, priority 0, unicast peers, bogus adverts
  from another group with the same VRID), the receiving node's nftables
  input hook deciding what it hears (`ip protocol vrrp`/`112` in
  `nftables.ts`), the virtual addresses on the master (`syncAddresses`,
  `ip a`'s `secondary`), the packets on the link for tcpdump);
  `src/engine/haproxy.ts`: a machine's HAProxy (`state.haproxy`:
  `haproxy.cfg` read and checked like `haproxy -c`, health checks with
  `inter`/`fall`/`rise`, L4/L7, balancing, the runtime API `runtime()`,
  the HTTP log in `/var/log/haproxy.log`; backends declared by the story,
  `state.haBackends`); `keepalived`, `tcpdump`, `pidof` in
  `commands/keepalived.ts`, `haproxy`, `socat` and curl on such a story
  (`haCurl`, `state.haHttp`) in `commands/haproxy.ts`.
  `chapters/blood-drive.ts`: what the chapters of "The Blood Drive" share
  (`lb1`, the main machine, and `lb2`, `web1`-`web3` as internal hosts
  created at start; the configurations of each chapter, the past replayed
  by `initialiseStory` (boot, the routers' VRRP group and lb2's firewall in
  chapter 3), five seconds per command in `passTime`, a donor's request
  every two seconds, web2's maintenance, `wouldFailOver`);
  `no-failover.ts`, `sick-server.ts`, `split-brain.ts`. Tests:
  `tests/blood-drive.test.ts`.
- nginx's access logs (`log_format`, `access_log path [format]|off`,
  `map` blocks, `accessLines`: what a request writes) in `nginx.ts`;
  logrotate's `maxage` (`readConfig` exported) in `commands/logs.ts`;
  journald's `MaxRetentionSec=` (`timeSpan`, `maxRetention`) in
  `journal-files.ts`; a WHERE clause and INSERT's values as PostgreSQL
  reads them (comparisons, AND/OR, NULL, LIKE, IN, dates and intervals) in
  `src/engine/sql-where.ts`, psql's `INSERT`, `--csv`, `-A`, `-t` in
  `commands/postgres.ts`; restic's `--keep-within` (`readWithin`).
  `chapters/choir.ts`: what the chapters of "The Choir" share (`baton`,
  the choir's server: its members from `choir-members` in the texts, the
  tables built by `referenceTables`, the policy, nginx's logs since 2027,
  the audit log, the journal, the uploads, the restic repository and the
  purge and backup units of chapter 3; visitors each command in
  `passTime`); `kept-forever.ts`, `access-request.ts` (`answer`: what the
  export holds and whether it leaks), `forget-me.ts` (`purgeVerdict`: the
  scheduled purge run once on a copy of the database). Tests:
  `tests/choir.test.ts`.
- `src/engine/mariadb.ts`: a machine's MariaDB 11.8 (`state.mariadb`:
  `/etc/mysql/my.cnf` and its `!includedir` read at start (`readOptions`,
  `fileValue`, `startErrors`), the variables (`vars`, `DYNAMIC`), accounts
  `'user'@'host'` (`sortedAccounts`, `authenticate`: unix_socket,
  mysql_native_password's real hash `nativeHash`), privileges (`allowed`),
  connections and `max_connections` (`connect`, `reapIdle` for
  `wait_timeout`), tables and indexes, `writeRow` and the row-based binary
  log with GTIDs, a replica's threads (`replicate`, `secondsBehind`,
  `healthy`), dumps' metadata (`dumps`, `restores`), `look` for what an
  administrator looked at; the story's network `state.mariaNet`,
  `machineAt`, `sourceFor`, `linkOf`); its SQL in `src/engine/mariadb-sql.ts`
  (`run`, `statements`, `cost` and `slowLog`); `mariadb`/`mysql` (and its
  monitor), `mariadb-dump`/`mysqldump`, `mariadb-admin`/`mysqladmin`,
  `mariadb-check`/`mysqlcheck`, `mariadb-secure-installation` in
  `src/engine/mariadb-client.ts`, loaded with the story (the `mariadb`
  family, `families/mariadb.ts`); a unit's `aliases` (mariadb: mysql, mysqld) in
  `systemd.ts`. `chapters/allotments.ts`: what the chapters of "The
  Allotments" share (`trowel`, the association's database server, and its
  `plots` database; `barrow`, the app's server, an internal host whose
  `plotline` service reads `/srv/plotline/.env` at start; `rake`, the
  replica, an internal host; the weekend replayed by `weekend`; the app's
  connections and writes and the replica's threads each command in
  `passTime`); `sleeping-connections.ts`, `least-privilege.ts`,
  `broken-replica.ts`. Tests: `tests/allotments.test.ts`.
- An inbound mail server, the `inbound` family (`families/inbound.ts`):
  Dovecot 2.4 in `src/engine/dovecot.ts` (`state.dovecot`: the
  configuration read like doveconf, `readConf`, named filters and
  `!include`, loaded at start and on reload; the passwd-file userdb
  `/etc/dovecot/users` and its `userdb_*` fields; Maildir++ mailboxes,
  `messagesOf`; the quota, `quotaRoot`, the count and maildir drivers and
  `maildirsize`, grace, `quota_warning`; LMTP delivery `lmtpDeliver` with
  Sieve, `runSieve`, `sieveScripts`: before scripts and the active
  personal one), Sieve in `src/engine/sieve.ts` (`compile` with
  Pigeonhole's messages, `execute`, vacation's checks, `printResult` for
  sieve-test), rspamd in `src/engine/rspamd.ts` (`state.rspamd`: UCL
  `readUcl`, `readConfig` from local.d and override.d, `scan`: symbols from
  the story's network `RspamdNet`, multimap, settings, Bayes `learn`, the
  actions; `logScan`), Postfix receiving in `src/engine/inbound.ts`
  (`receive`: smtpd, the rspamd milter, greylisting, virtual aliases,
  LMTP, bounces in mail.log); `doveadm`, `doveconf`, `sievec`,
  `sieve-test`, `rspamc`, `rspamadm` and the `doveadm-search-query(7)` page
  in `src/engine/inbound-client.ts`. `chapters/lifeboat.ts`: what the
  chapters of "The Lifeboat" share (`slipway`, the station's mail server:
  its Postfix, Dovecot and rspamd files, the users' Maildirs, the mail of
  the internet `ham`, `spam`, `newsletter`, `listMail`, `direct`, their texts in `lifeboat-mail-*` and `lifeboat-words-*` of the story's texts (each language its own mail, which Bayes learns), arriving
  each command in `passTime`; `classify` tells a message's family from its
  id); `mailbox-full.ts`, `spam-tide.ts` (reference messages scanned with
  the running configuration), `sorting-office.ts` (each user's scripts
  tried on reference messages, `runSieve` quiet). Tests:
  `tests/lifeboat.test.ts`.
- `src/engine/nut.ts`: Network UPS Tools 2.8.1 and the power behind it
  (`principal.state.power`: the mains and their cuts, the UPS's battery,
  output, kill timers and self tests, each machine it feeds with its halt,
  crash, boot and firmware power restore policy; `state.nut` on each
  machine: `ups.conf`, `upsd.conf` (LISTEN at start), `upsd.users`,
  `upsmon.conf`, `upssched.conf` read like parseconf, the units
  `nut-driver@NAME`, `nut-server`, `nut-monitor` hooked by `attachNut`,
  upsd's answers `variables`/`instcmd`/`setVar`, upsmon's poll, critical
  state and forced shutdown, upssched's timers; `second()` is one second of
  the world); `upsc`, `upscmd`, `upsrw`, `upsmon`, `upsd`, `upsdrvctl`,
  `upssched`, `ipmitool` in `commands/nut.ts` (the `nut` family).
  `chapters/climbing-wall.ts`: what the chapters of "The Climbing Wall"
  share (`belay`, the hall's server on the UPS; `harness`, the NAS, an
  internal host built by `harnessHost()`; chapter 1's past journal; fifteen
  seconds per command in `passTime`, the whole drill after `upsmon -c fsd`,
  `drill()`, Ikaika's button; chapter 3's flickering line and `alertTrial`);
  `last-cut.ts`, `down-in-order.ts`, `old-battery.ts`. Tests:
  `tests/climbing-wall.test.ts`.
- `src/engine/garage.ts`: a Garage cluster, S3 object storage
  (`state.garage` on the story's machine: nodes, the layout with its roles,
  zones and staged changes, buckets and their objects (size, ETag, date,
  text), website access, lifecycle rules, access keys and their per-bucket
  read/write/owner; `authorize` checks a request in Garage's order (anonymous,
  "Date is too old" past 24 hours, the region's scope, the key, the
  signature, the bucket, the permission), `presign`/`readPresigned`/
  `presignedGet` (X-Amz-Expires at most a week), `webGet` the web endpoint,
  `liveCopies`/`quorum`); `garage`, `aws` (s3, s3api, configure), `rclone`
  (ls, lsl, lsd, cat, size, copy, copyto, sync with `--backup-dir`, check,
  config) and curl towards the cluster (`s3Curl`, the `objects` family's
  hook) in `src/engine/objects-client.ts`, `state.s3net` the names of the
  S3 gateway and the website. `chapters/dance-troupe.ts`: what the chapters
  of "The Dance Troupe" share (`wings`, the troupe's server and one of the
  three nodes, built by `wingsState()` and `wingsWorld()`: the buckets of
  each chapter, `~/.aws`, the deploy script, `/etc/rclone/office.conf`, the
  office share and its nightly backup unit, a clock three days behind in
  chapter 2, porch failed and its replacement in chapter 3);
  `public-bucket.ts`, `offsite-copy.ts`, `big-file.ts`. Tests:
  `tests/dance-troupe.test.ts`.
- `chapters/shelter.ts`: what the chapters of "The Shelter" share
  (`meadow`, the shelters' offsite server: the restic repository in
  `/srv/restic`, the plan `/srv/drp/plan.md` read by `planRows`
  (`duration`, `serviceOf`, `interval` from a timer's calendar), the
  hidden primary DNS of chapter 3; `paddock`, the server in the cellar, an
  internal host built by `paddockHost()`; `haven`, the spare, fresh or
  rebuilt, built by `havenHost()`: its machine-specific files
  `machineFiles`, `clobbered` after a restore over /, the app `adopt`
  modelled once its unit is loaded; the database `referenceTables`, its
  dump, checksum and counts; `storyCurl`, the requests between the
  machines through `state.storyCurl` of `commands/network.ts`; one clock
  for all, `passTime`); `what-we-have.ts`, `rebuild.ts`,
  `switch-and-learn.ts` (`drill()`: the cron jobs and timers run once and
  undone). restic's `sftp:` repositories (`sftpStore`) and `snapshots`'
  filters in `commands/restic.ts`; the `postgresql` package in
  `commands/apt.ts`. Tests: `tests/shelter.test.ts`.
- `src/engine/rhel.ts`: a Red Hat family machine (`state.os = 'rhel'`,
  Rocky Linux 10): Debian's own tools "command not found" (`DEBIAN_ONLY`,
  the `rhel` platform of `availability.ts`), Fedora's prompt, SELinux
  contexts on files (`Rights.context`, `labelNew` in `Shell.place`: mv
  keeps a label, cp takes its place's) for `ls -Z`, `ps -Z`, `id`; the
  `rhel` family (`families/rhel.ts`): SELinux in `src/engine/selinux.ts`
  (`state.selinux`: mode, booleans and saved values, local file contexts
  and equivalences, port types, modules, the audit log; `defaultType`,
  `httpdAllows`, `check` writes AVCs, `boot` with `/.autorelabel` through
  `state.onBoot` of `systemd.ts`'s restart), firewalld in
  `src/engine/firewalld.ts` (runtime and permanent zones, rich rules,
  `verdict`), packages in `src/engine/rpm.ts` (Rocky 10.3's,
  `installFiles`), httpd in `src/engine/httpd-rhel.ts` (conf.d, vhosts,
  ProxyPass, `serve`); `dnf`, `rpm`, `firewall-cmd` in
  `commands/rhel-packages.ts`, SELinux's commands in `commands/selinux.ts`.
  `chapters/language-cafe.ts`: what the chapters of "The Language Café"
  share (`kettle`, the café's Rocky server, `kettleState`/`kettleWorld`/
  `initialiseKettle`; `noticeboard`, the café's screen, an internal host;
  `storyCurl`, `reach` through firewalld and httpd without trace; the
  noticeboard's request every five minutes in `passTime`; `rebootKettle`);
  `new-neighbour.ts`, `wrong-label.ts`, `port-and-boolean.ts`. Tests:
  `tests/language-cafe.test.ts`.
- `src/engine/hcl.ts`: HCL, the OpenTofu language's syntax (a subset:
  bodies, blocks, templates, tuples, objects, references; hclsyntax's
  errors) and `format()` for `tofu fmt`; `src/engine/tofu.ts`: OpenTofu
  1.13 (`tofu`: init from a filesystem mirror and `.terraform.lock.hcl`,
  fmt, validate against the hashicorp/dns provider's schema, variables,
  plan with refresh and drift, apply and its "yes", import and import
  blocks, state list/show/rm/mv, output, the local state
  `terraform.tfstate` and its lock held by a process, `state.tofu` on the
  principal: locks, runs; the diagnostics' box `renderDiagnostic`); the
  provider's records are the game's BIND zones (`dynamicUpdate`, `readRecord`;
  `dynamicZone` in `dns.ts`: `rndc reload` refuses a zone with
  `update-policy`), the `iac` family. `chapters/mapping-party.ts`: what the
  chapters of "The Mapping Party" share (`cairn`, the Wayfinders
  collective's DNS server: `/srv/dns` and its state, the dynamic zone,
  Femi's evening and his `tofu apply` holding the lock in chapter 2,
  `state.onKill` releasing it); `first-plan.ts`, `drift.ts` (`converged`:
  code, state and named agree). Tests: `tests/mapping-party.test.ts`.
- `src/engine/podman.ts`: rootless Podman 5.4.2 (`state.podman`: each
  account's images and containers, the user namespace from `/etc/subuid`
  and `/etc/subgid` (`freshMaps`, `keepIdMaps`, `toHost`, `toNs`, built at
  the account's first command, `podman system migrate`), the image's layers
  that a single mapping can't hold, `:U` from inside the namespace, pasta's
  and rootlessport's ports (`net.ipv4.ip_unprivileged_port_start`), the
  user session warnings; each account's manager `user@UID.service`
  (`managerService`, linger from `/var/lib/systemd/linger`), Quadlet's
  `.container` files converted at `daemon-reload` and when the manager
  starts (`convert`, `generate`), `settle()` after each command (a reboot,
  a manager that starts or stops); `REGISTRY` and `PAPPS`, the images and
  apps a story declares); `podman`, `loginctl`, Quadlet's dry run and
  `systemctl --user` (a hook of the core's systemctl) in
  `commands/podman.ts` (the `podman` family); `podman unshare` shows the
  namespace's ids through `state.idView` (read by `ls -l`); `usermod
  --add-subuids/--add-subgids`; `journalctl --user`, `--user-unit`
  (`Input.userUnit`). `chapters/walking-club.ts`: what the chapters of "The
  Walking Club" share (`stile`, the walking club's server: nginx in front of
  Trailbook, the service account trailbook, the data's owner, Ayasha's
  session replayed in chapter 2; `walksCurl` through `state.storyCurl`;
  five seconds per command and the sysctl files reapplied at a reboot in
  `passTime`); `no-root-needed.ts`, `logged-out.ts`. Tests:
  `tests/walking-club.test.ts`.
- `src/engine/apparmor.ts`: AppArmor 4.1 on a Debian machine
  (`state.apparmor`: the profiles loaded in the kernel and their mode, each
  process's confinement `tasks`, attached at exec by `execTask`; profiles of
  `/etc/apparmor.d` read like apparmor_parser, `parseFile`, `globToRegex`,
  `expandBraces`; `check` decides an access and writes its audit record
  to the kernel's log, or to `/var/log/audit/audit.log` with auditd;
  `loadAll` for apparmor.service; `withFlags` for the mode in a file); the
  `apparmor` family: `aa-status`, `apparmor_parser`, `aa-enforce`,
  `aa-complain`, `aa-disable`, `aa-autodep`, `aa-logprof` and `aa-genprof`
  (their questions) and the `apparmor.d(5)` page in `commands/apparmor.ts`.
  A story's own program run by its path or name (`state.programs` in
  `shell.ts`). `chapters/zine-library.ts`: what the chapters of "The Zine
  Library" share (`stapler`, the library's server: nginx, the zinecat app
  under php-fpm and its profile, the scans, `request` for each visit and
  upload, `storyCurl`, a visit and an upload per command in `passTime`;
  the backup script `runBackup`, confined as the kernel would, its runs in
  `story.runs`, `tooWide`); `denied-upload.ts`, `backup-profile.ts`. Tests:
  `tests/zine-library.test.ts`.
- `src/engine/sops.ts`: SOPS 3.10.2 and age 1.2.1, simulated (age keys in
  real Bech32 derived from a seed, `ageKey`, `parseRecipient`,
  `parseIdentities`; the data key wrapped in an armored age file,
  `wrapKey`/`unwrapKey`; `ENC[AES256_GCM,…]` values with their tag and the
  key's path, `encryptValue`/`decryptValue`; the MAC; the dotenv store and
  its `sops_` metadata, `encryptFile`/`decryptFile`, the no-key report
  `noKeyError`; `.sops.yaml`'s creation rules, `readSopsConfig`,
  `findConfig`, `ruleFor`; `state.sops.seq` makes every key and data key
  new, deterministically); `sops` (encrypt, decrypt, edit through nano,
  rotate, updatekeys and its question, set, filestatus; the identities from
  `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, `~/.config/sops/age/keys.txt`) and
  `age-keygen` in `commands/secrets.ts`, the `secrets` family; `.gitignore`
  (`ignoredBy`, a repository with `deep`) and the `gitignore(5)` page in
  `commands/git.ts`. `chapters/tenants-union.ts`: what the chapters of "The
  Tenants' Union" share (`latch`, the Larkspur Tenants' Union's server:
  `/srv/repairline` and its history, origin, the server's age key, the
  repairline service reading `/etc/repairline/env` at start, PostgreSQL's
  role; the keys of the server, Makoa, Ikenna and yours; chapter 2's
  encrypted files with fixed data keys, `state.startKeys`); `out-of-the-open.ts`,
  `keys-change-hands.ts`. Tests: `tests/tenants-union.test.ts`.
- `src/engine/openbao.ts`: OpenBao 2.7, the open-source fork of HashiCorp
  Vault (`state.bao` on the principal: the Shamir seal, `parts` counted
  once, a wrong share failing the attempt, `seal()` at each start; tokens
  `s.` + base62 (`mint`, `lookupToken`, `revokeTree`: children revoked with
  their parent, `ttlLeft`); ACL policies in HCL (`parsePolicy` with
  OpenBao's errors, `matches` for `*` and `+`, Vault's priority rules,
  `capabilitiesOf`, `allowed` with sudo on root-protected paths); KV
  version 2 at `secret/` (`data/`, `metadata/`, versions, patch); the file
  audit device (`auditLines`, strings HMAC'd, `hmacSha256`,
  `sys/audit-hash`); `request()` is the API: the seal, the token, the ACL,
  the handler, the audit entries, `runs` for the story); `bao` in
  `commands/bao.ts` (columnize tables, Go's `%v`/`%q`, flags before the
  arguments, the hidden prompts of `operator unseal` and `login`,
  `~/.vault-token`), the `openbao` family. `chapters/hostel.ts`: what the
  chapters of "The Hostel" share (`padlock`, the cooperative hostel's
  server: OpenBao from its `.deb`, Bunks the booking site, a modelled unit
  that reads `/etc/bunks/bunks.env` and its two secrets at start
  (`bunksStart`), `narrow()` for a token that reads them and nothing else,
  the past replayed into the audit log by `initialiseStory`, `storyCurl`
  for the health page, Desta's new admin token if you revoke yours);
  `sealed.ts`, `need-to-know.ts`, `leaked-token.ts`. Tests:
  `tests/hostel.test.ts`.
- `src/interface/`: the interface. `game.ts`: `mount()`, the entry, builds
  each part with a shared context (`context.ts`: the options, texts,
  console, progress, display settings, and what one part asks of another;
  no part imports another's state) and lays them out; `dom.ts`: `el`,
  `quiet`, `icon`, `uid`, `downloadFile`. The parts: `output.ts` (the log,
  `announce()`, Alt+R), `terminal.ts` (the command line, history, Ctrl-R,
  Tab, the key bar, copy and paste, a follow, nano), `run-line.ts` (a line
  run: `needs()`, `waitFor()`), `notes.ts` (tips, the error explainer),
  `menu.ts` (stories, chapters, paths), `whats-new.ts` (the "New" badges,
  the `qds-badge` event), `settings.ts`, `exam.ts`, `on-call-duty.ts`,
  `autosave-banner.ts`, `tour.ts`, `summary.ts`, and the dialogs:
  `*-window.ts` built with the game (mission with hints and rescue, map,
  notebook, progress, achievements), `*-dialog.ts` the rarely opened ones,
  each a chunk of its own loaded when it first opens (`lazy-dialog.ts`:
  start here, feedback, reminder, a chapter's summary; precached by
  `src/pwa/build.ts`). The
  `nano` editor in `editor.ts`, the sysadmin's notebook whose logic is in
  `src/engine/notebook.ts`, the links to rouages.net after a chapter in
  `src/engine/rouages.ts`, the map of known places whose logic is in
  `src/engine/map.ts`, and its "Network" tab: the planned network
  diagram, declared by each chapter in `Chapter.plan`, see
  `src/engine/plan.ts`; "My progress", the short code and the save file, in
  `src/engine/progress.ts`: an added chapter goes at the end of
  `CODE_ORDER` and of `tests/progress/order.txt`; achievements and
  rank in `src/engine/achievements.ts`, easter eggs in `EGGS` of `shell.ts`;
  command-line highlighting in `src/engine/highlighting.ts` (it follows the
  game's shell: `split()`, `known()`), output colours (ANSI
  sequences, `Shell.colours`, `--color`) in `src/engine/colours.ts`: an
  event condition reads `last.output`, already without colours; on-call
  duty and the incident of the day in `src/engine/on-call.ts` (drawn from
  the date by the interface; the engine doesn't read the time), the
  on-call streak in `src/engine/streak.ts` (`streak()` on the days solved,
  `localDate()` given the interface's Date: a rest day in any seven, a
  clock set back; the results in `KEY-on-call` and the save file's
  `onCall`, `cleanOnCall`/`mergeOnCall` of `progress.ts`;
  `tests/streak.test.ts`), reminders and new-content notices, static
  only: the release date of each story in `src/engine/releases.ts`
  (`RELEASES`, set when a story is added, `tests/releases.test.ts`; the
  menu's "New" badges `whatsNew`/`markSeen`, `KEY-whats-new`), the Atom
  feeds `/en/feed.xml` and `/fr/feed.xml` (`src/engine/feed.ts`,
  `src/feeds.ts`, `src/pages/<language>/feed.xml.ts`, `<link
  rel="alternate">` and the footer's link in `Base.astro`), the daily
  reminder's calendar file in `src/engine/reminder.ts` (RFC 5545, floating
  time; its dialog's texts in `dialog-reminder.ftl`), the `qds-badge`
  event shown on the installed app's icon by `src/pwa/badge.ts`, the
  learning paths in `src/engine/paths.ts` (an added chapter goes in at
  least one path, `tests/paths.test.ts` checks it), "Report a problem or
  an idea" in `src/engine/feedback.ts` (`buildReport()`: a pure function,
  the parts ticked, `partLines`, progress codes removed, the GitHub link
  under `URL_LIMIT` by dropping the oldest commands; the interface's
  last steps `recentSteps`, never a password; no commands in exam mode;
  nothing sent; the version from `src/version.mjs` as `__QDS_VERSION__`;
  the footer's link `src/pwa/feedback-link.ts`; texts in `feedback.ftl`;
  `.github/ISSUE_TEMPLATE/feedback.md`; `tests/feedback.test.ts`), "Where do I start?"
  in `src/engine/start-here.ts` (four questions, `recommend()`: a path,
  a chapter playable now or the one that opens the way, alternatives;
  texts in `start-here.ftl`; the answers kept with the display settings,
  not the progress; a first visit's card and the tour's last step; hidden
  in exam mode; `tests/start-here.test.ts`), the end-of-chapter
  summary in `src/engine/summary.ts` (`Shell.passed`, `typedCommands`),
  replay and compare in `src/engine/runs.ts` (`makeRun`, `addRun`,
  `compare`, `diffLines`; the runs in `KEY-runs`, the lines typed kept by
  `run-line.ts`; the dialog's texts in `dialog-compare.ftl`;
  `tests/runs.test.ts`),
  the error explainer in `src/engine/explainer.ts` (a failed command's
  common error recognised from the messages listed in `explainer.ftl`'s
  `.match`, explained on demand under the output, never in exam mode, an
  "Error help" setting),
  graduated hints in `src/engine/hints.ts`, their texts in
  `src/texts/<language>/hints-<story>.ftl`: every new chapter has some,
  `tests/hints.test.ts` checks it), one-time tips earned by what the
  player types (silence means success, `cd ../..`, `cd -`, `cd ~`, Tab) in
  `src/engine/tips.ts` (texts `tip-*`, shown ones saved with the progress,
  a "Tips" setting), the intro tour of a first visit (`tour.ts`) and the
  notebook's window (with its shortcuts, `notebook-window.ts`); and styles (`styles.css`, everything
  under `.qds`, colours in `--qds-*` variables).
- `src/pwa/`: the installable game (Progressive Web App), on the site's
  pages only, never in the embeddable element: the manifests (`manifest.ts`,
  served by `src/pages/<language>/manifest.webmanifest.ts`), the service
  worker (template `service-worker.js`, written to `dist/sw.js` with its
  precache list, the game's shell from `first-load.mjs`, the build's hashed
  files and a version hashed from the build by the integration of
  `build.ts`; stories, their texts and the manual kept at runtime in
  `qds-runtime`), its registration and the footer's "Install the game"
  (`site.ts`, `install.ts`, imported by `Base.astro`, texts in
  `Base.astro`); icons in `public/icons/`, drawn by `scripts/icons.mjs`.
  Tests: `tests/pwa.test.ts`, the PWA part of `tests/browser.mjs`.
- `src/element.ts`: the `<quetes-de-sysadmin>` element (Shadow DOM);
  attributes `lang`, `story`, `save-key`, `theme="light|dark"`,
  `exam-control="page"` (with the `exam` property and the `exam-change`
  event; the home page's checkbox under "For teachers" in
  `src/exam-control.ts`) (the French
  names `langue`, `histoire`, `cle`, `theme="clair|sombre"` still work).
- `src/pages/en/teachers.astro` and `src/pages/fr/enseignants.astro`: the
  quest sheets (component `src/components/Sheets.astro`), computed by
  `src/engine/sheets.ts` (new commands, prerequisites, time) and
  `src/engine/difficulty.ts`. A story's printable sheet
  (`src/pages/en/teachers/sheets/[story].astro`,
  `src/pages/fr/enseignants/fiches/[story].astro`, component
  `StorySheet.astro`; `storySheets`, `manualPages`, `documentation` read
  from the debrief, `solutionRoute` from the hints for the folded teacher's
  version, in `sheets.ts`); the Print buttons (`data-print`) in
  `src/interface/print.ts`, the print styles at the end of `site.css`. The
  class table (`/en/teachers/class/`, `/fr/enseignants/classe/`, component
  `Classroom.astro`, `src/interface/classroom.ts`, logic in
  `src/engine/classroom.ts`: `exportTable`, `csvCell`, `csvSeparator` by
  language, `csvFile` with a BOM, `streakFor`) reads the students' saves in
  the browser, exports them as CSV and prints them; tests
  `tests/classroom.test.ts`, `tests/sheets.test.ts`.
- `src/texts/<language>/*.ftl`: every text (Fluent), loaded by
  `src/texts/index.ts` (`translator()`, `typography()`); `names.ftl`: the
  names of places and objects of chapters with `names: true` (in the code,
  `path()` and `name()` of `world.ts`; in tests, `inLanguage()`);
  `machines.ftl`: the machines' names (kingdom → royaume in French; `machineName()`,
  `hostInLanguage()` of `machines.ts`, `Shell.hostName`; in tests,
  `machinesInLanguage()`); `passwords.ftl`: the stories' passwords
  (`password()` of `world.ts`). Every identifier is English (chapters,
  stories, machines, places, accounts, passwords); French is a translation.
  `dialog-<name>.ftl`: a dialog's texts, their own group loaded when the
  dialog first opens (`src/texts/plugin.mjs`; in `game.ts`, `lazy()` text
  nodes filled by `withTexts()`, with the dialog's own chunk for a
  `*-dialog.ts`), precached for offline play
  (`src/pwa/build.ts`); its buttons stay in the core texts.
- `tests/quests.test.ts`: each chapter replayed; `tests/browser.mjs`:
  Chromium, 1000 and 375 px, the CSP of `.htaccess` applied, the root's
  language choice, the 404 page, embedding in another page, the PWA
  (service workers blocked elsewhere, `serviceWorkers: 'allow'` there);
  `tests/a11y.mjs` (also run by `npm run test:browser`): axe-core on every
  page and dialog, light and dark, 1000 and 375 px, and the checks axe
  cannot make (see `docs/ACCESSIBILITY.md`).
- Deployment: `.github/workflows/deploy.yml` (tests on each PR, FTPS and a
  check of the live site from `main`, including the root's redirections);
  see `docs/DEPLOYMENT.md`. Every new resource must respect the CSP (no
  inline script).

```bash
npm install
npm test                    # Vitest
npm run dev                 # http://localhost:4321
npm run build               # Astro site (dist/) + embeddable file (dist/integration/) + tsc + first-visit budget
npm run catalogue           # after adding a story or a chapter: src/engine/catalogue.json
npm run preview &           # http://localhost:4340, then:
npm run test:browser
```

**Texts**: every displayed text (story, dialogue, debrief, message, `man`
page) goes in `src/texts/en/*.ftl` first, then its translations
(`src/texts/fr/*.ftl`…) (Fluent format), never in the code; the code calls
`t('id', { variable })` or `game.t(...)`. How-to: `docs/TRANSLATING.md`.
`tests/texts.test.ts` fails if accented French remains in `src/engine/` or
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
  English names (translated by `inLanguage()`) and check texts in French.
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
  `man` pages live in `src/texts/<language>/*.ftl` (**Fluent** format,
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
  contrast; `prefers-reduced-motion` respected; usable on mobile. Target:
  WCAG 2.2 AA, see `docs/ACCESSIBILITY.md` and `tests/a11y.mjs` (a new
  page, dialog or state goes in its axe list). On the command line Tab
  completes, Shift+Tab and Escape then Tab leave it, Alt+R reads the last
  output again; what is said besides the log (the follow's digest, a
  chapter's end) goes through `announce()` (`interface/output.ts`), its logic in
  `src/engine/announce.ts`. A follow keeps the log quiet. Monospace text
  has no ligatures; a block that scrolls takes a tab stop; forced colours
  and reduced motion are handled at the end of `styles.css`; the terminal
  colours' contrast is checked by `tests/terminal-contrast.test.ts`.
- No tracker, no ads, no third-party resource (fonts and scripts served by
  the site). Progress in `localStorage`, with no account.
- Never put real personal data in the quests.

## Accuracy

- The behaviour of the simulated tools (ufw, fail2ban, nginx, docker,
  restic…) is based on their **official documentation**; cite the page used
  in a comment or in the debrief.
- Note in the documentation what is simplified.
