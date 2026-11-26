### Geschichte „Die Flotte“, Kapitel 2 „Das Playbook“: Idempotenz. Die
### Befehle, Module, Pfade und Ausgaben von Ansible werden nicht übersetzt;
### die Namen der Tasks und der Text der Willkommensnachricht schon.

chapter-playbook = Das Playbook
    .summary = Ein Playbook, das eine Zeile verdoppelt und beim zweiten Mal scheitert: Schreib es mit den richtigen Modulen neu, damit ein zweiter Lauf nichts ändert.

## Dateien

playbook-line-motd = Stadtteilzentrum. Server von Ansible verwaltet, nicht von Hand bearbeiten.

playbook-site-yml =
    # Das Playbook der Stadtteilzentren (Lucie)
    - name: Die Stadtteilzentren
      hosts: centres
      become: true
      tasks:
        - name: htop für die Ehrenamtlichen
          apt:
            name: htop
            state: present

        - name: Die Willkommensnachricht
          shell: echo "Stadtteilzentrum. Server von Ansible verwaltet, nicht von Hand bearbeiten." >> /etc/motd

        - name: Das gemeinsame Verzeichnis
          command: mkdir /srv/shared

playbook-message-theo =
    Hallo!

    Lucie, die uns mittwochs hilft, hat unser erstes Playbook geschrieben:
    ~/ansible/site.yml. Sie hat es zum Ausprobieren zweimal auf north
    laufen lassen (ansible-playbook site.yml --limit north), und beim
    zweiten Mal ist es gescheitert. Ich verstehe nicht, warum: Dazwischen
    hatte sich nichts geändert!

    Was wir auf den drei Zentren wollen:
    - htop installiert;
    - die Willkommensnachricht (/etc/motd), die einmal sagt, dass der
      Server von Ansible verwaltet wird;
    - ein Verzeichnis /srv/shared.

    Und vor allem: das Playbook so oft wie wir wollen erneut laufen lassen
    können, ohne etwas kaputtzumachen. Ansible nennt das Idempotenz.

    Théo

## Ereignisse

playbook-event-failure =
    Ein Task ist gescheitert: mkdir weigert sich, /srv/shared anzulegen,
    das schon existiert. Das Modul command führt den Befehl jedes Mal aus,
    ohne zu wissen, ob er noch nützlich ist. Die Module von Ansible
    dagegen beschreiben einen Zustand: „dieses Verzeichnis existiert“
    (ansible-doc file), und tun nur etwas, wenn nötig.
playbook-event-duplicate =
    Die Willkommensnachricht hat die Zeile zweimal: shell: echo … >> fügt
    bei jedem Lauf eine Zeile hinzu. Um „die Datei enthält diese Zeile
    einmal“ zu beschreiben, gibt es Module: copy (der ganze Inhalt der
    Datei) oder lineinfile (eine Zeile). ansible-doc copy, ansible-doc
    lineinfile.
playbook-event-modules =
    site.yml benutzt weder shell noch command mehr: Jeder Task beschreibt
    einen Zustand, und Ansible prüft, bevor es handelt.
playbook-event-second =
    Das Playbook ist überall durchgelaufen. Aber ein idempotentes Playbook
    prüft man… indem man es noch einmal laufen lässt: Beim zweiten Mal muss
    es nichts ändern (changed=0 im PLAY RECAP).
playbook-event-end =
    Zweiter Lauf: überall ok, changed=0, failed=0. Die drei Zentren sind im
    selben Zustand, und das Playbook kann jeden Tag laufen, ohne etwas zu
    beschädigen. Théo: „Lucie wird sich freuen, sie hatte es fast ganz
    richtig.“

    Gut gemacht! Du hast das Kapitel „Das Playbook“ abgeschlossen.

    WAS PASSIERT IST
    Ein Playbook ist eine Liste von Tasks, jeder wird auf jedem Host der
    Gruppe aufgerufen. command und shell führen jedes Mal einen Befehl aus:
    echo >> fügt eine Zeile mehr hinzu, mkdir scheitert, wenn das
    Verzeichnis existiert. Module (apt, copy, lineinfile, file…) beschreiben
    den gewünschten Zustand: Sie schauen zuerst nach und ändern nur, was
    geändert werden muss (changed), sonst sagen sie ok.

    GUTE PRAXIS
    - Ein Modul statt eines Befehls, wann immer es eins gibt (ansible-doc
      -l für die Liste).
    - Ein Playbook zweimal laufen lassen: Beim zweiten Mal muss es
      changed=0 sagen.
    - copy verwaltet die ganze Datei, lineinfile eine Zeile: Wähle danach,
      ob auch andere in die Datei schreiben.
    - Wenn ein Befehl unvermeidlich ist: creates= (nicht erneut ausführen,
      wenn eine Datei existiert) oder changed_when.

    DOKUMENTATION
    - Playbooks: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html
    - Idempotenz: https://docs.ansible.com/ansible/latest/reference_appendices/glossary.html#term-Idempotency
    - Die eingebauten Module: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/index.html
