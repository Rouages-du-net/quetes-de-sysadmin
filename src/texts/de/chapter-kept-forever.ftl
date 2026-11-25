### Story "The Choir", chapter "Kept Forever": the logs of the choir's
### server go back years, against the retention policy. logrotate (rotate,
### maxage), find -mtime, nginx's map and log_format, journald's
### MaxRetentionSec=. Commands, options, paths and outputs are not
### translated.

chapter-kept-forever = Für immer aufbewahrt
    .summary = Der Vorstand des Chors hat vor zwei Jahren aufgeschrieben, wie lange er personenbezogene Daten aufbewahrt. Der Server hat es nie gelesen: seine Logs bewahren die Adresse jedes Besuchers seit 2027 auf. Bring die Logs in Einklang mit der Richtlinie, ohne wegzuwerfen, was sie aufzubewahren verlangt.

## Files

kept-forever-message-amara =
    Von: Amara (Vorsitzende, Chor am Fluss)
    Dienstag, 4. März, 9:10
    
    Hallo, und danke, dass du unseren kleinen Server übernimmst!
    
    Bei der Vorstandssitzung letzte Woche hat jemand gefragt, ob wir
    eigentlich tun, was unsere Aufbewahrungsrichtlinie sagt. Wir haben sie
    2029 beschlossen (sie liegt in /srv/choir/docs/aufbewahrungsrichtlinie.txt),
    Ruben hat den Server schon davor eingerichtet, und ich fürchte, niemand
    hat es je geprüft. Ruben ist nach Glasgow gezogen; er hat dir eine Notiz
    hinterlassen.
    
    Könntest du dir die Logs des Servers ansehen und dafür sorgen, dass sie
    der Richtlinie folgen? Behalte, was die Richtlinie zu behalten sagt, und
    nichts länger. Mir ist lieber, wir finden es selbst heraus, als dass ein
    Mitglied es für uns herausfindet.
    
    Du bist auf baton, dem Server des Chors; sudo funktioniert mit deinem
    Passwort.
    
    Amara
kept-forever-note-ruben =
    Notizen von Ruben (baton, 2027)
    
    - nginx liefert www.riversidechoir.example aus /var/www/choir aus; der
      Mitgliederbereich (/members/) ist die App des Chors (gunicorn, Port
      8000). Logs in /var/log/nginx.
    - Ich habe logrotate so eingestellt, dass es die Web-Logs zehn Jahre
      behält, „für alle Fälle“ (/etc/logrotate.d/nginx). Platte ist billig.
    - Der Mitgliederbereich schreibt sein Sicherheitslog (Anmeldungen,
      Profiländerungen) nach /var/log/choir/audit.log, jeden Monat rotiert.
    - journalctl für alles andere; das Journal ist persistent
      (/var/log/journal).
    
    Ruben

## Events

kept-forever-event-policy =
    Das ist das Versprechen des Vorstands: Web-Access-Logs für dreißig Tage
    mit gekürzten Adressen, das Sicherheitslog des Mitgliederbereichs für
    zwölf Monate, das System-Journal für dreißig Tage. Jetzt schau dir an,
    was der Server wirklich aufbewahrt: /var/log/nginx, /var/log/choir, das
    Journal.
kept-forever-event-forever =
    { $weeks } Wochen Access-Logs, zurück bis September 2027, jede Zeile mit
    der vollständigen IP-Adresse eines Besuchers: nach der DSGVO ist eine
    IP-Adresse ein personenbezogenes Datum. Rubens „rotate 520“ behält zehn
    Jahre wöchentlicher Logs. Wo entscheidet logrotate, wie lange ein Log
    lebt? (man logrotate: rotate, maxage, daily, weekly.)
kept-forever-event-today-only =
    Das Log von heute ist weg, aber die Jahre an Archiven sind noch da: das
    Problem war nie die Datei von heute. Und die Richtlinie verlangt, dreißig
    Tage Logs zu behalten, um einen Vorfall untersuchen zu können: lösche,
    was älter ist, nicht was neu ist.
