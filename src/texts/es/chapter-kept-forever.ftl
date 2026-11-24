### Historia «El Coro», capítulo «Guardado para siempre»: los registros del
### servidor del coro se remontan años atrás, en contra de la política de
### conservación. logrotate (rotate, maxage), find -mtime, map y log_format
### de nginx, MaxRetentionSec= de journald. Los comandos, las opciones, las
### rutas y las salidas no se traducen.

chapter-kept-forever = Guardado para siempre
    .summary = La junta del coro escribió hace dos años cuánto tiempo guarda los datos personales. El servidor nunca lo leyó: sus registros guardan la dirección de cada visitante desde 2027. Ajusta los registros a la política, sin tirar lo que pide conservar.

## Archivos

kept-forever-message-amara =
    De: Amara (presidenta, Riverside Community Choir)
    Martes 4 de marzo, 9:10

    ¡Hola, y gracias por hacerte cargo de nuestro pequeño servidor!

    En la reunión de la junta de la semana pasada, alguien preguntó si
    hacemos de verdad lo que dice nuestra política de conservación. La
    adoptamos en 2029 (está en /srv/choir/docs/politica-de-conservacion.txt),
    Ruben montó el servidor antes de eso, y me temo que nadie lo comprobó
    nunca. Ruben se mudó a Glasgow; te dejó una nota.

    ¿Podrías mirar los registros del servidor y hacer que sigan la
    política? Guarda lo que la política dice que hay que guardar, y nada
    más tiempo. Prefiero que lo descubramos nosotros a que lo descubra un
    miembro por nosotros.

    Estás en batuta, el servidor del coro; sudo funciona con tu
    contraseña.

    Amara

kept-forever-note-ruben =
    Notas de Ruben (batuta, 2027)

    - nginx sirve www.riversidechoir.example desde /var/www/choir; el
      área de miembros (/members/) es la aplicación del coro (gunicorn,
      puerto 8000). Registros en /var/log/nginx.
    - Configuré logrotate para guardar los registros web diez años, «por
      si acaso» (/etc/logrotate.d/nginx). El disco es barato.
    - El área de miembros escribe su registro de seguridad (inicios de
      sesión, cambios de perfil) en /var/log/choir/audit.log, rotado cada
      mes.
    - journalctl para todo lo demás; el diario es persistente
      (/var/log/journal).

    Ruben

## Eventos

kept-forever-event-policy =
    Esa es la promesa de la junta: los registros de acceso web durante
    treinta días con las direcciones truncadas, el registro de seguridad
    del área de miembros durante doce meses, el diario del sistema durante
    treinta días. Ahora mira lo que guarda de verdad el servidor:
    /var/log/nginx, /var/log/choir, el diario.
kept-forever-event-forever =
    { $weeks } semanas de registros de acceso, hasta septiembre de 2027,
    cada línea con la dirección IP completa de un visitante: según el
    RGPD, una dirección IP es un dato personal. El «rotate 520» de Ruben
    guarda diez años de registros semanales. ¿Dónde decide logrotate
    cuánto vive un registro? (man logrotate: rotate, maxage, daily,
    weekly.)
kept-forever-event-today-only =
    El registro de hoy ha desaparecido, pero los años de archivos siguen
    ahí: el problema nunca fue el archivo de hoy. Y la política pide
    guardar treinta días de registros, para investigar un incidente:
    borra lo que es más antiguo, no lo reciente.
kept-forever-event-too-much =
    Has borrado registros que la política pide guardar: las últimas
    semanas de registros web (treinta días, para investigar un incidente)
    o el registro de seguridad de los últimos doce meses. Una política de
    conservación es un máximo y un mínimo. En un servidor real, ahora los
    restaurarías desde una copia de seguridad; aquí, vuelve a empezar el
    capítulo (o usa la instantánea de rescate) y borra solo lo que es más
    antiguo de lo que permite la política.
kept-forever-event-rotation =
    logrotate ya no guarda más de treinta días de registros de acceso.
    Pero logrotate solo actúa en la próxima rotación, y solo quita el
    registro que supera su cuenta: los años de archivos que dejó atrás una
    cuenta más alta se quedan donde están. Vuelve a mirarlos (ls, o find
    -mtime).
kept-forever-event-leftovers =
    logrotate se ha ejecutado con la nueva cuenta, y siguen ahí { $count }
    archivos antiguos: solo quita el archivo que supera la cuenta (y, con
    maxage, los antiguos dentro de cuenta + 1), nunca los cientos de
    archivos que quedaron más allá. Quita tú lo que tiene más de treinta
    días, con cuidado: find /var/log/nginx -mtime +30 los lista antes de
    que borres nada.
