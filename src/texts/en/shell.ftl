### The shell: prompt, sudo, pipes and redirections, man, and the error
### messages shared by several commands (taken from coreutils and bash
### with LANG=C). { $command }: name of the command; { $target }: path.

## Shared messages

error-missing = { $command }: { $target }: No such file or directory
error-is-one-directory = { $command }: { $target }: Is a directory
error-permission = { $command }: { $target }: Permission denied
error-binary = { $command }: { $target }: binary file (an archive: to see what it contains, tar -tf { $target })
error-creation-permission = { $command }: cannot create '{ $target }': Permission denied
error-space = { $command }: write error: No space left on device

## sudo

# Message sudo shows the first time it is used.
sudo-lecture =
    We trust you have received the usual lecture from the local System Administrator. It usually boils down to these three things:

        #1) Respect the privacy of others.
        #2) Think before you type.
        #3) With great power comes great responsibility.
# { $user }: user name (technical identifier)
sudo-prompt = [sudo] password for { $user }:
sudo-bad-password = Sorry, try again.
sudo-three-failures = sudo: 3 incorrect password attempts
sudo-not-still = sudo: you don't have this command yet in this chapter.
sudo-cd =
    sudo: cd: command not found
    (cd is part of the shell itself, so sudo cannot run it. With sudo, you look and act from a distance: sudo ls place, sudo cat file…)

## Command lines, pipes and redirections

# { $operator }: > or >>
syntax-redirection = syntax error: missing file name after { $operator }
syntax-pipe = syntax error near unexpected token `|'
redirection-is-one-directory = { $target }: Is a directory
redirection-permission = { $target }: Permission denied
redirection-sudo = (The > redirection is done by your own shell, not by sudo. Tip: send the text into "sudo tee -a file", which writes as root.)
command-not-still = { $command }: you don't have this command yet in this chapter. Type "help" for the list.
command-missing = { $command }: command not found. Type "help" for the list.
# { $commands }: list of commands, separated by commas
# Le nom de la commande qui liste les autres, dans la langue (aide, help)
command-help = help
help-commands =
    Known commands: { $commands }.
    To learn more: "man command" (the full manual), "command --help" (a summary), "man -k word" (find a command by keyword).

## man, apropos, whatis (man-db messages)

manual-not-still = (You don't have this command yet in this chapter.)
manual-what-search = { $command } what?
manual-nothing = { $word }: nothing appropriate.
manual-which-page =
    What manual page do you want?
    For example, try 'man man'.
manual-not-page = No manual entry for { $command }

## Scripts (/bin/sh): git hooks, deployment scripts (src/engine/script.ts)

# { $script }: the script name; { $number }: the line; { $word }: the shell word
script-not-simulated = { $script }: { $number }: "{ $word }": this shell construct is not simulated in this game (no if, for or while). Write one command per line, with && or || to chain them.
# { $script }: the script name; { $number }: the line
test-hook-missing = { $script }: { $number }: [: missing ]
# { $operator }: what was given to test
test-operator = { $operator }: unexpected operator
test-too-arguments = too many arguments
# { $file }: the requested script
sh-missing = sh: 0: cannot open { $file }: No such file
sh-interactive = (In this game, sh runs a script: sh file. The interactive shell is the one you are already typing in.)
# { $argument }: what was not understood
date-invalid = date: invalid date '{ $argument }'
# The date format with no argument, like date with LANG=C
date-format = %a %b %e %H:%M:%S %Z %Y
readlink-operand =
    readlink: missing operand
    Try 'readlink --help' for more information.
# Running ./script: { $command } is the path typed
script-missing = bash: { $command }: No such file or directory
script-directory = bash: { $command }: Is a directory
script-permission = bash: { $command }: Permission denied

## Disks (mount, umount)

mount-usage =
    Usage:
     mount [-lhV]
     mount -a [options]
     mount [options] [--source] <source> | [--target] <directory>
     mount [options] <source> <directory>
    (Here: mount, or sudo mount [-o ro] device mount_point; see man mount)
# sfdisk without a script: the real sfdisk would open a dialogue (game difference)
sfdisk-interactive =
    sfdisk: interactive mode does not exist in this game. Give it a script
    on its standard input: for example another disk's table,
    sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (see man sfdisk).
# mdadm --create with a level other than RAID 1 (game difference)
# { $level }: the level asked for
mdadm-level = mdadm: in this game, only RAID 1 (--level=1) is simulated, not "{ $level }".
update-initramfs-usage =
    Usage: update-initramfs {"{"} -c | -d | -u {"}"} [-k version] [-v] [-b directory]
umount-usage =
    Usage:
     umount [-hV]
     umount <source> | <directory> [options]
# { $command }: the command; { $target }: the path
error-read-only = { $command }: { $target }: Read-only file system

# sudo -u with an account that does not exist; { $account }: the name given
sudo-account-unknown = sudo: unknown user { $account }

# A wildcard that expands to too many names: the limit on a program's arguments (ARG_MAX).
# { $program }: the path of the program, e.g. /usr/bin/rm
list-arguments-too-long = bash: { $program }: Argument list too long
sudo-list-arguments-too-long = sudo: unable to execute { $program }: Argument list too long
date-option-argument =
    date: option requires an argument -- 's'
    Try 'date --help' for more information.
date-setting-refuse = date: cannot set date: Operation not permitted

## Easter eggs (see OEUFS in src/engine/shell.ts)

egg-xyzzy = Nothing happens.
egg-sandwich-refusal = What? Make it yourself.
egg-sandwich = Okay.
egg-sl =
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

# Unknown --color=WHEN (ls, grep, diff), as coreutils says it.
colour-argument-invalid =
    { $command }: invalid argument ‘{ $value }’ for ‘--color’
    Valid arguments are:
      - ‘always’, ‘yes’, ‘force’
      - ‘never’, ‘no’, ‘none’
      - ‘auto’, ‘tty’, ‘if-tty’
    Try '{ $command } --help' for more information.
