### Story "The Workshop", chapter 3 "The hole in the firewall":
### Docker and ufw, and the space Docker takes up. Commands, paths and the
### messages of docker, ufw, ss and nc are not translated.

chapitre-contournement = The hole in the firewall
    .resume = The fablab's database open to the world despite ufw: ports published by Docker, then freeing up space without throwing away what matters.

## Files

contournement-message-de-rania =
    A message from Rania, from The Neighbourhood Letters:

    "Hi! Last night I tested the fablab server's ports from home, out of
    curiosity. Surprise: PostgreSQL answers on port 5432, open to the
    whole world. And yet Yasmine showed me her firewall: ufw only allows
    SSH, 8080 and 8081!

    Test it yourself from your workstation (exit to go back to it):
      nc -zv fabrique 5432

    A database open on the internet is an open door for every bot that
    tries passwords…"
contournement-mot-de-yasmine =
    A note from Yasmine:

    "Oops. I had added port 5432 to the database in
    /srv/reservations/compose.yaml to connect to it with pgAdmin from
    my laptop. I thought ufw blocked it.

    And another problem: the server's disk is more than 90% full
    (df -h /). I think it's Docker. Can you free up some space? But
    careful: whatever you do, DO NOT touch the wiki-ancien volume. It holds
    the pages of our old wiki, which we still need to recover. No container
    is using it at the moment.

    For sudo: fablab-2027."

## Events

contournement-evenement-ss =
    docker-proxy listens on 0.0.0.0:5432: Docker is publishing the
    database's port, on every address of the machine. And sudo ufw status
    says nothing about 5432… Docker writes its own rules into iptables,
    which the kernel checks BEFORE ufw's rules: a port published by Docker
    bypasses ufw.
contournement-evenement-ufw-inutile =
    A ufw rule for 5432 changes nothing: packets to a port published by
    Docker are redirected to the container before they reach ufw's rules.
    Test from your workstation: nc -zv fabrique 5432. The solution is in
    compose.yaml: don't publish this port, or publish it only on
    127.0.0.1.
contournement-evenement-ferme =
    Port 5432 no longer answers from outside, and the booking app still
    works: it reaches the database through the project network, without a
    published port. For pgAdmin, Yasmine will go through an SSH tunnel:
    ssh -L 5432:127.0.0.1:5432 fabrique (with the port published on
    127.0.0.1 only), or docker compose exec db psql.
# { $volumes }: the deleted volumes
contournement-evenement-volume-perdu =
    The { $volumes } volume is gone, along with all its data: docker
    volume prune -a deletes every volume no container uses, even if they
    have a name and matter. On a real server, it would be lost. Here, you
    can restart the chapter from the menu. Before a prune: docker system
    df, docker volume ls, and read the warning.
# { $pourcent }: disk usage
contournement-evenement-disque =
    The disk can breathe again: { $pourcent }% used. Images no container
    uses (old versions, forgotten tests, unnamed images) were taking up
    almost all the space.
contournement-evenement-fin =
    The database is no longer visible from the internet, both apps are
    running, the disk has room, and the wiki is still waiting in its
    volume. Rania runs her test again: "Nothing on 5432 any more. Well
    done!"

    Well done! You have finished chapter 3 of The Workshop. (What comes
    next: ssh fabrique, for the fablab's photo gallery.)

    WHAT HAPPENED
    "ports: - "5432:5432"" publishes the port on every address of the
    machine. To do this, Docker writes its own iptables rules (nat table,
    DOCKER chain), which the kernel applies before ufw's rules: the
    firewall shown by ufw status never sees these packets. And Docker
    keeps everything it has downloaded, until you clean up.

    GOOD PRACTICE
    - Only publish what must be public; between containers, the project
      network is enough.
    - A port just for yourself: "127.0.0.1:5432:5432", and an SSH tunnel.
    - Test from outside (nc -zv, nmap), never just ufw status.
    - docker system df to see the space used; docker image prune -a and
      docker container prune to reclaim it.
    - docker volume prune -a also deletes unused named volumes: check
      first, or never use it on a server.

    DOCUMENTATION
    - Docker and ufw: https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw
    - Publishing a port: https://docs.docker.com/engine/network/#published-ports
    - Cleaning up: https://docs.docker.com/engine/manage-resources/pruning/
