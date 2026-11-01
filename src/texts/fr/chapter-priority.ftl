### Histoire « La Veille », chapitre « La priorité » : classer deux CVE par
### exposition autant que par score CVSS. Les identifiants de CVE sont
### fictifs ; les noms de paquets, les commandes et les chemins ne se
### traduisent pas.

chapter-priority = La priorité
    .summary = Décider quoi corriger en premier : l'exposition compte autant que le score CVSS.

## Fichiers

priority-email-salome =
    De :     Salomé
    À :      toi
    Objet :  Deux CVE, dans quel ordre ?

    Bien joué pour le tri. Il reste deux CVE à traiter : nginx (score 8.2)
    et rsync (score 9.8). Si tu t'arrêtes au score, rsync passe en premier,
    c'est le plus haut. Mais le score seul ne dit pas tout.

    Pose-toi la question que je me pose toujours : qui peut atteindre ce
    service, et comment ? Regarde ce qui écoute vraiment sur ce serveur
    (man ss, man nmap). Un service joignable depuis internet, même avec un
    score plus bas, mérite d'être traité avant un outil qui ne tourne
    jamais sans qu'on le lance soi-même.

    Écris ta décision dans priorite.md, avec pourquoi. Et dis-moi aussi ce
    qu'on fait de la CVE de openssh-server : elle s'applique à ce serveur,
    mais est-ce qu'elle demande une action ?

    Salomé

priority-template =
    # Priorité — Le Fournil

    (à compléter : l'ordre de traitement des deux CVE retenues, avec pourquoi ;
    et ce qu'on fait de la CVE d'openssh-server)

priority-a-complete = (à compléter
priority-words-expose = internet, joignable, exposé, exposée, public, publique, l'extérieur, 80, 443
priority-words-local = aucun port, pas de port, n'écoute pas, local, ligne de commande, outil, pas un service, pas de service
priority-words-protected = déjà protégé, déjà protégée, déjà à « no », déjà à no, rien à faire, pas d'action, kbdinteractiveauthentication

## Relecture

priority-review = Salomé relit ta décision :
priority-missing-template = Il reste la ligne « (à compléter) » du modèle.
priority-missing-order = Les deux CVE (nginx et rsync) doivent être citées, nginx en premier.
priority-missing-exposure = Dis pourquoi : qu'est-ce qui rend nginx joignable depuis internet, et pourquoi rsync ne l'est pas (regarde ss -tlnp ou nmap) ?
priority-missing-ssh = N'oublie pas la CVE d'openssh-server : s'applique-t-elle ? Faut-il agir ?

## Événements

priority-event-score-only =
    Tu as classé rsync avant nginx : c'est l'ordre du score CVSS (9.8 contre
    8.2), mais regarde l'exposition. Un score mesure la gravité SI la faille
    est atteinte ; il ne dit rien de la facilité à l'atteindre. Relance
    ss -tlnp ou nmap -sV sur ce serveur : qui peut parler à chaque service ?
priority-event-expose =
    Voilà ce qui écoute vraiment : 80 et 443 répondent à n'importe quelle
    adresse. rsync, lui, n'a jamais de port ouvert : c'est un outil qu'on
    lance, pas un service qui attend des connexions.
priority-event-order =
    Ton classement tient : nginx d'abord (exposé), rsync ensuite (un score
    plus haut, mais aucun port, donc aucune façon de l'atteindre à distance).
priority-event-end =
    Salomé : « C'est exactement ça. Le score dit « si ça touche », pas « est-ce
    que ça peut me toucher ». »

    Bravo ! Tu as terminé le chapitre « La priorité ».

    CE QUI S'EST PASSÉ
    Un score CVSS mesure l'impact d'une faille une fois atteinte (perte de
    données, contrôle du système…), pas la facilité de l'atteindre. Un
    service joignable depuis internet avec un score moyen est souvent plus
    urgent qu'un outil local avec un score élevé, parce que personne d'autre
    que toi ne peut déclencher la seconde faille.

    LA BONNE PRATIQUE
    - Croiser le score avec l'exposition réelle (ss -tlnp, nmap -sV) avant
      de décider d'un ordre de traitement.
    - Une faille qui demande un accès déjà obtenu (local, authentifié) est
      presque toujours moins urgente qu'une faille atteignable de
      l'extérieur, même à score égal ou inférieur.
    - Écrire la décision et sa raison : un ordre de priorité qui ne
      s'explique pas ne se défend pas.

    UNE AUTRE VOIE
    Le CVSS version 4.0 ajoute justement des métriques d'exposition
    (« Attack Requirements », « Attack Complexity ») au score de base, pour
    tenir compte d'une partie de ce raisonnement directement dans le
    chiffre ; il reste utile de vérifier soi-même l'exposition réelle de son
    propre système, que le score ne connaît pas.

    LA DOCUMENTATION
    - ss : https://man7.org/linux/man-pages/man8/ss.8.html
    - nmap : https://nmap.org/book/man.html
    - CVSS : https://www.first.org/cvss/
