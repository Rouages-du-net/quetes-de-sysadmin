### L’Effaceur, chapitre 1 — L’Île du Phare. Se repérer et se déplacer :
### ls, cd, pwd, cat, less, mv, les fichiers cachés. Les noms de lieux et
### de fichiers (Cabane, Jetee, .ampoule_de_secours…) restent dans le code.

chapter-lighthouse = L’Île du Phare
    .summary = Se repérer et se déplacer : ls, cd, pwd, cat, mv, les fichiers cachés.
lighthouse-welcome =
    Tu te réveilles dans une cabane de pêcheur, sur une petite île. Devant toi,
    un écran noir et un curseur qui clignote.

    Dans ce monde, chaque LIEU est un dossier et chaque OBJET est un fichier.
    C'est exactement comme ça que Linux range tout.

    Pour regarder autour de toi, tape :   ls
    Pour te déplacer dans un lieu, tape : cd NomDuLieu
    Pour lire un objet, tape :            cat nom_du_fichier

    Et si tu ne sais plus comment marche une commande, demande au manuel :
      man ls
    C'est le premier réflexe de toutes celles et ceux qui administrent des
    serveurs : chercher dans le manuel avant de demander.

    Commence par lire le message :  cat message.txt
lighthouse-message =
    « Si tu lis ceci, c'est que l'Effaceur est passé sur l'île.

    Une créature parcourt le royaume et efface tout ce qu'elle touche. Cette
    nuit, elle a effacé l'ampoule du Phare. Sans lumière, aucun bateau ne peut
    entrer au Port, et personne ne peut quitter l'île pour rejoindre le Bourg,
    où l'on a besoin d'aide.

    Monte d'abord à l'École des signaux, sur la Colline : on t'y apprendra les
    commandes. Puis viens me trouver au Phare, au bout de la Jetee.

                                  — Maëlle, gardienne du phare »
lighthouse-panel =
    « Plage des Galets. »

    Tu peux toujours revenir en arrière : « .. » désigne le lieu parent.
    Essaie :  cd ..

    Et si tu te perds, « pwd » (print working directory) te dit où tu es.
lighthouse-ravaudeuse =
    Une femme ravaude des filets à côté d'un vieil ordinateur ternaire.

    « Bonjour, voyageur·se. Moi, j'ai programmé avant que l'on parle de
    "logiciel". Deux conseils :

      - la touche Tab complète les noms à ta place : tape « cat ra » puis Tab ;
      - la flèche du haut rappelle tes commandes précédentes.

    Et méfie-toi de l'Effaceur. Il ne détruit pas par méchanceté : il obéit à
    un ordre que quelqu'un lui a donné, il y a longtemps. »
lighthouse-seashell = Un coquillage nacré. Si tu l'approches de ton oreille, tu entends… un ventilateur de serveur.
lighthouse-wind = Le vent souffle fort sur la Colline. En contrebas, la Jetee et le Phare éteint.
lighthouse-headteacher =
    La directrice de l'École des signaux t'accueille entre deux pavillons de
    couleur.

    « Bienvenue ! Tu sais déjà regarder (ls), te déplacer (cd) et lire (cat).
    Il te manque une commande essentielle : mv (move), qui déplace un objet.

      mv objet Lieu

    Va t'entraîner dans la SalleDExercice. Les Cours sont ouverts à tous, et
    la Bibliotheque garde le Livre des commandes.

    Et retiens la devise de l'École : « Dans le doute, lis le manuel. »
    man mv te dira tout sur mv. »
lighthouse-instructions =
    EXERCICE : un crabe s'est échappé de l'aquarium. Remets-le dans le Seau.

      mv crabe Seau

    Puis vérifie avec  ls  et  ls Seau
