### Histoire « Le Club de marche », chapitre « Pas besoin de root » : une
### application web passée de Docker en root à Podman sans root, sous un
### compte de service : identifiants subordonnés (/etc/subuid, /etc/subgid),
### ports non privilégiés, le propriétaire des données vu à travers l'espace
### de noms utilisateur (:U, --userns=keep-id, podman unshare). Les
### commandes, options, chemins et sorties ne se traduisent pas.

chapter-no-root-needed = Pas besoin de root
    .summary = L'application d'inscription d'un club de randonnée tournait dans un conteneur Docker, en root, depuis qu'un bénévole l'avait installée. Passe-la à Podman sans root, sous son propre compte, avec les données du club intactes et le site toujours derrière nginx.

## Fichiers

# { $you } : le compte du joueur ou de la joueuse sur la machine (« vous »).
no-root-needed-message-soo-ah =
    De : Soo-ah (présidente du club de randonnée Sentiers ouverts)
    Lundi 12 avril, 09:20

    Bonjour, et merci de venir nous aider !

    Notre site d'inscription, https://walks.openpaths.example, est arrêté
    depuis ce matin, et c'est voulu : j'ai arrêté Docker.

    Bolat a installé le site en 2031 : Trailbook (l'application qui liste
    nos sorties et prend les inscriptions) tourne dans un conteneur, derrière
    nginx. La semaine dernière, une amie dont la sécurité est le métier a
    regardé echalier avec nous. Son verdict : le démon Docker tourne en root,
    quiconque est dans le groupe docker est root sur la machine, et une
    application à laquelle des inconnu·es parlent toute la journée ne
    devrait avoir aucun rapport avec root. « Faites-la tourner sans root,
    sous son propre compte. »

    Ayasha a déjà créé le compte, trailbook (sudo useradd --system
    --create-home --home-dir /var/lib/trailbook --shell /bin/bash
    trailbook), et installé le podman de Debian. Elle a dû partir au travail
    avant d'aller plus loin.

    Ce qu'il nous faut avant les inscriptions de samedi :
      - Trailbook de nouveau en marche avec Podman sans root, sous
        trailbook ;
      - le site qui répond à travers nginx, comme avant ;
      - nos données gardées : /srv/trailbook/data/trailbook.db (412 sorties,
        1873 inscriptions depuis 2031).

    Les notes de Bolat sont dans ton dossier personnel. Ton mot de passe
    sudo : lacet-27.

    Soo-ah

no-root-needed-notes-bolat =
    Notes de Bolat (echalier, 2031)

    - Trailbook, c'est une seule image :
      registry.example/openpaths/trailbook:2.3. Elle garde tout dans un seul
      fichier SQLite, /data/trailbook.db, et écoute sur 8080 dans le
      conteneur.
    - Je l'ai lancée comme ceci, une fois (elle redémarre toute seule) :
        sudo docker run -d --name trailbook --restart=always -p 8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
    - nginx (/etc/nginx/sites-enabled/walks) prend 80 et 443 et passe tout à
      127.0.0.1:8080.
    - L'image ne tourne pas en root : elle a son propre utilisateur,
      trailbook, uid 1000 dans l'image. Chose curieuse : sur la machine, les
      fichiers de /srv/trailbook/data appartiennent à { $you }. Je n'ai
      jamais compris pourquoi.

## Événements

no-root-needed-event-single-mapping =
    podman n'a trouvé aucun identifiant subordonné pour trailbook dans
    /etc/subuid (ou /etc/subgid). Sans eux, l'espace de noms utilisateur
    qu'il construit ne contient qu'un identifiant : trailbook lui-même, qui
    est root dedans. Or une image est une arborescence de fichiers qui
    appartiennent à de nombreux identifiants (ici /etc/gshadow appartient au
    groupe shadow, 42), et aucun ne peut exister dans un espace d'un seul
    identifiant.

    Les comptes créés par adduser ou useradd reçoivent une plage de 65536
    identifiants subordonnés ; les comptes système (useradd --system), non.
    Regarde /etc/subuid et /etc/subgid, puis man subuid et man usermod.
no-root-needed-event-overlap =
    La plage de trailbook chevauche celle d'un autre compte dans /etc/subuid
    ou /etc/subgid. Deux comptes dont les conteneurs partagent des
    identifiants de l'hôte peuvent lire et écrire les fichiers l'un de
    l'autre : chaque plage doit être à soi. Prends le premier bloc libre
    après la dernière plage du fichier.
