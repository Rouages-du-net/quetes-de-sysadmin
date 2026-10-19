### Remarques du jeu sur ssh (les messages d'OpenSSH, eux, restent en anglais).

ssh-commande-distante = (Le jeu ne lance pas de commande à distance : connecte-toi d'abord, puis tape-la sur la machine.)
# { $machine } : le nom de la machine
ssh-enferme = (Ta clé est bonne, mais la configuration de sshd sur { $machine } refuse ton compte : tu t'es enfermé·e dehors. Sur un vrai serveur, il faudrait passer par la console de secours de l'hébergeur. Ici, le menu du jeu en tient lieu : ouvre l'histoire depuis le menu, corrige /etc/ssh/sshd_config, recharge ssh, puis reviens tester avec exit et ssh { $machine }.)
# { $machine } : le nom de la machine
ssh-pare-feu = (Le pare-feu de { $machine } bloque le port de SSH : tu t'es enfermé·e dehors. La session que tu avais n'est plus là pour corriger. Ici, le menu du jeu sert de console de secours de l'hébergeur : ouvre l'histoire depuis le menu, autorise SSH dans ufw, puis reviens tester avec ssh { $machine }.)
# { $machine } : le nom de la machine ; { $adresse } : l'adresse du poste
ssh-banni = (fail2ban, sur { $machine }, a banni l'adresse de ton poste ({ $adresse }) : tu t'es enfermé·e dehors. Ici, le menu du jeu sert de console de secours de l'hébergeur : ouvre l'histoire depuis le menu, débannis ton adresse, ajoute-la à ignoreip, puis reviens tester avec ssh { $machine }.)

# ssh refuse une clé d'hôte qui a changé. { $empreinte } : l'empreinte annoncée.
ssh-cle-changee = (La machine { $machine } ne présente plus la même clé qu'avant. C'est normal si elle vient d'être réinstallée ; sinon, quelqu'un se fait peut-être passer pour elle. Ne retire jamais l'ancienne clé sans vérifier : l'hébergeur a annoncé par courriel l'empreinte de la nouvelle clé, { $empreinte }. Si c'est bien celle affichée plus haut, retire l'ancienne clé de known_hosts (la commande est écrite juste au-dessus ; man ssh-keygen), puis reconnecte-toi.)
# ssh-keygen sans option : le jeu ne crée pas de clés.
ssh-keygen-generer = ssh-keygen : ici, on ne crée pas de nouvelle clé (le jeu donne les clés dont tu as besoin). Essaie ssh-keygen -R, -F ou -l (man ssh-keygen).
# { $type } : le type de clé demandé
ssh-keygen-type = ssh-keygen : le jeu ne fabrique que des clés ed25519 (le type recommandé aujourd'hui) ; « { $type } » n'est pas simulé.
ssh-sans-arriere-plan = (ssh -N garde la connexion ouverte sans rendre la main : dans un vrai terminal, il faudrait un deuxième terminal pour s'en servir. Ajoute -f pour le passer en arrière-plan, comme ssh -f -N -L …)
scp-local = scp : aucune machine d'en face (écris machine:chemin) ; pour copier sur la même machine, cp suffit.
scp-deux-distants = scp : le jeu ne copie qu'entre la machine où tu es et une autre (pas d'une machine distante à une autre).
sftp-usage =
    usage: sftp [-46AaCfNpqrv] [-B buffer_size] [-b batchfile] [-c cipher]
              {"["}-D sftp_server_command] [-F ssh_config] [-i identity_file]
              {"["}-J destination] [-l limit] [-o ssh_option] [-P port]
              {"["}-R num_requests] [-S program] [-s subsystem | sftp_server]
              destination
# L'aide de sftp (la sortie de « help »), en anglais comme l'outil.
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
# L'aide de lftp (la sortie de « help »), en anglais comme l'outil.
lftp-aide =
    bye [<code>]                        cd <rdir>
    get [OPTS] <rfile>                  lcd <ldir>
    lpwd                                ls [<args>]
    mirror [OPTS] [remote [local]]      mkdir [OPTS] <dirs>
    open [OPTS] <site>                  put [OPTS] <lfile>
    pwd [-p]                            rm [-r] [-f] <files>
    set [OPT] [<var> [<val>]]           user <user|URL> [<pass>]
