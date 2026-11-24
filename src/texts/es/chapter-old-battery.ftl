### Historia «El Rocódromo», capítulo «La batería vieja»: una batería
### gastada, su prueba rápida (upscmd, instcmds en upsd.users), la fecha de
### un cartucho nuevo (upsrw battery.mfr.date), alertas mediante upssched
### (NOTIFYCMD, AT … START-TIMER, CANCEL-TIMER). Los comandos, las opciones,
### las rutas, las líneas de configuración y las salidas no se traducen.

chapter-old-battery = La batería vieja
    .summary = Dos meses después de la tormenta, el SAI promete diez minutos de batería en lugar de cincuenta, y el buzón de recepción se ahoga en «UPS: ONBATT» cada vez que arrancan los ventiladores. Prueba la batería sin vaciarla, haz que pongan una nueva, y enseña a las alertas a distinguir un parpadeo de un corte de luz.

## Archivos

old-battery-message-thandiwe =
    De: Thandiwe (recepción, Overhang)
    Lunes 17 de enero, 10:20

    Buenos días:

    Dos cosas, y quizá sean una sola.

    1. Mi buzón. Cada vez que arrancan los ventiladores grandes de la sala
       de bloque, las luces parpadean y recibo dos correos: «UPS: ONBATT»,
       y luego «UPS: ONLINE». 38 solo el sábado. He empezado a ignorarlos,
       que seguro que no es la idea. ¿Podemos recibir un correo solo
       cuando de verdad se va la luz? (Van a «volunteers», que soy yo:
       /var/mail/thandiwe en seguro.)

    2. Ikaika ha leído esta mañana la pantalla del SAI: dice unos diez
       minutos de batería. En noviembre era casi una hora. Las notas de
       Haruto dicen que la batería es de 2028. Ikaika tiene un cartucho de
       repuesto en la oficina (un APC RBC, se puede cambiar con el SAI en
       marcha) pero quiere una prueba antes de abrir nada.

    El rocódromo está abierto (la clase de las 10:00 está en las paredes),
    así que nada que corte la corriente, ¡por favor! Haruto dejó una cuenta
    de administración en upsd.users para este tipo de cosas; su contraseña
    está en el archivo.

    Thandiwe

## Eventos

old-battery-event-runtime =
    battery.runtime está en segundos: diez minutos con la carga de hoy,
    para una batería que daba cincuenta en noviembre. ups.test.result dice
    cuándo se probó el SAI a sí mismo por última vez. Una prueba rápida
    (unos segundos en batería) dice el estado de la batería sin vaciarla:
    upscmd -l hallups lista lo que puede hacer el SAI.

old-battery-event-flapping =
    Otro par de correos en el buzón de Thandiwe: la línea ha parpadeado
    unos segundos, upsmon vio ONBATT y luego ONLINE, y NOTIFYCMD envió los
    dos. upsmon envía cada evento al instante; para esperar y ver si un
    evento dura, upsmon se lo pasa a upssched (man upssched).

old-battery-event-denied =
    upsd se ha negado: una orden instantánea necesita una cuenta que tenga
    permiso para ejecutarla. En upsd.users, instcmds lista las órdenes que
    puede ejecutar una cuenta (o ALL); actions = SET solo sirve para
    cambiar variables. upsd vuelve a leer upsd.users en una recarga.

old-battery-event-deep =
    Una prueba profunda es una calibración: el SAI alimenta el rocódromo
    con su batería hasta casi vaciarla. Con el rocódromo abierto y una
    batería gastada, un corte real durante la prueba no dejaría nada.
    Detenla (test.battery.stop) y guarda las pruebas profundas para las
    horas de cierre, con una batería sana.

old-battery-event-warning =
    «Done and warning», y ups.status muestra ahora RB: el SAI pide una
    batería nueva. Ikaika, encantado con su prueba, cambia el cartucho con
    el SAI en marcha («clic, clic: listo»). El nuevo está cargado al 92 %.
    El SAI todavía cree que su batería es de 2028 (battery.mfr.date): esa
    fecha se puede escribir en este modelo (upsrw -l hallups). La
    etiqueta del cartucho dice 2032/12/02.

