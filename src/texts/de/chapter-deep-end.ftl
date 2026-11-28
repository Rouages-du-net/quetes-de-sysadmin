### Story "The Pool", chapter "The Deep End": the swim meet's load, memory
### limits copied from a tutorial (OOMKilled, exit code 137), a release
### with a memory leak. kubectl top, describe's Last State, rollout history
### and undo, requests and limits from what was measured. Commands,
### resource names, fields and outputs are not translated.

chapter-deep-end = Das tiefe Becken
    .summary = Am Samstag ist der regionale Schwimmwettkampf, und alle verfolgen Zeitplan und Ergebnisse über die Buchungs-App. Seit heute Morgen starten ihre Pods immer wieder neu. Miss, was die App wirklich braucht, finde heraus, warum sie beendet wird, und gib ihr den Platz, den sie braucht, nicht mehr.

## Files

deep-end-message-folake =
    Von: Folake (Uferbad, Kasse und Büro)
    Samstag, 23. Juni, 9:15

    Hallo, entschuldige, dass ich dich an einem Samstag anrufe!

    Heute ist der regionale Schwimmwettkampf: zweihundert Schwimmerinnen und
    Schwimmer, ihre Vereine, ihre Familien, und alle schauen sich Zeitplan
    und Ergebnisse auf der Buchungs-Site an. Seit dem Start um 8:00 sagt sie
    nur „404 page not found“. Letzten Samstag hat sie den ganzen Vormittag
    gehalten.

    Rui hat gestern Abend eine neue Version eingespielt (seine Notiz liegt
    hier). Er ist beim Wettkampf, als Zeitnehmer: vor Mittag kann er sein
    Handy nicht anfassen.

    Folake
deep-end-note-rui =
    Notiz von Rui (Freitag, 18:20)

    Ich habe das neue Release angewendet: ein Cache für die Ergebnisse,
    damit die Zeitplan-Seite morgen schneller ist. Ich habe auch Requests
    und Limits für den Speicher hinzugefügt, wie im Kubernetes-Tutorial:
    das ist sauberer. Die Pods sind gut gestartet.

    Rui

## Events

deep-end-event-oom =
    OOMKilled, Rückgabewert 137 (128 + 9: beendet durch SIGKILL): der
    Container hat mehr Speicher benutzt als sein Limit, und der Kernel hat
    ihn beendet. Das Kubelet startet ihn wieder, immer seltener
    (CrashLoopBackOff). Wie viel Speicher braucht die App, und wie viel
    darf sie?
deep-end-event-top =
    kubectl top fragt den metrics-server, was jeder Pod gerade braucht
    (kubectl top node für die ganze Maschine). Vergleiche es mit dem Limit
    im Deployment; unter der Last des Wettkampfs ändert es sich von Minute
    zu Minute: schau mehr als einmal hin, die Spitze zählt.
deep-end-event-history =
    kubectl rollout history listet die Revisionen des Deployments, mit
    ihrem CHANGE-CAUSE: 2.4.0 hat gestern einen neuen Cache gebracht. Ein
    Deployment behält seine früheren ReplicaSets: zurückgehen ist ein
    einziger Befehl.
deep-end-event-leak =
    Der Ergebnis-Cache wächst mit jeder Anfrage und vergisst nie: der
    Speicher von 2.4.0 steigt, solange sie läuft, egal wie viel Platz sie
    bekommt. Das ist ein Leck; kein Limit repariert es. Die Version, die
    den letzten Wettkampf gehalten hat, ist 2.3.1.
deep-end-event-pending =
    „0/1 nodes are available: 1 Insufficient memory“: der Scheduler setzt
    einen Pod nur dorthin, wo seine Requests in das passen, was der Node
    noch geben kann (kubectl describe node: Allocatable, Allocated
    resources). Er bleibt Pending, und das Rolling Update wartet. Requests
    sind das, was der Pod sicher bekommt: verlange, was er braucht, nicht
    den ganzen Node.
deep-end-event-whole-node =
    Ein Limit von mehr als einem Gigabyte, auf einem Node mit 4 GiB für
    alles (k3s, Traefik, die anderen Pods): die App hat nie ein Viertel
    davon gebraucht. Ein Limit ist ein Sicherheitsnetz, etwas über der
    gemessenen Spitze; ein Leck würde sonst den Node füllen, bevor es
    gestoppt wird.
deep-end-event-no-limits =
    Kein Speicherlimit mehr: ein Container darf jetzt den ganzen Speicher
    des Nodes nehmen. Mit einem Leck würde das Kubelet des Nodes anfangen,
    Pods zu verdrängen, oder der OOM-Killer des Kernels würde einen Prozess
    auswählen, vielleicht k3s selbst. Behalte ein Limit, über der gemessenen
    Spitze.
deep-end-event-pods-deleted =
    Die Pods zu löschen bringt nur neue zurück, mit demselben Limit und
    demselben Image: sie werden genauso beendet. Die Reparatur gehört in
    das Template des Deployments.
