### Histoire « La Veille », chapitre « Mettre en veille » : automatiser les
### mises à jour de sécurité (sans tout faire tout seul) et planifier un
### rendez-vous hebdomadaire. Les mots-clés d'apt.conf, les commandes et les
### chemins ne se traduisent pas.

chapter-routine = Mettre en veille
    .summary = Automatiser ce qui peut l'être (mises à jour de sécurité, un rendez-vous hebdomadaire), sans remplacer la décision humaine.

## Fichiers

routine-email-salome =
    De :     Salomé
    À :      toi
    Objet :  La dernière pièce : en faire une habitude

    On a fini la semaine, mais une veille n'est pas un geste qu'on fait une
    fois. Deux choses à mettre en place avant que je m'en aille pour de
    bon :

    1. unattended-upgrades est installé, mais pas activé (regarde
       /etc/apt/apt.conf.d/20auto-upgrades : les deux tâches périodiques
       sont à « 0 »). Active-les. Et limite-le aux mises à jour de SÉCURITÉ
       seulement (/etc/apt/apt.conf.d/50unattended-upgrades) : tout
       auto-mettre à jour casserait un jour sans prévenir. Donne-toi un
       rapport par courrier (Unattended-Upgrade::Mail).
    2. Un rendez-vous hebdomadaire qui te rappelle de lire le prochain
       bulletin : un timer systemd ou une tâche cron, qui t'envoie par
       courrier la liste des paquets en attente de mise à jour (man
       systemd.timer, man crontab).

    unattended-upgrades s'occupera des mises à jour de sécurité toute
    seule ; le reste (une CVE sans correctif encore, un paquet hors de la
    sécurité) restera ton travail, chaque semaine, avec le prochain
    bulletin.

    Salomé
    (Pour sudo, ton mot de passe est toujours : levain-2028)

## Événements

routine-event-syntax =
    Il y a une erreur de syntaxe dans la configuration d'apt ! Une
    affectation s'écrit « Clé "valeur"; », une liste « Clé {"{"} "a"; "b"; {"}"}; »
    (man apt.conf). Corrige-la avant de continuer : apt refuse de lire le
    reste tant qu'elle y est.
routine-event-active =
    Les deux tâches périodiques sont activées. Reste à limiter ce
    qu'unattended-upgrades touche, et à te donner un rapport.
routine-event-security =
    unattended-upgrades est actif, limité aux mises à jour de sécurité
    (Debian-Security), et un rapport partira par courrier. Reste le
    rendez-vous hebdomadaire.
routine-event-periodic =
    Un rendez-vous existe, et il est de ceux qui survivent à un
    redémarrage. Il te rappellera, chaque semaine, de lire le prochain
    bulletin — même pour ce qu'unattended-upgrades ne corrige pas tout
    seul.
routine-event-end =
    Salomé : « Voilà. unattended-upgrades pour ce qui se corrige tout seul,
    un rendez-vous pour le reste. Tu n'as plus besoin de moi pour ça. »

    Bravo ! Tu as terminé le chapitre « Mettre en veille », et l'histoire
    « La Veille ».

    CE QUI S'EST PASSÉ
    Une veille de sécurité qui dépend entièrement de la mémoire d'une
    personne finit par sauter une semaine. Deux filets complémentaires :
    l'automatisation pour ce qui ne demande pas de jugement (une mise à
    jour de sécurité déjà publiée, déjà testée par Debian), et un
    rendez-vous régulier pour ce qui en demande (lire un bulletin, décider
    d'une priorité, écrire ce qu'on a trouvé).

    LA BONNE PRATIQUE
    - Limiter l'automatique aux mises à jour de sécurité : le reste (une
      nouvelle version majeure, une dépendance qui change de comportement)
      mérite d'être vu avant d'être appliqué.
    - Se donner un rapport (par courrier, ou tout autre moyen qu'on regarde
      vraiment) : une automatisation silencieuse qu'on ne surveille jamais
      équivaut à ne rien avoir fait.
    - Écrire les tâches planifiées dans /etc (fichiers système, pas un
      script perdu dans un dossier personnel) : elles doivent survivre à un
      redémarrage et à un changement de compte.
    - Une routine ne remplace pas le jugement : elle libère du temps pour
      l'utiliser sur ce qui en a vraiment besoin.

    UNE AUTRE VOIE
    Au lieu d'un courrier, un rendez-vous hebdomadaire peut aussi être une
    tâche dans un gestionnaire de projet, une alerte dans un outil de
    supervision (comme les plugins de « La sonde »), ou simplement un
    rappel dans un agenda partagé par l'équipe : l'important est que
    quelqu'un le voie vraiment, pas la forme exacte du rappel.

    LA DOCUMENTATION
    - unattended-upgrades : https://wiki.debian.org/UnattendedUpgrades
    - systemd.timer : https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - crontab : https://manpages.debian.org/bookworm/cron/crontab.5.en.html
