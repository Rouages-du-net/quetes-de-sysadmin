### Historia «El Coro», capítulo «La solicitud de acceso»: una miembro pide
### una copia de todos los datos que el coro tiene sobre ella (RGPD,
### artículo 15). psql (WHERE, --csv), grep -r, zgrep, find, cp. Los
### comandos, las opciones, las rutas y las salidas no se traducen.

chapter-access-request = La solicitud de acceso
    .summary = Una contralto pide al coro una copia de todo lo que tiene sobre ella. Su fila en la tabla de miembros es la parte fácil: encuéntrala en todos los sitios donde el servidor la guarda, y envíale todo, y nada de nadie más.

## Archivos

access-request-message-amara =
    De: Amara (presidenta)
    Lunes 17 de marzo, 18:40

    Hola otra vez:

    Priya Raman, una de nuestras contraltos, nos ha escrito (su mensaje
    está en tu carpeta personal). Tiene derecho a ello, y tenemos un mes
    para responder.

    ¿Podrías reunir todo lo que el servidor tiene sobre ella en
    /srv/choir/solicitudes-rgpd/priya-raman/? Cualquier formato vale,
    mientras ella pueda leerlo; se lo enviaré por el área de miembros con
    una carta. Solo sus datos, por favor: nada sobre los demás.

    Amara

access-request-request-priya =
    De: Priya Raman
    Para: la junta del Riverside Community Choir
    Domingo 16 de marzo

    Estimada junta:

    En virtud del artículo 15 del RGPD, quisiera una copia de todos los
    datos personales que el coro tiene sobre mí, donde sea que se guarden,
    y saber cuánto tiempo los conservan.

    No pasa nada, ¡me encanta cantar con ustedes! Solo tengo curiosidad, y
    trabajo en protección de datos, así que me gusta predicar con el
    ejemplo.

    Un saludo,
    Priya Raman (contralto)

## Eventos

access-request-event-her-row =
    Esa es su ficha en la tabla de miembros: sus datos de contacto. Pero
    una aplicación de miembros rara vez guarda a una persona en una sola
    tabla. ¿Qué más contiene la base de datos (\dt), y qué tablas apuntan
    a ella, por su id o por su correo?
access-request-event-tables =
    Sus ensayos y sus cuotas también son suyos: cada fila que apunta a su
    id es un dato suyo. psql puede escribirlos directamente en un archivo
    (redirige su salida, o --csv para una hoja de cálculo).
access-request-event-backups =
    El volcado de anoche vuelve a contener sus datos, como toda copia de
    seguridad. No le envías las copias en sí (contienen los datos de todo
    el mundo), pero la respuesta debería decir que existen y cuánto tiempo
    se guardan: la política dice tres meses.
access-request-event-uploads =
    Su foto y su formulario de consentimiento, en los archivos subidos por
    los miembros (una carpeta por id de miembro). Son suyos: las copias
    van en la respuesta.
access-request-event-logs =
    Los registros también la mencionan: el registro de seguridad del área
    de miembros (el de este mes, y el del mes pasado, comprimido con gzip:
    zgrep lo lee), y el registro del correo (los boletines enviados a su
    dirección). Sus líneas son datos suyos; las demás líneas no.
access-request-event-old-copy =
    Una copia olvidada: la exportación de Ruben para la cadena telefónica,
    de octubre pasado, con su antigua dirección. Los datos que no sabías
    que tenías siguen siendo datos que tienes: van en la respuesta (solo
    su línea), y después el archivo ya no tiene razón de existir.
access-request-event-members-only =
    La respuesta contiene su ficha de la tabla de miembros, y nada más. La
    tabla de miembros es un sitio entre varios: sus ensayos, sus cuotas,
    el boletín, sus archivos subidos, los registros… Busca más amplio:
    grep -r con su correo, las tablas de la base de datos.
access-request-event-leak =
    La respuesta contiene datos de otros miembros (una dirección de correo
    o un número de teléfono que no es el suyo): un archivo entero copiado,
    una tabla sin WHERE, un registro sin grep. Enviarla sería en sí una
    violación de datos. Conserva solo sus líneas.
access-request-event-incomplete =
    La respuesta va tomando forma. Todavía falta: { $missing }.
access-request-part-member = su ficha en la tabla de miembros
access-request-part-attendance = sus ensayos
access-request-part-payments = sus cuotas
access-request-part-newsletter = su suscripción al boletín
access-request-part-photo = su foto
access-request-part-consent = su formulario de consentimiento
access-request-part-audit = sus líneas en el registro de seguridad (los dos meses)
access-request-part-mail = sus líneas en el registro del correo
access-request-part-phone-tree = su línea en la antigua exportación de la cadena telefónica
access-request-event-end =
    Amara: «Lo he leído todo antes de enviarlo: no tenía ni idea de que
    supiéramos tanto de quienes cantan con nosotros. Priya ya ha
    respondido: "Impresionante, y nada de nadie más. ¡Gracias!"»

    ¡Bien hecho! Has terminado el capítulo «La solicitud de acceso».

    QUÉ HA PASADO
    Priya ejerció su derecho de acceso. Sus datos no estaban solo en la
    tabla de miembros: sus ensayos y sus cuotas en otras dos tablas, el
    boletín, su foto y su formulario de consentimiento en los archivos
    subidos, sus líneas en dos registros (uno de ellos comprimido), y una
    exportación de la cadena telefónica con su antigua dirección que nadie
    recordaba. Lo reuniste todo, y solo lo suyo.

    BUENA PRÁCTICA
    - El derecho de acceso (RGPD, artículo 15) cubre todos los datos que
      se tienen sobre una persona, estén donde estén, y lo que se hace con
      ellos, durante cuánto tiempo, y quién los recibe. La respuesta se
      debe dar en el plazo de un mes (artículo 12.3).
    - Sabe dónde viven los datos personales antes de que nadie pregunte:
      un pequeño inventario (tablas, archivos, registros, exportaciones,
      copias de seguridad) convierte una solicitud en el trabajo de una
      tarde en lugar de una búsqueda del tesoro.
    - Busca por cada identificador: el id en la base de datos, el correo
      en los registros, el número de teléfono en una hoja de cálculo.
    - Responde a una persona, y solo a esa persona: una tabla sin WHERE o
      un registro entero en la respuesta es una violación de los datos de
      todos los demás.
    - Las exportaciones olvidadas son la fuga clásica: una vez enviada la
      respuesta, el archivo de la cadena telefónica debería desaparecer.
    - Las copias de seguridad contienen los mismos datos: dilo, y cuánto
      tiempo se guardan, en lugar de rebuscar en ellas.

    DOCUMENTACIÓN
    - RGPD, artículos 12 y 15: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - La CNIL: https://www.cnil.fr/
    - psql: https://www.postgresql.org/docs/16/app-psql.html
    - gzip y zgrep: https://www.gnu.org/software/gzip/manual/gzip.html
