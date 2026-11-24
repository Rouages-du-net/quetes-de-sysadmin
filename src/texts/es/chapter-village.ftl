### El Borrador, capítulo 2 — El Pueblo. Buscar, crear, copiar, borrar:
### grep, touch, cp, mkdir, rm. grep lee los avisos del Ayuntamiento línea a
### línea: una frase por línea. La criatura se llama «el Borrador» (las
### pistas proponen «grep Borrador»). Los nombres de lugares y archivos
### (Muelle, Panaderia, masamadre, engranaje…) vienen de names.ftl.

chapter-village = El Pueblo
    .summary = Buscar, crear, copiar, borrar: grep, touch, cp, mkdir, rm.
village-crier =
    El barco de la capitana Ana te deja en el Muelle de un pueblo. Un
    pregonero agita su campana.

    «¡Oíd, oíd! ¡El Borrador ha pasado por el Pueblo! La panadería ya no
    tiene masa madre, el reloj se ha parado, la escuela no tiene aula,
    ¡y la pequeña Nour ha desaparecido! ¿Quién nos ayudará?»

    Te tiende un pergamino:  cat pergamino_de_hechizos.txt
village-scroll-spells =
    EL PERGAMINO DE LOS HECHIZOS — cinco comandos nuevos

      grep patrón archivo   encuentra las líneas que contienen un patrón
      touch nombre          crea un objeto (un archivo vacío)
      cp origen destino     copia un objeto (copy)
      mkdir Nombre          crea un lugar (make directory)
      rm objeto             borra un objeto (remove) — ¡para siempre!

    Recuerda: «man grep» (o man cp, man rm…) da las instrucciones, y
    «grep --help» un resumen. ¿Has olvidado qué comando copia?
    «man -k copia» busca en todos los manuales.

    La gente del Pueblo te necesita: la Panaderia, el Taller, la
    Escuela, el Ayuntamiento… Empieza por donde quieras.
village-stallholder =
    «¡No me queda nada que vender, el Borrador se lo llevó todo! Bueno, casi:
    mira mis puestos.»

    Baja la voz: «Un consejo. Antes de borrar algo con rm, piénsalo bien.
    rm no pone nada en una papelera: lo que borra desaparece para siempre.
    Nuestra Papelera, en el Reino, es solo una carpeta donde cada cual deja
    lo que quiere tirar; el Borrador es quien la vacía, con rm, rm, rm,
    sin mirar nunca atrás.»
village-apple = Una manzana un poco arrugada.
village-apple-2 = Otra manzana, igual de arrugada.
village-cheese = Una rueda de queso muy oloroso. «El único producto que el Borrador no quiso tocar», dice la tendera.
village-cheese-protected-rm = «¡No toques mi último queso!», protesta la tendera.
village-baker =
    El panadero mira fijamente su artesa vacía.

    «El Borrador se lo llevó todo. Solo me queda una masa madre, y
    necesito tres para las tres hornadas de la mañana. ¡Ay, si
    tuviera tres!»

    (cp masamadre masamadre_2 crea una copia de la masa madre.)
village-sourdough = Un tarro de masa madre que burbujea suavemente. Está viva, se alimenta… y se puede copiar.
village-sourdough-protected-rm = «¡Mi última masa madre no!», grita el panadero.
village-craftswoman =
    La artesana rebusca en sus cajones vacíos.

    «¡Socorro! El Borrador borró todos mis engranajes y, sin ellos,
    el reloj del Pueblo ya no gira. ¿Sabes fabricar un objeto? Basta
    con un comando:

      touch engranaje

    Luego necesitaría cinco en total. Fabricar lleva mucho tiempo… copiar
    es rápido.»
village-teacher =
    La maestra da la clase… en el patio de recreo, a falta de aula.

    «¡El Borrador borró nuestra Aula! Un aula es un lugar.
    ¿Sabes construir uno?»

    (mkdir Nombre crea un lugar.)
village-clerk =
    La secretaria está enterrada bajo los carteles.

    «Cada vecino y vecina ha colgado un aviso desde que pasó el Borrador.
    Uno de ellos dice adónde fue, pero ¿cuál? No tengo tiempo de leerlos
    todos. Tú tampoco.

    Usa grep: busca una palabra en los archivos y muestra las líneas
    que la contienen. La estrella * significa «todos los archivos de aquí»:

      grep Borrador *»
village-notice-ball =
    AVISO: el baile del sábado sigue en pie.
    Traed farolillos de papel.
village-notice-cat =
    PERDIDO: gato pelirrojo, responde al nombre de Pixel.
    Recompensa: un queso.
village-notice-sewers =
    AVISO DE LOS ALCANTARILLEROS
    Vimos al Borrador bajar a la Alcantarilla, al fondo del Patio del Callejon.
    La pequeña Nour lo siguió. Las ratas no dejan pasar a nadie.
    La llave del Archivo está bajo el felpudo del Ayuntamiento (un objeto oculto, claro).
