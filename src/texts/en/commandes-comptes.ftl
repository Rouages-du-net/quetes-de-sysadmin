### Accounts and groups: id, groups, chgrp, chown (coreutils) and
### usermod (shadow-utils), with their LANG=C messages. { $utilisateur } and
### { $groupe } are technical identifiers, not to be translated.

# Output of id: { $uid }, { $gid } and { $groupes } look like "1000(you)"
id-line = uid={ $uid } gid={ $gid } groups={ $groupes }
id-missing = id: '{ $utilisateur }': no such user
groups-missing = groups: '{ $utilisateur }': no such user

# Shared by chgrp and chown; { $commande }: chgrp or chown
error-access-missing = { $commande }: cannot access '{ $cible }': No such file or directory
error-access-permission = { $commande }: cannot access '{ $cible }': Permission denied

chgrp-usage = Usage: chgrp [-R] group file... (see man chgrp)
chgrp-group-incorrect = chgrp: invalid group: '{ $groupe }'
chgrp-not-allowed = chgrp: changing group of '{ $cible }': Operation not permitted

chown-usage = Usage: chown [-R] owner[:group] file... (see man chown)
# { $proprio }: what was typed, e.g. "malo:equipe"
chown-user-incorrect = chown: invalid user: '{ $proprio }'
chown-group-incorrect = chown: invalid group: '{ $proprio }'
chown-not-allowed = chown: changing ownership of '{ $cible }': Operation not permitted

usermod-usage =
    Usage: usermod [options] LOGIN
    (e.g. usermod -aG group user; see man usermod)
usermod-a-without-G = usermod: -a flag is only allowed with the -G flag
usermod-permission =
    usermod: Permission denied.
    usermod: cannot lock /etc/passwd; try again later.
usermod-user-missing = usermod: user '{ $utilisateur }' does not exist
usermod-group-missing = usermod: group '{ $groupe }' does not exist
# { $date }: the date given to usermod -e
usermod-date-invalid = usermod: invalid date '{ $date }'

## userdel, gpasswd, chage (shadow-utils)

userdel-usage =
    Usage: userdel [options] LOGIN
    (e.g. userdel -r user; see man userdel)
userdel-permission =
    userdel: Permission denied.
    userdel: cannot lock /etc/passwd; try again later.
userdel-missing = userdel: user '{ $utilisateur }' does not exist
# { $pid }: the process number
userdel-used = userdel: user { $utilisateur } is currently used by process { $pid }
userdel-without-mail = userdel: { $utilisateur } mail spool (/var/mail/{ $utilisateur }) not found
gpasswd-usage =
    Usage: gpasswd [option] GROUP
    (e.g. gpasswd -d user group; see man gpasswd)
gpasswd-permission = gpasswd: Permission denied.
gpasswd-group-missing = gpasswd: group '{ $groupe }' does not exist
gpasswd-user-missing = gpasswd: user '{ $utilisateur }' does not exist
gpasswd-addition = Adding user { $utilisateur } to group { $groupe }
gpasswd-indent = Removing user { $utilisateur } from group { $groupe }
gpasswd-not-member = gpasswd: user '{ $utilisateur }' is not a member of '{ $groupe }'
chage-usage =
    Usage: chage [options] LOGIN
    (e.g. chage -l user; chage -E 0 user; see man chage)
chage-missing = chage: user '{ $utilisateur }' does not exist in /etc/passwd
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
