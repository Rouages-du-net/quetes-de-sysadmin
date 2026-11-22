### Indices gradués de La Station de sauvetage (voir src/engine/hints.ts) :
### un message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Boîte pleine

hint-mailbox-full-bounces =
    .lead = Que sont devenus les derniers messages envoyés à Saoirse ? Postfix et Dovecot écrivent chaque remise dans le journal du courrier.
    .solution = sudo grep saoirse /var/log/mail.log | tail
hint-mailbox-full-quota-get =
    .lead = Combien de son quota occupe-t-elle ? doveadm a une commande pour le quota d'une personne (man doveadm).
    .solution = sudo doveadm quota get -u saoirse@lifeboat.example
hint-mailbox-full-trash =
    .lead = Lequel de ses dossiers prend la place ? Demande à doveadm la taille de chaque boîte, ou mesure son Maildir.
    .solution = sudo doveadm mailbox status -u saoirse@lifeboat.example "messages vsize" "*" (ou sudo du -sh /var/vmail/lifeboat.example/saoirse/Maildir/.[A-Z]*)
hint-mailbox-full-expunged =
    .lead = Efface les vieux messages de sa corbeille par Dovecot, avec une requête sur leur date (man doveadm, man doveadm-search-query) ; essaie d'abord la requête avec doveadm search.
    .solution = sudo doveadm expunge -u saoirse@lifeboat.example mailbox Trash savedbefore 2031-01-01
hint-mailbox-full-raised =
    .lead = Donne à Saoirse, et à elle seule, les 2 Go que le bureau a acceptés : la userdb de Dovecot peut porter des réglages par personne.
    .solution = sudo nano /etc/dovecot/users : ajoute userdb_quota_storage_size=2G au bout de la ligne de Saoirse ; vérifie avec sudo doveadm quota get -u saoirse@lifeboat.example
hint-mailbox-full-delivered =
    .lead = Une fois la place faite, le prochain message pour elle est enregistré : regarde le journal.
    .solution = sudo tail -n 5 /var/log/mail.log (cherche « stored mail into mailbox 'INBOX' »)
hint-mailbox-full-warning =
    .lead = 90-quota.conf contient un exemple d'avertissement de quota, en commentaire, et le service qu'il lance existe déjà. Active-le, vérifie, recharge Dovecot.
    .solution = sudo nano /etc/dovecot/conf.d/90-quota.conf (décommente le bloc quota_warning warn-90), puis sudo doveconf -n | grep -A5 quota_warning et sudo doveadm reload
hint-mailbox-full-end =
    .lead = Vérifie tout : son quota, la corbeille, le compte (doveadm quota recalc si des fichiers ont été enlevés à la main), l'avertissement dans la configuration en service.
    .solution = sudo doveadm quota get -u saoirse@lifeboat.example ; sudo doveadm quota recalc -u saoirse@lifeboat.example ; sudo doveadm reload

## Chapitre 2 — Marée de spam

hint-spam-tide-scores =
    .lead = Comment rspamd note-t-il ces messages ? Son journal a une ligne par message, et rspamc peut analyser un message enregistré (man rspamc).
    .solution = sudo tail -n 3 /var/log/rspamd/rspamd.log ; ou sudo rspamc symbols sur un fichier de la boîte de Leilani (/var/vmail/lifeboat.example/leilani/Maildir/cur/…)
hint-spam-tide-thresholds =
    .lead = Regarde les seuils des actions que Yerlan a changés, remets les valeurs par défaut de rspamd, vérifie la configuration et recharge rspamd.
    .solution = sudo nano /etc/rspamd/local.d/actions.conf (reject = 15; add_header = 6; greylist = 4;), sudo rspamadm configtest, sudo systemctl reload rspamd
hint-spam-tide-bulletin-junk =
    .lead = Pourquoi le bulletin dépasse-t-il add_header ? Lis ses symboles, et vois lesquels viennent de la plateforme par laquelle il est envoyé.
    .solution = sudo grep coastwatch /var/log/rspamd/rspamd.log | tail -n 1
