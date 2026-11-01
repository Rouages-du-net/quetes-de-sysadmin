### Histoire « L'Astreinte », chapitre 6 « Le post-mortem » : retrouver les
### faits dans les journaux (journalctl --since/--until, last, apt) et
### rédiger un post-mortem sans reproche. Les commandes, chemins et
### messages des outils ne se traduisent pas. Les titres de section du
### modèle (post-mortem-section-…) doivent rester ceux du modèle.

chapter-post-mortem = Le post-mortem
    .resume = Dimanche nuit, Théo était d'astreinte et le direct a coupé : écrire ce qui s'est passé, avec les faits des journaux et sans chercher de coupable.

## Fichiers

post-mortem-message-zoe =
    Un message de Zoé (lundi, 9 h 40) :

    « Dimanche nuit, c'est Théo qui était d'astreinte : le direct a coupé,
    il a réparé. Pour l'association, on écrit un post-mortem : ce qui
    s'est passé, pourquoi, et ce qu'on change. Sans reproche : on ne
    cherche pas un coupable, on cherche ce qui a permis la panne.

    Tu peux le rédiger ? Le modèle est dans postmortem.md (nano). Théo a
    laissé ses notes (notes_theo.txt), mais il était à moitié endormi :
    vérifie les heures dans les journaux. Je le relirai à chaque
    enregistrement. »
post-mortem-notes-theo =
    Notes de Théo (dimanche, 3 h 10) :

    Réveillé par le téléphone, je ne sais plus à quelle heure, vers 2 h 30 ?
    Le relais était tombé, vers 2 h 20 je crois. journalctl disait une option
    inconnue dans stream.conf, ligne 7 (bitrate_max). Je l'ai commentée, j'ai
    relancé, c'est reparti.

    Ce que je ne comprends pas : pourquoi le relais a redémarré en pleine
    nuit ? Personne n'était connecté.
