### Histoire « L'Astreinte », chapitre 7 « Le goulot » : l'attente du
### disque (iowait), iostat, pidstat, ionice et la limite de débit de
### systemd. Les commandes, chemins, noms d'unités et lignes de journal ne
### se traduisent pas.

chapter-bottleneck = Le goulot
    .resume = Chaque après-midi à 16 h, le direct hoquette : trouver ce qui sature le disque, et le limiter sans l'arrêter.

## Fichiers

bottleneck-message-zoe =
    Un message de Zoé (16 h 12) :

    « Ça recommence ! Tous les jours, vers 16 h, le direct a des trous :
    des silences d'une demi-seconde, plusieurs par minute. Les
    auditeur·ices nous écrivent. Le relais (radio-stream) tourne, son
    journal parle de « read stall ».

    J'ai regardé top : la machine a l'air surchargée, mais le processeur
    ne fait presque rien. Je n'y comprends rien.

    Ce que je sais : à 16 h, l'archivage du jour (radio-archives) recopie
    les enregistrements dans /srv/archives. Il ne faut surtout pas
    l'arrêter : les émissions de la journée doivent être archivées ce
    soir. Mais il ne doit pas casser le direct, ni aujourd'hui ni demain. »

    Pour regarder le disque : man iostat, man pidstat.

## Événements

bottleneck-event-iowait =
    Regarde la ligne %Cpu(s) de top : le processeur n'est presque jamais
    occupé (us, sy), mais « wa » est énorme. C'est l'iowait : le temps où
    des processus attendent le disque. La charge (load average) compte ces
    processus bloqués, d'où une machine « surchargée » qui ne calcule rien.
    Le goulot, c'est le disque : iostat -x montre à quel point il est
    occupé (%util) et combien attend chaque requête (r_await, en ms) ;
    pidstat -d, qui lit et écrit.
bottleneck-event-ionice =
    ionice a accepté la classe « idle »… mais regarde iostat : rien n'a
    changé. Les priorités d'ionice ne comptent que si l'ordonnanceur du
    disque les gère (bfq, mq-deadline). Celui de ce disque virtuel est
    « none » (cat /sys/block/vda/queue/scheduler) : il sert les requêtes
    dans l'ordre, sans priorité. Une limite de débit, elle, marche avec
    tous les ordonnanceurs : systemd la pose sur le cgroup du service
    (man systemd.resource-control, IOWriteBandwidthMax=).
bottleneck-event-stop =
    L'archivage ne tourne plus. Le direct respire… mais les émissions du
    jour ne seront pas archivées, et demain à 16 h, le timer le relancera
    à pleine vitesse. Relance-le (sudo systemctl start radio-archives),
    mais avec une limite de débit.
bottleneck-event-bad-disk =
    systemd a enregistré la limite, mais elle vise un disque qui n'existe
    pas ici : elle ne freine rien. Le disque de cette machine est vda
    (iostat le montre) ; on peut aussi donner un chemin, systemd trouve
    le disque qui le porte.
bottleneck-event-too-slow =
    Une limite aussi basse protège le direct… mais l'archivage du jour
    n'aura pas fini avant demain. Quelques dizaines de Mio/s suffisent :
    regarde iostat après chaque essai, et cherche le juste milieu.
bottleneck-event-end =
    Le direct ne hoquette plus : ses lectures attendent quelques
    millisecondes, plus des centaines. L'archivage continue, plus
    lentement, et sa limite est enregistrée : demain à 16 h, elle
    s'appliquera d'elle-même. Zoé : « Plus un seul trou depuis cinq
    minutes. Et l'archive sera finie vers 18 h, c'est parfait. »

    Bravo ! Tu as terminé le chapitre « Le goulot ».

    CE QUI S'EST PASSÉ
    La machine n'était pas surchargée : elle attendait son disque. Une
    copie à pleine vitesse prenait presque tout son débit, et chaque
    lecture du direct faisait la queue derrière (r_await en centaines de
    ms). top le montre (wa, la charge), iostat -x le prouve (%util,
    await), pidstat -d dit qui en est la cause.

    LA BONNE PRATIQUE
    - Une charge élevée avec un processeur au repos : penser au disque
      (iowait), et le regarder avec iostat -x 1.
    - Limiter les tâches de fond avec systemd : IOWriteBandwidthMax= et
      IOReadBandwidthMax= (le cgroup du service, io.max), qui marchent
      avec tous les ordonnanceurs ; ionice et IOSchedulingClass=idle ne
      servent qu'avec bfq ou mq-deadline.
    - systemctl set-property applique tout de suite et enregistre (dans
      /etc/systemd/system.control) ; une limite écrite avec systemctl edit
      vaut aussi pour les lancements suivants.
    - Et quand c'est possible, programmer les grosses copies quand
      personne n'écoute.

    LA DOCUMENTATION
    - iostat(1) : https://man7.org/linux/man-pages/man1/iostat.1.html
    - systemd.resource-control(5) : https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - Le contrôleur io de cgroup v2 : https://docs.kernel.org/admin-guide/cgroup-v2.html#io
