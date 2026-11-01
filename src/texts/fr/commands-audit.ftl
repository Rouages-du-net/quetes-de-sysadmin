### Commandes d'audit (src/engine/commands/nmap.ts et lynis.ts) : nmap et
### lynis répondent en anglais, comme les vrais outils ; seuls les messages
### propres au jeu sont ici.

nmap-none-target = WARNING: No targets were specified, so 0 hosts scanned.
lynis-without-root = Lynis a besoin de root pour lire toute la configuration (essaie : sudo lynis audit system).
lynis-usage = Utilisation : lynis audit system  (voir man lynis)
lynis-audit-target = Lynis ne sait auditer ici que « audit system » (reçu : « audit { $target } »).
lynis-command-unknown = lynis : « { $command } » n'est pas une commande que ce jeu connaît (voir man lynis).
