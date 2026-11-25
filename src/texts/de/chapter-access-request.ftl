### Story "The Choir", chapter "The Access Request": a member asks for a
### copy of all the data the choir holds about her (GDPR article 15). psql
### (WHERE, --csv), grep -r, zgrep, find, cp. Commands, options, paths and
### outputs are not translated.

chapter-access-request = Das Auskunftsersuchen
    .summary = Eine Altistin bittet den Chor um eine Kopie von allem, was er über sie speichert. Ihre Zeile in der Mitgliedertabelle ist der leichte Teil: finde sie überall, wo der Server sie aufbewahrt, und schick ihr alles davon, und nichts von anderen.

## Files

access-request-message-amara =
    Von: Amara (Vorsitzende)
    Montag, 17. März, 18:40
    
    Hallo noch einmal,
    
    Priya Raman, eine unserer Altistinnen, hat uns geschrieben (ihre
    Nachricht liegt in deinem Home-Verzeichnis). Sie hat ein Recht darauf,
    und wir haben einen Monat, um zu antworten.
    
    Könntest du alles, was der Server über sie speichert, in
    /srv/choir/dsgvo-anfragen/priya-raman/ sammeln? Jedes Format ist recht,
    solange sie es lesen kann; ich schicke es ihr mit einem Brief über den
    Mitgliederbereich. Bitte nur ihre Daten: nichts über die anderen.
    
    Amara
access-request-request-priya =
    Von: Priya Raman
    An: den Vorstand des Chors am Fluss
    Sonntag, 16. März
    
    Lieber Vorstand,
    
    nach Artikel 15 der DSGVO möchte ich eine Kopie aller
    personenbezogenen Daten, die der Chor über mich speichert, wo auch
    immer sie aufbewahrt werden, und wissen, wie lange ihr sie aufbewahrt.
    
    Es ist nichts passiert, ich singe sehr gern mit euch! Ich bin nur
    neugierig, und ich arbeite im Datenschutz, also halte ich mich gern an
    das, was ich predige.
    
    Viele Grüße,
    Priya Raman (Alt)

## Events

access-request-event-her-row =
    Das ist ihr Eintrag in der Mitgliedertabelle: ihre Kontaktdaten. Aber
    eine Mitglieder-App hält eine Person selten in einer einzigen Tabelle.
    Was enthält die Datenbank sonst noch (\dt), und welche Tabellen
    verweisen auf sie, über ihre id oder ihre E-Mail?
access-request-event-tables =
    Ihre Proben und ihre Beiträge gehören auch ihr: jede Zeile, die auf
    ihre id verweist, sind ihre Daten. psql kann sie direkt in eine Datei
    schreiben (leite seine Ausgabe um, oder --csv für eine Tabelle).
access-request-event-backups =
    Der Dump von letzter Nacht enthält ihre Daten auch, wie jedes Backup.
    Du schickst ihr nicht die Backups selbst (sie enthalten die Daten
    aller), aber die Antwort sollte sagen, dass es sie gibt und wie lange
    sie aufbewahrt werden: die Richtlinie sagt drei Monate.
access-request-event-uploads =
    Ihr Foto und ihre Einwilligung, in den Uploads der Mitglieder (ein
    Verzeichnis pro Mitglieds-id). Sie gehören ihr: Kopien kommen in die
    Antwort.
access-request-event-logs =
    Die Logs erwähnen sie auch: das Sicherheitslog des Mitgliederbereichs
    (das von diesem Monat und das vom letzten, mit gzip gepackt: zgrep liest
    es) und das Mail-Log (die an ihre Adresse geschickten Newsletter). Ihre
    Zeilen sind ihre Daten; die anderen Zeilen nicht.
access-request-event-old-copy =
    Eine vergessene Kopie: Rubens Export für die Telefonkette vom letzten
    Oktober, mit ihrer alten Adresse. Daten, von denen du nichts wusstest,
    sind trotzdem Daten, die du speicherst: sie gehören in die Antwort (nur
    ihre Zeile), und danach hat die Datei keinen Grund mehr zu existieren.
