### Historia «El Club de Senderismo», capítulo «Sin root»: una aplicación
### web que pasa de Docker como root a Podman sin root, bajo una cuenta de
### servicio: identificadores subordinados (/etc/subuid, /etc/subgid),
### puertos no privilegiados, el propietario de los datos visto a través del
### espacio de nombres de usuario (:U, --userns=keep-id, podman unshare).
### Los comandos, las opciones, las rutas y las salidas nunca se traducen.

chapter-no-root-needed = Sin root
    .summary = La aplicación de inscripciones de un club de senderismo funcionaba en un contenedor Docker, como root, desde que un voluntario la instaló. Pásala a Podman sin root, bajo su propia cuenta, con los datos del club intactos y el sitio todavía detrás de nginx.

## Archivos

# { $you }: la cuenta de quien juega en la máquina («tu»).
no-root-needed-message-soo-ah =
    De: Soo-ah (presidenta del club de senderismo Senderos Abiertos)
    Lunes 12 de abril, 09:20

    ¡Hola, y gracias por venir a ayudarnos!

    Nuestro sitio de inscripciones, https://walks.openpaths.example, está
    caído desde esta mañana, y es a propósito: he detenido Docker.

    Bolat montó el sitio en 2031: Trailbook (la aplicación que lista
    nuestras salidas y recoge las inscripciones) funciona en un contenedor,
    detrás de nginx. La semana pasada, una amiga que se dedica a la
    seguridad miró hito con nosotros. Su veredicto: el demonio Docker
    funciona como root, cualquiera del grupo docker es root en la máquina, y
    una aplicación con la que habla gente desconocida todo el día no
    debería tener nada que ver con root. «Ejecutadla sin root, bajo su
    propia cuenta.»

    Ayasha ya creó la cuenta, trailbook (sudo useradd --system
    --create-home --home-dir /var/lib/trailbook --shell /bin/bash
    trailbook), e instaló el podman de Debian. Tuvo que irse a trabajar
    antes de seguir.

    Lo que necesitamos antes de las inscripciones del sábado:
      - Trailbook funcionando de nuevo con Podman sin root, como trailbook;
      - el sitio respondiendo a través de nginx, como antes;
      - nuestros datos a salvo: /srv/trailbook/data/trailbook.db (412
        salidas, 1873 inscripciones desde 2031).

    Las notas de Bolat están en tu directorio personal. Tu contraseña de
    sudo: zigzag-27.

    Soo-ah

no-root-needed-notes-bolat =
    Notas de Bolat (hito, 2031)

    - Trailbook es una sola imagen:
      registry.example/openpaths/trailbook:2.3. Lo guarda todo en un único
      archivo SQLite, /data/trailbook.db, y escucha en el 8080 dentro del
      contenedor.
    - La arranqué así, una vez (se reinicia sola):
        sudo docker run -d --name trailbook --restart=always -p 8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
    - nginx (/etc/nginx/sites-enabled/walks) se queda con el 80 y el 443 y
      le pasa todo a 127.0.0.1:8080.
    - La imagen no funciona como root: tiene su propio usuario, trailbook,
      uid 1000 en la imagen. Cosa curiosa: en la máquina, los archivos de
      /srv/trailbook/data pertenecen a { $you }. Nunca entendí por qué.

## Eventos

no-root-needed-event-single-mapping =
    podman no ha encontrado ningún identificador subordinado para trailbook
    en /etc/subuid (o /etc/subgid). Sin ellos, el espacio de nombres de
    usuario que construye solo contiene un identificador: el propio
    trailbook, que dentro es root. Pero una imagen es un árbol de archivos
    que pertenecen a muchos identificadores (aquí /etc/gshadow pertenece al
    grupo shadow, 42), y ninguno puede existir en un espacio de un solo
    identificador.

    Las cuentas creadas por adduser o useradd reciben un rango de 65536
    identificadores subordinados; las cuentas del sistema (useradd
    --system), no. Mira /etc/subuid y /etc/subgid, y luego man subuid y man
    usermod.
no-root-needed-event-overlap =
    El rango de trailbook se solapa con el de otra cuenta en /etc/subuid o
    /etc/subgid. Dos cuentas cuyos contenedores comparten identificadores
    del anfitrión pueden leer y escribir los archivos de la otra: cada rango
    tiene que ser propio. Toma el primer bloque libre después del último
    rango del archivo.
