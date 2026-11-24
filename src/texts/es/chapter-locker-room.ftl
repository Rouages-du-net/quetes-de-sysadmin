### Historia «La Piscina», capítulo «El vestuario»: la contraseña de la base
### de datos está en un ConfigMap y en claro en un repositorio git compartido
### con informática del ayuntamiento. Un Secret, secretKeyRef, rollout
### restart, base64 que no es cifrado, el historial de git. Los comandos,
### nombres de recursos, campos y salidas no se traducen.

chapter-locker-room = El vestuario
    .summary = La contraseña de la base de datos de la aplicación de reservas está en un ConfigMap, y en claro en el repositorio git de los manifiestos, que puede leer informática del ayuntamiento. Esta mañana se cambió en la base de datos: pon la nueva en un Secret, saca la antigua de los archivos y asegúrate de que los pods la usan.

## Files

locker-room-message-folake =
    De: Folake (Piscina de la Ribera, recepción)
    Lunes 18 de junio, 9:05

    Hola:

    Kemal me ha llamado a las 8:50, un poco preocupado: ha encontrado la
    contraseña de la base de datos escrita en claro en los manifiestos que
    Rui comparte con informática del ayuntamiento. Dice que cualquiera en
    el ayuntamiento que pueda leer ese repositorio podría haberla leído,
    así que la ha cambiado enseguida en la base de datos. Su nota está
    junto a este mensaje.

    El sitio sigue funcionando. Kemal dice que solo «hasta el próximo
    reinicio». No sé qué significa, pero no suena bien.

    Folake
locker-room-note-kemal =
    Nota de Kemal (informática del ayuntamiento)

    El martes pasado activamos la autenticación por contraseña en
    db.pool.internal, y Rui puso la contraseña de la cuenta booking en el
    ConfigMap, o sea en ~/manifests/config.yaml, que él confirma y sube a
    /srv/git/pool-manifests.git: el repositorio del que yo hago pull, y que
    puede leer la mitad de informática del ayuntamiento.

    A las 9:00 cambié la contraseña de esa cuenta en la base de datos. La
    nueva está en ~/nueva_clave_bd.txt (solo tú puedes leerla). Los pods
    en marcha conservan las conexiones que abrieron; pero un pod que
    arranque ahora con la contraseña antigua no entrará.

    Lo que hace falta:
    - la nueva contraseña en un Secret de Kubernetes, no en un ConfigMap;
    - que la aplicación la lea de ahí (el ConfigMap le sigue dando
      database_host);
    - pods que la usen de verdad;
    - nada secreto en los archivos, y los archivos corregidos subidos.

    Kemal

## Git

pool-commit-1 = Aplicación booking en k3s
pool-commit-2 = 2.3.1, un Service y un Ingress
pool-commit-3 = La base de datos pide ahora una contraseña

## Events

locker-room-event-config-read =
    Ahí está, en claro: la contraseña antigua, en el ConfigMap y en
    config.yaml. Un ConfigMap es para ajustes que cualquiera puede leer
    (kubectl get configmap -o yaml lo muestra todo); una contraseña va en
    un Secret.
locker-room-event-history-seen =
    El historial de git conserva cada versión de cada archivo: la
    contraseña antigua se queda en el commit que la añadió, y en cada clon
    del repositorio, incluso una vez corregido el archivo. Reescribir el
    historial no llegaría a las copias que otros ya tienen. Por eso que
    Kemal la cambiara en la base de datos fue el verdadero arreglo: la del
    historial ya no abre nada.
locker-room-event-old-secret =
    Este Secret contiene la contraseña antigua, la que está escrita en el
    repositorio: Kemal la cambió en la base de datos a las 9:00, así que un
    pod que arranque con ella no entrará. La nueva está en
    ~/nueva_clave_bd.txt.
locker-room-event-auth-failed =
    «password authentication failed for user "booking"»: la base de datos
    rechaza la contraseña con la que arrancó este contenedor. ¿Qué
    contraseña le da la plantilla, y es la de ~/nueva_clave_bd.txt?
locker-room-event-newline =
    Este Secret contiene la contraseña seguida de un salto de línea:
    --from-file toma el archivo entero, y el archivo termina con uno. La
    base de datos la rechazaría. Usa --from-literal (o un archivo sin el
    salto de línea).
locker-room-event-secret-created =
    El Secret contiene la nueva contraseña. Míralo con kubectl get secret
    NOMBRE -n swim -o yaml: ¿está oculta?
locker-room-event-decoded =
    base64 es una codificación, no un cifrado: cualquiera que pueda leer el
    Secret recupera la contraseña con un comando. Un Secret es más seguro
    que un ConfigMap por lo que se hace a su alrededor: quién puede leerlo
    (RBAC), cómo se almacena (cifrado de etcd), y que se quede fuera del
    repositorio.
