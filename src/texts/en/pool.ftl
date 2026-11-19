### What the chapters of "The Pool" share: the booking app's page, the
### manifests' comments, kubectl's usage, and the messages of what the game
### doesn't simulate. Commands, resource names, fields, paths and outputs
### are not translated.

pool-booking-home =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Riverside Pool: bookings</title></head>
    <body>
    <h1>Riverside Pool</h1>
    <p>Book a lane, a swimming lesson or an aquagym class.</p>
    <p>Summer lessons: registration opens on Monday 4 June at 9:00.</p>
    <footer>booking { $version }</footer>
    </body>
    </html>
pool-manifest-booking-comment = The booking app (Rui). Apply with: kubectl apply -f ~/manifests/
pool-manifest-config-comment = The app's settings (Rui): the database is outside the cluster.
pool-manifest-service-comment = The app's Service (Kemal, town IT)
pool-manifest-ingress-comment = booking.pool.example through Traefik, k3s's ingress controller (Kemal, town IT)
kubectl-not-simulated = kubectl { $command } is not simulated in this game
k3s-not-simulated = k3s { $command }: not simulated in this game (k3s --version, k3s kubectl and k3s check-config are)
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
