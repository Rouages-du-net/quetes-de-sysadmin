### Historia «La Compañía de Danza», capítulo «El bucket público»: los
### documentos de los miembros se publicaron con el sitio web, desde el mismo
### bucket de Garage. Buckets, acceso web, claves y sus permisos, aws s3 mv,
### curl. Los comandos, las opciones, las rutas, los nombres de buckets y de
### claves, y las salidas no se traducen.

chapter-public-bucket = El bucket público
    .summary = Un padre encontró la lista de contactos médicos de la compañía con un buscador. El sitio web y los documentos de los miembros comparten un mismo bucket del almacén de objetos de la compañía: sepáralos, comprueba desde fuera y da a cada herramienta una clave que solo abra lo que necesita.

## Archivos

public-bucket-message-esperanza =
    De: Esperanza (directora artística, Kestrel Dance Company)
    Martes 9 de marzo, 9:20

    Hola, y gracias por venir tan rápido.

    Anoche me llamó el padre de una de nuestras jóvenes bailarinas:
    buscando nuestros horarios de clase, encontró una lista con los
    contactos de emergencia y las notas médicas de los niños, en la
    dirección de nuestro sitio web. Lo probé yo misma:
    https://www.kestrel.example/members/medical-contacts-2032.csv se abre
    para cualquiera.

    Nuestros archivos están en wings, donde estás ahora (sudo funciona con
    tu contraseña), y en las otras dos máquinas de lo que Teodora llamaba
    «el clúster». Teodora lo montó todo antes de mudarse y dejó notas.
    Hiroshi, que hizo el sitio web, lo publica con un pequeño script.

    Por favor, vuelve a hacer privados esos documentos, sin perder
    ninguno: la junta los necesita. Y el sitio web tiene que seguir en
    línea, ahí están las entradas de la gala de primavera.

    Esperanza

public-bucket-notes-teodora =
    Notas de Teodora (wings, 2029, con algunas actualizaciones desde entonces)

    - Nuestros archivos están en Garage, un almacén de objetos con una API
      S3, en tres nodos: wings (aquí, el estudio), vault (en el teatro del
      Old Mill, que tiene la fibra) y porch (en casa de Siosaia). Cada
      objeto se guarda en los tres. sudo garage status los muestra.
    - Garage guarda los objetos en buckets. sudo garage bucket list, sudo
      garage bucket info NOMBRE (lo que contiene, el acceso web, qué
      claves pueden usarlo).
    - Un programa llega a Garage con una clave de acceso (un ID que
      empieza por GK, y un secreto). Cada clave tiene permisos por bucket:
      read, write, owner. sudo garage key list, sudo garage key info
      NOMBRE.
    - El sitio web es el bucket www.kestrel.example, con «acceso web»: el
      punto de acceso web de Garage lo sirve a cualquiera, sin clave. La
      API S3 en sí nunca responde sin clave.
    - Clientes: la herramienta de línea de comandos de AWS (aws s3 ls,
      aws s3 cp…; sus claves en ~/.aws/credentials, su punto de acceso y
      su región en ~/.aws/config) y rclone (la copia de seguridad de la
      oficina: /etc/rclone/office.conf, ejecutada cada noche por
      office-backup.timer).
    - Le di a todo la clave troupe-admin. Es más sencillo.

## Eventos

public-bucket-event-exposed =
    Cualquiera puede leerlo: sin clave, sin contraseña. Antes de cambiar
    nada, averigua por qué Garage sirve este archivo. ¿En qué bucket está,
    y qué permite al punto de acceso web servir ese bucket al mundo?

public-bucket-event-website =
    Eso es: www.kestrel.example tiene acceso web, y con él el punto de
    acceso web de Garage sirve todos los objetos del bucket, bajo cualquier
    ruta, a cualquiera. El sitio web y los documentos de los miembros
    comparten ese bucket. El acceso web es todo o nada, para un bucket
    entero: los documentos necesitan un bucket propio, sin él.

public-bucket-event-deleted =
    Un documento de los miembros ha desaparecido de todos los buckets. La
    junta los necesita, y Garage no guarda ninguna versión anterior de un
    objeto (no tiene versionado): vuelve a empezar el capítulo (o usa la
    instantánea de rescate). Mueve los documentos a un bucket privado en
    lugar de borrarlos.

public-bucket-event-site-down =
    El sitio web ya no responde: www.kestrel.example debe conservar su
    acceso web y su index.html, ahí se venden las entradas de la gala. Los
    documentos salen del bucket; el sitio web se queda.

public-bucket-event-moved =
    Los documentos de los miembros ya solo están en buckets sin acceso
    web: el punto de acceso web no los servirá, y la API S3 solo responde
    con una clave que tenga un permiso sobre su bucket. Compruébalo desde
    fuera, igual que los encontró el padre.

