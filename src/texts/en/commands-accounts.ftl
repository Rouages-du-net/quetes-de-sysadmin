### Accounts and groups: id, groups, chgrp, chown (coreutils) and
### usermod (shadow-utils), with their LANG=C messages. { $user } and
### { $group } are technical identifiers, not to be translated.

# Output of id: { $uid }, { $gid } and { $groups } look like "1000(you)"
id-line = uid={ $uid } gid={ $gid } groups={ $groups }
id-missing = id: '{ $user }': no such user
groups-missing = groups: '{ $user }': no such user

# Shared by chgrp and chown; { $command }: chgrp or chown
error-access-missing = { $command }: cannot access '{ $target }': No such file or directory
error-access-permission = { $command }: cannot access '{ $target }': Permission denied

chgrp-usage = Usage: chgrp [-R] group file... (see man chgrp)
chgrp-group-incorrect = chgrp: invalid group: '{ $group }'
chgrp-not-allowed = chgrp: changing group of '{ $target }': Operation not permitted

chown-usage = Usage: chown [-R] owner[:group] file... (see man chown)
# { $owner }: what was typed, e.g. "malo:equipe"
chown-user-incorrect = chown: invalid user: '{ $owner }'
chown-group-incorrect = chown: invalid group: '{ $owner }'
chown-not-allowed = chown: changing ownership of '{ $target }': Operation not permitted

usermod-usage =
    Usage: usermod [options] LOGIN
    (e.g. usermod -aG group user; see man usermod)
usermod-a-without-G = usermod: -a flag is only allowed with the -G flag
usermod-permission =
    usermod: Permission denied.
    usermod: cannot lock /etc/passwd; try again later.
usermod-user-missing = usermod: user '{ $user }' does not exist
usermod-group-missing = usermod: group '{ $group }' does not exist
# { $date }: the date given to usermod -e
usermod-date-invalid = usermod: invalid date '{ $date }'
usermod-uid-invalid = usermod: invalid user ID '{ $uid }'
usermod-uid-exists = usermod: UID '{ $uid }' already exists
usermod-used = usermod: user { $user } is currently used by process { $pid }
# { $range }: what was given to -v/-w (FIRST-LAST)
usermod-subuid-invalid = usermod: invalid subordinate uid range '{ $range }'
usermod-subgid-invalid = usermod: invalid subordinate gid range '{ $range }'

## userdel, gpasswd, chage (shadow-utils)

userdel-usage =
    Usage: userdel [options] LOGIN
    (e.g. userdel -r user; see man userdel)
userdel-permission =
    userdel: Permission denied.
    userdel: cannot lock /etc/passwd; try again later.
userdel-missing = userdel: user '{ $user }' does not exist
# { $pid }: the process number
userdel-used = userdel: user { $user } is currently used by process { $pid }
userdel-without-mail = userdel: { $user } mail spool (/var/mail/{ $user }) not found
gpasswd-usage =
    Usage: gpasswd [option] GROUP
    (e.g. gpasswd -d user group; see man gpasswd)
gpasswd-permission = gpasswd: Permission denied.
gpasswd-group-missing = gpasswd: group '{ $group }' does not exist
gpasswd-user-missing = gpasswd: user '{ $user }' does not exist
gpasswd-addition = Adding user { $user } to group { $group }
gpasswd-indent = Removing user { $user } from group { $group }
gpasswd-not-member = gpasswd: user '{ $user }' is not a member of '{ $group }'
chage-usage =
    Usage: chage [options] LOGIN
    (e.g. chage -l user; chage -E 0 user; see man chage)
chage-missing = chage: user '{ $user }' does not exist in /etc/passwd
chage-permission = chage: Permission denied.
chage-date-invalid = chage: invalid date '{ $date }'
# { $expire }: the account expiry date (YYYY-MM-DD), or never
chage-list =
    Last password change					: 2027-03-14
    Password expires					: never
    Password inactive					: never
    Account expires						: { $expire ->
        [never] never
       *[other] { $expire }
    }
    Minimum number of days between password change		: 0
    Maximum number of days between password change		: 99999
    Number of days of warning before password expires	: 7

