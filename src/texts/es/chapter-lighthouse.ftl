### El Borrador, capítulo 1 — La Isla del Faro. Orientarse y moverse:
### ls, cd, pwd, cat, less, mv, archivos ocultos. Los nombres de lugares y
### archivos (Cabana, Espigon, .bombilla_de_repuesto…) vienen de names.ftl.

chapter-lighthouse = La Isla del Faro
    .summary = Orientarse y moverse: ls, cd, pwd, cat, mv, archivos ocultos.
lighthouse-welcome =
    Te despiertas en la Cabana de un pescador, en una pequeña isla. Delante
    de ti, una pantalla negra y un cursor que parpadea.

    En este mundo, cada LUGAR es una carpeta y cada OBJETO es un archivo.
    Así es exactamente como Linux lo organiza todo.

    Para mirar alrededor, escribe:        ls
    Para entrar en un lugar, escribe:     cd NombreDelLugar
    Para leer un objeto, escribe:         cat nombre_del_archivo

    Y si olvidas cómo funciona un comando, pregunta al manual:
      man ls
    Es el primer reflejo de quienes administran servidores: buscar en el
    manual antes de preguntar.

    Empieza por leer el mensaje:  cat mensaje.txt
lighthouse-message =
    «Si estás leyendo esto, el Borrador ha pasado por la isla.

    Una criatura recorre el reino y borra todo lo que toca. Anoche
    borró la bombilla del Faro. Sin luz, ningún barco puede entrar
    en el Puerto, y nadie puede salir de la isla para llegar al
    Pueblo, donde hace falta ayuda.

    Sube primero a la Escuela de Señales (EscuelaDeSenales), en la Colina:
    allí te enseñarán los comandos. Luego ven a buscarme al Faro, al final
    del Espigon.

                                  — Maëlle, farera»
lighthouse-panel =
    «Playa de los Guijarros.»

    Siempre puedes volver atrás: «..» significa el lugar de arriba.
    Prueba:  cd ..

    Y si te pierdes, «pwd» (print working directory) te dice dónde
    estás.
lighthouse-ravaudeuse =
    Una mujer remienda redes junto a un viejo ordenador ternario.

    «Hola, viajero o viajera. Yo ya programaba antes de que nadie dijera
    "software". Dos consejos:

      - la tecla Tab completa los nombres por ti: escribe "cat me" y luego Tab;
      - la flecha hacia arriba recupera tus comandos anteriores.

    Y cuidado con el Borrador. No destruye por maldad: obedece una orden
    que alguien le dio hace mucho tiempo.»
lighthouse-seashell = Una concha nacarada. Si te la acercas al oído, oyes… el ventilador de un servidor.
lighthouse-wind = El viento sopla fuerte en la Colina. Abajo, el Espigon y el Faro apagado.
lighthouse-headteacher =
    La directora de la Escuela de Señales te recibe entre dos banderas
    de colores.

    «¡Bienvenida, bienvenido! Ya sabes mirar (ls), moverte (cd) y leer (cat).
    Te falta un comando esencial: mv (move), que mueve un objeto.

      mv objeto Lugar

    Ve a practicar a la SalaDePracticas. Las Lecciones están abiertas a
    todo el mundo, y la Biblioteca guarda el Libro de los comandos.

    Y recuerda el lema de la Escuela: "Ante la duda, lee el manual".
    man mv te lo contará todo sobre mv.»
lighthouse-instructions =
    EJERCICIO: un cangrejo se ha escapado del acuario. Vuelve a meterlo en
    el Cubo.

      mv cangrejo Cubo

    Luego compruébalo con  ls  y  ls Cubo
lighthouse-crab = Un cangrejito verde. Camina de lado, con aire muy ocupado.
lighthouse-course-1-manual =
    LECCIÓN 1 — EL MANUAL

    Cada comando tiene su manual. Escribe  man  seguido del nombre del comando:

      man ls
      man mv

    Una página del manual siempre tiene las mismas partes: NOMBRE (para qué
    sirve), SINOPSIS (cómo se escribe; lo que va entre corchetes [ ] es
    opcional), DESCRIPCIÓN, OPCIONES (las letras después de un guion, como
    -a), EJEMPLOS y VÉASE TAMBIÉN (comandos relacionados).

    Dos atajos:
      ls --help        un resumen rápido del comando
      man -k oculto    ¿qué comandos hablan de "oculto"?

    En un Linux real, el manual se abre a pantalla completa: lo recorres
    con las flechas, buscas con /palabra y sales con q.
lighthouse-course-2-paths =
    LECCIÓN 2 — LAS RUTAS

    Una ruta dice dónde está un lugar o un objeto.

      {"."}.            el lugar de arriba (un nivel más arriba)
      {"."}             el lugar donde estás
      ~             tu casa
      /             la raíz, arriba del todo

    Una ruta RELATIVA parte de donde estás:      cd Lecciones
    Una ruta ABSOLUTA parte de la raíz:          cd /Cabana/Playa
    Puedes encadenar lugares con /:              cat ../directora.txt
    Y ~/ parte de tu casa:                       ls ~/Puerto

    Prueba:  cd ~  y luego  pwd
