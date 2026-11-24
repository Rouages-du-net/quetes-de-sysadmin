### Historia «Windows al Lado», capítulo «Caracteres invisibles»: un script
### escrito en Windows (finales de línea CR LF) que bash no puede ejecutar,
### cómo verlo, convertirlo y evitar que git lo traiga de vuelta. Los
### comandos, contenidos de archivos y salidas de las herramientas no se
### traducen.

chapter-line-endings = Caracteres invisibles
    .summary = Un script de copia escrito en un portátil Windows ni siquiera arranca en Linux: encuentra el carácter invisible al final de cada línea, convierte el archivo y haz que git lo mantenga bien.

## Shared by the story

mixed-fleet-ops-readme =
    ops - los scripts del Estudio de Arquitectura (compas)

    nightly-copy.sh    copia nocturna de /srv/projects/current a /srv/nightly
                 (cron, 01:30, con tu cuenta)

    Escríbelos donde quieras, súbelos aquí, ejecútalos en compas.
    Henrik

mixed-fleet-project-notes =
    Proyectos en curso - Estudio de Arquitectura
    harbour-library: revisión C de la fachada, para el 30 de noviembre
    school-canteen: distribución de la cocina, revisión con el cliente el viernes

mixed-fleet-plotter-conf =
    # Plotter - exporta los planos a PDF cada mañana a las 06:00
    {"["}export]
    source = /srv/projects/current
    target = /mnt/plans/exports
    user = plotter

mixed-fleet-templates-readme =
    Cajetines y plantillas del Estudio de Arquitectura. Pregunta a Ifeoma antes de cambiarlos.

mixed-fleet-handover =
    armario - notas de traspaso (Priya, contratista), 28 de octubre de 2029

    Windows Server 2022 Standard, servidor de archivos del Estudio.
    C: sistema (100 GB), D: Data (500 GB): los recursos compartidos viven
    en D:\Shares.

    Recursos: plans (D:\Shares\plans): proyectos, exportaciones PDF,
              plantillas.
              scans (D:\Shares\scans): la fotocopiadora deja ahí sus
              escaneos.
    compas accede a plans con la cuenta local compass-svc.

    OpenSSH Server está activado (integrado en Windows): ssh llega a
    PowerShell. Tu clave está en
    C:\ProgramData\ssh\administrators_authorized_keys (para los
    administradores, Windows lee ese archivo, no el de tu perfil).

    SMB1 está desactivado y así sigue. Windows Update reinicia el servidor
    las noches de martes, entre las 03:00 y las 03:30.

    Me ocupo de este servidor el primer lunes de cada mes; para cualquier
    otra cosa, escríbeme lo que viste y yo me encargo.
    Priya

## Files

line-endings-email-ifeoma =
    De:    Ifeoma
    Para:  tú

    ¡Hola, y te damos la bienvenida al Estudio de Arquitectura!

    Nuestros servidores son un poco variados. compas, donde estás, es
    nuestro servidor Linux: guarda las copias de los proyectos y ejecuta
    Plotter, el servicio que exporta nuestros planos a PDF. A su lado,
    armario es el servidor Windows donde todo el mundo guarda sus planos;
    lo instaló Priya, nuestra contratista, y ella se ocupa de él.

    Lo primero: Henrik escribió un script para la copia nocturna de los
    proyectos en curso, en su portátil (Windows), y lo puso en ~/ops, el
    repositorio git de nuestros scripts. Nunca se ha ejecutado: anoche,
    /srv/nightly se quedó vacío, y cuando lo pruebo yo dice algo de un «bad
    interpreter». El archivo me parece perfectamente normal.

    ¿Podrías averiguar qué le pasa, hacer una copia y asegurarte de que el
    próximo script que venga de una máquina Windows no vuelva a hacer esto?

    ¡Gracias!
    Ifeoma

## Events