old-battery-event-date =
    battery.mfr.date es la del cartucho nuevo: la próxima persona que lea
    upsc sabrá qué edad tiene la batería.

old-battery-event-passed =
    La prueba rápida pasa con la batería nueva: «Done and passed», RB ha
    desaparecido, battery.runtime vuelve a unos cincuenta minutos.

old-battery-event-sched-error =
    NOTIFYCMD es upssched, pero upssched.conf lo detiene: necesita
    CMDSCRIPT, PIPEFN y LOCKFN antes de su primera línea AT (journalctl -u
    nut-monitor: «must be set before any ATs»).

old-battery-event-silenced =
    Ahora ni siquiera un corte real enviaría un correo a nadie: las
    alertas se han silenciado en lugar de clasificarse. Un corte que dura
    tiene que seguir avisando a los voluntarios.

old-battery-event-still-flapping =
    Un parpadeo de unos segundos sigue enviando un correo: algo se ejecuta
    en cada ONBATT o en cada ONLINE. Un temporizador iniciado en ONBATT y
    cancelado en ONLINE solo salta si la corriente sigue sin volver (la
    orden opcional de CANCEL-TIMER solo se ejecuta cuando el temporizador
    ya había saltado).

old-battery-event-alerts =
    Las alertas están clasificadas: un parpadeo de unos segundos inicia el
    temporizador de upssched y ONLINE lo cancela, en silencio; un corte
    que dura lo deja saltar y envía un solo correo a los voluntarios.

old-battery-event-end =
    Thandiwe: «Ni un solo correo desde el mediodía, e Ikaika ha puesto el
    cartucho viejo en la caja de reciclaje con una sonrisa. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «La batería vieja».

    QUÉ HA PASADO
    La batería, de 2028 y vaciada del todo por el corte de noviembre,
    había perdido la mayor parte de su capacidad. Una prueba rápida
    (upscmd, una vez que la cuenta de administración tuvo instcmds en
    upsd.users) dio el veredicto del SAI, «Done and warning», y el
    indicador RB. Tras el cambio escribiste la fecha de la batería nueva
    con upsrw y volviste a probar. Mientras tanto, el NOTIFYCMD de upsmon
    enviaba un correo por cada parpadeo; con upssched, ONBATT inicia un
    temporizador que ONLINE cancela, así que solo un corte que dura envía
    correo.

    BUENA PRÁCTICA
    - Prueba la batería con regularidad con la prueba rápida, en horas
      tranquilas: dice el estado de la batería en segundos. Guarda las
      pruebas profundas (calibración) para las horas de cierre, con una
      batería sana.
    - Las baterías de plomo de los SAI duran de tres a cinco años, menos
      tras descargas profundas: escribe la fecha cuando cambies una
      (battery.mfr.date o battery.date, donde el SAI lo permita), y
      planifica la siguiente.
    - Da a las cuentas solo lo que necesitan: instcmds para las pruebas,
      actions = SET para las variables, nada para quienes solo leen upsc.
    - Una alerta tiene que significar algo: espera (los temporizadores de
      upssched) antes de enviar un correo por un estado que puede durar
      segundos; nunca lo silencies todo.
    - REPLBATT (RB) también merece un correo: AT REPLBATT * EXECUTE
      replbatt.

    DOCUMENTACIÓN
    - upscmd(8): https://networkupstools.org/docs/man/upscmd.html
    - upsrw(8): https://networkupstools.org/docs/man/upsrw.html
    - upssched(8): https://networkupstools.org/docs/man/upssched.html
    - upssched.conf(5): https://networkupstools.org/docs/man/upssched.conf.html
    - Notificación y programación: https://networkupstools.org/docs/user-manual.chunked/Advanced_usage_scheduling_notes.html
    - upsd.users(5): https://networkupstools.org/docs/man/upsd.users.html
