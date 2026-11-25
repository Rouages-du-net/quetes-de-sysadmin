### Geschichte „Windows nebenan“, Kapitel „Die andere Seite“: Das Volume
### der Freigabe ist voll, aber nicht wegen der Freigabe; ein Blick in den
### Windows-Server über sein OpenSSH und PowerShell, nur lesend. Befehle,
### Cmdlets, Pfade und Ausgaben werden nicht übersetzt.

chapter-full-volume = Die andere Seite
    .summary = Die Windows-Freigabe ist voll, die Freigabe selbst aber nicht: im Windows-Server über sein OpenSSH nachsehen, ihn mit ein paar PowerShell-Cmdlets lesen und für die Person, die sich um ihn kümmert, aufschreiben, was die Platte füllt.

## Dateien

full-volume-email-ifeoma =
    Von:  Ifeoma
    An:   dich

    Hallo,

    Plotter hat es nicht geschafft, die PDFs von heute Morgen auf schrank
    zu speichern: „No space left on device“, sagt sein Log
    (/var/log/plotter/export.log). Das ist seltsam: Unsere Pläne sind
    nicht so groß, und diese Woche hat meines Wissens niemand etwas
    hinzugefügt.

    Priya kommt am ersten Montag des Monats, und sie administriert
    schrank: Bitte ändere nichts daran. Aber du hast dort ein Konto (sie
    hat deinen Schlüssel eingetragen), und sie sagt, es ist „OpenSSH, in
    Windows eingebaut“. Könntest du nachsehen, was ihn füllt, und
    aufschreiben, was du findest, in schrank-bericht.txt? Ich schicke es
    ihr.

    Ifeoma

full-volume-report =
    schrank - warum die Freigabe voll ist (für Priya)

    Das volle Volume:
    Was es füllt (vollständiger Pfad):
    Seit wann:
    Im Ereignisprotokoll gesehen:

## Ereignisse

full-volume-event-full =
    df sagt es: Das Volume der Freigabe ist voll (100%), etwa 500 GB. Das
    ist die Platte von schrank, wie schrank sie zählt, nicht nur das
    Verzeichnis der Freigabe. Wie viel enthält die Freigabe selbst? (du)
full-volume-event-outside =
    Die Freigabe enthält etwa 60 GB, das Volume 500 GB: Was es füllt, liegt
    auf derselben Platte, aber außerhalb der Freigabe, wo kompass nicht
    hinsieht. Um dort nachzusehen, musst du auf schrank sein: Sein in
    Windows eingebautes OpenSSH öffnet eine PowerShell.
full-volume-event-deleted-drawings =
    Vorsicht: Das waren die Zeichnungen des Büros, und Platz zu schaffen
    ist hier nicht deine Entscheidung. Die Freigabe enthält nur einen
    Bruchteil des Volumes: Was es füllt, ist anderswo.
full-volume-event-powershell =
    „PS C:\Users\du>“: Du bist unter Windows, in PowerShell. Befehle heißen
    Cmdlets, nach dem Muster Verb-Substantiv benannt (Get-ChildItem,
    Get-Service), ihre Parameter beginnen mit einem Bindestrich
    (-Recurse), und Groß- und Kleinschreibung spielt keine Rolle. Manche
    Linux-Namen funktionieren als Aliase (ls, cat, cd, pwd). Get-Help NAME
    ist das Handbuch; Get-Command listet auf, was es gibt.
full-volume-event-linux-habit =
    Nicht jeder Linux-Befehl hat einen PowerShell-Alias: grep, df oder du
    gibt es hier nicht. Die Gegenstücke sind Cmdlets: Get-Volume oder
    Get-PSDrive für die Platten, Get-ChildItem für die Dateien,
    Where-Object zum Filtern. Get-Help und Get-Command, um sie zu finden.
full-volume-event-parameter =
    ls ist nur ein Alias von Get-ChildItem, und Get-ChildItem hat weder -l
    noch -a: Seine Parameter haben Namen (-Force für versteckte Dateien,
    -Recurse, um hinabzusteigen). Get-Help Get-ChildItem listet sie auf.
