### Geschichte „Die Genossenschaft“, Kapitel „Der Abschied“: einer
### ehrenamtlichen Person, die geht, alle Zugänge entziehen, ohne etwas
### kaputtzumachen. Befehle, Pfade und Kontonamen werden nicht übersetzt.

chapter-departure = Der Abschied
    .summary = Marc geht: Schließ sein Konto (wirklich), entferne seinen Schlüssel überall, sein sudo, seine Sitzung, und behalte das Backup, das er laufen ließ.

## Dateien

departure-email-awa =
    Von:     Awa (Koordinatorin des Lebensmittelladens der Genossenschaft)
    An:      dich
    Betreff: Marc geht

    Wie du weißt, zieht Marc Ende der Woche nach Brest. Er hat sich von
    Anfang an um den Server gekümmert: Danke, dass du übernimmst! Er ist
    einverstanden, dass wir heute seine Zugänge schließen (er hat alles
    zurückgegeben, das ist einfach gute Praxis).

    Was zu tun ist, laut ihm:
    1. Sein Konto darf niemanden mehr hereinlassen, auf keine Weise (er
       hat sich mit einem SSH-Schlüssel angemeldet, man usermod);
    2. er darf kein sudo mehr haben;
    3. sein Schlüssel liegt auch auf dem gemeinsamen Konto deploy (das für
       die Releases): Entferne SEINEN Schlüssel, aber nicht die der
       anderen;
    4. er ist vielleicht noch angemeldet (who);
    5. und vor allem: Er ließ „ein paar Sachen“ unter seinem Konto laufen.
       Ich weiß, dass es das nächtliche Backup der Kasse gibt: Das muss
       weiterlaufen! (crontab -l -u marc, als root)

    Für sudo ist dein Passwort: radieschen-2027

departure-notes-marc =
    Meine Notizen (Marc)

    - Die Kasse läuft als Dienst (till.service), unter dem Konto till.
    - Releases: über das Konto deploy (Schlüssel in
      /home/deploy/.ssh/authorized_keys: die CI, Lina und ich).
    - Backup: mein Skript ~/bin/kasse-sicherung.sh, jede Nacht um
      2:30 Uhr, in meiner crontab. Sollte irgendwann ordentlich neu
      gemacht werden…

## Ereignisse

departure-event-lock-only =
    Das Passwort von marc ist gesperrt… aber er hat sich mit einem
    SSH-Schlüssel angemeldet, und usermod -L ändert daran nichts. Lies man
    usermod noch einmal: Um ein Konto wirklich zu schließen, musst du es
    auch ablaufen lassen (oder ihm seine Login-Shell oder seine Schlüssel
    nehmen).
# { $file }: die Schlüsseldatei des Kontos deploy
departure-event-deploy-empty =
    Vorsicht: In { $file } fehlen Schlüssel! Die CI und Lina können die
    Kasse nicht mehr releasen. Entferne nur Marcs Zeile (sein Schlüssel
    endet auf marc@laptop). Leg die anderen zurück: nano, und die Zeilen
    deploy@ci und lina@werkstatt behalten.
departure-event-script-lost =
    Marcs Verzeichnis ist weg, und mit ihm sein Backup-Skript… und das
    Backup heute Nacht läuft nicht (cron ignoriert die crontab eines
    gelöschten Kontos).

    Zum Glück enthält das Backup von gestern /home: Schau in
    /srv/sicherungen nach (als root). Nächstes Mal: zuerst nachsehen, was
    ein Konto laufen lässt, dann löschen.
departure-event-task-personal =
    Das Backup steht in DEINER crontab. Es läuft… bis zu dem Tag, an dem
    auch du übergibst: Genau das war Marcs Falle. Eine Aufgabe der
    Genossenschaft gehört in die crontab von root (sudo crontab -e), oder
    in eine Datei in /etc/cron.d, und ihr Skript außerhalb jedes
    Home-Verzeichnisses (zum Beispiel /usr/local/bin).
departure-event-backup =
    Das Backup der Kasse hängt nicht mehr von Marcs Konto ab: Sein Skript
    liegt außerhalb von /home/marc, und es wird von einem Konto
    ausgeführt, das bleibt.
departure-event-closed =
    Marc kommt nicht mehr herein: nicht über sein Konto, nicht über
    deploy, kein sudo mehr, keine offene Sitzung mehr.
departure-event-end =
    Alles ist geschlossen, nichts ist kaputt. Awa: „Marc sagt danke… und
    willkommen im Team!“

    Gut gemacht! Du hast das Kapitel „Der Abschied“ abgeschlossen.

    WAS PASSIERT IST
    Ein Konto zu schließen ist keine einzelne Aktion. usermod -L sperrt nur
    das Passwort: Ein SSH-Schlüssel kommt immer noch durch. Man muss das
    Konto ablaufen lassen (usermod -e 1, oder chage -E 0), oder ihm seine
    Shell nehmen, oder es löschen. Und Zugänge leben auch anderswo: ein
    Schlüssel in einem gemeinsamen Konto, ein Platz in der Gruppe sudo, eine
    noch offene Sitzung, geplante Aufgaben, von denen das Team abhängt.

    GUTE PRAXIS
    - Eine Checkliste für Abschiede: Konto (abgelaufen oder gelöscht),
      Schlüssel (überall, auch in gemeinsamen Konten), Gruppen (sudo!),
      Sitzungen (who, pkill -u), die crontab und die Dienste des Kontos.
    - Nachsehen, was ein Konto laufen lässt, BEVOR man es löscht
      (crontab -l -u, ps -u, find / -user).
    - Aufgaben des Teams leben nicht in einem persönlichen Konto: die
      crontab von root oder eines Dienstkontos, /etc/cron.d, Timer von
      systemd.
    - Noch besser: ein Schlüssel pro Person und kein gemeinsames Konto,
      damit man weiß, wer was getan hat, und Zugänge entziehen kann, ohne
      die anderen zu stören.

    DOKUMENTATION
    - usermod: https://man7.org/linux/man-pages/man8/usermod.8.html
    - userdel: https://man7.org/linux/man-pages/man8/userdel.8.html
    - chage: https://man7.org/linux/man-pages/man1/chage.1.html

## Die Rechner, die in den SSH-Schlüsseln des Teams genannt werden
## (marc@laptop): Hostnamen, kleingeschrieben, ohne Umlaute oder
## Leerzeichen (von den Kapiteln von „Die Genossenschaft“ geteilt)
departure-host-marc = laptop
departure-host-lina = werkstatt
