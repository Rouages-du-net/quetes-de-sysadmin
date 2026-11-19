### Histoire « L'Épicerie solidaire », chapitre « L'exercice de
### restauration » : la perte du serveur simulée sur un portable prêté
### (secours), avec seulement le disque et l'enveloppe de la trésorière.
### cryptsetup open, restic check --read-data, restic restore,
### sha256sum -c, et la base que la sauvegarde oubliait. Les commandes,
### options, chemins et sorties ne sont pas traduits.

chapter-restore-drill = L'exercice de restauration
    .summary = Samedi matin, l'épicerie simule la perte de son serveur : un portable prêté, le disque de sauvegarde, et l'enveloppe de la trésorière, rien d'autre. Ouvrez le disque, relisez le dépôt jusqu'à ses données, restaurez, prouvez que les fichiers sont intacts, et découvrez ce que la sauvegarde n'a jamais contenu.

## Fichiers

restore-drill-message-fatou =
    De : Fatou (coordinatrice)
    Samedi 17 mars, 9 h 45

    Aujourd'hui, on fait comme si cagette avait disparu : brûlée, volée,
    peu importe. Noor nous a prêté son vieux portable, que nous appelons
    secours. Debian vient d'y être installé (avec cryptsetup et restic),
    vous pouvez l'atteindre depuis cagette (ssh secours), et Joaquín y a
    branché le disque de sauvegarde.

    La règle du jeu : sur secours, seulement le disque et ce qu'il y a
    dans l'enveloppe de Mei. Rien de cagette : dans un vrai sinistre, les
    fichiers de cagette seraient des cendres. Mei a ouvert l'enveloppe
    pour nous :

        Disque de sauvegarde (LUKS) :     { $disk }
        Sauvegardes (secours restic) :    { $restic }

    (Elle en scellera une nouvelle après.) La liste à suivre est dans
    exercice.txt.

    Fatou

restore-drill-checklist =
    EXERCICE DE RESTAURATION — liste (Fatou, mars 2029)

    1. Sur secours : trouver le disque de sauvegarde, l'ouvrir avec la
       phrase de passe de l'enveloppe, le monter.
    2. Ouvrir le dépôt avec le mot de passe de l'enveloppe ; lister les
       instantanés.
    3. Vérifier le dépôt, en entier, données comprises.
    4. Restaurer le dernier instantané À CÔTÉ (par-dessus rien), par
       exemple sous /srv/restore.
    5. Prouver que les fichiers sont intacts : le script écrit leur
       SHA-256 dans SHA256SUMS avant chaque sauvegarde.
    6. L'appli pourrait-elle repartir de là ? Il lui faut ses fichiers ET
       sa base (la sauvegarde de nuit, pantry.sql).
    7. Corriger ce que l'exercice a révélé. Fermer le disque sur secours.

## Événements

restore-drill-event-log =
    « backup completed », chaque nuit. Le journal dit que le script est
    arrivé à sa dernière ligne : il ne dit pas ce qui a été sauvegardé,
    ni si on peut le relire. C'est à ça que sert aujourd'hui.
restore-drill-event-plugged =
    Le voilà, sur secours : sdb1, crypto_LUKS. secours n'a ni fichier de
    clé, ni crypttab, rien : la phrase de passe de l'enveloppe est le seul
    accès (cryptsetup open).
restore-drill-event-copied-secret =
    C'est un secret de cagette (son fichier de clé, ou le mot de passe
    restic du script), copié sur secours. Dans un vrai sinistre, il
    aurait brûlé avec cagette : l'exercice ne prouve rien ainsi.
    Supprimez-le de secours et utilisez l'enveloppe.
restore-drill-event-opened-key =
    Le disque a été ouvert avec le fichier de clé de cagette : c'est la
    clé qui meurt avec cagette. Fermez-le, et rouvrez-le avec la phrase
    de passe de Mei.
restore-drill-event-opened =
    Le disque s'ouvre avec la seule phrase de passe de l'enveloppe :
    première moitié de la question de Mei, vérifiée pour de vrai.
    secours n'a pas de /mnt/offsite : n'importe quel répertoire vide fera
    un point de montage (mkdir).
