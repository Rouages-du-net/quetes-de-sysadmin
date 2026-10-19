### Histoire « La Coopérative », chapitre « Les droits partagés » : un
### dossier d'équipe (setgid, umask) et une règle sudo étroite (visudo).
### Les commandes, les chemins et la syntaxe de sudoers ne se traduisent pas.

chapitre-droits = Les droits partagés
    .resume = Un dossier où l'équipe caisse peut vraiment travailler à plusieurs (setgid, umask), et le droit de relancer la caisse, rien de plus (visudo).

## Fichiers

droits-courriel-awa =
    De :     Awa
    À :      toi
    Objet :  L'équipe caisse

    Deux soucis avec l'équipe caisse (Lina et Karim, groupe caisse) :

    1. Les relevés du jour sont dans /srv/caisse/releves. Lina ne peut pas
       corriger ceux de Karim, et inversement. Pourtant, ils sont tous les
       deux dans le groupe caisse ! Regarde ls -l. Il faut que tout ce qu'ils
       y créent, aujourd'hui et demain, appartienne au groupe caisse et que
       le groupe puisse l'écrire (man chmod, man umask).

    2. Quand la caisse se fige, ils doivent appeler quelqu'un qui a sudo
       pour lancer systemctl restart caisse. Marc leur donnait son mot de
       passe… Donne-leur le droit de relancer la caisse, et RIEN d'autre
       (man sudoers, man visudo ; sudo -l -U lina pour vérifier).

    Pour sudo, ton mot de passe est toujours : radis-2027

droits-releve-17 =
    Relevé de caisse — dimanche 17 octobre (Lina)
    Fond de caisse : 150,00
    Ventes : 1 243,60
droits-releve-18 =
    Relevé de caisse — lundi 18 octobre (Karim)
    Fond de caisse : 150,00
    Ventes : 987,20

## Événements

droits-evenement-sudoers-casse =
    sudo est cassé : la politique a une erreur (relis le message), et sudo
    refuse alors TOUT, même à toi. C'est pour ça qu'on modifie sudoers avec
    visudo, qui vérifie avant d'enregistrer.

    Sur un vrai serveur, il faudrait la console de secours de l'hébergeur
    (ou pkexec). Ici : « Recommencer ce chapitre », sous le terminal.
# { $fichier } : le fichier de règles ignoré
droits-evenement-fichier-ignore =
    Ta règle est dans { $fichier }… que sudo ne lit pas ! @includedir ignore
    les fichiers dont le nom contient un point ou finit par ~ (relis
    /etc/sudoers.d/README). Donne-lui un nom sans point, comme
    /etc/sudoers.d/caisse.
droits-evenement-trop-large =
    Attention : avec cette règle, Lina et Karim peuvent lancer un shell
    root (sudo bash), donc TOUT faire. Ce n'est pas ce qu'Awa demande :
    seulement relancer la caisse, avec le chemin complet de la commande et
    ses arguments.
droits-evenement-systemctl-entier =
    Presque : avec systemctl sans arguments, Lina et Karim peuvent relancer
    la caisse… mais aussi arrêter ssh ou n'importe quel service. Écris la
    commande entière : chemin, et arguments.
droits-evenement-sudo =
    sudo -l -U lina le confirme : l'équipe caisse peut relancer la caisse,
    et rien d'autre.
# { $dossier } : le dossier partagé
droits-evenement-dossier =
    { $dossier } appartient maintenant au groupe caisse, qui peut y écrire, et
    porte le bit setgid (le s de drwxrwsr-x) : tout ce qui y sera créé prendra
    le groupe caisse. Reste ce qui y est déjà, et les droits que Lina et Karim
    donneront à leurs prochains fichiers (umask).
droits-evenement-masque =
    Lina et Karim auront le masque 002 à leur prochaine connexion : leurs
    nouveaux fichiers seront rw-rw-r--, modifiables par le groupe.
droits-evenement-fin =
    Le lendemain : Lina enregistre son relevé (-rw-rw-r-- lina caisse),
    Karim corrige une virgule sans demander à personne, et quand la caisse se
    fige à midi, il la relance lui-même avec sudo. Awa : « Plus de mot de
    passe qui circule ! »

    Bravo ! Tu as terminé le chapitre « Les droits partagés ».

    CE QUI S'EST PASSÉ
    Un fichier appartient au groupe principal de la personne qui le crée, avec
    les droits que laisse son masque (umask 022 : rw-r--r--). Pour travailler
    à plusieurs, il faut les deux : le bit setgid sur le dossier (le groupe du
    dossier passe aux nouveaux fichiers) et un masque 002 (le groupe peut
    écrire). Et sudo n'est pas tout ou rien : une règle peut ne permettre
    qu'une commande précise, à un groupe précis.

    LA BONNE PRATIQUE
    - Dossier d'équipe : chgrp équipe, chmod 2775 (ou g+ws), puis
      chgrp -R et chmod -R g+w pour l'existant.
    - umask 002 dans le ~/.profile de l'équipe (ou /etc/profile.d).
    - Toujours visudo (-f pour /etc/sudoers.d/nom-sans-point), des chemins
      complets (which), les arguments écrits en entier ; vérifier avec
      sudo -l -U compte.
    - Ne jamais partager un mot de passe : donner un droit précis à chaque
      personne.

    LA DOCUMENTATION
    - sudoers : https://www.sudo.ws/docs/man/sudoers.man/
    - visudo : https://www.sudo.ws/docs/man/visudo.man/
    - setgid sur les dossiers : https://www.gnu.org/software/coreutils/manual/html_node/Directory-Setuid-and-Setgid.html
