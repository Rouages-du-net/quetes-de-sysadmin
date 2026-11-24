### Historia «La Compañía de Danza», capítulo «El archivo grande»: una URL
### prefirmada para una semana con una clave propia, y un nodo de Garage
### averiado sustituido en el layout. Los comandos, las opciones, las rutas,
### los ID de nodo y las salidas no se traducen.

chapter-big-file = El archivo grande
    .summary = Un festival quiere la película de la gala de primavera, casi 4 GB, durante una semana. Compártela sin abrir el bucket al mundo. Y una de las tres máquinas que guardan los archivos de la compañía ha muerto: ¿están a salvo los datos, y cómo ocupa su lugar la máquina nueva?

## Archivos

big-file-message-farrukh =
    De: Farrukh (vídeo)
    Jueves 13 de mayo, 10:05

    ¡Hola! Zuri, que produce el festival Harbourlight, quiere la película
    completa de nuestra gala de primavera para su comité de selección: se
    reúnen la semana que viene. El archivo está en el bucket media:
    videos/spring-gala-2032-full.mp4 (3,8 GB, demasiado grande para un
    correo).

    Tiene que poder descargarla con un simple enlace, desde su oficina,
    durante una semana: sin cuenta, sin programas. ¿Puedes poner el enlace
    en ~/enlace_para_zuri.txt? Yo se lo enviaré.

    Prefiero no hacer público el bucket: nuestros ensayos también están en
    él.

    Farrukh

big-file-message-siosaia =
    De: Siosaia
    Miércoles 12 de mayo

    ¡Hola! La máquina que tiene porch, en mi casa, murió el martes por la
    mañana (el disco, creo: hace clic). Instalé Garage en mi ordenador de
    reserva, con el mismo garage.toml que el de Teodora (el mismo
    rpc_secret), y está conectado: sudo garage status debería mostrarlo.
    Tiene un disco de 4 TB. No me atreví a tocar el layout, Teodora decía
    que es la parte peligrosa. ¿Siguen a salvo nuestros datos?

    Siosaia

big-file-notes-teodora =
    Notas de Teodora (bastidores, el clúster)

    - replication_factor = 3: cada dato está en tres nodos, uno por zona:
      studio (bastidores), mill (vault), home (porch). Garage necesita dos
      respuestas de tres para leer o escribir (un quórum).
    - El layout es quién guarda qué: el rol de cada nodo (zona,
      capacidad). Los cambios primero se preparan (garage layout assign,
      remove), se muestran con garage layout show, y solo se aplican con
      garage layout apply --version N.
    - Un nodo se conoce por su ID (una larga cadena hexadecimal; bastan
      sus primeros caracteres en la línea de comandos), no por su nombre
      de máquina.
    - Compartir un archivo: aws s3 presign da un enlace firmado con una
      clave, que funciona durante un tiempo limitado.

## Eventos

big-file-event-failed-node =
    porch es un nodo averiado: todavía tiene su rol en el layout (zona
    home), y Garage no sabe nada de él desde hace dos días. La máquina
    nueva también está ahí, sana, con «NO ROLE ASSIGNED»: conectada, pero
    sin guardar nada. ¿Cuántas copias le quedan a cada dato?

big-file-event-safe =
    Se previeron tres copias, una por zona; con porch caído, quedan dos,
    en bastidores y vault. Garage lee y escribe con dos respuestas de
    tres: todo sigue funcionando. Pero un fallo más y los datos serían
    inaccesibles: el nodo nuevo debería ocupar pronto el lugar de porch.

big-file-event-too-long =
    Garage rechaza ese enlace: «X-Amz-Expires may not exceed a week». Una
    URL prefirmada (Signature Version 4) dura como mucho 604800 segundos,
    siete días; aws s3 presign firma cualquier duración sin comprobar, y
    el error solo aparece cuando alguien usa el enlace.

big-file-event-public-media =
    Con el acceso web, el punto de acceso web sirve todos los objetos de
    media a cualquiera, incluidos los ensayos y las fotos de niños, y
    durante todo el tiempo que nadie lo desactive. Un enlace que caduca,
    para este único objeto, hace el trabajo sin eso.

