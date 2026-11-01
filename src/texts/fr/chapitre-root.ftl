### L’Effaceur, chapitre 3 — La Racine. Les permissions et l’administration :
### ls -l, chmod, whoami, sudo. L’arborescence est celle d’un vrai Linux
### (/home, /etc, /var/log, /root) : les chemins ne se traduisent pas.

chapitre-root = La Racine
    .resume = Les permissions et l’administration : ls -l, chmod, whoami, sudo.
root-arrivee =
    Tu glisses le long du Toboggan et tu atterris… dans une pièce qui te
    semble familière. Sur la porte, une plaque : /home/vous.

    Ta maison. La vraie. Tout en bas du royaume, à la Racine (« / »), les lieux
    ont enfin leurs vrais noms de Linux : /home pour les maisons des
    utilisateurs, /etc pour les réglages, /var/log pour les journaux, /root
    pour l'administrateur.

    Lis le manuel posé sur la table :  cat manuel_admin.txt
root-manuel-admin =
    MANUEL DE L'ADMINISTRATEUR·ICE

    Chaque objet et chaque lieu a un PROPRIÉTAIRE et des PERMISSIONS.
    Pour les voir :  ls -l

      d rwx r-x r-x   vous  vous  4096  souvenirs/
      │  │   │   │     └─ propriétaire
      │  │   │   └─ les autres : r-x
      │  │   └─ le groupe : r-x
      │  └─ le propriétaire : rwx
      └─ d = un lieu (dossier), - = un objet (fichier)

    (ls -l écrit les trois groupes collés : drwxr-xr-x.)

      r  lire           (read)
      w  écrire         (write)   pour un lieu : y créer, y effacer, y renommer
      x  exécuter       (execute) pour un lieu : y entrer, le traverser

    chmod change les permissions (seul le propriétaire peut le faire) :
      chmod o-w lieu    retire aux autres (o) le droit d'écrire (w)
      chmod 755 lieu    rwx pour le propriétaire, r-x pour les autres

    whoami dit qui tu es. root, lui, a TOUS les droits. Pour agir en tant que
    root, on écrit sudo devant la commande. sudo demande TON mot de passe.

    Ton mot de passe ? L'Effaceur te l'a fait oublier, avec le reste. Tu l'as
    peut-être noté quelque part chez toi… Ton journal.txt est long : grep est
    fait pour ça. (Les guillemets gardent les espaces : grep "mot de passe" …)
root-journal =
    JOURNAL

    An 98 : on me confie l'administration du royaume. Grande responsabilité.
    An 99 : installé l'horloge du Bourg. Les engrenages tournent bien.
    An 100 : la Corbeille déborde. Ce n'est qu'un dossier où chacun dépose ce qu'il veut jeter : il faudrait un programme pour la vider pour de bon.
    An 101 : j'écris l'Effaceur, un petit démon qui videra la Corbeille.
    An 102 : écrit la configuration de l'Effaceur dans /etc. Pas eu le temps de relire.
    An 102 : mon mot de passe change. Je le note ici (très mauvaise idée !) : tournesol
    An 102 : Démarré l'Effaceur. Il tourne sous son propre utilisateur, « effaceur ».
    An 103 : catastrophe. Le levain de la Boulangerie disparaît. Puis les engrenages.
    An 103 : j'ai trouvé l'erreur dans la configuration. J'ai préparé une version corrigée, ici, dans ma maison.
    An 103 : il faut l'installer avec sudo avant que l'Effaceur n'arrive jusqu'à moi.
# Fichier de configuration : garder la ligne « cible = /Royaume/Corbeille »
# telle quelle (le jeu la vérifie).
root-effaceur-conf-corrige =
    # Configuration de l'Effaceur — version corrigée (an 103)
    # Le démon efface, à chaque passage, tout ce qui se trouve dans la cible.
    cible = /Royaume/Corbeille
