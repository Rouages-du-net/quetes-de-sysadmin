### L’Effaceur, chapitre 2 — Le Bourg. Chercher, créer, copier, effacer :
### grep, touch, cp, mkdir, rm. Les avis de la Mairie sont lus ligne par
### ligne par grep : garder une phrase par ligne.

chapter-village = Le Bourg
    .resume = Chercher, créer, copier, effacer : grep, touch, cp, mkdir, rm.
village-crier =
    Le bateau de la capitaine Ana te dépose sur le quai d'un bourg. Un crieur
    public agite sa cloche.

    « Oyez ! L'Effaceur est passé par le Bourg ! La boulangerie n'a plus de
    levain, l'horloge est arrêtée, l'école n'a plus de classe, et la petite
    Nour a disparu ! Qui nous aidera ? »

    Il te tend un parchemin :  cat parchemin_des_sorts.txt
village-scroll-spells =
    LE PARCHEMIN DES SORTS — cinq nouvelles commandes

      grep motif fichier    trouve les lignes qui contiennent un motif
      touch nom             crée un objet (un fichier vide)
      cp source dest        copie un objet (copy)
      mkdir Nom             crée un lieu (make directory)
      rm objet              efface un objet (remove) — pour toujours !

    Rappel : « man grep » (ou man cp, man rm…) donne le mode d'emploi, et
    « grep --help » un résumé. Tu ne sais plus quelle commande copie ?
    « man -k copie » cherche dans tous les manuels.

    Les gens du Bourg ont besoin de toi : la Boulangerie, l'Atelier, l'Ecole,
    la Mairie… Commence où tu veux.
village-stallholder =
    « Plus rien à vendre, l'Effaceur a tout pris ! Enfin, presque : regarde
    mes étals. »

    Elle baisse la voix : « Un conseil. Avant d'effacer quoi que ce soit avec
    rm, réfléchis bien. rm ne met rien à la corbeille : ce qu'il efface
    disparaît pour de bon. Notre Corbeille, au Royaume, n'est qu'un dossier
    où chacun dépose ce qu'il veut jeter ; c'est l'Effaceur qui la vide, avec
    rm, rm, rm, sans jamais se retourner. »
village-apple = Une pomme un peu fripée.
village-apple-2 = Une autre pomme, tout aussi fripée.
village-cheese = Une meule de fromage qui sent très fort. « Le seul produit que l'Effaceur n'a pas voulu toucher », dit la marchande.
village-cheese-protected-rm = « Ne touche pas à mon dernier fromage ! » proteste la marchande.
village-baker =
    Le boulanger contemple son pétrin vide.

    « L'Effaceur a tout pris. Il ne me reste qu'un seul levain, et il m'en
    faut trois pour les trois fournées du matin. Ah, si je pouvais en avoir
    trois ! »

    (cp levain levain_2 crée une copie du levain.)
village-sourdough = Un bocal de levain qui bulle doucement. C'est vivant, ça se nourrit… et ça se copie.
village-sourdough-protected-rm = « Pas mon dernier levain ! » crie le boulanger.
village-craftswoman =
    L'artisane fouille ses tiroirs vides.

    « Ah, de l'aide ! L'Effaceur a effacé tous mes engrenages, et sans eux,
    l'horloge du Bourg ne tourne plus. Tu sais fabriquer un objet ? Il suffit
    d'une commande :

      touch engrenage

    Ensuite, il m'en faudrait cinq en tout. Fabriquer, c'est long… copier,
    c'est rapide. »
village-teacher =
    L'institutrice fait la classe… dans la cour, faute de salle.

    « L'Effaceur a effacé notre Classe ! Une salle de classe, c'est un lieu.
    Tu sais en construire un ? »

    (mkdir Nom crée un lieu.)
village-clerk =
    La greffière croule sous les affiches.

    « Chaque habitant·e a placardé un avis depuis le passage de l'Effaceur. Il
    y en a une qui dit où il est allé, mais laquelle ? Je n'ai pas le temps de
    toutes les lire. Toi non plus.

    Utilise grep : il cherche un mot dans des fichiers et affiche les lignes
    qui le contiennent. L'étoile * veut dire « tous les fichiers d'ici » :

      grep Effaceur *
village-notice-ball =
    AVIS : le bal du samedi est maintenu.
    Apportez des lampions.
village-notice-cat =
    PERDU : chat roux, répond au nom de Pixel.
    Récompense : un fromage.
village-notice-sewers =
    AVIS DES ÉGOUTIERS
    Nous avons vu l’Effaceur descendre dans l’Egout, au fond de la Cour de la Ruelle.
    La petite Nour l’a suivi. Les rats ne laissent passer personne.
    La clé des Archives est sous le paillasson de la Mairie (un objet caché, bien sûr).
