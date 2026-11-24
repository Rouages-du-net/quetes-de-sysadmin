### Historia «Las Ondas», capítulo «El portátil robado»: el portátil de una
### reportera robado con su certificado de cliente; revocación, CRL, ssl_crl
### de nginx; luego una vigilancia de las fechas de caducidad (openssl x509
### -checkend, cron o un temporizador). Los comandos, las opciones, las
### rutas y las salidas no se traducen.

chapter-stolen-laptop = El portátil robado
    .summary = Han robado el portátil de una reportera, y con él el certificado que abre el portal de contribuciones. Alguien ya lo está usando. Cierra esa puerta sin dejar fuera a los demás, y luego asegúrate de que ningún certificado de la federación vuelva a caducar por sorpresa.

## Archivos

stolen-laptop-message-adaeze =
    De: Adaeze
    Martes 16 de abril, 10:05

    Malas noticias: el domingo por la noche, después del festival, le
    robaron a Lindiwe el portátil del coche. Su disco no está cifrado (ya
    lo sé...).

    En él está el programa que envía sus grabaciones al portal de
    contribuciones, https://contrib.airwaves.internal/. El portal solo deja
    entrar los portátiles de los reporteros: cada uno tiene un certificado
    de cliente de nuestra CA emisora (las notas de Kwame están en
    /srv/ca/LEEME.txt). Amina y Ravi tienen que seguir trabajando: Amina
    envía esta mañana las entrevistas del festival.

    Lindiwe tendrá un portátil nuevo la semana que viene; mientras tanto,
    nadie más que nosotros debe poder usar el suyo.

    Y otra cosa, después de la sorpresa de la intranet en marzo: ¿podemos
    recibir un aviso, por nuestra cuenta, antes de que caduque un
    certificado? La política dice 30 días antes.

    Adaeze

## Eventos

stolen-laptop-event-thief =
    203.0.113.66: una dirección que no es de ninguna emisora, que se
    conecta al portal a las 2 de la madrugada y otra vez esta mañana, y es
    aceptada (200). Presenta un certificado válido firmado por nuestra CA:
    nginx no puede distinguirla de Lindiwe. Un certificado sigue siendo
    válido hasta su fecha de fin, salvo que la autoridad lo revoque y los
    servidores se enteren.
stolen-laptop-event-deleted =
    El archivo del certificado ya no está en newcerts, pero eso no revoca
    nada: el ladrón tiene su copia, con su clave, y nginx solo comprueba
    que la firmó nuestra CA. Revocar es avisar a la base de datos de la
    autoridad (openssl ca -revoke) y luego publicar la lista. También se
    guarda una copia del certificado de cada portátil en
    /srv/ca/issuing/certs/.
stolen-laptop-event-new-ca =
    ¿Una autoridad completamente nueva? Solo se robó la clave de un
    portátil, no la de la autoridad: cambiar la raíz obligaría a
    instalarla en todas partes y a volver a emitir todos los certificados,
    para nada. Basta con revocar ese único certificado.
stolen-laptop-event-revoked =
    El certificado 1003 está ahora marcado R (revocado) en index.txt. Pero
    la base de datos es de la autoridad: nginx nunca la lee. Lo que leen
    los servidores es la lista de revocación, la CRL, que la autoridad
    escribe y firma (openssl ca -gencrl).
stolen-laptop-event-crl =
    La CRL lista el número de serie 1003, firmada por la CA emisora, válida
    30 días (default_crl_days: hay que reescribirla antes, aunque no haya
    nada nuevo). Hay que dársela a nginx: la directiva ssl_crl, leída en
    cada recarga.
stolen-laptop-event-stale-crl =
    nginx tiene una CRL, pero una que no lista 1003: una CRL es una foto
    de la base de datos en el momento en que se escribió. Vuelve a
    escribirla después de cada revocación, y recarga nginx.