## useradd, passwd (shadow-utils and PAM), adduser (Debian)

useradd-usage =
    Usage: useradd [options] LOGIN
    (e.g. useradd -m -s /bin/bash -G group account; see man useradd)
useradd-permission =
    useradd: Permission denied.
    useradd: cannot lock /etc/passwd; try again later.
useradd-exists = useradd: user '{ $user }' already exists
useradd-group-missing = useradd: group '{ $group }' does not exist
useradd-group-exists = useradd: group { $group } exists - if you want to add this user to that group, use -g.
useradd-bad-name = useradd: invalid user name '{ $user }': use --badname to ignore
useradd-uid-invalid = useradd: invalid user ID '{ $uid }'
useradd-uid-exists = useradd: UID { $uid } is not unique
# { $home }: the home directory that was already there
useradd-home-exists =
    useradd: warning: the home directory { $home } already exists.
    useradd: Not copying any file from skel directory into it.
passwd-usage =
    Usage: passwd [options] [LOGIN]
    (e.g. passwd; sudo passwd account; passwd -S; sudo passwd -l account; see man passwd)
passwd-changing = Changing password for { $user }.
passwd-current = Current password:{" "}
passwd-new = New password:{" "}
passwd-retype = Retype new password:{" "}
passwd-updated = passwd: password updated successfully
passwd-mismatch = Sorry, passwords do not match.
passwd-none-supplied = No password has been supplied.
passwd-unchanged-same = Password unchanged
passwd-too-short = You must choose a longer password.
passwd-token-error =
    passwd: Authentication token manipulation error
    passwd: password unchanged
passwd-not-allowed = passwd: You may not view or modify password information for { $user }.
passwd-permission = passwd: Permission denied.
passwd-unknown-user = passwd: user '{ $user }' does not exist
passwd-changed = passwd: password changed.
passwd-expiry-changed = passwd: password expiry information changed.
passwd-unlock-empty =
    passwd: unlocking the password would result in a passwordless account.
    You should set a password with usermod -p to unlock this user's password.
adduser-usage =
    adduser [--uid id] [--ingroup group] [--shell shell] [--disabled-password] [--comment comment] [--home dir] user
    adduser user group
    (see man adduser)
adduser-only-root = fatal: Only root may add a user or group to the system.
adduser-exists = fatal: The user `{ $user }' already exists.
adduser-user-missing = fatal: The user `{ $user }' does not exist.
adduser-group-missing = fatal: The group `{ $group }' does not exist.
adduser-bad-name =
    fatal: Please enter a username matching the regular expression
    configured via the NAME_REGEX configuration variable.  Use the `--allow-bad-names' option to relax this check or reconfigure NAME_REGEX
    in configuration.
adduser-adding-user = info: Adding user `{ $user }' ...
# { $from } and { $to }: the range of ids adduser picks from
adduser-selecting = info: Selecting UID/GID from range { $from } to { $to } ...
adduser-adding-group = info: Adding new group `{ $group }' ({ $gid }) ...
adduser-adding-new-user = info: Adding new user `{ $user }' ({ $uid }) with group `{ $group } ({ $gid })' ...
adduser-creating-home = info: Creating home directory `{ $home }' ...
adduser-copying = info: Copying files from `/etc/skel' ...
adduser-changing-info = Changing the user information for { $user }
adduser-enter-value = Enter the new value, or press ENTER for the default
adduser-full-name = Full Name
adduser-room = Room Number
adduser-work-phone = Work Phone
adduser-home-phone = Home Phone
adduser-other = Other
adduser-correct = Is the information correct? [Y/n]{" "}
adduser-try-again = Try again? [y/N]{" "}
adduser-extra-groups = info: Adding new user `{ $user }' to supplemental / extra groups `users' ...
adduser-adding-to-group = info: Adding user `{ $user }' to group `{ $group }' ...
adduser-already-member = info: The user `{ $user }' is already a member of `{ $group }'.
