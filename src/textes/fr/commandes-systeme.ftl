### Commandes système (src/moteur/commandes/systeme.ts) : ps, kill,
### systemctl. Les sorties en anglais de ps et systemctl restent dans le code,
### comme sur un vrai système.

kill-usage = Usage : kill PID (le numéro du processus, donné par ps)
# { $pid } : le numéro tapé
kill-aucun = kill : ({ $pid }) - Aucun processus de ce type
kill-non-permise = kill : ({ $pid }) - Opération non permise
systemctl-usage = Usage : systemctl status service (ex. : systemctl status nginx)
systemctl-action-inconnue = systemctl : action inconnue « { $action } »
# Première ligne : message de systemctl (en anglais) ; seconde : conseil du jeu.
systemctl-acces-refuse =
    Failed to { $action } { $service }.service: Access denied
    (il faut être root : sudo systemctl { $action } { $service })
