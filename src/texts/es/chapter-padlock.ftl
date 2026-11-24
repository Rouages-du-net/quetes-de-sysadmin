### Historia «El Parche», capítulo 1 «El candado»: Caddy y su HTTPS
### automático (dirección del sitio, desafío ACME, cortafuegos, redirección
### de www). Los comandos, las rutas, las directivas y los mensajes de Caddy
### no se traducen.

chapter-padlock = El candado
    .summary = Caddy tenía que hacer HTTPS solo, pero el sitio del taller de bicis se queda en HTTP: darle su nombre, dejar pasar a Let's Encrypt, y no olvidar www.

## Archivos

padlock-message-ines =
    De:      Inès
    Para:    tú
    Asunto:  ¡El candado!

    ¡Hola!

    El Parche tiene por fin su propio servidor, solo para el sitio web del
    taller. Instalé Caddy en lugar de nginx: por lo visto hace HTTPS solo,
    sin certbot, sin nada. Puse el sitio en /var/www/cycles y cambié la
    carpeta en /etc/caddy/Caddyfile.

    En el servidor, curl http://localhost muestra nuestra página. Pero
    desde fuera, nada: ningún candado en el navegador,
    https://cycles.example no responde, y ni siquiera http://cycles.example
    funciona desde casa. Y eso que el DNS está bien: cycles.example y
    www.cycles.example llevan los dos a 203.0.113.40, nuestro servidor.

    Lo que necesitamos:
    - que https://cycles.example muestre el sitio, con un certificado de
      verdad;
    - que http://cycles.example mande a la gente a https://;
    - que https://www.cycles.example funcione también (¡es la dirección
      impresa en nuestros carteles!), mostrando el sitio o mandando a la
      gente a cycles.example.

    El cortafuegos (ufw) lo activé siguiendo un tutorial, para ssh. El
    servicio se llama caddy (systemctl status caddy, journalctl -u caddy);
    también está man caddy.

    ¡Gracias, y hasta el sábado en el taller!
    Inès

padlock-site =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>El Parche — taller de bicis</title></head>
    <body>
    <h1>El Parche</h1>
    <p>Taller de bicis comunitario: te enseñamos a arreglar tu bici tú misma o tú mismo.</p>
    <p>Todos los sábados, de 10:00 a 17:00. Herramientas y consejos, paga lo que puedas.</p>
    </body>
    </html>

## Eventos

padlock-event-http-only =
    Caddy solo escucha en el puerto 80, en HTTP: el Caddyfile empieza por
    «:80 {"{"}», la plantilla del paquete. Una dirección sin nombre de
    dominio, o que indica el puerto 80 (o http://), no recibe certificado:
    Caddy no sabría para qué nombre pedirlo. El comentario del principio del
    archivo lo dice: sustituye :80 por el nombre del sitio. Luego
    sudo systemctl reload caddy, y mira lo que dice el journal.
padlock-event-schema-http =
    http://cycles.example: con http://, la dirección pide un sitio solo en
    HTTP, así que sin certificado. Para el HTTPS automático, basta con el
    nombre solo: cycles.example (o https://cycles.example).
padlock-event-address =
    Caddy ha cogido el nombre: ahora escucha en los puertos 80 y 443
    (sudo ss -tlnp), y pide un certificado a Let's Encrypt por sí solo. ¿Lo
    ha conseguido? Todo está en su journal: journalctl -u caddy (las líneas
    tls.obtain y acme_client).
padlock-event-firewall =
    «Timeout during connect (likely firewall problem)»: para comprobar que
    el servidor responde de verdad por cycles.example, Let's Encrypt viene a
    mirar desde internet, por el puerto 80 (desafío HTTP-01) o 443
    (TLS-ALPN-01). Pero ufw solo deja entrar ssh: sudo ufw status. Los
    visitantes también usarán esos puertos. Caddy volverá a intentarlo
    solo, un poco más tarde.
padlock-event-alert =
    «tlsv1 alert internal error»: Caddy responde en el puerto 443, pero no
    tiene (todavía) certificado para este nombre, así que el intercambio TLS
    falla. El journal dice cómo va: journalctl -u caddy.
padlock-event-format =
    Solo es un aviso: el Caddyfile no está escrito como le gustaría a caddy
    fmt (tabulaciones para la sangría, un espacio entre palabras).
    sudo caddy fmt --overwrite /etc/caddy/Caddyfile le da formato.
padlock-event-certificate =
    ¡El candado! Caddy ha conseguido su certificado («certificate obtained
    successfully» en el journal), guardado en /var/lib/caddy. Prueba
    curl -I http://cycles.example: la redirección a HTTPS la ha añadido
    Caddy solo. Queda por hacer: la dirección de los carteles,
    www.cycles.example.
padlock-event-end =
    https://cycles.example y https://www.cycles.example responden, con sus
    certificados, y HTTP manda a la gente a HTTPS. Inès: «¡El candado!
    Puedo imprimir los carteles nuevos».

    ¡Bien hecho! Has terminado el capítulo «El candado».

    QUÉ HA PASADO
    El Caddyfile empezaba por :80, la plantilla del paquete: un sitio sin
    nombre, servido solo en HTTP. Con su nombre de dominio como dirección,
    Caddy se encarga solo del HTTPS: pide un certificado a Let's Encrypt
    (ACME), lo guarda, lo renovará, y redirige HTTP a HTTPS. Pero Let's
    Encrypt tiene que poder alcanzar la máquina por el puerto 80 o 443 para
    comprobar que responde por ese nombre: el cortafuegos solo dejaba pasar
    ssh. Por último, www.cycles.example es otro nombre: necesita su propio
    bloque (o su sitio en la lista de direcciones), y su certificado.

    NGINX + CERTBOT Y CADDY, LADO A LADO
      nginx + certbot                      Caddy
      server_name, listen 443 ssl          la dirección del sitio: cycles.example
      certbot --nginx o --webroot          nada: Caddy lo hace al cargar
      ssl_certificate, ssl_certificate_key nada (guardado en /var/lib/caddy)
      return 301 https://…                 automático (308)
      un temporizador para certbot renew   automático
      nginx -t                             caddy validate, caddy fmt
      systemctl reload nginx               systemctl reload caddy (caddy reload)

    BUENA PRÁCTICA
    - Para un certificado público, el nombre tiene que llevar a la máquina
      (DNS) y los puertos 80 y 443 tienen que estar abiertos: vale para
      Caddy como para certbot.
    - Lee el journal después de cada recarga: un certificado rechazado no
      impide a Caddy funcionar, solo lo dice en el journal.
    - caddy validate antes de recargar; caddy fmt para mantener un
      Caddyfile legible.
    - Un nombre por dirección o por bloque: www es un nombre aparte, que
      también se sirve o se redirige (redir https://cycles.example{"{"}uri{"}"} permanent).
    - Para experimentar sin chocar con los límites de Let's Encrypt, Caddy
      puede usar la autoridad de pruebas (opción acme_ca, o tls internal en
      una red privada).

    DOCUMENTACIÓN
    - HTTPS automático: https://caddyserver.com/docs/automatic-https
    - Las direcciones del Caddyfile: https://caddyserver.com/docs/caddyfile/concepts#addresses
    - redir: https://caddyserver.com/docs/caddyfile/directives/redir
    - Tipos de desafío ACME: https://letsencrypt.org/docs/challenge-types/
