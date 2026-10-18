### Histoire « Le Datacenter », chapitre « Premier jour » : premier jour de
### stage, le site de la médiathèque est en panne. Lire un journal nginx,
### enchaîner les commandes avec |, écrire avec > et >>, arrêter un
### processus, écrire dans un fichier de root avec sudo tee.
### Les commandes, chemins et adresses IP ne se traduisent pas.

chapitre-premier-jour = Premier jour
    .resume = Lire un journal de serveur, enchaîner les commandes avec |, écrire avec > et >>, arrêter un processus.

## Fichiers

premier-jour-courriel-awa =
    De :     Awa (responsable d'exploitation)
    À :      toi, stagiaire
    Objet :  Bienvenue… et urgence !

    Bienvenue dans l'équipe ! Tu tombes bien : depuis 20 h 25, le site de la
    médiathèque répond par des erreurs 503 (« Service indisponible »).

    Je suis coincée en réunion. Peux-tu enquêter ? Le journal du serveur web
    est ici :

      /var/log/nginx/access.log

    Chaque ligne est une visite : l'adresse IP du visiteur, la date, la page
    demandée, puis le code de réponse (200 = OK, 503 = en panne).

    1. Combien y a-t-il d'erreurs 503 dans le journal ?
    2. Qui envoie autant de demandes ?
    3. Remets le site en état, puis écris-moi un petit rapport dans
       ~/rapport.txt : le nombre d'erreurs 503 et l'adresse du coupable.

    Ton mot de passe provisoire (pour sudo) : bienvenue-2026
    Change-le vite, et ne le note nulle part !

    Mes notes sont dans ~/notes_awa.txt.
premier-jour-notes-awa =
    NOTES D'AWA — LES COMMANDES DU QUOTIDIEN

      head fichier        le début (10 lignes)       tail fichier   la fin
      wc -l fichier       compte les lignes
      grep motif fichier  les lignes qui contiennent le motif

    La vraie force d'Unix : le TUBE |. La sortie d'une commande devient
    l'entrée de la suivante. Par exemple :

      grep " 503 " access.log | wc -l     compte les lignes qui contiennent « 503 »

    (les guillemets gardent les espaces : on cherche « 503 » entouré d'espaces,
    pour ne pas tomber sur un 503 caché dans une adresse ou une taille).

    Pour savoir qui demande le plus souvent :

      cut -d " " -f 1 fichier     garde le 1er champ de chaque ligne (l'IP)
      sort                        trie les lignes
      uniq -c                     compte les lignes identiques qui se suivent
      sort -n                     trie par nombre
      tail -3                     garde les 3 dernières (les plus grandes)

    On les enchaîne toutes avec des | . Essaie !

    Écrire dans un fichier :
      commande > fichier     ÉCRASE le fichier avec le résultat
      commande >> fichier    AJOUTE le résultat à la fin

    Le serveur web (nginx) bloque les adresses listées dans
    /etc/nginx/bloques.conf, au format : deny ADRESSE;
    Ce fichier appartient à root. Après l'avoir modifié, il faut demander à
    nginx de le relire : sudo systemctl reload nginx
# Commentaire en tête de /etc/nginx/bloques.conf (après « # »)
premier-jour-bloques-commentaire = Adresses bloquées par nginx (une règle par ligne)
# Description du service, affichée par « systemctl status catalogue »
premier-jour-service-catalogue = Catalogue en ligne de la médiathèque (php-fpm)

## Relance du service par systemd après kill ({ $pid } : numéro du nouveau processus)

premier-jour-relance-calme = systemd relance le service catalogue : nouveau processus { $pid }. Le robot étant bloqué, il reste calme.
premier-jour-relance-robot = systemd relance aussitôt le service catalogue : nouveau processus { $pid }… et le robot recommence. Il est déjà à 99 % !

## Événements ({ $robot } : adresse IP du robot ; { $bloques } : chemin de bloques.conf)

# { $erreurs } : nombre d'erreurs 503 dans le journal
premier-jour-evenement-compte =
    Exact : { $erreurs } erreurs 503. Tu viens d'enchaîner deux petits outils :
    grep filtre les lignes, wc les compte. C'est toute la philosophie d'Unix :
    des outils simples, qu'on branche les uns aux autres.

    Question suivante : qui envoie autant de demandes ? (voir ~/notes_awa.txt)
# { $requetes } : nombre de demandes du robot
premier-jour-evenement-robot =
    { $robot } : { $requetes } demandes en quelques minutes, toutes vers
    /catalogue/recherche. Ce n'est pas un humain : c'est un robot qui aspire
    le catalogue, et le service « catalogue » n'arrive plus à suivre.

    Regarde ce qui se passe sur la machine :  ps aux
premier-jour-evenement-surcharge =
    Le processus 4242 (php-fpm: pool catalogue) utilise 99 % du processeur.
    Tu pourrais l'arrêter avec kill… mais si le robot continue, il retombera
    aussitôt. Bloque d'abord le robot dans /etc/nginx/bloques.conf.

    Ce fichier appartient à root, et  sudo echo … >> fichier  ne marche pas :
    la redirection >> est faite par TON shell, pas par sudo. L'astuce
    classique, c'est tee, qui écrit ce qu'il reçoit dans un fichier :

      echo "deny { $robot };" | sudo tee -a { $bloques }
premier-jour-evenement-ecrase =
    Oups ! Les anciennes règles de bloques.conf ont disparu : le fichier a été
    ÉCRASÉ (> ou tee sans -a) au lieu d'être complété (>> ou tee -a). Pas de
    panique : une copie de sauvegarde existe. Restaure-la avec
    sudo cp /etc/nginx/bloques.conf.bak { $bloques }, puis recommence avec -a.
premier-jour-evenement-regle = La règle est écrite. Mais nginx ne relit pas son fichier tout seul : sudo systemctl reload nginx
premier-jour-evenement-bloque =
    nginx a relu sa configuration : { $robot } reçoit maintenant « 403 Forbidden »
    au lieu de pages.
# Variante quand le processus surchargé tourne encore ({ $pid } : son numéro)
premier-jour-evenement-bloque-processus =
    nginx a relu sa configuration : { $robot } reçoit maintenant « 403 Forbidden »
    au lieu de pages. Reste le processus { $pid }, toujours bloqué à 99 % : arrête-le
    (il appartient à www-data, donc… sudo). systemd le relancera tout propre.
premier-jour-evenement-repare =
    Le site de la médiathèque répond de nouveau ! Dernière chose : le rapport
    pour Awa, dans ~/rapport.txt. Avec > on crée le fichier, avec >> on ajoute
    une ligne. Par exemple :

      grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt
      echo "Coupable : { $robot }" >> ~/rapport.txt
premier-jour-evenement-rapport =
    Awa sort de réunion et lit ton rapport : « { $erreurs } erreurs, robot
    identifié, bloqué, service relancé. Pour un premier jour… bravo ! »

    FIN DU CHAPITRE « PREMIER JOUR ».

    Tu sais maintenant lire un journal (head, tail, grep), compter et classer
    (wc, cut, sort, uniq), enchaîner les outils avec |, écrire dans un fichier
    (> écrase, >> ajoute), et gérer processus et services (ps, kill,
    systemctl). Ce sont les gestes de tous les jours des personnes qui font
    tourner les serveurs d'internet.
