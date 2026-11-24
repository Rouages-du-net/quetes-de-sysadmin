### Historia «La Sala de Profesores», capítulo «La impresora nueva»: una cola
### sin controlador para la multifunción de la sala de profesores, destino por
### defecto de la escuela, compartida solo con el profesorado; la vieja
### LaserJet de recepción y su controlador. lpadmin, lpinfo, driverless, los
### bloques Location de cupsd.conf. Los comandos, opciones, rutas y salidas no
### se traducen.

chapter-new-printer = La impresora nueva
    .summary = Ha llegado la nueva multifunción de la sala de profesores, y la vieja LaserJet de recepción quiere una segunda vida. Añade las dos a CUPS, a la manera moderna cuando puedas, a la antigua cuando no haya más remedio, y asegúrate de que los Chromebooks del alumnado se queden en su lado.

## Files

new-printer-message-ines =
    De: Ines (secretaría de la escuela)
    Miércoles 28 de noviembre, 13:30

    ¡Hola!

    La nueva multifunción de la sala de profesores está conectada (el
    albarán está en tu carpeta). ¿Podrías añadirla en tiza, y hacerla la
    impresora por defecto para todo el mundo? El profesorado debería
    imprimir en ella desde sus PC y sus Mac, como hace con la impresora de
    secretaría.

    Pero cuidado: es solo para el profesorado. Los Chromebooks de la
    biblioteca ven la impresora de la biblioteca, y es lo único que deben
    ver. No quiero que las «creaciones» del alumnado salgan en la sala de
    profesores.

    Y recepción querría recuperar la vieja HP LaserJet 4250: funciona
    perfectamente, solo es vieja. También está conectada.

    Ines

new-printer-delivery-note =
    ALBARÁN

    1 x impresora multifunción RICOH IM C3010 (color, A4/A3)
    Instalada en: Sala de profesores
    Red: VLAN del profesorado, dirección 198.51.100.21
    (mfp-staffroom.internal)
    Impresión: certificada IPP Everywhere / AirPrint / Mopria (sin
    controlador), puerto 631, ruta /ipp/print. No hace falta controlador
    para los sistemas recientes.

    Impresora antigua reconectada: HP LaserJet 4250, dirección
    198.51.100.22 (laserjet-reception.internal). Impresión en red: puerto
    raw 9100 (JetDirect).

## Events

new-printer-event-discover =
    La multifunción se anuncia en la red (DNS-SD, los nombres .local): IPP
    Everywhere, el estándar detrás de la impresión sin controlador. CUPS le
    pregunta sus capacidades por IPP y hace él mismo el PPD: el -m
    everywhere de lpadmin, ningún controlador que instalar (man lpadmin).
new-printer-event-not-enabled =
    La cola existe pero está desactivada y rechaza trabajos: lpadmin crea
    así una cola nueva, salvo si -E va después de -p (antes de -p, -E
    significa «cifrar la conexión»). cupsenable y cupsaccept también
    sirven.
new-printer-event-added =
    La cola { $queue } está lista, sin controlador. ¿Es el destino por
    defecto que verán los equipos del profesorado (lpstat -d)? ¿Y quién
    puede llegar a ella? Echar un vistazo al <Location /> de cupsd.conf
    sería prudente.
new-printer-event-lpoptions-only =
    lpoptions -d ha fijado tu propia impresora por defecto, en
    ~/.cups/lpoptions: no cambia nada para el servidor, ni para los equipos
    del profesorado. El destino por defecto del servidor es el -d de
    lpadmin.
new-printer-event-default =
    La multifunción es el destino por defecto del servidor: los equipos
    del profesorado la ofrecerán en primer lugar.
new-printer-event-pupil-printed =
    Ines: «¡Acaban de salir treinta páginas de skins de videojuegos en la
    sala de profesores!»

    Un Chromebook ha imprimido en la multifunción. cupsd.conf lo comparte
    todo con «Allow @LOCAL» en <Location />, y @LOCAL significa todas las
    redes en las que tiza tiene una interfaz: ip -br addr muestra tres,
    entre ellas la VLAN del alumnado, para la impresora de la biblioteca.
    Las colas nuevas se comparten por defecto (DefaultShared). Quién envía
    qué: /var/log/cups/access_log.
new-printer-event-remote-any =
    «Allow all»: ahora cualquiera que llegue al puerto 631 puede imprimir,
    desde cualquier red. Es lo contrario de lo que pidió Ines. Un Location
    puede nombrar redes (Allow 198.51.100.0/24, Allow @IF(eth1)) y una
    cola puede nombrar sus usuarios (lpadmin -u allow:@staff).
