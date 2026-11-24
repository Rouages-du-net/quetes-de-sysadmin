### Historia «Las Cartas del Barrio», capítulo 4 «Compartir casa»:
### hosts virtuales y proxy inverso con nginx. Los comandos, las rutas, las
### directivas y los mensajes de nginx nunca se traducen. Las páginas de los
### sitios (sharing-site-*, sharing-agenda-*) se traducen.

chapter-sharing = Compartir casa
    .summary = Dos sitios y una aplicación en un solo servidor: hosts virtuales, ln -s, proxy inverso con nginx.

## Archivos

sharing-email-kofi =
    De:      Kofi (asociación Las Cartas del Barrio)
    Para:    tú
    Asunto:  El café se muda con nosotros

    Buena noticia: el café asociativo (¿te acuerdas?, aquel donde dejó de
    funcionar internet) deja de pagar alojamiento. ¡Se muda a nuestro
    servidor! Una máquina, dos sitios: al parecer nginx sabe hacerlo.
    Ya he apuntado el nombre cafe.example a nuestra dirección.

    Y Rania ha terminado la agenda de talleres: un pequeño programa que
    debería aparecer en http://letters.example/agenda/.

    Así que necesitamos:
    1. que http://cafe.example muestre el sitio del café;
    2. que http://letters.example siga siendo nuestro sitio, claro;
    3. que http://letters.example/agenda/ muestre la agenda (y sus
       páginas, como /agenda/semana);
    4. que todo esto sobreviva a un reinicio.

    Rania ha dejado sus notas (nota_de_rania.txt). Para sudo, tu
    contraseña sigue siendo la misma: hormigas-2026
sharing-note-rania =
    NOTAS DE RANIA

    Las páginas del café están listas: /var/www/cafe/

    En Debian, cada sitio tiene su archivo en /etc/nginx/sites-available/,
    y se habilita con un enlace simbólico en /etc/nginx/sites-enabled/
    (ls -l /etc/nginx/sites-enabled para ver cómo está hecho el nuestro).
    Lo más sencillo: copiar nuestro archivo y adaptarlo.

    La agenda está en /opt/agenda (servicio systemd «agenda»). Escucha en
    127.0.0.1:3000, solo en la propia máquina: nginx tiene que pasarle
    las visitas (proxy inverso, ver proxy_pass en man nginx). Sus páginas
    empiezan en /: /, /semana, /talleres.

    Para probar un sitio desde el servidor, antes de que lo vea todo el
    mundo:
      curl -H "Host: cafe.example" http://127.0.0.1
    Y siempre: sudo nginx -t antes de recargar.
sharing-agenda-description = Agenda de talleres (Node.js)
# { $file }: el archivo del programa (server.js)
sharing-agenda-readme =
    Agenda de talleres — servidor Node.js

    Escucha en 127.0.0.1:3000 (ver { $file }).
    Páginas: /  /semana  /talleres
    Servicio systemd: agenda
sharing-agenda-code =
    // Agenda de talleres de Las Cartas del Barrio.
    const express = require('express');
    const app = express();

    app.get('/', (req, res) => res.sendFile(__dirname + '/pages/inicio.html'));
    app.get('/semana', (req, res) => res.sendFile(__dirname + '/pages/semana.html'));
    app.get('/talleres', (req, res) => res.sendFile(__dirname + '/pages/talleres.html'));

    // Solo en la propia máquina: nginx está delante.
    app.listen(3000, '127.0.0.1');

## Los sitios

sharing-site-letters =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Las Cartas del Barrio</title></head>
    <body>
    <h1>Las Cartas del Barrio</h1>
    <p>Escribiente público, talleres de escritura, ayuda con los trámites.</p>
    </body>
    </html>
sharing-site-cafe =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>El café asociativo</title></head>
    <body>
    <h1>El café asociativo</h1>
    <p>Abierto de miércoles a domingo. Sopa del día, paga lo que puedas.</p>
    </body>
    </html>
sharing-agenda-welcome =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Agenda de talleres</title></head>
    <body>
    <h1>Agenda de talleres</h1>
    <p><a href="semana">Esta semana</a> · <a href="talleres">Todos los talleres</a></p>
    </body>
    </html>
