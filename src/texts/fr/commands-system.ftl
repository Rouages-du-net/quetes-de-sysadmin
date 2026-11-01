### Commandes système (src/engine/commands/system.ts) : ps, kill,
### systemctl. Les sorties en anglais de ps et systemctl restent dans le code,
### comme sur un vrai système.

kill-usage = Usage : kill PID (le numéro du processus, donné par ps)
# { $pid } : le numéro tapé
kill-none = kill : ({ $pid }) - Aucun processus de ce type
kill-not-allowed = kill : ({ $pid }) - Opération non permise
systemctl-usage = Usage : systemctl status service (ex. : systemctl status nginx ; voir man systemctl)
# Première ligne : message de systemctl (en anglais) ; seconde : conseil du jeu.
systemctl-access-refuse =
    Failed to { $action } { $service }.service: Access denied
    (il faut être root : sudo systemctl { $action } { $service })
journalctl-argument = journalctl : argument inattendu « { $argument } » (pour un service : journalctl -u { $argument })
reboot-refuse =
    Failed to reboot system: Access denied
    (il faut être root : sudo reboot)

## Journaux (truncate, logrotate)

truncate-size = truncate: vous devez spécifier « --size »
truncate-operand =
    truncate: opérande de fichier manquant
    Saisissez « truncate --help » pour plus d'informations.
# { $size } : la taille donnée
truncate-size-incorrect = truncate: Taille incorrecte : « { $size } »
# { $file } : le fichier
truncate-directory = truncate: impossible d'ouvrir '{ $file }' en écriture: Est un dossier
truncate-permission = truncate: impossible d'ouvrir '{ $file }' en écriture: Permission non accordée
logrotate-usage =
    logrotate 3.21.0 - Copyright (C) 1995-2001 Red Hat, Inc.
    This may be freely redistributed under the terms of the GNU General Public License

    Usage: logrotate [-dfv?] [-d|--debug] [-f|--force] [-v|--verbose] <configfile>
pkill-usage =
    pkill: no matching criteria specified
    Try `pkill --help' for more information.

# ionice suivi d'une commande : le jeu ne sait régler que des processus déjà lancés.
ionice-command = ionice : ici, seulement pour un processus qui tourne déjà (ionice -p PID, ou ionice -c 3 -p PID). Voir man ionice.
