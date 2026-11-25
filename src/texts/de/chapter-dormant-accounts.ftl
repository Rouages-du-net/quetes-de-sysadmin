### Geschichte „Der Zettelkatalog“, Kapitel „Türen und schlafende Konten“:
### das jährliche Audit der Stadt: Remote Desktop auf dem Dateiserver aus
### dem Internet erreichbar, und die Konten, die 90 Tage niemand benutzt
### hat, mit einem kleinen Skript geschlossen und in einem CSV-Bericht
### aufgelistet. Befehle, Cmdlets, Kontonamen, Adressen, Pfade und
### Ausgaben werden nicht übersetzt.

chapter-dormant-accounts = Türen und schlafende Konten
    .summary = Das IT-Sicherheitsteam der Stadt hat auf dem Dateiserver Remote Desktop gefunden, offen zum Internet, und will die Konten geschlossen haben, die 90 Tage niemand benutzt hat, mit einem Bericht. Die Tür schließen, ohne dich auszusperren, und dann ein kleines Skript schreiben, das die schlafenden Konten schließt, und nur sie.

## Dateien

dormant-accounts-email-nandini =
    Von:  Nandini Mukherjee (Leitung des Bibliotheksverbunds)
    An:   dich

    Guten Morgen,

    Das IT-Sicherheitsteam der Stadt hat uns sein jährliches Audit
    geschickt (in deinen Documents). Zwei Dinge für uns, bis Freitag.
    Vorsicht beim zweiten: Letztes Jahr hat Tomas ein Konto geschlossen,
    das das Archiv noch brauchte, und wir haben es erst im April gemerkt.

    Der Bericht, den sie wollen, kommt auch in deine Documents, als
    CSV-Datei: Er geht direkt in ihre Tabelle.

    Nandini

# { $scanner }: the scanner's address (not translated).
dormant-accounts-audit =
    Stadt der Bibliotheken - IT-Sicherheit - jährliches Audit 2030
    Netz: öffentliche Bibliotheken (LENDING)

    1. EXTERNER SCAN (vierteljährlich, von { $scanner })
       Die öffentliche Adresse der Bibliotheken antwortet auf TCP 3389
       (Remote Desktop). Der Router leitet ihn an einen internen Server
       weiter. Remote Desktop darf nie aus dem Internet erreichbar sein,
       auch nicht von den öffentlichen Terminals. Administration nur vom
       IT-Arbeitsplatz (192.0.2.2).

    2. SCHLAFENDE KONTEN
       Konten von Personen ohne Anmeldung seit 90 Tagen oder mehr:
         - deaktivieren, in eure OU für Ausgeschiedene verschieben, aus
           jeder Gruppe entfernen (außer der primären Gruppe);
         - uns die Liste als CSV-Datei schicken (Kontoname, Name, letzte
           Anmeldung).
       Dienstkonten nicht anfassen, ohne zu prüfen, was sie benutzt.
       Prüft auch, ob eure Ausgeschiedenen wirklich aus ihren Gruppen
       heraus sind.

dormant-accounts-gpo-refresh =
    Neunzig Minuten später aktualisiert regale seine Richtlinie im
    Hintergrund: Die Regel aus der GPO der Server lässt register wieder auf
    Port 22 herein. (Im echten Leben hätte vielleicht jemand in den
    Serverraum fahren müssen.)

## Ereignisse

dormant-accounts-event-rdp-found =
    „Remote Desktop - Any“: TCP 3389, von jeder Adresse (Any), in jedem
    Profil. Tomas hat sie 2028 angelegt, um von zu Hause zu arbeiten, und
    der Router leitet den Port immer noch weiter: Jeder im Internet kann
    Passwörter am Remote Desktop von regale probieren, und jeder an einem
    öffentlichen Terminal auch. Die eingebauten Remote-Desktop-Regeln sind
    aus; diese nicht. Benutzt noch jemand Remote Desktop? Du kommst mit
    ssh herein.
dormant-accounts-event-profile-off =
    Ein Firewall-Profil ist aus: In diesem Netz nimmt regale jetzt alles
    an, jeden Port, von allen. Die Tür, die du schließen solltest, steht
    sperrangelweit offen, und jede andere auch. Schalte es wieder ein
    (Set-NetFirewallProfile -Enabled True) und kümmere dich um die eine
    Regel.
