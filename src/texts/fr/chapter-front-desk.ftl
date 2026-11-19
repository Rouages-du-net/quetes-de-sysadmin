### Histoire « La Piscine », chapitre « L'Accueil » : le site de
### réservation doit être servi par le cluster. Un Ingress qui vise le
### mauvais port d'un Service, un Service qui ne choisit aucun pod, une
### sonde de disponibilité sur un chemin que l'appli n'a pas. curl avec un
### en-tête Host, kubectl get/describe ingress, service, endpoints, le
### journal de Traefik. Les commandes, noms de ressources, champs et
### sorties ne sont pas traduits.

chapter-front-desk = L'Accueil
    .summary = Le site de réservation doit maintenant être servi par le cluster lui-même, via son contrôleur d'Ingress. Kemal, de l'informatique de la mairie, a tout installé vendredi, et l'adresse répond « 404 page not found ». Suivez la requête d'un visiteur, de la porte d'entrée jusqu'aux pods.

## Fichiers

front-desk-message-folake =
    De : Folake (piscine des Berges, accueil)
    Lundi 11 juin, 8 h 45

    Bonjour !

    Depuis vendredi, booking.pool.example pointe vers couloir : l'ancien
    serveur est parti, le cluster doit servir le site tout seul. Kemal, de
    l'informatique de la mairie, a tout préparé vendredi soir (son mot est
    à côté de ce message), mais ce matin l'adresse dit seulement « 404
    page not found ». La piscine ouvre à 9 h et les gens réservent de chez
    eux dès le matin.

    Pouvez-vous regarder ? Sans ouvrir ce qu'il ne faut pas : la
    responsable de la sécurité de la mairie nous a déjà grondé·es une fois.

    Folake
front-desk-note-kemal =
    Mot de Kemal (informatique de la mairie)

    Vendredi, j'ai rangé l'appli de réservation sur couloir : j'ai
    supprimé le Deployment et appliqué mes manifestes (dans ~/manifests,
    avec ceux de Rui) :
    - une sonde de disponibilité (readiness), pour qu'un pod ne reçoive du
      trafic qu'une fois prêt ;
    - un Service, booking, devant les pods ;
    - un Ingress pour booking.pool.example : le Traefik de k3s écoute sur
      les ports 80 et 443 de couloir, et envoie chaque requête au Service
      où mènent son hôte et son chemin.

    Pour tester depuis couloir lui-même :
      curl -H 'Host: booking.pool.example' http://localhost/

    L'appli écoute sur le port 8080.

    Kemal

## Événements

front-desk-event-not-found =
    « 404 page not found » est la réponse de Traefik, pas celle de
    l'appli : aucune route pour cet hôte et ce chemin. Traefik construit
    ses routes à partir des Ingress ; une route dont il ne peut pas
    construire la cible est laissée de côté, et son journal dit pourquoi
    (kubectl logs -n kube-system deploy/traefik). Que dit l'Ingress
    (kubectl describe ingress booking -n swim) ?
front-desk-event-ingress-port =
    L'Ingress envoie vers le port 8080 du Service booking, mais le Service
    écoute sur le port 80 (il transmet vers 8080 sur les pods :
    targetPort). Un Ingress nomme un port du Service, pas celui des pods.
front-desk-event-port-fixed =
    L'Ingress nomme maintenant un port qu'a le Service. Le Service a-t-il
    où envoyer le trafic ? kubectl get endpoints booking -n swim.
front-desk-event-no-endpoints =
    Pas d'endpoints : le Service n'envoie à personne. Un Service choisit
    ses pods par leurs étiquettes (son selector) ; comparez avec les
    étiquettes des pods (kubectl get pods -n swim --show-labels).
front-desk-event-labels-changed =
    Le serveur d'API refuse : le selector d'un Deployment ne peut pas
    changer, et les étiquettes du modèle de pod doivent lui correspondre.
    Laissez les étiquettes des pods tranquilles : c'est le selector du
    Service qui doit les trouver.
