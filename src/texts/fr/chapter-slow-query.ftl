### Histoire « Le Théâtre », chapitre 2 « La Requête lente » : EXPLAIN, un
### parcours séquentiel, CREATE INDEX. Le SQL, les chemins et les sorties
### des outils ne sont pas traduits.

chapter-slow-query = La Requête lente
    .summary = Le plan de salle met cinq secondes à s'afficher, pour chaque spectacle. PostgreSQL note la requête lente ; demande-lui comment il l'exécute, et donne-lui un raccourci.

## Fichiers

slow-query-message-camille =
    De :     Camille
    À :      toi
    Objet :  Le plan de salle est si lent

    Bonjour,

    Merci encore pour la première ! Maintenant, c'est le plan de salle
    qui est très lent : cinq secondes avant que les places s'affichent,
    pour chaque spectacle. C'était instantané à l'ouverture du théâtre.
    Pour le chronométrer :
      curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:3000/shows/42/seats

    La table bookings garde toutes les places vendues depuis l'ouverture
    du théâtre. Je ne veux pas effacer notre histoire.

    Même mot de passe sudo : rideau-2028.

    Camille

## Évènements

slow-query-event-slow =
    4812 ms pour une seule requête : SELECT seat, status FROM bookings
    WHERE show_id = 42. PostgreSQL note toute requête de plus d'1 s
    (log_min_duration_statement dans postgresql.conf). Comment
    l'exécute-t-il ? (man psql : EXPLAIN)
slow-query-event-seqscan =
    Seq Scan on bookings : pour trouver les 380 places du spectacle 42,
    PostgreSQL lit toute la table, les 480 000 lignes (avec deux
    processus en parallèle, mais quand même). « Rows Removed by Filter »
    dans EXPLAIN ANALYZE dit combien il en a lu pour rien. Une table des
    matières pour show_id lui permettrait d'aller droit aux bonnes lignes.
slow-query-event-wrong-column =
    Un index sur bookings, mais pas sur la colonne de la condition : la
    requête cherche show_id = 42, et EXPLAIN lit toujours toute la table.
    Un index aide les requêtes qui filtrent (ou trient) sur sa colonne.
slow-query-event-vacuum =
    VACUUM range les lignes mortes, ANALYZE rafraîchit les statistiques
    du planificateur : les deux sont sains, mais aucun ne crée de moyen
    de trouver les lignes d'un spectacle sans toutes les lire.
slow-query-event-end =
    Le plan de salle s'affiche de nouveau tout de suite : EXPLAIN utilise
    maintenant l'index { $index } (Index Scan), et lit 380 lignes au lieu
    de 480 000. Camille : « Et on garde toute notre histoire ! »

    Bravo ! Tu as terminé le chapitre « La Requête lente ».

    CE QUI S'EST PASSÉ
    La table bookings grandit à chaque spectacle. Sans index sur
    show_id, trouver les places d'un spectacle, c'est lire toutes les
    lignes : rien avec quelques milliers, cinq secondes avec 480 000.
    EXPLAIN le disait : Seq Scan, Filter, Rows Removed by Filter.

    L'INDEX
    Un index (un B-tree par défaut) est une copie triée d'une colonne,
    avec l'emplacement de chaque ligne : PostgreSQL trouve les lignes du
    spectacle 42 en quelques étapes, quelle que soit la taille de la
    table. Il prend de la place sur le disque et ralentit un peu chaque
    INSERT : on indexe les colonnes sur lesquelles les requêtes filtrent,
    pas toutes.

    BONNES PRATIQUES
    - Trouver les requêtes lentes : log_min_duration_statement (ou
      l'extension pg_stat_statements).
    - EXPLAIN montre le plan ; EXPLAIN ANALYZE l'exécute et ajoute les
      vrais temps.
    - Sur une table de production très sollicitée, CREATE INDEX
      CONCURRENTLY ne bloque pas les écritures pendant sa construction.

    DOCUMENTATION
    - EXPLAIN : https://www.postgresql.org/docs/16/using-explain.html
    - Les index : https://www.postgresql.org/docs/16/indexes-intro.html
    - CREATE INDEX : https://www.postgresql.org/docs/16/sql-createindex.html
