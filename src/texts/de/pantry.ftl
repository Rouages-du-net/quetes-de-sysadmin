### Was die Kapitel von „Die Vorratskammer“ gemeinsam nutzen: die Dateien
### der Lebensmittelausgabe (keine echte Person: Haushalte sind Codes), der
### Dump der Datenbank, die Kommentare der cron-Jobs und des nächtlichen
### Skripts. Befehle und Pfade werden nicht übersetzt; die Spaltennamen
### ohne Umlaute, wie man sie tippt.

pantry-families-csv =
    code,viertel,personen,seit,notizen
    H-0102,Nord,4,2027-09-14,Säuglingsnahrung
    H-0117,Nord,2,2027-11-02,
    H-0123,Flussufer,5,2028-01-09,kein Schweinefleisch
    H-0131,Bahnhof,1,2028-03-21,Diabetes
    H-0144,Flussufer,3,2028-06-30,
    H-0152,Nord,6,2028-10-12,glutenfrei
    H-0158,Bahnhof,2,2029-01-25,
pantry-families-new-1 =
    H-0161,Flussufer,3,2029-03-05,vegetarisch
pantry-families-new-2 =
    H-0163,Nord,2,2029-03-14,
pantry-stock-csv =
    artikel,einheit,menge,mhd
    Reis,kg,84,2030-01-31
    Linsen,kg,41,2029-11-30
    Nudeln,kg,66,2030-04-30
    Dosentomaten,Dose,120,2030-06-30
    Säuglingsnahrung,Packung,9,2029-08-31
    Olivenöl,Liter,22,2030-02-28
pantry-stock-csv-2 =
    artikel,einheit,menge,mhd
    Reis,kg,71,2030-01-31
    Linsen,kg,35,2029-11-30
    Nudeln,kg,58,2030-04-30
    Dosentomaten,Dose,104,2030-06-30
    Säuglingsnahrung,Packung,14,2029-08-31
    Olivenöl,Liter,19,2030-02-28
pantry-volunteers-csv =
    vorname,rolle,schicht
    Fatou,Koordination,Mo Mi Fr
    Joaquín,Logistik,Fr Sa
    Mei,Kasse,Mi
    Noor,IT,Sa
    Ilse,Empfang,Mo Do
    Tavita,Empfang,Di Sa

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

pantry-cron-dump-comment = Die Datenbank der App, jede Nacht gedumpt (Besuche, Termine).
pantry-cron-backup-comment = Das nächtliche Backup auf die externe Platte (Noor, 5. März).