dormant-accounts-event-ssh-cut =
    Vorsicht: Die Firewall von regale lässt register nicht mehr auf Port
    22 herein. Deine Sitzung hält (eine offene Verbindung bleibt offen),
    aber das nächste ssh regale läuft in einen Timeout. Stell es jetzt
    wieder her (Get-NetFirewallRule -Name OpenSSH-Server-In-TCP,
    Enable-NetFirewallRule, Set-NetFirewallRule -RemoteAddress), bevor du
    exit tippst.
# { $kiosk }: a kiosk's address (not translated).
dormant-accounts-event-lan-wide =
    Aus dem Internet: zu. Aber { $kiosk }, ein öffentliches
    Katalogterminal, kommt immer noch herein: Es ist im selben Netz
    (192.0.2.0/24) wie das Personal. LocalSubnet oder das ganze /24 ist
    nicht „der Admin-Arbeitsplatz“.
dormant-accounts-event-rdp-closed =
    Port 3389 für alle geschlossen: aus dem Internet und von den
    Terminals. Du kommst weiter mit ssh herein. (Die Portweiterleitung des
    Routers sollte auch weg: eine Notiz für Nandinis Dienstleister.)
dormant-accounts-event-rdp-narrowed =
    Port 3389 nur noch für den IT-Arbeitsplatz offen: nicht aus dem
    Internet, nicht von den Terminals. Du kommst weiter mit ssh herein.
dormant-accounts-event-inactive =
    Die inaktiven Konten der Domäne. Sieh genau hin, bevor du handelst:
    Guest und krbtgt sind eingebaute Konten (deaktiviert, nie
    „angemeldet“), oadeyemi ist im Mai gegangen, svc_backup ist ein
    Dienstkonto. Die Personen sind ychen und pmorel. -SearchBase kann die
    Suche auf die Leute der Zweigstellen beschränken.
dormant-accounts-event-too-short =
    lhassan in der Liste: Leila ist seit Dezember in Elternzeit, zurück im
    März. Mit einem zu kurzen -TimeSpan schließt das Audit Leute, die
    zurückkommen. Das Audit sagt 90 Tage.
dormant-accounts-event-service-account =
    svc_backup führt die externe Kopie des Archivs aus, am 1. Oktober und
    am 1. April. Seine letzte Anmeldung ist vom Oktober: seit 90 Tagen
    inaktiv, und in neun Wochen wieder gebraucht. Das LastLogonDate eines
    Dienstkontos sagt, wann es sich zuletzt angemeldet hat, nicht, ob
    etwas davon abhängt.
dormant-accounts-event-service-touched =
    Ein Dienstkonto wurde geändert. svc_backup sieht inaktiv aus, aber die
    Aufgabe Offsite Copy auf regale läuft am 1. April als svc_backup:
    deaktiviert, aus seiner Gruppe heraus oder verschoben, scheitert die
    Kopie (0x80070533, das Konto ist deaktiviert), und das Archiv wird
    nicht extern gesichert. Stell es wieder her, wie es war:
    Enable-ADAccount, seine Gruppe, OU=Service Accounts.
dormant-accounts-event-builtin-touched =
    Ein eingebautes Konto wurde verschoben oder geändert (Guest, krbtgt,
    Administrator…). Sie sind deaktiviert oder werden von der Domäne selbst
    gebraucht: Im Audit geht es um Personen. Stell es zurück, wo es war
    (Move-ADObject).
# { $accounts }: account names (not translated).
dormant-accounts-event-active-touched =
    Das Konto einer aktiven Person wurde geändert: { $accounts }. Sie hat
    sich in den letzten 90 Tagen angemeldet: Stell das Konto wieder her,
    wie es war (aktiviert, seine OU, seine Gruppen).
# { $accounts }: account names (not translated).
dormant-accounts-event-deleted =
    Gelöscht: { $accounts }. Das Audit verlangt deaktivieren, nicht
    löschen: Die SID besitzt Dateien, die Prüfer·innen wollen den Namen.
    Der Papierkorb hat es noch (Get-ADObject -IncludeDeletedObjects,
    Restore-ADObject).
dormant-accounts-event-closed =
    ychen und pmorel: deaktiviert, in Leavers, aus ihren Gruppen heraus.
    Wenn eine der beiden Personen zurückkommt, holen Enable-ADAccount, eine
    GG_-Gruppe und ein Move-ADObject sie zurück.
