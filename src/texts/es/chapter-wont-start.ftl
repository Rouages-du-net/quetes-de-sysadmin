### Historia «La Piscina», capítulo «El pod que no arranca»: la nueva versión
### de un Deployment no arranca nunca (una etiqueta de imagen errónea, luego
### un ajuste renombrado). kubectl get, describe y sus Events, logs
### --previous, apply -f, rollout status. Los comandos, nombres de recursos,
### campos y salidas no se traducen.

chapter-wont-start = El pod que no arranca
    .summary = La aplicación de reservas de la piscina funciona en un pequeño clúster de Kubernetes, y la versión de esta mañana no ha arrancado nunca. Las inscripciones a los cursos de verano abren a las nueve: averigua por qué no arranca el pod nuevo, y arréglalo donde corresponde.

## Files

wont-start-message-folake =
    De: Folake (Piscina de la Ribera, recepción)
    Lunes 4 de junio, 8:35

    ¡Hola, y gracias por venir tan temprano!

    Las inscripciones a los cursos de natación de verano abren a las 9:00
    en el sitio de reservas, y necesitan la versión 2.3.1 de la
    aplicación. Rui la desplegó esta mañana en calle, nuestro servidor
    Kubernetes, justo antes de coger el tren, y me escribió: «el pod nuevo
    no arranca, no tengo tiempo, ¡lo siento!».

    El sitio sigue respondiendo, con la versión antigua. ¿Puedes poner en
    marcha la nueva antes de las 9:00?

    Los archivos de Rui están en ~/manifests, y su nota está junto a este
    mensaje.

    Folake
wont-start-note-rui =
    Nota de Rui

    calle funciona con k3s, un Kubernetes de una sola máquina. kubectl
    funciona con tu cuenta (~/.kube/config). Todo lo de la aplicación de
    reservas está en el namespace swim: un Deployment, booking (dos pods),
    y sus ajustes, el ConfigMap booking-config.

    Los manifiestos están en ~/manifests; los cambio, y luego:
      kubectl apply -f ~/manifests/

    Las versiones están en el registro del ayuntamiento,
    registry.pool.example/booking: 2.2.0 (lo que funcionaba hasta hoy),
    2.3.0, 2.3.1.

    Rui

## Events

wont-start-event-default-namespace =
    Nada en el namespace default: la aplicación de reservas vive en swim.
    Añade -n swim a tus comandos (o haz de swim el namespace de tu
    contexto: man kubectl, los ejemplos).
wont-start-event-pods =
    El pod nuevo está atascado en ErrImagePull, luego ImagePullBackOff: el
    nodo no consigue su imagen, y lo vuelve a intentar cada vez menos a
    menudo (10 s, 20 s, 40 s… hasta 5 minutos). Los dos pods antiguos
    siguen funcionando: una actualización progresiva solo los quita cuando
    hay nuevos disponibles. ¿Por qué no se puede descargar la imagen?
    kubectl describe pod NOMBRE -n swim: los Events al final.
wont-start-event-pull-error =
    «not found»: el registro responde, pero no tiene esa etiqueta. Compara
    la imagen que pide el Deployment con las versiones de la nota de Rui.
wont-start-event-pod-deleted =
    El pod ha desaparecido… y otro ha ocupado su lugar, con el mismo
    error. Un pod de un Deployment pertenece a un ReplicaSet, que mantiene
    el número de pods que se le ha pedido: la corrección está en la
    plantilla del Deployment, no en sus pods.
wont-start-event-run =
    kubectl run arranca un pod suelto: ningún ReplicaSet lo vigila, el
    Service y el Deployment no lo conocen, y si el nodo se reinicia nadie
    lo volverá a arrancar. Puede servir para probar una imagen, pero no
    arregla nada: el Deployment sigue pidiendo lo mismo. Bórralo cuando
    termines (kubectl delete pod NOMBRE -n swim).
wont-start-event-pod-edited =
    Has cambiado un pod, no su Deployment. Su ReplicaSet sigue teniendo la
    plantilla antigua: el próximo pod que cree (un reinicio, un nodo que
    rearranca, un escalado) volverá con los valores antiguos. Corrige la
    plantilla, en ~/manifests/booking.yaml, y aplícala.
