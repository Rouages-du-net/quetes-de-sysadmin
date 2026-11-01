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
       *[autre] { $expire }
    }
    Minimum number of days between password change		: 0
    Maximum number of days between password change		: 99999
    Number of days of warning before password expires	: 7
