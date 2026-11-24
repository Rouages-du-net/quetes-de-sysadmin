### Historia «Correo No Deseado», capítulo 1 «El cartero»: SPF.
### Los comandos, las rutas, los registros DNS y los mensajes de Postfix no
### se traducen.

chapter-postman = El cartero
    .summary = Los correos de bienvenida de los Huertos Comunitarios están atascados: el SPF publicado sigue siendo el del antiguo proveedor de alojamiento.

## Archivos

postman-email-nour =
    De:      Nour
    Para:    tú
    Asunto:  Los correos de bienvenida ya no llegan

    ¡Hola, y gracias por echarnos una mano!

    La semana pasada dejamos nuestro antiguo proveedor de alojamiento
    (old-hosting.example): el sitio y el correo de los Huertos Comunitarios
    funcionan ahora en nuestro propio servidor, este. Todo iba bien… hasta
    que cinco socias y socios nuevos nos escribieron: nunca recibieron el
    correo de bienvenida que envía el sitio cuando te inscribes. Los cinco
    tienen una dirección en mailbox.example.

    No entiendo mucho de esto, pero vi un comando, mailq, que muestra el
    correo que está esperando. Y está /var/log/mail.log.

    El DNS de gardens.example también está en este servidor (BIND), con una
    copia en el registro (ns2.registry.example), igual que antes en el
    proveedor.

    La contraseña de sudo: semillas-2027.

    ¡Gracias!
    Nour

## Eventos

postman-event-differs =
    mailbox.example no rechaza el correo para siempre: 451 es un código
    «temporal» (4xx), Postfix guarda el mensaje y volverá a intentarlo. Pero
    el motivo está claro: «neither SPF nor DKIM passed». Ni SPF (que dice
    qué máquinas pueden enviar en nombre de un dominio) ni DKIM (una firma)
    demuestran que este servidor habla de verdad en nombre de
    gardens.example. Empieza por SPF: es un registro TXT del dominio, que
    empieza por v=spf1 (dig TXT gardens.example).
postman-event-old =
    Este es el SPF de gardens.example: «include:_spf.old-hosting.example
    -all». Solo autoriza los servidores del antiguo proveedor (lo que
    publica _spf.old-hosting.example), y -all rechaza todos los demás…
    incluido este servidor, 203.0.113.30. El registro está en la zona, en
    este servidor: /etc/bind/zones/db.gardens.example.
postman-event-two =
    Cuidado: la zona contiene ahora dos registros que empiezan por v=spf1.
    El RFC 7208 es estricto: con dos registros SPF, el resultado es
    «permerror», como si ninguno fuera válido. Sustituye el antiguo en lugar
    de añadir otro.
postman-event-serial =
    Este servidor publica el SPF correcto, pero el resto de internet también
    pregunta al secundario del registro, que conserva la versión antigua:
    dig TXT gardens.example @ns2.registry.example. El secundario solo vuelve
    a copiar la zona si su número de serie (serial, en el SOA) sube.
postman-event-spf =
    El SPF que ve ahora internet autoriza a 203.0.113.30 a enviar en nombre
    de gardens.example. Los correos que esperan solo saldrán en el próximo
    intento de Postfix (cada pocos minutos); para no esperar: sudo
    postqueue -f, y luego mailq.
postman-event-end =
    La cola está vacía: mailbox.example ha aceptado los cinco correos de
    bienvenida. Nour: «¡Amina acaba de contestar, le ha llegado! … en su
    carpeta de correo no deseado, pero le ha llegado».

    ¡Bien hecho! Has terminado el capítulo «El cartero».

    QUÉ HA PASADO
    Un servidor que recibe correo comprueba que el remitente puede enviar en
    nombre de su dominio. SPF responde a la pregunta «¿puede esta dirección
    IP enviar en nombre de gardens.example?»: es un registro TXT del dominio
    (v=spf1 …). Tras la mudanza, seguía autorizando al antiguo proveedor, no
    a este servidor. 451 es un error temporal: Postfix guardó los mensajes y
    los volvió a enviar.

    BUENA PRÁCTICA
    - Un solo registro SPF por dominio; cámbialo cuando cambies de servidor
      de envío (mx, a, ip4:…, include:… para un proveedor).
    - Termina con -all (rechazar el resto) o ~all (marcarlo), nunca +all.
    - Cambiar la zona también es subir el serial, y luego comprobar lo que
      ve internet: dig @ns2.registry.example.
    - mailq y /var/log/mail.log dicen por qué espera un mensaje.

    DOCUMENTACIÓN
    - SPF, RFC 7208: https://www.rfc-editor.org/rfc/rfc7208
    - postqueue: https://www.postfix.org/postqueue.1.html
    - Archivos de zona de BIND: https://bind9.readthedocs.io/en/stable/chapter3.html
