### Lo que comparten los capítulos de «La Biblioteca de Herramientas»: los
### mensajes propios del juego sobre los comandos de la forja (forgejo,
### forgejo-runner). Los comandos, las opciones, las rutas y las salidas no
### se traducen.

forgejo-usage =
    NAME:
       Forgejo - Beyond coding. We forge.

    USAGE:
       forgejo [global options] command [command options]

    COMMANDS:
       web      Start the Forgejo web server
       admin    Perform common administrative operations
       help, h  Shows a list of commands or help for one command

    GLOBAL OPTIONS:
       --config value, -c value      Set custom config file (default: "/var/lib/forgejo/custom/conf/app.ini")
       --work-path value, -w value   Set Forgejo's working path
       --version, -v                 print the version
forgejo-user-usage =
    Incorrect Usage: forgejo admin user list|create|change-password|delete|must-change-password|generate-access-token
    (en este juego: mira man forgejo)
forgejo-web-service = aquí forgejo web funciona como el servicio forgejo: usa systemctl (status, restart forgejo).
# { $command }: el subcomando escrito
forgejo-not-simulated = { $command }: no se simula en este juego (mira man forgejo, man forgejo-runner).
forgejo-runner-usage =
    Usage:
      forgejo-runner [command]

    Available Commands:
      daemon           Run as a runner daemon
      generate-config  Generate an example config file
      register         Register a runner to the server
      version          Print the version number

    Flags:
      -c, --config string   Config file path
forgejo-runner-service = aquí forgejo-runner daemon funciona como el servicio forgejo-runner: usa systemctl y journalctl -u forgejo-runner.
forgejo-runner-config =
    log:
      level: info
    runner:
      file: .runner
      capacity: 1
      timeout: 3h
      labels: []
    container:
      network: ""
      privileged: false
