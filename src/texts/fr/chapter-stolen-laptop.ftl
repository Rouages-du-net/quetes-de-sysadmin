### Histoire « Les Ondes », chapitre « Le Portable volé » : le portable
### d'une reporter volé avec son certificat client ; révocation, CRL,
### ssl_crl de nginx ; puis une surveillance des dates d'expiration
### (openssl x509 -checkend, cron ou un timer). Les commandes, options,
### chemins et sorties ne sont pas traduits.

chapter-stolen-laptop = Le Portable volé
    .summary = Le portable d'une reporter a été volé, et avec lui le certificat qui ouvre le portail des contributions. Quelqu'un s'en sert déjà. Ferme cette porte sans enfermer les autres dehors, puis fais en sorte qu'aucun certificat de la fédération n'expire plus jamais par surprise.

## Fichiers

stolen-laptop-message-adaeze =
    De : Adaeze
    Mardi 16 avril, 10 h 05

    Mauvaise nouvelle : le portable de Lindiwe a été volé dans sa voiture
    dimanche soir, après le festival. Son disque n'est pas chiffré (je
    sais...).

    Dessus, le logiciel qui envoie ses enregistrements au portail des
    contributions, https://contrib.airwaves.internal/. Le portail ne
    laisse entrer que les portables des reporters : chacun a un
    certificat client de notre autorité intermédiaire (les notes de Kwame
    sont dans /srv/ca/LISEZMOI.txt). Amina et Ravi doivent pouvoir
    continuer : Amina envoie les interviews du festival ce matin.

    Lindiwe aura un nouveau portable la semaine prochaine ; d'ici là,
    personne d'autre que nous ne doit pouvoir se servir du sien.

    Et autre chose, après la surprise de l'intranet en mars : peut-on être
    prévenus, tout seuls, avant qu'un certificat expire ? La politique dit
    30 jours à l'avance.

    Adaeze

## Événements

stolen-laptop-event-thief =
    203.0.113.66 : une adresse qui n'est celle d'aucune station, qui se
    connecte au portail à 2 h du matin puis ce matin, et qui est acceptée
    (200). Elle présente un certificat valide signé par notre autorité :
    nginx ne peut pas la distinguer de Lindiwe. Un certificat reste
    valide jusqu'à sa date de fin, sauf si l'autorité le révoque et que
    les serveurs l'apprennent.
stolen-laptop-event-deleted =
    Le fichier du certificat a disparu de newcerts, mais cela ne révoque
    rien : le voleur a sa copie, avec sa clé, et nginx vérifie seulement
    qu'il a été signé par notre autorité. Révoquer, c'est le dire à la
    base de l'autorité (openssl ca -revoke), puis publier la liste. Une
    copie du certificat de chaque portable est aussi gardée dans
    /srv/ca/issuing/certs/.
stolen-laptop-event-new-ca =
    Une toute nouvelle autorité ? Seule la clé d'un portable a été volée,
    pas celle de l'autorité : changer de racine voudrait dire l'installer
    partout et réémettre chaque certificat, pour rien. Révoquer le seul
    certificat suffit.
stolen-laptop-event-revoked =
    Le certificat 1003 est maintenant marqué R (révoqué) dans index.txt.
    Mais la base est celle de l'autorité : nginx ne la lit jamais. Ce que
    lisent les serveurs, c'est la liste de révocation, la CRL, que
    l'autorité écrit et signe (openssl ca -gencrl).
stolen-laptop-event-crl =
    La CRL liste le numéro de série 1003, signée par l'autorité
    intermédiaire, valable 30 jours (default_crl_days : il faut la
    réécrire avant, même sans rien de nouveau). Il faut la donner à
    nginx : la directive ssl_crl, lue à chaque rechargement.
stolen-laptop-event-stale-crl =
    nginx a une CRL, mais une qui ne liste pas 1003 : une CRL est une
    photo de la base au moment où elle a été écrite. Réécris-la après
    chaque révocation, et recharge nginx.