locker-room-event-base64-config =
    La contraseña en base64 en el ConfigMap sigue siendo la contraseña:
    base64 -d se la devuelve a cualquiera. Lo que cambia no es dónde está
    escrita, sino quién puede leerla. Ponla en un Secret.
locker-room-event-config-deleted =
    El ConfigMap booking-config ha desaparecido, pero la aplicación sigue
    tomando de él database_host: el próximo pod que arranque se quedará en
    CreateContainerConfigError. Quítale la contraseña; conserva el resto.
locker-room-event-literal =
    La contraseña está ahora escrita en el propio Deployment (value:), o
    sea en booking.yaml, o sea en el repositorio. Haz referencia al Secret
    en su lugar (valueFrom.secretKeyRef).
locker-room-event-referenced =
    La plantilla del Deployment toma ahora DATABASE_PASSWORD del Secret.
locker-room-event-config-cleaned =
    El ConfigMap ya no contiene ninguna contraseña, y sigue dando a la
    aplicación su database_host.
locker-room-event-stale-env =
    La plantilla da la nueva contraseña, pero algunos pods en marcha
    arrancaron con la antigua: un contenedor lee sus variables de entorno
    una sola vez, al arrancar. Cambiar un Secret o un ConfigMap no reinicia
    nada. kubectl rollout restart deployment/booking -n swim sustituye los
    pods uno a uno, sin corte.
locker-room-event-restarted =
    Todos los pods de booking funcionan ahora con la nueva contraseña,
    leída del Secret.
locker-room-event-secret-file =
    { $file } en ~/manifests contiene la contraseña (en claro, o en base64,
    que es lo mismo): iría al repositorio con el resto. Mantenlo fuera del
    repositorio (kubectl create secret generic no necesita ningún archivo),
    y luego quítalo de ahí.
locker-room-event-committed =
    El último commit ya no contiene ninguna contraseña. Kemal hace pull del
    repositorio compartido: ¿está ahí también?
locker-room-event-pushed =
    El repositorio compartido está al día: lo que descarga Kemal ya no
    contiene ninguna contraseña (pero su historial todavía contiene la
    antigua: ver git log -p).
locker-room-event-drift =
    Los pods usan el Secret, pero los archivos de ~/manifests no lo dicen:
    el próximo kubectl apply -f ~/manifests/ volvería a poner la contraseña
    en el ConfigMap. Corrige los archivos y aplícalos.
locker-room-event-end =
    Kemal: «Perfecto. La contraseña antigua ya no abre nada, la nueva está
    en un Secret que solo pueden leer los administradores del clúster, y
    el repositorio ya no tiene nada que ocultar. Se lo diré al responsable
    de seguridad.»

    ¡Bien hecho! Has terminado El vestuario.

    QUÉ HA PASADO
    La contraseña de la base de datos estaba en un ConfigMap, o sea en
    config.yaml, o sea en un repositorio git que podía leer informática
    del ayuntamiento. Kemal la cambió en la base de datos: los pods en
    marcha conservaron sus conexiones, pero cualquier arranque nuevo
    habría fallado. Pusiste la nueva contraseña en un Secret, hiciste que
    el Deployment la leyera con secretKeyRef, la sacaste del ConfigMap (que
    sigue dando database_host), sustituiste los pods para que la leyeran
    (una variable de entorno se lee una sola vez, al arrancar el
    contenedor) y subiste archivos sin ella.

    BUENA PRÁCTICA
    - Una contraseña va en un Secret, nunca en un ConfigMap, y nunca en el
      repositorio. kubectl create secret generic --from-literal no necesita
      ningún archivo; --dry-run=client -o yaml muestra lo que crearía.
    - base64 es una codificación: a un Secret lo protege quién puede leerlo
      (RBAC: get, list y watch sobre secrets valen tanto como la
      contraseña), el cifrado en reposo de etcd (k3s server
      --secrets-encryption), y quedarse fuera de git. Herramientas como
      Sealed Secrets o una caja fuerte externa los mantienen fuera del
      repositorio para siempre.
    - Un secreto que se ha filtrado se cambia en su origen (rotación). El
      historial de git y sus copias conservan el antiguo para siempre:
      reescribir el historial no vuelve a hacer secreta una contraseña.
    - Las variables se leen al arrancar: tras cambiar un Secret, kubectl
      rollout restart. Un Secret montado como volumen lo actualiza el
      kubelet en más o menos un minuto (pero no a través de subPath), y la
      aplicación debe volver a leer el archivo.

    DOCUMENTACIÓN
    - Secrets: https://kubernetes.io/docs/concepts/configuration/secret/
    - Buenas prácticas para los Secrets: https://kubernetes.io/docs/concepts/security/secrets-good-practices/
    - Configurar un Pod para usar un ConfigMap: https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/
    - Distribuir credenciales de forma segura con Secrets: https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/
    - Cifrar los datos en reposo: https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/
    - Cifrado de los Secrets en k3s: https://docs.k3s.io/security/secrets-encryption
