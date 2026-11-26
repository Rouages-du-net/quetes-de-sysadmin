### Konten und Gruppen: id, groups, chgrp, chown (coreutils) und
### usermod (shadow-utils), mit ihren deutschen Meldungen. { $user } und
### { $group } sind technische Bezeichner und werden nicht übersetzt.

# Ausgabe von id: { $uid }, { $gid } und { $groups } sehen aus wie „1000(du)“
id-line = uid={ $uid } gid={ $gid } Gruppen={ $groups }
id-missing = id: '{ $user }': Benutzer nicht gefunden
groups-missing = groups: '{ $user }': Benutzer nicht gefunden

# Gemeinsam für chgrp und chown; { $command }: chgrp oder chown
error-access-missing = { $command }: Zugriff auf '{ $target }' nicht möglich: Datei oder Verzeichnis nicht gefunden
error-access-permission = { $command }: Zugriff auf '{ $target }' nicht möglich: Keine Berechtigung

chgrp-usage = Aufruf: chgrp [-R] gruppe datei... (siehe man chgrp)
chgrp-group-incorrect = chgrp: ungültige Gruppe: '{ $group }'
chgrp-not-allowed = chgrp: Ändern der Gruppe von '{ $target }': Die Operation ist nicht erlaubt

chown-usage = Aufruf: chown [-R] besitzer[:gruppe] datei... (siehe man chown)
# { $owner }: was getippt wurde, z. B. „malo:team“
chown-user-incorrect = chown: ungültiger Benutzer: '{ $owner }'
chown-group-incorrect = chown: ungültige Gruppe: '{ $owner }'
chown-not-allowed = chown: Ändern des Eigentümers von '{ $target }': Die Operation ist nicht erlaubt

usermod-usage =
    Aufruf: usermod [Optionen] BENUTZER
    (z. B. usermod -aG gruppe benutzer; siehe man usermod)
usermod-a-without-G = usermod: Die Option -a ist nur zusammen mit der Option -G erlaubt
usermod-permission =
    usermod: Zugriff verweigert.
    usermod: /etc/passwd kann nicht gesperrt werden, versuchen Sie es später noch einmal.
usermod-user-missing = usermod: Benutzer '{ $user }' existiert nicht
usermod-group-missing = usermod: Gruppe '{ $group }' existiert nicht
# { $date }: das an usermod -e übergebene Datum
usermod-date-invalid = usermod: Ungültiges Datum '{ $date }'
usermod-uid-invalid = usermod: Ungültige Benutzer-ID '{ $uid }'
usermod-uid-exists = usermod: UID '{ $uid }' existiert bereits
usermod-used = usermod: Benutzer { $user } wird gerade von Prozess { $pid } benutzt
# { $range }: was an -v/-w übergeben wurde (ERSTE-LETZTE)
usermod-subuid-invalid = usermod: Ungültiger untergeordneter UID-Bereich '{ $range }'
usermod-subgid-invalid = usermod: Ungültiger untergeordneter GID-Bereich '{ $range }'

## userdel, gpasswd, chage (shadow-utils)

userdel-usage =
    Aufruf: userdel [Optionen] BENUTZER
    (z. B. userdel -r benutzer; siehe man userdel)
userdel-permission =
    userdel: Zugriff verweigert.
    userdel: /etc/passwd kann nicht gesperrt werden, versuchen Sie es später noch einmal.
userdel-missing = userdel: Benutzer '{ $user }' existiert nicht
# { $pid }: die Nummer des Prozesses
userdel-used = userdel: Benutzer { $user } wird gerade von Prozess { $pid } benutzt
userdel-without-mail = userdel: Mail-Spool von { $user } (/var/mail/{ $user }) nicht gefunden
gpasswd-usage =
    Aufruf: gpasswd [Option] GRUPPE
    (z. B. gpasswd -d benutzer gruppe; siehe man gpasswd)
gpasswd-permission = gpasswd: Zugriff verweigert.
gpasswd-group-missing = gpasswd: Gruppe '{ $group }' existiert nicht
gpasswd-user-missing = gpasswd: Benutzer '{ $user }' existiert nicht
gpasswd-addition = Benutzer { $user } wird zur Gruppe { $group } hinzugefügt.
gpasswd-indent = Benutzer { $user } wird aus der Gruppe { $group } entfernt.
gpasswd-not-member = gpasswd: Benutzer '{ $user }' ist kein Mitglied von '{ $group }'
chage-usage =
    Aufruf: chage [Optionen] BENUTZER
    (z. B. chage -l benutzer; chage -E 0 benutzer; siehe man chage)
