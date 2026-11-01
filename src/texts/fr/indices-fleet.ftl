### Les indices gradués de l'histoire « La flotte » : une piste, puis
### presque la réponse, pour chaque étape (voir indices.ts).

## Chapitre 1 — L'inventaire

hint-inventory-key-host =
    .piste = Ansible lit sa configuration dans le dossier courant (cd ~/ansible). Puis il passe par ssh sans jamais poser de question : chaque centre doit déjà être dans ~/.ssh/known_hosts.
    .solution = cd ~/ansible, puis pour chaque centre : ssh deploy@north, yes, exit (de même pour south et east) ; puis ansible centres -m ping
hint-inventory-account =
    .piste = Ansible se connecte avec le compte remote_user de ansible.cfg. Quel compte a ta clé sur les centres ? (voir le courriel de Théo, et man ansible)
    .solution = Dans ~/ansible/ansible.cfg : remote_user = deploy
hint-inventory-missing =
    .piste = ansible-inventory --graph montre les hôtes du groupe centres. Il en manque un.
    .solution = Ajouter east sous [centres] dans ~/ansible/inventory.ini, puis ansible centres -m ping

## Chapitre 2 — Le playbook

hint-playbook-failure =
    .piste = Lance le playbook (ansible-playbook site.yml) et lis la tâche qui échoue : la commande refait la même chose à chaque fois.
    .solution = ansible-playbook site.yml : mkdir échoue sur north, le dossier existe déjà ; et echo >> ajoute la ligne une fois de plus.
hint-playbook-modules =
    .piste = Remplace les tâches shell et command par des modules qui décrivent un état : ansible-doc copy (ou lineinfile), ansible-doc file.
    .solution = Dans site.yml : copy avec content (la ligne du message) et dest: /etc/motd ; file avec path: /srv/shared et state: directory.
hint-playbook-second =
    .piste = Un playbook idempotent se vérifie en le relançant : la deuxième exécution ne doit rien changer.
    .solution = ansible-playbook site.yml une première fois (changed), puis une deuxième : changed=0 partout dans le PLAY RECAP.

## Chapitre 3 — La répétition

hint-rehearsal-rehearsal =
    .piste = Avant de changer quoi que ce soit : man ansible-playbook, les options qui jouent sans rien changer et qui montrent les différences.
    .solution = ansible-playbook ssh.yml --check --diff
hint-rehearsal-handler =
    .piste = Lis l'erreur : le nom notifié et le nom du handler doivent être exactement les mêmes.
    .solution = Dans ssh.yml : notify: recharger ssh (le nom du handler, en minuscules).
hint-rehearsal-canary =
    .piste = Un seul centre d'abord : l'option --limit. Puis vérifie que tu t'y connectes encore.
    .solution = ansible-playbook ssh.yml --limit north, puis ansible north -m ping
hint-rehearsal-end =
    .piste = Chaque centre doit avoir rechargé sshd (sshd -T sur un centre). Là où la ligne est déjà là, le handler ne sera plus notifié : recharge ssh toi-même. Puis relance le playbook pour vérifier changed=0.
    .solution = ansible centres -b -m service -a "name=ssh state=reloaded" si besoin, ansible-playbook ssh.yml, puis encore ansible-playbook ssh.yml (changed=0).