big-file-event-wide-key =
    Ese enlace funciona, pero piensa en su clave: una URL prefirmada actúa
    con los derechos de la clave que la firmó, y no se puede revocar por
    sí sola. Firmada con una clave que puede escribir, o que usan otras
    herramientas, la única forma de cortarla antes es quitar esos derechos
    a todos los que usan la clave. Una clave hecha para este envío, que
    solo puede leer media, se puede borrar el día que el comité termine.

big-file-event-local-url =
    Ese enlace nombra una máquina que solo conoce bastidores (localhost, o
    el propio bastidores): desde la oficina de Zuri, no lleva a ninguna
    parte. El punto de acceso público es s3.kestrel.example (el
    endpoint_url de ~/.aws/config).

big-file-event-read-key =
    Una clave que solo puede leer media: un enlace firmado con ella nunca
    puede escribir ni borrar nada, y borrar la clave revoca todos los
    enlaces que firmó.

big-file-event-shared =
    El enlace está listo: un objeto, una semana como mucho, firmado con
    una clave que solo puede leer media, en el punto de acceso público. El
    bucket sigue siendo privado.

big-file-event-staged =
    El cambio está preparado, no aplicado: garage layout show dice cómo
    sería el nuevo layout, y la versión que hay que dar a garage layout
    apply.

big-file-event-same-zone =
    El nodo nuevo está en la misma zona que otro: Garage coloca como mucho
    una copia por zona cuando puede, así que con dos zonas restantes, dos
    copias de cada dato acaban en un mismo edificio. Un incendio o una
    inundación allí, y desaparecen las dos. El sustituto de porch va en la
    zona de porch.

big-file-event-replaced =
    El nodo nuevo ha ocupado el rol de porch: otra vez tres nodos en tres
    zonas. Garage copia ahora en él los fragmentos que faltan (garage stats
    muestra la cola de resincronización); el antiguo porch ha salido del
    layout.

big-file-event-end =
    Farrukh: «Zuri la ha descargado en veinte minutos. ¡Gracias!»
    Siosaia: «garage status está todo en verde, y mi disco viejo puede
    jubilarse».

    ¡Bien hecho! Has terminado el capítulo «El archivo grande».

    QUÉ HA PASADO
    La película de la gala tenía que llegar a un festival sin hacer
    público el bucket media: creaste una clave que solo puede leer media y
    firmaste con ella una URL prefirmada, para una semana, lo máximo que
    permite Signature Version 4. Luego el clúster: porch había fallado, y
    sus datos todavía tenían dos copias de tres, suficiente para el quórum
    de Garage. Diste el rol de porch al nodo nuevo, en la misma zona, y
    aplicaste el nuevo layout.

    BUENA PRÁCTICA
    - Comparte un objeto, no un bucket: una URL prefirmada da un objeto,
      durante un tiempo limitado, a quien tenga el enlace (trátalo como
      una contraseña).
    - Fírmala con una clave hecha para el envío, de solo lectura: borrar
      la clave revoca el enlace antes de tiempo. Un enlace no puede durar
      más de siete días; para más, firma uno nuevo.
    - Mantén las réplicas en lugares distintos (zonas): el sustituto de un
      nodo va en su zona. Con tres copias, Garage sigue funcionando cuando
      un nodo está caído, pero repara antes del siguiente fallo.
    - Cambia un layout en dos pasos: prepara, lee garage layout show, y
      luego aplica con la versión que da.

    OTRA FORMA DE HACERLO
    garage layout remove seguido de garage layout assign hace lo mismo que
    --replace. Para un envío a largo plazo, un bucket aparte con acceso
    web y solo lo que debe ser público es una opción; Amazon S3 y MinIO
    también tienen políticas de bucket, que Garage no implementa.

    DOCUMENTACIÓN
    - aws s3 presign: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/presign.html
    - Las URL prefirmadas y sus siete días: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    - Garage, recuperarse de fallos: https://garagehq.deuxfleurs.fr/documentation/operations/recovering/
    - Garage, el layout del clúster: https://garagehq.deuxfleurs.fr/documentation/operations/layout/
