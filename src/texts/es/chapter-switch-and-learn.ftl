### Historia «El Refugio», capítulo «Cambiar y aprender»: el cortafuegos de
### refugio, una comprobación desde fuera, www cambiado en la zona (serial,
### rndc reload, TTL), la revisión sin culpables, y el próximo simulacro de
### restauración programado. El último capítulo de la serie: su balance
### cierra el arco. Los comandos, las opciones, las rutas y las salidas no
### se traducen.

chapter-switch-and-learn = Cambiar y aprender
    .summary = El sitio vuelve a funcionar en la máquina de repuesto, pero el mundo sigue pidiendo la dirección del servidor ahogado. Abre el camino, compruébalo desde fuera, apunta el nombre a la máquina nueva, y mira cómo se apaga la respuesta antigua. Luego las dos líneas del plan que todo el mundo se salta: la revisión, y el próximo simulacro.

## Archivos

switch-and-learn-message-teuila =
    De: Teuila
    Viernes 14 de noviembre, 13:10

    refugio funciona por dentro: Mirela ha visitado en él las páginas de
    los animales. Ahora el mundo. Los visitantes siguen pidiendo
    www.hillsideshelters.example y reciben la dirección de Hillside, que
    está bajo el agua.

    El router de Riverbend ya redirige su dirección pública,
    203.0.113.163, puerto 80, a refugio (Wiremu lo hizo a mediodía).
    pradera es nuestro servidor DNS primario oculto para la zona
    (/etc/bind), el servidor del registrador la copia. El plan de Dariusz
    nos hizo bajar el TTL de www a cinco minutos hace quince días: el
    cambio debería ser rápido.

    Luego las dos últimas líneas del plan, las que nadie hace:
    - la revisión, en revision.md aquí (la plantilla está lista). Sin
      nombres a los que culpar: qué pasó, qué ayudó, qué cambiar, y quién
      hace qué a continuación.
    - el próximo simulacro de restauración: Mirela empezó un script,
      /usr/local/sbin/restore-drill. Tiene que restaurar y comprobar de
      verdad, y ejecutarse solo, cada mes. Su clave está en
      /root/.restic-drill.

    Teuila

switch-and-learn-review-template =
    # Revisión posincidente: la inundación de Hillside, 14 de noviembre de 2031

    <!-- Sin culpables: describe qué pasó y por qué, no quién tiene la culpa. -->

    ## Resumen

    (por completar)

    ## Cronología

    <!-- Las horas, de los registros: el /var/log/sitewatch.log de pradera, las instantáneas de restic, el diario de named. -->
    (por completar)

    ## Impacto

    (por completar)

    ## Qué fue bien

    (por completar)

    ## Qué mejorar

    (por completar)

    ## Acciones

    <!-- Una por línea, cada una con su responsable: Teuila, Mirela, Rahel, Wiremu, o tú. -->
    (por completar)

switch-and-learn-section-summary = Resumen
switch-and-learn-section-timeline = Cronología
switch-and-learn-section-impact = Impacto
switch-and-learn-section-went-well = Qué fue bien
switch-and-learn-section-improve = Qué mejorar
switch-and-learn-section-actions = Acciones
switch-and-learn-placeholder = (por completar)
# Una expresión regular: las palabras que señalan a un culpable.
switch-and-learn-blame-words = \b(culpa|culpable|culpables|culpar|descuido|descuidado|descuidada|negligente|negligencia|estúpido|estúpida|incompetente|debería haberlo sabido)(?![\wáéíóúñ])
# Una expresión regular: las personas que pueden ser responsables de una acción.
switch-and-learn-owners = \b(Teuila|Mirela|Rahel|Wiremu|tu|yo)\b|\btú(?![\wáéíóúñ])

## Eventos

switch-and-learn-event-outside-closed =
    Ninguna respuesta de refugio en el puerto 80, desde fuera: el router
    redirige el puerto, pero el cortafuegos de refugio lo descarta (Wiremu
    activó ufw esta mañana, solo con ssh). Cambiar el nombre ahora
    mandaría a cada visitante contra ese muro.
switch-and-learn-event-opened =
    El cortafuegos de refugio deja entrar la web (puerto 80). Comprueba
    desde aquí, a través de la dirección pública de Riverbend, antes de
    tocar el nombre.
switch-and-learn-event-outside =
    Desde pradera, fuera de los dos refugios, la dirección pública de
    Riverbend responde con el sitio de los refugios: refugio está listo
    para el mundo. Ahora el nombre.
switch-and-learn-event-dark-switch =
    www apunta ahora a Riverbend, pero los visitantes no reciben nada:
    refugio todavía no responde desde fuera (su cortafuegos, o nginx). En
    un cambio de verdad, el orden es: primero funciona desde fuera, luego
    el nombre.
switch-and-learn-event-serial =
    named ha cargado la dirección nueva, pero el servidor del registrador
    sigue sirviendo la antigua: el serial del SOA no ha subido, así que el
    secundario no copia la zona (journalctl -u named lo dice). Súbelo, y
    vuelve a hacer rndc reload.
switch-and-learn-event-zone =
    named en pradera sirve la dirección nueva de www.
switch-and-learn-event-switched =
    El servidor del registrador responde 203.0.113.163 para www: los
    visitantes que pregunten ahora llegan a refugio. Aquellos cuyo
    resolutor recuerda la respuesta antigua seguirán dentro de su TTL:
    cinco minutos, gracias al plan.
