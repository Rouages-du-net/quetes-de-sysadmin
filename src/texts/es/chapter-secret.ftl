### Historia «La Cooperativa», capítulo «El secreto»: un .env servido por
### nginx. Las directivas de nginx, las rutas y la salida de las
### herramientas no se traducen.

chapter-secret = El secreto
    .summary = La clave de pago anda suelta por internet: averiguar cómo salió, cerrar la fuga en nginx, bloquear a quien se la llevó, cambiar la clave.

## Archivos

# { $key }: la nueva clave de pago
secret-email-awa =
    De:      Awa
    Para:    tú
    Asunto:  URGENTE: nuestra clave de pago

    El proveedor del terminal de pago acaba de llamar: nuestra clave
    secreta se vio anoche en internet. La ha desactivado, y nos ha dado
    una nueva:

      { $key }

    ¡Mientras la caja use la antigua, se acabaron los pagos con tarjeta!
    La clave está en el archivo .env de la aplicación de la caja
    (/srv/till/app), que la aplicación lee al arrancar.

    Pero primero: ¿cómo ha salido? Intenta pedirla tú al sitio web (curl
    http://coop.example/.env), mira el registro de nginx
    (/var/log/nginx/access.log), y cierra la puerta. Si encuentras quién se
    la llevó, bloquéalo también (man nginx… y la documentación de deny).

    Para sudo: rabano-2027

## Eventos

secret-event-env-only =
    /.env ya no sale… pero /.git/config sí (prueba con curl). La
    carpeta .git contiene la dirección del repositorio, con un token de acceso
    dentro. No solo hay que esconder los archivos .env, sino TODOS los
    archivos ocultos: una location con una expresión regular (location ~
    /\. ), o una raíz que solo contenga lo que debe ser público.
secret-event-site-broken =
    Cuidado: la fuga está cerrada, pero el sitio (/) o la caja (/till/) ya
    no responde con normalidad. Compruébalo con curl, y vuelve a leer tu
    configuración (sudo nginx -t).
secret-event-closed =
    Los archivos ocultos ya no salen, y el sitio sigue respondiendo.
# { $address }: la dirección bloqueada
secret-event-attacker =
    { $address } recibe ahora un 403: es la dirección que descargó los
    archivos .env y .git/config anoche (python-requests, a las 3:12). Ya no
    volverá por este sitio… pero lo que se llevó, ya lo tiene: hay que
    cambiar los secretos.
secret-event-key-written =
    La nueva clave está en .env… pero la caja sigue funcionando con la
    antigua: la aplicación solo lee su .env al arrancar. Compruébalo con
    curl http://127.0.0.1:3000/health.
secret-event-end =
    Se acabó la fuga, la dirección está bloqueada, y la caja vuelve a
    aceptar tarjetas. Awa: «Uf. Lo hablaremos en la próxima reunión».

    ¡Bien hecho! Has terminado el capítulo «El secreto».

    QUÉ HA PASADO
    El sitio se servía desde la carpeta de la aplicación: nginx entregaba
    todo lo que había en ella, incluidos los archivos ocultos
    (.env, .git). Los robots piden estas direcciones a todos los sitios, cada
    noche. El registro de accesos de nginx guarda cada petición: la hora,
    la dirección, el código (200: el archivo ha salido).

    BUENA PRÁCTICA
    - Una raíz que contenga SOLO lo que debe ser público; nunca la carpeta
      de una aplicación, con su código y sus secretos.
    - Prohíbe los archivos ocultos en todas partes: location ~ /\. {"{"}
      deny all; {"}"}.
    - Los secretos, legibles solo por la aplicación (chmod 600,
      propiedad de la cuenta de la aplicación), y nunca en git.
    - Un secreto que se ha filtrado está perdido: cámbialo (la clave de
      pago, pero también la contraseña de la base de datos y el token de
      git, ¡lo siguiente que hay que hacer!).
    - Después de una fuga: lee el registro de accesos (grep '\.env'
      access.log), apunta quién, cuándo, qué.

    DOCUMENTACIÓN
    - location: https://nginx.org/en/docs/http/ngx_http_core_module.html#location
    - deny: https://nginx.org/en/docs/http/ngx_http_access_module.html

## La aplicación de la caja (compartida con los capítulos siguientes, ver
## till-web.ts): las palabras que ve quien juega, en el idioma
secret-till-env-payment = CLAVE_PAGO
secret-till-login = acceso
secret-till-health-payment = pago
secret-till-health-revoked = clave_revocada
secret-till-title = Caja
secret-till-site = Cooperativa
secret-till-lang = es
