### Le poste : la machine de départ, d'où l'on se connecte en ssh aux
### machines des histoires. Et le message d'accueil (motd) de chaque machine.

poste-bienvenue =
    Bienvenue sur ton poste de travail.

    Chaque histoire se passe sur une machine du réseau. Pour t'y connecter,
    on utilise ssh (Secure Shell), comme le font tous les jours celles et ceux
    qui administrent des serveurs. Commence par le royaume :

      ssh royaume

    La première fois, ssh te demandera si tu fais confiance à cette machine :
    réponds yes. Une fois connecté·e, l'invite change (vous@royaume). Pour
    revenir ici :

      exit

    Les machines que tu connais sont dans ~/.ssh/config, et tes clés dans le
    dossier caché ~/.ssh. Pour l'instant, tu n'as que la clé du royaume ;
    termine l'Effaceur pour recevoir les autres. Pour les voir :

      ls -a ~/.ssh
# Commentaire en tête de ~/.ssh/config (chaque ligne devient un commentaire « # »)
poste-config-commentaire =
    Les machines que tu connais. « ssh royaume » se connecte à royaume.example
    avec l'utilisateur vous et la clé ~/.ssh/id_royaume.
    Manuel : man ssh
poste-exit = (Tu es sur ton propre poste : exit fermerait ton terminal. Pour te connecter à une machine : ssh nom, par exemple ssh royaume.)
# { $cles } : la liste des nouvelles clés, séparées par des virgules
poste-cles-recues =
    🔑 Le royaume te remercie : de nouvelles clés SSH t'attendent sur ton poste
    ({ $cles }). Reviens-y (exit), regarde ~/.ssh/config, et connecte-toi à la
    machine de ton choix.

## Messages d'accueil des machines (motd), affichés à la connexion

machine-royaume-motd = Royaume — serveur de la gardienne du phare. Accès réservé aux voyageur·ses munis d'une clé.
machine-datacenter-motd = Datacenter — serveur web de la médiathèque. Toute intervention est journalisée.
machine-fourmiliere-motd = La Fourmilière — l'ordinateur du café associatif. « Merci de venir nous aider ! » (Kofi)
machine-manuscrit-motd = Manuscrit — l'ordinateur d'Inès. Ne pas toucher au roman sans sauvegarde !
machine-bibliotheque-motd = Bibliothèque du quartier — ce serveur sera éteint ce soir à minuit.
