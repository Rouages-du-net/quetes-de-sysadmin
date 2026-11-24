### Historia «Las Bicis Compartidas», capítulo «Horas tranquilas»: el
### encaminamiento, la agrupación y el intervalo de repetición del
### Alertmanager, y un silencio para un mantenimiento previsto. amtool,
### alertmanager.yml, el registro del relé. Los comandos, opciones,
### etiquetas, rutas y salidas no se traducen.

chapter-quiet-hours = Horas tranquilas
    .summary = Las alertas llegan al chat, pero a quien no debe, una y otra vez, y un mantenimiento previsto está a punto de despertar a quien esté de guardia para nada. Encamina las alertas, cálmalas y silencia lo que ya sabes, sin silenciarlo todo.

## Files

quiet-hours-message-ngozi =
    De: Ngozi (cooperativa de bicis compartidas)
    Sábado 19 de mayo, 9:35

    Hola:

    Dos cosas, y una es urgente.

    1. Las alertas llegan al chat (el relé de medidor publica lo que le
       envía el Alertmanager: /var/log/alert-relay/relay.log), pero mal.
       #team recibe el mismo aviso sobre el disco de sillin cada cinco
       minutos (Tomás lo limpiará el lunes, puede esperar). Y el martes por
       la noche sillin se cayó cuatro minutos: la alerta fue a #team, y
       nadie de guardia recibió el aviso. Los page van a #on-call, los
       warning a #team, y no más de una vez por hora, por favor.

    2. A las 10:00 cambio el disco de buje. Estará caído hasta las 11:30
       más o menos. No quiero que despierten a quien esté de guardia por
       algo que ya sabemos. ¡Pero sí quiero saber si mientras tanto se
       rompe sillin o cualquier otra cosa!

    amtool está instalado (lee /etc/amtool/config.yml).

    Ngozi

## Events

quiet-hours-event-repeats =
    El mismo aviso, cada cinco minutos: repeat_interval: 1m en
    /etc/prometheus/alertmanager.yml. El Alertmanager vuelve a enviar una
    alerta activa tras repeat_interval (4h por defecto), pero solo mira un
    grupo cada group_interval (aquí 5m): esa es la máxima frecuencia a la
    que puede repetir. group_by decide qué va junto.
quiet-hours-event-routes =
    El árbol de encaminamiento: bajo la ruta por defecto, una sola ruta,
    para severity="critical". Tus reglas dicen page o warning: critical no
    coincide con nada, así que todo cae en el receptor por defecto, team.
    (amtool config routes test severity=page muestra adónde iría una
    alerta.)
quiet-hours-event-am-invalid =
    amtool rechaza el archivo, y dice por qué. El Alertmanager también lo
    rechazaría, y conservaría su configuración anterior.
quiet-hours-event-am-check =
    amtool check-config: el archivo es válido. El Alertmanager sigue con la
    configuración que leyó antes, hasta que vuelva a leer el archivo.
quiet-hours-event-am-not-reloaded =
    El archivo es correcto, pero el Alertmanager no lo ha vuelto a leer:
    sudo systemctl reload prometheus-alertmanager (o un POST a /-/reload).
quiet-hours-event-am-bad-reload =
    La recarga ha fallado: el Alertmanager conserva su configuración
    anterior, y su registro dice por qué (sudo journalctl -u
    prometheus-alertmanager -n 20).
quiet-hours-event-routing =
    El encaminamiento funciona: un page va a on-call, un warning a team.
quiet-hours-event-repeat-interval =
    No más de un recordatorio por hora: el canal puede respirar. Una alerta
    resuelta se sigue anunciando (send_resolved, true por defecto para un
    webhook).
quiet-hours-event-stopped =
    Prometheus o el Alertmanager están parados: no se notará nada, ni
    durante el mantenimiento ni después, y sillin podría caerse sin que
    nadie lo viera. Ngozi pidió lo contrario. Vuelve a arrancarlo, y
    silencia solo lo que ya sabes.
quiet-hours-event-rule-removed =
    La regla NodeDown ha desaparecido: el mantenimiento de buje no
    avisará, pero tampoco la próxima caída de sillin, ni buje si no vuelve
    a las 11:30. Un silencio es para un tiempo conocido y limitado; quitar
    una regla es para siempre.
quiet-hours-event-too-broad =
    Este silencio cubre también las alertas de otras máquinas (o todos los
    page): si sillin se cae durante el mantenimiento, nadie lo sabrá.
    Restríngelo a buje (su instance), y haz caducar el amplio (amtool
    silence expire con su ID).
quiet-hours-event-too-short =
    Este silencio no cubre todo el mantenimiento, de 10:00 a 11:30: empieza
    demasiado tarde, o su final despertaría a alguien. --duration cuenta
    desde ahora (o desde --start). Un silencio no se puede alargar, pero sí
    sustituir: añade uno nuevo, haz caducar el antiguo.
quiet-hours-event-silenced =
    Las alertas de buje están silenciadas durante el mantenimiento: el
    Alertmanager las sigue recibiendo (amtool alert query --silenced), pero
    no envía nada. El silencio termina solo.
quiet-hours-event-paged =
    Ha sonado el teléfono de guardia: el NodeDown de buje, durante un
    mantenimiento que todo el mundo conocía. Un silencio puesto de
    antemano lo habría callado.
quiet-hours-event-end =
    Ngozi: «Perfecto. Bajo al sótano con el disco nuevo. Si sillin
    parpadea siquiera, me enteraré.» (Puedes ver pasar la mañana: sleep
    1800, luego amtool alert query --silenced.)

    ¡Bien hecho! Has terminado Horas tranquilas, y Las Bicis Compartidas.

    QUÉ HA PASADO
    Prometheus decide que una alerta salta; el Alertmanager decide quién se
    entera, con qué frecuencia, y cuándo no. Su única ruta coincidía con
    severity="critical", una etiqueta que ninguna regla ponía: todas las
    alertas caían en el receptor por defecto (#team), y repeat_interval: 1m
    las repetía en cada group_interval, cada cinco minutos. Corregiste el
    matcher (page va a on-call), pusiste un intervalo de repetición
    razonable, comprobaste el archivo (amtool check-config), recargaste y
    silenciaste buje durante su mantenimiento con amtool, sin tocar las
    reglas ni parar nada.

    BUENA PRÁCTICA
    - Encamina según las etiquetas que de verdad ponen las reglas; amtool
      config routes test muestra adónde va una alerta.
    - Agrupa lo que va junto (group_by), y repite en horas, no en minutos.
    - Un mantenimiento previsto es un silencio: matchers estrechos
      (instance=…), un inicio y un final que cubran la ventana con margen,
      un comentario, un autor. Nunca borres la regla, nunca pares la
      vigilancia.
    - La inhibición (inhibit_rules) puede callar las alertas de los
      servicios de una máquina mientras la propia máquina está caída.
    - Comprueba una configuración antes de recargarla (amtool
      check-config, promtool check config).

    DOCUMENTACIÓN
    - Alertmanager, route: https://prometheus.io/docs/alerting/latest/configuration/#route
    - Agrupación, inhibición, silencios: https://prometheus.io/docs/alerting/latest/alertmanager/
    - amtool: https://github.com/prometheus/alertmanager#amtool
