### Geschichte „Die Tanzgruppe“, Kapitel „Die große Datei“: eine
### vorsignierte URL für eine Woche mit einem eigenen Schlüssel, und ein
### ausgefallener Garage-Knoten, im Layout ersetzt. Befehle, Optionen, Pfade,
### Knoten-IDs und Ausgaben werden nicht übersetzt.

chapter-big-file = Die große Datei
    .summary = Ein Festival möchte den Film der Frühlingsgala, fast 4 GB, für eine Woche. Teile ihn, ohne den Bucket der Welt zu öffnen. Und eine der drei Maschinen, die die Dateien der Gruppe aufbewahren, ist gestorben: Sind die Daten sicher, und wie nimmt die neue Maschine ihren Platz ein?

## Files

big-file-message-farrukh =
    Von: Farrukh (Video)
    Donnerstag, 13. Mai, 10:05

    Hallo! Zuri, die das Festival Harbourlight produziert, möchte den ganzen
    Film unserer Frühlingsgala für ihr Auswahlkomitee: Es tagt nächste
    Woche. Die Datei liegt im Bucket media:
    videos/spring-gala-2032-full.mp4 (3,8 GB, viel zu groß für eine Mail).

    Sie muss sie mit einem einfachen Link herunterladen können, von ihrem
    Büro aus, eine Woche lang: kein Konto, keine Software. Kannst du den
    Link in ~/link_fuer_zuri.txt legen? Ich schicke ihn ihr dann.

    Ich würde den Bucket lieber nicht öffentlich machen: Unsere Proben sind
    auch darin.

    Farrukh

big-file-message-siosaia =
    Von: Siosaia
    Mittwoch, 12. Mai

    Hallo! Die Maschine, die porch bei mir zu Hause trägt, ist am
    Dienstagmorgen gestorben (die Platte, glaube ich: Sie klickt). Ich habe
    Garage auf meinem Ersatzrechner installiert, mit derselben garage.toml
    wie bei Teodora (dasselbe rpc_secret), und er ist verbunden: sudo
    garage status sollte ihn zeigen. Er hat eine 4-TB-Platte. Ich habe mich
    nicht getraut, das Layout anzufassen, Teodora sagte, das sei der
    gefährliche Teil. Sind unsere Daten noch sicher?

    Siosaia

big-file-notes-teodora =
    Notizen von Teodora (kulissen, der Cluster)

    - replication_factor = 3: Jedes Stück Daten liegt auf drei Knoten, einer
      pro Zone: studio (kulissen), mill (vault), home (porch). Garage braucht
      zwei Antworten von drei, um zu lesen oder zu schreiben (ein Quorum).
    - Das Layout ist, wer was speichert: die Rolle jedes Knotens (Zone,
      Kapazität). Änderungen werden zuerst vorgemerkt (garage layout assign,
      remove), mit garage layout show angezeigt und erst mit garage layout
      apply --version N angewendet.
    - Ein Knoten wird an seiner ID erkannt (eine lange Hexadezimalzeichenkette;
      ihre ersten Zeichen reichen auf der Kommandozeile), nicht an seinem
      Hostnamen.
    - Eine Datei teilen: aws s3 presign gibt einen mit einem Schlüssel
      signierten Link, der eine begrenzte Zeit funktioniert.

## Events

big-file-event-failed-node =
    porch ist ein ausgefallener Knoten: Er hat noch seine Rolle im Layout
    (Zone home), und Garage hat seit zwei Tagen nichts von ihm gehört. Die
    neue Maschine ist auch da, gesund, mit „NO ROLE ASSIGNED“: verbunden,
    aber sie speichert nichts. Wie viele Kopien hat jedes Stück Daten noch?

big-file-event-safe =
    Drei Kopien waren geplant, eine pro Zone; mit porch ausgefallen bleiben
    zwei, auf kulissen und vault. Garage liest und schreibt mit zwei
    Antworten von drei: Alles funktioniert noch. Aber noch ein Ausfall, und
    die Daten wären unerreichbar: Der neue Knoten sollte bald den Platz von
    porch einnehmen.

big-file-event-too-long =
    Garage lehnt diesen Link ab: „X-Amz-Expires may not exceed a week“. Eine
    vorsignierte URL (Signature Version 4) gilt höchstens 604800 Sekunden,
    sieben Tage; aws s3 presign signiert jede Dauer, ohne zu prüfen, und der
    Fehler zeigt sich erst, wenn jemand den Link benutzt.

big-file-event-public-media =
    Mit Website-Zugriff liefert der Web-Endpunkt jedes Objekt von media an
    alle aus, die Proben und die Fotos der Kinder eingeschlossen, und so
    lange, bis jemand es abschaltet. Ein Link, der abläuft, für dieses eine
    Objekt, erledigt die Aufgabe ohne das.

