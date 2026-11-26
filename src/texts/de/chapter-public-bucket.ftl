### Geschichte „Die Tanzgruppe“, Kapitel „Der öffentliche Bucket“: Die
### Dokumente der Mitglieder wurden mit der Website veröffentlicht, aus
### demselben Garage-Bucket. Buckets, Website-Zugriff, Schlüssel und ihre
### Rechte, aws s3 mv, curl. Befehle, Optionen, Pfade, Bucket- und
### Schlüsselnamen und Ausgaben werden nicht übersetzt.

chapter-public-bucket = Der öffentliche Bucket
    .summary = Ein Vater hat die Liste der medizinischen Notfallkontakte der Gruppe über eine Websuche gefunden. Die Website und die Dokumente der Mitglieder teilen sich einen Bucket im Objektspeicher der Gruppe: Trenne sie, prüfe von außen, und gib jedem Werkzeug einen Schlüssel, der nur öffnet, was es braucht.

## Files

public-bucket-message-esperanza =
    Von: Esperanza (künstlerische Leitung, Kestrel Dance Company)
    Dienstag, 9. März, 9:20

    Hallo, und danke, dass du so schnell gekommen bist.

    Gestern Abend hat mich der Vater einer unserer jungen Tänzerinnen
    angerufen: Als er unsere Kurszeiten suchte, hat er eine Liste mit den
    Notfallkontakten und medizinischen Hinweisen der Kinder gefunden, unter
    der Adresse unserer Website. Ich habe es selbst probiert:
    https://www.kestrel.example/members/medical-contacts-2032.csv öffnet
    sich für alle.

    Unsere Dateien liegen auf kulissen, wo du gerade bist (sudo geht mit
    deinem Passwort), und auf den zwei anderen Maschinen dessen, was Teodora
    „den Cluster“ nannte. Teodora hat alles eingerichtet, bevor sie
    weggezogen ist, und hat Notizen hinterlassen. Hiroshi, der die Website
    gemacht hat, veröffentlicht sie mit einem kleinen Skript.

    Bitte mach diese Dokumente wieder privat, ohne eines davon zu verlieren:
    Der Vorstand braucht sie. Und die Website muss online bleiben, darüber
    laufen die Tickets für die Frühlingsgala.

    Esperanza

public-bucket-notes-teodora =
    Notizen von Teodora (kulissen, 2029, seitdem ein paar Aktualisierungen)

    - Unsere Dateien liegen in Garage, einem Objektspeicher mit S3-API, auf
      drei Knoten: kulissen (hier, das Studio), vault (im Theater Old Mill,
      es hat Glasfaser) und porch (bei Siosaia). Jedes Objekt wird auf allen
      dreien gespeichert. sudo garage status zeigt sie.
    - Garage bewahrt Objekte in Buckets auf. sudo garage bucket list, sudo
      garage bucket info NAME (was er enthält, Website-Zugriff, welche
      Schlüssel ihn benutzen dürfen).
    - Ein Programm erreicht Garage mit einem Zugriffsschlüssel (eine ID, die
      mit GK beginnt, und ein Secret). Jeder Schlüssel hat Rechte pro
      Bucket: read, write, owner. sudo garage key list, sudo garage key
      info NAME.
    - Die Website ist der Bucket www.kestrel.example, mit
      „Website-Zugriff“: Der Web-Endpunkt von Garage liefert ihn an alle
      aus, ohne Schlüssel. Die S3-API selbst antwortet nie ohne Schlüssel.
    - Clients: das Kommandozeilenwerkzeug von AWS (aws s3 ls, aws s3 cp…;
      seine Schlüssel in ~/.aws/credentials, sein Endpunkt und seine Region
      in ~/.aws/config) und rclone (das Backup des Büros:
      /etc/rclone/office.conf, jede Nacht von office-backup.timer
      ausgeführt).
    - Ich habe allem den Schlüssel troupe-admin gegeben. Das ist einfacher.

## Events

public-bucket-event-exposed =
    Alle können sie lesen: kein Schlüssel, kein Passwort. Bevor du etwas
    änderst, finde heraus, warum Garage diese Datei ausliefert. In welchem
    Bucket liegt sie, und was erlaubt dem Web-Endpunkt, diesen Bucket der
    Welt auszuliefern?

