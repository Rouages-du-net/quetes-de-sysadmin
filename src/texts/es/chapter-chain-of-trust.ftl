### Historia «Las Ondas», capítulo «La cadena de confianza»: una CA
### emisora, un servidor que envía su certificado sin el intermedio,
### máquinas que no confían en la raíz. update-ca-certificates, la cadena de
### nginx, openssl s_client -showcerts y verify. Los comandos, las opciones,
### las rutas y las salidas no se traducen.

chapter-chain-of-trust = La cadena de confianza
    .summary = Kwame puso una autoridad intermedia bajo la raíz, Mateo escribió una comprobación de monitorización que está en rojo desde entonces, y el nuevo PC del estudio rechaza todos los sitios. Los certificados son válidos: lo que falta es confianza, y un eslabón de la cadena.

## Archivos

chain-of-trust-message-adaeze =
    De: Adaeze
    Lunes 18 de marzo, 9:15

    Dos semanas de paz, y ahora esto.

    Kwame pasó la semana pasada para montar lo que llama una «CA emisora»
    (mira /srv/ca/LEEME.txt), y firmó con ella el certificado del nuevo
    archivo: archive.airwaves.internal funciona bien en Firefox en las
    emisoras.

    Pero Mateo dice que su monitorización en mastil está en rojo desde que
    la escribió (/usr/local/bin/check-sites, su registro en
    /var/log/check-sites.log), y el nuevo PC del estudio que instaló en
    Riverside, cabina, rechaza tanto el archivo como la intranet. Propuso
    añadir -k «para que se ponga en verde»; le dije que primero te
    preguntaría.

    Puedes llegar a cabina desde mastil: ssh cabina (tu clave está en él).

    Adaeze
chain-of-trust-note-mateo =
    Nota de Mateo, viernes 15 de marzo

    Debian 13 recién instalado en este PC, para el programa de emisión del
    estudio. Descarga la parrilla de https://intranet.airwaves.internal/ y
    las sintonías de https://archive.airwaves.internal/, y rechaza ambos:
    «SSL certificate problem: unable to get local issuer certificate».
    En la emisora, Firefox va bien. Kwame instaló algo en nuestros PC
    antiguos, pero no sé qué.

## Eventos

chain-of-trust-event-red =
    «unable to get local issuer certificate»: el cliente no pudo enlazar
    el certificado con una autoridad en la que confíe. Una máquina recién
    instalada solo confía en las autoridades públicas de su almacén
    (ca-certificates de Debian, en /etc/ssl/certs); nuestra raíz no es una
    de ellas, y Kwame solo la instaló a mano en los PC de las emisoras.
    ¿De dónde saca Debian las autoridades en las que confía? (man
    update-ca-certificates)
chain-of-trust-event-insecure =
    -k (--insecure) en la monitorización la pondría en verde... y ciega:
    ya no notaría un certificado caducado, un nombre incorrecto ni un
    servidor que no es el nuestro. Una comprobación que no puede fallar no
    comprueba nada. Mejor haz que mastil confíe en nuestra raíz.
chain-of-trust-event-pem-ignored =
    Hay un archivo .pem en /usr/local/share/ca-certificates, y
    update-ca-certificates lo ignora: solo toma los archivos que terminan
    en .crt (el contenido es el mismo PEM). Cámbiale el nombre.
chain-of-trust-event-key-on-booth =
    ¡Hay una clave privada de la autoridad en cabina! Un cliente solo
    necesita el certificado, la parte pública: quien tenga la clave puede
    firmar certificados en los que confiarían todas las emisoras. Bórrala
    de cabina enseguida (en la vida real, una clave filtrada significa una
    autoridad nueva: aquí, cabina aún no está en la red, y Adaeze lo deja
    pasar por esta vez).
chain-of-trust-event-mast-trusts =
    mastil confía ahora en Airwaves Root CA: está en /etc/ssl/certs y en el
    paquete ca-certificates.crt que leen curl y openssl. Veamos qué dice
    ahora la monitorización.
