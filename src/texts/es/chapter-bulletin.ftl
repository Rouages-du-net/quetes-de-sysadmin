### Historia «La Vigilancia», capítulo «El boletín»: clasificar los CVE de
### un boletín de seguridad semanal, decir cuáles afectan de verdad a este
### servidor. Los identificadores CVE son ficticios (CVE-2099-NNNNN, con la
### forma de los reales); los nombres de paquetes, los comandos y las rutas
### no se traducen. Los títulos de sección de la plantilla
### (bulletin-section-…) deben ser los de la plantilla.

chapter-bulletin = El boletín
    .summary = Clasificar un boletín de CVE: lo que afecta de verdad a este servidor, y lo que no es más que una falsa alarma.

## Archivos

# The Bakery's website (/var/www/bakery/index.html), as curl shows it.
watch-site-index =
    <!DOCTYPE html>
    <html lang="es">
    <title>La Panadería</title>
    <h1>La Panadería</h1>
    <p>Encarga tu pan en línea y recógelo en la tienda.</p>
    </html>

bulletin-email-salome =
    De:      Salomé
    Para:    tú
    Asunto:  La vigilancia, seis meses después

    ¡Hola!

    Han pasado seis meses desde la auditoría. El negocio ha crecido: has
    migrado a un servidor nuevo (amasadora), y Nadia ha vuelto a llamarme,
    esta vez no para volver a revisarlo todo, sino para ayudarte a crear un
    hábito: la vigilancia de seguridad. No voy a volver cada seis meses a
    comprobarlo todo por ti.

    Cada semana, una lista de correo que sigo (como los avisos de seguridad
    de Debian) envía un boletín de fallos corregidos recientemente. El de
    esta semana está en tu carpeta: boletin_seguridad.txt.

    Primera regla, y la más importante: una línea del boletín solo es una
    alerta si afecta de verdad a este servidor. Antes de preocuparte por un
    CVE, comprueba:
    - ¿el paquete está siquiera instalado aquí? (apt list --installed)
    - si lo está, ¿la versión instalada está en el rango afectado, o ya ha
      pasado la versión corregida?

    Clasifica lo que encuentres en vigilancia.md: lo que afecta a este
    servidor por un lado, lo que no tiene por qué preocuparte por otro (con
    el porqué).

    Salomé
    (Para sudo, tu contraseña es: masamadre-2028)

bulletin-file =
    BOLETÍN DE SEGURIDAD — semana del 8 de septiembre de 2028
    (CVE ficticios, con fines didácticos: ninguno existe de verdad)

    CVE-2099-41042 — nginx                                        [alta, 8.2]
    Elusión de las restricciones de acceso mediante una confusión de
    peticiones HTTP/2. Un servidor que hace de proxy inverso puede dejar
    pasar una petición hacia una ruta normalmente protegida.
    Versiones afectadas: nginx < 1.26.3-3+deb13u3
    Corregido en:        nginx 1.26.3-3+deb13u3

    CVE-2099-37715 — rsync                                        [crítica, 9.8]
    La extracción de un archivo especialmente preparado puede ejecutar
    código arbitrario con los derechos de la cuenta que ejecuta rsync.
    Versiones afectadas: rsync < 3.4.1+ds1-5
    Corregido en:        rsync 3.4.1+ds1-5

    CVE-2099-50288 — python3-certbot-nginx                        [media, 5.3]
    Durante la renovación de un certificado, la clave de la cuenta es
    legible brevemente por todas las cuentas del sistema (una fracción de
    segundo, lo que dura la escritura de un archivo).
    Versiones afectadas: python3-certbot-nginx < 3.5.0

    CVE-2099-12003 — curl                                         [media, 6.1]
    Al seguir una redirección con una cabecera especialmente preparada,
    curl puede leer más allá de la zona de memoria prevista (denegación de
    servicio).
    Versiones afectadas: curl ≤ 8.14.1-2
    Corregido en:        curl 8.14.1-3

    CVE-2099-29107 — openssh-server                                [media, 5.9]
    Canal lateral temporal en la autenticación «keyboard-interactive»
    (KbdInteractiveAuthentication): el tiempo de respuesta del servidor
    puede filtrar información sobre una contraseña que se está comprobando.
    Todavía no hay corrección en Debian; mientras tanto, desactiva
    KbdInteractiveAuthentication en sshd_config.
    Versiones afectadas: openssh-server (todas, si la opción está activada)