chage-missing = chage: Benutzer '{ $user }' existiert nicht in /etc/passwd
chage-permission = chage: Zugriff verweigert.
chage-date-invalid = chage: Ungültiges Datum '{ $date }'
# { $expire }: das Ablaufdatum des Kontos (JJJJ-MM-TT) oder never
chage-list =
    Letzte Passwortänderung					: 2027-03-14
    Passwort läuft ab					: nie
    Passwort inaktiv					: nie
    Konto läuft ab						: { $expire ->
        [never] nie
       *[other] { $expire }
    }
    Minimale Anzahl der Tage zwischen Passwortänderungen	: 0
    Maximale Anzahl der Tage zwischen Passwortänderungen	: 99999
    Anzahl Tage, an denen vor Passwortablauf gewarnt wird	: 7

## useradd, passwd (shadow-utils und PAM), adduser (Debian)

useradd-usage =
    Aufruf: useradd [Optionen] BENUTZER
    (z. B. useradd -m -s /bin/bash -G gruppe konto; siehe man useradd)
useradd-permission =
    useradd: Zugriff verweigert.
    useradd: /etc/passwd kann nicht gesperrt werden, versuchen Sie es später noch einmal.
useradd-exists = useradd: Benutzer '{ $user }' existiert bereits
useradd-group-missing = useradd: Gruppe '{ $group }' existiert nicht
useradd-group-exists = useradd: Gruppe { $group } existiert - wenn Sie diesen Benutzer zu dieser Gruppe hinzufügen wollen, verwenden Sie -g.
useradd-bad-name = useradd: Ungültiger Benutzername '{ $user }': Verwenden Sie --badname, um dies zu ignorieren
useradd-uid-invalid = useradd: Ungültige Benutzer-ID '{ $uid }'
useradd-uid-exists = useradd: UID { $uid } ist nicht eindeutig
# { $home }: das Home-Verzeichnis, das schon da war
useradd-home-exists =
    useradd: Warnung: Das Home-Verzeichnis { $home } existiert bereits.
    useradd: Es werden keine Dateien aus dem skel-Verzeichnis dorthin kopiert.
passwd-usage =
    Aufruf: passwd [Optionen] [BENUTZER]
    (z. B. passwd; sudo passwd konto; passwd -S; sudo passwd -l konto; siehe man passwd)
passwd-changing = Passwort für { $user } wird geändert.
passwd-current = Aktuelles Passwort:{" "}
passwd-new = Neues Passwort:{" "}
passwd-retype = Geben Sie das neue Passwort erneut ein:{" "}
passwd-updated = passwd: Passwort erfolgreich geändert
passwd-mismatch = Die Passwörter stimmen nicht überein.
passwd-none-supplied = Es wurde kein Passwort angegeben.
passwd-unchanged-same = Passwort nicht geändert
passwd-too-short = Sie müssen ein längeres Passwort wählen.
passwd-token-error =
    passwd: Fehler beim Ändern des Authentifizierungstoken
    passwd: Passwort nicht geändert
passwd-not-allowed = passwd: Sie dürfen die Passwortinformationen für { $user } weder ansehen noch ändern.
passwd-permission = passwd: Zugriff verweigert.
passwd-unknown-user = passwd: Benutzer '{ $user }' existiert nicht
passwd-changed = passwd: Passwort geändert.
passwd-expiry-changed = passwd: password expiry information changed.
passwd-unlock-empty =
    passwd: Das Entsperren des Passworts würde zu einem Konto ohne Passwort führen.
    Sie sollten mit usermod -p ein Passwort setzen, um das Passwort dieses Benutzers zu entsperren.
adduser-usage =
    adduser [--uid id] [--ingroup group] [--shell shell] [--disabled-password] [--comment comment] [--home dir] user
    adduser user group
    (siehe man adduser)
adduser-only-root = fatal: Only root may add a user or group to the system.
adduser-exists = fatal: The user `{ $user }' already exists.
adduser-user-missing = fatal: The user `{ $user }' does not exist.
adduser-group-missing = fatal: The group `{ $group }' does not exist.
adduser-bad-name =
    fatal: Please enter a username matching the regular expression
    configured via the NAME_REGEX configuration variable.  Use the `--allow-bad-names' option to relax this check or reconfigure NAME_REGEX
    in configuration.
adduser-adding-user = info: Adding user `{ $user }' ...
# { $from } und { $to }: der Bereich, aus dem adduser die IDs wählt
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
