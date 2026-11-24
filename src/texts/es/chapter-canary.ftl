### Historia «La Gaceta», capítulo 4 «El canario»: enviar una pequeña parte
### del tráfico a la nueva versión, y mirar los registros antes de ir más
### lejos. Los comandos, las rutas y los mensajes de nginx, curl y los
### registros no se traducen.

chapter-canary = El canario
    .summary = Una versión que pasa sus comprobaciones de salud pero falla en una página: un canario (una visita de cada diez), los registros, y el cambio solo cuando todo esté limpio.

## Archivos

canary-message-samia =
    Un mensaje de Samia:

    «Ha salido el Quiosco 1.6.0 (/srv/kiosk/versions/1.6.0), con una nueva
    búsqueda en el archivo. Verde sigue sirviendo la 1.5.0; la nueva
    versión irá en azul, como acordamos.

    Pero esta versión cambia muchas cosas, y /health no lo comprueba todo.
    Así que esta vez, nada de cambiarlo todo de golpe: primero un canario.
    Una visita de cada diez para azul, el resto para verde, y miramos lo
    que recibe el público (/var/log/nginx/access.log) antes de ir más
    lejos. man nginx explica cómo repartir entre dos servidores
    (upstream, weight).

    Para sudo: gazette-2027.»
canary-notes-160 =
    Quiosco 1.6.0 — notas de versión

    Novedad: búsqueda en los boletines anteriores (/archives).
    No hay nada que cambiar en la configuración.
canary-notes-161 =
    Quiosco 1.6.1 — notas de versión

    Corrección: la página del archivo (/archives) respondía 500 cuando la
    búsqueda estaba vacía. ¡Gracias al equipo de la Gaceta por el aviso!

## Eventos

# { $visits }: el número de visitas simuladas
canary-one-time =
    Pasa una hora: { $visits } visitas al Quiosco, a través de nginx.
    Todo está escrito en /var/log/nginx/access.log.
# { $errors }: el número de visitas que han recibido un error
canary-event-all-at-once =
    Todo el tráfico ha pasado a la 1.6.0 de golpe… y { $errors } visitas
    de esa hora han recibido un error 500: le ha tocado a todo el mundo.
    Eso es lo que habría evitado el canario. Vuelve a verde (proxy_pass,
    nginx -t, reload), y luego prueba con una pequeña parte del tráfico.
canary-event-canary-160 =
    El canario está en su sitio: azul (1.6.0) recibe una pequeña parte de
    las visitas. Ahora mira lo que ha recibido el público: los códigos de
    respuesta están en access.log (el número después de la petición: 200,
    404, 500…). grep o awk te ayudan a ordenarlos.
canary-event-too-big =
    Una gran parte del tráfico va a la nueva versión: si tiene un
    problema, lo verá mucha gente. Un canario es una parte pequeña (una
    visita de cada diez, o menos): weight=1 frente a weight=9.
canary-event-found =
    ¡Errores 500 en /kiosk/archives! Deben de venir de azul: verde lleva
    semanas sirviendo la misma página. Pruébalo directamente en cada
    instancia (curl http://localhost:3001/archives, y luego 3002) para
    estar seguro. /health no comprobaba esta página. Detén el canario: ni
    una visita más para azul (down, o quita el servidor).
canary-event-stopped =
    Canario detenido: solo una visita de cada diez vio el error, durante
    una hora, en lugar de todo el mundo. Samia transmite el problema al
    equipo de desarrollo… que publica enseguida la 1.6.1
    (/srv/kiosk/versions/). Vuelve a empezar: azul, /health, canario,
    registros.
canary-event-canary-161 =
    Una hora de canario con la 1.6.1: ningún error en este lote de
    visitas. La nueva versión puede llevarse todo el tráfico. Deja verde
    en marcha, por si acaso.
canary-event-end =
    Todo el Quiosco pasa por la 1.6.1, sin errores, y verde espera en la
    reserva. Samia: «El primer intento solo molestó a una visita de cada
    diez, durante una hora. Sin canario, se lo habríamos servido a todo
    el mundo».

    ¡Bien hecho! Has terminado el capítulo 4 de La Gaceta. (Te espera lo
    siguiente: ssh gaceta.)

    QUÉ HA PASADO
    La 1.6.0 respondía bien en /health, pero fallaba en una página
    concreta. Un upstream de nginx envió una pequeña parte de las visitas
    a la nueva versión (weight=1 frente a weight=9): los errores
    aparecieron en access.log, solo para unas pocas personas. Se detuvo el
    canario, se esperó la corrección, se volvió a lanzar un canario
    limpio, y luego se cambió todo.

    BUENA PRÁCTICA
    - Un canario: una pequeña parte del tráfico (un pequeño %), durante
      un tiempo fijado, con criterios de parada decididos de antemano
      (tasa de 5xx).
    - Mira lo que ve el público (los registros de acceso), no solo /health.
    - Hay que poder detener el canario en un solo gesto (down, reload).
    - Aumenta por etapas (10 %, 50 %, 100 %); deja la versión antigua en
      marcha hasta el final.
    - Para saber qué servidor atendió cada visita, añade $upstream_addr al
      formato del registro (log_format).

    DOCUMENTACIÓN
    - upstream y weight: https://nginx.org/en/docs/http/ngx_http_upstream_module.html
    - Despliegue canario: https://martinfowler.com/bliki/CanaryRelease.html
    - Canarying releases (Google SRE): https://sre.google/workbook/canarying-releases/
