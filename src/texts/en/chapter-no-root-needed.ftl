### Story "The Walking Club", chapter "No Root Needed": a web app moved
### from Docker as root to rootless Podman under a service account:
### subordinate ids (/etc/subuid, /etc/subgid), unprivileged ports, the data's
### owner seen through the user namespace (:U, --userns=keep-id, podman
### unshare). Commands, options, paths and outputs are not translated.

chapter-no-root-needed = No Root Needed
    .summary = A walking club's sign-up app ran in a Docker container, as root, since a volunteer set it up. Move it to rootless Podman under its own account, with the club's data intact and the site still behind nginx.

## Files

# { $you }: the player's account on the machine ("you").
no-root-needed-message-soo-ah =
    From: Soo-ah (chair, Open Paths walking club)
    Monday 12 April, 09:20

    Hello, and thank you for coming to help!

    Our sign-up site, https://walks.openpaths.example, has been down since
    this morning, and that's on purpose: I stopped Docker.

    Bolat set the site up in 2031: Trailbook (the app that lists our walks
    and takes the sign-ups) runs in a container, behind nginx. Last week a
    friend who does security for a living looked at stile with us. Her
    verdict: the Docker daemon runs as root, anybody in the docker group is
    root on the machine, and an app that strangers talk to all day should
    have nothing to do with root. "Run it rootless, under its own account."

    Ayasha already created the account, trailbook (sudo useradd --system
    --create-home --home-dir /var/lib/trailbook --shell /bin/bash
    trailbook), and installed Debian's podman. She had to leave for work
    before going further.

    What we need before Saturday's sign-ups:
      - Trailbook running again with rootless Podman, as trailbook;
      - the site answering through nginx, as before;
      - our data kept: /srv/trailbook/data/trailbook.db (412 walks, 1873
        sign-ups since 2031).

    Bolat's notes are in your home directory. Your sudo password:
    switchback-27.

    Soo-ah

no-root-needed-notes-bolat =
    Notes from Bolat (stile, 2031)

    - Trailbook is a single image: registry.example/openpaths/trailbook:2.3.
      It keeps everything in one SQLite file, /data/trailbook.db, and listens
      on 8080 inside the container.
    - I started it like this, once (it restarts by itself):
        sudo docker run -d --name trailbook --restart=always -p 8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
    - nginx (/etc/nginx/sites-enabled/walks) takes 80 and 443 and passes
      everything to 127.0.0.1:8080.
    - The image doesn't run as root: it has its own user, trailbook, uid 1000
      in the image. Funny thing: on the machine, the files in
      /srv/trailbook/data belong to { $you }. I never understood why.

## Events

no-root-needed-event-single-mapping =
    podman found no subordinate ids for trailbook in /etc/subuid (or
    /etc/subgid). Without them, the user namespace it builds holds a single
    id: trailbook itself, which is root inside. But an image is a tree of
    files owned by many ids (here /etc/gshadow belongs to the group shadow,
    42), and none of them can exist in a namespace of one id.

    Accounts made by adduser or useradd get a range of 65536 subordinate ids;
    system accounts (useradd --system) don't. Look at /etc/subuid and
    /etc/subgid, then at man subuid and man usermod.
no-root-needed-event-overlap =
    trailbook's range overlaps another account's in /etc/subuid or
    /etc/subgid. Two accounts whose containers share host ids can read and
    write each other's files: each range must be its own. Take the first free
    block after the last range of the file.
no-root-needed-event-ranges =
    trailbook now has its own range of subordinate uids and gids: in its
    namespace, 0 is trailbook, and 1 to 65536 are the range you gave it.
    Podman keeps a namespace per account (its pause process), built before
    you changed the files: if it still complains, its error message says
    what to run.
no-root-needed-event-stale-namespace =
    /etc/subuid and /etc/subgid are right, and yet podman still sees a single
    id: trailbook's namespace was built before, and podman keeps it until it
    is told the configuration changed. Read the end of the error message
    (and man podman-system-migrate).
no-root-needed-event-pulled =
    The image is in trailbook's own storage, under
    /var/lib/trailbook/.local/share/containers. Root's podman doesn't see it,
    and trailbook's containers can't see root's: compare podman images as
    trailbook and with sudo.
no-root-needed-event-sudo-podman =
    sudo podman runs Podman as root: rootful, with root's images and
    containers, no user namespace, and the container's processes are the
    host's ids again; root is back, the very thing we are leaving. Rootless
    means running podman as trailbook itself (sudo -iu trailbook, or sudo -u
    trailbook podman …). Remove what root started (sudo podman rm -f NAME).
no-root-needed-event-port-80 =
    An ordinary process can't listen on a port below
    net.ipv4.ip_unprivileged_port_start (1024 by default), and pasta, which
    publishes the ports of trailbook's containers, is one. And 80 is taken
    anyway: nginx listens on 80 and 443 and already passes the site to
    127.0.0.1:8080 (/etc/nginx/sites-enabled/walks).

    Publish the container on 8080, on 127.0.0.1 if only nginx needs it, and
    leave the front door to nginx. A container that couldn't start is still
    there under its name (podman ps -a).
