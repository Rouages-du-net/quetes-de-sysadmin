### Historia «Las Ondas», capítulo «La fecha de caducidad»: el certificado
### de la intranet, firmado por la propia autoridad de la federación, ha
### caducado. openssl s_client, x509, req, x509 -req con -CA, subjectAltName.
### Los comandos, las opciones, las rutas y las salidas no se traducen.

chapter-expiry-date = La fecha de caducidad
    .summary = Lunes por la mañana, y el navegador de cada emisora avisa de que la intranet no es segura. Su certificado viene de la propia autoridad de la federación, y caducó anoche. Renuévalo como se debe hacer hoy un certificado, y de paso cuida la clave de la autoridad.

## Archivos

expiry-date-message-adaeze =
    De: Adaeze (coordinadora de la federación)
    Lunes 4 de marzo, 8:40

    ¡Hola, y gracias por tomar el relevo de Kwame!

    Desde esta mañana, todas las emisoras ven un gran aviso rojo en la
    intranet: «La conexión no es privada». Los presentadores lo saltan
    (les he pedido que no lo hagan...), y Mateo dice que su navegador
    habla de una fecha caducada y de un nombre incorrecto para
    board.airwaves.internal.

    Todo funciona en mast. Nuestros nombres terminan en airwaves.internal,
    así que Kwame creó nuestra propia autoridad de certificación hace dos
    años: está en /srv/ca, con sus notas (README.txt) y nuestra política
    (POLICY.txt).

    ¿Puedes renovar el certificado de la intranet, bien hecho esta vez?
    Kwame también dijo algo sobre la clave de la autoridad que me
    preocupó, pero no entendí qué.

    Adaeze

## Eventos

expiry-date-event-expired =
    Ahí está: la fecha notAfter del certificado ha pasado (domingo, 23:59
    hora de París). Un certificado lleva su propia fecha de fin, y ningún
    cliente lo acepta después, lo firme quien lo firme. ¿Qué dice el
    certificado sobre los nombres que cubre? openssl x509 -text lo muestra
    todo.
expiry-date-event-cn-only =
    El certificado tiene un sujeto (CN=intranet.airwaves.internal) y
    ninguna extensión: no hay subjectAltName. Desde 2017, los navegadores
    (Chrome 58, luego los demás) ignoran el Common Name y solo miran
    subjectAltName, como piden la RFC 2818 y el CA/Browser Forum. Sin él,
    incluso un certificado válido provoca un aviso; y
    board.airwaves.internal nunca estuvo cubierto. Las notas de Kwame en
    /srv/ca cuentan cómo hizo este.
expiry-date-event-readme =
    La receta de Kwame funciona, pero vuelve a hacer el mismo certificado:
    por defecto, x509 -req no conserva ninguna extensión de la solicitud
    (ningún subjectAltName), y -days 825 va contra la política. Los
    nombres van en un archivo de extensiones (-extfile), o en la solicitud
    con -addext y luego copiados con -copy_extensions copy. Ya que estás
    en /srv/ca: ¿quién puede leer la clave privada de la autoridad?
expiry-date-event-key-open =
    La clave privada de la raíz está en rw-r--r--: cualquier cuenta de
    mast puede leerla y, con ella, firmar un certificado para cualquier
    nombre, en el que confiarían todas las emisoras. La clave de una CA
    solo la puede leer root (chmod 600), en una carpeta en la que nadie
    más puede entrar (chmod 700).
expiry-date-event-key-gone =
    ¡La clave privada de la raíz ya no está en /srv/ca/private/ca.key! Sin
    ella, la autoridad ya no puede firmar nada, y todas las emisoras
    tendrían que confiar en una raíz nueva. Vuelve a ponerla donde estaba
    (la segunda regla de la política: solo cambian sus permisos).
expiry-date-event-key-closed =
    La clave de la autoridad ahora solo la puede leer root: para firmar,
    se pasa por sudo, y eso deja rastro en el diario.
expiry-date-event-insecure =
    curl -k (--insecure) responde, pero solo porque ya no comprueba nada:
    ni la fecha, ni el nombre, ni quién firmó. Esconde el problema sin
    arreglarlo; nunca lo pongas en un script ni en una comprobación de
    monitorización. Para comprobar con nuestra autoridad: curl --cacert
    /srv/ca/ca.crt.
expiry-date-event-mismatch =
    nginx se niega a cargar: el certificado y la clave no van juntos (key
    values mismatch). Un certificado contiene la mitad pública de un par
    de claves; ssl_certificate_key debe ser su mitad privada. openssl x509
    -noout -pubkey y openssl pkey -pubout, cada uno pasado por sha256sum,
    deben dar la misma huella.
