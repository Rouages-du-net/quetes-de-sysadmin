### Ce que partagent les chapitres des « Ondes » : les fichiers de
### l'autorité de certification de la fédération sur pylone (les notes de
### Kwame, la politique) et les pages de ses sites. Les commandes, options,
### chemins et sorties ne sont pas traduits.

airwaves-readme-ca-1 =
    L'autorité de certification de la fédération Airwaves -- Kwame, février 2028

    Nos noms finissent en airwaves.internal : aucune autorité publique ne
    les certifiera, alors nous avons la nôtre. Les PC des stations font
    confiance à notre racine parce que j'ai installé ca.crt sur chacun
    (Firefox et le système).

      ca.crt            le certificat de la racine (Airwaves Root CA, 10 ans)
      private/ca.key    la clé privée de la racine : les joyaux de la couronne
      ca.srl            le dernier numéro de série utilisé
      issued/           une copie de chaque certificat signé

    Comment j'ai fait le certificat de l'intranet (8 février 2028) :

      openssl req -new -key /etc/nginx/ssl/intranet.key -subj /CN=intranet.airwaves.internal -out intranet.csr
      openssl x509 -req -in intranet.csr -CA ca.crt -CAkey private/ca.key -days 825 -out intranet.crt

    Ensuite, le copier dans /etc/nginx/ssl/ et recharger nginx.
    Avant de signer quoi que ce soit, lire POLICY.txt.
airwaves-readme-ca-2 =
    { airwaves-readme-ca-1 }

    Mars 2030 -- l'autorité intermédiaire

    La racine ne devrait pas signer chaque certificat : sa clé devrait
    dormir hors ligne. Le 11 mars, j'ai fait une autorité intermédiaire,
    signée par la racine : issuing/ (Airwaves Issuing CA 1). Elle tourne
    avec openssl ca et son propre openssl.cnf (base index.txt, serial,
    newcerts/). Désormais, c'est elle qui signe les certificats des
    serveurs et des portables. La clé de la racine quitte pylone la
    semaine prochaine.
airwaves-readme-ca-3 =
    { airwaves-readme-ca-2 }

    Avril 2030

    La clé de la racine est sur une clé USB dans le coffre d'Adaeze ; la
    liste de révocation (CRL) de la racine, écrite à la même cérémonie,
    est dans crl/root.crl (valable un an). Portables : un certificat
    client chacun, émis par issuing/ (copies dans issuing/certs/ et
    issuing/newcerts/).
airwaves-policy =
    Fédération Airwaves -- politique de certification (version 2, janvier 2030)

    1. Certificats de serveur
       - chaque nom qu'utilise un client va dans subjectAltName (DNS:...) ;
         les navigateurs ignorent le Common Name
       - validité : un an (365 jours), jamais plus de 398
       - pas une autorité (basicConstraints CA:FALSE)
       - clé : EC P-256 ou RSA d'au moins 2048 bits
    2. Les clés de l'autorité
       - lisibles par root seul (chmod 600), jamais copiées ailleurs
       - on ne distribue que les certificats, jamais les clés
    3. Révocation
       - une clé perdue ou volée : révoquer son certificat le jour même,
         et publier la liste de révocation
airwaves-site-intranet =
    <!DOCTYPE html>
    <html lang="fr"><head><title>Intranet Airwaves</title></head>
    <body><h1>Fédération Airwaves</h1><p>La grille de la semaine, le planning des animateur·rices, les jingles communs.</p></body></html>
airwaves-site-archive =
    <!DOCTYPE html>
    <html lang="fr"><head><title>Archives Airwaves</title></head>
    <body><h1>Archives des émissions</h1><p>Chaque émission des cinq stations depuis 2019.</p></body></html>
airwaves-site-contrib =
    <!DOCTYPE html>
    <html lang="fr"><head><title>Contributions Airwaves</title></head>
    <body><h1>Contributions</h1><p>Les enregistrements du terrain : le logiciel d'envoi les dépose ici.</p></body></html>
