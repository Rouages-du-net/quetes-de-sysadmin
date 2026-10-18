### Histoire « Les Lettres du quartier », chapitre 6 « Le soir du concert » :
### lire les journaux avec awk, limiter le débit avec nginx. Les commandes,
### chemins, directives et lignes de journal ne se traduisent pas.

chapitre-concert = Le soir du concert
    .resume = L'agenda s'écroule le soir du concert : lire les journaux avec awk, limiter le débit avec nginx (limit_req).

## Fichiers

concert-message-de-kofi =
    Un message de Kofi, envoyé à 20 h 02 :

    « Au secours ! Ce soir, concert au café, et tout le monde va voir
    l'agenda pour l'horaire… qui ne s'affiche plus. Les gens reçoivent une
    erreur 504. Rania dit que l'agenda ne sait servir qu'une vingtaine de
    pages par seconde, mais on n'a jamais eu autant de monde !

    Peux-tu regarder dans les journaux de nginx qui demande quoi, et faire
    en sorte que les vrais visiteurs passent ? Rania a laissé une aide
    (aide_journaux.txt). Et pas de bricolage qui marche juste ce soir :
    une règle qui tienne. »
concert-aide-journaux =
    AIDE JOURNAUX — PAR RANIA

    Chaque visite fait une ligne dans /var/log/nginx/access.log (format
    « combined ») :

      adresse - - [date] "GET chemin HTTP/1.1" code octets "page d'origine" "navigateur"
      $1          $4 $5   $6  $7     $8        $9   $10

    awk découpe chaque ligne en champs ($1, $7, $9…). Quelques recettes :
      awk '{"{"}print $9{"}"}' FICHIER | sort | uniq -c         les codes de réponse
      awk '{"{"}print $1{"}"}' FICHIER | sort | uniq -c | sort -n les adresses
      awk '$9 == 504 {"{"}print $7{"}"}' FICHIER | head          ce qui échoue

    Pour limiter le débit, nginx a limit_req (man nginx) : une zone dans le
    bloc http (limit_req_zone), puis limit_req là où on veut limiter.
    Après chaque rechargement, on regarde la minute suivante dans le journal.

## Événements

# Après chaque rechargement de nginx : une minute de trafic.
concert-minute =
    Une minute passe. Visiteur·ses : { $servis } requêtes servies sur { $humains }.
    Robot : { $refuses } requêtes refusées sur { $robot }. Délais dépassés
    (504) : { $depasses }. (Le détail est à la fin de access.log.)
concert-evenement-robot =
    Trois adresses voisines (198.51.100.23, .24, .25), un même « navigateur »
    (AgendaScraper), des centaines de pages d'agenda par minute : c'est un
    robot qui aspire le site. À lui seul, il demande plus que ce que
    l'agenda sait servir. Les vraies personnes, elles, demandent une page
    et ses quatre fichiers, puis lisent.
concert-evenement-interdit =
    Bloquer les adresses du robot (deny) marche… ce soir. Kofi : « Rania
    dit que ces robots changent d'adresse toutes les semaines. On ne va pas
    tenir une liste à la main ! » Une limite de débit par adresse
    s'appliquerait à tous les robots, connus ou pas.
concert-evenement-humains-limites =
    La limite refuse aussi des vraies personnes ! Un navigateur demande une
    page et ses fichiers (feuille de style, script, images) presque en même
    temps : cinq requêtes dans la même seconde. Sans marge, la limite les
    refuse. limit_req accepte une rafale (burst), et nodelay la sert tout de
    suite (man nginx).
concert-evenement-encore-trop =
    La limite freine le robot, mais il passe encore trop souvent, et
    l'agenda peut déborder (504). Le débit autorisé par adresse, multiplié
    par le nombre d'adresses du robot, doit rester bien sous ce que
    l'agenda sait servir (une vingtaine de pages par seconde). Et la limite
    s'applique-t-elle bien à /agenda/ ?
concert-evenement-fin =
    Toutes les visites humaines passent, le robot est freiné, et l'agenda
    respire. Kofi : « L'horaire s'affiche ! Le concert commence à
    21 heures. » Le message d'erreur que reçoit le robot (429 Too Many
    Requests, ou 503) lui dit de ralentir.

    Bravo ! Tu as terminé le chapitre 6 des Lettres du quartier.

    CE QUI S'EST PASSÉ
    Un robot demandait l'agenda trois fois plus vite qu'il ne pouvait
    répondre ; les visites humaines attendaient derrière lui, jusqu'au délai
    de nginx (504). Les journaux d'accès, lus avec awk, sort et uniq -c,
    ont montré qui demandait quoi.

    LA BONNE PRATIQUE
    - Lire les journaux avant d'agir : codes de réponse, adresses, chemins
      (awk '{"{"}print $9{"}"}' | sort | uniq -c).
    - Limiter le débit par adresse (limit_req_zone $binary_remote_addr),
      là où c'est coûteux (l'appli), pas forcément partout.
    - Laisser une rafale (burst=10 nodelay) : une page, ce sont plusieurs
      requêtes d'un coup.
    - limit_req_status 429 dit clairement au robot de ralentir.
    - Bloquer une adresse (deny) dépanne ; une règle de débit tient dans la
      durée.

    LA DOCUMENTATION
    - limit_req : https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
    - Le format des journaux d'accès : https://nginx.org/en/docs/http/ngx_http_log_module.html
    - awk (POSIX) : https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html
