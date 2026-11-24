### Historia «La Biblioteca de Herramientas», capítulo «La tubería que
### gotea»: un workflow de CI que entrega la clave de despliegue a la pull
### request de un fork y la imprime. Los comandos, las opciones, las rutas,
### las rutas de la API y las salidas no se traducen.

chapter-leaky-pipeline = La tubería que gotea
    .summary = La CI que prueba las pull requests de Lendshed y publica su documentación imprimió la clave de despliegue en un registro público, y se la dio al código de cualquier fork. Encuentra la fuga, rota la clave y reconstruye la tubería para que el código de quien contribuye se pruebe sin tocar nunca un secreto.

## Archivos

leaky-pipeline-message-rosa =
    De: Rosa (mantenedora)
    Miércoles 13 de noviembre, 13:40

    ¡Hola! Algo raro en la CI. Estaba leyendo la ejecución de la pull
    request de Kwame (#57, su traducción al suajili) y el job «test»
    imprime una línea enorme de letras y números bajo un paso llamado
    «Show deploy configuration». Tomasz añadió ese paso en febrero «para
    depurar el despliegue», y el workflow sigue así desde entonces.

    Nuestro repositorio es público, y también lo son sus ejecuciones y
    sus registros.

    La CI es .forgejo/workflows/ci.yml en el repositorio (tu clon está en
    ~/lendshed). Las ejecuciones están en la API (man forgejo-api), y el
    registro de cada job es una simple página web. La documentación la
    publica el job «deploy» como la cuenta deploy en anvil
    (deploy@anvil.internal), con la clave guardada en el secreto
    DEPLOY_KEY de la forja.

    Tu token de API sigue en ~/.forgejo-token.

    Rosa

## Eventos

leaky-pipeline-kwame-sync = (Kwame ha rebasado su pull request #57 sobre el nuevo main: la CI se ha vuelto a ejecutar en ella.)
leaky-pipeline-event-runs =
    Las ejecuciones de la forja: los push a main, y la pull request #57 de
    Kwame, ejecutada en pull_request_target. Cada job tiene su registro
    (logs_url); en un repositorio público, cualquiera puede leerlo.
leaky-pipeline-event-log =
    El paso «Show deploy configuration» imprime una línea larga: base64.
    El runner enmascara en los registros los secretos que conoce (*** en
    su lugar), pero solo su texto exacto: una vez codificado, el secreto
    es una línea más. ¿Qué es? base64 -d lo vuelve a leer.
leaky-pipeline-event-decoded =
    Es la clave de despliegue: una clave privada OpenSSH, en un registro
    público desde febrero, y además entregada al código de cada pull
    request. Hay que darla por robada: esconder ahora el registro no
    cambia nada. Una clave filtrada se rota: una clave nueva, la antigua
    rechazada, el secreto actualizado. Y el workflow, ¿cómo le da la clave
    a un fork?
leaky-pipeline-event-workflow =
    Ahí está el patrón que el laboratorio de seguridad de GitHub llama
    «pwn request»: pull_request_target ejecuta el workflow de la rama base
    con los secretos del repositorio, para que un workflow pueda comentar
    en una pull request; pero este hace checkout del propio código de la
    pull request (github.event.pull_request.head.sha) y lo ejecuta, con
    DEPLOY_KEY en el entorno de todo el workflow. El pip install o un
    archivo de pruebas de un fork podría leerla. El código de una pull
    request se prueba con pull_request, que no da secretos a un fork; la
    clave solo pertenece al paso de despliegue, en un push a main.
leaky-pipeline-event-old-key-gone =
    La clave filtrada ya no está en el authorized_keys de la cuenta
    deploy: quien la haya copiado recibe «Permission denied». La
    documentación no se puede publicar hasta que haya una clave nueva.
leaky-pipeline-event-unrestricted =
    Una clave en authorized_keys sin ninguna opción puede hacer todo lo
    que puede la cuenta deploy: una shell, redirección de puertos... Para
    la clave de una CI, restríngela: restrict, from="192.0.2.80" (la
    dirección del runner), y command="rrsync /srv/www/docs", que solo
    permite rsync hacia esa carpeta (man authorized_keys en el manual de
    sshd, rrsync).
leaky-pipeline-event-new-key =
    Una clave nueva y restringida para la cuenta deploy. Su mitad privada
    tiene que ir ahora al secreto DEPLOY_KEY de la forja (PUT
    /repos/OWNER/REPO/actions/secrets/NAME, un cuerpo JSON {"{"}"data": "…"{"}"}),
    y luego desaparecer de esta máquina.
leaky-pipeline-event-json-error =
    Forgejo no puede leer el JSON: una clave privada tiene saltos de línea,
    y una cadena JSON no puede contener saltos de línea en bruto; hay que
    escribirlos \n. jq construye bien el JSON: jq -Rs '{"{"}data: .{"}"}' < CLAVE
    lee el archivo como una sola cadena. Cuidado también: curl -d @ARCHIVO
    quita los saltos de línea del archivo que envía; --data-binary
    @ARCHIVO los conserva.
leaky-pipeline-event-secret =
    El secreto DEPLOY_KEY contiene ahora la clave nueva (la forja nunca
    vuelve a mostrar el valor de un secreto: solo su nombre y su fecha).
    Borra tu copia local de la clave privada una vez guardada.
leaky-pipeline-event-pushed =
    main se ha movido: la forja ha ejecutado el workflow de push, y Kwame
    actualizará su pull request encima.
leaky-pipeline-event-no-ci =
    Ya no queda ningún workflow en main: se acabó la fuga, pero también
    las pruebas de las pull requests y la publicación de la documentación.
    La CI tiene que seguir; solo tiene que dejar de entregar secretos a
    código no fiable.
leaky-pipeline-event-still-exposed =
    La última ejecución de Kwame sigue dando los secretos al código del
    fork, o sigue imprimiendo uno. Vuelve a mirar las ejecuciones y sus
    registros: qué evento, qué código se descarga, dónde está DEPLOY_KEY
    en el entorno.
leaky-pipeline-event-untested =
    La ejecución de Kwame ya no toca la clave, pero tampoco prueba ya su
    código: pull_request_target con el checkout de la rama base prueba
    main, no la pull request. Prueba las pull requests en pull_request:
    su propio código, sin secretos.
leaky-pipeline-event-masked-only =
    El workflow ya es seguro, pero la clave filtrada sigue abriendo la
    cuenta deploy: fue pública durante nueve meses. Rótala.
leaky-pipeline-event-safe =
    La última ejecución de Kwame: su código probado en pull_request, sin
    ningún secreto, sin nada impreso. Incluso un fork malicioso solo
    podría romper su propia ejecución.
leaky-pipeline-event-stale-context =
    La comprobación de estado obligatoria de main sigue nombrando «ci /
    test (pull_request_target)»: ese contexto no volverá nunca, y ninguna
    pull request podría fusionarse. Actualiza la protección con el
    contexto que informa ahora la pull request.
leaky-pipeline-event-context =
    La protección espera ahora el contexto que la CI informa de verdad en
    las pull requests.
leaky-pipeline-event-deploy-failed =
    El job de despliegue del último push ha fallado: mira su registro. La
    clave del secreto, la línea de authorized_keys y sus opciones (from=,
    la carpeta de rrsync) tienen que coincidir. Una vez arreglado, un
    nuevo push a main lo vuelve a ejecutar (git commit --allow-empty, por
    ejemplo).
leaky-pipeline-event-deployed =
    El último push a main ha desplegado la documentación con la clave
    nueva, la única que acepta la cuenta deploy.
leaky-pipeline-event-end =
    Rosa: «Así que la clave estuvo fuera nueve meses... y ahora ya no vale
    nada. Las ejecuciones de Kwame están en verde, y ningún código que no
    sea el nuestro ve nunca un secreto. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «La tubería que gotea».

    QUÉ HA PASADO
    La CI ejecutaba las pull requests en pull_request_target, que da los
    secretos del repositorio al workflow, y hacía checkout del código del
    fork; la clave de despliegue estaba en el entorno de cada job, y un
    paso de depuración la imprimía en base64, saltándose el enmascarado
    de los registros. La clave se había filtrado en registros públicos.
    La decodificaste para estar segura, la rotaste (una clave nueva,
    restringida con rrsync y from=, la antigua quitada, el secreto de la
    forja actualizado por la API), reescribiste el workflow (pull requests
    probadas en pull_request sin secretos, el despliegue solo en un push a
    main, la clave solo en su paso), y comprobaste las ejecuciones
    siguientes.

    BUENA PRÁCTICA
    - El código no fiable (la pull request de un fork) nunca se ejecuta
      donde hay un secreto: pull_request, no pull_request_target con
      checkout de la cabeza.
    - Un secreto está en el entorno del paso que lo necesita, en ningún
      otro sitio; nunca impreso, ni siquiera codificado: el enmascarado
      solo conoce su texto exacto.
    - Un secreto filtrado se rota, no se esconde.
    - La clave de despliegue de una CI se restringe en el servidor:
      restrict, from=, command= (rrsync para rsync).
    - Las comprobaciones de estado obligatorias siguen los contextos del
      workflow.

    DOCUMENTACIÓN
    - Forgejo Actions, eventos: https://forgejo.org/docs/latest/user/actions/reference/
    - Forgejo Actions, seguridad: https://forgejo.org/docs/latest/user/actions/security/
    - GitHub Security Lab, prevenir los pwn requests: https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
    - sshd, AUTHORIZED_KEYS FILE FORMAT: https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
