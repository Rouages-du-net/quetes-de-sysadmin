# Verified against sources

The game's messages and outputs were checked against the tools' own
sources, at the version Debian 13 (trixie) ships, or the version the story
names. Each line says what was checked, where, and what came of it:
**confirmed** (the game already matched), **corrected** (the game now
matches) or **unverifiable** (kept, and still listed in the table of
differences of [SCENARIOS.md](SCENARIOS.md)).

Checked in November 2026. Debian sources were read on
`sources.debian.org/data/main/…` (the package's version is given), upstream
ones on the tagged release.

## MariaDB 11.8 (The Allotments)

Sources: `sql/share/errmsg-utf8.txt`, `sql/sql_class.cc`, `sql/sql_repl.cc`,
`sql/rpl_gtid.cc`, `sql/protocol.cc`, `mysys/my_init.c` at
[mariadb-11.8.3](https://github.com/MariaDB/server/tree/mariadb-11.8.3)
(Debian 13.0's; trixie now has 11.8.9, same texts); the client library
`libmariadb/ma_errmsg.c` and `plugins/pvio/pvio_socket.c` of
[Connector/C v3.4.5](https://github.com/mariadb-corporation/mariadb-connector-c/tree/v3.4.5);
Debian's `debian/patches/hide-mysql-command-deprecation-warnings.patch`
(salsa.debian.org, tag `debian/1%11.8.3-0+deb13u1`).

| Item | Result |
| --- | --- |
| The 46 server errors the game raises: number, SQLSTATE and text | confirmed, but one: |
| ERROR 1941 for a bad `gtid_slave_pos` | corrected: "Could not parse GTID list" (the game added "for GTID_SLAVE_POS") |
| ERROR 1040 (HY000) "Too many connections" (errmsg says 08004) | confirmed: refused before the handshake, so the packet carries no SQLSTATE and the client says HY000 (`protocol.cc`) |
| `Unknown column 'x' in 'WHERE'` (and `'SELECT'`, `'ORDER BY'`, `'GROUP BY'`, `'SET'`, `'INSERT INTO'`) | confirmed: 11.x names the clause (`thd_where()` in `sql_class.cc`) |
| ERROR 1200 "Misconfigured slave: MASTER_HOST was not set; …" | confirmed (`sql_repl.cc`, `start_slave`) |
| ERROR 2002 "Can't connect to server on 'HOST' (115)" | confirmed: the non-blocking `connect()` leaves EINPROGRESS (115) in errno whether the port is refused or the packets dropped |
| … "(110)" for a timeout | corrected: only when `--connect-timeout` is given (poll times out, ETIMEDOUT) |
| ERROR 2005 "Unknown server host 'X' (-2)" | confirmed (getaddrinfo's EAI_NONAME) |
| `mysql`, `mysqldump`… without a deprecation warning | confirmed for Debian: upstream warns, Debian's patch silences it |

## Garage v2.1.0 (The Dance Troupe)

Sources: `src/garage/cli/remote/{cluster,layout,bucket,key,mod}.rs`,
`src/format-table/lib.rs`, `src/api/admin/{error,bucket,key,layout}.rs`,
`src/api/common/common_error.rs`, `src/rpc/layout/{history,version}.rs`,
`src/web/{web_server,error}.rs`, `src/model/bucket_alias_table.rs` at
[tag v2.1.0](https://git.deuxfleurs.fr/Deuxfleurs/garage/src/tag/v2.1.0);
timeago 0.4 (`convert`), chrono's `Display` for dates.

| Item | Result |
| --- | --- |
| `garage status`: a healthy node without a role | corrected: "NO ROLE ASSIGNED" sits in the Capacity column |
| `garage status`: FAILED NODES | corrected: no Address column; "Last seen" as timeago writes it ("3 days ago", "1 week ago", rounded down) |
| `garage layout show` with no staged change | corrected: no "No staged role changes." line |
| `garage layout show` with staged changes | corrected: the new layout's header only when it can be computed, "Zone redundancy: maximum", a REMOVED row with no empty columns; the error lines without a blank line |
| `garage layout apply` errors | corrected: "Error: ApplyClusterLayout returned InternalError (500): Internal error: Invalid new layout version"; no refusal of an empty change (Garage has none); the missing `--version` message starts on a new line |
| `garage layout remove`, `revert` without `--yes`, a node prefix matching 0 or 2 nodes | corrected: "Role removal is staged…", "Please add the --yes flag…", "0 nodes match 'x'" |
| `garage bucket info` | corrected: format_table's alignment (index and error documents widen the column), "Global aliases:" for several, no alias line without one, the keys table's empty name header |
| `garage bucket create`, `allow`, `deny`, `website` | corrected: they print the bucket's information (the game printed one line of its own) |
| `garage bucket delete`, `key delete` | corrected: "About to delete bucket ID." before the `--yes` error; "Bucket ID has been deleted." with the id; "Tried to delete a non-empty bucket" (BucketNotEmpty, 409) |
| Unknown bucket, wrong key pattern, existing or invalid bucket name | corrected to the admin API's errors ("GetBucketInfo returned NoSuchBucket (404): Bucket not found: x", "GetKeyInfo returned InvalidRequest (400): Bad request: 0 matching keys", …) |
| A bucket without website access on the web endpoint | corrected: `404 Not Found` page in HTML (`text/html; charset=utf-8`), not an XML NoSuchBucket error; a missing object adds "Code: NoSuchKey / Message: Key not found." |
| The command line's own argument errors | unverifiable here: Garage parses with structopt (clap 2.34); the game keeps clap 4's wording (listed in the table) |

## rspamd 3.12.1 (The Lifeboat)

Sources: `src/client/rspamc.cxx`, `src/libserver/protocol.c`,
`src/libmime/message.c`, `conf/scores.d/*.conf`, `rules/*.lua`,
`src/plugins/lua/{rbl,phishing,spf,dmarc}.lua` at
[tag 3.12.1](https://github.com/rspamd/rspamd/tree/3.12.1) (Debian 13: 3.12.1-1).

| Item | Result |
| --- | --- |
| `rspamc` layout: Results for file, `[Metric: default]`, Action, Spam, Score, `Symbol: NAME (score)[options]`, Message-ID | confirmed; corrected: the time with three significant digits (`{:.3}`), symbols sorted with strcmp (`R_…` after `RDNS_…`), `Message-ID: undef` without one, `Urls:`/`Emails:` lines when the message has links |
| Weights of RDNS_NONE, HFILTER_HOSTNAME_UNKNOWN, ONCE_RECEIVED, SPF, DKIM, DMARC_POLICY_ALLOW/REJECT/SOFTFAIL, FROM_NEQ_ENVFROM, MIME_HTML_ONLY, R_SUSPICIOUS_URL, HTML_SHORT_LINK_IMG_1, HAS_LIST_UNSUB, PRECEDENCE_BULK, MISSING_MID, BAYES_SPAM/HAM | confirmed |
| DMARC_POLICY_QUARANTINE | corrected: 1.5 (was 2.0) |
| SUBJ_ALL_CAPS | corrected: 3.0 × min(1, length / 40), the length as option (was a flat 2.1) |
| PHISHING | corrected: 4.0 × the module's distance weight, option "shown->real" registered domains |
| RBL option | corrected: "ADDRESS:from" (`make_option`), not a reversed DNS name |
| RBL_SPAMCOP | unverifiable as a default: 3.12 ships no SpamCop list; kept as the story's own blocklist (listed in the table) |

## Pigeonhole and Dovecot 2.4.1 (The Lifeboat)

Sources: `pigeonhole/src/lib-sieve/{sieve-lexer,sieve-validator,sieve-ast}.c`,
`cmd-redirect.c`, `tst-*.c`, `ext-*.c`, `plugins/body/tst-body.c`,
`plugins/vacation/cmd-vacation.c`; `src/lib-storage/mail-search-*.c`,
`src/lib/str-parse.c` of Debian's dovecot 1:2.4.1+dfsg1-6+deb13u7.

| Item | Result |
| --- | --- |
| Argument type names ("a string", "a string list", "a number", "a tag") | confirmed (`sieve_ast_argument_type_name`) |
| "the X command expects … as argument N, but … was found" | corrected: the argument's name follows its number ("as argument 1 (folder)") |
| Lexer: unfinished bracket comment | corrected: `('/* ... */')` with single quotes, reported at the end of the file's line |
| Lexer: unfinished quoted string | corrected: "… started at line N", reported at the end of the file's line |
| Lexer: unexpected character | corrected: a control character shown as `0x..` (`_char_sanitize`) |
| `doveadm search … larger X` with a bad size | corrected: "Invalid size: X" (str_parse_get_size); sizes like `10k`, `2 MiB` accepted |

## Podman 5.4.2, passt and systemd 257 (The Walking Club)

Sources: Podman's sources at [v5.4.2](https://github.com/containers/podman/tree/v5.4.2)
(Debian 13: podman 5.4.2+ds1-2+b2): `pkg/rootless/rootless_linux.go`,
`vendor/github.com/containers/storage/pkg/idtools/idtools.go`,
`vendor/github.com/containers/common/pkg/config/config.go`,
`vendor/github.com/containers/common/libnetwork/pasta/pasta_linux.go`,
`vendor/github.com/rootless-containers/rootlesskit/v2/pkg/port/builtin/parent/parent.go`,
`vendor/github.com/containers/common/pkg/chown/chown_unix.go`,
`vendor/github.com/containers/storage/containers.go`, `libpod/container_internal.go`,
`vendor/github.com/containers/image/v5/{copy,storage}`, `cmd/quadlet/main.go`,
`pkg/systemd/quadlet/quadlet.go`, `cmd/podman/generate/systemd.go`,
`cmd/podman/system/unshare.go`; passt's `conf.c` and `log.h` at
2025_05_03.587980c (Debian 13: 0.0~git20250503.587980c-2+deb13u1); systemd's
`src/shared/bus-util.c` (`bus_log_connect_error`) and `src/shared/install.c` at v257.

| Item | Result |
| --- | --- |
| "cannot find UID/GID for user X: no subuid ranges found for user \"X\" in /etc/subuid - check rootless mode in man pages." (ERRO), "Using rootless single mapping into the namespace. This might break some images. Check /etc/subuid and /etc/subgid for adding sub*ids if not using a network user" (WARN) | confirmed |
| "potentially insufficient UIDs or GIDs available in user namespace (requested 0:42 for /etc/gshadow): Check /etc/subuid and /etc/subgid if configured locally and run \"podman system migrate\": lchown …: invalid argument", wrapped by "writing blob: adding layer with blob …: processing tar file(…): exit status 1" | confirmed (the blob's trusted identity printed as `"sha256:…"/""/"sha256:…"`) |
| The four user session warnings ("The cgroupv2 manager is set to systemd but there is no systemd user session available" … "Falling back to --cgroup-manager=cgroupfs") | confirmed |
| Rootless ports: Podman 5 uses pasta by default (`default_rootless_network_cmd`), "pasta failed with exit code 1:" followed by passt's "Failed to bind port 80 (Permission denied) for option '-t 80-80:8080-8080'" | confirmed; rootlesskit's "cannot expose privileged port 80, you can add 'net.ipv4.ip_unprivileged_port_start=80' to /etc/sysctl.conf (currently 1024), or choose a larger port number (>= 1024)" kept for `--network slirp4netns` (prefixed "rootlessport ") |
| `:U`: "failed to chown recursively host path: lchown …: operation not permitted" | confirmed (the message); EPERM on files the namespace doesn't map is the kernel's |
| "creating container storage: the container name \"X\" is already in use by ID. You have to remove that container to be able to reuse that name: that name is already in use", "cannot remove container ID as it is running - running or paused containers cannot be removed without force: container state improper", "please use unshare with rootless", generate systemd's DEPRECATED text, "short-name \"X\" did not resolve to an alias and no unqualified-search registries are defined in …" | confirmed |
| Quadlet: "converting \"X.container\": unsupported key 'K' in group 'Container' in PATH", "no Image or Rootfs key specified", the generated unit's lines (`--replace --rm --cgroups=split --sdnotify=conmon -d`, `systemd-%N`, `Type=notify`, `KillMode=mixed`, `[X-Container]`), dry run's `---NAME.service---` | confirmed; the order of the generated file's groups is approximated |
| systemctl --user: "Failed to connect to user scope bus via local transport: $DBUS_SESSION_BUS_ADDRESS and $XDG_RUNTIME_DIR not defined (consider using --machine=<user>@.host --user to connect to bus of other user)" | confirmed; "Failed to enable unit: Unit … is transient or generated" (`src/shared/install.c`, `install_changes_dump`: no final period) |
| `podman ps`/`images` layout (tabwriter 12, 2, 2; COMMAND cut at 17 characters; HumanDuration; HumanSizeWithPrecision 3) | confirmed |
| `loginctl list-users` columns (UID USER LINGER STATE), "Could not enable linger: Access denied", "Failed to get user: User ID N is not logged in or lingering" | approximated (systemd 257's tables and logind's errors, not checked line by line) |

## NUT 2.8.1 (The Climbing Wall)

Sources: `clients/{upsmon,upsmon.h,upsclient,upssched,upsc,upscmd,upsrw}.c`,
`server/{upsd,sstate,user,conf}.c`, `drivers/{upsdrvctl,usbhid-ups,libusb1}.c`,
`scripts/systemd/nut-driver@.service.in` at
[v2.8.1](https://github.com/networkupstools/nut/tree/v2.8.1) (Debian 13: 2.8.1-5).

| Item | Result |
| --- | --- |
| 31 messages spot-checked: upsmon's (on battery, battery low, FSD, "Executing automatic power-fail shutdown", "Auto logout and shutdown proceeding", poll and login failures, "Host sync timer expired, forcing shutdown"), upsd's ("Connected to UPS [x]: usbhid-ups-x", "listening on … port …", "Found N UPS defined in ups.conf", world-readable upsd.users), upssched's, the clients' errors ("Unknown UPS", "Driver not connected", "Data stale", "Variable not supported by UPS"), the driver's banner and version strings, the unit's "FATAL: Could not find a NUT device section…" | confirmed |

## keepalived 2.3.3 (The Blood Drive)

Sources: `keepalived/core/main.c` (`config_test_exit`), `lib/scheduler.h`,
`lib/parser.c`, `keepalived/vrrp/{vrrp,vrrp_parser,vrrp_data,vrrp_track,vrrp_ipaddress}.c`
at [v2.3.3](https://github.com/acassen/keepalived/tree/v2.3.3) (Debian 13: 2.3.3-1).

| Item | Result |
| --- | --- |
| `keepalived -t` exit code | corrected: 5 for any configuration error or warning, 4 for a file that is missing or can't be read, 0 otherwise (was 1) |
| Line prefix | corrected: "(Line N) …" with a single file (the file name only appears with several) |
| VRID, priority, script weight, unknown interface, missing router id, track script not found, no script, extra '}', missing '}', bad VIP, bad unicast peer | corrected to keepalived's texts ("(VI_1): VRID '300' not valid…", "… Using default 100", "must be in [-253, 253]", "Unknown interface!", "No script set for vrrp_script X - removing", "Extra '}' found", "There are N missing '}'s or extra '{'s", "VRRP parsed invalid IP …", "malformed unicast peer address[…]") |
| "Unknown keyword 'x'", "unknown state …", "Warning - nopreempt will not work with initial state MASTER - clearing" | confirmed |

## HAProxy 3.0.11 (The Blood Drive)

Sources: `src/{cfgparse,server,errors,tcpcheck}.c` of Debian's
haproxy 3.0.11-1+deb13u4.

| Item | Result |
| --- | --- |
| http-check rules without `option httpchk` | corrected: "[WARNING] … : config : backend 'X' uses http-check rules without 'option httpchk', so the rules are ignored." |
| "option httpchk ignored … as no server has the 'check' option" | corrected: removed, HAProxy has no such warning |
| A frontend without `bind` | corrected: a warning, "frontend 'X' has no 'bind' directive. Please declare it as a backend if this was intended." (was an alert) |
| "Server X/Y enters drain state" | corrected: followed by ". N active and M backup servers online. 0 sessions requeued, 0 total in queue" |
| Leaving forced maintenance | corrected: "is UP/READY (leaving forced maintenance)" |
| "is UP/DOWN, reason: …, check duration: …" with the server counts, "going DOWN for maintenance", "'set server <srv> state' expects …", the "[ALERT]"/"[WARNING]" prefix with "config :" | confirmed |

## restic 0.18.0 (The Choir)

Sources: `cmd/restic/{cmd_forget,main}.go`, `internal/restic/duration.go`
at [v0.18.0](https://github.com/restic/restic/tree/v0.18.0); spf13/pflag
v1.0.6 `flag.go`.

| Item | Result |
| --- | --- |
| A bad `--keep-within` | corrected: `invalid argument "30x" for "--keep-within" flag: invalid unit 'x' found after number 30` (or "no unit found after number N", "no number found"), without "Fatal:"; units in any order |
| A bad `--keep-last` (and the others) | corrected: the flag named with its shorthand (`"-l, --keep-last"`), without "Fatal:"; `unlimited` accepted; a negative count refused with restic's message |

## CUPS 2.4.10 (The Staff Room)

Sources: `scheduler/{ipp.c,cups.service.in}`, `systemv/{lpadmin,lpstat}.c`,
`berkeley/lpq.c`, `debian/patches/series` of Debian's cups 2.4.10-3+deb13u2.

| Item | Result |
| --- | --- |
| `systemctl reload cups` | corrected: refused ("Job type reload is not applicable"), the unit has no `ExecReload=` |
| `lpstat` for another user's job under JobPrivateValues | corrected: "unknown" in the owner column (was blank) |
| Job sizes in `lpstat -o` and `lpq` | corrected: 1024 × job-k-octets (the size rounded up to a kilobyte) |
| `lpadmin -m` with an unknown model | corrected: "lpadmin: cups-driverd failed to get PPD file - see error_log for details." and "copy_model: empty PPD file" in error_log |
| An unreachable printer's message | unverifiable without a live network trace (kept in the table) |

## Rocky Linux 10.3: SELinux, firewalld, DNF, httpd (The Language Café)

Sources: Rocky Linux 10.3's source RPMs (dl.rockylinux.org/pub/rocky/10/):
selinux-policy 42.1.27-2.el10_3.2 (`policy/modules/contrib/apache.{te,fc}`,
`kernel/corenetwork.te.in`, `kernel/files.fc`, `system/authlogin.te`,
`contrib/nis.if`, `dist/targeted/booleans.conf`,
`config/file_contexts.subs_dist`); policycoreutils, libselinux and
libsemanage 3.11 (`python/semanage/seobject.py`,
`python/audit2allow/audit2allow`, sepolgen's `policygen.py`,
`python/sepolicy/sepolicy/__init__.py`,
`libselinux/utils/{setenforce,getsebool}.c`,
`libselinux/src/selinux_restorecon.c`, `policycoreutils/{setsebool,sestatus}`,
`libsemanage/src/direct_api.c`); audit 4.2.1 (`src/ausearch*.c`,
`auparse/auditd-config.c`); firewalld 2.4.3-4.el10_2 (`src/firewall-cmd.in`,
`src/firewall/{command,errors}.py`, `core/{rich,fw_policy}.py`,
`core/io/policy.py`, `server/config_zone.py`, `config/`, Red Hat's patch
adding cockpit to public); dnf 4.20.0-28 (`dnf/cli/{cli,output,main}.py`,
`dnf/base.py`, `dnf/cli/commands/{search,install}.py`); httpd
2.4.63-13.el10_2.8 (`server/{listen,main,core,request}.c`,
`modules/proxy/{proxy_util,mod_proxy_http}.c`, the package's `httpd.conf`,
`welcome.conf`, `httpd.service`).

| Item | Result |
| --- | --- |
| Rocky 10 ships DNF 4 (4.20.0), not dnf5; firewalld 2.4.3; selinux-policy 42.1.27 | confirmed (the 10.3 repositories) |
| `httpd_can_network_connect`, `httpd_graceful_shutdown`, `httpd_can_network_relay`, `httpd_read_user_content`, `nis_enabled` default off; graceful_shutdown and relay are what let httpd_t connect to http_port_t, so typing 8086 http_port_t alone doesn't let it connect | confirmed (`apache.te`, targeted `booleans.conf`) |
| `nis_enabled` lets nsswitch domains (httpd included) bind and connect to unreserved ports: audit2why offers it next to httpd_can_network_connect | confirmed (`nis.if`, `authlogin.te`) |
| http_port_t: tcp 80, 81, 443, 488, 8008, 8009, 8443, 9000; 8010 and 8086 are unreserved_port_t; httpd_t binds http_port_t and http_cache_port_t | confirmed (`corenetwork.te.in`, `apache.te`) |
| `/srv/([^/]*/)?www(/.*)?` is httpd_sys_content_t, `/srv/.*` var_t | confirmed (`apache.fc`, `files.fc`): the story uses `/srv/site`, not `/srv/www` |
| semanage's listings ("%-50s %-18s %s", "%-30s %-8s %s", the boolean table), "Port tcp/N already defined, modifying instead", "Type %s is invalid, must be a port type" / "a file or device type", "File context for %s already defined, modifying instead", "SELinux policy is not managed or store cannot be accessed." | confirmed |
| restorecon's "Relabeled %s from %s to %s", "Would relabel", "lstat(%s) failed", the type only without -F | confirmed |
| setenforce's usage and "security_setenforce() failed", setsebool's "Could not change active booleans. Please try as root", "Cannot set persistent booleans, please try as root.", "Boolean %s is not defined", getsebool's "%s --> %s" | confirmed |
| sestatus's 32-column layout; ausearch's "----", "time->", "<no matches>", the non-root "Error opening config file (Permission denied)" | confirmed |
| audit2why's texts ("Was caused by:", "The boolean %s was set incorrectly. ", "One of the following booleans was set incorrectly.", "Missing type enforcement (TE) allow rule."), audit2allow's IMPORTANT banner and "#!!!! This avc can be allowed using the boolean" | confirmed; the booleans' descriptions are sepolicy's fallback (policy.xml is in selinux-policy-devel) |
| firewall-cmd: "success", "Warning: ALREADY_ENABLED: 'http' already in 'public'" (runtime) / ": http" (permanent), "Error: INVALID_SERVICE…", "Authorization failed." and its polkit line (253), "FirewallD is not running" (252), `--list-all`'s lines | confirmed |
| dnf: "Last metadata expiration check: … ago on …", "Is this ok [y/N]: ", "No match for argument", "Error: Unable to find a match", the superuser error, search's sections, history's columns | confirmed; the transaction table's column widths and the download lines are approximated |
| httpd: AH00072 (13)/(98), "no listening sockets available, shutting down", AH00015, AH00132, AH00035, AH00957, AH00959, AH01114, AH01630 | confirmed; "Server configured, listening on: port 80" and the "SELinux policy enabled" notice come from Red Hat's patches (as seen on RHEL; the patches were not read) |
| The AVC record's layout (`avc:  denied  { read } for  pid=… comm=… name=… scontext=… tcontext=… tclass=… permissive=0`), and ausearch printing an event's records PROCTITLE first | unverifiable here (the kernel's and auparse's output order were not read): kept as commonly printed |
## OpenTofu v1.13.10 and hashicorp/dns v3.6.2 (The Mapping Party)

Sources: OpenTofu's `internal/command/views/{init,apply,operation,import,state,output,unlock,hook_ui,validate}.go`,
`internal/command/jsonformat/{plan.go,computed/renderers/{block,set,util}.go,differ/set.go}`,
`internal/command/format/{diagnostic,trivia}.go`, `internal/command/clistate/state.go`,
`internal/backend/local/{backend_apply,backend_local}.go`, `internal/states/statemgr/{filesystem,locker}.go`,
`internal/tofu/{evaluate,node_resource_validate,node_resource_import,context}.go`,
`internal/backend/unparsed_value.go`, `internal/plans/plan.go`, `internal/terminal/stream.go` at
[tag v1.13.10](https://github.com/opentofu/opentofu/tree/v1.13.10); HCL's
`hclsyntax/{parser,structure}.go` ([main](https://github.com/hashicorp/hcl));
the provider's `internal/provider/{provider,resource_dns_a_record_set,resource_dns_cname_record,validators}.go`
and `docs/` at [v3.6.2](https://github.com/hashicorp/terraform-provider-dns).

| Item | Result |
| --- | --- |
| Diagnostics: `╷ │ ╵`, "Error: " then the summary, "on FILE line N, in BLOCK:", the snippet `%4d: `, the detail wrapped at 75 columns | confirmed (`format.DiagnosticFromJSON`, 78 columns when not a terminal) |
| "Missing required argument" before "Unsupported argument", the former on the block's `{` line; "Did you mean" | confirmed (hclsyntax `Body.Content`: `PartialContent` first, `MissingItemRange` = the body's start) |
| "No value for required variable", before validation | confirmed (`backend/unparsed_value.go`, `localRunDirect`); the snippet without context is an assumption (hcled's context for a declaration range) |
| "Inconsistent dependency lock file", "Missing required provider" | confirmed (`backend_local.go`, `context.go`) |
| init's lines, the lock file's message, "(unauthenticated)" for a mirror, the incomplete lock file warning | confirmed (`views/init.go`, `init.go`); its position among the lines approximated |
| Plan rendering: symbols, "will be created", "must be replaced", "# forces replacement", "has changed", "(N unchanged attributes hidden)", the set's elements (removed then added), the rule of 77 "─", "Note: You didn't use the -out option" | confirmed (`jsonformat`); the "-> (known after apply)" of an id in a replacement from memory of real plans |
| "Plan: N to add, N to change, N to destroy." and the import form | confirmed |
| The approval question, "Enter a value: ", "Apply cancelled." | confirmed (`backend_apply.go`, `ui_input.go`, `operation.go`) |
| Hook lines: "Refreshing state... [id=…]", "Creating...", "Creation complete after 0s [id=…]", "Destruction complete", "Importing from ID", "Import prepared!" | confirmed (`hook_ui.go`); the duration is always 0s |
| "Error acquiring the state lock", "resource temporarily unavailable", Lock Info's layout | confirmed (`clistate/state.go`, `statemgr/locker.go`); the error text is Linux's EAGAIN from flock |
| force-unlock on a local state: "State locked by another local process" / "Local state cannot be unlocked by another process." | confirmed (`unlock.go`, `views/unlock.go`) |
| state rm/mv messages, "No instance found for the given address", "No state file was found", output's warnings | confirmed (`views/state.go`, `views/output.go`) |
| The provider: import IDs are FQDNs with the final dot ("Not a fully-qualified DNS name"), zone/name/ttl ForceNew, addresses updated by set difference, TTL default 3600 | confirmed (`provider.go`, `resource_dns_a_record_set.go`, the CNAME resource's plan modifiers) |
| named's update log ("signer … approved", "updating zone '…/IN': deleting rrset at", "adding an RR at"), `rndc: 'reload' failed: dynamic zone` | from BIND 9.20's `update.c` and `rndc` as remembered; not re-read here |
| `tofu -help`'s command list | confirmed (`cmd/tofu/help.go`, each command's `Synopsis()`), reduced to the commands the game has |
## AppArmor 4.1.0 (The Zine Library)

Sources: `binutils/aa_status.c`, `parser/parser_main.c`,
`utils/apparmor/{tools,aa,ui}.py`, `utils/aa-logprof`, `utils/logprof.conf`
and `profiles/apparmor.d/php-fpm` at
[apparmor-4.1](https://gitlab.com/apparmor/apparmor/-/tree/apparmor-4.1)
(Debian 13: apparmor 4.1.0-1, https://packages.debian.org/trixie/apparmor);
the man pages of https://manpages.debian.org/trixie/apparmor/ and
https://manpages.debian.org/trixie/apparmor-utils/; the file list of
apparmor-profiles 4.1.0-1 (https://packages.debian.org/trixie/all/apparmor-profiles/filelist);
https://wiki.debian.org/AppArmor/HowToUse.

| Item | Result |
| --- | --- |
| aa-status: "apparmor module is loaded.", "%zd profiles are loaded.", "%zd profiles are in %s mode." for enforce, complain, prompt, kill, unconfined, "%zd processes have profiles defined.", "%zd processes are unconfined but have a profile defined.", the process line "   %s (%s) %s" (the profile left out when it is the program's path), "You do not have enough privilege to read the profile set." and exit code 4 | confirmed |
| The tools: "Setting %s to complain mode.", "Setting %s to enforce mode.", "Disabling %s.", "Profile for %s not found, skipping", "%s does not exist, please double-check the path.", "Can't find %s in the system path list…", "Profile for %s already exists - skipping.", "Writing updated profile for %s.", "Reading log entries from %s.", "Updating AppArmor profiles in %s.", "Complain-mode changes:", "Enforce-mode changes:", "Can't find system log … Please check permissions.", "The logfile %s does not exist. Please check the path."; the disable/ link; apparmor_parser -r after a mode change; aa-autodep's complain flag, interpreter `ix` and bash abstraction; the menu's button order | confirmed |
| The php-fpm profile (its rules, `include if exists <php-fpm.d>`, `include if exists <local/php-fpm>`); aa-genprof's two choices and its Finish to enforce mode (aa-genprof(8)) | confirmed |
| apparmor_parser's syntax errors ("syntax error, unexpected TOK_CLOSE, expecting TOK_END_OF_RULE", "unexpected TOK_MODE, expecting TOK_OPEN", "Could not open '…'"), "Invalid mode, 'x' must be preceded by exec qualifier…", "Conflict 'a' and 'w' perms are mutually exclusive."; the kernel's record fields (`class="file"`, `capability=2  capname="dac_read_search"`); aa-logprof's header labels and the Save menu's words; severities | from memory of real outputs, not checked against the 4.1 sources |

## SOPS v3.10.2 and age v1.2.1 (The Tenants' Union)

Sources: SOPS's `usererrors.go`, `sops.go` (`Tree.Encrypt`, `Tree.Decrypt`,
`shouldBeEncrypted`, `decryptKey`), `aes/cipher.go`, `age/keysource.go`,
`stores/{flatten.go,stores.go,dotenv/store.go}`, `config/config.go`,
`cmd/sops/{main.go,encrypt.go,decrypt.go,edit.go,rotate.go}`,
`cmd/sops/common/common.go`, `cmd/sops/codes/codes.go`,
`cmd/sops/subcommand/updatekeys/updatekeys.go`, `version/version.go` at
v3.10.2 (the module from proxy.golang.org, github.com/getsops/sops/v3);
age's `cmd/age-keygen/keygen.go`, `x25519.go`, `parse.go`, `age.go`,
`internal/bech32/bech32.go` at v1.2.1 (filippo.io/age; Debian 13 ships
1.2.1-1, sources.debian.org). Git's ignored-file message from Git 2.47's
`advice.c` hint as Git ≥ 2.46 prints it (`git config set`).

| Item | Result |
| --- | --- |
| "Failed to get the data key required to decrypt the SOPS file.", "Group 0: FAILED", each key's "FAILED" with `- |` and `|` lines wrapped at 60, the trailer wrapped at 75 | confirmed (`usererrors.go`); the blank line between two keys keeps the two-space prefix, as `prefixer` writes it |
| "failed to create reader for decrypting sops data key with age: no identity matched any of the recipients", "failed to load age identities: failed to open file: open …: no such file or directory", "failed to open SOPS_AGE_KEY_FILE file: …" | confirmed (`age/keysource.go`, `age.go`) |
| "MAC mismatch. File has …, computed …", "Error decrypting tree: Error walking tree: Could not decrypt value: …", "Input string … does not match sops' data format", "Could not decrypt with AES_GCM: cipher: message authentication failed" | confirmed (`common.go`, `sops.go`, `aes/cipher.go`; Go's `crypto/cipher` message) |
| "config file not found, or has no creation rules, and no keys provided through command line options" and its ": error loading config: no matching creation rules found" | confirmed (`main.go`, `config.go`) |
| "File already encrypted"'s user message wrapped at 75, exit code 203 | confirmed (`encrypt.go`, `codes.go`) |
| updatekeys: "Syncing keys for file", "already up to date", "The following changes will be made to the file's groups:", "Group 1", `+++`, `---`, "Is this okay? (y/n):", "synced with new keys", "left unchanged", the same data key | confirmed (`updatekeys.go`, `common.go` PrettyPrintDiffs) |
| rotate: a new data key, `--add-age` to the first group, `--rm-age` from every group | confirmed (`rotate.go`) |
| edit: SOPS_EDITOR, EDITOR, then vim, nano, vi; "File has not changed, exiting." (200); the example file of a new dotenv file | confirmed (`edit.go`, `stores.go` ExampleFlatTree) |
| The dotenv store: `#` comments, `KEY=value`, `\n` escapes, the `sops_` prefix, keys sorted, `__map_`/`__list_` flattening, "invalid dotenv input line" | confirmed (`dotenv/store.go`, `flatten.go`) |
| A plain dotenv file given to `-d`: Go's time parsing error on an empty `sops_lastmodified` | confirmed by reading `ToInternal` (`time.Parse(time.RFC3339, "")`); not run |
| Exit codes 2, 3, 4, 8, 25, 51, 91, 92, 100, 128, 200, 201, 203 | confirmed (`codes.go`) |
| age-keygen: usage text, "Public key: …" on stderr when the output isn't a terminal, the world-readable warning, "failed to open output file …: file exists", the report line, "too many arguments", `-y`'s "no identities found in the input" | confirmed (`keygen.go`) |
| Bech32 errors ("invalid checksum", "invalid character data part", "separator '1' at invalid position") and "malformed recipient …" | confirmed (`internal/bech32`, `x25519.go`) |
| `sops --version` without network: the "[warning] failed to retrieve latest version from upstream" line and the note on `--check-for-updates` | wording confirmed (`version.go`); the Go network error inside is an approximation |
| urfave/cli's "Incorrect Usage. flag provided but not defined: -x" | from urfave/cli v1's behaviour as remembered; not re-read here |
| `sops --help` | abridged from `main.go`'s `UsageText` and flags (kept in the table of differences) |

## OpenBao v2.7.3 (The Hostel)

Sources: OpenBao's `internal/command/{status,format,base,base_helpers,operator_unseal,operator_init,operator_seal,login,token_create,token_lookup,token_revoke,token_capabilities,policy_write,policy_read,policy_list,policy_delete,kv_get,kv_put,kv_patch,kv_list,kv_rollback,kv_metadata_get,kv_helpers,read,write,audit_list,secrets_list,version,main}.go`,
`api/{response,client,env,sys_seal}.go`, `internal/http/sys_seal.go`,
`internal/vault/{request_handling,seal_manager,seal,core,cluster,token_store,logical_system}.go`,
`internal/vault/policy/{policy,policy_store}.go`, `internal/vault/barrier/barrier.go`,
`internal/audit/format.go`, `internal/command/server/config.go`, `sdk/logical/{error,response_util}.go`,
`sdk/helper/{consts/error,consts/token_consts,hclutil/hcl}.go`, `internal/builtin/credential/token/cli.go`,
the package's `.release/linux/` (`openbao.hcl`, `openbao.service`, `nfpm.yaml`, `postinst`) and
`website/content/docs/` at [tag v2.7.3](https://github.com/openbao/openbao/tree/v2.7.3) (released 19 November 2026).

| Item | Result |
| --- | --- |
| `bao status`'s table: Seal Type, Initialized, Sealed, Total Shares, Threshold, Unseal Progress N/T and Unseal Nonce while sealed, Version, Commit Date, Storage Type, Cluster Name/ID once unsealed, HA Enabled; exit code 2 while sealed | confirmed (`format.go` `formatSealStatusStruct`, `OutputSealStatusStruct`, `status.go`) |
| Tables: columnize with four spaces, "n/a" for an empty cell, the dashed header; Go's `%v` (`<nil>`, `[a b]`, `map[k:v]`) and `%q` (`["bunks" "default"]`); `∞` for a token without TTL; durations as `humanDuration` (768h, 2h30s) | confirmed (`base_helpers.go`, `format.go` `OutputSecret`/`OutputMap`) |
| "Unseal Key (will be hidden): ", "Error unsealing: …", a duplicate share ignored, "'key' must be a valid hex or base64 string", "invalid key: key is shorter than minimum 16 bytes", the parts cleared after the threshold | confirmed (`operator_unseal.go`, `sys_seal.go`, `seal_manager.go` `recordUnsealPart`/`getUnsealKey`) |
| A wrong share: "invalid key: failed to decrypt keys from storage: cipher: message authentication failed" | confirmed in `seal.go` (`readStoredKeys`); the last part is Go's AES-GCM error, as go-kms-wrapping returns it |
| "Error initializing: … * Vault is already initialized", "Vault is sealed" (503), "Success! Vault is sealed." | confirmed (`core.go`, `consts/error.go`, `operator_init.go`, `operator_seal.go`) |
| The API error's layout ("Error making API request.", "URL: METHOD URL", "Code: N. Errors:", "* …", "Raw Message" when the body isn't JSON) | confirmed (`api/response.go`) |
| An ACL denial: "1 error occurred:\n\t* permission denied\n\n"; a missing or revoked token: "permission denied"; lookup of an unknown token: "bad token" | confirmed (`request_handling.go` `CheckToken`, `fetchACLTokenEntryAndEntity`, `token_store.go` `handleLookup`) |
| The KV preflight on `sys/internal/ui/mounts/PATH` and "preflight capability check returned 403, please ensure client's policies grant access to path "…/"" | confirmed (`kv_helpers.go`, `logical_system.go` `pathInternalUIMountRead`, `hasMountAccess`) |
| `kv get`'s "Secret Path" / "Metadata" / "Data" headers (padEqualSigns), "No value found at …", "Field "…" not present in secret"; kv put/patch/rollback/metadata get outputs and errors | confirmed (`kv_get.go`, `kv_put.go`, `kv_patch.go`, `kv_rollback.go`, `kv_metadata_get.go`, `kv_helpers.go`); the field message is from `PrintRawField` |
| Tokens: "s." + 24 base62 characters with the default `disable_sscts`; accessor 24 characters; the default policy's text; child tokens revoked with their parent; "child policies must be subset of parent" without sudo; the 768h default and maximum TTL | confirmed (`token_store.go`, `server/config.go`, `policy_store.go`); the cap without a warning is a simplification |
| `token lookup`'s fields (accessor, creation_time, creation_ttl, display_name, entity_id, expire_time, explicit_max_ttl, id, issue_time, meta, num_uses, orphan, path, policies, renewable, ttl, type) | confirmed (`token_store.go` `handleLookup`) |
| `token create`'s table (token, token_accessor, token_duration, token_renewable, token_policies, identity_policies, policies) | confirmed (`format.go` `OutputSecret`) |
| `token capabilities`: sorted, comma-separated; "deny", "root" | confirmed (`token_capabilities.go`) |
| Policy errors: "failed to parse policy: path "x": path "x": invalid capability "reed"" (the path named twice), "invalid key "…" on line N" in a multierror; "Success! Uploaded policy: NAME" | confirmed (`policy/policy.go` `parsePaths`/`parsePath`, `hclutil.CheckHCLKeys`, `policy_write.go`); HCL v1's own syntax messages ("object expected closing RBRACE got: EOF") from memory of hashicorp/hcl v1, not re-read |
| Priority between matching rules (first wildcard, trailing `*`, number of `+`, length, lexical order) | confirmed (`website/content/docs/concepts/policies.mdx`) |
| `login`: "Success! You are now authenticated…", the BAO_TOKEN warning, "Error authenticating: error looking up token: …", "Token (will be hidden): " | confirmed (`login.go`, `credential/token/cli.go`) |
| "Command flags must be provided before positional arguments. The following arguments will not be parsed as flags: [...]" | confirmed (`base_helpers.go` `generateFlagWarnings`) |
| The audit entries' field names (time, type, auth{client_token, accessor, display_name, policies, token_policies, policy_results, token_type, token_ttl, token_issue_time}, request{id, operation, mount_point, mount_type, client_token, client_token_accessor, namespace, path, data, remote_address, remote_port}, response, error) and `hmac-sha256:` + hex | confirmed (`audit/format.go`); the set of fields kept per entry is reduced |
| `/sys/audit-hash/:path` returning `hash` | confirmed (`website/content/docs/api/system/audit-hash.mdx`) |
| `bao audit list` ("Path Type Description"), `bao secrets list` ("Path Type Accessor Description"), the root help's command list and synopses | confirmed (`audit_list.go`, `secrets_list.go`, `main.go`, each command's `Synopsis()`) |
| The package: `/etc/openbao/openbao.hcl` (pebbledb storage, TLS listener on 0.0.0.0:8200), `openbao.service` (Description in quotes, `Type=notify`, `ExecReload=/bin/kill --signal HUP`), the self-signed certificate of `postinst` | confirmed (`.release/linux/`); the declarative `audit "file"` stanza from `website/content/docs/configuration/audit.mdx` |
| "Client sent an HTTP request to an HTTPS server." for plain HTTP to the listener | Go's `net/http` server answer, from memory |

## rm and mv in French, Spanish and German

The translations of `rm` and `mv`'s messages were checked against the
Translation Project's current catalogues, downloaded in November 2026:
coreutils' [fr.po](https://translationproject.org/latest/coreutils/fr.po)
(coreutils 9.12-pre1),
[es.po](https://translationproject.org/latest/coreutils/es.po) (8.23-pre1,
the latest Spanish one) and
[de.po](https://translationproject.org/latest/coreutils/de.po) (9.11-pre1);
the system errors after the colon (`strerror`) against glibc's
[fr.po](https://translationproject.org/latest/libc/fr.po),
[es.po](https://translationproject.org/latest/libc/es.po) and
[de.po](https://translationproject.org/latest/libc/de.po).

| What | Result |
|------|--------|
| fr: "Aucun fichier ou dossier de ce nom" (capital A), "est un dossier", "Le dossier n'est pas vide", "Permission non accordée", "Périphérique ou ressource occupé" | corrected for `rm` and `mv` (the capital); the rest confirmed (libc fr.po) |
| fr: `mv -v` "'A' -> 'B' renommé", "refus de suppression des répertoires '.' ou '..' : 'X' ignoré", "'X' est ignoré car il est sur un périphérique différent" | corrected (coreutils fr.po) |
| fr: "impossible de supprimer", "impossible de déplacer … vers un sous-répertoire de lui-même", the `-i` questions ("supprimer 'X' du type fichier ?"), `--preserve-root`'s two lines | confirmed |
| es: "se rechaza borrar el directorio '.' o '..': se salta 'X'", "utilice --no-preserve-root para saltarse esta medida de seguridad", "se salta 'X', dado que está en un sistema de ficheros distinto", "no se puede mover 'A' a un directorio de sí mismo, 'B'" | corrected (coreutils es.po) |
| es: `mv -v` "renamed 'A' -> 'B'" | confirmed: the Spanish catalogue predates the message, so it stays in English |
| de: "das Entfernen von 'X' ist nicht möglich", "das Verschieben von 'A' nach 'B' ist nicht möglich", "… in ein Unterverzeichnis seiner selbst ('B') ist nicht möglich", "reguläre (leere) Datei", "überspringe 'X', da es auf einem anderen Gerät ist", `--preserve-root`'s lines ending with a full stop, "Entfernen von '.' Verzeichnis '..' nicht möglich" (the catalogue's own wording) | corrected (coreutils de.po) |
| de: "Das Verzeichnis ist nicht leer", "Ist ein Verzeichnis", "Keine Berechtigung" | corrected for the first (libc de.po); the others confirmed |
| `mv`'s "cannot overwrite non-directory … with directory …" and "cannot overwrite directory … with non-directory" in fr and de | unverifiable: these catalogues (coreutils 9.11 and later) no longer carry the messages; the earlier translations are kept |
| The game's own refusals (a place of the story, the system's places) | the game's wording, translated in the same form as the tool's "cannot remove"/"cannot move" |
| The space before the colon in French ("rm : …") | kept: the game's French typography for every command; the real `error()` prefix is "rm: " |

## Not checked against sources

These stay in the table of differences as they were: the IBM i messages
CPD2420 and CPA4067 (IBM's message files are not published as source);
the Windows items marked "uncertain" (icacls' exit code 1332,
New-NetFirewallRule's error texts, RemoteDynamicKeywordAddresses on Server
2022, the default SMB-In rule, New-ADUser's sAMAccountName, Search-ADAccount
`-AccountInactive`, GroupPolicy cmdlets' error texts, an ordering match
without an ordering rule): Windows' sources are closed and Microsoft Learn
does not show these outputs; Forgejo's API message for an unknown token;
libvirt's error for a snapshot-delete whose overlay left the chain; the
"approximate" figures of `git push`, `rsync` and `apt`, which are
simplifications rather than messages.
