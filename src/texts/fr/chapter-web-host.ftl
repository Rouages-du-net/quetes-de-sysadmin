### Histoire « La Maison des associations », chapitre « L'hébergeur » :
### sftp, puis publier un site chez un hébergeur mutualisé en FTPS avec lftp.
### Les commandes, les noms de machines, les chemins et le HTML ne se
### traduisent pas (le texte des pages, si).

chapter-web-host = L'hébergeur
    .summary = Le nouveau site est prêt sur le wiki : le rapatrier par sftp, puis le publier chez l'hébergeur, qui n'accepte plus le FTP en clair. FTPS, le bon nom de serveur, et rien de vieux qui traîne.

## Fichiers

# { $compte } : le compte FTP chez l'hébergeur ; { $motdepasse } : son mot de passe
web-host-email-yasmine =
    De :     Yasmine
    À :      toi
    Objet :  Le nouveau site

    Le nouveau site de la Maison est prêt ! Il est sur le wiki, dans
    /srv/wiki/site. Il faut le mettre en ligne chez notre hébergeur, et
    surtout retirer la page des tarifs 2025, qui ne sont plus les bons.

    C'est Gaspard qui s'en occupait, avec FileZilla ; ses notes sont dans
    notes-gaspard.txt. Mais l'hébergeur a écrit (courriel_hebergeur.txt) :
    depuis le 1er mars, plus de FTP en clair.

    Ses identifiants, que l'hébergeur m'a renvoyés :
        compte       : { $compte }
        mot de passe : { $motdepasse }

    Le wiki, tu y vas comme d'habitude depuis ton poste (le raccourci
    ssh wiki) ; pour regarder avant de prendre : man sftp. Pour
    l'hébergeur, qui ne propose que FTP : man lftp, installé sur ton
    poste.

web-host-email-host =
    De :     Le support de l'hébergeur <support@hosting.example>
    Objet :  Fin du FTP non chiffré le 1er mars

    Bonjour,

    Pour protéger vos identifiants, nos serveurs refusent désormais les
    connexions FTP non chiffrées. Utilisez FTPS (FTP explicite sur TLS,
    port 21) : la plupart des clients le font par défaut.

    Serveur : ftp.hosting.example
    Notre certificat est émis pour *.hosting.example : connectez-vous
    sous ce nom pour qu'il soit reconnu. Ne désactivez jamais la
    vérification du certificat.

    Votre site se trouve dans le dossier public_html de votre compte.

    L'équipe technique

