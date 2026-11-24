### Historia «El Centro de Datos», capítulo «Primer día»: primer día de
### prácticas, el sitio web de la mediateca no responde. Leer un registro
### de nginx, encadenar comandos con |, escribir con > y >>, detener un
### proceso, escribir en un archivo de root con sudo tee.
### Los comandos, las rutas y las direcciones IP no se traducen.

chapter-first-day = Primer día
    .summary = Leer el registro de un servidor, encadenar comandos con |, escribir con > y >>, detener un proceso.

## Archivos

first-day-email-awa =
    De:      Awa (responsable de operaciones)
    Para:    tú, en prácticas
    Asunto:  Bienvenida… ¡y es urgente!

    ¡Te damos la bienvenida al equipo! Llegas en el momento justo: desde las
    20:25, el sitio web de la mediateca responde con errores 503
    («Service Unavailable»).

    Estoy atrapada en una reunión. ¿Puedes investigar? El registro del
    servidor web está aquí:

      /var/log/nginx/access.log

    Cada línea es una visita: la dirección IP del visitante, la fecha, la
    página pedida y luego el código de respuesta (200 = OK, 503 = caído).

    1. ¿Cuántos errores 503 hay en el registro?
    2. ¿Quién envía tantas peticiones?
    3. Vuelve a poner el sitio en marcha y luego escríbeme un breve informe
       en ~/informe.txt: el número de errores 503 y la dirección del culpable.

    El registro tiene cientos de líneas: ¡no las cuentes a mano! Empieza
    por leer mis notas, ahí están los comandos que necesitas:

      cat notes_awa.txt

    Tu contraseña provisional (para sudo): bienvenida-2026
    Cámbiala pronto, ¡y no la apuntes en ningún sitio!
first-day-notes-awa =
    NOTAS DE AWA — COMANDOS DE CADA DÍA

      head archivo         el principio (10 líneas)  tail archivo   el final
      tail -f archivo      el final, y luego las líneas nuevas según llegan, en directo (Ctrl-C para parar)
      wc -l archivo        cuenta las líneas
      grep patrón archivo  las líneas que contienen el patrón

    La verdadera fuerza de Unix: la TUBERÍA |. La salida de un comando se
    convierte en la entrada del siguiente. Por ejemplo:

      grep " 503 " access.log | wc -l     cuenta las líneas que contienen «503»

    (las comillas conservan los espacios: buscamos «503» rodeado de espacios,
    para no dar con un 503 escondido dentro de una dirección o un tamaño).

    Para saber quién hace más peticiones:

      cut -d " " -f 1 archivo     se queda con el 1.er campo de cada línea (la IP)
      sort                        ordena las líneas
      uniq -c                     cuenta las líneas idénticas consecutivas
      sort -n                     ordena por número
      tail -3                     se queda con las 3 últimas (las mayores)

    Encadénalos todos con | . ¡Pruébalo!

    Escribir en un archivo:
      comando > archivo      SOBRESCRIBE el archivo con el resultado
      comando >> archivo     AÑADE el resultado al final

    ¿Se te olvidó sudo? No hace falta volver a escribirlo todo: sudo !!
    vuelve a ejecutar el último comando, con sudo delante. Y history muestra
    todo lo que has escrito.

    El servidor web (nginx) bloquea las direcciones listadas en
    /etc/nginx/blocked.conf, con el formato: deny DIRECCIÓN;
    Este archivo pertenece a root. Después de cambiarlo, hay que pedir
    a nginx que lo vuelva a cargar: sudo systemctl reload nginx
# Comentario al principio de /etc/nginx/blocked.conf (después de «#»)
first-day-blocked-comment = Direcciones bloqueadas por nginx (una regla por línea)
# Descripción del servicio, mostrada por «systemctl status catalogue»
first-day-service-catalogue = Catálogo en línea de la mediateca (php-fpm)

## Servicio reiniciado por systemd después de kill ({ $pid }: número del nuevo proceso)

first-day-restart-calm = systemd reinicia el servicio catalogue: nuevo proceso { $pid }. Con el robot bloqueado, se mantiene tranquilo.
first-day-restart-robot = systemd reinicia enseguida el servicio catalogue: nuevo proceso { $pid }… y el robot vuelve a empezar. ¡Ya está al 99 %!

## Eventos ({ $robot }: la dirección IP del robot; { $blocked }: ruta de blocked.conf)

