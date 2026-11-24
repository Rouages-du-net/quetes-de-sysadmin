### Historia «La Gaceta», capítulo 3 «Azul y verde»: desplegar sin corte,
### con dos ranuras y una comprobación de salud. Los comandos, las rutas y
### los mensajes de nginx, systemctl y curl no se traducen.

chapter-blue-green = Azul y verde
    .summary = Actualizar la aplicación de suscripciones sin corte: la nueva versión al lado de la antigua, su salud comprobada, y luego nginx cambia.

## Archivos

blue-green-message-samia =
    Un mensaje de Samia:

    «La Gaceta ya tiene su Quiosco: la aplicación para suscribirse al
    boletín (curl http://gazette.example/kiosk/). Es un programa Node.js,
    detrás de nginx.

    Puede funcionar en dos copias, «azul» (blue) y «verde» (green):
      - azul: el servicio kiosk-blue, puerto 3001, el código en
        /srv/kiosk/blue (un enlace a una versión de /srv/kiosk/versions/);
      - verde: el servicio kiosk-green, puerto 3002, /srv/kiosk/green
        (parado).
    nginx envía /kiosk/ a una de las dos
    (/etc/nginx/sites-available/gazette).

    Azul ejecuta la 1.4.2. Hay que pasar a la 1.5.0, ya instalada en
    /srv/kiosk/versions/, sin que quienes leen vean la más mínima
    interrupción. Cada versión responde en /health cuando está bien.

    Y deja la versión antigua en marcha hasta que estemos seguros de la
    nueva. Para sudo: gazette-2027.»
blue-green-conf-comment = El Quiosco (suscripciones): la ranura que sirve al público
blue-green-notes-150 =
    Quiosco 1.5.0 — notas de versión

    Novedad: el boletín lo envía el propio Quiosco.

    QUÉ HACER ANTES DE PONERLO EN LÍNEA: indicar el servidor de correo
    en la configuración (/etc/kiosk/kiosk.env), por ejemplo:
      KIOSK_SMTP=smtp.gazette.example
    Sin él, /health responde 503 y la suscripción falla.

## El Quiosco (páginas servidas; { $version }: la versión de la aplicación)

kiosk-welcome =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>El Quiosco de la Gaceta</title></head>
    <body>
    <h1>El Quiosco</h1>
    <p>Recibe el boletín de la Gaceta cada lunes.</p>
    <form method="post" action="subscribe"><input name="email"><button>Suscribirme</button></form>
    <footer>Quiosco { $version }</footer>
    </body>
    </html>
kiosk-archives =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Boletines anteriores</title></head>
    <body>
    <h1>Boletines anteriores</h1>
    <ul><li>Boletín del 17 de mayo</li><li>Boletín del 10 de mayo</li></ul>
    <footer>Quiosco { $version }</footer>
    </body>
    </html>
kiosk-migration-4 = rename_subscribers_mail_to_email

## Eventos

blue-green-event-health-ko =
    /health responde 503: la versión funciona, pero no está en condiciones
    de servir. Una versión que no pasa su comprobación de salud nunca
    recibe tráfico. Lo que le falta probablemente está escrito en sus notas
    de versión (/srv/kiosk/versions/1.5.0/).
blue-green-event-not-restarts =
    El enlace apunta a la nueva versión, pero el servicio sigue respondiendo
    con la antigua: un programa lee su código (y su configuración) al
    arrancar. Hay que reiniciarlo (man systemctl).
blue-green-event-too-early =
    Ay: quienes leen reciben un error en /kiosk/. nginx envía el tráfico a
    una instancia que no responde, o no correctamente. La vuelta atrás es
    inmediata: vuelve a poner la otra ranura en proxy_pass, nginx -t,
    reload. Comprueba /health ANTES de cambiar.
blue-green-event-not-reload =
    El archivo de nginx sí apunta a verde (3002), pero nginx sigue
    sirviendo azul: solo vuelve a leer su configuración al recargar
    (nginx -t, y luego systemctl reload nginx).
blue-green-event-more-net =
    Azul está parado: si la 1.5.0 da un problema esta noche, ya no habrá
    vuelta atrás instantánea. Deja la versión antigua en marcha un tiempo,
    hasta estar seguros.
blue-green-event-end =
    El público ha pasado a la 1.5.0 sin darse cuenta, y la versión antigua
    espera, todavía en marcha, por si acaso. Samia: «Si algo va mal,
    volvemos a cambiar con un solo comando».

    ¡Bien hecho! Has terminado el capítulo 3 de La Gaceta. (Te espera lo
    siguiente: ssh gaceta.)

    QUÉ HA PASADO
    Dos ranuras, azul y verde: una sirve al público, la otra recibe la
    nueva versión. Se arranca, se comprueba su salud (/health) antes de
    que reciba una sola visita, se corrige lo que falta (su
    configuración), y luego el proxy cambia de una vez. Recargar nginx no
    corta ninguna conexión: las peticiones antiguas terminan, las nuevas
    van a verde.

    BUENA PRÁCTICA
    - Lee las notas de versión antes de desplegar.
    - Una comprobación de salud automática (/health) antes de cualquier
      cambio.
    - nginx -t antes de cada recarga; reload, no restart.
    - Deja la versión antigua en marcha hasta que la nueva haya dado
      pruebas: volver atrás es volver a cambiar el proxy.
    - Azul y verde se turnan: la próxima versión irá en azul.

    OTRA MANERA
    El canario (capítulo siguiente) solo envía una pequeña parte de las
    visitas a la nueva versión, para juzgarla con tráfico real; un
    despliegue progresivo (rolling) sustituye los servidores uno a uno.
    Azul-verde: cambio instantáneo y vuelta atrás inmediata, a costa del
    doble de recursos durante el cambio.

    DOCUMENTACIÓN
    - Despliegue azul-verde: https://martinfowler.com/bliki/BlueGreenDeployment.html
    - proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
    - Recargar nginx: https://nginx.org/en/docs/beginners_guide.html#control
