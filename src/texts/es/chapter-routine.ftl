### Historia «La Vigilancia», capítulo «Crear una rutina»: automatizar las
### actualizaciones de seguridad (sin hacerlo todo solo) y programar un
### recordatorio semanal. Las palabras clave de apt.conf, los comandos y las
### rutas no se traducen.

chapter-routine = Crear una rutina
    .summary = Automatizar lo que se puede automatizar (actualizaciones de seguridad, un recordatorio semanal), sin sustituir el criterio humano.

## Archivos

routine-email-salome =
    De:      Salomé
    Para:    tú
    Asunto:  La última pieza: convertirlo en hábito

    La semana ha terminado, pero la vigilancia no es algo que se haga una
    sola vez. Dos cosas que montar antes de que me vaya de verdad:

    1. unattended-upgrades está instalado, pero no activado (mira
       /etc/apt/apt.conf.d/20auto-upgrades: las dos tareas periódicas están
       a "0"). Actívalas. Y limítalo SOLO a las actualizaciones de SEGURIDAD
       (/etc/apt/apt.conf.d/50unattended-upgrades): actualizarlo todo
       automáticamente acabaría rompiendo algo un día sin avisar. Mándate un
       informe por correo (Unattended-Upgrade::Mail).
    2. Un recordatorio semanal que te recuerde leer el próximo boletín: un
       temporizador de systemd o una tarea cron, que te envíe por correo la
       lista de paquetes que esperan una actualización (man systemd.timer,
       man crontab).

    unattended-upgrades se encargará solo de las actualizaciones de
    seguridad; el resto (un CVE todavía sin corrección, un paquete fuera de
    seguridad) sigue siendo tu trabajo, cada semana, con el próximo boletín.

    Salomé
    (Para sudo, tu contraseña sigue siendo: masamadre-2028)

## Eventos

routine-event-syntax =
    ¡Hay un error de sintaxis en la configuración de apt! Una asignación se
    escribe «Clave "valor";», una lista «Clave {"{"} "a"; "b"; {"}"};» (man
    apt.conf). Corrígelo antes de seguir: apt se niega a leer el resto
    mientras siga ahí.
routine-event-active =
    Las dos tareas periódicas están activadas. Queda limitar lo que toca
    unattended-upgrades, y mandarte un informe.
routine-event-security =
    unattended-upgrades está activo, limitado a las actualizaciones de
    seguridad (Debian-Security), y se enviará un informe por correo. Queda
    el recordatorio semanal.
routine-event-periodic =
    Existe un recordatorio, y sobrevive a un reinicio. Te recordará, cada
    semana, leer el próximo boletín — incluso para lo que
    unattended-upgrades no corrige por sí solo.
routine-event-end =
    Salomé: «Ya está. unattended-upgrades para lo que se corrige solo, un
    recordatorio para lo demás. Para esto ya no me necesitas».

    ¡Bien hecho! Has terminado el capítulo «Crear una rutina» y la historia
    «La Vigilancia».

    QUÉ HA PASADO
    Una vigilancia de seguridad que depende por completo de la memoria de
    una persona acaba saltándose una semana. Dos redes de seguridad
    complementarias: la automatización para lo que no necesita criterio
    (una actualización de seguridad ya publicada, ya probada por Debian), y
    una cita regular para lo que sí lo necesita (leer un boletín, decidir
    una prioridad, anotar lo encontrado).

    BUENA PRÁCTICA
    - Limita la automatización a las actualizaciones de seguridad: el resto
      (una nueva versión mayor, una dependencia que cambia de
      comportamiento) merece verse antes de aplicarse.
    - Mándate un informe (por correo, o por cualquier otro medio que mires
      de verdad): una automatización silenciosa que nadie vigila nunca
      equivale a no haber hecho nada.
    - Escribe las tareas programadas en /etc (archivos del sistema, no un
      script perdido en una carpeta personal): tienen que sobrevivir a un
      reinicio y a un cambio de cuenta.
    - Una rutina no sustituye al criterio: libera tiempo para dedicarlo
      donde de verdad hace falta.

    OTRA MANERA
    En lugar de un correo, un recordatorio semanal también puede ser una
    tarea en un gestor de proyectos, una alerta en una herramienta de
    monitorización (como los plugins de «La sonda»), o simplemente un
    recordatorio en un calendario compartido del equipo: lo que importa es
    que alguien lo vea de verdad, no la forma exacta del recordatorio.

    DOCUMENTACIÓN
    - unattended-upgrades: https://wiki.debian.org/UnattendedUpgrades
    - systemd.timer: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - crontab: https://manpages.debian.org/bookworm/cron/crontab.5.en.html
