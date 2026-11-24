### Historia «El Café de Idiomas», capítulo «Vecino nuevo»: una persona
### que administra Debian ante una máquina Rocky Linux 10: /etc/os-release,
### dnf, systemctl, las configuraciones de ejecución y permanente de
### firewalld. Los comandos, las opciones, las rutas, las líneas de
### configuración y las salidas no se traducen.

chapter-new-neighbour = Vecino nuevo
    .summary = El pequeño servidor del café funciona con Rocky Linux, no con Debian: ni apt, ni ufw. Encuentra el gestor de paquetes y el cortafuegos de la otra familia, monta un servidor web y ábrelo de forma que siga abierto después de una recarga.

## Archivos

new-neighbour-message-dilnoza =
    De: Dilnoza (coordinadora, Lengua Común)
    Lunes 7 de diciembre, 18:30

    ¡Hola, y te damos la bienvenida a Lengua Común!

    Cada jueves por la tarde nuestro café organiza mesas de conversación
    gratuitas: árabe, darí, español, tigriña, ucraniano, vietnamita, y
    francés e inglés para todo el mundo. La pantalla junto a la puerta (la
    llamamos la pizarra) debería mostrar las mesas de la semana, desde
    nuestro propio servidorcito, tetera, en la trastienda.

    Seun, nuestro último informático, instaló tetera antes de irse tres
    meses a trabajar al extranjero. Dice que es «Rocky Linux, como en mi
    trabajo», cosa que a mí no me dice nada, y dice que tú conoces Debian.
    ¿Es lo mismo?

    ¿Podrías poner un servidor web en tetera esta noche, y comprobar que la
    pizarra llega hasta él? Itzel está terminando el sitio; lo pondrá en su
    sitio esta semana. Seun te ha dejado unas notas. sudo funciona con tu
    contraseña.

    ¡Gracias!
    Dilnoza

new-neighbour-notes-seun =
    Notas de Seun (tetera, 30 de noviembre)

    - tetera es Rocky Linux 10, una recompilación de Red Hat Enterprise
      Linux. El mismo Linux, el mismo systemd y journalctl, el mismo bash,
      pero no es Debian: mira /etc/os-release.
    - Paquetes: no es apt. Te he instalado nano, nada más.
    - El cortafuegos es firewalld, no ufw. Está en marcha, con los ajustes
      por defecto de una instalación nueva.
    - SELinux está activado (enforcing). Déjalo activado, por favor. En el
      trabajo nunca lo apagamos: arreglamos aquello de lo que se queja.
    - La pizarra (la pantalla junto a la puerta) es una cajita Debian en la
      red del café: ssh pizarra desde tetera, tu clave ya está puesta. Su
      navegador carga http://www.commontongue.example/ cada cinco minutos;
      en la red del café, ese nombre es tetera.

## Eventos

new-neighbour-event-debian =
    bash no conoce ese comando: tetera no es una Debian. Sus paquetes, su
    cortafuegos y su servidor web tienen otros nombres. Las notas de Seun
    dicen dónde mirar primero, y /etc/os-release dice de qué familia es
    tetera.

new-neighbour-event-rocky =
    Rocky Linux 10: la familia Red Hat, como RHEL, AlmaLinux y, algo más
    lejos, Fedora. Los paquetes vienen de repositorios a través de dnf (su
    manual: man dnf), el cortafuegos es firewalld (man firewall-cmd), y el
    paquete de Apache no es apache2 sino httpd.

new-neighbour-event-installed =
    httpd está instalado: su configuración está en /etc/httpd, sus páginas
    en /var/www/html, sus registros en /var/log/httpd. A diferencia de
    Debian, aquí instalar un servicio no lo arranca: en los sistemas Red Hat,
    un servicio nuevo espera a que lo arranquen y lo activen.

new-neighbour-event-running =
    httpd está en marcha, y volverá tras un reinicio. curl http://localhost/
    en tetera responde; la pizarra es otra historia: entre las dos está el
    cortafuegos.

new-neighbour-event-not-enabled =
    httpd está en marcha, pero no está activado: tras el próximo reinicio,
    la pantalla del café se quedaría en blanco. systemctl sabe hacer las dos
    cosas a la vez.

new-neighbour-event-blocked =
    Desde la pizarra, tetera rechaza al instante: la zona public de
    firewalld permite ssh, cockpit y dhcpv6-client, y rechaza el resto.
    firewall-cmd --list-all muestra lo que permite la zona; man firewall-cmd
    explica cómo añadir un servicio.

new-neighbour-event-runtime-only =
    La regla funciona ahora: está en la configuración de ejecución de
    firewalld. No está en la permanente: el próximo firewall-cmd --reload, o
    el próximo reinicio, cargará la configuración permanente y la olvidará.
    Compara firewall-cmd --list-all con firewall-cmd --permanent --list-all.

new-neighbour-event-permanent-only =
    La regla está en la configuración permanente, en
    /etc/firewalld/zones/public.xml. Pero firewalld sigue filtrando con su
    configuración de ejecución, que todavía no la tiene: nada cambia hasta
    una recarga.

new-neighbour-event-lost =
    La recarga ha cargado la configuración permanente en lugar de la de
    ejecución: lo que solo estaba en ejecución ha desaparecido. Para eso
    sirve --reload, y esa es la trampa de un cambio hecho solo en ejecución.

new-neighbour-event-firewall-off =
    firewalld no está en marcha (o no arrancará con la máquina): todos los
    puertos de tetera están abiertos a la red del café y a internet. Basta
    con abrir un servicio; vuelve a arrancar firewalld (y actívalo).

