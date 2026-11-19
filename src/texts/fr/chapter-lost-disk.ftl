### Histoire « L'Épicerie solidaire », chapitre « Le disque perdu » : le
### disque de sauvegarde, perdu dans le tram puis retrouvé, n'était pas
### chiffré. LUKS (cryptsetup), un fichier de clé et une phrase de passe,
### /etc/crypttab et /etc/fstab. Les commandes, options, chemins, noms de
### périphériques et sorties ne sont pas traduits.

chapter-lost-disk = Le disque perdu
    .summary = Le disque de sauvegarde de l'épicerie a passé un week-end aux objets trouvés du tram, en clair, avec la liste des foyers qu'elle aide. Chiffrez-le avec LUKS, donnez un fichier de clé à la sauvegarde de nuit et une phrase de passe à la trésorière, décrivez-le dans crypttab et fstab, et remettez la sauvegarde dessus.

## Fichiers

lost-disk-message-fatou =
    De : Fatou (coordinatrice)
    Lundi, 9 h 02

    Bonjour, et merci d'être venu·e si vite.

    Vendredi soir, Joaquín a emporté le disque de sauvegarde chez lui,
    comme chaque semaine (le disque qui quitte les locaux, en cas
    d'incendie). Il a oublié son sac dans le tram. Les objets trouvés
    nous l'ont rendu ce matin, le disque dedans, apparemment intact.

    Apparemment. Ce disque contient une copie de tout : la liste des
    foyers que nous aidons (familles.csv), avec leurs notes. Si quelqu'un
    l'avait branché sur un portable, il aurait pu tout lire.

    Je veux que ce ne soit plus jamais possible. Joaquín a rebranché le
    disque sur cagette (il est monté sur /mnt/offsite, comme chaque
    semaine). Mei, notre trésorière, vous a laissé un mot.

    Fatou

lost-disk-note-mei =
    Mot de Mei (trésorière)

    Je garde les mots de passe de l'association dans notre gestionnaire
    de mots de passe, et une copie papier dans une enveloppe scellée à la
    banque. Pour le disque de sauvegarde, j'ai généré cette phrase de
    passe :

        { $passphrase }

    Elle est déjà dans le gestionnaire (« Disque de sauvegarde — LUKS »)
    et dans l'enveloppe. Utilisez-la pour le disque, comme un accès qui
    ne dépend pas du serveur. Puis supprimez ce mot : il n'a rien à faire
    sur cagette.

lost-disk-last-sync =
    rsync vers le disque externe : vendredi 2 mars 2029, 18 h 40, OK.

## Événements

lost-disk-event-disk =
    Le voilà : sdb, un disque amovible (RM 1), et sa partition sdb1, un
    système de fichiers ext4 en clair, étiqueté OFFSITE, monté sur
    /mnt/offsite. N'importe qui peut le lire sur n'importe quel
    ordinateur. Pour le chiffrer, il doit d'abord être libre : rien de
    monté, personne dessus.
lost-disk-event-system-disk =
    cryptsetup a refusé : ce périphérique est utilisé. Heureusement, car
    sda est le disque de cagette, celui sur lequel tourne le système. Le
    chiffrer aurait effacé le serveur. Le disque de sauvegarde, c'est
    l'autre : vérifiez avec lsblk (RM, SIZE, MOUNTPOINTS) avant de nommer
    un périphérique.
lost-disk-event-in-use =
    cryptsetup ne formate pas un périphérique monté : démontez-le d'abord
    (umount). Pas d'inquiétude pour son contenu : c'est la copie de
    vendredi dernier, et les originaux sont sur cagette, dans /srv.
lost-disk-event-unmounted =
    Le disque est libre. Le formater en LUKS efface ce qu'il contient et
    écrit à son début un en-tête avec des emplacements de clé (man
    cryptsetup, luksFormat). Nommez bien le périphérique : la partition
    sdb1 (ou le disque entier sdb).
lost-disk-event-lowercase =
    cryptsetup ne continue que si vous tapez YES, en majuscules : toute
    autre réponse, « yes » compris, annule. C'est un ralentisseur voulu :
    le dernier moment pour vérifier le nom du périphérique.
lost-disk-event-formatted =
    Le périphérique est maintenant en LUKS : un en-tête (cryptsetup
    luksDump montre ses emplacements de clé) puis, derrière, uniquement
    des données chiffrées. On ne peut rien monter directement : il faut
    l'ouvrir (cryptsetup open PÉRIPHÉRIQUE NOM), ce qui crée un
    périphérique en clair, /dev/mapper/NOM. Attention : c'est sur lui que
    va le système de fichiers.
lost-disk-event-mounted-luks =
    mount ne sait pas quoi faire de crypto_LUKS : le périphérique chiffré
    ne se monte jamais lui-même. Ouvrez-le (cryptsetup open PÉRIPHÉRIQUE
    NOM), puis montez /dev/mapper/NOM une fois qu'il porte un système de
    fichiers.
lost-disk-event-mkfs-header =
    mkfs.ext4 a écrit sur la partition chiffrée elle-même : l'en-tête LUKS
    a disparu, et le disque est de nouveau en clair. Le système de
    fichiers va sur le périphérique ouvert, /dev/mapper/NOM, jamais sur
    celui du dessous. Recommencez avec luksFormat.
lost-disk-event-filesystem =
    Un système de fichiers ext4 vit dans le périphérique chiffré : ce que
    vous écrivez sur /dev/mapper/NOM est chiffré en allant vers le
    disque. Passons aux clés. La sauvegarde de nuit ne peut pas taper de
    phrase de passe : il lui faut un fichier de clé (des octets
    aléatoires : dd depuis /dev/urandom), lisible par root seul, ajouté
    dans un deuxième emplacement (luksAddKey).
lost-disk-event-keyfile-open =
    Ce fichier de clé ouvre le disque, et quelqu'un d'autre que root peut
    le lire (ls -l : ses droits, son propriétaire). Un fichier de clé est
    un mot de passe : chmod 400, à root, dans un répertoire où root seul
    entre (/root).
lost-disk-event-keyfile-on-disk =
    Ce fichier de clé est sur le disque de sauvegarde lui-même : la clé
    laissée sur la serrure. Il partirait avec le disque, et il ne peut de
    toute façon pas ouvrir ce sur quoi il est posé. Gardez-le sur
    cagette, dans /root.
lost-disk-event-keyfile =
    Le fichier de clé ouvre le disque, et seul root peut le lire : la
    sauvegarde de nuit pourra l'ouvrir sans que personne ne tape rien.
    Mais si cagette meurt, cette clé meurt avec elle. Le disque doit
    aussi s'ouvrir avec quelque chose gardé ailleurs : la phrase de passe
    de Mei.
lost-disk-event-own-passphrase =
    Cette phrase de passe est dans un emplacement, mais ce n'est pas
    celle que garde Mei : si vous l'oubliez, personne d'autre ne peut
    ouvrir le disque. Ajoutez aussi la sienne (luksAddKey), et vous
    pourrez retirer la vôtre ensuite (luksRemoveKey).
lost-disk-event-passphrase =
    La phrase de passe de Mei ouvre le disque : si cagette brûle, son
    enveloppe suffit pour lire la sauvegarde sur n'importe quelle machine
    Linux.
lost-disk-event-insecure =
    cryptdisks_start se plaint des droits du fichier de clé : il devrait
    appartenir à root et n'être lisible par personne d'autre (chmod 400
    ou 600).
lost-disk-event-crypttab-name =
    Cette ligne de crypttab désigne le disque par /dev/sdX : le nom d'un
    disque USB change selon l'ordre dans lequel on branche les disques.
    Utilisez son UUID LUKS (UUID=…, voir blkid ou cryptsetup luksUUID).
lost-disk-event-crypttab-auto =
    Avec cette ligne de crypttab, le démarrage attendrait un disque
    absent chaque week-end. Un disque amovible prend noauto (ouvert à la
    demande, cryptdisks_start) ou nofail.
lost-disk-event-crypttab =
    /etc/crypttab décrit le disque : son nom, son UUID, le fichier de clé,
    et noauto. cryptdisks_start NOM l'ouvre avec le fichier de clé, comme
    le fera la sauvegarde de nuit. Maintenant /etc/fstab : l'ancienne
    ligne monte une étiquette qui n'existe plus.
lost-disk-event-fstab =
    /etc/fstab monte /dev/mapper/NOM, pas au démarrage (noauto ou
    nofail) : une fois le disque ouvert, mount /mnt/offsite suffit.
lost-disk-event-copied =
    Les fichiers de l'épicerie sont de nouveau sur le disque chiffré :
    cette semaine au moins, il y a une sauvegarde.
lost-disk-event-busy =
    Le périphérique ouvert est encore utilisé : quelque chose y est
    monté. Démontez d'abord (umount), puis fermez.
lost-disk-event-closed =
    Le disque est fermé : sans clé, ce n'est que du bruit. Joaquín pourra
    l'emporter vendredi.
lost-disk-event-note =
    Le mot de Mei a quitté cagette : la phrase de passe ne vit plus que là
    où elle doit être, dans le gestionnaire et dans l'enveloppe.
lost-disk-event-note-early =
    Vous avez supprimé le mot de Mei avant que sa phrase de passe soit
    dans un emplacement : elle vient de le renvoyer (cat du mot).
    Supprimez-le une fois que le disque s'ouvre avec.
lost-disk-event-end =
    Fatou : « Donc si le sac est de nouveau perdu, celui qui le trouve
    récupère une brique ? Et si cagette meurt, l'enveloppe de Mei
    l'ouvre ? Parfait. »

    Bravo ! Vous avez terminé le chapitre 1 de L'Épicerie solidaire. (La
    suite vous attend : ssh cagette.)

    CE QUI S'EST PASSÉ
    Le disque de sauvegarde voyageait en clair. Vous l'avez démonté,
    chiffré avec LUKS (cryptsetup luksFormat, après un YES en
    majuscules), ouvert, et vous avez créé le système de fichiers sur le
    périphérique ouvert (/dev/mapper/NOM), avec deux clés : un fichier de
    clé que seul root lit, pour la sauvegarde de nuit, et la phrase de
    passe de Mei, gardée hors du serveur. crypttab et fstab le décrivent,
    les fichiers sont de nouveau dessus, et il quitte les locaux fermé.

    BONNES PRATIQUES
    - Tout disque qui quitte les locaux est chiffré : une sauvegarde
      perdue doit être un objet perdu, pas une fuite de données.
    - Vérifier deux fois le périphérique avant luksFormat (lsblk : RM,
      SIZE, le modèle).
    - Jamais une seule clé : une automatique (un fichier de clé, root
      seul) et une humaine gardée ailleurs (gestionnaire de mots de
      passe, enveloppe scellée).
    - Un fichier de clé n'est jamais rangé sur le disque qu'il ouvre, ni
      lisible par un autre que root.
    - crypttab et fstab : l'UUID plutôt que /dev/sdX, noauto ou nofail
      pour un disque amovible, pour que le démarrage ne l'attende pas.
    - Sauvegarder aussi l'en-tête LUKS (cryptsetup luksHeaderBackup) : un
      en-tête abîmé rend toutes les clés inutiles.
    - Chiffré n'est pas sauvegardé : remettez les fichiers, et testez
      l'ouverture avec chaque clé.

    DOCUMENTATION
    - cryptsetup : https://man7.org/linux/man-pages/man8/cryptsetup.8.html
    - crypttab : https://man7.org/linux/man-pages/man5/crypttab.5.html
    - FAQ de cryptsetup : https://gitlab.com/cryptsetup/cryptsetup/-/wikis/FrequentlyAskedQuestions
    - crypttab et cryptdisks sous Debian : https://cryptsetup-team.pages.debian.net/cryptsetup/README.Debian.html
