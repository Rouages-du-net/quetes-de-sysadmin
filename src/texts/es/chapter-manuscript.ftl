### Historia «La Máquina del Tiempo», capítulo único
### (src/engine/chapters/manuscript.ts): Inès, novelista, ha estropeado su
### manuscrito; lo reparamos con git. La novela, sus versiones, los mensajes
### de commit y los poemas son textos de la historia: se traducen
### (los identificadores de commit cambian entonces con el idioma).

chapter-manuscript = La Máquina del Tiempo
    .summary = Viajar por las versiones de un texto con git: log, diff, restore, add, commit, init.

# Autora de los commits (git log): nombre y dirección, en el formato de git
manuscript-author = Inès Haddad <ines@example.org>

## La novela de Inès (novela.txt), capítulo a capítulo

manuscript-novel-chapter-1 =
    CAPÍTULO 1 — LA PARTIDA

    El autobús nocturno salió de Marsella a las diez.
    Yasmina apretaba contra sí la carta de su abuela.
    «Ve a ver el faro», había escrito la abuela Zohra. «Todo está allí.»
manuscript-novel-chapter-2 =
    CAPÍTULO 2 — LA TRAVESÍA

    El barco a la isla zarpó al amanecer.
    En cubierta, un viejo marinero remendaba una red, tarareando.
    Conocía el faro: «Nadie ha subido allí desde 1962.»
manuscript-novel-chapter-3 =
    CAPÍTULO 3 — EL FARO

    La puerta cedió al tercer empujón de hombro.
    Arriba del todo, bajo la linterna, esperaba una caja de hierro.
    Dentro: cuadernos, cubiertos con la letra apretada de Zohra.
# El capítulo 3 después de que el gato pasara por el teclado: se conserva
# el título, solo se traduce el título; las líneas de letras quedan igual.
manuscript-novel-chapter-3-damaged =
    CAPÍTULO 3 — EL FARO

    jjjjjjjjjjjjjjjjjjjjjjkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk;;;;;;;;;;;;;
    mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm

## Los mensajes de commit de Inès (git log)

manuscript-commit-1 = Capítulo 1: la partida
manuscript-commit-2 = Capítulo 2: la travesía
manuscript-commit-3 = Capítulo 3: el faro
manuscript-commit-4 = Copia de la mañana

## Los poemas (carpeta poemas)

manuscript-poem-sea =
    El mar cose
    los bordes del mundo
    con un hilo de espuma.
manuscript-poem-lighthouse =
    Un ojo que gira
    en la noche de los marineros:
    nunca duerme.
manuscript-poem-zohra =
    Mi abuela hablaba
    tres lenguas y media,
    la media era silencio.

## Archivos

manuscript-message-ines =
    Un mensaje de Inès, tu amiga novelista:

    «¡Desastre! Esta mañana mi gato ha cruzado el teclado mientras tenía
    la novela abierta… y he guardado sin mirar. El capítulo 3 ya no es
    más que una papilla de letras. Y peor: ¡hice un commit justo después!

    Por suerte, mi carpeta novela la sigue git, una máquina del tiempo
    para archivos: cada «commit» es una instantánea de todos los
    archivos, con un mensaje y una fecha. ¿Me ayudas a recuperar mi
    capítulo? Empieza por echar un vistazo:

      cd novela
      cat novela.txt
      git log

    Y ya puestos… mis poemas, en la carpeta poemas, no los sigue
    nada de nada. Si mi gato vuelve a hacerlo, lo pierdo todo.»
manuscript-help-git =
    CHULETA DE GIT (ver también:  man git)

      git log --oneline          el historial, un commit por línea (el más reciente arriba)
      git show ID                lo que cambió un commit
      git diff ID novela.txt     las diferencias entre ese commit y el archivo actual
                                 (- : la línea de antes, + : la línea de ahora)
      git restore --source=ID novela.txt
                                 deja novela.txt como estaba en ese commit
      git status                 lo que ha cambiado desde el último commit
      git add novela.txt         prepara el archivo para el próximo commit
      git commit -m "mensaje"    toma la instantánea, con un mensaje

    Un commit se designa por el principio de su identificador (bastan 7
    caracteres), o por HEAD (el último), HEAD~1 (el anterior), HEAD~2…

    Para empezar a seguir una carpeta:  git init , luego  git add .  (el
    punto = toda la carpeta) y  git commit -m "…"

## Eventos

manuscript-event-history =
    Cuatro commits, del más reciente al más antiguo. El último, «Copia de
    la mañana», es el del gato. El anterior, «Capítulo 3: el faro», es de
    antes del desastre. Para ver lo que cambió el gato: git show HEAD
manuscript-event-restored =
    ¡El capítulo 3 ha vuelto! El archivo ha viajado en el tiempo.
    Pero de momento solo está reparada tu copia de trabajo: el último
    commit sigue conteniendo la papilla. Mira git status y luego guarda
    la versión reparada:

      git add novela.txt
      git commit -m "Recuperar el capítulo 3 (gracias, gato)"
manuscript-event-saved =
    Commit guardado. Fíjate: no se ha borrado nada del historial. El commit
    del gato sigue ahí (git log); simplemente hemos añadido encima una
    instantánea nueva, reparada. Con git, casi nunca se pierde nada.

    Quedan los poemas de Inès: convierte la carpeta poemas en un
    repositorio (git init) y luego toma una primera instantánea de todos
    los poemas.
manuscript-event-poems = Los tres poemas están ahora en un commit: aunque vuelva el gato, están a salvo en el historial.
manuscript-event-end =
    Inès responde: «¡Mi capítulo! ¡Mis poemas! Eres un mago, una
    hechicera, bueno… una persona maravillosa».

    FIN DE LA HISTORIA «LA MÁQUINA DEL TIEMPO».

    Ya sabes leer el historial de una carpeta (git log, git show), ver
    las diferencias (git diff), volver a una versión (git restore) y tomar
    instantáneas nuevas (git add, git commit). git lo creó en 2005
    Linus Torvalds para desarrollar el kernel Linux. También se usa para
    libros, tesis, sitios web… como el que estás leyendo.
