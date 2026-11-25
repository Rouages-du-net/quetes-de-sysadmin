### Story "The Pool", chapter "The Pod That Won't Start": a Deployment's
### new release never starts (a wrong image tag, then a setting renamed).
### kubectl get, describe and its Events, logs --previous, apply -f,
### rollout status. Commands, resource names, fields and outputs are not
### translated.

chapter-wont-start = Der Pod, der nicht startet
    .summary = Die Buchungs-App des Schwimmbads läuft auf einem kleinen Kubernetes-Cluster, und das Release von heute Morgen ist nie gestartet. Die Anmeldung für die Sommerkurse öffnet um neun: finde heraus, warum der neue Pod nicht startet, und repariere es dort, wo es hingehört.

## Files

wont-start-message-folake =
    Von: Folake (Uferbad, Kasse und Büro)
    Montag, 4. Juni, 8:35
    
    Hallo, und danke, dass du so früh gekommen bist!
    
    Die Anmeldung für die Sommer-Schwimmkurse öffnet um 9:00 Uhr auf der
    Buchungs-Site, und dafür braucht es Version 2.3.1 der App. Rui hat sie
    heute Morgen auf bahn deployt, unserem Kubernetes-Server, kurz bevor er
    in den Zug gestiegen ist, und er hat mir geschrieben: „der neue Pod
    startet nicht, keine Zeit, sorry!“.
    
    Die Site antwortet noch, mit der alten Version. Kannst du die neue vor
    9:00 Uhr zum Laufen bringen?
    
    Ruis Dateien liegen in ~/manifests, und seine Notiz liegt neben dieser
    Nachricht.
    
    Folake
wont-start-note-rui =
    Notiz von Rui
    
    Auf bahn läuft k3s, ein Kubernetes auf einer einzigen Maschine. kubectl
    funktioniert mit deinem Konto (~/.kube/config). Alles von der
    Buchungs-App liegt im Namespace swim: ein Deployment, booking (zwei
    Pods), und seine Einstellungen, die ConfigMap booking-config.
    
    Die Manifeste liegen in ~/manifests; ich ändere sie, dann:
      kubectl apply -f ~/manifests/
    
    Die Releases liegen in der Registry der Stadt, registry.pool.example/booking:
    2.2.0 (was bis heute lief), 2.3.0, 2.3.1.
    
    Rui

## Events

wont-start-event-default-namespace =
    Nichts im Namespace default: die Buchungs-App lebt in swim. Hänge
    -n swim an deine Befehle an (oder mach swim zum Namespace deines
    Kontexts: man kubectl, die Beispiele).
wont-start-event-pods =
    Der neue Pod hängt in ErrImagePull, dann ImagePullBackOff: der Node
    bekommt sein Image nicht und versucht es immer seltener (10 s, 20 s,
    40 s… bis zu 5 Minuten). Die zwei alten Pods laufen noch: ein Rolling
    Update entfernt sie erst, wenn neue verfügbar sind. Warum lässt sich das
    Image nicht holen? kubectl describe pod NAME -n swim: die Events am Ende.
wont-start-event-pull-error =
    „not found“: die Registry antwortet, hat aber keinen solchen Tag.
    Vergleiche das Image, das das Deployment verlangt, mit den Releases in
    Ruis Notiz.
wont-start-event-pod-deleted =
    Der Pod ist weg… und ein anderer hat seinen Platz eingenommen, mit
    demselben Fehler. Ein Pod eines Deployments gehört zu einem ReplicaSet,
    das die verlangte Zahl von Pods hält: die Reparatur gehört in das
    Template des Deployments, nicht in seine Pods.
wont-start-event-run =
    kubectl run startet einen einzelnen Pod: kein ReplicaSet passt auf ihn
    auf, der Service und das Deployment kennen ihn nicht, und wenn der Node
    neu startet, startet ihn niemand wieder. Zum Ausprobieren eines Images
    kann das helfen, aber es repariert nichts: das Deployment verlangt immer
    noch dasselbe. Lösche ihn, wenn du fertig bist (kubectl delete pod NAME
    -n swim).
wont-start-event-pod-edited =
    Du hast einen Pod geändert, nicht sein Deployment. Sein ReplicaSet hat
    noch das alte Template: der nächste Pod, den es erzeugt (ein Neustart,
    ein Node, der rebootet, ein Scale), kommt mit den alten Werten zurück.
    Repariere das Template in ~/manifests/booking.yaml und wende es an.
