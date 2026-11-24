### El puesto: la máquina de partida, desde la que te conectas con ssh a las
### máquinas de las historias. Y el mensaje de bienvenida (motd) de cada máquina.

workstation-welcome =
    Te damos la bienvenida a tu puesto.

    Cada historia transcurre en una máquina de la red. Para conectarte a ella
    usas ssh (Secure Shell), como hacen cada día las personas que administran
    servidores. Empieza por el reino:

      ssh reino

    La primera vez, ssh te preguntará si confías en esta máquina: responde
    yes. Una vez dentro, el prompt cambia (tu@reino). Para
    volver aquí:

      exit

    Las máquinas que conoces están en ~/.ssh/config, y tus claves en la
    carpeta oculta ~/.ssh. Por ahora solo tienes la clave del reino;
    termina La Raíz (capítulo 3 de El Borrador) para recibir las demás. Para verlas:

      ls -a ~/.ssh
# Comentario al principio de ~/.ssh/config (cada línea se vuelve un comentario «#»)
workstation-config-comment =
    Las máquinas que conoces. «ssh reino» se conecta a reino.internal
    como el usuario tu con la clave ~/.ssh/id_reino.
    Manual: man ssh
# Comentario al principio del /etc/hosts del puesto (cada línea se vuelve un comentario «#»)
workstation-hosts-comment =
    Las máquinas de este juego son ficticias.
    Los nombres que terminan en .internal están reservados para las redes privadas (ICANN, 2024);
    los que terminan en .example, para los ejemplos (RFC 6761). Las direcciones 192.0.2.x,
    198.51.100.x y 203.0.113.x están reservadas para la documentación (RFC 5737).
    Ninguno de estos nombres ni direcciones lleva a nadie real.
workstation-exit = (Estás en tu propio puesto: exit cerraría tu terminal. Para conectarte a una máquina: ssh nombre, por ejemplo ssh reino.)
# { $keys }: la lista de las claves nuevas, separadas por comas
workstation-keys-received =
    🔑 El reino te da las gracias: te esperan claves SSH nuevas en tu
    puesto ({ $keys }). Vuelve allí (exit), mira ~/.ssh/config y
    conéctate a la máquina que elijas.
workstation-keys-received-next =
    🔑 Otra etapa: se abren más historias, sus claves te esperan en
    tu puesto ({ $keys }).

## Mensajes de bienvenida de las máquinas (motd), que se muestran al conectarse

machine-kingdom-motd = Reino — servidor de la farera. Acceso reservado a los viajeros que llevan una clave.
machine-datacenter-motd = Centro de datos — servidor web de la mediateca. Toda intervención queda registrada.
machine-anthill-motd = El Hormiguero — el ordenador del café asociativo. «¡Gracias por venir a ayudarnos!» (Kofi)
machine-manuscript-motd = Manuscrito — el ordenador de Inès. ¡No toques la novela sin una copia de seguridad!
machine-library-motd = Biblioteca del barrio — este servidor se apagará esta noche a medianoche.
machine-letters-motd = Las Cartas del Barrio — el servidor de la asociación. ¡Cuídalo bien, por favor!
machine-workshop-motd = El Taller — el servidor del fablab. Aquí se repara, se presta, se trastea.
machine-gazette-motd = La Gaceta del Barrio — el servidor del periódico. Publicamos con git push, no a mano.
machine-games-motd = La Ludoteca del Barrio — el servidor del voluntariado. Se juega, se presta y se guardan las piezas.
machine-radio-motd = Radio Barrio — el servidor de la emisora. De guardia: un ojo en la emisión y el otro en los registros.
machine-community-motd = Centro Cívico — la pasarela. Detrás: la wiki y el archivo.
machine-coop-motd = La cooperativa de consumo del barrio — el servidor de la caja. Aquí se comparte todo menos las contraseñas.
machine-hive-motd = La Colmena — el router del espacio asociativo. eth0: el router del operador; eth1: el switch.
machine-bakery-motd = El Obrador — el servidor de la panadería: el sitio web, la aplicación de pedidos y su base de datos. Por aquí ha pasado una auditoría.
machine-lab-motd = El Laboratorio — el servidor del club de fotografía: la galería y el archivo de los socios. Dos discos en RAID 1.
machine-garden-motd = Los Huertos Comunitarios — el sitio web y el correo de la asociación (gardens.example). ¡Cuida por igual los plantones y el servidor!
machine-pilot-motd = Los centros de barrio — la máquina de control: desde aquí, Ansible se ocupa de los servidores de los tres centros.
machine-patch-motd = El Parche — el taller comunitario de bicis (cycles.example). Un servidor recién estrenado, con Caddy. ¡Acuérdate de inflar las ruedas!
machine-canteen-motd = El Comedor — el servidor del comedor solidario: el menú del día y las reservas. Paga lo que puedas, comamos juntos.
machine-observatory-motd = El Observatorio — el servidor del club de astronomía: la galería de fotos y el apilado de las imágenes de la noche. ¡Cielos despejados!
machine-theatre-motd = El Teatro — el servidor del teatro del barrio: la taquilla y su base de datos. ¡Mucha mierda!
machine-valley-motd = Los Refugios — el servidor del valle: los registros de los refugios de montaña, reunidos en un solo sitio.
machine-nas-motd = El Club de Fotografía — el NAS del club: las fotos de cada álbum, compartidas con el laboratorio.
machine-oven-motd = El Bastión — el servidor de reparto de la Panadería: las rutas, los repartidores, los pedidos del día.
machine-projector-motd = El Otro Unix — el servidor del cineclub: la programación, las entradas y el viejo FreeBSD de Lucien.
machine-herbarium-motd = El Viejo Sun — el catálogo del banco de semillas desde 2009, en una Sun Fire V240. Por favor, no desenchufar.
machine-abacus-motd = El Lote Nocturno — el servidor de la Mutua: el proceso nocturno de las cuotas, en COBOL, sacado del mainframe de la gestoría.
machine-mill-motd = El Libro de Pedidos — el IBM i de la harinera (PASE, el lado Unix). tn5250 molino desde el puesto abre su pantalla verde.
machine-kneader-motd = El Obrador — servidor nuevo (migración), seis meses después de la auditoría. La vigilancia de seguridad, ahora sin Salomé.

