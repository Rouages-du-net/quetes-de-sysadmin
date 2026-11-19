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

## Chapitre 3 — Le Vestiaire

hint-locker-room-config-read =
    .lead = Trouvez où le mot de passe est écrit : dans les réglages de l'appli, dans le cluster et dans les fichiers.
    .solution = cat ~/manifests/config.yaml, ou kubectl get configmap booking-config -n swim -o yaml
hint-locker-room-secret-created =
    .lead = Créez dans l'espace de noms swim un Secret qui contient le nouveau mot de passe (le fichier de Kemal), sans l'écrire dans un fichier du dépôt (man kubectl : create secret generic).
    .solution = kubectl create secret generic booking-db -n swim --from-literal=password=LE_NOUVEAU_MOT_DE_PASSE
hint-locker-room-decoded =
    .lead = Regardez ce que contient vraiment le Secret : ses données sont en base64. Est-ce caché ? (man base64)
    .solution = kubectl get secret booking-db -n swim -o jsonpath='{"{"}.data.password{"}"}' | base64 -d
hint-locker-room-referenced =
    .lead = Faites prendre DATABASE_PASSWORD au Deployment dans le Secret plutôt que dans la ConfigMap, dans booking.yaml (man kubectl : les variables).
    .solution = nano ~/manifests/booking.yaml (valueFrom: secretKeyRef: name: booking-db, key: password), puis kubectl apply -f ~/manifests/
hint-locker-room-config-cleaned =
    .lead = Retirez le mot de passe de la ConfigMap, mais gardez la ConfigMap : l'appli y lit toujours son database_host.
    .solution = nano ~/manifests/config.yaml (enlever database_password), puis kubectl apply -f ~/manifests/
hint-locker-room-restarted =
    .lead = Chaque pod en marche doit avoir démarré avec le nouveau mot de passe : un conteneur lit ses variables à son démarrage.
    .solution = kubectl rollout restart deployment/booking -n swim, puis kubectl rollout status deployment/booking -n swim
hint-locker-room-committed =
    .lead = Les fichiers de ~/manifests forment un dépôt git : enregistrez les fichiers corrigés dans un commit (man git).
    .solution = cd ~/manifests ; git status ; git commit -am "Mot de passe de la base dans un Secret"
hint-locker-room-pushed =
    .lead = Kemal récupère le dépôt partagé : envoyez-y votre commit.
    .solution = git push (dans ~/manifests)
hint-locker-room-end =
    .lead = Le nouveau mot de passe dans un Secret dont se servent les pods, aucun mot de passe dans la ConfigMap ni dans les fichiers, les fichiers identiques à ce qui tourne, le commit poussé.
    .solution = kubectl apply -f ~/manifests/ (tout unchanged), git status, git log -p (l'ancien mot de passe reste dans l'historique : c'est pour ça qu'il a été changé)

## Chapitre 4 — Le Grand Bain

hint-deep-end-oom =
    .lead = Les pods n'arrêtent pas de redémarrer : demandez à Kubernetes comment s'est fini le dernier conteneur (son Last State).
    .solution = kubectl get pods -n swim, puis kubectl describe pod NOM -n swim
hint-deep-end-top =
    .lead = Mesurez la mémoire qu'utilisent les pods et le nœud en ce moment (man kubectl : top).
    .solution = kubectl top pod -n swim, kubectl top node
hint-deep-end-history =
    .lead = Qu'est-ce qui a changé depuis le dernier meeting ? Le Deployment garde ses révisions.
    .solution = kubectl rollout history deployment/booking -n swim
hint-deep-end-leak =
    .lead = Laissez un peu de temps à la 2.4.0, et observez sa mémoire et ce qu'elle écrit dans son journal.
    .solution = kubectl top pod -n swim (deux fois, à une minute d'écart), kubectl logs deploy/booking -n swim --tail=5
hint-deep-end-rolled-back =
    .lead = Revenez à la version qui a tenu au dernier meeting, la 2.3.1 : dans le fichier (et kubectl rollout undo peut le faire tout de suite, vers la bonne révision).
    .solution = kubectl rollout undo deployment/booking -n swim --to-revision=N, ou nano ~/manifests/booking.yaml (image …:2.3.1) et kubectl apply -f ~/manifests/
hint-deep-end-limit-raised =
    .lead = Mettez la limite de mémoire au-dessus du pic mesuré par Rui (son mot), avec une marge, mais loin de tout le nœud.
    .solution = nano ~/manifests/booking.yaml (limits: memory: 320Mi), puis kubectl apply -f ~/manifests/
hint-deep-end-requests =
    .lead = Mettez les requests de mémoire à ce que l'appli utilise d'habitude sous charge (kubectl top pod), sous la limite.
    .solution = nano ~/manifests/booking.yaml (requests: memory: 256Mi), puis kubectl apply -f ~/manifests/ et kubectl rollout status deployment/booking -n swim
hint-deep-end-end =
    .lead = La 2.3.1 déployée sous la charge du meeting, des requests et des limits raisonnables, et les fichiers identiques à ce qui tourne.
    .solution = kubectl apply -f ~/manifests/ (tout unchanged), kubectl get pods -n swim, kubectl top pod -n swim
