### Histoire « La Piscine », chapitre « Le Vestiaire » : le mot de passe
### de la base est dans une ConfigMap, et en clair dans un dépôt git partagé
### avec l'informatique de la mairie. Un Secret, secretKeyRef, rollout
### restart, base64 qui n'est pas un chiffrement, l'historique de git. Les
### commandes, noms de ressources, champs et sorties ne sont pas traduits.

chapter-locker-room = Le Vestiaire
    .summary = Le mot de passe de la base de l'appli de réservation est dans une ConfigMap, et en clair dans le dépôt git des manifestes, que l'informatique de la mairie peut lire. Il a été changé ce matin côté base : mettez le nouveau dans un Secret, sortez l'ancien des fichiers, et vérifiez que les pods s'en servent.

## Fichiers

locker-room-message-folake =
    De : Folake (piscine des Berges, accueil)
    Lundi 18 juin, 9 h 05

    Bonjour,

    Kemal m'a appelée à 8 h 50, un peu inquiet : il a trouvé le mot de
    passe de la base de données écrit en clair dans les manifestes que
    Rui partage avec l'informatique de la mairie. Il dit que n'importe qui
    à la mairie qui peut lire ce dépôt a pu le lire, alors il l'a changé
    tout de suite sur la base. Son mot est à côté de ce message.

    Le site marche toujours. Kemal dit que c'est « jusqu'au prochain
    redémarrage ». Je ne sais pas ce que ça veut dire, mais ça n'a pas
    l'air bon.

    Folake
locker-room-note-kemal =
    Mot de Kemal (informatique de la mairie)

    Mardi dernier, on a activé l'authentification par mot de passe sur
    db.pool.internal, et Rui a mis le mot de passe du compte booking dans
    la ConfigMap, donc dans ~/manifests/config.yaml, qu'il commite et
    pousse vers /srv/git/pool-manifests.git : le dépôt que je récupère, et
    que la moitié de l'informatique de la mairie peut lire.

    À 9 h, j'ai changé le mot de passe de ce compte sur la base. Le
    nouveau est dans ~/nouveau_mdp_bdd.txt (vous seul·e pouvez le lire).
    Les pods qui tournent gardent les connexions qu'ils ont ouvertes ; mais
    un pod qui démarre maintenant avec l'ancien mot de passe n'entrera pas.

    Ce qu'il faut :
    - le nouveau mot de passe dans un Secret Kubernetes, pas dans une
      ConfigMap ;
    - l'appli qui le lit de là (la ConfigMap lui donne toujours
      database_host) ;
    - des pods qui s'en servent vraiment ;
    - plus rien de secret dans les fichiers, et les fichiers corrigés
      poussés.

    Kemal

## Git

pool-commit-1 = appli de réservation sur k3s
pool-commit-2 = 2.3.1, un Service et un Ingress
pool-commit-3 = La base demande maintenant un mot de passe

## Événements

locker-room-event-config-read =
    Le voilà, en clair : l'ancien mot de passe, dans la ConfigMap et dans
    config.yaml. Une ConfigMap, c'est pour des réglages que tout le monde
    peut lire (kubectl get configmap -o yaml montre tout) ; un mot de passe
    va dans un Secret.
locker-room-event-history-seen =
    L'historique de git garde chaque version de chaque fichier : l'ancien
    mot de passe reste dans le commit qui l'a ajouté, et dans chaque clone
    du dépôt, même une fois le fichier corrigé. Réécrire l'historique
    n'atteindrait pas les copies que d'autres ont déjà. C'est pour ça que
    le changement fait par Kemal sur la base était le vrai remède : celui
    de l'historique n'ouvre plus rien.
locker-room-event-old-secret =
    Ce Secret contient l'ancien mot de passe, celui qui est écrit dans le
    dépôt : Kemal l'a changé sur la base à 9 h, un pod qui démarre avec
    n'entrera pas. Le nouveau est dans ~/nouveau_mdp_bdd.txt.
locker-room-event-auth-failed =
    « password authentication failed for user "booking" » : la base refuse
    le mot de passe avec lequel ce conteneur a démarré. Quel mot de passe
    le modèle lui donne-t-il, et est-ce celui de ~/nouveau_mdp_bdd.txt ?
locker-room-event-newline =
    Ce Secret contient le mot de passe suivi d'un saut de ligne :
    --from-file prend tout le fichier, et le fichier finit par un saut de
    ligne. La base le refuserait. Utilisez --from-literal (ou un fichier
    sans le saut de ligne).
locker-room-event-secret-created =
    Le Secret contient le nouveau mot de passe. Regardez-le avec kubectl
    get secret NOM -n swim -o yaml : est-il caché ?