kept-forever-event-purged =
    No queda nada de más de treinta días en /var/log/nginx, y las semanas
    recientes siguen ahí. El pasado está en regla; ahora el presente: cada
    línea nueva sigue llevando la dirección completa del visitante.
kept-forever-event-log-off =
    access_log off: nginx ya no escribe ningún registro de acceso. Sin
    direcciones, claro, pero tampoco ninguna forma de investigar un
    incidente, y la política pide treinta días de ellos. Conserva el
    registro, con la dirección truncada (man nginx: map, log_format).
kept-forever-event-v6-whole =
    Las direcciones IPv4 están truncadas, pero los visitantes IPv6 siguen
    apareciendo con su dirección completa: algunos visitantes del coro
    llegan por IPv6 (2001:db8:…). Tu map tiene que tratar las dos, o
    recurrir a un valor por defecto que no revele nada.
kept-forever-event-not-loaded =
    La configuración de los archivos trunca las direcciones, pero el nginx
    en marcha sigue usando la configuración que cargó: nginx -t, luego
    recárgalo (systemctl reload nginx).
kept-forever-event-anonymised =
    Los visitantes nuevos aparecen en access.log con una dirección
    truncada (el último byte de una dirección IPv4, todo lo que sigue al
    segundo grupo de una IPv6): suficiente para ver una red que inunda el
    sitio, no para señalar un hogar. Queda el diario del sistema.
kept-forever-event-vacuum-only =
    Los archivos antiguos del diario han desaparecido, pero nada le dice
    a journald que guarde el diario treinta días: volverá a crecer. La
    política va en su configuración (man journald.conf: MaxRetentionSec=).
kept-forever-event-journal-not-loaded =
    MaxRetentionSec= está en el archivo, pero journald lee su
    configuración al arrancar: reinícialo (systemctl restart
    systemd-journald).
kept-forever-event-journal =
    journald guarda ahora treinta días, y ha quitado los archivos
    archivados más antiguos.
kept-forever-event-end =
    Amara: «¡Gracias! Le diré a la junta que ahora hacemos lo que decimos.
    Me pregunto qué más guardamos sin saberlo…»

    ¡Bien hecho! Has terminado el capítulo «Guardado para siempre».

    QUÉ HA PASADO
    La política de la junta prometía treinta días de registros web con
    las direcciones truncadas, y treinta días de diario. El logrotate de
    Ruben guardaba diez años de registros semanales, con la dirección IP
    completa de cada visitante, y el diario se remontaba a 2027.
    Configuraste logrotate a treinta días, quitaste los archivos que nunca
    habría quitado solo, truncaste las direcciones que escribe nginx con
    un map y un log_format, y diste a journald un MaxRetentionSec=,
    conservando el registro de seguridad del área de miembros, que ya
    estaba bien.

    BUENA PRÁCTICA
    - Limitación del plazo de conservación (RGPD, artículo 5.1.e): los
      datos personales no se guardan más tiempo del que necesita su
      finalidad. Una dirección IP es un dato personal.
    - Un plazo de conservación se configura en la herramienta que guarda
      los datos (logrotate, journald), no en un recordatorio: así se
      cumple cada día.
    - Cambiar la cuenta de logrotate no limpia el pasado: solo quita el
      archivo que supera la cuenta. Comprueba con find -mtime antes de
      borrar.
    - Minimiza en el origen: una dirección truncada en el registro mejor
      que una completa limpiada después. El registro de errores todavía
      contiene direcciones completas: mantenlo corto también, o en un
      nivel que registre menos.
    - Una política también es un mínimo: el registro de seguridad de los
      últimos doce meses se queda, para responder «¿quién inició sesión?»
      tras un incidente.

    DOCUMENTACIÓN
    - RGPD, artículo 5: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - La CNIL (la autoridad francesa de protección de datos): https://www.cnil.fr/
    - El módulo de registro de nginx: https://nginx.org/en/docs/http/ngx_http_log_module.html
    - El módulo map de nginx: https://nginx.org/en/docs/http/ngx_http_map_module.html
    - logrotate(8): https://man7.org/linux/man-pages/man8/logrotate.8.html
    - journald.conf(5): https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html

## Lo que comparten los tres capítulos de la historia (miembros, política, páginas): guardado aquí para que se cargue con la historia.

choir-list-locale = es
choir-policy-marker = CUÁNTO TIEMPO GUARDAMOS LOS DATOS PERSONALES

