### The shell: prompt, sudo, pipes and redirections, man, and the error
### messages shared by several commands (taken from coreutils and bash
### with LANG=C). { $commande }: name of the command; { $cible }: path.

## Shared messages

erreur-introuvable = { $commande }: { $cible }: No such file or directory
erreur-est-un-dossier = { $commande }: { $cible }: Is a directory
erreur-permission = { $commande }: { $cible }: Permission denied
erreur-binaire = { $commande }: { $cible }: binary file (an archive: to see what it contains, tar -tf { $cible })
erreur-creation-permission = { $commande }: cannot create '{ $cible }': Permission denied
erreur-espace = { $commande }: write error: No space left on device

## sudo

# Message sudo shows the first time it is used.
sudo-sermon =
    We trust you have received the usual lecture from the local System Administrator. It usually boils down to these three things:

        #1) Respect the privacy of others.
        #2) Think before you type.
        #3) With great power comes great responsibility.
# { $utilisateur }: user name (technical identifier)
sudo-invite = [sudo] password for { $utilisateur }:
sudo-mauvais-mot-de-passe = Sorry, try again.
sudo-trois-echecs = sudo: 3 incorrect password attempts
sudo-pas-encore = sudo: you don't have this command yet in this chapter.
sudo-cd =
    sudo: cd: command not found
    (cd is part of the shell itself, so sudo cannot run it. With sudo, you look and act from a distance: sudo ls place, sudo cat file…)

## Command lines, pipes and redirections

# { $operateur }: > or >>
syntaxe-redirection = syntax error: missing file name after { $operateur }
syntaxe-tube = syntax error near unexpected token `|'
redirection-est-un-dossier = { $cible }: Is a directory
redirection-permission = { $cible }: Permission denied
redirection-sudo = (The > redirection is done by your own shell, not by sudo. Tip: send the text into "sudo tee -a file", which writes as root.)
commande-pas-encore = { $commande }: you don't have this command yet in this chapter. Type "aide" for the list.
commande-introuvable = { $commande }: command not found. Type "aide" for the list.
# { $commandes }: list of commands, separated by commas
aide-commandes =
    Known commands: { $commandes }.
    To learn more: "man command" (the full manual), "command --help" (a summary), "man -k word" (find a command by keyword).

## man, apropos, whatis (man-db messages)

manuel-pas-encore = (You don't have this command yet in this chapter.)
manuel-quoi-chercher = { $commande } what?
manuel-rien = { $mot }: nothing appropriate.
manuel-quelle-page =
    What manual page do you want?
    For example, try 'man man'.
manuel-pas-de-page = No manual entry for { $commande }

## Scripts (/bin/sh): git hooks, deployment scripts (src/moteur/script.ts)

# { $script }: the script name; { $numero }: the line; { $mot }: the shell word
script-non-simule = { $script }: { $numero }: "{ $mot }": this shell construct is not simulated in this game (no if, for or while). Write one command per line, with && or || to chain them.
# { $script }: the script name; { $numero }: the line
test-crochet-manquant = { $script }: { $numero }: [: missing ]
# { $operateur }: what was given to test
test-operateur = { $operateur }: unexpected operator
test-trop-d-arguments = too many arguments
# { $fichier }: the requested script
sh-introuvable = sh: 0: cannot open { $fichier }: No such file
sh-interactif = (In this game, sh runs a script: sh file. The interactive shell is the one you are already typing in.)
# { $argument }: what was not understood
date-invalide = date: invalid date '{ $argument }'
# The date format with no argument, like date with LANG=C
date-format = %a %b %e %H:%M:%S %Z %Y
readlink-operande =
    readlink: missing operand
    Try 'readlink --help' for more information.
# Running ./script: { $commande } is the path typed
script-introuvable = bash: { $commande }: No such file or directory
script-dossier = bash: { $commande }: Is a directory
script-permission = bash: { $commande }: Permission denied

## Disks (mount, umount)

mount-usage =
    Usage:
     mount [-lhV]
     mount -a [options]
     mount [options] [--source] <source> | [--target] <directory>
     mount [options] <source> <directory>
    (Here: mount, or sudo mount [-o ro] device mount_point; see man mount)
umount-usage =
    Usage:
     umount [-hV]
     umount <source> | <directory> [options]
# { $commande }: the command; { $cible }: the path
erreur-lecture-seule = { $commande }: { $cible }: Read-only file system

# sudo -u with an account that does not exist; { $compte }: the name given
sudo-compte-inconnu = sudo: unknown user { $compte }

# A wildcard that expands to too many names: the limit on a program's arguments (ARG_MAX).
# { $programme }: the path of the program, e.g. /usr/bin/rm
liste-arguments-trop-longue = bash: { $programme }: Argument list too long
sudo-liste-arguments-trop-longue = sudo: unable to execute { $programme }: Argument list too long
date-option-argument =
    date: option requires an argument -- 's'
    Try 'date --help' for more information.
date-reglage-refuse = date: cannot set date: Operation not permitted

## Easter eggs (see OEUFS in src/moteur/shell.ts)

oeuf-xyzzy = Nothing happens.
oeuf-sandwich-refus = What? Make it yourself.
oeuf-sandwich = Okay.
oeuf-sl =
          ====        ________                ___________
      _D _|  |_______/        \__I_I_____===__|_________|
       |(_)---  |   H\________/ |   |        =|___ ___|
       /     |  |   H  |  |     |   |         ||_| |_||
      |      |  |   H  |__--------------------| (___) |
      | ________|___H__/__|_____/(__)~\_______|       |
      |/ |   |-----------I_____I (__) (__)  D |=======|__
    __/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
     |/-=|___|=    ||    ||    ||    |_____/~\___/
      \_/      \O=====O=====O=====O_/      \_/
