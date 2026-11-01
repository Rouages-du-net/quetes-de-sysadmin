### Histoire « L'Audit », chapitre « Le rapport » : quatre constats d'hygiène
### sur le serveur du Fournil (SSH, un compte oublié, sudo sans mot de passe,
### un secret lisible par tous). Les mots-clés (PermitRootLogin, NOPASSWD…),
### les commandes, les chemins et les messages des outils (en anglais) ne se
### traduisent pas.

chapitre-report = Le rapport
    .resume = Corriger les constats d'un audit : SSH, un compte oublié, sudo sans mot de passe, un secret lisible par tous.

## Fichiers

report-courriel-nadia =
    De :     Nadia (Le Fournil)
    À :      toi
    Objet :  L'audit de mon serveur

    Je tiens la boulangerie, pas le serveur : c'est toi qui t'en occupes
    maintenant. Mon assureur veut un audit de sécurité avant de renouveler
    le contrat, alors j'ai fait venir Salomé, une auditrice indépendante.
    Elle a passé le serveur au crible hier et m'a laissé son rapport, que
    j'ai copié dans ton dossier : rapport-audit.txt.

    Je n'y comprends pas tout, mais elle a l'air sérieuse. Peux-tu traiter
    les constats, un par un, sans couper les commandes en ligne ? On a
    du monde au comptoir tous les matins, et le site ne doit pas tomber.

    Pour sudo, ton mot de passe est : farine-2028
    Et merci de vérifier chaque correction : Salomé reviendra contrôler.

report-rapport-audit =
    RAPPORT D'AUDIT — Le Fournil (bakery.example)
    Auditrice : Salomé, indépendante
    Périmètre : le serveur fournil (192.0.2.22)
    Méthode : revue des comptes et de la configuration, balayage des ports
    depuis internet, lecture des journaux

    Ce rapport compte trois parties. Voici la première, l'hygiène du serveur.
    Les deux autres suivront (exposition sur le réseau, traces de connexion).

    C1 — SSH accepte la connexion directe du compte root       [élevé]
         Un robot qui devine un mot de passe, ou une clé volée, donnerait
         tous les droits d'un coup. Référence : sshd_config(5), PermitRootLogin.

    C2 — Le compte d'une personne partie existe toujours        [élevé]
         lucas, stagiaire dont le contrat a pris fin le 28 février, a
         encore un compte, et il est membre du groupe sudo.

    C3 — sudo sans mot de passe pour le compte d'administration [moyen]
         Une session volée ou un oubli de verrouillage d'écran suffit pour
         obtenir root sans rien taper. Référence : sudoers(5), NOPASSWD.

    C4 — Un fichier de secrets est lisible par tout le monde    [moyen]
         /srv/commandes/.env contient l'adresse de la base de données avec
         son mot de passe. Tout compte du serveur peut le lire.

    Attendu : pour chaque constat, corriger, puis vérifier que la
    correction tient (et que rien n'est cassé : le site, l'appli de
    commandes et l'accès de l'administration restent en service).

## Événements

report-evenement-sudoers-casse =
    Il y a une erreur dans la politique de sudo ! Quand un fichier de sudoers
    est faux, sudo refuse tout, pour tout le monde. On modifie ces fichiers
    avec visudo (man visudo) : il vérifie la syntaxe avant d'enregistrer.
report-evenement-enferme =
    ATTENTION : avec la configuration que sshd vient de charger, une nouvelle
    connexion de ton compte serait refusée. Ta session actuelle reste ouverte
    (sshd ne coupe jamais les sessions en cours) : c'est le moment de
    corriger, AVANT de te déconnecter.
report-evenement-sans-effet =
    Le fichier dit bien « PermitRootLogin no »… mais sshd ne l'a pas encore
    appliqué : il lit sa configuration au démarrage et quand on la lui fait
    recharger. Vérifie avec  sudo sshd -t  (la syntaxe), puis fais recharger
    le service. Pour voir ce que sshd applique vraiment :  sudo sshd -T
