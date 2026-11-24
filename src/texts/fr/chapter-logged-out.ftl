### Histoire « Le Club de marche », chapitre « Déconnexion » : un conteneur
### sans root mort avec la session de son utilisatrice. Le gestionnaire de
### services du compte (user@UID.service), la persistance (loginctl
### enable-linger), Quadlet (fichiers .container, systemctl --user), et un
### redémarrage pour le prouver. Les commandes, options, chemins et sorties
### ne se traduisent pas.

chapter-logged-out = Déconnexion
    .summary = L'application du club tournait sans root, jusqu'à ce que la bénévole qui l'avait lancée se déconnecte : le site est tombé avec sa session. Fais-en un service de son propre compte, qui n'a besoin de personne de connecté, et qui survit à un redémarrage.

## Fichiers

logged-out-message-ayasha =
    De : Ayasha
    Mercredi 14 avril, 09:05

    Salut !

    Merci pour lundi ! Hier après-midi, j'ai voulu essayer moi-même. Je me
    suis connectée en trailbook depuis mon PC (ssh trailbook@echalier : ma clé
    est dans ses authorized_keys), j'ai supprimé ton conteneur et lancé le
    mien, la même commande, avec le nom trailbook. Le site marchait. Je me
    suis déconnectée à 18:02, et à 18:02 le site est tombé : nginx répond
    502 depuis.

    Alors le conteneur ne vit que tant que quelqu'un est connecté en
    trailbook ? Ça ne peut pas être comme ça qu'on fait tourner des
    services. Il nous faut :
      - Trailbook en marche sans personne de connecté ;
      - et qui revient tout seul après un redémarrage. La mise à jour du
        noyau en attend un de toute façon (/var/run/reboot-required) :
        redémarre echalier quand tu as fini, qu'on en ait le cœur net.

    Les gens de Podman semblent recommander un truc appelé Quadlet. Je ne
    suis pas allée plus loin que le nom.

    Ton mot de passe sudo n'a pas changé : lacet-27.

    Ayasha

## Événements

logged-out-event-logout =
    La voilà, à 18:02 : la session d'Ayasha se ferme, et logind arrête
    user@997.service, le gestionnaire de services propre à trailbook, avec
    tout ce qu'il contient. Un conteneur sans root lancé depuis une session
    vit dans ce gestionnaire (podman met son conmon dans un scope en
    dessous). Quand la dernière session du compte se termine, le
    gestionnaire ne reste que si le compte persiste (man loginctl). Et même
    alors : qui relancerait le conteneur après un redémarrage ?
logged-out-event-nohup =
    nohup protège seulement un processus du signal de raccrochage quand son
    terminal se ferme. Ce n'est pas ce qui a arrêté Trailbook : logind a
    arrêté le gestionnaire de trailbook, et tout son cgroup avec lui. Et
    après un redémarrage, rien ne relance le conteneur. Un conteneur qui
    doit rester debout est un service : la manière de Podman, c'est Quadlet
    (man podman-systemd.unit).
logged-out-event-root-unit =
    Une unité système qui lance podman pour trailbook (sudo -u, ou User=)
    remet le lanceur root en place, et elle se bat avec Podman : pas de
    session utilisateur, donc pas de gestionnaire de cgroups systemd (les
    avertissements), conmon hors de vue de l'unité, pas d'arrêt propre.
    Laisse le gestionnaire propre à trailbook le lancer : un fichier Quadlet
    dans son dossier, et le compte qui persiste. Puis retire cette unité
    (systemctl disable --now, puis le fichier).
logged-out-event-generate =
    podman generate systemd marche encore, mais il est déprécié (il le dit) :
    il écrit une unité pour un conteneur qui doit déjà exister. Podman 5
    recommande Quadlet : tu décris le conteneur dans un fichier .container,
    et le générateur de systemd écrit l'unité à chaque daemon-reload.
logged-out-event-quadlet-error =
    Quadlet a refusé le fichier : son message nomme la clé et le groupe. Les
    clés de [Container] sont toutes dans man podman-systemd.unit, et tu peux
    tester le fichier sans systemd : /usr/libexec/podman/quadlet -dryrun
    -user (sous trailbook).
