### Historia «El Bote Salvavidas», capítulo «Buzón lleno»: el buzón de
### Saoirse supera su cuota y su correo rebota. La cuota de Dovecot
### (maildirsize, doveadm quota), la userdb, doveadm expunge con una consulta
### de búsqueda, un aviso de cuota. Los comandos, las opciones, las rutas,
### los parámetros y las salidas no se traducen.

chapter-mailbox-full = Buzón lleno
    .summary = Desde el sábado, la responsable de recaudación de la estación de salvamento no recibe nada, y a sus patrocinadores les vuelven los mensajes. Averigua por qué el servidor de correo rechaza su correo, haz sitio como se debe, y asegúrate de que la próxima vez reciba un aviso.

## Archivos

mailbox-full-message-marisol =
    De: Marisol (presidenta, Seaholme Lifeboat)
    Martes 16 de septiembre, 9:10

    ¡Hola, y gracias por ayudarnos!

    Saoirse, que lleva nuestra recaudación de fondos, no ha recibido ni un
    solo correo desde el sábado. Peor aún: Amara, de la tienda náutica que
    patrocina nuestra campaña de invierno, me reenvió el mensaje que le
    volvió, «Mail delivery failed». Estamos en plena campaña de invierno.

    Nuestro servidor de correo es rampa, donde estás ahora; sudo funciona
    con tu contraseña. Yerlan lo montó hace años y dejó una nota. La junta
    acordó ayer darle a Saoirse 2 GB en lugar de 1, ya que recibe todas
    las fotos y los documentos de los patrocinadores; pero, por favor, no
    abras las compuertas para todo el mundo.

    Marisol