stolen-laptop-event-all-refused =
    ¡Ahora nginx rechaza a todo el mundo, Amina incluida! Su registro de
    errores dice por qué: «unable to get certificate CRL». Con ssl_crl,
    nginx comprueba la revocación de cada certificado de la cadena,
    también el de la CA emisora, y ese está en la CRL de la raíz
    (/srv/ca/crl/root.crl): el archivo que se da a ssl_crl debe contener
    las dos CRL, una detrás de otra.
stolen-laptop-event-not-loaded =
    La configuración menciona ssl_crl, pero nginx aún no la ha cargado:
    compruébala (sudo nginx -t) y recarga.
stolen-laptop-event-refused =
    El portátil robado es rechazado (400, «The SSL certificate error»,
    certificate revoked en el registro de errores), y los envíos de Amina
    siguen pasando. Ahora, la segunda petición: una vigilancia de las
    fechas de caducidad.
stolen-laptop-event-watch-quiet =
    Una tarea se ejecuta sola, pero no dijo nada del certificado del
    servidor de streaming, que caduca dentro de 20 días
    (/srv/ca/issued/stream.crt). Los certificados están en /srv/ca/issued
    y /srv/ca/issuing/newcerts; openssl x509 -checkend responde con su
    código de salida.
stolen-laptop-event-watch-noisy =
    La tarea lista todos los certificados igual: el que caduca se pierde
    entre los sanos, y nadie leerá un correo diario que siempre dice lo
    mismo. Una alerta solo habla cuando hay algo que hacer.
stolen-laptop-event-watch =
    La vigilancia funciona: ejecutada como lo será, señala el certificado
    del servidor de streaming, que caduca el 6 de mayo, y no dice nada de
    los demás.
stolen-laptop-event-end =
    Adaeze: «Las entrevistas del festival ya están, y el portátil robado
    ya no puede enviar nada. Ya tengo la primera alerta en mi buzón: el
    certificado del streaming. ¡Le pediré a Kwame que lo renueve esta
    semana!»

    ¡Bien hecho! Has terminado el capítulo «El portátil robado».

    QUÉ HA PASADO
    Un certificado de cliente prueba «este portátil es de una reportera»
    mientras es válido: robado, funciona para quien lo tenga. Encontraste
    las conexiones del ladrón en el registro de accesos de nginx,
    revocaste el certificado en la base de datos de la CA emisora (openssl
    ca -revoke, keyCompromise), escribiste la lista de revocación (openssl
    ca -gencrl), y diste a nginx las dos CRL (la de la CA emisora y la de
    la raíz, ya que nginx comprueba toda la cadena) antes de recargar.
    Luego montaste una vigilancia que ejecuta openssl x509 -checkend sobre
    cada certificado emitido y solo habla de los que caducan en menos de
    30 días.

    BUENA PRÁCTICA
    - Una clave perdida o robada: revoca el certificado enseguida (openssl
      ca -revoke archivo -crl_reason keyCompromise); borrar un archivo no
      revoca nada.
    - Revocar son dos pasos: la base de datos, luego una CRL nueva
      (-gencrl) que cargan los servidores (nginx: ssl_crl, luego una
      recarga).
    - Una CRL caduca (default_crl_days): reescríbela con regularidad, o
      todos los clientes serán rechazados el día que venza.
    - nginx comprueba las CRL de toda la cadena: también la CRL de la raíz.
    - Vigila las fechas de caducidad: openssl x509 -checkend $((30*86400))
      en una tarea diaria (cron, o un temporizador de systemd), que solo
      informa de lo que caduca.
    - Cifra los discos de los portátiles: una clave robada es el principio
      de todas las historias.

    DOCUMENTACIÓN
    - openssl-ca (-revoke, -gencrl): https://docs.openssl.org/3.0/man1/openssl-ca/
    - openssl-crl: https://docs.openssl.org/3.0/man1/openssl-crl/
    - nginx, ssl_crl y ssl_verify_client: https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_crl
    - CRL (RFC 5280, sección 5): https://www.rfc-editor.org/rfc/rfc5280#section-5
    - openssl-x509 (-checkend): https://docs.openssl.org/3.0/man1/openssl-x509/
