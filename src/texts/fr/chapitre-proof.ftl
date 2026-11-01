### Histoire « La Veille », chapitre « Sans preuve, pas de certitude » :
### reprouver que les correctifs tiennent, chercher une tentative antérieure
### dans les journaux. Les commandes, les chemins et le format du journal
### d'accès de nginx (en anglais) ne se traduisent pas.

chapitre-proof = Sans preuve, pas de certitude
    .resume = Reprouver que les correctifs tiennent, et chercher si la faille avait déjà été tentée.

## Fichiers

proof-courriel-salome =
    De :     Salomé
    À :      toi
    Objet :  Une dernière chose avant de clore la semaine

    Deux CVE corrigées, c'est bien ; encore faut-il le prouver, pas juste le
    croire. Confirme avec apt (man apt) que plus rien n'attend pour nginx
    et rsync.

    Et une habitude à prendre, même après coup : la faille de nginx
    (HTTP/2) était-elle déjà en train d'être tentée avant que tu la
    corriges ? Le journal d'accès de nginx garde une trace de chaque
    requête (man grep pour le fouiller). Une tentative qui a échoué ne fait
    de mal à personne, mais mérite d'être notée : elle dit que quelqu'un,
    dehors, cherchait déjà.

    Salomé

## Événements

proof-evenement-versions =
    apt confirme : plus rien à mettre à jour pour nginx ni rsync. Ce n'est
    qu'une fois vérifié que c'est vraiment corrigé.
# { $adresse } : l'adresse de la tentative trouvée
proof-evenement-trouve =
    Une ligne du journal d'accès attire l'œil : une requête HTTP/2 vide,
    sans navigateur déclaré, refusée par nginx (code 400), depuis
    { $adresse }, quelques jours avant le correctif. Ce n'est pas une preuve
    d'intrusion réussie (nginx l'a refusée), mais c'est une trace qu'il vaut
    la peine de garder : quelqu'un cherchait déjà.
proof-evenement-fin =
    Salomé : « Voilà ce que je veux dire par preuve : pas « je pense que
    c'est corrigé », mais « apt confirme, et voici la tentative qu'on a
    repérée ». »

    Bravo ! Tu as terminé le chapitre « Sans preuve, pas de certitude ».

    CE QUI S'EST PASSÉ
    Un correctif appliqué sans vérification n'est qu'une intention. Vérifier
    après coup (apt list --upgradable vide) transforme « je crois que c'est
    fait » en fait établi. Chercher dans les journaux une tentative
    antérieure, même ratée, donne une idée de qui s'intéressait déjà à ce
    serveur, et depuis quand.

    LA BONNE PRATIQUE
    - Toujours reprouver un correctif après l'avoir appliqué : apt list
      --upgradable, ou la commande propre à l'outil corrigé.
    - Chercher les traces d'une tentative avant de clore un incident, même
      sans preuve qu'elle ait réussi : ça fait partie de la veille, pas
      seulement de la réponse à un incident déjà visible.
    - Garder les journaux assez longtemps pour pouvoir les relire : une
      tentative ne se voit souvent qu'après coup, en connaissant la faille.

    UNE AUTRE VOIE
    Un système de détection d'intrusion (comme fail2ban, déjà vu dans « La
    sentinelle », ou un outil plus complet comme Suricata) peut repérer ce
    genre de tentative en direct plutôt qu'après coup, et réagir tout seul
    (bannir l'adresse). Les deux se complètent : la détection en direct
    pour réagir vite, la relecture des journaux pour comprendre ce qu'on a
    raté.

    LA DOCUMENTATION
    - apt : https://manpages.debian.org/trixie/apt/apt.8.en.html
    - Le format du journal d'accès de nginx : https://nginx.org/en/docs/http/ngx_http_log_module.html
