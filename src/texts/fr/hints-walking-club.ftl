### Indices gradués du Club de marche (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Pas besoin de root

hint-no-root-needed-single-mapping =
    .lead = Travaille sous trailbook, pas en root, et laisse podman te dire ce qui lui manque : télécharge l'image nommée dans les notes de Bolat.
    .solution = sudo -iu trailbook, puis podman pull registry.example/openpaths/trailbook:2.3 ; puis cat /etc/subuid /etc/subgid
hint-no-root-needed-ranges =
    .lead = Donne à trailbook son propre bloc de 65536 uid et gid subordonnés, après le dernier bloc de /etc/subuid et /etc/subgid (man usermod).
    .solution = sudo usermod --add-subuids 296608-362143 --add-subgids 296608-362143 trailbook
hint-no-root-needed-stale-namespace =
    .lead = Podman garde l'ancien espace de noms du compte : la fin de son message d'erreur nomme la commande qui le reconstruit.
    .solution = sous trailbook : podman system migrate, puis podman pull de nouveau
hint-no-root-needed-pulled =
    .lead = L'image dans le stockage de trailbook, lance le conteneur comme Bolat, mais pense au port : qui écoute déjà sur 80 ?
    .solution = sous trailbook : podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
hint-no-root-needed-port-80 =
    .lead = nginx tient 80 et 443 et passe le site à 127.0.0.1:8080 (/etc/nginx/sites-enabled/walks) : publie le conteneur là.
    .solution = podman rm trailbook ; podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
hint-no-root-needed-cant-write =
    .lead = Compare qui possède les données sur l'hôte, et dans l'espace de noms de trailbook (podman unshare). Puis donne les données au bon propriétaire (man podman-run : l'option de volume U).
    .solution = sudo chown -R trailbook:trailbook /srv/trailbook/data ; sous trailbook : podman rm trailbook ; podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data:U registry.example/openpaths/trailbook:2.3
hint-no-root-needed-running =
    .lead = Vérifie le site comme les visiteur·ses l'atteignent, à travers nginx, et qu'aucun conteneur root ni droit ouvert ne traîne.
    .solution = curl -k https://walks.openpaths.example/ ; sudo podman ps -a ; ls -l /srv/trailbook/data
hint-no-root-needed-end =
    .lead = Tout est en place ? Les plages propres à trailbook, son conteneur qui sert /srv/trailbook/data sur 8080, le site à travers nginx, rien en root, pas de 777, les réglages de ports intacts.
    .solution = cat /etc/subuid ; sudo -u trailbook podman ps ; curl -k https://walks.openpaths.example/ ; sysctl net.ipv4.ip_unprivileged_port_start

## Chapitre 2 — Déconnexion

hint-logged-out-logout =
    .lead = Que s'est-il passé hier à 18:02 ? Le journal de cette heure-là : la session ssh, logind, et le gestionnaire de services de trailbook.
    .solution = sudo journalctl --since "2033-04-13 18:00" --until "2033-04-13 18:05"
hint-logged-out-quadlet =
    .lead = Décris le conteneur dans un fichier Quadlet du dossier de trailbook (man podman-systemd.unit : [Container], Image=, PublishPort=, Volume=, et une section [Install]).
    .solution = sudo -iu trailbook ; nano ~/.config/containers/systemd/trailbook.container : [Container] Image=registry.example/openpaths/trailbook:2.3 PublishPort=127.0.0.1:8080:8080 Volume=/srv/trailbook/data:/data:U [Install] WantedBy=default.target
hint-logged-out-linger =
    .lead = Le gestionnaire de trailbook doit tourner sans personne de connecté, dès le démarrage (man loginctl).
    .solution = sudo loginctl enable-linger trailbook
hint-logged-out-no-bus =
    .lead = systemctl --user trouve le gestionnaire par $XDG_RUNTIME_DIR, que sudo ne définit pas ; ou demande depuis root avec -M.
    .solution = sous trailbook : export XDG_RUNTIME_DIR=/run/user/$(id -u) ; systemctl --user daemon-reload ; systemctl --user start trailbook
hint-logged-out-unit-running =
    .lead = Maintenant la preuve qu'Ayasha a demandée : redémarre echalier, reconnecte-toi, vérifie le site.
    .solution = sudo reboot ; ssh echalier ; curl -k https://walks.openpaths.example/
hint-logged-out-rebooted =
    .lead = Qu'a fait le gestionnaire de trailbook au démarrage ? Son journal, la persistance du compte, la section [Install] de l'unité.
    .solution = sudo journalctl -u user@997 -b ; loginctl show-user trailbook -p Linger ; sudo cat /var/lib/trailbook/.config/containers/systemd/trailbook.container
hint-logged-out-end =
    .lead = Tout est en place ? trailbook qui persiste, son unité Quadlet voulue par default.target, démarrée par le gestionnaire à ce démarrage-ci, le site qui répond.
    .solution = loginctl list-users ; sudo systemctl --user -M trailbook@ status trailbook ; curl -k https://walks.openpaths.example/