logged-out-event-quadlet =
    Le gestionnaire de trailbook a généré un service à partir du
    fichier .container (systemctl --user cat le montre : podman run avec
    --replace, --rm et --sdnotify=conmon, sous le nom de l'unité). Est-il
    démarré ? Et démarrera-t-il avec le gestionnaire au démarrage ? C'est à
    ça que sert une section [Install] avec WantedBy=default.target dans le
    fichier .container.
logged-out-event-no-bus =
    systemctl --user parle au gestionnaire du compte par son bus, trouvé
    grâce à $XDG_RUNTIME_DIR, qu'une connexion définit (pam_systemd) et que
    sudo ne définit pas. Donne-le (export XDG_RUNTIME_DIR=/run/user/$(id -u))
    une fois le gestionnaire en marche, ou demande depuis ton propre compte :
    sudo systemctl --user -M trailbook@ …. Et il faut que le gestionnaire
    tourne : sans session, seule la persistance le garde.
logged-out-event-generated =
    Une unité que Quadlet génère ne s'active pas : il n'y a pas de fichier à
    lier, elle est réécrite à chaque daemon-reload. Sa section [Install] va
    dans le fichier .container : avec WantedBy=default.target, le générateur
    la fait démarrer par le gestionnaire chaque fois qu'il démarre.
logged-out-event-linger =
    trailbook persiste : son gestionnaire (user@997.service) démarre avec la
    machine et reste sans aucune session (/var/lib/systemd/linger/trailbook).
    Il faut maintenant que le conteneur soit une de ses unités.
logged-out-event-not-wanted =
    L'unité tourne, mais rien ne la démarrera au prochain démarrage : son
    fichier .container n'a pas de section [Install] avec
    WantedBy=default.target.
logged-out-event-unit-running =
    Trailbook tourne comme un service du gestionnaire de trailbook. Ayasha a
    demandé la preuve : redémarre echalier (le noyau l'attend), reconnecte-toi
    et vérifie le site.
logged-out-event-rebooted =
    echalier a redémarré, et le site ne répond pas. Regarde ce qui est revenu :
    le gestionnaire de trailbook tourne-t-il (systemctl status user@997),
    a-t-il démarré l'unité (journalctl -u user@997 -b), le compte
    persiste-t-il, l'unité est-elle voulue par default.target ?
logged-out-event-end =
    Ayasha : « Je me suis connectée, déconnectée, et les sorties étaient
    toujours là. Puis le redémarrage, et toujours là. Samedi peut venir ! »

    Bravo ! Tu as terminé Déconnexion.

    CE QUI S'EST PASSÉ
    Ayasha avait lancé Trailbook depuis une session ssh en trailbook : podman
    a mis le conteneur dans le gestionnaire de services du compte,
    user@997.service, que logind a démarré avec sa session et arrêté avec
    elle, conteneur compris. Tu as décrit le conteneur dans un fichier
    Quadlet, ~/.config/containers/systemd/trailbook.container ; à chaque
    daemon-reload, et chaque fois que le gestionnaire démarre, le générateur
    de Podman en fait trailbook.service. Avec WantedBy=default.target dans
    sa section [Install], le gestionnaire le démarre tout seul. loginctl
    enable-linger trailbook fait démarrer le gestionnaire par logind avec la
    machine et le garde sans aucune session. Le redémarrage a prouvé toute la
    chaîne.

    LA BONNE PRATIQUE
    - Un service sans root est une unité utilisateur de son compte :
      Quadlet, une section [Install], et le compte qui persiste.
    - Parler au gestionnaire d'un compte avec une vraie session,
      $XDG_RUNTIME_DIR défini, ou depuis root avec systemctl --user -M
      COMPTE@.
    - Son journal est dans celui du système (comptes système) : journalctl
      -u user@997, ou journalctl --user-unit trailbook.
    - Tester un fichier .container avec /usr/libexec/podman/quadlet -dryrun
      -user.
    - Le prouver : un redémarrage qu'on choisit vaut mieux qu'une coupure
      qu'on subit.

    UNE AUTRE VOIE
    Une unité utilisateur écrite à la main (~/.config/systemd/user/) peut
    aussi lancer podman, et podman generate systemd en écrivait une ; les
    deux sont plus difficiles à bien faire (le nettoyage du conteneur, le
    type notify) et Podman 5 déprécie le second. Quadlet écrit ces détails
    pour toi.

    LA DOCUMENTATION
    - podman-systemd.unit(5) : https://docs.podman.io/en/v5.4.2/markdown/podman-systemd.unit.5.html
    - loginctl(1), enable-linger : https://www.freedesktop.org/software/systemd/man/latest/loginctl.html
    - logind.conf(5), KillUserProcesses et UserStopDelaySec : https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
    - systemctl(1), --user et --machine : https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