# Personas inventadas (el rango de números de teléfono que Ofcom reserva a la ficción, dominios .example): id|first_name|last_name|email|phone|voice|joined_on|left_on|address
choir-members =
    1|Amara|Okafor|amara.okafor@mail.example|07700 900101|contralto|2025-09-01||calle del Molino 3, La Ribera
    2|Kenji|Watanabe|kenji.watanabe@mail.example|07700 900102|bajo|2025-09-01||camino de los Huertos 27, La Ribera
    3|Gwen|Hughes|gwen.hughes@mail.example|07700 900103|soprano|2024-09-02|2027-06-30|calle de la Presa 8, La Ribera
    4|Mateus|Silva|mateus.silva@mail.example|07700 900104|tenor|2025-09-01||calle del Canal 41, La Ribera
    5|Leila|Haddad|leila.haddad@mail.example|07700 900105|soprano|2026-01-12||camino de la Barca 12, La Ribera
    6|Oskar|Lindqvist|oskar.lindqvist@mail.example|07700 900106|bajo|2026-09-07||plaza de las Garzas 5, La Ribera
    7|Nadia|Petrova|nadia.petrova@mail.example|07700 900107|contralto|2026-09-07||calle de la Esclusa 19, La Ribera
    8|Samuel|Mensah|samuel.mensah@mail.example|07700 900108|tenor|2025-09-01|2028-06-30|orilla de los Sauces 2, La Ribera
    9|Chloe|Martin|chloe.martin@mail.example|07700 900109|soprano|2027-09-05||cuesta de la Estación 33, La Ribera
    10|Arjun|Mehta|arjun.mehta@mail.example|07700 900110|bajo|2027-09-05||calle del Muelle 7, La Ribera
    11|Fatima|Idrissi|fatima.idrissi@mail.example|07700 900111|contralto|2027-09-05||paseo de las Gabarras 16, La Ribera
    12|Brendan|Walsh|brendan.walsh@mail.example|07700 900112|tenor|2026-09-07|2028-12-15|plaza de los Juncos 9, La Ribera
    13|Yuki|Tanaka|yuki.tanaka@mail.example|07700 900113|soprano|2028-01-10||mirador del Prado 21, La Ribera
    14|Rosa|Delgado|rosa.delgado@mail.example|07700 900114|contralto|2028-09-03||camino de Sirga 4, La Ribera
    15|Ivan|Horvat|ivan.horvat@mail.example|07700 900115|bajo|2027-09-05|2029-06-30|calle del Puente 11, La Ribera
    16|Aisha|Bello|aisha.bello@mail.example|07700 900116|soprano|2028-09-03||calle del Molino 28, La Ribera
    17|Tom|Becker|tom.becker@mail.example|07700 900117|tenor|2028-09-03||avenida de los Tilos 6, La Ribera
    18|Mei|Lin|mei.lin@mail.example|07700 900118|contralto|2029-01-14||cuesta del Martín Pescador 30, La Ribera
    19|Pablo|Ortega|pablo.ortega@mail.example|07700 900119|bajo|2028-09-03|2030-06-30|camino de la Compuerta 15, La Ribera
    20|Ingrid|Solberg|ingrid.solberg@mail.example|07700 900120|soprano|2029-09-08||calle de los Mimbres 2, La Ribera
    21|Kwabena|Asante|kwabena.asante@mail.example|07700 900121|tenor|2029-09-08||calle del Embarcadero 18, La Ribera
    22|Hannah|Weiss|hannah.weiss@mail.example|07700 900122|contralto|2029-09-08|2030-12-20|calle del Lucio 23, La Ribera
    23|Sofia|Rossi|sofia.rossi@mail.example|07700 900123|soprano|2029-09-08||camino de la Polla de Agua 10, La Ribera
    24|Daniel|Cohen|daniel.cohen@mail.example|07700 900124|bajo|2030-01-12||calle del Canal 37, La Ribera
    25|Lucia|Moreno|lucia.moreno@mail.example|07700 900125|contralto|2030-01-12||camino de la Barca 1, La Ribera
    26|Omar|Farouk|omar.farouk@mail.example|07700 900126|tenor|2030-09-07||plaza de las Garzas 13, La Ribera
    27|Priya|Raman|priya.raman@mail.example|07700 900127|contralto|2030-09-07||plaza de los Olmos 14, La Ribera
    28|Elif|Kaya|elif.kaya@mail.example|07700 900128|soprano|2030-09-07||calle de la Esclusa 9, La Ribera
    33|Minh|Tran|minh.tran@mail.example|07700 900133|bajo|2030-09-07||calle del Muelle 26, La Ribera
    36|Grace|Mwangi|grace.mwangi@mail.example|07700 900136|soprano|2031-01-11||calle de la Presa 5, La Ribera
    41|Tomas|Novak|tomas.novak@mail.example|07700 900141|tenor|2029-09-08||paseo de las Gabarras 22, La Ribera

