### Historia «El Centro de Datos», capítulo «La noche del reinicio»:
### servicios de systemd. El servidor se reinició anoche y el sitio web
### cayó. Los comandos, los nombres de servicios, las rutas y los mensajes
### de systemd o php-fpm (en inglés) nunca se traducen.

chapter-reboot-night = La noche del reinicio
    .summary = Servicios que no vuelven: systemctl, journalctl, enable, y comprobar tras un reinicio.

## Archivos

reboot-night-email-awa =
    De:      Awa (responsable de operaciones)
    Para:    tú
    Asunto:  El sitio web cayó anoche

    Anoche a las 3:12, el servidor se reinició solo: las actualizaciones
    automáticas habían instalado un kernel nuevo. Desde entonces, el sitio
    web de la mediateca ya no responde.

    1. Averigua qué servicios no están en marcha, y por qué. El diario
       de systemd lo sabe todo.
    2. Arréglalos.
    3. Lo más importante: asegúrate de que todo volverá SOLO en el
       próximo reinicio. La única manera de estar seguro: reiniciar
       (sudo reboot) y luego comprobar. Se te desconectará durante el
       reinicio: vuelve a conectarte con ssh datacenter.

    Mis notas están en ~/notes_awa.txt. La contraseña de sudo no ha
    cambiado.
reboot-night-notes-awa =
    NOTAS DE AWA — CUANDO UN SERVICIO NO ARRANCA

      systemctl --failed           los servicios que han fallado
      systemctl status nombre      el estado de un servicio y sus últimos mensajes
      journalctl -u nombre         todos los mensajes de un servicio
      journalctl -xeu nombre       la fórmula clásica: el final, con explicaciones

    Lee el PRIMER error: los siguientes suelen ser solo su
    consecuencia.

    Ojo: «active» (está en marcha ahora) y «enabled» (arranca
    con la máquina) son dos cosas distintas. Todo está en
    man systemctl.

## Eventos

# { $logs }: la carpeta de registros del catálogo
reboot-night-event-logs-open =
    Cuidado: ahora cualquier cuenta puede escribir en { $logs },
    y por tanto borrar los registros… o colar mensajes falsos para borrar
    huellas. Una carpeta de registros debe pertenecer a la cuenta del
    servicio que escribe en ella, sin permiso de escritura para los demás.
reboot-night-event-nginx =
    nginx está en marcha: el sitio web vuelve a responder… por ahora.

    Mira bien la línea Loaded de systemctl status nginx: «disabled».
    ¿Qué pasará en el próximo reinicio?
reboot-night-event-nginx-active =
    nginx está en marcha, y está habilitado: volverá solo en el
    próximo arranque de la máquina.
reboot-night-event-catalogue =
    El catálogo arranca: php-fpm, que funciona con la cuenta www-data,
    puede volver a escribir su registro. Las búsquedas del sitio vuelven
    a funcionar.
reboot-night-event-forgotten =
    La máquina se ha reiniciado… y nginx no está en marcha: el sitio vuelve
    a estar caído. systemctl start solo dura hasta el próximo arranque.
    Para que un servicio arranque con la máquina, vuelve a leer
    man systemctl.
reboot-night-event-end =
    Tras el reinicio, todo ha vuelto solo: nginx y el catálogo están en
    marcha, y lo has comprobado. Awa: «Eso es exactamente el oficio:
    no solo arreglar, sino asegurarse de que aguantará».

    ¡Bien hecho! Has terminado el capítulo 3 de El Centro de Datos.
    (Lo siguiente: El gran incendio. Vuelve más tarde con ssh datacenter.)

    QUÉ HA PASADO
    El reinicio de anoche reveló dos problemas escondidos desde el
    viernes: nginx se había deshabilitado (disable) durante una prueba, y
    un «chown -R root:» había dado a root la carpeta donde php-fpm, que
    funciona como www-data, escribe su registro. Mientras la máquina
    siguió en marcha, no se notó nada.

    BUENA PRÁCTICA
    - Después de cada reinicio: systemctl --failed.
    - Un servicio se niega a arrancar: journalctl -xeu nombre, y lee el
      primer error.
    - start (ahora) no es enable (en cada arranque);
      enable --now hace las dos cosas.
    - La carpeta de un servicio pertenece a la cuenta del servicio, nunca 777.
    - Un servidor que nunca se ha reiniciado es un servidor del que no
      sabes si volverá a arrancar: prueba un reinicio en horas valle.

    DOCUMENTACIÓN
    - systemctl: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