big-file-event-wide-key =
    Dieser Link funktioniert, aber denk an seinen Schlüssel: Eine
    vorsignierte URL handelt mit den Rechten des Schlüssels, der sie
    signiert hat, und lässt sich nicht allein widerrufen. Mit einem
    Schlüssel signiert, der schreiben kann oder den andere Werkzeuge
    benutzen, kann man sie nur vorzeitig kappen, indem man diese Rechte
    allen nimmt, die den Schlüssel benutzen. Ein Schlüssel nur für diese
    Freigabe, der media nur lesen kann, lässt sich an dem Tag löschen, an
    dem das Komitee fertig ist.

big-file-event-local-url =
    Dieser Link nennt einen Host, den nur kulissen kennt (localhost, oder
    kulissen selbst): Von Zuris Büro aus führt er nirgendwohin. Der
    öffentliche Endpunkt ist s3.kestrel.example (die endpoint_url von
    ~/.aws/config).

big-file-event-read-key =
    Ein Schlüssel, der media nur lesen kann: Ein damit signierter Link kann
    nie etwas schreiben oder löschen, und das Löschen des Schlüssels
    widerruft jeden Link, den er signiert hat.

big-file-event-shared =
    Der Link ist fertig: ein Objekt, höchstens eine Woche, signiert mit einem
    Schlüssel, der media nur lesen kann, auf dem öffentlichen Endpunkt. Der
    Bucket bleibt privat.

big-file-event-staged =
    Die Änderung ist vorgemerkt, nicht angewendet: garage layout show sagt,
    wie das neue Layout aussähe, und welche Version du garage layout apply
    geben musst.

big-file-event-same-zone =
    Der neue Knoten ist in derselben Zone wie ein anderer: Garage legt, wenn
    es kann, höchstens eine Kopie pro Zone ab, also landen bei zwei
    verbleibenden Zonen zwei Kopien jedes Stücks Daten in einem Gebäude. Ein
    Brand oder eine Überschwemmung dort, und beide sind weg. Der Ersatz von
    porch gehört in die Zone von porch.

big-file-event-replaced =
    Der neue Knoten hat die Rolle von porch übernommen: wieder drei Knoten in
    drei Zonen. Garage kopiert jetzt die fehlenden Stücke darauf (garage
    stats zeigt die Resync-Warteschlange); das alte porch hat das Layout
    verlassen.

big-file-event-end =
    Farrukh: „Zuri hat ihn in zwanzig Minuten heruntergeladen. Danke!“
    Siosaia: „garage status ist ganz grün, und meine alte Platte darf in
    Rente.“

    Gut gemacht! Du hast „Die große Datei“ abgeschlossen.

    WAS PASSIERT IST
    Der Film der Gala musste ein Festival erreichen, ohne den Bucket media
    öffentlich zu machen: Du hast einen Schlüssel angelegt, der media nur
    lesen kann, und damit eine vorsignierte URL signiert, für eine Woche,
    das Längste, was Signature Version 4 erlaubt. Dann der Cluster: porch
    war ausgefallen, und seine Daten hatten noch zwei Kopien von drei,
    genug für das Quorum von Garage. Du hast die Rolle von porch dem neuen
    Knoten gegeben, in derselben Zone, und das neue Layout angewendet.

    GUTE PRAXIS
    - Teile ein Objekt, nicht einen Bucket: Eine vorsignierte URL gibt ein
      Objekt, für begrenzte Zeit, an alle, die den Link haben (behandle ihn
      wie ein Passwort).
    - Signiere ihn mit einem Schlüssel nur für die Freigabe, nur lesend: Das
      Löschen des Schlüssels widerruft den Link vorzeitig. Ein Link kann
      nicht länger als sieben Tage gelten; für länger signierst du einen
      neuen.
    - Halte Replikate an verschiedenen Orten (Zonen): Der Ersatz eines
      Knotens kommt in seine Zone. Mit drei Kopien arbeitet Garage weiter,
      wenn ein Knoten ausfällt, aber repariere vor dem nächsten Ausfall.
    - Ändere ein Layout in zwei Schritten: vormerken, garage layout show
      lesen, dann mit der Version anwenden, die es angibt.

    EIN ANDERER WEG
    garage layout remove gefolgt von garage layout assign tut dasselbe wie
    --replace. Für eine dauerhafte Freigabe ist ein eigener Bucket mit
    Website-Zugriff und nur dem, was öffentlich sein soll, eine Option;
    Amazon S3 und MinIO haben auch Bucket-Policies, die Garage nicht
    implementiert.

    DOKUMENTATION
    - aws s3 presign: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/presign.html
    - Vorsignierte URLs und ihre sieben Tage: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    - Garage, Wiederherstellung nach Ausfällen: https://garagehq.deuxfleurs.fr/documentation/operations/recovering/
    - Garage, das Layout des Clusters: https://garagehq.deuxfleurs.fr/documentation/operations/layout/