new-printer-event-not-applied =
    cupsd.conf ha cambiado, pero cupsd sigue con la configuración que leyó
    al arrancar. cupsd -t comprueba el archivo; un reinicio (o cupsctl, que
    lo reinicia) la aplica.
new-printer-event-staff-blocked =
    Ahora el profesorado tampoco puede imprimir en la multifunción: un PC
    del profesorado es rechazado (el access_log muestra 403 o
    client-error-not-possible). Compartida y abierta a la red del
    profesorado: hacen falta las dos cosas.
new-printer-event-library-broken =
    Los Chromebooks de la biblioteca ya no pueden imprimir en la impresora
    de la biblioteca: la restricción es demasiado amplia. Restringe la cola
    de la sala de profesores, no todo el servidor.
new-printer-event-printers-conf =
    printers.conf editado mientras cupsd funciona: cupsd lo sobrescribirá,
    y una cola sin su PPD en /etc/cups/ppd imprime en bruto. lpadmin es la
    herramienta para las colas.
new-printer-event-restricted =
    El profesorado imprime en la multifunción, los Chromebooks son
    rechazados (403 en el access_log, o client-error-not-authorized), y
    siguen imprimiendo en la biblioteca. Ahora la vieja LaserJet.
new-printer-event-everywhere-refused =
    «IPP Everywhere driver requires an IPP connection»: la LaserJet 4250
    (2004) solo conoce el puerto raw 9100, socket://. CUPS no puede
    preguntarle nada: necesita un PPD, una descripción de la impresora, y
    los filtros detrás. lpinfo -m lista los controladores instalados; los
    de HP están en un paquete de Debian (apt search hpcups).
new-printer-event-raw =
    Una cola raw envía el documento tal cual: la LaserJet no entiende el
    PDF. Y CUPS lo dice: las colas raw están obsoletas. Necesita un
    controlador.
new-printer-event-hpcups =
    printer-driver-hpcups está instalado: lpinfo -m conoce ahora la
    LaserJet 4250 (lpinfo -m | grep 4250).
new-printer-event-old-added =
    La LaserJet de recepción tiene su cola, con { $model }. CUPS avisa de
    que los controladores de impresora están obsoletos: CUPS 3 solo
    imprimirá sin controlador, y las impresoras viejas necesitarán una
    Printer Application.
new-printer-event-end =
    Ines: «La sala de profesores imprime, recepción imprime, y los
    Chromebooks de la biblioteca solo ven la biblioteca. ¡Perfecto!»

    ¡Bien hecho! Has terminado La impresora nueva.

    QUÉ HA PASADO
    La multifunción habla IPP Everywhere: la cola { $queue } va sin
    controlador (-m everywhere), activada al crearse (-E después de -p), y
    es el destino por defecto del servidor (lpadmin -d). cupsd.conf lo
    compartía todo con «Allow @LOCAL», y @LOCAL incluye la VLAN del
    alumnado, donde tiza sirve a la biblioteca: restringiste la
    multifunción al profesorado, por red o por grupo, y comprobaste quién
    entraba con el access_log. La LaserJet solo habla el puerto 9100: la
    cola { $old } usa un PPD, el de HP de printer-driver-hpcups o uno
    genérico.

    BUENA PRÁCTICA
    - Primero sin controlador (IPP Everywhere, AirPrint, Mopria): ningún
      controlador que mantener, y la única forma en que imprimirá CUPS 3.
    - lpadmin -p NOMBRE -E -v URI -m everywhere: -E después de -p.
    - @LOCAL significa todas las redes en las que el servidor tiene una
      interfaz: lístalas (ip -br addr) antes de fiarte.
    - Restringe por red en un <Location /printers/NOMBRE> (quién puede
      conectarse), por usuario con lpadmin -u (quién puede imprimir; el
      nombre de usuario lo da el cliente, salvo si el servidor
      autentica).
    - Nunca Allow all; nunca edites printers.conf mientras cupsd funciona.
    - Impresoras viejas: el paquete de controladores del fabricante, o un
      PPD genérico, hasta que lo sustituya una Printer Application.

    DOCUMENTACIÓN
    - lpadmin: https://www.cups.org/doc/man-lpadmin.html
    - lpinfo: https://www.cups.org/doc/man-lpinfo.html
    - Compartir impresoras: https://www.cups.org/doc/sharing.html
    - cupsd.conf (Location, Allow, Order): https://www.cups.org/doc/man-cupsd.conf.html
    - Impresión sin controlador en Debian: https://wiki.debian.org/CUPSDriverlessPrinting
