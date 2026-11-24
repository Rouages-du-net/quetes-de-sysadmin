### Historia «La Cooperativa», capítulo «El proxy»: la aplicación detrás de
### nginx solo ve 127.0.0.1 (X-Forwarded-For, trust proxy). Las directivas
### de nginx, las variables y las rutas no se traducen.

chapter-proxy = El proxy
    .summary = Un robot hace que bloqueen a todo el mundo: detrás de nginx, la caja ve a cada cliente como 127.0.0.1. X-Forwarded-For, y de quién fiarse.

## Archivos

proxy-email-awa =
    De:       Awa
    Para:     tú
    Asunto:   Nadie puede entrar ya en la caja

    Desde esta mañana, la caja responde «Demasiados intentos, vuelve a
    intentarlo dentro de 15 minutos» a todo el mundo: Lina, Karim, yo…
    Volvemos a intentarlo, y vuelta a empezar.

    Karim cree que un robot está probando contraseñas (la caja bloquea una
    dirección después de 5 fallos). Pero ¿por qué a nosotros? Compara el
    registro de la caja (/var/log/till/app.log) y el de nginx
    (/var/log/nginx/access.log): no ven las mismas direcciones.

    La aplicación es una aplicación Node (Express): mira su ajuste
    TRUST_PROXY en /srv/till/app/.env (y la guía de Express, «behind
    proxies»). Del lado de nginx: la documentación de proxy_set_header.

    Para sudo: rabano-2027

## Eventos

proxy-event-all-world =
    Cinco minutos más tarde: el robot ha vuelto a hacer que bloqueen
    127.0.0.1… y a Lina con él. Para la caja, cada petición viene de nginx
    (127.0.0.1): nginx tiene que transmitir la dirección del verdadero
    cliente (una cabecera X-Forwarded-For), Y la caja tiene que aceptar
    leerla (TRUST_PROXY), y luego hay que reiniciar los dos.
# { $robot }: la dirección del robot
proxy-event-spoofed =
    Lina puede entrar… pero el robot ({ $robot }) nunca queda bloqueado:
    escribe él mismo un X-Forwarded-For falso, distinto en cada intento, y
    la caja se lo cree. Mira /var/log/till/app.log: 10.1.0.4, 10.2.7.5…

    Una aplicación solo debería creerse de X-Forwarded-For lo que le ha
    añadido SU proxy: TRUST_PROXY=true toma la primera dirección de la
    lista (la que ha escrito el cliente). Vuelve a leer la guía de
    Express: loopback solo se fía de 127.0.0.1. Y del lado de nginx, esta
    cabecera debe escribirla o completarla nginx, no solo transmitirla.
# { $robot }: la dirección del robot
proxy-event-end =
    Cinco minutos más tarde: el robot ({ $robot }) está bloqueado, y Lina
    entra sin problemas. Awa: «¡Podemos volver a abrir las cajas!»

    ¡Bien hecho! Has terminado el capítulo «El proxy».

    QUÉ HA PASADO
    Detrás de un proxy (nginx), una aplicación recibe todas sus conexiones
    del propio proxy. Para conocer al verdadero cliente, necesita la
    cabecera X-Forwarded-For, que rellena el proxy. Pero un cliente
    también puede escribirla él mismo: la aplicación solo debe fiarse de
    las direcciones añadidas por los proxies que conoce, leyendo la lista
    por la derecha.

    BUENA PRÁCTICA
    - En nginx: proxy_set_header X-Forwarded-For
      $proxy_add_x_forwarded_for (y a menudo X-Real-IP $remote_addr,
      X-Forwarded-Proto $scheme).
    - En la aplicación: fiarse solo del proxy (loopback, o su dirección),
      nunca de «todo el mundo» (true).
    - Compara los registros del proxy y de la aplicación cuando una
      dirección parezca rara: 127.0.0.1 en todas partes en la aplicación
      es ese síntoma.
    - Un bloqueo por dirección protege mal detrás de un proxy mal
      configurado: castiga a todo el mundo, o a nadie.

    DOCUMENTACIÓN
    - proxy_set_header: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
    - Express detrás de proxies: https://expressjs.com/en/guide/behind-proxies.html
