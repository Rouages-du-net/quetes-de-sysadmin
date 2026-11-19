### What the chapters of "The Pantry" share: the files of the community
### grocery (no real person: households are codes), the database dump,
### the comments of the cron jobs and of the nightly script. Column names,
### commands and paths are not translated.

pantry-families-csv =
    code,district,people,since,notes
    H-0102,North,4,2027-09-14,infant formula
    H-0117,North,2,2027-11-02,
    H-0123,Riverside,5,2028-01-09,no pork
    H-0131,Station,1,2028-03-21,diabetic
    H-0144,Riverside,3,2028-06-30,
    H-0152,North,6,2028-10-12,gluten free
    H-0158,Station,2,2029-01-25,
pantry-families-new-1 =
    H-0161,Riverside,3,2029-03-05,vegetarian
pantry-families-new-2 =
    H-0163,North,2,2029-03-14,
pantry-stock-csv =
    item,unit,quantity,best_before
    rice,kg,84,2030-01-31
    lentils,kg,41,2029-11-30
    pasta,kg,66,2030-04-30
    tinned tomatoes,tin,120,2030-06-30
    infant formula,box,9,2029-08-31
    olive oil,litre,22,2030-02-28
pantry-stock-csv-2 =
    item,unit,quantity,best_before
    rice,kg,71,2030-01-31
    lentils,kg,35,2029-11-30
    pasta,kg,58,2030-04-30
    tinned tomatoes,tin,104,2030-06-30
    infant formula,box,14,2029-08-31
    olive oil,litre,19,2030-02-28
pantry-volunteers-csv =
    first_name,role,shift
    Fatou,coordinator,mon wed fri
    Joaquín,logistics,fri sat
    Mei,treasurer,wed
    Noor,it,sat
    Ilse,reception,mon thu
    Tavita,reception,tue sat

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

pantry-cron-dump-comment = The app's database, dumped every night (visits, appointments).
pantry-cron-backup-comment = The nightly backup to the offsite disk (Noor, 5 March).
