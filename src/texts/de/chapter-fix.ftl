### Geschichte „Die Wache“, Kapitel „Die Korrektur“: nginx und rsync
### korrigieren, ohne etwas kaputtzumachen. Die Befehle, Pfade und die
### Ausgabe von apt werden nicht übersetzt.

chapter-fix = Die Korrektur
    .summary = nginx und rsync korrigieren, ohne etwas kaputtzumachen: apt update vor apt upgrade, dann prüfen, dass die Website noch antwortet.

## Dateien

fix-email-salome =
    Von:     Salomé
    An:      dich
    Betreff: Zeit für die Korrektur

    Die Reihenfolge steht fest: nginx, dann rsync. Für beide gibt es schon
    eine veröffentlichte Korrektur von Debian, also braucht es hier keinen
    vorübergehenden Workaround: Ein Update reicht (man apt).

    Ein Reflex, den man nie überspringt: die Paketliste auffrischen, bevor
    man nach einem Update fragt. Ohne das weiß apt nicht, dass es eine
    Korrektur gibt.

    Und nach der Korrektur: prüfen, dass die Website noch antwortet. Eine
    Schwachstelle zu beheben und dabei die Website lahmzulegen, wäre ein
    seltsamer Gefallen für Nadia.

    Salomé
    (Für sudo ist dein Passwort immer noch: sauerteig-2028)

## Ereignisse

fix-event-without-update =
    apt upgrade sagt „Upgrading: 0“: Nichts ist passiert. apt kennt
    verfügbare Updates erst, nachdem es seine Paketliste aufgefrischt hat
    (sudo apt update), wie ein Katalog, den man neu laden muss, bevor man
    darin etwas Neues nachschlagen kann.
fix-event-fixed =
    nginx und rsync haben die korrigierte Version. Noch etwas zu prüfen,
    bevor es weitergeht: Antwortet die Website noch?
fix-event-checked =
    Die Website antwortet (curl gibt 200 zurück): Das Update hat nichts
    kaputtgemacht.
fix-event-end =
    Salomé: „Zwei korrigiert, die Website steht noch. Mehr verlangt man von
    einem Update nicht.“

    Gut gemacht! Du hast das Kapitel „Die Korrektur“ abgeschlossen.

    WAS PASSIERT IST
    Die Korrekturen von Debian für die beiden behaltenen CVEs sind jetzt
    installiert. apt upgrade installiert alle verfügbaren Updates auf
    einmal (nicht eins nach dem anderen), nachdem die Paketliste
    aufgefrischt wurde; deshalb kommt sudo apt update immer zuerst.

    GUTE PRAXIS
    - sudo apt update vor jedem Update: Ohne das arbeitet apt mit einer
      veralteten Liste und findet nichts.
    - Danach prüfen, dass läuft, was laufen soll (hier reicht ein
      einfaches curl): Eine Schwachstelle zu beheben darf keine andere
      schaffen und keinen Dienst lahmlegen.
    - Wenn es noch keine Korrektur gibt (der Fall von openssh-server im
      Bulletin), dokumentiert das Bulletin meist eine vorübergehende
      Abhilfe: anzuwenden, während man wartet, nicht anstelle einer echten
      Beobachtung.

    EIN ANDERER WEG
    unattended-upgrades (schon gesehen in „Automatische Updates“, in der
    Genossenschaft) kann diese Art von Sicherheitskorrektur von selbst
    einspielen, ohne zu warten, bis jemand das Bulletin liest — genau das
    ist das Thema des letzten Kapitels dieser Geschichte.

    DOKUMENTATION
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
