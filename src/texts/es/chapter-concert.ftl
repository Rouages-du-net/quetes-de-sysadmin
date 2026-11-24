### Historia «Las Cartas del Barrio», capítulo 6 «Noche de concierto»:
### leer registros con awk, limitar el ritmo con nginx. Los comandos, las
### rutas, las directivas y las líneas de registro no se traducen.

chapter-concert = Noche de concierto
    .summary = La agenda se hunde la noche del concierto: leer registros con awk, limitar el ritmo con nginx (limit_req).

## Archivos

concert-message-kofi =
    Un mensaje de Kofi, enviado a las 20:02:

    «¡Socorro! Esta noche hay concierto en el café, y todo el mundo
    consulta la agenda para ver la hora… que ya no carga. La gente
    recibe un error 504. Rania dice que la agenda solo puede servir unas
    veinte páginas por segundo, ¡pero nunca hemos tenido tanta gente!

    ¿Podrías mirar en los registros de nginx quién pide qué, y hacer que
    pasen las visitas de verdad? Rania ha dejado una guía
    (ayuda_registros.txt). Y nada de apaños que solo valgan para esta
    noche: una regla que aguante.»
concert-help-logs =
    GUÍA DE LOS REGISTROS — DE RANIA

    Cada visita escribe una línea en /var/log/nginx/access.log (formato
    «combined»):

      dirección - - [fecha] "GET ruta HTTP/1.1" código bytes "página de origen" "navegador"
      $1            $4 $5    $6  $7   $8        $9     $10

    awk corta cada línea en campos ($1, $7, $9…). Algunas recetas:
      awk '{"{"}print $9{"}"}' ARCHIVO | sort | uniq -c         los códigos de respuesta
      awk '{"{"}print $1{"}"}' ARCHIVO | sort | uniq -c | sort -n las direcciones
      awk '$9 == 504 {"{"}print $7{"}"}' ARCHIVO | head          lo que falla

    Para limitar el ritmo, nginx tiene limit_req (man nginx): una zona en
    el bloque http (limit_req_zone), y luego limit_req donde quieras
    limitar. Después de cada recarga, mira el minuto siguiente en el
    registro.

## Eventos

# Después de cada recarga de nginx: un minuto de tráfico.
concert-minute =
    Pasa un minuto. Visitantes: { $served } peticiones servidas de { $humans }.
    Robot: { $refused } peticiones rechazadas de { $robot }. Tiempos de
    espera agotados (504): { $exceeded }. (El detalle está al final de
    access.log.)
concert-event-robot =
    Tres direcciones vecinas (198.51.100.23, .24, .25), el mismo
    «navegador» (AgendaScraper), cientos de páginas de la agenda por
    minuto: es un robot que rastrea el sitio. Él solo pide más de lo que
    la agenda puede servir. Las personas de verdad, en cambio, piden una
    página y sus cuatro archivos, y luego leen.
concert-event-forbidden =
    Bloquear las direcciones del robot (deny) funciona… esta noche. Kofi:
    «Rania dice que estos robots cambian de dirección cada semana. ¡No
    vamos a llevar una lista a mano!» Un límite de ritmo por dirección se
    aplicaría a todos los robots, conocidos o no.
concert-event-humans-limits =
    ¡El límite también rechaza a las personas! Un navegador pide una
    página y sus archivos (hoja de estilo, script, imágenes) casi a la
    vez: cinco peticiones en el mismo segundo. Sin margen, el límite las
    rechaza. limit_req acepta una ráfaga (burst), y nodelay la sirve
    enseguida (man nginx).
concert-event-still-too =
    El límite frena al robot, pero todavía pasa demasiado a menudo, y la
    agenda puede desbordarse (504). El ritmo permitido por dirección,
    multiplicado por el número de direcciones del robot, debe quedar muy
    por debajo de lo que la agenda puede servir (unas veinte páginas por
    segundo). ¿Y se aplica de verdad el límite a /agenda/?
concert-event-end =
    Todas las visitas humanas pasan, el robot va frenado y la agenda
    respira. Kofi: «¡Ya sale la hora! El concierto empieza a las 21:00».
    El error que recibe el robot (429 Too Many Requests, o 503) le dice
    que vaya más despacio.

    ¡Bien hecho! Has terminado el capítulo 6 de Las Cartas del Barrio.

    QUÉ HA PASADO
    Un robot pedía la agenda tres veces más rápido de lo que podía
    responder; las visitas humanas esperaban detrás, hasta el tiempo
    límite de nginx (504). Los registros de acceso, leídos con awk, sort
    y uniq -c, mostraron quién pedía qué.

    BUENA PRÁCTICA
    - Lee los registros antes de actuar: códigos de respuesta,
      direcciones, rutas (awk '{"{"}print $9{"}"}' | sort | uniq -c).
    - Limita el ritmo por dirección (limit_req_zone $binary_remote_addr),
      donde sale caro (la aplicación), no necesariamente en todas partes.
    - Permite una ráfaga (burst=10 nodelay): una página son varias
      peticiones a la vez.
    - limit_req_status 429 le dice claramente al robot que vaya más
      despacio.
    - Bloquear una dirección (deny) es un parche; una regla de ritmo
      aguanta en el tiempo.

    DOCUMENTACIÓN
    - limit_req: https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
    - El formato del registro de accesos: https://nginx.org/en/docs/http/ngx_http_log_module.html
    - awk (POSIX): https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html