bulletin-template =
    # Vigilancia — la Panadería

    ## Afecta a este servidor
    (por completar: los CVE que se aplican de verdad, con su identificador)

    ## No aplicable
    (por completar: los CVE que no se aplican, con su identificador y el porqué)

bulletin-section-affected = Afecta a este servidor
bulletin-section-not-applicable = No aplicable
bulletin-a-complete = (por completar
bulletin-words-missing = no está instalado, no esta instalado, no instalado, no está, no esta, ausente, no existe ese paquete, no existe en este servidor, no hay tal paquete
bulletin-words-fixed = ya corregido, ya corregida, ya está corregido, ya esta corregido, ya al día, ya al dia, ya actualizado, versión instalada, version instalada, posterior a la versión corregida, posterior a la version corregida, más reciente, mas reciente

## Revisión

bulletin-review = Salomé revisa tu clasificación:
bulletin-missing-template = Todavía quedan líneas «(por completar)» de la plantilla.
bulletin-missing-concerns = En «Afecta a este servidor» tienen que estar exactamente nginx, rsync y openssh-server (ese se aplica, aunque aquí no haga falta nada más) — ni certbot ni curl pintan nada ahí.
bulletin-missing-not-applicable = En «No aplicable», explica el porqué de cada uno: certbot (comprueba si está siquiera instalado) y curl (compara la versión instalada con la versión corregida del boletín).

## Eventos

bulletin-event-read =
    Cinco líneas, cinco CVE. Antes de corregir nada: ¿cuáles afectan DE
    VERDAD a este servidor? apt list --installed te dice lo que está
    instalado aquí, y en qué versión (man apt).
bulletin-event-sort =
    Tu clasificación separa lo que merece atención de lo que no tiene por
    qué preocuparte: certbot no está en este servidor, curl ya ha pasado la
    versión corregida. Quedan nginx, rsync y openssh-server (ya protegido
    por la configuración, pero que conviene vigilar).
bulletin-event-end =
    Salomé: «Ese es el buen reflejo: leer antes de entrar en pánico. La
    mitad de un boletín de seguridad, normalmente, no te afecta».

    ¡Bien hecho! Has terminado el capítulo «El boletín».

    QUÉ HA PASADO
    Un boletín de seguridad lista fallos corregidos en programas muy usados;
    la mayoría no afectan a un servidor concreto (el paquete no está, o la
    versión instalada no está en el rango afectado). Clasificar antes de
    actuar evita entrar en pánico para nada, y reserva la atención para lo
    que importa de verdad.

    BUENA PRÁCTICA
    - Comprueba la instalación Y la versión antes de quedarte con un CVE
      (apt list --installed, nunca solo el nombre del paquete).
    - Un CVE que se aplica en teoría puede ser ya inofensivo gracias a una
      configuración que ya era prudente (aquí,
      KbdInteractiveAuthentication).
    - Deja constancia escrita de la clasificación: la próxima vigilancia se
      apoyará en ella, y otra persona tiene que poder releerla.

    OTRA MANERA
    Las grandes organizaciones usan un escáner de vulnerabilidades (OpenVAS,
    Nessus, o el Lynis que ya viste en «La Auditoría») que cruza
    automáticamente las versiones instaladas con una base de datos de CVE:
    eso elimina una parte del trabajo manual de este capítulo, sin eliminar
    la decisión de lo que merece la pena corregir.

    DOCUMENTACIÓN
    - Avisos de seguridad de Debian: https://www.debian.org/security/
    - CVE: https://www.cve.org/
    - CVSS (la calculadora de puntuación): https://www.first.org/cvss/calculator/4-0
