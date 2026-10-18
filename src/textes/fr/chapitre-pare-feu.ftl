### Histoire « Les Lettres du quartier », chapitre « Le pare-feu » : ufw.
### Les commandes, ports, adresses et mots-clés d'ufw (allow, deny…) ne se
### traduisent pas ; la sortie de nmap et de ss reste en anglais.

chapitre-pare-feu = Le pare-feu
    .resume = Qui écoute, et qui peut entrer : ss, ufw, et toujours ne pas s'enfermer dehors.

## Fichiers

pare-feu-courriel-kofi =
    De :     Kofi (La Fourmilière)
    À :      toi
    Objet :  Une porte de trop ?

    Mon amie Yasmine, qui travaille dans la sécurité, a « scanné » notre
    serveur depuis chez elle (avec notre accord !). Son rapport est dans
    ~/scan_yasmine.txt. Elle dit que la porte 3306, c'est la base de données
    du site, et qu'elle n'a rien à faire sur internet.

    Peux-tu installer un pare-feu ? Il faut que :

    1. le site reste joignable par tout le monde (http et https) ;
    2. tu puisses toujours te connecter en SSH depuis ton poste ;
    3. tout le reste soit refusé, à commencer par la base de données.

    Yasmine conseille ufw, déjà installé (man ufw). Elle a ajouté : « Et
    surtout, autorise SSH AVANT d'activer le pare-feu. » Pour sudo, c'est
    toujours le même mot de passe.

## Événements

pare-feu-evenement-ecoute =
    Regarde la colonne « Local Address » : 0.0.0.0:3306 veut dire que MariaDB
    écoute sur TOUTES les interfaces, donc que n'importe qui sur internet
    peut frapper à cette porte. php-fpm, lui, n'écoute que sur 127.0.0.1 : il
    n'est joignable que depuis la machine elle-même.
pare-feu-evenement-enferme =
    ATTENTION : le pare-feu est actif et bloque SSH. Ta session tient (le
    pare-feu laisse passer les connexions déjà établies), mais toute nouvelle
    connexion échouera. Autorise SSH maintenant, avant de te déconnecter !
pare-feu-evenement-site-coupe =
    Le pare-feu est actif… et le site des Lettres ne répond plus : http (80)
    et https (443) sont bloqués. Kofi va recevoir des messages inquiets.
pare-feu-evenement-base-ouverte =
    Le pare-feu est actif, mais la base de données (3306) est toujours
    joignable depuis internet. Relis la demande de Kofi.
pare-feu-evenement-filtre =
    Le pare-feu filtre comme il faut : le site répond à tout le monde, SSH à
    toi, et la base de données à personne de l'extérieur. Vérifie avec
    sudo ufw status verbose.

    Dernière étape, comme pour SSH : vérifier que tu peux toujours entrer.
    exit, puis ssh lettres.
pare-feu-evenement-fin =
    Nouvelle connexion réussie : le pare-feu laisse passer SSH. Yasmine
    relance son scan : 22, 80 et 443 ouverts, 3306 filtré. Kofi : « Elle dit
    que c'est du beau travail ! »

    Bravo ! Tu as terminé le chapitre « Le pare-feu ».

    CE QUI S'EST PASSÉ
    Un programme qui écoute sur 0.0.0.0 est joignable depuis tout internet,
    même quand on ne s'en sert que localement : c'était le cas de la base de
    données. Le pare-feu refuse maintenant tout ce qui entre, sauf les portes
    utiles.

    LA BONNE PRATIQUE
    - Commencer par regarder qui écoute : sudo ss -tlnp.
    - ufw default deny incoming, puis autoriser une à une les portes utiles.
    - Autoriser SSH AVANT ufw enable, et tester une nouvelle connexion.
    - Mieux encore : ufw limit OpenSSH (freine la force brute), ou
      n'autoriser SSH que depuis ses propres adresses.
    - Le pare-feu n'excuse pas une mauvaise configuration : une base de
      données locale doit aussi n'écouter que sur 127.0.0.1 (bind-address).

    LA DOCUMENTATION
    - ufw : https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss : https://man7.org/linux/man-pages/man8/ss.8.html