front-desk-event-selector-fixed =
    Le Service choisit maintenant les pods de booking. kubectl get
    endpointslices -n swim les liste ; mais kubectl get endpoints booking
    -n swim ne garde que ceux qui sont prêts. Le sont-ils ?
front-desk-event-not-ready =
    « Readiness probe failed: HTTP probe failed with statuscode: 404 » :
    le kubelet demande à l'appli un chemin qu'elle n'a pas, donc les pods
    restent à 0/1 et le Service ne leur donne pas de trafic. Sur quel
    chemin l'appli répond-elle ? (curl sur l'adresse d'un pod, port 8080,
    depuis couloir, ou kubectl exec … -- wget -qO- …)
front-desk-event-node-port =
    Un NodePort ouvre le port { $port } sur couloir lui-même, à tout
    internet, à côté de Traefik : sans hôte, sans TLS, sans porte d'entrée
    unique. La responsable de la sécurité de la mairie ne va pas aimer.
    Remettez le Service en ClusterIP : l'Ingress est la porte d'entrée.
front-desk-event-port-forward =
    kubectl port-forward atteint bien l'appli (il saute même la
    vérification de disponibilité), mais seulement depuis couloir,
    seulement tant que la commande tourne, et seulement pour vous. Un bon
    outil de test ; pas une façon de servir des visiteurs. Ctrl-C pour
    l'arrêter.
front-desk-event-probe-removed =
    Sans sonde de disponibilité, un pod reçoit du trafic dès que son
    conteneur démarre, même si l'appli n'est pas encore prête (ou a perdu
    sa base de données). La sonde était une bonne idée ; elle demande
    seulement le mauvais chemin.
front-desk-event-probe-fixed =
    La sonde de disponibilité passe : les pods sont à 1/1, et le Service
    leur envoie du trafic.
front-desk-event-drift =
    Le site répond, mais les fichiers de ~/manifests ne décrivent pas ce
    qui tourne : le prochain kubectl apply -f ~/manifests/ le casserait de
    nouveau. Corrigez les fichiers et appliquez-les.
front-desk-event-end =
    Folake : « Ça marche ! Et la première réservation est arrivée à
    8 h 58, depuis un téléphone. Kemal dit merci, et qu'il lira la doc la
    prochaine fois. »

    Bravo ! Vous avez terminé L'Accueil.

    CE QUI S'EST PASSÉ
    La requête d'un visiteur passe trois portes. Traefik, le contrôleur
    d'Ingress de k3s, fait correspondre l'hôte et le chemin de l'Ingress
    et envoie la requête à un port d'un Service ; le Service l'envoie aux
    pods prêts que choisit son selector (ses endpoints) ; un pod est prêt
    quand sa sonde de disponibilité passe. Chaque porte était fermée :
    l'Ingress nommait le port des pods (8080) au lieu de celui du Service
    (80), le Service choisissait app=booking-web alors que les pods sont
    app=booking, et la sonde demandait /healthz, auquel l'appli répond 404
    (elle a /health).

    BONNES PRATIQUES
    - Suivre la requête : curl avec le bon en-tête Host, kubectl describe
      ingress (ses cibles), kubectl get endpoints (qui reçoit), les Events
      des pods (sont-ils prêts ?), le journal du contrôleur d'Ingress.
    - Un Ingress nomme un Service et l'un de ses ports ; targetPort est le
      port des pods.
    - Les Endpoints ne listent que les pods prêts ; les EndpointSlices
      montrent aussi les autres, avec ready: false.
    - Garder les sondes de disponibilité, sur un chemin auquel l'appli
      répond vraiment ; un NodePort ou un port-forward n'est pas une porte
      d'entrée.

    DOCUMENTATION
    - Les Services : https://kubernetes.io/docs/concepts/services-networking/service/
    - Ingress : https://kubernetes.io/docs/concepts/services-networking/ingress/
    - Les sondes : https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
    - Déboguer un Service : https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/
    - Traefik dans k3s : https://docs.k3s.io/networking/networking-services
