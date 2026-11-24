### Cuentas y grupos: id, groups, chgrp, chown (coreutils) y usermod
### (shadow-utils), con sus mensajes en español (Translation Project).
### { $user } y { $group } son identificadores técnicos, no se traducen.
### adduser (Debian) se queda en inglés en este juego.

# Salida de id: { $uid }, { $gid } y { $groups } tienen la forma «1000(tu)»
id-line = uid={ $uid } gid={ $gid } grupos={ $groups }
id-missing = id: '{ $user }': no existe ese usuario
groups-missing = groups: '{ $user }': no existe ese usuario

# Común a chgrp y chown; { $command }: chgrp o chown
error-access-missing = { $command }: no se puede acceder a '{ $target }': No existe el fichero o el directorio
error-access-permission = { $command }: no se puede acceder a '{ $target }': Permiso denegado

chgrp-usage = Uso: chgrp [-R] grupo archivo... (mira man chgrp)
chgrp-group-incorrect = chgrp: grupo inválido: '{ $group }'
chgrp-not-allowed = chgrp: cambiando el grupo de '{ $target }': Operación no permitida

chown-usage = Uso: chown [-R] propietario[:grupo] archivo... (mira man chown)
# { $owner }: lo que se escribió, p. ej. «malo:equipe»
chown-user-incorrect = chown: usuario inválido: '{ $owner }'
chown-group-incorrect = chown: grupo inválido: '{ $owner }'
chown-not-allowed = chown: cambiando el propietario de '{ $target }': Operación no permitida

usermod-usage =
    Modo de uso: usermod [opciones] USUARIO
    (p. ej. usermod -aG grupo usuario; mira man usermod)
usermod-a-without-G = usermod: -a flag is only allowed with the -G flag
usermod-permission =
    usermod: permiso denegado.
    usermod: no se puede bloquear /etc/passwd, inténtelo de nuevo.
usermod-user-missing = usermod: el usuario «{ $user }» no existe
usermod-group-missing = usermod: el grupo «{ $group }» no existe
# { $date }: la fecha dada a usermod -e
usermod-date-invalid = usermod: fecha «{ $date }» incorrecta
usermod-uid-invalid = usermod: identificador de usuario «{ $uid }» incorrecto
usermod-uid-exists = usermod: el UID «{ $uid }» ya existe
usermod-used = usermod: el usuario { $user } está actualmente en uso por el proceso { $pid }

## userdel, gpasswd, chage (shadow-utils)

userdel-usage =
    Modo de uso: userdel [opciones] USUARIO
    (p. ej. userdel -r usuario; mira man userdel)
userdel-permission =
    userdel: permiso denegado.
    userdel: no se puede bloquear /etc/passwd, inténtelo de nuevo.
userdel-missing = userdel: el usuario «{ $user }» no existe
# { $pid }: el número del proceso
userdel-used = userdel: el usuario { $user } está actualmente en uso por el proceso { $pid }
userdel-without-mail = userdel: { $user } no se encontró el buzón de correo (/var/mail/{ $user })
gpasswd-usage =
    Modo de uso: gpasswd [opción] GRUPO
    (p. ej. gpasswd -d usuario grupo; mira man gpasswd)
gpasswd-permission = gpasswd: permiso denegado.
gpasswd-group-missing = gpasswd: el grupo «{ $group }» no existe
gpasswd-user-missing = gpasswd: el usuario «{ $user }» no existe
gpasswd-addition = Añadiendo el usuario { $user } al grupo { $group }
gpasswd-indent = Eliminando el usuario { $user } del grupo { $group }
gpasswd-not-member = gpasswd: el usuario «{ $user }» no es miembro de «{ $group }»
chage-usage =
    Modo de uso: chage [opciones] USUARIO
    (p. ej. chage -l usuario; chage -E 0 usuario; mira man chage)
