### Historia «El Coro», capítulo «Olvídame»: un miembro que se va pide que
### lo borren (RGPD, artículo 17); los documentos contables se quedan; luego
### una purga que se ejecuta de verdad (un temporizador de systemd) y copias
### de seguridad que caducan (restic forget --prune). Los comandos, las
### opciones, las rutas y las salidas no se traducen.

chapter-forget-me = Olvídame
    .summary = Un tenor deja el coro y pide que lo olviden. Bórralo donde la ley te lo permite, conserva lo que la ley te pide conservar, y luego haz que la política se cumpla sola: una purga nocturna que se ejecute de verdad, y copias de seguridad que no recuerden para siempre.

## Archivos

forget-me-message-kenji =
    De: Kenji (tesorero)
    Lunes 7 de abril, 9:30

    Buenos días:

    Tomas Novak nos dejó el sábado, y pide que borremos sus datos (su
    mensaje está en tu carpeta personal). Es lógico. Pero una cosa, de
    parte del tesorero: sus cuotas están en nuestras cuentas, y las
    cuentas se tienen que guardar diez años. La política también lo dice.
    Por favor, no hagas mentir a mis libros.

    Ya puestos, Amara se pregunta si el «2 años después de irse» de la
    política llegó a cumplirse alguna vez. Creo que Ruben escribió un
    script de purga para eso, y la copia de seguridad semanal funciona
    desde 2029. ¿Una copia de seguridad olvida algo?

    Kenji

forget-me-message-tomas =
    De: Tomas Novak
    Para: la junta del Riverside Community Choir
    Domingo 6 de abril

    Hola:

    Como saben, me he mudado a Lisboa por trabajo. Ha sido una alegría
    cantar con ustedes todos estos años.

    Quisiera que borraran mis datos personales (artículo 17 del RGPD): mi
    perfil, mi foto, mi asistencia, el boletín. Sé que quizá tengan que
    guardar algunas cosas para las cuentas; díganme solo cuáles.

    ¡Gracias a todo el mundo, y suerte con el concierto de primavera!
    Tomas

## Eventos

forget-me-event-found =
    Ese es Tomas, el miembro 41. Está en más de una tabla: la tabla de
    miembros, la asistencia, las cuotas, el boletín (por su correo). ¿A
    cuáles llega el borrado, y cuál te pide la ley que conserves?
forget-me-event-payments-deleted =
    Sus cuotas han desaparecido de la tabla payments: son los documentos
    contables del coro, que la política (y la ley) guardan diez años. El
    borrado no se aplica a los datos que estás obligado a conservar (RGPD,
    artículo 17.3). Vuelve a ponerlas: el volcado de anoche las tiene
    (grep SUB-20 /var/backups/choir.sql | grep 041), e INSERT INTO
    payments VALUES (…) las recupera, una fila por cuota.
forget-me-event-erased =
    Tomas ya no está en members, attendance ni en el boletín, y sus
    cuotas se quedan en los libros con su nombre: eso es lo que Kenji le
    escribirá. ¿Qué más contiene sus datos en el disco?
forget-me-event-uploads =
    Su foto y su formulario de consentimiento han desaparecido de los
    archivos subidos.
forget-me-event-purge-broken =
    La purga de Ruben nunca se ha ejecutado: su temporizador nunca se
    activó, y su servicio se ejecuta como www-data, que no tiene ningún
    rol en PostgreSQL («role "www-data" does not exist»). Y su script dice
    «TODO attendance». Arregla el servicio, el script y el temporizador
    (man systemd.timer, systemctl enable --now), o programa la tarea de
    otra forma.
forget-me-event-purge-too-much =
    Cuidado: la purga, tal como se ejecutará esta noche, borraría datos
    que la política conserva (miembros actuales, personas que se fueron
    hace menos de dos años, asistencia reciente, los pagos o el boletín).
    Comprueba sus cláusulas WHERE antes de dejar que un temporizador las
    ejecute cada noche.
forget-me-event-purge-partial =
    La purga, tal como se ejecutará, hace la mitad del trabajo: la
    política también limita la asistencia a los ensayos a dos años, y las
    fichas de los antiguos miembros a dos años después de irse. Las dos
    líneas tienen que estar en la tarea.
forget-me-event-purge-idle =
    Hay una tarea de purga programada, pero ejecutada como se ejecutará,
    no borra nada: mira lo que dice al ejecutarse (systemctl start, luego
    journalctl -u), con qué cuenta se ejecuta, y si esa cuenta puede
    llegar a la base de datos.