public-bucket-event-website =
    Das ist es: www.kestrel.example hat Website-Zugriff, und damit liefert
    der Web-Endpunkt von Garage jedes Objekt des Buckets aus, unter jedem
    Pfad, an alle. Die Website und die Dokumente der Mitglieder teilen sich
    diesen Bucket. Website-Zugriff gilt ganz oder gar nicht, für einen
    ganzen Bucket: Die Dokumente brauchen einen eigenen Bucket, ohne ihn.

public-bucket-event-deleted =
    Ein Dokument der Mitglieder ist aus allen Buckets verschwunden. Der
    Vorstand braucht sie, und Garage bewahrt keine ältere Version eines
    Objekts auf (es hat keine Versionierung): Starte das Kapitel neu (oder
    nimm den Rettungs-Snapshot). Verschieb die Dokumente in einen privaten
    Bucket, statt sie zu löschen.

public-bucket-event-site-down =
    Die Website antwortet nicht mehr: www.kestrel.example muss seinen
    Website-Zugriff und seine index.html behalten, dort werden die Tickets
    für die Gala verkauft. Die Dokumente verlassen den Bucket; die Website
    bleibt.

public-bucket-event-moved =
    Die Dokumente der Mitglieder liegen jetzt nur noch in Buckets ohne
    Website-Zugriff: Der Web-Endpunkt liefert sie nicht aus, und die S3-API
    antwortet nur mit einem Schlüssel, der ein Recht auf ihren Bucket hat.
    Prüf es von außen, so wie der Vater sie gefunden hat.

public-bucket-event-closed =
    Die öffentliche Adresse des Dokuments antwortet jetzt mit 404: Der
    Web-Endpunkt findet es nicht mehr. Suchmaschinen werden den Link
    verwerfen. Jetzt die andere Hälfte des Problems: Ein Schlüssel öffnet
    alles, und zwei Skripte tragen ihn mit sich.

public-bucket-event-too-wide =
    Dieser Schlüssel kann mehr als seine Aufgabe: owner-Rechte (er könnte den
    Website-Zugriff des Buckets ändern oder ihn löschen), das Recht, Buckets
    anzulegen, oder Rechte auf andere Buckets. Wenn die Maschine des
    Deploy-Skripts oder die Konfiguration des Backups durchsickert, sickert
    dieser Schlüssel mit durch. Gib jedem Werkzeug read und write auf seinem
    eigenen Bucket, sonst nichts.

public-bucket-event-deploy-key =
    Das Deployment der Website benutzt jetzt einen eigenen Schlüssel: read
    und write auf www.kestrel.example, sonst nichts, und es funktioniert.

public-bucket-event-backup-key =
    Das Backup des Büros benutzt jetzt einen eigenen Schlüssel: read und
    write auf backups, sonst nichts, und es erreicht seinen Bucket.

