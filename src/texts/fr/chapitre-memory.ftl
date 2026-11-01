### Histoire « L'Astreinte », chapitre 2 « La mémoire » : l'OOM killer, une
### fuite de mémoire contenue par systemd (MemoryMax=, Restart=), des
### processus zombies. Les commandes, options, directives et messages
### (free, top, dmesg, systemctl) ne se traduisent pas.

chapter-memory = La mémoire
    .resume = 4 h 31, le direct ne diffuse plus que du silence : qui a tué la playlist de la nuit, et comment l'empêcher de tout emporter la prochaine fois ?

## Fichiers

memory-message-zoe =
    Un message de Zoé (4 h 25) :

    « Encore moi… Depuis 4 h 12, le direct ne diffuse plus que du silence.
    Le relais tourne (systemctl status radio-stream), mais la playlist
    automatique de la nuit (le service radio-playlist) a l'air morte. Je
    n'ai rien touché, promis.

    Autre chose, peut-être sans rapport : dans ps, il y a des processus
    marqués <defunct>, des « zombies » d'après un forum. J'ai essayé kill -9
    dessus : ils sont toujours là. »
memory-server-js =
    // Radio Quartier : la playlist automatique de la nuit.
    const cache = new Map(); // morceaux déjà décodés
    
    function decoder(morceau) {"{"}
      if (!cache.has(morceau.id)) cache.set(morceau.id, lire(morceau)); // TODO : vider le cache un jour
      return cache.get(morceau.id);
    {"}"}
memory-convert-py =
    # Radio Quartier : convertit les émissions en podcasts.
    import subprocess
    
    for emission in nouvelles_emissions():
        # Lance la conversion... et n'attend jamais qu'elle se termine (pas de wait()).
        subprocess.Popen(["convertir", emission])

## Événements

memory-event-oom =
    « Out of memory », « oom-kill » : la machine a manqué de mémoire, et le
    noyau a choisi un processus à tuer pour survivre. C'est l'OOM killer
    (Out Of Memory) : il vise le processus qui occupe le plus de mémoire.
    Ses messages sont dans le journal du noyau : sudo dmesg (ou sudo
    journalctl -k). Combien de mémoire reste-t-il, et qui la prend ? free -h
    et top.
memory-event-zombies =
    Les zombies : des processus déjà terminés, dont le parent n'a pas encore
    lu le résultat (l'appel système wait). Ils ne prennent presque rien,
    mais ils trahissent un parent qui ne fait pas son travail. Qui est ce
    parent ? ps -ef montre la colonne PPID.
memory-event-kill-zombie =
    kill ne fait rien à un zombie : il est déjà mort ! Seul son parent peut
    le faire disparaître… ou disparaître lui-même : à la mort du parent, init
    (PID 1) adopte les zombies et les récupère aussitôt. Redémarrer le
    service parent suffit.
memory-event-grows =
    Regarde la playlist dans top (ou top -o %MEM) d'une commande à l'autre :
    elle grossit sans arrêt, des dizaines de mégaoctets à chaque fois. Une
    fuite de mémoire ! Le code est dans /opt/playlist. Si rien ne l'arrête,
    le noyau devra encore tuer quelqu'un…
memory-event-still =
    Et voilà : plus de mémoire, l'OOM killer a de nouveau frappé (sudo
    dmesg). Relancer ne suffit pas, la fuite recommence. Corriger le
    programme, c'est le travail des développeur·ses ; ce soir, il faut le
    contenir. systemd peut limiter la mémoire d'un service (MemoryMax=,
    voir man systemctl : edit, set-property) et le relancer s'il meurt
    (Restart=).
memory-event-too-down =
    Cette limite est trop basse : la playlist a besoin d'environ 200 Mo
    rien que pour démarrer, elle serait tuée presque aussitôt lancée.
    Donne-lui de quoi tourner un moment (quelques centaines de mégaoctets),
    sans mettre la machine en danger.
memory-event-too-up =
    Cette limite est plus haute que ce que la machine peut offrir sans
    souffrir (2 Go en tout, dont 1 Go pris par le reste) : le noyau
    frapperait avant systemd. Vise plutôt quelques centaines de mégaoctets.
memory-event-without-restart =
    systemd a tué la playlist quand elle a dépassé sa limite, comme prévu :
    la machine et le relais n'ont rien senti. Mais elle est restée arrêtée
    (systemctl status radio-playlist : Result: oom-kill). Pour que systemd
    la relance tout seul, il faut ajouter Restart=on-failure dans la
    section {"["}Service] de la surcharge (sudo systemctl edit radio-playlist).
memory-event-contained =
    La playlist a atteint sa limite : systemd l'a tuée, et aussitôt
    relancée (systemctl status radio-playlist). Seule elle a souffert, pas
    la machine. Le silence n'a duré qu'un instant.
memory-event-without-zombies =
    Plus aucun zombie : leur parent redémarré, init les a récupérés.
memory-event-end =
    La playlist tourne, contenue par sa limite et relancée si elle la
    dépasse ; les zombies ont disparu. Le direct a retrouvé sa musique.
    Zoé : « J'ouvre un ticket pour le cache de la playlist. Merci ! »

    Bravo ! Tu as terminé le chapitre 2 de L'Astreinte. (La suite t'attend :
    ssh radio.)

    CE QUI S'EST PASSÉ
    La playlist gardait en mémoire chaque morceau décodé, sans jamais rien
    oublier : une fuite de mémoire. À 4 h 12, plus un octet de libre, et le
    noyau a tué le plus gros processus (l'OOM killer). Ici c'était la
    coupable, mais ça aurait pu être la base de données ou le relais. Une
    limite par service (MemoryMax=) fait payer la fuite au seul service
    fautif, et Restart=on-failure le relance. Les zombies venaient d'un
    autre programme, qui n'attendait jamais ses enfants.

    LA BONNE PRATIQUE
    - Un service tué sans raison apparente : sudo dmesg ou journalctl -k
      (Out of memory), systemctl status (Result: oom-kill).
    - free -h pour l'état de la mémoire, top -o %MEM pour savoir qui la
      prend, et le suivre dans le temps.
    - Une limite de mémoire par service (MemoryMax=), avec une relance
      automatique (Restart=on-failure), le temps de corriger la fuite.
    - Modifier un service par une surcharge (systemctl edit), jamais en
      touchant le fichier livré dans /usr/lib/systemd.
    - Un zombie ne se tue pas : on s'occupe de son parent (et on signale le
      bogue).

    UNE AUTRE VOIE
    Réparer la fuite reste la vraie solution : la limite ne fait que
    contenir. Autres réglages de systemd : MemoryHigh= freine le service
    (le noyau lui reprend de la mémoire) avant d'en arriver à le tuer ;
    OOMScoreAdjust= dit au noyau qui sacrifier en premier ; systemd-oomd
    arrête un service avant que toute la machine n'étouffe.

    LA DOCUMENTATION
    - MemoryMax= : https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - Restart= : https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
    - free : https://man7.org/linux/man-pages/man1/free.1.html
    - les zombies et wait : https://man7.org/linux/man-pages/man2/wait.2.html
