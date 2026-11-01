### Histoire « Les Lettres du quartier », chapitre « La sentinelle » :
### fail2ban. Les commandes, chemins, adresses, mots-clés de configuration
### (bantime, ignoreip…) et la sortie de fail2ban (en anglais) ne se
### traduisent pas.

chapter-sentinel = La sentinelle
    .resume = Bannir les robots sans bannir les amis : fail2ban, jail.local, ignoreip.

## Fichiers

sentinel-email-kofi =
    De :     Kofi (La Fourmilière)
    À :      toi
    Objet :  Rania n'arrive plus à se connecter

    Rania, notre webmestre, n'arrive plus à se connecter au serveur depuis
    ce matin : « Connection refused ». Elle dit qu'elle s'est trompée
    plusieurs fois de nom d'utilisateur. Yasmine pense que c'est fail2ban,
    le gardien installé avec le serveur, qui l'a prise pour un robot. Son
    adresse : 198.51.100.40.

    Yasmine a aussi remarqué que les robots reviennent toutes les dix
    minutes : regarde /var/log/fail2ban.log. Ils frappent encore à la porte
    en ce moment ; pour les voir en direct (Ctrl-C pour arrêter) :

      journalctl -fu ssh
      tail -f /var/log/fail2ban.log

    Peux-tu :

    1. rendre l'accès à Rania ;
    2. faire en sorte que ni Rania, ni toi, ne soyez plus jamais bannis ;
    3. bannir les robots pour plus longtemps, une heure au moins ?

    D'après Yasmine, tout est dans man fail2ban-client et man jail.conf, et
    « surtout, ne touche pas à jail.conf ». Le mot de passe pour sudo n'a
    pas changé.

## Événements

sentinel-event-jail-conf =
    Tu as modifié /etc/fail2ban/jail.conf. Ça marche… jusqu'à la prochaine
    mise à jour de fail2ban, qui remplacera ce fichier et tes réglages avec
    lui. Le fichier le dit lui-même en tête : « YOU SHOULD NOT MODIFY THIS
    FILE ». Mieux vaut mettre tes réglages dans /etc/fail2ban/jail.local.
sentinel-event-error =
    La configuration de fail2ban a une erreur. Avant de recharger, vérifie
    avec  sudo fail2ban-client -t : il donne le fichier et la ligne en cause.
sentinel-event-rania =
    Rania n'est plus bannie : elle peut de nouveau se connecter. Mais si elle
    se trompe encore cinq fois, fail2ban la bannira de nouveau…
# { $adresse } : l'adresse du poste
sentinel-event-banned-self =
    ATTENTION : fail2ban vient de bannir { $adresse }… l'adresse de ton propre
    poste ! Hier, tu avais raté trois connexions (cherche « Failed publickey »
    dans journalctl -u ssh), et avec ces réglages, ça suffit. Débannis-toi,
    et ajoute ton adresse à ignoreip, avant de te déconnecter.
sentinel-event-set =
    fail2ban applique tes réglages : les robots restent bannis plus
    longtemps, et ni Rania ni toi ne serez plus bannis. Vérifie l'état de la
    prison : sudo fail2ban-client status sshd.
sentinel-event-end =
    Les robots sont bannis pour de bon, Rania se reconnecte, et ton poste ne
    risque plus rien. Kofi : « Rania te remercie, elle a pu publier le
    programme ! »

    Bravo ! Tu as terminé le chapitre « La sentinelle ».

    CE QUI S'EST PASSÉ
    fail2ban lit le journal de SSH et bannit une adresse après un certain
    nombre d'échecs. Avec les réglages par défaut, le bannissement ne durait
    que dix minutes : les robots revenaient aussitôt. Et un humain qui se
    trompe cinq fois ressemble à un robot.

    LA BONNE PRATIQUE
    - Ne jamais modifier jail.conf : mettre ses réglages dans jail.local.
    - ignoreip pour ses propres adresses et celles de l'équipe, AVANT de
      serrer maxretry.
    - Un bantime plus long pour les récidivistes (1h, 1d) ; pour aller plus
      loin, la prison « recidive » bannit pour une semaine ceux qui
      reviennent.
    - fail2ban-client -t avant de recharger, status sshd pour vérifier, et
      set sshd unbanip pour lever une erreur.
    - fail2ban ne remplace pas les clés SSH : il réduit le bruit et la
      charge, la vraie protection reste PasswordAuthentication no.

    UNE AUTRE VOIE
    ufw limit 22/tcp refuse une adresse qui ouvre au moins 6 connexions en
    30 secondes, sans lire aucun journal : simple, mais aveugle (il ne
    voit pas les échecs de connexion, et freine aussi un·e collègue
    pressé·e). fail2ban lit les échecs eux-mêmes. Mieux encore : les clés
    seulement (PasswordAuthentication no), qui rendent la force brute
    inutile.

    LA DOCUMENTATION
    - jail.conf : https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - fail2ban-client : https://manpages.debian.org/bookworm/fail2ban/fail2ban-client.1.en.html
