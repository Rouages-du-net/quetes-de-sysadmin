### Historia «El Albergue», capítulo «Token filtrado»: el token de una
### aplicación publicado en un foro público; lookup, el registro de
### auditoría, revoke, un token nuevo, un secreto rotado. Los comandos, las
### opciones, las rutas, los nombres de políticas y de tokens, las claves y
### la salida de OpenBao no se traducen.

chapter-leaked-token = Token filtrado
    .summary = Un voluntario pidió ayuda en un foro público y pegó la configuración del sitio de reservas, token incluido. Averigua de quién es ese token, qué hizo alguien con él, córtalo y cambia lo que se leyó, sin romper el sitio.

## Archivos

leaked-token-message-desta =
    De: Desta
    Lunes 22 de marzo, 16:45

    Malas noticias. Esta tarde a las 14:02, Nnamdi pidió ayuda en el foro
    público de quienes desarrollan Bunks, por un error de pagos, y pegó el
    principio de bunks.env, token incluido. Lo vi a las 16:40 y le pedí que
    borrara el mensaje, pero estuvo público más de dos horas. Tienes una
    copia en tu carpeta personal.

    ¿Qué podía hacer ese token, y lo usó alguien?

    Hiroko ya ha pedido una clave de API nueva al proveedor de pagos, por si
    acaso:

        { $key }

    La clave antigua sigue funcionando hasta que ella la revoque en el panel
    del proveedor: lo hará en cuanto le digas que Bunks usa la nueva.

    Desta

leaked-token-forum-post =
    forum.bunks.example › Ayuda › «página de pagos lenta tras la actualización»
    Publicado por nnamdi_h, lunes 22 de marzo, 14:02 (público)

    Hola a todo el mundo: desde la última actualización, la página de pagos
    del Bunks de nuestro albergue va muy lenta. Aquí está el principio de
    nuestra configuración, por si ayuda:

        { $env }

    ¿Alguna idea? ¡Gracias!

    Respuesta de una moderadora, 14:20: no publiquéis tokens ni contraseñas
    en público. ¡Edita tu mensaje!

## Eventos

leaked-token-event-resealed =
    OpenBao se ha reiniciado, así que ha vuelto sellado. Desta, Hiroko y
    Nnamdi han pasado a escribir sus fragmentos: vuelve a estar desellado.
    Las políticas y los tokens surten efecto al momento; OpenBao nunca
    necesita un reinicio para ellos.
leaked-token-event-identified =
    Es el token de Bunks (display_name token-bunks, políticas bunks y
    default), válido todavía durante semanas (ttl). Su accessor lo nombra
    sin revelarlo. Ahora: ¿qué hizo alguien con él?
leaked-token-event-hash =
    OpenBao ha calculado el HMAC del valor con la sal del dispositivo de
    auditoría: la misma cadena que el registro de auditoría escribe en lugar
    del token. Búscala en el registro (sudo grep, o jq).
leaked-token-event-traced =
    El registro de auditoría cuenta la historia: desde 203.0.113.77 a las
    14:31 (13:31 en el registro, que cuenta en UTC), el token filtrado se
    consultó a sí mismo, intentó listar secret/metadata/ (denegado), leyó
    secret/data/bunks/payments (permitido: es el secreto de Bunks), y se le
    negaron los datos bancarios de tesorería, las políticas y un token
    nuevo. La política estrecha aguantó; la clave de pagos, en cambio, se
    leyó.
leaked-token-event-revoked =
    El token filtrado está revocado: desde ahora se rechaza en todas partes.
    Bunks, que sigue funcionando, guarda sus secretos en memoria, pero su
    próximo arranque fallaría: necesita un token nuevo.
leaked-token-event-still-leaked =
    Bunks ha fallado: «permission denied». bunks.env sigue teniendo el token
    revocado. Un token nuevo para Bunks (la misma política), luego bunks.env,
    luego el reinicio.
