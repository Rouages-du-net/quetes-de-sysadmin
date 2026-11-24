### Historia «El Centro Cívico», capítulo «Las llaves»: crear tu par de
### claves, ponerlo en el servidor, y luego rechazar las contraseñas. Las
### palabras clave de sshd_config, los comandos, las rutas y los mensajes de
### OpenSSH (en inglés) nunca se traducen.

chapter-keys = Las llaves
    .summary = Tu cuenta tiene una contraseña provisional (lila-2027): ssh-keygen, ssh-copy-id, y luego nada de contraseñas.

## Archivos

# { $password }: la contraseña provisional de la cuenta
keys-email-yasmine =
    De:      Yasmine (coordinadora del Centro Cívico)
    Para:    tú
    Asunto:  ¡Te damos la bienvenida al equipo!

    ¡Gracias por aceptar encargarte de la informática del Centro! Gaspard,
    que se ocupó de ella durante diez años, se ha mudado a Lyon; todavía se
    le puede localizar, pero ya no puede venir.

    La máquina «civico» es nuestra pasarela: es la única que se ve desde
    internet. Detrás están la wiki de las asociaciones y el servidor de
    archivos (los descubrirás pronto).

    Te he creado una cuenta (nombre de usuario: tu) con una contraseña
    provisional: { $password }. Así es como entras, de momento. Gaspard
    decía que una contraseña en un servidor abierto a internet es una
    puerta entornada. Así que antes que nada:

    1. Crea tu propio par de claves SSH, en TU ordenador (man ssh-keygen).
    2. Pon tu clave pública en civico (man ssh-copy-id), y vuelve a
       conectarte: ssh ya no debe pedirte contraseña.
    3. Solo entonces, haz que el servidor SSH rechace las contraseñas
       (/etc/ssh/sshd_config, man sshd_config), y comprueba que todavía
       puedes entrar.

    Para sudo, es la misma contraseña provisional: sudo siempre pedirá
    una, aunque ssh ya no quiera ninguna.

## Eventos

# { $config }: la ruta del archivo de configuración
keys-event-error =
    Hay un error en la configuración de SSH. Antes de recargar, comprueba
    siempre con  sudo sshd -t: te da el archivo y la línea culpables.
    Mientras sea incorrecta, systemctl reload ssh se niega a aplicarla, y
    sshd conserva la anterior.
keys-event-locked-out =
    ATENCIÓN: sshd rechaza ahora las contraseñas… y no hay ninguna clave
    autorizada para tu cuenta (~/.ssh/authorized_keys). Tu sesión actual
    sigue abierta, ¡pero una conexión nueva sería rechazada!

    Vuelve a poner PasswordAuthentication yes y recarga ssh, el tiempo
    justo para poner tu clave. El orden importa: primero la llave, luego
    la puerta.
keys-event-key-game =
    Ha llegado una clave a ~/.ssh/authorized_keys… pero es una clave que
    el juego te dio para otra máquina (mira el final de la línea, y
    ls -lt ~/.ssh en tu ordenador). Sin -i, ssh-copy-id toma la clave
    pública más reciente de ~/.ssh; y ssh, por su parte, no se la ofrecerá
    a civico.

    Primero crea tu propio par (ssh-keygen), y luego vuelve a lanzar
    ssh-copy-id.
keys-event-copied =
    Tu clave pública está en ~/.ssh/authorized_keys en civico. Mira el
    archivo (cat): una línea «ssh-ed25519 AAAA…», la mitad pública de tu
    par. La mitad privada nunca ha salido de tu ordenador.

    Vuelve a conectarte (exit, y luego ssh civico): esta vez, sin
    contraseña.
keys-event-by-key =
    ¡Has entrado con tu clave, sin contraseña! El servidor te ha enviado un
    desafío que solo tu clave privada podía firmar.

    Ahora cierra la puerta a las contraseñas: un robot todavía podría
    intentar adivinar una. En /etc/ssh/sshd_config, busca la línea
    PasswordAuthentication (man sshd_config), y luego sudo sshd -t y sudo
    systemctl reload ssh.
keys-event-closed =
    sshd ya solo acepta claves. Antes de cerrar esta sesión, prueba: exit,
    y luego ssh civico. (En un servidor real, se mantiene la sesión abierta
    y se prueba en un segundo terminal.)
keys-event-end =
    Dentro con tu clave, y las contraseñas rechazadas: la pasarela está
    cerrada a los robots, pero no a ti. Yasmine: «¡Gaspard estará orgulloso
    de ti!»

    ¡Bien hecho! Has terminado el capítulo «Las llaves».

    QUÉ HA PASADO
    Un par de claves son dos archivos: la clave privada (~/.ssh/id_ed25519),
    que se queda en tu ordenador, y la clave pública (id_ed25519.pub), que
    puedes dar a cualquiera. El servidor guarda las claves públicas
    autorizadas en ~/.ssh/authorized_keys; al conectarte, te pide que
    firmes un desafío con la clave privada. No viaja nada secreto, y no
    hay nada que adivinar.

    BUENA PRÁCTICA
    - Genera tu clave en tu propia máquina (ssh-keygen -t ed25519), con una
      frase de paso; nunca copies una clave privada a otro sitio.
    - Pon la clave pública con ssh-copy-id: crea ~/.ssh y authorized_keys
      con los permisos correctos (700 y 600).
    - En este orden: la clave, la prueba, y luego PasswordAuthentication no.
    - Mantén una sesión abierta y prueba con una conexión nueva.

    DOCUMENTACIÓN
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
    - ssh-copy-id: https://manpages.debian.org/bookworm/openssh-client/ssh-copy-id.1.en.html
    - sshd_config: https://man.openbsd.org/sshd_config
