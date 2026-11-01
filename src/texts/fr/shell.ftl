### Le shell : invite, sudo, tubes et redirections, man, et les messages
### d'erreur communs à plusieurs commandes (repris des coreutils et de bash
### en français). { $commande } : nom de la commande ; { $cible } : chemin.

## Messages communs

error-missing = { $commande } : { $cible } : aucun fichier ou dossier de ce nom
error-is-one-directory = { $commande } : { $cible } : est un dossier
error-permission = { $commande } : { $cible } : Permission non accordée
error-binary = { $commande } : { $cible } : fichier binaire (une archive : pour voir ce qu'elle contient, tar -tf { $cible })
error-creation-permission = { $commande } : impossible de créer '{ $cible }' : Permission non accordée
error-space = { $commande } : erreur d'écriture : Aucun espace disponible sur le périphérique

## sudo

# Message que sudo affiche la première fois qu'on l'utilise (traduit).
sudo-lecture =
    Nous espérons que vous avez reçu les instructions habituelles de l'administrateur système local. Cela se résume généralement à ces trois choses :

        #1) Respectez la vie privée des autres.
        #2) Réfléchissez avant de taper.
        #3) De grands pouvoirs confèrent de grandes responsabilités.
# { $utilisateur } : nom de l'utilisateur (identifiant technique)
sudo-prompt = [sudo] Mot de passe de { $utilisateur } :
sudo-bad-password = Désolé, essayez de nouveau.
sudo-three-failures = sudo : 3 saisies de mots de passe incorrectes
sudo-not-still = sudo : tu n’as pas encore cette commande dans ce chapitre.
sudo-cd =
    sudo : cd : commande introuvable
    (cd fait partie du shell lui-même, sudo ne peut pas le lancer. Avec sudo, on regarde et on agit à distance : sudo ls lieu, sudo cat fichier…)

## Lignes de commande, tubes et redirections

# { $operateur } : > ou >>
syntax-redirection = erreur de syntaxe : il manque un nom de fichier après { $operateur }
syntax-pipe = erreur de syntaxe près du symbole « | »
redirection-is-one-directory = { $cible } : est un dossier
redirection-permission = { $cible } : Permission non accordée
redirection-sudo = (La redirection > est faite par ton propre shell, pas par sudo. Astuce : envoie le texte dans « sudo tee -a fichier », qui écrit en tant que root.)
command-not-still = { $commande } : tu n’as pas encore cette commande dans ce chapitre. Tape « aide » pour la liste.
command-missing = { $commande } : commande introuvable. Tape « aide » pour la liste.
# { $commandes } : liste des commandes, séparées par des virgules
# Le nom de la commande qui liste les autres, dans la langue (aide, help)
command-help = aide
help-commands =
    Commandes connues : { $commandes }.
    Pour en savoir plus : « man commande » (le manuel complet), « commande --help » (un résumé), « man -k mot » (trouver une commande par mot-clé).

## man, apropos, whatis (messages de man-db)

manual-not-still = (Tu n’as pas encore cette commande dans ce chapitre.)
manual-what-search = { $commande } : que faut-il chercher ?
manual-nothing = { $mot } : rien d'approprié.
manual-which-page =
    Quelle page de manuel voulez-vous ?
    Par exemple, essayez « man man ».
manual-not-page = Il n'y a pas de page de manuel pour { $commande }.

## Scripts (/bin/sh) : crochets de git, scripts de déploiement (src/engine/script.ts)

# { $script } : le nom du script ; { $numero } : la ligne ; { $mot } : le mot du shell
script-not-simulated = { $script }: { $numero }: « { $mot } » : cette construction du shell n'est pas simulée dans ce jeu (ni if, ni for, ni while). Écrire une commande par ligne, avec && ou || pour les enchaîner.
# { $script } : le nom du script ; { $numero } : la ligne
test-hook-missing = { $script }: { $numero }: [: missing ]
# { $operateur } : ce qui a été donné à test
test-operator = { $operateur }: unexpected operator
test-too-arguments = too many arguments
# { $fichier } : le script demandé
sh-missing = sh: 0: cannot open { $fichier }: No such file
sh-interactive = (Dans ce jeu, sh lance un script : sh fichier. Le shell interactif, c'est déjà celui où tu tapes.)
# { $argument } : ce qui n'a pas été compris
date-invalid = date: date incorrecte « { $argument } »
# Le format de date sans argument, comme date avec LANG=fr_FR.UTF-8
date-format = %a %e %b %Y %T %Z
readlink-operand =
    readlink: opérande manquant
    Saisissez « readlink --help » pour plus d'informations.
# Lancer ./script : { $commande } est le chemin tapé
script-missing = bash: { $commande }: Aucun fichier ou dossier de ce nom
script-directory = bash: { $commande }: est un dossier
script-permission = bash: { $commande }: Permission non accordée

## Disques (mount, umount)

mount-usage =
    Usage:
     mount [-lhV]
     mount -a [options]
     mount [options] [--source] <source> | [--target] <directory>
     mount [options] <source> <directory>
    (Ici : mount, ou sudo mount [-o ro] périphérique point_de_montage ; voir man mount)
# sfdisk sans script : le vrai sfdisk ouvrirait un dialogue (écart du jeu)
sfdisk-interactive =
    sfdisk : le mode interactif n'existe pas dans ce jeu. Donne-lui un script
    sur son entrée standard : par exemple la table d'un autre disque,
    sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (voir man sfdisk).
# mdadm --create d'un autre niveau que RAID 1 (écart du jeu)
# { $niveau } : le niveau demandé
mdadm-level = mdadm : dans ce jeu, seul le RAID 1 (--level=1) est simulé, pas « { $niveau } ».
update-initramfs-usage =
    Usage: update-initramfs {"{"} -c | -d | -u {"}"} [-k version] [-v] [-b directory]
umount-usage =
    Usage:
     umount [-hV]
     umount <source> | <directory> [options]
# { $commande } : la commande ; { $cible } : le chemin
error-read-only = { $commande }: { $cible }: Système de fichiers accessible en lecture seulement

# sudo -u avec un compte qui n'existe pas ; { $compte } : le nom donné
sudo-account-unknown = sudo: unknown user { $compte }

# Un joker qui donne trop de noms : la limite des arguments d'un programme (ARG_MAX).
# { $programme } : le chemin du programme, ex. /usr/bin/rm
list-arguments-too-long = bash: { $programme }: Liste d'arguments trop longue
sudo-list-arguments-too-long = sudo: impossible d'exécuter { $programme }: Liste d'arguments trop longue
date-option-argument =
    date: l'option requiert un argument -- 's'
    Saisissez « date --help » pour plus d'informations.
date-setting-refuse = date: impossible de régler la date: Opération non permise

## Clins d'œil (voir OEUFS dans src/engine/shell.ts) : en anglais, comme leurs originaux

egg-xyzzy = Nothing happens.
egg-sandwich-refusal = What? Make it yourself.
egg-sandwich = Okay.
egg-sl =
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

# --color=QUAND inconnu (ls, grep, diff), comme coreutils en français.
colour-argument-invalid =
    { $commande } : argument « { $valeur } » incorrect pour « --color »
    Les arguments valables sont :
      - « always », « yes », « force »
      - « never », « no », « none »
      - « auto », « tty », « if-tty »
    Saisissez « { $commande } --help » pour plus d'informations.