leaked-token-event-lost-field =
    La última versión del secreto payments ya no tiene account: bao kv put
    escribe una versión entera solo con los campos dados. Bunks necesita los
    dos. bao kv patch cambia un campo y conserva los demás (o kv put con los
    dos; kv rollback recupera una versión anterior).
leaked-token-event-wrong-key =
    El secreto payments tiene ahora una clave que el proveedor no conoce. La
    clave nueva está en el mensaje de Desta.
leaked-token-event-db-touched =
    La contraseña de la base de datos ha cambiado en OpenBao, no en la base
    de datos: OpenBao solo la guarda, y Bunks ya no podría conectarse. Y el
    registro de auditoría muestra que el token filtrado nunca la leyó.
    Recupera la versión anterior (bao kv rollback -version=1, o kv patch con
    el valor antiguo).
leaked-token-event-rotated =
    El secreto payments tiene una versión nueva: la clave nueva, con el
    account conservado (bao kv metadata get lista las versiones). Bunks
    sigue usando la clave antigua, cargada al arrancar.
leaked-token-event-wide-app =
    Bunks funciona con un token que puede hacer más que leer sus dos
    secretos (bao token capabilities). Quien lo robe la próxima vez se
    llevará todo eso.
leaked-token-event-old-key-loaded =
    Bunks se reinició antes de que cambiara la clave: sigue usando la
    antigua. Reinícialo una vez más ahora que el secreto tiene la clave
    nueva.
leaked-token-event-switched =
    Bunks ha arrancado con un token nuevo y ha cargado la clave nueva.
leaked-token-event-end =
    Hiroko: «La clave antigua está revocada en el proveedor. No se cobró
    nada; los intentos son solo de esta tarde.»

    ¡Bien hecho! Has terminado el capítulo «Token filtrado».

    QUÉ HA PASADO
    El token de Bunks estuvo público dos horas. bao token lookup lo
    identificó (token-bunks, políticas bunks y default, un accessor). El
    dispositivo de auditoría había anotado cada petición con el token
    pasado por HMAC: bao write sys/audit-hash/file input=TOKEN dio el mismo
    HMAC, y grep o jq encontraron lo que hizo 203.0.113.77 a las 14:31: leyó
    secret/data/bunks/payments y se le negó todo lo demás, gracias a la
    política del capítulo anterior. El token se revocó, Bunks recibió uno
    nuevo, la clave de pagos que se había leído se rotó (una versión nueva,
    con el account conservado), Bunks se reinició para cargarla, y la clave
    antigua pudo revocarse en el proveedor. La contraseña de la base de
    datos, que nunca se leyó, se quedó como estaba.

    BUENA PRÁCTICA
    - Un secreto filtrado se revoca primero y se investiga después: el
      registro de auditoría dice qué hay que rotar, y qué no.
    - Mantén dispositivos de auditoría (dos en producción), enviados a otra
      máquina: OpenBao rechaza las peticiones que no puede auditar.
    - Rota en el origen y en la caja fuerte: una clave nueva del proveedor,
      una versión nueva en OpenBao, la aplicación reiniciada, y luego la
      clave antigua revocada.
    - kv put sustituye todo el secreto, kv patch cambia campos, y las
      versiones permiten volver atrás.
    - Los TTL cortos reducen lo que vale una filtración; no pegues nunca un
      archivo de entorno, y deja que un detector de secretos vigile tus
      mensajes y tus commits.

    OTRA MANERA
    Los secretos dinámicos: el motor database de OpenBao crea una cuenta por
    concesión y la borra cuando caduca, así que una credencial filtrada
    muere sola. El envoltorio de respuestas (response wrapping) entrega un
    secreto mediante un token de un solo uso.

    DOCUMENTACIÓN
    - bao token: https://openbao.org/docs/commands/token/
    - Los dispositivos de auditoría: https://openbao.org/docs/audit/
    - /sys/audit-hash: https://openbao.org/docs/api/system/audit-hash/
    - bao kv patch: https://openbao.org/docs/commands/kv/patch/
    - El envoltorio de respuestas: https://openbao.org/docs/concepts/response-wrapping/