kept-forever-event-too-much =
    Du hast Logs gelöscht, die die Richtlinie zu behalten verlangt: die
    letzten Wochen der Web-Logs (dreißig Tage, um einen Vorfall zu
    untersuchen) oder das Sicherheitslog der letzten zwölf Monate. Eine
    Aufbewahrungsrichtlinie ist ein Maximum und ein Minimum. Auf einem
    echten Server würdest du sie jetzt aus einem Backup wiederherstellen;
    hier starte das Kapitel neu (oder nimm den Wiederherstellungspunkt) und
    lösch nur, was älter ist, als die Richtlinie erlaubt.
kept-forever-event-rotation =
    logrotate behält jetzt nicht mehr als dreißig Tage Access-Logs. Aber
    logrotate handelt erst bei der nächsten Rotation, und es entfernt nur
    das Log, das seine Anzahl überschreitet: die Jahre an Archiven, die eine
    größere Anzahl zurückgelassen hat, bleiben, wo sie sind. Schau sie dir
    noch einmal an (ls, oder find -mtime).
kept-forever-event-leftovers =
    logrotate ist mit der neuen Anzahl gelaufen, und { $count } alte Archive
    sind noch da: es entfernt nur das Archiv, das die Anzahl überschreitet
    (und mit maxage die alten innerhalb von Anzahl + 1), nie die hunderte
    Dateien, die darüber hinaus liegen. Entferne selbst, was älter als
    dreißig Tage ist, vorsichtig: find /var/log/nginx -mtime +30 listet sie,
    bevor du irgendetwas löschst.
kept-forever-event-purged =
    Nichts, was älter als dreißig Tage ist, bleibt in /var/log/nginx, und
    die letzten Wochen sind noch da. Die Vergangenheit ist in Ordnung; jetzt
    die Gegenwart: jede neue Zeile trägt immer noch die vollständige Adresse
    des Besuchers.
kept-forever-event-log-off =
    access_log off: nginx schreibt überhaupt kein Access-Log mehr. Keine
    Adressen, sicher, aber auch keine Möglichkeit, einen Vorfall zu
    untersuchen, und die Richtlinie verlangt dreißig Tage davon. Behalte das
    Log, mit gekürzter Adresse (man nginx: map, log_format).
kept-forever-event-v6-whole =
    IPv4-Adressen werden gekürzt, aber IPv6-Besucher erscheinen noch mit
    ihrer vollständigen Adresse: einige Besucher des Chors kommen über IPv6
    (2001:db8:…). Deine map muss beides behandeln oder auf einen
    Standardwert zurückfallen, der nichts verrät.
kept-forever-event-not-loaded =
    Die Konfiguration in den Dateien kürzt Adressen, aber das laufende nginx
    benutzt noch die Konfiguration, die es geladen hat: nginx -t, dann neu
    laden (systemctl reload nginx).
kept-forever-event-anonymised =
    Neue Besucher erscheinen in access.log mit gekürzter Adresse (das letzte
    Byte einer IPv4-Adresse, alles nach der zweiten Gruppe einer
    IPv6-Adresse): genug, um ein Netz zu erkennen, das die Site flutet,
    nicht genug, um auf einen Haushalt zu zeigen. Bleibt das System-Journal.
kept-forever-event-vacuum-only =
    Die alten Journal-Dateien sind weg, aber nichts sagt journald, das
    Journal auf dreißig Tage zu begrenzen: es wird wieder wachsen. Die
    Richtlinie gehört in seine Konfiguration (man journald.conf:
    MaxRetentionSec=).
kept-forever-event-journal-not-loaded =
    MaxRetentionSec= steht in der Datei, aber journald liest seine
    Konfiguration beim Start: starte es neu (systemctl restart
    systemd-journald).