report-evenement-compte-incomplet =
    Tu as traité une partie du constat C2 seulement. Un compte « fermé »,
    c'est : plus de connexion possible (mot de passe verrouillé, compte
    expiré) ET plus aucun droit (retiré du groupe sudo). Regarde ce qui reste
    avec  id lucas  et  sudo chage -l lucas  (man chage, man usermod).
report-evenement-appli-aveugle =
    Le secret n'est plus lisible par tout le monde… mais l'appli de commandes
    non plus ! Elle tourne avec le compte « commandes » et lit .env au
    démarrage : elle ne repartirait pas au prochain redémarrage. Regarde qui
    possède le fichier (ls -l) : le but est de fermer la porte aux autres
    comptes, pas à l'appli.
report-evenement-ssh =
    sshd applique ta nouvelle configuration : root ne peut plus entrer, et
    ton compte, lui, le peut toujours. C1 est traité.

    Sur un vrai serveur, on garde une session ouverte et on teste avec une
    deuxième avant de fermer la première.
report-evenement-compte =
    Plus personne ne peut se connecter avec le compte de Lucas, et il n'a plus
    aucun droit sur le serveur. C2 est traité.
report-evenement-sudo =
    Plus aucune règle NOPASSWD pour ton compte : sudo te demande ton mot de
    passe, comme il faut, et tu peux toujours administrer. C3 est traité.
report-evenement-secret =
    Le fichier de secrets n'est plus lisible que par l'appli (et son
    propriétaire), et l'appli peut toujours le lire. C4 est traité.
report-evenement-fin =
    Les quatre constats sont corrigés, et rien n'est cassé. Nadia : « Le site
    n'a pas bougé d'un poil. Je transmets ça à Salomé ! »

    Bravo ! Tu as terminé le chapitre « Le rapport ».

    CE QUI S'EST PASSÉ
    Un audit ne cherche pas des pirates : il compare le serveur à ce qu'il
    devrait être. Ces quatre constats sont les plus courants : une porte
    d'entrée trop large (root en SSH), un accès oublié après un départ
    (compte et sudo), un privilège sans garde-fou (sudo sans mot de passe)
    et un secret à portée de tous (.env en rw-r--r--). Aucun n'est une
    attaque : chacun en facilite une.

    LA BONNE PRATIQUE
    - PermitRootLogin no : on devient root avec sudo, depuis son propre
      compte, ce qui laisse une trace de qui a fait quoi. Toujours sshd -t
      avant de recharger, et garder une session ouverte pour tester.
    - À chaque départ, fermer le compte : userdel (ou usermod -L, un
      chage -E et le retrait de sudo si l'on veut garder ses fichiers).
      Une liste des comptes à relire régulièrement évite les oublis.
    - sudo avec mot de passe, ou des règles limitées à une commande :
      moindre privilège. Les fichiers de /etc/sudoers.d se modifient avec
      visudo.
    - Un fichier de secrets : chmod 600, propriétaire le compte qui s'en
      sert. Mieux : ne pas garder de secret en clair dans un dépôt ni sur
      un partage.

    UNE AUTRE VOIE
    Pour C2, supprimer le compte est le plus net ; le verrouiller, l'expirer
    et le retirer de sudo garde ses fichiers pour un transfert de dossier,
    mais laisse une porte à surveiller : un compte seulement verrouillé
    (usermod -L) accepterait encore une clé SSH ; c'est l'expiration
    (usermod -e, chage -E) qui ferme vraiment, avec le retrait de sudo.

    LA DOCUMENTATION
    - sshd_config : https://man.openbsd.org/sshd_config
    - sudoers : https://www.sudo.ws/docs/man/sudoers.man/
    - userdel et usermod : https://man7.org/linux/man-pages/man8/userdel.8.html
    - chmod : https://man7.org/linux/man-pages/man1/chmod.1.html
