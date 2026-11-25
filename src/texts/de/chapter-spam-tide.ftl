### Story "The Lifeboat", chapter "Spam Tide": spam reaches the INBOX while
### a legitimate safety bulletin is rejected. rspamd's scores and actions
### (rspamc symbols, rspamd.log, actions.conf), a whitelist (multimap or
### settings), Bayes (rspamc learn_spam, learn_ham). Commands, options,
### paths, symbols and outputs are not translated.

chapter-spam-tide = Spam-Flut
    .summary = Eine Flut aus Phishing und gefälschten Rechnungen erreicht die Schriftführerin der Station, während das Sicherheitsbulletin der Küstenwache, das die Crew vor jedem Einsatz liest, nicht mehr ankommt. Lies, wie der Spamfilter jede Nachricht bewertet, setz seine Schwellen dorthin zurück, wo sie hingehören, vertraue dem Bulletin und nur dem Bulletin, und bring dem Filter bei, wie Spam aussieht.

## Files

spam-tide-message-leilani =
    Von: Leilani (Schriftführerin, Rettungsstation Seaholme)
    Montag, 6. Oktober, 8:40
    
    Hallo,
    
    Zwei Dinge, und das zweite ist das wichtigste.
    
    1. Mein Posteingang ertrinkt: „Ihr Postfach wird gesperrt“, Rechnungen
       von Firmen, von denen wir nie gehört haben, Gewinne. Ich schiebe sie
       jeden Morgen von Hand nach Junk (inzwischen zweihundert), und es
       kommen immer neue.
    
    2. Das Sicherheitsbulletin von Coastwatch (news@coastwatch.example)
       kommt seit Mai nicht mehr an. Die Crew liest es vor jedem Einsatz:
       Sturmwarnungen, Gezeiten. Coastwatch sagt, ihre Mails an uns werden
       „als Spam abgelehnt“. Die Buchungen, die ich letztes Jahr archiviert
       habe, liegen in meinem Ordner Archive.
    
    Yerlan hat im Mai etwas am Spamfilter geändert, glaube ich.
    
    Leilani
