### Historia «El Libro de Pedidos», capítulo «Salvado, menos uno»: la
### salvaguarda nocturna de una biblioteca IBM i dejó fuera un archivo (en
### uso); luego los pedidos exportados en CSV a un servidor Linux, con el
### juego de caracteres correcto. Los comandos CL, ID de mensaje, nombres de
### objetos y rutas no se traducen.

chapter-save-file = Salvado, menos uno
    .summary = La salvaguarda de la noche «terminó con normalidad», sin los pedidos. Sálvalos mientras se usan, y luego envíalos al nuevo servidor de informes como un CSV que Linux pueda leer, acentos incluidos.

## Files

save-file-email-kwame =
    De:    Kwame
    Para:  tú

    Dos cosas hoy, una aburrida y una nueva.

    La aburrida: Margit me preguntó por teléfono si «la salvaguarda de la
    noche está bien». Le dije que sí, el trabajo NIGHTSAV dice «completed
    normally» cada mañana. Me contestó: «Eso no es lo que te he
    preguntado.» ¿Podrías comprobar que la salvaguarda de anoche del libro
    de pedidos (el archivo de salvar BACKUP/ORDERS) lo contiene todo de
    verdad, y volver a salvarlo si no? Las panaderías piden por la web todo
    el día: si algo tiene que parar, que sea poco tiempo.

    La nueva: tamiz, el servidor Debian de nuestros nuevos informes, quiere
    los pedidos abiertos (la tabla ORDHDR) como archivo CSV, en su bandeja
    de entrada, /srv/reports/inbox/. La herramienta de informes lee UTF-8,
    y nuestras panaderías tienen acentos: Pâtisserie Müller, Boulangerie
    Éloïse... Cada pedido una vez, por favor. Tu clave en molino (PASE)
    abre tamiz: scp funciona.

    Kwame

## Events

save-file-event-not-saved =
    «Completed normally», y sin embargo: CPF3771, 15 objetos salvados de
    ORDERS, 1 no salvado. El que falta es ORDHDR, los pedidos en sí. Un
    trabajo puede terminar con normalidad tras una salvaguarda parcial: lo
    que lo dice es el mensaje de resumen. ¿Por qué no se salvó? El registro
    histórico lo dice: en uso (CPF3202).
save-file-event-in-use =
    ORDWEB, el receptor web, mantiene ORDHDR abierto (*SHRUPD) día y
    noche: una salvaguarda sin salvar-mientras-activo se salta un objeto
    que un trabajo retiene para actualizarlo. O paras lo que lo retiene
    durante la salvaguarda (su subsistema, ORDSBS), o salvas mientras está
    activo (el parámetro SAVACT de SAVLIB).
save-file-event-still-in-use =
    Otra vez lo mismo: ORDHDR está en uso, y SAVLIB sin SAVACT se lo salta.
    man SAVLIB: SAVACT.
save-file-event-web-down =
    ORDSBS está parado: ORDWEB ya no recibe los pedidos de las panaderías.
    Vale durante una salvaguarda; vuelve a arrancarlo en cuanto termine,
    con STRSBS ORDERS/ORDSBS.
save-file-event-saved =
    BACKUP/ORDERS contiene ahora todo ORDERS, ORDHDR incluido (DSPSAVF). La
    salvaguarda de la noche necesita la misma corrección, o mañana volverá
    a saltarse ORDHDR: Margit cambiará NIGHTSAV el jueves, con SAVACT.
save-file-event-ebcdic =
    Ese archivo está en CCSID 37: EBCDIC, como la tabla, porque el
    STMFCCSID(*STMF) de CPYTOIMPF, el valor por defecto, da a un archivo
    nuevo el CCSID de la tabla. En Linux, file dice «data» y cat muestra
    basura. Pide UTF-8 (STMFCCSID(1208)), o conviértelo por el camino
    (iconv -f IBM037).
save-file-event-latin1 =
    Ese archivo está en una página de códigos ASCII de un byte (*PCASCII es
    Windows-1252, *STDASCII ISO 8859-1): en el UTF-8 de tamiz, cada letra
    acentuada se ve como �. La herramienta de informes lee UTF-8: CCSID
    1208.
save-file-event-exported =
    Un archivo continuo en CCSID 1208: UTF-8, lo que lee tamiz. Échale un
    vistazo (head, file) antes de enviarlo.
save-file-event-duplicates =
    El archivo de tamiz tiene algunos pedidos dos veces: el MBROPT(*ADD) de
    CPYTOIMPF, el valor por defecto, añade al final de un archivo continuo
    existente. MBROPT(*REPLACE) lo vuelve a escribir; luego envíalo otra
    vez.
save-file-event-end =
    Kwame: «El primer informe está en pantalla, con el nombre de cada
    panadería bien escrito. Y Margit dice que la salvaguarda es "por fin
    una salvaguarda".»

    ¡Bien hecho! Has terminado el capítulo «Salvado, menos uno».

    QUÉ HA PASADO
    El trabajo de salvaguarda de la noche terminó «con normalidad» tras
    salvar 15 objetos de 16: ORDHDR, abierto para actualización por el
    receptor web, se omitió (CPF3202, CPF3741, CPF3771). Leíste el registro
    histórico y el archivo de salvar, encontraste el bloqueo (WRKOBJLCK) y
    volviste a salvar la biblioteca, mientras estaba activa (SAVACT) o con
    su subsistema parado un momento. Luego exportaste los pedidos con
    CPYTOIMPF a un archivo continuo del IFS, en UTF-8 (CCSID 1208) en lugar
    del EBCDIC de la tabla (37), y lo copiaste a tamiz con scp desde PASE.

    BUENA PRÁCTICA
    - Una salvaguarda se comprueba por sus mensajes, no por el final de su
      trabajo: CPF3771 «not saved», DSPSAVF frente a DSPLIB.
    - Salvar-mientras-activo (SAVACT) permite salvar una biblioteca
      mientras los trabajos la usan; para un punto coherente entre archivos
      bajo control de compromiso, SAVACT(*SYNCLIB) y una breve espera
      (SAVACTWAIT).
    - Entre el IBM i y el resto del mundo, di el juego de caracteres:
      STMFCCSID(1208) para UTF-8, MBROPT(*REPLACE) para volver a escribir
      el archivo, RCDDLM(*LF) para finales de línea Unix; compruébalo con
      file al llegar.
    - Prueba una restauración de vez en cuando (RSTLIB en otra biblioteca):
      una salvaguarda que nadie ha restaurado es una esperanza.

    DOCUMENTACIÓN
    - SAVLIB: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/savlib.html
    - Salvar mientras está activo: https://www.ibm.com/docs/en/i/7.5?topic=system-save-while-active
    - CPYTOIMPF: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/cpytoimpf.html
    - CCSID: https://www.ibm.com/docs/en/i/7.5?topic=information-ccsid-values-defined-i
