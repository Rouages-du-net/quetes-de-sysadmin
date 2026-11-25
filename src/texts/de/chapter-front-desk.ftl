### Story "The Pool", chapter "The Front Desk": the booking site must be
### served by the cluster. An Ingress pointing at the wrong port of a
### Service, a Service that selects no pod, a readiness probe on a path
### the app doesn't have. curl with a Host header, kubectl get/describe
### ingress, service, endpoints, Traefik's log. Commands, resource names,
### fields and outputs are not translated.

chapter-front-desk = Der Empfang
    .summary = Die Buchungs-Site muss jetzt vom Cluster selbst ausgeliefert werden, über seinen Ingress-Controller. Kemal von der IT der Stadt hat am Freitag alles eingerichtet, und die Adresse antwortet „404 page not found“. Verfolge die Anfrage einer Besucherin von der Eingangstür bis zu den Pods.

## Files

front-desk-message-folake =
    Von: Folake (Uferbad, Kasse und Büro)
    Montag, 11. Juni, 8:45
    
    Hallo!
    
    Seit Freitag zeigt booking.pool.example auf lane: der alte Server ist
    weg, der Cluster muss die Site allein ausliefern. Kemal von der IT der
    Stadt hat am Freitagabend alles vorbereitet (seine Notiz liegt neben
    dieser Nachricht), aber heute Morgen sagt die Adresse nur „404 page not
    found“. Das Bad öffnet um 9:00 Uhr, und die Leute buchen gleich
    morgens von zu Hause.
    
    Kannst du nachsehen? Ohne etwas zu öffnen, was wir nicht sollten: der
    Sicherheitsbeauftragte der Stadt hat uns schon einmal gerügt.
    
    Folake
front-desk-note-kemal =
    Notiz von Kemal (IT der Stadt)
    
    Am Freitag habe ich die Buchungs-App auf lane aufgeräumt: ich habe das
    Deployment entfernt und meine Manifeste angewendet (in ~/manifests, bei
    denen von Rui):
    - eine Readiness-Probe, damit ein Pod erst Traffic bekommt, wenn er
      bereit ist;
    - einen Service, booking, vor den Pods;
    - einen Ingress für booking.pool.example: das Traefik von k3s lauscht
      auf den Ports 80 und 443 von lane und schickt jede Anfrage an den
      Service, zu dem ihr Host und ihr Pfad führen.
    
    Zum Testen von lane selbst aus:
      curl -H 'Host: booking.pool.example' http://localhost/
    
    Die App lauscht auf Port 8080.
    
    Kemal

## Events

front-desk-event-not-found =
    „404 page not found“ ist die Antwort von Traefik, nicht die der App:
    keine Route für diesen Host und diesen Pfad. Traefik baut seine Routen
    aus den Ingresses; eine Route, deren Backend es nicht bauen kann, wird
    weggelassen, und sein Log sagt warum (kubectl logs -n kube-system
    deploy/traefik). Was sagt der Ingress (kubectl describe ingress booking
    -n swim)?
front-desk-event-ingress-port =
    Der Ingress schickt an Port 8080 des Service booking, aber der Service
    lauscht auf Port 80 (er leitet an 8080 der Pods weiter: targetPort).
    Ein Ingress nennt den Port eines Service, nicht den der Pods.
front-desk-event-port-fixed =
    Der Ingress nennt jetzt einen Port, den der Service hat. Hat der Service
    ein Ziel für den Traffic? kubectl get endpoints booking -n swim.
front-desk-event-no-endpoints =
    Keine Endpoints: der Service schickt an niemanden. Ein Service wählt
    seine Pods nach ihren Labels (sein Selector); vergleiche mit den Labels
    der Pods (kubectl get pods -n swim --show-labels).
front-desk-event-labels-changed =
    Der API-Server lehnt ab: der Selector eines Deployments kann sich nicht
    ändern, und die Labels des Pod-Templates müssen zu ihm passen. Lass die
    Labels der Pods in Ruhe: der Selector des Service muss sie finden.
