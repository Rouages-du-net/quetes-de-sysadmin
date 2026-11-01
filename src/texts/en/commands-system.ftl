### System commands (src/engine/commands/system.ts): ps, kill,
### systemctl. The English output of ps and systemctl stays in the code,
### as on a real system.

kill-usage = Usage: kill PID (the process number, given by ps)
# { $pid }: the number typed
kill-none = kill: ({ $pid }) - No such process
kill-not-allowed = kill: ({ $pid }) - Operation not permitted
systemctl-usage = Usage: systemctl status service (e.g. systemctl status nginx; see man systemctl)
# First line: systemctl's message (in English); second: the game's advice.
systemctl-access-refuse =
    Failed to { $action } { $service }.service: Access denied
    (you need to be root: sudo systemctl { $action } { $service })
journalctl-argument = journalctl: unexpected argument '{ $argument }' (for a service: journalctl -u { $argument })
reboot-refuse =
    Failed to reboot system: Access denied
    (you need to be root: sudo reboot)

## Logs (truncate, logrotate)

truncate-size = truncate: you must specify either '--size' or '--reference'
truncate-operand =
    truncate: missing file operand
    Try 'truncate --help' for more information.
# { $size }: the size given
truncate-size-incorrect = truncate: Invalid number: '{ $size }'
# { $file }: the file
truncate-directory = truncate: cannot open '{ $file }' for writing: Is a directory
truncate-permission = truncate: cannot open '{ $file }' for writing: Permission denied
logrotate-usage =
    logrotate 3.21.0 - Copyright (C) 1995-2001 Red Hat, Inc.
    This may be freely redistributed under the terms of the GNU General Public License

    Usage: logrotate [-dfv?] [-d|--debug] [-f|--force] [-v|--verbose] <configfile>
pkill-usage =
    pkill: no matching criteria specified
    Try `pkill --help' for more information.

# ionice followed by a command: the game can only adjust processes already running.
ionice-command = ionice: here, only for a process that is already running (ionice -p PID, or ionice -c 3 -p PID). See man ionice.