sharing-agenda-week =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Esta semana</title></head>
    <body>
    <h1>Esta semana</h1>
    <p>Martes 18:00: taller de escritura. Jueves 14:00: ayuda con los trámites en línea.</p>
    </body>
    </html>
sharing-agenda-workshops =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Los talleres</title></head>
    <body>
    <h1>Los talleres</h1>
    <p>Escritura, lectura en voz alta, trámites en línea, escritura de cartas.</p>
    </body>
    </html>

## Eventos

sharing-event-link-broken =
    nginx no encuentra un archivo en /etc/nginx/sites-enabled/: el enlace
    está roto. ls -l /etc/nginx/sites-enabled muestra adónde apunta. Una
    ruta relativa se lee desde la carpeta del enlace (sites-enabled), no
    desde donde estabas al crearlo: vuelve a leer man ln, y borra el enlace
    malo con rm (el archivo de destino no se mueve).
sharing-event-conflict =
    «conflicting server name»: dos sitios responden al mismo nombre. nginx
    se queda con el primero que lee e ignora el otro para ese nombre. El
    archivo copiado probablemente ha conservado el server_name del sitio
    de Las Cartas.
sharing-event-bad-site =
    Has pedido cafe.example… y responde el sitio de Las Cartas.
    nginx elige el sitio según el nombre pedido (server_name); si ninguno
    coincide, toma el sitio por defecto del puerto (default_server).
    ¿Está habilitado el sitio del café, y lleva ese nombre?
sharing-event-cafe =
    cafe.example responde con la página del café: dos sitios en la misma
    máquina, en la misma dirección, distinguidos solo por el nombre pedido.
    Eso es un host virtual.
sharing-event-gateway =
    502 Bad Gateway: nginx sí ha recibido la visita, pero nadie responde
    detrás. Su registro de errores dice por qué:
    sudo tail /var/log/nginx/error.log. ¿Y está en marcha la agenda?
sharing-event-cannot-get =
    «Cannot GET /agenda/»: esta vez es la agenda la que responde… pero
    recibe la ruta /agenda/, mientras que sus páginas empiezan en /. Con
    proxy_pass, un detalle importa muchísimo: la barra final. Vuelve a
    leer proxy_pass en man nginx.
sharing-event-agenda-without-enable =
    La agenda responde. Pero no arrancará con la máquina: en el próximo
    reinicio, otra vez 502. (man systemctl)
sharing-event-end =
    cafe.example, letters.example y la agenda responden, cada uno con sus
    propias páginas, desde un solo servidor. Kofi: «Hacemos una fiesta
    por la mudanza del café. ¡Estás invitado, estás invitada!»

    ¡Bien hecho! Has terminado el capítulo 4 de Las Cartas del Barrio.
    (Lo siguiente: En mi máquina funciona.)

    QUÉ HA PASADO
    Una dirección IP, un nginx, varios sitios: cada visita anuncia el
    nombre que pide (cabecera Host), y nginx elige el bloque server cuyo
    server_name coincide, o si no el marcado default_server. Delante de
    la agenda, nginx hace de proxy inverso: recibe las visitas y se las
    pasa al programa, que solo escucha en 127.0.0.1.

    BUENA PRÁCTICA
    - Un archivo por sitio en sites-available, habilitado por un enlace en
      sites-enabled (ln -s, con una ruta absoluta); se deshabilita
      borrando el enlace, sin perder el archivo.
    - Un solo default_server por puerto, y un server_name explícito en
      todas partes.
    - Prueba un sitio antes del DNS: curl -H "Host: nombre" http://127.0.0.1
    - proxy_pass http://127.0.0.1:3000/; (con la barra) sustituye el
      prefijo de location; sin la barra, la ruta pasa tal cual.
    - 502: mira error.log, y luego el servicio que hay detrás de nginx.
    - Una aplicación detrás de un proxy escucha en 127.0.0.1, nunca en
      todas las direcciones.

    OTRA MANERA
    Apache hace lo mismo (VirtualHost, a2ensite); Caddy también, con HTTPS
    automático. Delante de contenedores, Traefik descubre solo las
    aplicaciones. nginx sigue siendo el más extendido delante de una
    aplicación, y su configuración se relee con facilidad.

    DOCUMENTACIÓN
    - Cómo elige nginx un sitio: https://nginx.org/en/docs/http/request_processing.html
    - server_name: https://nginx.org/en/docs/http/server_names.html
    - proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
