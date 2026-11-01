### Histoire « Le courrier indésirable », chapitre 3 « La politique » : DMARC
### (rapports agrégés, alignement, p=quarantine). Les commandes, chemins,
### enregistrements DNS et balises ne se traduisent pas.

chapter-policy = La politique
    .summary = Passer DMARC à p=quarantine sans perdre la lettre d'information : lire les rapports, aligner le prestataire, puis durcir la politique.

## Fichiers

policy-email-nour =
    De :     Nour
    À :      toi
    Objet :  DMARC

    Bonjour !

    mailbox.example annonce que les expéditeurs qui envoient beaucoup
    doivent publier une politique DMARC « quarantine » au moins. Notre
    lettre d'information part chaque semaine à presque 500 personnes…

    Comme le conseille leur guide, j'ai publié la semaine dernière une
    politique qui ne bloque rien (p=none) mais qui demande des rapports
    (rua=mailto:dmarc@gardens.example). Les premiers sont arrivés, je les
    ai rangés dans rapports_dmarc. Je n'y comprends rien : c'est du XML.

    La lettre est envoyée par newsmail.example, un prestataire : leur page
    d'aide sur DKIM est dans lettre_newsmail.txt.

    Peux-tu passer DMARC à quarantine, sans que notre lettre finisse dans
    les indésirables ?

    Nour

policy-letter-newsmail =
    newsmail.example — Aide — Signer avec votre propre domaine (DKIM)

    Par défaut, nos serveurs signent vos campagnes avec notre domaine
    (d=newsmail.example). Les destinataires vérifient la signature, mais
    pour DMARC, elle ne correspond pas au domaine de votre adresse
    d'expédition.

    Pour que nous signions avec votre domaine, déléguez-nous un sélecteur.
    Ajoutez dans la zone DNS de votre domaine :

        nm1._domainkey.VOTRE-DOMAINE.   CNAME   nm1.dkim.newsmail.example.

    Nos serveurs vérifient votre DNS toutes les heures : dès que le CNAME
    est visible, vos campagnes sont signées avec d=VOTRE-DOMAINE.

    L'adresse de retour (les rebonds) reste chez nous :
    bounces+…@bounce.newsmail.example.

## Événements

policy-event-report =
    198.51.100.77 : ce sont les serveurs de newsmail.example, qui envoient
    la lettre (412 messages chez mailbox.example). SPF passe, DKIM passe…
    mais pour bounce.newsmail.example et newsmail.example, pas pour
    gardens.example. DMARC demande l'alignement : que le domaine vérifié
    par SPF (l'enveloppe) ou par DKIM (d=) soit celui de l'adresse From:.
    Avec p=quarantine, ces 412 messages finiraient dans les indésirables.
policy-event-spoofing =
    192.0.2.66 n'est à personne de l'association : 17 messages au nom de
    gardens.example, sans SPF ni DKIM valides. Quelqu'un se fait passer pour
    les Jardins. C'est justement ce que p=quarantine (ou reject) arrêtera.
policy-event-inclusion =
    Ajouter include:_spf.newsmail.example au SPF de gardens.example ne
    change rien pour DMARC : les destinataires vérifient SPF pour le domaine
    de l'enveloppe, bounce.newsmail.example, pas pour gardens.example. Et
    chaque include coûte des requêtes DNS (dix au plus). C'est DKIM qu'il
    faut aligner : voir lettre_newsmail.txt.
policy-event-point =
    Le CNAME de nm1._domainkey ne mène nulle part : dans une zone, un nom
    sans point final est relatif. nm1.dkim.newsmail.example devient
    nm1.dkim.newsmail.example.gardens.example. Il faut le point final :
    nm1.dkim.newsmail.example.
policy-event-two =
    Il y a maintenant deux enregistrements DMARC pour gardens.example : la
    RFC 7489 dit d'ignorer DMARC dans ce cas, comme s'il n'y avait aucune
    politique. Modifie l'enregistrement existant au lieu d'en ajouter un.
policy-event-aligned =
    Internet voit le CNAME : newsmail.example signe maintenant la lettre
    avec d=gardens.example, et la clé est trouvée en suivant le CNAME. La
    lettre passe DMARC. On peut durcir la politique.
policy-event-too-early =
    Attention : avec cette politique, la lettre d'information (non
    alignée) serait mise en quarantaine, ou refusée, par les messageries.
    Aligne d'abord la signature de newsmail.example.
policy-event-end =
    gardens.example publie p=quarantine (ou plus), la lettre et les
    courriels du serveur passent DMARC, et les messages de 192.0.2.66 n'ont
    plus de chance. Nour : « Je garde un œil sur les rapports chaque
    semaine. »

    Bravo ! Tu as terminé le chapitre « La politique », et l'histoire
    « Le courrier indésirable ».

    CE QUI S'EST PASSÉ
    DMARC relie SPF et DKIM à l'adresse que lit la personne (From:) : un
    message passe si SPF ou DKIM passe pour le même domaine (alignement).
    La politique (p=) dit aux destinataires quoi faire des autres : rien
    (none), les indésirables (quarantine), le refus (reject). Les rapports
    (rua=) montrent qui envoie au nom du domaine : ici, le prestataire de
    la lettre, mal aligné, et un usurpateur.

    LA BONNE PRATIQUE
    - Commencer par p=none avec rua=, lire les rapports, aligner chaque
      service qui envoie au nom du domaine, puis seulement quarantine,
      puis reject.
    - Un prestataire s'aligne par DKIM (un CNAME vers sa clé, d=votre
      domaine) ou par SPF (une adresse de retour dans votre domaine).
    - Un seul enregistrement DMARC, sous _dmarc.domaine ; augmenter le
      serial, vérifier ce que voit internet.
    - pct= permet de durcir peu à peu (pct=25, puis 100).

    LA DOCUMENTATION
    - DMARC, la RFC 7489 : https://www.rfc-editor.org/rfc/rfc7489
    - Le format des rapports agrégés : https://www.rfc-editor.org/rfc/rfc7489#appendix-C
    - L'alignement : https://www.rfc-editor.org/rfc/rfc7489#section-3.1
