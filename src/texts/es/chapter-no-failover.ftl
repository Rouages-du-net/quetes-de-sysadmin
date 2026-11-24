### Historia «La Donación de Sangre», capítulo «La conmutación que no
### ocurrió»: haproxy murió en lb1 pero keepalived mantuvo allí la dirección
### virtual. keepalived.conf, vrrp_script, track_script, weight, nopreempt,
### systemctl reload, ip a, journalctl. Los comandos, las opciones, las
### rutas y las salidas no se traducen.

chapter-no-failover = La conmutación que no ocurrió
    .summary = Dos balanceadores de carga, una dirección virtual, y aun así el sitio de citas de los donantes está caído desde el amanecer. Averigua por qué el de reserva no tomó el relevo, enseña a keepalived lo que debe vigilar y demuestra que la conmutación funciona de verdad.

## Archivos

no-failover-message-zainab =
    De: Zainab (atención a donantes)
    Lunes 13 de mayo, 7:40

    ¡Buenos días, y bienvenida o bienvenido al Servicio de Sangre de
    Lindenvale!

    Nuestros donantes piden cita en donate.lindenvale.example, y desde las
    siete de esta mañana más o menos nadie puede: la página ni siquiera
    carga. El lunes por la mañana es nuestro momento de más trabajo, y las
    reservas de plaquetas están bajas.

    Bastien siempre nos dijo que el sitio no podía caerse: hay dos
    balanceadores de carga, lb1 y lb2, «y si uno muere, el otro toma el
    relevo en un segundo». Está claro que algo falla. Se fue en marzo;
    sus notas están en tu carpeta personal.

    Estás en lb1; puedes llegar a lb2 y a los servidores web (web1, web2,
    web3) con ssh desde aquí, y sudo funciona con tu contraseña.

    Por favor, recupera las citas, y asegúrate de que esto no pueda
    volver a pasar.

    Zainab

no-failover-note-bastien =
    Notas de Bastien (balanceadores de carga)

    - lb1 (192.0.2.104) y lb2 (192.0.2.105) comparten 192.0.2.108, la
      dirección a la que apunta donate.lindenvale.example. keepalived
      (VRRP) la pone en el maestro; lb1 es el maestro, lb2 el de reserva.
      /etc/keepalived/keepalived.conf en cada uno.
    - Detrás de la dirección, HAProxy en cada balanceador envía las
      peticiones a web1, web2 y web3 (/etc/haproxy/haproxy.cfg, el mismo
      archivo en los dos).
    - Si lb1 muere, lb2 toma la dirección en tres o cuatro segundos. Lo
      probé en 2029 desenchufando el cable de alimentación de lb1.
      Funciona de maravilla.
    - ip a muestra quién tiene la dirección. journalctl -u keepalived dice
      por qué.

    Bastien

## Eventos

no-failover-event-haproxy-dead =
    haproxy está muerto en lb1: su worker abortó a las 6:58, systemd lo
    reinició cuatro veces, y tras cinco fallos en diez segundos se rindió
    («Start request repeated too quickly»). Entonces, ¿por qué no tomó
    lb2 el relevo? Mira quién tiene 192.0.2.108.
no-failover-event-vip-on-lb1 =
    lb1 sigue teniendo 192.0.2.108 (la dirección «secondary» en eth0), y
    lb1 no tiene haproxy: las peticiones de los donantes llegan a una
    máquina donde nada escucha en el puerto 80. Compara con lb2 (ssh lb2),
    y luego lee el keepalived.conf de lb1: ¿qué vigila keepalived?
no-failover-event-no-tracking =
    keepalived solo vigila a keepalived. La prueba de Bastien
    (desenchufar el cable) funcionó porque toda la máquina se calló; pero
    aquí lb1 está vivo y sigue enviando sus anuncios VRRP, así que lb2 no
    tiene ningún motivo para tomar el relevo. keepalived tiene que saber
    de haproxy: un vrrp_script que lo compruebe, y un track_script en la
    instancia (man keepalived.conf).
no-failover-event-restart-only =
    haproxy vuelve a funcionar en lb1 y los donantes pueden pedir cita.
    Pero en el diseño no ha cambiado nada: la próxima vez que muera
    haproxy, la dirección volverá a quedarse en lb1, y el sitio se caerá
    con un lb2 perfectamente sano al lado. Enseña a keepalived a vigilar
    haproxy.
