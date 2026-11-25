### Geschichte „Der Zettelkatalog“, Kapitel „Die Richtlinie, die nicht
### greift“: Eine GPO, die das Laufwerk Events verbindet, erreicht nur einen
### Teil der Leute, für die sie gedacht ist: eine Verknüpfung auf der
### falschen OU und eine Sicherheitsfilterung, der eine Gruppe fehlt.
### Befehle, Cmdlets, Kontonamen, Computernamen, GPO-Namen und Ausgaben
### werden nicht übersetzt.

chapter-unapplied-policy = Die Richtlinie, die nicht greift
    .summary = Die Plakate für die Vorlesestunden im Frühling liegen auf der Freigabe Events, aber die Hälfte der Leute, die sie brauchen, hat kein Laufwerk E:. Lesen, was die Gruppenrichtlinie auf ihren Arbeitsplätzen angewendet hat, finden, warum die GPO sie nicht erreicht, und das reparieren, ohne das Laufwerk allen zu geben.

## Dateien

unapplied-policy-email-nandini =
    Von:  Nandini Mukherjee (Leitung des Bibliotheksverbunds)
    An:   dich

    Guten Morgen,

    Die Plakate für die Vorlesestunden im Frühling liegen fertig auf der
    Freigabe Events, und die Zweigstellen sollten sie heute drucken. Nur:

      - Josephine (Hilltop) hat kein Laufwerk E:. Sie sitzt an HILL-DESK1.
      - Kofi (Riverside) auch nicht, an RIVER-DESK1.
      - Und ich! Ich sitze an CENTRAL-DESK1, auch kein E:. Dabei hat das
        Kinderteam hier in Central es seit dem Herbst.

    Bongani (HILL-DESK2) sagt, er hat auch kein E:, aber er benutzt es nie.
    Thanh braucht es nicht, er sitzt an der Ausleihe.

    Sie sind gerade alle angemeldet. Tomas sagte, das Laufwerk kommt aus
    „einer GPO“. Könntest du nachsehen?

    Nandini

## Ereignisse

unapplied-policy-event-no-rsop =
    „Does not have RSoP data“: gpresult zeigt, was auf DIESEM Computer
    angewendet wurde, bei seinen Anmeldungen. Josephine hat sich nie an
    register angemeldet. Der Richtlinienergebnissatz lebt auf ihrem
    Arbeitsplatz: gpresult kann ihn aus der Ferne lesen (man gpresult: /s,
    /user), und Get-GPResultantSetOfPolicy auch.
unapplied-policy-event-gpupdate-here =
    Das hat die eigene Richtlinie von register aktualisiert: der
    Domänencontroller, und du. Die Arbeitsplätze der Bibliotheken
    aktualisieren sich von selbst (alle 90 Minuten oder bei der nächsten
    Anmeldung), oder wenn man es von hier aus verlangt: Get-Help
    Invoke-GPUpdate.
unapplied-policy-event-josephine =
    Ihr Arbeitsplatz hat Staff Drives (S:) angewendet und Archives Drive
    herausgefiltert (sie ist nicht in der Ortsgeschichte). Aber Events
    Drive taucht nirgends auf: weder angewendet noch herausgefiltert. Eine
    GPO, die gpresult nicht einmal auflistet, wurde auf dem Weg von der
    Domäne hinunter zu ihrer OU nicht gefunden: Keine Verknüpfung erreicht
    sie. Wo ist sie verknüpft? (Get-Help Get-GPInheritance,
    Get-GPOReport.)
unapplied-policy-event-links =
    Events Drive ist nur mit OU=Central verknüpft, wo Tomas sie getestet
    hat. Riverside und Hilltop erben, was über ihnen verknüpft ist (die
    Domäne, OU=Branches), nicht, was auf einer Schwester-OU verknüpft ist.
    Tomas' Konventionen sagen, wohin eine GPO für das Personal gehört.
unapplied-policy-event-root =
    Eine Verknüpfung auf der Wurzel der Domäne: Jedes Konto und jeder
    Computer der Domäne liest diese GPO jetzt bei jeder Anmeldung und
    Aktualisierung, der Domänencontroller und die Server inklusive, und
    nur die Sicherheitsfilterung steht noch zwischen dem Laufwerk und
    allen. Die Konventionen behalten die Wurzel der Default Domain Policy
    vor: Verknüpf sie stattdessen mit OU=Branches (Remove-GPLink,
    New-GPLink).
unapplied-policy-event-enforced =
    Enforced gewinnt nur gegen eine blockierte Vererbung und gegen weiter
    unten verknüpfte GPOs. Es lässt eine GPO keine OU erreichen, über der
    sie nicht verknüpft ist, und auch nicht an der Sicherheitsfilterung
    vorbeikommen. Hier blockiert nichts die Vererbung: Nimm es weg
    (Set-GPLink … -Enforced No).
unapplied-policy-event-linked =
    Jede Zweigstelle liegt jetzt unter einer Verknüpfung von Events Drive.
    Reicht das? Aktualisiere einen Arbeitsplatz und lies sein Ergebnis
    noch einmal; auch das von Nandini.
unapplied-policy-event-nandini =
    In Central, wo die Verknüpfung schon immer war, listet Nandinis
    Arbeitsplatz Events Drive unter „gefiltert“: Filtering: Denied
    (Security). Die GPO hat ihr Konto erreicht; ihre Berechtigungen haben
    sie nicht angewendet werden lassen. Wer darf sie anwenden? (Get-Help
    Get-GPPermission.)