web-host-notes-gaspard =
    NOTES DE GASPARD — publier le site

    FileZilla :
      hôte         : ftp.community.example
      port         : 21
      chiffrement  : « FTP simple (non sécurisé) »
                     (avec le chiffrement, j'avais une erreur de
                     certificat, alors j'ai enlevé)
      dossier      : public_html

    Je glisse les fichiers d'un côté à l'autre. Les vieux fichiers, je
    les laisse, au cas où.

## Le site

web-host-old-index =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Maison des associations</title></head>
    <body><h1>Maison des associations</h1>
    <p>Bienvenue ! Voir l'agenda et les tarifs 2025.</p></body></html>
web-host-old-agenda =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Agenda</title></head>
    <body><h1>Agenda 2025</h1><p>Fête des voisins : 23 mai 2025.</p></body></html>
web-host-old-prices =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Tarifs 2025</title></head>
    <body><h1>Tarifs 2025</h1><p>Location de salle : 15 € de l'heure.</p></body></html>
web-host-index =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Maison des associations</title>
    <link rel="stylesheet" href="style.css"></head>
    <body><header><img src="images/logo.svg" alt="" width="48"><h1>Maison des associations</h1></header>
    <p>Bienvenue ! L'agenda des activités et l'adhésion sont en ligne.</p>
    <p><a href="agenda.html">Agenda</a> · <a href="adhesion.html">Adhérer</a></p></body></html>
web-host-agenda =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Agenda</title><link rel="stylesheet" href="style.css"></head>
    <body><h1>Agenda 2028</h1><p>Assemblée générale : 12 avril. Fête des voisins : 26 mai.</p></body></html>
web-host-membership =
    <!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Adhérer</title><link rel="stylesheet" href="style.css"></head>
    <body><h1>Adhérer</h1><p>L'adhésion est à prix libre, à l'accueil ou par courriel.</p></body></html>

## Événements

web-host-event-clear =
    L'hébergeur refuse : plus de FTP en clair, comme il l'avait annoncé. Et
    c'est tant mieux : en FTP simple, le mot de passe du compte passe en
    clair sur le réseau, lisible par quiconque se trouve sur le chemin (le
    wifi d'un café…). lftp chiffre tout seul (FTPS), à moins qu'on ne le
    lui interdise.
web-host-event-certificate =
    La connexion est chiffrée, mais lftp refuse le certificat : il est
    émis pour *.hosting.example, et tu as demandé ftp.community.example.
    C'est l'erreur qu'avait eue Gaspard. Elle ne se règle pas en coupant
    la vérification, mais en demandant le serveur sous le nom que son
    certificat porte (courriel_hebergeur.txt).
web-host-event-without-verification =
    Attention : la vérification du certificat est coupée
    (ssl:verify-certificate). La connexion est chiffrée… mais avec
    n'importe qui : quelqu'un qui se ferait passer pour l'hébergeur
    recevrait le mot de passe sans que lftp proteste. Remets la
    vérification, et passe par le nom que le certificat couvre.
web-host-event-bad-direction =
    Oups : mirror sans -R copie DE l'hébergement VERS ton poste. Tu viens
    de rapatrier l'ancien site (la page des tarifs 2025 est arrivée chez
    toi). -R (reverse) envoie dans l'autre sens. Pour retrouver le
    nouveau site, il est toujours sur le wiki.
web-host-event-bad-directory =
    Le site est arrivé chez l'hébergeur… mais pas dans public_html : mirror
    -R site, sans cible, crée un dossier du même nom à côté. Le dossier
    publié par le serveur web, c'est public_html (et le dossier en trop
    peut se retirer : rm -r).
web-host-event-rest =
    Le nouveau site est en ligne… et la page des tarifs 2025 aussi :
    mirror n'efface rien de l'autre côté sans --delete. (Pour voir ce qu'il
    ferait avant de le faire : --dry-run.)
web-host-event-end =
    Le nouveau site est en ligne, exactement celui du wiki, et les tarifs
    de 2025 ont disparu. Le mot de passe n'a jamais circulé en clair.
    Yasmine : « Gaspard demande si tu peux lui montrer, pour la prochaine
    fois. »

    Bravo ! Tu as terminé le chapitre « L'hébergeur ».

    CE QUI S'EST PASSÉ
    sftp transfère des fichiers par SSH, comme scp, mais en dialoguant : on
    regarde (ls, cd), puis on prend (get) ou on envoie (put). Un hébergement
    mutualisé, lui, ne propose souvent que FTP : il faut alors FTPS, du FTP
    chiffré par TLS, comme un site en HTTPS. Le chiffrement ne protège que
    si le certificat est vérifié, et il ne se vérifie que sous le nom qu'il
    porte : celui de l'hébergeur, pas celui de son propre site.

    LA BONNE PRATIQUE
    - SFTP (ou scp, rsync) dès qu'on a SSH ; FTPS sinon ; jamais de FTP en
      clair.
    - Ne jamais couper la vérification du certificat : changer de nom, pas
      de réglage.
    - Publier avec mirror -R --delete (après un --dry-run) : le site en
      ligne est exactement celui qu'on a préparé, sans vieux fichiers.

    LA DOCUMENTATION
    - sftp : https://man.openbsd.org/sftp
    - lftp : https://lftp.yar.ru/lftp-man.html
    - FTP sur TLS (RFC 4217) : https://www.rfc-editor.org/rfc/rfc4217
