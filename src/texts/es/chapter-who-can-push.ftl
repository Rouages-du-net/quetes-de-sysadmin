### Historia «La Biblioteca de Herramientas», capítulo «Quién puede hacer
### push»: un push forzado con las credenciales de un antiguo mantenedor;
### colaboradores, tokens, ramas protegidas. Los comandos, las opciones, las
### rutas, las rutas de la API y las salidas no se traducen.

chapter-who-can-push = Quién puede hacer push
    .summary = Alguien reescribió en plena noche la rama main de Lendshed, el programa de préstamo que usan cuarenta bibliotecas de herramientas, con las credenciales de un mantenedor que se fue en marzo. Averigua qué pasó, cierra las puertas que dejó abiertas y haz de main una rama que nadie pueda reescribir.

## Archivos

who-can-push-message-wanjiru =
    De: Wanjiru (mantenedora principal de Lendshed)
    Lunes 4 de noviembre, 8:50

    ¡Bienvenida o bienvenido al equipo, y gracias por cuidar de nuestra
    forja!

    Hay algo que me preocupa. El 16 de octubre, Rosa vio que sus dos
    commits de la semana anterior habían desaparecido de main: alguien
    había hecho un push forzado la noche del 14. Volvió a poner sus
    commits el mismo día, pero nunca entendimos qué pasó. Los
    repositorios desnudos están en /var/lib/forgejo/data/forgejo-repositories
    (activé core.logAllRefUpdates tras un accidente el año pasado), y
    Forgejo guarda su registro en /var/lib/forgejo/log.

    Tomasz dice que no fue él (mira su nota). Dejó de ser mantenedor en
    marzo: lo saqué del equipo de mantenedores, así que ya no debería
    poder hacer push... ¿verdad?

    Por favor, no borres su cuenta: sus incidencias y sus revisiones son
    años de memoria de nuestro proyecto, y deben conservar su nombre.

    Tu cuenta de la forja se llama «tu», administradora, con la misma contraseña
    que en anvil por ahora; tienes un token de API en ~/.forgejo-token. La
    API responde en https://forge.lendshed.example/api/v1 (man
    forgejo-api). Tu clon del repositorio está en ~/lendshed.

    Wanjiru

who-can-push-note-tomasz =
    De: Tomasz
    Domingo 3 de noviembre

    ¡Hola! Wanjiru me ha contado lo de main. No fui yo, lo prometo: no he
    tocado Lendshed desde marzo, ahora trabajo en los horarios de una red
    de tranvías. Pero sí vendí mi portátil viejo en septiembre... me temo
    que solo lo borré deprisa. El script de publicación que escribí en
    2029 tenía mi token de acceso personal en su configuración, un token
    con todos los permisos, porque tenía prisa. Por favor, revoca todo lo
    que todavía tenga. ¡Lo siento!

    Tomasz

## Eventos

who-can-push-event-history =
    Ahí está: en el reflog del repositorio desnudo, el 14 de octubre a las
    02:13, main pasó a un commit que no desciende del anterior: un push
    forzado. Los dos commits de Rosa quedaron atrás (siguen en el almacén
    de objetos, localizables por su ID), y el 16 otro push forzado los
    volvió a poner. ¿Qué cambiaba el commit de esa noche? git show te lo
    dice.
who-can-push-event-typosquat =
    El commit añadía una dependencia a requirements.txt: requets, a una
    letra de la conocida biblioteca requests. Un paquete con nombre
    parecido, publicado para que se instale por error, es una entrada
    clásica en la cadena de suministro de un proyecto: cada biblioteca de
    herramientas que instaló Lendshed entre el 14 y el 16 ejecutó pip
    install con él. ¿Quién podía hacer push a main? Pregunta a la forja
    quién colabora en el repositorio.
