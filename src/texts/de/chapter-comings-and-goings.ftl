### Geschichte „Der Zettelkatalog“, Kapitel „Kommen und Gehen“: Ein neuer
### Bibliothekar fängt am Montag an, eine andere Person ist heute gegangen.
### Die gemeinsamen Texte der Geschichte (Tomas' Übergabe, die
### Konventionen) stehen auch hier. Befehle, Cmdlets, Kontonamen, DNs,
### Pfade, Passwörter und Ausgaben werden nicht übersetzt.

chapter-comings-and-goings = Kommen und Gehen
    .summary = Dein erster Freitag auf dem Domänencontroller der Bibliotheken: das Konto des Bibliothekars anlegen, der am Montag anfängt, mit den Rechten seiner Stelle und nicht mehr, und das Konto der Person schließen, die heute gegangen ist, ohne es zu löschen.

## Die gemeinsamen Dateien der Geschichte

card-catalogue-handover =
    register - Übergabenotizen (Tomas, 20. Dezember 2029)

    Die Domäne: lending.internal (NetBIOS-Name LENDING), drei
    Bibliotheken: Central, Riverside, Hilltop.
      - register.internal (192.0.2.46): der Domänencontroller, Windows
        Server 2022 (Active Directory, DNS). OpenSSH landet hier in
        PowerShell, mit deinem Schlüssel. Das Modul ActiveDirectory ist
        installiert: Get-Command -Module ActiveDirectory.
      - regale (192.0.2.47): der Dateiserver (Freigaben Staff, Events,
        Archives, Finance, Scans). Von register aus: ssh regale (dein
        Schlüssel liegt in %USERPROFILE%\.ssh und ist dort autorisiert).

    Du bist in Domain Admins: jedes Konto, jede Gruppe, jeder Server.
    Geh behutsam damit um. Lies Documents\konventionen.txt, bevor du
    etwas anlegst.

    Was ich nicht fertig bekommen habe:
      - svc_scans (OU=Service Accounts): im Dezember angelegt, um Rafaels
        Konto in der Scan-Importaufgabe auf regale zu ersetzen. Noch nicht
        umgestellt. Sein Passwort ist im Tresor (Nandini kann es
        exportieren).
      - Das Laufwerk Events (GPO „Events Drive“) ist nur dort verknüpft,
        wo ich es getestet habe.
      - Ein Aufräumen alter Konten (manche haben sich seit Monaten nicht
        angemeldet).

    Viel Erfolg. Ich bin jetzt in der IT-Abteilung der Stadt, du kannst
    anrufen.
    Tomas

card-catalogue-conventions =
    LENDING - wie die Domäne organisiert ist (Tomas)

    KONTEN
      - Name (sAMAccountName): erster Buchstabe des Vornamens + Nachname,
        kleingeschrieben, ohne Akzente: Thanh Nguyen -> tnguyen.
      - Vollständiger Name (Name, CN): „Vorname Nachname“. GivenName und
        Surname ausgefüllt.
      - Wo: OU=<Zweigstelle>,OU=Branches,DC=lending,DC=internal
        (Central, Riverside oder Hilltop).
      - Department, Title und Manager: so, wie die Personalabteilung sie
        ins Ticket schreibt.
      - Erstes Passwort: von uns gewählt, von der vorgesetzten Person am
        ersten Morgen persönlich übergeben, bei der ersten Anmeldung zu
        ändern. Die Domäne will mindestens 10 Zeichen, drei Arten
        (Großbuchstaben, Kleinbuchstaben, Ziffern, Sonderzeichen) und
        nicht den Namen der Person.

    GRUPPEN (AGDLP)
      - A für Accounts (Konten) kommen in G für globale Gruppen, eine pro
        Abteilung: GG_Lending, GG_Children, GG_LocalHistory, GG_Management.
      - Globale Gruppen kommen in DL für domänenlokale Gruppen, eine pro
        Freigabe und Stufe: DL_Staff_RW, DL_Events_RW, DL_Archives_RW,
        DL_Archives_RO, DL_Finance_RW.
      - P für Permissions (Berechtigungen): Nur DL_-Gruppen erscheinen in
        den NTFS-Berechtigungen von regale.
      - Eine Person kommt also in die GG_-Gruppe ihrer Abteilung, und
        nirgendwo sonst. Ausnahmen stehen im Ticket des Kontos.

    AUSSCHEIDENDE
      - Ein Jahr lang nie gelöscht: Ihre SID besitzt Dateien auf regale,
        ihr Postfach ist archiviert, die Prüfer·innen fragen vielleicht.
      - Am letzten Tag: deaktiviert, nach OU=Leavers verschoben, aus ihren
        Gruppen genommen. Die Beschreibung sagt, wann sie gegangen sind.

    GRUPPENRICHTLINIEN
      - Eine GPO wird mit der OU dessen verknüpft, wofür sie ist:
        OU=Branches für das Personal, OU=Servers für die Server. Die
        Wurzel der Domäne trägt nur die Default Domain Policy.
      - Wer sie bekommt: Sicherheitsfilterung mit denselben Gruppen wie
        die Freigabe, um die es geht (GG_-Gruppen oder die DL_-Gruppe der
        Freigabe).

    DIENSTKONTEN
      - svc_*, in OU=Service Accounts: eines pro Aufgabe, nie das Konto
        einer Person. Manche laufen nur ein paarmal im Jahr.

