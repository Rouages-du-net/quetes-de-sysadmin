### Historia «La Auditoría», capítulo «La visita de control»: repetir el
### escaneo y ejecutar Lynis para demostrar que las correcciones aguantan,
### reforzar lo que merece la pena, escribir el informe de cierre. Los
### comandos, las opciones, las rutas y la salida de nmap y de Lynis no se
### traducen. Los títulos de sección de la plantilla
### (follow-up-section-…) deben ser los de la plantilla.

chapter-follow-up = La visita de control
    .summary = Demostrar que las correcciones aguantan: un nuevo escaneo, una auditoría Lynis, un refuerzo razonado y el informe de cierre.

## Archivos

follow-up-email-salome =
    De:      Salomé (auditora)
    Para:    tú
    Asunto:  Auditoría de la Panadería — la visita de control

    Hola:

    Las cuatro partes del informe están tratadas: buen trabajo. Antes de
    cerrar, hago lo que hago siempre: la visita de control. No se dice
    «está arreglado», se demuestra.

    Lo que espero, en este orden:
    1. Repite el inventario, como el primer día: nmap -sV sobre el servidor
       (y solo sobre él, recuerda la carta de encargo). ¿Qué ve internet
       ahora?
    2. Ejecuta Lynis en el servidor (man lynis). No arregla nada: dice lo que
       encuentra, y te toca a ti decidir. Primero los avisos; entre las
       sugerencias, las que merecen la pena (algunas necesitan un proyecto de
       verdad: van al informe, no se instalan con prisas).
    3. Corrige, y demuéstralo: un índice de refuerzo de al menos 70, sin
       ningún aviso, y un nuevo escaneo que muestre versiones al día.
    4. Escribe el informe de cierre en informe_cierre.md. Lo leo cada vez que
       guardas.

    Salomé
    (Para sudo, tu contraseña sigue siendo: harina-2028)

follow-up-template =
    # Informe de cierre — la Panadería

    ## Resumen
    (por completar: en dos frases, dónde está la seguridad del servidor)

    ## Hallazgos corregidos
    (por completar: un punto por hallazgo de las partes 1 a 4: SSH, cuenta olvidada, sudo, secreto, exposición, la clave y la tarea cron del intruso)

    ## Pruebas
    (por completar: el nuevo escaneo nmap y el índice de refuerzo de Lynis, con sus cifras)

    ## Pendiente
    (por completar: lo que no está corregido y por qué, con los identificadores de Lynis)

