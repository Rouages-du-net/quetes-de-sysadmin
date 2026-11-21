### What the chapters of "The Tool Library" share: the game's own messages
### about the forge's commands (forgejo, forgejo-runner). Commands,
### options, paths and outputs are not translated.

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
    (in this game: see man forgejo)
forgejo-web-service = forgejo web runs as the forgejo service here: use systemctl (status, restart forgejo).
# { $command }: the subcommand typed
forgejo-not-simulated = { $command }: not simulated in this game (see man forgejo, man forgejo-runner).
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
forgejo-runner-service = forgejo-runner daemon runs as the forgejo-runner service here: use systemctl and journalctl -u forgejo-runner.
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
