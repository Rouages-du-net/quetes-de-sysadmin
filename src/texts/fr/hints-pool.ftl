### Indices gradués de La Piscine (voir src/engine/hints.ts) : un message
### par étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans
### la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Le Pod qui ne démarre pas

hint-wont-start-pods =
    .lead = Listez les pods de l'appli de réservation, dans son namespace (le mot de Rui le donne), et regardez leur STATUS (man kubectl).
    .solution = kubectl get pods -n swim
hint-wont-start-pull-error =
    .lead = Demandez à Kubernetes pourquoi le nouveau pod ne démarre pas : les Events, à la fin de sa description, le disent.
    .solution = kubectl describe pod NOM -n swim (le pod en ImagePullBackOff)
hint-wont-start-tag-fixed =
    .lead = Le registre ne connaît pas le tag que demande le Deployment : corrigez l'image dans le manifeste de Rui (son mot liste les versions), puis appliquez le fichier.
    .solution = nano ~/manifests/booking.yaml (image: registry.pool.example/booking:2.3.1), puis kubectl apply -f ~/manifests/
hint-wont-start-crash =
    .lead = Regardez de nouveau le nouveau pod, quelques secondes plus tard : tourne-t-il ?
    .solution = kubectl get pods -n swim
hint-wont-start-logs =
    .lead = Le conteneur s'arrête tout seul : lisez ce qu'il a écrit avant de s'arrêter (man kubectl : logs, --previous).
    .solution = kubectl logs NOM -n swim --previous
hint-wont-start-env-fixed =
    .lead = L'appli demande une variable que le modèle ne lui donne pas : renommez la variable dans le manifeste, en gardant sa valeur de la ConfigMap, et appliquez.
    .solution = nano ~/manifests/booking.yaml (- name: DATABASE_HOST au lieu de DB_HOST), puis kubectl apply -f ~/manifests/
hint-wont-start-rolled-out =
    .lead = Suivez le déploiement jusqu'à ce que les nouveaux pods remplacent les anciens.
    .solution = kubectl rollout status deployment/booking -n swim
hint-wont-start-end =
    .lead = Tout ce qui tourne doit être dans les fichiers (un second apply dit unchanged), et aucun pod que personne ne gère ne doit rester dans le namespace.
    .solution = kubectl apply -f ~/manifests/ (tout unchanged), kubectl get pods -n swim (supprimez un pod à vous avec kubectl delete pod NOM -n swim)

## Chapitre 2 — L'Accueil

hint-front-desk-not-found =
    .lead = Demandez le site comme le ferait un visiteur, depuis couloir : Traefik écoute sur le port 80, et distingue les sites par l'en-tête Host (man curl).
    .solution = curl -H 'Host: booking.pool.example' http://localhost/
hint-front-desk-ingress-port =
    .lead = Regardez l'Ingress en détail : vers quel Service et quel port envoie-t-il ? Le journal de Traefik dit ce qu'il en pense.
    .solution = kubectl describe ingress booking -n swim, kubectl logs -n kube-system deploy/traefik
hint-front-desk-port-fixed =
    .lead = Un Ingress nomme un port du Service (port:), pas celui des pods (targetPort:). Corrigez ingress.yaml et appliquez-le.
    .solution = nano ~/manifests/ingress.yaml (number: 80), puis kubectl apply -f ~/manifests/
hint-front-desk-no-endpoints =
    .lead = Le Service envoie-t-il à quelqu'un ? Ses endpoints sont les pods qu'il choisit.
    .solution = kubectl get endpoints booking -n swim
hint-front-desk-selector-fixed =
    .lead = Comparez le selector du Service avec les étiquettes des pods, et corrigez le Service (pas les pods).
    .solution = kubectl get pods -n swim --show-labels ; nano ~/manifests/service.yaml (selector app: booking), puis kubectl apply -f ~/manifests/
hint-front-desk-not-ready =
    .lead = Les pods sont Running mais pas prêts (0/1) : leurs Events disent pourquoi.
    .solution = kubectl describe pod NOM -n swim
hint-front-desk-probe-fixed =
    .lead = Trouvez le chemin auquel l'appli répond vraiment (essayez-le sur l'adresse d'un pod, port 8080), corrigez la sonde dans le manifeste, appliquez.
    .solution = curl http://IP_DU_POD:8080/health ; nano ~/manifests/booking.yaml (path: /health), puis kubectl apply -f ~/manifests/
hint-front-desk-end =
    .lead = Le site via Traefik, une sonde de disponibilité qui passe, pas de NodePort, et les fichiers identiques à ce qui tourne.
    .solution = kubectl rollout status deployment/booking -n swim, puis curl -H 'Host: booking.pool.example' http://localhost/