follow-up-section-summary = Resumen
follow-up-section-findings = Hallazgos corregidos
follow-up-section-evidence = Pruebas
follow-up-section-remaining = Pendiente
follow-up-a-complete = (por completar

## Palabras que busca la revisión (separadas por comas, sin distinguir mayúsculas)

follow-up-words-hint = índice, indice, refuerzo, bastionado, index, hardening
follow-up-words-ssh = ssh, root
follow-up-words-account = lucas, cuenta
follow-up-words-sudo = sudo, nopasswd
follow-up-words-secret = .env, secreto
follow-up-words-network = ufw, cortafuegos, redis, firewall
follow-up-words-key = clave, cron

## Revisión

follow-up-review = Salomé lee tu informe:
follow-up-missing-template = Todavía quedan líneas «(por completar)» de la plantilla.
follow-up-missing-summary = El resumen cabe en dos frases, pero hacen falta (algo más que una palabra).
follow-up-missing-findings = En «Hallazgos corregidos» faltan hallazgos: repasa las partes 1 a 4 (SSH, la cuenta olvidada, sudo, el secreto, la exposición de red, la clave y la tarea cron del intruso), al menos cinco de seis.
follow-up-missing-lynis = Primero hay que ejecutar Lynis: sin auditoría, no hay cifra que citar.
follow-up-missing-proofs = En «Pruebas», cita el índice de refuerzo de tu última auditoría Lynis (la cifra exacta) y lo que muestra tu último escaneo (los puertos 22, 80 y 443).
follow-up-missing-rest = En «Pendiente», cita al menos un hallazgo de Lynis todavía abierto con su identificador (como FINT-4350): un informe honesto dice lo que no está hecho.

## Eventos

follow-up-event-error-ssh =
    ¡Hay un error en la configuración de SSH! Antes de recargar, comprueba
    siempre con  sudo sshd -t : te da el archivo y la línea culpables.
follow-up-event-locked-out =
    ATENCIÓN: con la configuración que sshd acaba de cargar, un nuevo inicio
    de sesión desde tu cuenta sería rechazado. Tu sesión sigue abierta:
    corrígelo ANTES de desconectarte.
follow-up-event-outside-scope =
    Has sondeado una dirección fuera de la carta de encargo ({ $addresses }).
    Incluso en una visita de control, se queda una en el perímetro: { $neighbour ->
        [yes] el servidor del vecino sigue sin ser nuestro.
       *[no] lo que no figura en ella no es nuestro.
    }
# { $outdated }: "yes" if the SSH version shown is not up to date
follow-up-event-scan =
    Eso es lo que ve internet ahora. Compáralo con el primer día: los puertos
    5432 (PostgreSQL) y 6379 (Redis) ya no responden; quedan SSH, el sitio
    web y su puerto seguro. Las correcciones del cortafuegos aguantan.
    { $outdated ->
        [yes] Pero mira la versión de SSH: no es la de una máquina al día. Hay una actualización de seguridad esperando (apt list --upgradable); es el tipo de detalle que revela nmap -sV y que nadie mira.
       *[no] Y la versión de SSH es la de una máquina al día.
    }
follow-up-event-lynis =
    Ahí está la auditoría: un índice de refuerzo de { $hint }, y
    { $warnings } aviso(s). Un índice sirve para comparar, no para perseguir
    el 100: lee cada sugerencia, su identificador (SSH-7408…) y su página de
    explicación. Algunas se pueden corregir aquí; otras (integridad de
    archivos, antimalware, registros remotos, auditd) son proyectos de verdad
    que van al informe.

    La auditoría se guarda en /var/log/lynis-report.dat: un
    sudo grep suggestion  sobre él da la lista de una vez.
follow-up-event-update =
    Ya no queda ninguna actualización de seguridad pendiente: el aviso de
    Lynis (PKGS-7392) ha desaparecido, y la versión de SSH que mostrará nmap
    será la nueva. (Acuérdate de volver a ejecutar nmap y Lynis: una
    corrección que no se demuestra no es más que una intención.)
follow-up-event-ssh-a-reload =
    Has cambiado la configuración de SSH, pero sshd sigue funcionando con la
    antigua: un servicio relee su configuración cuando se le pide (sudo
    sshd -t para comprobar, y luego sudo systemctl reload ssh). Lynis lee el
    archivo: su nuevo índice no te dice lo que está aplicado.
# { $target }: the index to reach
follow-up-event-hardened =
    Ningún aviso y un índice de al menos { $target }, con la configuración de
    SSH aplicada. Es un buen nivel para este servidor; el resto es un
    proyecto, no una urgencia.

    Demuéstralo: vuelve a ejecutar Lynis y repite el escaneo.
follow-up-event-proof-lynis =
    La última auditoría Lynis refleja el estado actual de la máquina: ningún
    aviso, y por encima del objetivo. Anota la cifra del índice: el informe
    la cita.
follow-up-event-nmap-own =
    El último escaneo solo ve SSH, el sitio web y su puerto seguro, con la
    versión de SSH al día. Esa es la prueba, desde el lado de internet, de
    que todo aguanta. Queda el informe de cierre.
# { $mistake }: "yes" if a scan went beyond the scope
follow-up-event-end =
    Salomé: «Está completo, y es honesto. Se lo paso a Nadia y a su
    aseguradora. Volveré dentro de seis meses: la seguridad se vuelve a
    comprobar».

    ¡Bien hecho! Has terminado el capítulo «La visita de control» y la
    historia «La Auditoría».

    QUÉ HA PASADO
    Repetiste el escaneo de puertos, ejecutaste Lynis, aplicaste las
    actualizaciones y reforzaste lo que merecía la pena, y luego repetiste
    las dos cosas para demostrarlo. El nuevo índice y el nuevo escaneo están
    en tu informe, con lo que queda por hacer. Una visita de control no
    intenta arreglarlo todo: muestra lo que está arreglado, y dice con
    franqueza lo que no.
    { $mistake ->
        [yes] Tu escaneo también tocó una dirección que no estaba en la carta de encargo: anótalo para la próxima misión.
       *[no] Todos tus escaneos se quedaron dentro del perímetro.
    }

    BUENA PRÁCTICA
    - Demuestra, no afirmes: la misma herramienta, el mismo comando, antes y
      después.
    - Lynis da un índice, no una nota que maximizar: algunas sugerencias
      valen una tarde, otras un proyecto. El informe prioriza.
    - Un aviso se trata antes que las sugerencias.
    - Tras un cambio de configuración, aplica (reload) Y comprueba (nmap,
      lynis, sshd -T): el archivo no es el servicio.
    - La versión que muestra un servicio es una prueba (nmap -sV): una
      actualización de seguridad se ve desde fuera.
    - Un informe honesto lista lo que queda: un riesgo conocido y aceptado
      vale más que uno ignorado.

    OTRA MANERA
    OpenSCAP o las guías de referencia del CIS (Center for Internet Security)
    hacen un trabajo parecido al de Lynis con una cuadrícula de referencia
    precisa: se usan cuando un contrato o una norma te pide demostrar la
    conformidad. Un escáner de vulnerabilidades (OpenVAS, Nessus) cruza las
    versiones con bases de datos de fallos conocidos, cosa que nmap -sV no
    hace.

    DOCUMENTACIÓN
    - Lynis: https://cisofy.com/documentation/lynis/
    - Controles de Lynis: https://cisofy.com/lynis/controls/
    - nmap: https://nmap.org/book/man.html
    - sshd_config: https://man.openbsd.org/sshd_config
    - Guías de higiene y auditoría de las autoridades nacionales: ANSSI (Francia, cyber.gouv.fr), BSI (Alemania, bsi.bund.de), NCSC (Reino Unido, ncsc.gov.uk), CCN-CERT (España, ccn-cert.cni.es), CCB (Bélgica, ccb.belgium.be), NCSC (Suiza, ncsc.admin.ch), CISA (Estados Unidos, cisa.gov)