wont-start-event-tag-fixed =
    Das Deployment verlangt jetzt registry.pool.example/booking:2.3.1: ein
    neues ReplicaSet (ein neuer pod-template-hash) startet seine Pods. Schau
    ihnen zu: kubectl get pods -n swim.
wont-start-event-crash =
    Das Image ist da, der Container startet… und hält sofort an:
    CrashLoopBackOff. Das Kubelet startet ihn neu und wartet jedes Mal
    länger (RESTARTS steigt). Was hat er gesagt, bevor er angehalten hat?
    kubectl logs POD -n swim (mit --previous, sobald er neu gestartet ist:
    die Instanz, die abgestürzt ist).
wont-start-event-logs =
    Die App sagt es: seit 2.3.0 liest sie DATABASE_HOST und nicht mehr
    DB_HOST. Im Template behält die Variable ihren Wert aus der ConfigMap
    (den Schlüssel database_host); nur ihr Name muss sich ändern.
wont-start-event-config-error =
    CreateContainerConfigError: das Kubelet kann die Umgebung des Containers
    nicht bauen, weil eine ConfigMap oder einer ihrer Schlüssel nicht
    existiert. Der Schlüssel ist der Name in der ConfigMap (kubectl get
    configmap booking-config -n swim -o yaml); der Name der Variable ist
    das, was die App liest.
wont-start-event-env-fixed =
    Das Template gibt dem Container jetzt DATABASE_HOST. kubectl rollout
    status deployment/booking -n swim verfolgt den Rollout, bis er fertig
    ist (oder scheitert).
wont-start-event-rolled-out = Das neue Release läuft auf beiden Pods, und die alten sind weg.
wont-start-event-drift =
    Der Cluster fährt die richtige Version, aber ~/manifests/booking.yaml
    beschreibt noch die alte: das nächste kubectl apply -f ~/manifests/
    würde die Fehler zurückbringen. Bring die Datei in Einklang mit dem, was
    läuft, und wende sie an (dann sollte es unchanged sagen).
wont-start-event-lone-pod =
    Noch etwas: der Pod { $pod } ist noch da, und niemand verwaltet ihn.
    Lösche ihn.
wont-start-event-end =
    Folake: „8:56! Die Seite zeigt 2.3.1, die ersten Familien melden sich
    an. Rui wird erleichtert sein.“
    
    Gut gemacht! Du hast „Der Pod, der nicht startet“ abgeschlossen.
    
    WAS PASSIERT IST
    Ein Deployment hält ein Pod-Template; jede Version davon bekommt ihr
    eigenes ReplicaSet, das die Pods hält. Ruis neues Template verlangte den
    Image-Tag 2.31: die Registry hat keinen solchen Tag, also konnte das
    containerd des Nodes ihn nicht holen (ErrImagePull), und das Kubelet
    versuchte es immer seltener (ImagePullBackOff). Währenddessen behielt
    das Rolling Update die zwei alten Pods, da kein neuer verfügbar war. Mit
    2.3.1 startete der Container und stürzte ab (CrashLoopBackOff): Release
    2.3.0 hatte DB_HOST in DATABASE_HOST umbenannt, wie das Log des
    abgestürzten Containers sagte. Die Reparatur ging ins Manifest, dann
    kubectl apply, und der Rollout ersetzte die alten Pods einen nach dem
    anderen.
    
    GUTE PRAXIS
    - In dieser Reihenfolge lesen: kubectl get pods (der Zustand), kubectl
      describe pod (die Events sagen, warum), kubectl logs --previous (was
      die App vor dem Absturz gesagt hat).
    - Das Deployment reparieren, nie seine Pods: ein gelöschter Pod kommt
      zurück, ein bearbeiteter Pod ist beim nächsten Neustart vergessen.
    - Die Manifeste sind die Wahrheit: die Datei ändern, kubectl apply -f,
      und prüfen, dass ein zweites apply unchanged sagt. Ein kubectl edit
      oder set image, das die Datei nicht kennt, macht das nächste apply
      rückgängig.
    - kubectl rollout status wartet auf das Ende eines Rollouts; ein
      Rollout, der hängen bleibt, endet mit ProgressDeadlineExceeded
      (standardmäßig 10 Minuten), und kubectl rollout undo kehrt zum
      vorigen Template zurück.
    - minReadySeconds und Readiness-Probes verhindern, dass ein Rollout alte
      Pods zu früh entfernt.
    
    DOKUMENTATION
    - Pods debuggen: https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/
    - Der Lebenszyklus eines Pods: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/
    - Images und ImagePullBackOff: https://kubernetes.io/docs/concepts/containers/images/
    - Deployments und Rolling Updates: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
