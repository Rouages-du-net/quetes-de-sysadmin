### Geschichte „Die Genossenschaft“, Kapitel „Gemeinsame Rechte“: ein
### Team-Verzeichnis (setgid, umask) und eine enge sudo-Regel (visudo).
### Befehle, Pfade und die Syntax von sudoers werden nicht übersetzt.

chapter-shared-rights = Gemeinsame Rechte
    .summary = Ein Verzeichnis, in dem das Kassenteam wirklich zusammenarbeiten kann (setgid, umask), und das Recht, die Kasse neu zu starten, mehr nicht (visudo).

## Dateien

shared-rights-email-awa =
    Von:     Awa
    An:      dich
    Betreff: Das Kassenteam

    Zwei Probleme mit dem Kassenteam (Lina und Karim, Gruppe till):

    1. Die Tagesabrechnungen liegen in /srv/till/abrechnungen. Lina kann
       die von Karim nicht korrigieren, und umgekehrt. Dabei sind beide
       in der Gruppe till! Schau dir ls -l an. Alles, was sie dort
       anlegen, heute und morgen, muss der Gruppe till gehören und für
       die Gruppe beschreibbar sein (man chmod, man umask).

    2. Wenn die Kasse hängt, müssen sie jemanden mit sudo anrufen, um
       systemctl restart till auszuführen. Marc hat ihnen sein Passwort
       gegeben… Gib ihnen das Recht, die Kasse neu zu starten, und SONST
       NICHTS (man sudoers, man visudo; sudo -l -U lina zum Prüfen).

    Für sudo ist dein Passwort immer noch: radieschen-2027

shared-rights-statement-17 =
    Kassenabrechnung — Sonntag, 17. Oktober (Lina)
    Wechselgeld zu Beginn: 150,00
    Umsatz: 1.243,60
shared-rights-statement-18 =
    Kassenabrechnung — Montag, 18. Oktober (Karim)
    Wechselgeld zu Beginn: 150,00
    Umsatz: 987,20

## Ereignisse

shared-rights-event-sudoers-broken =
    sudo ist kaputt: Die Richtlinie hat einen Fehler (lies die Meldung
    noch einmal), und sudo verweigert dann ALLES, sogar dir. Deshalb
    bearbeitet man sudoers mit visudo, das vor dem Speichern prüft.

    Auf einem echten Server bräuchtest du die Rettungskonsole des Hosters
    (oder pkexec). Hier: „Dieses Kapitel neu starten“, unter dem Terminal.
# { $file }: die ignorierte Regeldatei
shared-rights-event-file-ignore =
    Deine Regel steht in { $file }… das sudo nicht liest! @includedir
    ignoriert Dateien, deren Name einen Punkt enthält oder auf ~ endet
    (lies /etc/sudoers.d/README noch einmal). Gib ihr einen Namen ohne
    Punkt, wie /etc/sudoers.d/till.
shared-rights-event-too-large =
    Vorsicht: Mit dieser Regel können Lina und Karim eine root-Shell
    starten (sudo bash) und damit ALLES tun. Das ist nicht, worum Awa
    bittet: nur die Kasse neu starten, mit dem vollständigen Pfad des
    Befehls und seinen Argumenten.
shared-rights-event-systemctl-whole =
    Fast: Mit systemctl ohne Argumente können Lina und Karim die Kasse neu
    starten… aber auch ssh oder jeden anderen Dienst stoppen. Schreib den
    ganzen Befehl: Pfad und Argumente.
shared-rights-event-sudo =
    sudo -l -U lina bestätigt es: Das Kassenteam kann die Kasse neu
    starten, und nichts sonst.
# { $directory }: das gemeinsame Verzeichnis
shared-rights-event-directory =
    { $directory } gehört jetzt der Gruppe till, die darin schreiben darf,
    und hat das setgid-Bit (das s in drwxrwsr-x): Alles, was darin
    angelegt wird, bekommt die Gruppe till. Bleibt das, was schon da ist,
    und die Rechte, die Lina und Karim ihren nächsten Dateien geben werden
    (umask).
shared-rights-event-mask =
    Lina und Karim haben bei ihrer nächsten Anmeldung die Maske 002: Ihre
    neuen Dateien werden rw-rw-r--, von der Gruppe bearbeitbar.
shared-rights-event-end =
    Am nächsten Tag: Lina speichert ihre Abrechnung (-rw-rw-r-- lina till),
    Karim korrigiert ein Komma, ohne jemanden zu fragen, und als die Kasse
    mittags hängt, startet er sie selbst mit sudo neu. Awa: „Keine
    Passwörter mehr, die herumgereicht werden!“

    Gut gemacht! Du hast das Kapitel „Gemeinsame Rechte“ abgeschlossen.

    WAS PASSIERT IST
    Eine Datei gehört der primären Gruppe der Person, die sie anlegt, mit
    den Rechten, die ihre Maske erlaubt (umask 022: rw-r--r--). Um im Team
    zu arbeiten, braucht man beides: das setgid-Bit auf dem Verzeichnis
    (die Gruppe des Verzeichnisses geht an neue Dateien über) und eine
    Maske 002 (die Gruppe kann schreiben). Und sudo ist nicht alles oder
    nichts: Eine Regel kann einen einzigen bestimmten Befehl einer
    bestimmten Gruppe erlauben.

    GUTE PRAXIS
    - Team-Verzeichnis: chgrp team, chmod 2775 (oder g+ws), dann
      chgrp -R und chmod -R g+w für das, was schon da ist.
    - umask 002 in der ~/.profile des Teams (oder /etc/profile.d).
    - Immer visudo (-f für /etc/sudoers.d/name-ohne-punkt), vollständige
      Pfade (which), ausgeschriebene Argumente; mit sudo -l -U konto prüfen.
    - Nie ein Passwort teilen: Jeder Person ein genaues Recht geben.

    DOKUMENTATION
    - sudoers: https://www.sudo.ws/docs/man/sudoers.man/
    - visudo: https://www.sudo.ws/docs/man/visudo.man/
    - setgid auf Verzeichnissen: https://www.gnu.org/software/coreutils/manual/html_node/Directory-Setuid-and-Setgid.html