public-bucket-event-closed =
    La dirección pública del documento responde ahora 404: el punto de
    acceso web ya no lo encuentra. Los buscadores quitarán el enlace.
    Ahora, la otra mitad del problema: una sola clave lo abre todo, y dos
    scripts la llevan.

public-bucket-event-too-wide =
    Esa clave puede hacer más que su trabajo: derechos de owner (podría
    cambiar el acceso web del bucket, o borrarlo), el derecho de crear
    buckets, o permisos sobre otros buckets. Si se filtra la máquina del
    script de despliegue o la configuración de la copia de seguridad, esa
    clave se filtra con ellas. Da a cada herramienta lectura y escritura
    en su propio bucket, nada más.

public-bucket-event-deploy-key =
    El despliegue del sitio usa ahora su propia clave: lectura y escritura
    en www.kestrel.example, nada más, y funciona.

public-bucket-event-backup-key =
    La copia de seguridad de la oficina usa ahora su propia clave: lectura
    y escritura en backups, nada más, y llega a su bucket.

public-bucket-event-end =
    Esperanza: «La lista ya no se abre, y el sitio sigue ahí. Voy a llamar
    al padre. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «El bucket público».

    QUÉ HA PASADO
    El sitio web era un bucket de Garage con acceso web, y los documentos
    de los miembros se habían puesto en el mismo bucket, bajo members/. El
    acceso web hace que el punto de acceso web de Garage sirva todos los
    objetos del bucket a cualquiera: los documentos eran públicos, y un
    buscador los había encontrado. Y una sola clave, con todos los
    derechos sobre todos los buckets, la usaban el script de despliegue y
    la copia de seguridad de la oficina. Moviste los documentos a un
    bucket privado, comprobaste su antigua dirección desde fuera, y diste
    a cada herramienta su propia clave con solo lo que necesita.

    BUENA PRÁCTICA
    - Un bucket por uso y por público: lo que es público, en un bucket
      propio, nunca al lado de archivos privados. Un prefijo («carpeta») no
      es una frontera: el acceso web, y los permisos, son por bucket.
    - Comprueba desde fuera (curl, una ventana privada): lo que sirve el
      punto de acceso web es lo que ve el mundo.
    - Una clave por programa, con el mínimo privilegio: lectura y escritura
      en su bucket, sin el bit owner, sin otro bucket. Una clave de
      administración se queda con quienes administran, fuera de los
      scripts.
    - Una clave filtrada se borra (garage key delete), no basta con
      sustituirla en un archivo. Garage no tiene versionado: un objeto
      borrado desaparece, así que piensa antes de rm, y guarda copias de
      seguridad.
    - Unos documentos que fueron públicos durante un tiempo pueden haberse
      copiado: avisa a las personas afectadas, como suele exigir la ley de
      protección de datos personales.

    OTRA FORMA DE HACERLO
    La compañía usa Garage, un pequeño servidor S3 geodistribuido escrito
    para el autoalojamiento por la asociación Deuxfleurs. MinIO es la
    alternativa más conocida, pero su edición comunitaria perdió su consola
    de administración en 2025 y ahora solo se distribuye como código fuente.
    Con MinIO o Amazon S3, un bucket también se puede hacer público con una
    política de bucket o con ACL, que Garage no implementa: el acceso web es
    su única puerta pública.

    DOCUMENTACIÓN
    - Garage, exponer sitios web: https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites/
    - Garage, buckets y claves: https://garagehq.deuxfleurs.fr/documentation/quick-start/
    - Compatibilidad S3 de Garage: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
    - aws s3 mv: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/mv.html
    - Los archivos de configuración de la AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

## Lo que comparten los tres capítulos, guardado aquí para que se cargue con
## la historia: el sitio web de la compañía, los documentos de los miembros
## (personas inventadas; los números de teléfono están en el rango del Reino
## Unido reservado a la ficción), los archivos del recurso compartido de la
## oficina.

troupe-site-index =
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <header><h1>Kestrel Dance Company</h1><nav><a href="/">Inicio</a><a href="/classes.html">Clases</a><a href="/agenda.html">Agenda</a></nav></header>
    <main>
    <p>Una compañía de danza comunitaria: clases para todas las edades, de 4 a 84 años, y una gala de primavera en el escenario del Old Mill.</p>
    <p><img src="/images/gala-2031.jpg" alt="La gala de 2031: cuarenta bailarines en el escenario"></p>
    <p>Gala de primavera, sábado 1 de mayo: entradas en el estudio y en este sitio.</p>
    </main>
    </body>
    </html>