forget-me-event-purge =
    Esta noche, y cada noche, la purga borrará a los antiguos miembros que
    se fueron hace más de dos años y la asistencia de hace más de dos
    años, y nada más. Ahora las copias de seguridad: ¿qué contienen
    todavía?
forget-me-event-snapshots =
    { $count } instantáneas semanales, hasta septiembre de 2029: la copia de
    seguridad nunca ha olvidado nada. Todo lo borrado hoy, y todo lo que
    borre la purga, sigue vivo en ellas para siempre. La política dice
    tres meses de copias semanales (man restic: forget, --keep-weekly,
    --keep-within, --prune).
forget-me-event-too-few =
    Quedan demasiado pocas copias: la política dice tres meses de copias
    semanales, para que una mala copia esta noche se pueda recuperar con
    una más antigua. Las instantáneas olvidadas y purgadas no vuelven: en
    un servidor real se habrían perdido; aquí, vuelve a empezar el
    capítulo (o usa la instantánea de rescate) y elige una política que
    guarde unos tres meses.
forget-me-event-no-prune =
    Las instantáneas antiguas están olvidadas, pero sus datos siguen en el
    repositorio: forget solo quita las instantáneas, prune borra los datos
    que ya no usa ninguna instantánea (o forget --prune).
forget-me-event-trimmed =
    El repositorio contiene ahora unos tres meses de copias semanales,
    purgadas. El próximo domingo, la copia añade una más: ¿hará algo que
    se vaya la más antigua?
forget-me-event-script-unchanged =
    Has recortado el repositorio a mano, pero el script de la copia
    semanal no olvida nada: dentro de un año habrá cincuenta instantáneas
    más. La política va en el script (/usr/local/sbin/choir-backup),
    después de la copia.
forget-me-event-script =
    La copia semanal olvida ahora lo que tiene más de unos tres meses, y
    purga: los datos borrados salen de las copias de seguridad en un
    plazo conocido.
forget-me-event-end =
    Kenji: «Mis libros están intactos, Tomas tiene su respuesta, y Amara
    dice que la política por fin se cumple sola. Dormiré mejor».

    ¡Bien hecho! Has terminado el capítulo «Olvídame».

    QUÉ HA PASADO
    Tomas pidió que lo borraran. Borraste su ficha, su asistencia, su
    suscripción al boletín y sus archivos subidos, y conservaste sus
    cuotas, que son documentos contables que el coro debe guardar. Luego
    hiciste que la política se cumpliera sola: la purga de Ruben nunca se
    había ejecutado (un temporizador nunca activado, una cuenta sin rol en
    la base de datos, la asistencia olvidada), y la copia semanal lo
    guardaba todo desde 2029. La purga se ejecuta ahora cada noche, y las
    copias de seguridad guardan unos tres meses, purgadas.

    BUENA PRÁCTICA
    - El derecho de supresión (RGPD, artículo 17) tiene límites: los datos
      que la ley obliga a conservar (documentos contables) se quedan, y la
      respuesta le dice a la persona cuáles y por qué.
    - Borra en todos los sitios donde está la persona: cada tabla que
      apunta a ella, los archivos, y luego las copias.
    - Una purga que no está programada es un deseo. Pruébala tal como se
      ejecutará (su cuenta, su temporizador: systemctl start,
      journalctl -u), y comprueba que borra lo que dice la política, y
      nada más.
    - Las copias de seguridad no se pueden editar persona a persona:
      tienen que caducar en un plazo conocido (restic forget con una
      política, y prune), y si alguna vez se restaura una, hay que volver a
      aplicar los borrados.
    - Guarda el registro de la propia solicitud (quién, cuándo, qué se
      hizo), no los datos que borró.

    OTRA FORMA DE HACERLO
    Seudonimizar en lugar de borrar (sustituir el nombre por un
    identificador) conserva las estadísticas, pero los datos seudonimizados
    siguen siendo datos personales según el RGPD (considerando 26): solo
    cuentan como anónimos cuando nadie puede relacionarlos con la persona.

    DOCUMENTACIÓN
    - RGPD, artículos 5, 17 y considerando 26: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - La CNIL: https://www.cnil.fr/
    - systemd.timer(5): https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - restic, quitar instantáneas: https://restic.readthedocs.io/en/stable/060_forget.html
