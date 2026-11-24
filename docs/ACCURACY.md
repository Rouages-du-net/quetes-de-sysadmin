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
