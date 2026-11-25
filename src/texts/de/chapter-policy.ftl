### Geschichte „Spam“, Kapitel 3 „Die Richtlinie“: DMARC (Sammelberichte,
### Ausrichtung, p=quarantine). Befehle, Pfade, DNS-Einträge und Tags
### werden nicht übersetzt.

chapter-policy = Die Richtlinie
    .summary = DMARC auf p=quarantine umstellen, ohne den Newsletter zu verlieren: die Berichte lesen, den Anbieter ausrichten, dann die Richtlinie verschärfen.

## Dateien

policy-email-nour =
    Von:     Nour
    An:      dich
    Betreff: DMARC

    Hallo!

    mailbox.example kündigt an, dass Absender, die viel senden, eine
    DMARC-Richtlinie von mindestens „quarantine“ veröffentlichen müssen.
    Unser Newsletter geht jede Woche an fast 500 Personen…

    Wie ihr Leitfaden rät, habe ich letzte Woche eine Richtlinie
    veröffentlicht, die nichts blockiert (p=none), aber nach Berichten
    fragt (rua=mailto:dmarc@gardens.example). Die ersten sind angekommen,
    ich habe sie in dmarc_berichte gelegt. Ich verstehe kein Wort: Das ist
    XML.

    Der Newsletter wird von newsmail.example verschickt, einem Anbieter:
    Ihre Hilfeseite zu DKIM steht in newsmail_schreiben.txt.

    Könntest du DMARC auf quarantine umstellen, ohne dass unser Newsletter
    im Spam-Ordner landet?

    Nour

policy-letter-newsmail =
    newsmail.example — Hilfe — Mit Ihrer eigenen Domain signieren (DKIM)

    Standardmäßig signieren unsere Server Ihre Kampagnen mit unserer
    Domain (d=newsmail.example). Die Empfänger prüfen die Signatur, aber
    für DMARC passt sie nicht zur Domain Ihrer Absenderadresse.

    Damit wir mit Ihrer Domain signieren, delegieren Sie uns einen
    Selektor. Fügen Sie der DNS-Zone Ihrer Domain hinzu:

        nm1._domainkey.IHRE-DOMAIN.   CNAME   nm1.dkim.newsmail.example.

    Unsere Server prüfen Ihr DNS stündlich: Sobald der CNAME sichtbar ist,
    werden Ihre Kampagnen mit d=IHRE-DOMAIN signiert.

    Die Rücklaufadresse (Bounces) bleibt bei uns:
    bounces+…@bounce.newsmail.example.

## Ereignisse

policy-event-report =
    198.51.100.77: Das sind die Server von newsmail.example, die den
    Newsletter verschicken (412 Nachrichten bei mailbox.example). SPF
    besteht, DKIM besteht… aber für bounce.newsmail.example und
    newsmail.example, nicht für gardens.example. DMARC verlangt
    Ausrichtung: Die von SPF (der Umschlag) oder von DKIM (d=) geprüfte
    Domain muss die der From:-Adresse sein. Mit p=quarantine würden diese
    412 Nachrichten im Spam-Ordner landen.
policy-event-spoofing =
    192.0.2.66 gehört niemandem im Verein: 17 Nachrichten im Namen von
    gardens.example, ohne gültiges SPF oder DKIM. Jemand gibt sich als die
    Gärten aus. Genau das wird p=quarantine (oder reject) stoppen.
policy-event-inclusion =
    include:_spf.newsmail.example zum SPF von gardens.example hinzuzufügen,
    ändert für DMARC nichts: Die Empfänger prüfen SPF für die Domain des
    Umschlags, bounce.newsmail.example, nicht für gardens.example. Und
    jedes include kostet DNS-Abfragen (höchstens zehn). Es ist DKIM, das
    ausgerichtet sein muss: siehe newsmail_schreiben.txt.
policy-event-point =
    Der CNAME für nm1._domainkey führt ins Leere: In einer Zone ist ein
    Name ohne Punkt am Ende relativ. nm1.dkim.newsmail.example wird zu
    nm1.dkim.newsmail.example.gardens.example. Er braucht den Punkt am
    Ende: nm1.dkim.newsmail.example.
policy-event-two =
    Es gibt jetzt zwei DMARC-Einträge für gardens.example: RFC 7489 sagt,
    DMARC in diesem Fall zu ignorieren, als gäbe es keine Richtlinie.
    Ändere den bestehenden Eintrag, statt einen weiteren hinzuzufügen.
policy-event-aligned =
    Das Internet sieht den CNAME: newsmail.example signiert den Newsletter
    jetzt mit d=gardens.example, und der Schlüssel wird über den CNAME
    gefunden. Der Newsletter besteht DMARC. Die Richtlinie kann verschärft
    werden.
policy-event-too-early =
    Vorsicht: Mit dieser Richtlinie würde der Newsletter (nicht
    ausgerichtet) von den Mailanbietern in Quarantäne gesteckt oder
    abgelehnt. Richte zuerst die Signatur von newsmail.example aus.
policy-event-end =
    gardens.example veröffentlicht p=quarantine (oder strenger), der
    Newsletter und die E-Mails des Servers bestehen DMARC, und die
    Nachrichten von 192.0.2.66 haben keine Chance mehr. Nour: „Ich behalte
    die Berichte jede Woche im Auge.“

    Gut gemacht! Du hast das Kapitel „Die Richtlinie“ und die Geschichte
    „Spam“ abgeschlossen.

    WAS PASSIERT IST
    DMARC verbindet SPF und DKIM mit der Adresse, die die Person liest
    (From:): Eine Nachricht besteht, wenn SPF oder DKIM für dieselbe Domain
    besteht (Ausrichtung). Die Richtlinie (p=) sagt den Empfängern, was sie
    mit den anderen tun sollen: nichts (none), Spam-Ordner (quarantine),
    Ablehnung (reject). Die Berichte (rua=) zeigen, wer im Namen der Domain
    sendet: hier der Newsletter-Anbieter, schlecht ausgerichtet, und ein
    Betrüger.

    GUTE PRAXIS
    - Mit p=none und rua= anfangen, die Berichte lesen, jeden Dienst
      ausrichten, der im Namen der Domain sendet, erst dann quarantine,
      dann reject.
    - Ein Anbieter richtet sich über DKIM aus (ein CNAME zu seinem
      Schlüssel, d=deine Domain) oder über SPF (eine Rücklaufadresse in
      deiner Domain).
    - Ein einziger DMARC-Eintrag, unter _dmarc.domain; Seriennummer
      erhöhen, prüfen, was das Internet sieht.
    - pct= erlaubt es, schrittweise zu verschärfen (pct=25, dann 100).

    DOKUMENTATION
    - DMARC, RFC 7489: https://www.rfc-editor.org/rfc/rfc7489
    - Das Format der Sammelberichte: https://www.rfc-editor.org/rfc/rfc7489#appendix-C
    - Ausrichtung: https://www.rfc-editor.org/rfc/rfc7489#section-3.1
