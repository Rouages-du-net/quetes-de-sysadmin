### The game's remarks about ssh (OpenSSH's own messages stay in English).

ssh-commande-distante = (The game does not run remote commands: connect first, then type the command on the machine.)
# { $machine }: the name of the machine
ssh-enferme = (Your key is fine, but the sshd configuration on { $machine } refuses your account: you have locked yourself out. On a real server, you would have to use the hosting provider's rescue console. Here, the game menu plays that role: open the story from the menu, fix /etc/ssh/sshd_config, reload ssh, then come back and test with exit and ssh { $machine }.)
# { $machine }: the name of the machine
ssh-pare-feu = (The firewall of { $machine } blocks the SSH port: you have locked yourself out. The session you had is no longer there to fix it. Here, the game menu acts as the hosting provider's rescue console: open the story from the menu, allow SSH in ufw, then come back and test with ssh { $machine }.)
# { $machine }: the machine; { $port }: the requested port; { $ports }: those sshd listens on
ssh-autre-port = (Nobody is listening on port { $port } of { $machine }: its SSH server now listens on { $ports }. To connect to it: ssh -p, or Port in ~/.ssh/config (man ssh_config).)
# { $machine }: the name of the machine; { $adresse }: the workstation's address
ssh-banni = (fail2ban, on { $machine }, has banned your workstation's address ({ $adresse }): you have locked yourself out. Here, the game menu acts as the hosting provider's rescue console: open the story from the menu, unban your address, add it to ignoreip, then come back and test with ssh { $machine }.)

# ssh refuses a host key that has changed. { $empreinte }: the announced fingerprint.
ssh-cle-changee = (The machine { $machine } no longer presents the same key as before. That's normal if it has just been reinstalled; otherwise, someone may be impersonating it. Never remove the old key without checking: the hosting provider announced the new key's fingerprint by email, { $empreinte }. If it is indeed the one shown above, remove the old key from known_hosts (the command is written just above; man ssh-keygen), then reconnect.)
# ssh-keygen with no option: the game does not create keys.
ssh-keygen-generer = ssh-keygen: here, you don't create a new key (the game gives you the keys you need). Try ssh-keygen -R, -F or -l (man ssh-keygen).
# { $type }: the requested key type
ssh-keygen-type = ssh-keygen: the game only makes ed25519 keys (the type recommended today); "{ $type }" is not simulated.
ssh-sans-arriere-plan = (ssh -N keeps the connection open without giving you the prompt back: in a real terminal, you would need a second terminal to use it. Add -f to send it to the background, as in ssh -f -N -L …)
scp-local = scp: no remote machine (write machine:path); to copy on the same machine, cp is enough.
scp-deux-distants = scp: the game only copies between the machine you are on and another one (not from one remote machine to another).
sftp-usage =
    usage: sftp [-46AaCfNpqrv] [-B buffer_size] [-b batchfile] [-c cipher]
              {"["}-D sftp_server_command] [-F ssh_config] [-i identity_file]
              {"["}-J destination] [-l limit] [-o ssh_option] [-P port]
              {"["}-R num_requests] [-S program] [-s subsystem | sftp_server]
              destination
# sftp's help (the output of "help"), in English like the tool.
sftp-aide =
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
# lftp's help (the output of "help"), in English like the tool.
lftp-aide =
    bye [<code>]                        cd <rdir>
    get [OPTS] <rfile>                  lcd <ldir>
    lpwd                                ls [<args>]
    mirror [OPTS] [remote [local]]      mkdir [OPTS] <dirs>
    open [OPTS] <site>                  put [OPTS] <lfile>
    pwd [-p]                            rm [-r] [-f] <files>
    set [OPT] [<var> [<val>]]           user <user|URL> [<pass>]
