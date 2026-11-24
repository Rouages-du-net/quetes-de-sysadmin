### Historia «La Despensa», capítulo «La llave de repuesto»: el repositorio
### restic del disco cifrado tiene una sola clave, cuya contraseña solo vive
### en el servidor del que hace copia. restic key list/add, variables
### RESTIC_*, check. Los comandos, opciones, rutas, variables y salidas no se
### traducen.

chapter-spare-key = La llave de repuesto
    .summary = La tarea nocturna hace ahora sus copias en un repositorio restic del disco cifrado. La tesorera pregunta si su sobre bastaría para leer las copias si el servidor ardiera: no bastaría. Da al repositorio una segunda clave que viva fuera del servidor, sin romper la tarea nocturna.

spare-key-script-comment = Copia nocturna al disco externo (Noor). Abre el disco con el archivo de clave, restic, cierra.

## Files

spare-key-message-fatou =
    De: Fatou (coordinadora)
    Lunes 12 de marzo, 8:50

    ¡Buenos días!

    El disco ha vuelto esta mañana de casa de Joaquín; está conectado, y
    cerrado, como debe ser. Desde el lunes pasado Noor ha pasado la tarea
    nocturna a restic (el script es /usr/local/sbin/nightly-backup): dice
    que guarda la versión de cada noche y solo almacena lo que ha cambiado.

    El miércoles, Mei me hizo una pregunta que no supe responder: «Si
    cajon ardiera esta noche, con lo que hay en mi sobre, ¿podríamos leer
    las copias?» ¿Podrías comprobarlo, y arreglar lo que haga falta? Te ha
    dejado una nota.

    Fatou

spare-key-note-mei =
    Nota de Mei (tesorera)

    Para el disco, tengo la frase de paso. Pero Noor me dice que las
    copias de dentro tienen su propia contraseña, y que está «en un
    archivo del servidor». Si el servidor desaparece, el archivo también,
    ¿no?

    Por si sirve, he generado una contraseña para las copias en el gestor
    de contraseñas («Copias de la despensa — recuperación restic»), y
    también está en el sobre:

        { $password }

    Borra esta nota una vez que la hayas usado.

## Events

spare-key-event-opened =
    El disco está abierto y montado. Antes de tocar nada, lee cómo llega
    la tarea nocturna al repositorio: el script está en /usr/local/sbin.
spare-key-event-job =
    La tarea no pasa -r ni una contraseña: exporta dos variables,
    RESTIC_REPOSITORY y RESTIC_PASSWORD_FILE, que restic lee de su entorno.
    La contraseña está en /root/.restic-pass. Puedes hacer lo mismo
    (export), o dar -r y --password-file (-p) en la línea de comandos. Y
    aquí restic necesita root: el repositorio pertenece a root.
spare-key-event-sudo-env =
    restic no ve tus variables: sudo lo arranca con un entorno limpio
    (env_reset, ver man sudoers). Escríbelas después de sudo (sudo
    RESTIC_REPOSITORY=… restic …), usa sudo -E, o da -r y -p.
spare-key-event-snapshots =
    Una instantánea por noche de entre semana: la tarea funciona. Ahora la
    pregunta de Mei: ¿quién puede abrir este repositorio? Cada clave es una
    entrada (man restic, el comando key).
spare-key-event-one-key =
    La lista de claves: lo que el cifrado de restic acepta como entrada.
    Cuéntalas, y piensa dónde vive la contraseña de cada una.
spare-key-event-envelope-fails =
    «wrong password or no key found»: la contraseña de Mei no abre nada
    hoy. Su sobre le dejaría abrir el disco, y luego se pararía en la
    puerta del repositorio. Esa puerta necesita una segunda clave.
spare-key-event-init =
    restic init crea un repositorio NUEVO: este ya existe, y contiene las
    copias. Consérvalo: lo que te falta es una clave, no un repositorio.
spare-key-event-remove-current =
    restic se niega a quitar la clave que estás usando para hablar con él:
    menos mal, porque es la clave de la tarea nocturna.
spare-key-event-nightly-broken =
    Cuidado: ninguna clave abre ya el repositorio con /root/.restic-pass.
    Esta noche, la tarea fallará con «wrong password or no key found». La
    clave nocturna debe quedarse; la de Mei se añade a ella (restic key
    add, no passwd). Vuelve a poner la clave de la tarea (key add con el
    contenido de /root/.restic-pass).
spare-key-event-escrowed =
    Ahora hay dos claves: la de la tarea (su contraseña en cajon) y la de
    Mei (su contraseña en el gestor de contraseñas y en el sobre).
    Cualquiera de las dos abre los mismos datos: restic cifra los datos con
    una clave maestra, y cada clave solo desbloquea esa clave maestra.
    Ahora comprueba que el repositorio está sano.
spare-key-event-checked =
    restic check: ningún error. El repositorio está sano, y se abre con
    una contraseña que no vive en cajon.
spare-key-event-written-down =
    La contraseña de Mei está ahora en un archivo de cajon (o en el propio
    disco). Esa es la trampa de la que te estás librando: la contraseña
    debe vivir fuera de esta máquina. Borra ese archivo.
spare-key-event-note =
    La nota de Mei ha desaparecido: su contraseña solo vive en el gestor de
    contraseñas y en el sobre.
spare-key-event-note-early =
    Has borrado la nota de Mei antes de que su clave estuviera en el
    repositorio: te la ha vuelto a enviar (cat de la nota). Bórrala una vez
    añadida la clave.
spare-key-event-closed =
    El disco está desmontado y cerrado, listo para salir el viernes.
spare-key-event-end =
    Mei: «¿Así que solo con mi sobre se abre el disco, y las copias
    también? ¿Aunque cajon sea un montón de cenizas?» Sí. Fatou: «Entonces
    probémoslo de verdad, el sábado.»

    ¡Bien hecho! Has terminado el capítulo 2 de La Despensa. (Te espera lo
    que viene después: ssh cajon.)

    QUÉ HA PASADO
    El repositorio estaba cifrado, pero su única clave era una contraseña
    guardada en cajon, la máquina de la que hace copia: si cajon moría, las
    copias morían con él, ilegibles. Leíste cómo llega la tarea al
    repositorio (RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE), listaste las
    claves, añadiste una segunda cuya contraseña guarda Mei fuera del
    servidor (restic key add), comprobaste el repositorio y cerraste el
    disco.

    BUENA PRÁCTICA
    - Todo secreto que necesita una restauración debe existir en otro
      sitio que no sea la máquina de la que se hace copia: la frase de paso
      del disco Y la contraseña del repositorio.
    - Una clave por uso: la clave de la tarea se puede cambiar o quitar sin
      tocar la clave de recuperación (restic key list, key remove ID).
    - restic key add añade una entrada; key passwd sustituye la clave
      actual: la tarea perdería la suya.
    - sudo reinicia el entorno: las variables van después de sudo, o usa
      -E.
    - restic check tras un cambio; check --read-data de vez en cuando lee
      cada paquete (más lento, pero encuentra los datos dañados).
    - Una contraseña dejada «de momento» en un archivo del servidor es
      exactamente la trampa: borra las notas.

    DOCUMENTACIÓN
    - restic, claves y cifrado: https://restic.readthedocs.io/en/stable/070_encryption.html
    - restic, variables de entorno: https://restic.readthedocs.io/en/stable/040_backup.html#environment-variables
    - restic, comprobar un repositorio: https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency
