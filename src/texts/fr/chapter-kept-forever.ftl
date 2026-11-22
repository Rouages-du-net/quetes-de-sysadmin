### Histoire « La Chorale », chapitre « Gardé pour toujours » : les
### journaux du serveur de la chorale remontent à des années, contre la
### politique de conservation. logrotate (rotate, maxage), find -mtime, map
### et log_format de nginx, MaxRetentionSec= de journald. Les commandes,
### options, chemins et sorties ne sont pas traduits.

chapter-kept-forever = Gardé pour toujours
    .summary = Le bureau de la chorale a écrit, il y a deux ans, combien de temps il garde les données personnelles. Le serveur ne l'a jamais lu : ses journaux gardent l'adresse de chaque visiteur·se depuis 2027. Mettez les journaux en accord avec la politique, sans jeter ce qu'elle demande de garder.

## Fichiers

kept-forever-message-amara =
    De : Amara (présidente de la Chorale des Berges)
    Mardi 4 mars, 9 h 10

    Bonjour, et merci de reprendre notre petit serveur !

    À la réunion du bureau la semaine dernière, quelqu'un a demandé si nous
    faisons vraiment ce que dit notre politique de conservation. Nous
    l'avons adoptée en 2029 (elle est dans
    /srv/choir/docs/politique-de-conservation.txt), Ruben avait installé le
    serveur avant, et j'ai peur que personne n'ait jamais vérifié. Ruben est
    parti vivre à Glasgow ; il vous a laissé un mot.

    Pourriez-vous regarder les journaux du serveur et leur faire suivre la
    politique ? Garder ce qu'elle dit de garder, et rien de plus longtemps.
    Je préfère que nous le découvrions nous-mêmes plutôt qu'un·e choriste à
    notre place.

    Vous êtes sur baguette, le serveur de la chorale ; sudo marche avec
    votre mot de passe.

    Amara

kept-forever-note-ruben =
    Notes de Ruben (baguette, 2027)

    - nginx sert www.riversidechoir.example depuis /var/www/choir ;
      l'espace choristes (/members/) est l'appli de la chorale (gunicorn,
      port 8000). Journaux dans /var/log/nginx.
    - J'ai réglé logrotate pour garder les journaux web dix ans, « au cas
      où » (/etc/logrotate.d/nginx). Le disque ne coûte rien.
    - L'espace choristes écrit son journal de sécurité (connexions,
      modifications de profil) dans /var/log/choir/audit.log, tourné chaque
      mois.
    - journalctl pour tout le reste ; le journal est persistant
      (/var/log/journal).

    Ruben

## Événements

kept-forever-event-policy =
    Voilà la promesse du bureau : trente jours de journaux d'accès web avec
    les adresses tronquées, douze mois pour le journal de sécurité de
    l'espace choristes, trente jours pour le journal du système. Regardez
    maintenant ce que le serveur garde vraiment : /var/log/nginx,
    /var/log/choir, le journal.
kept-forever-event-forever =
    { $weeks } semaines de journaux d'accès, jusqu'à septembre 2027, chaque
    ligne avec l'adresse IP complète d'un·e visiteur·se : pour le RGPD, une
    adresse IP est une donnée personnelle. Le « rotate 520 » de Ruben garde
    dix ans de journaux hebdomadaires. Où logrotate décide-t-il de la durée
    de vie d'un journal ? (man logrotate : rotate, maxage, daily, weekly.)
kept-forever-event-today-only =
    Le journal du jour a disparu, mais les années d'archives sont toujours
    là : le problème n'a jamais été le fichier du jour. Et la politique
    demande de garder trente jours de journaux, pour enquêter sur un
    incident : supprimez ce qui est plus vieux, pas ce qui est récent.
