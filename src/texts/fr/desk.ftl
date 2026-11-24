### Le poste : la machine de départ, d'où l'on se connecte en ssh aux
### machines des histoires. Et le message d'accueil (motd) de chaque machine.

workstation-welcome =
    Bienvenue sur ton poste de travail.

    Chaque histoire se passe sur une machine du réseau. Pour t'y connecter,
    on utilise ssh (Secure Shell), comme le font tous les jours celles et ceux
    qui administrent des serveurs. Commence par le royaume :

      ssh royaume

    La première fois, ssh te demandera si tu fais confiance à cette machine :
    réponds yes. Une fois connecté·e, l'invite change (vous@royaume). Pour
    revenir ici :

      exit

    Les machines que tu connais sont dans ~/.ssh/config, et tes clés dans le
    dossier caché ~/.ssh. Pour l'instant, tu n'as que la clé du royaume ;
    termine La Racine (chapitre 3 de l'Effaceur) pour recevoir les autres. Pour les voir :

      ls -a ~/.ssh
# Commentaire en tête de ~/.ssh/config (chaque ligne devient un commentaire « # »)
workstation-config-comment =
    Les machines que tu connais. « ssh royaume » se connecte à royaume.internal
    avec l'utilisateur vous et la clé ~/.ssh/id_royaume.
    Manuel : man ssh
# Commentaire en tête de /etc/hosts du poste (chaque ligne devient un commentaire « # »)
workstation-hosts-comment =
    Les machines de ce jeu sont fictives.
    Les noms en .internal sont réservés aux réseaux privés (ICANN, 2024) ;
    ceux en .example, aux exemples (RFC 6761). Les adresses 192.0.2.x,
    198.51.100.x et 203.0.113.x sont réservées à la documentation (RFC 5737).
    Aucun de ces noms ni de ces adresses ne mène chez quelqu'un de réel.
workstation-exit = (Tu es sur ton propre poste : exit fermerait ton terminal. Pour te connecter à une machine : ssh nom, par exemple ssh royaume.)
# { $keys } : la liste des nouvelles clés, séparées par des virgules
workstation-keys-received =
    🔑 Le royaume te remercie : de nouvelles clés SSH t'attendent sur ton poste
    ({ $keys }). Reviens-y (exit), regarde ~/.ssh/config, et connecte-toi à la
    machine de ton choix.
workstation-keys-received-next =
    🔑 Nouvelle étape franchie : d'autres histoires s'ouvrent, leurs clés
    t'attendent sur ton poste ({ $keys }).

## Messages d'accueil des machines (motd), affichés à la connexion

machine-kingdom-motd = Royaume — serveur de la gardienne du phare. Accès réservé aux voyageur·ses munis d'une clé.
machine-datacenter-motd = Datacenter — serveur web de la médiathèque. Toute intervention est journalisée.
machine-anthill-motd = La Fourmilière — l'ordinateur du café associatif. « Merci de venir nous aider ! » (Kofi)
machine-manuscript-motd = Manuscrit — l'ordinateur d'Inès. Ne pas toucher au roman sans sauvegarde !
machine-library-motd = Bibliothèque du quartier — ce serveur sera éteint ce soir à minuit.
machine-letters-motd = Les Lettres du quartier — le serveur de l'association. Merci de prendre soin de lui !
machine-workshop-motd = La Fabrique — le serveur du fablab. Ici, on répare, on prête, on bidouille.
machine-gazette-motd = La Gazette du quartier — le serveur du journal. On publie avec git push, pas à la main.
machine-games-motd = La Ludothèque du quartier — le serveur des bénévoles. On joue, on prête, on range les pions.
machine-radio-motd = Radio Quartier — le serveur de l'antenne. Astreinte : un œil sur le flux, l'autre sur les journaux.
machine-community-motd = Maison des associations — la passerelle. Derrière elle : le wiki et les archives.
machine-coop-motd = L'épicerie coopérative du quartier — le serveur de la caisse. Ici, on partage tout, sauf les mots de passe.
machine-hive-motd = La Ruche — le routeur du tiers-lieu. eth0 : la box ; eth1 : le commutateur.
machine-bakery-motd = Le Fournil — le serveur de la boulangerie : le site, l'appli de commandes, sa base. Un audit est passé par là.
machine-lab-motd = Le Labo — le serveur du club photo : la galerie et les archives des membres. Deux disques en RAID 1.
machine-garden-motd = Les Jardins partagés — le site et le courrier de l'association (gardens.example). Merci de prendre soin des plants comme du serveur !
machine-pilot-motd = Les maisons de quartier — le poste de pilotage : d'ici, Ansible s'occupe des serveurs des trois maisons.
machine-patch-motd = La Rustine — l'atelier vélo associatif (cycles.example). Un serveur tout neuf, avec Caddy. Pensez à regonfler vos pneus !
machine-canteen-motd = La Cantine — le serveur de la cantine solidaire : le menu du jour et les réservations. Prix libre, repas partagé.
machine-observatory-motd = L'Observatoire — le serveur du club d'astronomie : la galerie photo, et l'empilement des images de la nuit. Bon ciel !
machine-theatre-motd = Le Théâtre — le serveur du théâtre de quartier : la billetterie et sa base de données. Merde pour ce soir !
machine-valley-motd = Les Refuges — le serveur de la vallée : les journaux des refuges de montagne, rassemblés au même endroit.
machine-nas-motd = Le Club photo — le NAS du club : les photos de tous les albums, partagées avec le labo.
machine-oven-motd = Le Bastion — le serveur des livraisons du Fournil : les tournées, les livreur·ses, les commandes du jour.
machine-projector-motd = L'Autre Unix — le serveur du ciné-club : le programme, les billets, et le vieux FreeBSD de Lucien.
machine-herbarium-motd = Le vieux Soleil — le catalogue de la grainothèque depuis 2009, sur un Sun Fire V240. Merci de ne pas débrancher.
machine-abacus-motd = Le traitement de nuit — le serveur de la Mutuelle : le traitement des cotisations de chaque nuit, en COBOL, descendu du mainframe du centre de traitement.
machine-mill-motd = Le carnet de commandes — l'IBM i du moulin (PASE, le côté Unix). tn5250 moulin depuis le poste de travail ouvre son écran vert.
machine-kneader-motd = Le Fournil — nouveau serveur (migration), six mois après l'audit. La veille de sécurité, maintenant sans Salomé.

# En se reconnectant à une machine dont le chapitre est en cours.
# { $file } : le fichier d'accueil du chapitre (ex. bienvenue.txt)
resumed-chapter = Tu reprends ce chapitre là où tu l'avais laissé. Pour relire ce qui t'attend :   cat { $file }
machine-compass-motd = Les voisins Windows — le serveur Linux de l'Atelier. Son voisin, armoire, est un Windows Server.
machine-stave-motd = L'École de musique — le serveur de fichiers de l'école, un Windows Server 2022 (OpenSSH arrive dans cmd.exe).
machine-register-motd = Le Catalogue — le contrôleur de domaine des bibliothèques, un Windows Server 2022 (Active Directory, lending.internal).
machine-crate-motd = L'Épicerie solidaire — le serveur Debian de l'épicerie (ses fichiers, son appli, et le disque de sauvegarde qui part le vendredi).
machine-quay-motd = Le Bac — le serveur Debian de la coopérative du bac, en IPv4 et en IPv6 (son site, son appli de réservation, sa zone DNS ferry.example).
machine-gauge-motd = Les Vélos partagés — le serveur de supervision de la coopérative (Prometheus, son node exporter, l'Alertmanager) ; selle et moyeu sont derrière lui.
machine-lane-motd = La Piscine — le serveur Debian de la piscine, un cluster k3s à un seul nœud (l'appli de réservation, namespace swim).

machine-chalk-motd = La Salle des profs — le serveur d'impression de l'école primaire (CUPS) : le secrétariat, la bibliothèque, la salle des profs. Merci de ne pas imprimer l'album de l'école deux fois.
machine-mast-motd = Les Ondes — le serveur Debian de la fédération de radios associatives : l'intranet, les archives, le portail des contributions, et l'autorité de certification de la fédération dans /srv/ca.
machine-anvil-motd = L'Outilthèque — la forge de Lendshed : Forgejo (https://forge.lendshed.example), son exécuteur Actions, et les sites de la documentation et des téléchargements. Soyez bienveillant·es avec les contributeur·rices.
machine-hearth-motd = La Maison de santé — l'hyperviseur de la maison de santé de Millbrook (KVM, libvirt) : ledger, agenda, records et leurs ami·es vivent ici. virsh list --all avant toute chose.
machine-lb1-motd = La Collecte — lb1, le premier répartiteur de charge de l'établissement du sang de Lindenvale (keepalived, HAProxy) devant donate.lindenvale.example. Son jumeau est lb2. ip a avant toute chose.
machine-baton-motd = La Chorale — baguette, le serveur de la Chorale des Berges : le site, l'espace choristes et sa base, et les données des choristes. La politique de conservation est dans /srv/choir/docs.
machine-trowel-motd = Les Jardins — truelle, le serveur de base de données de l'association des Jardins de Greenholme (MariaDB) : les réservations, les membres et la liste d'attente de Plotline. sudo mariadb avant toute chose.
machine-slipway-motd = La Station de sauvetage — cale, le serveur de courrier de la Station de sauvetage de Seaholme : Postfix reçoit, rspamd note, Dovecot range dans /var/vmail. sudo tail /var/log/mail.log avant toute chose.
machine-belay-motd = Le Mur d'escalade — relais, le serveur du Dévers, la salle d'escalade associative : réservations, adhésions, badges de la porte. Il est branché sur un onduleur dans la baie du bureau (Network UPS Tools : upsc, upsmon).
machine-wings-motd = La Troupe de danse — coulisses, le serveur de la Compagnie de danse Kestrel et un nœud de sa grappe Garage. sudo garage status avant toute chose ; aws et rclone parlent à s3.kestrel.example.
machine-meadow-motd = Le Refuge — prairie, le petit serveur des Refuges des Coteaux chez un hébergeur associatif : le dépôt restic (/srv/restic), le plan de reprise (/srv/drp), et le DNS primaire caché de la zone. enclos, le serveur principal, est dans la cave de la grange des Coteaux.
machine-kettle-motd = Le Café des langues — bouilloire, le petit serveur de Langue Commune dans l'arrière-salle du café : Rocky Linux 10 (pas Debian : dnf, firewalld, SELinux). Son site s'affiche sur l'écran du café, panneau.
machine-cairn-motd = La Cartopartie — cairn, le serveur DNS du collectif Wayfinders (BIND, zone wayfinders.example), ses enregistrements tenus en code avec OpenTofu dans /srv/dns. tofu plan avant toute chose.
machine-stile-motd = Le Club de marche — echalier, le serveur du club de randonnée Sentiers ouverts : Trailbook (sorties et inscriptions) dans un conteneur derrière nginx, https://walks.openpaths.example. Son compte : trailbook.
