### Histoire « La flotte », chapitre 3 « La répétition » : --check, --diff,
### --limit et handlers. Les commandes, modules, chemins et sorties d'Ansible
### ne se traduisent pas ; les noms des tâches et des handlers, si.

chapter-rehearsal = La répétition
    .summary = Couper les mots de passe SSH sur trois serveurs sans s'enfermer dehors : répéter (--check --diff), un centre d'abord (--limit), et un handler qui recharge sshd.

## Fichiers

rehearsal-site-yml =
    # Le playbook des maisons de quartier
    - name: Les maisons de quartier
      hosts: centres
      become: true
      tasks:
        - name: htop pour les bénévoles
          apt:
            name: htop
            state: present

        - name: Le message d'accueil
          copy:
            content: "Maison de quartier. Serveur géré par Ansible, ne pas modifier à la main.\n"
            dest: /etc/motd

        - name: Le dossier partagé
          file:
            path: /srv/shared
            state: directory
            mode: "0755"

rehearsal-ssh-yml =
    # Plus de mot de passe pour SSH sur les centres (Théo)
    - name: SSH sans mot de passe
      hosts: centres
      become: true
      tasks:
        - name: Pas de mot de passe pour SSH
          lineinfile:
            path: /etc/ssh/sshd_config
            regexp: '^#?PasswordAuthentication'
            line: PasswordAuthentication no
          notify: Recharger ssh

      handlers:
        - name: recharger ssh
          service:
            name: ssh
            state: reloaded

rehearsal-note-theo =
    Bonjour !

    Les centres acceptent encore les mots de passe pour SSH : on ne s'en
    sert plus (Ansible passe par les clés), et les robots qui essaient des
    mots de passe, eux, ne s'en privent pas. J'ai écrit ~/ansible/ssh.yml
    pour couper ça partout.

    Mais c'est le genre de changement qui peut nous enfermer dehors. Alors,
    on fait comme au théâtre :
    1. la répétition : ansible-playbook ssh.yml --check --diff (rien ne
       change, Ansible montre ce qu'il ferait) ;
    2. un seul centre d'abord : --limit north, et on vérifie qu'on s'y
       connecte encore ;
    3. puis les trois.

    À la fin, sshd doit avoir vraiment rechargé sa configuration sur
    chaque centre (sudo sshd -T | grep passwordauth, sur un centre), et le
    playbook relancé ne doit plus rien changer.

    Théo

## Événements

rehearsal-event-rehearsal =
    La répétition : avec --check, Ansible regarde chaque hôte et dit ce
    qu'il changerait, sans rien changer ; --diff montre les lignes en
    question. C'est le moment de relire, et de trouver les erreurs avant
    qu'elles ne coûtent quelque chose.
rehearsal-event-handler =
    « The requested handler 'Recharger ssh' was not found » : la tâche
    notifie « Recharger ssh », mais le handler s'appelle « recharger ssh ».
    Ansible compare les noms exactement, majuscules comprises. Corrige
    l'un ou l'autre dans ssh.yml.
rehearsal-event-canary =
    Un seul centre a reçu le changement (--limit). Avant de continuer,
    vérifie qu'on s'y connecte toujours avec la clé : ansible north -m ping
    (ou ssh deploy@north). Si quelque chose casse, il ne casse qu'à un
    endroit.
rehearsal-event-not-reload =
    Sur au moins un centre, sshd_config dit PasswordAuthentication no, mais
    sshd tourne encore avec l'ancienne configuration : le handler n'a pas
    rechargé le service. Et relancer le playbook n'y changera rien : la
    ligne est déjà là, la tâche dit « ok », elle ne notifie plus. Il faut
    recharger ssh soi-même, sur les centres concernés (le module service,
    avec ansible).
rehearsal-event-end =
    Sur les trois centres, sshd refuse désormais les mots de passe, et le
    playbook relancé ne change plus rien. Théo : « Et personne n'est resté
    enfermé dehors. »

    Bravo ! Tu as terminé le chapitre « La répétition », et l'histoire
    « La flotte ».

    CE QUI S'EST PASSÉ
    --check joue le playbook sans rien changer, --diff montre les
    différences : la répétition a trouvé l'erreur du handler avant qu'elle
    ne fasse de dégât. --limit applique d'abord le changement à un seul
    hôte. Un handler ne tourne qu'à la fin du play, et seulement si une
    tâche qui le notifie a changé quelque chose : c'est ce qui recharge
    sshd une fois, au bon moment, et pas à chaque exécution.

    LA BONNE PRATIQUE
    - --check --diff avant tout changement risqué, puis --limit sur un
      hôte, puis tous.
    - Les noms dans notify et dans handlers doivent être identiques.
    - Un handler notifié mais pas joué (une erreur plus loin dans le
      play) ne le sera plus : --force-handlers le joue malgré l'échec,
      sinon il faut recharger le service à la main.
    - Pour SSH : vérifier qu'on se connecte encore avant de fermer la
      session ouverte.

    LA DOCUMENTATION
    - Le mode vérification : https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html
    - Les handlers : https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html
    - lineinfile : https://docs.ansible.com/ansible/latest/collections/ansible/builtin/lineinfile_module.html
