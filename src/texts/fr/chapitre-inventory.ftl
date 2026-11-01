### Histoire « La flotte », chapitre 1 « L'inventaire » : Ansible joint-il les
### trois maisons de quartier ? Les commandes, chemins et sorties d'Ansible ne
### se traduisent pas.

chapitre-inventory = L'inventaire
    .resume = Trois serveurs à gérer d'un coup : un inventaire Ansible, les clés d'hôte, le bon compte, puis ansible -m ping.

## Fichiers

inventory-courriel-theo =
    De :     Théo
    À :      toi
    Objet :  Les trois maisons de quartier

    Bonjour, et bienvenue !

    Les trois maisons de quartier ont chacune leur petit serveur : north,
    south et east (north.centres.internal, etc.). Jusqu'ici, on se
    connectait à chacun pour tout faire trois fois, et ils ont fini par
    ne plus se ressembler. On passe à Ansible : depuis ce poste, une
    commande pour les trois.

    Sur chaque centre, le compte deploy a ta clé ssh (~/.ssh/id_ed25519)
    et peut utiliser sudo sans mot de passe.

    J'ai commencé dans ~/ansible : un ansible.cfg et un inventaire. Je
    n'ai pas eu le temps de finir ni d'essayer. Le premier test, c'est :
    ansible centres -m ping
    Il doit répondre « pong » pour les trois.

    Le mot de passe pour sudo sur ce poste : quartiers-2027.

    Théo

## Événements

inventory-evenement-sans-config =
    « No inventory was parsed » : Ansible n'a trouvé ni ansible.cfg ni
    inventaire. Il cherche ansible.cfg dans le dossier où tu es, puis
    ~/.ansible.cfg, puis /etc/ansible/ansible.cfg. La configuration de Théo
    est dans ~/ansible : place-toi dedans (cd ~/ansible).
inventory-evenement-cle-hote =
    « Host key verification failed » : Ansible passe par ssh, mais ne pose
    jamais la question « Are you sure you want to continue connecting ? ».
    Une machine dont la clé d'hôte n'est pas dans ~/.ssh/known_hosts est
    refusée. Connecte-toi une fois à chacune (ssh deploy@north, vérifie
    l'empreinte, yes, puis exit) : la clé est notée, et Ansible passera.
inventory-evenement-compte =
    « theo@… : Permission denied » : Ansible se connecte avec le compte
    remote_user de ansible.cfg, theo, qui n'existe pas sur les centres. Le
    compte qui a ta clé, c'est deploy (ou ansible_user dans l'inventaire,
    ou -u deploy pour une seule commande).
inventory-evenement-manque =
    Tous ceux de l'inventaire répondent « pong »… mais l'inventaire n'en
    connaît que deux. Théo parlait de trois maisons de quartier :
    ansible-inventory --graph montre ce qu'Ansible a lu.
inventory-evenement-fin =
    north, south et east répondent « pong » : Ansible les joint tous les
    trois, avec le bon compte et des clés d'hôte vérifiées. Théo : « Une
    commande pour trois serveurs, on y est ! »

    Bravo ! Tu as terminé le chapitre « L'inventaire ».

    CE QUI S'EST PASSÉ
    Ansible n'installe rien sur les serveurs : il s'y connecte en ssh,
    avec un compte et une clé, et y lance de petits programmes (les
    modules). L'inventaire dit quelles machines il gère, rangées en
    groupes ([centres]) ; ansible.cfg, lu dans le dossier courant, dit où
    est l'inventaire et sous quel compte se connecter. ping ne fait pas de
    ping réseau : il vérifie qu'Ansible peut se connecter et lancer un
    module.

    LA BONNE PRATIQUE
    - Vérifier les clés d'hôte (known_hosts) plutôt que de couper la
      vérification (host_key_checking = False) : c'est elle qui protège
      d'une machine qui se ferait passer pour une autre.
    - Un compte dédié (deploy), avec une clé, et sudo pour ce qui demande
      root (become).
    - ansible-inventory --graph pour voir ce qu'Ansible a compris de
      l'inventaire.

    LA DOCUMENTATION
    - L'inventaire : https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html
    - Les connexions : https://docs.ansible.com/ansible/latest/inventory_guide/connection_details.html
    - Le module ping : https://docs.ansible.com/ansible/latest/collections/ansible/builtin/ping_module.html