kept-forever-event-journal = journald behält jetzt dreißig Tage und hat die älteren archivierten Dateien entfernt.
kept-forever-event-end =
    Amara: „Danke! Ich sage dem Vorstand, dass wir jetzt tun, was wir sagen.
    Ich frage mich, was wir sonst noch aufbewahren, ohne es zu wissen…“
    
    Gut gemacht! Du hast „Für immer aufbewahrt“ abgeschlossen.
    
    WAS PASSIERT IST
    Die Richtlinie des Vorstands versprach dreißig Tage Web-Logs mit
    gekürzten Adressen und dreißig Tage Journal. Rubens logrotate behielt
    zehn Jahre wöchentlicher Logs, mit der vollständigen IP-Adresse jedes
    Besuchers, und das Journal reichte bis 2027 zurück. Du hast logrotate
    auf dreißig Tage gesetzt, die Archive entfernt, die es selbst nie
    entfernt hätte, die Adressen, die nginx schreibt, mit einer map und einem
    log_format gekürzt und journald ein MaxRetentionSec= gegeben; das
    Sicherheitslog des Mitgliederbereichs, das schon stimmte, hast du
    behalten.
    
    GUTE PRAXIS
    - Speicherbegrenzung (DSGVO, Artikel 5 Absatz 1 Buchstabe e):
      personenbezogene Daten werden nicht länger aufbewahrt, als ihr Zweck
      es verlangt. Eine IP-Adresse ist ein personenbezogenes Datum.
    - Eine Aufbewahrungsfrist wird im Werkzeug festgelegt, das die Daten
      aufbewahrt (logrotate, journald), nicht in einer Erinnerung: dann
      geschieht es jeden Tag.
    - Die Anzahl von logrotate zu ändern räumt die Vergangenheit nicht auf:
      es entfernt nur das Archiv, das die Anzahl überschreitet. Vor dem
      Löschen mit find -mtime prüfen.
    - An der Quelle minimieren: eine gekürzte Adresse im Log statt einer
      vollständigen, die später bereinigt wird. Das Fehlerlog enthält noch
      vollständige Adressen: halte es auch kurz, oder auf einer Stufe, die
      weniger loggt.
    - Eine Richtlinie ist auch ein Minimum: das Sicherheitslog der letzten
      zwölf Monate bleibt, um nach einem Vorfall „wer hat sich angemeldet?“
      zu beantworten.
    
    DOKUMENTATION
    - DSGVO, Artikel 5: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - Die CNIL (die französische Datenschutzbehörde): https://www.cnil.fr/
    - Das Log-Modul von nginx: https://nginx.org/en/docs/http/ngx_http_log_module.html
    - Das map-Modul von nginx: https://nginx.org/en/docs/http/ngx_http_map_module.html
    - logrotate(8): https://man7.org/linux/man-pages/man8/logrotate.8.html
    - journald.conf(5): https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html

## What the three chapters of the story share (members, policy, pages): kept here so that they load with the story.