expiry-date-event-self-signed =
    nginx sirve ahora un certificado firmado por su propia clave:
    autofirmado. Ninguna emisora confía en él (el aviso rojo sigue, ahora
    por un emisor desconocido), y con la configuración por defecto de req
    -x509 es incluso un certificado de CA. Lo tiene que firmar Airwaves
    Root CA, en la que las emisoras ya confían: x509 -req con -CA y
    -CAkey.
expiry-date-event-no-san =
    Un certificado nuevo, firmado por nuestra raíz, pero todavía sin
    subjectAltName: los navegadores seguirán avisando. Cuidado: x509 -req
    descarta las extensiones de la solicitud salvo que digas lo contrario
    (-copy_extensions copy, o los nombres en -extfile).
expiry-date-event-one-name =
    Por fin un subjectAltName, pero no contiene los dos nombres que usan
    las emisoras: intranet.airwaves.internal y board.airwaves.internal (el
    server_name de nginx).
expiry-date-event-too-long =
    Este certificado es válido { $days } días: la política dice un año,
    nunca más de 398. Las autoridades públicas no pueden pasar de 398
    días, y los sistemas de Apple rechazan más de 825 incluso de una
    autoridad privada; una validez corta limita los daños de una clave
    perdida y obliga a que la renovación siga siendo una rutina conocida.
expiry-date-event-short =
    Este certificado solo es válido un mes: sin -days, x509 -req firma por
    30 días. La intranet volvería a estar en rojo en abril. La política
    pide un año.
expiry-date-event-ca-leaf =
    Este certificado dice CA:TRUE: quien tenga la clave de la intranet
    podría firmar certificados para cualquier nombre. El certificado de un
    servidor no es una CA (basicConstraints = CA:FALSE).
expiry-date-event-not-reloaded =
    El certificado nuevo está en su sitio en el disco, pero nginx sigue
    sirviendo el antiguo: lee sus certificados al arrancar o al recargar.
    Comprueba la configuración (sudo nginx -t) y recarga.
expiry-date-event-renewed =
    nginx presenta ahora un certificado de Airwaves Root CA, válido un
    año, con los dos nombres en subjectAltName. curl --cacert
    /srv/ca/ca.crt https://board.airwaves.internal/ está de acuerdo.
expiry-date-event-end =
    Adaeze: «Se acabó el aviso rojo, en todas las emisoras. ¡Y board
    vuelve a funcionar para Mateo! Gracias. He puesto un recordatorio en
    el calendario para el próximo febrero...»

    ¡Bien hecho! Has terminado el capítulo «La fecha de caducidad».

    QUÉ HA PASADO
    En 2028, Kwame firmó el certificado de la intranet con la raíz de la
    federación, como hacían muchos tutoriales: el nombre solo en el Common
    Name, y 825 días. Caducó el domingo por la noche; e incluso antes, los
    navegadores habían dejado de leer el CN, por eso board.airwaves.internal
    daba aviso. Leíste lo que presenta el servidor (openssl s_client, x509
    -dates, -checkend), hiciste una solicitud, la hiciste firmar por la
    raíz con los nombres en subjectAltName para un año, la instalaste y
    recargaste nginx, y luego comprobaste con curl --cacert. Y la clave de
    la raíz, que todo el mundo podía leer, ahora es solo de root.

    BUENA PRÁCTICA
    - Cada nombre que usa un cliente va en subjectAltName; el CN se ignora.
    - x509 -req no conserva por defecto ninguna extensión de la solicitud:
      -extfile, o -copy_extensions copy (y comprueba el resultado con x509
      -text).
    - Una validez de un año como mucho (398 días es el techo público), y
      un recordatorio en el calendario o, mejor, una vigilancia de las
      fechas de caducidad.
    - Un certificado y su clave van juntos: compara sus claves públicas
      (x509 -pubkey, pkey -pubout, sha256sum).
    - Nunca curl -k como arreglo: --cacert con el certificado de tu
      autoridad.
    - La clave privada de una CA solo la puede leer root, e idealmente su
      raíz está fuera de línea.

    DOCUMENTACIÓN
    - openssl-x509: https://docs.openssl.org/3.0/man1/openssl-x509/
    - openssl-req: https://docs.openssl.org/3.0/man1/openssl-req/
    - subjectAltName (RFC 5280, 4.2.1.6): https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.6
    - Guía TLS de Mozilla: https://wiki.mozilla.org/Security/Server_Side_TLS