chain-of-trust-event-still-red =
    Sigue en rojo para el archivo, pero la intranet pasa. El certificado
    de la intranet lo firma directamente la raíz; el del archivo, la CA
    emisora, que el cliente no conoce. Un servidor debe enviar, después de
    su propio certificado, los intermedios hasta la raíz (no la raíz misma,
    que el cliente ya tiene). ¿Qué envía el archivo? openssl s_client
    -showcerts lista la cadena recibida.
chain-of-trust-event-intermediate-trusted =
    Confiar en la CA emisora en los clientes hace que el archivo funcione
    aquí, pero en cualquier otro cliente el problema sigue: el arreglo está
    en el servidor, que debe enviar el intermedio con su certificado.
chain-of-trust-event-root-served =
    El archivo envía ahora también la raíz. Funciona, pero no sirve de
    nada: un cliente solo confía en una raíz que ya tiene en su almacén,
    nunca en una que le dé el servidor; son unos cientos de bytes inútiles
    en cada negociación.
chain-of-trust-event-chain =
    El archivo envía ahora su certificado seguido del de la CA emisora:
    cualquier cliente que confíe en la raíz puede construir la cadena
    (hoja, CA emisora, raíz). Firefox iba bien en las emisoras porque
    recuerda los intermedios que ya ha visto; curl y una máquina recién
    instalada no.
chain-of-trust-event-booth =
    cabina confía ahora en la raíz de la federación (solo está su
    certificado, no su clave).
chain-of-trust-event-end =
    Mateo: «Todo en verde, y cabina reproduce las sintonías. He quitado -k
    de mis notas, prometido».

    ¡Bien hecho! Has terminado el capítulo «La cadena de confianza».

    QUÉ HA PASADO
    Dos problemas distintos daban el mismo mensaje, «unable to get local
    issuer certificate». Primero, ni mastil ni cabina confiaban en la raíz de
    la federación: Debian confía en lo que update-ca-certificates pone en
    /etc/ssl/certs, a partir de la lista de Mozilla y de los archivos .crt
    de /usr/local/share/ca-certificates. Luego, el archivo enviaba su
    certificado solo, sin la CA emisora que lo enlaza con la raíz; los
    navegadores que ya habían visto ese intermedio se las arreglaban, los
    demás clientes no. Instalaste el certificado de la raíz (y solo él) en
    las dos máquinas, y diste a nginx la cadena: la hoja, luego el
    intermedio.

    BUENA PRÁCTICA
    - Distribuye el certificado de la raíz, nunca una clave: un cliente
      nunca necesita una clave privada de la autoridad.
    - En Debian: /usr/local/share/ca-certificates/nombre.crt, luego
      update-ca-certificates (un .pem se ignora).
    - Un servidor envía su certificado y los intermedios, en orden; no la
      raíz (cat hoja.crt emisora.crt > cadena.crt para ssl_certificate).
    - openssl s_client -showcerts muestra lo que se envía de verdad;
      openssl verify -CAfile raiz.crt -untrusted emisora.crt comprueba la
      cadena.
    - «Funciona en mi navegador» prueba poco: los navegadores guardan los
      intermedios en caché.
    - Nunca desactives la verificación en una comprobación de
      monitorización: tiene que poder fallar.

    DOCUMENTACIÓN
    - update-ca-certificates: https://manpages.debian.org/trixie/ca-certificates/update-ca-certificates.8.en.html
    - nginx, cadenas de certificados SSL: https://nginx.org/en/docs/http/configuring_https_servers.html#chains
    - openssl-verify: https://docs.openssl.org/3.0/man1/openssl-verify/
    - openssl-s_client: https://docs.openssl.org/3.0/man1/openssl-s_client/
    - Guía TLS de Mozilla: https://wiki.mozilla.org/Security/Server_Side_TLS