lighthouse-crab = Un petit crabe vert. Il marche de côté, l'air très occupé.
lighthouse-course-1-manual =
    COURS 1 — LE MANUEL

    Chaque commande a son manuel. Tape  man  suivi du nom de la commande :

      man ls
      man mv

    Une page de manuel a toujours les mêmes parties : NOM (à quoi ça sert),
    SYNOPSIS (comment l'écrire ; ce qui est entre crochets [ ] est facultatif),
    DESCRIPTION, OPTIONS (les lettres après un tiret, comme -a), EXEMPLES, et
    VOIR AUSSI (des commandes voisines).

    Deux raccourcis :
      ls --help        un résumé rapide de la commande
      man -k caché     quelles commandes parlent de « caché » ?

    Sur un vrai Linux, le manuel s'ouvre en plein écran : on le parcourt avec
    les flèches, on cherche avec /mot, et on le quitte avec q.
lighthouse-course-2-paths =
    COURS 2 — LES CHEMINS

    Un chemin dit où se trouve un lieu ou un objet.

      {"."}.            le lieu parent (un cran au-dessus)
      {"."}             le lieu où tu es
      ~             ta maison
      /             la racine, tout en haut

    Un chemin RELATIF part de là où tu es :     cd Cours
    Un chemin ABSOLU part de la racine :        cd /Cabane/Plage
    On peut enchaîner les lieux avec / :        cat ../directrice.txt
    Et ~/ part de ta maison :                   ls ~/Port

    Essaie :  cd ~  puis  pwd
lighthouse-course-3-caches =
    COURS 3 — CE QUI NE SE VOIT PAS

    Sous Linux, un fichier dont le nom commence par un point est CACHÉ :
    un simple « ls » ne le montre pas. Ce n'est pas une protection, juste une
    façon de ranger les réglages pour qu'ils ne gênent pas.

    Pour tout voir, ls a une option. Laquelle ? Je ne te la donne pas : elle
    est dans le manuel.  man ls

    Il y a un fichier caché dans cette salle de cours. À toi de le trouver.
lighthouse-note-secret =
    Bien vu ! Tu as trouvé un fichier caché.

    Retiens-le : sur une île, on range à l'abri ce qui est précieux. Et ce
    qu'on range à l'abri, on lui donne souvent un nom qui commence par un
    point.
lighthouse-course-4-rename =
    COURS 4 — RENOMMER

    mv ne sert pas qu'à déplacer : si la destination n'est pas un lieu
    existant, mv RENOMME l'objet.

      mv brouillon.txt lettre.txt     (brouillon.txt s'appelle désormais lettre.txt)

    On peut même déplacer ET renommer d'un coup, en donnant le nouveau nom au
    bout du chemin :

      mv brouillon.txt ~/Port/lettre.txt

    Sous Linux, déplacer et renommer, c'est la même opération : changer le
    chemin d'un fichier.
lighthouse-book-commands =
    LE LIVRE DES COMMANDES

      ls       liste ce qu'il y a ici (list) ; ls -a montre aussi les cachés
      cd       change de lieu (change directory)
      pwd      affiche où tu es (print working directory)
      cat      affiche le contenu d'un fichier (concatenate)
      less     pareil, page par page (pour les longs fichiers)
      mv       déplace ou renomme (move)
      man      le manuel d'une commande, ex. : man ls
      clear    efface l'écran

    Ces commandes existent depuis les années 1970 : elles viennent d'Unix,
    l'ancêtre de Linux et de macOS. Celles et ceux qui administrent les
    serveurs d'internet les tapent tous les jours.
lighthouse-captain =
    La capitaine Ana tourne en rond sur le quai.

    « Mon bateau peut t'emmener au Bourg. Mais sans le Phare, impossible de
    passer les récifs à la nuit tombée. Rallume-le, et on part ! »
lighthouse-inventory = Le hangar du Port : des rames, des bouées, une ancre. Il reste de la place.
lighthouse-label = La remise de la gardienne. Des caisses de pièces de rechange… presque toutes vides : l'Effaceur est passé.
lighthouse-bulb-rescue = Une grosse ampoule de phare, rangée à l'abri. Une étiquette dit : « Pour la Lanterne. »
lighthouse-net = Un énorme filet de pêche, emmêlé, qui bloque la porte du Phare. Il serait mieux rangé au Hangar du Port.
lighthouse-hint =
    Gravé sur une borne :

      « Ce qui encombre la Jetee a sa place au Hangar.
        ~ te ramène toujours chez toi, d'où part le chemin du Port. »

    (Essaie :  mv filet ~/Port/Hangar)
lighthouse-keeper =
    Maëlle, la gardienne du phare, t'attend au pied de l'escalier.

    « Te voilà ! La Lanterne ne s'allume qu'avec un objet qui s'appelle
    exactement ampoule, posé dans la Lanterne. L'Effaceur a effacé la nôtre.

    Il m'en reste une de secours, rangée à l'abri dans la Remise du Port. Tu ne
    la verras pas avec un simple ls : comme tout ce qu'on range à l'abri, son
    nom commence par un point. (Le manuel de ls dit comment tout voir.)

    Rapporte-la dans la Lanterne, sous son bon nom. mv sait déplacer et
    renommer : regarde les EXEMPLES de man mv. »
lighthouse-steps = Cent vingt marches en colimaçon. Tout en haut, la Lanterne.
lighthouse-lantern =
    La grande lentille du phare, toute en anneaux de verre. Au centre, le
    support de l'ampoule est vide. Une plaque indique :

      « Ampoule — nom exact : ampoule »
lighthouse-lighthouse-blocked = Un énorme filet emmêlé bloque la porte du Phare. Il faudrait le déplacer (mv) ailleurs…
lighthouse-event-crab = Le crabe retrouve son seau. La directrice applaudit : tu sais déplacer un objet avec mv.
lighthouse-event-net = Le filet est rangé. La porte du Phare est libre.
lighthouse-event-bad-name = L’ampoule est bien dans la Lanterne… mais le support refuse un objet qui ne s’appelle pas exactement ampoule. Renomme-la avec mv.
lighthouse-event-light =
    Le Phare s'allume ! Un faisceau balaie la mer, et au Port, la capitaine
    Ana hisse la voile.

    Bravo ! Tu as terminé le chapitre 1.

    Tu sais maintenant te déplacer (cd, .., ~), regarder (ls, ls -a), lire
    (cat, less), te situer (pwd), déplacer et renommer (mv). Ce sont les mêmes
    commandes que sur les vrais serveurs qui font tourner internet.

    Le bateau t'emmène vers le chapitre 2, « Le Bourg ».