public-bucket-event-end =
    Esperanza: „Die Liste öffnet sich nicht mehr, und die Website ist noch
    da. Ich rufe den Vater zurück. Danke!“

    Gut gemacht! Du hast „Der öffentliche Bucket“ abgeschlossen.

    WAS PASSIERT IST
    Die Website war ein Garage-Bucket mit Website-Zugriff, und die Dokumente
    der Mitglieder waren in denselben Bucket gelegt worden, unter members/.
    Website-Zugriff lässt den Web-Endpunkt von Garage jedes Objekt des
    Buckets an alle ausliefern: Die Dokumente waren öffentlich, und eine
    Suchmaschine hatte sie gefunden. Und ein einziger Schlüssel, mit allen
    Rechten auf allen Buckets, wurde vom Deploy-Skript und vom Backup des
    Büros benutzt. Du hast die Dokumente in einen privaten Bucket
    verschoben, ihre alte Adresse von außen geprüft und jedem Werkzeug einen
    eigenen Schlüssel mit nur dem gegeben, was es braucht.

    GUTE PRAXIS
    - Ein Bucket pro Zweck und Publikum: was öffentlich ist, in einem
      eigenen Bucket, nie neben privaten Dateien. Ein Präfix („Ordner“) ist
      keine Grenze: Website-Zugriff und Rechte gelten pro Bucket.
    - Prüfe von außen (curl, ein privates Fenster): Was der Web-Endpunkt
      ausliefert, sieht die Welt.
    - Ein Schlüssel pro Programm, mit den geringsten Rechten: read und write
      auf seinem Bucket, kein owner-Bit, kein anderer Bucket. Ein
      Admin-Schlüssel bleibt bei den Admins, nicht in Skripten.
    - Ein durchgesickerter Schlüssel wird gelöscht (garage key delete), nicht
      nur in einer Datei ersetzt. Garage hat keine Versionierung: Ein
      gelöschtes Objekt ist weg, also denk vor rm nach, und halte Backups.
    - Dokumente, die eine Weile öffentlich waren, könnten kopiert worden
      sein: Informiere die betroffenen Personen, wie es das
      Datenschutzrecht meist verlangt.

    EIN ANDERER WEG
    Die Gruppe benutzt Garage, einen kleinen geoverteilten S3-Server, den
    der gemeinnützige Verein Deuxfleurs für Self-Hosting geschrieben hat.
    MinIO ist die bekannteste Alternative, aber seine Community-Edition hat
    2025 ihre Admin-Konsole verloren und wird jetzt nur noch als Quellcode
    verteilt. Mit MinIO oder Amazon S3 kann ein Bucket auch über eine
    Bucket-Policy oder ACLs öffentlich gemacht werden, die Garage nicht
    implementiert: Website-Zugriff ist seine einzige öffentliche Tür.

    DOKUMENTATION
    - Garage, Websites bereitstellen: https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites/
    - Garage, Buckets und Schlüssel: https://garagehq.deuxfleurs.fr/documentation/quick-start/
    - Die S3-Kompatibilität von Garage: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
    - aws s3 mv: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/mv.html
    - Die Konfigurationsdateien der AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

## What the three chapters share, kept here so that it loads with the
## story: the troupe's website, the members' documents (invented people;
## the phone numbers are in the UK's range reserved for fiction), the
## office share's files.

troupe-site-index =
    <!doctype html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <header><h1>Kestrel Dance Company</h1><nav><a href="/">Start</a><a href="/classes.html">Kurse</a><a href="/agenda.html">Termine</a></nav></header>
    <main>
    <p>Eine Tanzgruppe für die Nachbarschaft: Kurse für jedes Alter, von 4 bis 84, und eine Frühlingsgala auf der Bühne des Old Mill.</p>
    <p><img src="/images/gala-2031.jpg" alt="Die Gala 2031: vierzig Tänzerinnen und Tänzer auf der Bühne"></p>
    <p>Frühlingsgala, Samstag, 1. Mai: Tickets im Studio und auf dieser Website.</p>
    </main>
    </body>
    </html>
troupe-site-agenda =
    <!doctype html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Termine, Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <main>
    <h1>Termine</h1>
    <ul>
    <li>13. März: offener Kurs für Anfänger·innen</li>
    <li>3. April: Beginn der Proben im Old Mill</li>
    <li>1. Mai: Frühlingsgala</li>
    </ul>
    </main>
    </body>
    </html>
troupe-site-classes =
    <!doctype html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Kurse, Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <main>
    <h1>Kurse</h1>
    <p>Kleine Hüpfer (4-7): Mittwoch 16:30. Jugendliche: Mittwoch 18:00. Zeitgenössisch, Erwachsene: Donnerstag 19:30. Sanfte Bewegung, ab 60: Freitag 10:00.</p>
    </main>
    </body>
    </html>
troupe-site-404 =
    <!doctype html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Nicht gefunden</title></head>
    <body><main><h1>Diese Seite gibt es nicht</h1><p><a href="/">Zurück zur Startseite</a></p></main></body>
    </html>

troupe-doc-register =
    mitglied,gruppe,eintritt,beitrag_bezahlt
    Ayo Bankole,Jugendliche,2029-09,ja
    Ilka Carvalho,Erwachsene,2031-01,ja
    Kalani Akana,Kleine Hüpfer,2031-09,nein
    Rasmus Ekholm,Sanfte Bewegung,2030-02,ja
    Wren Okonkwo,Jugendliche,2032-01,ja
