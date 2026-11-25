### Story "The Walking Club", chapter "Logged Out": a rootless container
### that died with its user's session. The user's service manager
### (user@UID.service), lingering (loginctl enable-linger), Quadlet
### (.container files, systemctl --user), and a reboot to prove it.
### Commands, options, paths and outputs are not translated.

chapter-logged-out = Logged Out
    .summary = The club's app ran rootless, until the volunteer who started it logged out: the site went down with her session. Make it a service of its own account that needs nobody logged in, and survives a reboot.

## Files

logged-out-message-ayasha =
    From: Ayasha
    Wednesday 14 April, 09:05

    Hi!

    Thank you for Monday! Yesterday afternoon I wanted to try it myself. I
    logged in as trailbook from my PC (ssh trailbook@stile: my key is in its
    authorized_keys), removed your container and started mine, the same
    command, with the name trailbook. The site worked. I logged out at
    18:02, and at 18:02 the site went down: nginx has answered 502 ever
    since.

    So the container only lives while somebody is logged in as trailbook?
    That can't be how people run services. We need:
      - Trailbook running with nobody logged in;
      - and coming back by itself after a reboot. The kernel update is
        waiting for one anyway (/var/run/reboot-required): please reboot
        stile once you're done, so that we know.

    The Podman people seem to recommend something called Quadlet. I didn't
    get further than the name.

    Your sudo password hasn't changed: switchback-27.

    Ayasha

## Events

logged-out-event-logout =
    There it is, at 18:02: Ayasha's session closes, and logind stops
    user@997.service, trailbook's own service manager, with everything in it.
    A rootless container started from a session lives in that manager (podman
    puts its conmon in a scope under it). When the account's last session
    ends, the manager stays only if the account lingers (man loginctl). And
    even then: who would start the container again after a reboot?
logged-out-event-nohup =
    nohup only shields a process from the hangup signal when its terminal
    closes. That isn't what stopped Trailbook: logind stopped trailbook's
    manager, and everything in its cgroup with it. And after a reboot nothing
    starts the container again. A container that must stay up is a service:
    Podman's way is Quadlet (man podman-systemd.unit).
logged-out-event-root-unit =
    A system unit that runs podman for trailbook (sudo -u, or User=) puts the
    root launcher back, and it fights Podman: no user session, so no systemd
    cgroup manager (the warnings), conmon out of the unit's sight, no clean
    stop. Let trailbook's own manager run it: a Quadlet file in its home, and
    the account lingering. Then remove this unit (systemctl disable --now,
    then the file).
logged-out-event-generate =
    podman generate systemd still works, but it is deprecated (it says so):
    it writes a unit for a container that must already exist. Podman 5
    recommends Quadlet: you describe the container in a .container file, and
    systemd's generator writes the unit at each daemon-reload.
logged-out-event-quadlet-error =
    Quadlet refused the file: its message names the key and the group. The
    keys of [Container] are all in man podman-systemd.unit, and you can test
    the file without systemd: /usr/libexec/podman/quadlet -dryrun -user (as
    trailbook).
logged-out-event-quadlet =
    trailbook's manager generated a service from the .container file
    (systemctl --user cat shows it: podman run with --replace, --rm and
    --sdnotify=conmon, under the unit's name). Is it started? And will it
    start with the manager at boot? That's what an [Install] section with
    WantedBy=default.target in the .container file is for.
logged-out-event-no-bus =
    systemctl --user talks to the account's manager through its bus, found
    with $XDG_RUNTIME_DIR, which a login sets (pam_systemd) and sudo doesn't.
    Give it (export XDG_RUNTIME_DIR=/run/user/$(id -u)) once the manager
    runs, or ask from your own account: sudo systemctl --user -M trailbook@ ….
    And the manager must run: with no session, only lingering keeps it.
logged-out-event-generated =
    A unit Quadlet generates can't be enabled: there is no file to link, it
    is written again at each daemon-reload. Its [Install] section belongs in
    the .container file: with WantedBy=default.target, the generator makes the
    manager start it whenever the manager starts.
logged-out-event-linger =
    trailbook lingers: its manager (user@997.service) starts at boot and
    stays without any session (/var/lib/systemd/linger/trailbook). Now the
    container must be one of its units.
logged-out-event-not-wanted =
    The unit runs, but nothing will start it at the next boot: its .container
    file has no [Install] section with WantedBy=default.target.
logged-out-event-unit-running =
    Trailbook runs as a service of trailbook's manager. Ayasha asked for the
    proof: reboot stile (the kernel is waiting for it), connect again and
    check the site.
logged-out-event-rebooted =
    stile rebooted, and the site doesn't answer. Look at what came back: does
    trailbook's manager run (systemctl status user@997), did it start the
    unit (journalctl -u user@997 -b), does the account linger, is the unit
    wanted by default.target?
logged-out-event-end =
    Ayasha: "I logged in, logged out, and the walks were still there. Then
    the reboot, and still there. Saturday can come!"

    Well done! You finished Logged Out.

    WHAT HAPPENED
    Ayasha started Trailbook from an ssh session as trailbook: podman put the
    container in the account's service manager, user@997.service, which
    logind started with her session and stopped with it, container included.
    You described the container in a Quadlet file,
    ~/.config/containers/systemd/trailbook.container; at daemon-reload, and
    whenever the manager starts, Podman's generator turns it into
    trailbook.service. With WantedBy=default.target in its [Install] section,
    the manager starts it by itself. loginctl enable-linger trailbook makes
    logind start the manager at boot and keep it without any session. The
    reboot proved the whole chain.

    GOOD PRACTICE
    - A rootless service is a user unit of its account: Quadlet, an [Install]
      section, and the account lingering.
    - Talk to a user's manager with a real session, $XDG_RUNTIME_DIR set, or
      from root with systemctl --user -M ACCOUNT@.
    - Its journal is in the system's (system accounts): journalctl -u
      user@997, or journalctl --user-unit trailbook.
    - Test a .container file with /usr/libexec/podman/quadlet -dryrun -user.
    - Prove it: a reboot you chose beats a power cut you didn't.

    ANOTHER WAY
    A hand-written user unit (~/.config/systemd/user/) can run podman too, and
    podman generate systemd used to write one; both are harder to get right
    (the container's cleanup, the notify type) and Podman 5 deprecates the
    latter. Quadlet writes those details for you.

    DOCUMENTATION
    - podman-systemd.unit(5): https://docs.podman.io/en/v5.4.2/markdown/podman-systemd.unit.5.html
    - loginctl(1), enable-linger: https://www.freedesktop.org/software/systemd/man/latest/loginctl.html
    - logind.conf(5), KillUserProcesses and UserStopDelaySec: https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
    - systemctl(1), --user and --machine: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
