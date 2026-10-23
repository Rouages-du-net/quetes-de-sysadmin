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

## Scripts (/bin/sh) : crochets de git, scripts de déploiement (src/moteur/script.ts)

# { $script } : le nom du script ; { $numero } : la ligne ; { $mot } : le mot du shell
script-non-simule = { $script }: { $numero }: « { $mot } » : cette construction du shell n'est pas simulée dans ce jeu (ni if, ni for, ni while). Écrire une commande par ligne, avec && ou || pour les enchaîner.
# { $script } : le nom du script ; { $numero } : la ligne
test-crochet-manquant = { $script }: { $numero }: [: missing ]
# { $operateur } : ce qui a été donné à test
test-operateur = { $operateur }: unexpected operator
test-trop-d-arguments = too many arguments
# { $fichier } : le script demandé
sh-introuvable = sh: 0: cannot open { $fichier }: No such file
sh-interactif = (Dans ce jeu, sh lance un script : sh fichier. Le shell interactif, c'est déjà celui où tu tapes.)
# { $argument } : ce qui n'a pas été compris
date-invalide = date: date incorrecte « { $argument } »
# Le format de date sans argument, comme date avec LANG=fr_FR.UTF-8
date-format = %a %e %b %Y %T %Z
readlink-operande =
    readlink: opérande manquant
    Saisissez « readlink --help » pour plus d'informations.
# Lancer ./script : { $commande } est le chemin tapé
script-introuvable = bash: { $commande }: Aucun fichier ou dossier de ce nom
script-dossier = bash: { $commande }: est un dossier
script-permission = bash: { $commande }: Permission non accordée

## Disques (mount, umount)

mount-usage =
    Usage:
     mount [-lhV]
     mount -a [options]
     mount [options] [--source] <source> | [--target] <directory>
     mount [options] <source> <directory>
    (Ici : mount, ou sudo mount [-o ro] périphérique point_de_montage ; voir man mount)
umount-usage =
    Usage:
     umount [-hV]
     umount <source> | <directory> [options]
# { $commande } : la commande ; { $cible } : le chemin
erreur-lecture-seule = { $commande }: { $cible }: Système de fichiers accessible en lecture seulement

# sudo -u avec un compte qui n'existe pas ; { $compte } : le nom donné
sudo-compte-inconnu = sudo: unknown user { $compte }

# Un joker qui donne trop de noms : la limite des arguments d'un programme (ARG_MAX).
# { $programme } : le chemin du programme, ex. /usr/bin/rm
liste-arguments-trop-longue = bash: { $programme }: Liste d'arguments trop longue
sudo-liste-arguments-trop-longue = sudo: impossible d'exécuter { $programme }: Liste d'arguments trop longue
date-option-argument =
    date: l'option requiert un argument -- 's'
    Saisissez « date --help » pour plus d'informations.
date-reglage-refuse = date: impossible de régler la date: Opération non permise

## Clins d'œil (voir OEUFS dans src/moteur/shell.ts) : en anglais, comme leurs originaux

oeuf-xyzzy = Nothing happens.
oeuf-sandwich-refus = What? Make it yourself.
oeuf-sandwich = Okay.
oeuf-sl =
          ====        ________                ___________
      _D _|  |_______/        \__I_I_____===__|_________|
       |(_)---  |   H\________/ |   |        =|___ ___|
       /     |  |   H  |  |     |   |         ||_| |_||
      |      |  |   H  |__--------------------| (___) |
      | ________|___H__/__|_____/(__)~\_______|       |
      |/ |   |-----------I_____I (__) (__)  D |=======|__
    __/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
     |/-=|___|=    ||    ||    ||    |_____/~\___/
      \_/      \O=====O=====O=====O_/      \_/
