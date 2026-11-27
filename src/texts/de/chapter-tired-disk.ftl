### Geschichte „Das Labor“, Kapitel 1 „Die müde Platte“: SMART,
### Software-RAID (mdadm), eine Platte aus ihren Arrays nehmen. Befehle,
### Optionen, Pfade und Ausgaben (smartctl, mdadm, /proc/mdstat) werden
### nicht übersetzt. Enthält auch die Texte, die die Geschichte teilt
### (lab-…).

chapter-tired-disk = Die müde Platte
    .summary = smartd macht sich Sorgen um eine Platte: Lies, was SMART wirklich sagt, versteh das RAID des Servers, nimm die kranke Platte aus ihren Arrays und fordere ihren Austausch über ihre Seriennummer an.

## Von der Geschichte geteilt

lab-procedure-host =
    Austausch einer defekten Platte — dedizierte Server

    1. Bevor Sie uns schreiben, entfernen Sie die Platte aus Ihren
       Software-RAID-Arrays (mdadm): Wir ziehen sie bei laufendem Server,
       und eine noch benutzte Platte könnte das Array beschädigen.
    2. Nennen Sie uns in Ihrer Anfrage die Seriennummer (S/N) der zu
       tauschenden Platte, und nur diese: Die Namen sda oder sdb können
       sich von einem Bootvorgang zum nächsten ändern, die Seriennummer
       nicht (smartctl -i oder lsblk -o zeigen sie). Geben Sie dazu die
       Zahl der umgelagerten Sektoren der Platte an (den Rohwert des
       SMART-Attributs 5, Reallocated_Sector_Ct): Ein Gesamturteil genügt
       uns nicht.
    3. Wir greifen innerhalb von 24 Stunden ein. Die neue Platte wird leer
       geliefert: Es ist an Ihnen, sie zu partitionieren und Ihr RAID neu
       aufzubauen.
lab-syslog =
    Nov 11 03:12:44 labor smartd[588]: Device: /dev/sdb [SAT], 8 Currently unreadable (pending) sectors
    Nov 11 03:42:44 labor smartd[588]: Device: /dev/sdb [SAT], 8 Offline uncorrectable sectors
    Nov 13 03:00:12 labor smartd[588]: Device: /dev/sdb [SAT], starting scheduled Short Self-Test.
    Nov 13 03:02:44 labor smartd[588]: Device: /dev/sdb [SAT], previous self-test completed with error (read test element)
    Nov 13 03:12:44 labor smartd[588]: Device: /dev/sdb [SAT], 8 Currently unreadable (pending) sectors

# Die Startseite der Galerie (/var/www/gallery/index.html).
lab-gallery-index = <!doctype html><title>Das Labor</title>

## Dateien

tired-disk-message-odile =
    Eine Nachricht von Odile, Vorsitzende des Labors, des Fotoclubs im
    Viertel (Samstag, 7:30 Uhr):

    „Hallo, und danke, dass du den Server des Clubs übernimmst! Ich kenne
    mich nicht gut aus, aber seit Donnerstag bekomme ich seltsame E-Mails
    von ‚smartd‘ über eine Platte. Ich habe sie dir weitergeleitet: Der
    Befehl mail listet sie auf, und sie liegen in /var/mail/du. Die
    Galerie war letzte Nacht auch sehr langsam.

    Der Server ist bei einem Hoster gemietet. Laut dem früheren
    Ehrenamtlichen hat er zwei Platten ‚im RAID‘, damit wir nichts
    verlieren, wenn eine ausfällt. Wenn eine Platte getauscht werden muss,
    macht der Hoster das kostenlos: Sein Verfahren steht in
    hoster_verfahren.txt. Schreib die Anfrage in ~/ticket.txt, ich schicke
    sie von unserem Kundenkonto aus.

    Für sudo: film-2027.“

## Ereignisse

tired-disk-event-alert =
    smartd und der Kernel sprechen von derselben Platte: sdb. Sektoren,
    die sie nicht mehr lesen kann (pending), und Lesevorgänge, die das
    RAID auf der anderen Platte wiederholen musste (redirecting … to other
    mirror). Bevor du einen Schluss ziehst, schau dir an, wie die Platten
    zusammengesetzt sind: cat /proc/mdstat.
tired-disk-event-arrays =
    Zwei RAID-1-Arrays: md0 (das System, /) mit sda2 und sdb2, und md1
    (die Fotos, /srv) mit sda3 und sdb3. [UU]: Im Moment sind beide Kopien
    da. Jede Platte ist also in beiden Arrays. Was sagt SMART über sdb,
    und zum Vergleich über sda? (man smartctl)
