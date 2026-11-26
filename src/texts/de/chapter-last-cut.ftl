### Geschichte „Die Kletterhalle“, Kapitel „Der letzte Ausfall“: Nach einem
### Stromausfall ist der Server der Halle abgestürzt, statt herunterzufahren.
### Network UPS Tools (upsc, upsmon, MONITOR, MINSUPPLIES, SHUTDOWNCMD,
### upsmon -c fsd) und die Power-Restore-Policy des Servers (ipmitool chassis
### policy). Befehle, Optionen, Pfade, Konfigurationszeilen und Ausgaben
### werden nicht übersetzt.

chapter-last-cut = Der letzte Ausfall
    .summary = Ein Sturm hat der Kletterhalle anderthalb Stunden lang den Strom genommen. Der Server hing an einer USV, die genau dafür gekauft wurde, und ist trotzdem gestorben wie bei gezogenem Stecker. Finde heraus, warum er die USV nie gehört hat, bring ihn dazu, zuzuhören, und beweise es mit einer echten Übung.

## Files

last-cut-message-nkechi =
    Von: Nkechi (Vorsitz, Kletterhalle Overhang)
    Donnerstag, 18. November, 21:40

    Hallo, und danke, dass du nach Feierabend noch bleibst!

    Am Dienstagabend hat der Sturm in der ganzen Straße von 19:42 bis 21:05
    den Strom abgeschaltet. Die Notbeleuchtung ging an, wir haben alle von
    den Wänden geholt, und die USV im Büroschrank hat fast eine Stunde lang
    tapfer gepiept. Dann wurde sie still, und sicherung (unser Server:
    Buchungen, Mitgliedschaften, die Badges der Tür) ist mit ihr gestorben.
    Als der Strom zurückkam, ist er von selbst wieder angelaufen, aber die
    Buchungsdatenbank musste repariert werden, und die Einträge des Abends
    sind verloren.

    Die USV ist genau dafür da, dass sicherung sauber herunterfährt, bevor
    die Batterie leer ist. Haruto hat das alles 2028 eingerichtet; er lebt
    jetzt in Sapporo, hat aber Notizen in deinem Home-Verzeichnis gelassen.

    Die Halle ist bis morgen 10:00 geschlossen, heute Abend darfst du es
    also wirklich testen: Ikaika, unser ehrenamtlicher Elektriker, ist im
    Büro, falls ein Knopf gedrückt werden muss. sudo geht mit deinem
    Passwort.

    Nkechi

last-cut-notes-haruto =
    Notizen von Haruto (sicherung, 2028, zuletzt aktualisiert 2030)

    - Die USV spricht mit sicherung über USB. Network UPS Tools (NUT, die
      Debian-Pakete nut-server und nut-client) hat drei Schichten: den
      Treiber (nut-driver@NAME, für die USV namens NAME in
      /etc/nut/ups.conf), upsd (nut-server: stellt die Daten der USV bereit)
      und upsmon (nut-monitor: beobachtet upsd und fährt sicherung herunter,
      wenn die Batterie zur Neige geht).
    - upsc listet, was upsd weiß: upsc -l für die Namen der USVs, upsc NAME
      für alles, was eine USV sagt.
    - 2030: Die alte Eaton ist gestorben, wir haben eine APC Back-UPS RS 1500
      gekauft. Ich habe ihren Abschnitt in ups.conf in etwas
      Aussagekräftigeres umbenannt.
    - upsmon hat das Journal ständig mit „Poll UPS failed“-Zeilen gefüllt;
      ich habe ihn in upsmon.conf leiser gemacht
      (POLLFAIL_LOG_THROTTLE_MAX).
    - Um das Herunterfahren zu testen, sagt die Doku von NUT: upsmon -c fsd.
      Das ist ein ECHTES Herunterfahren: sicherung hält an, dann schaltet die
      USV ihre Steckdosen kurz ab. Nur wenn die Halle geschlossen ist!
    - Das Board des Servers hat einen BMC: ipmitool funktioniert als root.

