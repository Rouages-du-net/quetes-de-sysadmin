### Historia «La Piscina», capítulo «La parte honda»: la carga de la
### competición de natación, límites de memoria copiados de un tutorial
### (OOMKilled, código de salida 137), una versión con una fuga de memoria.
### kubectl top, el Last State de describe, rollout history y undo, requests
### y limits a partir de lo medido. Los comandos, nombres de recursos, campos
### y salidas no se traducen.

chapter-deep-end = La parte honda
    .summary = El sábado es la competición regional de natación, y todo el mundo sigue los horarios y los resultados en la aplicación de reservas. Desde esta mañana sus pods no paran de reiniciarse. Mide lo que la aplicación usa de verdad, averigua por qué la matan y dale el espacio que necesita, ni más ni menos.

## Files

deep-end-message-folake =
    De: Folake (Piscina de la Ribera, recepción)
    Sábado 23 de junio, 9:15

    ¡Hola, perdona que te llame en sábado!

    Hoy es la competición regional de natación: doscientos nadadores y
    nadadoras, sus clubes, sus familias, y todo el mundo mira los horarios
    y los resultados en el sitio de reservas. Desde la salida a las 8:00
    solo dice «404 page not found». El sábado pasado aguantó toda la
    mañana.

    Rui puso una versión nueva anoche (su nota está aquí). Está en la
    competición, de cronometrador: no puede tocar el teléfono antes del
    mediodía.

    Folake
deep-end-note-rui =
    Nota de Rui (viernes, 18:20)

    He aplicado la 2.4.0: una caché de resultados, para que la página de
    horarios vaya más rápida mañana. También he añadido requests y limits
    de memoria, como hace el tutorial de Kubernetes (64Mi y 128Mi): queda
    más limpio. Los pods han arrancado bien.

    Para que conste, en la competición del sábado pasado (con la 2.3.1,
    sin límites), kubectl top pod mostró como mucho 230Mi por pod en el
    pico.

    Las versiones: 2.3.1 (desde el 4 de junio), 2.4.0 (esta noche).

    Rui

## Events

deep-end-event-oom =
    OOMKilled, código de salida 137 (128 + 9: matado por SIGKILL): el
    contenedor usó más memoria que su límite, y el núcleo lo mató. El
    kubelet lo vuelve a arrancar, cada vez menos a menudo
    (CrashLoopBackOff). ¿Cuánta memoria usa la aplicación, y cuánta se le
    permite?
deep-end-event-top =
    kubectl top pregunta al metrics-server lo que usa cada pod ahora mismo
    (kubectl top node para toda la máquina). Compáralo con el límite del
    Deployment, y con lo que midió Rui en la última competición.
deep-end-event-history =
    kubectl rollout history lista las revisiones del Deployment, con su
    CHANGE-CAUSE: la 2.4.0 trajo ayer una caché nueva. Un Deployment
    conserva sus ReplicaSets anteriores: volver atrás es un comando.
deep-end-event-leak =
    La caché de resultados crece con cada petición y nunca olvida: la
    memoria de la 2.4.0 sube mientras funciona, le des el espacio que le
    des. Es una fuga; ningún límite la arregla. La versión que aguantó la
    última competición es la 2.3.1.
deep-end-event-pending =
    «0/1 nodes are available: 1 Insufficient memory»: el planificador solo
    coloca un pod donde sus requests caben en lo que el nodo todavía puede
    dar (kubectl describe node: Allocatable, Allocated resources). Se queda
    Pending, y la actualización progresiva espera. Las requests son lo que
    el pod tiene garantizado: pide lo que usa, no el nodo entero.
deep-end-event-whole-node =
    Un límite de más de un gigabyte, en un nodo de 4 GiB para todo (k3s,
    Traefik, los demás pods): la aplicación nunca ha necesitado ni la
    cuarta parte. Un límite es una red de seguridad puesta un poco por
    encima del pico medido; una fuga llenaría el nodo antes de que la
    pararan.
deep-end-event-no-limits =
    Ya no hay límite de memoria: un contenedor puede tomar ahora toda la
    memoria del nodo. Con una fuga, el kubelet del nodo empezaría a
    desalojar pods, o el OOM killer del núcleo elegiría un proceso, quizá
    el propio k3s. Conserva un límite, por encima del pico medido.