mailbox-full-note-yerlan =
    Notas de Yerlan (rampa, 2028, con algunas actualizaciones desde entonces)

    - Postfix recibe el correo de lifeboat.example y se lo pasa a Dovecot
      por LMTP (virtual_transport en /etc/postfix/main.cf). Todo se
      registra en /var/log/mail.log.
    - Dovecot guarda el correo de cada persona en
      /var/vmail/lifeboat.example/NOMBRE/Maildir, propiedad de vmail. Las
      carpetas son .Trash, .Sent… dentro del Maildir.
    - Los usuarios están en /etc/dovecot/users (passwd-file: una línea por
      persona, campos extra al final, como userdb_algo=valor).
    - La configuración: /etc/dovecot/conf.d/*.conf. doveconf -n muestra lo
      que lee Dovecot; tras un cambio, sudo doveadm reload (o systemctl
      reload dovecot).
    - Todo el mundo tiene 1G de cuota (90-quota.conf). Usé la cuota
      Maildir++, como en el servidor antiguo: el uso se guarda en un
      archivo llamado maildirsize.
    - doveadm lo hace todo como root: doveadm quota, doveadm mailbox,
      doveadm expunge… (man doveadm).

    Yerlan

## Eventos

mailbox-full-event-bounces =
    Ahí está: cada mensaje para saoirse@lifeboat.example termina con «552
    5.2.2 … Quota exceeded (mailbox for user is full)», status=bounced, y
    Postfix devuelve un aviso de no entrega al remitente. El LMTP de
    Dovecot se niega a guardar el mensaje porque su buzón supera su cuota.
    ¿Cómo de lleno está, y qué ocupa el sitio? (man doveadm: quota get.)
mailbox-full-event-quota-get =
    La cuota se cuenta en kilobytes: Value es lo que usa, Limit lo que
    puede usar. Está por encima del 100 %. Una vez que un buzón supera su
    límite, Dovecot rechaza cada mensaje nuevo (el margen de
    almacenamiento solo deja que un mensaje cruce el límite). ¿Cuáles de
    sus carpetas ocupan ese sitio? (doveadm mailbox status con messages y
    vsize, o du sobre el Maildir.)
mailbox-full-event-trash =
    Su Papelera contiene cientos de megabytes: las fotos de las jornadas de
    puertas abiertas de 2029 y 2030, borradas pero nunca vaciadas.
    doveadm puede eliminar los mensajes que coinciden con una consulta de
    búsqueda, para un usuario y un buzón (man doveadm, y man
    doveadm-search-query para las fechas: savedbefore, before, 2w,
    AAAA-MM-DD…). Prueba antes la consulta con doveadm search.
mailbox-full-event-lost =
    Su INBOX ha perdido mensajes: borrar su correo al por mayor no es
    hacer sitio, es perder los documentos de los patrocinadores que
    todavía necesita. Aquí, vuelve a empezar el capítulo (o usa la
    instantánea de rescate) y quita solo lo que es antiguo y ya está en la
    Papelera.
mailbox-full-event-unlimited =
    Alguien no tiene ahora ninguna cuota. Un buzón ilimitado llena el
    disco algún día, y entonces nadie recibe nada. Marisol pidió 2 GB para
    Saoirse, no para todo el mundo: conserva un límite para cada usuario.
mailbox-full-event-stale =
    Los archivos han desaparecido, pero Dovecot sigue creyendo que el
    buzón está lleno: con la cuota Maildir++, el uso vive en maildirsize,
    y Dovecot no nota los archivos quitados a sus espaldas. Las entregas
    siguen rebotando. Pide a Dovecot que vuelva a contar (man doveadm:
    quota recalc), y la próxima vez quita el correo a través de Dovecot
    (doveadm expunge), que mantiene la cuenta correcta.
mailbox-full-event-expunged =
    La Papelera antigua ha desaparecido, su INBOX y su Sent están
    intactos, y la cuenta de la cuota coincide con los archivos: vuelve a
    haber sitio. El próximo mensaje para ella se guardará.
mailbox-full-event-raised =
    El límite de Saoirse es ahora el que acordó la junta, y solo el suyo.
    Un campo extra de la userdb (userdb_quota_storage_size=2G en
    /etc/dovecot/users) sustituye la configuración para un usuario;
    doveadm user y doveadm quota get muestran lo que aplicará Dovecot.
mailbox-full-event-delivered =
    Un mensaje ha llegado al INBOX de Saoirse: «stored mail into mailbox
    'INBOX'» en el registro, status=sent del lado de Postfix.
mailbox-full-event-warning =
    El aviso de cuota está en la configuración con la que funciona
    Dovecot: cuando un buzón cruza ese porcentaje, Dovecot ejecuta el
    servicio quota-warning, que escribe al usuario. Solo salta en el
    momento en que se cruza el límite.
mailbox-full-event-end =
    Marisol: «Saoirse tiene doce mensajes nuevos, entre ellos el dosier de
    patrocinio de Amara. Le he dicho a Amara que lo vuelva a enviar;
    ¡gracias!»

    ¡Bien hecho! Has terminado el capítulo «Buzón lleno».

    QUÉ HA PASADO
    El buzón de Saoirse había llegado a su cuota de 1 GiB, sobre todo con
    una Papelera antigua llena de fotos. El LMTP de Dovecot rechazaba cada
    mensaje nuevo con «552 5.2.2 Quota exceeded» y Postfix los devolvía a
    sus remitentes. Encontraste los rebotes en mail.log, mediste el buzón
    con doveadm, eliminaste la Papelera antigua con una consulta de
    búsqueda, diste a Saoirse los 2 GiB acordados en la userdb en lugar de
    a todo el mundo, y añadiste un aviso para que se entere antes de que
    vuelva a llenarse.

    BUENA PRÁCTICA
    - Lee primero el registro: el código de respuesta (552 5.2.2) y la
      línea de Dovecot dicen exactamente quién rechazó y por qué.
    - Quita el correo a través de Dovecot (doveadm expunge -u USUARIO
      mailbox Trash savedbefore 365d), prueba la consulta con doveadm
      search, y nunca borres a mano archivos de un Maildir: la cuota y los
      índices quedarían mal (doveadm quota recalc arregla la cuenta).
    - Una cuota por usuario, desde la userdb; ningún buzón ilimitado.
    - Avisa antes de que esté lleno (quota_warning), y plantéate
      quota_full_tempfail = yes: un buzón lleno aplaza entonces el correo
      (4.2.2) en lugar de devolverlo, y te da unos días para reaccionar.
    - Para un servidor nuevo, Dovecot recomienda el controlador de cuota
      count en lugar de Maildir++.

    DOCUMENTACIÓN
    - El plugin de cuota: https://doc.dovecot.org/2.4.1/core/plugins/quota.html
    - doveadm quota: https://doc.dovecot.org/2.4.1/core/man/doveadm-quota.1.html
    - doveadm expunge: https://doc.dovecot.org/2.4.1/core/man/doveadm-expunge.1.html
    - Consultas de búsqueda: https://doc.dovecot.org/2.4.1/core/man/doveadm-search-query.7.html
    - passwd-file y sus campos extra: https://doc.dovecot.org/2.4.1/core/config/auth/databases/passwd_file.html

## Lo que comparten los tres capítulos, guardado aquí para que se cargue con
## la historia: el correo que llega a rampa (asuntos, cuerpos, las palabras
## de las que está hecho cada tipo de correo). Una lista se separa con |. El
## Bayes de rspamd aprende estas palabras: las listas del spam y las del
## correo legítimo no deben solaparse.

lifeboat-month-names = enero | febrero | marzo | abril | mayo | junio | julio | agosto | septiembre | octubre | noviembre | diciembre
lifeboat-visit-months = noviembre | diciembre | marzo | abril
lifeboat-schools = la escuela del Puerto | el colegio San Brendan | los scouts de Northcliff | los cadetes del mar de Seaholme | el instituto de Westbay | la guardería de las Rocas | los guardas del Acantilado
lifeboat-words-ham = visita | estación | grupo | niños | sábado | cobertizo | tripulación | entrenamiento | salida | turnos | voluntarios | donativo | rifa | recorrido | profesores | almuerzo | aparcamiento | puerto | chalecos | simulacro | marea | gracias | mañana | tarde | entradas | regalo | tienda | café | microbús
lifeboat-crew-whats = salida | entrenamiento | simulacro | práctica con el tractor
lifeboat-crew-days = sábado | domingo | miércoles
lifeboat-mail-booking-subject = Solicitud de visita: { $school }, { $day } de { $month }
lifeboat-mail-booking-body =
    Hola:

    Nos encantaría traer un grupo de { $school } a visitar la estación y el cobertizo del bote, unos { $children } niños y cuatro profesores. ¿Podríamos reservar un recorrido el día { $day }, por la mañana si la marea lo permite? Traeremos nuestro propio almuerzo.

    Notas: { $notes }.

    Muchas gracias,
    { $name }
lifeboat-mail-crew-subject = Turnos de la tripulación: { $what } el { $day }
lifeboat-mail-crew-body =
    Hola a todo el equipo:

    Los turnos de la próxima { $what } están en el tablón de la estación. Revisen sus chalecos y díganme si no pueden venir.

    Notas: { $notes }.

    { $name }

lifeboat-words-phish = verificar | cuenta | suspendida | buzón | contraseña | inmediatamente | confirmar | acceso | protección | desactivación | almacenamiento | cuota | ampliar | validar | credenciales | restaurar | identificarse | caducidad
lifeboat-mail-phish-name = Administrador de correo
lifeboat-mail-phish-subjects = Acción requerida: su buzón será suspendido | Límite de almacenamiento del buzón alcanzado | Confirme su cuenta para evitar la desactivación
lifeboat-mail-phish-body = <html><body><p>Estimado usuario { $name }:</p><p>Su buzón de { $domain } ha alcanzado su límite de almacenamiento y será suspendido. { $words }.</p><p><a href="{ $link }">Verificar su cuenta</a></p><p>Administrador de correo de { $domain }</p></body></html>
lifeboat-words-invoice = factura | pago | vencida | pendiente | remesa | transferencia | liquidar | importe | saldo | penalización | referencia | urgente | contabilidad | último | requerimiento
lifeboat-mail-invoice-name = Contabilidad
lifeboat-mail-invoice-subjects = FACTURA VENCIDA - ÚLTIMO AVISO | RECORDATORIO DE PAGO - ACCIÓN URGENTE | AVISO DE SALDO PENDIENTE
lifeboat-mail-invoice-body = <html><body><p>Buenos días:</p><p>Adjuntamos el último aviso de la factura vencida { $number }. { $words }.</p><p>Departamento de Contabilidad</p></body></html>
lifeboat-words-prize = ganador | premio | reclamar | recompensa | cripto | monedero | bono | lotería | afortunado | sorteo | seleccionado | enhorabuena | exclusivo | vale | gratis
lifeboat-mail-prize-name = Gran Sorteo
lifeboat-mail-prize-subjects = ¡Ha GANADO! | ¡Reclame ya su bono cripto! | ¡Su recompensa exclusiva le espera!
lifeboat-mail-prize-body = <html><body><img src="{ $image }"><p>¡Enhorabuena! Ha sido seleccionado en nuestro sorteo { $draw }.</p><p><a href="{ $claim }">Reclame su recompensa ahora</a></p><p>{ $words }</p><p><a href="{ $unsubscribe }">Darse de baja</a></p></body></html>

lifeboat-mail-bulletin-subject = Boletín de seguridad Coastwatch: tiempo y mareas, { $day } de { $month }
lifeboat-mail-bulletin-body = <html><body><img src="{ $image }"><p>Boletín de seguridad Coastwatch, { $day } de { $month }: alerta de temporal en la bahía exterior desde esta noche, marea viva el fin de semana, la previsión del puerto.</p><p><a href="{ $link }">Leer el boletín completo</a></p><p><a href="{ $unsubscribe }">Gestionar mi suscripción</a></p></body></html>

lifeboat-list-topics = las fechas de los entrenamientos de invierno | los nuevos buscapersonas | la renovación del seguro | la jornada regional de puertas abiertas | el precio del combustible
lifeboat-mail-list-name = Federación de estaciones costeras
lifeboat-mail-list-subject = {"["}stations{"]"} Sobre { $topic }
lifeboat-mail-list-body =
    Estimadas estaciones:

    Una breve nota sobre { $topic }: los detalles, en la próxima reunión.

    --
    lista de correo stations
    stations@lists.coastfed.example

lifeboat-mail-attachment-body =
    Hola, Saoirse:

    { $subject }: te mando los archivos adjuntos.

    Adjunto: { $file }
lifeboat-mail-photos-subject = Fotos de la jornada de puertas abiertas, lote { $n }
lifeboat-mail-poster-subject = Borrador del cartel { $n }
lifeboat-mail-saoirse-subjects = Formulario de patrocinio | Premios de la rifa | Fotos de la fiesta de verano | Solicitud de subvención | Ceremonia de bautizo del bote
lifeboat-mail-sent-subject = Re: Fiesta de verano, parte { $n }
lifeboat-mail-sponsor-0-subject = Tu dosier de patrocinio para la campaña de invierno
lifeboat-mail-sponsor-1-subject = El formulario firmado para el bautizo del bote
lifeboat-mail-sponsor-2-subject = Las fotos de la fiesta de verano
lifeboat-mail-sponsor-3-subject = Subvención: los documentos que pediste
lifeboat-mail-sponsor-4-subject = Los premios de la rifa de la tienda náutica
lifeboat-mail-sponsor-0-body =
    Hola, Saoirse:

    { $subject }: adjunto, como prometí.

    Adjunto: { $file }
    { $name }
lifeboat-mail-sponsor-1-body =
    Hola, Saoirse:

    { $subject }: adjunto, como prometí.

    Adjunto: { $file }
    { $name }
lifeboat-mail-sponsor-2-body =
    Hola, Saoirse:

    { $subject }: adjunto, como prometí.

    Adjunto: { $file }
    { $name }
lifeboat-mail-sponsor-3-body =
    Hola, Saoirse:

    { $subject }: adjunto, como prometí.

    Adjunto: { $file }
    { $name }
lifeboat-mail-sponsor-4-body =
    Hola, Saoirse:

    { $subject }: adjunto, como prometí.

    Adjunto: { $file }
    { $name }
    { $subject }: adjunto, como prometí.

    Adjunto: { $file }
    { $name }

lifeboat-mail-raffle-subject = Las papeletas de la rifa
lifeboat-mail-raffle-body =
    Hola, Leilani:

    Las papeletas de la rifa ya están impresas: ¿las llevo el sábado?

    { $name }
lifeboat-mail-shop-subject = El sábado en la tienda
lifeboat-mail-shop-body =
    Hola, Leilani:

    ¿Puedes abrir la tienda el sábado por la mañana?

    { $name }
lifeboat-mail-tyres-subject = Factura de los neumáticos nuevos del tractor
lifeboat-mail-tyres-body =
    Estimado Aziz:

    Le enviamos nuestra factura por los neumáticos del tractor.

    { $name }
lifeboat-mail-fuel-subject = Recibo del combustible
lifeboat-mail-fuel-body =
    Hola, Aziz:

    Aquí tienes el recibo del combustible de la última salida.

    { $name }
lifeboat-mail-year-end-subject = Cuentas de fin de año
lifeboat-mail-year-end-body =
    Hola:

    ¿Podría el tesorero enviarnos los extractos bancarios para las cuentas de fin de año?

    { $name }
lifeboat-mail-gift-aid-subject = Certificado de donaciones
lifeboat-mail-gift-aid-body =
    Estimado tesorero:

    El formulario de certificados de donaciones necesita una firma este mes.

    { $name }

lifeboat-holiday-comment = Aziz, agosto de 2030 (escrito por Yerlan): «diles que estoy fuera»
lifeboat-holiday-reply = Estoy fuera hasta el 25 de agosto. Para cualquier urgencia, escribe a Marisol.
