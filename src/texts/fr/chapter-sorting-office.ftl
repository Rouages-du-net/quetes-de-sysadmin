### Histoire « La Station de sauvetage », chapitre « Le Centre de tri » :
### des filtres Sieve avec Pigeonhole (Dovecot) : fileinto pour bookings@,
### une réponse d'absence qui répond à un alias mais pas à une liste de
### diffusion. sievec, sieve-test, doveadm sieve, le script actif, la
### remise par LMTP. Commandes, options, chemins, code Sieve et sorties ne
### sont pas traduits.

chapter-sorting-office = Le Centre de tri
    .summary = Les visites scolaires d'hiver commencent, et la secrétaire veut les réservations dans leur propre dossier ; le trésorier part trois semaines et a besoin d'une réponse d'absence qui réponde aux gens, pas aux listes de diffusion. Écris les scripts Sieve, vérifie-les, fais-en les scripts actifs, et regarde le nouveau courrier aller où il doit.

## Fichiers

sorting-office-message-marisol =
    De : Marisol (présidente, Station de sauvetage de Seaholme)
    Lundi 3 novembre, 9 h 05

    Rebonjour !

    Deux petites choses avant l'hiver :

    1. Leilani : tout ce qui est écrit à bookings@lifeboat.example arrive
       dans sa boîte (c'est un alias), mélangé au reste. Elle voudrait que
       ça aille dans un dossier appelé Bookings, et son autre courrier là
       où il est maintenant.

    2. Aziz, notre trésorier, est absent jusqu'au 24 novembre. Il voudrait
       une réponse automatique (« Je suis absent jusqu'au 24, écrivez à
       Marisol pour toute urgence »), aux gens qui lui écrivent, et aussi à
       ceux qui écrivent à treasurer@, qui lui arrive aussi. L'an dernier,
       sa réponse est partie sur la liste de diffusion de la fédération et
       deux cents stations l'ont reçue, deux fois : plus jamais, s'il te
       plaît. Yerlan dit qu'il y a un vieux script à lui quelque part.

    J'ai mis deux messages d'exemple dans ton dossier, pour essayer.

    Marisol

sorting-office-note-yerlan =
    Notes de Yerlan (Sieve sur cale)

    - Dovecot passe le courrier dans des scripts Sieve quand il le remet
      (LMTP, greffon sieve) : d'abord les scripts globaux
      (/etc/dovecot/sieve/before.d : le spam dans Junk), puis le script
      actif de la personne.
    - Les scripts d'une personne sont dans ~/sieve/NOM.sieve (dossier :
      /var/vmail/lifeboat.example/NOM) ; l'actif est celui vers lequel
      pointe ~/.dovecot.sieve (90-sieve.conf). sudo doveadm sieve list -u
      PERSONNE les montre, doveadm sieve activate en choisit un.
    - sievec FICHIER vérifie et compile un script ; sieve-test SCRIPT
      MESSAGE dit ce qu'il ferait d'un message, sans le remettre.
    - Les fichiers sous /var/vmail appartiennent à vmail (5000) : Dovecot
      doit pouvoir lire ce que tu y mets.
    - Le langage : RFC 5228 (if, header, address, envelope, fileinto,
      stop), RFC 5230 pour vacation. man sievec, man sieve-test.

    Yerlan

## Événements

sorting-office-event-read-old =
    C'est le script de l'an dernier : reject ne répond pas en gardant le
    message, il le refuse. Tous les messages pour Aziz seraient perdus, et
    le refus repart vers l'expéditeur de l'enveloppe, y compris l'adresse
    de la liste de diffusion. Une réponse d'absence, c'est ce que fait
    l'extension vacation (RFC 5230) : elle garde le message et répond une
    fois à chaque personne.
sorting-office-event-syntax =
    Le compilateur s'est arrêté à la ligne qu'il donne : un point-virgule
    oublié, une commande mal écrite, ou une extension utilisée sans son
    require. Pigeonhole signale la première erreur ; corrige-la et compile
    de nouveau (sievec) avant d'activer.
