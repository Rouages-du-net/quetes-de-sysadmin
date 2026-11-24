### Historia «El Café de Idiomas», capítulo «Un puerto y un booleano»:
### httpd solo puede escuchar en http_port_t y, por defecto, no puede
### conectarse a otros puertos. semanage port, setsebool -P, las sugerencias
### de audit2why, una regla enriquecida de firewalld. Los comandos, las
### opciones, las rutas, las etiquetas y las salidas no se traducen.

chapter-port-and-boolean = Un puerto y un booleano
    .summary = Unos turnos de voluntariado en su propio puerto, una aplicación de inscripción detrás de httpd, y desde el viernes todo el sitio está caído. SELinux le niega a httpd un puerto y una conexión: dale exactamente esas dos cosas, deja los turnos solo en la red del café, y asegúrate de que todo aguanta un reinicio.

## Archivos

port-and-boolean-message-dilnoza =
    De: Dilnoza
    Lunes 14 de diciembre, 18:40

    Hola otra vez:

    El sitio está caído desde el viernes por la tarde: la pantalla está en
    blanco y la gente pregunta si se han cancelado las mesas del jueves
    (¡no!).

    El viernes Tenzin añadió dos cosas, las dos para el voluntariado: una
    página de inscripción (https://signup.commontongue.example, para quien
    quiera echar una mano) y los turnos del voluntariado, en otro «puerto»,
    que solo deberían verse desde la propia red del café (los ordenadores
    del café y la pizarra). Luego reinició algo y tuvo que coger el tren;
    está en la montaña sin teléfono hasta el miércoles. Sus notas están en
    tu carpeta personal.

    Por favor, devuélvelo todo a su sitio, bien hecho, como le gustaría a
    Seun.

    Dilnoza

port-and-boolean-notes-tenzin =
    Notas de Tenzin (viernes 11 de diciembre, 17:55, con prisas)

    - signup: mi aplicación, /opt/signup, un servicio systemd
      (signup.service), escucha en 127.0.0.1:8086. httpd es su puerta de
      entrada: /etc/httpd/conf.d/signup.conf (ProxyPass).
    - Los turnos: /var/www/volunteers, en el puerto 8010:
      /etc/httpd/conf.d/volunteers.conf. Solo la red del café
      (198.51.100.0/24) debería verlos.
    - httpd -t dijo "Syntax OK", y luego systemctl restart httpd falló con
      algún «Permission denied» sobre un socket. ¡Esta vez no son los
      archivos!
    - Pasé audit2allow por el registro de auditoría y me escribió un módulo
      que lo permitiría todo (en mi carpeta: /home/tenzin/httpd-fix.te). No
      lo cargué: me pareció demasiado. ¿Hice bien?

## Eventos

port-and-boolean-event-down =
    httpd no ha podido arrancar: «make_sock: could not bind to address
    …:8010», (13) Permission denied. Nada más escucha ahí (ss -tlnp): el
    núcleo le ha negado ese puerto a httpd. ¿Qué parte del núcleo le niega
    un puerto a un programa? El registro de auditoría lo sabe.

port-and-boolean-event-bind-avc =
    { "{" } name_bind { "}" } sobre un tcp_socket, tcontext unreserved_port_t:
    httpd_t solo puede escuchar en los puertos que la política tipa como
    http_port_t (80, 443, 8008, 8009, 8443, 9000…: semanage port -l), y el
    8010 no es un puerto web para la política. A un puerto se le puede dar
    un tipo, igual que a un archivo una etiqueta.

port-and-boolean-event-nis =
    nis_enabled deja a todo programa que use NSS (casi todos los servicios)
    escuchar y conectarse en cualquier puerto no reservado: audit2why lo
    sugiere porque funcionaría, no porque sea lo adecuado. Apágalo (y
    apágalo con -P), y dale a httpd solo el puerto que necesita.

port-and-boolean-event-module =
    Hay cargado un módulo de audit2allow: httpd_t ahora puede escuchar y
    conectarse en todos los puertos no reservados, mucho más que el 8010 y
    el 8086. Tenzin hizo bien en no cargarlo: quítalo (semodule -r) y usa
    los medios de la propia política, un tipo de puerto y un booleano.

port-and-boolean-event-port =
    El 8010 ya es un puerto web para la política (semanage port -l | grep
    http). httpd leyó su configuración la última vez que intentó arrancar:
    arráncalo otra vez.

port-and-boolean-event-up =
    httpd ha vuelto, y con él el sitio del café. Ahora las dos cosas nuevas:
    la página de inscripción (curl con su nombre: -H 'Host:
    signup.commontongue.example') y los turnos en el 8010 (desde la
    pizarra).

