### Story "The Workshop", chapter 1 "The Update": Docker, containers and
### volumes. Commands, paths, image names and the messages of docker and
### of the outiltheque (in English) are not translated.

chapter-update = The Update
    .summary = Update an app in Docker without losing its data: the container layer, docker cp, volumes, --restart.

## Files

update-message-yasmine =
    A message from Yasmine, who runs the fablab:

    "Hello! Here, we lend tools to people in the neighbourhood, and we
    record everything in the outiltheque, a small web app. I installed
    it two weeks ago with Docker, following the instructions:

      docker run -d --name outiltheque -p 8080:8080 registry.example/outiltheque:1.4

    Version 1.5 has just come out (it fixes a bug in the return dates).
    Can you update it? Above all, don't lose the 37 current loans: I have
    nothing but the app to know who has what!

    Another thing: after Wednesday's power cut, the outiltheque didn't
    come back by itself, I had to restart it.

    For sudo, your password is: fablab-2027
    My notes are in notes_docker.txt."
update-notes-docker =
    YASMINE'S NOTES — DOCKER

      sudo docker ps -a              the containers (even stopped ones)
      sudo docker logs outiltheque   what the app has to say
      curl http://localhost:8080     the app, as in a browser

    "Updating a container": you don't update it, you replace it with a
    new one, created from the new image. The rest is in man docker (and
    the outiltheque's docs say it keeps its database in
    /var/lib/outiltheque).
update-tools = drill, jigsaw, sander, stepladder, cordless screwdriver, soldering iron, laser level, staple gun, wallpaper steamer, lawnmower, sewing machine, circular saw
update-people = Aya, Bilal, Chloé, Dmitri, Esra, Farid, Gaëlle, Hugo, Ines, Jun, Kenza, Lucas

## The app (pages)

update-app-welcome =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Fablab tool library</title></head>
    <body>
    <h1>Fablab tool library</h1>
    <p>{ $loans ->
        [0] No current loans.
        [one] One current loan.
       *[other] { $loans } current loans.
    } <a href="/prets">See the loans</a></p>
    <footer>outiltheque { $version }</footer>
    </body>
    </html>
update-app-loans = Current loans: { $loans } (the first five)

## Events

update-event-layer =
    "Mounts": []: this container has no volume and no machine directory
    mounted. Everything the app writes (its database included) lives in
    the container layer, which disappears with it. Before deleting it,
    you must put the database somewhere safe (man docker: cp).
update-event-port-busy =
    "port is already allocated": port 8080 of the machine is already
    published by another running container (the old one). Two containers
    can't listen on the same port of the machine: you must stop the old
    one first.
update-event-lost =
    The 37 loans are gone: the container was deleted along with its
    layer, and the database hadn't been copied anywhere. On a real
    server, it would be lost for good. Here, you can restart the chapter
    from the menu. The rule: a container's data goes in a volume, and you
    copy it before any risky operation.
update-event-new-empty =
    Version 1.5 is running… with a brand-new, empty database (docker logs
    says so: "creating a new one"). The old container's database is not
    in the new one. If you put it somewhere safe, you still have to put
    it back in place (and restart the app so it migrates it).
update-event-without-reboot =
    The 37 loans are there, in version 1.5, and the database is finally
    in a volume. But Yasmine said it: after a power cut, the outiltheque
    doesn't come back by itself. Look at the --restart option of
    docker run (or docker update).
update-event-end =
    Outiltheque 1.5 is running, with its 37 loans, in a volume that will
    survive the next updates, and it will start again by itself after a
    power cut. Yasmine: "And the next update will just be: new container,
    same volume!"

    Well done! You have finished chapter 1 of The Workshop. (What comes
    next awaits you: The Composition.)

    WHAT HAPPENED
    The outiltheque had been started without a volume: its database
    lived in the container layer. Updating an app in Docker means
    deleting the container and creating a new one; without precautions,
    the database left with the old one.

    GOOD PRACTICE
    - First of all: docker inspect (the "Mounts") to know where the data
      is.
    - A container's data goes in a volume (-v name:/path) or a directory
      of the machine (-v /srv/app:/path), never in its layer.
    - Copy before touching: docker cp container:/path ./backup.
    - Stop the old one before starting the new one on the same port; only
      delete it once the new one has been checked (docker logs, curl).
    - --restart unless-stopped: the container starts again with the
      machine.
    - The docker group is as good as root: only put admins in it.

    DOCUMENTATION
    - Volumes: https://docs.docker.com/engine/storage/volumes/
    - docker cp: https://docs.docker.com/reference/cli/docker/container/cp/
    - Start containers automatically: https://docs.docker.com/engine/containers/start-containers-automatically/
