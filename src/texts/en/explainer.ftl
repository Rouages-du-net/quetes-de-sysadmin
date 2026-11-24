### The error explainer (src/engine/explainer.ts): a short explanation,
### offered under the output of a command that failed, which the player may
### open. It says what the message means and where to look (a manual page, a
### diagnostic command), never the chapter's answer.
###
### Each explanation's .match attribute lists the error messages it answers,
### one per line, as the game prints them in this language: * stands for any
### text, a final $ for the end of the line. The English markers are always
### read too (many tools answer in English whatever the language): a
### translation lists only the messages the game prints in its own language
### (as with LANG set to that language), or leaves .match out. A line can't
### start with [, * or . in Fluent, and braces must be avoided.

explainer-button = What does this error mean?
explainer-label = The error, explained:

explainer-sudo-password = sudo asks for your own password, the one of the account you are logged in with, not root's. Nothing appears while you type it, no stars, no dots: that is normal. After three wrong tries sudo gives up; run the command again to get a new prompt.
    .match =
        Sorry, try again.
        incorrect password attempt

explainer-sudoers = sudo knows who you are, and its policy says your account may not run this command as root on this machine: it is a rule, not a wrong password. The rules live in /etc/sudoers and the files of /etc/sudoers.d. sudo -l lists what you may run; man sudoers explains how a rule is written.
    .match =
        is not allowed to run sudo
        is not allowed to execute

explainer-ssh-denied = The SSH server answered, but it refused to let you in: the account, the key or the password didn't fit. The words in brackets are the methods it accepts (publickey, password). ssh -v shows each key ssh tries and the server's answers; on the server, the authentication log tells its side of the story.
    .match =
        Permission denied (publickey
        Permission denied, please try again

explainer-config-test = The configuration check found an error and refused the configuration. Read the line marked [emerg] (or the one before "test failed"): it names the file and the line number, as in file:12. The mistake is often on that line or just above it, a missing semicolon or closing brace. If it says Permission denied instead, the check itself needed root's rights.
    .match =
        configuration file * test failed
        emerg] *
        Syntax error on line

explainer-yaml = The YAML file could not be read. YAML is strict about indentation: spaces only, never tabs, and the items under a key must line up exactly. The message gives a line number, but the real mistake is often a line or two above it; cat -A shows tabs as ^I.
    .match =
        Syntax Error while loading YAML
        mapping values are not allowed
        did not find expected
        could not find expected

explainer-unit-not-found = systemd knows no unit with that name. Check the spelling: it is the name of the unit file, which may differ from the program's (apache2, not httpd, on Debian). systemctl list-unit-files shows the units it knows; a package that isn't installed brings no unit.
    .match =
        Unit * could not be found.
        Unit * not found.

explainer-unit-failed = systemd started the service and the program stopped with an error; the reason is not in this message. systemctl status shows the last lines of the service's log, and journalctl -u with the unit's name shows all of them. Read from the bottom up: the first real error is usually just above the lines saying the unit failed.
    .match =
        Job for * failed

explainer-db-access-denied = The database server answered, and refused this account. A MariaDB or MySQL account is a user name AND the address it comes from ('app'@'198.51.100.134'): the same name from another address is another account, or none ("is not allowed to connect"). "using password: NO" means no password was sent (-p asks for it); for root on Debian, sudo mariadb logs in through the socket without one. "command denied" means the account got in but lacks that privilege on that table. SELECT user, host, plugin FROM mysql.user and SHOW GRANTS FOR 'user'@'host' show what exists.
    .match =
        Access denied for user
        command denied to user
        is not allowed to connect to this MariaDB server

explainer-db-unreachable = The database client could not reach a server. Through the socket (no -h, or -h localhost), the server is probably not running: systemctl status mariadb, then journalctl -u mariadb for why it stopped. Over the network (-h an address), nothing listens there or a firewall is in the way: on the server, ss -tlnp shows where mariadbd listens (bind-address in its configuration), and the firewall's rules who may reach port 3306.
    .match =
        Can't connect to local server through socket
        Can't connect to server on

