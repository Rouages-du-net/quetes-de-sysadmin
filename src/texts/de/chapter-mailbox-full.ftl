### Story "The Lifeboat", chapter "Mailbox Full": Saoirse's mailbox is over
### its quota and her mail bounces. Dovecot's quota (maildirsize, doveadm
### quota), the userdb, doveadm expunge with a search query, a quota
### warning. Commands, options, paths, settings and outputs are not
### translated.

chapter-mailbox-full = Postfach voll
    .summary = Seit Samstag empfängt die Spendensammlerin der Rettungsstation nichts mehr, und ihre Sponsoren bekommen ihre Nachrichten zurück. Finde heraus, warum der Mailserver ihre Mail ablehnt, schaff auf die richtige Art Platz und sorg dafür, dass sie nächstes Mal gewarnt wird.

## Files

mailbox-full-message-marisol =
    Von: Marisol (Vorsitzende, Rettungsstation Seaholme)
    Dienstag, 16. September, 9:10
    
    Hallo, und danke, dass du uns hilfst!
    
    Saoirse, die unsere Spendensammlung leitet, hat seit Samstag keine
    einzige E-Mail bekommen. Schlimmer: Amara vom Bootsausrüster, der unseren
    Winteraufruf sponsert, hat mir die Nachricht weitergeleitet, die sie
    zurückbekommen hat, „Mail delivery failed“. Wir sind mitten im
    Winteraufruf.
    
    Unser Mailserver ist helling, wo du gerade bist; sudo funktioniert mit
    deinem Passwort. Yerlan hat ihn vor Jahren eingerichtet und eine Notiz
    hinterlassen. Der Vorstand hat gestern beschlossen, Saoirse 2 GB statt 1
    zu geben, da sie alle Fotos und die Dokumente der Sponsoren bekommt;
    aber bitte öffne nicht einfach für alle die Schleusen.
    
    Marisol