no-failover-event-both-master =
    «state MASTER» en los dos nodos con la misma prioridad no hace dos
    maestros, ni una conmutación mejor: el estado solo es donde arranca
    una instancia. La elección usa la prioridad, y un empate se lo lleva
    la dirección más alta. Y sigue sin decir nada de haproxy.
no-failover-event-edited-not-loaded =
    El archivo tiene un track_script, pero el keepalived en marcha sigue
    usando la configuración que leyó al arrancar: recárgalo (systemctl
    reload keepalived) para que la vuelva a leer.
no-failover-event-tracking =
    El keepalived de lb1 ejecuta ahora tu comprobación. Con haproxy
    muerto, la comprobación falla: mira journalctl -u keepalived en lb1
    («VRRP_Script(…) failed», luego la prioridad o el estado FAULT), e ip
    a en los dos nodos.
no-failover-event-stuck =
    La comprobación de lb1 falla, su prioridad ha bajado, pero sigue
    siendo el maestro: lb2 oye los anuncios de lb1 con una prioridad más
    baja y no toma el relevo. ¿Tiene lb2 permiso para adelantarse? Con
    nopreempt, un nodo de reserva nunca le quita la dirección a un
    maestro que sigue anunciándose, sea cual sea su prioridad. O deja que
    lb2 se adelante, o da a la comprobación un peso de 0 (una
    comprobación fallida pone el nodo en FAULT: deja de anunciarse).
no-failover-event-failed-over =
    La dirección se ha movido: lb2 tiene 192.0.2.108 y su haproxy atiende
    a los donantes (mira curl sobre el sitio, y el /var/log/haproxy.log de
    lb2). Esa es la conmutación que el diseño debería haber hecho a las
    6:58. Ahora vuelve a poner haproxy en marcha en lb1.
no-failover-event-haproxy-back-preempt =
    haproxy vuelve a funcionar en lb1, su comprobación tiene éxito, su
    prioridad vuelve a estar por encima de la de lb2, y lb1 ha recuperado
    la dirección (la preferencia, por defecto). Un segundo cambio, unas
    cuantas conexiones perdidas: hay quien prefiere nopreempt (state
    BACKUP en los dos) para que la dirección se quede donde está hasta el
    próximo fallo. Las dos opciones son válidas; elige con conocimiento.
no-failover-event-haproxy-back-stays =
    haproxy vuelve a funcionar en lb1, pero la dirección se queda en lb2
    (nopreempt): sin segundo cambio, sin conexiones perdidas para nada. Se
    volverá a mover en el próximo fallo. Las dos opciones son válidas;
    elige con conocimiento.
no-failover-event-lb2-tracked =
    lb2 también vigila su propio haproxy: una conmutación funciona en los
    dos sentidos, sea cual sea el nodo maestro.
no-failover-event-end =
    Zainab: «Las citas llegan a raudales, y Teodor dice que los donantes
    de la mañana ya han recibido sus correos de confirmación. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «La conmutación que no
    ocurrió».

    QUÉ HA PASADO
    haproxy murió en lb1 a las 6:58 (un fallo que systemd no pudo
    reiniciar). lb1 en sí estaba bien, y keepalived solo vigila si su
    compañero está vivo: lb1 siguió anunciándose, lb2 siguió esperando, y
    la dirección se quedó en una máquina que no servía nada. Diste a
    keepalived un vrrp_script que comprueba haproxy, seguido por la
    instancia en los dos nodos, lo recargaste, viste la dirección pasar a
    lb2, volviste a poner haproxy en marcha en lb1, y comprobaste que todo
    funciona.

    BUENA PRÁCTICA
    - La redundancia cubre lo que se vigila. Una pareja VRRP solo sabe que
      el otro nodo está vivo: dile a keepalived lo que necesita el
      servicio (vrrp_script, track_script).
    - El peso tiene que cambiar el resultado: la prioridad del maestro que
      falla tiene que caer por debajo de la del de reserva (101 - 20 <
      100), o usa el peso 0 (FAULT).
    - nopreempt en un nodo de reserva y una comprobación con peso no van
      juntos: a un maestro que sigue anunciándose nunca se le adelanta
      nadie.
    - Prueba el fallo que temes (el servicio que se para), no solo el que
      es fácil de simular (un cable de alimentación).
    - Reiniciar el servicio arregla el hoy; el diseño arregla la próxima
      vez.

    DOCUMENTACIÓN
    - keepalived.conf(5): https://www.keepalived.org/manpage.html
    - La documentación de keepalived: https://keepalived.readthedocs.io/en/latest/
    - VRRP (RFC 3768): https://www.rfc-editor.org/rfc/rfc3768