switch-and-learn-event-cache =
    Sigue la dirección antigua: el resolutor responde desde su caché hasta
    que se agota el TTL que recibió (dig muestra los segundos que quedan).
    Pregunta directamente al servidor del registrador (dig
    @ns1.registrar.example) para ver lo que sirve ahora; el resolutor
    seguirá dentro de cinco minutos.
switch-and-learn-event-resolver =
    El resolutor público también da la dirección nueva: la respuesta
    antigua ha caducado. Ahora todo el mundo llega a refugio.
switch-and-learn-event-blame =
    La revisión señala a alguien. Una revisión sin culpables describe lo
    que el sistema y el proceso permitieron, para que la gente lo cuente
    todo la próxima vez: escribe qué pasó, no de quién es la culpa.
switch-and-learn-event-no-owners =
    Cada acción necesita un responsable (Teuila, Mirela, Rahel, Wiremu, o
    tú), una acción por línea: una acción de la que nadie es responsable
    es un deseo.
switch-and-learn-event-no-timeline =
    La cronología necesita las horas de los registros: cuándo se cayó el
    sitio ({ $time }, la primera comprobación fallida de sitewatch.log), y
    al menos dos más (la última copia, el cambio…).
switch-and-learn-event-review =
    La revisión está escrita: qué pasó, su impacto, qué ayudó, qué
    cambiar, y quién hace qué.
switch-and-learn-event-drill-list-only =
    El simulacro, ejecutado como se ejecutará, solo lista las
    instantáneas: eso prueba que el repositorio se abre, no que una copia
    vuelve. Un simulacro restaura (al lado: --target), y luego comprueba
    lo que ha vuelto.
switch-and-learn-event-drill-over-root =
    El simulacro restaura sobre /: en pradera, eso escribiría el /etc de
    cercado sobre el de pradera. Restaura al lado, en una carpeta
    provisional.
switch-and-learn-event-drill-unchecked =
    El simulacro restaura, pero no comprueba lo que ha vuelto: el SHA-256
    del volcado está en shelter.sha256, a su lado (sha256sum -c, desde
    esa carpeta).
switch-and-learn-event-drill-failed =
    La tarea se ejecuta, pero restic nunca llegó al final: lee lo que
    imprime (ejecuta el script a mano, como root).
switch-and-learn-event-drill =
    El simulacro, ejecutado como lo ejecutará cron o el temporizador,
    restaura la última instantánea al lado y comprueba el volcado con su
    SHA-256.
switch-and-learn-event-end =
    Teuila: «El sitio ha vuelto, la revisión está en la mesa de la junta,
    y el próximo simulacro está en el calendario. Gracias. De verdad».

    ¡Bien hecho! Has terminado «El Refugio», y con ella la última historia
    de Quêtes de Sysadmin.

    QUÉ HA PASADO
    refugio servía el sitio por dentro; abriste su cortafuegos a la web y
    lo comprobaste desde fuera antes de tocar el nombre. Luego www cambió
    en la zona, con un serial que subió para que el servidor del
    registrador lo siguiera, y el TTL de cinco minutos bajado de antemano
    dejó que la respuesta antigua se apagara deprisa. La revisión cuenta
    la noche sin culpables, con acciones y responsables, y el próximo
    simulacro restaurará y comprobará solo cada mes.

    BUENA PRÁCTICA
    - Cambia al final: primero el servicio nuevo funciona desde fuera,
      luego se mueve el nombre.
    - Baja el TTL mucho antes de necesitar moverte (días, no minutos): el
      TTL antiguo es lo que recuerdan las cachés.
    - Un cambio de zona necesita un serial más alto, o los secundarios se
      quedan con la zona antigua.
    - Una revisión sin culpables: cronología a partir de los registros,
      impacto, qué ayudó, qué cambiar, acciones con un responsable y una
      fecha.
    - Un simulacro que no restaura no prueba nada: restaura al lado,
      comprueba (sumas, recuentos), cronométralo, y escribe el resultado
      en el plan.
    - El plan es un documento vivo: cada servicio nuevo, cada simulacro,
      cada incidente lo cambia.

    Desde el primer comando del Borrador, has listado archivos, leído
    registros, abierto puertos y cerrado otros, firmado, cifrado,
    restaurado. Esta última noche lo ha juntado todo: un plan, las copias
    que prometía, una reconstrucción en el orden correcto, un cambio con
    calma, y las lecciones escritas para la siguiente persona. Ese es el
    oficio, más que cualquier comando suelto. Mantén ciertos tus planes,
    sigue haciendo simulacros, y sé amable en tus revisiones. Gracias por
    jugar.

    DOCUMENTACIÓN
    - NIST SP 800-34 Rev. 1 (pruebas, ejercicios y mantenimiento del plan): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
    - BIND 9, archivos de zona y el serial del SOA: https://bind9.readthedocs.io/en/stable/chapter3.html
    - RFC 1034, caché y TTL: https://www.rfc-editor.org/rfc/rfc1034#section-4.3.5
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - Libro SRE de Google, la cultura del postmortem: https://sre.google/sre-book/postmortem-culture/
    - restic, restaurar: https://restic.readthedocs.io/en/stable/050_restore.html