new-neighbour-event-selinux-off =
    SELinux ya no está en enforcing (setenforce, o /etc/selinux/config). No
    está entre la pizarra y httpd: lo que está ahí es el cortafuegos. Seun
    pidió que siguiera activado: vuelve a ponerlo.

new-neighbour-event-reached =
    La pizarra ha llegado a httpd: lo que muestra es la página de prueba de
    Rocky, la bienvenida que sirve httpd mientras /var/www/html no tiene
    index.html (con un estado 403: welcome.conf convierte ese rechazo en
    esta página). El sitio llegará.

new-neighbour-event-end =
    Dilnoza: «Thuy dice que la pantalla muestra una página que pone "Test
    Page" en letras grandes. ¡Me dicen que es buena señal!»

    ¡Bien hecho! Has terminado el capítulo «Vecino nuevo».

    QUÉ HA PASADO
    tetera funciona con Rocky Linux 10, de la familia Red Hat: dnf en lugar
    de apt, httpd en lugar de apache2, firewalld en lugar de ufw. Instalaste
    httpd con dnf, lo arrancaste y lo activaste con systemctl, y permitiste
    http y https en la zona public de firewalld, en ejecución y en la
    configuración permanente, para que la pizarra llegue a él ahora y
    después de una recarga o un reinicio.

    BUENA PRÁCTICA
    - Mira antes de teclear: /etc/os-release (o hostnamectl) dice en qué
      sistema estás, y por tanto qué herramientas tiene.
    - firewalld tiene dos configuraciones: la de ejecución (la que filtra
      ahora) y la permanente (la que cargan --reload y el próximo arranque).
      Cambia las dos: el comando con y sin --permanent, o la permanente y
      luego --reload, o la de ejecución y luego --runtime-to-permanent.
    - Permite un servicio por su nombre (http, https: firewall-cmd
      --info-service muestra sus puertos) en lugar de un puerto a secas: la
      regla dice por qué.
    - Comprueba desde donde están los usuarios (aquí, la pizarra): curl
      localhost en el servidor no atraviesa el cortafuegos.
    - Mantén SELinux en enforcing; los próximos capítulos tratan de convivir
      con él.

    OTRA MANERA
    nftables está debajo tanto de ufw como de firewalld (nft list ruleset
    muestra lo que ha construido firewalld). Escribir reglas nftables a mano
    también funciona, pero en una máquina Rocky firewalld es su dueño: usa
    una sola herramienta.

    DOCUMENTACIÓN
    - Rocky Linux, firewalld for beginners: https://docs.rockylinux.org/guides/security/firewalld-beginners/
    - firewall-cmd(1): https://firewalld.org/documentation/man-pages/firewall-cmd.html
    - DNF command reference: https://dnf.readthedocs.io/en/latest/command_ref.html
    - RHEL 10, Managing software with the DNF tool: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_software_with_the_dnf_tool/

## What the three chapters of the story share: kept here so that they load with the story.

language-cafe-site-index =
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Lengua Común: las mesas de la semana</title><link rel="stylesheet" href="/css/style.css"></head>
    <body class="common-tongue-site">
    <h1>Lengua Común</h1>
    <p>Mesas de conversación gratuitas, cada jueves desde las 18:30 en el café. Ven como eres: recién llegados y vecinos, todos los niveles son bienvenidos.</p>
    <p><a href="/tables.html">Las mesas de la semana</a></p>
    </body>
    </html>

language-cafe-site-tables =
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Las mesas de la semana</title><link rel="stylesheet" href="/css/style.css"></head>
    <body class="common-tongue-site">
    <h1>Las mesas del jueves</h1>
    <table>
    <tr><th>Mesa</th><th>Anima</th></tr>
    <tr><td>Árabe</td><td>Hamza</td></tr>
    <tr><td>Darí</td><td>Farida</td></tr>
    <tr><td>Español</td><td>Itzel</td></tr>
    <tr><td>Tigriña</td><td>Selam</td></tr>
    <tr><td>Ucraniano</td><td>Oksana</td></tr>
    <tr><td>Vietnamita</td><td>Thuy</td></tr>
    <tr><td>Francés e inglés</td><td>todo el mundo</td></tr>
    </table>
    </body>
    </html>

language-cafe-old-index =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Lengua Común</title></head>
    <body><p>Lengua Común: nuestro nuevo sitio llega pronto.</p></body></html>

language-cafe-rota =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Turnos del voluntariado</title></head>
    <body class="common-tongue-rota">
    <h1>Turnos del voluntariado (solo red del café)</h1>
    <p>Jueves: montaje a las 18:00 (Hamza, Thuy), té y café (Farida), cierre a las 21:00 (Itzel).</p>
    </body></html>

language-cafe-signup-page =
    <!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Hazte voluntario o voluntaria</title></head>
    <body class="common-tongue-signup">
    <h1>Colabora con Lengua Común</h1>
    <form method="post" action="/signup"><label>Tu nombre <input name="name"></label> <label>Los idiomas que hablas <input name="languages"></label> <button>Inscribirme</button></form>
    </body></html>

language-cafe-signup-readme =
    signup: la aplicación de inscripción del voluntariado (Tenzin)

    Una pequeña aplicación Python, lanzada por systemd (signup.service) con
    la cuenta signup. Solo escucha en 127.0.0.1:{ $port }: httpd es su
    puerta de entrada (ver /etc/httpd/conf.d/signup.conf).
