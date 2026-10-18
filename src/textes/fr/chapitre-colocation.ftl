### Histoire « Les Lettres du quartier », chapitre 4 « La colocation » :
### hôtes virtuels et reverse proxy avec nginx. Les commandes, chemins,
### directives et messages de nginx ne se traduisent pas. Les pages des
### sites (colocation-site-*, colocation-agenda-*) se traduisent.

chapitre-colocation = La colocation
    .resume = Deux sites et une appli sur un seul serveur : hôtes virtuels, ln -s, reverse proxy avec nginx.

## Fichiers

colocation-courriel-kofi =
    De :     Kofi (association Les Lettres du quartier)
    À :      toi
    Objet :  Le café emménage chez nous

    Bonne nouvelle : le café associatif (tu te souviens, celui où internet
    ne marchait plus) arrête de payer un hébergeur. Il emménage sur notre
    serveur ! Une seule machine, deux sites : nginx sait faire, paraît-il.
    J'ai déjà fait pointer le nom cafe.example vers notre adresse.

    Et Rania a terminé l'agenda des ateliers : un petit programme qui doit
    s'afficher sous http://lettres.example/agenda/.

    Il faudrait donc :
    1. que http://cafe.example montre le site du café ;
    2. que http://lettres.example reste notre site, bien sûr ;
    3. que http://lettres.example/agenda/ montre l'agenda (et ses pages,
       comme /agenda/semaine) ;
    4. que tout ça tienne après un redémarrage.

    Rania a laissé ses notes (note_de_rania.txt). Pour sudo, ton mot de
    passe est toujours le même : fourmis-2026
colocation-note-de-rania =
    NOTES DE RANIA

    Les pages du café sont prêtes : /var/www/cafe/

    Sur Debian, chaque site a son fichier dans /etc/nginx/sites-available/,
    et on l'active avec un lien symbolique dans /etc/nginx/sites-enabled/
    (ls -l /etc/nginx/sites-enabled pour voir comment est fait le nôtre).
    Le plus simple : copier notre fichier et l'adapter.

    L'agenda est dans /opt/agenda (service systemd « agenda »). Il écoute
    sur 127.0.0.1:3000, seulement sur la machine elle-même : c'est nginx
    qui doit lui passer les visites (reverse proxy, voir proxy_pass dans
    man nginx). Ses pages commencent à / : /, /semaine, /ateliers.

    Pour tester un site depuis le serveur, avant que le monde entier le voie :
      curl -H "Host: cafe.example" http://127.0.0.1
    Et toujours : sudo nginx -t avant de recharger.
colocation-agenda-lisezmoi =
    Agenda des ateliers — serveur Node.js

    Écoute sur 127.0.0.1:3000 (voir serveur.js).
    Pages : /  /semaine  /ateliers
    Service systemd : agenda
colocation-agenda-code =
    // Agenda des ateliers des Lettres du quartier.
    const express = require('express');
    const app = express();

    app.get('/', (req, res) => res.sendFile(__dirname + '/pages/accueil.html'));
    app.get('/semaine', (req, res) => res.sendFile(__dirname + '/pages/semaine.html'));
    app.get('/ateliers', (req, res) => res.sendFile(__dirname + '/pages/ateliers.html'));

    // Seulement sur la machine elle-même : nginx est devant.
    app.listen(3000, '127.0.0.1');

## Les sites

colocation-site-lettres =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Les Lettres du quartier</title></head>
    <body>
    <h1>Les Lettres du quartier</h1>
    <p>Écrivain public, ateliers d'écriture, aide aux démarches.</p>
    </body>
    </html>
colocation-site-cafe =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Le café associatif</title></head>
    <body>
    <h1>Le café associatif</h1>
    <p>Ouvert du mercredi au dimanche. Soupe du jour à prix libre.</p>
    </body>
    </html>
colocation-agenda-accueil =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Agenda des ateliers</title></head>
    <body>
    <h1>Agenda des ateliers</h1>
    <p><a href="semaine">Cette semaine</a> · <a href="ateliers">Tous les ateliers</a></p>
    </body>
    </html>
