### Story "The Lifeboat", chapter "The Sorting Office": Sieve filters with
### Dovecot's Pigeonhole: fileinto for bookings@, a vacation reply that
### answers an alias but not a mailing list. sievec, sieve-test, doveadm
### sieve, the active script, delivery by LMTP. Commands, options, paths,
### Sieve code and outputs are not translated.

chapter-sorting-office = Die Sortierstelle
    .summary = Die Schulbesuche im Winter beginnen, und die Schriftführerin will die Buchungen in einem eigenen Ordner; der Kassenwart ist drei Wochen weg und braucht eine Abwesenheitsnotiz, die Menschen antwortet, nicht Mailinglisten. Schreib die Sieve-Skripte, prüf sie, mach sie zu den aktiven und sieh zu, wie neue Mail dorthin geht, wo sie soll.

## Files

sorting-office-message-marisol =
    Von: Marisol (Vorsitzende, Rettungsstation Seaholme)
    Montag, 3. November, 9:05
    
    Hallo noch einmal!
    
    Zwei kleine Dinge vor dem Winter:
    
    1. Leilani: alles, was an bookings@lifeboat.example geschrieben wird,
       kommt in ihrem Postfach an (es ist ein Alias), vermischt mit dem
       Rest. Sie hätte es gern in einem Ordner namens Bookings, und ihre
       andere Mail dort, wo sie jetzt ist.
    
    2. Aziz, unser Kassenwart, ist bis zum 24. November weg. Er hätte gern
       eine automatische Antwort („Ich bin bis zum 24. weg, schreibt in
       dringenden Fällen an Marisol“), an die Leute, die ihm schreiben, und
       auch an die, die an treasurer@ schreiben, was ihn auch erreicht.
       Letztes Jahr ging seine Antwort an die Mailingliste des Verbunds, und
       zweihundert Stationen haben sie bekommen, zweimal: bitte nie wieder.
       Yerlan sagt, irgendwo gibt es ein altes Skript von ihm.
    
    Ich habe zwei Beispielnachrichten in dein Home-Verzeichnis gelegt, zum
    Ausprobieren.
    
    Marisol
sorting-office-note-yerlan =
    Notizen von Yerlan (Sieve auf slipway)
    
    - Dovecot führt Sieve-Skripte aus, wenn es Mail zustellt (LMTP, Plugin
      sieve): zuerst die globalen (/etc/dovecot/sieve/before.d: Spam nach
      Junk), dann das aktive Skript des Benutzers.
    - Die Skripte eines Benutzers liegen in ~/sieve/NAME.sieve (Home:
      /var/vmail/lifeboat.example/NAME); das aktive ist das, auf das
      ~/.dovecot.sieve verweist (90-sieve.conf). sudo doveadm sieve list -u
      BENUTZER zeigt sie, doveadm sieve activate wählt eines aus.
    - sievec DATEI prüft und kompiliert ein Skript; sieve-test SKRIPT
      NACHRICHT sagt, was es mit einer Nachricht tun würde, ohne sie
      zuzustellen.
    - Dateien unter /var/vmail gehören vmail (5000): Dovecot muss lesen
      können, was du dort hinlegst.
    - Die Sprache: RFC 5228 (if, header, address, envelope, fileinto, stop),
      RFC 5230 für vacation. man sievec, man sieve-test.
    
    Yerlan

## Events

sorting-office-event-read-old =
    Das ist das Skript vom letzten Jahr: reject antwortet nicht und behält
    die Nachricht nicht, es weist sie ab. Jede Nachricht an Aziz ginge
    verloren, und die Ablehnung geht an den Absender des Umschlags zurück,
    die Adresse der Mailingliste inklusive. Eine Abwesenheitsnotiz ist das,
    was die Erweiterung vacation (RFC 5230) tut: sie behält die Nachricht
    und antwortet jeder Person einmal.
sorting-office-event-syntax =
    Der Compiler hat an der Zeile angehalten, die er nennt: ein fehlendes
    Semikolon, ein falsch geschriebener Befehl oder eine Erweiterung ohne
    ihr require. Pigeonhole meldet den ersten Fehler; repariere ihn und
    kompiliere noch einmal (sievec), bevor du aktivierst.
sorting-office-event-reject-live =
    Eine Nachricht an Aziz wurde abgewiesen, und die Ablehnung hat ihrem
    Absender geantwortet: so hat die Antwort vom letzten Jahr die Liste
    erreicht. Deaktiviere dieses Skript (doveadm sieve deactivate, oder ein
    anderes aktivieren) und nimm vacation.
