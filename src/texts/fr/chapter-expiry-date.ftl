### Histoire « Les Ondes », chapitre « La Date de péremption » : le
### certificat de l'intranet, signé par l'autorité de la fédération, a
### expiré. openssl s_client, x509, req, x509 -req avec -CA, subjectAltName.
### Les commandes, options, chemins et sorties ne sont pas traduits.

chapter-expiry-date = La Date de péremption
    .summary = Lundi matin, et le navigateur de chaque station prévient que l'intranet n'est pas sûr. Son certificat vient de l'autorité de la fédération, et il a expiré cette nuit. Renouvelle-le comme on fait un certificat aujourd'hui, et occupe-toi de la clé de l'autorité au passage.

## Fichiers

expiry-date-message-adaeze =
    De : Adaeze (coordinatrice de la fédération)
    Lundi 4 mars, 8 h 40

    Bonjour, et merci de prendre la suite de Kwame !

    Depuis ce matin, chaque station a un grand avertissement rouge sur
    l'intranet : « Votre connexion n'est pas privée ». Les animateur·rices
    passent outre (je leur ai demandé de ne pas le faire...), et Mateo dit
    que son navigateur parle d'une date dépassée et d'un nom incorrect
    pour board.airwaves.internal.

    Tout tourne sur pylone. Nos noms finissent en airwaves.internal, alors
    Kwame a fait notre propre autorité de certification il y a deux ans :
    elle est dans /srv/ca, avec ses notes (LISEZMOI.txt) et notre politique
    (POLICY.txt).

    Peux-tu renouveler le certificat de l'intranet, correctement cette
    fois ? Kwame a aussi dit quelque chose sur la clé de l'autorité qui
    m'a inquiétée, mais je n'ai pas compris quoi.

    Adaeze

## Événements

expiry-date-event-expired =
    Voilà : la date notAfter du certificat est passée (dimanche, 23 h 59,
    heure de Paris). Un certificat porte sa propre date de fin, et aucun
    client ne l'accepte ensuite, qui que soit le signataire. Que dit le
    certificat des noms qu'il couvre ? openssl x509 -text montre tout.
expiry-date-event-cn-only =
    Le certificat a un sujet (CN=intranet.airwaves.internal) et aucune
    extension : pas de subjectAltName. Depuis 2017, les navigateurs
    (Chrome 58, puis les autres) ignorent le Common Name et ne regardent
    que subjectAltName, comme le demandent la RFC 2818 et le CA/Browser
    Forum. Sans elle, même un certificat valide déclenche un
    avertissement ; et board.airwaves.internal n'a jamais été couvert. Les
    notes de Kwame dans /srv/ca disent comment il a fait celui-ci.
expiry-date-event-readme =
    La recette de Kwame marche, mais elle refait le même certificat : x509
    -req ne garde par défaut aucune extension de la demande (pas de
    subjectAltName), et -days 825 va contre la politique. Les noms vont
    dans un fichier d'extensions (-extfile), ou dans la demande avec
    -addext puis recopiés avec -copy_extensions copy. Tant que tu es dans
    /srv/ca : qui peut lire la clé privée de l'autorité ?
expiry-date-event-key-open =
    La clé privée de la racine est en rw-r--r-- : chaque compte de pylone
    peut la lire, et avec elle signer un certificat pour n'importe quel
    nom, auquel chaque station ferait confiance. La clé d'une autorité est
    lisible par root seul (chmod 600), dans un dossier où personne d'autre
    n'entre (chmod 700).
expiry-date-event-key-gone =
    La clé privée de la racine n'est plus dans /srv/ca/private/ca.key !
    Sans elle, l'autorité ne peut plus rien signer, et chaque station
    devrait faire confiance à une nouvelle racine. Remets-la où elle était
    (deuxième règle de la politique : seuls ses droits changent).
expiry-date-event-key-closed =
    La clé de l'autorité n'est plus lisible que par root : pour signer, on
    passe par sudo, et cela laisse une trace dans le journal.
expiry-date-event-insecure =
    curl -k (--insecure) répond, mais seulement parce qu'il ne vérifie plus
    rien : ni la date, ni le nom, ni le signataire. Il cache le problème
    sans le régler ; ne le mets jamais dans un script ni dans une
    supervision. Pour vérifier avec notre autorité : curl --cacert
    /srv/ca/ca.crt.
expiry-date-event-mismatch =
    nginx refuse de charger : le certificat et la clé ne vont pas ensemble
    (key values mismatch). Un certificat contient la moitié publique d'une
    paire de clés ; ssl_certificate_key doit en être la moitié privée.
    openssl x509 -noout -pubkey et openssl pkey -pubout, chacun passé à
    sha256sum, doivent donner la même empreinte.