no-root-needed-event-ranges =
    trailbook tiene ahora su propio rango de uid y gid subordinados: en su
    espacio de nombres, 0 es trailbook, y del 1 al 65536 son el rango que le
    has dado. Podman conserva un espacio de nombres por cuenta (su proceso
    «pause»), construido antes de que cambiaras los archivos: si todavía se
    queja, su mensaje de error dice qué ejecutar.
no-root-needed-event-stale-namespace =
    /etc/subuid y /etc/subgid están bien, y aun así podman sigue viendo un
    solo identificador: el espacio de nombres de trailbook se construyó
    antes, y podman lo conserva hasta que se le dice que la configuración ha
    cambiado. Lee el final del mensaje de error (y man
    podman-system-migrate).
no-root-needed-event-pulled =
    La imagen está en el almacenamiento propio de trailbook, en
    /var/lib/trailbook/.local/share/containers. El podman de root no la ve,
    y los contenedores de trailbook no ven los de root: compara podman
    images como trailbook y con sudo.
no-root-needed-event-sudo-podman =
    sudo podman ejecuta Podman como root: «rootful», con las imágenes y los
    contenedores de root, sin espacio de nombres de usuario, y los procesos
    del contenedor vuelven a tener los identificadores del anfitrión; root
    vuelve, justo lo que estamos dejando. Sin root significa ejecutar podman
    como el propio trailbook (sudo -iu trailbook, o sudo -u trailbook podman
    …). Borra lo que arrancó root (sudo podman rm -f NOMBRE).
no-root-needed-event-port-80 =
    Un proceso normal no puede escuchar en un puerto inferior a
    net.ipv4.ip_unprivileged_port_start (1024 por defecto), y pasta, que
    publica los puertos de los contenedores de trailbook, es uno. Y el 80
    está ocupado de todas formas: nginx escucha en el 80 y el 443 y ya le
    pasa el sitio a 127.0.0.1:8080 (/etc/nginx/sites-enabled/walks).

    Publica el contenedor en el 8080, en 127.0.0.1 si solo lo necesita
    nginx, y deja la puerta de entrada a nginx. Un contenedor que no pudo
    arrancar sigue ahí con su nombre (podman ps -a).
no-root-needed-event-lowered =
    net.ipv4.ip_unprivileged_port_start está ahora por debajo de 1024 (o lo
    estará en el próximo arranque, por /etc/sysctl.d). No es un ajuste para
    una cuenta: cualquier programa de cualquier usuario puede entonces tomar
    el 22, el 80 o el 443. Basta con que sshd o nginx se detenga un minuto
    para que el proceso de cualquiera responda en su lugar. El proxy inverso
    que ya tienes es la puerta más segura: vuelve a poner el valor en 1024
    (sysctl -w, y borra el archivo que añadiste).
no-root-needed-event-chown-refused =
    :U pide a podman que ceda la carpeta al usuario del contenedor, pero
    podman lo hace desde el espacio de nombres de trailbook, como el root de
    ese espacio: solo puede cambiar los archivos cuyo propietario conoce el
    espacio (trailbook y sus identificadores subordinados). Estos archivos
    pertenecen a otra persona en el anfitrión. ¿A quién (ls -ln
    /srv/trailbook/data)? root puede cedérselos antes a trailbook.
no-root-needed-event-cant-write =
    La aplicación se ha detenido enseguida: «unable to open database file:
    permission denied». Dentro, Trailbook funciona con el uid 1000, el USER
    de la imagen. En el espacio de nombres de trailbook, ese uid no es el
    1000 del anfitrión: el 1 del espacio es el primer identificador del
    rango, así que su 1000 es el primero + 999. En el anfitrión, los datos
    pertenecen al uid 1000, porque con Docker (sin espacio de nombres de
    usuario) el 1000 del contenedor ERA el 1000 del anfitrión.

    Compara podman unshare cat /proc/self/uid_map, podman unshare ls -ln
    /srv/trailbook/data y ls -ln /srv/trailbook/data. Luego cede la carpeta
    al identificador correcto: la opción de volumen U y --userns=keep-id en
    man podman-run, o podman unshare chown.
no-root-needed-event-world-writable =
    chmod 777 (u o+w) sobre los datos deja escribir al contenedor, pero
    también a cada cuenta de hito y a cada otro contenedor: 1873
    inscripciones, con nombres y teléfonos, abiertas a cualquiera que
    consiga un shell. Vuelve a poner los permisos (755 para la carpeta, 644
    para el archivo) y corrige mejor el propietario.
