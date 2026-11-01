### Histoire « La Gazette », chapitre 4 « Le canari » : envoyer une petite
### part du trafic à la nouvelle version, et regarder les journaux avant
### d'aller plus loin. Les commandes, chemins et messages de nginx, curl et
### des journaux ne se traduisent pas.

chapter-canary = Le canari
    .summary = Une version qui passe ses vérifications de santé mais plante sur une page : un canari (une visite sur dix), les journaux, et la bascule seulement quand tout est propre.

## Fichiers

canary-message-samia =
    Un message de Samia :

    « La 1.6.0 du Kiosque est sortie (/srv/kiosk/versions/1.6.0), avec
    une nouvelle recherche dans les archives. Green sert toujours la 1.5.0 ;
    la nouvelle version ira sur blue, comme convenu.

    Mais cette version change beaucoup de choses, et /health ne vérifie
    pas tout. Alors cette fois, pas de bascule d'un coup : d'abord un
    canari. Une visite sur dix pour blue, le reste pour green, et on
    regarde ce que reçoivent les lecteur·rices (/var/log/nginx/access.log)
    avant d'aller plus loin. man nginx explique comment répartir entre deux
    serveurs (upstream, weight).

    Pour sudo : gazette-2027. »
canary-notes-160 =
    Kiosque 1.6.0 — notes de version

    Nouveau : recherche dans les lettres précédentes (/archives).
    Rien à changer dans la configuration.
canary-notes-161 =
    Kiosque 1.6.1 — notes de version

    Correctif : la page des archives (/archives) répondait 500 quand la
    recherche était vide. Merci à l'équipe de la Gazette pour le
    signalement !

## Événements

# { $visits } : le nombre de visites simulées
canary-one-time =
    Une heure passe : { $visits } visites sur le Kiosque, à travers nginx.
    Tout est écrit dans /var/log/nginx/access.log.
# { $errors } : le nombre de visites qui ont reçu une erreur
canary-event-all-one-coup =
    Tout le trafic est passé d'un coup à la 1.6.0… et { $errors } visites
    sur l'heure ont reçu une erreur 500 : tout le monde en profite. C'est
    ce que le canari aurait évité. Reviens à green (proxy_pass, nginx -t,
    reload), puis essaie avec une petite part du trafic.
canary-event-canary-160 =
    Le canari est en place : blue (1.6.0) reçoit une petite part des visites.
    Regarde maintenant ce que les lecteur·rices ont reçu : les codes de
    réponse sont dans access.log (le nombre après la requête : 200, 404,
    500…). grep ou awk aident à trier.
canary-event-too-big =
    Une grosse part du trafic va à la nouvelle version : si elle a un
    problème, beaucoup de monde le verra. Un canari, c'est une petite part
    (une visite sur dix, ou moins) : weight=1 face à weight=9.
canary-event-found =
    Des 500 sur /kiosk/archives ! Ils viennent forcément de blue : green
    sert la même page depuis des semaines. Essaie-la directement sur chaque
    instance (curl http://localhost:3001/archives, puis 3002) pour en être
    sûr·e. /health ne vérifiait pas cette page. Arrête le canari : plus
    aucune visite pour blue (down, ou retirer le serveur).
canary-event-stopped =
    Canari arrêté : seule une visite sur dix a vu l'erreur, pendant une
    heure, au lieu de tout le monde. Samia transmet le problème aux
    développeur·ses… qui publient aussitôt la 1.6.1 (/srv/kiosk/versions/).
    On recommence : blue, /health, canari, journaux.
canary-event-canary-161 =
    Une heure de canari avec la 1.6.1 : aucune erreur dans ce lot de
    visites. La nouvelle version peut recevoir tout le trafic. Garde green
    allumé, au cas où.
canary-event-end =
    Tout le Kiosque passe par la 1.6.1, sans erreur, et green attend en
    réserve. Samia : « Le premier essai n'a gêné qu'une visite sur dix,
    pendant une heure. Sans canari, on l'aurait servi à tout le monde. »

    Bravo ! Tu as terminé le chapitre 4 de La Gazette. (La suite t'attend :
    ssh gazette.)

    CE QUI S'EST PASSÉ
    La 1.6.0 répondait bien sur /health, mais plantait sur une page
    précise. Un upstream nginx a envoyé une petite part des visites à la
    nouvelle version (weight=1 face à weight=9) : les erreurs sont apparues
    dans access.log, pour peu de monde. On a arrêté le canari, attendu le
    correctif, refait un canari propre, puis tout basculé.

    LA BONNE PRATIQUE
    - Un canari : une petite part du trafic (quelques %), pendant un temps
      défini, avec des critères d'arrêt décidés à l'avance (taux de 5xx).
    - Regarder ce que voient les utilisateur·rices (les journaux d'accès),
      pas seulement /health.
    - Pouvoir arrêter le canari d'un geste (down, reload).
    - Augmenter par paliers (10 %, 50 %, 100 %) ; garder l'ancienne version
      allumée jusqu'au bout.
    - Pour savoir qui a servi chaque visite, ajouter $upstream_addr au
      format du journal (log_format).

    LA DOCUMENTATION
    - upstream et weight : https://nginx.org/en/docs/http/ngx_http_upstream_module.html
    - Le déploiement canari : https://martinfowler.com/bliki/CanaryRelease.html
    - Canarying releases (Google SRE) : https://sre.google/workbook/canarying-releases/
