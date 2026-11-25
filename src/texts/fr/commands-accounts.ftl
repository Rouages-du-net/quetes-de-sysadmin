### Comptes et groupes : id, groups, chgrp, chown (coreutils en français) et
### usermod (shadow-utils en français). { $user } et { $group } sont
### des identifiants techniques, à ne pas traduire.

# Sortie de id : { $uid }, { $gid } et { $groups } ont la forme « 1000(vous) »
id-line = uid={ $uid } gid={ $gid } groupes={ $groups }
id-missing = id : '{ $user }' : utilisateur inexistant
groups-missing = groups : '{ $user }' : utilisateur inexistant

# Communs à chgrp et chown ; { $command } : chgrp ou chown
error-access-missing = { $command } : impossible d'accéder à '{ $target }' : aucun fichier ou dossier de ce nom
error-access-permission = { $command } : impossible d'accéder à '{ $target }' : Permission non accordée

chgrp-usage = Usage : chgrp [-R] groupe fichier... (voir man chgrp)
chgrp-group-incorrect = chgrp : groupe incorrect : « { $group } »
chgrp-not-allowed = chgrp : modification du groupe de '{ $target }' : Opération non permise

chown-usage = Usage : chown [-R] propriétaire[:groupe] fichier... (voir man chown)
# { $owner } : ce qui a été tapé, ex. « malo:equipe »
chown-user-incorrect = chown : utilisateur incorrect : « { $owner } »
chown-group-incorrect = chown : groupe incorrect : « { $owner } »
chown-not-allowed = chown : modification du propriétaire de '{ $target }' : Opération non permise

usermod-usage =
    Usage : usermod [options] IDENTIFIANT
    (ex. : usermod -aG groupe utilisateur ; voir man usermod)
usermod-a-without-G = usermod : l'option -a n'est autorisée qu'avec l'option -G
usermod-permission =
    usermod : Permission non accordée.
    usermod : impossible de verrouiller /etc/passwd ; réessayez plus tard.
usermod-user-missing = usermod : l'utilisateur « { $user } » n'existe pas
usermod-group-missing = usermod : le groupe « { $group } » n'existe pas
# { $date } : la date donnée à usermod -e
usermod-date-invalid = usermod : date « { $date } » non valable
usermod-uid-invalid = usermod : identifiant d'utilisateur « { $uid } » non valable
usermod-uid-exists = usermod : l'UID « { $uid } » existe déjà
usermod-used = usermod : l'utilisateur { $user } est actuellement utilisé par le processus { $pid }
# { $range }: what was given to -v/-w (FIRST-LAST)
usermod-subuid-invalid = usermod : plage d'UID subordonnés « { $range } » non valable
usermod-subgid-invalid = usermod : plage de GID subordonnés « { $range } » non valable

## userdel, gpasswd, chage (shadow-utils en français)

userdel-usage =
    Usage : userdel [options] IDENTIFIANT
    (ex. : userdel -r utilisateur ; voir man userdel)
userdel-permission =
    userdel : Permission non accordée.
    userdel : impossible de verrouiller /etc/passwd ; réessayez plus tard.
userdel-missing = userdel : l'utilisateur « { $user } » n'existe pas
# { $pid } : le numéro du processus
userdel-used = userdel : l'utilisateur { $user } est actuellement utilisé par le processus { $pid }
userdel-without-mail = userdel : boîte aux lettres de { $user } (/var/mail/{ $user }) non trouvée
gpasswd-usage =
    Usage : gpasswd [option] GROUPE
    (ex. : gpasswd -d utilisateur groupe ; voir man gpasswd)
gpasswd-permission = gpasswd : Permission non accordée.
gpasswd-group-missing = gpasswd : le groupe « { $group } » n'existe pas
gpasswd-user-missing = gpasswd : l'utilisateur « { $user } » n'existe pas
gpasswd-addition = Ajout de l'utilisateur { $user } au groupe { $group }
gpasswd-indent = Retrait de l'utilisateur { $user } du groupe { $group }
gpasswd-not-member = gpasswd : l'utilisateur « { $user } » n'est pas membre de « { $group } »
chage-usage =
    Usage : chage [options] IDENTIFIANT
    (ex. : chage -l utilisateur ; chage -E 0 utilisateur ; voir man chage)
chage-missing = chage : l'utilisateur « { $user } » n'existe pas
chage-permission = chage : Permission non accordée.
chage-date-invalid = chage : date « { $date } » non valable
# { $expire } : la fin de validité du compte (AAAA-MM-JJ), ou never
chage-list =
    Dernier changement de mot de passe					: 2027-03-14
    Fin de validité du mot de passe					: jamais
    Mot de passe désactivé						: jamais
    Fin de validité du compte					: { $expire ->
        [never] jamais
       *[other] { $expire }
    }
    Nombre minimum de jours entre les changements de mot de passe		: 0
    Nombre maximum de jours entre les changements de mot de passe		: 99999
    Nombre de jours d'avertissement avant la fin de validité du mot de passe	: 7