colocation-agenda-semaine =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Cette semaine</title></head>
    <body>
    <h1>Cette semaine</h1>
    <p>Mardi 18 h : atelier d'écriture. Jeudi 14 h : aide aux démarches en ligne.</p>
    </body>
    </html>
colocation-agenda-ateliers =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Les ateliers</title></head>
    <body>
    <h1>Les ateliers</h1>
    <p>Écriture, lecture à voix haute, démarches en ligne, correspondance.</p>
    </body>
    </html>

## Événements

colocation-evenement-lien-casse =
    nginx ne trouve pas un fichier de /etc/nginx/sites-enabled/ : le lien
    est cassé. ls -l /etc/nginx/sites-enabled montre où il pointe. Un
    chemin relatif est lu depuis le lieu du lien (sites-enabled), pas
    depuis là où tu étais en le créant : relis man ln, et efface le mauvais
    lien avec rm (le fichier visé ne bouge pas).
colocation-evenement-conflit =
    « conflicting server name » : deux sites répondent au même nom. nginx
    garde le premier qu'il lit et ignore l'autre pour ce nom. Le fichier
    copié a sans doute gardé le server_name des Lettres.
colocation-evenement-mauvais-site =
    Tu as demandé cafe.example… et c'est le site des Lettres qui répond.
    nginx choisit le site d'après le nom demandé (server_name) ; si aucun
    ne correspond, il prend le site par défaut du port (default_server).
    Le site du café est-il activé, et porte-t-il ce nom ?
colocation-evenement-cafe =
    cafe.example répond avec la page du café : deux sites sur la même
    machine, à la même adresse, distingués seulement par le nom demandé.
    C'est ça, un hôte virtuel.
colocation-evenement-passerelle =
    502 Bad Gateway : nginx a bien reçu la visite, mais personne ne répond
    derrière lui. Son journal d'erreurs dit pourquoi :
    sudo tail /var/log/nginx/error.log. Et l'agenda, il tourne ?
colocation-evenement-cannot-get =
    « Cannot GET /agenda/ » : cette fois, c'est l'agenda qui répond… mais il
    reçoit le chemin /agenda/, alors que ses pages commencent à /. Avec
    proxy_pass, un détail compte énormément : la barre finale. Relis
    proxy_pass dans man nginx.
colocation-evenement-agenda-sans-enable =
    L'agenda répond. Mais il ne démarrera pas avec la machine : au prochain
    redémarrage, 502 de nouveau. (man systemctl)
colocation-evenement-fin =
    cafe.example, lettres.example et l'agenda répondent, chacun avec ses
    pages, depuis un seul serveur. Kofi : « On fait une fête pour
    l'emménagement du café. Tu es invité·e ! »

    Bravo ! Tu as terminé le chapitre 4 des Lettres du quartier. (La suite
    t'attend : Ça marche chez moi.)

    CE QUI S'EST PASSÉ
    Une seule adresse IP, un seul nginx, plusieurs sites : chaque visite
    annonce le nom qu'elle demande (en-tête Host), et nginx choisit le bloc
    server dont le server_name correspond, sinon celui marqué
    default_server. Devant l'agenda, nginx joue le reverse proxy : il reçoit
    les visites et les passe au programme qui n'écoute que sur 127.0.0.1.

    LA BONNE PRATIQUE
    - Un fichier par site dans sites-available, activé par un lien dans
      sites-enabled (ln -s, avec un chemin absolu) ; on le désactive en
      effaçant le lien, sans perdre le fichier.
    - Un seul default_server par port, et un server_name explicite partout.
    - Tester un site avant le DNS : curl -H "Host: nom" http://127.0.0.1
    - proxy_pass http://127.0.0.1:3000/; (avec la barre) remplace le
      préfixe de la location ; sans barre, le chemin passe tel quel.
    - 502 : regarder error.log, puis le service derrière nginx.
    - Une appli derrière un proxy écoute sur 127.0.0.1, jamais sur toutes
      les adresses.

    LA DOCUMENTATION
    - Comment nginx choisit un site : https://nginx.org/en/docs/http/request_processing.html
    - server_name : https://nginx.org/en/docs/http/server_names.html
    - proxy_pass : https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
