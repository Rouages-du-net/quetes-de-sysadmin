### Histoire « Le Paquet perdu » : « internet ne marche plus » au café
### associatif. Diagnostiquer une panne réseau de proche en proche avec
### ping, dig, traceroute et curl. Les commandes, noms de domaine et
### adresses IP ne se traduisent pas ; les sorties des outils réseau restent
### en anglais, comme sur un vrai système.

chapitre-paquet-perdu = Le Paquet perdu
    .resume = Trouver où se perd un message, couche par couche : ping, dig, traceroute, curl.

## Fichiers

paquet-perdu-note-de-kofi =
    Un mot de Kofi, bénévole au café associatif La Fourmilière :

    « Au secours ! Internet ne marche plus sur l'ordinateur du café. Le site
    des Lettres du quartier (letters.example) ne s'ouvre pas, et c'est là que
    l'on publie le programme de la semaine.

    J'ai déjà redémarré la box. Rien. Peux-tu regarder ? Le mot de passe de cet
    ordinateur, si tu en as besoin : fourmiliere

    Il y a un carnet à côté de l'écran :  cat carnet.txt  »
paquet-perdu-carnet =
    CARNET DE DÉPANNAGE — trouver où le paquet se perd

    On teste de proche en proche, du plus près au plus loin :

      1. Ma box répond-elle ?           ping 192.168.1.1
      2. Internet répond-il ?           ping 9.9.9.9   (un serveur DNS public)
      3. Les noms fonctionnent-ils ?    ping letters.example
                                        dig letters.example
      4. Par où passent les paquets ?   traceroute letters.example
      5. Le site répond-il ?            curl -I https://letters.example

    Le DNS traduit un nom (letters.example) en adresse IP (des chiffres).
    L'ordinateur sait quel serveur DNS interroger grâce au fichier
    /etc/resolv.conf (ligne « nameserver »).

    Les commandes réseau répondent en anglais, comme sur un vrai système :
    « packet loss » = paquets perdus, « timed out » = délai dépassé.
# Commentaires des fichiers /etc/resolv.conf et /etc/resolv.conf.box (après « # »)
paquet-perdu-resolv-commentaire = Écrit lors de l'installation, avec l'ancienne box
paquet-perdu-resolv-box-commentaire = Réglage conseillé par la nouvelle box

## La page du site, renvoyée par curl (HTML)

paquet-perdu-site-titre = Les Lettres du quartier
paquet-perdu-site-texte = Le site fonctionne ! Écrivez-nous.

## Événements ({ $ip } : adresse IP du site)

paquet-perdu-evenement-box =
    La box répond, en une milliseconde à peine : le réseau local (le câble ou
    le Wi-Fi jusqu'à la box) fonctionne. ping envoie un petit message ICMP
    « echo » ; la machine renvoie la balle, et l'on mesure l'aller-retour.

    Plus loin maintenant : un serveur sur internet,  ping 9.9.9.9
paquet-perdu-evenement-internet =
    9.9.9.9 répond : les paquets sortent bien sur internet et reviennent.
    Donc « internet » marche ! Le problème est ailleurs. Essaie le nom du site :
    ping letters.example
paquet-perdu-evenement-nom =
    « Temporary failure in name resolution » : l'ordinateur n'arrive pas à
    traduire le nom en adresse IP. C'est le travail du DNS. Pose-lui la
    question directement : dig letters.example
paquet-perdu-evenement-dns-muet =
    Le serveur DNS 192.168.1.250 ne répond pas : « timed out ». D'où vient cette
    adresse ? Regarde cat /etc/resolv.conf

    Et pour vérifier que le nom existe bien, demande à un autre serveur DNS :
    dig @9.9.9.9 letters.example
paquet-perdu-evenement-dns-autre =
    Avec un autre serveur DNS, la réponse arrive : letters.example = { $ip }.
    Le nom existe, c'est le réglage de l'ordinateur qui est faux : il interroge
    192.168.1.250, l'adresse de l'ANCIENNE box, qui n'existe plus.

    Le bon réglage est dans /etc/resolv.conf.box. Ce fichier appartient à root :
    sudo cp /etc/resolv.conf.box /etc/resolv.conf
paquet-perdu-evenement-dns-repare = Le DNS est réparé : l'ordinateur interroge maintenant la nouvelle box. Réessaie :  ping letters.example
paquet-perdu-evenement-ping-perdu =
    Le nom est traduit ({ $ip })… mais 100 % des paquets sont perdus !
    Le site serait-il en panne ? Ou les paquets se perdent-ils en route ?
    Suis-les à la trace :  traceroute letters.example
paquet-perdu-evenement-route =
    Voilà le voyage du paquet, saut par saut :
     1. ta box ;
     2-3. les routeurs de ton opérateur (le FAI) ;
     4. un point d'échange, où les réseaux se raccordent entre eux ;
     5. le routeur de l'hébergeur du site.
    Puis plus rien : « * * * ». Les paquets arrivent jusqu'à la porte de
    l'hébergeur. Beaucoup de serveurs ignorent volontairement le ping et le
    traceroute (leur pare-feu les filtre) : ce silence ne prouve pas une panne.

    Le seul vrai test, c'est de demander la page :  curl -I https://letters.example
paquet-perdu-evenement-curl =
    HTTP/2 200 : le site répond parfaitement ! Kofi peut publier le programme.

    Résumé de l'enquête : le réseau local marchait (ping box), internet aussi
    (ping 9.9.9.9). La panne était dans le DNS : l'ordinateur interrogeait une
    ancienne box disparue. Une fois le DNS réparé, le ping du site échouait…
    mais seulement parce que son pare-feu ignore le ping. curl l'a prouvé.

    FIN DE L'HISTOIRE « LE PAQUET PERDU ».

    La méthode à retenir : tester de proche en proche, et ne pas conclure trop
    vite. « Pas de réponse au ping » ne veut pas dire « en panne ».
