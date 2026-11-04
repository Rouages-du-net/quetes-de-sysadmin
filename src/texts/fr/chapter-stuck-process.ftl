### Histoire « L'Observatoire », chapitre 4 « Le Processus coincé » : les
### signaux (TERM, KILL), le trap d'un script, un fichier PID périmé. Les
### commandes, les chemins et les sorties des outils ne sont pas traduits.

chapter-stuck-process = Le Processus coincé
    .summary = La copie de la nuit vers le NAS du club ne s'est jamais terminée : rsync attend, son script réessaie sans fin, et refuse de se laisser arrêter. Débarrasse-t'en proprement, pour que la copie de ce soir tourne.

## Fichiers

stuck-process-message-amara =
    De :     Amara
    À :      toi
    Objet :  La copie vers le NAS est bloquée

    Bonjour,

    Chaque nuit à 2 h, cron lance /usr/local/bin/sync-photos, qui copie
    la galerie sur le NAS du club. Cette nuit, le NAS était éteint (une
    coupure de courant au local). Il est revenu depuis 9 h, mais la copie
    lancée à 2 h est toujours là, coincée.

    Et si elle est encore là ce soir, la nouvelle copie ne démarrera même
    pas : le script garde un fichier PID et abandonne s'il en trouve un.

    J'ai essayé kill dessus, rien ne s'est passé. Tu peux la faire
    disparaître, et vérifier que la copie de ce soir tournera ?

    Même mot de passe sudo : nebuleuse-2028.

    Amara

## Évènements

stuck-process-event-stuck =
    La copie : un script /bin/bash (sync-photos), et son enfant, rsync,
    qui attend le NAS depuis 2 h. ps -ef montre qui a lancé qui (la
    colonne PPID).
stuck-process-event-ignored =
    SIG{ $signal } envoyé, et le script est toujours là : pas d'erreur,
    rien. Un processus peut ignorer un signal, ou le traiter à sa façon
    (regarde le script : trap). Seuls deux signaux ne peuvent être ni
    interceptés ni ignorés (man 7 signal).
stuck-process-event-respawn =
    rsync est mort… et un nouveau est apparu (PID { $pid }) : le script le
    relance en boucle (« until rsync …; do sleep 60; done »). Tant que le
    script vit, tuer son enfant ne sert à rien.
stuck-process-event-orphan =
    Le script n'est plus là, mais son rsync, si : les enfants d'un
    processus qui meurt ne meurent pas avec lui, ils sont adoptés par
    init (PPID 1). rsync, lui, est un processus ordinaire : il accepte
    TERM.
stuck-process-event-stale =
    Plus de processus. Mais le script a fini par KILL : il n'a pas pu
    exécuter sa dernière ligne (rm -f "$LOCK"). Son fichier PID dit
    toujours 3301, un processus qui n'existe plus : ce soir, la nouvelle
    copie le trouvera et abandonnera (« already running »). Un fichier
    PID périmé s'enlève à la main, après avoir vérifié que le processus
    est vraiment parti.
stuck-process-event-early-lock =
    Le fichier PID est parti, mais le script coincé tourne toujours : ce
    soir, une deuxième copie démarrera à côté de lui. Le fichier ne
    s'enlève qu'une fois que plus personne ne le tient.
stuck-process-event-cron-stopped =
    cron est arrêté : ce soir, plus rien ne lancera la copie. Relance-le
    (sudo systemctl start cron).
stuck-process-event-end =
    Plus de copie en cours, plus de fichier PID : ce soir à 2 h, cron
    lancera sync-photos, et il trouvera le NAS. Amara : « J'ajouterai un
    délai à rsync (--timeout), pour qu'il abandonne tout seul la
    prochaine fois. »

    Bravo ! Tu as terminé le chapitre « Le Processus coincé ».

    CE QUI S'EST PASSÉ
    rsync a attendu le NAS toute la nuit. Son script ignorait TERM, INT
    et HUP (trap '' …), et relançait rsync à chaque fois qu'il mourait.
    kill sans option envoie TERM : ignoré.

    LES SIGNAUX
    - TERM (15) : « arrête-toi, s'il te plaît » ; le défaut de kill. Un
      programme peut l'intercepter pour ranger, ou l'ignorer.
    - KILL (9) : le noyau termine le processus tout de suite. Impossible
      à intercepter : aucun rangement (ici, le fichier PID reste).
    - HUP (1) : souvent « relis ta configuration » pour un démon ; INT
      (2) : Ctrl-C ; STOP et CONT : pause, reprise.
    - Les enfants d'un processus tué ne meurent pas avec lui : ils sont
      adoptés par init.

    BONNES PRATIQUES
    - TERM d'abord, attendre un peu, KILL seulement s'il le faut, puis
      ranger ce que le programme aurait rangé lui-même.
    - Regarder les parents : ps -ef, ps -o pid,ppid,stat,args.
    - Avant d'enlever un fichier PID, vérifier son processus : ps -p PID.
    - Une copie à travers le réseau a besoin d'un délai (rsync --timeout).

    DOCUMENTATION
    - Les signaux : https://man7.org/linux/man-pages/man7/signal.7.html
    - kill : https://man7.org/linux/man-pages/man1/kill.1.html
    - trap : https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html#index-trap
