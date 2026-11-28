### Graded hints for The Pool (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).


## Chapter 1 — The Pod That Won't Start

hint-wont-start-pods =
    .lead = Liste die Pods der Buchungs-App auf, in ihrem Namespace (Ruis Notiz nennt ihn), und schau dir ihren STATUS an (man kubectl).
    .solution = kubectl get pods -n swim
hint-wont-start-pull-error =
    .lead = Frag Kubernetes, warum der neue Pod nicht startet: die Events am Ende seiner Beschreibung sagen es.
    .solution = kubectl describe pod NAME -n swim (der Pod in ImagePullBackOff)
hint-wont-start-tag-fixed =
    .lead = Die Registry kennt den Tag nicht, den das Deployment verlangt: repariere das Image in Ruis Manifest (seine Notiz listet die Releases), dann wende die Datei an.
    .solution = nano ~/manifests/booking.yaml (image: registry.pool.example/booking:2.3.1), dann kubectl apply -f ~/manifests/
hint-wont-start-crash =
    .lead = Schau dir den neuen Pod ein paar Sekunden später noch einmal an: läuft er?
    .solution = kubectl get pods -n swim
hint-wont-start-logs =
    .lead = Der Container hält von selbst an: lies, was er vor dem Anhalten ausgegeben hat (man kubectl: logs, --previous).
    .solution = kubectl logs NAME -n swim --previous
hint-wont-start-env-fixed =
    .lead = Die App verlangt eine Variable, die das Template ihr nicht gibt: benenne die Variable im Manifest um, behalte ihren Wert aus der ConfigMap, und wende an.
    .solution = nano ~/manifests/booking.yaml (- name: DATABASE_HOST statt DB_HOST), dann kubectl apply -f ~/manifests/
hint-wont-start-rolled-out =
    .lead = Verfolge den Rollout, bis die neuen Pods die alten ersetzen.
    .solution = kubectl rollout status deployment/booking -n swim
hint-wont-start-end =
    .lead = Alles, was läuft, muss in den Dateien stehen (ein zweites apply sagt unchanged), und kein Pod, den niemand verwaltet, darf im Namespace bleiben.
    .solution = kubectl apply -f ~/manifests/ (alles unchanged), kubectl get pods -n swim (einen eigenen Pod mit kubectl delete pod NAME -n swim löschen)

## Chapter 2 — The Front Desk

hint-front-desk-not-found =
    .lead = Frag die Site so, wie eine Besucherin es täte, von bahn aus: Traefik lauscht auf Port 80 und unterscheidet die Sites am Host-Header (man curl).
    .solution = curl -H 'Host: booking.pool.example' http://localhost/
hint-front-desk-ingress-port =
    .lead = Schau dir den Ingress im Detail an: an welchen Service und welchen Port schickt er? Das Log von Traefik sagt, was es davon hält.
    .solution = kubectl describe ingress booking -n swim, kubectl logs -n kube-system deploy/traefik
hint-front-desk-port-fixed =
    .lead = Ein Ingress nennt einen Port des Service (port:), nicht den der Pods (targetPort:). Repariere ingress.yaml und wende es an.
    .solution = nano ~/manifests/ingress.yaml (number: 80), dann kubectl apply -f ~/manifests/
hint-front-desk-no-endpoints =
    .lead = Schickt der Service an irgendwen? Seine Endpoints sind die Pods, die er wählt.
    .solution = kubectl get endpoints booking -n swim
hint-front-desk-selector-fixed =
    .lead = Vergleiche den Selector des Service mit den Labels der Pods, und repariere den Service (nicht die Pods).
    .solution = kubectl get pods -n swim --show-labels; nano ~/manifests/service.yaml (selector app: booking), dann kubectl apply -f ~/manifests/
hint-front-desk-not-ready =
    .lead = Die Pods sind Running, aber nicht bereit (0/1): ihre Events sagen warum.
    .solution = kubectl describe pod NAME -n swim
hint-front-desk-probe-fixed =
    .lead = Finde den Pfad, auf dem die App wirklich antwortet (probiere es an der Adresse eines Pods, Port 8080), repariere die Readiness-Probe im Manifest, wende an.
    .solution = curl http://POD_IP:8080/health; nano ~/manifests/booking.yaml (path: /health), dann kubectl apply -f ~/manifests/
hint-front-desk-end =
    .lead = Die Site über Traefik, eine Readiness-Probe, die besteht, kein NodePort, und die Dateien gleich dem, was läuft.
    .solution = kubectl rollout status deployment/booking -n swim, dann curl -H 'Host: booking.pool.example' http://localhost/

## Chapter 3 — The Locker Room

hint-locker-room-config-read =
    .lead = Finde, wo das Passwort steht: in den Einstellungen der App, im Cluster und in den Dateien.
    .solution = cat ~/manifests/config.yaml, oder kubectl get configmap booking-config -n swim -o yaml
