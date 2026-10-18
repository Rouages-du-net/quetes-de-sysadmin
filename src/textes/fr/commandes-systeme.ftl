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