post-mortem-template =
    # Post-mortem : coupure du direct, nuit du 11 au 12 septembre 2027

    Sans reproche : on cherche ce qui a permis la panne, pas un coupable.

    ## Résumé
    (à compléter : deux ou trois phrases)

    ## Chronologie
    (à compléter : les heures, vérifiées dans les journaux)

    ## Impact
    (à compléter : combien de temps, pour qui)

    ## Causes
    (à compléter : ce qui a déclenché la panne, et ce qui l'a rendue possible)

    ## Ce qui a bien marché
    (à compléter)

    ## Actions
    (à compléter : une ligne « - » par action)
post-mortem-conf-flux =
    # Radio Quartier : relais du flux (le service radio-stream)
    port = 8000
    mount = /direct
    logfile = /var/log/radio/stream.log
    loglevel = info
    record_dir = /srv/radio/emissions
    #bitrate_max = 192    # Théo, 12/09 : option inconnue, mise en commentaire
    stats_dir = /srv/radio/stats
post-mortem-unattended-conf =
    // Les mises à jour de sécurité, installées automatiquement chaque nuit
    // (apt-daily-upgrade.timer). needrestart relance ensuite les services
    // qui utilisent une bibliothèque mise à jour.
    Unattended-Upgrade::Origins-Pattern {"{"}
            "origin=Debian,codename=bookworm,label=Debian-Security";
    {"}"};
    Unattended-Upgrade::Automatic-Reboot "false";
post-mortem-apt-history =
    Start-Date: 2027-09-05  02:11:52
    Commandline: /usr/bin/unattended-upgrade
    Upgrade: tzdata:amd64 (2027a-0+deb12u1, 2027b-0+deb12u1)
    End-Date: 2027-09-05  02:11:58

    Start-Date: 2027-09-12  02:12:44
    Commandline: /usr/bin/unattended-upgrade
    Upgrade: libssl3:amd64 (3.0.15-1~deb12u1, 3.0.15-1~deb12u2), openssl:amd64 (3.0.15-1~deb12u1, 3.0.15-1~deb12u2)
    End-Date: 2027-09-12  02:13:04
post-mortem-unattended-dpkg =
    Log started: 2027-09-12  02:12:45
    (Reading database ... 41213 files and directories currently installed.)
    Preparing to unpack .../libssl3_3.0.15-1~deb12u2_amd64.deb ...
    Unpacking libssl3:amd64 (3.0.15-1~deb12u2) over (3.0.15-1~deb12u1) ...
    Setting up libssl3:amd64 (3.0.15-1~deb12u2) ...
    Processing triggers for libc-bin (2.36-9+deb12u9) ...

    Restarting services...
     systemctl restart radio-stream.service
    Log ended: 2027-09-12  02:13:04

## Ce que le jeu vérifie dans le post-mortem

# Les titres des sections (comme dans le modèle, sans « ## »).
post-mortem-section-resume = Résumé
post-mortem-section-chronologie = Chronologie
post-mortem-section-impact = Impact
post-mortem-section-causes = Causes
post-mortem-section-marche = Ce qui a bien marché
post-mortem-section-actions = Actions
# Le début des lignes du modèle à remplacer.
post-mortem-a-complete = (à compléter
# Des mots dont l'un doit apparaître dans « Causes » (séparés par des virgules, en minuscules).
post-mortem-words-trigger = unattended, upgrade, apt, needrestart, mise à jour, mises à jour
post-mortem-words-origin = 20 août, 20/08, 2027-08-20, aug 20, août
# Des mots qui cherchent un coupable (le post-mortem doit les éviter).
post-mortem-words-blame = faute, coupable, négligence, négligent, aurait dû, auraient dû, incompétent, erreur de théo, erreur de zoé

post-mortem-review = Zoé relit ton post-mortem :
# { $mot } : le mot qui cherche un coupable
post-mortem-blame = « { $mot } » : on cherche ce qui a permis la panne, pas qui l'a causée. Personne n'a mal agi ; c'est le système (les outils, les habitudes) qu'on améliore. Tu peux reformuler ?
post-mortem-missing-template = Il reste des lignes « (à compléter) » du modèle.
post-mortem-missing-timeline = La chronologie doit donner, vérifiées dans les journaux, l'heure de la coupure, celle de la première alerte et celle du retour du direct (journalctl --since … --until …, le courrier de l'alerte).
post-mortem-missing-impact = L'impact : combien de minutes de silence pour les auditeur·rices ?
post-mortem-missing-cause = Les causes : ce qui a relancé le relais en pleine nuit (l'historique d'apt, /var/log/unattended-upgrades), et l'erreur de configuration qui l'a empêché de repartir.
post-mortem-missing-origin = Et depuis quand cette erreur attendait-elle dans stream.conf ? Le journal garde la trace des commandes lancées avec sudo.
post-mortem-missing-actions = Au moins deux actions, une par ligne « - ».
post-mortem-missing-works = Le résumé, et ce qui a bien marché (il y a des choses !).

## Événements

post-mortem-event-notes =
    Les notes de Théo donnent des pistes, pas des faits : « vers 2 h 30 ? »,
    « vers 2 h 20 je crois ». Les journaux, eux, sont précis à la seconde
    (journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30").
    Et qui s'est connecté cette nuit-là ? (last)
post-mortem-event-reboot =
    Juste avant que le relais ne tombe, apt-daily-upgrade a démarré : la
    mise à jour automatique de la nuit. Qu'a-t-elle installé, et qu'a-t-elle
    fait ensuite ? (/var/log/apt/history.log, /var/log/unattended-upgrades)
post-mortem-event-origin =
    Le 20 août, Zoé a modifié stream.conf… sans relancer le relais, qui a
    continué de tourner avec l'ancienne configuration. L'erreur a attendu
    trois semaines le premier redémarrage. Ce n'est la faute de personne :
    rien ne vérifiait la configuration après une modification.
post-mortem-event-end =
    Zoé : « Parfait. Je le lis à la réunion de jeudi, et on attaque les
    actions. Merci pour ces nuits ; tu as fait de cette radio un endroit où
    les pannes nous apprennent quelque chose. »

    Bravo ! Tu as terminé L'Astreinte.

    CE QUI S'EST PASSÉ
    Une mise à jour de sécurité automatique (unattended-upgrades) a relancé
    le relais à 2 h 13 (needrestart). Il n'a pas pu repartir : une option
    inconnue (bitrate_max) attendait dans sa configuration depuis le 20
    août, jamais vérifiée ni appliquée. La sonde a alerté à 2 h 15, Théo a
    réparé à 2 h 58 : 45 minutes de silence.

    LA BONNE PRATIQUE
    - Les faits d'abord : les journaux (journalctl --since/--until, last,
      l'historique d'apt), pas les souvenirs.
    - Sans reproche : on cherche les conditions qui ont permis la panne
      (une configuration jamais vérifiée, un redémarrage la nuit), pas un
      coupable ; sinon, plus personne ne raconte ses erreurs.
    - Des actions concrètes, avec qui et quand : vérifier la configuration
      avant de relancer (ExecStartPre=), relancer après chaque
      modification, réveiller l'astreinte plus fort…
    - Partager le post-mortem : c'est ainsi que toute l'équipe apprend.

    LA DOCUMENTATION
    - la culture du post-mortem (Google SRE, en anglais) : https://sre.google/sre-book/postmortem-culture/
    - journalctl : https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    - unattended-upgrades : https://wiki.debian.org/UnattendedUpgrades
