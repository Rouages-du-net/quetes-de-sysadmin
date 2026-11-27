### Historia «El Lote Nocturno», capítulo «Ancho fijo»: el archivo EBCDIC de
### la gestoría, sus registros de ancho fijo descritos por un copybook, y por
### qué sus importes empaquetados no pueden pasar por una conversión de texto.
### Los comandos, rutas, formatos de registro y salidas de los programas no
### se traducen.

chapter-copybook = Ancho fijo
    .summary = El archivo nocturno del mainframe ha llegado a Linux y parece un galimatías: lee sus bytes, sus registros y su copybook, y conviértelo sin estropear los importes.

## Shared by the story

night-batch-notes-ramon =
    Notas de Ramón - el lote nocturno (trabajo NIGHTLY), para quien venga
    después

    EL ARCHIVO. Cada noche, la gestoría envía las cuotas del día:
    /srv/drop/contrib.ebc. Viene del mainframe tal cual: EBCDIC (página de
    códigos 037), registros fijos de 40 bytes uno tras otro, sin salto de
    línea (RECFM=FB, LRECL=40). El formato está en copybooks/CONTRIB.cpy:
    una cabecera (H), un registro por cuota (D) y un registro final (T)
    que da el número de cuotas y su total. Compruébalo siempre.

    LOS IMPORTES son decimales empaquetados (COMP-3): dos cifras por byte,
    el signo en el último medio byte. 42.50 se escribe 00 00 04 25 0C.

    LA CONVERSIÓN. ebc2asc (en bin/, su fuente en src/) convierte campo a
    campo, según el copybook. Escribe el archivo ASCII que lee el lote
    (copybooks/CONTRIBA.cpy, un registro por línea):
        bin/ebc2asc ARCHIVO-EBCDIC ARCHIVO-ASCII

    EL LOTE. src/contrib.cob lee el archivo convertido y escribe el informe
    de cobro que contabilidad envía al banco. Se compila con cobc
    (GnuCOBOL). No ha fallado ni una vez en treinta años. Lo que falló,
    siempre, fue lo de alrededor: un archivo que no llegó, que llegó dos
    veces o que llegó cortado.

    Ramón

## Files

copybook-email-ayesha =
    De:    Ayesha
    Para:  tú

    ¡Hola, y gracias por venir a ayudar! Desde hace treinta años, las
    cuotas de nuestros socios y socias las cobra un programa COBOL que se
    ejecuta cada noche en el mainframe de una gestoría informática. La
    gestoría cierra su sala de ordenadores a final de mes, así que el lote
    se muda aquí, a abaco.

    Ramón escribió esos programas en 1994 y se jubila el viernes. Lo dejó
    todo en /opt/batch: sus notas (NOTES.txt), los copybooks (la
    descripción de los registros) y las fuentes. La gestoría seguirá
    enviándonos las cuotas del día cada noche, en /srv/drop; el archivo de
    anoche está ahí, contrib.ebc.

    Intenté abrirlo: un galimatías. En un foro dicen «iconv -f EBCDIC-US -t
    ASCII», pero se detiene con un error. Ramón tiene un conversor propio,
    pero antes de fiarnos de él me gustaría que entendiéramos qué hay en
    ese archivo.

    ¿Podrías poner el archivo convertido donde lo leerá el lote,
    /srv/batch/in/contrib.dat, y rellenar comprobacion.txt? Lo compararemos
    esta noche.

    Ayesha

copybook-check =
    El archivo de la gestoría del 21 de noviembre - comprobaciones antes de
    la primera noche en Linux

    Tamaño del archivo, en bytes:
    Número de registros (uno cada 40 bytes):
    Cuotas (registros de detalle):
    Total de control (en el registro final):
    Importe de la primera cuota, sus 5 bytes en el archivo (hex):

## Events

copybook-event-garbage =
    � y @ por todas partes: esto no es texto que tu terminal pueda leer. Sus
    letras son EBCDIC, el juego de caracteres del mainframe: una A
    mayúscula es el byte 0xC1, que no es UTF-8 válido (�), y el espacio es
    0x40, una @ en ASCII. Y no hay saltos de línea: los registros van uno
    tras otro. Mira sus bytes (od -c, xxd, hexdump -C) y su tamaño (wc -c).
copybook-event-data =
    file dice «data»: ningún juego de caracteres que conozca. libmagic no
    reconoce el EBCDIC; el copybook y las notas de Ramón dicen qué es esto.