village-notice-works =
    MERCADO: abierto los jueves.
    Quesos, manzanas, y poco más.
village-notice-clock =
    AVISO: el reloj se ha parado.
    Mientras no gire, la verja del Callejon sigue cerrada.
village-doormat = Bajo el felpudo, una llavecita. Te la quedas.
village-doormat-read = La puerta del Archivo está abierta.
village-archivist =
    Una archivera trabaja a la luz de una vela.

    «¡Has encontrado la llave! Así que sabes usar grep. Llevo años
    estudiando al Borrador. Todo está en la crónica, pero es
    larga. Busca las líneas que hablan de él:

      grep Borrador cronica.txt

    Y si no sabes seguro si lleva mayúscula, añade -i:

      grep -i borrador cronica.txt»
village-column =
    CRÓNICA DEL REINO

    Año 1: se funda el Pueblo junto al mar.
    Año 12: se construye el muelle, con piedra de la isla.
    Año 40: el Borrador es creado en la Raíz para vaciar la Papelera.
    Año 41: una gran hornada de pan para la fiesta de la masa madre.
    Año 77: se amplía la casa del relojero.
    Año 102: el Borrador ya solo obedece una orden: borrarlo todo.
    Año 103: se dice que solo quien lo puso en marcha puede detenerlo.
    Año 104: se cancela la feria de la manzana (llueve).
    Año 130: se enciende el faro de la isla para guiar a los barcos.
    Año 131: el Borrador vive en la Raíz, en lo más hondo, bajo las alcantarillas del Pueblo.
village-archives-blocked = La puerta del Archivo está cerrada con llave. Los carteles del Ayuntamiento quizá te digan más.
village-barricade = Una barricada de tablas, barriles y sillas rotas, levantada deprisa. Demasiado pesada para moverla.
village-barricade-protected-mv = Tiras con todas tus fuerzas… nada. La barricada pesa demasiado para mv. Pero conoces un hechizo más radical.
village-wall = Un patio empedrado. Al fondo, una tapa de alcantarilla entreabierta: la Alcantarilla.
village-rats =
    Un ejército de ratas corta el paso.

    «¡Iii! Aquí no pasa nadie sin pagar. Queremos QUESO, aquí,
    ahora mismo.»

    Hay un queso en el Mercado. Para copiar uno aquí sin volver atrás,
    da su ruta completa y . (el lugar donde estás) como destino:

      cp ~/Mercado/queso .
village-nour =
    Nour está sentada al borde de un gran tobogán que se hunde en la oscuridad.

    «¡Gracias por venir! Seguí al Borrador hasta aquí. Se deslizó por
    este tobogán, hacia la Raíz, murmurando: "borrar, borrar, la orden
    de la raíz…". Luego las ratas me cortaron el paso.»
village-gallery-blocked = «¡Iii!» Las ratas bloquean la Galeria.
village-yard-blocked = Una barricada bloquea la entrada del Patio.
village-alley-blocked = La verja del Callejon está cerrada. Se abre a una hora fija… pero el reloj del Pueblo se ha parado.
village-event-sourdough = «¡Tres masas madre!» El panadero no se lo cree. «Una copia es un objeto nuevo, idéntico al original. ¡Gracias!»
village-event-gear = «¡Un engranaje! Perfecto. Solo faltan cuatro… con cp, irá rápido.»
village-event-gears = Tic, tac… ¡El reloj del Pueblo vuelve a girar! A la primera campanada del mediodía, la verja del Callejon se abre chirriando.
village-event-class = Un Aula se levanta en la Escuela. Los niños y niñas entran corriendo.
village-event-class-without-nour = Un Aula se levanta en la Escuela. Los niños y niñas entran corriendo. «Solo falta una alumna», suspira la maestra: «Nour».
village-event-barricade =
    ¡Puf! La barricada desaparece. El Patio es accesible.
    (rm no pasa por ninguna papelera: nunca volverá.)
village-event-rats = Las ratas se lanzan sobre el queso y se lo llevan a un agujero. La Galeria está despejada.
village-event-nour-without-class = «Me gustaría volver», dice Nour, «pero el Borrador borró mi Aula. ¿Puedes reconstruirla, en la Escuela?» (mkdir)
village-event-nour =
    Nour corre a su Aula recién construida.

    ¡Bien hecho! Has terminado el capítulo 2.

    Ya sabes buscar (grep), crear (touch, mkdir), copiar (cp) y
    borrar (rm) — con cuidado, porque rm no pasa por ninguna papelera.

    El Borrador se esconde en la Raíz, al fondo del tobogán: te espera
    el capítulo 3.
