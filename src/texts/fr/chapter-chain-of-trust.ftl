### Histoire « Les Ondes », chapitre « La Chaîne de confiance » : une
### autorité intermédiaire, un serveur qui envoie son certificat sans
### l'intermédiaire, des machines qui ne font pas confiance à la racine.
### update-ca-certificates, la chaîne de nginx, openssl s_client -showcerts
### et verify. Les commandes, options, chemins et sorties ne sont pas traduits.

chapter-chain-of-trust = La Chaîne de confiance
    .summary = Kwame a mis une autorité intermédiaire sous la racine, Mateo a écrit une supervision rouge depuis le premier jour, et le nouveau PC du studio refuse tous les sites. Les certificats sont valides : ce qui manque, c'est la confiance, et un maillon de la chaîne.

## Fichiers

chain-of-trust-message-adaeze =
    De : Adaeze
    Lundi 18 mars, 9 h 15

    Deux semaines de calme, et maintenant ça.

    Kwame est passé la semaine dernière installer ce qu'il appelle une
    « autorité intermédiaire » (voir /srv/ca/LISEZMOI.txt), et a signé avec
    elle le certificat des nouvelles archives : archive.airwaves.internal
    marche très bien dans Firefox, dans les stations.

    Mais Mateo dit que sa supervision sur pylone est rouge depuis qu'il
    l'a écrite (/usr/local/bin/check-sites, son journal dans
    /var/log/check-sites.log), et le nouveau PC de studio qu'il a installé
    à Riverside, cabine, refuse les archives comme l'intranet. Il a proposé
    d'ajouter -k « pour que ce soit vert » ; je lui ai dit que je te
    demandais d'abord.

    Tu peux joindre cabine depuis pylone : ssh cabine (ta clé y est).

    Adaeze
chain-of-trust-note-mateo =
    Mot de Mateo, vendredi 15 mars

    Debian 13 tout neuf sur ce PC, pour le logiciel de diffusion du
    studio. Il va chercher la grille sur https://intranet.airwaves.internal/
    et les jingles sur https://archive.airwaves.internal/, et refuse les
    deux : « SSL certificate problem: unable to get local issuer
    certificate ». À la station, Firefox n'a aucun souci. Kwame avait
    installé quelque chose sur nos vieux PC, mais je ne sais pas quoi.

## Événements

chain-of-trust-event-red =
    « unable to get local issuer certificate » : le client n'a pas pu
    rattacher le certificat à une autorité en qui il a confiance. Une
    machine neuve ne fait confiance qu'aux autorités publiques de son
    magasin (le paquet ca-certificates de Debian, dans /etc/ssl/certs) ;
    notre racine n'en fait pas partie, et Kwame ne l'a installée à la main
    que sur les PC des stations. D'où Debian tire-t-il les autorités
    auxquelles il fait confiance ? (man update-ca-certificates)
chain-of-trust-event-insecure =
    -k (--insecure) dans la supervision la rendrait verte... et aveugle :
    elle ne verrait plus un certificat expiré, un mauvais nom, ni un
    serveur qui n'est pas le nôtre. Une vérification qui ne peut pas
    échouer ne vérifie rien. Fais plutôt confiance à notre racine sur
    pylone.
chain-of-trust-event-pem-ignored =
    Il y a un fichier .pem dans /usr/local/share/ca-certificates, et
    update-ca-certificates l'ignore : il ne prend que les fichiers en .crt
    (le contenu est le même PEM). Renomme-le.
chain-of-trust-event-key-on-booth =
    Une clé privée de l'autorité est sur cabine ! Un client n'a besoin que
    du certificat, la partie publique : qui détient la clé peut signer des
    certificats auxquels chaque station ferait confiance. Efface-la de
    cabine tout de suite (en vrai, une clé qui a fuité impose une nouvelle
    autorité : ici, cabine n'est pas encore sur le réseau, Adaeze passe
    l'éponge pour cette fois).
chain-of-trust-event-mast-trusts =
    pylone fait maintenant confiance à Airwaves Root CA : elle est dans
    /etc/ssl/certs et dans le paquet ca-certificates.crt que lisent curl
    et openssl. Voyons ce que dit la supervision maintenant.
chain-of-trust-event-still-red =
    Toujours rouge pour les archives, mais l'intranet passe. Le certificat
    de l'intranet est signé directement par la racine ; celui des
    archives par l'autorité intermédiaire, que le client ne connaît pas.
    Un serveur doit envoyer, après son propre certificat, les
    intermédiaires jusqu'à la racine (pas la racine elle-même, que le
    client a déjà). Qu'envoient les archives ? openssl s_client -showcerts
    liste la chaîne reçue.
