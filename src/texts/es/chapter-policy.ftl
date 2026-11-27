### Historia «Correo No Deseado», capítulo 3 «La política»: DMARC
### (informes agregados, alineación, p=quarantine). Los comandos, las rutas,
### los registros DNS y las etiquetas no se traducen.

chapter-policy = La política
    .summary = Pasar DMARC a p=quarantine sin perder el boletín: leer los informes, alinear al proveedor y luego endurecer la política.

## Archivos

policy-email-nour =
    De:      Nour
    Para:    tú
    Asunto:  DMARC

    ¡Hola!

    mailbox.example anuncia que los remitentes que envían mucho tienen que
    publicar una política DMARC de «quarantine» como mínimo. Nuestro boletín
    sale cada semana para casi 500 personas…

    Como aconseja su guía, la semana pasada publiqué una política que no
    bloquea nada (p=none) pero pide informes
    (rua=mailto:dmarc@gardens.example). Han llegado los primeros, los he
    puesto en informes_dmarc. No entiendo nada: es XML.

    El boletín lo envía newsmail.example, un proveedor: su página de ayuda
    sobre DKIM está en carta_newsmail.txt.

    ¿Podrías pasar DMARC a quarantine, sin que nuestro boletín acabe en las
    carpetas de correo no deseado?

    Nour

policy-letter-newsmail =
    newsmail.example — Ayuda — Firmar con tu propio dominio (DKIM)

    Por defecto, nuestros servidores firman tus campañas con nuestro dominio
    (d=newsmail.example). Los destinatarios comprueban la firma, pero para
    DMARC no coincide con el dominio de tu dirección de envío.

    Para que firmemos con tu dominio, deléganos un selector. Añade a la zona
    DNS de tu dominio:

        SELECTOR._domainkey.TU-DOMINIO.   CNAME   SELECTOR.dkim.newsmail.example.

    SELECTOR es el selector de tu cuenta: aquel con el que ya firmamos tus
    campañas (el s= de su firma DKIM, que también dan los informes DMARC
    que recibes).

    Nuestros servidores comprueban tu DNS cada hora: en cuanto el CNAME es
    visible, tus campañas se firman con d=TU-DOMINIO.

    La dirección de retorno (rebotes) se queda en nuestro dominio:
    bounces+…@bounce.newsmail.example.

## Eventos

policy-event-report =
    198.51.100.77: son los servidores de newsmail.example, que envían el
    boletín (412 mensajes en mailbox.example). SPF pasa, DKIM pasa… pero
    para bounce.newsmail.example y newsmail.example, no para
    gardens.example. DMARC exige la alineación: el dominio comprobado por
    SPF (el sobre) o por DKIM (d=) tiene que ser el de la dirección From:.
    Con p=quarantine, esos 412 mensajes acabarían en la carpeta de correo no
    deseado.
policy-event-spoofing =
    192.0.2.66 no pertenece a nadie de la asociación: 17 mensajes en nombre
    de gardens.example, sin SPF ni DKIM válidos. Alguien está suplantando a
    los Huertos. Es exactamente lo que p=quarantine (o reject) va a parar.
policy-event-inclusion =
    Añadir include:_spf.newsmail.example al SPF de gardens.example no cambia
    nada para DMARC: los destinatarios comprueban el SPF del dominio del
    sobre, bounce.newsmail.example, no el de gardens.example. Y cada include
    cuesta consultas DNS (diez como máximo). Es DKIM lo que hay que alinear:
    mira carta_newsmail.txt.
policy-event-point =
    El CNAME de nm1._domainkey no lleva a ninguna parte: en una zona, un
    nombre sin punto final es relativo. nm1.dkim.newsmail.example se
    convierte en nm1.dkim.newsmail.example.gardens.example. Necesita el
    punto final: nm1.dkim.newsmail.example.
policy-event-two =
    Ahora hay dos registros DMARC para gardens.example: el RFC 7489 dice que
    en ese caso se ignore DMARC, como si no hubiera política. Cambia el
    registro existente en lugar de añadir otro.
policy-event-aligned =
    Internet ve el CNAME: newsmail.example firma ahora el boletín con
    d=gardens.example, y la clave se encuentra siguiendo el CNAME. El
    boletín pasa DMARC. Ya se puede endurecer la política.
policy-event-too-early =
    Cuidado: con esta política, el boletín (no alineado) iría a cuarentena,
    o sería rechazado, por los proveedores de correo. Alinea primero la
    firma de newsmail.example.
policy-event-end =
    gardens.example publica p=quarantine (o más estricto), el boletín y los
    correos del servidor pasan DMARC, y los mensajes de 192.0.2.66 ya no
    tienen ninguna posibilidad. Nour: «Echaré un vistazo a los informes
    cada semana».

    ¡Bien hecho! Has terminado el capítulo «La política» y la historia
    «Correo No Deseado».

    QUÉ HA PASADO
    DMARC une SPF y DKIM a la dirección que lee la persona (From:): un
    mensaje pasa si SPF o DKIM pasan para el mismo dominio (alineación). La
    política (p=) dice a los destinatarios qué hacer con los demás: nada
    (none), carpeta de correo no deseado (quarantine), rechazo (reject). Los
    informes (rua=) muestran quién envía en nombre del dominio: aquí, el
    proveedor del boletín, mal alineado, y alguien que lo suplanta.

    BUENA PRÁCTICA
    - Empieza con p=none y rua=, lee los informes, alinea cada servicio que
      envía en nombre del dominio, y solo entonces quarantine, y luego
      reject.
    - Un proveedor se alinea por DKIM (un CNAME hacia su clave, d=tu
      dominio) o por SPF (una dirección de retorno en tu dominio).
    - Un solo registro DMARC, en _dmarc.dominio; sube el serial, comprueba
      lo que ve internet.
    - pct= permite endurecer poco a poco (pct=25, y luego 100).

    DOCUMENTACIÓN
    - DMARC, RFC 7489: https://www.rfc-editor.org/rfc/rfc7489
    - El formato de los informes agregados: https://www.rfc-editor.org/rfc/rfc7489#appendix-C
    - La alineación: https://www.rfc-editor.org/rfc/rfc7489#section-3.1
