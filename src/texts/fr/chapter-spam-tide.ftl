### Histoire « La Station de sauvetage », chapitre « Marée de spam » : le
### spam arrive dans la boîte de réception, un bulletin de sécurité légitime
### est rejeté. Les scores et actions de rspamd (rspamc symbols, rspamd.log,
### actions.conf), une liste blanche (multimap ou settings), Bayes (rspamc
### learn_spam, learn_ham). Commandes, options, chemins, symboles et
### sorties ne sont pas traduits.

chapter-spam-tide = Marée de spam
    .summary = Une marée d'hameçonnage et de fausses factures atteint la secrétaire de la station, tandis que le bulletin de sécurité des garde-côtes, que l'équipage lit avant chaque sortie, n'arrive plus. Lis comment le filtre note chaque message, remets ses seuils à leur place, fais confiance au bulletin et seulement à lui, et apprends au filtre à quoi ressemble le spam.

## Fichiers

spam-tide-message-leilani =
    De : Leilani (secrétaire, Station de sauvetage de Seaholme)
    Lundi 6 octobre, 8 h 40

    Bonjour,

    Deux choses, et la deuxième compte le plus.

    1. Ma boîte se noie : « votre boîte va être suspendue », des factures
       d'entreprises dont on n'a jamais entendu parler, des prix gagnés. Je
       les déplace à la main dans Junk tous les matins (deux cents à force),
       et il en arrive toujours.

    2. Le bulletin de sécurité Coastwatch (news@coastwatch.example) n'arrive
       plus depuis mai. L'équipage le lit avant chaque sortie : avis de coup
       de vent, marées. Coastwatch dit que ses courriels chez nous sont
       « rejetés comme spam ». Les réservations que j'ai archivées l'an
       dernier sont dans mon dossier Archive.

    Yerlan a changé quelque chose dans le filtre en mai, je crois.

    Leilani

