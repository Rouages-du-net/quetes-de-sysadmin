### "The Fleet" story, chapter 2 "The Playbook": idempotence. Ansible's
### commands, modules, paths and output are not translated; task names and
### the welcome message text are.

chapitre-playbook = The Playbook
    .resume = A playbook that duplicates a line and fails the second time: rewrite it with the right modules, so a second run changes nothing.

## Files

playbook-ligne-motd = Neighbourhood centre. Server managed by Ansible, do not edit by hand.

playbook-site-yml =
    # The neighbourhood centres' playbook (Lucie)
    - name: The neighbourhood centres
      hosts: centres
      become: true
      tasks:
        - name: htop for the volunteers
          apt:
            name: htop
            state: present

        - name: The welcome message
          shell: echo "Neighbourhood centre. Server managed by Ansible, do not edit by hand." >> /etc/motd

        - name: The shared directory
          command: mkdir /srv/shared

playbook-message-theo =
    Hello!

    Lucie, who helps us on Wednesdays, wrote our first playbook:
    ~/ansible/site.yml. She ran it twice on north to try it out
    (ansible-playbook site.yml --limit north), and the second time it
    failed. I don't understand why: nothing had changed in between!

    What we want on the three centres:
    - htop installed;
    - the welcome message (/etc/motd) saying, once, that the server is
      managed by Ansible;
    - a /srv/shared directory.

    And above all: being able to run the playbook again as many times as
    we like without breaking anything. Ansible calls that idempotence.

    Théo

## Events

playbook-evenement-echec =
    A task failed: mkdir refuses to create /srv/shared, which already
    exists. The command module runs the command every time, without
    knowing whether it's still useful. Ansible's modules, on the other
    hand, describe a state: "this directory exists" (ansible-doc file),
    and only do something if needed.
playbook-evenement-doublon =
    The welcome message has the line twice: shell: echo … >> adds a line
    on every run. To describe "the file contains this line once", there
    are modules: copy (the whole content of the file) or lineinfile (one
    line). ansible-doc copy, ansible-doc lineinfile.
playbook-evenement-modules =
    site.yml no longer uses shell or command: each task describes a state,
    and Ansible checks before acting.
playbook-evenement-deuxieme =
    The playbook went through everywhere. But an idempotent playbook is
    checked… by running it again: the second time, it must change nothing
    (changed=0 in the PLAY RECAP).
playbook-evenement-fin =
    Second run: ok everywhere, changed=0, failed=0. The three centres are
    in the same state, and the playbook can run every day without damaging
    anything. Théo: "Lucie will be pleased, she almost had it all right."

    Well done! You have finished the chapter "The Playbook".

    WHAT HAPPENED
    A playbook is a list of tasks, each one called on every host in the
    group. command and shell run a command every time: echo >> adds one
    more line, mkdir fails when the directory exists. Modules (apt, copy,
    lineinfile, file…) describe the desired state: they look first, and
    only change what must be changed (changed), otherwise they say ok.

    GOOD PRACTICE
    - A module rather than a command whenever one exists (ansible-doc -l
      for the list).
    - Run a playbook twice: the second time must say changed=0.
    - copy manages the whole file, lineinfile one line: choose according
      to whether others also write to the file.
    - If a command is unavoidable: creates= (don't run it again if a file
      exists) or changed_when.

    DOCUMENTATION
    - Playbooks: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html
    - Idempotence: https://docs.ansible.com/ansible/latest/reference_appendices/glossary.html#term-Idempotency
    - The builtin modules: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/index.html
