### Graded hints for "The Fleet" story: a lead, then almost the answer, for
### each step (see indices.ts).

## Chapter 1 — The Inventory

indice-inventaire-cle-hote =
    .piste = Ansible reads its configuration from the current directory (cd ~/ansible). Then it goes through ssh without ever asking a question: each centre must already be in ~/.ssh/known_hosts.
    .solution = cd ~/ansible, then for each centre: ssh deploy@north, yes, exit (likewise for south and east); then ansible centres -m ping
indice-inventaire-compte =
    .piste = Ansible connects with the remote_user account from ansible.cfg. Which account has your key on the centres? (see Théo's email, and man ansible)
    .solution = In ~/ansible/ansible.cfg: remote_user = deploy
indice-inventaire-manque =
    .piste = ansible-inventory --graph shows the hosts in the centres group. One is missing.
    .solution = Add east under [centres] in ~/ansible/inventory.ini, then ansible centres -m ping

## Chapter 2 — The Playbook

indice-playbook-echec =
    .piste = Run the playbook (ansible-playbook site.yml) and read the failing task: the command does the same thing every time.
    .solution = ansible-playbook site.yml: mkdir fails on north, the directory already exists; and echo >> adds the line once more.
indice-playbook-modules =
    .piste = Replace the shell and command tasks with modules that describe a state: ansible-doc copy (or lineinfile), ansible-doc file.
    .solution = In site.yml: copy with content (the message line) and dest: /etc/motd; file with path: /srv/shared and state: directory.
indice-playbook-deuxieme =
    .piste = An idempotent playbook is checked by running it again: the second run must change nothing.
    .solution = ansible-playbook site.yml a first time (changed), then a second time: changed=0 everywhere in the PLAY RECAP.

## Chapter 3 — The Rehearsal

indice-repetition-repetition =
    .piste = Before changing anything: man ansible-playbook, the options that play without changing anything and that show the differences.
    .solution = ansible-playbook ssh.yml --check --diff
indice-repetition-gestionnaire =
    .piste = Read the error: the notified name and the handler's name must be exactly the same.
    .solution = In ssh.yml: notify: reload ssh (the handler's name, in lowercase).
indice-repetition-canari =
    .piste = One centre first: the --limit option. Then check you can still connect to it.
    .solution = ansible-playbook ssh.yml --limit north, then ansible north -m ping
indice-repetition-fin =
    .piste = Each centre must have reloaded sshd (sshd -T on a centre). Where the line is already there, the handler won't be notified again: reload ssh yourself. Then run the playbook again to check changed=0.
    .solution = ansible centres -b -m service -a "name=ssh state=reloaded" if needed, ansible-playbook ssh.yml, then ansible-playbook ssh.yml again (changed=0).