hint-spam-tide-whitelist =
    .lead = Fais confiance à l'adresse From: du bulletin, rien de plus large : une règle multimap de type from (attention : expéditeur SMTP par défaut) ou une règle settings (from_mime), dans local.d.
    .solution = local.d/multimap.conf : WHITELIST_COASTWATCH {"{"} type = "from"; extract_from = "mime"; map = "/etc/rspamd/local.d/coastwatch.map"; score = -6.0; {"}"}, la carte contenant news@coastwatch.example ; rspamadm configtest ; systemctl reload rspamd
hint-spam-tide-bayes =
    .lead = Bayes a besoin d'assez d'exemples des deux classes : Leilani a déjà trié du spam dans Junk, et gardé ses réservations dans Archive.
    .solution = sudo rspamc learn_spam /var/vmail/lifeboat.example/leilani/Maildir/.Junk/cur/ et sudo rspamc learn_ham /var/vmail/lifeboat.example/leilani/Maildir/.Archive/cur/ ; puis rspamc stat
hint-spam-tide-caught =
    .lead = Vérifie sur de nouveaux messages : l'hameçonnage, les factures et les prix sont-ils maintenant marqués comme spam ? Le journal montre l'action de chaque nouveau message.
    .solution = sudo tail -n 4 /var/log/rspamd/rspamd.log (cherche add header) ; sudo rspamc stat
hint-spam-tide-end =
    .lead = Tout à la fois : le milter dans main.cf, des seuils sensés, Bayes entraîné, le bulletin sans action, rien en liste blanche dont le spam puisse profiter.
    .solution = postconf smtpd_milters ; sudo rspamadm configdump actions multimap ; sudo rspamc stat

## Chapitre 3 — Le Centre de tri

hint-sorting-office-read-old =
    .lead = Yerlan parle d'un vieux script d'Aziz : regarde ses scripts Sieve.
    .solution = sudo doveadm sieve list -u aziz@lifeboat.example ; sudo cat /var/vmail/lifeboat.example/aziz/sieve/holiday.sieve
hint-sorting-office-folder =
    .lead = Écris pour Leilani un script qui range les messages pour bookings@ dans Bookings (fileinto, :create), vérifie-le, et fais-en son script actif.
    .solution = require ["fileinto", "mailbox", "envelope"]; if envelope :is "to" "bookings@lifeboat.example" {"{"} fileinto :create "Bookings"; {"}"} — sudo doveadm sieve put -a -u leilani@lifeboat.example tri < tri.sieve
hint-sorting-office-sorted-live =
    .lead = Attends la prochaine réservation et regarde ce que LMTP en a fait.
    .solution = sudo grep -E "Bookings|bookings@" /var/log/mail.log | tail
hint-sorting-office-vacation =
    .lead = Une réponse d'absence, c'est l'extension vacation (RFC 5230) : écris à Aziz un script qui l'utilise, teste-le sur les exemples (sieve-test), active-le.
    .solution = require ["vacation"]; vacation :days 7 :subject "Absent jusqu'au 24 novembre" "Je suis absent jusqu'au 24 novembre ; pour toute urgence, écrivez à marisol@lifeboat.example."; — puis sudo sieve-test absence.sieve exemple-liste.eml et doveadm sieve put -a
hint-sorting-office-alias =
    .lead = Un message à treasurer@ n'a pas de réponse : vacation ne répond qu'au courrier adressé à la personne. Donne-lui son autre adresse.
    .solution = vacation :days 7 :addresses ["treasurer@lifeboat.example"] :subject "…" "…";
hint-sorting-office-replied-live =
    .lead = Attends un vrai message pour Aziz et cherche la réponse dans le journal.
    .solution = sudo grep "vacation response" /var/log/mail.log | tail
hint-sorting-office-end =
    .lead = Les deux scripts actifs, chacun testé, chacun vu au travail sur du vrai courrier.
    .solution = sudo doveadm sieve list -u leilani@lifeboat.example ; sudo doveadm sieve list -u aziz@lifeboat.example ; sudo tail /var/log/mail.log