access-request-event-members-only =
    Die Antwort enthält ihren Eintrag aus der Mitgliedertabelle, und sonst
    nichts. Die Mitgliedertabelle ist ein Ort unter mehreren: ihre Proben,
    ihre Beiträge, der Newsletter, ihre Uploads, die Logs… Such weiter:
    grep -r nach ihrer E-Mail, die Tabellen der Datenbank.
access-request-event-leak =
    Die Antwort enthält Daten anderer Mitglieder (eine E-Mail-Adresse oder
    eine Telefonnummer, die nicht ihre ist): eine ganze Datei kopiert, eine
    Tabelle ohne WHERE, ein Log ohne grep. Sie zu schicken wäre selbst eine
    Datenpanne. Behalte nur ihre Zeilen.
access-request-event-incomplete = Die Antwort nimmt Gestalt an. Es fehlt noch: { $missing }.
access-request-part-member = ihr Eintrag in der Mitgliedertabelle
access-request-part-attendance = ihre Proben
access-request-part-payments = ihre Beiträge
access-request-part-newsletter = ihr Newsletter-Abonnement
access-request-part-photo = ihr Foto
access-request-part-consent = ihre Einwilligung
access-request-part-audit = ihre Zeilen im Sicherheitslog (beide Monate)
access-request-part-mail = ihre Zeilen im Mail-Log
access-request-part-phone-tree = ihre Zeile im alten Export der Telefonkette
access-request-event-end =
    Amara: „Ich habe alles gelesen, bevor ich es geschickt habe: ich hatte
    keine Ahnung, dass wir so viel über unsere Sängerinnen und Sänger
    wissen. Priya hat schon geantwortet: ‚Beeindruckend, und nichts von
    jemand anderem. Danke!‘“
    
    Gut gemacht! Du hast „Das Auskunftsersuchen“ abgeschlossen.
    
    WAS PASSIERT IST
    Priya hat ihr Auskunftsrecht genutzt. Ihre Daten waren nicht nur in der
    Mitgliedertabelle: ihre Proben und Beiträge in zwei anderen Tabellen,
    der Newsletter, ihr Foto und ihre Einwilligung in den Uploads, ihre
    Zeilen in zwei Logs (eines davon mit gzip gepackt) und ein Export der
    Telefonkette mit ihrer alten Adresse, an den sich niemand erinnerte. Du
    hast alles gesammelt, und nur ihres.
    
    GUTE PRAXIS
    - Das Auskunftsrecht (DSGVO, Artikel 15) umfasst alle Daten, die über
      eine Person gespeichert sind, wo auch immer, und was damit geschieht,
      wie lange und wer sie erhält. Die Antwort ist innerhalb eines Monats
      fällig (Artikel 12 Absatz 3).
    - Wissen, wo personenbezogene Daten liegen, bevor jemand fragt: ein
      kurzes Verzeichnis (Tabellen, Dateien, Logs, Exporte, Backups) macht
      aus einer Anfrage einen Abend Arbeit statt einer Suche.
    - Nach jedem Kennzeichen suchen: die id in der Datenbank, die E-Mail in
      den Logs, die Telefonnummer in einer Tabellenkalkulation.
    - Einer Person antworten, und nur dieser: eine Tabelle ohne WHERE oder
      ein ganzes Log in der Antwort ist eine Panne mit den Daten aller
      anderen.
    - Vergessene Exporte sind das klassische Leck: sobald die Antwort
      verschickt ist, sollte die Datei der Telefonkette weg.
    - Backups enthalten dieselben Daten: sag es, und wie lange sie
      aufbewahrt werden, statt in ihnen zu graben.
    
    DOKUMENTATION
    - DSGVO, Artikel 12 und 15: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - Die CNIL: https://www.cnil.fr/
    - psql: https://www.postgresql.org/docs/16/app-psql.html
    - gzip und zgrep: https://www.gnu.org/software/gzip/manual/gzip.html
