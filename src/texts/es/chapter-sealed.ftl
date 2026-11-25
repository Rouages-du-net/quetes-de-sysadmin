### Historia «El Albergue», capítulo «Sellado»: OpenBao sellado tras un
### corte de luz (status, tres fragmentos de clave, la aplicación
### reiniciada, su salud comprobada). Los comandos, las opciones, las rutas,
### los nombres de políticas y de tokens, los fragmentos de clave y la
### salida de OpenBao no se traducen.

chapter-sealed = Sellado
    .summary = Una tormenta cortó la luz por la noche. El servidor del albergue volvió solo, pero la caja fuerte de secretos volvió sellada, y el sitio de reservas se rindió. Los huéspedes llegan a las nueve: reconstruye la clave de la caja fuerte con los fragmentos de tres personas, y vuelve a poner el sitio en marcha.

## Archivos

sealed-message-desta =
    De: Desta (coordinación del albergue)
    Sábado 6 de marzo, 07:40

    ¡Buenos días, y perdona por escribir tan temprano!

    La tormenta cortó la luz a las 03:12. candado volvió solo a las 03:58,
    pero el sitio de reservas, Bunks, no funciona, y doce personas llegan a
    las nueve para registrarse.

    Ruslan instaló candado el mes pasado. Bunks guarda sus contraseñas (la
    base de datos, el proveedor de pagos) en OpenBao, una caja fuerte de
    secretos en la misma máquina. Nos dijo que, después de un reinicio,
    OpenBao está «sellado», y que tres personas tienen que dar cada una su
    «fragmento de clave» para abrirlo. Hay cinco
    fragmentos: el mío, el de Ruslan, el tuyo, el de Hiroko y el de Nnamdi.

    Ruslan está de travesía sin cobertura hasta el lunes. Mi fragmento está
    en papel en la caja fuerte del albergue; voy en el tren, pero le hice
    una foto la semana pasada. Está un poco borrosa; esto es lo que leo:

        { $share }

    No estoy segura de cada carácter. Hiroko y Nnamdi enviaron los suyos
    (sus mensajes están en tu carpeta personal), y el tuyo debería estar en
    tu memoria USB.

    ¿Puedes abrir la caja fuerte y volver a poner Bunks en marcha antes de
    las nueve?

    Desta

sealed-message-hiroko =
    De: Hiroko (tesorería)
    Sábado 6 de marzo, 07:22

    Desta me llamó. Estoy en casa de mi hermana, a dos horas, así que aquí
    tienes mi fragmento, copiado de mi sobre:

        { $share }

    Borra este mensaje cuando la caja fuerte esté abierta: Ruslan dijo que,
    si un fragmento viaja alguna vez, habrá que hacer fragmentos nuevos.

    Hiroko

sealed-message-nnamdi =
    De: Nnamdi
    Sábado 6 de marzo, 07:31

    ¡Madrugando por una vez! Mi fragmento, de mi gestor de contraseñas:

        { $share }

    Hoy no puedo pasar; dime si el sitio necesita algo.

    Nnamdi

sealed-usb-comment = Tu fragmento de clave (número 3 de 5), entregado por Ruslan el 14 de febrero. Guárdalo fuera de línea.

## Eventos

sealed-event-status =
    OpenBao responde, pero está sellado: sus datos están cifrados en el
    disco, y no puede descifrarlos hasta reconstruir su clave raíz con tres
    de los cinco fragmentos (el reparto de secretos de Shamir). Unseal
    Progress 0/3: nadie ha dado todavía ningún fragmento. Todo arranque del
    servidor empieza así.
sealed-event-init =
    bao operator init es para un servidor nuevo: crea la clave raíz, los
    fragmentos y el primer token root. Este ya está inicializado
    (Initialized true): solo hay que desellarlo.
sealed-event-first-share =
    OpenBao ha contado un fragmento: el progreso ha avanzado, y un Unseal
    Nonce identifica este intento. Los fragmentos dados se quedan en memoria
    hasta alcanzar el umbral. Escribir un fragmento en la solicitud (bao
    operator unseal sin argumento) lo mantiene fuera del historial del
    shell.
