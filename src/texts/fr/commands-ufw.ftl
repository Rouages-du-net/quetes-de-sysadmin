### ufw (pare-feu) : ses messages suivent la traduction française d'ufw.
### Les mots-clés (allow, deny, incoming…) et les noms d'actions (ALLOW,
### DENY…) restent en anglais, comme dans le vrai ufw.

ufw-usage =
    Usage : ufw COMMANDE (voir man ufw)
      enable | disable                 activer ou désactiver le pare-feu
      default allow|deny|reject        politique par défaut (entrant)
      allow|deny|reject|limit RÈGLE    ajouter une règle (ex. : ufw allow 22/tcp)
      delete RÈGLE|NUMÉRO              supprimer une règle
      status [verbose|numbered]        état et règles
      app list                         profils d'applications
ufw-root = ERREUR : Vous devez être root pour exécuter ce script
ufw-missing = ERREUR : ufw n'est pas installé sur cette machine
ufw-syntax = ERREUR : syntaxe invalide
ufw-idle = État : inactif
ufw-status-active = État : actif
ufw-journalisation = Journalisation : activée (faible)
# { $incoming }, { $outgoing } : allow, deny ou reject (non traduits)
ufw-defaults = Par défaut : { $incoming } (entrant), { $outgoing } (sortant), disabled (routé)
ufw-profiles = Nouveaux profils : skip
# En-têtes du tableau de ufw status
ufw-to = Vers
ufw-action = Action
ufw = De
ufw-everywhere = N'importe où
ufw-question = La commande peut perturber les connexions ssh existantes. Poursuivre l'opération (o|n) ?
# { $rule } : la règle, ex. « allow 22/tcp »
ufw-question-deletion =
    Suppression :
     { $rule }
    Poursuivre l'opération (o|n) ?
ufw-abandon = Abandonné
ufw-active = Le pare-feu est actif et lancé au démarrage du système
ufw-already-active = Le pare-feu est déjà actif et lancé au démarrage du système
ufw-disabled = Pare-feu arrêté et désactivé au démarrage du système
ufw-default-incoming =
    La politique par défaut pour les entrées est passée à « { $policy } »
    (assurez-vous de mettre à jour vos règles en conséquence)
ufw-default-outgoing =
    La politique par défaut pour les sorties est passée à « { $policy } »
    (assurez-vous de mettre à jour vos règles en conséquence)
ufw-rules-updates = Règles mises à jour
ufw-existing = Règle existante ignorée
ufw-rule-deleted = Règle supprimée
ufw-nonexistent = Impossible de supprimer une règle inexistante
ufw-number = ERREUR : Impossible de trouver la règle numéro « { $number } »
ufw-applications = Applications disponibles :