stolen-laptop-event-all-refused =
    Maintenant nginx refuse tout le monde, Amina comprise ! Son journal
    d'erreurs dit pourquoi : « unable to get certificate CRL ». Avec
    ssl_crl, nginx vérifie la révocation de chaque certificat de la
    chaîne, celui de l'autorité intermédiaire aussi, et celui-là est dans
    la CRL de la racine (/srv/ca/crl/root.crl) : le fichier donné à
    ssl_crl doit contenir les deux CRL, l'une après l'autre.
stolen-laptop-event-not-loaded =
    La configuration mentionne ssl_crl, mais nginx ne l'a pas encore
    chargée : vérifie-la (sudo nginx -t), puis recharge.
stolen-laptop-event-refused =
    Le portable volé est refusé (400, « The SSL certificate error »,
    certificate revoked dans le journal d'erreurs), et les envois d'Amina
    passent toujours. Maintenant, la deuxième demande : une surveillance
    des dates d'expiration.
stolen-laptop-event-watch-quiet =
    Une tâche tourne toute seule, mais elle n'a rien dit du certificat du
    serveur de diffusion, qui expire dans 20 jours
    (/srv/ca/issued/stream.crt). Les certificats sont dans /srv/ca/issued
    et /srv/ca/issuing/newcerts ; openssl x509 -checkend répond par son
    code de sortie.
stolen-laptop-event-watch-noisy =
    La tâche liste chaque certificat de la même façon : celui qui expire
    est noyé parmi ceux qui vont bien, et personne ne lira un courriel
    quotidien qui dit toujours la même chose. Une alerte ne parle que
    quand il y a quelque chose à faire.
stolen-laptop-event-watch =
    La surveillance marche : lancée comme elle le sera, elle signale le
    certificat du serveur de diffusion, qui expire le 6 mai, et se tait
    pour les autres.
stolen-laptop-event-end =
    Adaeze : « Les interviews du festival sont arrivées, et le portable
    volé ne peut plus rien envoyer. J'ai déjà la première alerte dans ma
    boîte : le certificat de la diffusion. Je demande à Kwame de le
    renouveler cette semaine ! »

    Bravo ! Tu as terminé Le Portable volé.

    CE QUI S'EST PASSÉ
    Un certificat client prouve « ce portable appartient à une reporter »
    tant qu'il est valide : volé, il marche pour qui le détient. Tu as
    trouvé les connexions du voleur dans le journal d'accès de nginx,
    révoqué le certificat dans la base de l'autorité intermédiaire
    (openssl ca -revoke, keyCompromise), écrit la liste de révocation
    (openssl ca -gencrl), et donné les deux CRL à nginx (celle de
    l'intermédiaire et celle de la racine, puisque nginx vérifie toute la
    chaîne) avant de le recharger. Puis tu as mis en place une
    surveillance qui passe openssl x509 -checkend sur chaque certificat
    émis et ne parle que pour ceux qui expirent dans les 30 jours.

    BONNES PRATIQUES
    - Une clé perdue ou volée : révoquer le certificat tout de suite
      (openssl ca -revoke fichier -crl_reason keyCompromise) ; effacer un
      fichier ne révoque rien.
    - Révoquer, c'est deux étapes : la base, puis une nouvelle CRL
      (-gencrl) que les serveurs chargent (nginx : ssl_crl, puis un
      rechargement).
    - Une CRL expire (default_crl_days) : la réécrire à intervalles
      réguliers, sinon chaque client est refusé le jour où elle échoit.
    - nginx vérifie les CRL de toute la chaîne : la CRL de la racine aussi.
    - Surveiller les dates d'expiration : openssl x509 -checkend
      $((30*86400)) dans une tâche quotidienne (cron, ou un timer systemd),
      qui ne signale que ce qui expire.
    - Chiffrer les disques des portables : une clé volée est le début de
      toutes les histoires.

    DOCUMENTATION
    - openssl-ca (-revoke, -gencrl) : https://docs.openssl.org/3.0/man1/openssl-ca/
    - openssl-crl : https://docs.openssl.org/3.0/man1/openssl-crl/
    - nginx, ssl_crl et ssl_verify_client : https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_crl
    - Les CRL (RFC 5280, section 5) : https://www.rfc-editor.org/rfc/rfc5280#section-5
    - openssl-x509 (-checkend) : https://docs.openssl.org/3.0/man1/openssl-x509/
