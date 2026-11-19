### Histoire « La Piscine », chapitre « Le Pod qui ne démarre pas » : la
### nouvelle version d'un Deployment ne démarre jamais (un tag d'image
### faux, puis un réglage renommé). kubectl get, describe et ses Events,
### logs --previous, apply -f, rollout status. Les commandes, noms de
### ressources, champs et sorties ne sont pas traduits.

chapter-wont-start = Le Pod qui ne démarre pas
    .summary = L'appli de réservation de la piscine tourne sur un petit cluster Kubernetes, et la version de ce matin n'a jamais démarré. Les inscriptions aux cours d'été ouvrent à neuf heures : trouvez pourquoi le nouveau pod ne démarre pas, et réparez là où il faut.

## Fichiers

wont-start-message-folake =
    De : Folake (piscine des Berges, accueil)
    Lundi 4 juin, 8 h 35

    Bonjour, et merci d'être venu·e si tôt !

    Les inscriptions aux cours de natation d'été ouvrent à 9 h sur le site
    de réservation, et il faut pour cela la version 2.3.1 de l'appli. Rui
    l'a déployée ce matin sur couloir, notre serveur Kubernetes, juste
    avant de prendre son train, et il m'a envoyé un SMS : « le nouveau pod
    ne démarre pas, pas le temps, désolé ! ».

    Le site répond encore, avec l'ancienne version. Pouvez-vous faire
    tourner la nouvelle avant 9 h ?

    Les fichiers de Rui sont dans ~/manifests, et son mot est à côté de ce
    message.

    Folake
