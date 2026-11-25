### Geschichte „Das Tierheim“, Kapitel „Umschalten und lernen“: die Firewall
### von zuflucht, eine Prüfung von außen, www in der Zone umgestellt
### (Seriennummer, rndc reload, TTL), die Nachbetrachtung ohne Schuldzuweisung
### und die nächste Wiederherstellungsübung geplant. Das letzte Kapitel der
### Reihe: Seine Nachbesprechung schließt den Bogen.
### Befehle, Optionen, Pfade und Ausgaben werden nicht übersetzt.

chapter-switch-and-learn = Umschalten und lernen
    .summary = Die Website läuft wieder auf dem Ersatz, aber die Welt fragt immer noch nach der Adresse des ertrunkenen Servers. Öffne den Weg, prüfe von außen, lass den Namen auf die neue Maschine zeigen und sieh zu, wie die alte Antwort verblasst. Dann die zwei Zeilen des Plans, die alle überspringen: die Nachbetrachtung und die nächste Übung.

## Files

switch-and-learn-message-teuila =
    Von: Teuila
    Freitag, 14. November, 13:10

    zuflucht funktioniert von innen: Mirela hat darauf die Seiten der Tiere
    durchgeblättert. Jetzt die Welt. Besucher·innen fragen immer noch nach
    www.hillsideshelters.example und bekommen die Adresse von Hillside, die
    unter Wasser steht.

    Der Router von Riverbend leitet seine öffentliche Adresse,
    203.0.113.163, Port 80, schon an zuflucht weiter (Wiremu hat das mittags
    gemacht). wiese ist unser versteckter primärer DNS-Server für die Zone
    (/etc/bind), der Server des Registrars kopiert sie. Der Plan von
    Dariusz hat uns die TTL von www vor zwei Wochen auf fünf Minuten senken
    lassen: Das Umschalten sollte schnell gehen.

    Dann die letzten zwei Zeilen des Plans, die niemand macht:
    - die Nachbetrachtung, in rueckblick.md hier (die Vorlage ist fertig).
      Keine Namen, denen man die Schuld gibt: was passiert ist, was
      geholfen hat, was sich ändern muss, und wer als Nächstes was tut.
    - die nächste Wiederherstellungsübung: Mirela hat ein Skript angefangen,
      /usr/local/sbin/restore-drill. Es muss wirklich wiederherstellen und
      prüfen, und von selbst laufen, jeden Monat. Sein Schlüssel liegt in
      /root/.restic-drill.

    Teuila

switch-and-learn-review-template =
    # Nachbetrachtung des Vorfalls: das Hochwasser in Hillside, 14. November 2031

    <!-- Ohne Schuldzuweisung: Beschreibe, was passiert ist und warum, nicht, wer schuld ist. -->

    ## Zusammenfassung

    (noch auszufüllen)

    ## Zeitleiste

    <!-- Die Uhrzeiten, aus den Logs: /var/log/sitewatch.log auf wiese, die restic-Snapshots, das Journal von named. -->
    (noch auszufüllen)

    ## Auswirkungen

    (noch auszufüllen)

    ## Was gut lief

    (noch auszufüllen)

    ## Was besser werden muss

    (noch auszufüllen)

    ## Maßnahmen

    <!-- Eine pro Zeile, jede mit ihrer verantwortlichen Person: Teuila, Mirela, Rahel, Wiremu oder du. -->
    (noch auszufüllen)

switch-and-learn-section-summary = Zusammenfassung
switch-and-learn-section-timeline = Zeitleiste
switch-and-learn-section-impact = Auswirkungen
switch-and-learn-section-went-well = Was gut lief
switch-and-learn-section-improve = Was besser werden muss
switch-and-learn-section-actions = Maßnahmen
switch-and-learn-placeholder = (noch auszufüllen)
# A regular expression: the words that point at a culprit.
switch-and-learn-blame-words = \b(Schuld|schuldig|beschuldigt|vorwerfen|Vorwurf|fahrlässig|Fahrlässigkeit|nachlässig|Nachlässigkeit|unachtsam|dumm|inkompetent|hätte es wissen müssen)\b
# A regular expression: the people who can own an action.
switch-and-learn-owners = \b(Teuila|Mirela|Rahel|Wiremu|du|ich)\b

