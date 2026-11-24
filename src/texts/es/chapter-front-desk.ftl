### Historia «La Piscina», capítulo «La recepción»: el sitio de reservas
### debe servirlo el clúster. Un Ingress que apunta al puerto equivocado de
### un Service, un Service que no selecciona ningún pod, una sonda de
### disponibilidad en una ruta que la aplicación no tiene. curl con una
### cabecera Host, kubectl get/describe ingress, service, endpoints, el
### registro de Traefik. Los comandos, nombres de recursos, campos y salidas
### no se traducen.

chapter-front-desk = La recepción
    .summary = El sitio de reservas debe servirlo ahora el propio clúster, a través de su controlador de Ingress. Kemal, de informática del ayuntamiento, lo dejó todo listo el viernes, y la dirección responde «404 page not found». Sigue la petición de un visitante desde la puerta de entrada hasta los pods.

## Files

front-desk-message-folake =
    De: Folake (Piscina de la Ribera, recepción)
    Lunes 11 de junio, 8:45

    ¡Hola!

    Desde el viernes, booking.pool.example apunta a calle: el servidor
    antiguo ya no está, el clúster tiene que servir el sitio solo. Kemal,
    de informática del ayuntamiento, lo preparó todo el viernes por la
    tarde (su nota está junto a este mensaje), pero esta mañana la
    dirección solo dice «404 page not found». La piscina abre a las 9:00 y
    la gente reserva desde casa a primera hora.

    ¿Puedes echar un vistazo? Sin abrir nada que no debamos: el
    responsable de seguridad del ayuntamiento ya nos llamó la atención una
    vez.

    Folake
front-desk-note-kemal =
    Nota de Kemal (informática del ayuntamiento)

    El viernes ordené la aplicación de reservas en calle: quité el
    Deployment y apliqué mis manifiestos (en ~/manifests, con los de Rui):
    - una sonda de disponibilidad, para que un pod solo reciba tráfico
      cuando esté listo;
    - un Service, booking, delante de los pods;
    - un Ingress para booking.pool.example: el Traefik de k3s escucha en
      los puertos 80 y 443 de calle, y envía cada petición al Service al
      que llevan su host y su ruta.

    Para probar desde la propia calle:
      curl -H 'Host: booking.pool.example' http://localhost/

    La aplicación escucha en el puerto 8080.

    Kemal

## Events

front-desk-event-not-found =
    «404 page not found» es la respuesta de Traefik, no de la aplicación:
    ninguna ruta para este host y esta ruta. Traefik construye sus rutas a
    partir de los Ingress; una ruta cuyo destino no puede construir queda
    fuera, y su registro dice por qué (kubectl logs -n kube-system
    deploy/traefik). ¿Qué dice el Ingress (kubectl describe ingress
    booking -n swim)?
front-desk-event-ingress-port =
    El Ingress envía al puerto 8080 del Service booking, pero el Service
    escucha en el puerto 80 (reenvía al 8080 de los pods: targetPort). Un
    Ingress nombra un puerto del Service, no de los pods.
front-desk-event-port-fixed =
    El Ingress nombra ahora un puerto que tiene el Service. ¿Tiene el
    Service adónde enviar el tráfico? kubectl get endpoints booking -n
    swim.
front-desk-event-no-endpoints =
    Ningún endpoint: el Service no envía a nadie. Un Service elige sus pods
    por sus etiquetas (su selector); compáralo con las etiquetas de los
    pods (kubectl get pods -n swim --show-labels).
front-desk-event-labels-changed =
    El servidor de la API se niega: el selector de un Deployment no puede
    cambiar, y las etiquetas de la plantilla de pod deben coincidir con él.
    Deja en paz las etiquetas de los pods: es el selector del Service el
    que debe encontrarlos.
front-desk-event-selector-fixed =
    El Service selecciona ahora los pods de booking. kubectl get
    endpointslices -n swim los lista; pero kubectl get endpoints booking -n
    swim solo se queda con los que están listos. ¿Están listos?
front-desk-event-not-ready =
    «Readiness probe failed: HTTP probe failed with statuscode: 404»: el
    kubelet pide a la aplicación una ruta que no tiene, así que los pods
    se quedan en 0/1 y el Service no les da tráfico. ¿En qué ruta responde
    la aplicación? (curl a la dirección del pod en el 8080 desde calle, o
    kubectl exec … -- wget -qO- …)
front-desk-event-node-port =
    Un NodePort abre el puerto { $port } en la propia calle, a todo
    internet, al lado de Traefik: sin host, sin TLS, sin una única puerta
    de entrada. Al responsable de seguridad del ayuntamiento no le va a
    gustar. Vuelve a poner el Service como ClusterIP: el Ingress es la
    entrada.
front-desk-event-port-forward =
    kubectl port-forward sí llega a la aplicación (incluso se salta la
    comprobación de disponibilidad), pero solo desde calle, solo mientras
    se ejecuta el comando, y solo para ti. Una buena herramienta de prueba;
    no una forma de servir a los visitantes. Ctrl-C para pararlo.
front-desk-event-probe-removed =
    Sin sonda de disponibilidad, un pod recibe tráfico en cuanto arranca
    su contenedor, aunque la aplicación todavía no esté lista (o haya
    perdido su base de datos). La sonda era una buena idea; solo pide la
    ruta equivocada.
front-desk-event-probe-fixed =
    La sonda de disponibilidad pasa: los pods están en 1/1, y el Service
    les envía tráfico.
front-desk-event-drift =
    El sitio responde, pero los archivos de ~/manifests no describen lo
    que se ejecuta: el próximo kubectl apply -f ~/manifests/ volvería a
    romperlo. Corrige los archivos y aplícalos.
front-desk-event-end =
    Folake: «¡Funciona! Y la primera reserva ha llegado a las 8:58, desde
    un teléfono. Kemal da las gracias, y dice que la próxima vez leerá la
    documentación.»

    ¡Bien hecho! Has terminado La recepción.

    QUÉ HA PASADO
    La petición de un visitante pasa por tres puertas. Traefik, el
    controlador de Ingress de k3s, compara el host y la ruta del Ingress y
    envía la petición a un puerto de un Service; el Service la envía a los
    pods listos que elige su selector (sus endpoints); un pod está listo
    cuando pasa su sonda de disponibilidad. Cada puerta estaba cerrada: el
    Ingress nombraba el puerto de los pods (8080) en lugar del del Service
    (80), el Service seleccionaba app=booking-web mientras que los pods son
    app=booking, y la sonda pedía /healthz, a lo que la aplicación responde
    404 (tiene /health).

    BUENA PRÁCTICA
    - Sigue la petición: curl con la cabecera Host correcta, kubectl
      describe ingress (sus destinos), kubectl get endpoints (quién
      recibe), los Events de los pods (¿están listos?), el registro del
      controlador de Ingress.
    - Un Ingress nombra un Service y uno de sus puertos; targetPort es el
      puerto de los pods.
    - Los Endpoints solo listan los pods listos; las EndpointSlices
      muestran también los demás, con ready: false.
    - Conserva las sondas de disponibilidad, en una ruta a la que la
      aplicación responda de verdad; un NodePort o un port-forward no son
      una puerta de entrada.

    DOCUMENTACIÓN
    - Services: https://kubernetes.io/docs/concepts/services-networking/service/
    - Ingress: https://kubernetes.io/docs/concepts/services-networking/ingress/
    - Sondas: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
    - Depurar un Service: https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/
    - Traefik en k3s: https://docs.k3s.io/networking/networking-services
