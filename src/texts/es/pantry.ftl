### Lo que comparten los capítulos de «La Despensa»: los archivos de la
### tienda solidaria (ninguna persona real: los hogares son códigos), el
### volcado de la base de datos, los comentarios de las tareas cron. Los
### nombres de columna, los comandos y las rutas no se traducen.

pantry-families-csv =
    code,barrio,personas,desde,notas
    H-0102,Norte,4,2027-09-14,leche infantil
    H-0117,Norte,2,2027-11-02,
    H-0123,Ribera,5,2028-01-09,sin cerdo
    H-0131,Estacion,1,2028-03-21,diabetes
    H-0144,Ribera,3,2028-06-30,
    H-0152,Norte,6,2028-10-12,sin gluten
    H-0158,Estacion,2,2029-01-25,
pantry-families-new-1 =
    H-0161,Ribera,3,2029-03-05,vegetariana
pantry-families-new-2 =
    H-0163,Norte,2,2029-03-14,
pantry-stock-csv =
    articulo,unidad,cantidad,consumo_preferente
    arroz,kg,84,2030-01-31
    lentejas,kg,41,2029-11-30
    pasta,kg,66,2030-04-30
    tomate en lata,lata,120,2030-06-30
    leche infantil,caja,9,2029-08-31
    aceite de oliva,litro,22,2030-02-28
pantry-stock-csv-2 =
    articulo,unidad,cantidad,consumo_preferente
    arroz,kg,71,2030-01-31
    lentejas,kg,35,2029-11-30
    pasta,kg,58,2030-04-30
    tomate en lata,lata,104,2030-06-30
    leche infantil,caja,14,2029-08-31
    aceite de oliva,litro,19,2030-02-28
pantry-volunteers-csv =
    nombre,funcion,turnos
    Fatou,coordinacion,lun mie vie
    Joaquín,logistica,vie sab
    Mei,tesoreria,mie
    Noor,informatica,sab
    Ilse,acogida,lun jue
    Tavita,acogida,mar sab

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

pantry-cron-dump-comment = La base de datos de la aplicación, volcada cada noche (visitas, citas).
pantry-cron-backup-comment = La copia nocturna al disco externo (Noor, 5 de marzo).
