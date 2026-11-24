### Historia «La Auditoría», capítulo «Los rastros»: un inicio de sesión
### nocturno que nadie esperaba. journalctl, last, huellas de claves
### (ssh-keygen -l), authorized_keys y una tarea cron dejada por el intruso.
### Los comandos, las rutas y los mensajes de las herramientas no se traducen.

chapter-traces = Los rastros
    .summary = Rastrear un inicio de sesión inesperado: el journal, last, la huella de una clave, la clave y la tarea cron del intruso.

## Archivos

traces-email-salome =
    De:      Salomé (auditora)
    Para:    tú
    Asunto:  Auditoría de la Panadería — tercera parte: los rastros

    Hola:

    Gracias por la segunda parte: mi escaneo ya solo ve SSH, el sitio web y
    su puerto seguro. Queda una cosa que no me gusta, y ya no es de
    configuración: leyendo el journal de ssh, vi un inicio de sesión de la
    cuenta de Nadia en la noche del domingo al lunes, a las 3:12, desde una
    dirección que ella no reconoce.

    Nadia me dice: «Estaba durmiendo, y mi clave solo está en el ordenador
    de la tienda».

    Lo que espero:
    1. Que encuentres ese inicio de sesión: cuándo, desde dónde y con qué
       clave (el journal guarda su huella).
    2. Que quites la clave que no es de Nadia, sin dejarla a ella fuera.
    3. Que busques lo que esa persona haya podido dejar, y limpies. Las
       tareas programadas de Nadia son un sitio clásico: pero ten cuidado de
       no borrar su copia de seguridad de verdad.
    4. Que mires lo que haya podido LEER: el historial de comandos de Nadia
       (.bash_history) dice lo que se escribió durante la sesión. Un secreto
       leído es un secreto que hay que cambiar, de verdad: el nuevo tiene que
       funcionar en todas partes, y la aplicación de pedidos no se puede
       caer.

    Nota: un comentario en una clave («nadia@portatil») no demuestra nada,
    cualquiera puede escribir lo que quiera. Compara las huellas.

    Salomé
    (Para sudo, tu contraseña sigue siendo: harina-2028)

## Eventos

# { $address }: the address the login came from
traces-event-found =
    Ahí está el inicio de sesión: una sesión de la cuenta «nadia» desde
    { $address }, a las 3:12, cuando Nadia suele conectarse desde la tienda
    (198.51.100.7), por la tarde. El journal de ssh guardó la huella de la
    clave usada: «ED25519 SHA256:…».

    ¿Qué clave de /home/nadia/.ssh/authorized_keys tiene esa huella?
    (man ssh-keygen, opción -l)
traces-event-key-identified =
    Ahí está la huella de cada clave del archivo. Compárala con la del
    journal: la segunda clave es la que se usó esa noche, y sin embargo lleva
    el comentario «nadia@portatil». El comentario no es más que una etiqueta.

    Quita esa línea (y solo esa) de authorized_keys.
traces-event-nadia-locked-out =
    Atención: ¡la clave de Nadia ya no está en authorized_keys! Ya no podría
    iniciar sesión. Vuelve a poner su clave (la que tiene la huella de los
    inicios de sesión de la tarde, desde la tienda): se quita la clave del
    intruso, no la de Nadia.
traces-event-key-revoked =
    En authorized_keys solo queda la clave de Nadia: la clave del intruso ya
    no puede abrir una sesión.

    Pero quitar la clave solo cierra la puerta por la que entró. ¿Qué dejó
    dentro durante esos tres minutos? Mira lo que se ejecuta solo para la
    cuenta de Nadia (man crontab).
traces-event-cron-found =
    Dos tareas para Nadia: copia.sh a las 4:00 (esa es suya), y una línea
    que, cada diez minutos, descarga un programa de 203.0.113.99 y lo
    ejecuta. Es la baliza del intruso: puede cambiar a distancia lo que hace
    el servidor, incluso sin clave.

    Quita esa línea, y solo esa.
traces-event-secret-seen =
    Ahí está lo que esa persona escribió durante sus tres minutos: leyó
    /srv/pedidos/.env. En ese momento, ese archivo era legible por todo el
    mundo («El informe»): la contraseña de la base de datos está
    comprometida, aunque la clave y la tarea ya no estén. Cerrar la puerta no
    cambia una llave que ya se ha copiado.

    Tienes que cambiar esa contraseña, en los dos lados: en PostgreSQL (man
    psql; ALTER ROLE ... PASSWORD, desde la cuenta postgres) Y en el
    archivo .env, y luego reiniciar la aplicación. Elige una contraseña larga (doce
    caracteres como mínimo) y distinta de la antigua.
traces-event-password-weak =
    La contraseña de la base de datos ha cambiado, pero es demasiado corta:
    doce caracteres como mínimo, y una frase vale más que una palabra. Un
    secreto que se puede adivinar es tan mal sustituto como el que perdiste.
