### Histoire « Les Lettres du quartier », chapitre 9 « L'atelier de réparation » :
### Apache derrière nginx (ports, hôtes virtuels, .htaccess, mod_rewrite).
### Les commandes, chemins, directives et messages d'Apache ne se traduisent pas.

chapitre-repair-cafe = L'atelier de réparation
    .resume = Le site de l'atelier de réparation tourne sous Apache, avec un .htaccess : le faire vivre derrière nginx, sur le même serveur.

## Fichiers

repair-cafe-courriel-kofi =
    De :     Kofi
    À :      toi
    Objet :  L'atelier de réparation

    Bonjour !

    L'ancien hébergeur de l'atelier de réparation ferme à la fin du mois.
    J'ai proposé de prendre leur site sur notre serveur : le DNS de
    repair.example pointe déjà ici.

    Leur site tournait sous Apache, avec un fichier .htaccess qui fait
    marcher les adresses courtes des fiches : http://repair.example/guide/42
    mène à la fiche 42. Ces adresses sont imprimées en QR codes sur toutes
    les affiches de l'atelier : elles doivent continuer de marcher.

    Plutôt que de tout réécrire pour nginx tout de suite, on garde Apache,
    derrière nginx : nginx reste seul sur le port 80, pour tous les sites,
    et passe les visites de l'atelier à Apache. Rania a commencé hier
    soir, lis sa note (note_de_rania.txt).

    Ce qu'il faut :
    - Apache tourne, et redémarrera avec la machine ; mais il n'écoute que
      sur 127.0.0.1 (port 8080), comme l'agenda : personne ne doit le
      joindre sans passer par nginx ;
    - http://repair.example/ montre l'accueil de l'atelier, et
      http://repair.example/guide/42 la fiche 42 ;
    - les Lettres et le café restent en ligne.

    Merci !
    Kofi

repair-cafe-note-de-rania =
    J'ai fait sudo apt install apache2 hier soir. À la fin, apt a affiché
    « Job for apache2.service failed », et je n'ai pas eu le temps de
    regarder pourquoi (systemctl status apache2, journalctl -u apache2…).

    J'ai copié le site dans /var/www/repair, avec son .htaccess (le
    fichier caché qui fait marcher les adresses /guide/…), et la
    configuration Apache de l'ancien hébergeur dans
    /etc/apache2/sites-available/repair.conf. Je l'ai activée comme pour
    nginx, avec un lien dans sites-enabled.

    Côté nginx, le site est prêt dans /etc/nginx/sites-available/repair,
    pas encore activé : il passe tout à 127.0.0.1:8080.

    Sur Debian, Apache se règle dans /etc/apache2 : ports.conf pour les
    ports, sites-available et sites-enabled comme nginx, mais avec ses
    propres outils (man a2ensite, man a2enmod, man apache2ctl).

    Rania

repair-cafe-htaccess-commentaire =
    # Les adresses courtes des fiches, imprimées sur les affiches :
    # /guide/42 mène à guides/42.html

repair-cafe-site-accueil =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>L'atelier de réparation</title></head>
    <body>
    <h1>L'atelier de réparation</h1>
    <p>Chaque samedi, on répare ensemble : vélos, grille-pain, vêtements.</p>
    <p>Les fiches : <a href="/guide/7">7, changer une chambre à air</a>, <a href="/guide/42">42, détartrer une bouilloire</a>.</p>
    </body>
    </html>

repair-cafe-fiche-7 =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Fiche 7 : changer une chambre à air</title></head>
    <body>
    <h1>Fiche 7 : changer une chambre à air</h1>
    <p>Démonter la roue, sortir le pneu avec deux démonte-pneus, trouver le trou dans une bassine d'eau.</p>
    </body>
    </html>

repair-cafe-fiche-42 =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Fiche 42 : détartrer une bouilloire</title></head>
    <body>
    <h1>Fiche 42 : détartrer une bouilloire</h1>
    <p>Moitié vinaigre blanc, moitié eau : faire bouillir, laisser reposer une heure, rincer trois fois.</p>
    </body>
    </html>

## Événements

repair-cafe-evenement-occupe =
    « Address already in use » : Apache veut écouter sur le port 80
    (Listen 80, dans /etc/apache2/ports.conf), mais nginx y est déjà, pour
    tous les sites. Deux programmes ne peuvent pas écouter sur le même port
    de la même adresse : sudo ss -tlnp montre qui écoute où. Ici, nginx
    garde le port 80 ; Apache ira sur 127.0.0.1:8080, là où le site nginx
    préparé par Rania l'attend.
repair-cafe-evenement-ah00558 =
    « AH00558 » n'est qu'un avertissement : Apache ne connaît pas de nom
    complet pour la machine et prend son adresse. Une ligne ServerName au
    niveau global le fait taire (par exemple ServerName localhost dans
    /etc/apache2/conf-available/servername.conf, puis sudo a2enconf
    servername). Ce n'est pas lui qui empêche Apache de démarrer.
repair-cafe-evenement-ecoute =
    Apache tourne ! sudo ss -tlnp le montre, avec ses adresses. Vérifie
    qu'il sert bien l'atelier, en donnant le nom du site :
    curl -H "Host: repair.example" http://127.0.0.1:8080/
