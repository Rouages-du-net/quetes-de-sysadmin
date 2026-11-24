### Historia «De Guardia», capítulo 6 «El post-mortem»: encontrar los hechos
### en los registros (journalctl --since/--until, last, apt) y escribir un
### post-mortem sin culpables. Los comandos, las rutas y los mensajes de las
### herramientas no se traducen. Los títulos de sección de la plantilla
### (post-mortem-section-…) deben ser los mismos que en la plantilla.

chapter-post-mortem = El post-mortem
    .summary = El domingo por la noche, Théo estaba de guardia y el directo se cortó: poner por escrito lo que pasó, con los hechos de los registros y sin buscar culpables.

## Archivos

post-mortem-message-zoe =
    Un mensaje de Zoé (lunes, 9:40):

    «El domingo por la noche, Théo estaba de guardia: el directo se cortó,
    y él lo arregló. Para la asociación, escribimos un post-mortem: qué
    pasó, por qué, y qué cambiamos. Sin culpables: no buscamos a quién
    culpar, buscamos lo que hizo posible la avería.

    ¿Puedes escribirlo? La plantilla está en postmortem.md (nano). Théo ha
    dejado sus notas (notes_theo.txt), pero estaba medio dormido:
    comprueba las horas en los registros. Lo releeré cada vez que
    guardes.»
post-mortem-notes-theo =
    Notas de Théo (domingo, 3:10):

    Me despertó el móvil, no recuerdo a qué hora, ¿hacia las 2:30?
    El repetidor se había caído, hacia las 2:20 creo. journalctl decía una
    opción desconocida en stream.conf, línea 7 (bitrate_max). La comenté,
    lo reinicié, y volvió.

    Lo que no entiendo: ¿por qué se reinició el repetidor en plena noche?
    No había nadie conectado.
post-mortem-template =
    # Post-mortem: corte del directo, noche del 11 al 12 de septiembre de 2027

    Sin culpables: buscamos lo que hizo posible la avería, no a quién culpar.

    ## Resumen
    (por completar: dos o tres frases)

    ## Cronología
    (por completar: las horas, comprobadas en los registros)

    ## Impacto
    (por completar: cuánto tiempo, para quién)

    ## Causas
    (por completar: qué desencadenó la avería, y qué la hizo posible)

    ## Lo que funcionó bien
    (por completar)

    ## Acciones
    (por completar: una línea «-» por acción)
post-mortem-conf-stream =
    # Radio Barrio: repetidor del directo (el servicio radio-stream)
    port = 8000
    mount = /directo
    logfile = /var/log/radio/stream.log
    loglevel = info
    record_dir = /srv/radio/programas
    #bitrate_max = 192    # Théo, 12/09: opción desconocida, comentada
    stats_dir = /srv/radio/stats
post-mortem-unattended-conf =
    // Actualizaciones de seguridad, instaladas automáticamente cada noche
    // (apt-daily-upgrade.timer). needrestart reinicia luego los servicios
    // que usan una biblioteca actualizada.
    Unattended-Upgrade::Origins-Pattern {"{"}
            "origin=Debian,codename=bookworm,label=Debian-Security";
    {"}"};
    Unattended-Upgrade::Automatic-Reboot "false";
post-mortem-apt-history =
    Start-Date: 2027-09-05  02:11:52
    Commandline: /usr/bin/unattended-upgrade
    Upgrade: tzdata:amd64 (2027a-0+deb12u1, 2027b-0+deb12u1)
    End-Date: 2027-09-05  02:11:58

    Start-Date: 2027-09-12  02:12:44
    Commandline: /usr/bin/unattended-upgrade
    Upgrade: libssl3:amd64 (3.0.15-1~deb12u1, 3.0.15-1~deb12u2), openssl:amd64 (3.0.15-1~deb12u1, 3.0.15-1~deb12u2)
    End-Date: 2027-09-12  02:13:04
post-mortem-unattended-dpkg =
    Log started: 2027-09-12  02:12:45
    (Reading database ... 41213 files and directories currently installed.)
    Preparing to unpack .../libssl3_3.0.15-1~deb12u2_amd64.deb ...
    Unpacking libssl3:amd64 (3.0.15-1~deb12u2) over (3.0.15-1~deb12u1) ...
    Setting up libssl3:amd64 (3.0.15-1~deb12u2) ...
    Processing triggers for libc-bin (2.36-9+deb12u9) ...

    Restarting services...
     systemctl restart radio-stream.service
    Log ended: 2027-09-12  02:13:04

## Lo que el juego comprueba en el post-mortem

