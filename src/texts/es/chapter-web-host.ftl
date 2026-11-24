### Historia «El Centro Cívico», capítulo «El alojamiento»: sftp, y luego
### publicar un sitio en un alojamiento compartido por FTPS con lftp. Los
### comandos, los nombres de máquinas, las rutas y el HTML no se traducen
### (el texto de las páginas, sí).

chapter-web-host = El alojamiento
    .summary = El sitio nuevo está listo en la wiki: traerlo con sftp, y luego publicarlo en el alojamiento, que ya no acepta FTP en claro. FTPS, el nombre de servidor correcto, y nada antiguo por ahí.

## Archivos

# { $account }: la cuenta FTP en el alojamiento; { $password }: su contraseña
web-host-email-yasmine =
    De:      Yasmine
    Para:    tú
    Asunto:  El sitio web nuevo

    ¡El sitio web nuevo del Centro está listo! Está en la wiki, en
    /srv/wiki/site. Hay que ponerlo en línea en nuestro alojamiento, y
    sobre todo quitar la página de tarifas de 2025, esos precios ya no
    valen.

    Gaspard se encargaba de ello, con FileZilla; sus notas están en
    notes-gaspard.txt. Pero el alojamiento nos ha escrito
    (email_alojamiento.txt): desde el 1 de marzo, se acabó el FTP en claro.

    Sus credenciales, que el alojamiento me ha vuelto a enviar:
        cuenta       : { $account }
        contraseña   : { $password }

    A la wiki se llega como siempre desde tu puesto (el atajo ssh wiki);
    para mirar antes de llevarte nada: man sftp. Para el alojamiento, que
    solo ofrece FTP: man lftp, instalado en tu puesto.

web-host-email-host =
    De:      Soporte del alojamiento <support@hosting.example>
    Asunto:  Fin del FTP sin cifrar el 1 de marzo

    Hola:

    Para proteger sus credenciales, nuestros servidores rechazan ahora las
    conexiones FTP sin cifrar. Use FTPS (FTP explícito sobre TLS, puerto
    21): la mayoría de los clientes lo hacen por defecto.

    Servidor: ftp.hosting.example
    Nuestro certificado está emitido para *.hosting.example: conéctese con
    ese nombre para que se reconozca. No desactive nunca la verificación
    del certificado.

    Su sitio está en la carpeta public_html de su cuenta.

    El equipo técnico

web-host-notes-gaspard =
    NOTAS DE GASPARD — publicar el sitio

    FileZilla:
      servidor     : ftp.community.example
      puerto       : 21
      cifrado      : "Usar solo FTP plano (inseguro)"
                     (con cifrado me salía un error de
                     certificado, así que lo quité)
      carpeta      : public_html

    Arrastro los archivos de un lado al otro. Los archivos antiguos, los
    dejo ahí, por si acaso.

## El sitio

web-host-old-index =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Centro Cívico</title></head>
    <body><h1>Centro Cívico</h1>
    <p>¡Bienvenida, bienvenido! Mira la agenda y las tarifas de 2025.</p></body></html>
web-host-old-agenda =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Agenda</title></head>
    <body><h1>Agenda 2025</h1><p>Fiesta vecinal: 23 de mayo de 2025.</p></body></html>
web-host-old-prices =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Tarifas 2025</title></head>
    <body><h1>Tarifas 2025</h1><p>Alquiler de sala: 15 € la hora.</p></body></html>
web-host-index =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Centro Cívico</title>
    <link rel="stylesheet" href="style.css"></head>
    <body><header><img src="images/logo.svg" alt="" width="48"><h1>Centro Cívico</h1></header>
    <p>¡Bienvenida, bienvenido! La agenda de actividades y las altas de socios ya están en línea.</p>
    <p><a href="agenda.html">Agenda</a> · <a href="socios.html">Hazte socio</a></p></body></html>
web-host-agenda =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Agenda</title><link rel="stylesheet" href="style.css"></head>
    <body><h1>Agenda 2028</h1><p>Asamblea general: 12 de abril. Fiesta vecinal: 26 de mayo.</p></body></html>
web-host-membership =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Hazte socio</title><link rel="stylesheet" href="style.css"></head>
    <body><h1>Hazte socio</h1><p>La cuota es la voluntad, en recepción o por correo.</p></body></html>

## Eventos

web-host-event-clear =
    El alojamiento se niega: se acabó el FTP en claro, como anunció. Y
    mejor así: con FTP en claro, la contraseña de la cuenta viaja sin
    cifrar por la red, legible por cualquiera por el camino (el wifi de
    un café…). lftp cifra por sí solo (FTPS), salvo que le digas que no.
web-host-event-certificate =
    La conexión está cifrada, pero lftp rechaza el certificado: está
    emitido para *.hosting.example, y has pedido ftp.community.example.
    Es el error que le salía a Gaspard. No se arregla desactivando la
    verificación, sino pidiendo el servidor con el nombre que lleva su
    certificado (email_alojamiento.txt).
web-host-event-without-verification =
    Cuidado: la verificación del certificado está desactivada
    (ssl:verify-certificate). La conexión está cifrada… pero con
    cualquiera: alguien que se hiciera pasar por el alojamiento recibiría
    la contraseña sin que lftp se quejara. Vuelve a activar la
    verificación, y usa el nombre que cubre el certificado.
web-host-event-bad-direction =
    Uy: mirror sin -R copia DESDE el alojamiento HACIA tu puesto. Acabas de
    traerte el sitio antiguo (la página de tarifas de 2025 ha aterrizado
    en tu máquina). -R (reverse) envía en el otro sentido. El sitio nuevo
    sigue en la wiki si lo vuelves a necesitar.
web-host-event-bad-directory =
    El sitio ha llegado al alojamiento… pero no a public_html: mirror -R
    site, sin destino, crea al lado una carpeta con el mismo nombre. La
    carpeta que publica el servidor web es public_html (y la carpeta de
    más se puede quitar: rm -r).
web-host-event-rest =
    El sitio nuevo está en línea… y la página de tarifas de 2025 también:
    mirror no borra nada del otro lado sin --delete. (Para ver lo que
    haría antes de hacerlo: --dry-run.)
web-host-event-end =
    El sitio nuevo está en línea, exactamente el de la wiki, y las tarifas
    de 2025 han desaparecido. La contraseña nunca ha viajado en claro.
    Yasmine: «Gaspard pregunta si podrías enseñárselo, para la próxima
    vez».

    ¡Bien hecho! Has terminado el capítulo «El alojamiento».

    QUÉ HA PASADO
    sftp transfiere archivos por SSH, como scp, pero de forma
    interactiva: se mira (ls, cd), y luego se toma (get) o se envía (put).
    Un alojamiento compartido, en cambio, a menudo solo ofrece FTP:
    entonces hace falta FTPS, FTP cifrado con TLS, como un sitio en HTTPS.
    El cifrado solo protege si se verifica el certificado, y solo se
    verifica con el nombre que lleva: el del alojamiento, no el de tu
    propio sitio.

    BUENA PRÁCTICA
    - SFTP (o scp, rsync) siempre que tengas SSH; si no, FTPS; nunca FTP
      en claro.
    - Nunca desactives la verificación del certificado: cambia el nombre,
      no los ajustes.
    - Publica con mirror -R --delete (después de un --dry-run): el sitio
      en línea es exactamente el que preparaste, sin archivos antiguos.

    DOCUMENTACIÓN
    - sftp: https://man.openbsd.org/sftp
    - lftp: https://lftp.yar.ru/lftp-man.html
    - FTP sobre TLS (RFC 4217): https://www.rfc-editor.org/rfc/rfc4217
