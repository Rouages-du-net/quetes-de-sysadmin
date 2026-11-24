### Historia «El Lote Nocturno», capítulo «Código de retorno»: volver a
### compilar el lote con GnuCOBOL (copybooks, las columnas del formato de
### referencia, -x), ejecutarlo y leer su código de retorno. Los comandos,
### rutas, mensajes del compilador y salidas de los programas no se traducen.

chapter-return-code = Código de retorno
    .summary = Compila el lote COBOL con cobc: encuentra sus copybooks, pon las líneas de Ayesha en las columnas que espera COBOL, genera un ejecutable y lee lo que dice su código de retorno.

## Files

return-code-email-ayesha =
    De:    Ayesha
    Para:  tú

    El archivo convertido está listo, gracias. Ahora el lote en sí: el
    programa que ejecutaba la gestoría es un módulo de carga de su
    mainframe, aquí no puede funcionar. Lo volvemos a compilar desde la
    fuente de Ramón, /opt/batch/src/contrib.cob, con cobc (GnuCOBOL, ya
    instalado).

    En el mainframe, un operador leía cada mañana el registro del trabajo y
    comparaba los totales con el registro final. Aquí no lo hará nadie. Así
    que añadí una comprobación al final del programa: si los totales no
    coinciden con el registro final, código de retorno 8. Pero cobc rechaza
    mis líneas, y no veo por qué: se parecen a las demás.

    Cuando compile, ¿podrías ejecutarlo con el archivo de esta noche
    (/srv/batch/in/contrib.dat), luego con el archivo de prueba de la
    gestoría (/srv/batch/in/test-bad.dat, le falta un registro a propósito),
    y mirar cada vez el código de retorno? El programa recibe dos
    argumentos: el archivo de entrada y el informe que debe escribir (en
    /srv/batch/out, por ejemplo).

    Ayesha

## Events

return-code-event-copy-missing =
    COPY CONTRIBA: cobc busca el copybook en el directorio actual y en los
    directorios que se le indican; los de Ramón están en
    /opt/batch/copybooks. Dile a cobc dónde buscar (man cobc, -I).
return-code-event-indicator =
    «invalid indicator at column 7»: el formato de referencia de COBOL
    viene de la tarjeta perforada. Las columnas 1 a 6 contienen un número
    de secuencia, la columna 7 el indicador (* para un comentario, - para
    una continuación, un espacio para el código), y el texto del programa
    va de la columna 8 (área A: divisiones, nombres de párrafo) o 12 (área
    B: sentencias) a la columna 72. Las líneas de Ayesha empiezan en la
    columna 1, así que su 7.º carácter se lee como indicador. Compáralas
    con las líneas de Ramón justo encima.
return-code-event-free =
    -free pasa cobc a formato libre, sin columnas: los números de secuencia
    de Ramón (000100, 000200…) se vuelven errores de sintaxis. El archivo
    está en formato fijo: mejor mueve las líneas de Ayesha a las columnas
    correctas.
return-code-event-module =
    Segmentation fault: sin -x, cobc genera un módulo (NOMBRE.so), hecho
    para que lo cargue otro programa o cobcrun, no para ejecutarlo
    directamente. -x genera un ejecutable.
return-code-event-not-defined =
    PERFORM CHECK-TOTALS llama a un párrafo que ya no está: se quitaron las
    líneas de Ayesha. Conserva su comprobación, en las columnas correctas.
return-code-event-unchecked =
    Este contrib no compara los totales con el registro final: la
    comprobación de Ayesha se comentó o se quitó. Compila, pero un archivo
    erróneo pasaría con código de retorno 0.
return-code-event-compiled =
    Compila: un ejecutable, con la comprobación de Ayesha. Ejecútalo con
    sus dos argumentos (el archivo de entrada, el informe que debe
    escribir) y mira su código de retorno: echo $?
return-code-event-report =
    Código de retorno 0: el informe está escrito, 12 cuotas por 515.20,
    como el registro final. Un programa dice cómo le fue con su código de
    salida (RETURN-CODE en COBOL, $? en el shell): 0 significa que todo va
    bien.
return-code-event-passed-bad =
    El archivo de prueba pasó con código de retorno 0, y sin embargo le
    falta un registro: este contrib no comprueba el registro final. Hay que
    compilar con la comprobación de Ayesha.
return-code-event-rc =
    Código de retorno 8: los totales no coinciden con el registro final (11
    cuotas en lugar de 12). En el mainframe, el siguiente paso del trabajo
    se habría saltado (COND en el JCL); aquí, le toca a lo que ejecuta el
    programa mirar su código.
return-code-event-end =
    Ayesha: «Código de retorno 8 con el archivo de prueba de la gestoría:
    ¡mi comprobación funciona! Y el informe del 21 es idéntico al del
    mainframe.»

    ¡Bien hecho! Has terminado el capítulo «Código de retorno».

    QUÉ HA PASADO
    El programa en sí no cambió: la fuente de Ramón compiló con GnuCOBOL en
    cuanto cobc supo dónde estaban los copybooks (-I) y las líneas de
    Ayesha estuvieron en las columnas del formato de referencia (el código
    desde la columna 8, la columna 7 para el indicador). Generado con -x,
    es un ejecutable; ejecutado con los dos archivos, dijo cómo le fue con
    cada uno mediante su código de retorno: 0, y luego 8.

    BUENA PRÁCTICA
    - Respeta el formato en el que está escrita una fuente: en formato
      fijo, las columnas forman parte del lenguaje. No pases todo el
      archivo a -free para esquivar una línea.
    - Guarda los copybooks en un solo sitio e indícaselo al compilador (-I,
      o COB_COPY_DIR).
    - Un programa por lotes dice cómo le fue con su código de retorno: 0
      todo bien, 4 un aviso, 8 un error, 12 o 16 peor (la convención del
      mainframe). Léelo siempre: echo $? a mano, y en los scripts.

    OTRA MANERA
    cobc -x -I ../copybooks -o /opt/batch/bin/contrib contrib.cob lo instala
    donde lo busca el lote. Un módulo (cobc -m, por defecto) se ejecuta con
    cobcrun, o lo llama otro programa COBOL. GnuCOBOL también puede escribir
    el listado (-t) para leer el programa con sus copybooks desplegados.

    DOCUMENTACIÓN
    - Manual de GnuCOBOL (formato de referencia, COPY, opciones de cobc): https://gnucobol.sourceforge.io/doc/gnucobol.html
    - Bash, parámetros especiales ($?): https://www.gnu.org/software/bash/manual/html_node/Special-Parameters.html
