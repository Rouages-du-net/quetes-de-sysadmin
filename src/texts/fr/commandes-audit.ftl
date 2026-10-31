### Commandes d'audit (src/engine/commands/nmap.ts et lynis.ts) : nmap et
### lynis répondent en anglais, comme les vrais outils ; seuls les messages
### propres au jeu sont ici.

nmap-aucune-cible = WARNING: No targets were specified, so 0 hosts scanned.
lynis-sans-root = Lynis a besoin de root pour lire toute la configuration (essaie : sudo lynis audit system).
lynis-usage = Utilisation : lynis audit system  (voir man lynis)
lynis-audit-cible = Lynis ne sait auditer ici que « audit system » (reçu : « audit { $cible } »).
lynis-commande-inconnue = lynis : « { $commande } » n'est pas une commande que ce jeu connaît (voir man lynis).
