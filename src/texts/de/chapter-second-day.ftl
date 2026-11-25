### Geschichte „Das Rechenzentrum“, Kapitel „Zweiter Tag“: Konten und
### Gruppen. Malo soll die nginx-Logs ohne sudo lesen (Gruppe adm), und
### das Web-Team braucht ein gemeinsames Verzeichnis (/srv/team).
### Konten- und Gruppennamen (malo, adm, web-team), Befehle, Pfade und
### Modi (640, 770) werden nicht übersetzt.

chapter-second-day = Zweiter Tag
    .summary = Ein Neuzugang: Konten und Gruppen, id, usermod -aG, chgrp, chmod für die Gruppe.

## Dateien

second-day-email-awa =
    Von:     Awa (Leiterin des Betriebs)
    An:      dich
    Betreff: Zweiter Tag, zwei Kleinigkeiten

    Danke für gestern! Heute kommt Malo dazu, um mitzuhelfen. Sein Konto
    existiert schon (malo). Zwei Dinge sind zu regeln, bevor er kommt:

    1. Malo muss die nginx-Logs LESEN können (/var/log/nginx), um Roboter
       wie den von gestern zu erkennen. Aber kein sudo für ihn: Er muss
       kein Administrator sein, um ein Log zu lesen. Du liest sie ohne
       sudo… warum? Vergleiche  id  und  id malo , und schau dir die
       Rechte an mit  ls -l /var/log/nginx

    2. Das Web-Team (die Gruppe web-team) braucht ein gemeinsames
       Verzeichnis, /srv/team, in dem alle ihre Berichte ablegen können.
       Kein anderes Konto auf der Maschine darf dort lesen oder schreiben,
       vor allem nicht www-data: Die Website läuft unter diesem Konto, und
       wenn sie jemals gehackt wird, handelt der Angreifer mit dessen Rechten.

    Das sudo-Passwort hat sich nicht geändert. Meine Notizen zu den Rechten
    stehen in ~/notes_awa.txt, und das Handbuch ist dein Freund:
    man usermod, man chgrp.
second-day-notes-awa =
    AWAS NOTIZEN — ls -l LESEN

      -rw-r----- www-data adm      84211 access.log
       ^^^             ^^^  Besitzer, dann Gruppe
          ^^^          Rechte des Besitzers (rw-), der Gruppe (r--),
             ^^^       dann der anderen (---)

    Um zu wissen, welche Rechte für jemanden gelten, prüft man der Reihe
    nach: Ist die Person der Besitzer? Wenn nicht, ist sie Mitglied der
    Gruppe? Wenn nicht, gehört sie zu den „anderen“. Nur ein Dreierblock
    zählt, der erste, der passt.

    Die Gruppen eines Kontos:  id name  oder  groups name
    Unter Debian ist die Gruppe adm für die Überwachung der Maschine da:
    Ihre Mitglieder können die Logs in /var/log lesen.

    Bei einem Verzeichnis: r = die Liste sehen, w = darin anlegen oder
    löschen, x = hineingehen. In Zahlen: r = 4, w = 2, x = 1, also
    7 = rwx, 5 = r-x, 0 = nichts (siehe man chmod).

## Ereignisse

second-day-event-replaced =
    Autsch: Malo ist nicht mehr in der Gruppe web-team!

    Ohne die Option -a ERSETZT usermod -G die Liste der Zusatzgruppen,
    statt die neue hinzuzufügen. Eine klassische Falle, die schon mehr als
    einen Admin aus dem eigenen sudo ausgesperrt hat. Prüfe mit
    groups malo, und lies dann noch einmal man usermod, um Malo seine
    Gruppen zurückzugeben.
# { $logs }: das Verzeichnis der Logs
second-day-event-logs-open =
    Vorsicht: Mit diesen Rechten können ALLE Konten auf der Maschine die
    Logs in { $logs } lesen, auch www-data, das Konto der Website.

    Ein Zugriffslog enthält die IP-Adressen der Besuchenden: Das sind
    personenbezogene Daten, die geschützt werden müssen (DSGVO). Nimm den
    anderen die Rechte wieder weg (640), und nutze stattdessen die Gruppe,
    die dafür gedacht ist.
second-day-event-malo-reads =
    Malo kann die Logs lesen, ohne sudo und ohne sie für alle zu öffnen:
    Er ist Mitglied der Gruppe adm, und die Logs geben dieser Gruppe
    Leserechte (r-- in der Mitte von rw-r-----).

    Übrigens muss sich Malo auf einer echten Maschine neu anmelden: Die
    Gruppen einer Sitzung werden bei der Anmeldung gelesen.
# { $share }: der Pfad des gemeinsamen Verzeichnisses
second-day-event-share-open =
    Vorsicht: Jedes Konto kann jetzt in { $share } schreiben, auch
    www-data. Wird die Website gehackt, kann der Angreifer dort ablegen,
    was er will. Nimm den anderen alle Rechte (letzte Ziffer 0).
second-day-event-share =
    Das Verzeichnis { $share } ist bereit: Das Web-Team kann hinein, dort
    lesen und schreiben, und die anderen Konten sehen darin nichts.
second-day-event-end =
    Awa steckt den Kopf durch die Tür: „Perfekt. Malo liest die Logs, die
    Freigabe ist für andere geschlossen, und niemand hat mehr Rechte
    bekommen als nötig.“

    Gut gemacht! Du hast Kapitel 2 von „Das Rechenzentrum“ abgeschlossen.

    WAS PASSIERT IST
    Unter Linux werden die Rechte einer Datei in drei Feldern entschieden:
    Besitzer, Gruppe, andere. Malo in die Gruppe adm aufzunehmen, gab ihm
    genau das, was er brauchte, ohne sudo und ohne die Logs für alle zu
    öffnen. Für /srv/team ergeben eine Gruppe und der Modus 770 (rwx für
    den Besitzer und die Gruppe, nichts für die anderen) ein echtes
    Team-Verzeichnis.

    GUTE PRAXIS
    - Minimale Rechte: lieber eine Gruppe als sudo, und nie chmod 777 oder
      o+r, „damit es geht“.
    - usermod -aG, um eine Gruppe hinzuzufügen; -G allein ersetzt die Liste.
    - Weiter gehen: chmod g+s auf einem gemeinsamen Verzeichnis (setgid-Bit)
      lässt neue Dateien die Gruppe des Verzeichnisses übernehmen.

    DOKUMENTATION
    - usermod: https://man7.org/linux/man-pages/man8/usermod.8.html
    - chmod: https://man7.org/linux/man-pages/man1/chmod.1.html
    - Debian-Systemgruppen (adm…): https://wiki.debian.org/SystemGroups