dormant-accounts-event-leftover-seen =
    Olu ist im Mai 2029 gegangen. Deaktiviert, in Leavers... aber immer
    noch in GG_Lending und DL_Staff_RW. Deaktiviert kann er sich nicht
    anmelden; aber wer sein Konto wieder aktiviert (versehentlich, oder um
    „etwas zu prüfen“), gibt ihm auf einen Schlag alle Zugänge zurück, und
    jeder Bericht über die Freigabe Staff listet ihn auf.
dormant-accounts-event-leftover =
    Olu ist auch aus seinen Gruppen heraus: Leavers ist sauber.
dormant-accounts-event-report-active =
    Ein CSV-Bericht listet eine aktive Person auf: Die Prüfer·innen würden
    ein Konto schließen, das benutzt wird. Schreib ihn aus der richtigen
    Suche (-TimeSpan 90.00:00:00, die Leute der Zweigstellen).
dormant-accounts-event-report =
    Der Bericht ist da, und Import-Csv liest ihn zurück: Die Prüfer·innen
    können ihn in ihre Tabelle einfügen.
dormant-accounts-event-end =
    Nandini: „Der Scan ist sauber, das Audit hat seine Liste, und das
    Archiv wird im April kopiert. Danke!“

    Gut gemacht! Du hast das Kapitel „Türen und schlafende Konten“ und die
    Geschichte „Der Zettelkatalog“ abgeschlossen.

    WAS PASSIERT IST
    Tomas hat 2028 auf regale Remote Desktop für Any geöffnet, um von zu
    Hause zu arbeiten; der Router hat den Port weiter weitergeleitet, also
    hat der Scan der Stadt ihn aus dem Internet gefunden. Niemand benutzt
    Remote Desktop mehr: Du hast die Regel geschlossen, ohne die Profile
    oder dein eigenes ssh anzufassen. Dann das Audit: Search-ADAccount hat
    die Konten gefunden, die 90 Tage niemand benutzt hat, aber darunter
    waren eingebaute Konten, ein Ausgeschiedener und ein Dienstkonto, das
    nur zweimal im Jahr arbeitet. Du hast die Konten der beiden Personen
    mit einem Skript geschlossen, die Gruppen des alten Ausgeschiedenen
    aufgeräumt und die Liste mit Export-Csv geschrieben.

    GUTE PRAXIS
    - Remote Desktop zeigt nie zum Internet: ein VPN oder ein Gateway
      davor, und mindestens eine Firewall-Regel, die auf die Adressen der
      Admins beschränkt ist (-RemoteAddress). Lieber eine Regel
      deaktivieren, die niemand benutzt: Sie sagt, was sie war, und kann
      zurückkommen.
    - Eine Regel einschränken, nie ein ganzes Profil. Bevor du die Regel
      änderst, über die du hereingekommen bist, prüfe, was dich noch
      hereinlässt.
    - Ein Audit-Skript liest zuerst und handelt danach: die Suche in einer
      Variablen behalten, sie ansehen, exportieren (Export-Csv
      -NoTypeInformation), dann auf sie anwenden, beim ersten Mal mit
      -WhatIf.
    - LastLogonDate ist lastLogonTimestamp: mit bis zu 14 Tagen
      Verzögerung repliziert, und nur eine Anmeldung zählt. Schließ aus,
      was keine Person ist: -SearchBase auf die OU der Leute, Dienstkonten
      in ihrer eigenen OU, eingebaute Konten.
    - Deaktivieren, nicht löschen: Ein deaktiviertes Konto kommt mit einem
      Befehl zurück; ein gelöschtes braucht den Papierkorb, 180 Tage lang.

    WIE „DAS VERZEICHNIS“, IN ACTIVE DIRECTORY
    Search-ADAccount -AccountInactive ist eine LDAP-Suche auf dem Attribut
    lastLogonTimestamp: Get-ADUser -LDAPFilter '(lastLogonTimestamp<=…)'
    tut dasselbe, mit dem Datum als FILETIME geschrieben (Intervalle von
    100 Nanosekunden seit 1601), wie es ldapsearch täte.

    DOKUMENTATION
    - Search-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount
    - Export-Csv: https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/export-csv?view=powershell-5.1
    - Set-NetFirewallRule: https://learn.microsoft.com/powershell/module/netsecurity/set-netfirewallrule
    - Remote Desktop von überall, sicher: https://learn.microsoft.com/windows-server/remote/remote-desktop-services/rds-plan-access-from-anywhere
    - Der AD-Papierkorb: https://learn.microsoft.com/windows-server/identity/ad-ds/get-started/adac/advanced-ad-ds-management-using-active-directory-administrative-center--level-200-