expiry-date-event-self-signed =
    nginx sert maintenant un certificat signé par sa propre clé :
    auto-signé. Aucune station ne lui fait confiance (l'avertissement
    rouge reste, maintenant pour un émetteur inconnu), et avec la
    configuration par défaut de req -x509 c'est même un certificat
    d'autorité. Il doit être signé par Airwaves Root CA, à laquelle les
    stations font déjà confiance : x509 -req avec -CA et -CAkey.
expiry-date-event-no-san =
    Un nouveau certificat, signé par notre racine, mais toujours sans
    subjectAltName : les navigateurs vont continuer à prévenir.
    Attention : x509 -req laisse tomber les extensions de la demande sauf
    si on lui dit le contraire (-copy_extensions copy, ou les noms dans
    -extfile).
expiry-date-event-one-name =
    Enfin un subjectAltName, mais il ne liste pas les deux noms qu'utilisent
    les stations : intranet.airwaves.internal et board.airwaves.internal
    (le server_name de nginx).
expiry-date-event-too-long =
    Ce certificat est valable { $days } jours : la politique dit un an,
    jamais plus de 398. Les autorités publiques n'ont pas le droit de
    dépasser 398 jours, et les systèmes d'Apple refusent plus de 825 même
    venant d'une autorité privée ; une validité courte limite les dégâts
    d'une clé perdue et oblige le renouvellement à rester une routine
    connue.
expiry-date-event-short =
    Ce certificat n'est valable qu'un mois : sans -days, x509 -req signe
    pour 30 jours. L'intranet serait de nouveau rouge en avril. La
    politique demande un an.
expiry-date-event-ca-leaf =
    Ce certificat dit CA:TRUE : qui détient la clé de l'intranet pourrait
    signer des certificats pour n'importe quel nom. Le certificat d'un
    serveur n'est pas une autorité (basicConstraints = CA:FALSE).
expiry-date-event-not-reloaded =
    Le nouveau certificat est en place sur le disque, mais nginx sert
    toujours l'ancien : il lit ses certificats au démarrage ou au
    rechargement. Vérifie la configuration (sudo nginx -t), puis recharge.
expiry-date-event-renewed =
    nginx présente maintenant un certificat d'Airwaves Root CA, valable un
    an, avec les deux noms dans subjectAltName. curl --cacert
    /srv/ca/ca.crt https://board.airwaves.internal/ est d'accord.
expiry-date-event-end =
    Adaeze : « Plus d'avertissement rouge, dans aucune station. Et board
    remarche pour Mateo ! Merci. J'ai mis un rappel dans l'agenda pour
    février prochain... »

    Bravo ! Tu as terminé La Date de péremption.

    CE QUI S'EST PASSÉ
    En 2028, Kwame a signé le certificat de l'intranet avec la racine de la
    fédération, comme le faisaient beaucoup de tutoriels : le nom dans le
    seul Common Name, et 825 jours. Il a expiré dimanche soir ; et même
    avant, les navigateurs ne lisaient plus le CN, d'où l'avertissement
    pour board.airwaves.internal. Tu as lu ce que présente le serveur
    (openssl s_client, x509 -dates, -checkend), fait une demande, fait
    signer par la racine avec les noms dans subjectAltName pour un an,
    installé le certificat et rechargé nginx, puis vérifié avec curl
    --cacert. Et la clé de la racine, lisible par tous, n'est plus qu'à
    root.

    BONNES PRATIQUES
    - Chaque nom qu'utilise un client va dans subjectAltName ; le CN est
      ignoré.
    - x509 -req ne garde par défaut aucune extension de la demande :
      -extfile, ou -copy_extensions copy (et vérifier le résultat avec x509
      -text).
    - Une validité d'un an au plus (398 jours est le plafond public), et un
      rappel dans l'agenda, ou mieux, une surveillance des dates
      d'expiration.
    - Un certificat et sa clé vont ensemble : comparer leurs clés publiques
      (x509 -pubkey, pkey -pubout, sha256sum).
    - Jamais curl -k comme solution : --cacert avec le certificat de son
      autorité.
    - La clé privée d'une autorité n'est lisible que par root, et sa
      racine idéalement hors ligne.

    DOCUMENTATION
    - openssl-x509 : https://docs.openssl.org/3.0/man1/openssl-x509/
    - openssl-req : https://docs.openssl.org/3.0/man1/openssl-req/
    - subjectAltName (RFC 5280, 4.2.1.6) : https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.6
    - Les recommandations TLS de Mozilla : https://wiki.mozilla.org/Security/Server_Side_TLS
