### Histoire « La Piscine », chapitre « Le Grand Bain » : la charge du
### meeting de natation, des limites de mémoire copiées d'un tutoriel
### (OOMKilled, code de sortie 137), une version qui fuit. kubectl top, le
### Last State de describe, rollout history et undo, des requests et des
### limits tirées de ce qui a été mesuré. Les commandes, noms de
### ressources, champs et sorties ne sont pas traduits.

chapter-deep-end = Le Grand Bain
    .summary = Samedi, c'est le meeting régional de natation, et tout le monde suit les horaires et les résultats sur l'appli de réservation. Depuis ce matin, ses pods n'arrêtent pas de redémarrer. Mesurez ce que l'appli utilise vraiment, trouvez pourquoi elle est tuée, et donnez-lui la place qu'il lui faut, pas plus.

## Fichiers

deep-end-message-folake =
    De : Folake (piscine des Berges, accueil)
    Samedi 23 juin, 9 h 15

    Bonjour, désolée de vous appeler un samedi !

    C'est le meeting régional de natation aujourd'hui : deux cents
    nageur·ses, leurs clubs, leurs familles, et tout le monde regarde les
    horaires et les résultats sur le site de réservation. Depuis le départ
    à 8 h, il ne dit plus que « 404 page not found ». Samedi dernier, il a
    tenu toute la matinée.

    Rui a mis une nouvelle version hier soir (son mot est ici). Il est au
    meeting, chronométreur : il ne peut pas toucher son téléphone avant
    midi.

    Folake
deep-end-note-rui =
    Mot de Rui (vendredi, 18 h 20)

    J'ai appliqué la 2.4.0 : un cache des résultats, pour que la page des
    horaires soit plus rapide demain. J'ai aussi ajouté des requests et des
    limits de mémoire, comme dans le tutoriel de Kubernetes (64Mi et
    128Mi) : c'est plus propre. Les pods ont bien démarré.

    Pour mémoire, au meeting de samedi dernier (en 2.3.1, sans limites),
    kubectl top pod a montré au plus 230Mi par pod au pic.

    Les versions : 2.3.1 (depuis le 4 juin), 2.4.0 (ce soir).

    Rui

## Événements

deep-end-event-oom =
    OOMKilled, code de sortie 137 (128 + 9 : tué par SIGKILL) : le
    conteneur a utilisé plus de mémoire que sa limite, et le noyau l'a tué.
    Le kubelet le relance, de moins en moins souvent (CrashLoopBackOff).
    Combien de mémoire l'appli utilise-t-elle, et combien a-t-elle le droit
    d'en prendre ?
deep-end-event-top =
    kubectl top demande au metrics-server ce que chaque pod utilise en ce
    moment (kubectl top node pour toute la machine). Comparez avec la limite
    du Deployment, et avec ce que Rui a mesuré au dernier meeting.
deep-end-event-history =
    kubectl rollout history liste les révisions du Deployment, avec leur
    CHANGE-CAUSE : la 2.4.0 a apporté hier un nouveau cache. Un Deployment
    garde ses ReplicaSets précédents : revenir en arrière tient en une
    commande.
deep-end-event-leak =
    Le cache des résultats grossit à chaque requête et n'oublie jamais
    rien : la mémoire de la 2.4.0 monte tant qu'elle tourne, quelle que
    soit la place qu'on lui donne. C'est une fuite ; aucune limite ne la
    répare. La version qui a tenu au dernier meeting, c'est la 2.3.1.
deep-end-event-pending =
    « 0/1 nodes are available: 1 Insufficient memory » : l'ordonnanceur ne
    place un pod que là où ses requests tiennent dans ce que le nœud peut
    encore donner (kubectl describe node : Allocatable, Allocated
    resources). Il reste Pending, et la mise à jour progressive attend. Les
    requests, c'est ce que le pod est sûr d'avoir : demandez ce qu'il
    utilise, pas tout le nœud.
deep-end-event-whole-node =
    Une limite de plus d'un gigaoctet, sur un nœud de 4 Gio pour tout
    (k3s, Traefik, les autres pods) : l'appli n'en a jamais eu besoin du
    quart. Une limite est un filet de sécurité posé un peu au-dessus du pic
    mesuré ; avec celle-ci, une fuite remplirait le nœud avant d'être
    arrêtée.
deep-end-event-no-limits =
    Plus de limite de mémoire : un conteneur peut maintenant prendre toute
    la mémoire du nœud. Avec une fuite, le kubelet du nœud commencerait à
    expulser des pods, ou l'OOM killer du noyau choisirait un processus,
    peut-être k3s lui-même. Gardez une limite, au-dessus du pic mesuré.
