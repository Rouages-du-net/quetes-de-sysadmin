### Ce que partagent les chapitres de « La Piscine » : la page de l'appli
### de réservation, les commentaires des manifestes, l'aide de kubectl et
### les messages de ce que le jeu ne simule pas. Les commandes, noms de
### ressources, champs, chemins et sorties ne sont pas traduits.

pool-booking-home =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Piscine des Berges : réservations</title></head>
    <body>
    <h1>Piscine des Berges</h1>
    <p>Réservez une ligne d'eau, un cours de natation ou une séance d'aquagym.</p>
    <p>Cours d'été : inscriptions le lundi 4 juin à 9 h.</p>
    <footer>booking { $version }</footer>
    </body>
    </html>
pool-manifest-booking-comment = L'appli de réservation (Rui). Appliquer avec : kubectl apply -f ~/manifests/
pool-manifest-config-comment = Les réglages de l'appli (Rui) : la base de données est hors du cluster.
pool-manifest-service-comment = Le Service de l'appli (Kemal, informatique de la mairie)
pool-manifest-ingress-comment = booking.pool.example via Traefik, le contrôleur d'Ingress de k3s (Kemal, informatique de la mairie)
kubectl-not-simulated = kubectl { $command } n'est pas simulé dans ce jeu
k3s-not-simulated = k3s { $command } : non simulé dans ce jeu (k3s --version, k3s kubectl et k3s check-config le sont)
kubectl-usage =
    kubectl controls the Kubernetes cluster manager.

     Find more information at: https://kubernetes.io/docs/reference/kubectl/

    Basic Commands (Beginner):
      create          Create a resource from a file or from stdin
      expose          Take a replication controller, service, deployment or pod and expose it as a new Kubernetes service
      run             Run a particular image on the cluster
      set             Set specific features on objects

    Basic Commands (Intermediate):
      explain         Get documentation for a resource
      get             Display one or many resources
      edit            Edit a resource on the server
      delete          Delete resources by file names, stdin, resources and names, or by resources and label selector

    Deploy Commands:
      rollout         Manage the rollout of a resource
      scale           Set a new size for a deployment, replica set, or replication controller

    Cluster Management Commands:
      cluster-info    Display cluster information
      top             Display resource (CPU/memory) usage

    Troubleshooting and Debugging Commands:
      describe        Show details of a specific resource or group of resources
      logs            Print the logs for a container in a pod
      exec            Execute a command in a container
      port-forward    Forward one or more local ports to a pod

    Advanced Commands:
      apply           Apply a configuration to a resource by file name or stdin

    Other Commands:
      api-resources   Print the supported API resources on the server
      config          Modify kubeconfig files
      version         Print the client and server version information

    Usage:
      kubectl [flags] [options]

    Use "kubectl <command> --help" for more information about a given command.
