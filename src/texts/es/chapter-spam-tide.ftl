### Historia «El Bote Salvavidas», capítulo «Marea de spam»: el spam llega
### al INBOX mientras se rechaza un boletín de seguridad legítimo. Las
### puntuaciones y las acciones de rspamd (rspamc symbols, rspamd.log,
### actions.conf), una lista blanca (multimap o settings), Bayes (rspamc
### learn_spam, learn_ham). Los comandos, las opciones, las rutas, los
### símbolos y las salidas no se traducen.

chapter-spam-tide = Marea de spam
    .summary = Una marea de phishing y de facturas falsas llega a la secretaria de la estación, mientras que el boletín de seguridad de los guardacostas, que la tripulación lee antes de cada salida, ha dejado de llegar. Lee cómo puntúa el filtro antispam cada mensaje, devuelve sus umbrales a su sitio, confía en el boletín y solo en el boletín, y enséñale al filtro cómo es el spam.

## Archivos

spam-tide-message-leilani =
    De: Leilani (secretaria, Seaholme Lifeboat)
    Lunes 6 de octubre, 8:40

    Hola:

    Dos cosas, y la segunda es la que más importa.

    1. Mi bandeja de entrada se ahoga: «su buzón será suspendido»,
       facturas de empresas de las que nunca hemos oído hablar, premios.
       Los muevo a Junk a mano cada mañana (ya van doscientos), y siguen
       llegando nuevos.

    2. El boletín de seguridad de Coastwatch (news@coastwatch.example) dejó
       de llegar en mayo. La tripulación lo lee antes de cada salida:
       avisos de temporal, mareas. Coastwatch dice que sus correos para
       nosotros son «rechazados como spam». Las reservas que archivé el año
       pasado están en mi carpeta Archive.

    Creo que Yerlan cambió algo en el filtro antispam en mayo.

    Leilani

