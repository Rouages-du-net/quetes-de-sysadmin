### Historia «Las Cartas del Barrio», capítulo 9 «El Café de Reparaciones»:
### Apache detrás de nginx (puertos, hosts virtuales, .htaccess,
### mod_rewrite). Los comandos, las rutas, las directivas y los mensajes de
### Apache no se traducen.

chapter-repair-cafe = El Café de Reparaciones
    .summary = El sitio del café de reparaciones funciona con Apache, con un .htaccess: hacerlo vivir detrás de nginx, en el mismo servidor.

## Archivos

repair-cafe-email-kofi =
    De:      Kofi
    Para:    tú
    Asunto:  El café de reparaciones

    ¡Hola!

    El antiguo alojamiento del café de reparaciones cierra a final de mes.
    Me he ofrecido a acoger su sitio en nuestro servidor: el DNS de
    repair.example ya apunta aquí.

    Su sitio funcionaba con Apache, con un archivo .htaccess que hace
    funcionar las direcciones cortas de sus guías:
    http://repair.example/guide/42 lleva a la guía 42. Estas direcciones
    están impresas como códigos QR en todos los carteles del café: tienen
    que seguir funcionando.

    En vez de reescribirlo todo para nginx ya mismo, conservamos Apache,
    detrás de nginx: nginx sigue solo en el puerto 80, para todos los
    sitios, y le pasa a Apache las visitas del café. Rania empezó anoche,
    lee su nota (nota_de_rania.txt).

    Lo que necesitamos:
    - Apache funciona, y volverá a arrancar con la máquina; pero solo
      escucha en 127.0.0.1 (puerto 8080), como la agenda: nadie debe
      llegar a él sin pasar por nginx;
    - http://repair.example/ muestra la página de inicio del café, y
      http://repair.example/guide/42 muestra la guía 42;
    - Las Cartas y el café siguen en línea.

    ¡Gracias!
    Kofi

repair-cafe-note-rania =
    Anoche lancé sudo apt install apache2. Al final, apt mostró
    «Job for apache2.service failed», y no tuve tiempo de mirar por qué
    (systemctl status apache2, journalctl -u apache2…).

    He copiado el sitio en /var/www/repair, con su .htaccess (el archivo
    oculto que hace funcionar las direcciones /guide/…), y la configuración
    de Apache del antiguo alojamiento en
    /etc/apache2/sites-available/repair.conf. La he habilitado como para
    nginx, con un enlace en sites-enabled.

    Del lado de nginx, el sitio está listo en
    /etc/nginx/sites-available/repair, aún sin habilitar: se lo pasa todo
    a 127.0.0.1:8080.

    En Debian, Apache se configura en /etc/apache2: ports.conf para los
    puertos, sites-available y sites-enabled como nginx, pero con sus
    propias herramientas (man a2ensite, man a2enmod, man apache2ctl).

    Rania

repair-cafe-htaccess-comment =
    # Direcciones cortas de las guías, impresas en los carteles:
    # /guide/42 lleva a guides/42.html

repair-cafe-site-welcome =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>El Café de Reparaciones</title></head>
    <body>
    <h1>El Café de Reparaciones</h1>
    <p>Cada sábado reparamos juntos: bicis, tostadoras, ropa.</p>
    <p>Guías: <a href="/guide/7">7, cambiar una cámara</a>, <a href="/guide/42">42, quitar la cal a un hervidor</a>.</p>
    </body>
    </html>

repair-cafe-sheet-7 =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Guía 7: cambiar una cámara</title></head>
    <body>
    <h1>Guía 7: cambiar una cámara</h1>
    <p>Quita la rueda, saca la cubierta con dos desmontables, busca el pinchazo en un barreño de agua.</p>
    </body>
    </html>

repair-cafe-sheet-42 =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Guía 42: quitar la cal a un hervidor</title></head>
    <body>
    <h1>Guía 42: quitar la cal a un hervidor</h1>
    <p>Mitad vinagre blanco, mitad agua: hierve, deja una hora, enjuaga tres veces.</p>
    </body>
    </html>

## Eventos

repair-cafe-event-busy =
    «Address already in use»: Apache quiere escuchar en el puerto 80
    (Listen 80, en /etc/apache2/ports.conf), pero nginx ya está ahí, para
    todos los sitios. Dos programas no pueden escuchar en el mismo puerto
    de la misma dirección: sudo ss -tlnp muestra quién escucha dónde.
    Aquí, nginx se queda con el puerto 80; Apache irá a 127.0.0.1:8080,
    donde lo espera el sitio de nginx que preparó Rania.
repair-cafe-event-ah00558 =
    «AH00558» es solo un aviso: Apache no conoce un nombre completo para
    la máquina y usa su dirección. Una línea ServerName global lo calla
    (por ejemplo ServerName localhost en
    /etc/apache2/conf-available/servername.conf, y luego sudo a2enconf
    servername). No es eso lo que impide arrancar a Apache.
repair-cafe-event-listening =
    ¡Apache está en marcha! sudo ss -tlnp lo muestra, con sus
    direcciones. Comprueba que sirve el café, dando el nombre del sitio:
    curl -H "Host: repair.example" http://127.0.0.1:8080/
