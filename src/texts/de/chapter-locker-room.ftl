### Story "The Pool", chapter "The Locker Room": the database password sits
### in a ConfigMap and in clear in a git repository shared with the town's
### IT. A Secret, secretKeyRef, rollout restart, base64 that is not
### encryption, git's history. Commands, resource names, fields and outputs
### are not translated.

chapter-locker-room = Die Umkleide
    .summary = Das Datenbankpasswort der Buchungs-App steht in einer ConfigMap, und im Klartext im Git-Repository der Manifeste, das die IT der Stadt lesen kann. Es wurde heute Morgen auf der Datenbank geändert: leg das neue in ein Secret, nimm das alte aus den Dateien und sorg dafür, dass die Pods es benutzen.

## Files

locker-room-message-folake =
    Von: Folake (Uferbad, Kasse und Büro)
    Montag, 18. Juni, 9:05
    
    Hallo,
    
    Kemal hat mich um 8:50 angerufen, etwas besorgt: er hat das Passwort der
    Datenbank im Klartext in den Manifesten gefunden, die Rui mit der IT der
    Stadt teilt. Er sagt, alle im Rathaus, die dieses Repository lesen
    können, hätten es lesen können, also hat er es sofort auf der Datenbank
    geändert. Seine Notiz liegt neben dieser Nachricht.
    
    Die Site funktioniert noch. Kemal sagt, das sei nur „bis zum nächsten
    Neustart“. Ich weiß nicht, was das heißt, aber es klingt nicht gut.
    
    Folake
locker-room-note-kemal =
    Notiz von Kemal (IT der Stadt)
    
    Letzten Dienstag haben wir die Passwort-Authentifizierung auf
    db.pool.internal eingeschaltet, und Rui hat das Passwort des Kontos
    booking in die ConfigMap gelegt, also in ~/manifests/config.yaml, das er
    committet und nach /srv/git/pool-manifests.git pusht: das Repository,
    das ich pulle und das die halbe IT der Stadt lesen kann.
    
    Um 9:00 habe ich das Passwort dieses Kontos auf der Datenbank geändert.
    Das neue steht in ~/new_db_password.txt (nur du kannst es lesen). Die
    laufenden Pods behalten die Verbindungen, die sie geöffnet haben; aber
    ein Pod, der jetzt mit dem alten Passwort startet, kommt nicht rein.
    
    Was nötig ist:
    - das neue Passwort in einem Kubernetes-Secret, nicht in einer ConfigMap;
    - die App liest es von dort (die ConfigMap gibt ihr weiterhin
      database_host);
    - Pods, die es wirklich benutzen;
    - nichts Geheimes mehr in den Dateien, und die reparierten Dateien
      gepusht.
    
    Kemal

## Git

pool-commit-1 = Buchungs-App auf k3s
pool-commit-2 = 2.3.1, ein Service und ein Ingress
pool-commit-3 = Die Datenbank verlangt jetzt ein Passwort

## Events

locker-room-event-config-read =
    Da ist es, im Klartext: das alte Passwort, in der ConfigMap und in
    config.yaml. Eine ConfigMap ist für Einstellungen, die alle lesen
    dürfen (kubectl get configmap -o yaml zeigt alles); ein Passwort gehört
    in ein Secret.
locker-room-event-history-seen =
    Die Historie von git behält jede Version jeder Datei: das alte Passwort
    bleibt in dem Commit, der es hinzugefügt hat, und in jedem Klon des
    Repositorys, auch wenn die Datei repariert ist. Die Historie
    umzuschreiben würde die Kopien, die andere schon haben, nicht
    erreichen. Deshalb war Kemals Änderung auf der Datenbank die eigentliche
    Reparatur: das Passwort in der Historie öffnet nichts mehr.
locker-room-event-old-secret =
    Dieses Secret enthält das alte Passwort, das im Repository steht: Kemal
    hat es um 9:00 auf der Datenbank geändert, also kommt ein Pod, der damit
    startet, nicht rein. Das neue steht in ~/new_db_password.txt.
locker-room-event-auth-failed =
    „password authentication failed for user "booking"“: die Datenbank lehnt
    das Passwort ab, mit dem dieser Container gestartet ist. Welches
    Passwort gibt ihm das Template, und ist es das aus
    ~/new_db_password.txt?
locker-room-event-newline =
    Dieses Secret enthält das Passwort gefolgt von einem Zeilenumbruch:
    --from-file nimmt die ganze Datei, und die Datei endet mit einem. Die
    Datenbank würde es ablehnen. Nimm --from-literal (oder eine Datei ohne
    den Zeilenumbruch).
locker-room-event-secret-created =
    Das Secret enthält das neue Passwort. Schau es dir mit kubectl get
    secret NAME -n swim -o yaml an: ist es versteckt?
locker-room-event-decoded =
    base64 ist eine Kodierung, keine Verschlüsselung: wer das Secret lesen
    kann, bekommt das Passwort mit einem Befehl zurück. Ein Secret ist
    sicherer als eine ConfigMap wegen dem, was darum herum geschieht: wer es
    lesen darf (RBAC), wie es gespeichert wird (Verschlüsselung von etcd),
    und dass es aus dem Repository draußen bleibt.
