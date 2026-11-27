### Pistas graduales de El Libro de Pedidos (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una dirección) y
### .solution (casi la respuesta).

## Capítulo 1 — Esperando una respuesta

hint-inquiry-msgw =
    .lead = Abre la pantalla verde desde tu puesto (tn5250 molino) y mira los trabajos en ejecución y su estado (WRKACTJOB ?).
    .solution = tn5250 molino, inicia la sesión, luego WRKACTJOB: ORDIMPORT está en MSGW en QBATCH.
hint-inquiry-inquiry =
    .lead = Un trabajo en MSGW espera la respuesta a un mensaje de la cola de mensajes del operador (DSPMSG ?).
    .solution = DSPMSG QSYSOPR: RNQ1218, «Unable to allocate a record in file ORDHDR (R C G D F)».
hint-inquiry-cause =
    .lead = Antes de responder, lee la ayuda del mensaje (? en la línea de respuesta), luego el registro del trabajo, o quién retiene los registros del archivo (DSPJOBLOG ?, DSPRCDLCK ?).
    .solution = DSPJOBLOG JOB(412907/ORDBATCH/ORDIMPORT) o DSPRCDLCK FILE(ORDERS/ORDHDR): el registro 28 lo retiene 412655/SORAYA/QPADEV0004.
hint-inquiry-released =
    .lead = El registro lo retiene una sesión que ya nadie usa: termina esa (ENDJOB ?), no la importación, ni una sesión en la que alguien trabaja.
    .solution = ENDJOB JOB(412655/SORAYA/QPADEV0004) OPTION(*IMMED).
hint-inquiry-end =
    .lead = La causa ha desaparecido: responde a la pregunta para que la importación lo vuelva a intentar. Si la importación se perdió por el camino, las notas de Margit dicen cómo volver a enviarla.
    .solution = DSPMSG QSYSOPR, responde R. (Si se terminó o se canceló: SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT).)

## Capítulo 2 — Papel que nadie imprime

hint-spooled-storage =
    .lead = Lee el mensaje del operador y luego el estado del sistema: ¿cuánto está lleno el ASP del sistema (WRKSYSSTS ?)?
    .solution = DSPMSG QSYSOPR (CPF0907), luego WRKSYSSTS: % system ASP used, por encima de 90.
hint-spooled-culprit =
    .lead = Nada grande en las bibliotecas: mira las salidas impresas que esperan en las colas de salida (WRKOUTQ ?, WRKSPLF ?).
    .solution = WRKOUTQ: QPRINT contiene 18 000 archivos; WRKSPLF SELECT(ORDBATCH): DBGLIST, datos de usuario ORDPICKDBG, HLD.
hint-spooled-cleaned =
    .lead = Borra solo los listados de depuración, de todos los trabajos de la noche, con una selección que deje en paz las facturas (DLTSPLF ?: FILE(*SELECT) y SELECT).
    .solution = DLTSPLF FILE(*SELECT) SELECT(ORDBATCH *ALL *ALL ORDPICKDBG)
hint-spooled-switched-off =
    .lead = Algo le dice a ORDPICK que escriba su listado: mira los objetos de la biblioteca ORDERS (DSPLIB ?), un área de datos quizá (DSPDTAARA ?, CHGDTAARA ?).
    .solution = DSPDTAARA DTAARA(ORDERS/ORDDEBUG) muestra Y; CHGDTAARA DTAARA(ORDERS/ORDDEBUG) VALUE('N').
hint-spooled-end =
    .lead = Los listados borrados, el interruptor desactivado, y las 31 facturas de esta mañana todavía en QPRINT (si se borraron, las notas de Margit dicen cómo volver a imprimirlas).
    .solution = WRKSPLF SELECT(*ALL *ALL *ALL INVOICE); si han desaparecido: SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV).

## Capítulo 3 — Salvado, menos uno

hint-save-file-not-saved =
    .lead = Un trabajo que termina con normalidad puede haber salvado menos de lo pedido: lee el registro histórico, y lo que contiene el archivo de salvar (DSPLOG ?, DSPSAVF ?).
    .solution = DSPLOG JOB(NIGHTSAV): CPF3771, 15 objetos salvados, 1 no salvado; DSPSAVF FILE(BACKUP/ORDERS): no está ORDHDR.
hint-save-file-in-use =
    .lead = ORDHDR estaba «en uso»: encuentra qué trabajo lo retiene (WRKOBJLCK ?).
    .solution = WRKOBJLCK OBJ(ORDERS/ORDHDR) OBJTYPE(*FILE): lo retiene ORDWEB.
hint-save-file-saved =
    .lead = Vuelve a salvar la biblioteca, o mientras está activa (SAVLIB ?: SAVACT), o con el subsistema que la retiene parado un momento (ENDSBS, STRSBS).
    .solution = SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS) SAVACT(*LIB) CLEAR(*ALL), luego DSPSAVF FILE(BACKUP/ORDERS).
hint-save-file-exported =
    .lead = Exporta la tabla a un archivo continuo de tu carpeta personal, en UTF-8 (CPYTOIMPF ?: TOSTMF, STMFCCSID, MBROPT, RCDDLM).
    .solution = CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/tu/orders.csv') MBROPT(*REPLACE) STMFCCSID(1208) RCDDLM(*LF)
hint-save-file-end =
    .lead = Desde PASE (ssh molino), comprueba el archivo (file, head) y cópialo a la bandeja de entrada de tamiz (man scp). ORDSBS debe estar en marcha.
    .solution = ssh molino, luego file orders.csv y scp orders.csv tamiz:/srv/reports/inbox/
