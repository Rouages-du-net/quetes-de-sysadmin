### Historia «El Sindicato de Inquilinos», capítulo «Las llaves cambian de
### manos»: la clave age de un voluntario nuevo añadida, la de uno que se va
### quitada, la clave de datos y el secreto cambiados. Los comandos, las
### opciones, las rutas, las claves, los nombres de variables y la salida
### de las herramientas no se traducen.

chapter-keys-change-hands = Las llaves cambian de manos
    .summary = Siete semanas después, los secretos del sindicato están cifrados para el servidor, para ti y para Makoa. Makoa se muda y deja el equipo técnico; Ikenna entra. Dale acceso a Ikenna, quítaselo de verdad a Makoa, y haz que lo que pudo leer ya no sirva para nada.

## Archivos

keys-change-hands-message-taslima =
    De: Taslima (secretaria del Sindicato de Inquilinos de Larkspur)
    Martes 26 de abril, 18:40

    ¡Hola!

    Dos noticias. Makoa se va a vivir con su hermana, a trescientos
    kilómetros, y deja el equipo técnico a final de semana (te ha dejado
    unas palabras). E Ikenna, del bloque C, se une: se encargará de los
    correos de Repairline. Te ha mandado su clave pública.

    Desde marzo, .env y mail.env están cifrados para el servidor, para ti y
    para Makoa (mira .sops.yaml). ¿Puedes abrírselos a Ikenna, y
    cerrárselos a Makoa? Confío plenamente en Makoa, pero su portátil se va
    con él, y su clave también.

    Para la contraseña del relé de correo, he pedido al proveedor que la
    cambie: lo hará mañana, y pondré la nueva en mail.env yo misma. La de
    la base de datos es cosa tuya.

    Como siempre: commit, push, y la aplicación tiene que seguir
    funcionando.

    Taslima

keys-change-hands-message-ikenna =
    De: Ikenna
    Martes 26 de abril, 17:12

    ¡Hola! Aquí tienes mi clave pública age, hecha en mi portátil con
    age-keygen:

    { $key }

    Taslima dice que la vas a añadir. Si es más fácil, ¿también podrías
    mandarme tu keys.txt y así tendría acceso enseguida?

    Ikenna

keys-change-hands-message-makoa =
    De: Makoa
    Lunes 25 de abril, 22:30

    Ha sido un placer, de verdad. Mi clave sigue en .sops.yaml y en los
    archivos: quítala, claro. Y no te cortes con lo demás: leía la
    contraseña de la base de datos cada vez que desplegaba, así que
    cámbiala también. Seguiré al sindicato desde lejos.

    Makoa

## Eventos

keys-change-hands-event-shared-key =
    Tu clave age privada está en otro sitio que tu propio keys.txt, o ese
    archivo lo pueden leer otras cuentas. Una clave privada compartida ya
    no es tuya: quien la tiene puede leer todo lo cifrado para ti, y nadie
    puede distinguiros. Ikenna tiene su propia clave; borra la copia (o
    chmod 600 ~/.config/sops/age/keys.txt).
keys-change-hands-event-hand-edit =
    sops rechaza el archivo: un valor ENC[…] se cambió fuera de sops. Cada
    valor tiene su propia etiqueta de autenticación, y el MAC cubre todos
    los valores juntos: un valor editado a mano, una línea borrada o
    movida, y sops ya no puede fiarse del archivo. Recupera el archivo de
    git (git checkout -- ARCHIVO), y cambia los valores con sops edit o sops
    set.
keys-change-hands-event-config-updated =
    El archivo .sops.yaml nombra ahora al servidor, a ti y a Ikenna. Esa
    regla es lo que reciben los archivos nuevos; los archivos ya cifrados
    conservan las claves para las que se cifraron hasta que los actualices.
keys-change-hands-event-config-only =
    La regla ha cambiado, pero .env o mail.env siguen cifrados para Makoa:
    sops no reescribe los archivos existentes cuando cambia .sops.yaml.
    sops updatekeys lo hace, archivo por archivo.
