### Histoire « La flotte », chapitre 2 « Le playbook » : l'idempotence. Les
### commandes, modules, chemins et sorties d'Ansible ne se traduisent pas ;
### les noms des tâches et le texte du message d'accueil, si.

chapter-playbook = Le playbook
    .summary = Un playbook qui double une ligne et échoue la deuxième fois : le réécrire avec les bons modules, pour qu'une deuxième exécution ne change rien.

## Fichiers

playbook-line-motd = Maison de quartier. Serveur géré par Ansible, ne pas modifier à la main.

playbook-site-yml =
    # Le playbook des maisons de quartier (Lucie)
    - name: Les maisons de quartier
      hosts: centres
      become: true
      tasks:
        - name: htop pour les bénévoles
          apt:
            name: htop
            state: present

        - name: Le message d'accueil
          shell: echo "Maison de quartier. Serveur géré par Ansible, ne pas modifier à la main." >> /etc/motd

        - name: Le dossier partagé
          command: mkdir /srv/shared

playbook-message-theo =
    Bonjour !

    Lucie, qui nous aide le mercredi, a écrit notre premier playbook :
    ~/ansible/site.yml. Elle l'a lancé deux fois sur north pour essayer
    (ansible-playbook site.yml --limit north), et la deuxième fois, ça a
    échoué. Je ne comprends pas pourquoi : rien n'avait changé entre les
    deux !

    Ce qu'on veut sur les trois centres :
    - htop installé ;
    - le message d'accueil (/etc/motd) qui dit, une fois, que le serveur
      est géré par Ansible ;
    - un dossier /srv/shared.

    Et surtout : qu'on puisse relancer le playbook autant de fois qu'on
    veut sans rien casser. Ansible appelle ça l'idempotence.

    Théo

## Événements

playbook-event-failure =
    Une tâche a échoué : mkdir refuse de créer /srv/shared, qui existe déjà.
    Le module command lance la commande à chaque fois, sans savoir si
    c'est encore utile. Les modules d'Ansible, eux, décrivent un état :
    « ce dossier existe » (man… ou plutôt ansible-doc file), et ne font
    quelque chose que s'il le faut.
playbook-event-duplicate =
    Le message d'accueil a la ligne en double : shell: echo … >> ajoute
    une ligne à chaque exécution. Pour décrire « le fichier contient cette
    ligne une fois », il y a des modules : copy (tout le contenu du
    fichier) ou lineinfile (une ligne). ansible-doc copy, ansible-doc
    lineinfile.
playbook-event-modules =
    site.yml n'utilise plus ni shell ni command : chaque tâche décrit un
    état, et Ansible vérifie avant d'agir.
playbook-event-second =
    Le playbook est passé partout. Mais un playbook idempotent se
    vérifie… en le relançant : la deuxième fois, il ne doit rien changer
    (changed=0 dans le PLAY RECAP).
playbook-event-end =
    Deuxième exécution : ok partout, changed=0, failed=0. Les trois
    centres sont dans le même état, et le playbook peut tourner tous les
    jours sans rien abîmer. Théo : « Lucie va être contente, elle avait
    presque tout bon. »

    Bravo ! Tu as terminé le chapitre « Le playbook ».

    CE QUI S'EST PASSÉ
    Un playbook est une liste de tâches, chacune appelée sur chaque hôte
    du groupe. command et shell lancent une commande à chaque fois :
    echo >> ajoute une ligne de plus, mkdir échoue quand le dossier
    existe. Les modules (apt, copy, lineinfile, file…) décrivent l'état
    voulu : ils regardent d'abord, et ne changent que ce qui doit l'être
    (changed), sinon ils disent ok.

    LA BONNE PRATIQUE
    - Un module plutôt qu'une commande dès qu'il en existe un (ansible-doc
      -l pour la liste).
    - Relancer un playbook deux fois : la deuxième doit dire changed=0.
    - copy gère tout le fichier, lineinfile une ligne : choisir selon ce
      que d'autres peuvent aussi écrire dans le fichier.
    - Si une commande est inévitable : creates= (ne pas la relancer si un
      fichier existe) ou changed_when.

    LA DOCUMENTATION
    - Les playbooks : https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html
    - L'idempotence : https://docs.ansible.com/ansible/latest/reference_appendices/glossary.html#term-Idempotency
    - Les modules de base : https://docs.ansible.com/ansible/latest/collections/ansible/builtin/index.html