troupe-site-agenda =
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Agenda, Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <main>
    <h1>Agenda</h1>
    <ul>
    <li>13 de marzo: clase abierta para principiantes</li>
    <li>3 de abril: empiezan los ensayos en el Old Mill</li>
    <li>1 de mayo: gala de primavera</li>
    </ul>
    </main>
    </body>
    </html>
troupe-site-classes =
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Clases, Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <main>
    <h1>Clases</h1>
    <p>Pequeños pasos (4-7): miércoles 16:30. Adolescentes: miércoles 18:00. Contemporáneo, adultos: jueves 19:30. Danza suave, mayores de 60: viernes 10:00.</p>
    </main>
    </body>
    </html>
troupe-site-404 =
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"><title>No encontrada</title></head>
    <body><main><h1>Esta página no existe</h1><p><a href="/">Volver a la página de inicio</a></p></main></body>
    </html>

troupe-doc-register =
    miembro,grupo,alta,cuota_pagada
    Ayo Bankole,adolescentes,2029-09,sí
    Ilka Carvalho,adultos,2031-01,sí
    Kalani Akana,pequeños pasos,2031-09,no
    Rasmus Ekholm,danza suave,2030-02,sí
    Wren Okonkwo,adolescentes,2032-01,sí
troupe-doc-medical =
    bailarín,grupo,contacto de emergencia,teléfono,notas médicas
    Kalani Akana,pequeños pasos,Malia Akana (madre),07700 900127,asma (inhalador en la mochila)
    Ayo Bankole,adolescentes,Folasade Bankole (tía),07700 900341,ninguna
    Wren Okonkwo,adolescentes,Chidi Okonkwo (padre),07700 900562,alergia a los frutos secos
    Rasmus Ekholm,danza suave,Saga Ekholm (hija),07700 900718,prótesis de rodilla 2030
troupe-doc-minutes =
    Reunión de la junta, 24 de febrero de 2032 (acta)
    Presentes: Esperanza, Anahera, Linh, Farrukh, Siosaia.
    1. Cuentas: llegó la subvención del consejo de las artes; el informe de 2031 se entrega el 15 de abril.
    2. Gala: el Old Mill está reservado para el 1 de mayo; Farrukh la grabará.
    3. Cuotas: dos familias pidieron la tarifa reducida, concedida.
troupe-doc-consent =
    miembro,fotos en el sitio web,fotos en la prensa
    Ayo Bankole,sí,no
    Ilka Carvalho,sí,sí
    Kalani Akana,no,no
    Rasmus Ekholm,sí,sí
    Wren Okonkwo,sí,no

troupe-office-report =
    Consejo de las artes: informe de actividad 2031, Kestrel Dance Company
    1. Clases: 6 clases semanales, 112 miembros (31 menores de 12 años, 27 mayores de 60).
    2. Gala de primavera 2031: 2 funciones, 640 entradas, 14 plazas gratuitas para familias del barrio.
    3. Actividades: 9 talleres en dos escuelas primarias y en el centro de día.
    4. Cuentas: subvención de 6000 gastada en el suelo del estudio y las luces de la gala (detalle en budget-2032.csv).
    Redactado por Anahera, tesorera.
troupe-office-report-template =
    Consejo de las artes: informe de actividad (PLANTILLA)
    1. Clases: [número de clases, de miembros]
    2. Funciones: [fechas, entradas]
    3. Actividades: [talleres]
    4. Cuentas: [uso de la subvención]
troupe-office-budget =
    partida,2031,2032 (previsto)
    alquiler del estudio,7200,7400
    profesorado,9800,10200
    gala (sala y luces),2650,2800
    reparación del suelo,3100,0
troupe-office-schedule =
    Ensayos de primavera, Old Mill
    Sábados del 3 al 24 de abril, 10:00-13:00: todos los grupos.
    Miércoles 28 de abril, 18:00: ensayo general.
troupe-office-hall =
    Al teatro del Old Mill: confirmamos la reserva de la sala principal
    para el sábado 1 de mayo de 2032, de 9:00 a 23:00, para nuestra gala de
    primavera.
troupe-office-running-order =
    Orden de la gala (borrador 3)
    1. Pequeños pasos: El nido del cernícalo
    2. Adolescentes: Cruces
    3. Danza suave: Té a las cuatro
    4. Adultos: Marea
    5. Todo el mundo: final
troupe-office-thanks =
    Queridos amigos de la panadería de Mill Lane, gracias por los
    pasteles en cada ensayo: los bailarines les mandan su más cálido
    agradecimiento.
troupe-office-joiners =
    nombre,grupo,inicio
    Noa Benali,adolescentes,2032-04
    Bea Ferreira,adultos,2032-04
troupe-office-old-plan =
    Plan de invierno (cancelado): ensayos en enero en el salón parroquial.
