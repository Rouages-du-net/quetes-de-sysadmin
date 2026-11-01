### Histoire « La Coopérative », chapitre 6 « Les mises à jour
### automatiques » : unattended-upgrades. Les commandes, chemins, clés de
### configuration d'apt et noms de paquets ne se traduisent pas.

chapter-auto-updates = Les mises à jour automatiques
    .summary = De nouvelles mises à jour de sécurité, déjà : activer unattended-upgrades, recevoir le rapport, redémarrer la nuit, et laisser nodejs tranquille.

## Fichiers

auto-updates-email-awa =
    De :     Awa
    À :      toi
    Objet :  Encore des mises à jour ?

    Merci encore pour la dernière fois ! Mais je viens de lire qu'il y a
    déjà de nouvelles failles dans openssl et dans le noyau. On ne va pas
    t'appeler chaque semaine…

    Marc m'avait dit avoir installé « les mises à jour automatiques »
    (unattended-upgrades) il y a un an. Visiblement, rien ne s'est
    jamais installé tout seul. Tu peux regarder ? Ce qu'on voudrait :
      - que les mises à jour de sécurité s'installent seules, chaque jour ;
      - en être prévenu·es : un courrier à root suffit, Lina le lit ;
      - si un redémarrage est nécessaire, qu'il se fasse seul, mais
        pendant que la coopérative est fermée (on ouvre de 7 h à 20 h) ;
      - surtout, qu'on ne touche pas à nodejs : Lina dit que la caisse
        ne marche qu'avec la version 20, et Marc a ajouté le dépôt de la
        version 22 « pour préparer ».

    La configuration est dans /etc/apt/apt.conf.d (man apt.conf,
    man unattended-upgrade). Pour vérifier sans attendre demain matin, le
    service qui fait le travail chaque matin peut se lancer à la main.

## Événements

auto-updates-event-syntax =
    apt ne comprend plus sa configuration (« E: Syntax error ») : il refuse
    TOUT, et les mises à jour automatiques avec. Le plus souvent, un « ; »
    oublié en fin de ligne, ou une accolade. apt-config dump donne le
    fichier et la ligne.
auto-updates-event-nothing =
    Le service apt-daily-upgrade a tourné… et n'a rien fait. Il lance
    apt.systemd.daily, qui lit APT::Periodic::Unattended-Upgrade : à « 0 »
    (c'est le cas dans 20auto-upgrades), il s'arrête aussitôt. C'est
    pour ça que rien ne s'est jamais installé. (apt-config dump
    APT::Periodic montre ce qu'apt a compris.)
auto-updates-event-nodejs =
    Aïe : nodejs vient de passer en version 22. La caisse tourne encore
    (avec l'ancien programme en mémoire), mais elle ne redémarrera pas :
    elle exige Node.js 20. Un motif trop large dans Origins-Pattern laisse
    passer les dépôts tiers, que personne n'a testés avec la caisse.
    Pour revenir en arrière, recommence le chapitre depuis le menu ; et
    garde nodejs à l'écart (ne pas autoriser son origine, ou
    Package-Blacklist).
auto-updates-event-in-day =
    La machine vient de redémarrer, en plein après-midi : Automatic-Reboot
    est activé, mais sans heure, unattended-upgrades redémarre tout de
    suite (« now »). Deux minutes sans caisse, une file à l'accueil. Il
    faut une heure où la coopérative est fermée :
    Automatic-Reboot-Time.
auto-updates-event-without-report =
    Les mises à jour se sont installées, mais personne n'en saura rien :
    sans Unattended-Upgrade::Mail, aucun rapport n'est envoyé.
auto-updates-event-end =
    Les mises à jour de sécurité s'installent seules chaque matin, le
    rapport part à root, la machine redémarrera cette nuit pour le nouveau
    noyau, et nodejs reste en version 20. Lina : « J'ai reçu le courrier !
    Ça dit qu'il faudra redémarrer, et que ça se fera tout seul cette
    nuit. »

    Bravo ! Tu as terminé le chapitre « Les mises à jour automatiques ».

    CE QUI S'EST PASSÉ
    unattended-upgrades était installé, mais éteint : 20auto-upgrades
    disait « 0 ». Chaque matin, le timer apt-daily-upgrade lançait le
    service, qui lisait ce « 0 » et s'arrêtait. Une fois activé, il
    installe ce que permet 50unattended-upgrades : les origines de Debian
    et de ses mises à jour de sécurité, pas le dépôt de NodeSource.

    LA BONNE PRATIQUE
    - Les mises à jour de sécurité automatiques sur tout serveur ; les
      dépôts tiers et les grosses versions, à la main, après un essai.
    - Un rapport par courrier (Mail), et un redémarrage programmé quand
      personne n'utilise la machine (Automatic-Reboot-Time).
    - Vérifier sans attendre : unattended-upgrade --dry-run --debug,
      apt-config dump, et le journal dans /var/log/unattended-upgrades.
    - Un rapport qui n'arrive plus est une alerte : il faut le lire.

    LA DOCUMENTATION
    - UnattendedUpgrades (wiki Debian) : https://wiki.debian.org/UnattendedUpgrades
    - unattended-upgrade(8) : https://manpages.debian.org/trixie/unattended-upgrades/unattended-upgrade.8.en.html
    - apt.conf(5) : https://manpages.debian.org/trixie/apt/apt.conf.5.en.html
