### Historia «El Libro de Pedidos», capítulo «Esperando una respuesta»: un
### trabajo nocturno en MSGW en un IBM i, el mensaje de consulta en QSYSOPR,
### el bloqueo de registro que hay detrás. Los comandos CL, ID de mensaje y
### nombres de trabajos y objetos no se traducen.

chapter-inquiry = Esperando una respuesta
    .summary = La importación de la noche lleva esperando desde las 02:14 una respuesta que nadie dio, y las listas de preparación con ella: encuentra la pregunta, lee su ayuda, quita su causa y luego respóndela.

## Shared by the story

order-book-notes-margit =
    Notas de Margit - molino, el IBM i (para quien se ocupe de él después)

    ENTRAR. Dos puertas a la misma máquina:
      - la pantalla verde: tn5250 molino desde tu puesto; inicia la sesión
        con tu perfil y tu contraseña, y escribe comandos CL en ===>;
      - ssh molino: PASE, un shell Unix (bash, ls, cat, grep...). Desde
        ahí, system "WRKACTJOB" ejecuta un comando CL, db2 "SELECT ..."
        ejecuta SQL.
    Una pregunta de un trabajo (un mensaje de consulta) se responde en la
    pantalla verde: DSPMSG QSYSOPR.

    CL EN UN MINUTO. Un verbo y un objeto: WRK (trabajar con), DSP
    (mostrar), CHG (cambiar), DLT (borrar), CRT (crear), END, STR, SAV.
    Parámetros por palabra clave, WRKSPLF SELECT(ORDBATCH), o por orden,
    DSPLIB ORDERS. Los valores especiales empiezan por *: *ALL, *CURRENT.
    Los objetos viven en bibliotecas: ORDERS/ORDHDR es el archivo ORDHDR
    de la biblioteca ORDERS (ORDERS.ORDHDR en SQL,
    /QSYS.LIB/ORDERS.LIB/ORDHDR.FILE desde PASE). CMD ? muestra la ayuda
    de un comando; desde PASE, man WRKACTJOB.

    LA NOCHE (cola de trabajos QBATCH: un trabajo cada vez)
      02:00    ORDIMPORT  importa los pedidos de la web (programa
                          ORDERS/ORDIMP). Si se detiene, vuelve a
                          enviarlo, se salta lo que ya está importado:
                          SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT)
      después  ORDPICK    las listas de preparación del turno de mañana
      después  ACCTEXP    la exportación para la gestoría contable
      después  ORDINV     las facturas, en QPRINT, impresas a las 08:30.
                          Para volver a imprimirlas:
                          SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV)
      23:00    NIGHTSAV   salva la biblioteca ORDERS en el archivo de
                          salvar BACKUP/ORDERS.
    ORDWEB, en su propio subsistema ORDSBS, recibe los pedidos web de las
    panaderías de día y de noche.

    MIS REGLAS. Nunca terminar un trabajo por lotes sin leer su registro
    de trabajo (DSPJOBLOG). Nunca responder a una consulta sin leer su
    ayuda. QPRINT es de todo el mundo.

    Margit

## Files

inquiry-email-kwame =
    De:    Kwame
    Para:  tú

    ¡Buenos días, y te damos la bienvenida a la harinera! Son las 07:40,
    los repartidores esperan y esta mañana no hay listas de preparación.

    Nuestros pedidos viven en el IBM i de la oficina desde 1996 (entonces
    era un AS/400). Margit lo montó todo; se jubiló y solo viene los
    jueves, pero dejó sus notas en tu carpeta personal: notas-de-margit.txt.

    ¿Podrías averiguar por qué se detuvo el trabajo de la noche y ponerlo
    en marcha otra vez, sin perder los pedidos web de anoche? Las listas
    se imprimen solas en cuanto se han ejecutado los trabajos de la noche.

    La oficina abrió a las siete: los pedidos por teléfono se toman en la
    pantalla verde como siempre, así que, por favor, no le cortes a nadie.

    Tu perfil es TU, contraseña muela-2029: tn5250 molino desde tu puesto
    para la pantalla verde, o ssh molino para el lado Unix.

    Kwame

## Events

inquiry-event-linux-habit =
    Aquí no hay systemd: esto es PASE, el lado Unix de un IBM i. Los
    trabajos, mensajes e impresoras son del propio IBM i, y se alcanzan con
    comandos CL: en la pantalla verde (tn5250 molino), o desde aquí con
    system "WRKACTJOB". Las notas de Margit dan los primeros pasos.
inquiry-event-msgw =
    ORDIMPORT, la importación de la noche, está en MSGW: esperando la
    respuesta a un mensaje. Un trabajo por lotes que hace una pregunta se
    detiene hasta que alguien la responde, y a las 02:14 no había nadie. La
    pregunta está en la cola de mensajes del operador, QSYSOPR.
inquiry-event-queue =
    Detrás de ORDIMPORT espera la cola de trabajos QBATCH: las listas de
    preparación (ORDPICK), la exportación contable, las facturas. QBATCH
    ejecuta un trabajo por lotes cada vez: un trabajo atascado retiene toda
    la noche.
