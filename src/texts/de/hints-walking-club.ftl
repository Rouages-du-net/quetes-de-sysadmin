### Abgestufte Hinweise für „Der Wanderverein“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Ganz ohne root

hint-no-root-needed-single-mapping =
    .lead = Arbeite als trailbook, nicht als root, und lass podman dir sagen, was ihm fehlt: Hol das Image, das in Bolats Notizen steht.
    .solution = sudo -iu trailbook, dann podman pull registry.example/openpaths/trailbook:2.3; dann cat /etc/subuid /etc/subgid
hint-no-root-needed-ranges =
    .lead = Gib trailbook einen eigenen Block von 65536 untergeordneten UIDs und GIDs, nach dem letzten Block von /etc/subuid und /etc/subgid (man usermod).
    .solution = sudo usermod --add-subuids 296608-362143 --add-subgids 296608-362143 trailbook
hint-no-root-needed-stale-namespace =
    .lead = Podman behält den alten Namespace des Kontos: Das Ende seiner Fehlermeldung nennt den Befehl, der ihn neu baut.
    .solution = als trailbook: podman system migrate, dann noch einmal podman pull
hint-no-root-needed-pulled =
    .lead = Mit dem Image im Speicher von trailbook starte den Container wie Bolat, aber denk an den Port: Wer lauscht schon auf 80?
    .solution = als trailbook: podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
hint-no-root-needed-port-80 =
    .lead = nginx gehören 80 und 443, und es reicht die Website an 127.0.0.1:8080 weiter (/etc/nginx/sites-enabled/walks): Veröffentliche den Container dort.
    .solution = podman rm trailbook; podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
hint-no-root-needed-cant-write =
    .lead = Vergleiche, wem die Daten auf dem Host gehören, und im Namespace von trailbook (podman unshare). Dann gib die Daten dem richtigen Besitzer (man podman-run: die Volume-Option U).
    .solution = sudo chown -R trailbook:trailbook /srv/trailbook/data; als trailbook: podman rm trailbook; podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data:U registry.example/openpaths/trailbook:2.3
hint-no-root-needed-running =
    .lead = Prüf die Website so, wie Besucher·innen sie erreichen, über nginx, und dass kein root-Container und keine offenen Rechte zurückgeblieben sind.
    .solution = curl -k https://walks.openpaths.example/; sudo podman ps -a; ls -l /srv/trailbook/data
hint-no-root-needed-end =
    .lead = Alles an seinem Platz? Die eigenen Bereiche von trailbook, sein Container liefert /srv/trailbook/data auf 8080 aus, die Website über nginx, nichts als root, kein 777, die Port-Einstellungen unangetastet.
    .solution = cat /etc/subuid; sudo -u trailbook podman ps; curl -k https://walks.openpaths.example/; sysctl net.ipv4.ip_unprivileged_port_start

## Kapitel 2 — Abgemeldet

hint-logged-out-logout =
    .lead = Was ist gestern um 18:02 passiert? Das Journal dieser Stunde: die ssh-Sitzung, logind und der Dienstmanager von trailbook.
    .solution = sudo journalctl --since "2033-04-13 18:00" --until "2033-04-13 18:05"
hint-logged-out-quadlet =
    .lead = Beschreib den Container in einer Quadlet-Datei im Home-Verzeichnis von trailbook (man podman-systemd.unit: [Container], Image=, PublishPort=, Volume=, und ein [Install]-Abschnitt).
    .solution = sudo -iu trailbook; nano ~/.config/containers/systemd/trailbook.container: [Container] Image=registry.example/openpaths/trailbook:2.3 PublishPort=127.0.0.1:8080:8080 Volume=/srv/trailbook/data:/data:U [Install] WantedBy=default.target
hint-logged-out-linger =
    .lead = Der Manager von trailbook muss laufen, ohne dass jemand angemeldet ist, ab dem Booten (man loginctl).
    .solution = sudo loginctl enable-linger trailbook
hint-logged-out-no-bus =
    .lead = systemctl --user findet den Manager über $XDG_RUNTIME_DIR, das sudo nicht setzt; oder frag von root aus mit -M.
    .solution = als trailbook: export XDG_RUNTIME_DIR=/run/user/$(id -u); systemctl --user daemon-reload; systemctl --user start trailbook
hint-logged-out-unit-running =
    .lead = Jetzt der Beweis, um den Ayasha gebeten hat: Starte zaunstieg neu, verbinde dich wieder, prüf die Website.
    .solution = sudo reboot; ssh zaunstieg; curl -k https://walks.openpaths.example/
hint-logged-out-rebooted =
    .lead = Was hat der Manager von trailbook beim Booten gemacht? Sein Journal, das Linger des Kontos, der [Install]-Abschnitt der Unit.
    .solution = sudo journalctl -u user@997 -b; loginctl show-user trailbook -p Linger; sudo cat /var/lib/trailbook/.config/containers/systemd/trailbook.container
hint-logged-out-end =
    .lead = Alles an seinem Platz? trailbook lingert, seine Quadlet-Unit ist von default.target gewollt, beim aktuellen Booten vom Manager gestartet, die Website antwortet.
    .solution = loginctl list-users; sudo systemctl --user -M trailbook@ status trailbook; curl -k https://walks.openpaths.example/