root-souvenir-ecole = Une salle de classe. Quelqu’un t’apprend à compter en binaire sur tes doigts : jusqu’à 31 avec une seule main.
root-souvenir-premier-programme = Ton tout premier programme. Il affichait « Bonjour » et tu as crié de joie.
root-souvenir-jardin = Un jardin plein de tournesols. Tu adorais leur couleur.
root-souvenir-chanson = Une chanson que tu fredonnais en réparant les serveurs.
root-souvenir-voyage = Un voyage en train, le nez collé à la vitre.
root-souvenir-amie = Une amie qui te disait : « Relis toujours avant d’appuyer sur Entrée. »
root-souvenir-bibliotheque = Une bibliothèque immense, où tu as appris le mot « Unix ».
root-souvenir-premier-serveur = Le premier serveur dont tu as eu la charge. Il ronronnait comme un chat.
root-journal-intime-root =
    Tu pourrais le lire : root a tous les droits. Mais c’est le journal intime de Nour. Tu le refermes sans le lire.
    (#1 : respectez la vie privée des autres.)
# Configuration fautive : garder la ligne « cible = /Royaume /Corbeille ».
root-effaceur-conf =
    # Configuration de l'Effaceur — écrite par : vous (an 102)
    # Le démon efface, à chaque passage, tout ce qui se trouve dans la cible.
    cible = /Royaume /Corbeille
root-sudoers =
    # Qui a le droit d'utiliser sudo, et pour quoi faire.
    root    ALL=(ALL:ALL) ALL
    vous    ALL=(ALL:ALL) ALL   # vous : administrateur·ice du royaume
# Journal du démon : une entrée par ligne (lu avec grep).
root-effaceur-log =
    {"["}an 102] démarrage du démon effaceur (utilisateur : effaceur)
    {"["}an 102] lecture de /etc/effaceur.conf
    {"["}an 102] cible = /Royaume /Corbeille
    {"["}an 102] 2 cibles trouvées : « /Royaume » et « /Corbeille »
    {"["}an 102] effacement de /Royaume/Corbeille/vieux_papiers
    {"["}an 102] effacement de /Royaume/Bourg/Boulangerie/levain_4
    {"["}an 103] effacement de /Royaume/Bourg/Boulangerie/levain_5
    {"["}an 103] effacement de /Royaume/Bourg/Atelier/engrenage_12
    {"["}an 104] effacement de /Royaume/Ile/Phare/ampoule
    {"["}an 131] nouvelle cible accessible : /home/vous/souvenirs (droits : rwxrwxrwx)
root-notes-root =
    Si tu lis ceci, c'est que tu es root (ou que tu as utilisé sudo).

    root peut tout lire, tout modifier, tout effacer, y compris le système
    lui-même. C'est pour cela qu'on ne travaille jamais en root au quotidien :
    on utilise sudo, pour une seule commande, quand c'est nécessaire.
root-evenement-alerte =
    Soudain, un grésillement venu du lieu souvenirs… L'Effaceur est ici ! À
    chacune de tes commandes, il va effacer un de tes souvenirs.

    Regarde les permissions :  ls -l
    Le lieu souvenirs est en rwxrwxrwx : tout le monde, y compris l'utilisateur
    « effaceur », a le droit d'y écrire, donc d'y effacer. Retire ce droit aux
    autres (o), vite :

      chmod o-w souvenirs
root-evenement-conf-effacee =
    Le démon cherche sa configuration… et ne la trouve plus. Il s'arrête.
    C'est mieux que rien, mais plus personne ne vide la Corbeille. Il manque
    une configuration correcte dans /etc : le démon ne lit que le fichier
    /etc/effaceur.conf, sous ce nom exact.

# { $souvenir } : nom du fichier effacé (identifiant technique)
root-souvenir-efface = ✗ Un souvenir s’efface : { $souvenir }
# { $sauves } : souvenirs sauvés ; { $total } : nombre de souvenirs au départ
root-evenement-protege =
    L'Effaceur s'acharne sur tes souvenirs… « Permission non accordée ». Il
    recule. Sous Linux, effacer un fichier, c'est modifier le lieu qui le
    contient : sans le droit d'écrire dans ce lieu, impossible d'y effacer.

    Tu as sauvé { $sauves ->
        [one] { $sauves } souvenir
       *[other] { $sauves } souvenirs
    } sur { $total }. Mais l'Effaceur continue ailleurs, dans
    tout le royaume. D'où vient son ordre ? Les démons écrivent ce qu'ils font
    dans un journal :

      cat /var/log/effaceur.log
# { $perte } : « oui » si des souvenirs ont été effacés, sinon « non »
root-evenement-corrige =
    Le démon relit sa configuration : « cible = /Royaume/Corbeille ». Une
    seule cible, cette fois. L'Effaceur s'arrête net… puis se met à vider la
    Corbeille, comme au premier jour.

    Et tout te revient. Tu étais l'administrateur·ice du royaume. C'est toi
    qui avais écrit cette configuration, avec une espace de trop : « /Royaume
    /Corbeille » au lieu de « /Royaume/Corbeille ». Pour l'Effaceur, cela
    faisait deux cibles, dont le royaume entier. Il n'était pas méchant : il
    faisait exactement ce qu'on lui avait écrit.

    Tu as sauvé { $sauves ->
        [one] { $sauves } souvenir
       *[other] { $sauves } souvenirs
    } sur { $total }.{ $perte ->
        [oui] {" "}Ceux qui sont partis ne reviendront pas : rm ne passe par aucune corbeille… à moins d'avoir fait des sauvegardes. Mais ça, c'est une autre histoire.
       *[non] {""}
    }

    LE ROYAUME EST SAUVÉ. (Un dernier chapitre t'attend : La Sauvegarde,
    pour que plus rien ne se perde.)

    Tu connais maintenant les permissions (ls -l, chmod), la différence entre
    un utilisateur et root, et sudo — avec ses trois règles. La deuxième est
    la plus importante : réfléchis avant de taper.
