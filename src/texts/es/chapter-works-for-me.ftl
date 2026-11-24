### Historia «Las Cartas del Barrio», capítulo 5 «En mi máquina funciona»:
### DNS (BIND). Los comandos, las rutas, los nombres de dominio, los
### archivos de zona y los mensajes de dig, named y rndc no se traducen.

chapter-works-for-me = En mi máquina funciona
    .summary = El sitio del café solo funciona para Kofi: DNS, zona BIND, número de serie, TTL.

## Archivos

works-for-me-email-kofi =
    De:      Kofi (asociación Las Cartas del Barrio)
    Para:    tú
    Asunto:  ¡En mi máquina funciona!

    No lo entiendo. El sitio del café funciona perfectamente en mi
    ordenador, pero la clientela del café dice que acaba en una página de
    error del antiguo alojamiento. Y www.cafe.example no funciona en
    ningún sitio, ni siquiera en mi ordenador.

    Y eso que sí «apunté» el nombre a nuestro servidor: añadí esta línea
    a /etc/hosts, en mi ordenador:

      203.0.113.10   cafe.example

    Rania dice que no se hace así, y que nuestro servidor es el que tiene
    autoridad sobre la zona cafe.example (BIND, el servicio named). El
    registro guarda una copia en ns2.registry.example.

    ¿Puedes echar un vistazo? Rania ha dejado una ayuda en ayuda_dns.txt.
    Para sudo: hormigas-2026
works-for-me-help-dns =
    AYUDA DNS — DE RANIA

    /etc/hosts solo cambia el ordenador en el que está: es una respuesta
    «casera» que nadie más ve.

    El DNS de verdad, para nuestros dominios:
      /etc/bind/named.conf.local      la lista de nuestras zonas
      /etc/bind/zones/db.NOMBRE       una zona por archivo
    Nuestra zona letters.example es un buen modelo.

    ¿Quién responde qué?
      dig cafe.example                        el resolvedor público (9.9.9.9)
      dig @localhost cafe.example             nuestro servidor (ns1)
      dig @ns2.registry.example cafe.example  la copia del registro (ns2)

    Después de un cambio: named-checkzone y luego rndc reload.
    Todo lo demás: man dig, man named-checkzone, man rndc.

## Eventos

# { $hours }: el tiempo que queda antes de que el resolvedor olvide la dirección antigua
works-for-me-event-cache =
    Nuestro servidor da la dirección nueva… pero el resolvedor público
    sigue respondiendo con la antigua. Mira el número antes de IN: es el
    TTL que queda. El resolvedor guardó en su caché la respuesta de ayer,
    y la conservará { $hours ->
        [one] todavía cerca de una hora
       *[other] todavía cerca de { $hours } horas
    }, como todos los resolvedores del mundo que la pidieron. Es lo que
    se llama, erróneamente, «propagación»: nada se propaga, las cachés
    caducan. No se pueden vaciar; solo se puede prever (un TTL corto antes
    de un cambio). Mientras tanto, comprueba directamente con los dos
    servidores con autoridad.
works-for-me-event-error-zone =
    named rechaza la zona y conserva la versión anterior: el sitio no se
    rompe, pero nada ha cambiado. journalctl -u named te dice por qué;
    named-checkzone te lo dice antes de recargar.
works-for-me-event-serial =
    ns1 (nuestro servidor) y ns2 (la copia del registro) ya no dan la misma
    respuesta: ns2 no ha copiado la zona. Un servidor secundario solo copia
    una zona si su número de serie (el serial del SOA) ha aumentado.
    journalctl -u named lo indica. La costumbre: AAAAMMDDnn, la fecha del
    día y un número de cambio.
works-for-me-event-point-final =
    Cuidado: en una zona, un nombre escrito sin punto final se completa
    con el nombre de la zona. cafe.example (sin el punto) se convierte en
    cafe.example.cafe.example.: dig @localhost www.cafe.example lo muestra.
    Para un nombre completo: cafe.example. con el punto.
works-for-me-event-end =
    ns1 y ns2 dan la misma respuesta: cafe.example y www.cafe.example
    llevan al servidor de Las Cartas. Los resolvedores seguirán, como muy
    tarde cuando caduque su caché. Kofi quita la línea de su /etc/hosts:
    «¡Así veo lo que ve todo el mundo!»

    ¡Bien hecho! Has terminado el capítulo 5 de Las Cartas del Barrio.
    (Lo que viene: Noche de concierto.)

    QUÉ HA PASADO
    /etc/hosts solo se aplica a la máquina en la que está: en el ordenador
    de Kofi, el nombre llevaba al servidor correcto; en todos los demás,
    el DNS seguía dando la dirección antigua. La zona cafe.example,
    en nuestro servidor, nunca se había cambiado, y no había ningún
    registro para www.

    BUENA PRÁCTICA
    - Prueba siempre como todo el mundo: dig, sin un /etc/hosts «casero».
    - Pregunta a los servidores con autoridad (dig @ns1, dig @ns2) para
      saber qué está publicado; el resolvedor solo te dice lo que tiene
      en caché.
    - Aumenta el serial del SOA con cada cambio, si no los secundarios
      conservan la zona antigua.
    - named-checkzone antes de rndc reload; journalctl -u named después.
    - Un nombre completo termina con un punto en un archivo de zona.
    - Antes de una mudanza, baja el TTL (por ejemplo a 300 segundos) un
      día antes: las cachés olvidarán rápido la dirección antigua.

    DOCUMENTACIÓN
    - Archivos de zona de BIND: https://bind9.readthedocs.io/en/stable/chapter3.html
    - dig, named-checkzone, rndc: https://bind9.readthedocs.io/en/stable/manpages.html
    - El DNS, sus nombres y su caché (RFC 1034): https://www.rfc-editor.org/rfc/rfc1034
