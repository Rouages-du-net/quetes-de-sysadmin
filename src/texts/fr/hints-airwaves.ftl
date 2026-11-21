### Indices gradués des Ondes (voir src/engine/hints.ts) : un message par
### étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans la
### commande exacte) et .solution (presque la réponse).

## Chapitre 1 — La Date de péremption

hint-expiry-date-expired =
    .lead = Regarde le certificat que présente vraiment l'intranet, et ses dates (man openssl : s_client, x509).
    .solution = openssl s_client -connect intranet.airwaves.internal:443 </dev/null | openssl x509 -noout -dates
hint-expiry-date-cn-only =
    .lead = Quels noms couvre le certificat ? Lis-le en entier, en clair.
    .solution = openssl x509 -in /etc/nginx/ssl/intranet.crt -noout -text
hint-expiry-date-readme =
    .lead = L'autorité vit dans /srv/ca : Kwame y a laissé des notes et une politique.
    .solution = cat /srv/ca/LISEZMOI.txt /srv/ca/POLICY.txt
hint-expiry-date-key-open =
    .lead = Qui peut lire la clé privée de l'autorité ? Regarde les droits de /srv/ca/private.
    .solution = ls -l /srv/ca/private
hint-expiry-date-key-closed =
    .lead = La clé d'une autorité n'est lisible que par root (man chmod).
    .solution = sudo chmod 600 /srv/ca/private/ca.key; sudo chmod 700 /srv/ca/private
hint-expiry-date-renewed =
    .lead = Une demande pour la clé de l'intranet, puis la racine la signe pour un an avec les deux noms dans subjectAltName (-extfile, ou -addext avec -copy_extensions copy) ; l'installer où nginx regarde, vérifier, recharger.
    .solution = openssl req -new -key CLÉ -subj /CN=intranet.airwaves.internal -out intranet.csr; printf 'subjectAltName = DNS:intranet.airwaves.internal, DNS:board.airwaves.internal\n' > san.ext; sudo openssl x509 -req -in intranet.csr -CA /srv/ca/ca.crt -CAkey /srv/ca/private/ca.key -days 365 -extfile san.ext -out intranet.crt; puis le copier dans /etc/nginx/ssl/intranet.crt, sudo nginx -t, sudo systemctl reload nginx
hint-expiry-date-end =
    .lead = Vérifie comme un client qui fait confiance à notre racine : les deux noms, avec curl et le certificat de l'autorité.
    .solution = curl --cacert /srv/ca/ca.crt https://board.airwaves.internal/

## Chapitre 2 — La Chaîne de confiance

hint-chain-of-trust-red =
    .lead = Lis le journal de la supervision, puis essaie sa requête toi-même.
    .solution = tail /var/log/check-sites.log; curl https://archive.airwaves.internal/
hint-chain-of-trust-mast-trusts =
    .lead = Debian fait confiance aux autorités qu'installe update-ca-certificates : le certificat de la racine (jamais sa clé) va dans /usr/local/share/ca-certificates, dans un fichier .crt (man update-ca-certificates).
    .solution = sudo cp /srv/ca/ca.crt /usr/local/share/ca-certificates/airwaves-root.crt; sudo update-ca-certificates
hint-chain-of-trust-still-red =
    .lead = Relance la supervision, ou curl sur les archives : qu'envoie le serveur ? Compare avec l'intranet.
    .solution = sudo /usr/local/bin/check-sites; tail -n 3 /var/log/check-sites.log
hint-chain-of-trust-chain =
    .lead = Le serveur doit envoyer son certificat suivi de l'intermédiaire (le certificat de l'autorité intermédiaire), dans un seul fichier pour ssl_certificate.
    .solution = openssl s_client -connect archive.airwaves.internal:443 -showcerts </dev/null; sudo sh -c 'cat /etc/nginx/ssl/archive.crt /srv/ca/issuing/issuing.crt > /etc/nginx/ssl/archive-chain.crt', y faire pointer ssl_certificate, sudo nginx -t, sudo systemctl reload nginx
hint-chain-of-trust-booth =
    .lead = cabine a besoin du certificat de la racine aussi, installé de la même façon : copie-le par ssh (man scp).
    .solution = scp /srv/ca/ca.crt cabine:; ssh cabine; sudo cp ca.crt /usr/local/share/ca-certificates/airwaves-root.crt; sudo update-ca-certificates
hint-chain-of-trust-end =
    .lead = Depuis cabine et depuis pylone, les deux sites doivent répondre sans -k.
    .solution = curl https://archive.airwaves.internal/ (sur cabine et sur pylone)

## Chapitre 3 — Le Portable volé

hint-stolen-laptop-thief =
    .lead = Qui s'est connecté au portail ? nginx écrit chaque requête dans son journal d'accès.
    .solution = sudo tail -n 20 /var/log/nginx/access.log
hint-stolen-laptop-revoked =
    .lead = Révoquer, c'est le travail de l'autorité, dans sa base : openssl ca, avec la configuration de l'autorité intermédiaire et le certificat du portable de Lindiwe (index.txt donne son numéro de série).
    .solution = sudo openssl ca -config /srv/ca/issuing/openssl.cnf -revoke /srv/ca/issuing/newcerts/1003.pem -crl_reason keyCompromise
hint-stolen-laptop-crl =
    .lead = Les serveurs ne lisent pas la base : ils lisent une liste de révocation, que l'autorité écrit (man openssl : ca -gencrl).
    .solution = sudo openssl ca -config /srv/ca/issuing/openssl.cnf -gencrl -out /srv/ca/issuing/crl/issuing.crl
hint-stolen-laptop-refused =
    .lead = Donne les CRL à nginx avec ssl_crl dans le bloc server de contrib ; il vérifie toute la chaîne, donc la CRL de la racine va dans le même fichier. Puis vérifie et recharge.
    .solution = sudo sh -c 'cat /srv/ca/issuing/crl/issuing.crl /srv/ca/crl/root.crl > /etc/nginx/ssl/airwaves-crl.pem'; ajouter ssl_crl /etc/nginx/ssl/airwaves-crl.pem; dans /etc/nginx/sites-enabled/contrib; sudo nginx -t; sudo systemctl reload nginx
hint-stolen-laptop-watch =
    .lead = Un script qui passe sur chaque certificat émis (/srv/ca/issued, /srv/ca/issuing/newcerts) et se sert du code de sortie d'openssl x509 -checkend pour ne signaler que ceux qui expirent dans les 30 jours ; le lancer chaque jour depuis cron (ou un timer).
    .solution = un script : for c in /srv/ca/issued/*.crt /srv/ca/issuing/newcerts/*.pem; do openssl x509 -in "$c" -noout -checkend 2592000 >/dev/null || echo "expire dans les 30 jours : $c"; done; puis sudo crontab -e : 17 7 * * * /usr/local/bin/cert-expiry
hint-stolen-laptop-end =
    .lead = Lance la surveillance une fois à la main : elle doit nommer le certificat du serveur de diffusion.
    .solution = sudo /usr/local/bin/cert-expiry