chain-of-trust-event-intermediate-trusted =
    Faire confiance à l'autorité intermédiaire sur les clients fait
    marcher les archives ici, mais sur chaque autre client le problème
    reste : la correction est côté serveur, qui doit envoyer
    l'intermédiaire avec son certificat.
chain-of-trust-event-root-served =
    Les archives envoient maintenant la racine aussi. Ça marche, mais c'est
    inutile : un client ne fait confiance qu'à une racine qu'il a déjà dans
    son magasin, jamais à celle que lui tend le serveur ; c'est quelques
    centaines d'octets pour rien à chaque connexion.
chain-of-trust-event-chain =
    Les archives envoient maintenant leur certificat suivi de celui de
    l'autorité intermédiaire : tout client qui fait confiance à la racine
    peut construire la chaîne (feuille, intermédiaire, racine). Firefox,
    dans les stations, s'en sortait parce qu'il retient les
    intermédiaires qu'il a déjà croisés ; curl et une machine neuve, non.
chain-of-trust-event-booth =
    cabine fait maintenant confiance à la racine de la fédération (seul
    son certificat y est, pas sa clé).
chain-of-trust-event-end =
    Mateo : « Tout est vert, et cabine joue les jingles. J'ai rayé -k de
    mes notes, promis. »

    Bravo ! Tu as terminé La Chaîne de confiance.

    CE QUI S'EST PASSÉ
    Deux problèmes distincts donnaient le même message, « unable to get
    local issuer certificate ». D'abord, ni pylone ni cabine ne faisaient
    confiance à la racine de la fédération : Debian fait confiance à ce
    qu'update-ca-certificates met dans /etc/ssl/certs, depuis la liste de
    Mozilla et les fichiers .crt de /usr/local/share/ca-certificates.
    Ensuite, les archives envoyaient leur certificat seul, sans
    l'autorité intermédiaire qui le rattache à la racine ; les navigateurs
    qui avaient déjà croisé cet intermédiaire s'en sortaient, les autres
    clients non. Tu as installé le certificat de la racine (et lui seul)
    sur les deux machines, et donné la chaîne à nginx : la feuille, puis
    l'intermédiaire.

    BONNES PRATIQUES
    - Distribuer le certificat de la racine, jamais une clé : un client
      n'a jamais besoin d'une clé privée de l'autorité.
    - Sous Debian : /usr/local/share/ca-certificates/nom.crt, puis
      update-ca-certificates (un .pem est ignoré).
    - Un serveur envoie son certificat et les intermédiaires, dans
      l'ordre ; pas la racine (cat feuille.crt issuing.crt > chaine.crt
      pour ssl_certificate).
    - openssl s_client -showcerts montre ce qui est vraiment envoyé ;
      openssl verify -CAfile racine.crt -untrusted issuing.crt vérifie la
      chaîne.
    - « Ça marche dans mon navigateur » ne prouve pas grand-chose : les
      navigateurs gardent les intermédiaires en cache.
    - Ne jamais désactiver la vérification dans une supervision : elle
      doit pouvoir échouer.

    DOCUMENTATION
    - update-ca-certificates : https://manpages.debian.org/trixie/ca-certificates/update-ca-certificates.8.en.html
    - nginx, chaînes de certificats : https://nginx.org/en/docs/http/configuring_https_servers.html#chains
    - openssl-verify : https://docs.openssl.org/3.0/man1/openssl-verify/
    - openssl-s_client : https://docs.openssl.org/3.0/man1/openssl-s_client/
    - Les recommandations TLS de Mozilla : https://wiki.mozilla.org/Security/Server_Side_TLS
