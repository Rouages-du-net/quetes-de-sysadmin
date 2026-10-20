### Story "The Workshop", chapter 2 "The Composition": Docker Compose.
### The commands, paths, YAML keys and messages from docker, PostgreSQL
### and the app (in English) are not translated.

chapitre-composition = The Composition
    .resume = An app and its database with Docker Compose: service names, volumes, secrets in .env, restarting.

## Files

composition-message-de-yasmine =
    A message from Yasmine:

    "We'd like people to book the fablab's machines (the
    laser cutter, the 3D printers) online. I found an app,
    "reservations", which needs a PostgreSQL database. A tutorial
    gave a ready-made compose.yaml file: I copied it into
    /srv/reservations/.

    I can't get it to work. And before putting this file on
    the fablab's git repository, I'd like it not to contain any password
    any more: they will go in a .env file, readable by root only.

    Of course, everything must start again on its own after a power cut, and the
    bookings must not disappear if the containers are recreated.
    The app must answer on http://localhost:8081.

    For sudo: fablab-2027. My notes: aide_compose.txt."
composition-aide-compose =
    YASMINE'S NOTES — DOCKER COMPOSE

    Run everything from the project directory (/srv/reservations):
      sudo docker compose up -d       creates and starts (or recreates) the services
      sudo docker compose ps          the state of the services
      sudo docker compose logs appli  the log of one service
      sudo docker compose config      the file as Compose understands it
      sudo docker compose down        stops and removes the containers

    The rest: man docker-compose.

## The app

composition-appli-accueil =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Book a machine — Fablab</title></head>
    <body>
    <h1>Book a machine</h1>
    <p>Laser cutter, 3D printers, embroidery machine: choose a time slot.</p>
    <footer>reservations 2.1 — database connected</footer>
    </body>
    </html>

## Events

composition-evenement-localhost =
    "connect ECONNREFUSED 127.0.0.1:5432": the app looks for the database on
    localhost. But in a container, localhost means the container
    itself, not the machine nor the other containers. In a Compose
    project, each service can be reached by its name, on the project's
    network.
composition-evenement-sans-mot-de-passe =
    PostgreSQL refuses to create its database without a password: the variable
    POSTGRES_PASSWORD is empty. docker compose config shows what Compose
    understood, and the warnings say which variable is missing from .env.
composition-evenement-authentification =
    "password authentication failed": the app and the database don't have the
    same password. A classic trap: the PostgreSQL image only reads
    POSTGRES_PASSWORD once, when it creates the database in an empty
    directory. If the database already exists in the volume, changing the variable
    changes nothing. As long as the database holds nothing important, you can
    recreate it (down -v deletes the volumes); otherwise, you change the password
    in the database itself.
composition-evenement-connectee =
    The app is connected to its database: http://localhost:8081 answers. Now
    make the setup solid (data, secrets, restarting).
composition-evenement-volumes-effaces =
    docker compose down -v: the project's volumes are deleted, along with
    all the database's data. Useful while it's empty; never to be
    typed on a database in service.
composition-evenement-en-clair =
    Everything works… but the password is still written in compose.yaml,
    which is going to the git repository. Compose replaces ${"{"}VARIABLE{"}"} with the
    value found in the project's .env file (man docker-compose).
composition-evenement-env-lisible =
    The password has left compose.yaml: good. But .env is readable by
    every account on the machine (ls -la). Yasmine wanted it to be
    readable by root only.
composition-evenement-sans-redemarrage =
    Almost: after a power cut, these containers would not start
    again. In compose.yaml, each service can have its restart policy.
composition-evenement-fin =
    http://localhost:8081 answers, the database keeps its data in a volume,
    the password sleeps in .env (readable by root only), and everything
    will start again after a power cut. Yasmine publishes compose.yaml on the fablab's
    git repository, without any secret in it.

    Well done! You have finished chapter 2 of The Workshop. (What comes next awaits you:
    The Hole in the Firewall.)

    WHAT HAPPENED
    The tutorial's compose.yaml had four flaws: the app looked for the
    database on localhost (in a container, that's itself), the database had
    no volume, the password was written in plain text, and nothing
    restarted.

    GOOD PRACTICE
    - Between containers of the same project: the service name (db), never
      localhost.
    - A database's data in a named volume, declared under volumes:.
    - Secrets in .env (chmod 600), never in the published file;
      ${"{"}VARIABLE{"}"} in compose.yaml.
    - POSTGRES_PASSWORD is only used when the database is created.
    - docker compose config to see what Compose understood; down -v
      deletes the data.
    - restart: unless-stopped on each service.
    - The version: attribute is obsolete: remove it.

    ANOTHER WAY
    Podman, without a daemon, can run the same compose files; its
    quadlets describe containers as systemd units.
    Kubernetes, for many machines, at the cost of much more
    complexity. For one app and its database on one server, docker compose
    remains the simplest.

    DOCUMENTATION
    - Networking in Compose: https://docs.docker.com/compose/how-tos/networking/
    - Compose variables: https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
    - The PostgreSQL image: https://hub.docker.com/_/postgres