front-desk-event-selector-fixed =
    Der Service wählt jetzt die booking-Pods. kubectl get endpointslices
    -n swim listet sie auf; aber kubectl get endpoints booking -n swim
    behält nur die bereiten. Sind sie bereit?
front-desk-event-not-ready =
    „Readiness probe failed: HTTP probe failed with statuscode: 404“: das
    Kubelet fragt die App nach einem Pfad, den sie nicht hat, also bleiben
    die Pods bei 0/1, und der Service gibt ihnen keinen Traffic. Auf welchem
    Pfad antwortet die App? (curl auf die Adresse des Pods auf 8080 von
    lane aus, oder kubectl exec … -- wget -qO- …)
front-desk-event-node-port =
    Ein NodePort öffnet Port { $port } auf lane selbst, für das ganze
    Internet, neben Traefik: kein Host, kein TLS, keine einzige
    Eingangstür. Das wird dem Sicherheitsbeauftragten der Stadt nicht
    gefallen. Mach den Service wieder zu einer ClusterIP: der Ingress ist
    der Eingang.
front-desk-event-port-forward =
    kubectl port-forward erreicht die App durchaus (es überspringt sogar
    die Readiness-Prüfung), aber nur von lane aus, nur solange der Befehl
    läuft, und nur für dich. Ein gutes Testwerkzeug; keine Art, Besucher
    zu bedienen. Strg-C, um es zu stoppen.
front-desk-event-probe-removed =
    Ohne Readiness-Probe bekommt ein Pod Traffic, sobald sein Container
    startet, auch wenn die App noch nicht bereit ist (oder ihre Datenbank
    verloren hat). Die Probe war eine gute Idee; sie fragt nur den falschen
    Pfad ab.
front-desk-event-probe-fixed =
    Die Readiness-Probe besteht: die Pods sind 1/1, und der Service schickt
    ihnen Traffic.
front-desk-event-drift =
    Die Site antwortet, aber die Dateien in ~/manifests beschreiben nicht,
    was läuft: das nächste kubectl apply -f ~/manifests/ würde sie wieder
    kaputtmachen. Repariere die Dateien und wende sie an.
front-desk-event-end =
    Folake: „Es geht! Und die erste Buchung kam um 8:58 rein, von einem
    Handy. Kemal sagt danke, und dass er nächstes Mal die Doku liest.“
    
    Gut gemacht! Du hast „Der Empfang“ abgeschlossen.
    
    WAS PASSIERT IST
    Die Anfrage einer Besucherin geht durch drei Türen. Traefik, der
    Ingress-Controller von k3s, gleicht Host und Pfad des Ingress ab und
    schickt die Anfrage an den Port eines Service; der Service schickt sie
    an die bereiten Pods, die sein Selector wählt (seine Endpoints); ein Pod
    ist bereit, wenn seine Readiness-Probe besteht. Jede Tür war zu: der
    Ingress nannte den Port der Pods (8080) statt den des Service (80), der
    Service wählte app=booking-web, während die Pods app=booking sind, und
    die Probe fragte /healthz ab, worauf die App mit 404 antwortet (sie hat
    /health).
    
    GUTE PRAXIS
    - Der Anfrage folgen: curl mit dem richtigen Host-Header, kubectl
      describe ingress (seine Backends), kubectl get endpoints (wer
      empfängt), die Events der Pods (sind sie bereit?), das Log des
      Ingress-Controllers.
    - Ein Ingress nennt einen Service und einen seiner Ports; targetPort
      ist der Port der Pods.
    - Endpoints listen nur die bereiten Pods; EndpointSlices zeigen auch
      die anderen, mit ready: false.
    - Readiness-Probes behalten, auf einem Pfad, auf dem die App wirklich
      antwortet; ein NodePort oder ein port-forward ist keine Eingangstür.
    
    DOKUMENTATION
    - Services: https://kubernetes.io/docs/concepts/services-networking/service/
    - Ingress: https://kubernetes.io/docs/concepts/services-networking/ingress/
    - Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
    - Einen Service debuggen: https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/
    - Traefik in k3s: https://docs.k3s.io/networking/networking-services