inquiry-event-inquiry =
    La pregunta: RNQ1218, «Unable to allocate a record in file ORDHDR (R C
    G D F)». Las letras entre paréntesis son las respuestas válidas. Antes
    de elegir, lee la ayuda del mensaje (? en la línea de respuesta, F1 en
    una pantalla real): qué hace cada respuesta, y por qué no se pudo
    obtener el registro.
inquiry-event-cause =
    Ahí está: el registro 28 de ORDHDR, el pedido 1847, lo retiene el
    trabajo 412655/SORAYA/QPADEV0004, la pantalla verde de Soraya, que
    quedó abierta anoche en ese pedido. Mientras su sesión lo retenga, la
    importación no puede modificar el pedido. Kwame la llama: sonó el
    teléfono, se fue con prisa y no cambió nada. Se puede terminar su
    sesión.
inquiry-event-retry-locked =
    R volvió a intentarlo, pero el registro sigue retenido: el trabajo
    esperó otra vez, y volvió la misma pregunta. Reintentar solo sirve una
    vez que la causa ha desaparecido: libera primero el registro.
inquiry-event-killed =
    La importación se terminó en mitad de su trabajo: los pedidos
    posteriores al 1847 no se importaron, y la cola siguió sin ellos. Las
    notas de Margit dicen cómo volver a enviarla (se salta lo que ya está),
    una vez libre el registro.
inquiry-event-cancelled =
    La importación se canceló: el trabajo terminó de forma anómala, con
    solo una parte de los pedidos de la noche. Las notas de Margit dicen
    cómo volver a enviarla (se salta lo que ya está), una vez libre el
    registro.
inquiry-event-skipped =
    G se saltó el registro: la importación continuó, pero el cambio del
    pedido 1847 se quedó fuera, en silencio. La panadería recibirá la
    cantidad antigua. Libera el registro y vuelve a enviar la importación:
    aplicará lo que se saltó.
inquiry-event-wrong-session =
    Terminaste la sesión de Diego: estaba escribiendo el pedido de una
    panadería por teléfono, y se ha perdido. Su sesión tenía ORDHDR
    abierto, como toda pantalla de entrada de pedidos, pero ningún
    registro: el bloqueo de registro (DSPRCDLCK, o las anotaciones del
    trabajo de la importación) nombra el trabajo que retiene el pedido
    1847. «Deshacer la última entrada» (Punto de restauración) te lleva a
    antes de ese comando.
inquiry-event-web-ended =
    Se terminó ORDWEB: los pedidos web de las panaderías ya no llegan.
    Pertenece al subsistema ORDSBS: vuelve a arrancarlo (ENDSBS y luego
    STRSBS ORDERS/ORDSBS, man STRSBS).
inquiry-event-released =
    La sesión de Soraya ya no está, y su bloqueo tampoco: el registro 28
    está libre. Ahora se puede responder a la pregunta.
inquiry-event-end =
    Kwame: «¡Las listas salen por la impresora! Y Soraya cerrará la sesión
    antes de irse, prometido.»

    ¡Bien hecho! Has terminado el capítulo «Esperando una respuesta».

    QUÉ HA PASADO
    A las 02:14, la importación (ORDIMPORT) necesitaba el pedido 1847, que
    la sesión de Soraya tenía bloqueado desde la tarde. Esperó, luego hizo
    una pregunta al operador, la consulta RNQ1218, y pasó a MSGW. Nadie
    responde a QSYSOPR por la noche: el trabajo esperó, y la cola de
    trabajos QBATCH detrás de él. Encontraste el trabajo (WRKACTJOB), la
    pregunta (DSPMSG QSYSOPR), su ayuda y el registro del trabajo (CPF5027:
    el trabajo que retenía el registro), liberaste el registro terminando
    la sesión olvidada y respondiste R: la importación continuó, terminó con
    normalidad, y se ejecutaron los trabajos de la noche.

    BUENA PRÁCTICA
    - Una consulta es una decisión: lee su texto de segundo nivel (F1) y el
      registro del trabajo antes de responder. R solo sirve una vez que la
      causa ha desaparecido; C o ENDJOB pierden la ejecución; G se salta
      datos en silencio.
    - Averigua quién retiene un bloqueo: DSPRCDLCK, WRKOBJLCK, el mensaje
      CPF5027.
    - Alguien debe vigilar QSYSOPR por la noche, o las respuestas deben
      conocerse de antemano: la lista de respuestas del sistema (WRKRPYLE)
      responde sola a los mensajes elegidos, y un monitor de mensajes
      puede avisar a alguien.
    - Cierra la sesión al final del día (o deja que QINACTITV termine las
      sesiones inactivas).

    DOCUMENTACIÓN
    - Mensajes de consulta: https://www.ibm.com/docs/en/i/7.5?topic=types-inquiry-messages
    - DSPMSG: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dspmsg.html
    - DSPRCDLCK: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dsprcdlck.html
    - La lista de respuestas del sistema: https://www.ibm.com/docs/en/i/7.5?topic=messages-using-system-reply-list

## Shared by the story: a CL command (or tn5250) typed in PASE
order-book-event-cl-in-pase =
    Estás en PASE, el lado Unix del IBM i: los comandos CL no son sus
    programas. Desde aquí, system ejecuta uno (system "WRKACTJOB"). Para la
    pantalla verde, donde también puedes responder a un mensaje, vuelve a
    tu puesto (exit), y luego tn5250 molino.