restore-drill-event-mounted =
    Monté. Le dépôt est dans restic/ : secours n'a pas de
    /root/.restic-pass, donc restic demandera le mot de passe (ou donnez
    -r et tapez celui de l'enveloppe).
restore-drill-event-nightly-key =
    C'est le mot de passe du script, venu de cagette : un vrai jour de
    sinistre, vous ne l'auriez pas. Utilisez celui de l'enveloppe.
restore-drill-event-snapshots =
    Le dépôt s'ouvre avec le mot de passe de l'enveloppe : deuxième moitié
    de la question. Avant de lui faire confiance, vérifiez-le, jusqu'aux
    données.
restore-drill-event-check-only =
    restic check, sans option, vérifie la structure du dépôt (index,
    instantanés, arbres) : pas le contenu des paquets. Pour relire chaque
    octet depuis le disque, c'est --read-data (man restic).
restore-drill-event-read-data =
    Chaque paquet relu et vérifié : les données de ce disque sont
    entières. Restaurez maintenant le dernier instantané, à côté :
    restore … --target RÉPERTOIRE recrée le chemin complet sous lui.
restore-drill-event-over-root =
    --target / écrit les fichiers là où ils étaient. Sur un secours vierge,
    c'est sans danger, mais sur une machine en service, cela écraserait
    les données du jour avec celles de la nuit. Pendant un exercice,
    restaurez à côté et comparez.
restore-drill-event-restored =
    Les fichiers sont revenus, sous le chemin complet que restic a recréé.
    Restauré ne veut pas dire juste : comparez-les avec ce que le script a
    noté avant la sauvegarde (SHA256SUMS, sha256sum -c, depuis leur
    répertoire).
restore-drill-event-mismatch =
    sha256sum signale un fichier qui ne correspond pas, ou qu'il ne peut
    pas lire. Lancez-le depuis le répertoire où se trouve SHA256SUMS : les
    noms dedans sont relatifs.
restore-drill-event-verified =
    Chaque fichier correspond à son SHA-256 : la restauration est exacte.
    La liste a encore une ligne : la base.
restore-drill-event-no-dump =
    Aucun pantry.sql dans aucun instantané : le script ne sauvegarde que
    /srv/epicerie. La sauvegarde de la base est écrite sur cagette, dans
    { $dump }, et rien ne l'emporte jamais. Sans elle, l'appli
    redémarrerait vide : aucun passage, aucun rendez-vous. Corrigez le
    script sur cagette (sa ligne restic backup).
restore-drill-event-fixed =
    Le script sauvegarde maintenant aussi la sauvegarde de la base : dès
    cette nuit, une restauration ramène l'appli entière. (La base est
    sauvegardée à 23 h 30, le script tourne à 1 h : l'ordre est bon.)
restore-drill-event-closed =
    Le disque est démonté et fermé sur secours : Joaquín peut le prendre.
restore-drill-event-end =
    Fatou : « Donc : l'enveloppe ouvre tout, les fichiers reviennent
    intacts, et on a trouvé le trou avant l'incendie. Même exercice dans
    six mois ? » Mei scelle déjà une nouvelle enveloppe.

    Bravo ! Vous avez terminé L'Épicerie solidaire.

    CE QUI S'EST PASSÉ
    Vous avez simulé la perte de cagette sur une machine vierge, avec
    seulement le disque et l'enveloppe : la phrase de passe a ouvert le
    disque, le mot de passe de secours a ouvert le dépôt, check
    --read-data a relu chaque paquet, le dernier instantané est revenu à
    côté, et sha256sum -c a prouvé que les fichiers étaient exacts.
    L'exercice a aussi trouvé ce qu'aucun journal ne montrait : la
    sauvegarde de la base n'avait jamais été sauvegardée. Le script la
    prend maintenant.

    BONNES PRATIQUES
    - Une sauvegarde jamais restaurée est un espoir. S'exercer
      régulièrement, sur une autre machine, avec seulement ce qui
      survivrait à un sinistre.
    - « backup completed » prouve que le script est allé au bout, pas
      qu'il contient les bonnes choses : listez ce qu'il faut pour
      repartir (fichiers, base, configuration) et cherchez chacun.
    - restic check --read-data relit chaque octet : de temps en temps
      (ou --read-data-subset sur les gros dépôts).
    - Restaurer à côté, puis comparer (empreintes, diff) : jamais
      par-dessus des données vivantes.
    - Notez combien de temps a pris l'exercice : c'est votre vrai délai
      de reprise.
    - La base : sauvegarder un export (pg_dump), fait avant le passage de
      la sauvegarde.

    DOCUMENTATION
    - restic, restaurer : https://restic.readthedocs.io/en/stable/050_restore.html
    - restic, vérifier : https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency
    - sha256sum : https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html
    - PostgreSQL, sauvegarde et restauration : https://www.postgresql.org/docs/current/backup-dump.html
