### "The Fleet" story, chapter 3 "The Rehearsal": --check, --diff, --limit
### and handlers. Ansible's commands, modules, paths and output are not
### translated; task and handler names are.

chapitre-repetition = The Rehearsal
    .resume = Turn off SSH passwords on three servers without locking yourself out: rehearse (--check --diff), one centre first (--limit), and a handler that reloads sshd.

## Files

repetition-site-yml =
    # The neighbourhood centres' playbook
    - name: The neighbourhood centres
      hosts: centres
      become: true
      tasks:
        - name: htop for the volunteers
          apt:
            name: htop
            state: present

        - name: The welcome message
          copy:
            content: "Neighbourhood centre. Server managed by Ansible, do not edit by hand.\n"
            dest: /etc/motd

        - name: The shared directory
          file:
            path: /srv/shared
            state: directory
            mode: "0755"

repetition-ssh-yml =
    # No more passwords for SSH on the centres (Théo)
    - name: SSH without passwords
      hosts: centres
      become: true
      tasks:
        - name: No password for SSH
          lineinfile:
            path: /etc/ssh/sshd_config
            regexp: '^#?PasswordAuthentication'
            line: PasswordAuthentication no
          notify: Reload ssh

      handlers:
        - name: reload ssh
          service:
            name: ssh
            state: reloaded

repetition-note-theo =
    Hello!

    The centres still accept passwords for SSH: we don't use them any more
    (Ansible goes through keys), and the bots trying passwords certainly
    do. I wrote ~/ansible/ssh.yml to turn that off everywhere.

    But it's the kind of change that can lock us out. So we do it like at
    the theatre:
    1. the rehearsal: ansible-playbook ssh.yml --check --diff (nothing
       changes, Ansible shows what it would do);
    2. one centre first: --limit north, and we check we can still connect;
    3. then all three.

    In the end, sshd must really have reloaded its configuration on each
    centre (sudo sshd -T | grep passwordauth, on a centre), and running the
    playbook again must change nothing.

    Théo

## Events

repetition-evenement-repetition =
    The rehearsal: with --check, Ansible looks at each host and says what
    it would change, without changing anything; --diff shows the lines
    involved. Now's the time to read carefully, and to find mistakes before
    they cost anything.
repetition-evenement-gestionnaire =
    "The requested handler 'Reload ssh' was not found": the task notifies
    "Reload ssh", but the handler is called "reload ssh". Ansible compares
    names exactly, capitals included. Fix one or the other in ssh.yml.
repetition-evenement-canari =
    A single centre got the change (--limit). Before going on, check you
    can still connect with the key: ansible north -m ping (or ssh
    deploy@north). If something breaks, it only breaks in one place.
repetition-evenement-pas-recharge =
    On at least one centre, sshd_config says PasswordAuthentication no, but
    sshd still runs with the old configuration: the handler didn't reload
    the service. And running the playbook again won't change that: the line
    is already there, the task says "ok", it no longer notifies. You have
    to reload ssh yourself, on the centres concerned (the service module,
    with ansible).
repetition-evenement-fin =
    On all three centres, sshd now refuses passwords, and running the
    playbook again changes nothing. Théo: "And nobody got locked out."

    Well done! You have finished the chapter "The Rehearsal", and the
    story "The Fleet".

    WHAT HAPPENED
    --check plays the playbook without changing anything, --diff shows the
    differences: the rehearsal found the handler mistake before it did any
    damage. --limit applies the change to a single host first. A handler
    only runs at the end of the play, and only if a task notifying it
    changed something: that's what reloads sshd once, at the right moment,
    and not on every run.

    GOOD PRACTICE
    - --check --diff before any risky change, then --limit on one host,
      then all of them.
    - The names in notify and in handlers must be identical.
    - A handler notified but not run (an error further on in the play)
      won't run later: --force-handlers runs it despite the failure,
      otherwise reload the service by hand.
    - For SSH: check you can still connect before closing the open session.

    DOCUMENTATION
    - Check mode: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html
    - Handlers: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html
    - lineinfile: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/lineinfile_module.html
