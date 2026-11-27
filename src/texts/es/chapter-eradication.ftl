### Historia «El Bastión», capítulo «La erradicación»: quitar los caminos de
### vuelta que dejó el intruso (crontab, clave, archivos) sin llevarse lo
### legítimo, encontrar lo que se cambió, y restaurarlo desde una versión
### cuya firma se ha comprobado. Los comandos, las rutas, las claves y las
### huellas no se traducen.

chapter-eradication = La erradicación
    .summary = Quitar los caminos de vuelta que dejó el intruso, encontrar lo que se cambió, y restaurarlo desde una versión firmada que hayas comprobado.

## Archivos

# { $fingerprint }: Selma's ssh key fingerprint
eradication-email-selma =
    De:      Selma
    Para:    tú
    Asunto:  Re: cuenta deploy

    Nadia me ha llamado. Lo siento, la contraseña tenía que ser temporal,
    solo para mis primeros despliegues en marzo. Mi clave es la única que
    debería estar en deploy; su huella es:

        { $fingerprint }

    El crontab tiene una tarea mía, sync-orders, cada cuarto de hora:
    consérvala, por ella pasan los pedidos de la tienda.

    Mis versiones están firmadas con mi clave gpg (ya está en el llavero del
    servidor, gpg --list-keys). La versión 2.3.1 está en /srv/releases, con
    su firma. No te fíes de nada más.

    Selma

eradication-incident =
    # Incidente — horno (reparto)

    ## Contenido (14/04, 9:30)
    Pool y 203.0.113.66 bloqueados (iptables), minero y vigilante parados,
    deploy caducada.

    ## Por hacer
    - ¿Qué dejó para volver? (crontab, claves, archivos)
    - ¿Qué cambió? La aplicación relanzaba el minero al arrancar.
    - El historial de deploy (/home/deploy/.bash_history) puede decir mucho.

## Eventos

# { $line }: Selma's job
eradication-event-cron-all =
    La tarea de Selma ha desaparecido del crontab de deploy ({ $line }): los
    pedidos de la tienda ya no se sincronizarán. Vuelve a ponerla (crontab
    -u deploy -e).
# { $line }: the line removed
eradication-event-cron =
    La línea @reboot ha desaparecido ({ $line }): en el próximo arranque,
    nada relanzará el vigilante. Y la tarea de Selma sigue ahí.
eradication-event-key-all =
    La clave de Selma también ha desaparecido: ya no podrá desplegar. Solo
    había que quitar la clave del intruso: compara las huellas
    (ssh-keygen -lf) con la de su correo.
eradication-event-key =
    La clave del intruso está quitada, la de Selma se conserva. Las dos
    decían selma@studio: un comentario es texto libre, solo la huella las
    distinguía.
eradication-event-files =
    El minero y su vigilante han desaparecido de /tmp/.cache.
eradication-event-bad-signature =
    Firma INCORRECTA (BAD): este archivo no es el que firmó Selma. Su
    contenido se cambió después de la firma: es la copia que reconstruyó el
    intruso, con su línea dentro. No restaures desde ella.
eradication-event-verified =
    Firma correcta, de la clave de Selma: este archivo es exactamente el que
    ella publicó. Puedes restaurar desde él.
eradication-event-restored =
    server.js vuelve a ser idéntico a la versión: la línea añadida ha
    desaparecido.
eradication-event-unverified =
    server.js vuelve a parecerse a la versión, pero nada lo prueba: el
    intruso pudo cambiar más de una línea. Comprueba la firma de la versión
    de Selma (gpg --verify) antes de fiarte.
eradication-event-relaunched =
    La aplicación ha vuelto a arrancar, y con ella el vigilante y el minero:
    server.js todavía los relanza, y su script sigue ahí. Páralos, y luego
    ocúpate de la causa.
eradication-event-end =
    Selma: «Gracias. Voy a cambiar mis costumbres: se acabaron las
    contraseñas, aunque sea "solo para una semana"».

    ¡Bien hecho! Has terminado el capítulo «La erradicación».

    QUÉ HA PASADO
    El intruso había dejado tres caminos de vuelta: una línea de crontab en
    cada arranque, su propia clave en el authorized_keys de deploy, y una
    línea en la aplicación que relanzaba el minero en cada arranque. Quitaste
    cada uno sin llevarte lo legítimo con él, y restauraste la aplicación
    desde una versión cuya firma comprobaste antes, no desde la copia que
    había al lado.

    BUENA PRÁCTICA
    - Busca la persistencia en todos los sitios donde una cuenta puede
      escribir: su crontab, sus claves, sus archivos, lo que ejecutan sus
      servicios. El historial de deploy decía mucho, pero un intruso puede
      borrarlo: no te fíes solo de él.
    - Quita línea a línea: crontab -r o vaciar authorized_keys se lleva lo
      legítimo con el resto.
    - Restaura desde una fuente de confianza que puedas comprobar (una
      versión firmada, una copia de seguridad anterior a la intrusión),
      nunca desde una copia que el intruso haya podido tocar.

    OTRA MANERA
    Si hay dudas sobre qué más se cambió, reinstala: un servidor nuevo
    construido a partir de fuentes conocidas (paquetes, versión firmada,
    copia de seguridad de los datos), y luego los datos comprobados antes de
    volver a ponerlos. Es más largo, pero es la única manera de estar
    seguro. Aquí, el intruso nunca tuvo root, lo que hacía razonable una
    limpieza selectiva.

    DOCUMENTACIÓN
    - crontab: https://man7.org/linux/man-pages/man5/crontab.5.html
    - ssh-keygen (-l): https://man.openbsd.org/ssh-keygen
    - gpg --verify: https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html
    - NIST SP 800-61r2, erradicación y recuperación: https://csrc.nist.gov/pubs/sp/800/61/r2/final