sorting-office-event-not-active =
    Das Skript ist geschrieben, aber keine Nachricht geht hindurch: es ist
    nicht das aktive (~/.dovecot.sieve verweist nicht darauf). doveadm sieve
    activate -u BENUTZER NAME macht es aktiv (oder, im Home des Benutzers,
    ln -s sieve/NAME.sieve .dovecot.sieve, im Besitz von vmail).
sorting-office-event-folder =
    Leilanis Skript legt eine Nachricht an bookings@ nach Bookings und lässt
    eine direkte in ihrer INBOX (dasselbe Ergebnis, das sieve-test zeigen
    würde). Der Ordner existiert, oder fileinto :create legt ihn an
    (require "mailbox").
sorting-office-event-sorted-live =
    Eine echte Buchung ist hereingekommen: „fileinto action: stored mail
    into mailbox 'Bookings'“ in mail.log. Der Test hatte recht, und LMTP hat
    dasselbe getan.
sorting-office-event-alias-missing =
    Aziz' Skript antwortet auf eine an aziz@ geschickte Nachricht, aber
    nicht auf eine an treasurer@: der Befehl vacation antwortet nur, wenn
    eine der Adressen des Benutzers in To oder Cc steht, und treasurer@ ist
    ein Alias, nicht seine Adresse („discarding vacation response for
    implicitly delivered message“ im Log). Der Tag :addresses listet seine
    anderen Adressen.
sorting-office-event-vacation =
    Aziz' vacation antwortet auf eine direkte Nachricht und behält sie in
    seiner INBOX. vacation schweigt auch von selbst, wo es soll:
    Mailinglisten (List-Id…), automatische Nachrichten (Auto-Submitted),
    Massenmail, MAILER-DAEMON, und derselbe Absender zweimal innerhalb von
    :days.
sorting-office-event-alias =
    Seine Antwort deckt auch treasurer@ ab, und die Listennachricht bekommt
    keine: der Befehl vacation sieht ihren Header List-Id.
sorting-office-event-replied-live =
    Eine echte Nachricht an Aziz hat ihre Antwort bekommen: „sent vacation
    response to <…>“ in mail.log. Die nächste von derselben Person bekommt
    :days Tage lang keine.
sorting-office-event-end =
    Marisol: „Leilani hat heute Morgen drei Schulbuchungen in ihrem neuen
    Ordner gefunden, und Aziz' Antwort ging an die Bootswerft und an die
    Steuerberaterin. Kein Wort an den Verbund. Danke!“
    
    Gut gemacht! Du hast „Die Sortierstelle“ abgeschlossen.
    
    WAS PASSIERT IST
    Mail wird sortiert, während sie zugestellt wird: das LMTP von Dovecot
    führt die globalen Sieve-Skripte aus, dann das aktive des Benutzers. Du
    hast ein Skript geschrieben, das die Nachrichten an bookings@ in einen
    eigenen Ordner legt, und ein anderes, das Aziz' Korrespondenz
    antwortet, während er weg ist, sein Alias inklusive und die
    Mailinglisten in Ruhe gelassen, sie mit sievec und sieve-test geprüft,
    aktiviert und zugesehen, wie neue Mail hindurchging.
    
    GUTE PRAXIS
    - Eine Abwesenheitsnotiz ist vacation, nie reject (das die Nachricht
      abweist) noch redirect: vacation behält die Mail, antwortet einmal pro
      Absender und :days und schweigt bei Listen und automatischen
      Nachrichten.
    - vacation die anderen Adressen des Benutzers geben (:addresses), wenn
      Mail über Aliase ankommt.
    - Vor dem Aktivieren prüfen: sievec für die Syntax, sieve-test auf
      echten Beispielen für das Ergebnis; dann bei der nächsten echten
      Nachricht das Log beobachten.
    - Nur ein persönliches Skript ist aktiv: doveadm sieve list zeigt
      welches.
    
    DOKUMENTATION
    - Sieve (RFC 5228): https://www.rfc-editor.org/rfc/rfc5228
    - Vacation (RFC 5230): https://www.rfc-editor.org/rfc/rfc5230
    - Das Sieve-Plugin von Pigeonhole: https://doc.dovecot.org/2.4.1/core/plugins/sieve.html
    - Vacation in Pigeonhole: https://doc.dovecot.org/2.4.1/core/config/sieve/extensions/vacation.html
    - doveadm sieve: https://doc.dovecot.org/2.4.1/core/man/doveadm-sieve.1.html