troupe-doc-medical =
    tänzer·in,gruppe,notfallkontakt,telefon,medizinische hinweise
    Kalani Akana,Kleine Hüpfer,Malia Akana (Mutter),07700 900127,Asthma (Inhalator in der Tasche)
    Ayo Bankole,Jugendliche,Folasade Bankole (Tante),07700 900341,keine
    Wren Okonkwo,Jugendliche,Chidi Okonkwo (Vater),07700 900562,Nussallergie
    Rasmus Ekholm,Sanfte Bewegung,Saga Ekholm (Tochter),07700 900718,Knieprothese 2030
troupe-doc-minutes =
    Vorstandssitzung, 24. Februar 2032 (Protokoll)
    Anwesend: Esperanza, Anahera, Linh, Farrukh, Siosaia.
    1. Finanzen: Der Zuschuss des Kulturrats ist eingegangen; der Bericht 2031 ist bis zum 15. April fällig.
    2. Gala: Das Old Mill ist für den 1. Mai gebucht; Farrukh filmt.
    3. Beiträge: Zwei Familien haben den ermäßigten Beitrag beantragt, bewilligt.
troupe-doc-consent =
    mitglied,fotos auf der website,fotos in der presse
    Ayo Bankole,ja,nein
    Ilka Carvalho,ja,ja
    Kalani Akana,nein,nein
    Rasmus Ekholm,ja,ja
    Wren Okonkwo,ja,nein

troupe-office-report =
    Kulturrat: Tätigkeitsbericht 2031, Kestrel Dance Company
    1. Kurse: 6 wöchentliche Kurse, 112 Mitglieder (31 unter 12, 27 über 60).
    2. Frühlingsgala 2031: 2 Vorstellungen, 640 Tickets, 14 Freiplätze für Familien aus dem Viertel.
    3. Öffentlichkeitsarbeit: 9 Workshops in zwei Grundschulen und der Tagesstätte.
    4. Finanzen: Zuschuss von 6.000 für den Boden des Studios und das Licht der Gala ausgegeben (Einzelheiten in budget-2032.csv).
    Verfasst von Anahera, Kassenwartin.
troupe-office-report-template =
    Kulturrat: Tätigkeitsbericht (VORLAGE)
    1. Kurse: [Anzahl der Kurse, Mitglieder]
    2. Vorstellungen: [Daten, Tickets]
    3. Öffentlichkeitsarbeit: [Workshops]
    4. Finanzen: [wofür der Zuschuss ausgegeben wurde]
troupe-office-budget =
    posten,2031,2032 (geplant)
    miete studio,7200,7400
    lehrkräfte,9800,10200
    gala (saal und licht),2650,2800
    bodenreparatur,3100,0
troupe-office-schedule =
    Frühlingsproben, Old Mill
    Samstags vom 3. bis 24. April, 10:00-13:00: alle Gruppen.
    Mittwoch, 28. April, 18:00: Generalprobe.
troupe-office-hall =
    An das Theater Old Mill: Wir bestätigen die Buchung des großen Saals für
    Samstag, den 1. Mai 2032, von 9:00 bis 23:00, für unsere Frühlingsgala.
troupe-office-running-order =
    Ablauf der Gala (Entwurf 3)
    1. Kleine Hüpfer: Das Nest des Falken
    2. Jugendliche: Kreuzungen
    3. Sanfte Bewegung: Tee um vier
    4. Erwachsene: Gezeiten
    5. Alle: Finale
troupe-office-thanks =
    Liebe Freundinnen und Freunde der Bäckerei in der Mill Lane, danke für
    die Kuchen bei jeder Probe: Die Tänzerinnen und Tänzer schicken euch
    ihren herzlichsten Dank.
troupe-office-joiners =
    name,gruppe,beginn
    Noa Benali,Jugendliche,2032-04
    Bea Ferreira,Erwachsene,2032-04
troupe-office-old-plan =
    Winterplan (abgesagt): Proben im Januar im Gemeindesaal der Kirche.
