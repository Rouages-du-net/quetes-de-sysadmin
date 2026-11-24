### Comandos del sistema (src/engine/commands/system.ts): ps, kill,
### systemctl. La salida en inglés de ps y systemctl se queda en el código,
### como en un sistema real.

kill-usage = Uso: kill PID (el número del proceso, que da ps)
# { $pid }: el número escrito
kill-none = kill: ({ $pid }) - No existe el proceso
kill-not-allowed = kill: ({ $pid }) - Operación no permitida
systemctl-usage = Uso: systemctl status servicio (p. ej. systemctl status nginx; mira man systemctl)
# Primera línea: el mensaje de systemctl (en inglés); segunda: el consejo del juego.
systemctl-access-refuse =
    Failed to { $action } { $service }.service: Access denied
    (hay que ser root: sudo systemctl { $action } { $service })
journalctl-argument = journalctl: argumento inesperado '{ $argument }' (para un servicio: journalctl -u { $argument })
poweroff-refuse =
    Call to PowerOff failed: Access denied
    (hay que ser root: sudo poweroff)
shutdown-refuse =
    Call to ScheduleShutdown failed: Access denied
    (hay que ser root: sudo shutdown)
reboot-refuse =
    Failed to reboot system: Access denied
    (hay que ser root: sudo reboot)

## Registros (truncate, logrotate)

truncate-size = truncate: debe especificar o bien '--size' o bien '--reference'
truncate-operand =
    truncate: falta un fichero como operando
    Pruebe 'truncate --help' para más información.
# { $size }: el tamaño dado
truncate-size-incorrect = truncate: Número inválido: '{ $size }'
# { $file }: el archivo
truncate-directory = truncate: no se puede abrir '{ $file }' para escritura: Es un directorio
truncate-permission = truncate: no se puede abrir '{ $file }' para escritura: Permiso denegado
logrotate-usage =
    logrotate 3.21.0 - Copyright (C) 1995-2001 Red Hat, Inc.
    This may be freely redistributed under the terms of the GNU General Public License

    Usage: logrotate [-dfv?] [-d|--debug] [-f|--force] [-v|--verbose] <configfile>
pkill-usage =
    pkill: no matching criteria specified
    Try `pkill --help' for more information.
killall-usage = Usage: killall [-s SIGNAL | -SIGNAL] [-u user] [-v] name...
# { $name }: el nombre del programa dado a killall
killall-none = killall: { $name }: no process found
# { $name }: el nombre del programa, { $pid }: el número del proceso
killall-not-allowed = { $name }({ $pid }): Operation not permitted

# ionice seguido de un comando: el juego solo puede ajustar procesos que ya están en marcha.
ionice-command = ionice: aquí, solo para un proceso que ya está en marcha (ionice -p PID, o ionice -c 3 -p PID). Mira man ionice.