deep-end-event-pods-deleted =
    Supprimer les pods n'en ramène que des nouveaux, avec la même limite
    et la même image : ils sont tués de la même façon. Le remède est dans
    le modèle du Deployment.
deep-end-event-leak-fills =
    Même avec plus de place, la 2.4.0 a de nouveau été OOMKilled : sa
    mémoire a grossi jusqu'à atteindre la nouvelle limite. Regardez ce
    qu'elle écrit dans son journal (kubectl logs), et l'historique du
    Deployment.
deep-end-event-undo-leaky =
    kubectl rollout undo revient d'une révision en arrière : celle d'avant
    l'actuelle est encore la 2.4.0. kubectl rollout history les liste, et
    --to-revision en choisit une (kubectl rollout history … --revision=N
    montre ce qu'elle contient).
deep-end-event-rolled-back =
    Le Deployment tourne de nouveau en 2.3.1. Est-ce dans les fichiers, et
    a-t-il assez de place pour le pic du meeting ?
deep-end-event-below-peak =
    Cette limite est sous ce que la 2.3.1 a utilisé au pic du dernier
    meeting (230Mi, le mot de Rui) : à la minute la plus chargée, elle
    serait de nouveau tuée. Mettez-la au-dessus du pic, avec une marge.
deep-end-event-limit-raised =
    La limite de mémoire est maintenant au-dessus du pic mesuré par Rui.
deep-end-event-requests-low =
    Les requests sont bien en dessous de ce que l'appli utilise sous
    charge : l'ordonnanceur ne réserve que ça, et pourrait placer d'autres
    pods là où l'appli aura ensuite besoin de place. Demandez ce qu'elle
    utilise d'habitude (kubectl top pod).
deep-end-event-requests =
    Des requests qui réservent ce que l'appli utilise, une limite
    au-dessus de son pic : les pods sont placés, et le noyau les laisse
    tranquilles.
deep-end-event-drift =
    Les pods tournent comme il faut, mais ~/manifests/booking.yaml dit
    toujours autre chose : le prochain kubectl apply -f ~/manifests/
    remettrait la 2.4.0 ou les anciennes limites. Écrivez-le dans le
    fichier et appliquez-le.
deep-end-event-end =
    Folake : « Les résultats sont sur les écrans et sur tous les
    téléphones ! Rui dit, entre deux courses, qu'il essaiera son cache un
    jour de semaine tranquille la prochaine fois. »

    Bravo ! Vous avez terminé Le Grand Bain.

    CE QUI S'EST PASSÉ
    Les limites de Rui, copiées d'un tutoriel (128Mi), allaient bien un
    soir calme ; sous la charge du meeting, l'appli a besoin de jusqu'à
    230Mi, alors le noyau tuait chaque conteneur dès qu'il travaillait
    (OOMKilled, code de sortie 137) et le site a perdu ses pods l'un après
    l'autre. Et le cache des résultats de la 2.4.0 n'oublie jamais rien :
    avec plus de place, il la remplit aussi. Vous êtes revenu·e à la 2.3.1,
    et avez fixé requests et limits d'après ce qui a été mesuré, dans le
    fichier.

    BONNES PRATIQUES
    - Mesurer avant de fixer : kubectl top pod et node, au moment le plus
      chargé (mieux : un historique, avec Prometheus). Requests : ce que
      l'appli utilise d'habitude (l'ordonnanceur le réserve). Limite de
      mémoire : au-dessus du pic mesuré, avec une marge.
    - OOMKilled : kubectl describe pod, Last State: Terminated, Reason:
      OOMKilled, Exit Code: 137 ; kubectl get pods compte les redémarrages.
    - Une mémoire qui ne fait que grossir, c'est une fuite : une limite plus
      grande ne fait que retarder la mise à mort. Revenir en arrière
      (kubectl rollout undo, ou l'image précédente dans le fichier), puis
      chercher la cause un jour calme.
    - Des requests plus grandes que le nœud : le pod reste Pending
      (FailedScheduling: Insufficient memory). Aucune limite : une seule
      fuite peut prendre tout le nœud.
    - kubectl rollout undo change ce qui tourne, pas les fichiers : écrivez
      le remède dans le manifeste aussi.

    DOCUMENTATION
    - Gestion des ressources des pods et conteneurs : https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
    - Attribuer de la mémoire aux conteneurs et aux pods (dépasser une limite, OOM) : https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/
    - Expulsion sous pression du nœud : https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
    - Revenir en arrière avec un Deployment : https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment
    - kubectl top : https://kubernetes.io/docs/reference/kubectl/generated/kubectl_top/
