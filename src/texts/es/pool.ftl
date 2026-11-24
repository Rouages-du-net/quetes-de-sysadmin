### Lo que comparten los capítulos de «La Piscina»: la página de la
### aplicación de reservas, los comentarios de los manifiestos, la ayuda de
### kubectl y los mensajes de lo que el juego no simula. Los comandos,
### nombres de recursos, campos, rutas y salidas no se traducen.

pool-booking-home =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Piscina de la Ribera: reservas</title></head>
    <body>
    <h1>Piscina de la Ribera</h1>
    <p>Reserva una calle, una clase de natación o una sesión de aquagym.</p>
    <p>Cursos de verano: inscripciones el lunes 4 de junio a las 9:00.</p>
    <footer>booking { $version }</footer>
    </body>
    </html>
pool-manifest-booking-comment = La aplicación de reservas (Rui). Aplicar con: kubectl apply -f ~/manifests/
pool-manifest-config-comment = Los ajustes de la aplicación (Rui): la base de datos está fuera del clúster.
pool-manifest-service-comment = El Service de la aplicación (Kemal, informática del ayuntamiento)
pool-manifest-ingress-comment = booking.pool.example a través de Traefik, el controlador de Ingress de k3s (Kemal, informática del ayuntamiento)
kubectl-not-simulated = kubectl { $command } no está simulado en este juego
k3s-not-simulated = k3s { $command }: no simulado en este juego (k3s --version, k3s kubectl y k3s check-config sí)
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