## Events

last-cut-event-blind =
    upsmon fragt eine USV namens eaton auf localhost ab, und upsd antwortet,
    dass es sie nicht gibt. Seit 2030 hat die einzige USV, die upsd kennt,
    einen anderen Namen. Eine USV, von der upsmon nie etwas gehört hat, ist
    für ihn nie „auf Batterie“, also hat er am Dienstag stillgehalten, bis
    die Batterie leer war. Welche USV stellt upsd bereit? (man upsc)

last-cut-event-renamed =
    Da ist sie: upsd stellt eine USV bereit, unter dem Namen ihres
    Abschnitts in /etc/nut/ups.conf. Die MONITOR-Zeile von upsmon muss sie
    genau so nennen, als NAME@HOST (man upsmon.conf).

last-cut-event-minsupplies =
    MINSUPPLIES sagt, wie viele Netzteile gesund bleiben müssen, damit
    upsmon die Maschine laufen lässt. Bei 0 findet upsmon nie zu wenige: Er
    fährt sicherung nie herunter, egal was die Batterie sagt. sicherung hat
    ein Netzteil: MINSUPPLIES 1.

last-cut-event-no-shutdown =
    Das SHUTDOWNCMD in upsmon.conf hält die Maschine nicht mehr an. Wenn die
    Batterie zur Neige geht, würde upsmon es ausführen, und sicherung würde
    weiterlaufen, bis die USV ausgeht: genau der Absturz vom Dienstag. Der
    Standard von Debian ist „/sbin/shutdown -h +0“.

last-cut-event-monitor-down =
    nut-monitor (upsmon) läuft nicht oder startet beim nächsten Booten nicht.
    Ohne upsmon beobachtet niemand die USV: Er muss aktiv und aktiviert sein
    (systemctl status nut-monitor, systemctl enable --now).

last-cut-event-killed =
    upsdrvctl shutdown schickt der USV ihren „kill power“-Befehl: Nach
    offdelay Sekunden schaltet sie ihre Steckdosen ab, egal was dahinter noch
    läuft. NUT macht das selbst ganz am Ende eines Herunterfahrens, wenn die
    Maschinen angehalten sind; von Hand getippt zieht es sicherung den
    Stecker.

last-cut-event-watching =
    upsmon beobachtet jetzt hallups: bei upsd als primary angemeldet (upsc -c
    hallups listet ihn als Client, und das Journal sagt „UPS: … (primary)“).
    Auf Batterie, dann bei schwacher Batterie, wird er warnen, sicherung
    herunterfahren und der USV sagen, dass sie abschalten und
    wiederkommen soll.

last-cut-event-blind-drill =
    Die Übung hat sicherung heruntergefahren… aber upsmon beobachtete immer
    noch die USV, die es nicht gibt: Er hat versucht, „forced shutdown“ auf
    ihr zu setzen, ist gescheitert und hat sicherung trotzdem angehalten.
    upsmon -c fsd testet das Herunterfahren, nicht die Erkennung: Bei einem
    echten Ausfall hätte dieser upsmon immer noch nichts gesehen. Korrigiere
    zuerst die MONITOR-Zeile, dann übe noch einmal.

last-cut-event-drill =
    Die Übung lief, wie sie sollte: upsmon hat FSD auf der USV gesetzt,
    sicherung ist sauber heruntergefahren, und ganz am Ende hat die USV ihre
    Steckdosen kurz abgeschaltet (journalctl -b -1: das Ende des vorherigen
    Boots).

