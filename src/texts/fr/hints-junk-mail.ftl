### Les indices gradués de l'histoire « Le courrier indésirable » : une
### piste, puis presque la réponse, pour chaque étape (voir indices.ts).

## Chapitre 1 — Le facteur

hint-postman-differs =
    .lead = Le courrier qui n'est pas parti attend dans la file de Postfix : mailq la montre, avec la réponse du serveur d'en face. /var/log/mail.log raconte chaque essai.
    .solution = mailq (ou postqueue -p), puis grep deferred /var/log/mail.log : mailbox.example répond 451, « neither SPF nor DKIM passed ».
hint-postman-old =
    .lead = SPF est un enregistrement TXT du domaine, qui commence par v=spf1 (man dig). Qui autorise-t-il à envoyer ?
    .solution = dig TXT gardens.example : « v=spf1 include:_spf.old-hosting.example -all », le SPF de l'ancien hébergeur.
hint-postman-spf =
    .lead = Le SPF est dans la zone de gardens.example, sur ce serveur (/etc/bind/zones). Il doit autoriser cette machine (mx, a ou ip4:203.0.113.30). Pour que le secondaire du registre le recopie, le serial doit augmenter.
    .solution = sudo nano /etc/bind/zones/db.gardens.example : remplacer l'include par mx (« v=spf1 mx -all ») et augmenter le serial ; sudo named-checkzone gardens.example /etc/bind/zones/db.gardens.example, sudo rndc reload, puis dig TXT gardens.example @ns2.registry.example
hint-postman-end =
    .lead = Le SPF est bon, mais Postfix ne réessaie qu'au bout de quelques minutes. man postqueue.
    .solution = sudo postqueue -f, puis mailq : « Mail queue is empty ».

## Chapitre 2 — La signature

hint-signature-check =
    .lead = Envoie un courriel au vérificateur (voir le message de Nour), puis lis sa réponse avec mail.
    .solution = echo test | mail -s test check-auth@verifier.example, puis mail (ou cat /var/mail/ton_compte) : « DKIM check: none ».
hint-signature-key =
    .lead = Il faut d'abord une paire de clés, dans /etc/dkimkeys : man opendkim-genkey (le domaine, le sélecteur, le dossier).
    .solution = sudo -u opendkim opendkim-genkey -d gardens.example -s mail -D /etc/dkimkeys (ou avec sudo seul, puis sudo chown opendkim:opendkim /etc/dkimkeys/mail.private)
hint-signature-opendkim =
    .lead = /etc/opendkim.conf a des lignes commentées pour le domaine, le sélecteur et la clé. opendkim doit pouvoir lire la clé ; journalctl -u opendkim dit pourquoi il ne démarre pas.
    .solution = Dans /etc/opendkim.conf : Domain gardens.example, Selector mail, KeyFile /etc/dkimkeys/mail.private, et Socket inet:8891@localhost ; sudo systemctl restart opendkim
hint-signature-milter =
    .lead = Postfix doit passer le courrier à opendkim : les paramètres smtpd_milters et non_smtpd_milters (man postconf). Le courrier déposé sur la machine passe par non_smtpd_milters, et Postfix tourne dans un chroot.
    .solution = sudo postconf -e "smtpd_milters = inet:localhost:8891" "non_smtpd_milters = $smtpd_milters" "milter_default_action = accept", puis sudo systemctl reload postfix
hint-signature-end =
    .lead = La signature ne se vérifie qu'avec la clé publique, publiée dans la zone (le fichier .txt d'opendkim-genkey). Et le serial.
    .solution = Ajouter le contenu de /etc/dkimkeys/mail.txt à /etc/bind/zones/db.gardens.example, augmenter le serial, sudo rndc reload ; sudo opendkim-testkey -d gardens.example -s mail -vvv, puis un courriel au vérificateur.

## Chapitre 3 — La politique

hint-policy-report =
    .lead = Les rapports de rapports_dmarc sont du XML : chaque « record » dit qui a envoyé (source_ip), combien, et ce qu'ont donné SPF, DKIM et DMARC. Cherche les adresses qui ne sont pas 203.0.113.30.
    .solution = grep source_ip rapports_dmarc/*.xml, puis less sur le rapport : 198.51.100.77 (newsmail.example) passe SPF et DKIM pour son domaine, pas pour gardens.example.
hint-policy-aligned =
    .lead = La lettre doit être signée avec d=gardens.example : lettre_newsmail.txt dit comment déléguer un sélecteur. Attention au point final, et au serial.
    .solution = Ajouter « nm1._domainkey IN CNAME nm1.dkim.newsmail.example. » à la zone, augmenter le serial, sudo rndc reload ; dig TXT nm1._domainkey.gardens.example @ns2.registry.example
hint-policy-end =
    .lead = Maintenant que la lettre est alignée, la politique peut se durcir : la balise p= de l'enregistrement _dmarc (garde rua=).
    .solution = Dans la zone : _dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@gardens.example", serial, sudo rndc reload ; dig TXT _dmarc.gardens.example @ns2.registry.example
