### Indices gradués du Paquet perdu (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Les noms des fichiers sont ceux de noms.ftl.

## Chapitre 1 — Le Paquet perdu

indice-paquet-perdu-box =
    .piste = On teste de proche en proche, du plus près au plus loin (le carnet.txt de Kofi). Le plus proche, c'est la box : une commande envoie un petit message et attend qu'on le renvoie.
    .solution = ping 192.168.1.1 (la box ; 0% packet loss : le réseau local marche).
indice-paquet-perdu-internet =
    .piste = La box répond. Un cran plus loin : un serveur sur internet, par son adresse IP (le carnet en donne une).
    .solution = ping 9.9.9.9 (le serveur DNS public de Quad9).
indice-paquet-perdu-nom =
    .piste = Internet répond par les adresses. Et par les noms ? Essaie le site lui-même, par son nom.
    .solution = ping letters.example
indice-paquet-perdu-dns-muet =
    .piste = Le nom ne se traduit pas en adresse : c'est le travail du DNS. Une commande pose la question directement au serveur DNS (man dig).
    .solution = dig letters.example (puis cat /etc/resolv.conf : quel serveur DNS l'ordinateur interroge-t-il ?).
indice-paquet-perdu-dns-autre =
    .piste = Le serveur DNS configuré ne répond pas. Le nom existe-t-il vraiment ? dig peut interroger un autre serveur que celui de /etc/resolv.conf (man dig, le @).
    .solution = dig @9.9.9.9 letters.example
indice-paquet-perdu-dns-repare =
    .piste = /etc/resolv.conf désigne l'ancienne box, qui n'existe plus. Le bon réglage est dans un fichier voisin. /etc appartient à root : sudo (le mot de passe est dans le mot de Kofi).
    .solution = sudo cp /etc/resolv.conf.box /etc/resolv.conf (mot de passe : fourmiliere).
indice-paquet-perdu-ping-perdu =
    .piste = Le DNS est réparé : réessaie de joindre le site par son nom.
    .solution = ping letters.example
indice-paquet-perdu-route =
    .piste = Le nom est traduit, mais le ping se perd. Où s'arrêtent les paquets ? Une commande montre leur trajet, routeur par routeur.
    .solution = traceroute letters.example
indice-paquet-perdu-curl =
    .piste = Beaucoup de serveurs ignorent le ping exprès. Le seul vrai test : demander la page elle-même, en HTTPS (le carnet, étape 5).
    .solution = curl -I https://letters.example (HTTP/2 200 : le site répond).