deep-end-event-pods-deleted =
    Borrar los pods solo trae otros nuevos, con el mismo límite y la misma
    imagen: los matan igual. La corrección está en la plantilla del
    Deployment.
deep-end-event-leak-fills =
    Incluso con más espacio, la 2.4.0 volvió a ser OOMKilled: su memoria
    siguió creciendo hasta llegar al nuevo límite. Mira lo que registra
    (kubectl logs), y el historial del Deployment.
deep-end-event-undo-leaky =
    kubectl rollout undo vuelve una revisión atrás: la anterior a la actual
    sigue siendo la 2.4.0. kubectl rollout history las lista, y
    --to-revision elige una (kubectl rollout history … --revision=N muestra
    lo que contiene).
deep-end-event-rolled-back =
    El Deployment vuelve a ejecutar la 2.3.1. ¿Está en los archivos, y
    tiene espacio suficiente para el pico de la competición?
deep-end-event-below-peak =
    Este límite está por debajo de lo que usó la 2.3.1 en el pico de la
    última competición (230Mi, la nota de Rui): en el minuto de más
    actividad, volverían a matarla. Ponlo por encima del pico, con margen.
deep-end-event-limit-raised =
    El límite de memoria está ahora por encima del pico que midió Rui.
deep-end-event-requests-low =
    Las requests están muy por debajo de lo que usa la aplicación con
    carga: el planificador reserva eso, y podría colocar otros pods donde
    la aplicación necesita luego el espacio. Pide lo que usa habitualmente
    (kubectl top pod).
deep-end-event-requests =
    Requests que reservan lo que usa la aplicación, un límite por encima
    de su pico: los pods se planifican, y el núcleo los deja en paz.
deep-end-event-drift =
    Los pods funcionan como deben, pero ~/manifests/booking.yaml sigue
    diciendo otra cosa: el próximo kubectl apply -f ~/manifests/ volvería a
    poner la 2.4.0 o los límites antiguos. Escríbelo en el archivo y
    aplícalo.
deep-end-event-end =
    Folake: «¡Los resultados están en las pantallas y en los teléfonos de
    todo el mundo! Rui dice, entre dos pruebas, que la próxima vez probará
    su caché un día tranquilo entre semana.»

    ¡Bien hecho! Has terminado La parte honda.

    QUÉ HA PASADO
    Los límites de Rui, copiados de un tutorial (128Mi), servían una tarde
    tranquila; con la carga de la competición la aplicación necesita hasta
    230Mi, así que el núcleo mataba cada contenedor en cuanto tenía
    trabajo (OOMKilled, código de salida 137) y el sitio perdía sus pods
    uno tras otro. Y la caché de resultados de la 2.4.0 nunca olvida: con
    más espacio, también lo llena. Volviste a la 2.3.1, y pusiste requests
    y limits a partir de lo medido, en el archivo.

    BUENA PRÁCTICA
    - Mide antes de fijar: kubectl top pod y node, en el momento de más
      actividad (mejor: un historial, de Prometheus). Requests: lo que la
      aplicación usa habitualmente (el planificador lo reserva). Límite de
      memoria: por encima del pico medido, con margen.
    - OOMKilled: kubectl describe pod, Last State: Terminated, Reason:
      OOMKilled, Exit Code: 137; kubectl get pods cuenta los reinicios.
    - Una memoria que no para de crecer es una fuga: un límite mayor solo
      retrasa la muerte. Vuelve atrás (kubectl rollout undo, o la imagen
      anterior en el archivo), y busca la causa un día tranquilo.
    - Requests mayores que el nodo: el pod se queda Pending
      (FailedScheduling: Insufficient memory). Sin ningún límite: una sola
      fuga puede tomar el nodo entero.
    - kubectl rollout undo cambia lo que se ejecuta, no los archivos:
      escribe también la corrección en el manifiesto.

    DOCUMENTACIÓN
    - Gestión de recursos para pods y contenedores: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
    - Asignar recursos de memoria a contenedores y pods (superar un límite, OOM): https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/
    - Desalojo por presión del nodo: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
    - Volver atrás un Deployment: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment
    - kubectl top: https://kubernetes.io/docs/reference/kubectl/generated/kubectl_top/