wont-start-note-rui =
    Mot de Rui

    couloir fait tourner k3s, un Kubernetes à une seule machine. kubectl
    marche avec votre compte (~/.kube/config). Tout ce qui concerne l'appli
    de réservation est dans le namespace swim : un Deployment, booking
    (deux pods), et ses réglages, la ConfigMap booking-config.

    Les manifestes sont dans ~/manifests ; je les modifie, puis :
      kubectl apply -f ~/manifests/

    Les versions sont dans le registre de la mairie,
    registry.pool.example/booking : 2.2.0 (ce qui tournait jusqu'à
    aujourd'hui), 2.3.0, 2.3.1.

    Rui

## Événements

wont-start-event-default-namespace =
    Rien dans le namespace default : l'appli de réservation vit dans swim.
    Ajoutez -n swim à vos commandes (ou faites de swim le namespace de
    votre contexte : man kubectl, les exemples).
wont-start-event-pods =
    Le nouveau pod est bloqué en ErrImagePull, puis ImagePullBackOff : le
    nœud n'arrive pas à récupérer son image, et réessaie de plus en plus
    rarement (10 s, 20 s, 40 s… jusqu'à 5 minutes). Les deux anciens pods
    tournent toujours : une mise à jour progressive ne les retire qu'une
    fois de nouveaux pods disponibles. Pourquoi l'image ne vient-elle pas ?
    kubectl describe pod NOM -n swim : les Events, à la fin.
wont-start-event-pull-error =
    « not found » : le registre répond, mais n'a pas ce tag. Comparez
    l'image que demande le Deployment avec les versions du mot de Rui.
wont-start-event-pod-deleted =
    Le pod a disparu… et un autre a pris sa place, avec la même erreur.
    Un pod d'un Deployment appartient à un ReplicaSet, qui maintient le
    nombre de pods demandé : la correction se fait dans le modèle du
    Deployment, pas dans ses pods.
wont-start-event-run =
    kubectl run lance un pod isolé : aucun ReplicaSet ne le surveille, ni
    le Service ni le Deployment ne le connaissent, et si le nœud redémarre
    personne ne le relancera. Ça peut servir à essayer une image, mais ça
    ne répare rien : le Deployment demande toujours la même chose.
    Supprimez-le quand vous avez fini (kubectl delete pod NOM -n swim).
wont-start-event-pod-edited =
    Vous avez modifié un pod, pas son Deployment. Son ReplicaSet garde
    l'ancien modèle : le prochain pod qu'il créera (un redémarrage, un nœud
    qui redémarre, un changement d'échelle) reviendra avec les anciennes
    valeurs. Corrigez le modèle, dans ~/manifests/booking.yaml, et
    appliquez-le.
wont-start-event-tag-fixed =
    Le Deployment demande maintenant registry.pool.example/booking:2.3.1 :
    un nouveau ReplicaSet (un nouveau pod-template-hash) lance ses pods.
    Surveillez-les : kubectl get pods -n swim.
wont-start-event-crash =
    L'image est là, le conteneur démarre… et s'arrête aussitôt :
    CrashLoopBackOff. Le kubelet le relance, en attendant plus longtemps à
    chaque fois (RESTARTS augmente). Qu'a-t-il dit avant de s'arrêter ?
    kubectl logs POD -n swim (ajoutez --previous une fois qu'il a
    redémarré : l'instance qui a planté).
wont-start-event-logs =
    L'appli le dit : depuis la 2.3.0, elle lit DATABASE_HOST, et non plus
    DB_HOST. Dans le modèle, la variable garde sa valeur de la ConfigMap
    (la clé database_host) ; seul son nom doit changer.
wont-start-event-config-error =
    CreateContainerConfigError : le kubelet n'arrive pas à construire
    l'environnement du conteneur, parce qu'une ConfigMap ou l'une de ses
    clés n'existe pas. La clé est le nom dans la ConfigMap (kubectl get
    configmap booking-config -n swim -o yaml) ; le nom de la variable est
    ce que lit l'appli.
wont-start-event-env-fixed =
    Le modèle donne maintenant DATABASE_HOST au conteneur. kubectl rollout
    status deployment/booking -n swim suit le déploiement jusqu'à ce qu'il
    se termine (ou échoue).
wont-start-event-rolled-out = La nouvelle version tourne sur les deux pods, et les anciens sont partis.
wont-start-event-drift =
    Le cluster fait tourner la bonne version, mais
    ~/manifests/booking.yaml décrit toujours l'ancienne : le prochain
    kubectl apply -f ~/manifests/ remettrait les erreurs. Alignez le
    fichier sur ce qui tourne, et appliquez-le (il doit alors dire
    unchanged).
wont-start-event-lone-pod =
    Encore une chose : le pod { $pod } est toujours là, et personne ne le
    gère. Supprimez-le.
wont-start-event-end =
    Folake : « 8 h 56 ! La page affiche 2.3.1, les premières familles
    s'inscrivent. Rui va être soulagé. »

    Bravo ! Vous avez terminé Le Pod qui ne démarre pas.

    CE QUI S'EST PASSÉ
    Un Deployment garde un modèle de pod ; chaque version de ce modèle a
    son propre ReplicaSet, qui maintient les pods. Le nouveau modèle de Rui
    demandait le tag d'image 2.31 : le registre n'a pas ce tag, donc le
    containerd du nœud n'a pas pu la récupérer (ErrImagePull), et le
    kubelet a réessayé de plus en plus rarement (ImagePullBackOff).
    Pendant ce temps, la mise à jour progressive a gardé les deux anciens
    pods, puisqu'aucun nouveau n'était disponible. Avec la 2.3.1, le
    conteneur a démarré puis planté (CrashLoopBackOff) : la version 2.3.0
    avait renommé DB_HOST en DATABASE_HOST, comme le disait le journal du
    conteneur planté. La correction est allée dans le manifeste, puis
    kubectl apply, et le déploiement a remplacé les anciens pods un par un.

    BONNES PRATIQUES
    - Lire dans l'ordre : kubectl get pods (l'état), kubectl describe pod
      (les Events disent pourquoi), kubectl logs --previous (ce que l'appli
      a dit avant de planter).
    - Corriger le Deployment, jamais ses pods : un pod supprimé revient, un
      pod modifié est oublié au prochain redémarrage.
    - Les manifestes font foi : modifier le fichier, kubectl apply -f, et
      vérifier qu'un second apply dit unchanged. Un kubectl edit ou set
      image que le fichier ignore est défait par le prochain apply.
    - kubectl rollout status attend la fin d'un déploiement ; un
      déploiement qui reste bloqué finit en ProgressDeadlineExceeded (10
      minutes par défaut), et kubectl rollout undo revient au modèle
      précédent.
    - minReadySeconds et les sondes de disponibilité (readiness)
      empêchent un déploiement de retirer les anciens pods trop tôt.

    DOCUMENTATION
    - Déboguer des pods : https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/
    - Le cycle de vie d'un pod : https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/
    - Les images et ImagePullBackOff : https://kubernetes.io/docs/concepts/containers/images/
    - Deployments et mises à jour progressives : https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
