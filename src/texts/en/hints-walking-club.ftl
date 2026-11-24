### Graded hints for The Walking Club (see src/engine/hints.ts): one
### message per step, hint-<chapter>-<event>, with .lead (a direction,
### without the exact command) and .solution (almost the answer).

## Chapter 1 — No Root Needed

hint-no-root-needed-single-mapping =
    .lead = Work as trailbook, not as root, and let podman tell you what it lacks: pull the image named in Bolat's notes.
    .solution = sudo -iu trailbook, then podman pull registry.example/openpaths/trailbook:2.3; then cat /etc/subuid /etc/subgid
hint-no-root-needed-ranges =
    .lead = Give trailbook its own block of 65536 subordinate uids and gids, after the last block of /etc/subuid and /etc/subgid (man usermod).
    .solution = sudo usermod --add-subuids 296608-362143 --add-subgids 296608-362143 trailbook
hint-no-root-needed-stale-namespace =
    .lead = Podman keeps the account's old namespace: the end of its error message names the command that rebuilds it.
    .solution = as trailbook: podman system migrate, then podman pull again
hint-no-root-needed-pulled =
    .lead = With the image in trailbook's storage, start the container as Bolat did, but think about the port: who listens on 80 already?
    .solution = as trailbook: podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
hint-no-root-needed-port-80 =
    .lead = nginx owns 80 and 443 and passes the site to 127.0.0.1:8080 (/etc/nginx/sites-enabled/walks): publish the container there.
    .solution = podman rm trailbook; podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
hint-no-root-needed-cant-write =
    .lead = Compare who owns the data on the host, and in trailbook's namespace (podman unshare). Then give the data to the right owner (man podman-run: the volume option U).
    .solution = sudo chown -R trailbook:trailbook /srv/trailbook/data; as trailbook: podman rm trailbook; podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data:U registry.example/openpaths/trailbook:2.3
hint-no-root-needed-running =
    .lead = Check the site the way visitors reach it, through nginx, and that no root container or open rights are left behind.
    .solution = curl -k https://walks.openpaths.example/; sudo podman ps -a; ls -l /srv/trailbook/data
hint-no-root-needed-end =
    .lead = Everything in place? trailbook's own ranges, its container serving /srv/trailbook/data on 8080, the site through nginx, nothing as root, no 777, port settings untouched.
    .solution = cat /etc/subuid; sudo -u trailbook podman ps; curl -k https://walks.openpaths.example/; sysctl net.ipv4.ip_unprivileged_port_start

## Chapter 2 — Logged Out

hint-logged-out-logout =
    .lead = What happened at 18:02 yesterday? The journal of that hour: the ssh session, logind, and trailbook's service manager.
    .solution = sudo journalctl --since "2033-04-13 18:00" --until "2033-04-13 18:05"
hint-logged-out-quadlet =
    .lead = Describe the container in a Quadlet file in trailbook's home (man podman-systemd.unit: [Container], Image=, PublishPort=, Volume=, and an [Install] section).
    .solution = sudo -iu trailbook; nano ~/.config/containers/systemd/trailbook.container: [Container] Image=registry.example/openpaths/trailbook:2.3 PublishPort=127.0.0.1:8080:8080 Volume=/srv/trailbook/data:/data:U [Install] WantedBy=default.target
hint-logged-out-linger =
    .lead = trailbook's manager must run with nobody logged in, from boot on (man loginctl).
    .solution = sudo loginctl enable-linger trailbook
hint-logged-out-no-bus =
    .lead = systemctl --user finds the manager through $XDG_RUNTIME_DIR, which sudo doesn't set; or ask from root with -M.
    .solution = as trailbook: export XDG_RUNTIME_DIR=/run/user/$(id -u); systemctl --user daemon-reload; systemctl --user start trailbook
hint-logged-out-unit-running =
    .lead = Now the proof Ayasha asked for: reboot cairn, connect again, check the site.
    .solution = sudo reboot; ssh cairn; curl -k https://walks.openpaths.example/
hint-logged-out-rebooted =
    .lead = What did trailbook's manager do at boot? Its journal, the account's linger, the unit's [Install] section.
    .solution = sudo journalctl -u user@997 -b; loginctl show-user trailbook -p Linger; sudo cat /var/lib/trailbook/.config/containers/systemd/trailbook.container
hint-logged-out-end =
    .lead = Everything in place? trailbook lingering, its Quadlet unit wanted by default.target, started by the manager at this boot, the site answering.
    .solution = loginctl list-users; sudo systemctl --user -M trailbook@ status trailbook; curl -k https://walks.openpaths.example/
