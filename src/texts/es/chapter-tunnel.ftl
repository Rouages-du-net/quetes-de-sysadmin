### Historia «El Centro Cívico», capítulo «El túnel»: llegar a un servicio
### que solo escucha en 127.0.0.1 de una máquina interna (ssh -L). Los
### comandos, las opciones, las rutas y los mensajes de OpenSSH y curl (en
### inglés) no se traducen.

chapter-tunnel = El túnel
    .summary = La interfaz de administración de la wiki solo escucha en 127.0.0.1: un túnel ssh -L, curl, y luego cerrar el túnel.

## Archivos

tunnel-email-yasmine =
    De:       Yasmine
    Para:     tú
    Asunto:   Altas pendientes

    Hay tres altas esperando aprobación en la wiki. Están la de Samir (el
    taller de bicis) y la de Léa (el coro). La tercera seguro que es
    publicidad: sobre todo, no la apruebes.

    El problema: la página de administración de la wiki no está en
    internet. Gaspard lo hizo a propósito, solo escucha en 127.0.0.1,
    puerto 8080, DE LA WIKI. En la wiki no hay navegador (ni siquiera
    curl): él la abría desde su puesto, con un «túnel» ssh (man ssh,
    opción -L; y -f -N para que se quede abierto sin sesión).

    En la página, cada alta tiene su propia dirección para aprobarla o
    rechazarla.

    Y cuando termines, cierra el túnel: no hay que dejar por ahí un puerto
    abierto en tu puesto hacia nuestra red interna.

tunnel-note-gaspard =
    Nota de Gaspard (junio de 2021)

    La interfaz de administración de la wiki funciona aquí (servicio
    wiki-admin, puerto 8080). Solo escucha en 127.0.0.1: nadie puede
    llegar a ella desde fuera, ni siquiera desde civico. Para comprobarlo:

      ss -tln
      systemctl status wiki-admin

## La página de administración (servida por la wiki)

# { $lines }: una línea por alta (tunnel-admin-line)
tunnel-admin-page =
    Wiki del Centro — administración

    Altas:
    { $lines }

    Aprobar:    /admin/aprobar/<cuenta>
    Rechazar:   /admin/rechazar/<cuenta>
# { $name }: la cuenta; { $state }: pending, approved o refused
tunnel-admin-line = { $state ->
        [approved] - { $name }: aprobada
        [refused] - { $name }: rechazada
       *[pending] - { $name }: pendiente
    }
tunnel-admin-approve = Alta de { $name } aprobada.
tunnel-admin-reject = Alta de { $name } rechazada.
tunnel-admin-not-found = Página no encontrada.

## Eventos

# { $account }: la cuenta publicitaria
tunnel-event-advert =
    Uy: la cuenta { $account } está aprobada. Yasmine: «¡Va a llenar la
    wiki de anuncios!» Recházala (la dirección está en la página de
    administración).
tunnel-event-approved =
    Samir y Léa están dados de alta, y la publicidad se queda fuera.

    Solo queda cerrar el túnel: funciona en segundo plano en tu puesto.
    Encuentra su proceso (ps), y luego detenlo (kill).
tunnel-event-end =
    Altas aprobadas, túnel cerrado. Yasmine: «¡Samir ya ha creado la
    página del taller de bicis!»

    ¡Bien hecho! Has terminado el capítulo «El túnel».

    QUÉ HA PASADO
    Con ssh -L 8080:localhost:8080 wiki, ssh abre el puerto 8080 en tu
    puesto. Todo lo que entra viaja, cifrado, dentro de la conexión ssh,
    y sale del lado de la wiki hacia «localhost:8080». Este localhost se
    ve desde el punto de vista de la WIKI: es su propia dirección
    127.0.0.1, donde escucha la interfaz de administración. El servicio
    nunca se expuso a internet; solo ssh lo estaba.

    BUENA PRÁCTICA
    - Deja las interfaces de administración en 127.0.0.1 y llega a ellas
      por un túnel ssh, en lugar de abrir un puerto más en el cortafuegos.
    - El nombre de -L lo resuelve la máquina del otro extremo: -L
      8080:localhost:8080 civico lleva a civico, no a la wiki.
    - -f -N: un túnel sin sesión; acuérdate de cerrarlo (ps, kill), o
      déjalo en primer plano y detenlo con Ctrl+C.

    DOCUMENTACIÓN
    - ssh, opción -L: https://man.openbsd.org/ssh#L
    - ssh, opciones -f y -N: https://man.openbsd.org/ssh#f
