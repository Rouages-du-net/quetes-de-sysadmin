### Geschichte „Spam“, Kapitel 1 „Der Briefträger“: SPF.
### Befehle, Pfade, DNS-Einträge und Meldungen von Postfix werden nicht
### übersetzt.

chapter-postman = Der Briefträger
    .summary = Die Willkommens-E-Mails der Gemeinschaftsgärten hängen fest: Das veröffentlichte SPF ist noch das des alten Hosters.

## Dateien

postman-email-nour =
    Von:     Nour
    An:      dich
    Betreff: Die Willkommens-E-Mails kommen nicht mehr an

    Hallo, und danke, dass du uns hilfst!

    Letzte Woche haben wir unseren alten Hoster verlassen
    (old-hosting.example): Website und Mail der Gemeinschaftsgärten laufen
    jetzt auf unserem eigenen Server, diesem hier. Alles lief gut… bis uns
    fünf neue Mitglieder geschrieben haben: Sie haben die
    Willkommens-E-Mail, die die Website bei der Anmeldung schickt, nie
    bekommen. Alle fünf haben eine Adresse bei mailbox.example.

    Ich kenne mich damit nicht gut aus, aber ich habe einen Befehl gesehen,
    mailq, der die wartende Post zeigt. Und es gibt /var/log/mail.log.

    Das DNS von gardens.example liegt auch auf diesem Server (BIND), mit
    einer Kopie bei der Registry (ns2.registry.example), genau wie vorher
    beim Hoster.

    Das sudo-Passwort: samen-2027.

    Danke!
    Nour

## Ereignisse

postman-event-differs =
    mailbox.example lehnt die Mail nicht für immer ab: 451 ist ein
    „vorübergehender“ Code (4xx), Postfix behält die Nachricht und wird es
    erneut versuchen. Aber der Grund ist klar: „neither SPF nor DKIM
    passed“. Weder SPF (das sagt, welche Maschinen für eine Domain
    senden dürfen) noch DKIM (eine Signatur) beweist, dass dieser Server
    wirklich für gardens.example spricht. Fang mit SPF an: Es ist ein
    TXT-Eintrag der Domain, der mit v=spf1 beginnt (dig TXT
    gardens.example).
postman-event-old =
    Hier ist das SPF von gardens.example: „include:_spf.old-hosting.example
    -all“. Es erlaubt nur die Server des alten Hosters (was
    _spf.old-hosting.example veröffentlicht), und -all lehnt alle anderen
    ab… auch diesen Server, 203.0.113.30. Der Eintrag steht in der Zone,
    auf diesem Server: /etc/bind/zones/db.gardens.example.
postman-event-two =
    Vorsicht: Die Zone enthält jetzt zwei Einträge, die mit v=spf1
    beginnen. RFC 7208 ist streng: Mit zwei SPF-Einträgen ist das Ergebnis
    „permerror“, als wäre keiner gültig. Ersetze den alten, statt einen
    weiteren hinzuzufügen.
postman-event-serial =
    Dieser Server veröffentlicht das richtige SPF, aber der Rest des
    Internets fragt auch den Secondary der Registry, der die alte Version
    behält: dig TXT gardens.example @ns2.registry.example. Der Secondary
    kopiert die Zone nur dann erneut, wenn ihre Seriennummer (serial, im
    SOA) steigt.
postman-event-spf =
    Das SPF, das das Internet jetzt sieht, erlaubt 203.0.113.30, für
    gardens.example zu senden. Die wartenden E-Mails gehen erst beim
    nächsten Versuch von Postfix raus (alle paar Minuten); um nicht zu
    warten: sudo postqueue -f, dann mailq.
postman-event-end =
    Die Warteschlange ist leer: mailbox.example hat die fünf
    Willkommens-E-Mails angenommen. Nour: „Amina hat gerade geantwortet,
    sie hat sie bekommen! … in ihrem Spam-Ordner, aber sie hat sie
    bekommen.“

    Gut gemacht! Du hast das Kapitel „Der Briefträger“ abgeschlossen.

    WAS PASSIERT IST
    Ein Server, der Mail empfängt, prüft, ob der Absender im Namen seiner
    Domain senden darf. SPF beantwortet die Frage „darf diese IP-Adresse
    für gardens.example senden?“: Es ist ein TXT-Eintrag der Domain
    (v=spf1 …). Nach dem Umzug erlaubte es noch den alten Hoster, nicht
    diesen Server. 451 ist ein vorübergehender Fehler: Postfix hat die
    Nachrichten behalten und erneut gesendet.

    GUTE PRAXIS
    - Ein SPF-Eintrag pro Domain; ändere ihn, wenn du den sendenden Server
      wechselst (mx, a, ip4:…, include:… für einen Anbieter).
    - Mit -all (den Rest ablehnen) oder ~all (markieren) enden, nie +all.
    - Die Zone zu ändern heißt auch, die Seriennummer zu erhöhen und dann
      zu prüfen, was das Internet sieht: dig @ns2.registry.example.
    - mailq und /var/log/mail.log sagen, warum eine Nachricht wartet.

    DOKUMENTATION
    - SPF, RFC 7208: https://www.rfc-editor.org/rfc/rfc7208
    - postqueue: https://www.postfix.org/postqueue.1.html
    - Zonendateien von BIND: https://bind9.readthedocs.io/en/stable/chapter3.html