explainer-db-too-many = Every connection slot of the database server is taken (max_connections). Before raising the limit, look at who holds them: SHOW PROCESSLIST (as root, who keeps one extra slot) shows each connection, where it comes from and whether it sleeps. Many sleeping connections from one app usually mean the app doesn't close them; wait_timeout decides how long the server waits before closing them itself.
    .match =
        Too many connections

explainer-ups-unknown = upsd answered, but it serves no UPS by that name. A UPS's name is its section in the server's /etc/nut/ups.conf, written NAME@HOST (localhost by default): upsc -l HOST lists the names that server knows. In upsmon.conf, a MONITOR line naming a UPS that doesn't exist watches nothing: upsmon will never see it go on battery.
    .match =
        Unknown UPS
        does not exist on server

explainer-ups-denied = upsd refused this account. Each account in the server's /etc/nut/upsd.users says what it may do: instcmds (the instant commands for upscmd, or ALL), actions = SET (to change variables with upsrw), upsmon primary or secondary (for upsmon). A wrong user name or password gives the same answer. upsd rereads upsd.users when it is reloaded (systemctl reload nut-server).
    .match =
        Instant command failed: Access denied
        Set variable failed: Access denied
        Can't login to UPS

explainer-ups-driver = upsd knows this UPS, but its driver isn't running, or lost the UPS: upsd has no data to give. The driver is a service of its own on Debian (systemctl status nut-driver@NAME, journalctl -u nut-driver@NAME), started from the UPS's section in /etc/nut/ups.conf; check the USB cable too.
    .match =
        Driver not connected
        Data stale

explainer-db-syntax = The database server could not read the SQL statement. The text after "near" is where it stopped understanding: the mistake is just before it, often a missing comma or quote, a word misspelt, or a statement this server doesn't know. A statement typed in the shell between double quotes keeps its single quotes intact: mariadb -e "SELECT … WHERE name = 'x'".
    .match =
        You have an error in your SQL syntax

explainer-db-read-only = The database server is read-only (its read_only variable is on): it refuses writes from ordinary accounts. On a replica that is on purpose: writes go to the primary, and the replica receives them. SELECT @@read_only shows the setting; connect to the primary to write.
    .match =
        running with the --read-only option

explainer-sieve-compile = The Sieve script could not be compiled, so it can't run. The message gives the script's line and the first problem only: an unknown command is often a typo, or an extension used without being required at the top (require ["fileinto", "vacation"];); "expected end of command ';'" means a semicolon is missing at the end of the line before. Fix it, then compile again with sievec before activating the script.
    .match =
        error: validation failed
        error: parse failed
        Compilation failed

explainer-dovecot-config = Dovecot can't read its configuration: the file and the line are in the message. "Unknown setting" is a misspelled setting (or one from another Dovecot version: 2.4 renamed many), "Missing '{"}"}'" a section left open. As long as the file is wrong, doveadm and doveconf stop, and a reload keeps the old configuration. doveconf -n reads it again once fixed.
    .match =
        Error in configuration file

explainer-mail-unknown-user = The user isn't in Dovecot's userdb. Dovecot's users are what its userdb returns (here a passwd-file), not the machine's accounts, and the name is usually the whole address: user@domain. doveadm user '*' lists the users Dovecot knows.
    .match =
        User doesn't exist

explainer-search-query = doveadm didn't understand the search query. Each key takes its value just after it (mailbox Trash, savedbefore 2031-01-01, larger 5M); a date is YYYY-MM-DD or an interval such as 30d or 2w (there is no year unit); OR goes between two keys, and parentheses must be escaped from the shell. man doveadm-search-query lists the keys.
    .match =
        Invalid search date parameter
        Fatal: *Unknown argument
        Fatal: *Missing argument

explainer-refused = The machine answered, but nothing accepted the connection on that port: no program listens there, or a firewall actively rejects it. On the server, ss -tlnp lists the ports where programs listen, and systemctl status says whether the service runs. Check the address and the port you used, too.
    .match =
        Connection refused
        after 0 ms: Couldn't connect to server

