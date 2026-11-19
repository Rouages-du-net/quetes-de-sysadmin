### Graded hints for The Pool (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The Pod That Won't Start

hint-wont-start-pods =
    .lead = List the pods of the booking app, in its namespace (Rui's note gives it), and look at their STATUS (man kubectl).
    .solution = kubectl get pods -n swim
hint-wont-start-pull-error =
    .lead = Ask Kubernetes why the new pod won't start: the Events at the end of its description say it.
    .solution = kubectl describe pod NAME -n swim (the pod in ImagePullBackOff)
hint-wont-start-tag-fixed =
    .lead = The registry doesn't know the tag the Deployment asks for: fix the image in Rui's manifest (his note lists the releases), then apply the file.
    .solution = nano ~/manifests/booking.yaml (image: registry.pool.example/booking:2.3.1), then kubectl apply -f ~/manifests/
hint-wont-start-crash =
    .lead = Look at the new pod again, a few seconds later: does it run?
    .solution = kubectl get pods -n swim
hint-wont-start-logs =
    .lead = The container stops by itself: read what it printed before stopping (man kubectl: logs, --previous).
    .solution = kubectl logs NAME -n swim --previous
hint-wont-start-env-fixed =
    .lead = The app asks for a variable the template doesn't give it: rename the variable in the manifest, keeping its value from the ConfigMap, and apply.
    .solution = nano ~/manifests/booking.yaml (- name: DATABASE_HOST instead of DB_HOST), then kubectl apply -f ~/manifests/
hint-wont-start-rolled-out =
    .lead = Follow the rollout until the new pods replace the old ones.
    .solution = kubectl rollout status deployment/booking -n swim
hint-wont-start-end =
    .lead = Everything that runs must be in the files (a second apply says unchanged), and no pod nobody manages may stay in the namespace.
    .solution = kubectl apply -f ~/manifests/ (all unchanged), kubectl get pods -n swim (delete a pod of yours with kubectl delete pod NAME -n swim)

## Chapter 2 — The Front Desk

hint-front-desk-not-found =
    .lead = Ask the site like a visitor would, from lane: Traefik listens on port 80, and tells sites apart by the Host header (man curl).
    .solution = curl -H 'Host: booking.pool.example' http://localhost/
hint-front-desk-ingress-port =
    .lead = Look at the Ingress in detail: which Service and which port does it send to? Traefik's log says what it thinks of it.
    .solution = kubectl describe ingress booking -n swim, kubectl logs -n kube-system deploy/traefik
hint-front-desk-port-fixed =
    .lead = An Ingress names a port of the Service (port:), not the pods' (targetPort:). Fix ingress.yaml and apply it.
    .solution = nano ~/manifests/ingress.yaml (number: 80), then kubectl apply -f ~/manifests/
hint-front-desk-no-endpoints =
    .lead = Does the Service send to anyone? Its endpoints are the pods it selects.
    .solution = kubectl get endpoints booking -n swim
hint-front-desk-selector-fixed =
    .lead = Compare the Service's selector with the pods' labels, and fix the Service (not the pods).
    .solution = kubectl get pods -n swim --show-labels; nano ~/manifests/service.yaml (selector app: booking), then kubectl apply -f ~/manifests/
hint-front-desk-not-ready =
    .lead = The pods are Running but not ready (0/1): their Events say why.
    .solution = kubectl describe pod NAME -n swim
hint-front-desk-probe-fixed =
    .lead = Find the path the app really answers (try it on a pod's address, port 8080), fix the readiness probe in the manifest, apply.
    .solution = curl http://POD_IP:8080/health; nano ~/manifests/booking.yaml (path: /health), then kubectl apply -f ~/manifests/
hint-front-desk-end =
    .lead = The site through Traefik, a readiness probe that passes, no NodePort, and the files the same as what runs.
    .solution = kubectl rollout status deployment/booking -n swim, then curl -H 'Host: booking.pool.example' http://localhost/