no-root-needed-event-empty =
    Trailbook funciona, pero sobre una base de datos vacía («database
    created … walks=0»): en este contenedor, /data no es /srv/trailbook/data
    (un volumen con nombre, otra ruta, o ningún -v). Las 412 salidas del club
    siguen en /srv/trailbook/data: borra este contenedor y arranca uno con
    esa carpeta montada.
no-root-needed-event-running =
    Trailbook funciona sin root como trailbook, sobre los datos del club. ps
    aux muestra su proceso con un uid grande: ni root, ni tú. Comprueba el
    sitio a través de nginx (curl -k https://walks.openpaths.example/), y
    que no quede nada por detrás.
no-root-needed-event-end =
    Soo-ah: «Las inscripciones están abiertas otra vez. Y nuestra amiga de
    seguridad dice: mucho mejor.»

    ¡Bien hecho! Has terminado Sin root.

    QUÉ HA PASADO
    Trailbook funcionaba con Docker: un demonio como root, y un contenedor
    cuyo uid 1000 era el uid 1000 del anfitrión (por eso los datos eran
    tuyos). Lo has pasado a Podman sin root bajo trailbook. Una cuenta del
    sistema no tiene identificadores subordinados, así que podman solo podía
    hacer corresponder al propio trailbook, y los archivos de la imagen
    (uno del grupo 42 entre ellos) no se podían desempaquetar; en cuanto la
    cuenta tuvo su propio rango, y podman system migrate reconstruyó su
    espacio de nombres, la imagen llegó. El puerto 80 es de nginx, y está
    fuera del alcance de un proceso normal: el contenedor publica el 8080 y
    nginx sigue delante. El uid 1000 de la aplicación, dentro, es un
    identificador subordinado fuera: los datos tenían que pertenecer a ese
    identificador (:U, o podman unshare chown), o el propio uid de la cuenta
    tenía que corresponder dentro del contenedor (--userns=keep-id).

    BUENA PRÁCTICA
    - Una cuenta sin privilegios por servicio, con su propio rango de
      identificadores subordinados (usermod --add-subuids,
      --add-subgids), nunca compartido.
    - Leer la correspondencia antes de tocar los permisos: podman unshare
      cat /proc/self/uid_map, podman unshare ls -ln, podman top CONTENEDOR
      user huser.
    - Corregir los propietarios, no los permisos: chmod 777 abre los datos
      a todo el mundo.
    - Dejar los puertos privilegiados a un proxy inverso; no bajar
      net.ipv4.ip_unprivileged_port_start por una aplicación.
    - :Z vuelve a etiquetar los archivos para SELinux. En Debian (AppArmor)
      no cambia nada, y nunca los propietarios.

    OTRA MANERA
    --userns=keep-id hace corresponder el propio uid de trailbook dentro
    del contenedor: en el anfitrión, los archivos siguen siendo de
    trailbook, más fáciles de copiar y de leer. La aplicación funciona
    entonces con el uid de trailbook dentro; una imagen que espera su propio
    USER puede necesitar keep-id:uid=1000,gid=1000.

    DOCUMENTACIÓN
    - podman-run(1): https://docs.podman.io/en/v5.4.2/markdown/podman-run.1.html
    - podman-unshare(1): https://docs.podman.io/en/v5.4.2/markdown/podman-unshare.1.html
    - Basic setup of rootless Podman: https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md
    - subuid(5): https://man7.org/linux/man-pages/man5/subuid.5.html

## Lo que comparten los capítulos de la historia: aquí, para que se carguen con ella.

walking-club-readme =
    Los datos de Trailbook (Senderos Abiertos).
    trailbook.db: las salidas, los senderistas y las inscripciones. Se copia
    cada noche al NAS de Bolat.
# La página que sirve Trailbook (curl la muestra tal cual): { $walks } y { $signups } son números.
walking-club-page =
    <!doctype html>
    <html lang="es">
    <title>Senderos Abiertos: próximas salidas</title>
    <h1>Senderos Abiertos: próximas salidas</h1>
    <p>{ $walks } salidas, { $signups } inscripciones.</p>
    <p>Sábado: la vuelta de la Cresta, 14 km, quedamos a las 08:30 en la estación.</p>
    </html>