mailbox-full-note-yerlan =
    Notizen von Yerlan (helling, 2028, seitdem ein paar Ergänzungen)
    
    - Postfix empfängt die Mail für lifeboat.example und gibt sie über LMTP
      an Dovecot (virtual_transport in /etc/postfix/main.cf). Alles wird in
      /var/log/mail.log protokolliert.
    - Dovecot speichert die Mail jeder Person in
      /var/vmail/lifeboat.example/NAME/Maildir, im Besitz von vmail. Die
      Ordner sind .Trash, .Sent… innerhalb des Maildir.
    - Die Benutzer stehen in /etc/dovecot/users (passwd-file: eine Zeile pro
      Person, Zusatzfelder am Ende, wie userdb_irgendwas=wert).
    - Die Konfiguration: /etc/dovecot/conf.d/*.conf. doveconf -n zeigt, was
      Dovecot liest; nach einer Änderung sudo doveadm reload (oder systemctl
      reload dovecot).
    - Alle haben 1G Quota (90-quota.conf). Ich habe die Maildir++-Quota
      benutzt, wie auf dem alten Server: der Verbrauch steht in einer Datei
      namens maildirsize.
    - doveadm macht alles als root: doveadm quota, doveadm mailbox, doveadm
      expunge… (man doveadm).
    
    Yerlan

## Events

mailbox-full-event-bounces =
    Da ist es: jede Nachricht an saoirse@lifeboat.example endet mit „552
    5.2.2 … Quota exceeded (mailbox for user is full)“, status=bounced, und
    Postfix schickt dem Absender eine Unzustellbarkeitsnachricht zurück. Das
    LMTP von Dovecot weigert sich, die Nachricht zu speichern, weil ihr
    Postfach über seiner Quota liegt. Wie voll ist es, und was belegt den
    Platz? (man doveadm: quota get.)
mailbox-full-event-quota-get =
    Die Quota wird in Kilobyte gezählt: Value ist, was sie benutzt, Limit,
    was sie benutzen darf. Sie liegt über 100 %. Sobald ein Postfach über
    seinem Limit ist, lehnt Dovecot jede neue Nachricht ab (die
    Speicher-Kulanz lässt nur eine Nachricht über das Limit). Welche ihrer
    Ordner belegen diesen Platz? (doveadm mailbox status mit messages und
    vsize, oder du auf dem Maildir.)
mailbox-full-event-trash =
    Ihr Papierkorb enthält hunderte Megabyte: die Fotos vom Tag der offenen
    Tür 2029 und 2030, gelöscht, aber nie geleert. Doveadm kann die
    Nachrichten löschen, die zu einer Suchanfrage passen, für einen Benutzer
    und ein Postfach (man doveadm, und man doveadm-search-query für die
    Daten: savedbefore, before, 2w, YYYY-MM-DD…). Probier die Anfrage zuerst
    mit doveadm search aus.
mailbox-full-event-lost =
    Ihr INBOX hat Nachrichten verloren: ihre Mail pauschal zu löschen
    schafft keinen Platz, es verliert die Dokumente der Sponsoren, die sie
    noch braucht. Starte hier das Kapitel neu (oder nimm den
    Wiederherstellungspunkt) und entferne nur, was alt ist und schon im
    Papierkorb liegt.
mailbox-full-event-unlimited =
    Jemand hat jetzt gar keine Quota mehr. Ein unbegrenztes Postfach füllt
    eines Tages die Platte, und dann empfängt niemand mehr etwas. Marisol
    hat 2 GB für Saoirse verlangt, nicht für alle: behalte ein Limit für
    jeden Benutzer.
mailbox-full-event-stale =
    Die Dateien sind weg, aber Dovecot glaubt immer noch, das Postfach sei
    voll: mit der Maildir++-Quota steht der Verbrauch in maildirsize, und
    Dovecot bemerkt keine Dateien, die hinter seinem Rücken entfernt wurden.
    Die Zustellungen prallen weiter ab. Bitte Dovecot, neu zu zählen (man
    doveadm: quota recalc), und entferne Mail nächstes Mal über Dovecot
    (doveadm expunge), das die Zählung richtig hält.
mailbox-full-event-expunged =
    Der alte Papierkorb ist weg, ihr INBOX und Sent sind vollständig, und
    die Zählung der Quota stimmt mit den Dateien überein: es gibt wieder
    Platz. Die nächste Nachricht an sie wird gespeichert.
mailbox-full-event-raised =
    Saoirses Limit ist jetzt, was der Vorstand beschlossen hat, und nur
    ihres. Ein Zusatzfeld der userdb (userdb_quota_storage_size=2G in
    /etc/dovecot/users) überschreibt die Konfiguration für einen Benutzer;
    doveadm user und doveadm quota get zeigen, was Dovecot anwenden wird.
mailbox-full-event-delivered =
    Eine Nachricht hat Saoirses INBOX erreicht: „stored mail into mailbox
    'INBOX'“ im Log, status=sent auf der Seite von Postfix.
mailbox-full-event-warning =
    Die Quota-Warnung steht in der Konfiguration, mit der Dovecot läuft:
    wenn ein Postfach diesen Prozentsatz überschreitet, führt Dovecot den
    Dienst quota-warning aus, der dem Benutzer schreibt. Sie löst nur in dem
    Moment aus, in dem das Limit überschritten wird.
mailbox-full-event-end =
    Marisol: „Saoirse hat zwölf neue Nachrichten, darunter Amaras
    Sponsorenpaket. Ich habe Amara gesagt, sie soll es noch einmal
    schicken; danke!“
    
    Gut gemacht! Du hast „Postfach voll“ abgeschlossen.
    
    WAS PASSIERT IST
    Saoirses Postfach hatte seine Quota von 1 GiB erreicht, vor allem mit
    einem alten Papierkorb voller Fotos. Das LMTP von Dovecot lehnte jede
    neue Nachricht mit „552 5.2.2 Quota exceeded“ ab, und Postfix schickte
    sie an ihre Absender zurück. Du hast die Rückläufer in mail.log
    gefunden, das Postfach mit doveadm vermessen, den alten Papierkorb mit
    einer Suchanfrage gelöscht, Saoirse die beschlossenen 2 GiB in der
    userdb gegeben statt allen, und eine Warnung hinzugefügt, damit sie es
    erfährt, bevor es wieder voll ist.
    
    GUTE PRAXIS
    - Zuerst das Log lesen: der Antwortcode (552 5.2.2) und die Zeile von
      Dovecot sagen genau, wer abgelehnt hat und warum.
    - Mail über Dovecot entfernen (doveadm expunge -u BENUTZER mailbox Trash
      savedbefore 365d), die Anfrage mit doveadm search testen und nie
      Dateien in einem Maildir von Hand löschen: Quota und Indizes wären
      falsch (doveadm quota recalc repariert die Zählung).
    - Eine Quota pro Benutzer, aus der userdb; keine unbegrenzten Postfächer.
    - Warnen, bevor es voll ist (quota_warning), und quota_full_tempfail =
      yes erwägen: ein volles Postfach stellt Mail dann zurück (4.2.2),
      statt sie abzuweisen, was dir ein paar Tage zum Reagieren gibt.
    - Für einen neuen Server empfiehlt Dovecot den Quota-Treiber count statt
      Maildir++.
    
    DOKUMENTATION
    - Das Quota-Plugin: https://doc.dovecot.org/2.4.1/core/plugins/quota.html
    - doveadm quota: https://doc.dovecot.org/2.4.1/core/man/doveadm-quota.1.html
    - doveadm expunge: https://doc.dovecot.org/2.4.1/core/man/doveadm-expunge.1.html
    - Suchanfragen: https://doc.dovecot.org/2.4.1/core/man/doveadm-search-query.7.html
    - passwd-file und seine Zusatzfelder: https://doc.dovecot.org/2.4.1/core/config/auth/databases/passwd_file.html

## What the three chapters share, kept here so that it loads with the
## story: the mail that arrives on helling (subjects, bodies, the words each
## kind of mail is made of). A list is separated by |. rspamd's Bayes
## learns these words: the spam's and the ham's lists must not overlap.

lifeboat-month-names = Januar | Februar | März | April | Mai | Juni | Juli | August | September | Oktober | November | Dezember
lifeboat-visit-months = November | Dezember | März | April
lifeboat-schools = die Hafenschule | die St.-Brendan-Schule | die Pfadfinder von Nordklippe | die Seekadetten von Seaholme | das Westbucht-Gymnasium | die Kita Felsenbecken | die Klippenranger
lifeboat-words-ham = Besuch | Station | Gruppe | Kinder | Samstag | Bootshaus | Crew | Übung | Auslaufen | Dienstplan | Ehrenamtliche | Spende | Tombola | Führung | Lehrkräfte | Mittagessen | Parkplatz | Hafen | Rettungswesten | Probealarm | Gezeiten | danke | Vormittag | Nachmittag | Lose | Geschenk | Laden | Kaffee | Kleinbus
lifeboat-crew-whats = Auslaufen | Übung | Probealarm | Traktorübung
lifeboat-crew-days = Samstag | Sonntag | Mittwoch
lifeboat-mail-booking-subject = Besuchsanfrage: { $school }, { $day }. { $month }
lifeboat-mail-booking-body =
    Hallo,
    
    wir würden gern mit einer Gruppe von { $school } die Station und das Bootshaus besuchen, etwa { $children } Kinder und vier Lehrkräfte. Könnten wir eine Führung am { $day }. buchen, vormittags, wenn die Gezeiten es erlauben? Unser Mittagessen bringen wir mit.
    
    Hinweise: { $notes }.
    
    Vielen Dank,
    { $name }
lifeboat-mail-crew-subject = Dienstplan der Crew: { $what } am { $day }
lifeboat-mail-crew-body =
    Hallo zusammen,
    
    der Dienstplan für die nächste Runde { $what } hängt am Brett in der Station. Bitte prüft eure Rettungswesten und sagt mir, wenn ihr nicht könnt.
    
    Hinweise: { $notes }.
    
    { $name }
lifeboat-words-phish = bestätigen | Konto | gesperrt | Postfach | Passwort | sofort | verifizieren | Anmeldung | Sicherheit | Deaktivierung | Speicher | Kontingent | Upgrade | validieren | Zugangsdaten | wiederherstellen | Zugriff | ablaufen
lifeboat-mail-phish-name = Mail-Administrator
lifeboat-mail-phish-subjects = Handlung erforderlich: Ihr Postfach wird gesperrt | Speicherlimit des Postfachs erreicht | Bestätigen Sie Ihr Konto, um die Deaktivierung zu vermeiden
lifeboat-mail-phish-body = <html><body><p>Sehr geehrte(r) { $name },</p><p>Ihr Postfach bei { $domain } hat sein Speicherlimit erreicht und wird gesperrt. { $words }.</p><p><a href="{ $link }">Konto bestätigen</a></p><p>{ $domain } Mail-Administrator</p></body></html>
lifeboat-words-invoice = Rechnung | Zahlung | überfällig | offen | Überweisung | Transfer | begleichen | Betrag | Saldo | Mahngebühr | Referenz | dringend | Buchhaltung | letzte | Mahnung
lifeboat-mail-invoice-name = Buchhaltung
lifeboat-mail-invoice-subjects = RECHNUNG ÜBERFÄLLIG - LETZTE MAHNUNG | ZAHLUNGSERINNERUNG - DRINGEND | MITTEILUNG ÜBER OFFENEN SALDO
lifeboat-mail-invoice-body = <html><body><p>Guten Tag,</p><p>anbei erhalten Sie die letzte Mahnung für die überfällige Rechnung { $number }. { $words }.</p><p>Abteilung Buchhaltung</p></body></html>
lifeboat-words-prize = Gewinner | Preis | einlösen | Belohnung | Krypto | Wallet | Bonus | Jackpot | Glück | Verlosung | ausgewählt | Glückwunsch | exklusiv | Gutschein | gratis
lifeboat-mail-prize-name = Glücksziehung
lifeboat-mail-prize-subjects = Sie haben GEWONNEN! | Lösen Sie jetzt Ihren Krypto-Bonus ein! | Ihre exklusive Belohnung wartet!
lifeboat-mail-prize-body = <html><body><img src="{ $image }"><p>Herzlichen Glückwunsch! Sie wurden bei unserer Verlosung { $draw } ausgewählt.</p><p><a href="{ $claim }">Belohnung jetzt einlösen</a></p><p>{ $words }</p><p><a href="{ $unsubscribe }">Abmelden</a></p></body></html>
lifeboat-mail-bulletin-subject = Sicherheitsbulletin der Küstenwache: Wetter und Gezeiten, { $day }. { $month }
lifeboat-mail-bulletin-body = <html><body><img src="{ $image }"><p>Sicherheitsbulletin der Küstenwache, { $day }. { $month }: Sturmwarnung für die äußere Bucht ab heute Nacht, Springflut am Wochenende, die Vorhersage für den Hafen.</p><p><a href="{ $link }">Das ganze Bulletin lesen</a></p><p><a href="{ $unsubscribe }">Abmelden</a></p></body></html>
lifeboat-list-topics = die Übungstermine im Winter | die neuen Pager | die Erneuerung der Versicherung | den regionalen Tag der offenen Tür | die Treibstoffpreise
lifeboat-mail-list-name = Verbund der Küstenstationen
lifeboat-mail-list-subject = { "[" }stations{ "]" } Über { $topic }
lifeboat-mail-list-body =
    Liebe Stationen,
    
    eine kurze Notiz über { $topic }: Details beim nächsten Treffen.
    
    --
    Mailingliste stations
    stations@lists.coastfed.example
lifeboat-mail-attachment-body =
    Hallo Saoirse,
    
    { $subject }: die Dateien hängen an.
    
    Anhang: { $file }
lifeboat-mail-photos-subject = Fotos vom Tag der offenen Tür, Teil { $n }
lifeboat-mail-poster-subject = Plakatentwurf { $n }
lifeboat-mail-saoirse-subjects = Sponsorenformular | Tombolapreise | Fotos vom Sommerfest | Förderantrag | Bootstaufe
lifeboat-mail-sent-subject = Re: Sommerfest, Teil { $n }
lifeboat-mail-sponsor-0-subject = Dein Sponsorenpaket für den Winteraufruf
lifeboat-mail-sponsor-1-subject = Unterschriebenes Formular für die Bootstaufe
lifeboat-mail-sponsor-2-subject = Fotos vom Sommerfest
lifeboat-mail-sponsor-3-subject = Förderung: die Dokumente, um die du gebeten hast
lifeboat-mail-sponsor-4-subject = Tombolapreise vom Bootsausrüster
lifeboat-mail-sponsor-0-body =
    Hallo Saoirse,
    
    { $subject }: anbei, wie versprochen.
    
    Anhang: { $file }
    { $name }
lifeboat-mail-sponsor-1-body =
    Hallo Saoirse,
    
    { $subject }: anbei, wie versprochen.
    
    Anhang: { $file }
    { $name }
lifeboat-mail-sponsor-2-body =
    Hallo Saoirse,
    
    { $subject }: anbei, wie versprochen.
    
    Anhang: { $file }
    { $name }
lifeboat-mail-sponsor-3-body =
    Hallo Saoirse,
    
    { $subject }: anbei, wie versprochen.
    
    Anhang: { $file }
    { $name }
lifeboat-mail-sponsor-4-body =
    Hallo Saoirse,
    
    { $subject }: anbei, wie versprochen.
    
    Anhang: { $file }
    { $name }
lifeboat-mail-raffle-subject = Die Tombolalose
lifeboat-mail-raffle-body =
    Hallo Leilani,
    
    die Tombolalose sind gedruckt: soll ich sie am Samstag mitbringen?
    
    { $name }
lifeboat-mail-shop-subject = Samstag im Laden
lifeboat-mail-shop-body =
    Hallo Leilani,
    
    kannst du den Laden am Samstagvormittag aufmachen?
    
    { $name }
lifeboat-mail-tyres-subject = Rechnung für die neuen Traktorreifen
lifeboat-mail-tyres-body =
    Lieber Aziz,
    
    anbei unsere Rechnung für die Traktorreifen.
    
    { $name }
lifeboat-mail-fuel-subject = Quittung für den Treibstoff
lifeboat-mail-fuel-body =
    Hallo Aziz,
    
    hier ist die Quittung für den Treibstoff des letzten Einsatzes.
    
    { $name }
lifeboat-mail-year-end-subject = Jahresabschluss
lifeboat-mail-year-end-body =
    Hallo,
    
    könnte der Kassenwart uns die Kontoauszüge für den Jahresabschluss schicken?
    
    { $name }
lifeboat-mail-gift-aid-subject = Antrag auf Spendenerstattung
lifeboat-mail-gift-aid-body =
    Lieber Kassenwart,
    
    das Formular für die Spendenerstattung braucht diesen Monat eine Unterschrift.
    
    { $name }
lifeboat-holiday-comment = Aziz, August 2030 (von Yerlan geschrieben): „sag ihnen, dass ich weg bin“
lifeboat-holiday-reply = Ich bin bis zum 25. August nicht da. In dringenden Fällen schreib an Marisol.