# Al reconectarse a una máquina cuyo capítulo está en curso.
# { $file }: el archivo de bienvenida del capítulo (p. ej. bienvenida.txt)
resumed-chapter = Retomas este capítulo donde lo dejaste. Para volver a leer lo que te espera:   cat { $file }
machine-compass-motd = Windows al Lado — el servidor Linux del estudio de arquitectura. Su vecino, armario, es un Windows Server.
machine-stave-motd = La Escuela de Música — el servidor de archivos de la escuela, un Windows Server 2022 (OpenSSH llega a cmd.exe).
machine-register-motd = El Fichero — el controlador de dominio de las bibliotecas, un Windows Server 2022 (Active Directory, lending.internal).
machine-crate-motd = La Despensa — el servidor Debian de la tienda solidaria (sus archivos, su aplicación y el disco de copias que sale los viernes).
machine-quay-motd = El Transbordador — el servidor Debian de la cooperativa del transbordador, en IPv4 y en IPv6 (su sitio, su aplicación de reservas, su zona DNS ferry.example).
machine-gauge-motd = Las Bicis Compartidas — el servidor de monitorización de la cooperativa (Prometheus, su node exporter, el Alertmanager); sillin y buje están detrás.
machine-lane-motd = La Piscina — el servidor Debian de la piscina, un clúster k3s de un solo nodo (la aplicación de reservas, namespace swim).

machine-chalk-motd = La Sala de Profesores — el servidor de impresión de la escuela de primaria (CUPS): la secretaría, la biblioteca, la sala de profesores. Por favor, no imprimas dos veces el anuario.
machine-mast-motd = Las Ondas — el servidor Debian de la federación de radios comunitarias: la intranet, el archivo, el portal de contribuciones y la autoridad de certificación de la federación en /srv/ca.
machine-anvil-motd = La Biblioteca de Herramientas — la forja de Lendshed: Forgejo (https://forge.lendshed.example), su runner de Actions y los sitios de documentación y descargas. Sé amable con quien contribuye.
machine-hearth-motd = El Centro de Salud — el hipervisor del Centro de Salud de Millbrook (KVM, libvirt): aquí viven ledger, agenda, records y sus amigos. virsh list --all antes que nada.
machine-lb1-motd = La Donación de Sangre — lb1, el primer balanceador de carga del Servicio de Sangre de Lindenvale (keepalived, HAProxy) delante de donate.lindenvale.example. Su gemelo es lb2. ip a antes que nada.
machine-baton-motd = El Coro — batuta, el servidor del Coro Comunitario de Riverside: el sitio, el área de socios y su base de datos, y los datos de los miembros. La política de conservación está en /srv/choir/docs.
machine-trowel-motd = Los Huertos — paleta, el servidor de base de datos de la Asociación de Huertos de Greenholme (MariaDB): las reservas, los socios y la lista de espera de Plotline. sudo mariadb antes que nada.
machine-slipway-motd = El Bote Salvavidas — rampa, el servidor de correo de la estación de salvamento de Seaholme: Postfix recibe, rspamd puntúa, Dovecot guarda en /var/vmail. sudo tail /var/log/mail.log antes que nada.
machine-belay-motd = El Rocódromo — seguro, el servidor de Overhang, el rocódromo comunitario: reservas, abonos, las tarjetas de la puerta. Está en un SAI en el armario de la oficina (Network UPS Tools: upsc, upsmon).
machine-wings-motd = La Compañía de Danza — bastidores, el servidor de la Compañía de Danza Kestrel y un nodo de su clúster Garage. sudo garage status antes que nada; aws y rclone hablan con s3.kestrel.example.
machine-meadow-motd = El Refugio — pradera, el pequeño servidor de los Refugios de Animales de Hillside en una cooperativa de alojamiento: el repositorio restic (/srv/restic), el plan de recuperación ante desastres (/srv/drp) y el DNS primario oculto de la zona. cercado, el servidor principal, está en el sótano de Hillside.
machine-stile-motd = El Club de Senderismo — portillo, el servidor del club de senderismo Senderos Abiertos: Trailbook (salidas e inscripciones) en un contenedor detrás de nginx, https://walks.openpaths.example. Su cuenta: trailbook.
