### Historia «El Otro Unix», capítulo «Aquí no hay systemd»: instalar y
### arrancar un servicio a la manera de FreeBSD (pkg, rc.conf, service, sysrc,
### sockstat). Los comandos, opciones, rutas y mensajes no se traducen.

chapter-rc-services = Aquí no hay systemd
    .summary = La programación tiene que estar en línea esta noche: instala nginx con pkg, actívalo en rc.conf, arráncalo con service y comprueba quién escucha.

## Files

rc-services-message-romy =
    De:    Romy
    Para:  tú

    ¡Esta noche es la proyección mensual y la programación todavía no está
    en línea! Según las notas de Lucien, el sitio lo servía nginx, pero ya
    no hay nginx en el servidor (lo reinstalamos la primavera pasada y nadie
    rehízo la parte web). ¿Puedes volver a ponerlo antes de las 20:00? El
    sitio en sí sigue en /usr/local/www/club.

    Romy

rc-services-notes-lucien =
    Notas de Lucien (2024)
    - nginx desde los paquetes; su configuración en /usr/local/etc/nginx.
    - Todo lo que arranca al inicio está en /etc/rc.conf.
    - Ni systemd ni apt. man es tu amigo.

## Events

rc-services-event-no-systemd =
    No encontrado: FreeBSD no tiene ni systemd ni apt. Los paquetes vienen
    de pkg (man pkg), y los servicios son scripts rc, que se manejan con
    service (man service).
rc-services-event-ps-ef =
    ps -ef, en FreeBSD, no es «todos los procesos, formato completo»: -e
    muestra el entorno de cada proceso (esos HOME=, PATH=…), y sin a ni x,
    ps solo lista tus propios procesos asociados a una terminal. A la
    manera de BSD: ps aux (o ps -ax), y ps -axj para los padres. man ps, en
    esta máquina.
rc-services-event-installed =
    nginx está instalado, bajo /usr/local: su configuración en
    /usr/local/etc/nginx, su script rc en /usr/local/etc/rc.d/nginx.
    Instalado no quiere decir en marcha, ni arrancado al inicio.
rc-services-event-not-enabled =
    «Cannot 'start' nginx»: en FreeBSD, un servicio solo arranca si
    /etc/rc.conf lo activa (nginx_enable="YES"). El mensaje incluso nombra
    la variable. sysrc la escribe sin abrir un editor (man sysrc).
rc-services-event-onestart =
    nginx está en marcha… pero con onestart, no porque lo diga rc.conf: en
    el próximo reinicio no volverá. El sitio desaparecería una noche sin que
    nadie hubiera tocado nada.
rc-services-event-enabled =
    nginx_enable="YES" está en rc.conf: nginx arrancará en cada inicio.
rc-services-event-end =
    Romy: «¡La programación está en línea! Yanis lo ha comprobado desde
    casa, funciona.»

    ¡Bien hecho! Has terminado el capítulo «Aquí no hay systemd».

    QUÉ HA PASADO
    nginx ya no estaba instalado. pkg lo instaló bajo /usr/local, rc.conf
    lo activa ahora al inicio (nginx_enable="YES") y service lo arrancó;
    sockstat lo muestra escuchando en el puerto 80.

    BUENA PRÁCTICA
    - En FreeBSD, un servicio se ejecuta porque /etc/rc.conf lo dice: una
      línea por servicio, NOMBRE_enable="YES", el equivalente de systemctl
      enable.
    - sysrc edita rc.conf sin arriesgarse a una errata en el resto del
      archivo.
    - Los paquetes viven bajo /usr/local: su configuración está en
      /usr/local/etc, no en /etc.
    - Lee lo que pkg muestra tras instalar: los paquetes dejan ahí mensajes
      útiles.

    OTRA MANERA
    service nginx enable escribe la misma línea de rc.conf (FreeBSD 12 y
    posteriores). Los ports (/usr/ports) compilan el mismo software desde
    el código fuente, eligiendo tus opciones: más lento, más flexible. Las
    jails pueden aislar un servicio en su propio pequeño sistema en la
    misma máquina.

    DOCUMENTACIÓN
    - El Handbook, paquetes: https://docs.freebsd.org/en/books/handbook/ports/#pkgng-intro
    - El Handbook, arrancar servicios: https://docs.freebsd.org/en/books/handbook/config/#configtuning-starting-services
    - rc.conf(5): https://man.freebsd.org/cgi/man.cgi?query=rc.conf
    - sysrc(8): https://man.freebsd.org/cgi/man.cgi?query=sysrc