lighthouse-course-3-caches =
    LECCIÓN 3 — LO QUE NO SE VE

    En Linux, un archivo cuyo nombre empieza por un punto está OCULTO: un
    "ls" a secas no lo muestra. No es una protección, solo una manera de
    guardar ajustes para que no estorben.

    Para verlo todo, ls tiene una opción. ¿Cuál? No te lo diré: está en
    el manual.  man ls

    En esta aula hay un archivo oculto. Te toca encontrarlo.
lighthouse-note-secret =
    ¡Bien visto! Has encontrado un archivo oculto.

    Recuerda esto: en una isla, las cosas valiosas se guardan a salvo,
    fuera de la vista. Y las cosas guardadas fuera de la vista suelen
    tener un nombre que empieza por un punto.
lighthouse-course-4-rename =
    LECCIÓN 4 — RENOMBRAR

    mv no sirve solo para mover: si el destino no es un lugar que existe,
    mv RENOMBRA el objeto.

      mv nota.txt carta.txt     (nota.txt ahora se llama carta.txt)

    Incluso puedes mover Y renombrar de una vez, dando el nombre nuevo al
    final de la ruta:

      mv nota.txt ~/Puerto/carta.txt

    En Linux, mover y renombrar son la misma operación: cambiar la ruta
    de un archivo.
lighthouse-book-commands =
    EL LIBRO DE LOS COMANDOS

      ls       lista lo que hay aquí (list); ls -a muestra también lo oculto
      cd       cambia de lugar (change directory)
      pwd      muestra dónde estás (print working directory)
      cat      muestra el contenido de un archivo (concatenate)
      less     lo mismo, página a página (para los archivos largos)
      mv       mueve o renombra (move)
      man      el manual de un comando, p. ej.: man ls
      clear    limpia la pantalla

    Estos comandos existen desde los años 1970: vienen de Unix, el
    antepasado de Linux y de macOS. Quienes hacen funcionar los servidores
    de internet los escriben cada día.
lighthouse-captain =
    La capitana Ana da vueltas por el muelle.

    «Mi barco puede llevarte al Pueblo. Pero sin el Faro no hay manera
    de pasar los arrecifes al caer la noche. ¡Vuelve a encenderlo y
    zarpamos!»
lighthouse-inventory = El Cobertizo del Puerto: remos, boyas, un ancla. Todavía queda sitio.
lighthouse-label = El Almacen de la farera. Cajas de piezas de repuesto… casi todas vacías: el Borrador ha pasado por aquí.
lighthouse-bulb-rescue = Una gran bombilla de faro, guardada a salvo. Una etiqueta dice: «Para la Linterna».
lighthouse-net = Una enorme red de pesca enmarañada que bloquea la puerta del Faro. Estaría mejor guardada en el Cobertizo del Puerto.
lighthouse-hint =
    Grabado en un poste de piedra:

      «Lo que estorba en el Espigon va al Cobertizo.
        ~ siempre te devuelve a casa, donde empieza el camino al Puerto.»

    (Prueba:  mv red ~/Puerto/Cobertizo)
lighthouse-keeper =
    Maëlle, la farera, te espera al pie de la
    escalera.

    «¡Ya estás aquí! La Linterna solo se enciende con un objeto que se
    llame exactamente bombilla, colocado en la Linterna. El Borrador borró
    la nuestra.

    Me queda una de repuesto, guardada a salvo en el Almacen del Puerto.
    No la verás con un ls a secas: como todo lo que se guarda fuera de la
    vista, su nombre empieza por un punto. (El manual de ls dice cómo
    verlo todo.)

    Tráela a la Linterna, con su nombre correcto. mv puede mover y
    renombrar: mira los EJEMPLOS de man mv.»
lighthouse-steps = Ciento veinte peldaños en espiral. Arriba del todo, la Linterna.
lighthouse-lantern =
    La gran lente del faro, toda anillos de cristal. En el centro, el
    portalámparas está vacío. Una placa dice:

      «Bombilla — nombre exacto: bombilla»
lighthouse-lighthouse-blocked = Una enorme red enmarañada bloquea la puerta del Faro. Habría que moverla (mv) a otra parte…
lighthouse-event-crab = El cangrejo ha vuelto a su cubo. La directora de la escuela aplaude: sabes mover un objeto con mv.
lighthouse-event-net = La red está guardada. La puerta del Faro ha quedado libre.
lighthouse-event-bad-name = La bombilla está en la Linterna, sí… pero el portalámparas rechaza todo objeto que no se llame exactamente bombilla. Renómbrala con mv.
lighthouse-event-light =
    ¡El Faro se enciende! Un haz de luz barre el mar y, en el Puerto,
    la capitana Ana iza la vela.

    ¡Bien hecho! Has terminado el capítulo 1.

    Ya sabes moverte (cd, .., ~), mirar (ls, ls -a), leer
    (cat, less), saber dónde estás (pwd), mover y renombrar (mv). Son
    los mismos comandos que en los servidores reales que hacen funcionar internet.

    El barco te lleva al capítulo 2, «El Pueblo».
