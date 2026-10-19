### Histoire « Les Lettres du quartier », chapitre 8 « La récidive » :
### d'autres prisons de fail2ban (recidive, nginx-limit-req). Les commandes,
### chemins, noms de prisons et lignes de journal ne se traduisent pas.

chapitre-recidive = La récidive
    .resume = Les mêmes robots reviennent chaque heure, et celui de l'agenda insiste : activer les prisons recidive et nginx-limit-req de fail2ban.

## Fichiers

recidive-courriel-rania =
    De :     Rania
    À :      toi
    Objet :  Toujours les mêmes

    Bonjour !

    Depuis que SSH est sur le port 2222, c'est plus calme, mais regarde
    /var/log/fail2ban.log : deux adresses sont bannies une heure,
    débannies, rebannies… neuf fois depuis hier pour l'une d'elles. Elles
    ont trouvé le nouveau port, et le bannissement d'une heure ne les
    décourage pas.

    Et le robot qui aspirait l'agenda le soir du concert est revenu.
    nginx le limite bien (il reçoit des refus), mais il insiste : le
    journal d'erreurs de nginx (/var/log/nginx/error.log) est plein de
    « limiting requests ».

    fail2ban a des prisons toutes prêtes pour ces deux cas, elles sont
    décrites dans /etc/fail2ban/jail.conf (cherche recidive, et les
    prisons nginx). Elles sont simplement désactivées. Tu te souviens :
    on ne touche pas à jail.conf, on règle dans jail.local.

    Fais attention à moi : pendant mes essais de la limite, j'ai
    rechargé l'agenda un peu trop vite, moi aussi.

    Pour vérifier : sudo fail2ban-client status, puis le status de
    chaque prison. Et sudo nft list ruleset montre ce que chaque prison
    bloque.

## Événements

recidive-evenement-tout-active =
    fail2ban refuse de démarrer : « Have not found any log file ». Avec
    enabled = true dans [DEFAULT], tu as activé TOUTES les prisons de
    jail.conf, y compris celles d'apache et de postfix, qui ne tournent pas
    ici : fail2ban ne trouve pas leurs journaux et s'arrête. On active une
    prison dans sa propre section : [recidive], [nginx-limit-req]…
recidive-evenement-courte =
    La prison recidive est active, mais elle ne bannit pas plus longtemps
    que la prison sshd. Tout son intérêt est là : une adresse bannie
    plusieurs fois l'est ensuite pour longtemps (une semaine, dans
    jail.conf). Garde un bantime nettement plus long pour recidive.
recidive-evenement-recidive =
    La prison recidive a lu fail2ban.log, compté les bannissements de
    chaque adresse, et banni les récidivistes pour une semaine, sur tous
    les ports (banaction_allports) : SSH, mais aussi le site.
recidive-evenement-agenda =
    La prison nginx-limit-req a lu le journal d'erreurs de nginx et banni
    les adresses du robot de l'agenda. nginx ne les voit même plus
    arriver : le pare-feu les rejette avant.
recidive-evenement-fin =
    Les récidivistes sont bannis pour une semaine, le robot de l'agenda
    aussi, et ni Rania ni les visiteur·ses n'ont été touché·es. Rania :
    « fail2ban.log tient sur un écran, maintenant ! »

    Bravo ! Tu as terminé le chapitre « La récidive ».

    CE QUI S'EST PASSÉ
    Une prison de fail2ban, c'est un journal à lire, un filtre (ce qu'est
    un échec) et une action (ce qu'on bloque, et combien de temps).
    nginx-limit-req lit les refus de la limite de débit de nginx ;
    recidive lit le journal de fail2ban lui-même : une adresse bannie cinq
    fois en un jour l'est ensuite une semaine, sur tous les ports.
    ignoreip, mis dans [DEFAULT], protège Rania dans toutes les prisons.

    LA BONNE PRATIQUE
    - Activer une prison dans sa section de jail.local (enabled = true),
      jamais dans [DEFAULT], jamais dans jail.conf.
    - fail2ban-client -t avant de recharger, puis fail2ban-client status
      pour chaque prison.
    - recidive bannit plus longtemps que les autres prisons ; la base de
      fail2ban (dbpurgeage) doit garder les bannissements au moins aussi
      longtemps que son findtime.
    - Autre approche, depuis fail2ban 0.11 : bantime.increment = true
      allonge le bannissement à chaque récidive, dans toutes les prisons.

    LA DOCUMENTATION
    - jail.conf (fail2ban) : https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - Les prisons livrées avec fail2ban : https://github.com/fail2ban/fail2ban/blob/master/config/jail.conf
    - limit_req (nginx) : https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
