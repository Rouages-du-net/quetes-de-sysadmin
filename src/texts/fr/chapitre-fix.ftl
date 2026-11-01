### Histoire « La Veille », chapitre « Le correctif » : corriger nginx et
### rsync sans rien casser. Les commandes, les chemins et les sorties d'apt
### (en anglais) ne se traduisent pas.

chapter-fix = Le correctif
    .resume = Corriger nginx et rsync sans rien casser : apt update avant apt upgrade, puis vérifier que le site répond toujours.

## Fichiers

fix-email-salome =
    De :     Salomé
    À :      toi
    Objet :  Au tour du correctif

    L'ordre est décidé : nginx, puis rsync. Les deux ont un correctif Debian
    déjà publié, alors pas besoin de contournement provisoire ici : une mise
    à jour suffit (man apt).

    Un réflexe à ne jamais sauter : rafraîchir la liste des paquets avant de
    demander une mise à jour. Sans ça, apt ne sait pas qu'un correctif
    existe.

    Et après avoir corrigé : vérifie que le site répond toujours. Corriger
    une faille qui coupe le site serait un drôle de service à rendre à
    Nadia.

    Salomé
    (Pour sudo, ton mot de passe est toujours : levain-2028)

## Événements

fix-event-without-update =
    apt upgrade dit « Upgrading: 0 » : rien ne s'est passé. apt ne connaît
    les mises à jour disponibles qu'après avoir rafraîchi sa liste des
    paquets (sudo apt update), comme un catalogue qu'il faut recharger
    avant d'y chercher quelque chose de nouveau.
fix-event-fixed =
    nginx et rsync sont à la version corrigée. Encore une chose à vérifier
    avant de continuer : le site répond-il toujours ?
fix-event-checked =
    Le site répond (curl renvoie 200) : la mise à jour n'a rien cassé.
fix-event-end =
    Salomé : « Deux corrigées, le site toujours debout. C'est tout ce qu'on
    demande à une mise à jour. »

    Bravo ! Tu as terminé le chapitre « Le correctif ».

    CE QUI S'EST PASSÉ
    Les correctifs Debian des deux CVE retenues sont maintenant installés.
    apt upgrade installe toutes les mises à jour disponibles d'un coup (pas
    une par une), après avoir rafraîchi la liste des paquets ; c'est
    pourquoi sudo apt update vient toujours en premier.

    LA BONNE PRATIQUE
    - sudo apt update avant toute mise à jour : sans lui, apt travaille sur
      une liste périmée et ne trouve rien.
    - Vérifier après coup que ce qui doit tourner tourne encore (ici, un
      simple curl suffit) : corriger une faille ne doit pas en créer une
      autre, ni couper un service.
    - Quand aucun correctif n'existe encore (le cas de l'openssh-server du
      bulletin), le bulletin documente en général une parade provisoire : à
      appliquer en attendant, pas à la place d'une vraie veille.

    UNE AUTRE VOIE
    unattended-upgrades (déjà vu dans « Les mises à jour automatiques », à
    La Coopérative) peut appliquer ce genre de correctif de sécurité tout
    seul, sans attendre qu'on lise le bulletin — ce qui est justement le
    sujet du dernier chapitre de cette histoire.

    LA DOCUMENTATION
    - apt : https://manpages.debian.org/trixie/apt/apt.8.en.html
