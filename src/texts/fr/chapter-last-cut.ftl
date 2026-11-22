### Histoire « Le Mur d'escalade », chapitre « La Dernière Coupure » :
### après une coupure de courant, le serveur de la salle s'est éteint net au
### lieu de s'arrêter proprement. Network UPS Tools (upsc, upsmon, MONITOR,
### MINSUPPLIES, SHUTDOWNCMD, upsmon -c fsd) et la politique de remise sous
### tension du serveur (ipmitool chassis policy). Commandes, options,
### chemins, lignes de configuration et sorties ne sont pas traduits.

chapter-last-cut = La Dernière Coupure
    .summary = Une tempête a coupé le courant de la salle d'escalade pendant une heure et demie. Le serveur était branché sur un onduleur acheté exactement pour ça, et il s'est pourtant éteint comme une prise arrachée. Trouvez pourquoi il n'entendait pas l'onduleur, faites-le écouter, et prouvez-le par un vrai exercice.

## Fichiers

last-cut-message-nkechi =
    De : Nkechi (présidente du Dévers, salle d'escalade associative)
    Jeudi 18 novembre, 21 h 40

    Bonsoir, et merci de rester après la fermeture !

    Mardi soir, la tempête a coupé le courant de toute la rue de 19 h 42 à
    21 h 05. Les éclairages de secours se sont allumés, on a fait descendre
    tout le monde des murs, et l'onduleur de la baie du bureau a bipé
    courageusement pendant presque une heure. Puis il s'est tu, et relais
    (notre serveur : réservations, adhésions, badges de la porte) est mort
    avec lui. Au retour du courant il est reparti tout seul, mais la base
    des réservations a dû être réparée et nous avons perdu les saisies de
    la soirée.

    L'onduleur est là justement pour que relais s'arrête proprement avant
    que la batterie soit vide. C'est Haruto qui a tout installé en 2028 ;
    il vit à Sapporo maintenant, mais il a laissé des notes dans votre
    répertoire.

    La salle est fermée jusqu'à demain 10 h : ce soir, vous pouvez tester
    pour de vrai. Ikaika, notre électricien bénévole, est au bureau s'il
    faut appuyer sur un bouton. sudo fonctionne avec votre mot de passe.

    Nkechi

last-cut-notes-haruto =
    Notes d'Haruto (relais, 2028, mises à jour en 2030)

    - L'onduleur parle à relais en USB. Network UPS Tools (NUT, paquets
      nut-server et nut-client de Debian) a trois étages : le pilote
      (nut-driver@NOM, pour l'onduleur nommé NOM dans /etc/nut/ups.conf),
      upsd (nut-server : il sert les données de l'onduleur) et upsmon
      (nut-monitor : il surveille upsd et arrête relais quand la batterie
      faiblit).
    - upsc montre ce que sait upsd : upsc -l pour les noms d'onduleurs,
      upsc NOM pour tout ce que dit un onduleur.
    - 2030 : le vieil Eaton a lâché, nous avons acheté un APC Back-UPS RS
      1500. J'ai renommé sa section dans ups.conf en quelque chose de plus
      parlant.
    - upsmon remplissait le journal de lignes « Poll UPS failed » ; je l'ai
      rendu plus discret dans upsmon.conf (POLLFAIL_LOG_THROTTLE_MAX).
    - Pour tester l'arrêt, la documentation de NUT dit : upsmon -c fsd.
      C'est un VRAI arrêt : relais s'arrête, puis l'onduleur coupe ses
      prises un instant. Seulement quand la salle est fermée !
    - La carte mère du serveur a un BMC : ipmitool marche en root.

## Événements

last-cut-event-blind =
    upsmon interroge un onduleur appelé eaton sur localhost, et upsd répond
    qu'il n'existe pas. Depuis 2030, le seul onduleur que connaît upsd
    porte un autre nom. Un onduleur dont upsmon n'a jamais eu de nouvelles
    n'est jamais « sur batterie » pour lui : mardi, il n'a pas bougé
    jusqu'à ce que la batterie soit vide. Quel onduleur upsd sert-il ?
    (man upsc)

last-cut-event-renamed =
    Le voilà : upsd sert un seul onduleur, sous le nom de sa section dans
    /etc/nut/ups.conf. La ligne MONITOR d'upsmon doit le nommer exactement,
    sous la forme NOM@HÔTE (man upsmon.conf).

last-cut-event-minsupplies =
    MINSUPPLIES dit combien d'alimentations doivent rester saines pour
    qu'upsmon laisse tourner la machine. À 0, upsmon n'en trouve jamais
    trop peu : il n'arrête jamais relais, quoi que dise la batterie. relais
    a une alimentation : MINSUPPLIES 1.

last-cut-event-no-shutdown =
    Le SHUTDOWNCMD d'upsmon.conf n'arrête plus la machine. Batterie faible,
    upsmon le lancerait et relais continuerait jusqu'à ce que l'onduleur
    s'éteigne : exactement le plantage de mardi. La valeur de Debian est
    « /sbin/shutdown -h +0 ».

last-cut-event-monitor-down =
    nut-monitor (upsmon) ne tourne pas, ou ne démarrera pas au prochain
    démarrage. Sans upsmon, personne ne surveille l'onduleur : il doit être
    actif et activé (systemctl status nut-monitor, systemctl enable --now).

last-cut-event-killed =
    upsdrvctl shutdown envoie à l'onduleur sa commande de coupure : offdelay
    secondes plus tard, il coupe ses prises, quoi qu'il tourne encore
    derrière. NUT le fait lui-même tout à la fin d'un arrêt, une fois les
    machines arrêtées ; tapé à la main, il débranche relais.

last-cut-event-watching =
    upsmon surveille maintenant hallups : connecté à upsd en primaire (upsc
    -c hallups le liste comme client, et le journal dit « UPS: …
    (primary) »). Sur batterie, puis batterie faible, il préviendra, arrêtera
    relais, et dira à l'onduleur de couper puis de revenir.

last-cut-event-blind-drill =
    L'exercice a arrêté relais… mais upsmon surveillait toujours l'onduleur
    qui n'existe pas : il a essayé de lui mettre l'« arrêt forcé », a
    échoué, et a arrêté relais quand même. upsmon -c fsd teste l'arrêt, pas
    la détection : sur une vraie coupure, cet upsmon n'aurait toujours rien
    vu. Corrigez d'abord la ligne MONITOR, puis refaites l'exercice.

last-cut-event-drill =
    L'exercice s'est déroulé comme il faut : upsmon a mis FSD sur
    l'onduleur, relais s'est arrêté proprement, et tout à la fin l'onduleur
    a coupé ses prises un instant (journalctl -b -1 : la fin du démarrage
    précédent).

last-cut-event-stayed-off =
    Mais relais n'est pas revenu tout seul : Ikaika a dû appuyer sur son
    bouton. La politique de remise sous tension de son micrologiciel est
    « previous » : il redémarre au retour du courant seulement s'il
    tournait quand le courant est parti. Mardi il a planté en marche, donc
    il est revenu ; ce soir il s'était arrêté proprement, donc il est resté
    éteint. Sur une coupure à 3 h du matin, personne n'appuie sur le bouton.
    Regardez ipmitool chassis status (man ipmitool).

last-cut-event-policy =
    Power Restore Policy : always-on. Chaque fois que l'onduleur rend ses
    prises, relais démarre. Un nouvel exercice le dira.

last-cut-event-end =
    Nkechi : « Ikaika dit que l'onduleur a fait clic, s'est tu, et que
    relais est revenu tout seul deux minutes plus tard. Le meilleur
    spectacle qu'on ait eu au bureau. »

    Bravo ! Vous avez terminé La Dernière Coupure.

    CE QUI S'EST PASSÉ
    upsmon surveillait eaton@localhost, le nom d'un onduleur remplacé en
    2030 : upsd répondait « does not exist », et un onduleur dont upsmon n'a
    jamais eu de nouvelles n'est jamais sur batterie pour lui. Mardi, la
    batterie s'est vidée et relais a planté. Vous avez fait surveiller
    hallups par upsmon en primaire, puis fait l'exercice avec upsmon -c fsd :
    FSD sur l'onduleur, un arrêt propre, et la coupure de l'onduleur tout à
    la fin (le POWERDOWNFLAG d'upsmon, puis upsdrvctl shutdown lancé par les
    scripts d'arrêt). Après un arrêt propre, la politique « previous » du
    micrologiciel laissait relais éteint : always-on le rallume avec le
    courant.

    BONNES PRATIQUES
    - Vérifier la chaîne de bout en bout : upsc -l (les noms que sert upsd),
      upsc -c ONDULEUR (upsmon est-il connecté ?), le journal de
      nut-monitor (aucun « Poll UPS failed »).
    - Ne jamais faire taire une erreur qu'on n'a pas comprise : espacer les
      « Poll UPS failed » a caché celle-ci pendant deux ans.
    - MINSUPPLIES 1 et un vrai SHUTDOWNCMD : il n'y a pas de réglage « sûr »
      qui désactive l'arrêt ; c'est le plantage qu'on voulait éviter.
    - Faire l'exercice quand personne n'a besoin de la machine : upsmon -c
      fsd arrête vraiment, et l'onduleur coupe vraiment ses prises. Il ne
      teste pas la détection : lire les journaux pour cela, ou débrancher
      l'onduleur (avec un·e électricien·ne).
    - Les machines derrière un onduleur qui coupe puis rend le courant
      doivent « redémarrer au retour du courant » (always-on) dans leur
      micrologiciel.
    - NUT 2.8 a renommé master et slave en primary et secondary ; les
      anciens mots marchent encore, les nouveaux sont plus clairs.

    DOCUMENTATION
    - upsmon(8) : https://networkupstools.org/docs/man/upsmon.html
    - upsmon.conf(5) : https://networkupstools.org/docs/man/upsmon.conf.html
    - upsc(8) : https://networkupstools.org/docs/man/upsc.html
    - Tester les arrêts (upsdrvctl -t shutdown, puis upsmon -c fsd) : https://networkupstools.org/docs/user-manual.chunked/Configuration_notes.html
    - ipmitool : https://codeberg.org/IPMITool/ipmitool

## Ce que partagent les trois chapitres de l'histoire : gardé ici pour se charger avec l'histoire.

climbing-wall-archive-readme =
    harness : le NAS du Dévers (Akosua)
    /srv/archive/photos : les photos des compétitions et des cours
    /srv/archive/waivers : les décharges signées (scans), gardées cinq ans
    Partagé en Samba avec le bureau et l'accueil.
