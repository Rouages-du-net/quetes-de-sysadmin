### Historia «El Centro de Datos», capítulo 4 «El gran incendio»:
### reconstruir un servidor a partir de las copias. Los comandos, las rutas,
### los nombres de archivo y los mensajes de apt, nginx y tar no se
### traducen. Las páginas HTML del sitio (fire-site-*) son de la
### mediateca: se traducen.

chapter-fire = El gran incendio
    .summary = El centro de datos ardió: volver a empezar desde una máquina vacía con las copias, apt, tar y nginx -t.

## Archivos

fire-email-awa =
    De:      Awa (responsable de operaciones)
    Para:    tú
    Asunto:  Incendio en el centro de datos: reconstruimos

    Anoche, hacia las 0:47, se declaró un incendio en el centro de datos de
    nuestro proveedor de alojamiento. No hay heridos. Pero la sala de
    nuestro servidor ardió: el servidor, sus discos y todo lo que había
    en ellos.

    Esta mañana el proveedor nos ha entregado una máquina nueva: una Debian
    limpísima, con el mismo nombre y la misma dirección IP (la han pasado
    a la máquina nueva). Tu cuenta está, con tu contraseña de siempre
    (bienvenida-2026). Nada más: ni nginx, ni sitio web.

    Por suerte, nuestras copias van cada noche a otro centro de datos, en
    otra ciudad. El proveedor las ha montado en /mnt/copia. Mi plan de
    recuperación también está ahí: PRD.txt.

    Estoy en el lugar con los bomberos. Vuelve a poner en línea el sitio
    de la mediateca y dime qué hemos perdido.
fire-drp =
    PLAN DE RECUPERACIÓN ANTE DESASTRES (PRD) — SITIO WEB DE LA MEDIATECA
    A seguir si se pierde el servidor: volvemos a empezar desde una
    máquina nueva.

    Copiado cada noche a las 0:30, en otro centro de datos:
      /etc/nginx/sites-available/medialibrary   el sitio, para nginx
      /etc/nginx/sites-enabled/medialibrary     el mismo, habilitado
      /etc/nginx/blocked.conf                  las direcciones bloqueadas
      /var/www/medialibrary/                    las páginas

    Un archivo comprimido por noche: /mnt/copia/medialibrary-AAAA-MM-DD.tar.gz

    Las rutas se guardan desde la raíz, sin la / inicial.

    1. Instalar nginx (paquete de Debian).
    2. Comprobar el archivo comprimido ANTES de extraerlo: listarlo entero.
    3. Extraerlo en su sitio, desde la raíz.
    4. Comprobar la configuración de nginx y luego recargarla.
    5. Probar con curl, pidiendo el sitio por su nombre.

    Los detalles de cada comando están en su manual (man apt, man tar,
    man nginx, man curl).

## El sitio de la mediateca (páginas restauradas)

fire-site-index-1 =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Mediateca del barrio</title></head>
    <body>
    <h1>Mediateca del barrio</h1>
    <p>Abierta de martes a sábado, de 10:00 a 18:00.</p>
    <p>El catálogo en línea volverá pronto.</p>
    </body>
    </html>
fire-site-index-2 =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Mediateca del barrio</title></head>
    <body>
    <h1>Mediateca del barrio</h1>
    <p>Abierta de martes a sábado, de 10:00 a 18:00.</p>
    <p>Vacaciones de otoño: apertura especial el domingo 25 de octubre, de 14:00 a 17:00.</p>
    <p>El catálogo en línea volverá pronto.</p>
    </body>
    </html>
fire-site-index-3 =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Mediateca del barrio</title></head>
    <body>
    <h1>Mediateca del barrio</h1>
    <p>Abierta de martes a sábado, de 10:00 a 18:00.</p>
    <p>Vacaciones de otoño: apertura especial el domingo 25 de octubre, de 14:00 a 17:00.</p>
    <p>Jueves 29 de octubre, 18:00: encuentro con una autora de cómic.</p>
    <p>El catálogo en línea volverá pronto.</p>
    </body>
    </html>
fire-site-hours =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Horario — Mediateca del barrio</title></head>
    <body>
    <h1>Horario</h1>
    <p>De martes a sábado, de 10:00 a 18:00. Cerrado domingos y lunes.</p>
    </body>
    </html>

## Eventos

