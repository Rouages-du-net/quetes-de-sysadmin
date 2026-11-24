### Los comentarios del juego sobre ssh (los mensajes propios de OpenSSH se quedan en inglés).

ssh-command-remote = (El juego no ejecuta comandos remotos: conéctate primero y luego escribe el comando en la máquina.)
# { $machine }: el nombre de la máquina
ssh-locked-out = (Tu clave está bien, pero la configuración de sshd en { $machine } rechaza tu cuenta: te has quedado fuera. En un servidor real, tendrías que usar la consola de rescate del proveedor de alojamiento. Aquí, el menú del juego cumple ese papel: abre la historia desde el menú, corrige /etc/ssh/sshd_config, recarga ssh y luego vuelve y prueba con exit y ssh { $machine }.)
# { $machine }: el nombre de la máquina
ssh-firewall = (El cortafuegos de { $machine } bloquea el puerto SSH: te has quedado fuera. La sesión que tenías ya no está para arreglarlo. Aquí, el menú del juego hace de consola de rescate del proveedor de alojamiento: abre la historia desde el menú, permite SSH en ufw y luego vuelve y prueba con ssh { $machine }.)
# { $machine }: la máquina; { $port }: el puerto pedido; { $ports }: aquellos en los que escucha sshd
ssh-other-port = (Nadie escucha en el puerto { $port } de { $machine }: su servidor SSH escucha ahora en { $ports }. Para conectarte: ssh -p, o Port en ~/.ssh/config (man ssh_config).)
# { $machine }: el nombre de la máquina; { $address }: la dirección del puesto
ssh-banned = (fail2ban, en { $machine }, ha bloqueado la dirección de tu puesto ({ $address }): te has quedado fuera. Aquí, el menú del juego hace de consola de rescate del proveedor de alojamiento: abre la historia desde el menú, desbloquea tu dirección, añádela a ignoreip y luego vuelve y prueba con ssh { $machine }.)

# ssh rechaza una clave de máquina que ha cambiado. { $fingerprint }: la huella anunciada.
ssh-key-changed = (La máquina { $machine } ya no presenta la misma clave que antes. Es normal si acaba de reinstalarse; si no, alguien podría estar haciéndose pasar por ella. Nunca quites la clave antigua sin comprobarlo: el proveedor de alojamiento anunció por correo la huella de la clave nueva, { $fingerprint }. Si es de verdad la que aparece arriba, quita la clave antigua de known_hosts (el comando está escrito justo arriba; man ssh-keygen) y vuelve a conectarte.)
# ssh-keygen sin opciones: el juego no crea claves.
ssh-keygen-generate = ssh-keygen: aquí no se crea ninguna clave nueva (el juego te da las claves que necesitas). Prueba ssh-keygen -R, -F o -l (man ssh-keygen).
# { $type }: el tipo de clave pedido
ssh-keygen-type = ssh-keygen: el juego solo crea claves ed25519 (el tipo recomendado hoy); «{ $type }» no se simula.
ssh-without-back-plan = (ssh -N mantiene la conexión abierta sin devolverte el prompt: en una terminal real necesitarías una segunda terminal para usarla. Añade -f para mandarla al segundo plano, como en ssh -f -N -L …)
scp-local = scp: ninguna máquina remota (escribe máquina:ruta); para copiar en la misma máquina, basta con cp.
scp-two-remote = scp: el juego solo copia entre la máquina en la que estás y otra (no de una máquina remota a otra).
sftp-usage =
    usage: sftp [-46AaCfNpqrv] [-B buffer_size] [-b batchfile] [-c cipher]
              {"["}-D sftp_server_command] [-F ssh_config] [-i identity_file]
              {"["}-J destination] [-l limit] [-o ssh_option] [-P port]
              {"["}-R num_requests] [-S program] [-s subsystem | sftp_server]
              destination
# La ayuda de sftp (la salida de «help»), en inglés como la herramienta.
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
# La ayuda de lftp (la salida de «help»), en inglés como la herramienta.
lftp-help =
    bye [<code>]                        cd <rdir>
    get [OPTS] <rfile>                  lcd <ldir>
    lpwd                                ls [<args>]
    mirror [OPTS] [remote [local]]      mkdir [OPTS] <dirs>
    open [OPTS] <site>                  put [OPTS] <lfile>
    pwd [-p]                            rm [-r] [-f] <files>
    set [OPT] [<var> [<val>]]           user <user|URL> [<pass>]