explainer-timed-out = No answer came back before the tool gave up. The packets were probably dropped on the way, often by a firewall that drops instead of rejecting, or the machine is down, or the address is wrong. Compare with "Connection refused", which means the machine did answer.
    .match =
        Connection timed out
        Request timed out.
        (tcp) timed out
        ms: Couldn't connect to server

explainer-no-route = Your machine found no way to reach that address: no route leads there, or a router or the far side's firewall answered that it is unreachable. ip route shows where your machine sends its packets; check the address itself too.
    .match =
        No route to host
        Network is unreachable
        Destination Host Unreachable

explainer-resolve = The name could not be turned into an address: it is a DNS problem (or one in /etc/hosts), not a problem with the server itself. Check the spelling first; then dig or host shows what DNS answers for the name, and /etc/resolv.conf which server your machine asks.
    .match =
        Could not resolve host
        Name or service not known
        Temporary failure in name resolution

explainer-address-in-use = The program wanted to listen on a port another program already holds: only one program at a time can listen on an address and port. ss -tlnp shows which program has it. Two services set up on the same port, or an old copy still running, are the usual causes.
    .match =
        Address already in use

explainer-read-only = This file system is mounted read-only: nobody can write to it, not even root, whatever the rights. mount or findmnt shows the ro option. The system sometimes remounts a disk read-only by itself after serious errors, so dmesg and the journal are worth reading first.
    .match =
        Read-only file system

explainer-no-space = The storage that holds this file is full, or it has no inode left (one per file). df -h shows the free space of each file system and df -i its inodes; du helps find what takes the room. A deleted file that a program still holds open keeps its space until the program closes it (lsof).
    .match =
        No space left on device

explainer-syntax = The shell could not read the line, so nothing ran: a character that means something to it is in a place where it doesn't fit (a |, a ;, a parenthesis, a word like then or done), or a quote or a block was left open. Look at the token the message names, and check that each quote is closed. man bash, section SHELL GRAMMAR, gives the rules.
    .match =
        syntax error near unexpected token
        syntax error: unexpected end of file
        : Syntax error:
        syntax error at line

explainer-ps-not-recognized = PowerShell (or cmd.exe) found no cmdlet, function or program with that name. Check the spelling: cmdlets are named Verb-Noun, like Get-Service, and a script in the current folder runs with .\ in front of its name. Get-Command lists the commands this machine knows; some come from a module that only certain machines have.
    .match =
        is not recognized as the name of a cmdlet
        is not recognized as an internal or external command

explainer-not-found = The shell found no program with that name. Check the spelling and the case (ls, not LS). The program may not be installed on this machine, or not open yet in this chapter: help lists the commands you have, and man -k searches the manual by keyword.
    .match =
        command not found
        : not found$
        you don't have this command yet

explainer-access-denied = Windows refused the access: your account has no permission on that file, folder, key or service. For a share, the share's permissions and the NTFS permissions both apply, and the stricter one wins. Get-Acl (or icacls) shows who may do what, and whoami /groups the groups your account brings.
    .match =
        Access is denied
        Access to the path * is denied
        UnauthorizedAccess

explainer-permission = The system refused: your account lacks the right this needs on that file or folder (r to read, w to write, x to enter a folder or run a program). ls -l shows the owner, the group and the rights for each of them and for the others, and every folder on the way must let you through. Some files belong to root on purpose: read the rights before reaching for sudo.
    .match =
        Permission denied

explainer-not-permitted = The operation itself is not allowed for your account, whatever the rights: only a file's owner (or root) may change its rights or its owner, and only root may send a signal to another account's processes. Even root gets this message on a file made immutable: lsattr shows the i flag. man chmod, man kill and man chattr explain each case.
    .match =
        Operation not permitted

explainer-not-directory = A part of the path you gave is a file, not a folder: nothing can be inside it, and cd can't enter it. ls -l tells them apart: a folder's line starts with d. Check the path one part at a time.
    .match =
        Not a directory

explainer-is-directory = The command expected a file and was given a folder. ls shows what a folder contains; cat, nano and a redirection (>) work on files only. Removing or copying a whole folder takes an option: see man rm and man cp.
    .match =
        Is a directory

