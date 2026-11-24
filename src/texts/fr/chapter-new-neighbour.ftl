### Histoire « Le Café des langues », chapitre « Nouveau voisin » : un·e
### administrateur·rice Debian sur une machine Rocky Linux 10 :
### /etc/os-release, dnf, systemctl, les configurations d'exécution et
### permanente de firewalld. Commandes, options, chemins, lignes de
### configuration et sorties ne sont pas traduits.

chapter-new-neighbour = Nouveau voisin
    .summary = Le petit serveur du café tourne sous Rocky Linux, pas Debian : pas d'apt, pas de ufw. Trouvez le gestionnaire de paquets et le pare-feu de l'autre famille, montez un serveur web, et ouvrez-le pour qu'il reste ouvert après un rechargement.

## Fichiers

new-neighbour-message-dilnoza =
    De : Dilnoza (coordinatrice, Langue Commune)
    Lundi 7 décembre, 18 h 30

    Bonjour, et bienvenue à Langue Commune !

    Chaque jeudi soir, notre café organise des tables de conversation
    gratuites : arabe, dari, espagnol, tigrigna, ukrainien, vietnamien, et
    français et anglais pour tout le monde. L'écran près de la porte (on
    l'appelle le panneau) devrait afficher les tables de la semaine, depuis
    notre petit serveur, bouilloire, dans l'arrière-salle.

    Seun, notre dernier informaticien, a installé bouilloire avant de partir
    trois mois travailler à l'étranger. Il dit que c'est « du Rocky Linux,
    comme au boulot », ce qui ne me dit rien, et il dit que vous connaissez
    Debian. C'est pareil ?

    Pourriez-vous mettre un serveur web sur bouilloire ce soir, et vérifier
    que le panneau peut le joindre ? Itzel finit le site ; elle le mettra en
    place cette semaine. Seun vous a laissé des notes. sudo fonctionne avec
    votre mot de passe.

    Merci !
    Dilnoza