deep-end-event-leak-fills =
    Selbst mit mehr Platz wurde 2.4.0 wieder OOMKilled: ihr Speicher wuchs
    weiter, bis er das neue Limit erreichte. Schau dir an, was sie loggt
    (kubectl logs), und die Historie des Deployments.
deep-end-event-undo-leaky =
    kubectl rollout undo geht eine Revision zurück: die vor der aktuellen
    ist noch 2.4.0. kubectl rollout history listet sie auf, und
    --to-revision wählt eine (kubectl rollout history … --revision=N zeigt,
    was sie enthält).
deep-end-event-rolled-back =
    Das Deployment fährt wieder 2.3.1. Steht es in den Dateien, und hat es
    genug Platz für die Spitze des Wettkampfs?
deep-end-event-below-peak =
    Dieses Limit liegt unter dem, was 2.3.1 in den vollsten Minuten des
    Wettkampfs braucht: in der Spitze würde sie wieder beendet. Miss es
    (kubectl top pod, mehr als einmal) und setze das Limit über die Spitze,
    mit Spielraum.
deep-end-event-too-generous =
    Dieses Limit ist mehr als doppelt so hoch wie alles, was 2.3.1 beim
    Wettkampf je gebraucht hat: geschätzt, nicht gemessen. Mit so viel Platz
    würde ein Leck lange wachsen, bevor es gestoppt wird. Miss die Pods
    unter der Last des Wettkampfs (kubectl top pod, mehr als einmal) und
    setze das Limit ein wenig über die gemessene Spitze.
deep-end-event-limit-raised = Das Speicherlimit liegt jetzt über der Spitze des Wettkampfs.
deep-end-event-requests-low =
    Die Requests liegen weit unter dem, was die App unter Last braucht: der
    Scheduler reserviert nur so viel und könnte andere Pods dorthin setzen,
    wo die App dann den Platz braucht. Verlange, was sie normalerweise
    braucht (kubectl top pod).
deep-end-event-requests =
    Requests, die reservieren, was die App braucht, ein Limit über ihrer
    Spitze: die Pods werden eingeplant, und der Kernel lässt sie in Ruhe.
deep-end-event-drift =
    Die Pods laufen, wie sie sollen, aber ~/manifests/booking.yaml sagt noch
    etwas anderes: das nächste kubectl apply -f ~/manifests/ würde 2.4.0
    oder die alten Limits zurückbringen. Schreib es in die Datei und wende
    sie an.
deep-end-event-end =
    Folake: „Die Ergebnisse sind auf den Bildschirmen und auf allen Handys!
    Rui sagt zwischen zwei Läufen, dass er seinen Cache nächstes Mal an
    einem ruhigen Werktag ausprobiert.“

    Gut gemacht! Du hast „Das tiefe Becken“ abgeschlossen.

    WAS PASSIERT IST
    Ruis Limits, aus einem Tutorial kopiert (128Mi), waren an einem ruhigen
    Abend in Ordnung; unter der Last des Wettkampfs braucht die App bis zu
    230Mi, also beendete der Kernel jeden Container, sobald er zu tun hatte
    (OOMKilled, Rückgabewert 137), und die Site verlor ihre Pods einen nach
    dem anderen. Und der Ergebnis-Cache von 2.4.0 vergisst nie: mit mehr
    Platz füllt er auch den. Du bist zu 2.3.1 zurückgekehrt und hast
    Requests und Limits nach dem Gemessenen gesetzt, in der Datei.

    GUTE PRAXIS
    - Messen, bevor man festlegt: kubectl top pod und node, zur vollsten
      Zeit (besser: eine Historie, aus Prometheus). Requests: was die App
      normalerweise braucht (der Scheduler reserviert es). Speicherlimit:
      über der gemessenen Spitze, mit Spielraum.
    - OOMKilled: kubectl describe pod, Last State: Terminated, Reason:
      OOMKilled, Exit Code: 137; kubectl get pods zählt die Neustarts.
    - Speicher, der immer weiter wächst, ist ein Leck: ein größeres Limit
      verzögert nur das Beenden. Zurückrollen (kubectl rollout undo, oder
      das vorige Image in der Datei), dann an einem ruhigen Tag nach der
      Ursache suchen.
    - Requests größer als der Node: der Pod bleibt Pending
      (FailedScheduling: Insufficient memory). Gar kein Limit: ein einziges
      Leck kann den ganzen Node nehmen.
    - kubectl rollout undo ändert, was läuft, nicht die Dateien: schreib die
      Reparatur auch ins Manifest.

    DOKUMENTATION
    - Ressourcenverwaltung für Pods und Container: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
    - Speicherressourcen für Container und Pods zuweisen (ein Limit überschreiten, OOM): https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/
    - Verdrängung bei Ressourcendruck auf dem Node: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
    - Ein Deployment zurückrollen: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment
    - kubectl top: https://kubernetes.io/docs/reference/kubectl/generated/kubectl_top/