spam-tide-note-yerlan =
    Notizen von Yerlan (rspamd auf helling)
    
    - rspamd bewertet jede eingehende Nachricht: Postfix übergibt sie über
      den Milter (smtpd_milters = inet:localhost:11332 in main.cf).
    - Jede passende Regel fügt ein Symbol mit einer Punktzahl hinzu; die
      Summe entscheidet die Aktion: no action, greylist, add header (die
      Nachricht bekommt „X-Spam: Yes“, und das globale Sieve-Skript von
      Dovecot legt sie nach Junk), reject.
    - Nie /etc/rspamd/*.conf bearbeiten: lokale Änderungen gehören nach
      /etc/rspamd/local.d/ (mit den Standardwerten zusammengeführt) oder
      override.d/ (ersetzt sie). Dann rspamadm configtest und sudo
      systemctl reload rspamd.
    - Mai 2031: alle haben sich über die [SPAM]-Markierungen beschwert, also
      habe ich die Schwellen in local.d/actions.conf verschoben. Jetzt ist
      es ruhiger.
    - rspamc spricht mit dem laufenden rspamd: rspamc symbols DATEI zeigt
      die Punktzahl einer Nachricht, rspamc stat die Zähler. Sein Log:
      /var/log/rspamd/rspamd.log.
    - Bayes ist eingerichtet (Redis), aber ich habe es nie trainiert.
    
    Yerlan

## Events

spam-tide-event-scores =
    Jede Zeile ist ein Symbol und seine Punktzahl; Summe und Aktion stehen
    oben (oder in „(default: F (no action): [4.80/8.00] […])“ in
    rspamd.log). Das Phishing kommt auf etwa 4.8 und die gefälschten
    Rechnungen auf 6.9: unter jeder Schwelle, die Yerlan gelassen hat, also
    kommen sie unberührt durch. Das Bulletin kommt auf 8.89, über reject =
    8: es wird an der Tür abgewiesen. Was sagen die Schwellen?
    (local.d/actions.conf; man rspamc, man rspamadm.)
spam-tide-event-milter-off =
    Postfix fragt rspamd nichts mehr: jede Nachricht, Spam oder nicht, geht
    direkt in die Postfächer, und niemand sieht überhaupt noch eine
    Punktzahl. Der Milter ist der einzige Weg des Filters hinein; setz
    smtpd_milters zurück (und postfix reload).
spam-tide-event-reject-low =
    Mit so niedrigem reject wird fast alles abgewiesen, die Buchungen und
    die Mail der Crew inklusive: eine Nachricht von einer Freundin kommt auf
    etwa null, manchmal etwas mehr. Eine Schwelle ist ein Gleichgewicht:
    nur abweisen, was sicher Spam ist (15 standardmäßig), markieren, was
    wahrscheinlich Spam ist.
spam-tide-event-thresholds =
    Die Schwellen sind wieder vernünftig: greylist, add header, reject in
    aufsteigender Reihenfolge, weit genug auseinander. Die gefälschten
    Rechnungen und die Gewinne bekommen jetzt „X-Spam: Yes“ und gehen nach
    Junk. Das Phishing (4.8) wird nur gegreylistet: einmal zurückgestellt,
    kommt es fünf Minuten später wieder und erreicht trotzdem die INBOX.
    Das Bulletin wird nicht mehr abgewiesen, landet aber mit dem Spam in
    Junk.
spam-tide-event-bulletin-junk =
    Das letzte Bulletin ist in Leilanis Junk gelandet: mit 8.89 liegt es
    über add_header. Schau dir seine Symbole an: die meisten kommen von der
    Versandplattform, über die es geschickt wird (sendwave.example: in einer
    Sperrliste, Tracking-Links), derselben Plattform wie der Gewinnspam.
    Vertraue der eigenen Adresse des Bulletins statt der Plattform (man
    rspamc; die Module multimap und settings: docs.rspamd.com).
spam-tide-event-leak =
    Vorsicht: diese Regel senkt auch die Punktzahl des Spams. Der Gewinnspam
    kommt auch von sendwave.example, mit einem SMTP-Absender bei
    sendwave.example: der Plattform zu vertrauen (ihrer Domain oder ihren
    Adressen) lässt ihren Spam durch. Vertraue news@coastwatch.example, der
    Adresse im From:-Header (multimap: type = "from" mit extract_from =
    "mime"; settings: from_mime), und sonst nichts.
spam-tide-event-whitelist =
    Das Bulletin kommt jetzt ohne Aktion durch, und die Regel passt auf
    nichts anderes: der SMTP-Absender eines Newsletters ist oft die
    Bounce-Adresse der Plattform, deshalb schauen „from“-Maps standardmäßig
    auf den SMTP-Absender, und extract_from = "mime" war nötig.
spam-tide-event-poisoned =
    rspamd hat gerade Buchungen als Spam gelernt: das Archive enthält die
    Nachrichten, die Leilani behält, die als Ham zu lernen sind. Eine in der
    falschen Klasse gelernte Nachricht kann in der richtigen noch einmal
    gelernt werden (rspamd lernt sie neu).
spam-tide-event-bayes =
    Bayes hat jetzt genug von beiden Klassen (min_learns): es klassifiziert
    jede Nachricht nach den gelernten Wörtern und fügt BAYES_SPAM oder
    BAYES_HAM hinzu.
spam-tide-event-caught =
    Ein frisches Phishing, eine Rechnung und ein Gewinnspam werden jetzt alle
    als Spam markiert (rspamc symbols auf neuen: BAYES_SPAM schiebt das
    Phishing über add_header).
spam-tide-event-end =
    Leilani: „Der Junk von heute Morgen hat vierzig Nachrichten, meine INBOX
    hat die Buchungen, und die Crew hat die Sturmwarnung vor dem Einsatz am
    Samstag bekommen. Danke!“
    
    Gut gemacht! Du hast „Spam-Flut“ abgeschlossen.
    
    WAS PASSIERT IST
    In Eile verschobene Schwellen ließen den Spam unter 8 unmarkiert durch
    und wiesen alles darüber ab, auch ein legitimes Bulletin, das über eine
    Versandplattform geschickt wird, die auch Spammer benutzen. Du hast die
    Punktzahlen gelesen, die Schwellen zurückgesetzt (reject 15, add header
    6, greylist 4), der eigenen Adresse des Bulletins vertraut statt seiner
    Plattform und Bayes mit dem Spam trainiert, den Leilani schon sortiert
    hatte, und mit den Buchungen, die sie archiviert hatte.
    
    GUTE PRAXIS
    - Die Symbole ansehen, bevor man Schwellen anfasst: rspamc symbols auf
      eine gespeicherte Nachricht, oder die Zeile in rspamd.log.
    - Schwellen: abweisen, was sicher Spam ist, markieren (add header), was
      wahrscheinlich Spam ist; der Junk-Ordner der Person ist das
      Sicherheitsnetz, ein reject nicht.
    - Eine Whitelist so eng wie möglich: eine Adresse, am besten geprüft
      (DKIM, SPF); nie eine ganze Versandplattform oder eine Domain, die
      Spammer fälschen können.
    - Bayes mit Mail trainieren, die Menschen selbst sortiert haben, beide
      Klassen, mit genug Nachrichten (min_learns); den Filter im Weg
      behalten (Milter).
    - Lokale Änderungen in local.d/ oder override.d/, mit rspamadm
      configtest vor einem Neuladen geprüft.
    
    DOKUMENTATION
    - Aktionen und Punktzahlen: https://docs.rspamd.com/configuration/metrics/
    - Das Modul multimap: https://docs.rspamd.com/modules/multimap/
    - Settings: https://docs.rspamd.com/configuration/settings/
    - Statistik (Bayes): https://docs.rspamd.com/configuration/statistic/
    - Postfix und Milter: https://www.postfix.org/MILTER_README.html
