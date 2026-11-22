### Histoire « La Station de sauvetage », chapitre « Boîte pleine » : la
### boîte de Saoirse dépasse son quota et son courrier rebondit. Le quota de
### Dovecot (maildirsize, doveadm quota), la userdb, doveadm expunge avec
### une requête, un avertissement de quota. Commandes, options, chemins,
### réglages et sorties ne sont pas traduits.

chapter-mailbox-full = Boîte pleine
    .summary = Depuis samedi, la responsable des collectes de la station ne reçoit plus rien, et ses mécènes voient leurs messages revenir. Trouve pourquoi le serveur de courrier refuse son courrier, fais de la place comme il faut, et fais en sorte qu'elle soit prévenue la prochaine fois.

## Fichiers

mailbox-full-message-marisol =
    De : Marisol (présidente, Station de sauvetage de Seaholme)
    Mardi 16 septembre, 9 h 10

    Bonjour, et merci de nous aider !

    Saoirse, qui s'occupe de nos collectes, n'a pas reçu un seul courriel
    depuis samedi. Pire : Amara, de la shipchandlerie qui parraine notre
    appel d'hiver, m'a transféré le message qui lui est revenu, « Mail
    delivery failed ». Nous sommes en pleine campagne d'hiver.

    Notre serveur de courrier, c'est cale, où tu es maintenant ; sudo
    marche avec ton mot de passe. Yerlan l'a installé il y a des années et
    a laissé un mot. Le bureau a accepté hier de donner 2 Go à Saoirse au
    lieu de 1, puisqu'elle reçoit toutes les photos et les documents des
    mécènes ; mais n'ouvre pas les vannes pour tout le monde, s'il te plaît.

    Marisol

