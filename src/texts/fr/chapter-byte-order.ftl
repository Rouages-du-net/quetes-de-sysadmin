### Histoire « Le vieux Soleil », chapitre « Les octets à l'envers » :
### déménager la base vers greenhouse avec une sauvegarde logique, pas ses
### fichiers de données, en faisant attention au jeu de caractères. Les
### commandes, chemins et messages ne sont pas traduits.

chapter-byte-order = Les octets à l'envers
    .summary = Déménager la base du catalogue vers le nouveau serveur : le tar des fichiers de données d'Odette n'y démarre pas, une sauvegarde logique si ; arrêter d'abord ce qui écrit, et faire attention aux accents.

## Fichiers

byte-order-email-inaya =
    De :  Inaya
    À :   toi

    J'ai appelé Odette. Elle dit que c'est facile : « copie le tar de la
    semaine sur le nouveau serveur et démarre PostgreSQL dessus, c'est ce
    que j'ai fait quand on a changé les disques ». Le guichet des prêts est
    fermé jusqu'à jeudi, on peut donc arrêter le catalogue d'ici là.

    greenhouse est joignable depuis herbier (ssh greenhouse, ta clé y est
    déjà).

    Inaya

byte-order-migration =
    # Déménager le catalogue d'herbier

    ## Le service de la base (son nom SMF)
    svc:/application/database/postgresql_84:default_64bit, et le
    catalogue : svc:/site/seed-catalogue:default.

    ## Où vivent ses données (répertoire, jeu de données ZFS)
    /var/postgres/8.4/data_64, sur data/postgres.

    ## La base (nom, version de PostgreSQL, jeu de caractères)
    seeds, PostgreSQL 8.4, LATIN1. herbier est un SPARC (gros-boutiste).

    ## Avant de toucher à quoi que ce soit
    data/postgres@before-migration (zfs snapshot).

## Événements

byte-order-event-incompatible =
    Il ne démarre pas : ces fichiers ont été écrits par PostgreSQL 8.4, et
    greenhouse fait tourner la 16. Même avec la même version, ils ne
    conviendraient pas : le SPARC écrit ses nombres en gros-boutiste, le x86
    en petit-boutiste, et un répertoire de données, c'est la mémoire du
    serveur posée sur le disque, ordre des octets compris. Et un tar pris
    pendant que le serveur tournait n'est même pas cohérent. Ce qui voyage
    entre versions et machines, c'est une sauvegarde logique : du texte SQL
    (pg_dump).
byte-order-event-stopped =
    Le catalogue est arrêté : plus personne ne peut enregistrer de prêt
    pendant la copie. Une sauvegarde logique est cohérente avec elle-même,
    mais ce qui est écrit après elle serait perdu sur le nouveau serveur.
byte-order-event-replacement =
    Des � à la place des accents : la sauvegarde est en LATIN1 (un octet par
    lettre accentuée), et le terminal de greenhouse lit de l'UTF-8. Le
    fichier n'est pas abîmé : ses premières lignes disent SET
    client_encoding = 'LATIN1', et psql le convertira à la restauration.
byte-order-event-invalid =
    « invalid byte sequence for encoding UTF8 » : les octets du fichier sont
    en LATIN1, mais il se dit maintenant en UTF-8. Le fichier et son SET
    client_encoding doivent être d'accord.
byte-order-event-mojibake =
    CrimÃ©e au lieu de Crimée : les accents ont été convertis deux fois. Le
    fichier a été converti en UTF-8 (iconv), mais dit toujours SET
    client_encoding = 'LATIN1', donc PostgreSQL a converti chaque octet une
    seconde fois. Supprime la base (dropdb), et restaure la sauvegarde
    d'origine telle quelle, ou corrige aussi sa ligne SET client_encoding.
byte-order-event-missing-rows =
    greenhouse n'a pas toutes les lignes d'herbier : des prêts ont été
    enregistrés après la sauvegarde. Arrête d'abord le catalogue, refais la
    sauvegarde, et restaure-la dans une base vide.
byte-order-event-restored =
    La base seeds existe sur greenhouse, avec ses trois tables.
byte-order-event-end =
    Inaya : « J'ai ouvert le catalogue sur greenhouse : Tomato 'Noire de
    Crimée' a tous ses accents ! Et les prêts sont tous là. »

    Bravo ! Tu as terminé le chapitre « Les octets à l'envers ».

    CE QUI S'EST PASSÉ
    Le tar d'Odette contient les fichiers de données d'un PostgreSQL 8.4
    qui tourne sur SPARC : une autre version, et un autre ordre des octets
    que le x86 de greenhouse. Les fichiers de données ne voyagent pas ; une
    sauvegarde logique, si. Avec le catalogue arrêté, la sauvegarde contient
    tout ; restaurée avec psql, son SET client_encoding = 'LATIN1' a dit à
    PostgreSQL comment lire les accents, et il les a rangés en UTF-8.

    BONNE PRATIQUE
    - Déménager une base entre versions ou machines avec une sauvegarde
      logique (pg_dump), jamais en copiant ses fichiers.
    - Arrêter ce qui écrit avant la sauvegarde sur laquelle on va basculer.
    - Faire attention au jeu de caractères : un fichier et l'encodage qu'il
      déclare doivent être d'accord. file et head disent lequel ; sur un
      terminal UTF-8, le LATIN1 s'affiche en �, et ce n'est pas un dégât.
    - Vérifier après la restauration : les nombres de lignes, et quelques
      lignes avec des accents.

    UNE AUTRE FAÇON DE FAIRE
    pg_dump -E UTF8 convertit pendant la sauvegarde. Pour une grosse base,
    pg_dump -Fc (format personnalisé) avec pg_restore -j restaure en
    parallèle. Entre deux machines de même version et même architecture, la
    réplication (streaming, ou pg_upgrade pour les versions) évite un long
    arrêt.

    DOCUMENTATION
    - Mettre à jour un cluster PostgreSQL : https://www.postgresql.org/docs/16/upgrading.html
    - pg_dump : https://www.postgresql.org/docs/16/app-pgdump.html
    - Les jeux de caractères : https://www.postgresql.org/docs/16/multibyte.html
