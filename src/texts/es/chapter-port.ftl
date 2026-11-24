### Historia «Las Cartas del Barrio», capítulo 7 «El puerto»:
### mover SSH a otro puerto sin dejarse fuera (sshd, ufw, ~/.ssh/config,
### la jaula de fail2ban). Los comandos, las rutas, las opciones y las
### líneas de registro no se traducen.

chapter-port = El puerto
    .summary = Los robots inundan el registro de SSH: moverlo al puerto 2222, sin dejarse fuera y sin olvidar fail2ban.

## Archivos

# { $port }: el nuevo puerto SSH
port-email-kofi =
    De:      Kofi
    Para:    tú
    Asunto:  El puerto SSH

    Rania ha mirado el registro de SSH (journalctl -u ssh): cientos de
    «Invalid user» cada noche, siempre en el puerto 22. fail2ban banea
    a algunos, pero siguen llegando otros, y ya no se ve nada útil en
    ese registro.

    Propone mover SSH al puerto { $port }: «No protege de nada (de eso
    se encargan nuestras claves y fail2ban), pero la mayoría de los
    robots solo llaman al 22. El registro volverá a ser legible».

    Vale, pero me acuerdo del cortafuegos: casi nos quedamos fuera. Esta
    vez hay varias puertas que abrir antes de cerrar una:
      - el propio servidor SSH (man sshd_config, Port);
      - el cortafuegos (sudo ufw status);
      - tu puesto, que debe saber dónde llamar (man ssh_config);
      - y fail2ban: ¿vigila su jaula sshd el puerto correcto?

    Rania añade: «ufw es solo una fachada. Las reglas de verdad, las del
    kernel, se leen con sudo nft list ruleset. Vale la pena mirarlas».

## Eventos

port-event-locked-out =
    ATENCIÓN: sshd ya no escucha en ningún puerto que el cortafuegos deje
    pasar. Tu sesión aguanta (ni sshd ni ufw cortan las conexiones
    existentes), pero la próxima conexión fallará. Corrígelo ANTES de
    desconectarte: vuelve a poner el puerto antiguo, o abre el nuevo en ufw.
# { $port }: el nuevo puerto
port-event-two-ports =
    Bien jugado: sshd escucha en los dos puertos, 22 y { $port }, y el
    cortafuegos deja pasar { $port }. Es la maniobra segura: la puerta
    antigua sigue abierta mientras pruebas la nueva. Pruébala desde tu
    puesto, en otra conexión, antes de cerrar nada.
    (sudo nft list ruleset muestra la regla que acaba de escribir ufw, en
    la cadena ufw-user-input.)
# { $port }: el nuevo puerto
port-event-attempt =
    Ya está, te has conectado por el puerto { $port }. La puerta nueva
    funciona: ya puedes cerrar la antigua, en sshd y en el cortafuegos.
port-event-default =
    fail2ban ha recargado jail.local, pero su jaula sshd sigue con el
    puerto 22. Un «port = 2222» puesto en [DEFAULT] solo se aplica a las
    jaulas que no dicen nada de su puerto; pero el [sshd] de jail.conf
    dice «port = ssh», y un valor en la sección propia de una jaula
    siempre gana sobre [DEFAULT], sea cual sea el archivo (man
    jail.conf). El ajuste va en una sección [sshd] de jail.local.
port-event-sentinel =
    SSH ya solo escucha en 2222… pero la jaula sshd de fail2ban sigue
    baneando en el puerto «ssh», es decir el 22 (port = ssh, en
    jail.conf). Una dirección baneada podría seguir intentándolo en 2222.
    sudo nft list ruleset lo muestra: en la tabla f2b-table, la regla
    rechaza las direcciones baneadas solo hacia «tcp dport {"{"} 22 {"}"}».
port-event-end =
    SSH ya solo escucha en el puerto 2222, el cortafuegos solo deja pasar
    ese, fail2ban lo vigila y tu puesto sabe dónde llamar. Al día
    siguiente, Rania: «Tres intentos anoche en lugar de cuatrocientos. El
    registro vuelve a ser legible».

    ¡Bien hecho! Has terminado el capítulo «El puerto».

    QUÉ HA PASADO
    Cambiar el puerto SSH no hace el servidor más seguro: un escaneo de
    puertos lo encuentra en segundos, y lo que lo protege son las claves,
    la configuración de sshd y fail2ban. Pero los robots que solo llaman
    al 22 desaparecen del registro, y las alertas de verdad vuelven a
    verse. El riesgo, eso sí, es real: si cierras un puerto demasiado
    pronto, te quedas fuera.

    BUENA PRÁCTICA
    - Abre antes de cerrar: sshd en los dos puertos, ufw permite el
      nuevo, prueba desde otra conexión y luego cierra el antiguo.
    - Todo lo que menciona el puerto sigue: cortafuegos, fail2ban (el
      puerto de la jaula, en una sección [sshd]), ~/.ssh/config en los
      puestos, herramientas de supervisión.
    - ufw y fail2ban escriben reglas nftables: sudo nft list ruleset
      muestra lo que aplica de verdad el kernel.
    - En Ubuntu 22.10 y posteriores, SSH arranca desde un socket de
      systemd (ssh.socket): después de cambiar el puerto, systemctl
      daemon-reload y luego systemctl restart ssh.socket.

    DOCUMENTACIÓN
    - sshd_config, Port: https://man.openbsd.org/sshd_config#Port
    - ssh_config, Port: https://man.openbsd.org/ssh_config#Port
    - jail.conf (fail2ban): https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
