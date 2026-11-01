### Histoire « La Maison des associations », chapitre « Le rebond » : joindre
### une machine interne en passant par la passerelle (ssh -J, ProxyJump).
### Les options de ssh_config, les commandes, les chemins et les messages
### d'OpenSSH (en anglais) ne se traduisent pas.

chapter-jump = Le rebond
    .summary = Le wiki n'est joignable que par la passerelle : ssh -J, puis un raccourci ProxyJump dans ~/.ssh/config.

## Fichiers

jump-email-yasmine =
    De :     Yasmine
    À :      toi
    Objet :  Le wiki

    Bravo pour la passerelle ! Prochaine étape : le wiki des associations.
    C'est la machine « wiki » (wiki.maison.internal, 10.20.0.11), sur notre
    réseau interne : on ne peut pas la joindre depuis internet, seulement
    depuis maison. Regarde /etc/hosts ici : ce sont les noms que maison
    connaît.

    Gaspard faisait comme ça : ssh maison, puis, une fois sur maison,
    ssh wiki. Mais pour que le second ssh marche, il avait recopié sa clé
    PRIVÉE sur maison. Je l'ai effacée : si quelqu'un entrait sur la
    passerelle, il repartirait avec la clé de tout le réseau.

    Il paraît que ssh sait « rebondir » par une machine, directement depuis
    ton poste, sans que ta clé privée en sorte (man ssh, option -J). Et pour
    ne pas taper ça à chaque fois, on peut l'écrire une fois pour toutes dans
    ~/.ssh/config, sur ton poste (man ssh_config, ProxyJump) : je voudrais
    qu'un simple « ssh wiki » suffise.

    J'ai déjà ajouté ta clé publique sur nos machines, avec la mienne.

jump-note-gaspard =
    Note de Gaspard (mars 2019)

    Le wiki tourne ici, dans /srv/wiki. Les pages sont de simples fichiers
    Markdown ; on les modifie depuis le navigateur.

    Pour venir ici : ssh maison, puis ssh wiki. (J'ai mis ma clé dans
    ~/.ssh sur maison, c'est plus pratique.)

jump-wiki-welcome =
    # Wiki des associations

    Bienvenue sur le wiki de la Maison des associations ! Chaque association
    a sa page : horaires, contacts, salles réservées.

    - Les Jardins partagés
    - La chorale du mardi
    - Le club d'échecs
    - L'atelier vélo

## Événements

jump-event-key-private =
    ATTENTION : il y a une clé privée dans ~/.ssh sur maison (une ligne
    « BEGIN OPENSSH PRIVATE KEY »). C'est exactement ce que Yasmine voulait
    éviter : la passerelle est la machine la plus exposée du réseau.

    Efface-la (rm), et rebondis plutôt depuis ton poste : man ssh, option -J.
jump-event-to-wiki =
    Te voilà sur le wiki ! Ta connexion est passée par maison, mais ta clé
    privée, elle, est restée sur ton poste : maison n'a fait que relayer un
    tunnel chiffré de bout en bout entre ton poste et le wiki.

    (Regarde ton invite : vous@wiki. hostname le confirme.)

    Reste le raccourci : sur ton poste, un bloc dans ~/.ssh/config pour qu'un
    simple « ssh wiki » suffise (man ssh_config, ProxyJump).
jump-event-shortcut =
    Le raccourci est dans ~/.ssh/config de ton poste : ssh y trouve le
    chemin du wiki, par maison. (Pour voir ce que ssh en comprend :
    ssh -G wiki.)
jump-event-end =
    Un simple « ssh wiki » depuis ton poste, et aucune clé privée sur la
    passerelle. Yasmine : « C'est plus propre que du temps de Gaspard… mais
    ne lui dis pas ! »

    Bravo ! Tu as terminé le chapitre « Le rebond ».

    CE QUI S'EST PASSÉ
    Avec -J (ou ProxyJump), ssh se connecte d'abord à la passerelle et lui
    demande d'ouvrir un simple tuyau vers le wiki. À travers ce tuyau, ton
    poste parle directement au wiki : la vérification de sa clé d'hôte et ton
    authentification se font de bout en bout. La passerelle ne voit passer
    que du chiffré, et ta clé privée ne quitte jamais ton poste.

    LA BONNE PRATIQUE
    - Ne jamais recopier une clé privée sur un serveur, surtout pas sur la
      passerelle (le « bastion »), la machine la plus exposée.
    - Rebondir avec ssh -J ou ProxyJump plutôt qu'avec deux ssh à la suite
      (ou l'option ForwardAgent, qui expose ton agent à la passerelle).
    - Écrire ses raccourcis dans ~/.ssh/config (Host, HostName, User,
      ProxyJump) ; vérifier avec ssh -G.
    - HostName s'entend du point de vue de la passerelle : c'est elle qui
      cherche « wiki » dans son /etc/hosts (ou son DNS).

    LA DOCUMENTATION
    - ssh, option -J : https://man.openbsd.org/ssh#J
    - ssh_config, ProxyJump : https://man.openbsd.org/ssh_config#ProxyJump