locker-room-event-decoded =
    base64 est un encodage, pas un chiffrement : quiconque peut lire le
    Secret retrouve le mot de passe en une commande. Un Secret est plus sûr
    qu'une ConfigMap grâce à ce qu'on fait autour : qui a le droit de le
    lire (RBAC), comment il est stocké (chiffrement d'etcd), et qu'il reste
    hors du dépôt.
locker-room-event-base64-config =
    Le mot de passe en base64 dans la ConfigMap, c'est toujours le mot de
    passe : base64 -d le rend à n'importe qui. Ce n'est pas là où il est
    écrit qui change ; c'est qui peut le lire. Mettez-le dans un Secret.
locker-room-event-config-deleted =
    La ConfigMap booking-config a disparu, mais l'appli y prend toujours
    database_host : le prochain pod qui démarre restera en
    CreateContainerConfigError. Retirez-en le mot de passe ; gardez le
    reste.
locker-room-event-literal =
    Le mot de passe est maintenant écrit dans le Deployment lui-même
    (value:), donc dans booking.yaml, donc dans le dépôt. Faites plutôt
    référence au Secret (valueFrom.secretKeyRef).
locker-room-event-referenced =
    Le modèle du Deployment prend maintenant DATABASE_PASSWORD dans le
    Secret.
locker-room-event-config-cleaned =
    La ConfigMap ne contient plus de mot de passe, et donne toujours son
    database_host à l'appli.
locker-room-event-stale-env =
    Le modèle donne le nouveau mot de passe, mais des pods en marche ont
    démarré avec l'ancien : un conteneur lit ses variables
    d'environnement une fois, à son démarrage. Changer un Secret ou une
    ConfigMap ne redémarre rien. kubectl rollout restart
    deployment/booking -n swim remplace les pods un à un, sans coupure.
locker-room-event-restarted =
    Tous les pods booking tournent maintenant avec le nouveau mot de
    passe, lu dans le Secret.
locker-room-event-secret-file =
    { $file } dans ~/manifests contient le mot de passe (en clair, ou en
    base64, ce qui revient au même) : il partirait dans le dépôt avec le
    reste. Gardez-le hors du dépôt (kubectl create secret generic n'a pas
    besoin de fichier), puis retirez-le de là.
locker-room-event-committed =
    Le dernier commit ne contient plus de mot de passe. Kemal récupère le
    dépôt partagé : y est-il aussi ?
locker-room-event-pushed =
    Le dépôt partagé est à jour : ce que Kemal récupère ne contient plus de
    mot de passe (mais son historique contient toujours l'ancien : voyez
    git log -p).
locker-room-event-drift =
    Les pods utilisent le Secret, mais les fichiers de ~/manifests ne le
    disent pas : le prochain kubectl apply -f ~/manifests/ remettrait le
    mot de passe dans la ConfigMap. Corrigez les fichiers et appliquez-les.
locker-room-event-end =
    Kemal : « Parfait. L'ancien mot de passe n'ouvre plus rien, le nouveau
    est dans un Secret que seuls les admins du cluster peuvent lire, et le
    dépôt n'a plus rien à cacher. Je préviens la responsable de la
    sécurité. »

    Bravo ! Vous avez terminé Le Vestiaire.

    CE QUI S'EST PASSÉ
    Le mot de passe de la base était dans une ConfigMap, donc dans
    config.yaml, donc dans un dépôt git que l'informatique de la mairie
    pouvait lire. Kemal l'a changé sur la base : les pods en marche ont
    gardé leurs connexions, mais tout nouveau démarrage aurait échoué.
    Vous avez mis le nouveau mot de passe dans un Secret, fait lire le
    Deployment avec secretKeyRef, retiré le mot de passe de la ConfigMap
    (qui donne toujours database_host), remplacé les pods pour qu'ils le
    lisent (une variable d'environnement est lue une fois, au démarrage du
    conteneur), et poussé des fichiers qui ne le contiennent plus.

    BONNES PRATIQUES
    - Un mot de passe va dans un Secret, jamais dans une ConfigMap, et
      jamais dans le dépôt. kubectl create secret generic --from-literal
      n'a pas besoin de fichier ; --dry-run=client -o yaml montre ce qu'il
      créerait.
    - base64 est un encodage : un Secret est protégé par qui a le droit de
      le lire (RBAC : get, list et watch sur les secrets valent le mot de
      passe), par le chiffrement d'etcd au repos (k3s server
      --secrets-encryption), et en restant hors de git. Des outils comme
      Sealed Secrets ou un coffre externe les tiennent hors du dépôt pour
      de bon.
    - Un secret qui a fuité se change à la source (rotation). L'historique
      de git et ses copies gardent l'ancien pour toujours : réécrire
      l'historique ne rend pas un mot de passe secret à nouveau.
    - Les variables sont lues au démarrage : après avoir changé un Secret,
      kubectl rollout restart. Un Secret monté en volume est mis à jour
      par le kubelet en une minute environ (mais pas via subPath), et
      l'appli doit relire le fichier.

    DOCUMENTATION
    - Secrets : https://kubernetes.io/docs/concepts/configuration/secret/
    - Bonnes pratiques pour les Secrets : https://kubernetes.io/docs/concepts/security/secrets-good-practices/
    - Configurer un pod avec une ConfigMap : https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/
    - Distribuer des identifiants avec des Secrets : https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/
    - Chiffrer les données au repos : https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/
    - Chiffrement des secrets dans k3s : https://docs.k3s.io/security/secrets-encryption
