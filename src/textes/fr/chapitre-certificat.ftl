### Histoire « Le Datacenter », chapitre 5 « Le certificat a expiré » :
### TLS, Let's Encrypt et certbot. Les commandes, chemins, noms de fichiers
### et messages de certbot, d'openssl, de curl et de nginx ne se traduisent pas.

chapitre-certificat = Le certificat a expiré
    .resume = Le cadenas a sauté : certbot, le défi HTTP, openssl, et un renouvellement qui marche tout seul.

## Fichiers

certificat-courriel-awa =
    De :     Awa (responsable d'exploitation)
    À :      toi
    Objet :  Le site fait peur aux visiteurs

    Léa, à l'accueil de la médiathèque, m'écrit que le site affiche une
    alerte de sécurité depuis ce matin (son message est dans
    ~/message_de_lea.txt). Le certificat HTTPS a dû expirer.

    Je ne comprends pas : certbot est censé le renouveler tout seul, deux fois
    par jour il essaie. Et depuis 2025, Let's Encrypt n'envoie plus de
    courriel avant l'expiration : personne n'a rien vu venir.

    Peux-tu :
    1. trouver pourquoi le renouvellement automatique ne marche pas ;
    2. renouveler le certificat, pour que le site soit de nouveau sûr ;
    3. t'assurer que ça marchera TOUT SEUL la prochaine fois, jusqu'au bout.

    Pour vérifier ce que voit un navigateur : curl https://mediatheque.example
    Le reste est dans man certbot et man openssl. Le mot de passe pour sudo
    n'a pas changé.
certificat-message-de-lea =
    Bonjour Awa,

    Ce matin, en ouvrant le site de la médiathèque, Firefox affiche :

      Attention : risque probable de sécurité
      Le certificat de mediatheque.example a expiré le 21/01/2027.
      Code d'erreur : SEC_ERROR_EXPIRED_CERTIFICATE

    Sur le téléphone, Chrome dit « Votre connexion n'est pas privée »
    (NET::ERR_CERT_DATE_INVALID). Deux lecteurs m'ont déjà appelée pour
    savoir si on s'était fait pirater. Je leur ai dit de ne rien saisir sur
    le site en attendant.

    Léa
certificat-lisezmoi-live =
    This directory contains your keys and certificates.

    `privkey.pem`  : the private key for your certificate.
    `fullchain.pem`: the certificate file used in most server software.
    `chain.pem`    : used for OCSP stapling in Nginx >=1.3.7.
    `cert.pem`     : will break many server configurations, and should not be used
                     without reading further documentation (see link below).

    WARNING: DO NOT MOVE OR RENAME THESE FILES!
             Certbot expects these files to remain in this location in order
             to function properly!

    We recommend not moving these files. For more information, see the Certbot
    User Guide at https://certbot.eff.org/docs/using.html#where-are-my-certificates.

## Le site

certificat-site-index =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Médiathèque du quartier</title></head>
    <body>
    <h1>Médiathèque du quartier</h1>
    <p>Ouverte du mardi au samedi, de 10 h à 18 h.</p>
    <p>Nouveau : réservez vos livres en ligne avec votre carte de lecteur.</p>
    </body>
    </html>

## Événements

certificat-evenement-expire =
    Le certificat a bien expiré : c'est exactement ce que voient les
    navigateurs. Mais pourquoi n'a-t-il pas été renouvelé ? certbot tourne
    tout seul, lancé par systemd : son journal le sait (journalctl -u certbot,
    ou systemctl --failed). Pour essayer un renouvellement sans rien casser,
    man certbot parle d'une répétition générale.
certificat-evenement-defi =
    Let's Encrypt ne donne un certificat qu'à qui prouve qu'il tient le site :
    certbot dépose un petit fichier (le « défi ») dans un dossier, puis
    l'autorité vient le chercher sur http://mediatheque.example/.well-known/acme-challenge/.
    Ici, elle reçoit une 404 : le fichier n'est pas là où nginx sert ce site.

    Dans quel dossier certbot dépose-t-il le défi (regarde toutes les lignes
    de /etc/letsencrypt/renewal/mediatheque.example.conf) ? Et quel dossier
    nginx sert-il pour mediatheque.example ? man certbot dit comment changer
    de dossier.
certificat-evenement-pas-recharge =
    Le nouveau certificat est sur le disque… mais curl voit encore l'ancien.
    nginx lit son certificat quand il démarre ou recharge sa configuration,
    pas à chaque visite : il sert toujours celui d'octobre. Que faut-il dire
    à nginx ?
certificat-evenement-sans-hook =
    Le site est de nouveau sûr, et certbot sait maintenant renouveler.
    Mais dans 60 jours, quand il renouvellera tout seul, en pleine nuit, qui
    rechargera nginx ? Personne : le site servira l'ancien certificat jusqu'à
    ce qu'il expire, comme aujourd'hui. certbot peut lancer une commande
    après chaque renouvellement réussi : cherche « hook » dans man certbot.
certificat-evenement-fin =
    curl https://mediatheque.example répond sans alerte : le cadenas est
    revenu. Et la prochaine fois, certbot renouvellera tout seul, puis
    rechargera nginx tout seul.

    Awa : « Merci. J'ajoute une alerte qui nous préviendra quinze jours avant
    l'expiration : on ne peut plus compter sur les courriels de Let's
    Encrypt. »

    Bravo ! Tu as terminé le chapitre 5 du Datacenter.

    CE QUI S'EST PASSÉ
    Le jour de l'incendie, le certificat a été demandé avant la restauration
    du site : certbot a noté le dossier du site par défaut de Debian,
    /var/www/html. Pendant 60 jours, aucun problème. Puis, à partir de 30
    jours avant l'expiration, chaque renouvellement automatique a déposé le
    défi dans ce dossier, que nginx ne sert pas pour la médiathèque : 404,
    échec, deux fois par jour, en silence. Ce matin, le certificat a expiré.

    LA BONNE PRATIQUE
    - Un certificat de Let's Encrypt vaut 90 jours ; certbot essaie de le
      renouveler 30 jours avant la fin. Un renouvellement qui échoue ne se
      voit pas : surveiller la date d'expiration soi-même (openssl x509
      -checkend, une sonde), et le service certbot (systemctl --failed).
    - certbot renew --dry-run après chaque changement du site ou de nginx.
    - Le défi HTTP-01 passe par le port 80 : le dossier donné à certbot (-w)
      doit être celui que nginx sert pour ce nom.
    - nginx lit son certificat au chargement : un deploy hook (systemctl
      reload nginx) le recharge après chaque renouvellement réussi.
    - Toujours vérifier comme un visiteur : curl https://…, ou openssl
      s_client.

    LA DOCUMENTATION
    - certbot : https://eff-certbot.readthedocs.io/en/stable/using.html
    - Les défis de Let's Encrypt : https://letsencrypt.org/docs/challenge-types/
    - openssl x509 : https://docs.openssl.org/3.5/man1/openssl-x509/
