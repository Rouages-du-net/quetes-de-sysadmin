### Story "The Pool", chapter "The Front Desk": the booking site must be
### served by the cluster. An Ingress pointing at the wrong port of a
### Service, a Service that selects no pod, a readiness probe on a path
### the app doesn't have. curl with a Host header, kubectl get/describe
### ingress, service, endpoints, Traefik's log. Commands, resource names,
### fields and outputs are not translated.

chapter-front-desk = The Front Desk
    .summary = The booking site must now be served by the cluster itself, through its ingress controller. Kemal from the town's IT set it all up on Friday, and the address answers "404 page not found". Follow a visitor's request from the front door to the pods.

## Files

front-desk-message-folake =
    From: Folake (Riverside Pool, front office)
    Monday 11 June, 8:45

    Hello!

    Since Friday, booking.pool.example points to lane: the old server is
    gone, the cluster must serve the site by itself. Kemal, from the
    town's IT, prepared everything on Friday evening (his note is next to
    this message), but this morning the address only says "404 page not
    found". The pool opens at 9:00 and people book from home first thing.

    Can you have a look? Without opening anything we shouldn't: the
    town's security officer already told us off once.

    Folake
front-desk-note-kemal =
    Note from Kemal (town IT)

    Friday, I tidied up the booking app on lane: I removed the Deployment
    and applied my manifests (in ~/manifests, with Rui's):
    - a readiness probe, so that a pod gets traffic only once it is ready;
    - a Service, booking, in front of the pods;
    - an Ingress for booking.pool.example: k3s's Traefik listens on ports
      80 and 443 of lane, and sends each request to the Service its host
      and path lead to.

    To test from lane itself:
      curl -H 'Host: booking.pool.example' http://localhost/

    The app listens on port 8080.

    Kemal

## Events

front-desk-event-not-found =
    "404 page not found" is Traefik's answer, not the app's: no route for
    this host and this path. Traefik builds its routes from the Ingresses;
    a route whose backend it can't build is left out, and its log says why
    (kubectl logs -n kube-system deploy/traefik). What does the Ingress say
    (kubectl describe ingress booking -n swim)?
front-desk-event-ingress-port =
    The Ingress sends to port 8080 of the Service booking, but the Service
    listens on port 80 (it forwards to 8080 on the pods: targetPort).
    An Ingress names a Service's port, not the pods'.
front-desk-event-port-fixed =
    The Ingress now names a port the Service has. Does the Service have
    somewhere to send the traffic? kubectl get endpoints booking -n swim.
front-desk-event-no-endpoints =
    No endpoints: the Service sends to nobody. A Service picks its pods by
    their labels (its selector); compare with the pods' labels (kubectl get
    pods -n swim --show-labels).
front-desk-event-labels-changed =
    The API server refuses: a Deployment's selector can't change, and the
    pod template's labels must match it. Leave the pods' labels alone: it
    is the Service's selector that must find them.
front-desk-event-selector-fixed =
    The Service now selects the booking pods. kubectl get endpointslices
    -n swim lists them; but kubectl get endpoints booking -n swim only keeps
    the ready ones. Are they ready?
front-desk-event-not-ready =
    "Readiness probe failed: HTTP probe failed with statuscode: 404": the
    kubelet asks the app for a path it doesn't have, so the pods stay 0/1
    and the Service gives them no traffic. Which path does the app answer
    on? (curl the pod's address on 8080 from lane, or kubectl exec … --
    wget -qO- …)
front-desk-event-node-port =
    A NodePort opens port { $port } on lane itself, to the whole internet,
    beside Traefik: no host, no TLS, no single front door. The town's
    security officer won't like it. Put the Service back as a ClusterIP:
    the Ingress is the way in.
front-desk-event-port-forward =
    kubectl port-forward does reach the app (it even skips the readiness
    check), but only from lane, only while the command runs, and only for
    you. A good test tool; not a way to serve visitors. Ctrl-C to stop it.
front-desk-event-probe-removed =
    Without a readiness probe, a pod gets traffic as soon as its container
    starts, even if the app isn't ready yet (or has lost its database).
    The probe was a good idea; it only asks the wrong path.
front-desk-event-probe-fixed =
    The readiness probe passes: the pods are 1/1, and the Service sends
    them traffic.
front-desk-event-drift =
    The site answers, but the files in ~/manifests don't describe what
    runs: the next kubectl apply -f ~/manifests/ would break it again. Fix
    the files and apply them.
front-desk-event-end =
    Folake: "It works! And the first booking came in at 8:58, from a phone.
    Kemal says thanks, and that he'll read the docs next time."

    Well done! You finished The Front Desk.

    WHAT HAPPENED
    A visitor's request goes through three doors. Traefik, k3s's ingress
    controller, matches the Ingress's host and path and sends the request
    to a Service's port; the Service sends it to the ready pods its
    selector picks (its endpoints); a pod is ready when its readiness
    probe passes. Each door was shut: the Ingress named the pods' port
    (8080) instead of the Service's (80), the Service selected
    app=booking-web while the pods are app=booking, and the probe asked
    /healthz, which the app answers 404 (it has /health).

    GOOD PRACTICE
    - Follow the request: curl with the right Host header, kubectl describe
      ingress (its backends), kubectl get endpoints (who receives), the
      pods' Events (are they ready?), the ingress controller's log.
    - An Ingress names a Service and one of its ports; targetPort is the
      pods' port.
    - Endpoints list only the ready pods; EndpointSlices show the others
      too, with ready: false.
    - Keep readiness probes, on a path the app really answers; a NodePort
      or a port-forward is no front door.

    DOCUMENTATION
    - Services: https://kubernetes.io/docs/concepts/services-networking/service/
    - Ingress: https://kubernetes.io/docs/concepts/services-networking/ingress/
    - Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
    - Debugging a Service: https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/
    - Traefik in k3s: https://docs.k3s.io/networking/networking-services