## Events

switch-and-learn-event-outside-closed =
    Keine Antwort von zuflucht auf Port 80, von außen: Der Router leitet den
    Port weiter, aber die Firewall von zuflucht verwirft ihn (Wiremu hat
    heute Morgen ufw aktiviert, nur mit ssh). Den Namen jetzt umzuschalten,
    würde alle Besucher·innen gegen diese Wand schicken.
switch-and-learn-event-opened =
    Die Firewall von zuflucht lässt das Web herein (Port 80). Prüf von hier
    aus, über die öffentliche Adresse von Riverbend, bevor du den Namen
    anfasst.
switch-and-learn-event-outside =
    Von wiese aus, außerhalb beider Tierheime, antwortet die öffentliche
    Adresse von Riverbend mit der Website der Tierheime: zuflucht ist bereit
    für die Welt. Jetzt der Name.
switch-and-learn-event-dark-switch =
    www zeigt jetzt auf Riverbend, aber Besucher·innen bekommen nichts:
    zuflucht antwortet von außen noch nicht (seine Firewall, oder nginx).
    Bei einem echten Umschalten ist die Reihenfolge: Zuerst funktioniert es
    von außen, dann der Name.
switch-and-learn-event-serial =
    named hat die neue Adresse geladen, aber der Server des Registrars
    liefert immer noch die alte aus: Die Seriennummer im SOA ist nicht
    gestiegen, also kopiert der Secondary die Zone nicht (journalctl -u
    named sagt es). Erhöhe sie und mach noch einmal rndc reload.
switch-and-learn-event-zone =
    named auf wiese liefert die neue Adresse für www aus.
switch-and-learn-event-switched =
    Der Server des Registrars antwortet 203.0.113.163 für www: Wer jetzt
    fragt, erreicht zuflucht. Wessen Resolver sich an die alte Antwort
    erinnert, folgt innerhalb ihrer TTL: fünf Minuten, dem Plan sei Dank.
switch-and-learn-event-cache =
    Immer noch die alte Adresse: Der Resolver antwortet aus seinem Cache,
    bis die TTL abläuft, die er bekommen hat (dig zeigt die verbleibenden
    Sekunden). Frag den Server des Registrars direkt (dig
    @ns1.registrar.example), um zu sehen, was er jetzt ausliefert; der
    Resolver folgt innerhalb von fünf Minuten.
switch-and-learn-event-resolver =
    Der öffentliche Resolver gibt auch die neue Adresse: Die alte Antwort
    ist abgelaufen. Alle bekommen jetzt zuflucht.
switch-and-learn-event-blame =
    Die Nachbetrachtung zeigt auf jemanden. Eine Nachbetrachtung ohne
    Schuldzuweisung beschreibt, was das System und der Ablauf zugelassen
    haben, damit die Leute beim nächsten Mal alles erzählen: Schreib, was
    passiert ist, nicht, wessen Schuld es ist.
switch-and-learn-event-no-owners =
    Jede Maßnahme braucht eine verantwortliche Person (Teuila, Mirela,
    Rahel, Wiremu oder du), eine Maßnahme pro Zeile: Eine Maßnahme, für die
    niemand verantwortlich ist, ist ein Wunsch.
switch-and-learn-event-no-timeline =
    Die Zeitleiste braucht die Uhrzeiten aus den Logs: wann die Website
    ausgefallen ist ({ $time }, die erste gescheiterte Prüfung in
    sitewatch.log), und mindestens zwei weitere (das letzte Backup, das
    Umschalten…).
switch-and-learn-event-review =
    Die Nachbetrachtung ist geschrieben: was passiert ist, seine
    Auswirkungen, was geholfen hat, was sich ändern muss, und wer was tut.
switch-and-learn-event-drill-list-only =
    Die Übung, so ausgeführt, wie sie laufen wird, listet nur die Snapshots:
    Das beweist, dass sich das Repository öffnen lässt, nicht, dass ein
    Backup zurückkommt. Eine Übung stellt wieder her (daneben: --target) und
    prüft dann, was zurückgekommen ist.
