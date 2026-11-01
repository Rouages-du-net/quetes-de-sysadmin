### Histoire « La Maison des associations », chapitre « Les clés » : créer
### sa paire de clés, la poser sur le serveur, puis refuser les mots de passe.
### Les mots-clés de sshd_config, les commandes, les chemins et les messages
### d'OpenSSH (en anglais) ne se traduisent pas.

chapitre-keys = Les clés
    .resume = Ton compte a un mot de passe provisoire (lilas-2027) : ssh-keygen, ssh-copy-id, puis plus de mots de passe du tout.

## Fichiers

# { $motdepasse } : le mot de passe provisoire du compte
keys-courriel-yasmine =
    De :     Yasmine (coordinatrice de la Maison des associations)
    À :      toi
    Objet :  Bienvenue dans l'équipe !

    Merci d'avoir accepté de reprendre l'informatique de la Maison ! Gaspard,
    qui s'en occupait depuis dix ans, a déménagé à Lyon ; il reste joignable,
    mais il ne peut plus passer.

    La machine « maison » est notre passerelle : c'est la seule qu'on voit
    depuis internet. Derrière elle, il y a le wiki des associations et le
    serveur des archives (tu les découvriras bientôt).

    Je t'ai créé un compte (vous) avec un mot de passe provisoire :
    { $motdepasse }. C'est avec lui que tu entres, pour l'instant. Gaspard disait
    qu'un mot de passe sur un serveur ouvert à internet, c'est une porte
    entrouverte. Alors avant toute chose :

    1. Crée ta propre paire de clés SSH, sur TON poste (man ssh-keygen).
    2. Pose ta clé publique sur maison (man ssh-copy-id), puis reconnecte-toi :
       ssh ne doit plus te demander de mot de passe.
    3. Ensuite seulement, fais refuser les mots de passe par le serveur SSH
       (/etc/ssh/sshd_config, man sshd_config), et vérifie que tu entres
       toujours.

    Pour sudo, c'est le même mot de passe provisoire : sudo en demandera
    toujours un, même quand ssh n'en voudra plus.

## Événements

# { $config } : le chemin du fichier de configuration
keys-evenement-erreur =
    Il y a une erreur dans la configuration de SSH. Avant de recharger,
    vérifie toujours avec  sudo sshd -t : il donne le fichier et la ligne en
    cause. Tant qu'elle est fausse, systemctl reload ssh refuse de
    l'appliquer, et sshd garde l'ancienne.
keys-evenement-enferme =
    ATTENTION : sshd refuse maintenant les mots de passe… et aucune clé n'est
    autorisée pour ton compte (~/.ssh/authorized_keys). Ta session actuelle
    reste ouverte, mais une nouvelle connexion serait refusée !

    Remets PasswordAuthentication yes et recharge ssh, le temps de poser ta
    clé. L'ordre compte : d'abord la clé, ensuite la porte.
keys-evenement-cle-du-jeu =
    Une clé est arrivée dans ~/.ssh/authorized_keys… mais c'est une clé que le
    jeu t'a donnée pour une autre machine (regarde la fin de la ligne, et
    ls -lt ~/.ssh sur ton poste). Sans -i, ssh-copy-id prend la clé publique
    la plus récente de ~/.ssh ; et ssh, lui, ne la proposera pas à maison.

    Crée d'abord ta propre paire (ssh-keygen), puis recommence ssh-copy-id.
keys-evenement-copiee =
    Ta clé publique est dans ~/.ssh/authorized_keys sur maison. Regarde le
    fichier (cat) : une ligne « ssh-ed25519 AAAA… », la moitié publique de
    ta paire. La moitié privée, elle, n'a jamais quitté ton poste.

    Reconnecte-toi (exit, puis ssh maison) : cette fois, pas de mot de passe.
keys-evenement-par-cle =
    Entré·e par ta clé, sans mot de passe ! Le serveur t'a envoyé un défi que
    seule ta clé privée pouvait signer.

    Reste à fermer la porte aux mots de passe : un robot pourrait toujours
    essayer d'en deviner un. Dans /etc/ssh/sshd_config, cherche la ligne
    PasswordAuthentication (man sshd_config), puis sudo sshd -t et sudo
    systemctl reload ssh.
keys-evenement-fermee =
    sshd n'accepte plus que les clés. Avant de fermer cette session, teste :
    exit, puis ssh maison. (Sur un vrai serveur, on garde la session ouverte
    et on teste dans un deuxième terminal.)
keys-evenement-fin =
    Entré·e par ta clé, et les mots de passe sont refusés : la passerelle est
    fermée aux robots, mais pas à toi. Yasmine : « Gaspard sera fier de toi ! »

    Bravo ! Tu as terminé le chapitre « Les clés ».

    CE QUI S'EST PASSÉ
    Une paire de clés, ce sont deux fichiers : la clé privée (~/.ssh/id_ed25519),
    qui reste sur ton poste, et la clé publique (id_ed25519.pub), qu'on peut
    donner à tout le monde. Le serveur garde les clés publiques autorisées dans
    ~/.ssh/authorized_keys ; à la connexion, il te demande de signer un défi
    avec la clé privée. Rien de secret ne voyage, et rien ne se devine.

    LA BONNE PRATIQUE
    - Générer sa clé sur sa propre machine (ssh-keygen -t ed25519), avec une
      phrase de passe ; ne jamais copier une clé privée ailleurs.
    - Poser la clé publique avec ssh-copy-id : il crée ~/.ssh et
      authorized_keys avec les bons droits (700 et 600).
    - Dans cet ordre : la clé, le test, puis PasswordAuthentication no.
    - Garder une session ouverte et tester avec une nouvelle connexion.

    LA DOCUMENTATION
    - ssh-keygen : https://man.openbsd.org/ssh-keygen
    - ssh-copy-id : https://manpages.debian.org/bookworm/openssh-client/ssh-copy-id.1.en.html
    - sshd_config : https://man.openbsd.org/sshd_config
