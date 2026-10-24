### Histoire « Les Archives », chapitre unique (src/moteur/chapitres/archives.ts) :
### sauver le fonds d'une bibliothèque de quartier sur une petite clé USB,
### avec du, df, find et tar.

chapitre-archives = Les Archives
    .resume = Mesurer, trier et empaqueter un fonds pour le sauver sur une clé : du, df, find, tar.

## Fichiers

archives-lettre-de-rosa =
    Une lettre de Rosa, bibliothécaire de la bibliothèque du quartier :

    « Le serveur de la bibliothèque sera éteint ce soir à minuit, définitivement :
    la mairie ne le paie plus. Tout notre fonds est dessus : les manuscrits
    donnés par les habitant·es, les vieux plans, la gazette, les enregistrements
    du marché.

    Je n'ai qu'une vieille clé USB de 64 Mo, branchée sur /media/cle. Peux-tu y
    mettre le fonds, dans UNE SEULE archive compressée ? Une archive est plus
    facile à transporter, et la compression gagne de la place.

    Attention, ce n'est pas tout de copier : il faut que tout tienne. Mesure
    d'abord. Mes notes sont dans cat notes_rosa.txt »
archives-notes-rosa =
    NOTES DE ROSA

    Combien de place ?
      du -sh fonds          la taille totale du dossier fonds
      du -h fonds           la taille de chaque sous-dossier
      df -h /media/cle      la place libre sur la clé

    Chercher des fichiers, partout dans un dossier et ses sous-dossiers :
      find fonds -name "*.pdf"      tous les PDF
      find fonds -name "*.tmp"      tous les fichiers temporaires
    Les fichiers .tmp sont des restes de nos logiciels de numérisation : on peut
    les jeter sans regret. Pour effacer tout ce que find trouve, on ajoute
    -delete à la fin (relis bien la commande avant de taper Entrée !).

    Faire une archive compressée (tar = tape archive, z = gzip) :
      tar -czf /media/cle/fonds.tar.gz fonds
    Vérifier ce qu'elle contient :
      tar -tzf /media/cle/fonds.tar.gz
archives-lisezmoi = Fonds de la bibliothèque du quartier. Dons des habitant·es, 1890-2026.
archives-journal-de-marie = Journal de Marie, couturière, 1931-1940 (transcription).
archives-lettres-1914 = Lettres d’Ahmed à sa sœur, 1914-1918 (transcription).
archives-recettes-du-quartier = Recettes collectées au marché, 1975-2020.
# Contenu affiché par cat pour les fichiers qui ne sont pas du texte
archives-image-png = (image PNG)
archives-document-pdf = (document PDF)
archives-son-ogg = (son Ogg Vorbis)
archives-fichier-temporaire = (fichier temporaire)

## Événements

archives-evenement-mesure =
    Le fonds pèse bien plus que les 64 Mo de la clé. Mais regarde où se trouve
    la place : quelques gros fichiers… Rosa parlait de fichiers temporaires.
    find fonds -name "*.tmp"
archives-evenement-plein =
    « Aucun espace disponible sur le périphérique » : l'archive ne tient pas sur
    la clé. Il faut faire de la place AVANT : que contient le fonds qui n'est
    pas précieux ? (du -h fonds, puis find fonds -name "*.tmp")
archives-evenement-tmp =
    Trois fichiers temporaires, 120 Mo à eux trois ! Rosa dit qu'on peut les
    jeter. find peut les effacer d'un coup, avec -delete à la fin :

      find fonds -name "*.tmp" -delete

    (Relis bien avant Entrée : sans le -name, find effacerait TOUT le fonds.)
archives-evenement-perte =
    Aïe : un fichier précieux du fonds a disparu, et find -delete, comme rm, ne passe par aucune corbeille…
    Dans la vraie vie, c'est pour cela qu'on fait des sauvegardes AVANT de faire
    le ménage. Ici, tu peux recommencer le chapitre (lien sous le terminal).
archives-evenement-menage =
    Le ménage est fait. Vérifie avec du -sh fonds, puis crée l'archive
    compressée directement sur la clé :

      tar -czf /media/cle/fonds.tar.gz fonds
# { $taille } : taille de l'archive en Mo (nombre, avec une décimale)
archives-evenement-sauve =
    L'archive est sur la clé : { NUMBER($taille, minimumFractionDigits: 1, maximumFractionDigits: 1) } Mo, avec tout le fonds. Les textes ont été
    fortement compressés ; les images, les sons et les PDF, déjà compressés,
    presque pas. Pour vérifier son contenu sans l'ouvrir :
    tar -tzf /media/cle/fonds.tar.gz

    Rosa débranche la clé à 23 h 58. « Tout y est. Merci ! »

    (Un deuxième chapitre t'attend : Les versions.)

    Tu sais maintenant mesurer (du, df), chercher et trier (find, -delete) et
    empaqueter (tar). Et une règle d'or des archivistes : une seule copie, ce
    n'est pas une sauvegarde. Rosa en fera une deuxième dès demain.