# Empujoncitos, cuando se toma un camino demasiado largo (sin dar el comando).
first-day-event-all-read =
    ¡Cuántas líneas! Contarlas a mano llevaría una eternidad, y te
    equivocarías. Quien administra sistemas deja que cuente la máquina: en
    ~/notes_awa.txt, Awa apuntó una herramienta que se queda solo con las
    líneas que te interesan, y otra que cuenta líneas.
first-day-event-grep-only =
    Bien visto: grep se ha quedado solo con las líneas de errores 503. Pero
    siguen siendo muchas para contar. ¿Y si la salida de grep fuera
    directamente a un comando que cuenta líneas? Mira la tubería | en
    ~/notes_awa.txt.
first-day-event-addresses-only =
    Una dirección por línea… imposible ver cuál sale más a menudo.
    Ordénalas para que las idénticas queden seguidas y luego cuenta los
    duplicados: las notas de Awa encadenan cuatro pequeños comandos para eso.

# { $errors }: número de errores 503 del registro
first-day-event-account =
    Correcto: { $errors } errores 503. Acabas de encadenar dos pequeñas
    herramientas: grep filtra las líneas, wc las cuenta. Esa es toda la
    filosofía de Unix: herramientas sencillas que se enchufan unas a otras.

    Siguiente pregunta: ¿quién envía tantas peticiones? (mira ~/notes_awa.txt)
# { $requests }: número de peticiones del robot
first-day-event-robot =
    { $robot }: { $requests } peticiones en pocos minutos, todas a
    /catalogue/busqueda. Eso no es una persona: es un robot que rastrea
    el catálogo, y el servicio «catalogue» ya no da abasto.

    Mira lo que pasa en la máquina:  ps aux
first-day-event-override =
    El proceso 4242 (php-fpm: pool catalogue) usa el 99 % de la CPU.
    Podrías detenerlo con kill… pero si el robot sigue, volverá a caer
    enseguida. Primero bloquea el robot en /etc/nginx/blocked.conf.

    Este archivo pertenece a root, y  sudo echo … >> archivo  no funciona:
    la redirección >> la hace TU shell, no sudo. El truco clásico es tee,
    que escribe en un archivo todo lo que recibe:

      echo "deny { $robot };" | sudo tee -a { $blocked }
first-day-event-overwritten =
    ¡Uy! Las reglas antiguas de blocked.conf han desaparecido: el archivo
    se ha SOBRESCRITO (> o tee sin -a) en lugar de añadirle algo (>> o
    tee -a). Que no cunda el pánico: existe una copia de seguridad.
    Restáurala con sudo cp /etc/nginx/blocked.conf.bak { $blocked } y
    vuelve a intentarlo con -a.
first-day-event-rule = La regla está escrita. Pero nginx no vuelve a leer su archivo por sí solo: sudo systemctl reload nginx
first-day-event-blocked =
    nginx ha vuelto a cargar su configuración: { $robot } recibe ahora
    «403 Forbidden» en lugar de páginas.
# Variante cuando el proceso sobrecargado sigue en marcha ({ $pid }: su número)
first-day-event-blocked-process =
    nginx ha vuelto a cargar su configuración: { $robot } recibe ahora
    «403 Forbidden» en lugar de páginas. Queda el proceso { $pid }, atascado
    al 99 %: detenlo (pertenece a www-data, así que… sudo). systemd lo
    reiniciará limpio.
first-day-event-repaired =
    ¡El sitio de la mediateca vuelve a responder! Una última cosa: el
    informe para Awa, en ~/informe.txt. Con > creas el archivo, con >>
    añades una línea. Por ejemplo:

      grep " 503 " /var/log/nginx/access.log | wc -l > ~/informe.txt
      echo "Culpable: { $robot }" >> ~/informe.txt
first-day-event-report =
    Awa sale de su reunión y lee tu informe: «{ $errors } errores, robot
    identificado, bloqueado, servicio reiniciado. Para ser el primer día…
    ¡bien hecho!»

    FIN DEL CAPÍTULO «PRIMER DÍA».

    Ya sabes leer un registro (head, tail, grep), contar y ordenar
    (wc, cut, sort, uniq), encadenar herramientas con |, escribir en un
    archivo (> sobrescribe, >> añade) y gestionar procesos y servicios
    (ps, kill, systemctl). Son los gestos de cada día de quienes mantienen
    en marcha los servidores de internet.