new-neighbour-notes-seun =
    Notes de Seun (bouilloire, 30 novembre)

    - bouilloire tourne sous Rocky Linux 10, une recompilation de Red Hat
      Enterprise Linux. Même Linux, même systemd et journalctl, même bash,
      mais ce n'est pas Debian : regardez /etc/os-release.
    - Les paquets : pas apt. J'ai installé nano pour vous, rien d'autre.
    - Le pare-feu est firewalld, pas ufw. Il tourne, avec les réglages par
      défaut d'une installation neuve.
    - SELinux est actif (enforcing). Laissez-le actif, s'il vous plaît. Au
      boulot on ne l'éteint jamais, on corrige ce dont il se plaint.
    - Le panneau (l'écran près de la porte) est un petit boîtier Debian sur
      le réseau du café : ssh panneau depuis bouilloire, votre clé est en
      place. Son navigateur charge http://www.commontongue.example/ toutes
      les cinq minutes ; sur le réseau du café, ce nom désigne bouilloire.

## Événements

new-neighbour-event-debian =
    bash ne connaît pas cette commande : bouilloire n'est pas une Debian. Ses
    paquets, son pare-feu et son serveur web ont d'autres noms. Les notes de
    Seun disent où regarder d'abord, et /etc/os-release dit de quelle
    famille est bouilloire.

new-neighbour-event-rocky =
    Rocky Linux 10 : la famille Red Hat, comme RHEL, AlmaLinux et, plus loin,
    Fedora. Les paquets viennent de dépôts par dnf (son manuel : man dnf), le
    pare-feu est firewalld (man firewall-cmd), et le paquet d'Apache ne
    s'appelle pas apache2 mais httpd.

new-neighbour-event-installed =
    httpd est installé : sa configuration est dans /etc/httpd, ses pages dans
    /var/www/html, ses journaux dans /var/log/httpd. Contrairement à Debian,
    installer un service ne le démarre pas ici : sur les systèmes Red Hat, un
    nouveau service attend qu'on le démarre et qu'on l'active.

new-neighbour-event-running =
    httpd tourne, et reviendra après un redémarrage. curl http://localhost/
    sur bouilloire répond ; le panneau, c'est une autre histoire : entre les
    deux, il y a le pare-feu.

new-neighbour-event-not-enabled =
    httpd tourne, mais il n'est pas activé : après le prochain redémarrage,
    l'écran du café resterait vide. systemctl sait faire les deux d'un coup.

new-neighbour-event-blocked =
    Depuis le panneau, bouilloire refuse aussitôt : la zone public de
    firewalld autorise ssh, cockpit et dhcpv6-client, et rejette le reste.
    firewall-cmd --list-all montre ce que la zone autorise ; man firewall-cmd
    explique comment ajouter un service.

new-neighbour-event-runtime-only =
    La règle marche maintenant : elle est dans la configuration d'exécution
    de firewalld. Elle n'est pas dans la permanente : le prochain
    firewall-cmd --reload, ou le prochain redémarrage, chargera la
    configuration permanente et l'oubliera. Comparez firewall-cmd --list-all
    et firewall-cmd --permanent --list-all.

new-neighbour-event-permanent-only =
    La règle est dans la configuration permanente, dans
    /etc/firewalld/zones/public.xml. Mais firewalld filtre toujours avec sa
    configuration d'exécution, qui ne l'a pas encore : rien ne change avant
    un rechargement.

new-neighbour-event-lost =
    Le rechargement a chargé la configuration permanente à la place de celle
    d'exécution : ce qui n'existait qu'à l'exécution a disparu. C'est le
    rôle de --reload, et le piège d'un changement fait seulement à
    l'exécution.

new-neighbour-event-firewall-off =
    firewalld ne tourne pas (ou ne démarrera pas au boot) : tous les ports de
    bouilloire sont ouverts au réseau du café et à internet. Ouvrir un
    service suffit ; redémarrez firewalld (et activez-le).

new-neighbour-event-selinux-off =
    SELinux n'est plus en mode enforcing (setenforce, ou /etc/selinux/config).
    Ce n'est pas lui qui se dresse entre le panneau et httpd : c'est le
    pare-feu. Seun a demandé de le garder actif : remettez-le.

new-neighbour-event-reached =
    Le panneau a joint httpd : ce qu'il affiche, c'est la page de test de
    Rocky, l'accueil que httpd sert tant que /var/www/html n'a pas
    d'index.html (avec un code 403 : welcome.conf transforme ce refus en
    cette page). Le site viendra.

new-neighbour-event-end =
    Dilnoza : « Thuy dit que l'écran affiche une page avec "Test Page" en
    grosses lettres. On me dit que c'est une bonne nouvelle ! »

    Bravo ! Vous avez terminé Nouveau voisin.

    CE QUI S'EST PASSÉ
    bouilloire tourne sous Rocky Linux 10, de la famille Red Hat : dnf au
    lieu d'apt, httpd au lieu d'apache2, firewalld au lieu de ufw. Vous avez
    installé httpd avec dnf, l'avez démarré et activé avec systemctl, et
    avez autorisé http et https dans la zone public de firewalld, à
    l'exécution et dans la configuration permanente, pour que le panneau le
    joigne maintenant et après un rechargement ou un redémarrage.

    BONNES PRATIQUES
    - Regarder avant de taper : /etc/os-release (ou hostnamectl) dit sur
      quel système vous êtes, donc quels outils il a.
    - firewalld a deux configurations : celle d'exécution (ce qui filtre
      maintenant) et la permanente (ce que --reload et le prochain démarrage
      chargent). Changez les deux : la commande avec et sans --permanent, ou
      la permanente puis --reload, ou celle d'exécution puis
      --runtime-to-permanent.
    - Autoriser un service par son nom (http, https : firewall-cmd
      --info-service montre ses ports) plutôt qu'un port nu : la règle dit
      pourquoi.
    - Vérifier depuis là où sont les utilisateur·rices (ici, le panneau) :
      curl localhost sur le serveur ne traverse pas le pare-feu.
    - Garder SELinux en enforcing ; les chapitres suivants parlent de vivre
      avec.

    UNE AUTRE FAÇON DE FAIRE
    nftables est sous ufw comme sous firewalld (nft list ruleset montre ce
    que firewalld a construit). Écrire des règles nftables à la main marche
    aussi, mais sur une machine Rocky, c'est firewalld qui les gère :
    tenez-vous-en à un seul outil.

    DOCUMENTATION
    - Rocky Linux, firewalld pour débutant·es : https://docs.rockylinux.org/fr/guides/security/firewalld-beginners/
    - firewall-cmd(1) : https://firewalld.org/documentation/man-pages/firewall-cmd.html
    - Référence des commandes DNF : https://dnf.readthedocs.io/en/latest/command_ref.html
    - RHEL 10, gérer les logiciels avec DNF : https://docs.redhat.com/fr/documentation/red_hat_enterprise_linux/10/html/managing_software_with_the_dnf_tool/