# Los títulos de sección (como en la plantilla, sin «##»).
post-mortem-section-summary = Resumen
post-mortem-section-timeline = Cronología
post-mortem-section-impact = Impacto
post-mortem-section-causes = Causas
post-mortem-section-went-well = Lo que funcionó bien
post-mortem-section-actions = Acciones
# El principio de las líneas de la plantilla que hay que sustituir.
post-mortem-a-complete = (por completar
# Palabras, una de las cuales debe aparecer en «Causas» (separadas por comas, en minúsculas).
post-mortem-words-trigger = unattended, upgrade, apt, needrestart, actualización, actualizacion, actualizar
post-mortem-words-origin = agosto, ago 20, 20 ago, aug 20, 20/08, 08/20, 2027-08-20
# Palabras que buscan a quién culpar (el post-mortem debe evitarlas).
# (No «culpa» sola: está dentro de «culpables» y de «no es culpa de nadie».)
post-mortem-words-blame = la culpa, por culpa, culpa de théo, culpa de theo, culpa de zoé, culpa de zoe, culpable de, negligencia, negligente, descuido, descuidado, descuidada, debería haber, debió haber, incompetente, error de théo, error de theo, error de zoé, error de zoe

post-mortem-review = Zoé relee tu post-mortem:
# { $word }: la palabra que busca a quién culpar
post-mortem-blame = «{ $word }»: buscamos lo que hizo posible la avería, no quién la provocó. Nadie actuó mal; lo que mejoramos es el sistema (las herramientas, las costumbres). ¿Puedes reformularlo?
post-mortem-missing-template = Aún quedan líneas «(por completar)» de la plantilla.
post-mortem-missing-timeline = La cronología debe dar, comprobadas en los registros, la hora de la avería, la de la primera alerta y la de la vuelta del directo (journalctl --since … --until …, el correo de la alerta).
post-mortem-missing-impact = El impacto: ¿cuántos minutos de silencio para quienes escuchaban?
post-mortem-missing-cause = Las causas: qué reinició el repetidor en plena noche (el historial de apt, /var/log/unattended-upgrades), y el error de configuración que le impidió volver a arrancar.
post-mortem-missing-origin = ¿Y desde cuándo esperaba ese error en stream.conf? El registro guarda los comandos ejecutados con sudo.
post-mortem-missing-actions = Al menos dos acciones, una por línea «-».
post-mortem-missing-works = El resumen, y lo que funcionó bien (¡hay cosas!).

## Eventos

post-mortem-event-notes =
    Las notas de Théo dan pistas, no hechos: «¿hacia las 2:30?», «hacia
    las 2:20 creo». Los registros, en cambio, son exactos al segundo
    (journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30").
    ¿Y quién se conectó esa noche? (last)
post-mortem-event-reboot =
    Justo antes de que cayera el repetidor, arrancó apt-daily-upgrade: la
    actualización automática de la noche. ¿Qué instaló, y qué hizo
    después? (/var/log/apt/history.log, /var/log/unattended-upgrades)
post-mortem-event-origin =
    El 20 de agosto, Zoé cambió stream.conf… sin reiniciar el repetidor,
    que siguió funcionando con la configuración antigua. El error esperó
    tres semanas al primer reinicio. No es culpa de nadie: nada comprobaba
    la configuración después de un cambio.
post-mortem-event-end =
    Zoé: «Perfecto. Lo leeré en la reunión del jueves, y nos pondremos con
    las acciones. Gracias por estas noches; has hecho de esta radio un
    sitio donde las averías nos enseñan algo».

    ¡Bien hecho! Has terminado De Guardia.

    QUÉ HA PASADO
    Una actualización de seguridad automática (unattended-upgrades)
    reinició el repetidor a las 2:13 (needrestart). No pudo volver a
    arrancar: una opción desconocida (bitrate_max) esperaba en su
    configuración desde el 20 de agosto, nunca comprobada ni aplicada. La
    sonda alertó a las 2:15, Théo lo arregló a las 2:58: 45 minutos de
    silencio.

    BUENA PRÁCTICA
    - Primero los hechos: los registros (journalctl --since/--until, last,
      el historial de apt), no los recuerdos.
    - Sin culpables: busca las condiciones que hicieron posible la avería
      (una configuración nunca comprobada, un reinicio de noche), no a
      quién culpar; si no, nadie vuelve a hablar de sus errores.
    - Acciones concretas, con quién y cuándo: comprobar la configuración
      antes de reiniciar (ExecStartPre=), reiniciar después de cada
      cambio, despertar a la persona de guardia con más fuerza…
    - Comparte el post-mortem: así aprende todo el equipo.

    DOCUMENTACIÓN
    - La cultura del postmortem (Google SRE): https://sre.google/sre-book/postmortem-culture/
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    - unattended-upgrades: https://wiki.debian.org/UnattendedUpgrades
