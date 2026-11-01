### Histoire « La Rustine », chapitre 1 « Le cadenas » : Caddy et son HTTPS
### automatique (adresse du site, défi ACME, pare-feu, redirection www).
### Les commandes, chemins, directives et messages de Caddy ne se traduisent pas.

chapter-padlock = Le cadenas
    .summary = Caddy devait faire le HTTPS tout seul, mais le site de l'atelier vélo reste en HTTP : lui donner son nom, laisser passer Let's Encrypt, et ne pas oublier www.

## Fichiers

padlock-message-ines =
    De :     Inès
    À :      toi
    Objet :  Le cadenas !

    Salut !

    La Rustine a enfin son propre serveur, rien que pour le site de
    l'atelier. J'ai installé Caddy plutôt que nginx : il paraît qu'il fait
    le HTTPS tout seul, sans certbot, sans rien. J'ai mis le site dans
    /var/www/cycles et j'ai changé le dossier dans /etc/caddy/Caddyfile.

    Sur le serveur, curl http://localhost montre bien notre page. Mais
    dehors, rien : pas de cadenas dans le navigateur, https://cycles.example
    ne répond pas, et même http://cycles.example ne marche pas chez moi.
    Le DNS est bon pourtant : cycles.example et www.cycles.example mènent
    tous les deux à 203.0.113.40, notre serveur.

    Ce qu'il faudrait :
    - https://cycles.example montre le site, avec un vrai certificat ;
    - http://cycles.example renvoie vers https:// ;
    - https://www.cycles.example marche aussi (c'est l'adresse imprimée
      sur nos affiches !), en montrant le site ou en renvoyant vers
      cycles.example.

    Le pare-feu (ufw), je l'ai activé en suivant un tutoriel, pour ssh.
    Le service s'appelle caddy (systemctl status caddy, journalctl -u caddy) ;
    il y a aussi man caddy.

    Merci, et à samedi à l'atelier !
    Inès

padlock-site =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>La Rustine — atelier vélo</title></head>
    <body>
    <h1>La Rustine</h1>
    <p>Atelier vélo associatif : on t'apprend à réparer ton vélo toi-même.</p>
    <p>Tous les samedis, de 10 h à 17 h. Outils et conseils à prix libre.</p>
    </body>
    </html>

## Événements

padlock-event-http-only =
    Caddy n'écoute que sur le port 80, en HTTP : le Caddyfile commence par
    « :80 {"{"} », le modèle du paquet. Une adresse sans nom de domaine, ou qui
    donne le port 80 (ou http://), ne reçoit pas de certificat : Caddy ne
    saurait pas pour quel nom le demander. Le commentaire en haut du
    fichier le dit : remplace :80 par le nom du site. Puis
    sudo systemctl reload caddy, et regarde ce qu'en dit le journal.
padlock-event-schema-http =
    http://cycles.example : avec http://, l'adresse demande un site en HTTP
    seulement, donc pas de certificat. Pour le HTTPS automatique, le nom
    seul suffit : cycles.example (ou https://cycles.example).
padlock-event-address =
    Caddy a pris le nom : il écoute maintenant sur les ports 80 et 443
    (sudo ss -tlnp), et il demande tout seul un certificat à Let's Encrypt.
    Est-ce qu'il l'a obtenu ? Tout est dans son journal :
    journalctl -u caddy (les lignes de tls.obtain et acme_client).
padlock-event-firewall =
    « Timeout during connect (likely firewall problem) » : pour vérifier
    que le serveur répond bien pour cycles.example, Let's Encrypt vient le
    chercher depuis internet, sur le port 80 (défi HTTP-01) ou 443
    (TLS-ALPN-01). Mais ufw ne laisse entrer que ssh : sudo ufw status.
    Les visiteur·ses aussi passeront par ces ports. Caddy réessaiera tout
    seul, un peu plus tard.
padlock-event-alert =
    « tlsv1 alert internal error » : Caddy répond sur le port 443, mais il
    n'a pas (encore) de certificat pour ce nom, alors la poignée de main
    TLS échoue. Le journal dit où il en est : journalctl -u caddy.
padlock-event-format =
    Ce n'est qu'un avertissement : le Caddyfile n'est pas écrit comme le
    voudrait caddy fmt (des tabulations pour l'indentation, un espace
    entre les mots). sudo caddy fmt --overwrite /etc/caddy/Caddyfile le
    remet en forme.
padlock-event-certificate =
    Le cadenas ! Caddy a obtenu son certificat (« certificate obtained
    successfully » dans le journal), rangé dans /var/lib/caddy. Essaie
    curl -I http://cycles.example : la redirection vers HTTPS, Caddy l'a
    ajoutée tout seul. Reste l'adresse des affiches, www.cycles.example.
padlock-event-end =
    https://cycles.example et https://www.cycles.example répondent, avec
    leurs certificats, et HTTP renvoie vers HTTPS. Inès : « Le cadenas !
    Je vais pouvoir imprimer les nouvelles affiches. »

    Bravo ! Tu as terminé le chapitre « Le cadenas ».

    CE QUI S'EST PASSÉ
    Le Caddyfile commençait par :80, le modèle du paquet : un site sans nom,
    servi en HTTP seulement. Avec son nom de domaine pour adresse, Caddy
    gère le HTTPS de lui-même : il demande un certificat à Let's Encrypt
    (ACME), le range, le renouvellera, et redirige HTTP vers HTTPS. Mais
    Let's Encrypt doit pouvoir joindre la machine sur le port 80 ou 443
    pour vérifier qu'elle répond pour ce nom : le pare-feu ne laissait
    passer que ssh. Enfin, www.cycles.example est un autre nom : il lui
    faut son propre bloc (ou sa place dans la liste d'adresses), et son
    certificat.

    NGINX + CERTBOT ET CADDY, CÔTE À CÔTE
      nginx + certbot                     Caddy
      server_name, listen 443 ssl          l'adresse du site : cycles.example
      certbot --nginx ou --webroot         rien : Caddy le fait au chargement
      ssl_certificate, ssl_certificate_key rien (rangés dans /var/lib/caddy)
      return 301 https://…                 automatique (308)
      un timer pour certbot renew          automatique
      nginx -t                             caddy validate, caddy fmt
      systemctl reload nginx               systemctl reload caddy (caddy reload)

    LA BONNE PRATIQUE
    - Pour un certificat public, le nom doit mener à la machine (DNS) et
      les ports 80 et 443 doivent être ouverts : c'est vrai pour Caddy
      comme pour certbot.
    - Lire le journal après chaque rechargement : un certificat refusé
      n'empêche pas Caddy de tourner, il le dit seulement dans le journal.
    - caddy validate avant de recharger ; caddy fmt pour garder un
      Caddyfile lisible.
    - Un nom par ligne d'adresse ou par bloc : www est un nom à part, qu'on
      sert aussi ou qu'on redirige (redir https://cycles.example{"{"}uri{"}"} permanent).
    - Pour essayer sans risquer les limites de Let's Encrypt, Caddy sait
      utiliser l'autorité de test (option acme_ca, ou tls internal sur un
      réseau privé).

    LA DOCUMENTATION
    - Le HTTPS automatique : https://caddyserver.com/docs/automatic-https
    - Les adresses du Caddyfile : https://caddyserver.com/docs/caddyfile/concepts#addresses
    - redir : https://caddyserver.com/docs/caddyfile/directives/redir
    - Les types de défis ACME : https://letsencrypt.org/docs/challenge-types/