repair-cafe-evenement-partout =
    Attention : Apache écoute sur toutes les adresses de la machine (un
    Listen avec le port seul). Le pare-feu le protège aujourd'hui, mais
    Rania veut qu'il n'écoute que sur 127.0.0.1, comme l'agenda : seul
    nginx doit pouvoir le joindre. Listen 127.0.0.1:8080, dans ports.conf.
repair-cafe-evenement-defaut =
    C'est la page par défaut d'Apache (/var/www/html), pas celle de
    l'atelier. Pour une demande, Apache garde d'abord les VirtualHost qui
    correspondent à l'adresse et au port, puis celui dont le ServerName
    correspond au nom demandé (l'en-tête Host) ; s'il n'en trouve pas, il
    prend le premier lu, ou sa configuration principale. sudo apache2ctl -S
    montre qui répond où. Le site de l'atelier est-il lu (un fichier de
    sites-enabled qui finit par .conf) ? Son VirtualHost est-il sur le bon
    port ? Et par nginx : quel nom nginx transmet-il à Apache ?
repair-cafe-evenement-site =
    Apache sert l'accueil de l'atelier sur la boucle locale. Reste à le
    publier : nginx, devant, doit lui passer les visites de repair.example.
repair-cafe-evenement-passerelle =
    502 : nginx n'arrive pas à joindre Apache (dans
    /var/log/nginx/error.log : « connect() failed »). Apache tourne-t-il,
    et sur le port où nginx l'attend (proxy_pass http://127.0.0.1:8080) ?
repair-cafe-evenement-proxy =
    http://repair.example/ montre l'accueil de l'atelier : nginx, puis
    Apache. Essaie maintenant une adresse des affiches :
    curl http://repair.example/guide/42
repair-cafe-evenement-ignore =
    404 sur /guide/… : Apache cherche le fichier /var/www/repair/guide/42,
    qui n'existe pas. La règle qui transforme cette adresse est dans
    /var/www/repair/.htaccess… mais Apache ne lit les .htaccess que si
    AllowOverride le permet, et apache2.conf dit AllowOverride None pour
    /var/www. Autorise-le pour ce site seulement, dans une section
    <Directory /var/www/repair> de son VirtualHost.
repair-cafe-evenement-interne =
    500 Internal Server Error : Apache a lu le .htaccess, mais quelque
    chose ne va pas. La raison est dans le journal d'erreurs du site :
    sudo tail /var/log/apache2/repair-error.log
repair-cafe-evenement-reecriture =
    /guide/42 mène à la fiche 42 : la règle du .htaccess (RewriteRule) a
    transformé l'adresse en guides/42.html. Apache relit le .htaccess à
    chaque visite : quand on le modifie, rien à recharger.
repair-cafe-evenement-fin =
    Les adresses des affiches marchent, par nginx puis Apache. Rania :
    « Les QR codes de l'atelier mènent de nouveau aux bonnes fiches ! »

    Bravo ! Tu as terminé le chapitre « L'atelier de réparation ».

    CE QUI S'EST PASSÉ
    Apache ne démarrait pas : nginx tenait le port 80. Il écoute maintenant
    sur 127.0.0.1:8080 (Listen dans ports.conf, et le port du VirtualHost),
    et nginx lui passe les visites de repair.example. Le site n'était pas
    lu : Apache ne prend dans sites-enabled que les fichiers en .conf, que
    a2ensite crée. Les adresses courtes passent par le .htaccess, qu'Apache
    ne lit qu'avec AllowOverride, et dont RewriteRule demande le module
    rewrite (a2enmod).

    NGINX ET APACHE, CÔTE À CÔTE
      nginx                        Apache (Debian)
      sites-enabled, ln -s         sites-enabled, a2ensite (.conf)
      nginx -t                     apache2ctl configtest, apache2ctl -S
      listen, server_name, root    Listen, VirtualHost, ServerName, DocumentRoot
      location                     Directory, Location
      rewrite, try_files           RewriteRule (a2enmod rewrite)
      aucun .htaccess              .htaccess, si AllowOverride

    LA BONNE PRATIQUE
    - Un seul programme par port : un serveur web devant (reverse proxy),
      les autres derrière, sur 127.0.0.1.
    - apache2ctl configtest avant de recharger ; apache2ctl -S pour savoir
      quel VirtualHost répond à quel nom.
    - Derrière un proxy, transmettre le nom demandé (proxy_set_header Host
      $host; dans nginx), sinon Apache sert son site par défaut.
    - Les .htaccess servent quand on n'a pas accès à la configuration
      (hébergement mutualisé), mais Apache les relit à chaque visite. Sur
      son propre serveur, les mêmes règles vont mieux dans le VirtualHost,
      avec AllowOverride None.

    LA DOCUMENTATION
    - Le choix de l'hôte virtuel : https://httpd.apache.org/docs/2.4/vhosts/details.html
    - Les .htaccess : https://httpd.apache.org/docs/2.4/howto/htaccess.html
    - mod_rewrite : https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html
    - proxy_set_header (nginx) : https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
