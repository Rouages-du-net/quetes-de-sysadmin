### Story "The Co-op", chapter "Shared permissions": a team directory
### (setgid, umask) and a narrow sudo rule (visudo). Commands, paths and
### sudoers syntax are not translated.

chapitre-droits = Shared permissions
    .resume = A directory where the till team can really work together (setgid, umask), and the right to restart the till, nothing more (visudo).

## Files

droits-courriel-awa =
    From:    Awa
    To:      you
    Subject: The till team

    Two problems with the till team (Lina and Karim, group caisse):

    1. The daily statements are in /srv/caisse/statements. Lina can't
       correct Karim's, and vice versa. And yet they are both in the
       caisse group! Look at ls -l. Everything they create there, today
       and tomorrow, must belong to the caisse group and be writable by
       the group (man chmod, man umask).

    2. When the till freezes, they have to call someone who has sudo
       to run systemctl restart caisse. Marc used to give them his
       password… Give them the right to restart the till, and NOTHING else
       (man sudoers, man visudo; sudo -l -U lina to check).

    For sudo, your password is still: radis-2027

droits-releve-17 =
    Till statement — Sunday 17 October (Lina)
    Opening float: 150.00
    Sales: 1,243.60
droits-releve-18 =
    Till statement — Monday 18 October (Karim)
    Opening float: 150.00
    Sales: 987.20

## Events

droits-evenement-sudoers-casse =
    sudo is broken: the policy has an error (reread the message), and sudo
    then refuses EVERYTHING, even to you. That's why sudoers is edited with
    visudo, which checks before saving.

    On a real server, you would need the hosting provider's rescue console
    (or pkexec). Here: "Restart this chapter", below the terminal.
# { $fichier }: the ignored rules file
droits-evenement-fichier-ignore =
    Your rule is in { $fichier }… which sudo doesn't read! @includedir
    ignores files whose name contains a dot or ends with ~ (reread
    /etc/sudoers.d/README). Give it a name without a dot, like
    /etc/sudoers.d/caisse.
droits-evenement-trop-large =
    Careful: with this rule, Lina and Karim can start a root shell
    (sudo bash), and so do ANYTHING. That's not what Awa is asking for:
    only restarting the till, with the full path of the command and its
    arguments.
droits-evenement-systemctl-entier =
    Almost: with systemctl and no arguments, Lina and Karim can restart
    the till… but also stop ssh or any other service. Write the whole
    command: path, and arguments.
droits-evenement-sudo =
    sudo -l -U lina confirms it: the till team can restart the till, and
    nothing else.
# { $dossier }: the shared directory
droits-evenement-dossier =
    { $dossier } now belongs to the caisse group, which can write to it, and
    has the setgid bit (the s in drwxrwsr-x): everything created in it will
    get the caisse group. What remains is what's already there, and the
    permissions Lina and Karim will give their next files (umask).
droits-evenement-masque =
    Lina and Karim will have the 002 mask at their next login: their new
    files will be rw-rw-r--, editable by the group.
droits-evenement-fin =
    The next day: Lina saves her statement (-rw-rw-r-- lina caisse), Karim
    fixes a decimal point without asking anyone, and when the till freezes
    at noon, he restarts it himself with sudo. Awa: "No more passwords
    going around!"

    Well done! You have finished the chapter "Shared permissions".

    WHAT HAPPENED
    A file belongs to the primary group of the person who creates it, with
    the permissions their mask allows (umask 022: rw-r--r--). To work as a
    team, you need both: the setgid bit on the directory (the directory's
    group is passed on to new files) and a 002 mask (the group can write).
    And sudo isn't all or nothing: a rule can allow just one specific
    command, to one specific group.

    GOOD PRACTICE
    - Team directory: chgrp team, chmod 2775 (or g+ws), then
      chgrp -R and chmod -R g+w for what already exists.
    - umask 002 in the team's ~/.profile (or /etc/profile.d).
    - Always visudo (-f for /etc/sudoers.d/name-without-dot), full paths
      (which), arguments written out in full; check with
      sudo -l -U account.
    - Never share a password: give each person a precise right.

    DOCUMENTATION
    - sudoers: https://www.sudo.ws/docs/man/sudoers.man/
    - visudo: https://www.sudo.ws/docs/man/visudo.man/
    - setgid on directories: https://www.gnu.org/software/coreutils/manual/html_node/Directory-Setuid-and-Setgid.html
