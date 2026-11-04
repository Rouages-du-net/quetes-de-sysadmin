### Histoire « L'Observatoire », chapitre 3 « Trop de fichiers ouverts » :
### les limites d'un processus, ulimit, prlimit, LimitNOFILE=. Les commandes,
### les chemins et les sorties des outils ne sont pas traduits.

chapter-too-many-files = Trop de fichiers ouverts
    .summary = La nouvelle page d'archives de la galerie répond 500 : « EMFILE: too many open files ». Le ulimit du shell dit 1024, limits.conf ne dit rien, et la galerie est un service. Donne-lui la limite qu'il lui faut, pour de bon.

## Fichiers

too-many-files-message-amara =
    De :     Amara
    À :      toi
    Objet :  La page des archives est cassée

    Bonjour,

    Je suis rentrée ! Ce matin, j'ai mis à jour la galerie (version
    1.5) : elle a une nouvelle page, les archives, avec une mosaïque de
    toutes nos photos depuis 2019, 2400 en tout. La page d'accueil
    marche, mais les archives répondent par une erreur :
      curl -i http://localhost:8080/archive

    Les membres l'attendent. Je ne sais pas où chercher : sur mon
    portable, ça marche.

    Même mot de passe sudo : nebuleuse-2028.

    Amara

too-many-files-archive-page =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Club d'astronomie — archives</title></head>
    <body>
    <h1>Les archives</h1>
    <p>{ $photos } photos depuis 2019, en mosaïque.</p>
    </body>
    </html>

## Évènements

too-many-files-event-emfile =
    « EMFILE: too many open files » : la galerie a voulu ouvrir un
    fichier de plus, et le noyau a refusé. Chaque processus a une limite
    au nombre de fichiers qu'il garde ouverts en même temps. Combien en
    tient-il, et quelle est sa limite ? Tout ce qui concerne un processus
    est sous /proc/PID (son PID : systemctl status gallery).
too-many-files-event-limits =
    Max open files : une limite souple (soft, ce que le processus peut
    utiliser) et une limite dure (hard, le plafond jusqu'auquel il peut
    lui-même monter sa limite souple). Les archives ouvrent leurs 2400
    photos et les gardent ouvertes : 1024 ne suffit pas. Qui a donné
    1024 à la galerie ? C'est un service : systemd, qui le démarre.
too-many-files-event-ulimit-shell =
    ulimit change les limites de TON shell, et de ce que tu lances
    depuis lui. La galerie a été démarrée par systemd : les limites de
    ton shell ne l'atteignent pas.
too-many-files-event-limits-conf =
    /etc/security/limits.conf est lu par pam_limits à l'ouverture d'une
    session (ssh, login, su). Un service systemd n'ouvre aucune session :
    il ne lit jamais ce fichier. Ses limites viennent de son unité (man
    systemd.exec : LimitNOFILE=).
too-many-files-event-too-small =
    La galerie a maintenant sa propre limite, mais trop basse : les
    archives tiennent environ { $need } fichiers à la fois (2400 photos,
    plus ce que Node.js tient déjà). Laisse de la marge : 4096, par
    exemple.
too-many-files-event-restart-needed =
    systemd a la nouvelle limite, mais le processus de la galerie a
    toujours l'ancienne : une limite est fixée au démarrage du processus.
    Redémarre la galerie (sudo systemctl restart gallery).
too-many-files-event-live-only =
    La galerie qui tourne en a maintenant assez (prlimit change les
    limites d'un processus en marche). Mais seulement jusqu'à son
    prochain redémarrage : systemd la relancera avec 1024. Écris aussi la
    limite dans son unité.
too-many-files-event-end =
    Les archives répondent 200 : la mosaïque est là, et sa limite est
    dans l'unité de la galerie, elle tiendra aux redémarrages. Amara :
    « Voilà pourquoi ça marchait sur mon portable : je la lançais depuis
    mon terminal ! »

    Bravo ! Tu as terminé le chapitre « Trop de fichiers ouverts ».

    CE QUI S'EST PASSÉ
    Les archives ouvrent leurs 2400 photos et les gardent ouvertes. La
    galerie, un service systemd, avait la limite par défaut de systemd :
    1024 fichiers ouverts (souple), 524288 (dure). Au-delà de 1024,
    open() échoue : EMFILE.

    D'OÙ VIENNENT LES LIMITES
    - Un processus hérite des limites de son parent ; il peut les
      baisser, ou monter sa limite souple jusqu'à sa limite dure.
    - systemd fixe celles d'un service quand il le démarre : LimitNOFILE=
      dans l'unité (par défaut 1024:524288).
    - Une session reçoit les siennes de pam_limits (limits.conf), et
      ulimit change celles du shell : ni l'un ni l'autre n'atteint un
      service.
    - prlimit change les limites d'un processus en marche, jusqu'à son
      redémarrage.

    BONNES PRATIQUES
    - Regarder le vrai processus : cat /proc/PID/limits, sudo ls
      /proc/PID/fd | wc -l (ce qu'il tient), lsof -p PID.
    - sudo systemctl edit gallery : {"["}Service] LimitNOFILE=4096, puis sudo
      systemctl restart gallery.
    - Monter raisonnablement : un programme qui garde des milliers de
      fichiers ouverts a peut-être aussi une fuite à corriger.

    DOCUMENTATION
    - LimitNOFILE= : https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LimitCPU=
    - /proc/PID/limits : https://man7.org/linux/man-pages/man5/proc_pid_limits.5.html
    - prlimit : https://man7.org/linux/man-pages/man1/prlimit.1.html