## Dateien

comings-and-goings-email-nandini =
    Von:  Nandini Mukherjee (Leitung des Bibliotheksverbunds)
    An:   dich

    Hallo, und willkommen!

    Zwei Personaltickets für dich vor dem Wochenende, beide in deinen
    Documents:

      - pers-0112-eintritt.txt: Kofi Mensah fängt am Montag in Riverside
        an. Ines gibt ihm um 9:00 sein Passwort.
      - pers-0113-austritt.txt: Mateo Rossi hat Hilltop heute verlassen.
        Sein letzter Tag ist gut gelaufen; wir bleiben in Kontakt.

    Tomas' Konventionen stehen in Documents\konventionen.txt. Schönes
    Wochenende!

    Nandini

comings-and-goings-ticket-arrival =
    Personalticket 0112 - EINTRITT
    Eröffnet am 2. Januar 2030 von der Personalabteilung (Rebecca Owusu)

    Name:          Kofi Mensah
    Beginn:        Montag, 7. Januar 2030
    Zweigstelle:   Riverside
    Department:    Children
    Title:         Youth Librarian
    Manager:       Ines Duarte (iduarte)

    Zugänge: „dieselben wie Amara Okoye, gleiche Stelle, gleiche
    Zweigstelle“. Wenn es einfacher ist, kopiert Amaras Konto.

    Ausnahmen: keine.

comings-and-goings-ticket-departure =
    Personalticket 0113 - AUSTRITT
    Eröffnet am 4. Januar 2030 von der Personalabteilung (Rebecca Owusu)

    Name:          Mateo Rossi (mrossi)
    Letzter Tag:   Freitag, 4. Januar 2030
    Zweigstelle:   Hilltop
    Department:    Lending

    Bitte schließt seine Zugänge heute Abend. Seine Dateien auf der
    Freigabe Staff bleiben, wo sie sind: Bongani sortiert sie.

## Ereignisse

comings-and-goings-event-ous =
    Der Baum der Domäne: OU=Branches enthält eine OU pro Bibliothek, dort
    leben die Leute; Groups, Leavers, Servers, Service Accounts und
    Workstations daneben. Ein DN liest sich vom Objekt hinauf bis zur
    Domäne, wie in „Das Verzeichnis“: Kofis wäre
    CN=Kofi Mensah,OU=Riverside,OU=Branches,DC=lending,DC=internal.
comings-and-goings-event-colleague =
    Amara ist mehr als eine Jugendbibliothekarin: Sie ist in
    GG_Management (kommissarische Stellvertretung in Riverside seit dem
    Herbst) und direkt in DL_Finance_RW, eine Ausnahme, solange sie das
    Budget übernimmt. „Dieselben wie Amara“ würde Kofi an seinem ersten Tag
    die Finanzfreigabe geben. Gib ihm die Gruppe seiner Stelle, nicht die
    Geschichte seiner Kollegin.
comings-and-goings-event-agdlp =
    Da ist es, AGDLP: DL_Events_RW, die Gruppe in den NTFS-Berechtigungen
    der Freigabe, enthält keine Personen, sondern globale Gruppen,
    GG_Children und GG_Management. Ein neuer Jugendbibliothekar braucht
    nur GG_Children: Die Verschachtelung erledigt den Rest.
comings-and-goings-event-complexity =
    Abgelehnt: Die Passwortrichtlinie der Domäne (Default Domain Policy)
    will mindestens 10 Zeichen, drei Arten von Zeichen und nichts vom
    Kontonamen oder vom Namen der Person darin. Vorsicht: New-ADUser hat
    das Konto trotzdem angelegt, ohne Passwort und deaktiviert. Gib ihm
    ein Passwort mit Set-ADAccountPassword -Reset, oder lösch dieses
    halbfertige Konto und fang neu an.
