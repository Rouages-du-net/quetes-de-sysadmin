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

## Chapter 3 — The Locker Room

hint-locker-room-config-read =
    .lead = Find where the password is written: in the app's settings, in the cluster and in the files.
    .solution = cat ~/manifests/config.yaml, or kubectl get configmap booking-config -n swim -o yaml
hint-locker-room-secret-created =
    .lead = Create a Secret in the swim namespace holding the new password (Kemal's file), without writing it in a file of the repository (man kubectl: create secret generic).
    .solution = kubectl create secret generic booking-db -n swim --from-literal=password=THE_NEW_PASSWORD
hint-locker-room-decoded =
    .lead = Look at what the Secret really holds: its data are in base64. Is that hidden? (man base64)
    .solution = kubectl get secret booking-db -n swim -o jsonpath='{"{"}.data.password{"}"}' | base64 -d
hint-locker-room-referenced =
    .lead = Make the Deployment take DATABASE_PASSWORD from the Secret instead of the ConfigMap, in booking.yaml (man kubectl: the env examples).
    .solution = nano ~/manifests/booking.yaml (valueFrom: secretKeyRef: name: booking-db, key: password), then kubectl apply -f ~/manifests/
hint-locker-room-config-cleaned =
    .lead = Take the password out of the ConfigMap, but keep the ConfigMap: the app still reads its database_host there.
    .solution = nano ~/manifests/config.yaml (remove database_password), then kubectl apply -f ~/manifests/
hint-locker-room-restarted =
    .lead = Every running pod must have started with the new password: a container reads its variables when it starts.
    .solution = kubectl rollout restart deployment/booking -n swim, then kubectl rollout status deployment/booking -n swim
hint-locker-room-committed =
    .lead = The files in ~/manifests are a git repository: record the fixed files in a commit (man git).
    .solution = cd ~/manifests; git status; git commit -am "Database password in a Secret"
hint-locker-room-pushed =
    .lead = Kemal pulls from the shared repository: send your commit there.
    .solution = git push (in ~/manifests)
hint-locker-room-end =
    .lead = The new password in a Secret the pods use, no password in the ConfigMap or in the files, the files the same as what runs, the commit pushed.
    .solution = kubectl apply -f ~/manifests/ (all unchanged), git status, git log -p (the old password stays in the history: that's why it was changed)

## Chapter 4 — The Deep End

hint-deep-end-oom =
    .lead = The pods keep restarting: ask Kubernetes how the last container ended (its Last State).
    .solution = kubectl get pods -n swim, then kubectl describe pod NAME -n swim
hint-deep-end-top =
    .lead = Measure how much memory the pods and the node use right now (man kubectl: top).
    .solution = kubectl top pod -n swim, kubectl top node
hint-deep-end-history =
    .lead = What changed since the last meet? The Deployment keeps its revisions.
    .solution = kubectl rollout history deployment/booking -n swim
hint-deep-end-leak =
    .lead = Give 2.4.0 a little time, and watch its memory and what it logs.
    .solution = kubectl top pod -n swim (twice, a minute apart), kubectl logs deploy/booking -n swim --tail=5
hint-deep-end-rolled-back =
    .lead = Go back to the release that held the last meet (the Deployment's history says which): in the file (and kubectl rollout undo can do it at once, to the right revision).
    .solution = kubectl rollout undo deployment/booking -n swim --to-revision=N, or nano ~/manifests/booking.yaml (image …:2.3.1) and kubectl apply -f ~/manifests/
hint-deep-end-limit-raised =
    .lead = Set the memory limit above the peak you measure under the meet's load (kubectl top pod, more than once: it moves), with a modest margin: less than twice the peak, nowhere near the whole node.
    .solution = nano ~/manifests/booking.yaml (limits: memory: 320Mi), then kubectl apply -f ~/manifests/
hint-deep-end-requests =
    .lead = Set the memory requests to what the app usually uses under load (kubectl top pod), below the limit.
    .solution = nano ~/manifests/booking.yaml (requests: memory: 256Mi), then kubectl apply -f ~/manifests/ and kubectl rollout status deployment/booking -n swim
hint-deep-end-end =
    .lead = 2.3.1 rolled out under the meet's load, sensible requests and limits, and the files the same as what runs.
    .solution = kubectl apply -f ~/manifests/ (all unchanged), kubectl get pods -n swim, kubectl top pod -n swim