no-root-needed-event-ranges =
    trailbook a maintenant sa propre plage d'uid et de gid subordonnés :
    dans son espace de noms, 0 est trailbook, et 1 à 65536 sont la plage que
    tu lui as donnée. Podman garde un espace de noms par compte (son
    processus « pause »), construit avant que tu changes les fichiers : s'il
    se plaint encore, son message d'erreur dit quoi lancer.
no-root-needed-event-stale-namespace =
    /etc/subuid et /etc/subgid sont justes, et pourtant podman ne voit
    toujours qu'un identifiant : l'espace de noms de trailbook a été
    construit avant, et podman le garde jusqu'à ce qu'on lui dise que la
    configuration a changé. Lis la fin du message d'erreur (et man
    podman-system-migrate).
no-root-needed-event-pulled =
    L'image est dans le stockage propre à trailbook, sous
    /var/lib/trailbook/.local/share/containers. Le podman de root ne la voit
    pas, et les conteneurs de trailbook ne voient pas ceux de root : compare
    podman images sous trailbook et avec sudo.
no-root-needed-event-sudo-podman =
    sudo podman lance Podman en root : « rootful », avec les images et
    conteneurs de root, sans espace de noms utilisateur, et les processus du
    conteneur retrouvent les identifiants de l'hôte ; root revient, c'est
    justement ce qu'on quitte. Sans root, c'est lancer podman sous trailbook
    lui-même (sudo -iu trailbook, ou sudo -u trailbook podman …). Supprime ce
    que root a lancé (sudo podman rm -f NOM).
no-root-needed-event-port-80 =
    Un processus ordinaire ne peut pas écouter sur un port inférieur à
    net.ipv4.ip_unprivileged_port_start (1024 par défaut), et pasta, qui
    publie les ports des conteneurs de trailbook, en est un. Et 80 est pris
    de toute façon : nginx écoute sur 80 et 443 et passe déjà le site à
    127.0.0.1:8080 (/etc/nginx/sites-enabled/walks).

    Publie le conteneur sur 8080, sur 127.0.0.1 si seul nginx en a besoin, et
    laisse la porte d'entrée à nginx. Un conteneur qui n'a pas pu démarrer
    est toujours là sous son nom (podman ps -a).
no-root-needed-event-lowered =
    net.ipv4.ip_unprivileged_port_start est maintenant sous 1024 (ou le sera
    au prochain démarrage, par /etc/sysctl.d). Ce n'est pas un réglage pour
    un compte : n'importe quel programme de n'importe qui peut alors prendre
    22, 80 ou 443. Que sshd ou nginx s'arrête une minute, et le processus de
    n'importe qui peut répondre à leur place. Le mandataire inverse que tu as
    déjà est la porte la plus sûre : remets la valeur à 1024 (sysctl -w, et
    retire le fichier que tu as ajouté).
no-root-needed-event-chown-refused =
    :U demande à podman de donner le dossier à l'utilisateur du conteneur,
    mais podman le fait depuis l'espace de noms de trailbook, en tant que
    root de cet espace : il ne peut changer que les fichiers dont
    l'espace connaît le propriétaire (trailbook et ses identifiants
    subordonnés). Ces fichiers appartiennent à quelqu'un d'autre sur l'hôte.
    À qui (ls -ln /srv/trailbook/data) ? root peut d'abord les donner à
    trailbook.
no-root-needed-event-cant-write =
    L'application s'est arrêtée aussitôt : « unable to open database file:
    permission denied ». Dedans, Trailbook tourne sous l'uid 1000, le USER
    de l'image. Dans l'espace de noms de trailbook, cet uid n'est pas le
    1000 de l'hôte : le 1 de l'espace est le premier identifiant de la
    plage, donc son 1000 est le premier + 999. Sur l'hôte, les données
    appartiennent à l'uid 1000, parce que sous Docker (sans espace de noms
    utilisateur) le 1000 du conteneur ÉTAIT le 1000 de l'hôte.

    Compare podman unshare cat /proc/self/uid_map, podman unshare ls -ln
    /srv/trailbook/data et ls -ln /srv/trailbook/data. Puis donne le dossier
    au bon identifiant : l'option de volume U et --userns=keep-id dans man
    podman-run, ou podman unshare chown.
no-root-needed-event-world-writable =
    chmod 777 (ou o+w) sur les données laisse écrire le conteneur, mais
    aussi chaque compte de echalier et chaque autre conteneur : 1873
    inscriptions, avec noms et numéros de téléphone, ouvertes à quiconque
    obtient un shell. Remets les droits (755 pour le dossier, 644 pour le
    fichier) et corrige plutôt le propriétaire.