port-and-boolean-event-proxy-503 =
    503 para la página de inscripción: httpd no ha podido llegar a la
    aplicación que tiene detrás (AH01114 en su registro de errores). La
    aplicación está en marcha (systemctl status signup, curl 127.0.0.1:8086
    en tetera responde): ¿quién le ha negado la conexión a httpd?

port-and-boolean-event-connect-avc =
    { "{" } name_connect { "}" }: se ha rechazado que httpd_t se conecte al
    puerto 8086. Por defecto httpd no puede conectarse a ningún otro puerto;
    la política ofrece un booleano para un proxy inverso. audit2why lo
    nombra (y otro más, demasiado amplio: lee las descripciones).

port-and-boolean-event-label-8086 =
    El 8086 ya es http_port_t, pero httpd sigue sin poder conectarse a él:
    por defecto httpd_t no puede conectarse a ningún puerto, ni siquiera a
    un puerto web (solo con httpd_can_network_relay o
    httpd_graceful_shutdown, los dos apagados). Tipar los puertos sirve para
    escuchar; conectarse es cosa de un booleano.

port-and-boolean-event-boolean-runtime =
    httpd_can_network_connect está activado, hasta el próximo reinicio:
    setsebool sin -P solo cambia la política en ejecución. En el próximo
    arranque, la página de inscripción volvería a responder 503.

port-and-boolean-event-boolean =
    httpd_can_network_connect está activado, ahora y en el próximo arranque:
    httpd puede conectarse a su backend. Comprueba la página de inscripción.

port-and-boolean-event-open-to-all =
    El puerto 8010 está abierto a todo el mundo: los turnos, con los nombres
    y los horarios del voluntariado, están en internet. Solo la red del café
    (198.51.100.0/24) debería llegar a ellos: las reglas enriquecidas de
    firewalld pueden decir «solo desde este origen» (man firewall-cmd, y
    firewalld.richlanguage).

port-and-boolean-event-rota-office =
    Los turnos son accesibles desde la red del café y solo desde ahí.
    Mantén la regla tanto en ejecución como en la configuración permanente.

port-and-boolean-event-end =
    Dilnoza: «La pantalla muestra las mesas, Hamza se ha apuntado para el
    jueves, y los turnos vuelven a salir en el ordenador del café. Tenzin se
    va a quedar tranquilo.»

    ¡Bien hecho! Has terminado el capítulo «Un puerto y un booleano».

    QUÉ HA PASADO
    El nuevo host virtual de Tenzin escuchaba en el 8010, un puerto que
    SELinux no tipa para la web (unreserved_port_t): a httpd_t se le negó
    name_bind, y un httpd que no puede abrir uno de sus sockets no arranca
    en absoluto. Diste al 8010 el tipo http_port_t (semanage port -a), así
    que httpd arranca. Detrás de la página de inscripción, httpd tiene que
    conectarse a la aplicación en 127.0.0.1:8086, cosa que httpd_t no puede
    hacer por defecto: httpd_can_network_connect, puesto con -P, lo permite
    para siempre. Y una regla enriquecida deja que solo la red del café
    llegue a los turnos.

    BUENA PRÁCTICA
    - Un servicio que no puede escuchar en un puerto con «Permission
      denied», sin nada más escuchando: busca un AVC (name_bind), y luego
      semanage port -a -t con el tipo que su dominio puede usar
      (http_port_t para httpd).
    - Un proxy inverso que responde 503: name_connect. La política tiene
      booleanos para las necesidades habituales (getsebool -a | grep httpd);
      ponlos con -P, o desaparecen en el próximo arranque.
    - Lee las sugerencias de audit2why: nis_enabled funciona, y abre todos
      los puertos no reservados a todos los servicios que usan NSS. Elige la
      más estrecha.
    - audit2allow -M escribe lo que se rechazó, tan ampliamente como se
      rechazó: es el último recurso, después de las etiquetas, los tipos de
      puerto y los booleanos; lee el archivo .te antes de cualquier
      semodule -i.
    - Una regla enriquecida (dirección de origen, puerto, accept) mantiene
      un servicio en una sola red; firewall-cmd --add-port lo abre a todos.

    DOCUMENTACIÓN
    - RHEL 10, Using SELinux, non-standard configurations: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/configuring-selinux-for-applications-and-services-with-non-standard-configurations_using-selinux
    - semanage-port(8): https://man7.org/linux/man-pages/man8/semanage-port.8.html
    - setsebool(8): https://man7.org/linux/man-pages/man8/setsebool.8.html
    - firewalld rich language: https://firewalld.org/documentation/man-pages/firewalld.richlanguage.html
    - Apache, reverse proxy guide: https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html