explainer-no-such-file = Nothing exists at that path, as it was spelled. A path that doesn't start with / is relative: it starts from the current folder, which pwd shows; one that starts with / starts from the root. Names are case-sensitive (Notes is not notes), and Tab only completes a name that exists: a good test.
    .match =
        No such file or directory

## The setting, next to Tips and Autosave.
display-explainer = Error help
display-explainer-title = Offer a short explanation under common error messages

explainer-s3-date = The object store refused the request because of its date. Every S3 request is signed with the date and time of the machine that sends it: Amazon S3 refuses one more than 15 minutes away from its own clock (RequestTimeTooSkewed), Garage one dated more than 24 hours before its clock ("Date is too old"); a presigned URL is refused once its X-Amz-Expires has passed. The server isn't the problem: date and timedatectl show this machine's clock, and whether NTP keeps it right.
    .match =
        Date is too old
        RequestTimeTooSkewed

explainer-s3-region = The request was signed for another region than the store's. The region is part of the signature (its scope: date/region/s3/aws4_request), so a wrong one makes the signature invalid even with the right key. The message names the scope the server expected: put that region in the client's configuration (region in ~/.aws/config or rclone.conf, or --region).
    .match =
        AuthorizationHeaderMalformed
        unexpected scope

explainer-s3-access-denied = The object store knows the key (or refused a request without one) and won't let it do this. "Operation is not allowed for this key" means the key lacks the permission on that bucket (read to list and get, write to put and delete, owner for the bucket's settings); "No such key" an access key ID it doesn't know; "Invalid signature" a wrong secret; "anonymous access" a request sent without a key. With Garage, sudo garage bucket info BUCKET shows each key's permissions; aws configure list shows which key the client uses.
    .match =
        Operation is not allowed for this key
        Garage does not support anonymous access yet
        Invalid signature
        No such key: 

explainer-s3-no-bucket = No bucket has that name for this store. Check the spelling (bucket names are lower case), and that the client talks to the right endpoint (--endpoint-url, endpoint_url in ~/.aws/config, endpoint in rclone.conf): another store has other buckets. aws s3 ls lists the buckets this key may use; with Garage, sudo garage bucket list lists them all.
    .match =
        NoSuchBucket

explainer-s3-credentials = The AWS command-line tool found no key to sign with. It looks on the command line (--profile), in the environment (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, AWS_PROFILE), then in ~/.aws/credentials and ~/.aws/config, in the home of the user who runs it: under sudo that is root's home, not yours. aws configure list shows what it found, and where.
    .match =
        Unable to locate credentials
        The config profile (*) could not be found

explainer-garage-layout = Garage didn't apply the layout change. A layout is changed in two steps: changes are staged (garage layout assign, remove), then applied with garage layout apply --version N, N being the next version that garage layout show prints, so that nobody applies a layout they haven't read. A layout must also keep at least as many nodes with a capacity as the replication factor.
    .match =
        Please pass the new layout version number
        Invalid new layout version
        is smaller than the replication factor

explainer-firewalld-auth = firewall-cmd may read firewalld's configuration as any user, but changing it needs root: over ssh no polkit agent can ask for a password. Run the command with sudo.
    .match =
        Authorization failed.

explainer-firewalld-not-running = The firewalld daemon is not running, so firewall-cmd has nobody to talk to (and nothing filters). systemctl status firewalld says why; systemctl enable --now firewalld starts it and keeps it at boot.
    .match =
        FirewallD is not running

explainer-dnf-root = Installing or removing packages changes the system: dnf needs root. Run it again with sudo (searching, info and list work without).
    .match =
        This command has to be run with superuser privileges

explainer-httpd-bind = httpd could not open a socket. With (98) Address already in use, another program listens on that port (ss -tlnp). With (13) Permission denied and nothing else there, on a system with SELinux, httpd_t may only bind the ports typed http_port_t: look for an AVC (ausearch -m avc), and give the port that type with semanage port -a -t http_port_t -p tcp PORT. While one socket fails, httpd doesn't start at all.
    .match =
        make_sock: could not bind to address

