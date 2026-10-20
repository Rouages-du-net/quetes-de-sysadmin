### Accounts and groups: id, groups, chgrp, chown (coreutils) and
### usermod (shadow-utils), with their LANG=C messages. { $utilisateur } and
### { $groupe } are technical identifiers, not to be translated.

# Output of id: { $uid }, { $gid } and { $groupes } look like "1000(you)"
id-ligne = uid={ $uid } gid={ $gid } groups={ $groupes }
id-inexistant = id: '{ $utilisateur }': no such user
groups-inexistant = groups: '{ $utilisateur }': no such user

# Shared by chgrp and chown; { $commande }: chgrp or chown
erreur-acces-introuvable = { $commande }: cannot access '{ $cible }': No such file or directory
erreur-acces-permission = { $commande }: cannot access '{ $cible }': Permission denied

chgrp-usage = Usage: chgrp [-R] group file... (see man chgrp)
chgrp-groupe-incorrect = chgrp: invalid group: '{ $groupe }'
chgrp-non-permise = chgrp: changing group of '{ $cible }': Operation not permitted

chown-usage = Usage: chown [-R] owner[:group] file... (see man chown)
# { $proprio }: what was typed, e.g. "malo:equipe"
chown-utilisateur-incorrect = chown: invalid user: '{ $proprio }'
chown-groupe-incorrect = chown: invalid group: '{ $proprio }'
chown-non-permise = chown: changing ownership of '{ $cible }': Operation not permitted

usermod-usage =
    Usage: usermod [options] LOGIN
    (e.g. usermod -aG group user; see man usermod)
usermod-a-sans-G = usermod: -a flag is only allowed with the -G flag
usermod-permission =
    usermod: Permission denied.
    usermod: cannot lock /etc/passwd; try again later.
usermod-utilisateur-inexistant = usermod: user '{ $utilisateur }' does not exist
usermod-groupe-inexistant = usermod: group '{ $groupe }' does not exist
# { $date }: the date given to usermod -e
usermod-date-invalide = usermod: invalid date '{ $date }'

## userdel, gpasswd, chage (shadow-utils)

userdel-usage =
    Usage: userdel [options] LOGIN
    (e.g. userdel -r user; see man userdel)
userdel-permission =
    userdel: Permission denied.
    userdel: cannot lock /etc/passwd; try again later.
userdel-inexistant = userdel: user '{ $utilisateur }' does not exist
# { $pid }: the process number
userdel-utilise = userdel: user { $utilisateur } is currently used by process { $pid }
userdel-sans-courrier = userdel: { $utilisateur } mail spool (/var/mail/{ $utilisateur }) not found
gpasswd-usage =
    Usage: gpasswd [option] GROUP
    (e.g. gpasswd -d user group; see man gpasswd)
gpasswd-permission = gpasswd: Permission denied.
gpasswd-groupe-inexistant = gpasswd: group '{ $groupe }' does not exist
gpasswd-utilisateur-inexistant = gpasswd: user '{ $utilisateur }' does not exist
gpasswd-ajout = Adding user { $utilisateur } to group { $groupe }
gpasswd-retrait = Removing user { $utilisateur } from group { $groupe }
gpasswd-pas-membre = gpasswd: user '{ $utilisateur }' is not a member of '{ $groupe }'
chage-usage =
    Usage: chage [options] LOGIN
    (e.g. chage -l user; chage -E 0 user; see man chage)
chage-inexistant = chage: user '{ $utilisateur }' does not exist in /etc/passwd
chage-permission = chage: Permission denied.
chage-date-invalide = chage: invalid date '{ $date }'
# { $expire }: the account expiry date (YYYY-MM-DD), or never
chage-liste =
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