spam-tide-note-yerlan =
    Notes de Yerlan (rspamd sur cale)

    - rspamd note chaque message qui arrive : Postfix le lui passe par le
      milter (smtpd_milters = inet:localhost:11332 dans main.cf).
    - Chaque règle qui correspond ajoute un symbole avec un score ; le total
      décide de l'action : no action, greylist, add header (le message
      reçoit « X-Spam: Yes » et le script Sieve global de Dovecot le range
      dans Junk), reject.
    - Ne jamais modifier /etc/rspamd/*.conf : les changements locaux vont
      dans /etc/rspamd/local.d/ (fusionnés avec les valeurs par défaut) ou
      override.d/ (qui les remplacent). Ensuite rspamadm configtest, et
      sudo systemctl reload rspamd.
    - Mai 2031 : tout le monde se plaignait des étiquettes [SPAM], alors
      j'ai bougé les seuils dans local.d/actions.conf. C'est plus calme.
    - rspamc parle au rspamd qui tourne : rspamc symbols FICHIER montre le
      score d'un message, rspamc stat les compteurs. Son journal :
      /var/log/rspamd/rspamd.log.
    - Bayes est en place (Redis), mais je ne l'ai jamais entraîné.

    Yerlan

## Événements

spam-tide-event-scores =
    Chaque ligne est un symbole et son score ; le total et l'action sont en
    haut (ou dans « (default: F (no action): [4.80/8.00] […]) » dans
    rspamd.log). L'hameçonnage fait environ 4,8 et les fausses factures
    6,9 : sous tous les seuils que Yerlan a laissés, ils passent sans
    marque. Le bulletin fait 8,89, au-dessus de reject = 8 : il est refusé
    à la porte. Que disent les seuils ? (local.d/actions.conf ; man rspamc,
    man rspamadm.)
spam-tide-event-milter-off =
    Postfix ne demande plus rien à rspamd : chaque message, spam ou non, va
    droit dans les boîtes, et personne ne voit même plus de score. Le
    milter est le seul chemin du filtre ; remets smtpd_milters (et postfix
    reload).
spam-tide-event-reject-low =
    Avec un reject aussi bas, presque tout est refusé, les réservations et
    le courrier de l'équipage compris : un message d'ami·e fait autour de
    zéro, parfois un peu plus. Un seuil est un équilibre : ne rejette que ce
    qui est sûrement du spam (15 par défaut), marque ce qui l'est
    probablement.
spam-tide-event-thresholds =
    Les seuils sont de nouveau sensés : greylist, add header, reject dans
    l'ordre croissant, assez écartés. Les fausses factures et les prix
    reçoivent maintenant « X-Spam: Yes » et vont dans Junk. L'hameçonnage
    (4,8) n'est que mis en liste grise : différé une fois, il revient cinq
    minutes plus tard et atteint toujours la boîte de réception. Le
    bulletin n'est plus rejeté, mais il atterrit dans Junk avec le spam.
spam-tide-event-bulletin-junk =
    Le dernier bulletin est allé dans le Junk de Leilani : à 8,89, il
    dépasse add_header. Regarde ses symboles : la plupart viennent de la
    plateforme d'envoi par laquelle il passe (sendwave.example : sur une
    liste de blocage, liens de suivi), la même que celle du spam des prix.
    Fais confiance à l'adresse du bulletin plutôt qu'à la plateforme (man
    rspamc ; les modules multimap et settings : docs.rspamd.com).
spam-tide-event-leak =
    Attention : cette règle baisse aussi le score du spam. Le spam des prix
    vient lui aussi de sendwave.example, avec un expéditeur SMTP chez
    sendwave.example : faire confiance à la plateforme (son domaine ou ses
    adresses) laisse passer son spam. Fais confiance à
    news@coastwatch.example, l'adresse de l'en-tête From:, et à rien
    d'autre (multimap : type = "from" avec extract_from = "mime" ; settings :
    from_mime).
spam-tide-event-whitelist =
    Le bulletin passe maintenant sans action, et la règle ne correspond à
    rien d'autre : l'expéditeur SMTP d'une lettre d'information est souvent
    l'adresse de retour de la plateforme, c'est pourquoi les cartes « from »
    regardent l'expéditeur SMTP par défaut et qu'il fallait extract_from =
    "mime".
spam-tide-event-poisoned =
    rspamd vient d'apprendre des réservations comme du spam : le dossier
    Archive contient les messages que Leilani garde, ceux à apprendre comme
    ham. Un message appris dans la mauvaise classe peut être appris de
    nouveau dans la bonne (rspamd le réapprend).
spam-tide-event-bayes =
    Bayes a maintenant assez de messages dans chaque classe (min_learns) :
    il classe chaque message d'après les mots qu'il a appris, et ajoute
    BAYES_SPAM ou BAYES_HAM.
spam-tide-event-caught =
    Un hameçonnage, une facture et un spam de prix tout neufs sont
    maintenant marqués comme spam (rspamc symbols sur de nouveaux messages :
    BAYES_SPAM fait passer l'hameçonnage au-dessus d'add_header).
spam-tide-event-end =
    Leilani : « Le Junk de ce matin a quarante messages, ma boîte de
    réception a les réservations, et l'équipage a eu l'avis de coup de vent
    avant la sortie de samedi. Merci ! »

    Bravo ! Tu as terminé Marée de spam.

    CE QUI S'EST PASSÉ
    Des seuils déplacés dans l'urgence laissaient passer sans marque le
    spam sous 8 et rejetaient tout ce qui était au-dessus, y compris un
    bulletin légitime envoyé par une plateforme que des spammeurs utilisent
    aussi. Tu as lu les scores, remis les seuils (reject 15, add header 6,
    greylist 4), fait confiance à l'adresse du bulletin plutôt qu'à sa
    plateforme, et entraîné Bayes avec le spam que Leilani avait déjà trié
    et les réservations qu'elle a archivées.

    BONNES PRATIQUES
    - Regarde les symboles avant de toucher aux seuils : rspamc symbols sur
      un message enregistré, ou la ligne de rspamd.log.
    - Les seuils : rejeter ce qui est sûrement du spam, marquer (add header)
      ce qui l'est probablement ; le dossier Junk de chacun·e est le filet
      de sécurité, un rejet ne l'est pas.
    - Une liste blanche aussi étroite que possible : une adresse, vérifiée
      si possible (DKIM, SPF) ; jamais toute une plateforme d'envoi ni un
      domaine que les spammeurs peuvent usurper.
    - Entraîne Bayes sur du courrier que des gens ont trié eux-mêmes, les
      deux classes, avec assez de messages (min_learns) ; garde le filtre
      sur le chemin (milter).
    - Les changements locaux dans local.d/ ou override.d/, vérifiés avec
      rspamadm configtest avant un reload.

    DOCUMENTATION
    - Actions et scores : https://docs.rspamd.com/configuration/metrics/
    - Le module multimap : https://docs.rspamd.com/modules/multimap/
    - Settings : https://docs.rspamd.com/configuration/settings/
    - Les statistiques (Bayes) : https://docs.rspamd.com/configuration/statistic/
    - Postfix et les milters : https://www.postfix.org/MILTER_README.html
