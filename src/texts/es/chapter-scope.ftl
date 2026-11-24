### Historia «La Auditoría», capítulo «El perímetro»: leer la carta de
### encargo, hacer el inventario del servidor visto desde internet con nmap,
### quedarse dentro del perímetro. Los comandos, las opciones, las rutas y la
### salida de nmap (en inglés) no se traducen.

chapter-scope = El perímetro
    .summary = Antes de escanear: leer la carta de encargo, hacer un inventario con nmap y no tocar lo que no está en el perímetro.

## Archivos

scope-email-salome =
    De:      Salomé (auditora)
    Para:    tú
    Asunto:  Auditoría de la Panadería — por dónde empezar

    Hola:

    Nadia me ha encargado la auditoría de seguridad de su servidor. Siempre
    empiezo de la misma manera, y te pido que lo hagas conmigo: primero la
    carta de encargo (carta_de_encargo.txt, firmada por las dos), luego el
    inventario. Una auditoría empieza por «¿qué se ve, y qué tengo derecho a
    mirar?».

    Lo que espero de ti:
    1. Lee la carta de encargo: fija el perímetro y lo que está permitido.
    2. Haz el inventario del servidor tal como se ve desde internet, con nmap
       (man nmap): los puertos abiertos Y la versión de lo que responde.
       Guarda el rastro en un archivo (la opción -oN): es la prueba de lo que
       has visto.
    3. Completa notas_auditoria.md: el perímetro, lo que has encontrado y lo
       que has visto sin tocarlo.

    Una precaución: Nadia me ha avisado de que el servidor de la pizzería de
    al lado (vecino.internal, 192.0.2.24) está conectado al mismo router. No
    está en nuestro mandato.

    Salomé
    (Para sudo, tu contraseña es: harina-2028)

scope-letter-mission =
    CARTA DE ENCARGO

    Entre:  la Panadería, representada por Nadia, gerente
            («el cliente»)
    Y:      Salomé, auditora independiente

    Objeto: auditoría de seguridad externa del servicio de pedidos en línea.

    Perímetro autorizado:
      - el servidor obrador.internal (192.0.2.22), que aloja también el sitio
        público obrador.example.

    Fuera del perímetro (no se debe sondear, aunque sea técnicamente posible):
      - cualquier otro equipo, en particular los de los vecinos que comparten
        el router del cliente.

    Permitido:
      - escanear los puertos del servidor y leer las versiones de los
        servicios (nmap);
      - peticiones inofensivas (un código de respuesta, una cabecera);
      - leer la configuración, con el acuerdo de la administración.

    Prohibido:
      - explotar un fallo, leer o copiar datos de la clientela;
      - adivinar contraseñas;
      - perturbar el servicio;
      - sondear cualquier cosa fuera del perímetro.

    Periodo: del 6 al 17 de marzo de 2028, de 9:00 a 18:00.
    Los hallazgos se entregan únicamente al cliente.

    Firmado: Nadia (gerente) y Salomé, 3 de marzo de 2028.

scope-notes-template =
    # Notas de auditoría — la Panadería

    ## Perímetro
    (por completar: lo que permite la carta de encargo)

    ## Lo que he encontrado
    (por completar: los puertos abiertos vistos desde internet, los servicios y sus versiones)

    ## Fuera del perímetro
    (por completar: lo que he visto y NO he sondeado, y por qué)

