### Ce que partagent les chapitres de « L'Outilthèque » : les messages du
### jeu sur les commandes de la forge (forgejo, forgejo-runner). Commandes,
### options, chemins et sorties ne se traduisent pas.

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
    (dans ce jeu : voir man forgejo)
forgejo-web-service = forgejo web tourne ici comme le service forgejo : utilisez systemctl (status, restart forgejo).
# { $command } : la sous-commande tapée
forgejo-not-simulated = { $command } : non simulé dans ce jeu (voir man forgejo, man forgejo-runner).
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
forgejo-runner-service = forgejo-runner daemon tourne ici comme le service forgejo-runner : utilisez systemctl et journalctl -u forgejo-runner.
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
