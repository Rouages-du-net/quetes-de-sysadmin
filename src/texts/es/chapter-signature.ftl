### Historia «Correo No Deseado», capítulo 2 «La firma»: DKIM con
### OpenDKIM. Los comandos, las rutas, las directivas y los mensajes no se
### traducen.

chapter-signature = La firma
    .summary = Los correos llegan, pero a la carpeta de correo no deseado: firmarlos con DKIM (OpenDKIM, el milter de Postfix, la clave en el DNS).

## Archivos

signature-message-nour =
    ¡Hola!

    Los correos de bienvenida llegan, gracias. Pero en mailbox.example
    acaban en la carpeta de correo no deseado. Su página de ayuda dice que
    un remitente serio tiene que tener SPF y DKIM.

    Ayer instalé opendkim (sudo apt install opendkim opendkim-tools), sin
    configurar nada: el archivo es /etc/opendkim.conf, y Debian guarda las
    claves en /etc/dkimkeys.

    Una amiga me pasó una dirección que responde con lo que ve de un correo
    (SPF, DKIM, DMARC):
    echo test | mail -s test check-auth@verifier.example
    La respuesta llega a tu buzón, en este servidor (el comando mail, sin
    argumento, la lista; el buzón en sí es /var/mail/tu_cuenta).

    La contraseña de sudo sigue siendo semillas-2027.

    Nour

## Eventos

signature-event-check =
    El verificador ha respondido: SPF pasa, pero «DKIM check: none»: los
    correos no están firmados. DKIM es una firma que se añade a cada
    mensaje con una clave privada, y que el destinatario comprueba con la
    clave pública publicada en el DNS (selector._domainkey.gardens.example).
    En Debian, opendkim se encarga de firmar, conectado a Postfix como un
    «milter». Empieza por el par de claves: man opendkim-genkey.
signature-event-key =
    Una clave privada en /etc/dkimkeys. opendkim-genkey también ha escrito
    un archivo .txt al lado: el registro DNS que hay que publicar, con la
    clave pública. Mira quién es el dueño de la clave privada (ls -l):
    opendkim se ejecuta con la cuenta opendkim, y tiene que poder leerla.
signature-event-unreadable =
    opendkim no arranca: «Permission denied» sobre la clave privada.
    Pertenece a root (root la creó), con permisos rw-------: la cuenta
    opendkim no puede leerla. Dásela a opendkim:
    sudo chown opendkim:opendkim /etc/dkimkeys/…private
signature-event-not-sure =
    opendkim rechaza la clave: «key data is not secure». Una clave privada
    que otras cuentas pueden leer ya no es secreta, y opendkim
    (RequireSafeKeys) se niega a usarla. Haz que solo la pueda leer su
    dueño: sudo chmod 600 …
signature-event-opendkim =
    opendkim funciona con la clave y el dominio. Pero solo firma lo que
    Postfix le pasa: hay que conectar el milter en /etc/postfix/main.cf (man
    postconf, y MILTER_README). La dirección del socket tiene que coincidir
    con el Socket de opendkim.conf, cada uno con su propia sintaxis.
signature-event-chroot =
    «connect to Milter service unix:…: No such file or directory»: en
    Debian, Postfix funciona encerrado en /var/spool/postfix (chroot). Una
    ruta como /run/opendkim/opendkim.sock es, para él,
    /var/spool/postfix/run/opendkim/opendkim.sock, que no existe. El
    comentario de opendkim.conf lo dice: o un socket dentro de
    /var/spool/postfix, o un socket de red (Socket inet:8891@localhost, e
    inet:localhost:8891 del lado de Postfix).
signature-event-socket =
    «connect to Milter service inet:…: Connection refused»: Postfix no
    encuentra a nadie en esa dirección. ¿Está opendkim en marcha, y
    escuchando en ese puerto? Cuidado con las dos sintaxis:
    inet:8891@localhost en opendkim.conf, inet:localhost:8891 en main.cf.
signature-event-smtpd-only =
    smtpd_milters solo se aplica al correo que llega por la red (SMTP). Los
    correos del sitio web y el comando mail se envían desde la máquina:
    pasan por non_smtpd_milters. Para firmar los dos:
    non_smtpd_milters = $smtpd_milters.
signature-event-milter =
    Postfix pasa ahora el correo a opendkim, que lo firma («DKIM-Signature
    field added» en /var/log/mail.log). Ahora publica la clave pública en
    la zona, si no nadie podrá comprobar la firma. opendkim-testkey
    comprueba la clave publicada.
signature-event-not-secure =
    «key not secure» no es un error: opendkim-testkey solo dice que la
    respuesta DNS no está protegida por DNSSEC. Lo que cuenta es la línea
    siguiente: «key OK».
signature-event-serial =
    El servidor de la máquina publica la clave, pero el secundario del
    registro no la tiene: ¿has subido el serial de la zona? dig TXT
    mail._domainkey.gardens.example @ns2.registry.example
signature-event-end =
    Los correos de los Huertos están firmados, e internet puede comprobar
    la firma con la clave publicada. Nour: «¡mailbox.example los pone por
    fin en la bandeja de entrada!».

    ¡Bien hecho! Has terminado el capítulo «La firma».

    QUÉ HA PASADO
    DKIM añade una firma a cada correo, calculada con una clave privada que
    solo conoce el servidor; el destinatario la comprueba con la clave
    pública, publicada en el DNS en selector._domainkey.dominio. Un mensaje
    modificado por el camino, o enviado por otra persona, falla. opendkim
    firma; Postfix le pasa el correo (milter); el DNS publica la clave.

    BUENA PRÁCTICA
    - La clave privada pertenece a la cuenta del servicio (opendkim), y
      solo ella puede leerla (600); nunca se copia a ningún otro sitio.
    - non_smtpd_milters para el correo enviado desde la máquina,
      smtpd_milters para el que llega por SMTP; milter_default_action =
      accept para que el correo no se bloquee si opendkim se para.
    - Un selector por clave (mail, 2027…): para cambiar de clave, publica
      una nueva junto a la otra, y luego retira la antigua.
    - opendkim-testkey, y luego un correo de verdad a un verificador.

    DOCUMENTACIÓN
    - DKIM, RFC 6376: https://www.rfc-editor.org/rfc/rfc6376
    - Postfix y los milters: https://www.postfix.org/MILTER_README.html
    - OpenDKIM: http://www.opendkim.org/opendkim.conf.5.html
