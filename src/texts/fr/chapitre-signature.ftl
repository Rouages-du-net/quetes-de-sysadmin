### Histoire « Le courrier indésirable », chapitre 2 « La signature » : DKIM
### avec OpenDKIM. Les commandes, chemins, directives et messages ne se
### traduisent pas.

chapter-signature = La signature
    .resume = Les courriels arrivent, mais dans les indésirables : signer avec DKIM (OpenDKIM, le milter de Postfix, la clé dans le DNS).

## Fichiers

signature-message-nour =
    Bonjour !

    Les courriels de bienvenue arrivent, merci. Mais chez mailbox.example,
    ils tombent dans les indésirables. Leur page d'aide dit qu'un
    expéditeur sérieux doit avoir SPF et DKIM.

    J'ai installé opendkim hier (sudo apt install opendkim opendkim-tools),
    sans rien configurer : le fichier est /etc/opendkim.conf, et Debian
    range les clés dans /etc/dkimkeys.

    Une amie m'a donné une adresse qui répond avec ce qu'elle voit d'un
    courriel (SPF, DKIM, DMARC) :
    echo test | mail -s test check-auth@verifier.example
    La réponse arrive dans ta boîte, sur ce serveur (la commande mail,
    sans argument, la liste ; la boîte elle-même est /var/mail/ton_compte).

    Le mot de passe pour sudo reste semis-2027.

    Nour

## Événements

signature-event-check =
    Le vérificateur a répondu : SPF passe, mais « DKIM check: none » : les
    courriels ne sont pas signés. DKIM, c'est une signature ajoutée à chaque
    message avec une clé privée, que le destinataire vérifie avec la clé
    publique publiée dans le DNS (sélecteur._domainkey.gardens.example).
    Sur Debian, c'est opendkim qui signe, branché sur Postfix comme
    « milter ». Commence par la paire de clés : man opendkim-genkey.
signature-event-key =
    Une clé privée dans /etc/dkimkeys. opendkim-genkey a aussi écrit, à côté,
    un fichier .txt : l'enregistrement DNS à publier, avec la clé publique.
    Regarde qui possède la clé privée (ls -l) : opendkim tourne sous le
    compte opendkim, et doit pouvoir la lire.
signature-event-unreadable =
    opendkim ne démarre pas : « Permission denied » sur la clé privée. Elle
    appartient à root (c'est root qui l'a créée), avec les droits
    rw------- : le compte opendkim ne peut pas la lire. Donne-la-lui :
    sudo chown opendkim:opendkim /etc/dkimkeys/…private
signature-event-not-sure =
    opendkim refuse la clé : « key data is not secure ». Une clé privée
    lisible par d'autres comptes n'est plus secrète, et opendkim
    (RequireSafeKeys) refuse de s'en servir. Rends-la lisible par son seul
    propriétaire : sudo chmod 600 …
signature-event-opendkim =
    opendkim tourne avec la clé et le domaine. Mais il ne signe que ce que
    Postfix lui passe : il faut brancher le milter dans
    /etc/postfix/main.cf (man postconf, et MILTER_README). L'adresse de la
    prise doit correspondre au Socket d'opendkim.conf, chacun avec sa
    syntaxe.
signature-event-chroot =
    « connect to Milter service unix:… : No such file or directory » : sur
    Debian, Postfix tourne enfermé dans /var/spool/postfix (chroot). Un
    chemin comme /run/opendkim/opendkim.sock, pour lui, est
    /var/spool/postfix/run/opendkim/opendkim.sock, qui n'existe pas. Le
    commentaire d'opendkim.conf le dit : soit une prise dans
    /var/spool/postfix, soit une prise réseau (Socket inet:8891@localhost,
    et inet:localhost:8891 côté Postfix).
signature-event-socket =
    « connect to Milter service inet:… : Connection refused » : Postfix ne
    trouve personne à cette adresse. opendkim tourne-t-il, et écoute-t-il
    sur ce port ? Attention aux deux syntaxes : inet:8891@localhost dans
    opendkim.conf, inet:localhost:8891 dans main.cf.
signature-event-smtpd-only =
    smtpd_milters ne concerne que le courrier qui arrive par le réseau
    (SMTP). Les courriels du site et de la commande mail sont déposés sur
    la machine : ils passent par non_smtpd_milters. Pour signer les deux :
    non_smtpd_milters = $smtpd_milters.
signature-event-milter =
    Postfix passe maintenant le courrier à opendkim, qui le signe
    (« DKIM-Signature field added » dans /var/log/mail.log). Reste à publier
    la clé publique dans la zone, sinon personne ne peut vérifier la
    signature. opendkim-testkey vérifie la clé publiée.
signature-event-not-secure =
    « key not secure » n'est pas une erreur : opendkim-testkey dit
    seulement que la réponse du DNS n'est pas protégée par DNSSEC. Ce qui
    compte, c'est la ligne suivante : « key OK ».
signature-event-serial =
    Le serveur de la machine publie la clé, mais le secondaire du registre
    ne l'a pas : as-tu augmenté le serial de la zone ? dig TXT
    mail._domainkey.gardens.example @ns2.registry.example
signature-event-end =
    Les courriels des Jardins sont signés, et internet peut vérifier la
    signature avec la clé publiée. Nour : « mailbox.example les met dans la
    boîte de réception, enfin ! »

    Bravo ! Tu as terminé le chapitre « La signature ».

    CE QUI S'EST PASSÉ
    DKIM ajoute à chaque courriel une signature, calculée avec une clé
    privée que seul le serveur connaît ; le destinataire la vérifie avec la
    clé publique, publiée dans le DNS sous sélecteur._domainkey.domaine. Un
    message modifié en route, ou envoyé par quelqu'un d'autre, ne passe
    pas. opendkim signe ; Postfix lui passe le courrier (milter) ; le DNS
    publie la clé.

    LA BONNE PRATIQUE
    - La clé privée appartient au compte du service (opendkim), lisible par
      lui seul (600) ; jamais copiée ailleurs.
    - non_smtpd_milters pour le courrier déposé sur la machine,
      smtpd_milters pour celui qui arrive par SMTP ; milter_default_action
      = accept pour ne pas bloquer le courrier si opendkim s'arrête.
    - Un sélecteur par clé (mail, 2027…) : pour changer de clé, en publier
      une nouvelle à côté, puis retirer l'ancienne.
    - opendkim-testkey, puis un vrai courriel vers un vérificateur.

    LA DOCUMENTATION
    - DKIM, la RFC 6376 : https://www.rfc-editor.org/rfc/rfc6376
    - Postfix et les milters : https://www.postfix.org/MILTER_README.html
    - OpenDKIM : http://www.opendkim.org/opendkim.conf.5.html