spam-tide-note-yerlan =
    Notas de Yerlan (rspamd en rampa)

    - rspamd puntúa cada mensaje entrante: Postfix se lo pasa por el
      milter (smtpd_milters = inet:localhost:11332 en main.cf).
    - Cada regla que coincide añade un símbolo con una puntuación; el
      total decide la acción: no action, greylist, add header (el mensaje
      recibe «X-Spam: Yes» y el script Sieve global de Dovecot lo archiva
      en Junk), reject.
    - Nunca edites /etc/rspamd/*.conf: los cambios locales van en
      /etc/rspamd/local.d/ (combinados con los valores por defecto) o en
      override.d/ (que los sustituyen). Luego rspamadm configtest, y sudo
      systemctl reload rspamd.
    - Mayo de 2031: todo el mundo se quejaba de las etiquetas [SPAM], así
      que moví los umbrales en local.d/actions.conf. Ahora está más
      tranquilo.
    - rspamc habla con el rspamd en marcha: rspamc symbols ARCHIVO muestra
      la puntuación de un mensaje, rspamc stat los contadores. Su
      registro: /var/log/rspamd/rspamd.log.
    - Bayes está configurado (Redis), pero nunca lo entrené.

    Yerlan

## Eventos

spam-tide-event-scores =
    Cada línea es un símbolo y su puntuación; el total y la acción están
    arriba (o en «(default: F (no action): [4.80/8.00] […])» en
    rspamd.log). El phishing puntúa unos 4,8 y las facturas falsas 6,9:
    por debajo de todos los umbrales que dejó Yerlan, así que pasan sin
    tocar. El boletín puntúa 8,89, por encima de reject = 8: se rechaza en
    la puerta. ¿Qué dicen los umbrales? (local.d/actions.conf; man rspamc,
    man rspamadm.)
spam-tide-event-milter-off =
    Postfix ya no le pregunta nada a rspamd: cada mensaje, spam o no, va
    directo a los buzones, y ya nadie ve siquiera una puntuación. El
    milter es la única entrada del filtro; vuelve a poner smtpd_milters (y
    postfix reload).
spam-tide-event-reject-low =
    Con un reject tan bajo, casi todo se rechaza, incluidas las reservas y
    el correo de la tripulación: un mensaje de un amigo puntúa alrededor
    de cero, a veces un poco más. Un umbral es un equilibrio: rechaza solo
    lo que seguro es spam (15 por defecto), marca lo que probablemente es
    spam.
spam-tide-event-thresholds =
    Los umbrales vuelven a ser sensatos: greylist, add header, reject en
    orden creciente, lo bastante separados. Las facturas falsas y los
    premios reciben ahora «X-Spam: Yes» y van a Junk. El phishing (4,8)
    solo pasa por greylist: aplazado una vez, vuelve cinco minutos después
    y sigue llegando al INBOX. El boletín ya no se rechaza, pero acaba en
    Junk con el spam.
spam-tide-event-bulletin-junk =
    El último boletín fue al Junk de Leilani: con 8,89 supera add_header.
    Mira sus símbolos: la mayoría vienen de la plataforma de envíos
    masivos por la que se envía (sendwave.example: en una lista de
    bloqueo, enlaces de seguimiento), la misma plataforma que el spam de
    premios. Confía en la dirección propia del boletín en lugar de en la
    plataforma (man rspamc; los módulos multimap y settings:
    docs.rspamd.com).
spam-tide-event-leak =
    Cuidado: esa regla también baja la puntuación del spam. El spam de
    premios también viene de sendwave.example, con un remitente SMTP en
    sendwave.example: confiar en la plataforma (su dominio o sus
    direcciones) deja pasar su spam. Confía en news@coastwatch.example, la
    dirección de la cabecera From: (multimap: type = "from" con
    extract_from = "mime"; settings: from_mime), y en nada más.
spam-tide-event-whitelist =
    El boletín pasa ahora sin ninguna acción, y la regla no coincide con
    nada más: el remitente SMTP de un boletín suele ser la dirección de
    rebotes de la plataforma, por eso los mapas «from» miran por defecto
    el remitente SMTP y hacía falta extract_from = "mime".
spam-tide-event-poisoned =
    rspamd acaba de aprender reservas como spam: Archive contiene los
    mensajes que Leilani conserva, los que hay que aprender como legítimos.
    Un mensaje aprendido en la clase equivocada se puede volver a aprender
    en la correcta (rspamd lo reaprende).
spam-tide-event-bayes =
    Bayes tiene ahora suficientes mensajes de las dos clases (min_learns):
    clasifica cada mensaje a partir de las palabras que aprendió, y añade
    BAYES_SPAM o BAYES_HAM.
spam-tide-event-caught =
    Un phishing, una factura y un spam de premios nuevos están todos
    marcados como spam ahora (rspamc symbols sobre mensajes nuevos:
    BAYES_SPAM empuja el phishing por encima de add_header).
spam-tide-event-end =
    Leilani: «El Junk de esta mañana tiene cuarenta mensajes, mi INBOX
    tiene las reservas, y la tripulación recibió el aviso de temporal
    antes de la salida del sábado. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «Marea de spam».

    QUÉ HA PASADO
    Unos umbrales movidos con prisa dejaban pasar sin marcar el spam por
    debajo de 8 y rechazaban todo lo que estaba por encima, incluido un
    boletín legítimo enviado por una plataforma de envíos masivos que
    también usan los spammers. Leíste las puntuaciones, devolviste los
    umbrales a su sitio (reject 15, add header 6, greylist 4), confiaste
    en la dirección propia del boletín en lugar de en su plataforma, y
    entrenaste Bayes con el spam que Leilani ya había clasificado y las
    reservas que archivó.

    BUENA PRÁCTICA
    - Mira los símbolos antes de tocar los umbrales: rspamc symbols sobre
      un mensaje guardado, o la línea de rspamd.log.
    - Umbrales: rechaza lo que seguro es spam, marca (add header) lo que
      probablemente es spam; la carpeta Junk del usuario es la red de
      seguridad, un reject no.
    - Una lista blanca lo más estrecha posible: una dirección, idealmente
      comprobada (DKIM, SPF); nunca toda una plataforma de envíos ni un
      dominio que los spammers puedan falsificar.
    - Entrena Bayes con correo que las personas clasificaron ellas mismas,
      de las dos clases, con suficientes mensajes (min_learns); mantén el
      filtro en el camino (milter).
    - Los cambios locales en local.d/ u override.d/, comprobados con
      rspamadm configtest antes de una recarga.

    DOCUMENTACIÓN
    - Acciones y puntuaciones: https://docs.rspamd.com/configuration/metrics/
    - El módulo multimap: https://docs.rspamd.com/modules/multimap/
    - Settings: https://docs.rspamd.com/configuration/settings/
    - Estadísticas (Bayes): https://docs.rspamd.com/configuration/statistic/
    - Postfix y los milters: https://www.postfix.org/MILTER_README.html