comings-and-goings-event-other-name =
    Dieses Konto ist nicht so benannt, wie es die Konventionen sagen:
    erster Buchstabe des Vornamens und der Nachname, kleingeschrieben,
    kmensah. Jedes Skript und alle Kolleg·innen werden kmensah suchen.
    Benenne es um (Set-ADUser -SamAccountName, und sein
    UserPrincipalName), oder entferne es und leg es neu an.
comings-and-goings-event-created =
    Kofis Konto existiert. Prüfe es so, wie das Ticket es sagt: Get-ADUser
    kmensah -Properties Department, Title, Manager, Enabled.
comings-and-goings-event-created-disabled =
    Das Konto ist deaktiviert: New-ADUser legt ein deaktiviertes Konto an,
    außer es bekommt ein Passwort, das die Domäne annimmt, und -Enabled
    $true. Enable-ADAccount, sobald es ein Passwort hat.
comings-and-goings-event-wrong-ou =
    Kofi ist nicht in OU=Riverside,OU=Branches: Die Richtlinien und
    Delegierungen der Zweigstelle erreichen ihn dort nicht. Move-ADObject
    verschiebt ein Objekt in eine andere OU (-TargetPath, ein DN).
comings-and-goings-event-copied =
    Kofi hat jetzt Amaras Extras: GG_Management, oder DL_Finance_RW, die
    Budgets und Rechnungen. Das ist die Falle beim Kopieren einer
    Kollegin: Du kopierst ihre Geschichte, ihre Ausnahmen, ihre
    kommissarischen Rollen, nicht ihre Stelle. Nimm ihn aus diesen
    Gruppen heraus (Remove-ADGroupMember, oder
    Remove-ADPrincipalGroupMembership).
comings-and-goings-event-direct-dl =
    Kofi ist direkt in einer DL_-Gruppe. Heute funktioniert es, aber die
    Konventionen sagen AGDLP: Personen nur in GG_-Gruppen, GG_-Gruppen in
    DL_-Gruppen. Eine Person in einer DL_-Gruppe ist eine Ausnahme, die
    niemand sieht, wenn sich die Rechte der Abteilung ändern. Nimm ihn
    heraus und steck ihn in GG_Children.
comings-and-goings-event-admin =
    Kofi ist jetzt Admin der Domäne oder ihrer Server. Ein
    Jugendbibliothekar braucht Vorlesestunden, nicht die Schlüssel zu
    jedem Konto. Nimm ihn sofort aus dieser Gruppe heraus.
comings-and-goings-event-no-change =
    Kofis Konto hat ein Passwort, aber er muss es nicht ändern: Das
    Passwort, das du gewählt hast und das Ines auf Papier übergibt, bliebe
    seins. Set-ADUser kmensah -ChangePasswordAtLogon $true.
comings-and-goings-event-details =
    Fast: Vergleiche das Konto Feld für Feld mit dem Ticket: GivenName,
    Surname, Department, Title, Manager (Get-ADUser kmensah -Properties
    Department, Title, Manager). Set-ADUser korrigiert, was abweicht.
comings-and-goings-event-arrival =
    Kofi ist bereit für Montag: in seiner Zweigstelle, nur die Gruppe
    seiner Stelle, ein erstes Passwort, das er um 9:01 ändern wird. Jetzt
    Mateo.
