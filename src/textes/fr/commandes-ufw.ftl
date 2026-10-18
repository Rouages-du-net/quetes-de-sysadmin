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
ufw-absent = ERREUR : ufw n'est pas installé sur cette machine
ufw-syntaxe = ERREUR : syntaxe invalide
ufw-inactif = État : inactif
ufw-statut-actif = État : actif
ufw-journalisation = Journalisation : activée (faible)
# { $entrant }, { $sortant } : allow, deny ou reject (non traduits)
ufw-defauts = Par défaut : { $entrant } (entrant), { $sortant } (sortant), disabled (routé)
ufw-profils = Nouveaux profils : skip
# En-têtes du tableau de ufw status
ufw-vers = Vers
ufw-action = Action
ufw-de = De
ufw-partout = N'importe où
ufw-question = La commande peut perturber les connexions ssh existantes. Poursuivre l'opération (o|n) ?
# { $regle } : la règle, ex. « allow 22/tcp »
ufw-question-suppression =
    Suppression :
     { $regle }
    Poursuivre l'opération (o|n) ?
ufw-abandon = Abandonné
ufw-active = Le pare-feu est actif et lancé au démarrage du système
ufw-deja-actif = Le pare-feu est déjà actif et lancé au démarrage du système
ufw-desactive = Pare-feu arrêté et désactivé au démarrage du système
ufw-defaut-entrant =
    La politique par défaut pour les entrées est passée à « { $politique } »
    (assurez-vous de mettre à jour vos règles en conséquence)
ufw-defaut-sortant =
    La politique par défaut pour les sorties est passée à « { $politique } »
    (assurez-vous de mettre à jour vos règles en conséquence)
ufw-regles-mises-a-jour = Règles mises à jour
ufw-existante = Règle existante ignorée
ufw-regle-supprimee = Règle supprimée
ufw-inexistante = Impossible de supprimer une règle inexistante
ufw-numero = ERREUR : Impossible de trouver la règle numéro « { $numero } »
ufw-applications = Applications disponibles :
