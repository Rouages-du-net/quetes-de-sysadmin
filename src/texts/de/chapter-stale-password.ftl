### Geschichte „Der Zettelkatalog“, Kapitel „Das alte Passwort“: Ein Konto
### sperrt sich jeden Morgen; die Ereignisse des Domänencontrollers zeigen
### auf den Dateiserver, wo eine geplante Aufgabe noch das alte Passwort
### hält. Befehle, Cmdlets, Kontonamen, Pfade, Passwörter und Ausgaben
### werden nicht übersetzt.

chapter-stale-password = Das alte Passwort
    .summary = Rafaels Konto sperrt sich jeden Morgen, und das Entsperren hält nur eine Stunde. Finden, welcher Computer immer wieder sein altes Passwort probiert, reparieren, was es gespeichert hat, und ihn dann entsperren, ohne die Sperrrichtlinie zu schwächen.

## Dateien

stale-password-email-nandini =
    Von:  Nandini Mukherjee (Leitung des Bibliotheksverbunds)
    An:   dich

    Guten Morgen,

    Rafael (Archiv, Central) ist SCHON WIEDER gesperrt. Der dritte Morgen
    hintereinander. Am Montag hat Windows ihm gesagt, sein Passwort sei
    abgelaufen, er hat es an seinem Platz geändert, und seitdem ist er
    innerhalb einer Stunde gesperrt. Ich habe ihn am Montag und gestern
    entsperrt (Tomas hat mir gezeigt, wie): Es hält eine Weile, dann geht
    es wieder los.

    Er schwört, dass er das richtige Passwort eintippt, nur an seinem PC
    am Platz in Central, und dass er das alte nirgends aufgeschrieben hat.

    Könntest du herausfinden, was los ist? Ich habe den Tresoreintrag
    exportiert, von dem Tomas sagte, du würdest ihn brauchen:
    Documents\tresor-svc_scans.txt. Lösch ihn, wenn du fertig bist.

    Nandini

# { $password }: the account's password (not translated).
stale-password-vault =
    Passwortmanager - ein Eintrag, exportiert von Nandini (9. Januar 2030)

    Titel:         LENDING - svc_scans
    Benutzername:  LENDING\svc_scans
    Passwort:      { $password }
    Geändert:      12. Dezember 2029 (Tomas)
    Notizen:       Dienstkonto für den Scan-Import auf regale
                   (ersetzt Rafaels Konto in der Aufgabe). OU=Service
                   Accounts, Passwort läuft nie ab.

## Verstreichende Zeit

stale-password-relocked =
    Eine halbe Stunde später das Telefon: Rafael ist wieder gesperrt. Das
    Entsperren setzt den Zähler zurück, nicht seine Ursache: Etwas probiert
    immer wieder sein altes Passwort, und fünf falsche Versuche sperren das
    Konto für 30 Minuten.
stale-password-holds =
    Eine halbe Stunde später ist Rafael immer noch angemeldet, und kein
    neues 4740 auf register.

## Ereignisse

stale-password-event-locked =
    rsilva, LockedOut. Ein gesperrtes Konto ist kein deaktiviertes: Die
    Domäne lehnt 30 Minuten lang sogar das richtige Passwort ab (die
    Default Domain Policy), nach fünf falschen. Wie viele, und wann?
stale-password-event-bad-logons =
    PasswordLastSet: Montag, 8:52. Seitdem falsche Passwörter, in
    gleichmäßigem Takt: Ein Mensch, der sich vertippt, hält keinen solchen
    Rhythmus. Welcher Computer schickt sie? Der Domänencontroller schreibt
    es in sein Protokoll Security, im Sperrereignis: 4740.
stale-password-event-caller =
    „Caller Computer Name“: der Computer, der den Domänencontroller
    gebeten hat, das Passwort zu prüfen. Es ist nicht Rafaels PC am Platz:
    Es ist der Dateiserver. Etwas auf diesem Server meldet sich als Rafael
    an. Von register aus kommt der eigene OpenSSH-Client von Windows
    dorthin: ssh gefolgt von seinem Namen.
stale-password-event-on-stacks =
    Du bist auf dem Dateiserver, als Domain Admin. Sein eigenes Protokoll
    Security hat die fehlgeschlagenen Anmeldungen (4625), mit ihrem
    Anmeldetyp: 2 an der Tastatur, 3 aus dem Netz, 4 ein Batch-Job, 5 ein
    Dienst.
stale-password-event-logon-type =
    Logon Type 4: eine Batch-Anmeldung, wie sie eine geplante Aufgabe
    macht. Eine Aufgabe, die als Rafael läuft, mit einem Passwort, das bei
    ihrer Registrierung gespeichert wurde.
stale-password-event-task =
    Der Scan-Import: Tomas hat ihn im September unter Rafaels eigenem Konto
    eingerichtet, „Unabhängig von der Benutzeranmeldung ausführen“, alle 5
    Minuten. Die Aufgabenplanung hat das Passwort gespeichert, das er
    damals hatte. Am Montag hat Rafael es geändert; die Aufgabe hat das
    alte behalten und probiert es zwölfmal pro Stunde. Fünf falsche
    Versuche: gesperrt.
stale-password-event-policy =
    Die Sperrrichtlinie ist jetzt schwächer. Das würde das Symptom für
    jedes Konto der Domäne verstecken und das Erraten von Passwörtern bei
    allen freigeben; die Aufgabe würde trotzdem scheitern. Stell sie
    wieder her, wie sie war (5 Versuche, 30 Minuten):
    Set-ADDefaultDomainPasswordPolicy.
