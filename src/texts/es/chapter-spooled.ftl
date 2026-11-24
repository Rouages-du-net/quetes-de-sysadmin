### Historia «El Libro de Pedidos», capítulo «Papel que nadie imprime»: el
### ASP del sistema lleno de archivos en spool en un IBM i. Los comandos CL,
### ID de mensaje y nombres de objetos no se traducen.

chapter-spooled = Papel que nadie imprime
    .summary = El disco del IBM i ha superado su umbral, y no es culpa de ningún archivo: miles de listados impresos que nadie imprime. Borra solo esos, conserva las facturas y detén la causa.

## Files

spooled-email-kwame =
    De:    Kwame
    Para:  tú

    ¡Hola otra vez! Esta mañana hay un mensaje para el operador que me
    preocupa, algo sobre «storage» (en QSYSOPR, dice Soraya). ¿El disco del
    IBM i está lleno? No guardamos nada grande en él, el libro de pedidos
    es diminuto.

    Cuidado con la cola de la impresora: las facturas de esta mañana
    esperan en ella, Soraya las imprime a las 08:30 y salen con los
    repartos.

    ¿Podrías encontrar lo que ocupa el sitio, limpiarlo y asegurarte de que
    no vuelva a llenarse?

    Kwame

## Events

spooled-event-storage =
    El ASP del sistema (los discos del IBM i, como un solo conjunto) ha
    superado su umbral del 90 %: QSYSOPR recibió CPF0907. Al 100 %, el
    sistema se detiene. En Linux buscarías un archivo grande con du; aquí,
    mira los objetos que se acumulan sin que nadie se dé cuenta: las
    salidas impresas que esperan en las colas de salida (WRKOUTQ, WRKSPLF).
spooled-event-culprit =
    DBGLIST, datos de usuario ORDPICKDBG, estado HLD: listados de
    depuración de ORDPICK, uno por pedido, cada noche, retenidos y nunca
    impresos. Miles, en QPRINT, la cola compartida, justo al lado de las
    facturas (INVOICE). Algo hace que ORDPICK los escriba: un interruptor
    de un programa, quizá, en su biblioteca.
spooled-event-flag =
    ORDDEBUG vale «Y»: ORDPICK escribe su listado de depuración para cada
    pedido. Margit debió de activarlo para perseguir un error, y nunca lo
    desactivó. Mientras esté activo, cada noche añade seiscientos listados.
spooled-event-invoices-lost =
    Las facturas también han desaparecido: estaban en la misma cola,
    esperando a imprimirse a las 08:30. Una cola entera, o todos los
    archivos de un usuario, se lleva todo lo que contiene. Las notas de
    Margit dicen cómo volver a imprimirlas.
spooled-event-cleaned =
    Los listados de depuración están borrados: el ASP vuelve a tener sitio
    (WRKSYSSTS).
spooled-event-switched-off =
    ORDDEBUG está desactivado: ORDPICK ya no escribe su listado. Esta noche
    no volverá a llenar la cola.
spooled-event-end =
    Kwame: «Por debajo del 85 %, y las facturas se están imprimiendo.
    Margit se rio por teléfono: ¡había olvidado ese interruptor desde
    2027!»

    ¡Bien hecho! Has terminado el capítulo «Papel que nadie imprime».

    QUÉ HA PASADO
    El disco no lo llenaron datos, sino salidas impresas: archivos en
    spool. Durante dos años, un interruptor de depuración (el área de datos
    ORDERS/ORDDEBUG) hizo que ORDPICK escribiera un listado por pedido, a
    través de un archivo de impresora que los retiene y los guarda (HOLD,
    SAVE): 18 000 archivos en spool en QPRINT, la cola por la que pasan
    también las facturas. Los encontraste (WRKSYSSTS, WRKOUTQ, WRKSPLF),
    borraste solo esos (DLTSPLF FILE(*SELECT) con los datos de usuario, o
    trabajo por trabajo) y desactivaste el interruptor.

    BUENA PRÁCTICA
    - Los archivos en spool son objetos: ocupan disco, tienen propietario,
      sobreviven a los trabajos que los crearon. Vigila WRKSYSSTS y las
      colas.
    - Borra con la selección más estrecha: usuario, cola, datos de usuario.
      CLROUTQ en una cola compartida, o todos los archivos de un usuario,
      borra lo que todavía tiene que imprimirse.
    - Quita la causa, no solo el síntoma: el interruptor, o el archivo de
      impresora (CHGPRTF ... HOLD(*NO) SAVE(*NO), o su propia cola de
      salida).
    - Deja que el sistema limpie: la limpieza automática del Operational
      Assistant (GO CLEANUP) borra los registros de trabajo y las salidas
      del sistema antiguos al cabo de unos días.

    DOCUMENTACIÓN
    - DLTSPLF: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dltsplf.html
    - CLROUTQ: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/clroutq.html
    - Archivos en spool y colas de salida: https://www.ibm.com/docs/en/i/7.5?topic=concepts-spooled-files-output-queues
    - Limpieza automática: https://www.ibm.com/docs/en/i/7.5?topic=cleanup-starting-automatic