locker-room-event-base64-config =
    Das Passwort in base64 in der ConfigMap ist immer noch das Passwort:
    base64 -d gibt es allen zurück. Es kommt nicht darauf an, wo es steht,
    sondern wer es lesen darf. Leg es in ein Secret.
locker-room-event-config-deleted =
    Die ConfigMap booking-config ist weg, aber die App nimmt weiterhin
    database_host aus ihr: der nächste Pod, der startet, bleibt in
    CreateContainerConfigError hängen. Nimm das Passwort heraus; behalte
    den Rest.
locker-room-event-literal =
    Das Passwort steht jetzt im Deployment selbst (value:), also in
    booking.yaml, also im Repository. Verweise stattdessen auf das Secret
    (valueFrom.secretKeyRef).
locker-room-event-referenced = Das Template des Deployments nimmt DATABASE_PASSWORD jetzt aus dem Secret.
locker-room-event-config-cleaned =
    Die ConfigMap enthält kein Passwort mehr und gibt der App weiterhin
    ihren database_host.
locker-room-event-stale-env =
    Das Template gibt das neue Passwort, aber einige laufende Pods sind mit
    dem alten gestartet: ein Container liest seine Umgebungsvariablen
    einmal, beim Start. Ein Secret oder eine ConfigMap zu ändern startet
    nichts neu. kubectl rollout restart deployment/booking -n swim ersetzt
    die Pods einen nach dem anderen, ohne Unterbrechung.
locker-room-event-restarted =
    Jeder booking-Pod läuft jetzt mit dem neuen Passwort, aus dem Secret
    gelesen.
locker-room-event-secret-file =
    { $file } in ~/manifests enthält das Passwort (im Klartext oder in
    base64, was dasselbe ist): es würde mit dem Rest ins Repository gehen.
    Halte es aus dem Repository heraus (kubectl create secret generic
    braucht keine Datei), dann entferne es von dort.
locker-room-event-committed =
    Der letzte Commit enthält kein Passwort mehr. Kemal pullt aus dem
    gemeinsamen Repository: ist er dort auch?
locker-room-event-pushed =
    Das gemeinsame Repository ist aktuell: was Kemal pullt, enthält kein
    Passwort mehr (aber seine Historie enthält noch das alte: siehe git
    log -p).
locker-room-event-drift =
    Die Pods benutzen das Secret, aber die Dateien in ~/manifests sagen das
    nicht: das nächste kubectl apply -f ~/manifests/ würde das Passwort
    wieder in die ConfigMap legen. Repariere die Dateien und wende sie an.
locker-room-event-end =
    Kemal: „Perfekt. Das alte Passwort öffnet nichts mehr, das neue liegt in
    einem Secret, das nur die Admins des Clusters lesen können, und das
    Repository hat nichts mehr zu verbergen. Ich sage es dem
    Sicherheitsbeauftragten.“
    
    Gut gemacht! Du hast „Die Umkleide“ abgeschlossen.
    
    WAS PASSIERT IST
    Das Passwort der Datenbank stand in einer ConfigMap, also in
    config.yaml, also in einem Git-Repository, das die IT der Stadt lesen
    konnte. Kemal hat es auf der Datenbank geändert: die laufenden Pods
    behielten ihre Verbindungen, aber jeder neue Start wäre gescheitert. Du
    hast das neue Passwort in ein Secret gelegt, das Deployment es mit
    secretKeyRef lesen lassen, es aus der ConfigMap genommen (die weiterhin
    database_host liefert), die Pods ersetzt, damit sie es lesen (eine
    Umgebungsvariable wird einmal gelesen, beim Start des Containers), und
    Dateien ohne es gepusht.
    
    GUTE PRAXIS
    - Ein Passwort gehört in ein Secret, nie in eine ConfigMap, und nie ins
      Repository. kubectl create secret generic --from-literal braucht keine
      Datei; --dry-run=client -o yaml zeigt, was es anlegen würde.
    - base64 ist eine Kodierung: ein Secret wird geschützt durch die, die es
      lesen dürfen (RBAC: get, list und watch auf secrets sind so gut wie
      das Passwort), durch die Verschlüsselung von etcd im Ruhezustand (k3s
      server --secrets-encryption) und dadurch, dass es aus git draußen
      bleibt. Werkzeuge wie Sealed Secrets oder ein externer Tresor halten
      sie dauerhaft aus dem Repository heraus.
    - Ein geleaktes Geheimnis wird an seiner Quelle geändert (Rotation). Die
      Historie von git und ihre Kopien behalten das alte für immer: die
      Historie umzuschreiben macht ein Passwort nicht wieder geheim.
    - Variablen werden beim Start gelesen: nach der Änderung eines Secrets
      kubectl rollout restart. Ein als Volume eingehängtes Secret
      aktualisiert das Kubelet innerhalb von etwa einer Minute (aber nicht
      über subPath), und die App muss die Datei neu lesen.
    
    DOKUMENTATION
    - Secrets: https://kubernetes.io/docs/concepts/configuration/secret/
    - Gute Praxis für Secrets: https://kubernetes.io/docs/concepts/security/secrets-good-practices/
    - Einen Pod so konfigurieren, dass er eine ConfigMap benutzt: https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/
    - Zugangsdaten sicher mit Secrets verteilen: https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/
    - Daten im Ruhezustand verschlüsseln: https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/
    - Secrets-Verschlüsselung in k3s: https://docs.k3s.io/security/secrets-encryption