stale-password-event-reset =
    Du hast Rafaels Passwort zurückgesetzt: Er kennt das neue nicht, ein
    Zurücksetzen entsperrt das Konto nicht, und die Aufgabe hält immer noch
    das alte, das jetzt zwei Passwörter zurückliegt. Was ein Passwort
    speichert, muss aktualisiert werden, nicht die Person.
stale-password-event-system =
    Der Import läuft jetzt als SYSTEM: Er sperrt niemanden mehr, aber er
    kann auf dem Dateiserver alles, jede Freigabe, jede Datei. Die Aufgabe
    muss nur Scans nach Archives verschieben: Dafür wurde svc_scans
    angelegt.
stale-password-event-person =
    Der Import läuft wieder unter dem Konto einer Person (oder dem des
    Administrators des Domänencontrollers). Wenn diese Person das nächste
    Mal ein Passwort ändert oder geht, bricht der Import, oder er sperrt
    sie aus. Ein Job hat sein eigenes Dienstkonto: svc_scans, sein Passwort
    im Tresor.
stale-password-event-task-off =
    Der Scan-Import läuft nicht mehr: Rafael wird nicht gesperrt, aber die
    PDFs des Archivscanners häufen sich in D:\Scans und kommen nie in
    Archives an. Repariere die Aufgabe, statt sie zu stoppen: unter
    svc_scans.
stale-password-event-fixed =
    Der Import läuft jetzt als svc_scans, mit seinem eigenen Passwort:
    Nichts auf regale probiert mehr Rafaels Passwort. Er ist aber noch
    gesperrt: Die Sperre dauert 30 Minuten, oder bis ein Admin das Konto
    entsperrt.
stale-password-event-fixed-unlocked =
    Der Import läuft jetzt als svc_scans, mit seinem eigenen Passwort:
    Nichts auf regale probiert mehr Rafaels Passwort.
stale-password-event-vault-deleted =
    Der exportierte Eintrag ist gelöscht: Das Passwort bleibt im Tresor und
    in der Aufgabe, nirgendwo sonst. Danke, sagt Nandini.
stale-password-event-end =
    Rafael: „Eine halbe Stunde, und immer noch angemeldet! Und meine Scans
    sind in Archives. Danke!“

    Gut gemacht! Du hast das Kapitel „Das alte Passwort“ abgeschlossen.

    WAS PASSIERT IST
    Im September hat Tomas den Scan-Import auf regale als geplante Aufgabe
    unter Rafaels Konto eingerichtet; die Aufgabenplanung hat sein
    Passwort gespeichert. Am Montag ist Rafaels Passwort abgelaufen, und er
    hat es geändert; die Aufgabe hat alle 5 Minuten weiter das alte
    probiert. Nach fünf falschen Versuchen sperrt die Domäne ein Konto für
    30 Minuten: entsperrt oder nicht, Rafael war innerhalb einer Stunde
    wieder gesperrt. Das Ereignis 4740 des Domänencontrollers hat den
    Computer genannt (REGALE), seine Ereignisse 4625 den Anmeldetyp (4,
    Batch), und die Aufgabe hat ihren Principal gezeigt. Du hast der
    Aufgabe ihr eigenes Dienstkonto gegeben und dann Rafael entsperrt.

    GUTE PRAXIS
    - Eine wiederkehrende Sperre hat eine Quelle: Search-ADAccount
      -LockedOut, Get-ADUser -Properties BadLogonCount,
      LastBadPasswordAttempt, dann Ereignis 4740 auf dem Domänencontroller
      (dem PDC-Emulator) für den aufrufenden Computer, und 4625 dort für den
      Anmeldetyp.
    - Die üblichen Quellen: geplante Aufgaben, Dienste, verbundene
      Laufwerke mit gespeicherten Anmeldedaten (cmdkey), ein Telefon, das
      noch Mails synchronisiert.
    - Zuerst die Quelle reparieren, dann entsperren: Die umgekehrte
      Reihenfolge erkauft nur eine halbe Stunde.
    - Jobs laufen unter Dienstkonten, nie unter dem einer Person: Menschen
      ändern Passwörter und gehen. In einer Domäne ändert ein
      gruppenverwaltetes Dienstkonto (gMSA) sein Passwort sogar selbst.
    - Die Sperrrichtlinie nicht schwächen, um ein Symptom zum Schweigen zu
      bringen: Sie schützt jedes Konto vor dem Erraten von Passwörtern.

    WIE „DAS VERZEICHNIS“, IN ACTIVE DIRECTORY
    LockedOut, BadLogonCount und LastBadPasswordAttempt sind Attribute des
    Verzeichnisses (lockoutTime, badPwdCount, badPasswordTime), die ein
    LDAP-Filter durchsuchen kann, wie mit ldapsearch:
    Get-ADUser -LDAPFilter '(lockoutTime>=1)'.

    DOKUMENTATION
    - Ereignis 4740: https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4740
    - Ereignis 4625 und die Anmeldetypen: https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4625
    - Search-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount
    - Unlock-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/unlock-adaccount
    - Set-ScheduledTask: https://learn.microsoft.com/powershell/module/scheduledtasks/set-scheduledtask
    - Schwellenwert für Kontosperrung: https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/account-lockout-threshold
    - Gruppenverwaltete Dienstkonten: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
