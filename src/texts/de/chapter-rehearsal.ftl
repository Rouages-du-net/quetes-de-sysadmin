### Geschichte „Die Flotte“, Kapitel 3 „Die Generalprobe“: --check,
### --diff, --limit und Handler. Die Befehle, Module, Pfade und Ausgaben von
### Ansible werden nicht übersetzt; die Namen der Tasks und Handler schon.

chapter-rehearsal = Die Generalprobe
    .summary = SSH-Passwörter auf drei Servern abschalten, ohne dich selbst auszusperren: proben (--check --diff), zuerst ein Zentrum (--limit), und ein Handler, der sshd neu lädt.

## Dateien

rehearsal-site-yml =
    # Das Playbook der Stadtteilzentren
    - name: Die Stadtteilzentren
      hosts: centres
      become: true
      tasks:
        - name: htop für die Ehrenamtlichen
          apt:
            name: htop
            state: present

        - name: Die Willkommensnachricht
          copy:
            content: "Stadtteilzentrum. Server von Ansible verwaltet, nicht von Hand bearbeiten.\n"
            dest: /etc/motd

        - name: Das gemeinsame Verzeichnis
          file:
            path: /srv/shared
            state: directory
            mode: "0755"

rehearsal-ssh-yml =
    # Keine Passwörter mehr für SSH auf den Zentren (Théo)
    - name: SSH ohne Passwörter
      hosts: centres
      become: true
      tasks:
        - name: Kein Passwort für SSH
          lineinfile:
            path: /etc/ssh/sshd_config
            regexp: '^#?PasswordAuthentication'
            line: PasswordAuthentication no
          notify: Neuladen ssh

      handlers:
        - name: neuladen ssh
          service:
            name: ssh
            state: reloaded

rehearsal-note-theo =
    Hallo!

    Die Zentren nehmen für SSH immer noch Passwörter an: Wir benutzen sie
    nicht mehr (Ansible geht über Schlüssel), die Bots, die Passwörter
    ausprobieren, dagegen schon. Ich habe ~/ansible/ssh.yml geschrieben,
    um das überall abzuschalten.

    Aber das ist die Art von Änderung, mit der wir uns aussperren können.
    Also machen wir es wie im Theater:
    1. die Generalprobe: ansible-playbook ssh.yml --check --diff (nichts
       ändert sich, Ansible zeigt, was es tun würde);
    2. zuerst ein Zentrum: --limit north, und wir prüfen, dass wir uns
       noch verbinden können;
    3. dann alle drei.

    Am Ende muss sshd auf jedem Zentrum seine Konfiguration wirklich neu
    geladen haben (sudo sshd -T | grep passwordauth, auf einem Zentrum),
    und ein erneuter Lauf des Playbooks darf nichts ändern.

    Théo

## Ereignisse

rehearsal-event-rehearsal =
    Die Generalprobe: Mit --check schaut sich Ansible jeden Host an und
    sagt, was es ändern würde, ohne etwas zu ändern; --diff zeigt die
    betroffenen Zeilen. Jetzt ist der Moment, genau zu lesen und Fehler zu
    finden, bevor sie etwas kosten.
rehearsal-event-handler =
    „The requested handler 'Neuladen ssh' was not found“: Der Task
    benachrichtigt „Neuladen ssh“, aber der Handler heißt „neuladen ssh“.
    Ansible vergleicht Namen exakt, Großbuchstaben eingeschlossen.
    Korrigiere das eine oder das andere in ssh.yml.
rehearsal-event-canary =
    Ein einziges Zentrum hat die Änderung bekommen (--limit). Bevor du
    weitermachst, prüf, dass du dich noch mit dem Schlüssel verbinden
    kannst: ansible north -m ping (oder ssh deploy@north). Wenn etwas
    kaputtgeht, dann nur an einer Stelle.
rehearsal-event-not-reload =
    Auf mindestens einem Zentrum sagt sshd_config PasswordAuthentication
    no, aber sshd läuft noch mit der alten Konfiguration: Der Handler hat
    den Dienst nicht neu geladen. Und ein erneuter Lauf des Playbooks
    ändert daran nichts: Die Zeile ist schon da, der Task sagt „ok“, er
    benachrichtigt nicht mehr. Du musst ssh selbst neu laden, auf den
    betroffenen Zentren (das Modul service, mit ansible).
rehearsal-event-end =
    Auf allen drei Zentren lehnt sshd jetzt Passwörter ab, und ein erneuter
    Lauf des Playbooks ändert nichts. Théo: „Und niemand hat sich
    ausgesperrt.“

    Gut gemacht! Du hast das Kapitel „Die Generalprobe“ und die Geschichte
    „Die Flotte“ abgeschlossen.

    WAS PASSIERT IST
    --check spielt das Playbook, ohne etwas zu ändern, --diff zeigt die
    Unterschiede: Die Generalprobe hat den Fehler im Handler gefunden,
    bevor er Schaden angerichtet hat. --limit wendet die Änderung zuerst
    auf einen einzigen Host an. Ein Handler läuft erst am Ende des Plays,
    und nur, wenn ein Task, der ihn benachrichtigt, etwas geändert hat:
    Das lädt sshd einmal neu, im richtigen Moment, und nicht bei jedem
    Lauf.

    GUTE PRAXIS
    - --check --diff vor jeder riskanten Änderung, dann --limit auf einen
      Host, dann alle.
    - Die Namen in notify und in handlers müssen identisch sein.
    - Ein benachrichtigter, aber nicht gelaufener Handler (ein Fehler
      weiter hinten im Play) läuft später nicht: --force-handlers führt
      ihn trotz des Fehlschlags aus, sonst den Dienst von Hand neu laden.
    - Für SSH: Prüf, dass du dich noch verbinden kannst, bevor du die
      offene Sitzung schließt.

    DOKUMENTATION
    - Check-Modus: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html
    - Handler: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html
    - lineinfile: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/lineinfile_module.html