kept-forever-event-too-much =
    Vous avez supprimé des journaux que la politique demande de garder : les
    dernières semaines de journaux web (trente jours, pour enquêter sur un
    incident) ou le journal de sécurité des douze derniers mois. Une
    politique de conservation est un maximum et un minimum. Sur un vrai
    serveur, il faudrait les restaurer depuis une sauvegarde ; ici,
    recommencez le chapitre (ou revenez à l'instantané de secours) et ne
    supprimez que ce qui est plus vieux que ce que la politique permet.
kept-forever-event-rotation =
    logrotate ne garde plus que trente jours de journaux d'accès. Mais
    logrotate n'agit qu'à la prochaine rotation, et il ne supprime que le
    journal qui dépasse son compte : les années d'archives laissées par un
    compte plus grand restent où elles sont. Regardez-les à nouveau (ls, ou
    find -mtime).
kept-forever-event-leftovers =
    logrotate est passé avec le nouveau compte, et { $count } anciennes
    archives sont toujours là : il ne supprime que l'archive qui dépasse le
    compte (et, avec maxage, les vieilles parmi compte + 1), jamais les
    centaines de fichiers laissés au-delà. Supprimez vous-même ce qui a plus
    de trente jours, prudemment : find /var/log/nginx -mtime +30 les liste
    avant que vous ne supprimiez quoi que ce soit.
kept-forever-event-purged =
    Plus rien de plus de trente jours dans /var/log/nginx, et les semaines
    récentes sont toujours là. Le passé est en règle ; reste le présent :
    chaque nouvelle ligne porte encore l'adresse complète du visiteur ou de
    la visiteuse.
kept-forever-event-log-off =
    access_log off : nginx n'écrit plus aucun journal d'accès. Plus
    d'adresses, certes, mais plus moyen d'enquêter sur un incident non plus,
    et la politique en demande trente jours. Gardez le journal, avec
    l'adresse tronquée (man nginx : map, log_format).
kept-forever-event-v6-whole =
    Les adresses IPv4 sont tronquées, mais les visiteur·ses en IPv6
    gardent leur adresse complète : une partie des visites de la chorale
    arrive en IPv6 (2001:db8:…). Votre map doit traiter les deux, ou se
    rabattre sur une valeur par défaut qui ne révèle rien.
kept-forever-event-not-loaded =
    La configuration des fichiers tronque les adresses, mais le nginx qui
    tourne utilise toujours la configuration qu'il a chargée : nginx -t,
    puis rechargez-le (systemctl reload nginx).
kept-forever-event-anonymised =
    Les nouvelles visites apparaissent dans access.log avec une adresse
    tronquée (le dernier octet d'une adresse IPv4, tout ce qui suit le
    deuxième groupe d'une adresse IPv6) : assez pour repérer un réseau qui
    inonde le site, pas assez pour désigner un foyer. Reste le journal du
    système.
kept-forever-event-vacuum-only =
    Les vieux fichiers du journal ont disparu, mais rien ne dit à journald
    de garder le journal à trente jours : il va regrossir. La politique a sa
    place dans sa configuration (man journald.conf : MaxRetentionSec=).
kept-forever-event-journal-not-loaded =
    MaxRetentionSec= est dans le fichier, mais journald lit sa configuration
    à son démarrage : redémarrez-le (systemctl restart systemd-journald).
kept-forever-event-journal =
    journald garde maintenant trente jours, et a supprimé les fichiers
    archivés plus anciens.
kept-forever-event-end =
    Amara : « Merci ! Je vais dire au bureau que nous faisons maintenant ce
    que nous disons. Je me demande ce que nous gardons d'autre sans le
    savoir… »

    Bravo ! Vous avez terminé Gardé pour toujours.

    CE QUI S'EST PASSÉ
    La politique du bureau promettait trente jours de journaux web aux
    adresses tronquées, et trente jours de journal du système. Le logrotate
    de Ruben gardait dix ans de journaux hebdomadaires, avec l'adresse IP
    complète de chaque visite, et le journal remontait à 2027. Vous avez
    réglé logrotate sur trente jours, supprimé les archives qu'il n'aurait
    jamais supprimées lui-même, tronqué les adresses qu'écrit nginx avec une
    map et un log_format, et donné à journald un MaxRetentionSec=, en
    gardant le journal de sécurité de l'espace choristes, qui était déjà
    juste.

    BONNES PRATIQUES
    - Limitation de la conservation (RGPD, article 5, 1, e) : une donnée
      personnelle n'est pas gardée plus longtemps que son but ne l'exige.
      Une adresse IP est une donnée personnelle.
    - Une durée de conservation se règle dans l'outil qui garde la donnée
      (logrotate, journald), pas dans un pense-bête : elle s'applique alors
      chaque jour.
    - Changer le compte de logrotate ne nettoie pas le passé : il ne
      supprime que l'archive qui dépasse le compte. Vérifiez avec find
      -mtime avant de supprimer.
    - Minimiser à la source : une adresse tronquée dans le journal plutôt
      qu'une adresse complète nettoyée plus tard. Le journal d'erreurs garde
      encore des adresses complètes : gardez-le court lui aussi, ou à un
      niveau qui en écrit moins.
    - Une politique est aussi un minimum : le journal de sécurité des douze
      derniers mois reste, pour répondre à « qui s'est connecté ? » après un
      incident.

    DOCUMENTATION
    - RGPD, article 5 : https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - La CNIL : https://www.cnil.fr/
    - Le module de journalisation de nginx : https://nginx.org/en/docs/http/ngx_http_log_module.html
    - Le module map de nginx : https://nginx.org/en/docs/http/ngx_http_map_module.html
    - logrotate(8) : https://man7.org/linux/man-pages/man8/logrotate.8.html
    - journald.conf(5) : https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html

## Ce que partagent les trois chapitres de l'histoire (choristes, politique, pages) : ici pour être chargé avec l'histoire.

choir-list-locale = fr
choir-policy-marker = COMBIEN DE TEMPS NOUS GARDONS LES DONNÉES PERSONNELLES

# Personnes inventées (tranche de numéros réservée à la fiction par l'ARCEP, domaines .example) : id|first_name|last_name|email|phone|voice|joined_on|left_on|address
choir-members =
    1|Amara|Okafor|amara.okafor@mail.example|06 39 98 01 01|alto|2025-09-01||3 rue du Moulin, Les Berges
    2|Kenji|Watanabe|kenji.watanabe@mail.example|06 39 98 01 02|basse|2025-09-01||27 allée des Vergers, Les Berges
    3|Gwen|Hughes|gwen.hughes@mail.example|06 39 98 01 03|soprano|2024-09-02|2027-06-30|8 chemin du Barrage, Les Berges
    4|Mateus|Silva|mateus.silva@mail.example|06 39 98 01 04|ténor|2025-09-01||41 quai du Canal, Les Berges
    5|Leila|Haddad|leila.haddad@mail.example|06 39 98 01 05|soprano|2026-01-12||12 route du Bac, Les Berges
    6|Oskar|Lindqvist|oskar.lindqvist@mail.example|06 39 98 01 06|basse|2026-09-07||5 impasse des Hérons, Les Berges
    7|Nadia|Petrova|nadia.petrova@mail.example|06 39 98 01 07|alto|2026-09-07||19 rue de l'Écluse, Les Berges
    8|Samuel|Mensah|samuel.mensah@mail.example|06 39 98 01 08|ténor|2025-09-01|2028-06-30|2 rive des Saules, Les Berges
    9|Chloe|Martin|chloe.martin@mail.example|06 39 98 01 09|soprano|2027-09-05||33 côte de la Gare, Les Berges
    10|Arjun|Mehta|arjun.mehta@mail.example|06 39 98 01 10|basse|2027-09-05||7 rue du Port, Les Berges
    11|Fatima|Idrissi|fatima.idrissi@mail.example|06 39 98 01 11|alto|2027-09-05||16 promenade des Péniches, Les Berges
    12|Brendan|Walsh|brendan.walsh@mail.example|06 39 98 01 12|ténor|2026-09-07|2028-12-15|9 cour des Roseaux, Les Berges
    13|Yuki|Tanaka|yuki.tanaka@mail.example|06 39 98 01 13|soprano|2028-01-10||21 vue des Prés, Les Berges
    14|Rosa|Delgado|rosa.delgado@mail.example|06 39 98 01 14|alto|2028-09-03||4 chemin de Halage, Les Berges
    15|Ivan|Horvat|ivan.horvat@mail.example|06 39 98 01 15|basse|2027-09-05|2029-06-30|11 bout du Pont, Les Berges
    16|Aisha|Bello|aisha.bello@mail.example|06 39 98 01 16|soprano|2028-09-03||28 rue du Moulin, Les Berges
    17|Tom|Becker|tom.becker@mail.example|06 39 98 01 17|ténor|2028-09-03||6 avenue des Tilleuls, Les Berges
    18|Mei|Lin|mei.lin@mail.example|06 39 98 01 18|alto|2029-01-14||30 montée des Martins-Pêcheurs, Les Berges
    19|Pablo|Ortega|pablo.ortega@mail.example|06 39 98 01 19|basse|2028-09-03|2030-06-30|15 route de la Vanne, Les Berges
    20|Ingrid|Solberg|ingrid.solberg@mail.example|06 39 98 01 20|soprano|2029-09-08||2 chemin des Osiers, Les Berges
    21|Kwabena|Asante|kwabena.asante@mail.example|06 39 98 01 21|ténor|2029-09-08||18 rue du Quai, Les Berges
    22|Hannah|Weiss|hannah.weiss@mail.example|06 39 98 01 22|alto|2029-09-08|2030-12-20|23 rue du Brochet, Les Berges
    23|Sofia|Rossi|sofia.rossi@mail.example|06 39 98 01 23|soprano|2029-09-08||10 allée des Poules-d'Eau, Les Berges
    24|Daniel|Cohen|daniel.cohen@mail.example|06 39 98 01 24|basse|2030-01-12||37 quai du Canal, Les Berges
    25|Lucia|Moreno|lucia.moreno@mail.example|06 39 98 01 25|alto|2030-01-12||1 route du Bac, Les Berges
    26|Omar|Farouk|omar.farouk@mail.example|06 39 98 01 26|ténor|2030-09-07||13 impasse des Hérons, Les Berges
    27|Priya|Raman|priya.raman@mail.example|06 39 98 01 27|alto|2030-09-07||14 cour des Ormes, Les Berges
    28|Elif|Kaya|elif.kaya@mail.example|06 39 98 01 28|soprano|2030-09-07||9 rue de l'Écluse, Les Berges
    33|Minh|Tran|minh.tran@mail.example|06 39 98 01 33|basse|2030-09-07||26 rue du Port, Les Berges
    36|Grace|Mwangi|grace.mwangi@mail.example|06 39 98 01 36|soprano|2031-01-11||5 chemin du Barrage, Les Berges
    41|Tomas|Novak|tomas.novak@mail.example|06 39 98 01 41|ténor|2029-09-08||22 promenade des Péniches, Les Berges

# Des personnes inscrites à la lettre d'information sur le site sans être choristes : email|date.
choir-newsletter-public =
    jo.bright@post.example|2029-11-02
    sam.okonjo@post.example|2030-05-17
    lee.harper@post.example|2030-12-06

# L'export de Ruben pour la chaîne téléphonique, octobre 2030 (Priya habitait ailleurs).
choir-phone-tree =
    nom,pupitre,telephone,adresse
    Amara Okafor,alto,06 39 98 01 01,3 rue du Moulin
    Kenji Watanabe,basse,06 39 98 01 02,27 allée des Vergers
    Mateus Silva,ténor,06 39 98 01 04,41 quai du Canal
    Leila Haddad,soprano,06 39 98 01 05,12 route du Bac
    Nadia Petrova,alto,06 39 98 01 07,19 rue de l'Écluse
    Arjun Mehta,basse,06 39 98 01 10,7 rue du Port
    Rosa Delgado,alto,06 39 98 01 14,4 chemin de Halage
    Tom Becker,ténor,06 39 98 01 17,6 avenue des Tilleuls
    Ingrid Solberg,soprano,06 39 98 01 20,2 chemin des Osiers
    Omar Farouk,ténor,06 39 98 01 26,13 impasse des Hérons
    Priya Raman,alto,06 39 98 01 27,3 montée des Martins-Pêcheurs
    Elif Kaya,soprano,06 39 98 01 28,9 rue de l'Écluse

choir-purge-comment = Supprime ce que notre politique de conservation dit expiré (Ruben, 2029).

choir-policy =
    CHORALE DES BERGES
    COMBIEN DE TEMPS NOUS GARDONS LES DONNÉES PERSONNELLES
    Adoptée par le bureau le 14 septembre 2029. Revue chaque septembre.

    Nous ne gardons les données personnelles que le temps nécessaire au but
    pour lequel nous les avons recueillies (RGPD, article 5, 1, e). Le délai
    passé, elles sont supprimées, ou anonymisées pour que personne ne puisse
    plus être identifié.

    Quoi                                   Combien de temps                  Pourquoi
    -------------------------------------  --------------------------------  ---------------------------------
    Fiches des choristes (profil, contact) tant qu'on est choriste, puis     pour accueillir celles et ceux
                                           2 ans                             qui reviennent
    Présences aux répétitions              2 ans                             organisation, assurance de la salle
    Cotisations et paiements               10 ans                            pièces comptables (la loi)
    Photo et son formulaire de consentement tant qu'on est choriste          consentement
    Adresse pour la lettre d'information   jusqu'à la désinscription         consentement
    Journaux d'accès du serveur web        30 jours, adresses tronquées      sécurité : assez pour enquêter
                                                                             sur un incident, pas plus
    Journal de sécurité de l'espace        12 mois                           enquêtes de sécurité
    choristes (audit)
    Journal du système                     30 jours                          sécurité, dépannage
    Sauvegardes                            3 mois de sauvegardes             reprise après un incident
                                           hebdomadaires (les données
                                           effacées en sortent en vieillissant)

    Demandes des choristes (copie de leurs données, rectification,
    effacement) : réponse sous un mois (RGPD, article 12, 3). Amara les
    reçoit et les transmet à qui s'occupe du serveur.

choir-page-index =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Chorale des Berges</title></head>
    <body>
    <h1>Chorale des Berges</h1>
    <p>Quarante voix, sans audition, répétition chaque mardi à 19 h 30 à la salle de l'Écluse.</p>
    <p><a href="/concerts.html">Concerts</a> · <a href="/join.html">Nous rejoindre</a> · <a href="/members/login">Espace choristes</a></p>
    </body>
    </html>
choir-page-concerts =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Concerts — Chorale des Berges</title></head>
    <body>
    <h1>Concerts</h1>
    <p>Concert de printemps : samedi 12 avril 2031, 19 h, église Sainte-Anne. Entrée libre, participation au chapeau.</p>
    </body>
    </html>
choir-page-join =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Nous rejoindre — Chorale des Berges</title></head>
    <body>
    <h1>Nous rejoindre</h1>
    <p>Venez à n'importe quelle répétition du mardi : pas d'audition, pas besoin de lire la musique. La cotisation est de 120 par saison (60 en tarif réduit).</p>
    </body>
    </html>
choir-page-login =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Espace choristes</title></head>
    <body><h1>Espace choristes</h1><form method="post"><input name="email"><input name="password" type="password"><button>Se connecter</button></form></body>
    </html>
