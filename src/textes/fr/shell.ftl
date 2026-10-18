### Le shell : invite, sudo, tubes et redirections, man, et les messages
### d'erreur communs à plusieurs commandes (repris des coreutils et de bash
### en français). { $commande } : nom de la commande ; { $cible } : chemin.

## Messages communs

erreur-introuvable = { $commande } : { $cible } : aucun fichier ou dossier de ce nom
erreur-est-un-dossier = { $commande } : { $cible } : est un dossier
erreur-permission = { $commande } : { $cible } : Permission non accordée
erreur-binaire = { $commande } : { $cible } : fichier binaire (une archive : pour voir ce qu'elle contient, tar -tf { $cible })
erreur-creation-permission = { $commande } : impossible de créer '{ $cible }' : Permission non accordée
erreur-espace = { $commande } : erreur d'écriture : Aucun espace disponible sur le périphérique

## sudo

# Message que sudo affiche la première fois qu'on l'utilise (traduit).
sudo-sermon =
    Nous espérons que vous avez reçu les instructions habituelles de l'administrateur système local. Cela se résume généralement à ces trois choses :

        #1) Respectez la vie privée des autres.
        #2) Réfléchissez avant de taper.
        #3) De grands pouvoirs confèrent de grandes responsabilités.
# { $utilisateur } : nom de l'utilisateur (identifiant technique)
sudo-invite = [sudo] Mot de passe de { $utilisateur } :
sudo-mauvais-mot-de-passe = Désolé, essayez de nouveau.
sudo-trois-echecs = sudo : 3 saisies de mots de passe incorrectes
sudo-pas-encore = sudo : tu n’as pas encore cette commande dans ce chapitre.
sudo-cd =
    sudo : cd : commande introuvable
    (cd fait partie du shell lui-même, sudo ne peut pas le lancer. Avec sudo, on regarde et on agit à distance : sudo ls lieu, sudo cat fichier…)

## Lignes de commande, tubes et redirections

# { $operateur } : > ou >>
syntaxe-redirection = erreur de syntaxe : il manque un nom de fichier après { $operateur }
syntaxe-tube = erreur de syntaxe près du symbole « | »
redirection-est-un-dossier = { $cible } : est un dossier
redirection-permission = { $cible } : Permission non accordée
redirection-sudo = (La redirection > est faite par ton propre shell, pas par sudo. Astuce : envoie le texte dans « sudo tee -a fichier », qui écrit en tant que root.)
commande-pas-encore = { $commande } : tu n’as pas encore cette commande dans ce chapitre. Tape « aide » pour la liste.
commande-introuvable = { $commande } : commande introuvable. Tape « aide » pour la liste.
# { $commandes } : liste des commandes, séparées par des virgules
aide-commandes =
    Commandes connues : { $commandes }.
    Pour en savoir plus : « man commande » (le manuel complet), « commande --help » (un résumé), « man -k mot » (trouver une commande par mot-clé).

## man, apropos, whatis (messages de man-db)

manuel-pas-encore = (Tu n’as pas encore cette commande dans ce chapitre.)
manuel-quoi-chercher = { $commande } : que faut-il chercher ?
manuel-rien = { $mot } : rien d'approprié.
manuel-quelle-page =
    Quelle page de manuel voulez-vous ?
    Par exemple, essayez « man man ».
manuel-pas-de-page = Il n'y a pas de page de manuel pour { $commande }.