choir-list-locale = de
choir-policy-marker = WIE LANGE WIR PERSONENBEZOGENE DATEN AUFBEWAHREN
# Invented people (Ofcom's drama range of phone numbers, .example domains): id|first_name|last_name|email|phone|voice|joined_on|left_on|address
choir-members =
    1|Amara|Okafor|amara.okafor@mail.example|07700 900101|Alt|2025-09-01||Mühlenweg 3, Am Fluss
    2|Kenji|Watanabe|kenji.watanabe@mail.example|07700 900102|Bass|2025-09-01||Obstgartenweg 27, Am Fluss
    3|Gesine|Hartmann|gesine.hartmann@mail.example|07700 900103|Sopran|2024-09-02|2027-06-30|Wehrgasse 8, Am Fluss
    4|Mateus|Silva|mateus.silva@mail.example|07700 900104|Tenor|2025-09-01||Kanalstraße 41, Am Fluss
    5|Leila|Haddad|leila.haddad@mail.example|07700 900105|Sopran|2026-01-12||Fährweg 12, Am Fluss
    6|Jonas|Brandt|jonas.brandt@mail.example|07700 900106|Bass|2026-09-07||Reiherweg 5, Am Fluss
    7|Nadia|Petrova|nadia.petrova@mail.example|07700 900107|Alt|2026-09-07||Schleusenstraße 19, Am Fluss
    8|Samuel|Mensah|samuel.mensah@mail.example|07700 900108|Tenor|2025-09-01|2028-06-30|Weidenufer 2, Am Fluss
    9|Clara|Vogel|clara.vogel@mail.example|07700 900109|Sopran|2027-09-05||Bahnhofsberg 33, Am Fluss
    10|Arjun|Mehta|arjun.mehta@mail.example|07700 900110|Bass|2027-09-05||Kaistraße 7, Am Fluss
    11|Fatima|Idrissi|fatima.idrissi@mail.example|07700 900111|Alt|2027-09-05||Treidelpfad 16, Am Fluss
    12|Bernd|Kühn|bernd.kuehn@mail.example|07700 900112|Tenor|2026-09-07|2028-12-15|Schilfhof 9, Am Fluss
    13|Yuki|Tanaka|yuki.tanaka@mail.example|07700 900113|Sopran|2028-01-10||Wiesenblick 21, Am Fluss
    14|Rosa|Delgado|rosa.delgado@mail.example|07700 900114|Alt|2028-09-03||Uferweg 4, Am Fluss
    15|Ivan|Horvat|ivan.horvat@mail.example|07700 900115|Bass|2027-09-05|2029-06-30|Brückenende 11, Am Fluss
    16|Aisha|Bello|aisha.bello@mail.example|07700 900116|Sopran|2028-09-03||Mühlenweg 28, Am Fluss
    17|Tom|Becker|tom.becker@mail.example|07700 900117|Tenor|2028-09-03||Lindenallee 6, Am Fluss
    18|Mei|Lin|mei.lin@mail.example|07700 900118|Alt|2029-01-14||Eisvogelhang 30, Am Fluss
    19|Lukas|Schäfer|lukas.schaefer@mail.example|07700 900119|Bass|2028-09-03|2030-06-30|Schleusenweg 15, Am Fluss
    20|Ingrid|Solberg|ingrid.solberg@mail.example|07700 900120|Sopran|2029-09-08||Korbweidenweg 2, Am Fluss
    21|Kwabena|Asante|kwabena.asante@mail.example|07700 900121|Tenor|2029-09-08||Werftstraße 18, Am Fluss
    22|Hannah|Weiß|hannah.weiss@mail.example|07700 900122|Alt|2029-09-08|2030-12-20|Hechtstraße 23, Am Fluss
    23|Sofia|Rossi|sofia.rossi@mail.example|07700 900123|Sopran|2029-09-08||Teichhuhnweg 10, Am Fluss
    24|Daniel|Cohen|daniel.cohen@mail.example|07700 900124|Bass|2030-01-12||Kanalstraße 37, Am Fluss
    25|Ulrike|Möller|ulrike.moeller@mail.example|07700 900125|Alt|2030-01-12||Fährweg 1, Am Fluss
    26|Omar|Farouk|omar.farouk@mail.example|07700 900126|Tenor|2030-09-07||Reiherweg 13, Am Fluss
    27|Priya|Raman|priya.raman@mail.example|07700 900127|Alt|2030-09-07||Ulmenhof 14, Am Fluss
    28|Elif|Kaya|elif.kaya@mail.example|07700 900128|Sopran|2030-09-07||Schleusenstraße 9, Am Fluss
    33|Minh|Tran|minh.tran@mail.example|07700 900133|Bass|2030-09-07||Kaistraße 26, Am Fluss
    36|Grace|Mwangi|grace.mwangi@mail.example|07700 900136|Sopran|2031-01-11||Wehrgasse 5, Am Fluss
    41|Tomas|Novak|tomas.novak@mail.example|07700 900141|Tenor|2029-09-08||Treidelpfad 22, Am Fluss
# People who signed up for the newsletter on the site without being members: email|date.
choir-newsletter-public =
    jo.bright@post.example|2029-11-02
    sam.okonjo@post.example|2030-05-17
    lee.harper@post.example|2030-12-06