line-endings-event-bad-interpreter =
    «/bin/bash^M: bad interpreter»: el núcleo leyó la línea #! y buscó un
    programa llamado /bin/bash seguido de un carácter invisible, mostrado
    como ^M. Ese carácter es un retorno de carro (CR, \r, byte 0x0D):
    Windows termina cada línea con CR LF (\r\n), Linux solo con LF (\n).
    Mira los bytes del archivo en lugar de su texto: file, cat -A, od -c.
line-endings-event-carriage-return =
    «$'\r': command not found»: bash muestra el retorno de carro entre
    comillas $'…', como escribe los caracteres que no se ven. Para bash, la
    línea 5 vacía es un comando llamado \r, y SRC contiene
    «/srv/projects\r»: ese directorio no existe. Cada línea lleva un \r al
    final.
line-endings-event-chmod =
    El script ya era ejecutable (rwx en ls -l): los permisos nunca fueron
    el problema. Lo es el intérprete nombrado en la primera línea.
line-endings-event-crlf =
    Ahí está: cada línea termina en \r\n (^M$ para cat -A, \r \n para od
    -c, «with CRLF line terminators» para file). Un editor en Windows
    escribe eso; bash solo conoce \n. Convierte el archivo a finales de
    línea Unix (man dos2unix; sed y tr también pueden hacerlo).
line-endings-event-converted =
    nightly-copy.sh está ahora en formato Unix: no queda ningún \r, los
    comandos intactos. Ejecútalo.
line-endings-event-ran =
    /srv/nightly/current está ahí: la copia se ha hecho. Ahora, para que el
    próximo push de Henrik no traiga de vuelta el \r: dile a git que estos
    archivos son texto con finales de línea LF (man gitattributes), y haz
    un commit con él y el script convertido.
line-endings-event-committed =
    El repositorio dice ahora que los *.sh son texto con finales de línea
    LF, y su script está en LF: use Henrik el editor que use, git guarda y
    extrae LF.
line-endings-event-end =
    Ifeoma: «¡Se ha ejecutado! Y Henrik dice que la próxima vez hará pull
    antes de editar. Gracias.»

    ¡Bien hecho! Has terminado el capítulo «Caracteres invisibles».

    QUÉ HA PASADO
    El editor de Henrik en Windows guardó el script con finales de línea
    CR LF. En Linux, el retorno de carro (\r, ^M) pasó a formar parte de la
    última palabra de cada línea: la línea #! pedía «/bin/bash\r» (bad
    interpreter), bash ejecutado a mano tomaba una línea vacía por un
    comando llamado $'\r', y las variables conservaban un \r al final de su
    valor. Lo viste con file, cat -A u od -c, convertiste el archivo, lo
    ejecutaste y añadiste un .gitattributes para que git mantenga en LF los
    scripts del repositorio.

    BUENA PRÁCTICA
    - Cuando un script «parece correcto» pero falla de forma extraña, mira
      sus bytes: file, cat -A (^M$ al final de cada línea), od -c (\r \n).
    - dos2unix (o sed -i 's/\r$//', o tr -d '\r' en una tubería) para
      convertir; unix2dos para el sentido contrario.
    - En el repositorio, un .gitattributes con «*.sh text eol=lf» (o «*
      text=auto eol=lf»): git guarda LF y escribe LF al extraer, sea cual
      sea la máquina. Primero el commit del .gitattributes, luego los
      archivos.
    - En Windows, los editores pueden guardar en LF (VS Code, Notepad++), y
      el ajuste core.autocrlf de git convierte al extraer; .gitattributes
      tiene prioridad, y viaja con el repositorio.

    OTRA MANERA
    WSL (el Subsistema de Windows para Linux) ejecuta un Linux de verdad en
    el portátil: un script escrito y probado ahí tiene finales LF y se
    encuentra con bash antes que con compas.

    DOCUMENTACIÓN
    - dos2unix(1): https://waterlan.home.xs4all.nl/dos2unix/dos2unix.htm
    - gitattributes, los atributos eol y text: https://git-scm.com/docs/gitattributes
    - bash, comillas ANSI-C ($'…'): https://www.gnu.org/software/bash/manual/bash.html#ANSI_002dC-Quoting
