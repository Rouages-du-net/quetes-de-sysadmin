### Comptes et groupes : id, groups, chgrp, chown (coreutils en français) et
### usermod (shadow-utils en français). { $utilisateur } et { $groupe } sont
### des identifiants techniques, à ne pas traduire.

# Sortie de id : { $uid }, { $gid } et { $groupes } ont la forme « 1000(vous) »
id-ligne = uid={ $uid } gid={ $gid } groupes={ $groupes }
id-inexistant = id : '{ $utilisateur }' : utilisateur inexistant
groups-inexistant = groups : '{ $utilisateur }' : utilisateur inexistant

# Communs à chgrp et chown ; { $commande } : chgrp ou chown
erreur-acces-introuvable = { $commande } : impossible d'accéder à '{ $cible }' : aucun fichier ou dossier de ce nom
erreur-acces-permission = { $commande } : impossible d'accéder à '{ $cible }' : Permission non accordée

chgrp-usage = Usage : chgrp [-R] groupe fichier... (voir man chgrp)
chgrp-groupe-incorrect = chgrp : groupe incorrect : « { $groupe } »
chgrp-non-permise = chgrp : modification du groupe de '{ $cible }' : Opération non permise

chown-usage = Usage : chown [-R] propriétaire[:groupe] fichier... (voir man chown)
# { $proprio } : ce qui a été tapé, ex. « malo:equipe »
chown-utilisateur-incorrect = chown : utilisateur incorrect : « { $proprio } »
chown-groupe-incorrect = chown : groupe incorrect : « { $proprio } »
chown-non-permise = chown : modification du propriétaire de '{ $cible }' : Opération non permise

usermod-usage =
    Usage : usermod [options] IDENTIFIANT
    (ex. : usermod -aG groupe utilisateur ; voir man usermod)
usermod-a-sans-G = usermod : l'option -a n'est autorisée qu'avec l'option -G
usermod-permission =
    usermod : Permission non accordée.
    usermod : impossible de verrouiller /etc/passwd ; réessayez plus tard.
usermod-utilisateur-inexistant = usermod : l'utilisateur « { $utilisateur } » n'existe pas
usermod-groupe-inexistant = usermod : le groupe « { $groupe } » n'existe pas