wont-start-event-tag-fixed =
    El Deployment pide ahora registry.pool.example/booking:2.3.1: un
    ReplicaSet nuevo (un pod-template-hash nuevo) arranca sus pods.
    Obsérvalos: kubectl get pods -n swim.
wont-start-event-crash =
    La imagen está, el contenedor arranca… y se detiene enseguida:
    CrashLoopBackOff. El kubelet lo reinicia, esperando cada vez más
    (RESTARTS sube). ¿Qué dijo antes de pararse? kubectl logs POD -n swim
    (añade --previous una vez que se haya reiniciado: la instancia que
    falló).
wont-start-event-logs =
    La aplicación lo dice: desde la 2.3.0 lee DATABASE_HOST, y ya no
    DB_HOST. En la plantilla, la variable conserva el valor del ConfigMap
    (la clave database_host); solo tiene que cambiar su nombre.
wont-start-event-config-error =
    CreateContainerConfigError: el kubelet no puede construir el entorno
    del contenedor, porque un ConfigMap o una de sus claves no existe. La
    clave es el nombre en el ConfigMap (kubectl get configmap
    booking-config -n swim -o yaml); el nombre de la variable es lo que lee
    la aplicación.
wont-start-event-env-fixed =
    La plantilla da ahora DATABASE_HOST al contenedor. kubectl rollout
    status deployment/booking -n swim sigue el despliegue hasta que termina
    (o falla).
wont-start-event-rolled-out = La nueva versión funciona en los dos pods, y los antiguos han desaparecido.
wont-start-event-drift =
    El clúster ejecuta la versión correcta, pero ~/manifests/booking.yaml
    sigue describiendo la antigua: el próximo kubectl apply -f ~/manifests/
    volvería a poner los errores. Pon el archivo de acuerdo con lo que se
    ejecuta, y aplícalo (debería decir entonces unchanged).
wont-start-event-lone-pod =
    Una cosa más: el pod { $pod } sigue ahí, y nadie lo gestiona. Bórralo.
wont-start-event-end =
    Folake: «¡8:56! La página muestra 2.3.1, las primeras familias se están
    inscribiendo. Rui se va a quedar tranquilo.»

    ¡Bien hecho! Has terminado El pod que no arranca.

    QUÉ HA PASADO
    Un Deployment guarda una plantilla de pod; cada versión de ella tiene
    su propio ReplicaSet, que mantiene los pods. La nueva plantilla de Rui
    pedía la etiqueta de imagen 2.31: el registro no tiene esa etiqueta,
    así que el containerd del nodo no pudo descargarla (ErrImagePull), y el
    kubelet lo volvió a intentar cada vez menos a menudo
    (ImagePullBackOff). Mientras tanto, la actualización progresiva
    conservó los dos pods antiguos, ya que no había ninguno nuevo
    disponible. Con la 2.3.1, el contenedor arrancó y falló
    (CrashLoopBackOff): la versión 2.3.0 había renombrado DB_HOST a
    DATABASE_HOST, como decía el registro del contenedor que falló. La
    corrección fue al manifiesto, luego kubectl apply, y el despliegue
    sustituyó los pods antiguos uno a uno.

    BUENA PRÁCTICA
    - Lee en orden: kubectl get pods (el estado), kubectl describe pod (los
      Events dicen por qué), kubectl logs --previous (lo que dijo la
      aplicación antes de fallar).
    - Corrige el Deployment, nunca sus pods: un pod borrado vuelve, un pod
      editado se olvida en el próximo reinicio.
    - Los manifiestos son la verdad: cambia el archivo, kubectl apply -f, y
      comprueba que un segundo apply dice unchanged. Un kubectl edit o set
      image que el archivo no conoce se deshace con el próximo apply.
    - kubectl rollout status espera al final de un despliegue; un
      despliegue que se queda atascado termina con
      ProgressDeadlineExceeded (10 minutos por defecto), y kubectl rollout
      undo vuelve a la plantilla anterior.
    - minReadySeconds y las sondas de disponibilidad evitan que un
      despliegue quite los pods antiguos demasiado pronto.

    DOCUMENTACIÓN
    - Depurar pods: https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/
    - El ciclo de vida de un pod: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/
    - Imágenes e ImagePullBackOff: https://kubernetes.io/docs/concepts/containers/images/
    - Deployments y actualizaciones progresivas: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