sorting-office-event-reject-live =
    Un message pour Aziz a été refusé, et le refus a répondu à son
    expéditeur : c'est comme ça que la réponse de l'an dernier est arrivée
    sur la liste. Désactive ce script (doveadm sieve deactivate, ou un
    autre script activé) et utilise vacation.
sorting-office-event-not-active =
    Le script est écrit, mais aucun message n'y passe : ce n'est pas le
    script actif (~/.dovecot.sieve ne pointe pas vers lui). doveadm sieve
    activate -u PERSONNE NOM le rend actif (ou, dans le dossier de la
    personne, ln -s sieve/NOM.sieve .dovecot.sieve, à vmail).
sorting-office-event-folder =
    Le script de Leilani range un message pour bookings@ dans Bookings et
    laisse un message direct dans sa boîte de réception (le même résultat
    que montrerait sieve-test). Le dossier existe, ou fileinto :create le
    crée (require "mailbox").
sorting-office-event-sorted-live =
    Une vraie réservation est arrivée : « fileinto action: stored mail into
    mailbox 'Bookings' » dans mail.log. Le test avait raison, et LMTP a
    fait pareil.
sorting-office-event-alias-missing =
    Le script d'Aziz répond à un message envoyé à aziz@, mais pas à un
    message envoyé à treasurer@ : la commande vacation ne répond que si une
    des adresses de la personne est dans To ou Cc, et treasurer@ est un
    alias, pas son adresse (« discarding vacation response for implicitly
    delivered message » dans le journal). L'étiquette :addresses liste ses
    autres adresses.
sorting-office-event-vacation =
    Le vacation d'Aziz répond à un message direct et le garde dans sa boîte
    de réception. Vacation se tait aussi tout seul là où il faut : listes de
    diffusion (List-Id…), messages automatiques (Auto-Submitted), envois en
    masse, MAILER-DAEMON, et la même personne deux fois en moins de :days.
sorting-office-event-alias =
    Sa réponse couvre aussi treasurer@, et le message de la liste n'en
    reçoit pas : la commande vacation voit son en-tête List-Id.
sorting-office-event-replied-live =
    Un vrai message pour Aziz a eu sa réponse : « sent vacation response to
    <…> » dans mail.log. Le prochain de la même personne n'en aura pas
    pendant :days jours.
sorting-office-event-end =
    Marisol : « Leilani a trouvé trois réservations scolaires dans son
    nouveau dossier ce matin, et la réponse d'Aziz est partie au chantier
    naval et au comptable. Pas un mot à la fédération. Merci ! »

    Bravo ! Tu as terminé Le Centre de tri.

    CE QUI S'EST PASSÉ
    Le courrier se trie au moment de la remise : le LMTP de Dovecot fait
    passer les scripts Sieve globaux, puis le script actif de la personne.
    Tu as écrit un script qui range les messages pour bookings@ dans leur
    propre dossier et un autre qui répond aux correspondant·es d'Aziz
    pendant son absence, alias compris et listes de diffusion laissées
    tranquilles, tu les as vérifiés avec sievec et sieve-test, activés, et
    tu as regardé le nouveau courrier y passer.

    BONNES PRATIQUES
    - Une réponse d'absence, c'est vacation, jamais reject (qui refuse le
      message) ni redirect : vacation garde le courrier, répond une fois
      par personne et par :days, et se tait sur les listes et les messages
      automatiques.
    - Donne à vacation les autres adresses de la personne (:addresses)
      quand le courrier arrive par des alias.
    - Vérifie avant d'activer : sievec pour la syntaxe, sieve-test sur de
      vrais exemples pour le résultat ; puis regarde le journal au prochain
      vrai message.
    - Un seul script personnel est actif : doveadm sieve list montre lequel.

    DOCUMENTATION
    - Sieve (RFC 5228) : https://www.rfc-editor.org/rfc/rfc5228
    - Vacation (RFC 5230) : https://www.rfc-editor.org/rfc/rfc5230
    - Le greffon Sieve de Pigeonhole : https://doc.dovecot.org/2.4.1/core/plugins/sieve.html
    - Vacation dans Pigeonhole : https://doc.dovecot.org/2.4.1/core/config/sieve/extensions/vacation.html
    - doveadm sieve : https://doc.dovecot.org/2.4.1/core/man/doveadm-sieve.1.html
