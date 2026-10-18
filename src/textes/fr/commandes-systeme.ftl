### Commandes système (src/moteur/commandes/systeme.ts) : ps, kill,
### systemctl. Les sorties en anglais de ps et systemctl restent dans le code,
### comme sur un vrai système.

kill-usage = Usage : kill PID (le numéro du processus, donné par ps)
# { $pid } : le numéro tapé
kill-aucun = kill : ({ $pid }) - Aucun processus de ce type
kill-non-permise = kill : ({ $pid }) - Opération non permise
systemctl-usage = Usage : systemctl status service (ex. : systemctl status nginx ; voir man systemctl)
# Première ligne : message de systemctl (en anglais) ; seconde : conseil du jeu.
systemctl-acces-refuse =
    Failed to { $action } { $service }.service: Access denied
    (il faut être root : sudo systemctl { $action } { $service })
journalctl-argument = journalctl : argument inattendu « { $argument } » (pour un service : journalctl -u { $argument })
journalctl-suivre = (journalctl -f suit le journal en continu, jusqu'à Ctrl+C : le jeu ne le simule pas. Essaie journalctl -n 20.)
reboot-refuse =
    Failed to reboot system: Access denied
    (il faut être root : sudo reboot)

## Journaux (truncate, logrotate)

truncate-taille = truncate: vous devez spécifier « --size »
truncate-operande =
    truncate: opérande de fichier manquant
    Saisissez « truncate --help » pour plus d'informations.
# { $taille } : la taille donnée
truncate-taille-incorrecte = truncate: Taille incorrecte : « { $taille } »
# { $fichier } : le fichier
truncate-dossier = truncate: impossible d'ouvrir '{ $fichier }' en écriture: Est un dossier
truncate-permission = truncate: impossible d'ouvrir '{ $fichier }' en écriture: Permission non accordée
logrotate-usage =
    logrotate 3.21.0 - Copyright (C) 1995-2001 Red Hat, Inc.
    This may be freely redistributed under the terms of the GNU General Public License

    Usage: logrotate [-dfv?] [-d|--debug] [-f|--force] [-v|--verbose] <configfile>
