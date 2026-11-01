### Comptes et groupes : id, groups, chgrp, chown (coreutils en français) et
### usermod (shadow-utils en français). { $utilisateur } et { $groupe } sont
### des identifiants techniques, à ne pas traduire.

# Sortie de id : { $uid }, { $gid } et { $groupes } ont la forme « 1000(vous) »
id-line = uid={ $uid } gid={ $gid } groupes={ $groupes }
id-missing = id : '{ $utilisateur }' : utilisateur inexistant
groups-missing = groups : '{ $utilisateur }' : utilisateur inexistant

# Communs à chgrp et chown ; { $commande } : chgrp ou chown
error-access-missing = { $commande } : impossible d'accéder à '{ $cible }' : aucun fichier ou dossier de ce nom
error-access-permission = { $commande } : impossible d'accéder à '{ $cible }' : Permission non accordée

chgrp-usage = Usage : chgrp [-R] groupe fichier... (voir man chgrp)
chgrp-group-incorrect = chgrp : groupe incorrect : « { $groupe } »
chgrp-not-allowed = chgrp : modification du groupe de '{ $cible }' : Opération non permise

chown-usage = Usage : chown [-R] propriétaire[:groupe] fichier... (voir man chown)
# { $proprio } : ce qui a été tapé, ex. « malo:equipe »
chown-user-incorrect = chown : utilisateur incorrect : « { $proprio } »
chown-group-incorrect = chown : groupe incorrect : « { $proprio } »
chown-not-allowed = chown : modification du propriétaire de '{ $cible }' : Opération non permise

usermod-usage =
    Usage : usermod [options] IDENTIFIANT
    (ex. : usermod -aG groupe utilisateur ; voir man usermod)
usermod-a-without-G = usermod : l'option -a n'est autorisée qu'avec l'option -G
usermod-permission =
    usermod : Permission non accordée.
    usermod : impossible de verrouiller /etc/passwd ; réessayez plus tard.
usermod-user-missing = usermod : l'utilisateur « { $utilisateur } » n'existe pas
usermod-group-missing = usermod : le groupe « { $groupe } » n'existe pas
# { $date } : la date donnée à usermod -e
usermod-date-invalid = usermod : date « { $date } » non valable

## userdel, gpasswd, chage (shadow-utils en français)

userdel-usage =
    Usage : userdel [options] IDENTIFIANT
    (ex. : userdel -r utilisateur ; voir man userdel)
userdel-permission =
    userdel : Permission non accordée.
    userdel : impossible de verrouiller /etc/passwd ; réessayez plus tard.
userdel-missing = userdel : l'utilisateur « { $utilisateur } » n'existe pas
# { $pid } : le numéro du processus
userdel-used = userdel : l'utilisateur { $utilisateur } est actuellement utilisé par le processus { $pid }
userdel-without-mail = userdel : boîte aux lettres de { $utilisateur } (/var/mail/{ $utilisateur }) non trouvée
gpasswd-usage =
    Usage : gpasswd [option] GROUPE
    (ex. : gpasswd -d utilisateur groupe ; voir man gpasswd)
gpasswd-permission = gpasswd : Permission non accordée.
gpasswd-group-missing = gpasswd : le groupe « { $groupe } » n'existe pas
gpasswd-user-missing = gpasswd : l'utilisateur « { $utilisateur } » n'existe pas
gpasswd-addition = Ajout de l'utilisateur { $utilisateur } au groupe { $groupe }
gpasswd-indent = Retrait de l'utilisateur { $utilisateur } du groupe { $groupe }
gpasswd-not-member = gpasswd : l'utilisateur « { $utilisateur } » n'est pas membre de « { $groupe } »
chage-usage =
    Usage : chage [options] IDENTIFIANT
    (ex. : chage -l utilisateur ; chage -E 0 utilisateur ; voir man chage)
chage-missing = chage : l'utilisateur « { $utilisateur } » n'existe pas
chage-permission = chage : Permission non accordée.
chage-date-invalid = chage : date « { $date } » non valable
# { $expire } : la fin de validité du compte (AAAA-MM-JJ), ou never
chage-list =
    Dernier changement de mot de passe					: 2027-03-14
    Fin de validité du mot de passe					: jamais
    Mot de passe désactivé						: jamais
    Fin de validité du compte					: { $expire ->
        [never] jamais
       *[autre] { $expire }
    }
    Nombre minimum de jours entre les changements de mot de passe		: 0
    Nombre maximum de jours entre les changements de mot de passe		: 99999
    Nombre de jours d'avertissement avant la fin de validité du mot de passe	: 7