repair-cafe-event-everywhere =
    Cuidado: Apache escucha en todas las direcciones de la máquina (un
    Listen con solo el puerto). El cortafuegos lo protege hoy, pero Rania
    quiere que solo escuche en 127.0.0.1, como la agenda: solo nginx
    debe poder llegar a él. Listen 127.0.0.1:8080, en ports.conf.
repair-cafe-event-default =
    Esa es la página por defecto de Apache (/var/www/html), no la del
    café. Para una petición, Apache conserva primero los VirtualHost que
    coinciden con la dirección y el puerto, y luego aquel cuyo ServerName
    coincide con el nombre pedido (la cabecera Host); si ninguno coincide,
    toma el primero leído, o su configuración principal. sudo apache2ctl
    -S muestra quién responde dónde. ¿Se lee siquiera el sitio del café
    (un archivo de sites-enabled que termine en .conf)? ¿Está su
    VirtualHost en el puerto correcto? Y a través de nginx: ¿qué nombre
    le pasa nginx a Apache?
repair-cafe-event-site =
    Apache sirve la página de inicio del café en la interfaz de bucle
    local. Ahora publícala: nginx, delante, debe pasarle las visitas de
    repair.example.
repair-cafe-event-gateway =
    502: nginx no consigue llegar a Apache (en /var/log/nginx/error.log:
    «connect() failed»). ¿Está Apache en marcha, y en el puerto donde lo
    espera nginx (proxy_pass http://127.0.0.1:8080)?
repair-cafe-event-proxy =
    http://repair.example/ muestra la página de inicio del café: nginx, y
    luego Apache. Ahora prueba una dirección de los carteles:
    curl http://repair.example/guide/42
repair-cafe-event-ignore =
    404 en /guide/…: Apache busca el archivo /var/www/repair/guide/42,
    que no existe. La regla que transforma esta dirección está en
    /var/www/repair/.htaccess… pero Apache solo lee los .htaccess si
    AllowOverride lo permite, y apache2.conf dice AllowOverride None para
    /var/www. Permítelo solo para este sitio, en una sección
    <Directory /var/www/repair> de su VirtualHost.
repair-cafe-event-internal =
    500 Internal Server Error: Apache ha leído el .htaccess, pero algo va
    mal. El motivo está en el registro de errores del sitio:
    sudo tail /var/log/apache2/repair-error.log
repair-cafe-event-rewrite =
    /guide/42 lleva a la guía 42: la regla del .htaccess (RewriteRule) ha
    transformado la dirección en guides/42.html. Apache vuelve a leer
    el .htaccess en cada visita: cuando lo cambias, no hay nada que
    recargar.
repair-cafe-event-end =
    Las direcciones de los carteles funcionan, a través de nginx y luego
    Apache. Rania: «¡Los códigos QR del café vuelven a llevar a las guías
    correctas!»

    ¡Bien hecho! Has terminado el capítulo «El Café de Reparaciones».

    QUÉ HA PASADO
    Apache no arrancaba: nginx ocupaba el puerto 80. Ahora escucha en
    127.0.0.1:8080 (Listen en ports.conf, y el puerto del VirtualHost), y
    nginx le pasa las visitas de repair.example. El sitio no se leía:
    Apache solo toma de sites-enabled los archivos que terminan en .conf,
    los que crea a2ensite. Las direcciones cortas pasan por el .htaccess,
    que Apache solo lee con AllowOverride, y cuya RewriteRule necesita el
    módulo rewrite (a2enmod).

    NGINX Y APACHE, LADO A LADO
      nginx                        Apache (Debian)
      sites-enabled, ln -s         sites-enabled, a2ensite (.conf)
      nginx -t                     apache2ctl configtest, apache2ctl -S
      listen, server_name, root    Listen, VirtualHost, ServerName, DocumentRoot
      location                     Directory, Location
      rewrite, try_files           RewriteRule (a2enmod rewrite)
      sin .htaccess                .htaccess, si AllowOverride

    BUENA PRÁCTICA
    - Un programa por puerto: un servidor web delante (proxy inverso), los
      demás detrás, en 127.0.0.1.
    - apache2ctl configtest antes de recargar; apache2ctl -S para saber
      qué VirtualHost responde a qué nombre.
    - Detrás de un proxy, transmite el nombre pedido (proxy_set_header
      Host $host; en nginx), si no Apache sirve su sitio por defecto.
    - Los .htaccess ayudan cuando no tienes acceso a la configuración
      (alojamiento compartido), pero Apache los vuelve a leer en cada
      visita. En tu propio servidor, las mismas reglas están mejor en el
      VirtualHost, con AllowOverride None.

    DOCUMENTACIÓN
    - Cómo se elige el host virtual: https://httpd.apache.org/docs/2.4/vhosts/details.html
    - Los archivos .htaccess: https://httpd.apache.org/docs/2.4/howto/htaccess.html
    - mod_rewrite: https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html
    - proxy_set_header (nginx): https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
