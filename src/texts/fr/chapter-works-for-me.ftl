### Histoire « Les Lettres du quartier », chapitre 5 « Ça marche chez moi » :
### le DNS (BIND). Les commandes, chemins, noms de domaine, fichiers de zone
### et messages de dig, named et rndc ne se traduisent pas.

chapter-works-for-me = Ça marche chez moi
    .summary = Le site du café ne marche que chez Kofi : DNS, zone BIND, numéro de série, TTL.

## Fichiers

works-for-me-email-kofi =
    De :     Kofi (association Les Lettres du quartier)
    À :      toi
    Objet :  Ça marche chez moi !

    Je ne comprends pas. Le site du café marche parfaitement chez moi, mais
    les client·es du café disent qu'ils tombent sur une page d'erreur de
    l'ancien hébergeur. Et www.cafe.example ne marche nulle part, même
    chez moi.

    Pourtant, j'avais bien « fait pointer » le nom vers notre serveur : j'ai
    ajouté cette ligne dans /etc/hosts, sur mon ordinateur :

      203.0.113.10   cafe.example

    Rania dit que ce n'est pas comme ça qu'on fait, et que c'est notre
    serveur qui fait autorité pour la zone cafe.example (BIND, le service
    named). Le registre en garde une copie, sur ns2.registry.example.

    Tu peux regarder ? Rania a laissé une aide dans aide_dns.txt. Pour
    sudo : fourmis-2026
works-for-me-help-dns =
    AIDE DNS — PAR RANIA

    /etc/hosts ne change que l'ordinateur sur lequel il est : c'est une
    réponse « faite maison », que personne d'autre ne voit.

    Le vrai DNS, pour nos domaines :
      /etc/bind/named.conf.local      la liste de nos zones
      /etc/bind/zones/db.NOM          une zone par fichier
    Notre zone letters.example est un bon modèle.

    Qui répond quoi ?
      dig cafe.example                        le résolveur public (9.9.9.9)
      dig @localhost cafe.example             notre serveur (ns1)
      dig @ns2.registry.example cafe.example  la copie du registre (ns2)

    Après une modification : named-checkzone, puis rndc reload.
    Tout le reste : man dig, man named-checkzone, man rndc.

## Événements

# { $hours } : le temps qu'il reste au résolveur avant d'oublier l'ancienne adresse
works-for-me-event-cache =
    Notre serveur donne la nouvelle adresse… mais le résolveur public
    répond encore l'ancienne. Regarde le nombre avant IN : c'est le TTL qui
    reste. Le résolveur a gardé la réponse d'hier en cache, et la gardera
    encore { $hours ->
        [one] environ une heure
       *[other] environ { $hours } heures
    }, comme tous les résolveurs du monde qui l'ont demandée. C'est ce qu'on
    appelle à tort la « propagation » : rien ne se propage, les caches
    expirent. On ne peut pas les vider ; on peut seulement prévoir (un TTL
    court avant un changement). En attendant, vérifie directement auprès des
    deux serveurs qui font autorité.
works-for-me-event-error-zone =
    named refuse la zone et garde l'ancienne version : le site ne casse pas,
    mais rien n'a changé. journalctl -u named dit pourquoi ;
    named-checkzone le dit avant de recharger.
works-for-me-event-serial =
    ns1 (notre serveur) et ns2 (la copie du registre) ne répondent plus la
    même chose : ns2 n'a pas recopié la zone. Un serveur secondaire ne
    recopie une zone que si son numéro de série (le serial du SOA) a
    augmenté. journalctl -u named le signale. L'habitude : AAAAMMJJnn, la
    date du jour et un numéro de modification.
works-for-me-event-point-final =
    Attention : dans la zone, un nom écrit sans point final est complété par
    le nom de la zone. cafe.example (sans point) devient
    cafe.example.cafe.example. : dig @localhost www.cafe.example le montre.
    Pour un nom complet : cafe.example. avec le point.
works-for-me-event-end =
    ns1 et ns2 répondent la même chose : cafe.example et www.cafe.example
    mènent au serveur des Lettres. Les résolveurs suivront, au plus tard
    quand leur cache expirera. Kofi retire la ligne de son /etc/hosts :
    « Pour voir ce que voient les autres ! »

    Bravo ! Tu as terminé le chapitre 5 des Lettres du quartier. (La suite
    t'attend : Le soir du concert.)

    CE QUI S'EST PASSÉ
    /etc/hosts ne vaut que pour la machine où il se trouve : chez Kofi, le
    nom menait au bon serveur ; partout ailleurs, le DNS donnait encore
    l'ancienne adresse. La zone cafe.example, sur notre serveur, n'avait
    jamais été modifiée, et il n'y avait pas d'enregistrement pour www.

    LA BONNE PRATIQUE
    - Toujours tester comme les autres : dig, sans /etc/hosts « maison ».
    - Interroger les serveurs qui font autorité (dig @ns1, dig @ns2) pour
      savoir ce qui est publié ; le résolveur dit seulement ce qu'il a en cache.
    - Augmenter le serial du SOA à chaque modification, sinon les
      secondaires gardent l'ancienne zone.
    - named-checkzone avant rndc reload ; journalctl -u named après.
    - Un nom complet finit par un point dans un fichier de zone.
    - Avant un déménagement, baisser le TTL (par exemple à 300 secondes) un
      jour à l'avance : les caches oublieront vite l'ancienne adresse.

    LA DOCUMENTATION
    - Les fichiers de zone de BIND : https://bind9.readthedocs.io/en/stable/chapter3.html
    - dig, named-checkzone, rndc : https://bind9.readthedocs.io/en/stable/manpages.html
    - Le DNS, ses noms et son cache (RFC 1034) : https://www.rfc-editor.org/rfc/rfc1034