switch-and-learn-event-drill-over-root =
    Die Übung stellt über / wieder her: Auf wiese würde das /etc von koppel
    über das von wiese schreiben. Stell daneben wieder her, in einem
    Arbeitsverzeichnis.
switch-and-learn-event-drill-unchecked =
    Die Übung stellt wieder her, prüft aber nicht, was zurückgekommen ist:
    Die SHA-256 des Dumps steht in shelter.sha256, gleich daneben
    (sha256sum -c, aus diesem Verzeichnis).
switch-and-learn-event-drill-failed =
    Der Job läuft, aber restic ist nie bis zum Ende gekommen: Lies, was er
    ausgibt (führ das Skript von Hand aus, als root).
switch-and-learn-event-drill =
    Die Übung, so ausgeführt, wie cron oder der Timer sie ausführen werden,
    stellt den neuesten Snapshot daneben wieder her und prüft den Dump gegen
    seine SHA-256.
switch-and-learn-event-end =
    Teuila: „Die Website ist zurück, die Nachbetrachtung liegt auf dem Tisch
    des Vorstands, und die nächste Übung steht im Kalender. Danke. Wirklich.“

    Gut gemacht! Du hast „Das Tierheim“ abgeschlossen, und damit die letzte
    Geschichte der Sysadmin-Quests.

    WAS PASSIERT IST
    zuflucht lieferte die Website von innen aus; du hast seine Firewall für
    das Web geöffnet und von außen geprüft, bevor du den Namen angefasst
    hast. Dann ist www in der Zone umgezogen, mit einer gestiegenen
    Seriennummer, damit der Server des Registrars folgt, und die im Voraus
    gesenkte TTL von fünf Minuten ließ die alte Antwort schnell verblassen.
    Die Nachbetrachtung erzählt die Nacht ohne Schuldzuweisung, mit
    Maßnahmen und Verantwortlichen, und die nächste Übung wird jeden Monat
    von selbst wiederherstellen und prüfen.

    GUTE PRAXIS
    - Zuletzt umschalten: Der neue Dienst funktioniert zuerst von außen,
      dann zieht der Name um.
    - Senke die TTL lange, bevor du umziehen musst (Tage, nicht Minuten): Die
      alte TTL ist, woran sich die Caches erinnern.
    - Eine Änderung der Zone braucht eine höhere Seriennummer, sonst behalten
      die Secondaries die alte Zone.
    - Eine Nachbetrachtung ohne Schuldzuweisung: Zeitleiste aus den Logs,
      Auswirkungen, was geholfen hat, was sich ändern muss, Maßnahmen mit
      einer verantwortlichen Person und einem Datum.
    - Eine Übung, die nicht wiederherstellt, testet nichts: Stell daneben
      wieder her, prüfe (Prüfsummen, Zählungen), miss die Zeit und schreib
      das Ergebnis in den Plan.
    - Der Plan ist ein lebendes Dokument: Jeder neue Dienst, jede Übung,
      jeder Vorfall ändert ihn.

    Seit dem ersten Befehl beim Radierer hast du Dateien gelistet, Logs
    gelesen, Ports geöffnet und geschlossen, signiert, verschlüsselt,
    wiederhergestellt. Diese letzte Nacht hat alles zusammengebracht: einen
    Plan, die Backups, die er versprochen hat, einen Neuaufbau in der
    richtigen Reihenfolge, ein ruhiges Umschalten und die Lehren,
    aufgeschrieben für die nächste Person. Das ist das Handwerk, mehr als
    irgendein einzelner Befehl. Halte deine Pläne wahr, übe weiter, und sei
    freundlich in deinen Nachbetrachtungen. Danke fürs Spielen.

    DOKUMENTATION
    - NIST SP 800-34 Rev. 1 (Tests, Übungen und Pflege des Plans): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
    - BIND 9, Zonendateien und die Seriennummer des SOA: https://bind9.readthedocs.io/en/stable/chapter3.html
    - RFC 1034, Caching und TTL: https://www.rfc-editor.org/rfc/rfc1034#section-4.3.5
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - Google SRE Book, Postmortem-Kultur: https://sre.google/sre-book/postmortem-culture/
    - restic, wiederherstellen: https://restic.readthedocs.io/en/stable/050_restore.html