last-cut-event-stayed-off =
    Aber sicherung ist nicht von selbst wiedergekommen: Ikaika musste den
    Einschaltknopf drücken. Die Power-Restore-Policy der Firmware ist
    „previous“: Sie schaltet bei Stromrückkehr nur ein, wenn die Maschine
    lief, als der Strom wegging. Am Dienstag ist sie im Betrieb abgestürzt,
    also kam sie wieder; heute Abend war sie sauber heruntergefahren, also
    blieb sie aus. Bei einem Ausfall um 3 Uhr nachts drückt niemand den
    Knopf. Schau dir ipmitool chassis status an (man ipmitool).

last-cut-event-policy =
    Power Restore Policy: always-on. Sobald die USV ihre Steckdosen
    zurückgibt, startet sicherung. Eine neue Übung wird es zeigen.

last-cut-event-end =
    Nkechi: „Ikaika sagt, die USV hat geklickt, wurde still, und sicherung
    kam zwei Minuten später von selbst wieder. Die beste Show, die wir je im
    Büro hatten.“

    Gut gemacht! Du hast „Der letzte Ausfall“ abgeschlossen.

    WAS PASSIERT IST
    upsmon beobachtete eaton@localhost, den Namen einer 2030 ersetzten USV:
    upsd antwortete „does not exist“, und eine USV, von der upsmon nie etwas
    gehört hat, ist für ihn nie auf Batterie. Am Dienstag lief die Batterie
    leer und sicherung stürzte ab. Du hast upsmon hallups als primary
    beobachten lassen und dann mit upsmon -c fsd geübt: FSD auf der USV, ein
    sauberes Herunterfahren und ganz am Ende das kill power der USV
    (POWERDOWNFLAG von upsmon, dann upsdrvctl shutdown aus den
    Shutdown-Skripten). Nach einem sauberen Herunterfahren hielt die Policy
    „previous“ der Firmware sicherung aus: always-on bringt sie mit dem Strom
    zurück.

    GUTE PRAXIS
    - Prüfe die Kette von Ende zu Ende: upsc -l (welche Namen upsd
      bereitstellt), upsc -c USV (ist upsmon angemeldet?), das Journal von
      nut-monitor (kein „Poll UPS failed“).
    - Bring nie einen Fehler zum Schweigen, den du nicht verstanden hast: Das
      Drosseln von „Poll UPS failed“ hat diesen zwei Jahre lang versteckt.
    - MINSUPPLIES 1 und ein echtes SHUTDOWNCMD: Es gibt keine „sichere“
      Einstellung, die das Herunterfahren abschaltet; das ist genau der
      Absturz, den du vermeiden wolltest.
    - Übe, wenn niemand die Maschine braucht: upsmon -c fsd fährt wirklich
      herunter, und die USV schaltet ihre Steckdosen wirklich ab. Die
      Erkennung testet es nicht: Dafür liest du die Logs, oder du ziehst den
      Stecker der USV (mit einer Elektrofachkraft).
    - Maschinen hinter einer USV, die abschaltet und den Strom zurückgibt,
      brauchen „power on when AC returns“ (always-on) in ihrer Firmware.
    - NUT 2.8 hat master und slave in primary und secondary umbenannt; die
      alten Wörter gehen noch, die neuen sind klarer.

    DOKUMENTATION
    - upsmon(8): https://networkupstools.org/docs/man/upsmon.html
    - upsmon.conf(5): https://networkupstools.org/docs/man/upsmon.conf.html
    - upsc(8): https://networkupstools.org/docs/man/upsc.html
    - Herunterfahren testen (upsdrvctl -t shutdown, dann upsmon -c fsd): https://networkupstools.org/docs/user-manual.chunked/Configuration_notes.html
    - ipmitool: https://codeberg.org/IPMITool/ipmitool

## What the three chapters of the story share: kept here so that they load with the story.

climbing-wall-archive-readme =
    harness: das NAS von Overhang (Akosua)
    /srv/archive/photos: die Fotos der Wettkämpfe und der Kurse
    /srv/archive/waivers: die unterschriebenen Haftungsverzichte (Scans), fünf Jahre aufbewahrt
    Per Samba für das Büro und den Empfang freigegeben.