keys-change-hands-event-keys-updated =
    Los dos archivos están ahora cifrados para el servidor, para ti y para
    Ikenna, no para Makoa. Pero updatekeys solo vuelve a cifrar la misma
    clave de datos para la lista nueva: los valores en sí no han cambiado.
keys-change-hands-event-same-data-key =
    La clave de datos que cifra los valores es la que la clave de Makoa
    podía abrir: quien la haya guardado (o una copia antigua del archivo)
    aún puede descifrar lo que confirmes. sops rotate crea una clave de
    datos nueva y vuelve a cifrar cada valor.
keys-change-hands-event-data-rotated =
    Claves de datos nuevas para los dos archivos, cifradas solo para el
    servidor, para ti y para Ikenna. Lo que Makoa podía abrir eran las
    antiguas.
keys-change-hands-event-rotated =
    La base de datos tiene una contraseña nueva: la que Makoa leía al
    desplegar ya no vale nada. Tiene que llegar a .env (con sops, nunca en
    claro) y a la configuración desplegada.
keys-change-hands-event-app-down =
    Repairline no ha podido arrancar: la contraseña que leyó en
    /etc/repairline/env no es la de la base de datos (journalctl -u
    repairline).
keys-change-hands-event-deployed =
    El despliegue descifró el .env nuevo con la clave del servidor, y la
    aplicación se conecta con la contraseña nueva.
keys-change-hands-event-clear-commit =
    La contraseña nueva está en un commit, en claro. Elige otra, y ponla
    en .env con sops edit o sops set.
keys-change-hands-event-committed =
    El commit tiene la regla nueva, los dos archivos para la nueva lista de
    claves con claves de datos nuevas, y la contraseña nueva, cifrada.
keys-change-hands-event-pushed =
    origin lo tiene: Ikenna puede clonar el repositorio y descifrar los
    archivos con su propia clave.
keys-change-hands-event-end =
    Ikenna: «sops -d .env funciona en mi portátil. ¡Bienvenido yo!»

    ¡Bien hecho! Has terminado Las llaves cambian de manos.

    LO QUE PASÓ
    La clave pública de Ikenna entró en .sops.yaml y la de Makoa salió;
    sops updatekeys volvió a cifrar la clave de datos de cada archivo para
    la lista nueva. Como Makoa pudo guardar la clave de datos antigua, o
    simplemente los valores, cambiaste lo que importaba: una clave de datos
    nueva para cada archivo (sops rotate), y una contraseña nueva para la
    base de datos, puesta en .env con sops y desplegada. Ikenna obtuvo
    acceso con su propia clave; nadie compartió una clave privada.

    BUENA PRÁCTICA
    - Una clave por persona (y por servidor): añadir a alguien es añadir
      una clave pública, quitar a alguien es quitar la suya.
    - El archivo .sops.yaml decide para los archivos nuevos; updatekeys
      pone de acuerdo los existentes; ninguno de los dos cambia la clave de
      datos.
    - Cuando alguien se va, supón que guardó lo que podía leer: cambia la
      clave de datos (sops rotate) y los propios secretos.
    - No edites nunca los valores ENC[…] a mano: sops edit, sops set, o
      descifrar y volver a cifrar.
    - No envíes nunca una clave privada; pide una pública.

    OTRA FORMA DE HACERLO
    sops rotate --add-age y --rm-age cambian los destinatarios y la clave
    de datos en un solo comando, sin tocar .sops.yaml (que entonces también
    hay que cambiar). Con varios grupos de claves y shamir_threshold, un
    archivo puede exigir las claves de varias personas a la vez.

    DOCUMENTACIÓN
    - sops updatekeys: https://getsops.io/docs/#updatekeys-command
    - La rotación de claves: https://getsops.io/docs/#key-rotation
    - Añadir y quitar claves: https://getsops.io/docs/#adding-and-removing-keys
    - age-keygen: https://github.com/FiloSottile/age#readme