who-can-push-event-collaborator =
    Tomasz sigue siendo colaborador directo de lendshed/lendshed, con
    acceso de escritura. Salir del equipo de mantenedores solo le quitó lo
    que le daba el equipo; un colaborador añadido por su nombre conserva
    su propio acceso. Cada puerta se cierra donde se abrió.
who-can-push-event-removed =
    Tomasz ya no es colaborador: su cuenta ya no puede hacer push. Pero un
    token de acceso personal lleva los derechos de su dueño, y el de su
    antiguo script de publicación tenía todos los permisos. ¿Sigue siendo
    válido? Los tokens se listan por cuenta (GET /users/NOMBRE/tokens),
    con autenticación básica.
who-can-push-event-delete-refused =
    Forgejo se niega: Tomasz todavía es dueño de un repositorio (su
    antiguo fork). Borrar una cuenta es la vía dura, y Wanjiru pidió
    conservar su nombre en sus incidencias y revisiones. Para impedir que
    se use una cuenta, bloquéale el inicio de sesión (prohibit_login), o
    quita lo que le da acceso.
who-can-push-event-purged =
    La cuenta ha desaparecido, y con --purge se fue todo lo que poseía: su
    fork, sus comentarios, sus revisiones. En las incidencias, años de su
    trabajo aparecen ahora como escritos por «Ghost». La puerta está
    cerrada, pero el proyecto ha perdido parte de su memoria;
    prohibit_login la habría cerrado conservando su nombre.
who-can-push-event-password-only =
    Una contraseña nueva no cambia nada para un token: un token de acceso
    personal se autentica solo, sin la contraseña. Hay que quitar el token
    en sí (o bloquear la cuenta).
who-can-push-event-tokens-basic =
    Forgejo solo lista y borra tokens con autenticación básica (curl -u
    usuario:contraseña): un token no puede gestionar tokens. Como
    administradora, la cabecera Sudo te deja actuar como otra cuenta.
who-can-push-event-token-dead =
    El antiguo token de Tomasz ya no abre nada: quien tenga la copia de su
    portátil recibe ahora un 401 o un 403. Ahora la rama en sí: main no
    está protegida en absoluto, por eso un push forzado pudo reescribirla.
who-can-push-event-private =
    El repositorio ahora es privado: Kwame y las cuarenta bibliotecas de
    herramientas que instalan desde él ya no lo ven. Y no cambia quién
    puede hacer push: el acceso de escritura de Tomasz y su token también
    funcionan en un repositorio privado. Vuelve a hacerlo público (PATCH
    del repositorio con "private": false).
who-can-push-event-rewritten =
    main ya no lleva al último commit de Rosa: un push forzado ha vuelto a
    reescribir su historial, esta vez desde aquí. Vuelve a ponerlo: el
    reflog de tu clon recuerda dónde estaba main (git reflog), git reset
    --hard a ese punto, y luego un push. Después protege la rama antes de
    probar nada más.
who-can-push-event-weak =
    Hay una regla para main, pero todavía no lo hace todo. Forgejo siempre
    rechaza un push forzado en una rama protegida; la regla también
    debería dejar hacer push directo solo a los mantenedores
    (enable_push_whitelist y push_whitelist_usernames, o enable_push
    false), y pedir al menos una aprobación (required_approvals) y la
    comprobación de estado de la CI (enable_status_check,
    status_check_contexts) antes de fusionar una pull request.
who-can-push-event-bad-context =
    La comprobación de estado obligatoria nombra un contexto que la CI
    nunca informa: ninguna pull request podría fusionarse nunca. Los
    contextos son «workflow / job (event)»: mira lo que la forja registró
    para un commit (GET …/commits/REF/statuses).
who-can-push-event-protected =
    main está protegida: sin push forzado, push directo solo para los
    mantenedores, una aprobación y una CI en verde antes de fusionar.
    Compruébalo igual que falló: intenta reescribir main tú y mira cómo la
    forja se niega.
who-can-push-event-refused =
    «branch main is protected from force push»: el hook pre-receive de la
    forja se negó, antes de escribir nada. Eso es lo que faltaba la noche
    del 14.