## useradd, passwd (shadow-utils et PAM en français), adduser (Debian)

useradd-usage =
    Usage : useradd [options] IDENTIFIANT
    (ex. : useradd -m -s /bin/bash -G groupe compte ; voir man useradd)
useradd-permission =
    useradd : Permission non accordée.
    useradd : impossible de verrouiller /etc/passwd ; réessayez plus tard.
useradd-exists = useradd : l'utilisateur « { $user } » existe déjà
useradd-group-missing = useradd : le groupe « { $group } » n'existe pas
useradd-group-exists = useradd : le groupe { $group } existe. Si vous voulez ajouter cet utilisateur à ce groupe, utilisez -g.
useradd-bad-name = useradd : nom d'utilisateur « { $user } » non valable : utilisez --badname pour l'ignorer
useradd-uid-invalid = useradd : identifiant d'utilisateur « { $uid } » non valable
useradd-uid-exists = useradd : l'UID { $uid } n'est pas unique
useradd-home-exists =
    useradd : attention : le répertoire personnel { $home } existe déjà.
    useradd : aucun fichier du répertoire skel n'y sera copié.
passwd-usage =
    Usage : passwd [options] [IDENTIFIANT]
    (ex. : passwd ; sudo passwd compte ; passwd -S ; sudo passwd -l compte ; voir man passwd)
passwd-changing = Changement du mot de passe pour { $user }.
passwd-current = Mot de passe actuel :{" "}
passwd-new = Nouveau mot de passe :{" "}
passwd-retype = Retapez le nouveau mot de passe :{" "}
passwd-updated = passwd : le mot de passe a été mis à jour avec succès
passwd-mismatch = Les mots de passe ne correspondent pas.
passwd-none-supplied = Aucun mot de passe n'a été fourni.
passwd-unchanged-same = Mot de passe inchangé
passwd-too-short = Vous devez choisir un mot de passe plus long.
passwd-token-error =
    passwd : Erreur de manipulation du jeton d'authentification
    passwd : mot de passe inchangé
passwd-not-allowed = passwd : vous ne pouvez pas voir ni modifier les informations de mot de passe de { $user }.
passwd-permission = passwd : Permission non accordée.
passwd-unknown-user = passwd : l'utilisateur « { $user } » n'existe pas
passwd-changed = passwd : mot de passe modifié.
passwd-expiry-changed = passwd : informations d'expiration du mot de passe modifiées.
passwd-unlock-empty =
    passwd : déverrouiller le mot de passe aboutirait à un compte sans mot de passe.
    Vous devriez définir un mot de passe avec usermod -p pour déverrouiller le mot de passe de cet utilisateur.
adduser-usage =
    adduser [--uid id] [--ingroup groupe] [--shell shell] [--disabled-password] [--comment commentaire] [--home rép] utilisateur
    adduser utilisateur groupe
    (voir man adduser)
adduser-only-root = fatal : seul le superutilisateur peut ajouter un utilisateur ou un groupe au système.
adduser-exists = fatal : L'utilisateur « { $user } » existe déjà.
adduser-user-missing = fatal : L'utilisateur « { $user } » n'existe pas.
adduser-group-missing = fatal : Le groupe « { $group } » n'existe pas.
adduser-bad-name =
    fatal : Veuillez entrer un nom d'utilisateur qui corresponde à l'expression rationnelle
    configurée par la variable NAME_REGEX. Utilisez l'option « --allow-bad-names » pour assouplir cette vérification ou reconfigurez NAME_REGEX
    dans la configuration.
adduser-adding-user = info: Ajout de l'utilisateur « { $user } » ...
adduser-selecting = info: Choix d'un UID/GID dans la plage { $from } à { $to } ...
adduser-adding-group = info: Ajout du nouveau groupe « { $group } » ({ $gid }) ...
adduser-adding-new-user = info: Ajout du nouvel utilisateur « { $user } » ({ $uid }) avec le groupe « { $group } ({ $gid }) » ...
adduser-creating-home = info: Création du répertoire personnel « { $home } » ...
adduser-copying = info: Copie des fichiers depuis « /etc/skel » ...
adduser-changing-info = Modifier les informations associées à un utilisateur pour { $user }
adduser-enter-value = Entrer la nouvelle valeur, ou appuyer sur ENTER pour la valeur par défaut
adduser-full-name = Nom complet
adduser-room = N° de bureau
adduser-work-phone = Téléphone professionnel
adduser-home-phone = Téléphone personnel
adduser-other = Autre
adduser-correct = Cette information est-elle correcte ? [O/n]{" "}
adduser-try-again = Essayer à nouveau ? [o/N]{" "}
adduser-extra-groups = info: Ajout du nouvel utilisateur « { $user } » aux groupes supplémentaires « users » ...
adduser-adding-to-group = info: Ajout de l'utilisateur « { $user } » au groupe « { $group } » ...
adduser-already-member = info: L'utilisateur « { $user } » appartient déjà au groupe « { $group } ».