traces-event-a-restart =
    La base de datos y .env tienen la misma contraseña nueva, pero la
    aplicación sigue funcionando con la antigua: lee .env al arrancar, no
    cuando cambia el archivo. Reiníciala (systemctl restart pedidos) y luego
    comprueba que sigue activa (systemctl status pedidos).
traces-event-app-down =
    La aplicación de pedidos está parada: al arrancar, leyó en .env una
    contraseña que la base de datos no acepta (journalctl -u pedidos:
    «password authentication failed»). Los dos lados tienen que decir lo
    mismo: la contraseña del rol pedidos en PostgreSQL, y la de DATABASE_URL
    en el archivo .env. Corrige la que no coincide y reinicia la aplicación.
traces-event-password =
    La contraseña de la base de datos ha cambiado de punta a punta: el rol en
    PostgreSQL, el archivo .env (todavía cerrado a las demás cuentas), y la
    aplicación reiniciada que se conecta con ella. La antigua, que leyó el
    intruso, ya no abre nada.
traces-event-backup-lost =
    La copia de seguridad de Nadia (copia.sh, a las 4:00) ya no está
    programada: crontab -r borra TODO el crontab. Vuelve a poner su línea:
      0 4 * * * /srv/pedidos/bin/copia.sh
    y quita solo la línea del intruso.
traces-event-cron-cleaned =
    Se acabó la baliza, y la copia de seguridad de verdad de Nadia sigue ahí.
traces-event-end =
    La clave del intruso ya no está, su tarea tampoco, la contraseña que leyó
    está sustituida en todas partes, y Nadia sigue pudiendo iniciar sesión y
    hacer su copia. Salomé: «Mi informe está completo. Volveré dentro de seis
    meses a ver si todo aguanta».

    ¡Bien hecho! Has terminado el capítulo «Los rastros» y la historia
    «La Auditoría».

    QUÉ HA PASADO
    Alguien entró con una clave añadida a la cuenta de Nadia (todavía no
    sabemos cómo: un acceso robado, un secreto antiguo…), y dejó una tarea
    cron para volver. Una clave en authorized_keys es una puerta permanente:
    sobrevive a un cambio de contraseña. Por eso, en una auditoría, se
    comparan las huellas en lugar de los comentarios, y se busca la
    «persistencia» después de encontrar la entrada.

    BUENA PRÁCTICA
    - Lee primero los rastros (journalctl -u ssh, last) Y GUARDA UNA COPIA
      antes de limpiar: las pruebas ayudan a entender.
    - Identifica una clave por su huella (ssh-keygen -l -f) y quita solo esa.
      Vuelve a leer con regularidad el authorized_keys de cada cuenta.
    - Busca la persistencia: los crontab (sudo crontab -u cuenta -l,
      /etc/cron.d), los temporizadores y servicios de systemd, ~/.bashrc,
      authorized_keys.
    - Trata como comprometido cualquier secreto que fuera legible durante la
      intrusión: el archivo .env de los pedidos era legible por todo el mundo
      esa noche («El informe»). Cámbialo en los dos lados (la base de datos Y
      el archivo), reinicia la aplicación, comprueba que aguanta. Una
      contraseña escrita en «psql -c "ALTER ROLE ... PASSWORD '...'"» se queda
      en el historial de la shell: el metacomando \password de psql lo evita
      (la pide sin mostrarla).
    - Avisa a quien deba saberlo: a la aseguradora y, si había datos
      personales en juego, a la autoridad de protección de datos de tu país,
      a menudo en un plazo corto (72 horas en Europa, según el RGPD). Por
      ejemplo: la AEPD (España), la CNIL (Francia), el BfDI y las autoridades
      de los Länder (Alemania), el ICO (Reino Unido), la APD-GBA (Bélgica),
      la CNPD (Luxemburgo), el PFPDT (Suiza), el Commissariat à la protection
      de la vie privée (Canadá), la FTC y las autoridades de los estados
      (Estados Unidos). La lista de autoridades europeas la mantiene el
      Comité Europeo de Protección de Datos (edpb.europa.eu).

    OTRA MANERA
    Para enterarse antes: fail2ban vigila los fallos, no los éxitos; una
    alerta ante cualquier inicio de sesión desde fuera de las direcciones
    conocidas (un script que lee el journal y manda un correo, como en «La
    sonda») o una lista de direcciones permitidas
    (AllowUsers nadia@198.51.100.7) habría señalado o bloqueado esa sesión.

    DOCUMENTACIÓN
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
    - sshd (authorized_keys): https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
    - crontab: https://man7.org/linux/man-pages/man5/crontab.5.html
    - last: https://man7.org/linux/man-pages/man1/last.1.html
    - ALTER ROLE: https://www.postgresql.org/docs/current/sql-alterrole.html
    - Notificación de una violación de datos personales (RGPD, artículo 33): https://gdpr-info.eu/art-33-gdpr/
