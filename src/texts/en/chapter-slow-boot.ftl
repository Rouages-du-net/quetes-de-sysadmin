### Story "The Canteen", chapter 3 "The Slow Boot": network-online.target,
### systemd-networkd-wait-online, systemd-analyze. Unit names, paths and
### systemd's messages are not translated.

chapter-slow-boot = The Slow Boot
    .summary = Since the second network card, the server takes two minutes to come back after a reboot. Find out who it is waiting for.

## Files

slow-boot-message-ibrahim =
    From:     Ibrahim
    To:       you
    Subject:  Two minutes of 502

    Hello,

    I added a second network card to the server, eth1, for the backup
    line the town hall is going to give us (it isn't wired yet). I
    configured it already, /etc/systemd/network/20-eth1.network, to be
    ready on the day.

    Since then, every reboot takes forever: more than two minutes before
    the site comes back, and in the meantime the volunteers get "502 Bad
    Gateway". In the end everything works, but two minutes at lunch time
    is long.

    Can you find out what the server waits for, and make it boot quickly
    again? The backup line will come one day: its configuration must not
    be lost for good. You can reboot (sudo reboot), password
    lentils-2028.

    Ibrahim

## Events

slow-boot-event-blame =
    systemd-networkd-wait-online.service: more than two minutes, almost the
    whole boot. Its job is to wait until the network is "online", so that
    network-online.target is reached; nginx and the app wait for that
    target (systemd-analyze critical-chain). What is it waiting for?
    networkctl lists the links and their state.
slow-boot-event-no-carrier =
    eth1: no-carrier. The card has a configuration (20-eth1.network), so
    wait-online waits for it to be online… but no cable, no network: after
    two minutes it gives up, and the boot carries on. Tell it not to wait
    for this link (man systemd.network: RequiredForOnline=), or what to wait
    for (man systemd-networkd-wait-online: --any, --interface=).
slow-boot-event-menu-only =
    Still slow: the app no longer waits for the network, but nginx does
    (its unit, After=network-online.target). As long as wait-online waits
    for eth1, everything that needs the network waits with it
    (systemd-analyze critical-chain).
slow-boot-event-disabled =
    Without wait-online, network-online.target is reached at once: fast
    indeed. On this server it's acceptable (the services listen locally or
    on eth0, which comes up in a second), but the target no longer means
    "the network works". The finer fix keeps wait-online and tells it what
    to wait for.
slow-boot-event-end =
    The server is up in a few seconds after a reboot, and the site answers
    straight away. Ibrahim: "And when the backup line is wired, eth1 will
    come up by itself?" Yes: its configuration is still there.

    Well done! You have finished the chapter "The Slow Boot".

    WHAT HAPPENED
    nginx (Debian's unit) and the app wait for network-online.target.
    That target is reached when systemd-networkd-wait-online is done, and
    wait-online waits for every link that has a configuration
    (.network file) to be online. eth1 had one, but no cable: wait-online
    waited two minutes, gave up, and only then did nginx and the app start.

    THE TOOLS OF A SLOW BOOT
    - systemd-analyze time: how long the kernel and userspace took.
    - systemd-analyze blame: each unit, by the time it took to start.
    - systemd-analyze critical-chain: the chain of units that delayed the
      end of the boot (@ when it started, + how long it took).
    - systemctl list-dependencies --after nginx: what a unit waits for.
    - networkctl: the links, and how far each one got.

    GOOD PRACTICE
    - A link that may be absent: RequiredForOnline=no in its .network
      file ([Link] section); it comes up by itself when it is wired.
    - Or tell wait-online what "online" means here: a drop-in with
      ExecStart= then ExecStart=/usr/lib/systemd/systemd-networkd-wait-online --any
      (or --interface=eth0).
    - After=network-online.target only where it is needed (a service that
      connects to another machine at start); a service that listens doesn't
      need it.

    DOCUMENTATION
    - Running services after the network is up: https://systemd.io/NETWORK_ONLINE/
    - systemd-networkd-wait-online: https://www.freedesktop.org/software/systemd/man/latest/systemd-networkd-wait-online.service.html
    - RequiredForOnline=: https://www.freedesktop.org/software/systemd/man/latest/systemd.network.html#RequiredForOnline=
    - systemd-analyze: https://www.freedesktop.org/software/systemd/man/latest/systemd-analyze.html