village-notice-works =
    MARCHÉ : ouvert le jeudi.
    Fromages, pommes, et c’est à peu près tout.
village-notice-clock =
    AVIS : l’horloge est arrêtée.
    Tant qu’elle ne tourne pas, la grille de la Ruelle reste fermée.
village-doormat = Sous le paillasson, une petite clé. Tu la prends.
village-doormat-read = La porte des Archives est ouverte.
village-archivist =
    Une archiviste travaille à la lueur d'une bougie.

    « Tu as trouvé la clé ! Alors tu sais te servir de grep. J'étudie
    l'Effaceur depuis des années. Tout est dans la chronique, mais elle est
    longue. Cherche les lignes qui parlent de lui :

      grep Effaceur chronique.txt

    Et si tu ne sais plus si c'est avec une majuscule, ajoute -i :

      grep -i effaceur chronique.txt
village-column =
    CHRONIQUE DU ROYAUME

    An 1 : fondation du Bourg au bord de la mer.
    An 12 : construction du quai, en pierre de l'île.
    An 40 : l'Effaceur est créé à la Racine pour vider la Corbeille.
    An 41 : grande fournée de pain pour la fête du levain.
    An 77 : la maison de l'horloger est agrandie.
    An 102 : l'Effaceur n'obéit plus qu'à un seul ordre : tout effacer.
    An 103 : on raconte que seule la personne qui l'a lancé peut l'arrêter.
    An 104 : la foire aux pommes est annulée (il pleut).
    An 130 : on allume le phare de l'île pour guider les bateaux.
    An 131 : l'Effaceur vit à la Racine, tout en bas, sous les égouts du Bourg.
village-archives-blocked = La porte des Archives est fermée à clé. Les affiches de la Mairie en disent peut-être plus.
village-barricade = Une barricade de planches, de tonneaux et de chaises cassées, dressée à la hâte. Bien trop lourde pour être déplacée.
village-barricade-protected-mv = Tu tires de toutes tes forces… rien. La barricade est trop lourde pour mv. Mais tu connais un sort plus radical.
village-wall = Une cour pavée. Au fond, une plaque d'égout entrouverte : l'Egout.
village-rats =
    Une armée de rats bloque le passage.

    « Couic ! Personne ne passe sans payer. Nous voulons du FROMAGE, ici,
    tout de suite ! »

    Il y a un fromage au Marche. Pour en copier un ici sans y retourner,
    donne son chemin complet et . (le lieu où tu es) comme destination :

      cp ~/Marche/fromage .
village-nour =
    Nour est assise au bord d'un grand Toboggan qui plonge dans le noir.

    « Merci d'être venu·e ! J'ai suivi l'Effaceur jusqu'ici. Il a glissé par
    ce Toboggan, vers la Racine, en marmonnant : "effacer, effacer, l'ordre
    de la racine…" Puis les rats m'ont bloquée. »
village-gallery-blocked = « Couic ! » Les rats te barrent la Galerie.
village-yard-blocked = Une barricade bloque l’entrée de la Cour.
village-alley-blocked = La grille de la Ruelle est fermée. Elle s’ouvre à heure fixe… mais l’horloge du Bourg est arrêtée.
village-event-sourdough = « Trois levains ! » Le boulanger n’en revient pas. « Une copie, c’est un nouvel objet, identique à l’original. Merci ! »
village-event-gear = « Un engrenage ! Parfait. Plus que quatre… avec cp, ce sera vite fait. »
village-event-gears = Tic, tac… L’horloge du Bourg se remet à tourner ! Au premier coup de midi, la grille de la Ruelle s’ouvre en grinçant.
village-event-class = Une Classe se dresse à l’École. Les enfants s’y précipitent.
village-event-class-without-nour = Une Classe se dresse à l’École. Les enfants s’y précipitent. « Il ne manque qu’une élève », soupire l’institutrice : « Nour. »
village-event-barricade =
    Pouf ! La barricade disparaît. La Cour est accessible.
    (rm ne passe par aucune corbeille : elle ne reviendra jamais.)
village-event-rats = Les rats se jettent sur le fromage et l’emportent dans un trou. La Galerie est libre.
village-event-nour-without-class = « Je veux bien rentrer », dit Nour, « mais l’Effaceur a effacé ma Classe. Tu peux la reconstruire, à l’École ? » (mkdir)
village-event-nour =
    Nour court rejoindre sa Classe toute neuve.

    Bravo ! Tu as terminé le chapitre 2.

    Tu sais maintenant chercher (grep), créer (touch, mkdir), copier (cp) et
    effacer (rm) — avec prudence, puisque rm ne passe par aucune corbeille.

    L'Effaceur se cache à la Racine, au bas du Toboggan : le chapitre 3
    t'attend.
