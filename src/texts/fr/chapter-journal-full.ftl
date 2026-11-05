### Histoire « Les Refuges », chapitre 2 « Le Journal plein » : le
### journal de systemd sur le disque, journalctl --disk-usage et
### --vacuum-*, SystemMaxUse=. La configuration, les chemins et les
### sorties des outils ne sont pas traduits.

chapter-journal-full = Le Journal plein
    .summary = Le disque de la vallée est à 93 %. Les fichiers des refuges sont petits ; autre chose prend des gigaoctets dans /var/log. Rends la place, et fais en sorte qu'elle reste rendue.

## Fichiers

journal-full-message-lou =
    De :     Lou
    À :      toi
    Objet :  Disque presque plein

    Bonjour,

    Le panneau de l'hébergeur dit que le disque de vallee est à 93 %. Les
    fichiers des refuges (merci encore !) font quelques mégaoctets, donc
    c'est autre chose.

    J'ai bien activé une option « debug » dans hut-collector le mois
    dernier, pour comprendre un problème de capteur… ça aurait un
    rapport ?

    Ne touche pas à /var/lib/hut-data : ce sont les archives de toutes
    les mesures depuis 2019.

    Même mot de passe sudo : sommet-2028.

    Lou

## Événements

journal-full-event-disk =
    93 % occupés. Où va la place ? du -sh sur les gros répertoires le dira
    (sudo du -sh /var/log/*, /var/lib/*).
journal-full-event-journal =
    Le journal de systemd, dans /var/log/journal, prend des gigaoctets :
    trente fichiers archivés, un par jour, et le fichier actif. Depuis que
    hut-collector écrit en debug, il grossit vite. journald garde par
    défaut jusqu'à 10 % du système de fichiers… et c'est le reste du
    disque qui manque. (man journalctl : --disk-usage, --vacuum-size ; man
    journald.conf)
journal-full-event-rm =
    Le fichier actif du journal a été effacé à la main. journald écrit
    toujours dedans (il le garde ouvert), mais plus rien ne peut le lire,
    et sa place ne revient qu'au redémarrage de journald. Les fichiers
    archivés se réduisent avec journalctl --vacuum-…, jamais avec rm.
journal-full-event-vacuum-only =
    Les archives sont réduites : la place est revenue. Mais rien n'empêche
    le journal de regrossir au même rythme. journald a besoin d'une limite
    (SystemMaxUse= dans journald.conf), appliquée à son démarrage.
journal-full-event-restart-needed =
    La limite est écrite, mais journald lit sa configuration à son
    démarrage : sudo systemctl restart systemd-journald.
journal-full-event-too-big =
    Une limite est fixée, mais trop haute pour ce disque : avec les
    archives des mesures, 1G pour le journal suffit largement
    (SystemMaxUse=1G au plus).
journal-full-event-end =
    Le journal est sous sa nouvelle limite, et journald l'y gardera : le
    disque est revenu sous 80 %. Lou : « Et j'ai coupé le debug de
    hut-collector, promis. »

    Bravo ! Tu as terminé le chapitre « Le Journal plein ».

    CE QUI S'EST PASSÉ
    hut-collector écrivait en debug dans le journal, des centaines de
    mégaoctets par jour. La limite par défaut de journald (10 % du système
    de fichiers, jusqu'à 4G) autorisait six gigaoctets sur ce disque, à
    côté d'archives qui en prenaient déjà l'essentiel.

    LE JOURNAL SUR LE DISQUE
    - journalctl --disk-usage : combien il prend.
    - journalctl --vacuum-size=500M (ou --vacuum-time=2weeks) : réduit les
      fichiers archivés tout de suite.
    - SystemMaxUse= dans /etc/systemd/journald.conf (ou un complément dans
      journald.conf.d) : la limite durable, appliquée au démarrage de
      journald.

    BONNES PRATIQUES
    - Jamais de rm dans /var/log/journal : journalctl --vacuum-….
    - Une limite adaptée au disque, et une surveillance du disque (df)
      avec une alerte.
    - Un programme en debug est un programme qui remplira un disque : le
      couper une fois le problème compris.

    DOCUMENTATION
    - journald.conf : https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html
    - journalctl --vacuum-size : https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