## Ce que partagent les trois chapitres de l'histoire : rangé ici pour être chargé avec elle.

language-cafe-site-index =
    <!doctype html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Langue Commune : les tables de la semaine</title><link rel="stylesheet" href="/css/style.css"></head>
    <body class="common-tongue-site">
    <h1>Langue Commune</h1>
    <p>Tables de conversation gratuites, chaque jeudi dès 18 h 30 au café. Venez comme vous êtes : nouvelles et nouveaux arrivants, voisines et voisins, tous les niveaux.</p>
    <p><a href="/tables.html">Les tables de la semaine</a></p>
    </body>
    </html>

language-cafe-site-tables =
    <!doctype html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Les tables de la semaine</title><link rel="stylesheet" href="/css/style.css"></head>
    <body class="common-tongue-site">
    <h1>Les tables de jeudi</h1>
    <table>
    <tr><th>Table</th><th>Animée par</th></tr>
    <tr><td>Arabe</td><td>Hamza</td></tr>
    <tr><td>Dari</td><td>Farida</td></tr>
    <tr><td>Espagnol</td><td>Itzel</td></tr>
    <tr><td>Tigrigna</td><td>Selam</td></tr>
    <tr><td>Ukrainien</td><td>Oksana</td></tr>
    <tr><td>Vietnamien</td><td>Thuy</td></tr>
    <tr><td>Français et anglais</td><td>tout le monde</td></tr>
    </table>
    </body>
    </html>

language-cafe-old-index =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Langue Commune</title></head>
    <body><p>Langue Commune : notre nouveau site arrive bientôt.</p></body></html>

language-cafe-rota =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Planning des bénévoles</title></head>
    <body class="common-tongue-rota">
    <h1>Planning des bénévoles (réseau du café seulement)</h1>
    <p>Jeudi : installation à 18 h (Hamza, Thuy), thé et café (Farida), fermeture à 21 h (Itzel).</p>
    </body></html>

language-cafe-signup-page =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Devenir bénévole</title></head>
    <body class="common-tongue-signup">
    <h1>Devenez bénévole à Langue Commune</h1>
    <form method="post" action="/signup"><label>Votre nom <input name="name"></label> <label>Les langues que vous parlez <input name="languages"></label> <button>S'inscrire</button></form>
    </body></html>

language-cafe-signup-readme =
    signup : l'appli d'inscription des bénévoles (Tenzin)

    Une petite appli Python, lancée par systemd (signup.service) sous le
    compte signup. Elle n'écoute que sur 127.0.0.1:{ $port } : httpd est sa
    porte d'entrée (voir /etc/httpd/conf.d/signup.conf).