copybook-event-records =
    560 bytes: 14 registros de 40 bytes (LRECL=40), una cabecera, doce
    cuotas y un registro final. Un tamaño que no fuera múltiplo de la
    longitud del registro significaría un archivo cortado.
copybook-event-bytes =
    Los bytes tal cual. C8 es una H en EBCDIC, F0 a F9 son las cifras, 40 es
    el espacio. Pero en cada registro, los bytes 34 a 38 (CR-AMOUNT en el
    copybook) no son caracteres: 00 00 04 25 0C es 42.50, empaquetado
    (COMP-3), dos cifras por byte y el signo al final (C: positivo).
copybook-event-illegal =
    iconv se detiene en la posición 75: el byte 36 del segundo registro,
    dentro de su importe (bytes 34 a 38). Ese byte, 0x04, no es ningún
    carácter: es la mitad de un número empaquetado. Un juego de caracteres
    no puede hacer texto de lo que no es texto.
copybook-event-text-converted =
    Ha pasado, pero mira los importes: una conversión de texto trata cada
    byte como un carácter. De IBM037 a UTF-8, el byte 0x25 (las cifras 2 y
    5 de 42.50) se volvió un salto de línea, y los registros ya no tienen
    40 bytes; con dd conv=ascii la longitud se mantiene, pero 0x04 se
    volvió 0x9C: el importe se ha perdido. Solo los campos de texto pueden
    pasar por una tabla; los importes hay que desempaquetarlos. Las notas
    de Ramón dicen cómo.
copybook-event-wrong-dat =
    /srv/batch/in/contrib.dat no es lo que espera el lote: 14 líneas de 43
    caracteres, cada importe desempaquetado con su signo (+000004250). Si
    sale de iconv o de dd, los importes se estropearon por el camino. Las
    notas de Ramón dicen qué herramienta convierte campo a campo.
copybook-event-converted =
    contrib.dat es correcto: 14 líneas, el texto en ASCII, cada importe
    desempaquetado con su signo (+000004250 es 42.50). La última línea es
    el registro final: el número de cuotas y su total de control.
copybook-event-end =
    Ayesha: «¡Así que eso era lo que había dentro! Esta noche compararé tus
    cifras con las de la gestoría. Y no volveré a usar iconv con él.»

    ¡Bien hecho! Has terminado el capítulo «Ancho fijo».

    QUÉ HA PASADO
    El archivo de la gestoría es el archivo del mainframe tal cual: EBCDIC,
    registros fijos de 40 bytes sin salto de línea, e importes en decimal
    empaquetado. Lo leíste con herramientas que muestran bytes en lugar de
    texto (wc -c, od, xxd, hexdump), encontraste su formato en el copybook
    y viste por qué una conversión de texto de todo el archivo estropea los
    importes: iconv se detiene en ellos, o convierte uno de sus bytes en un
    salto de línea; dd conv=ascii los cambia en silencio. El ebc2asc de
    Ramón convierte campo a campo: el texto por la tabla EBCDIC, los
    importes desempaquetados.

    BUENA PRÁCTICA
    - Mira los bytes antes de fiarte del nombre: file, wc -c, od -c, xxd.
    - Un archivo de registros se lee con su descripción (el copybook): la
      longitud del registro, el tipo de cada campo. El tamaño debe ser
      múltiplo de la longitud del registro.
    - Nunca pases campos binarios (COMP-3, COMP) por una conversión de
      texto: convierte campo a campo, o pide a quien envía un archivo todo
      en texto (importes en DISPLAY, signo separado).
    - Comprueba con el registro final: el número de registros y el total
      de control están ahí para eso.

    OTRA MANERA
    Cuando el archivo es todo texto (sin COMP-3), dd conv=ascii cbs=80
    convierte registros fijos y añade un salto de línea tras cada uno;
    iconv -f IBM037 hace lo mismo carácter a carácter. Algunas herramientas
    de transferencia (FTP en modo ASCII desde el mainframe) convierten por
    el camino, igual de peligroso para los campos empaquetados: transfiere
    en binario y convierte al llegar.

    DOCUMENTACIÓN
    - iconv(1): https://man7.org/linux/man-pages/man1/iconv.1.html
    - dd, conv=ascii: https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html
    - od: https://www.gnu.org/software/coreutils/manual/html_node/od-invocation.html
    - GnuCOBOL, USAGE COMP-3: https://gnucobol.sourceforge.io/doc/gnucobol.html