scope-section-scope = Perímetro
scope-section-found = Lo que he encontrado
scope-section-outside = Fuera del perímetro
scope-a-complete = (por completar
scope-words-outside = fuera del perímetro, fuera del perimetro, fuera de perímetro, fuera de perimetro, no está en la carta, no esta en la carta, no está en el mandato, no esta en el mandato, no sondeado, no lo he sondeado, no lo sondeé, no lo sondee, no escaneado, sin tocarlo, sin tocar, no lo he tocado

## Revisión

scope-review = Salomé relee tus notas:
scope-missing-template = Todavía quedan líneas «(por completar)» de la plantilla.
scope-missing-ports = En «Lo que he encontrado» falta lo que no pinta nada en internet: los números de puerto de la base de datos y de Redis (lo que mostró nmap).
scope-missing-neighbour = Falta la máquina que has visto sin tocarla: el servidor del vecino (nombre o dirección).
scope-missing-outside = Mencionas el servidor del vecino: di también que está fuera del perímetro (y que no lo has sondeado).

## Eventos

scope-event-letter =
    La carta de encargo es el documento que te protege tanto como al
    cliente: dice adónde puedes ir. Recuerda dos cosas: el perímetro (UNA
    máquina: obrador, 192.0.2.22) y la lista de lo prohibido. Sin una
    autorización por escrito, un escaneo de puertos está en el mejor de los
    casos mal visto y, en el peor, es un delito.

    Ahora, el inventario: nmap, con las versiones (man nmap).
scope-event-scan =
    Eso es lo que internet ve de la Panadería. Lee la columna STATE: «open»
    quiere decir que un programa responde; «filtered», que un cortafuegos
    descarta el paquete; «closed», que nadie escucha. Y la columna VERSION:
    una versión desfasada es una pista más para un atacante.

    Una pregunta de auditora: entre estos servicios abiertos, ¿cuáles tienen
    motivo para ser accesibles por cualquiera? Guarda el rastro en un archivo
    (la opción -oN): un hallazgo sin prueba no es más que una opinión.
# { $addresses }: the addresses probed outside the letter of engagement; { $neighbour }: "yes" if the neighbour's server is one of them
scope-event-outside-scope =
    ATENCIÓN: acabas de sondear una dirección que no está en tu carta de
    encargo ({ $addresses }{ $neighbour ->
        [yes] , entre ellas el servidor del vecino
       *[no] {""}
    }). Aquí no ha pasado nada;
    en la realidad es una falta profesional y, según el país, un delito: la
    autorización del cliente no cubre los equipos de otras personas. La
    respuesta correcta ante una máquina que parece «interesante»: no tocarla,
    e informar de ella.

    (Escanear una red entera, como 192.0.2.0/24, también sondea todo lo que
    contiene: indica siempre las direcciones exactas del perímetro.)
scope-event-trace =
    Tienes una prueba: un archivo con el comando exacto, la fecha, los
    puertos y las versiones. En el informe podrás decir «el 6 de marzo, desde
    internet, la base de datos respondía en el puerto 5432» y enseñarlo.

    Quedan por escribir tus notas (notas_auditoria.md): lo que has encontrado
    y lo que has visto sin tocarlo.
# { $mistake }: "yes" if the scan went beyond the scope, "no" otherwise
scope-event-end =
    Salomé: «Es un inventario limpio: un perímetro, pruebas y notas
    honestas. Nos servirá para el informe».

    ¡Bien hecho! Has terminado el capítulo «El perímetro».

    QUÉ HA PASADO
    Leíste la carta de encargo antes de tocar nada, y luego hiciste el
    inventario de la Panadería vista desde internet: SSH, el sitio web, pero
    también PostgreSQL y Redis, que nada justifica exponer, y una versión de
    SSH que no es la última. Guardaste el rastro del escaneo en un archivo. Y
    anotaste, sin tocarla, una máquina «interesante» que no es tuya: el
    servidor del vecino.
    { $mistake ->
        [yes] Pero tu escaneo también sondeó la dirección del vecino: el error más frecuente, porque escanear «toda la red» es un acto reflejo. Aquí no cuesta nada; en la realidad, es la falta que termina una misión, y a veces una carrera.
       *[no] Tu escaneo se quedó dentro del perímetro: es lo que se espera de una auditora o un auditor.
    }

    BUENA PRÁCTICA
    - Ninguna auditoría sin autorización por escrito: quién, qué (las
      direcciones exactas), cuándo, qué está permitido y qué está prohibido.
    - Quédate en el perímetro, aunque el resto de la red esté a tu alcance.
      Lo que ves fuera del perímetro se comunica, no se prueba.
    - Anota el comando exacto y guarda la salida (nmap -oN): un hallazgo
      queda demostrado y se puede reproducir.
    - Observa, no explotes: ver que una base de datos responde no te
      autoriza a conectarte a ella.
    - Un puerto abierto no es necesariamente un problema: es una pregunta
      («¿es intencionado?»). El informe dice cuáles, y por qué.

    OTRA MANERA
    Sin nmap, ss -tlnp en el servidor lista los servicios que escuchan, pero
    no lo que ve el exterior: un cortafuegos puede ocultar algunos. Los dos se
    complementan: ss dice lo que escucha, nmap dice lo que pasa.

    DOCUMENTACIÓN
    - nmap: https://nmap.org/book/man.html
    - Cuestiones legales: https://nmap.org/book/legal-issues.html
    - Guías de higiene y auditoría de las autoridades nacionales: ANSSI (Francia, cyber.gouv.fr), BSI (Alemania, bsi.bund.de), NCSC (Reino Unido, ncsc.gov.uk), CCN-CERT (España, ccn-cert.cni.es), CCB (Bélgica, ccb.belgium.be), NCSC (Suiza, ncsc.admin.ch), CISA (Estados Unidos, cisa.gov)