fire-event-list-empty =
    Una máquina nueva aún no conoce ningún paquete: su lista de paquetes
    disponibles está vacía. Primero hay que descargarla de los repositorios
    de Debian. El manual te dice cómo: man apt.
fire-event-nginx =
    nginx está instalado, y ya está en marcha: en Debian, instalar un
    servicio lo arranca y lo habilita. Prueba curl http://localhost: es la
    página de bienvenida de nginx. El servidor web está; falta el sitio.
fire-event-truncated =
    «Unexpected EOF»: el archivo comprimido de anoche está cortado. La copia
    empezó a las 0:30; a las 0:47 se declaró el incendio y el envío se
    detuvo a medias. Mira su tamaño con ls -l, al lado de los demás.

    tar lee lo que viene antes del corte y luego se detiene: extraído, este
    archivo devolvería la configuración, pero ni una sola página del sitio.
    Una copia que nunca has vuelto a leer es solo una esperanza. Toma el
    último archivo comprimido que se lee hasta el final.
fire-event-bad-place =
    El archivo comprimido se ha extraído donde estabas: en tu carpeta, no
    en lugar de los archivos perdidos. nginx no los encontrará ahí. Vuelve
    a leer man tar: una opción permite elegir dónde extraer. (Puedes borrar
    lo que se ha extraído aquí.)
fire-event-duplicate =
    nginx rechaza la configuración: «a duplicate default server». Dos
    sitios quieren ser el sitio por defecto en el puerto 80: el de la
    mediateca, restaurado desde la copia, y el que Debian instala con
    nginx, en /etc/nginx/sites-enabled/. En el servidor antiguo solo había
    uno. ¿Cuál hay que conservar? (man nginx, y nginx -t después de cada
    cambio.)

    Buena noticia: mientras la nueva configuración sea rechazada, nginx
    conserva la anterior. El servidor no se cae.
fire-event-wednesday =
    El sitio responde… con la página del miércoles: falta el horario de las
    vacaciones, que Awa añadió el miércoles por la tarde. Este archivo
    comprimido no es el más reciente que está intacto.
fire-event-end =
    curl http://medialibrary.example responde: la mediateca vuelve a estar
    en línea, en una máquina que anoche no existía.

    Awa: «Gracias. Hemos perdido el trabajo del jueves: el anuncio del
    evento del jueves que viene estaba en la copia de anoche, la que cortó
    el incendio. Lo volveré a poner. Todo lo demás está, porque las copias
    estaban EN OTRO SITIO».

    ¡Bien hecho! Has terminado el capítulo 4 de El Centro de Datos. (Te
    espera un último capítulo, tres meses después: El certificado ha
    caducado.)

    QUÉ HA PASADO
    El incendio destruyó el servidor y sus discos. Lo que salvó el sitio:
    una copia cada noche, en otro centro de datos, y un plan de
    recuperación escrito de antemano. El último archivo comprimido, sin
    embargo, se cortó a mitad de escritura: sin tar -tzf, habrías
    restaurado un sitio medio vacío.

    No es ficción. En la noche del 9 al 10 de marzo de 2021, un incendio
    destruyó un edificio del centro de datos de OVHcloud en Estrasburgo
    (SBG2). Miles de clientes se vieron afectados, y algunos lo perdieron
    todo: sus copias estaban en el mismo lugar que sus servidores.

    BUENA PRÁCTICA
    - 3-2-1: tres copias, en dos soportes, una de ellas lejos (otra
      ciudad, no solo otro edificio).
    - Escribe el plan de recuperación ANTES del incendio, y pruébalo de
      verdad en una máquina vacía.
    - Vuelve a leer tus copias (tar -tzf) y vigila su tamaño: un archivo
      comprimido cortado parece un archivo comprimido.
    - Decide de antemano cuánto aceptas perder (aquí, un día) y en cuánto
      tiempo hay que volver a estar en marcha.
    - Una clave de host SSH que cambia: comprueba la nueva huella por otro
      medio antes de borrar la antigua (ssh-keygen -R).
    - sudo nginx -t antes de cada recarga; un solo default_server por puerto.

    DOCUMENTACIÓN
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - nginx, la línea de comandos: https://nginx.org/en/docs/switches.html
    - nginx, la elección del sitio: https://nginx.org/en/docs/http/request_processing.html
    - GNU tar: https://www.gnu.org/software/tar/manual/
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
