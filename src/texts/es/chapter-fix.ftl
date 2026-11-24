### Historia «La Vigilancia», capítulo «La corrección»: corregir nginx y
### rsync sin romper nada. Los comandos, las rutas y la salida de apt no se
### traducen.

chapter-fix = La corrección
    .summary = Corregir nginx y rsync sin romper nada: apt update antes de apt upgrade, y luego comprobar que el sitio sigue respondiendo.

## Archivos

fix-email-salome =
    De:      Salomé
    Para:    tú
    Asunto:  Llega la hora de corregir

    El orden está decidido: nginx, y luego rsync. Los dos tienen ya una
    corrección de Debian publicada, así que aquí no hace falta ningún apaño
    provisional: basta con una actualización (man apt).

    Un reflejo que no hay que saltarse nunca: refresca la lista de paquetes
    antes de pedir una actualización. Sin eso, apt no sabe que existe una
    corrección.

    Y después de corregir: comprueba que el sitio sigue respondiendo.
    Corregir un fallo tumbando el sitio sería un extraño favor para Nadia.

    Salomé
    (Para sudo, tu contraseña sigue siendo: masamadre-2028)

## Eventos

fix-event-without-update =
    apt upgrade dice «Upgrading: 0»: no ha pasado nada. apt solo conoce las
    actualizaciones disponibles después de refrescar su lista de paquetes
    (sudo apt update), como un catálogo que hay que recargar antes de poder
    buscar algo nuevo en él.
fix-event-fixed =
    nginx y rsync están en la versión corregida. Una cosa más que comprobar
    antes de seguir: ¿el sitio sigue respondiendo?
fix-event-checked =
    El sitio responde (curl devuelve 200): la actualización no ha roto nada.
fix-event-end =
    Salomé: «Dos corregidos, y el sitio sigue en pie. Es todo lo que se le
    pide a una actualización».

    ¡Bien hecho! Has terminado el capítulo «La corrección».

    QUÉ HA PASADO
    Las correcciones de Debian para los dos CVE retenidos están ya
    instaladas. apt upgrade instala todas las actualizaciones disponibles de
    una vez (no una por una), después de refrescar la lista de paquetes; por
    eso sudo apt update va siempre primero.

    BUENA PRÁCTICA
    - sudo apt update antes de cualquier actualización: sin eso, apt trabaja
      con una lista desfasada y no encuentra nada.
    - Comprueba después que lo que debe funcionar sigue funcionando (aquí
      basta un simple curl): corregir un fallo no debe crear otro, ni tumbar
      un servicio.
    - Cuando todavía no existe corrección (el caso de openssh-server en el
      boletín), el boletín suele documentar una mitigación provisional: para
      aplicar mientras se espera, no en lugar de una vigilancia de verdad.

    OTRA MANERA
    unattended-upgrades (que ya viste en «Las actualizaciones automáticas»,
    en la Cooperativa) puede aplicar este tipo de corrección de seguridad
    por sí solo, sin esperar a que alguien lea el boletín — que es
    justamente el tema del último capítulo de esta historia.

    DOCUMENTACIÓN
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