explainer-selinux-denied = "Permission denied" although the Unix rights allow it: on a system with SELinux, the kernel may refuse what the file's label doesn't allow to the program's domain. Compare the labels (ls -Z, ps -Z), read the denials (sudo ausearch -m avc -ts recent | audit2why), and fix the label in the policy (semanage fcontext, then restorecon) rather than switching SELinux off.
    .match =
        file permissions deny server access
        because search permissions are missing on a component of the path
explainer-tofu-lock = OpenTofu couldn't lock the state: another run holds the lock, and OpenTofu waits for nobody. Lock Info says who took it, for which operation and when. With a local state (terraform.tfstate), the lock belongs to that process: check whether it still runs (ps), and let it finish or stop it; tofu force-unlock only helps with remote states, and -lock=false risks two runs writing the state at once.
    .match =
        Error acquiring the state lock

explainer-tofu-init = This working directory isn't initialised, or no longer matches its configuration: the provider it needs isn't installed or recorded in .terraform.lock.hcl. tofu init installs the providers and writes the lock file; after a change of version constraint, tofu init -upgrade.
    .match =
        Inconsistent dependency lock file
        Missing required provider
        Required plugins are not installed

explainer-tofu-variable = A variable is declared (a variable block) but nothing gives it a value: no default, no .tfvars file, no -var. A value given with -var only lasts for that command; terraform.tfvars and *.auto.tfvars files are read every time, and TF_VAR_name variables of the environment too.
    .match =
        No value for required variable

explainer-tofu-argument = The configuration doesn't match the provider's schema: an argument it doesn't know (often a typo, OpenTofu then suggests the right name), a required one missing, or a block in the wrong place. The message gives the file and the line; tofu validate checks everything without touching anything, and the provider's documentation lists each resource's arguments.
    .match =
        Unsupported argument
        Missing required argument
        Unsupported block type
        Invalid resource type
explainer-podman-subids = Rootless Podman builds a user namespace for the account: inside, 0 is the account itself and 1, 2, 3… are its subordinate ids, read from /etc/subuid and /etc/subgid (ACCOUNT:FIRST:COUNT). An account without a range gets a namespace of one id, and no image whose files belong to other ids can be unpacked in it. Look at both files (man subuid); usermod --add-subuids and --add-subgids add a range. Podman keeps the account's namespace: after changing the files, podman system migrate rebuilds it.
    .match =
        cannot find UID/GID for user
        potentially insufficient UIDs or GIDs

explainer-privileged-port = A program that isn't root can't listen on a port below net.ipv4.ip_unprivileged_port_start (1024 by default): with rootless Podman, the program that publishes the port (pasta, or rootlessport) runs as your account. Publish a port from 1024 up and leave 80 and 443 to a reverse proxy (nginx, Caddy) that forwards to it. Lowering the sysctl opens these ports to every account's programs, not just yours.
    .match =
        (Permission denied) for option '-t
        cannot expose privileged port

explainer-user-bus = systemctl --user (and journalctl --user) talk to your account's own service manager through its bus, which they find with $XDG_RUNTIME_DIR (/run/user/UID). A login sets it (pam_systemd); sudo, su and cron don't. The manager must also be running: it starts with the account's first session, or at boot if the account lingers (loginctl enable-linger). From root, systemctl --user -M ACCOUNT@ reaches another account's manager.
    .match =
        XDG_RUNTIME_DIR not defined
        Failed to connect to user scope bus
explainer-apparmor-root = Reading or changing AppArmor's policy is root's business: the profiles loaded in the kernel, which processes they confine, loading or removing one. Run the command with sudo. (aa-status --enabled alone works without it.)
    .match =
        You do not have enough privilege to read the profile set
        attempted to load a profile while confined
        ERROR: [Errno 13] Permission denied:

explainer-apparmor-parser = apparmor_parser couldn't read the profile, so it loaded nothing: the kernel keeps the version it had. The message names the file and the line ("in profile" gives the file the error is in, an included one perhaps); every rule ends with a comma, and a missing comma is reported on the next line. A file of local/ or abstractions/ is not a profile: load the profile that includes it. man apparmor.d gives the syntax; apparmor_parser -Q checks a file without loading it.
    .match =
        AppArmor parser error for