mailbox-full-note-yerlan =
    Notes de Yerlan (cale, 2028, quelques mises à jour depuis)

    - Postfix reçoit le courrier de lifeboat.example et le donne à Dovecot
      par LMTP (virtual_transport dans /etc/postfix/main.cf). Tout est
      écrit dans /var/log/mail.log.
    - Dovecot range le courrier de chacun·e dans
      /var/vmail/lifeboat.example/NOM/Maildir, qui appartient à vmail. Les
      dossiers sont .Trash, .Sent… dans le Maildir.
    - Les utilisateur·rices sont dans /etc/dovecot/users (passwd-file : une
      ligne chacun·e, des champs en plus à la fin, comme userdb_quelquechose=valeur).
    - La configuration : /etc/dovecot/conf.d/*.conf. doveconf -n montre ce
      que Dovecot lit ; après un changement, sudo doveadm reload (ou
      systemctl reload dovecot).
    - Tout le monde a 1G de quota (90-quota.conf). J'ai pris le quota
      Maildir++, comme sur l'ancien serveur : l'occupation est tenue dans un
      fichier appelé maildirsize.
    - doveadm fait tout, en root : doveadm quota, doveadm mailbox,
      doveadm expunge… (man doveadm).

    Yerlan

## Événements

mailbox-full-event-bounces =
    Voilà : chaque message pour saoirse@lifeboat.example finit par « 552
    5.2.2 … Quota exceeded (mailbox for user is full) », status=bounced, et
    Postfix renvoie un avis de non-remise à l'expéditeur·rice. Le LMTP de
    Dovecot refuse d'enregistrer le message parce que sa boîte dépasse son
    quota. Elle est pleine à quel point, et qu'est-ce qui prend la place ?
    (man doveadm : quota get.)
mailbox-full-event-quota-get =
    Le quota se compte en kilo-octets : Value, ce qu'elle occupe, Limit, ce
    qu'elle peut occuper. Elle dépasse 100 %. Une fois une boîte au-delà de
    sa limite, Dovecot refuse tout nouveau message (la marge, storage
    grace, ne laisse passer qu'un seul message au-delà). Lesquels de ses
    dossiers prennent cette place ? (doveadm mailbox status avec messages
    et vsize, ou du sur le Maildir.)
mailbox-full-event-trash =
    Sa corbeille contient des centaines de mégaoctets : les photos des
    portes ouvertes de 2029 et 2030, supprimées mais jamais vidées. doveadm
    peut effacer les messages qui correspondent à une requête, pour une
    personne et une boîte (man doveadm, et man doveadm-search-query pour les
    dates : savedbefore, before, 2w, AAAA-MM-JJ…). Essaie d'abord la requête
    avec doveadm search.
mailbox-full-event-lost =
    Sa boîte de réception a perdu des messages : supprimer son courrier en
    bloc, ce n'est pas faire de la place, c'est perdre des documents de
    mécènes dont elle a encore besoin. Ici, recommence le chapitre (ou
    utilise l'instantané de secours) et n'enlève que ce qui est vieux et
    déjà dans la corbeille.
mailbox-full-event-unlimited =
    Quelqu'un n'a plus de quota du tout. Une boîte illimitée remplit le
    disque un jour, et alors plus personne ne reçoit rien. Marisol a
    demandé 2 Go pour Saoirse, pas pour tout le monde : garde une limite
    pour chacun·e.
mailbox-full-event-stale =
    Les fichiers sont partis, mais Dovecot croit toujours la boîte pleine :
    avec le quota Maildir++, l'occupation vit dans maildirsize, et Dovecot
    ne remarque pas les fichiers enlevés dans son dos. Les remises
    continuent de rebondir. Demande à Dovecot de recompter (man doveadm :
    quota recalc), et la prochaine fois, enlève le courrier par Dovecot
    (doveadm expunge), qui garde le compte juste.
mailbox-full-event-expunged =
    La vieille corbeille est partie, sa boîte de réception et ses envoyés
    sont intacts, et le compte du quota s'accorde avec les fichiers : il y
    a de nouveau de la place. Le prochain message pour elle sera enregistré.
mailbox-full-event-raised =
    La limite de Saoirse est maintenant celle que le bureau a acceptée, et
    seulement la sienne. Un champ en plus de la userdb
    (userdb_quota_storage_size=2G dans /etc/dovecot/users) remplace la
    configuration pour une seule personne ; doveadm user et doveadm quota
    get montrent ce que Dovecot va appliquer.
mailbox-full-event-delivered =
    Un message est arrivé dans la boîte de Saoirse : « stored mail into
    mailbox 'INBOX' » dans le journal, status=sent du côté de Postfix.
mailbox-full-event-warning =
    L'avertissement de quota est dans la configuration que Dovecot fait
    tourner : quand une boîte passe ce pourcentage, Dovecot lance le
    service quota-warning, qui écrit à la personne. Il ne se déclenche
    qu'au moment où le seuil est franchi.
mailbox-full-event-end =
    Marisol : « Saoirse a douze nouveaux messages, dont le dossier de
    parrainage d'Amara. J'ai dit à Amara de le renvoyer ; merci ! »

    Bravo ! Tu as terminé Boîte pleine.

    CE QUI S'EST PASSÉ
    La boîte de Saoirse avait atteint son quota de 1 Gio, surtout à cause
    d'une vieille corbeille pleine de photos. Le LMTP de Dovecot refusait
    chaque nouveau message avec « 552 5.2.2 Quota exceeded » et Postfix les
    renvoyait à leurs expéditeur·rices. Tu as trouvé les rebonds dans
    mail.log, mesuré la boîte avec doveadm, effacé la vieille corbeille
    avec une requête, donné à Saoirse les 2 Gio convenus dans la userdb
    plutôt qu'à tout le monde, et ajouté un avertissement pour qu'elle soit
    prévenue avant que ce soit plein.

    BONNES PRATIQUES
    - Lis d'abord le journal : le code de réponse (552 5.2.2) et la ligne
      de Dovecot disent exactement qui a refusé et pourquoi.
    - Enlève le courrier par Dovecot (doveadm expunge -u PERSONNE mailbox
      Trash savedbefore 365d), teste la requête avec doveadm search, et ne
      supprime jamais de fichiers à la main dans un Maildir : le quota et
      les index seraient faux (doveadm quota recalc corrige le compte).
    - Un quota par personne, depuis la userdb ; pas de boîte illimitée.
    - Préviens avant que ce soit plein (quota_warning), et pense à
      quota_full_tempfail = yes : une boîte pleine diffère alors le
      courrier (4.2.2) au lieu de le renvoyer, ce qui laisse quelques jours
      pour réagir.
    - Pour un nouveau serveur, Dovecot recommande le pilote de quota count
      plutôt que Maildir++.

    DOCUMENTATION
    - Le greffon quota : https://doc.dovecot.org/2.4.1/core/plugins/quota.html
    - doveadm quota : https://doc.dovecot.org/2.4.1/core/man/doveadm-quota.1.html
    - doveadm expunge : https://doc.dovecot.org/2.4.1/core/man/doveadm-expunge.1.html
    - Les requêtes : https://doc.dovecot.org/2.4.1/core/man/doveadm-search-query.7.html
    - passwd-file et ses champs en plus : https://doc.dovecot.org/2.4.1/core/config/auth/databases/passwd_file.html

## Ce que les trois chapitres partagent, gardé ici pour se charger avec
## l'histoire : le courrier qui arrive sur cale (sujets, corps, les mots
## dont chaque sorte de courrier est faite). Une liste est séparée par |. Le
## Bayes de rspamd apprend ces mots : les listes du spam et du ham ne
## doivent pas se recouper.

lifeboat-month-names = janvier | février | mars | avril | mai | juin | juillet | août | septembre | octobre | novembre | décembre
lifeboat-visit-months = novembre | décembre | mars | avril
lifeboat-schools = l'école du Port | l'école Saint-Brendan | les scouts de Northcliff | les cadets de la mer de Seaholme | le collège de Westbay | la crèche des Rochers | les rangers de la Falaise
lifeboat-words-ham = visite | station | groupe | enfants | samedi | abri du canot | équipage | entraînement | sortie | planning | bénévoles | don | tombola | goûter | enseignants | pique-nique | parking | port | gilets | exercice | marée | merci | matinée | après-midi | billets | cadeau | boutique | café | minibus
lifeboat-crew-whats = sortie | entraînement | exercice | manœuvre du tracteur
lifeboat-crew-days = samedi | dimanche | mercredi
lifeboat-mail-booking-subject = Demande de visite : { $school }, le { $day } { $month }
lifeboat-mail-booking-body =
    Bonjour,

    Nous aimerions venir avec un groupe de { $school } pour visiter la station et l'abri du canot, environ { $children } enfants et quatre enseignants. Pourrions-nous réserver une visite le { $day }, le matin si la marée le permet ? Nous apporterons notre pique-nique.

    Remarques : { $notes }.

    Merci beaucoup,
    { $name }
lifeboat-mail-crew-subject = Planning de l'équipage : { $what } { $day }
lifeboat-mail-crew-body =
    Bonjour à toutes et à tous,

    Le planning de la prochaine { $what } est affiché au tableau de la station. Vérifiez vos gilets et dites-moi si vous ne pouvez pas venir.

    Remarques : { $notes }.

    { $name }

lifeboat-words-phish = vérifier | compte | suspendu | messagerie | identifiants | immédiatement | confirmer | connexion | protection | désactivation | stockage | quota | augmenter | valider | authentification | restaurer | accès | expiration
lifeboat-mail-phish-name = Administrateur de messagerie
lifeboat-mail-phish-subjects = Action requise : votre boîte va être suspendue | Limite de stockage de la messagerie atteinte | Confirmez votre compte afin d'éviter sa désactivation
lifeboat-mail-phish-body = <html><body><p>Cher utilisateur { $name },</p><p>Votre messagerie { $domain } a atteint sa limite de stockage et va être suspendue. { $words }.</p><p><a href="{ $link }">Vérifier votre compte</a></p><p>Administrateur de messagerie { $domain }</p></body></html>
lifeboat-words-invoice = facture | paiement | impayée | échéance | virement | règlement | montant | solde | pénalité | référence | urgent | comptabilité | relance | dernière | pénalités
lifeboat-mail-invoice-name = Service comptable
lifeboat-mail-invoice-subjects = FACTURE IMPAYÉE - DERNIÈRE RELANCE | RAPPEL DE PAIEMENT - ACTION URGENTE | SOLDE DÛ À RÉGLER
lifeboat-mail-invoice-body = <html><body><p>Bonjour,</p><p>Veuillez trouver ci-joint la dernière relance de la facture impayée { $number }. { $words }.</p><p>Service comptable</p></body></html>
lifeboat-words-prize = gagnant | lot | réclamer | récompense | crypto | portefeuille | bonus | jackpot | chanceux | tirage | sélectionné | félicitations | exclusif | bon d'achat | gratuit
lifeboat-mail-prize-name = Grand Tirage
lifeboat-mail-prize-subjects = Vous avez GAGNÉ ! | Réclamez votre bonus crypto maintenant ! | Votre récompense exclusive vous attend !
lifeboat-mail-prize-body = <html><body><img src="{ $image }"><p>Félicitations ! Vous avez été sélectionné à notre tirage { $draw }.</p><p><a href="{ $claim }">Réclamez votre récompense</a></p><p>{ $words }</p><p><a href="{ $unsubscribe }">Se désabonner</a></p></body></html>

lifeboat-mail-bulletin-subject = Bulletin de sécurité Coastwatch : météo et marées, { $day } { $month }
lifeboat-mail-bulletin-body = <html><body><img src="{ $image }"><p>Bulletin de sécurité Coastwatch, { $day } { $month } : avis de coup de vent sur la baie extérieure à partir de ce soir, grandes marées ce week-end, les prévisions pour le port.</p><p><a href="{ $link }">Lire le bulletin complet</a></p><p><a href="{ $unsubscribe }">Se désabonner</a></p></body></html>

lifeboat-list-topics = les dates des entraînements d'hiver | les nouveaux bipeurs | le renouvellement de l'assurance | la journée portes ouvertes régionale | le prix du carburant
lifeboat-mail-list-name = Fédération des stations côtières
lifeboat-mail-list-subject = {"["}stations{"]"} À propos de { $topic }
lifeboat-mail-list-body =
    Chères stations,

    Un petit mot à propos de { $topic } : les détails à la prochaine réunion.

    --
    liste de diffusion stations
    stations@lists.coastfed.example

lifeboat-mail-attachment-body =
    Bonjour Saoirse,

    { $subject } : les fichiers sont en pièce jointe.

    Pièce jointe : { $file }
lifeboat-mail-photos-subject = Photos des portes ouvertes, lot { $n }
lifeboat-mail-poster-subject = Projet d'affiche { $n }
lifeboat-mail-saoirse-subjects = Formulaire de parrainage | Lots de la tombola | Photos de la fête d'été | Demande de subvention | Baptême du canot
lifeboat-mail-sent-subject = Re: Fête d'été, partie { $n }
lifeboat-mail-sponsor-0-subject = Votre dossier de parrainage pour l'appel d'hiver
lifeboat-mail-sponsor-1-subject = Le formulaire signé pour le baptême du canot
lifeboat-mail-sponsor-2-subject = Les photos de la fête d'été
lifeboat-mail-sponsor-3-subject = Subvention : les documents demandés
lifeboat-mail-sponsor-4-subject = Les lots de tombola de la shipchandlerie
lifeboat-mail-sponsor-0-body =
    Bonjour Saoirse,

    { $subject } : en pièce jointe, comme promis.

    Pièce jointe : { $file }
    { $name }
lifeboat-mail-sponsor-1-body =
    Bonjour Saoirse,

    { $subject } : en pièce jointe, comme promis.

    Pièce jointe : { $file }
    { $name }
lifeboat-mail-sponsor-2-body =
    Bonjour Saoirse,

    { $subject } : en pièce jointe, comme promis.

    Pièce jointe : { $file }
    { $name }
lifeboat-mail-sponsor-3-body =
    Bonjour Saoirse,

    { $subject } : en pièce jointe, comme promis.

    Pièce jointe : { $file }
    { $name }
lifeboat-mail-sponsor-4-body =
    Bonjour Saoirse,

    { $subject } : en pièce jointe, comme promis.

    Pièce jointe : { $file }
    { $name }

lifeboat-mail-raffle-subject = Les billets de tombola
lifeboat-mail-raffle-body =
    Bonjour Leilani,

    Les billets de tombola sont imprimés : je les apporte samedi ?

    { $name }
lifeboat-mail-shop-subject = Samedi à la boutique
lifeboat-mail-shop-body =
    Bonjour Leilani,

    Peux-tu ouvrir la boutique samedi matin ?

    { $name }
lifeboat-mail-tyres-subject = Facture des nouveaux pneus du tracteur
lifeboat-mail-tyres-body =
    Bonjour Aziz,

    Voici notre facture pour les pneus du tracteur.

    { $name }
lifeboat-mail-fuel-subject = Reçu pour le carburant
lifeboat-mail-fuel-body =
    Bonjour Aziz,

    Voici le reçu du carburant de la dernière sortie.

    { $name }
lifeboat-mail-year-end-subject = Comptes de fin d'année
lifeboat-mail-year-end-body =
    Bonjour,

    Le trésorier pourrait-il nous envoyer les relevés bancaires pour les comptes de fin d'année ?

    { $name }
lifeboat-mail-gift-aid-subject = Reçu fiscal des dons
lifeboat-mail-gift-aid-body =
    Cher trésorier,

    Le formulaire des reçus fiscaux doit être signé ce mois-ci.

    { $name }

lifeboat-holiday-comment = Aziz, août 2030 (écrit par Yerlan) : « dis-leur que je suis absent »
lifeboat-holiday-reply = Je suis absent jusqu'au 25 août. Pour toute urgence, écrivez à Marisol.
