### Story "La Fabrique", chapter 4 "Full powers": don't run a
### container as root. Commands, paths, options and messages of
### docker, chown, ls and ps are never translated.

chapitre-pleins-pouvoirs = Full powers
    .resume = The fablab's photo gallery runs as root: --user, the uid shared between the container and the machine, and the directory to hand over to the right account.

## Files

pleins-pouvoirs-message-de-yasmine =
    A message from Yasmine:

    "Hi! You know the fablab's photo gallery (port 8082)? Visitors
    upload photos of their projects there. I started it
    with docker compose, in /srv/galerie.

    Two problems. One: I can no longer add or remove photos in
    /srv/galerie/photos without sudo, "Permission denied". And yet it's
    our directory! Two: Rania says the gallery "runs as root", and
    that it's dangerous (her note is next to this message).

    What I'd like:
      - the gallery no longer running as root;
      - to be able to manage the photos myself (I'm yasmine, uid 1001);
      - and above all not to lose any of the 14 photos!

    For sudo: fablab-2027."
pleins-pouvoirs-mot-de-rania =
    A note from Rania:

    "The gallery receives files uploaded by strangers: that's
    exactly the kind of program that gets attacked. If someone finds
    a flaw in it, their code runs with the gallery's privileges.

    And a container isn't a separate machine: its processes run
    on the machine's kernel. Root in the container is the same
    uid 0 as root on the machine, and everything mounted in the
    container is at its mercy.

    Start by looking at who you are, inside and outside:
      sudo docker exec galerie-galerie-1 id
      ps aux
    Then the manual: man docker and man docker-compose."
pleins-pouvoirs-lisezmoi =
    Galerie 3.2 — README (shipped with the image registre.example/galerie)

    The photos live in /app/photos: mount a directory or a volume there.
    At startup, the gallery rebuilds its thumbnail index in
    /app/photos/.miniatures: it must be able to write to /app/photos.

    The image is built on node:22 and doesn't choose a user.
    It works under any uid, as long as it can write
    to /app/photos.

# { $nombre }: the number of photos
pleins-pouvoirs-galerie-accueil = { $nombre ->
        [one] Fablab gallery: one project photo. Send yours!
       *[other] Fablab gallery: { $nombre } project photos. Send yours!
    }

## Events

pleins-pouvoirs-evenement-root =
    The gallery runs as root: uid=0 in the container, and root in ps aux
    on the machine, like sshd. Its image doesn't declare a user (no
    USER), and neither does compose.yaml: so by default, a container runs
    as root. And without a user namespace (userns-remap,
    disabled by default), the container's uid 0 IS the machine's uid 0.
    That's also why the files in /srv/galerie/photos
    belong to root. Look for --user in man docker, and user: in
    man docker-compose.
pleins-pouvoirs-evenement-inconnu =
    "unable to find user": a name given to --user (or to user:) must exist
    in the IMAGE's /etc/passwd, not the machine's. With
    numbers (uid:gid), no more problem: the kernel only knows
    numbers.
pleins-pouvoirs-evenement-eacces =
    The gallery no longer starts: EACCES, permission denied (sudo docker
    logs, or docker compose logs). It no longer runs as root, so the
    machine's Unix permissions apply to it, by number: uid and gid.
    But /srv/galerie/photos and what it contains still belong to root.
    Look at ls -lan /srv/galerie/photos (-n: the numbers, -a: hidden
    files too). Docker restarts it on its own (restart: unless-stopped):
    it will come back as soon as it can write.
pleins-pouvoirs-evenement-uid-1000 =
    The gallery runs under uid 1000… and on this machine, uid 1000
    is you (vous)! In ls -l, its files belong to you: the kernel
    only sees numbers, and each /etc/passwd gives them its own name (node
    in the image, vous on the machine). Yasmine (uid 1001), however, still
    can't write to the photos directory.
pleins-pouvoirs-evenement-ouvert-a-tous =
    A directory writable by everyone (chmod 777, o+w): it "works",
    but then any account, any program on the machine can
    drop or delete files there. Instead, give the directory to the
    right owner (chown), without opening up the others' permissions.
# { $nombre }: the number of missing photos
pleins-pouvoirs-evenement-photos-perdues =
    { $nombre ->
        [one] One photo has disappeared from /srv/galerie/photos. On a real server, without a backup, it would be lost.
       *[other] { $nombre } photos have disappeared from /srv/galerie/photos. On a real server, without a backup, they would be lost.
    } Here, you can restart the chapter from the menu.
pleins-pouvoirs-evenement-fin =
    The gallery runs under an ordinary account, Yasmine manages the photos
    without sudo, and all 14 photos are there. Rania: "If someone breaks
    into the gallery, they'll only get an ordinary account's privileges.
    Not root's."

    Well done! You've finished chapter 4 of The Workshop, and the whole story.

    WHAT HAPPENED
    The gallery's image doesn't declare a user: without --user (or
    user:), a container runs as root. A container shares the machine's
    kernel; without a user namespace, its uid 0 is the machine's
    uid 0. The files it writes to a mounted directory belong
    to root, and a flaw in the app would give root privileges over everything
    that's mounted. Under an ordinary uid, the gallery is subject to
    Unix permissions like any other program: you had to give it its
    directory (chown -R).

    GOOD PRACTICE
    - Check: docker exec container id, and ps aux on the machine.
    - An ordinary uid for each container: USER in the Dockerfile,
      otherwise --user uid:gid or user: "uid:gid".
    - Numbers rather than names: a name must exist in the image.
    - Give the mounted directories to that uid (chown -R), never chmod 777.
    - Remove what isn't needed: --cap-drop ALL, --security-opt
      no-new-privileges, --read-only.
    - Never --privileged, nor /var/run/docker.sock mounted in an exposed
      container: that's root on the machine. The docker group too.
    - Going further: userns-remap, or Docker in rootless mode.

    DOCUMENTATION
    - docker run --user: https://docs.docker.com/reference/cli/docker/container/run/#user
    - user: in Compose: https://docs.docker.com/reference/compose-file/services/#user
    - Docker security: https://docs.docker.com/engine/security/
    - userns-remap: https://docs.docker.com/engine/security/userns-remap/
    - Rootless Docker: https://docs.docker.com/engine/security/rootless/
