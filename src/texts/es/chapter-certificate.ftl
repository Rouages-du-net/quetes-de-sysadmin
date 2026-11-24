### Historia «El Centro de Datos», capítulo 5 «El certificado ha caducado»:
### TLS, Let's Encrypt y certbot. Los comandos, las rutas, los nombres de
### archivo y los mensajes de certbot, openssl, curl y nginx no se traducen.

chapter-certificate = El certificado ha caducado
    .summary = El candado ha desaparecido: certbot, el desafío HTTP, openssl, y una renovación que funciona sola.

## Archivos

certificate-email-awa =
    De:      Awa (responsable de operaciones)
    Para:    tú
    Asunto:  El sitio asusta a los visitantes

    Léa, en el mostrador de la mediateca, me dice que el sitio muestra una
    advertencia de seguridad desde esta mañana (su mensaje está en
    ~/mensaje_de_lea.txt). El certificado HTTPS debe de haber caducado.

    No lo entiendo: se supone que certbot lo renueva solo, lo intenta
    dos veces al día. Y desde 2025, Let's Encrypt ya no envía un correo
    antes de la caducidad: nadie lo vio venir.

    ¿Podrías:
    1. averiguar por qué no funciona la renovación automática;
    2. renovar el certificado, para que el sitio vuelva a ser seguro;
    3. asegurarte de que la próxima vez funcionará COMPLETAMENTE SOLO,
       de principio a fin?

    Para comprobar lo que ve un navegador: curl https://medialibrary.example
    Lo demás está en man certbot y man openssl. La contraseña de sudo no
    ha cambiado.
certificate-message-lea =
    Hola, Awa:

    Esta mañana, al abrir el sitio de la mediateca, Firefox muestra:

      Advertencia: riesgo potencial de seguridad a continuación
      El certificado de medialibrary.example caducó el 21/01/2027.
      Código de error: SEC_ERROR_EXPIRED_CERTIFICATE

    En el móvil, Chrome dice «La conexión no es privada»
    (NET::ERR_CERT_DATE_INVALID). Dos personas usuarias ya me han llamado
    para preguntar si nos habían hackeado. Les he dicho que no escriban
    nada en el sitio mientras tanto.

    Léa
certificate-readme-live =
    This directory contains your keys and certificates.

    `privkey.pem`  : the private key for your certificate.
    `fullchain.pem`: the certificate file used in most server software.
    `chain.pem`    : used for OCSP stapling in Nginx >=1.3.7.
    `cert.pem`     : will break many server configurations, and should not be used
                     without reading further documentation (see link below).

    WARNING: DO NOT MOVE OR RENAME THESE FILES!
             Certbot expects these files to remain in this location in order
             to function properly!

    We recommend not moving these files. For more information, see the Certbot
    User Guide at https://certbot.eff.org/docs/using.html#where-are-my-certificates.

## El sitio

certificate-site-index =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Mediateca del barrio</title></head>
    <body>
    <h1>Mediateca del barrio</h1>
    <p>Abierta de martes a sábado, de 10:00 a 18:00.</p>
    <p>Novedad: reserva tus libros en línea con tu carné de la biblioteca.</p>
    </body>
    </html>

## Eventos

certificate-event-expires =
    El certificado ha caducado, efectivamente: es justo lo que ven los
    navegadores. Pero ¿por qué no se renovó? certbot se ejecuta solo,
    lanzado por systemd: su diario lo sabe (journalctl -u certbot, o
    systemctl --failed). Para probar una renovación sin romper nada,
    man certbot habla de un ensayo (dry run).
certificate-event-challenge =
    Let's Encrypt solo da un certificado a quien demuestra que controla el
    sitio: certbot deja un pequeño archivo (el «desafío») en una carpeta, y
    luego la autoridad lo va a buscar en http://medialibrary.example/.well-known/acme-challenge/.
    Aquí recibe un 404: el archivo no está donde nginx sirve este sitio.

    ¿En qué carpeta deja certbot el desafío (mira cada línea de
    /etc/letsencrypt/renewal/medialibrary.example.conf)? ¿Y qué carpeta
    sirve nginx para medialibrary.example? man certbot te dice cómo
    cambiar la carpeta.
certificate-event-not-reload =
    El nuevo certificado está en el disco… pero curl sigue viendo el
    antiguo. nginx lee su certificado al arrancar o al recargar su
    configuración, no en cada visita: sigue sirviendo el de octubre.
    ¿Qué hay que decirle a nginx?
certificate-event-without-hook =
    El sitio vuelve a ser seguro, y certbot ya puede renovar. Pero dentro
    de 60 días, cuando renueve solo, en plena noche, ¿quién recargará
    nginx? Nadie: el sitio servirá el certificado antiguo hasta que
    caduque, igual que hoy. certbot puede ejecutar un comando después de
    cada renovación correcta: busca «hook» en man certbot.
certificate-event-end =
    curl https://medialibrary.example responde sin advertencia: el candado
    ha vuelto. Y la próxima vez, certbot renovará solo y luego recargará
    nginx solo.

    Awa: «Gracias. Añado una alerta que nos avisará quince días antes de
    la caducidad: ya no podemos contar con los correos de Let's Encrypt».

    ¡Bien hecho! Has terminado el capítulo 5 de El Centro de Datos.

    QUÉ HA PASADO
    El día del incendio, el certificado se pidió antes de restaurar el
    sitio: certbot registró la carpeta del sitio por defecto de Debian,
    /var/www/html. Durante 60 días, ningún problema. Luego, a partir de
    30 días antes de la caducidad, cada renovación automática dejó el
    desafío en esa carpeta, que nginx no sirve para la mediateca: 404,
    fallo, dos veces al día, en silencio. Esta mañana, el certificado
    caducó.

    BUENA PRÁCTICA
    - Un certificado de Let's Encrypt dura 90 días; certbot intenta
      renovarlo 30 días antes del final. Una renovación fallida pasa
      desapercibida: vigila tú la fecha de caducidad (openssl x509
      -checkend, una sonda) y el servicio certbot (systemctl --failed).
    - certbot renew --dry-run después de cada cambio del sitio o de nginx.
    - El desafío HTTP-01 pasa por el puerto 80: la carpeta dada a certbot
      (-w) debe ser la que nginx sirve para ese nombre.
    - nginx lee su certificado al cargarse: un deploy hook (systemctl
      reload nginx) lo recarga después de cada renovación correcta.
    - Comprueba siempre como un visitante: curl https://…, u openssl s_client.

    OTRA MANERA
    Otros clientes ACME: acme.sh (un script de shell, sin dependencias) o
    lego; o un servidor web que se encarga solo (Caddy obtiene y renueva
    sus certificados sin configuración). Y el desafío DNS-01 (un registro
    TXT) en lugar de HTTP-01: el único que da un certificado comodín
    (*.example), pero hay que poder escribir en la zona DNS.

    DOCUMENTACIÓN
    - certbot: https://eff-certbot.readthedocs.io/en/stable/using.html
    - Desafíos de Let's Encrypt: https://letsencrypt.org/docs/challenge-types/
    - openssl x509: https://docs.openssl.org/3.5/man1/openssl-x509/
