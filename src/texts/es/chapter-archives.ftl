### Historia «El Archivo», capítulo único (src/engine/chapters/archives.ts):
### salvar los fondos de una biblioteca de barrio en una pequeña memoria USB,
### con du, df, find y tar.

chapter-archives = El Archivo
    .summary = Medir, ordenar y empaquetar unos fondos para salvarlos en una memoria USB: du, df, find, tar.

## Archivos

archives-letter-rosa =
    Una carta de Rosa, bibliotecaria de la biblioteca del barrio:

    «El servidor de la biblioteca se apagará esta noche a medianoche, para
    siempre: el ayuntamiento ya no lo pagará. Todos nuestros fondos están
    en él: los manuscritos donados por el vecindario, los planos antiguos,
    la gaceta, las grabaciones del mercado.

    Solo tengo una vieja memoria USB de 64 MB, conectada en /media/memoria.
    ¿Puedes guardar los fondos en ella, en UN SOLO archivo comprimido? Un
    archivo comprimido se transporta mejor, y la compresión ahorra espacio.

    Ojo, no basta con copiar: todo tiene que caber. Mide primero.
    Mis notas están en cat notes_rosa.txt»
archives-notes-rosa =
    NOTAS DE ROSA

    ¿Cuánto espacio?
      du -sh fondos         el tamaño total de la carpeta fondos
      du -h fondos          el tamaño de cada subcarpeta
      df -h /media/memoria  el espacio libre de la memoria USB

    Encontrar archivos, en cualquier parte de una carpeta y sus subcarpetas:
      find fondos -name "*.pdf"      todos los PDF
      find fondos -name "*.tmp"      todos los archivos temporales
    Los .tmp son restos de nuestro programa de escaneo: podemos tirarlos
    sin pena. Para borrar todo lo que encuentra find, añade -delete al
    final (¡vuelve a leer el comando antes de pulsar Intro!).

    Hacer un archivo comprimido (tar = tape archive, z = gzip):
      tar -czf /media/memoria/fondos.tar.gz fondos
    Comprobar lo que contiene:
      tar -tzf /media/memoria/fondos.tar.gz
archives-readme = Fondos de la biblioteca del barrio. Donaciones del vecindario, 1890-2026.
archives-journal-marie = Diario de Marie, costurera, 1931-1940 (transcripción).
archives-letters-1914 = Cartas de Ahmed a su hermana, 1914-1918 (transcripción).
archives-recipes-neighbourhood = Recetas recogidas en el mercado, 1975-2020.
# Contenido que muestra cat para los archivos que no son texto
archives-image-png = (imagen PNG)
archives-document-pdf = (documento PDF)
archives-its-ogg = (audio Ogg Vorbis)
archives-file-temporary = (archivo temporal)

## Eventos

archives-event-measure =
    Los fondos pesan mucho más que los 64 MB de la memoria. Pero mira
    adónde va el espacio: unos cuantos archivos grandes… Rosa hablaba de
    archivos temporales.
    find fondos -name "*.tmp"
archives-event-full =
    «No space left on device»: el archivo comprimido no cabe en la memoria.
    Hay que hacer sitio ANTES: ¿qué hay en los fondos que no sea valioso?
    (du -h fondos, y luego find fondos -name "*.tmp")
archives-event-tmp =
    ¡Tres archivos temporales, 120 MB entre los tres! Rosa dice que podemos
    tirarlos. find puede borrarlos de una vez, con -delete al final:

      find fondos -name "*.tmp" -delete

    (Vuelve a leerlo antes de Intro: sin el -name, find borraría TODOS los fondos.)
archives-event-loss =
    Ay: ha desaparecido un archivo valioso de los fondos, y find -delete,
    como rm, no pasa por ninguna papelera… En la vida real, por eso se
    hacen copias de seguridad ANTES de limpiar. Aquí puedes reiniciar el
    capítulo (enlace debajo del terminal).
archives-event-cleanup =
    La limpieza está hecha. Compruébalo con du -sh fondos y luego crea el
    archivo comprimido directamente en la memoria:

      tar -czf /media/memoria/fondos.tar.gz fondos
# { $size }: tamaño del archivo comprimido en MB (número, con un decimal)
archives-event-saved =
    El archivo comprimido está en la memoria: { NUMBER($size, minimumFractionDigits: 1, maximumFractionDigits: 1) } MB, con todos los fondos. Los textos
    se han comprimido mucho; las imágenes, los sonidos y los PDF, ya
    comprimidos, casi nada. Para comprobar su contenido sin extraerlo:
    tar -tzf /media/memoria/fondos.tar.gz

    Rosa desconecta la memoria a las 23:58. «Está todo. ¡Gracias!»

    (Te espera un segundo capítulo: Las Versiones.)

    Ya sabes medir (du, df), buscar y ordenar (find, -delete) y empaquetar
    (tar). Y una regla de oro de archiveros y archiveras: una sola copia
    no es una copia de seguridad. Rosa hará una segunda mañana a primera
    hora.
