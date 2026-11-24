### Historia «El Bote Salvavidas», capítulo «La oficina de clasificación»:
### filtros Sieve con Pigeonhole de Dovecot: fileinto para bookings@, una
### respuesta automática de ausencia que responde a un alias pero no a una
### lista de correo. sievec, sieve-test, doveadm sieve, el script activo, la
### entrega por LMTP. Los comandos, las opciones, las rutas, el código Sieve
### y las salidas no se traducen.

chapter-sorting-office = La oficina de clasificación
    .summary = Empiezan las visitas escolares de invierno, y la secretaria quiere las reservas en su propia carpeta; el tesorero se va tres semanas y necesita una respuesta de ausencia que conteste a las personas, no a las listas de correo. Escribe los scripts Sieve, compruébalos, haz que sean los activos, y mira cómo el correo nuevo va donde debe.

## Archivos

sorting-office-message-marisol =
    De: Marisol (presidenta, Seaholme Lifeboat)
    Lunes 3 de noviembre, 9:05

    ¡Hola otra vez!

    Dos cosillas antes del invierno:

    1. Leilani: todo lo que se escribe a bookings@lifeboat.example llega a
       su buzón (es un alias), mezclado con lo demás. Le gustaría tenerlo
       en una carpeta llamada Bookings, y el resto de su correo donde está
       ahora.

    2. Aziz, nuestro tesorero, está fuera hasta el 24 de noviembre. Le
       gustaría una respuesta automática («Estoy fuera hasta el 24,
       escribe a Marisol para cualquier urgencia»), para las personas que
       le escriben, y también para las que escriben a treasurer@, que
       también le llega. El año pasado su respuesta fue a la lista de
       correo de la federación y la recibieron doscientas estaciones, dos
       veces: nunca más, por favor. Yerlan dice que hay un script antiguo
       suyo por algún sitio.

    He puesto dos mensajes de ejemplo en tu carpeta personal, para probar.

    Marisol

sorting-office-note-yerlan =
    Notas de Yerlan (Sieve en rampa)

    - Dovecot ejecuta los scripts Sieve cuando entrega el correo (LMTP,
      plugin sieve): primero los globales (/etc/dovecot/sieve/before.d: el
      spam a Junk), luego el script activo del usuario.
    - Los scripts de un usuario viven en ~/sieve/NOMBRE.sieve (carpeta
      personal: /var/vmail/lifeboat.example/NOMBRE); el activo es aquel al
      que enlaza ~/.dovecot.sieve (90-sieve.conf). sudo doveadm sieve list
      -u USUARIO los muestra, doveadm sieve activate elige uno.
    - sievec ARCHIVO comprueba y compila un script; sieve-test SCRIPT
      MENSAJE dice lo que haría con un mensaje, sin entregarlo.
    - Los archivos bajo /var/vmail son de vmail (5000): Dovecot tiene que
      poder leer lo que pongas ahí.
    - El lenguaje: RFC 5228 (if, header, address, envelope, fileinto,
      stop), RFC 5230 para vacation. man sievec, man sieve-test.

    Yerlan

## Eventos

sorting-office-event-read-old =
    Ese es el script del año pasado: reject no responde y conserva el
    mensaje, lo rechaza. Se perdería cada mensaje para Aziz, y el rechazo
    vuelve al remitente del sobre, incluida la dirección de la lista de
    correo. Una respuesta de ausencia es lo que hace la extensión vacation
    (RFC 5230): conserva el mensaje y responde una vez a cada persona.
sorting-office-event-syntax =
    El compilador se paró en la línea que indica: falta un punto y coma,
    un comando mal escrito, o una extensión usada sin su require.
    Pigeonhole informa del primer error; arréglalo y vuelve a compilar
    (sievec) antes de activar.
sorting-office-event-reject-live =
    Un mensaje para Aziz se ha rechazado, y el rechazo ha respondido a su
    remitente: así es como la respuesta del año pasado llegó a la lista.
    Desactiva ese script (doveadm sieve deactivate, o activando otro) y
    usa vacation.
