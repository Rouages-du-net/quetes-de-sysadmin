### Die gestuften Hinweise der Geschichte „Die Flotte“: eine Spur, dann
### fast die Antwort, für jeden Schritt (siehe src/engine/hints.ts).

## Kapitel 1 — Das Inventar

hint-inventory-key-host =
    .lead = Ansible liest seine Konfiguration aus dem aktuellen Verzeichnis (cd ~/ansible). Dann geht es über ssh, ohne je eine Frage zu stellen: Jedes Zentrum muss schon in ~/.ssh/known_hosts stehen.
    .solution = cd ~/ansible, dann für jedes Zentrum: ssh deploy@north, yes, exit (ebenso für south und east); dann ansible centres -m ping
hint-inventory-account =
    .lead = Ansible verbindet sich mit dem Konto remote_user aus ansible.cfg. Welches Konto hat deinen Schlüssel auf den Zentren? (siehe Théos E-Mail, und man ansible)
    .solution = In ~/ansible/ansible.cfg: remote_user = deploy
hint-inventory-missing =
    .lead = ansible-inventory --graph zeigt die Hosts der Gruppe centres. Einer fehlt.
    .solution = Füge east unter [centres] in ~/ansible/inventory.ini hinzu, dann ansible centres -m ping

## Kapitel 2 — Das Playbook

hint-playbook-failure =
    .lead = Lass das Playbook laufen (ansible-playbook site.yml) und lies den gescheiterten Task: Der Befehl tut jedes Mal dasselbe.
    .solution = ansible-playbook site.yml: mkdir scheitert auf north, das Verzeichnis existiert schon; und echo >> fügt die Zeile noch einmal hinzu.
hint-playbook-modules =
    .lead = Ersetze die Tasks mit shell und command durch Module, die einen Zustand beschreiben: ansible-doc copy (oder lineinfile), ansible-doc file.
    .solution = In site.yml: copy mit content (die Zeile der Nachricht) und dest: /etc/motd; file mit path: /srv/shared und state: directory.
hint-playbook-second =
    .lead = Ein idempotentes Playbook prüft man, indem man es noch einmal laufen lässt: Der zweite Lauf darf nichts ändern.
    .solution = ansible-playbook site.yml ein erstes Mal (changed), dann ein zweites Mal: überall changed=0 im PLAY RECAP.

## Kapitel 3 — Die Generalprobe

hint-rehearsal-rehearsal =
    .lead = Bevor du etwas änderst: man ansible-playbook, die Optionen, die spielen, ohne etwas zu ändern, und die die Unterschiede zeigen.
    .solution = ansible-playbook ssh.yml --check --diff
hint-rehearsal-handler =
    .lead = Lies den Fehler: Der benachrichtigte Name und der Name des Handlers müssen exakt gleich sein.
    .solution = In ssh.yml: notify: neuladen ssh (der Name des Handlers, kleingeschrieben).
hint-rehearsal-canary =
    .lead = Zuerst ein Zentrum: die Option --limit. Prüf dann, dass du dich noch damit verbinden kannst.
    .solution = ansible-playbook ssh.yml --limit north, dann ansible north -m ping
hint-rehearsal-end =
    .lead = Jedes Zentrum muss sshd neu geladen haben (sshd -T auf einem Zentrum). Wo die Zeile schon da ist, wird der Handler nicht mehr benachrichtigt: Lade ssh selbst neu. Lass dann das Playbook noch einmal laufen, um changed=0 zu prüfen.
    .solution = ansible centres -b -m service -a "name=ssh state=reloaded" wenn nötig, ansible-playbook ssh.yml, dann noch einmal ansible-playbook ssh.yml (changed=0).