comings-and-goings-event-deleted =
    Mateos Konto ist weg. Mit ihm ist seine SID gegangen: Die Dateien, die
    ihm auf regale gehören, zeigen jetzt einen unbekannten Besitzer
    S-1-5-21-…, die Frage der Prüfer·innen „Wer hatte im Dezember
    Zugriff?“ hat keine Antwort, und ein neues Konto mit demselben Namen
    wäre jemand anderes, mit einer anderen SID. Zum Glück hat Tomas den
    AD-Papierkorb eingeschaltet (Get-ADOptionalFeature 'Recycle Bin
    Feature'): Das Konto wartet vollständig in CN=Deleted Objects. Finde
    es mit Get-ADObject -IncludeDeletedObjects, hol es mit
    Restore-ADObject zurück (Get-Help Restore-ADObject -Examples) und
    schließ es dann so, wie es die Konventionen sagen.
comings-and-goings-event-restored =
    Mateo ist zurück, wo er war, mit derselben SID, seinen Attributen und
    sogar seinen Gruppen: Der Papierkorb bewahrt die Verknüpfungswerte
    auf. Deshalb ist seine Gruppe wieder da. Jetzt: deaktiviert, aus
    seinen Gruppen heraus, in Leavers.
comings-and-goings-event-leaver-disabled =
    Mateos Konto ist deaktiviert: Niemand kann sich mehr damit anmelden,
    und es existiert weiter, mit seiner SID. Wozu gehört es jetzt noch?
comings-and-goings-event-leaver-groups =
    Mateo ist aus seinen Gruppen heraus: Wenn jemand das Konto eines Tages
    versehentlich aktivierte, würde es nichts öffnen. Noch eins: die OU,
    in der Ausscheidende warten.
comings-and-goings-event-leaver-groups-moved =
    Mateo ist aus seinen Gruppen heraus, in OU=Leavers.
comings-and-goings-event-leaver-moved =
    Mateo ist in OU=Leavers, aber immer noch in seinen Gruppen: GG_Lending
    führt ihn noch. Get-ADPrincipalGroupMembership mrossi sagt, in welchen
    (Domain Users, seine primäre Gruppe, bleibt).
comings-and-goings-event-end =
    Nandini: „Kofi fängt am Montag an, Mateo ist geschlossen. Danke, und
    schönes Wochenende!“

    Gut gemacht! Du hast das Kapitel „Kommen und Gehen“ abgeschlossen.

    WAS PASSIERT IST
    Zwei Personaltickets an einem Freitag. Du hast Kofis Konto dort
    angelegt, wo die Domäne es erwartet (OU=Riverside,OU=Branches), mit
    dem, was das Ticket sagt (Department, Title, Manager), einem ersten
    Passwort, das er ändern muss, und einer Gruppe, GG_Children: der
    seiner Abteilung. Du hast Mateos Konto geschlossen, ohne es zu
    löschen: deaktiviert, aus seinen Gruppen heraus, nach OU=Leavers
    verschoben.

    AGDLP
    Konten (Accounts) kommen in globale Gruppen (eine pro Abteilung, GG_),
    globale Gruppen in domänenlokale Gruppen (eine pro Freigabe und Stufe,
    DL_), und nur domänenlokale Gruppen bekommen Berechtigungen
    (Permissions) auf die Dateien. Wenn sich die Rechte einer Abteilung
    ändern, änderst du eine Verschachtelung, nicht vierzig Konten; wenn
    jemand dazukommt, genügt eine Gruppe. Eine Kollegin zu kopieren kopiert
    ihre Ausnahmen mit ihrer Stelle: Geh von der Stelle aus.

    WIE „DAS VERZEICHNIS“, IN ACTIVE DIRECTORY
    Active Directory ist ein LDAP-Verzeichnis: Kofis DN,
    CN=Kofi Mensah,OU=Riverside,OU=Branches,DC=lending,DC=internal,
    liest sich wie uid=…,ou=…,dc=… in OpenLDAP, und die LDAP-Filter, die
    du mit ldapsearch geschrieben hast, funktionieren auch hier:
    Get-ADUser -LDAPFilter '(&(department=Children)(title=Youth*))'.
    Get-ADUser -Filter "Department -eq 'Children'" ist dieselbe Suche in
    der eigenen Sprache von PowerShell.

    GUTE PRAXIS
    - Aus dem Ticket und den Konventionen anlegen, nicht aus einer
      Kollegin.
    - Ein erstes Passwort, das die Person bei der ersten Anmeldung ändert
      (-ChangePasswordAtLogon $true), persönlich übergeben.
    - Ausscheidende werden deaktiviert, nicht gelöscht: Die SID besitzt
      Dateien, Logs nennen sie, und ein gelöschtes Konto lässt sich ohne
      den AD-Papierkorb nicht zurückholen (hier ist er an:
      Restore-ADObject hat den Tag gerettet, aber er bewahrt ein
      gelöschtes Objekt nur 180 Tage auf).
    - Aus den Gruppen heraus, mit einer Beschreibung, die sagt, wann und
      warum.

    DOKUMENTATION
    - New-ADUser: https://learn.microsoft.com/powershell/module/activedirectory/new-aduser
    - Sicherheitsgruppen und ihr Bereich: https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-security-groups
    - Kennwort muss Komplexitätsvoraussetzungen entsprechen: https://learn.microsoft.com/windows-server/security/group-policy/password-must-meet-complexity-requirements
    - Disable-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/disable-adaccount
    - Move-ADObject: https://learn.microsoft.com/powershell/module/activedirectory/move-adobject