hint-locker-room-secret-created =
    .lead = Leg im Namespace swim ein Secret mit dem neuen Passwort an (Kemals Datei), ohne es in eine Datei des Repositorys zu schreiben (man kubectl: create secret generic).
    .solution = kubectl create secret generic booking-db -n swim --from-literal=password=DAS_NEUE_PASSWORT
hint-locker-room-decoded =
    .lead = Schau dir an, was das Secret wirklich enthält: seine Daten sind in base64. Ist das versteckt? (man base64)
    .solution = kubectl get secret booking-db -n swim -o jsonpath='{ "{" }.data.password{ "}" }' | base64 -d
hint-locker-room-referenced =
    .lead = Lass das Deployment DATABASE_PASSWORD aus dem Secret statt aus der ConfigMap nehmen, in booking.yaml (man kubectl: die env-Beispiele).
    .solution = nano ~/manifests/booking.yaml (valueFrom: secretKeyRef: name: booking-db, key: password), dann kubectl apply -f ~/manifests/
hint-locker-room-config-cleaned =
    .lead = Nimm das Passwort aus der ConfigMap, aber behalte die ConfigMap: die App liest dort weiterhin ihren database_host.
    .solution = nano ~/manifests/config.yaml (database_password entfernen), dann kubectl apply -f ~/manifests/
hint-locker-room-restarted =
    .lead = Jeder laufende Pod muss mit dem neuen Passwort gestartet sein: ein Container liest seine Variablen beim Start.
    .solution = kubectl rollout restart deployment/booking -n swim, dann kubectl rollout status deployment/booking -n swim
hint-locker-room-committed =
    .lead = Die Dateien in ~/manifests sind ein Git-Repository: halte die reparierten Dateien in einem Commit fest (man git).
    .solution = cd ~/manifests; git status; git commit -am "Datenbankpasswort in einem Secret"
hint-locker-room-pushed =
    .lead = Kemal pullt aus dem gemeinsamen Repository: schick deinen Commit dorthin.
    .solution = git push (in ~/manifests)
hint-locker-room-end =
    .lead = Das neue Passwort in einem Secret, das die Pods benutzen, kein Passwort in der ConfigMap oder in den Dateien, die Dateien gleich dem, was läuft, der Commit gepusht.
    .solution = kubectl apply -f ~/manifests/ (alles unchanged), git status, git log -p (das alte Passwort bleibt in der Historie: deshalb wurde es geändert)

## Chapter 4 — The Deep End

hint-deep-end-oom =
    .lead = Die Pods starten immer wieder neu: frag Kubernetes, wie der letzte Container geendet hat (sein Last State).
    .solution = kubectl get pods -n swim, dann kubectl describe pod NAME -n swim
hint-deep-end-top =
    .lead = Miss, wie viel Speicher die Pods und der Node gerade brauchen (man kubectl: top).
    .solution = kubectl top pod -n swim, kubectl top node
hint-deep-end-history =
    .lead = Was hat sich seit dem letzten Wettkampf geändert? Das Deployment behält seine Revisionen.
    .solution = kubectl rollout history deployment/booking -n swim
hint-deep-end-leak =
    .lead = Gib 2.4.0 ein wenig Zeit, und beobachte ihren Speicher und was sie loggt.
    .solution = kubectl top pod -n swim (zweimal, eine Minute auseinander), kubectl logs deploy/booking -n swim --tail=5
hint-deep-end-rolled-back =
    .lead = Geh zurück zu dem Release, das den letzten Wettkampf gehalten hat (die Historie des Deployments sagt, welches): in der Datei (und kubectl rollout undo kann es sofort tun, zur richtigen Revision).
    .solution = kubectl rollout undo deployment/booking -n swim --to-revision=N, oder nano ~/manifests/booking.yaml (image …:2.3.1) und kubectl apply -f ~/manifests/
hint-deep-end-limit-raised =
    .lead = Setze das Speicherlimit über die Spitze, die du unter der Last des Wettkampfs misst (kubectl top pod, mehr als einmal: es ändert sich), mit maßvollem Spielraum: weniger als das Doppelte der Spitze, bei weitem nicht den ganzen Node.
    .solution = nano ~/manifests/booking.yaml (limits: memory: 320Mi), dann kubectl apply -f ~/manifests/
hint-deep-end-requests =
    .lead = Setze die Speicher-Requests auf das, was die App unter Last normalerweise braucht (kubectl top pod), unter dem Limit.
    .solution = nano ~/manifests/booking.yaml (requests: memory: 256Mi), dann kubectl apply -f ~/manifests/ und kubectl rollout status deployment/booking -n swim
hint-deep-end-end =
    .lead = 2.3.1 unter der Last des Wettkampfs ausgerollt, sinnvolle Requests und Limits, und die Dateien gleich dem, was läuft.
    .solution = kubectl apply -f ~/manifests/ (alles unchanged), kubectl get pods -n swim, kubectl top pod -n swim