chage-missing = chage: el usuario «{ $user }» no existe en /etc/passwd
chage-permission = chage: permiso denegado.
chage-date-invalid = chage: fecha «{ $date }» incorrecta
# { $expire }: la fecha de caducidad de la cuenta (AAAA-MM-DD), o never
chage-list =
    Último cambio de contraseña					: 2027-03-14
    La contraseña caduca					: nunca
    Contraseña inactiva					: nunca
    La cuenta caduca						: { $expire ->
        [never] nunca
       *[other] { $expire }
    }
    Número de días mínimo entre cambios de contraseña		: 0
    Número de días máximo entre cambios de contraseña		: 99999
    Número de días de aviso antes de que caduque la contraseña	: 7

## useradd, passwd (shadow-utils y PAM), adduser (Debian)

useradd-usage =
    Modo de uso: useradd [opciones] USUARIO
    (p. ej. useradd -m -s /bin/bash -G grupo cuenta; mira man useradd)
useradd-permission =
    useradd: permiso denegado.
    useradd: no se puede bloquear /etc/passwd, inténtelo de nuevo.
useradd-exists = useradd: el usuario «{ $user }» ya existe
useradd-group-missing = useradd: el grupo «{ $group }» no existe
useradd-group-exists = useradd: el grupo { $group } existe - si quiere añadir este usuario a ese grupo, use -g.
useradd-bad-name = useradd: nombre de usuario «{ $user }» incorrecto: utilice --badname para permitirlo
useradd-uid-invalid = useradd: identificador de usuario «{ $uid }» incorrecto
useradd-uid-exists = useradd: el UID { $uid } no es único
# { $home }: la carpeta personal que ya estaba ahí
useradd-home-exists =
    useradd: aviso: el directorio personal { $home } ya existe.
    useradd: No se copiará ningún fichero del directorio «skel» en él.
passwd-usage =
    Modo de uso: passwd [opciones] [USUARIO]
    (p. ej. passwd; sudo passwd cuenta; passwd -S; sudo passwd -l cuenta; mira man passwd)
passwd-changing = Cambiando la contraseña para { $user }.
passwd-current = Contraseña actual:{" "}
passwd-new = Nueva contraseña:{" "}
passwd-retype = Vuelva a escribir la nueva contraseña:{" "}
passwd-updated = passwd: contraseña actualizada correctamente
passwd-mismatch = Las contraseñas no coinciden.
passwd-none-supplied = No se ha proporcionado ninguna contraseña.
passwd-unchanged-same = La contraseña no ha cambiado
passwd-too-short = Debe elegir una contraseña más larga.
passwd-token-error =
    passwd: Error de manipulación del testigo de autenticación
    passwd: no se ha cambiado la contraseña
passwd-not-allowed = passwd: no debe ver o cambiar la información de la contraseña para { $user }.
passwd-permission = passwd: permiso denegado.
passwd-unknown-user = passwd: el usuario «{ $user }» no existe
passwd-changed = passwd: contraseña cambiada.
passwd-expiry-changed = passwd: password expiry information changed.
passwd-unlock-empty =
    passwd: al desbloquear la contraseña dejaría una cuenta sin contraseña.
    Debería establecer una contraseña mediante «usermod -p» para desbloquear la contraseña de esta cuenta.
adduser-usage =
    adduser [--uid id] [--ingroup group] [--shell shell] [--disabled-password] [--comment comment] [--home dir] user
    adduser user group
    (mira man adduser)
adduser-only-root = fatal: Only root may add a user or group to the system.
adduser-exists = fatal: The user `{ $user }' already exists.
adduser-user-missing = fatal: The user `{ $user }' does not exist.
adduser-group-missing = fatal: The group `{ $group }' does not exist.
adduser-bad-name =
    fatal: Please enter a username matching the regular expression
    configured via the NAME_REGEX configuration variable.  Use the `--allow-bad-names' option to relax this check or reconfigure NAME_REGEX
    in configuration.
adduser-adding-user = info: Adding user `{ $user }' ...
# { $from } y { $to }: el intervalo de identificadores del que elige adduser
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
