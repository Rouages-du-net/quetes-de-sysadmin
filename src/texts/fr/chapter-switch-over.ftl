### Histoire « Le vieux Soleil », chapitre « Vérifier, puis basculer » :
### pointer le catalogue vers le nouveau serveur, et garder l'ancien figé.
### Les commandes, chemins et réglages ne sont pas traduits.

chapter-switch-over = Vérifier, puis basculer
    .summary = Vérifier que les deux bases sont d'accord, pointer le catalogue vers greenhouse, et garder l'ancienne figée plutôt qu'effacée, jusqu'à ce que la nouvelle ait fait ses preuves.

## Fichiers

switch-over-email-inaya =
    De :  Inaya
    À :   toi

    Le guichet des prêts rouvre demain. Mon neveu a ouvert le PostgreSQL de
    greenhouse à herbier (listen_addresses et pg_hba.conf, dit-il). Les
    réglages du catalogue sont dans /etc/opt/seed-catalogue/catalogue.ini.

    Odette demande une seule chose : « ne jette pas l'ancien tout de
    suite ».

    Inaya

switch-over-migration =
    # Déménager le catalogue d'herbier

    ## Fait
    - Instantané : data/postgres@before-migration.
    - Sauvegarde (LATIN1) restaurée sur greenhouse (UTF8), accents vérifiés.

    ## Reste à faire
    - Vérifier : les mêmes nombres de lignes des deux côtés.
    - Pointer le catalogue vers greenhouse, et le relancer.
    - L'ancienne base : la garder, mais s'assurer que plus rien n'y écrit.

## Événements

switch-over-event-counted =
    Compté sur greenhouse. La même requête sur herbier devrait donner les
    mêmes nombres : c'est la preuve, avant que quiconque écrive dans la
    nouvelle.
switch-over-event-still-old =
    Le catalogue tourne de nouveau… mais toujours sur la base d'herbier
    (db_host = localhost) : les nouveaux prêts iraient sur l'ancienne
    machine. Modifie catalogue.ini, puis relance-le (svcadm restart).
switch-over-event-online =
    Le catalogue est en ligne, et écrit sur greenhouse.
switch-over-event-frozen =
    On ne peut plus écrire dans l'ancienne base : si quelque chose la vise
    encore, ça échouera bruyamment plutôt que de remplir discrètement la
    mauvaise base.
switch-over-event-not-kept =
    Attention : les anciennes données ou leur instantané ont disparu. Tant
    que le nouveau serveur n'a pas fait ses preuves (quelques semaines
    d'usage, une sauvegarde restaurée), l'ancienne machine est le chemin du
    retour.
switch-over-event-uncounted =
    Le catalogue écrit maintenant sur greenhouse, et l'ancienne base est
    figée. Mais personne n'a vérifié que greenhouse a toutes les lignes :
    compte-les là-bas (SELECT count(*)), la preuve qu'il faut à Inaya avant
    de rouvrir le guichet.
switch-over-event-end =
    Inaya : « Premier prêt sur le nouveau serveur : Bean 'Mère Hélène', pour
    Zoë. Et le Sun est toujours dans le placard, tranquille, au cas où. »

    Bravo ! Tu as terminé le chapitre « Vérifier, puis basculer » et
    l'histoire « Le vieux Soleil ».

    CE QUI S'EST PASSÉ
    Tu as vérifié que les deux bases sont d'accord, pointé le catalogue vers
    greenhouse et relancé, et figé l'ancienne base sans l'effacer. Si
    quelque chose tourne mal dans les semaines qui viennent, le chemin du
    retour est toujours là : les données d'herbier, leur instantané ZFS, et
    les notes d'Odette.

    BONNE PRATIQUE
    - Vérifier avant de basculer : les nombres de lignes des deux côtés,
      quelques lignes à la main.
    - Basculer en un seul endroit (la configuration de l'application), puis
      relancer ce qui la lit.
    - Figer l'ancien système plutôt que l'effacer : en lecture seule
      (default_transaction_read_only) ou arrêté, mais gardé.
    - Décider à l'avance quand l'ancienne machine partira vraiment : après
      la première sauvegarde restaurée du nouveau, par exemple.

    UNE AUTRE FAÇON DE FAIRE
    Un nom DNS pour la base (db.seeds.internal) permettrait de basculer en
    changeant un seul enregistrement, sans toucher à l'application. Pour un
    service qui ne peut pas s'arrêter, la réplication logique recopie les
    changements en continu jusqu'à la bascule.

    DOCUMENTATION
    - default_transaction_read_only : https://www.postgresql.org/docs/16/runtime-config-client.html
    - svcadm(1M) : https://docs.oracle.com/cd/E26505_01/html/816-5166/svcadm-1m.html