who-can-push-event-end =
    Wanjiru: «Así que las puertas eran el colaborador y el token, no el
    equipo. Y ahora main no se puede reescribir ni siquiera como
    administradora. Gracias. Voy a escribir a las bibliotecas de
    herramientas sobre requets».

    ¡Bien hecho! Has terminado el capítulo «Quién puede hacer push».

    QUÉ HA PASADO
    Tomasz dejó el equipo de mantenedores en marzo, pero también lo
    habían añadido al repositorio por su nombre, hace años, y su token de
    acceso personal con todos los permisos estaba en un script de
    publicación, en un portátil que vendió. La noche del 14 de octubre
    alguien lo usó para hacer un push forzado de main, sustituyendo dos
    commits por uno que añadía una dependencia de nombre engañoso.
    Encontraste el push forzado en el reflog del repositorio desnudo y en
    el registro de Forgejo, quitaste al colaborador directo, inutilizaste
    el token y protegiste main: sin push forzado, push directo para los
    mantenedores, revisiones y CI antes de fusionar; luego viste cómo se
    rechazaba un push forzado.

    BUENA PRÁCTICA
    - Cuando alguien se va, lista todas las formas de entrar: equipos,
      colaboradores directos, claves SSH, claves de despliegue, tokens.
      Bloquea la cuenta (prohibit_login) en lugar de borrarla, para
      conservar su historial.
    - Tokens: los permisos mínimos, una caducidad, nunca en la
      configuración de un script en un portátil; revoca lo que no se usa.
    - Protege la rama por defecto: sin push forzado, push restringido,
      revisiones y comprobaciones de estado obligatorias; conserva un
      reflog en el servidor.
    - Una dependencia añadida en un commit que nadie revisó es un
      incidente de la cadena de suministro: avisa a quienes instalaron.

    DOCUMENTACIÓN
    - Forgejo, ramas protegidas: https://forgejo.org/docs/latest/user/protection/
    - Forgejo, uso de la API (tokens, Sudo): https://forgejo.org/docs/latest/user/api-usage/
    - git reflog: https://git-scm.com/docs/git-reflog
    - OpenSSF, buenas prácticas de gestión de código fuente: https://best.openssf.org/SCM-BestPractices/
who-can-push-event-end-purged =
    Wanjiru: «Las puertas están cerradas, gracias... pero el nombre de
    Tomasz ha desaparecido de cuatro años de incidencias. Intentaré
    restaurarlas desde la copia de seguridad de la semana pasada».

    ¡Bien hecho! Has terminado el capítulo «Quién puede hacer push», a un
    precio.

    QUÉ HA PASADO
    Tomasz dejó el equipo de mantenedores en marzo, pero también era
    colaborador directo, y su token de acceso personal con todos los
    permisos estaba en un script de publicación, en un portátil que
    vendió. Alguien lo usó para hacer un push forzado de main el 14 de
    octubre. Encontraste el push forzado en el reflog, cerraste sus
    accesos y protegiste main. Pero al borrar su cuenta con --purge se fue
    también la autoría de sus contribuciones: prohibit_login habría
    bloqueado la cuenta conservando la memoria del proyecto.

    BUENA PRÁCTICA
    - Cuando alguien se va, lista todas las formas de entrar: equipos,
      colaboradores directos, claves SSH, tokens. Bloquea
      (prohibit_login), no purgues.
    - Tokens: los permisos mínimos, una caducidad, nunca en un script en
      un portátil.
    - Protege la rama por defecto: sin push forzado, push restringido,
      revisiones y comprobaciones de estado obligatorias.

    DOCUMENTACIÓN
    - Forgejo, ramas protegidas: https://forgejo.org/docs/latest/user/protection/
    - Forgejo, admin user delete: https://forgejo.org/docs/latest/admin/command-line/
    - git reflog: https://git-scm.com/docs/git-reflog