unapplied-policy-event-filtering =
    Apply Group Policy: nur GG_Children. Tomas hat mit dem Kinderteam
    getestet; die Leitung wurde vergessen. Die Freigabe, die sie verbindet,
    Events, ist für DL_Events_RW: GG_Children und GG_Management.
# { $accounts }: account names (not translated).
unapplied-policy-event-everyone =
    Jetzt erreicht das Laufwerk Leute, für die es nicht gedacht ist:
    { $accounts }… Jede Ausleihkraft, alle im Archiv, die Dienstkonten,
    wenn die Verknüpfung hoch genug ist, bekommen ein E:, das sie nicht
    einmal öffnen können (die NTFS-Berechtigungen der Freigabe sind für
    DL_Events_RW). Die Sicherheitsfilterung sollte dieselben Gruppen
    nennen wie die Freigabe, nicht Authenticated Users. (Authenticated
    Users behält GpoRead: Computer müssen die GPO lesen.)
unapplied-policy-event-filtered =
    Die Leitung darf sie jetzt anwenden, und sonst hat sie niemand
    dazubekommen.
unapplied-policy-event-filtered-unlinked =
    Die Leitung darf sie jetzt anwenden, und sonst hat sie niemand
    dazubekommen. In Central genügt das; Riverside und Hilltop haben immer
    noch keine Verknüpfung über sich.
unapplied-policy-event-right =
    Im Verzeichnis stimmt die Richtlinie: Alle im Kinderteam und in der
    Leitung der drei Zweigstellen bekämen E:, sonst niemand. Aber die
    Arbeitsplätze wenden sie bei ihrer nächsten Aktualisierung an: Bitte
    jetzt einen darum (Get-Help Invoke-GPUpdate -Examples) und prüfe dann
    mit gpresult.
unapplied-policy-event-end =
    Josephine, eine Minute später: „E: ist da! Ich drucke die Plakate.“

    Gut gemacht! Du hast das Kapitel „Die Richtlinie, die nicht greift“
    abgeschlossen.

    WAS PASSIERT IST
    Tomas hat die GPO „Events Drive“ im Herbst angelegt und in Central mit
    dem Kinderteam getestet: Er hat sie mit OU=Central verknüpft und auf
    GG_Children gefiltert. Zwei Schichten, zwei Symptome. In Riverside und
    Hilltop hat gpresult die GPO gar nicht aufgelistet: keine Verknüpfung
    über ihrer OU. In Central hat es sie für Nandini als „Denied
    (Security)“ aufgelistet: erreicht, aber nicht erlaubt. Du hast sie
    dort verknüpft, wo das Personal ist, GG_Management das Recht gegeben,
    sie anzuwenden, und einen Arbeitsplatz um eine Aktualisierung gebeten.

    GUTE PRAXIS
    - Vom Ergebnis ausgehen, auf dem Computer der Person: gpresult /s
      COMPUTER /user DOMÄNE\benutzer /r (oder Get-GPResultantSetOfPolicy).
      Angewendet, herausgefiltert (und warum) oder abwesend: drei
      verschiedene Probleme.
    - Abwesend: ein Verknüpfungsproblem (wo sie verknüpft ist, blockierte
      Vererbung, das Objekt in einer anderen OU, als du denkst). „Denied
      (Security)“: Sicherheitsfilterung. „Disabled (Link)“, „Disabled
      (GPO)“, „Not Applied (Empty)“: die GPO selbst.
    - Dort verknüpfen, wo die Objekte sind, mit den Gruppen filtern, um die
      es bei der Einstellung geht. Nicht an der Wurzel, nicht Enforced,
      nicht Authenticated Users aus Reflex.
    - GpoRead für Authenticated Users (oder Domain Computers) behalten,
      wenn du filterst: Seit dem Update MS16-072 lesen Computer auch die
      Benutzer-GPOs.
    - Nach einer Änderung: Invoke-GPUpdate -Computer, oder auf die
      Hintergrundaktualisierung warten (90 Minuten, plus oder minus 30).

    WIE „DAS VERZEICHNIS“, IN ACTIVE DIRECTORY
    Eine GPO lebt im Verzeichnis (CN={"{"}GUID{"}"},CN=Policies,CN=System), und
    eine OU zeigt mit ihrem Attribut gPLink auf sie, das das Modul als
    LinkedGroupPolicyObjects zeigt: Get-ADOrganizationalUnit
    'OU=Branches,DC=lending,DC=internal' | Select-Object -ExpandProperty
    LinkedGroupPolicyObjects zeigt die Verknüpfung, die du hinzugefügt
    hast.

    DOKUMENTATION
    - gpresult: https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult
    - Sicherheitsfilterung: https://learn.microsoft.com/troubleshoot/windows-server/group-policy/apply-group-policy-objects-users-computers
    - New-GPLink: https://learn.microsoft.com/powershell/module/grouppolicy/new-gplink
    - Set-GPPermission: https://learn.microsoft.com/powershell/module/grouppolicy/set-gppermission
    - Invoke-GPUpdate: https://learn.microsoft.com/powershell/module/grouppolicy/invoke-gpupdate