# Personas que se suscribieron al boletín en el sitio sin ser miembros: email|date.
choir-newsletter-public =
    jo.bright@post.example|2029-11-02
    sam.okonjo@post.example|2030-05-17
    lee.harper@post.example|2030-12-06

# La exportación de Ruben para la cadena telefónica, octubre de 2030 (Priya vivía entonces en otro sitio).
choir-phone-tree =
    nombre,cuerda,telefono,direccion
    Amara Okafor,contralto,07700 900101,calle del Molino 3
    Kenji Watanabe,bajo,07700 900102,camino de los Huertos 27
    Mateus Silva,tenor,07700 900104,calle del Canal 41
    Leila Haddad,soprano,07700 900105,camino de la Barca 12
    Nadia Petrova,contralto,07700 900107,calle de la Esclusa 19
    Arjun Mehta,bajo,07700 900110,calle del Muelle 7
    Rosa Delgado,contralto,07700 900114,camino de Sirga 4
    Tom Becker,tenor,07700 900117,avenida de los Tilos 6
    Ingrid Solberg,soprano,07700 900120,calle de los Mimbres 2
    Omar Farouk,tenor,07700 900126,plaza de las Garzas 13
    Priya Raman,contralto,07700 900127,cuesta del Martín Pescador 3
    Elif Kaya,soprano,07700 900128,calle de la Esclusa 9

choir-purge-comment = Borra lo que nuestra política de conservación dice que ha caducado (Ruben, 2029).

choir-policy =
    RIVERSIDE COMMUNITY CHOIR
    CUÁNTO TIEMPO GUARDAMOS LOS DATOS PERSONALES
    Adoptada por la junta el 14 de septiembre de 2029. Revisada cada septiembre.

    Solo guardamos los datos personales el tiempo que los necesitamos para
    la finalidad con la que los recogimos (RGPD, artículo 5.1.e). Cuando se
    cumple el plazo, se borran, o se anonimizan para que nadie pueda ser
    identificado a partir de ellos.

    Qué                                   Cuánto tiempo                     Por qué
    ------------------------------------  --------------------------------  ----------------------------------
    Fichas de miembros (perfil, contacto) mientras sea miembro, y 2 años    para dar la bienvenida a quien vuelve
    Asistencia a los ensayos              2 años                            organización, el seguro de la sala
    Cuotas y pagos                        10 años                           documentos contables (la ley)
    Foto y formulario de consentimiento   mientras sea miembro              consentimiento
    Dirección del boletín                 hasta la baja                     consentimiento
    Registros de acceso del servidor web  30 días, direcciones truncadas    seguridad: lo bastante para
                                                                            investigar un incidente, no más
    Registro de seguridad del área de     12 meses                          investigaciones de seguridad
    miembros (auditoría)
    Diario del sistema                    30 días                           seguridad, resolución de problemas
    Copias de seguridad                   3 meses de copias semanales       recuperación tras un incidente
                                          (los datos borrados desaparecen
                                          de ellas a medida que caducan)

    Solicitudes de los miembros (una copia de sus datos, una corrección,
    un borrado): respondidas en el plazo de un mes (RGPD, artículo 12.3).
    Amara las recibe y las pasa a quien administra el servidor.

choir-page-index =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Riverside Community Choir</title></head>
    <body>
    <h1>Riverside Community Choir</h1>
    <p>Cuarenta voces, sin prueba de acceso, ensayos todos los martes a las 19:30 en la sala de Lock Street.</p>
    <p><a href="/concerts.html">Conciertos</a> · <a href="/join.html">Únete</a> · <a href="/members/login">Área de miembros</a></p>
    </body>
    </html>
choir-page-concerts =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Conciertos — Riverside Community Choir</title></head>
    <body>
    <h1>Conciertos</h1>
    <p>Concierto de primavera: sábado 12 de abril de 2031, 19:00, iglesia de St Anne. Entrada libre, donativos bienvenidos.</p>
    </body>
    </html>
choir-page-join =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Únete — Riverside Community Choir</title></head>
    <body>
    <h1>Únete</h1>
    <p>Ven a cualquier ensayo del martes: sin prueba de acceso, no hace falta leer partituras. La cuota es de 120 por temporada (60 reducida).</p>
    </body>
    </html>
choir-page-login =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Área de miembros</title></head>
    <body><h1>Área de miembros</h1><form method="post"><input name="email"><input name="password" type="password"><button>Entrar</button></form></body>
    </html>
