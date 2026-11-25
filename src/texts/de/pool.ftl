### What the chapters of "The Pool" share: the booking app's page, the
### manifests' comments, kubectl's usage, and the messages of what the game
### doesn't simulate. Commands, resource names, fields, paths and outputs
### are not translated.

pool-booking-home =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Uferbad: Buchungen</title></head>
    <body>
    <h1>Uferbad</h1>
    <p>Buche eine Bahn, einen Schwimmkurs oder eine Aquagym-Stunde.</p>
    <p>Sommerkurse: Anmeldung ab Montag, 4. Juni, 9:00 Uhr.</p>
    <footer>booking { $version }</footer>
    </body>
    </html>
pool-manifest-booking-comment = Die Buchungs-App (Rui). Anwenden mit: kubectl apply -f ~/manifests/
pool-manifest-config-comment = Die Einstellungen der App (Rui): die Datenbank liegt außerhalb des Clusters.
pool-manifest-service-comment = Der Service der App (Kemal, IT der Stadt)
pool-manifest-ingress-comment = booking.pool.example über Traefik, den Ingress-Controller von k3s (Kemal, IT der Stadt)
kubectl-not-simulated = kubectl { $command } wird in diesem Spiel nicht simuliert
k3s-not-simulated = k3s { $command }: in diesem Spiel nicht simuliert (k3s --version, k3s kubectl und k3s check-config schon)
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