tired-disk-event-smart =
    „PASSED“… und doch: über tausend umgelagerte Sektoren, 8 ausstehende,
    37 Fehler in ihrem Log. Das Gesamturteil kippt erst bei der Schwelle
    des Herstellers; eine Zahl umgelagerter Sektoren, die immer weiter
    steigt, kündigt den Ausfall an. Vergleich mit sda: überall null. sdb
    muss beide Arrays verlassen, bevor sie getauscht wird (man mdadm:
    --fail, dann --remove).
tired-disk-event-busy =
    mdadm lehnt ab: Ein aktives Mitglied entfernt man nicht aus einem
    Array („Device or resource busy“). Erklär es zuerst für defekt
    (--fail), dann entferne es (--remove); beides passt in denselben
    Befehl.
tired-disk-event-healthy =
    Vorsicht: Du hast gerade ein Mitglied von sda, der GESUNDEN Platte,
    aus seinem Array genommen! Es steht jetzt nur noch auf sdb, der, die
    verschleißt. Entferne es (--remove), und füg es dann wieder hinzu
    (--re-add): Es wird auf den neuesten Stand gebracht, und das Array
    bekommt seine gesunde Kopie zurück. Erst dann kümmere dich um sdb.
# { $partition }: die noch vorhandene Partition von sdb; { $array }: ihr Array
tired-disk-event-half =
    Ein Array ist fertig. Aber sdb ist auch im anderen: { $partition } ist
    noch Teil von { $array }. Eine Platte, die getauscht wird, verlässt
    alle ihre Arrays.
tired-disk-event-removed =
    sdb ist in keinem Array mehr: /proc/mdstat zeigt bei beiden [U_]. Der
    Server läuft nur noch auf sda, ohne Sicherheitsnetz: Die Platte muss
    schnell getauscht werden. Bleibt das Ticket, ~/ticket.txt, mit dem, was
    das Verfahren des Hosters verlangt.
# { $file }: der Name des Tickets
tired-disk-event-ticket-false =
    Das Ticket enthält die Seriennummer von sda: Das ist die GESUNDE
    Platte! Der Hoster würde die einzige Platte ziehen, die noch
    funktioniert. Korrigiere { $file }: nur die Seriennummer von sdb.
# { $file }: der Name des Tickets
tired-disk-event-ticket-count =
    { $file } nennt die Seriennummer von sdb, aber der Hoster verlangt
    auch die Zahl ihrer umgelagerten Sektoren: die Zahl, die zeigt, dass
    die Platte versagt, was auch immer ihr Gesamturteil sagt.
tired-disk-event-ticket =
    Das Ticket nennt die Seriennummer der zu tauschenden Platte und die
    umgelagerten Sektoren, die den Tausch begründen. Odile schickt es,
    sobald die Platte aus ihren Arrays heraus ist.
tired-disk-event-end =
    Odile: „Abgeschickt! Der Hoster antwortet, dass er die Platte heute
    Nacht tauscht.“

    Gut gemacht! Du hast Kapitel 1 von „Das Labor“ abgeschlossen. (Was als
    Nächstes kommt, wartet auf dich: ssh labor.)

    WAS PASSIERT IST
    Die Platte sdb verschliss: unlesbare Sektoren, die smartd seit zwei
    Tagen meldete und die das RAID ausglich, indem es die andere Platte
    las. Trotzdem sagte SMART PASSED: Sein Gesamturteil kippt erst bei der
    Schwelle des Herstellers, oft zu spät. Du hast die Attribute beider
    Platten verglichen, sdb aus ihren zwei Arrays genommen und ihren
    Austausch über ihre Seriennummer angefordert.

    GUTE PRAXIS
    - smartd laufen lassen, und seine E-Mails lesen: Die Mail von root muss
      bei jemandem ankommen (/etc/aliases).
    - Eine Platte nach ihren Attributen (5, 197, 198) und deren Verlauf
      beurteilen, nicht nach PASSED.
    - Vor einem Austausch: --fail, dann --remove, in jedem Array der
      Platte.
    - Eine Platte über ihre Seriennummer benennen, nie über sda oder sdb,
      die sich von einem Bootvorgang zum nächsten ändern können.
    - RAID ist kein Backup: Es schützt vor dem Ausfall einer Platte, nicht
      vor einer Löschung, Ransomware oder einem Brand.

    DOKUMENTATION
    - smartctl: https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in
    - mdadm: https://man7.org/linux/man-pages/man8/mdadm.8.html
    - Software-RAID unter Linux (md): https://docs.kernel.org/admin-guide/md.html