full-volume-event-volume =
    D: (Data): 500 GB, etwa 11 MB frei. Das ist das Volume der Freigaben
    (D:\Shares). Was füllt es? Get-ChildItem kann das ganze Laufwerk
    hinabsteigen (-Recurse), und seine Objekte lassen sich nach Größe
    sortieren, bevor du sie ansiehst.
full-volume-event-culprit =
    Da ist es: plans-full-2029-11-03.zip, mehr als 400 GB, in D:\Backup,
    außerhalb der Freigaben, geschrieben am 3. November. Eine vollständige
    Kopie der Pläne, gezippt und liegen gelassen. Schreib es in
    schrank-bericht.txt (das Volume, die Datei, seit wann); das
    Ereignisprotokoll verrät dir vielleicht, seit wann Windows sich
    beschwert (Get-WinEvent oder Get-EventLog).
full-volume-event-event-log =
    Ereignis 2013 von srv (dem Dateiserver): „The D: disk is at or near
    capacity“, alle paar Stunden seit dem 18. November. Windows hatte es
    gesagt; niemand hat es gelesen.
full-volume-event-read-only =
    Du bist hier, um zu lesen: schrank zu ändern ist Priyas Sache. Schreib
    auf, was du gefunden hast; sie tut, was zu tun ist.
full-volume-event-end =
    Ifeoma: „Ich habe Priya deinen Bericht geschickt. Sie wusste es sofort:
    Am 3. November, bevor die Freigabe umgezogen wurde, hat sie zur
    Vorsicht alle Pläne gezippt und das Zip vergessen. Sie hat es von
    ihrem Platz aus entfernt, und Plotter liefert morgen die PDFs. Sie
    fragt, ob du am Montag kommen möchtest, um die Windows-Seite zu
    sehen.“

    Gut gemacht! Du hast das Kapitel „Die andere Seite“ abgeschlossen.

    WAS PASSIERT IST
    Die Freigabe war voll, weil ihr Volume es war: df unter Linux zeigt die
    Platte des Servers, du nur die Freigabe. Der Rest lag außerhalb der
    Sicht von Linux. Über das OpenSSH von schrank (seit 2019 in Windows
    eingebaut) bist du in PowerShell gelandet und hast das Volume gefunden
    (Get-Volume, Get-PSDrive), die Datei (Get-ChildItem -Recurse, nach
    Length sortiert) und die Warnungen, die Windows geschrieben hatte
    (Get-WinEvent). Du hast gelesen, aufgeschrieben und die Änderung der
    Person überlassen, die den Server administriert.

    GUTE PRAXIS
    - df und du messen nicht dasselbe: Auf einer Netzwerkfreigabe ist df
      das Volume des Servers.
    - PowerShell gibt Objekte weiter, keinen Text: nach Eigenschaften
      sortieren und auswählen (Sort-Object Length -Descending,
      Select-Object -First 5), und die Formatierung zuletzt kommen lassen.
    - Get-Help und Get-Command sind das Handbuch: Der Reflex „erst das
      Handbuch“ gilt auch unter Windows.
    - Auf einem Server, den du nicht administrierst, lesen und berichten:
      das Volume, die Datei mit vollem Pfad, das Datum, die Ereignisse.
    - Die Platten der Server im Auge behalten, von denen du abhängst (eine
      Freigabe, die vollläuft, stoppt Dienste auf der anderen Seite).

    EIN ANDERER WEG
    Die PowerShell für Linux (pwsh) führt dieselben Cmdlets unter Linux
    aus; das Windows Admin Center und der Explorer zeigen dasselbe in
    Fenstern. WSL bringt umgekehrt ein Linux auf Windows-Arbeitsplätze.
    Windows zu administrieren ist eine eigene Geschichte.

    DOKUMENTATION
    - OpenSSH für Windows: https://learn.microsoft.com/windows-server/administration/openssh/openssh-overview
    - Get-ChildItem: https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-childitem?view=powershell-5.1
    - Get-Volume: https://learn.microsoft.com/powershell/module/storage/get-volume
    - Get-WinEvent: https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1
    - Über Pipelines: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_pipelines?view=powershell-5.1
