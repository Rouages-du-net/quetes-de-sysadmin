### Die Bemerkungen des Spiels zu ssh (die eigenen Meldungen von OpenSSH bleiben auf Englisch).

ssh-command-remote = (Das Spiel führt keine entfernten Befehle aus: Verbinde dich zuerst und tippe den Befehl dann auf der Maschine.)
# { $machine }: der Name der Maschine
ssh-locked-out = (Dein Schlüssel ist in Ordnung, aber die sshd-Konfiguration auf { $machine } lehnt dein Konto ab: Du hast dich ausgesperrt. Auf einem echten Server müsstest du die Rettungskonsole des Hosters benutzen. Hier übernimmt das Spielmenü diese Rolle: Öffne die Geschichte über das Menü, korrigiere /etc/ssh/sshd_config, lade ssh neu und komm dann zurück und teste mit exit und ssh { $machine }.)
# { $machine }: der Name der Maschine
ssh-firewall = (Die Firewall von { $machine } blockiert den SSH-Port: Du hast dich ausgesperrt. Die Sitzung, die du hattest, ist nicht mehr da, um es zu reparieren. Hier dient das Spielmenü als Rettungskonsole des Hosters: Öffne die Geschichte über das Menü, erlaube SSH in ufw und komm dann zurück und teste mit ssh { $machine }.)
# { $machine }: die Maschine; { $port }: der verlangte Port; { $ports }: die, auf denen sshd lauscht
ssh-other-port = (Auf Port { $port } von { $machine } lauscht niemand: Sein SSH-Server lauscht jetzt auf { $ports }. Um dich damit zu verbinden: ssh -p, oder Port in ~/.ssh/config (man ssh_config).)
# { $machine }: der Name der Maschine; { $address }: die Adresse des Rechners
ssh-banned = (fail2ban auf { $machine } hat die Adresse deines Rechners gesperrt ({ $address }): Du hast dich ausgesperrt. Hier dient das Spielmenü als Rettungskonsole des Hosters: Öffne die Geschichte über das Menü, entsperre deine Adresse, füge sie zu ignoreip hinzu und komm dann zurück und teste mit ssh { $machine }.)

# ssh lehnt einen geänderten Host-Schlüssel ab. { $fingerprint }: der angekündigte Fingerabdruck.
ssh-key-changed = (Die Maschine { $machine } zeigt nicht mehr denselben Schlüssel wie vorher. Das ist normal, wenn sie gerade neu installiert wurde; sonst gibt sich vielleicht jemand für sie aus. Entferne den alten Schlüssel nie, ohne zu prüfen: Der Hoster hat den Fingerabdruck des neuen Schlüssels per E-Mail angekündigt, { $fingerprint }. Wenn es genau der oben angezeigte ist, entferne den alten Schlüssel aus known_hosts (der Befehl steht direkt darüber; man ssh-keygen) und verbinde dich dann neu.)
# ssh-keygen ohne Option: Das Spiel erzeugt keine Schlüssel.
ssh-keygen-generate = ssh-keygen: Hier erzeugst du keinen neuen Schlüssel (das Spiel gibt dir die Schlüssel, die du brauchst). Versuch es mit ssh-keygen -R, -F oder -l (man ssh-keygen).
# { $type }: der verlangte Schlüsseltyp
ssh-keygen-type = ssh-keygen: Das Spiel erzeugt nur ed25519-Schlüssel (der heute empfohlene Typ); „{ $type }“ wird nicht simuliert.
ssh-without-back-plan = (ssh -N hält die Verbindung offen, ohne dir den Prompt zurückzugeben: In einem echten Terminal bräuchtest du ein zweites Terminal, um sie zu nutzen. Füge -f hinzu, um sie in den Hintergrund zu schicken, wie in ssh -f -N -L …)
scp-local = scp: keine entfernte Maschine (schreib maschine:pfad); um auf derselben Maschine zu kopieren, reicht cp.
scp-two-remote = scp: Das Spiel kopiert nur zwischen der Maschine, auf der du bist, und einer anderen (nicht von einer entfernten Maschine zu einer anderen).
sftp-usage =
    usage: sftp [-46AaCfNpqrv] [-B buffer_size] [-b batchfile] [-c cipher]
              {"["}-D sftp_server_command] [-F ssh_config] [-i identity_file]
              {"["}-J destination] [-l limit] [-o ssh_option] [-P port]
              {"["}-R num_requests] [-S program] [-s subsystem | sftp_server]
              destination
# Die Hilfe von sftp (die Ausgabe von „help“), auf Englisch wie das Werkzeug.
sftp-help =
    Available commands:
    bye                                Quit sftp
    cd path                            Change remote directory to 'path'
    exit                               Quit sftp
    get [-R] remote [local]            Download file
    help                               Display this help text
    lcd path                           Change local directory to 'path'
    lls [ls-options [path]]            Display local directory listing
    lpwd                               Print local working directory
    ls [-l] [path]                     Display remote directory listing
    mkdir path                         Create remote directory
    put [-R] local [remote]            Upload file
    pwd                                Display remote working directory
    quit                               Quit sftp
    rename oldpath newpath             Rename remote file
    rm path                            Delete remote file
    rmdir path                         Remove remote directory
    ?                                  Synonym for help
# Die Hilfe von lftp (die Ausgabe von „help“), auf Englisch wie das Werkzeug.
lftp-help =
    bye [<code>]                        cd <rdir>
    get [OPTS] <rfile>                  lcd <ldir>
    lpwd                                ls [<args>]
    mirror [OPTS] [remote [local]]      mkdir [OPTS] <dirs>
    open [OPTS] <site>                  put [OPTS] <lfile>
    pwd [-p]                            rm [-r] [-f] <files>
    set [OPT] [<var> [<val>]]           user <user|URL> [<pass>]