sorting-office-event-not-active =
    El script está escrito, pero ningún mensaje pasa por él: no es el
    activo (~/.dovecot.sieve no apunta a él). doveadm sieve activate -u
    USUARIO NOMBRE lo hace activo (o, en la carpeta personal del usuario,
    ln -s sieve/NOMBRE.sieve .dovecot.sieve, propiedad de vmail).
sorting-office-event-folder =
    El script de Leilani archiva un mensaje para bookings@ en Bookings y
    deja uno directo en su INBOX (el mismo resultado que mostraría
    sieve-test). La carpeta existe, o fileinto :create la crea (require
    "mailbox").
sorting-office-event-sorted-live =
    Ha llegado una reserva de verdad: «fileinto action: stored mail into
    mailbox 'Bookings'» en mail.log. La prueba tenía razón, y LMTP ha
    hecho lo mismo.
sorting-office-event-alias-missing =
    El script de Aziz responde a un mensaje enviado a aziz@, pero no a uno
    enviado a treasurer@: el comando vacation solo responde cuando una de
    las direcciones del usuario está en To o Cc, y treasurer@ es un alias,
    no su dirección («discarding vacation response for implicitly
    delivered message» en el registro). La etiqueta :addresses lista sus
    otras direcciones.
sorting-office-event-vacation =
    El vacation de Aziz responde a un mensaje directo y lo conserva en su
    INBOX. Vacation también se calla solo donde debe: listas de correo
    (List-Id…), mensajes automáticos (Auto-Submitted), correo masivo,
    MAILER-DAEMON, y el mismo remitente dos veces dentro de :days.
sorting-office-event-alias =
    Su respuesta cubre también treasurer@, y el mensaje de la lista no
    recibe ninguna: el comando vacation ve su cabecera List-Id.
sorting-office-event-replied-live =
    Un mensaje de verdad para Aziz ha recibido su respuesta: «sent
    vacation response to <…>» en mail.log. El siguiente de la misma
    persona no recibirá ninguna durante :days días.
sorting-office-event-end =
    Marisol: «Leilani ha encontrado esta mañana tres reservas de escuelas
    en su carpeta nueva, y la respuesta de Aziz ha salido para el
    astillero y la gestoría. Ni una palabra a la federación. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «La oficina de clasificación».

    QUÉ HA PASADO
    El correo se clasifica al entregarse: el LMTP de Dovecot ejecuta los
    scripts Sieve globales, y luego el activo del usuario. Escribiste un
    script que archiva los mensajes para bookings@ en su propia carpeta y
    otro que responde a quienes escriben a Aziz mientras está fuera,
    incluido su alias y sin tocar las listas de correo, los comprobaste
    con sievec y sieve-test, los activaste, y miraste cómo pasaba por
    ellos el correo nuevo.

    BUENA PRÁCTICA
    - Una respuesta de ausencia es vacation, nunca reject (que rechaza el
      mensaje) ni redirect: vacation conserva el correo, responde una vez
      por remitente y :days, y se calla ante las listas y los mensajes
      automáticos.
    - Da a vacation las otras direcciones del usuario (:addresses) cuando
      el correo llega por alias.
    - Comprueba antes de activar: sievec para la sintaxis, sieve-test
      sobre ejemplos reales para el resultado; luego mira el registro con
      el siguiente mensaje real.
    - Solo hay un script personal activo: doveadm sieve list muestra cuál.

    DOCUMENTACIÓN
    - Sieve (RFC 5228): https://www.rfc-editor.org/rfc/rfc5228
    - Vacation (RFC 5230): https://www.rfc-editor.org/rfc/rfc5230
    - El plugin Sieve de Pigeonhole: https://doc.dovecot.org/2.4.1/core/plugins/sieve.html
    - Vacation en Pigeonhole: https://doc.dovecot.org/2.4.1/core/config/sieve/extensions/vacation.html
    - doveadm sieve: https://doc.dovecot.org/2.4.1/core/man/doveadm-sieve.1.html