no-root-needed-event-lowered =
    net.ipv4.ip_unprivileged_port_start is now below 1024 (or will be at the
    next boot, from /etc/sysctl.d). It isn't a setting for one account: any
    program of any user may then take 22, 80 or 443. Let sshd or nginx stop
    for a minute, and anybody's process can answer in their place. The
    reverse proxy you already have is the safer door: put the value back to
    1024 (sysctl -w, and remove the file you added).
no-root-needed-event-chown-refused =
    :U asks podman to give the folder to the container's user, but podman
    does it from inside trailbook's namespace, as the namespace's root: it can
    only change files whose owner the namespace maps (trailbook and its
    subordinate ids). These files belong to somebody else on the host. Who
    (ls -ln /srv/trailbook/data)? Root can give them to trailbook first.
no-root-needed-event-cant-write =
    The app stopped at once: "unable to open database file: permission
    denied". Inside, Trailbook runs as uid 1000, the image's USER. In
    trailbook's namespace, that uid isn't the host's 1000: the namespace's 1
    is the first id of the range, so its 1000 is the first id + 999. On the
    host, the data belongs to uid 1000, because under Docker (no user
    namespace) the container's 1000 WAS the host's 1000.

    Compare podman unshare cat /proc/self/uid_map, podman unshare ls -ln
    /srv/trailbook/data and ls -ln /srv/trailbook/data. Then let the right
    id own the folder: the volume option U and --userns=keep-id in man
    podman-run, or podman unshare chown.
no-root-needed-event-world-writable =
    chmod 777 (or o+w) on the data lets the container write, and also every
    account on stile and every other container: 1873 sign-ups, with names
    and phone numbers, open to anybody who gets a shell. Put the rights back
    (755 for the folder, 644 for the file) and fix the owner instead.
no-root-needed-event-empty =
    Trailbook runs, but on an empty database ("database created … walks=0"):
    in this container, /data isn't /srv/trailbook/data (a named volume,
    another path, or no -v at all). The club's 412 walks are still in
    /srv/trailbook/data: remove this container and start one with that
    folder mounted.
no-root-needed-event-running =
    Trailbook runs rootless under trailbook, on the club's data. ps aux shows
    its process under a large uid: not root, and not you. Check the site
    through nginx (curl -k https://walks.openpaths.example/), and that
    nothing is left behind.
no-root-needed-event-end =
    Soo-ah: "The sign-ups are open again. And our security friend says:
    much better."

    Well done! You finished No Root Needed.

    WHAT HAPPENED
    Trailbook ran under Docker: a daemon as root, and a container whose uid
    1000 was the host's uid 1000 (which is why you owned the data). You moved
    it to rootless Podman under trailbook. A system account has no
    subordinate ids, so podman could only map trailbook itself, and the
    image's files (group 42 among them) couldn't be unpacked; once the
    account had its own range, and podman system migrate had rebuilt its
    namespace, the image came in. Port 80 is nginx's, and out of reach of an
    ordinary process: the container publishes 8080 and nginx stays in front.
    The app's uid 1000 inside is a subordinate id outside: the data had to
    belong to that id (:U, or podman unshare chown), or the account's own uid
    had to be mapped into the container (--userns=keep-id).

    GOOD PRACTICE
    - One unprivileged account per service, with its own range of
      subordinate ids (usermod --add-subuids, --add-subgids), never shared.
    - Read the mapping before touching rights: podman unshare cat
      /proc/self/uid_map, podman unshare ls -ln, podman top CONTAINER user
      huser.
    - Fix owners, not permissions: chmod 777 opens the data to everyone.
    - Leave the privileged ports to a reverse proxy; don't lower
      net.ipv4.ip_unprivileged_port_start for one app.
    - :Z relabels files for SELinux. On Debian (AppArmor) it changes nothing,
      and never the owners.

    ANOTHER WAY
    --userns=keep-id maps trailbook's own uid into the container: on the
    host, the files stay trailbook's, easier to back up and to read. The app
    then runs with trailbook's uid inside; an image that expects its own
    USER may need keep-id:uid=1000,gid=1000.

    DOCUMENTATION
    - podman-run(1): https://docs.podman.io/en/v5.4.2/markdown/podman-run.1.html
    - podman-unshare(1): https://docs.podman.io/en/v5.4.2/markdown/podman-unshare.1.html
    - Basic setup of rootless Podman: https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md
    - subuid(5): https://man7.org/linux/man-pages/man5/subuid.5.html

## What the story's chapters share: kept here so that they load with the story.

walking-club-readme =
    Trailbook's data (Open Paths).
    trailbook.db: the walks, the walkers and the sign-ups. Copied every night
    to Bolat's NAS.
# The page Trailbook serves (curl shows it as is): { $walks } and { $signups } are numbers.
walking-club-page =
    <!doctype html>
    <html lang="en">
    <title>Open Paths: upcoming walks</title>
    <h1>Open Paths: upcoming walks</h1>
    <p>{ $walks } walks, { $signups } sign-ups.</p>
    <p>Saturday: the Ridge Loop, 14 km, meet at 08:30 at the station.</p>
    </html>