sealed-event-duplicate =
    El progreso no se ha movido: ese fragmento ya estaba contado. Tres
    fragmentos son tres personas distintas; esa es la gracia del umbral:
    nadie puede abrir la caja fuerte a solas.
sealed-event-bad-format =
    OpenBao no ha podido decodificar ese fragmento: un fragmento es una
    cadena base64 (o hexadecimal) de longitud fija. Cópialo entero, sin
    espacios ni la línea de comentario.
sealed-event-bad-share =
    El tercer fragmento completó el umbral, OpenBao combinó los tres… y el
    resultado no descifró su llavero: uno de ellos era erróneo. Todo el
    intento se pierde y el progreso vuelve a 0/3, porque OpenBao no puede
    saber cuál era el erróneo. ¿Alguno se leyó de una foto borrosa?
sealed-event-restart-early =
    Bunks ha vuelto a fallar: OpenBao sigue sellado, así que sus secretos no
    se pueden leer (journalctl -u bunks: «Vault is sealed»). Primero desella,
    y luego reinicia la aplicación.
sealed-event-openbao-restarted =
    OpenBao se ha reiniciado: vuelve sellado, y los fragmentos ya dados se
    olvidan. Un reinicio nunca desella; solo lo hacen los fragmentos.
sealed-event-unsealed =
    Sealed false: OpenBao ha reconstruido su clave raíz en memoria y ha
    abierto su llavero. Sigue desellado hasta que se detenga (un reinicio,
    un corte de luz, bao operator seal). Bunks, en cambio, se rindió por la
    noche: tras cinco arranques fallidos, systemd dejó de intentarlo
    (start-limit-hit).
sealed-event-restarted =
    Bunks vuelve a funcionar: al arrancar leyó sus dos secretos en OpenBao
    (journalctl -u bunks). ¿Responde de verdad?
sealed-event-checked =
    La página de salud responde: Bunks llega a OpenBao, a su base de datos y
    al proveedor de pagos.
sealed-event-end =
    Desta: «Las primeras personas ya se están registrando. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «Sellado».

    QUÉ HA PASADO
    El corte de luz reinició candado, y OpenBao arrancó sellado, como
    siempre: sus datos están cifrados con una clave que a su vez está
    cifrada con la clave raíz, y la clave raíz no se escribe en ningún
    sitio. bao status mostraba Sealed true y Unseal Progress 0/3. Tres
    fragmentos distintos dados a bao operator unseal la reconstruyeron (el
    reparto de secretos de Shamir: tres cualesquiera de los cinco, nunca
    menos). Bunks se había rendido tras cinco arranques fallidos;
    reiniciado, leyó sus secretos y su página de salud respondió.

    BUENA PRÁCTICA
    - Los fragmentos pertenecen a personas distintas, guardados por
      separado y fuera de línea; cada persona escribe el suyo (bao operator
      unseal sin argumento: el fragmento no se muestra ni se guarda en el
      historial).
    - Un fragmento que ha viajado (un mensaje, una foto) queda debilitado:
      cuando la caja fuerte esté abierta, crea fragmentos nuevos (bao
      operator rekey) y destruye los antiguos.
    - El token root que muestra bao operator init solo sirve para la
      primera configuración. El trabajo diario usa tokens limitados por
      políticas; cuando de verdad hace falta un token root, tres personas
      con fragmento generan uno (bao operator generate-root), que se revoca
      justo después.
    - Una aplicación que depende de la caja fuerte debe reintentar con
      paciencia (Restart=on-failure, un RestartSec= suficientemente largo),
      y la supervisión debería decir «sellado» antes que los huéspedes.

    OTRA MANERA
    El desellado automático (auto-unseal): la clave raíz está protegida por
    un servicio de gestión de claves (un KMS en la nube, un HSM por PKCS#11,
    el motor transit de otro OpenBao) y el servidor se desella solo al
    arrancar; los fragmentos pasan a ser claves de recuperación. Se acaban
    las llamadas de madrugada, pero la confianza pasa a ese servicio.

    DOCUMENTACIÓN
    - Sellar y desellar: https://openbao.org/docs/concepts/seal/
    - bao operator unseal: https://openbao.org/docs/commands/operator/unseal/
    - bao status: https://openbao.org/docs/commands/status/
    - Los tokens root: https://openbao.org/docs/concepts/tokens/#root-tokens