# Ruben's export for the phone tree, October 2030 (Priya lived elsewhere then).
choir-phone-tree =
    name,stimme,telefon,adresse
    Amara Okafor,Alt,07700 900101,Mühlenweg 3
    Kenji Watanabe,Bass,07700 900102,Obstgartenweg 27
    Mateus Silva,Tenor,07700 900104,Kanalstraße 41
    Leila Haddad,Sopran,07700 900105,Fährweg 12
    Nadia Petrova,Alt,07700 900107,Schleusenstraße 19
    Arjun Mehta,Bass,07700 900110,Kaistraße 7
    Rosa Delgado,Alt,07700 900114,Uferweg 4
    Tom Becker,Tenor,07700 900117,Lindenallee 6
    Ingrid Solberg,Sopran,07700 900120,Korbweidenweg 2
    Omar Farouk,Tenor,07700 900126,Reiherweg 13
    Priya Raman,Alt,07700 900127,Eisvogelhang 3
    Elif Kaya,Sopran,07700 900128,Schleusenstraße 9
choir-purge-comment = Löschen, was laut unserer Aufbewahrungsrichtlinie abgelaufen ist (Ruben, 2029).
choir-policy =
    CHOR AM FLUSS
    WIE LANGE WIR PERSONENBEZOGENE DATEN AUFBEWAHREN
    Vom Vorstand beschlossen am 14. September 2029. Jeden September überprüft.
    
    Wir bewahren personenbezogene Daten nur so lange auf, wie wir sie für den
    Zweck brauchen, für den wir sie erhoben haben (DSGVO, Artikel 5 Absatz 1
    Buchstabe e). Ist die Zeit um, werden sie gelöscht oder so anonymisiert,
    dass niemand daraus identifiziert werden kann.
    
    Was                                       Wie lange                          Warum
    ----------------------------------------  ---------------------------------  ----------------------------------
    Mitgliederdaten (Profil, Kontakte)        solange Mitglied, dann 2 Jahre     um Rückkehrende wieder aufzunehmen
    Anwesenheit bei Proben                    2 Jahre                            Planung, Versicherung des Saals
    Beiträge und Zahlungen                    10 Jahre                           Buchhaltungsunterlagen (Gesetz)
    Foto und seine Einwilligung               solange Mitglied                   Einwilligung
    Newsletter-Adresse                        bis zur Abmeldung                  Einwilligung
    Access-Logs des Webservers                30 Tage, Adressen gekürzt          Sicherheit: lang genug, um einen
                                                                                 Vorfall zu untersuchen, nicht länger
    Sicherheitslog des Mitgliederbereichs     12 Monate                          Sicherheitsuntersuchungen
    System-Journal                            30 Tage                            Sicherheit, Fehlersuche
    Backups                                   3 Monate wöchentlicher Backups     Wiederherstellung nach einem Vorfall
                                              (gelöschte Daten verschwinden
                                              daraus, wenn sie altern)
    
    Anfragen von Mitgliedern (eine Kopie ihrer Daten, eine Berichtigung, eine
    Löschung): Antwort innerhalb eines Monats (DSGVO, Artikel 12 Absatz 3).
    Amara nimmt sie entgegen und gibt sie an die Person weiter, die den
    Server betreibt.
choir-page-index =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Chor am Fluss</title></head>
    <body>
    <h1>Chor am Fluss</h1>
    <p>Vierzig Stimmen, kein Vorsingen, Probe jeden Dienstag um 19:30 Uhr im Saal in der Schleusenstraße.</p>
    <p><a href="/concerts.html">Konzerte</a> · <a href="/join.html">Mitsingen</a> · <a href="/members/login">Mitgliederbereich</a></p>
    </body>
    </html>
choir-page-concerts =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Konzerte — Chor am Fluss</title></head>
    <body>
    <h1>Konzerte</h1>
    <p>Frühjahrskonzert: Samstag, 12. April 2031, 19 Uhr, St.-Annen-Kirche. Eintritt frei, Spenden willkommen.</p>
    </body>
    </html>
choir-page-join =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Mitsingen — Chor am Fluss</title></head>
    <body>
    <h1>Mitsingen</h1>
    <p>Komm zu irgendeiner Dienstagsprobe: kein Vorsingen, Noten lesen nicht nötig. Der Beitrag ist 120 pro Saison (60 ermäßigt).</p>
    </body>
    </html>
choir-page-login =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Mitgliederbereich</title></head>
    <body><h1>Mitgliederbereich</h1><form method="post"><input name="email"><input name="password" type="password"><button>Anmelden</button></form></body>
    </html>