no-root-needed-event-empty =
    Trailbook tourne, mais sur une base vide (« database created … walks=0 ») :
    dans ce conteneur, /data n'est pas /srv/trailbook/data (un volume nommé,
    un autre chemin, ou pas de -v du tout). Les 412 sorties du club sont
    toujours dans /srv/trailbook/data : supprime ce conteneur et lances-en un
    avec ce dossier monté.
no-root-needed-event-running =
    Trailbook tourne sans root sous trailbook, sur les données du club. ps
    aux montre son processus sous un grand uid : ni root, ni toi. Vérifie le
    site à travers nginx (curl -k https://walks.openpaths.example/), et que
    rien ne traîne derrière toi.
no-root-needed-event-end =
    Soo-ah : « Les inscriptions sont rouvertes. Et notre amie de la sécurité
    dit : beaucoup mieux. »

    Bravo ! Tu as terminé Pas besoin de root.

    CE QUI S'EST PASSÉ
    Trailbook tournait sous Docker : un démon en root, et un conteneur dont
    l'uid 1000 était l'uid 1000 de l'hôte (voilà pourquoi les données
    t'appartenaient). Tu l'as passé à Podman sans root sous trailbook. Un
    compte système n'a pas d'identifiants subordonnés : podman ne pouvait
    faire correspondre que trailbook lui-même, et les fichiers de l'image
    (dont un du groupe 42) ne pouvaient pas être déballés ; une fois le
    compte doté de sa propre plage, et son espace de noms reconstruit par
    podman system migrate, l'image est arrivée. Le port 80 est à nginx, et
    hors de portée d'un processus ordinaire : le conteneur publie 8080 et
    nginx reste devant. L'uid 1000 de l'application, dedans, est un
    identifiant subordonné dehors : les données devaient appartenir à cet
    identifiant (:U, ou podman unshare chown), ou le propre uid du compte
    devait correspondre dans le conteneur (--userns=keep-id).

    LA BONNE PRATIQUE
    - Un compte non privilégié par service, avec sa propre plage
      d'identifiants subordonnés (usermod --add-subuids, --add-subgids),
      jamais partagée.
    - Lire la correspondance avant de toucher aux droits : podman unshare
      cat /proc/self/uid_map, podman unshare ls -ln, podman top CONTENEUR
      user huser.
    - Corriger les propriétaires, pas les permissions : chmod 777 ouvre les
      données à tout le monde.
    - Laisser les ports privilégiés à un mandataire inverse ; ne pas baisser
      net.ipv4.ip_unprivileged_port_start pour une application.
    - :Z réétiquette les fichiers pour SELinux. Sur Debian (AppArmor), il ne
      change rien, et jamais les propriétaires.

    UNE AUTRE VOIE
    --userns=keep-id fait correspondre le propre uid de trailbook dans le
    conteneur : sur l'hôte, les fichiers restent à trailbook, plus simples à
    sauvegarder et à lire. L'application tourne alors avec l'uid de
    trailbook dedans ; une image qui attend son propre USER peut demander
    keep-id:uid=1000,gid=1000.

    LA DOCUMENTATION
    - podman-run(1) : https://docs.podman.io/en/v5.4.2/markdown/podman-run.1.html
    - podman-unshare(1) : https://docs.podman.io/en/v5.4.2/markdown/podman-unshare.1.html
    - Basic setup of rootless Podman : https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md
    - subuid(5) : https://man7.org/linux/man-pages/man5/subuid.5.html

## Ce que partagent les chapitres de l'histoire : gardé ici pour qu'ils se chargent avec elle.

walking-club-readme =
    Les données de Trailbook (Sentiers ouverts).
    trailbook.db : les sorties, les marcheur·ses et les inscriptions. Copiée
    chaque nuit sur le NAS de Bolat.
# La page que sert Trailbook (curl la montre telle quelle) : { $walks } et { $signups } sont des nombres.
walking-club-page =
    <!doctype html>
    <html lang="fr">
    <title>Sentiers ouverts : prochaines sorties</title>
    <h1>Sentiers ouverts : prochaines sorties</h1>
    <p>{ $walks } sorties, { $signups } inscriptions.</p>
    <p>Samedi : la boucle de la Crête, 14 km, rendez-vous à 08:30 à la gare.</p>
    </html>
