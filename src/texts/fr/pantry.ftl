### Ce que partagent les chapitres de « L'Épicerie solidaire » : les
### fichiers de l'épicerie (aucune personne réelle : les foyers sont des
### codes), la sauvegarde de la base, les commentaires des tâches cron.
### Les noms de colonnes, les commandes et les chemins ne sont pas traduits.

pantry-families-csv =
    code,quartier,personnes,depuis,notes
    H-0102,Nord,4,2027-09-14,lait infantile
    H-0117,Nord,2,2027-11-02,
    H-0123,Rivière,5,2028-01-09,sans porc
    H-0131,Gare,1,2028-03-21,diabétique
    H-0144,Rivière,3,2028-06-30,
    H-0152,Nord,6,2028-10-12,sans gluten
    H-0158,Gare,2,2029-01-25,
pantry-families-new-1 =
    H-0161,Rivière,3,2029-03-05,végétarien
pantry-families-new-2 =
    H-0163,Nord,2,2029-03-14,
pantry-stock-csv =
    article,unite,quantite,dluo
    riz,kg,84,2030-01-31
    lentilles,kg,41,2029-11-30
    pâtes,kg,66,2030-04-30
    tomates en boîte,boîte,120,2030-06-30
    lait infantile,boîte,9,2029-08-31
    huile d'olive,litre,22,2030-02-28
pantry-stock-csv-2 =
    article,unite,quantite,dluo
    riz,kg,71,2030-01-31
    lentilles,kg,35,2029-11-30
    pâtes,kg,58,2030-04-30
    tomates en boîte,boîte,104,2030-06-30
    lait infantile,boîte,14,2029-08-31
    huile d'olive,litre,19,2030-02-28
pantry-volunteers-csv =
    prenom,role,permanences
    Fatou,coordination,lun mer ven
    Joaquín,logistique,ven sam
    Mei,trésorerie,mer
    Noor,informatique,sam
    Ilse,accueil,lun jeu
    Tavita,accueil,mar sam

pantry-dump-sql =
    --
    -- PostgreSQL database dump
    --
    -- Dumped from database version 15.10 (Debian 15.10-0+deb12u1)
    --
    CREATE TABLE public.visits (id integer NOT NULL, household text NOT NULL, visited date NOT NULL, parcels integer NOT NULL);
    CREATE TABLE public.appointments (id integer NOT NULL, household text NOT NULL, slot timestamp without time zone NOT NULL);
    COPY public.visits (id, household, visited, parcels) FROM stdin;
    4411	H-0102	2029-03-14	2
    4412	H-0123	2029-03-14	3
    4413	H-0161	2029-03-15	2
    \.
    --
    -- PostgreSQL database dump complete
    --

pantry-cron-dump-comment = La base de l'appli, sauvegardée chaque nuit (passages, rendez-vous).
pantry-cron-backup-comment = La sauvegarde de nuit vers le disque externe (Noor, 5 mars).
