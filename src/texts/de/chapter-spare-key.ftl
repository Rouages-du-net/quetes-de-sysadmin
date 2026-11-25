### Geschichte „Die Vorratskammer“, Kapitel „Der Zweitschlüssel“: Das
### restic-Repository auf der verschlüsselten Platte hat einen einzigen
### Schlüssel, dessen Passwort nur auf dem Server lebt, den es sichert.
### restic key list/add, RESTIC_*-Variablen, check. Befehle, Optionen,
### Pfade, Variablen und Ausgaben werden nicht übersetzt.

chapter-spare-key = Der Zweitschlüssel
    .summary = Der nächtliche Job sichert jetzt in ein restic-Repository auf der verschlüsselten Platte. Die Kassenwartin fragt, ob ihr Umschlag reichen würde, um die Backups zu lesen, wenn der Server abbrennt: Er würde es nicht. Dem Repository einen zweiten Schlüssel geben, der außerhalb des Servers lebt, ohne den nächtlichen Job kaputt zu machen.

spare-key-script-comment = Nächtliches Backup auf die externe Platte (Noor). Öffnet die Platte mit der Schlüsseldatei, restic, schließt.

## Dateien

spare-key-message-fatou =
    Von: Fatou (Koordinatorin)
    Montag, 12. März, 8:50

    Guten Morgen!

    Die Platte ist heute Morgen von Joaquín zurückgekommen; sie ist
    angeschlossen und geschlossen, wie es sein soll. Seit letztem Montag
    hat Noor den nächtlichen Job auf restic umgestellt (das Skript ist
    /usr/local/sbin/nightly-backup): Sie sagt, es behält die Version jeder
    Nacht und speichert nur, was sich geändert hat.

    Am Mittwoch hat Mei mir eine Frage gestellt, die ich nicht beantworten
    konnte: „Wenn kiste heute Nacht abbrennt, könnten wir mit dem, was in
    meinem Umschlag ist, die Backups lesen?“ Könntest du das prüfen und
    reparieren, was zu reparieren ist? Sie hat dir eine Notiz
    hinterlassen.

    Fatou

spare-key-note-mei =
    Notiz von Mei (Kassenwartin)

    Für die Platte habe ich die Passphrase. Aber Noor sagt mir, die
    Backups darin haben ihr eigenes Passwort, und das liegt „in einer
    Datei auf dem Server“. Wenn der Server weg ist, ist die Datei es auch,
    oder?

    Falls es hilft: Ich habe im Passwortmanager ein Passwort für die
    Backups erzeugt („Pantry backups — restic recovery“), und es liegt
    auch im Umschlag:

        { $password }

    Lösch diese Notiz, wenn du es benutzt hast.

## Ereignisse

spare-key-event-opened =
    Die Platte ist offen und eingehängt. Bevor du etwas anfasst, lies, wie
    der nächtliche Job das Repository erreicht: Das Skript liegt in
    /usr/local/sbin.
spare-key-event-job =
    Der Job übergibt kein -r und kein Passwort: Er exportiert zwei
    Variablen, RESTIC_REPOSITORY und RESTIC_PASSWORD_FILE, die restic aus
    seiner Umgebung liest. Das Passwort steht in /root/.restic-pass. Du
    kannst dasselbe tun (export) oder -r und --password-file (-p) auf der
    Befehlszeile angeben. Und restic braucht hier root: Das Repository
    gehört root.
spare-key-event-sudo-env =
    restic sieht deine Variablen nicht: sudo startet es mit einer sauberen
    Umgebung (env_reset, siehe man sudoers). Schreib sie nach sudo (sudo
    RESTIC_REPOSITORY=… restic …), nimm sudo -E oder gib -r und -p an.
spare-key-event-snapshots =
    Ein Snapshot pro Werktagsnacht: Der Job funktioniert. Jetzt die Frage,
    die Mei gestellt hat: Wer kann dieses Repository öffnen? Jeder
    Schlüssel ist ein Weg hinein (man restic, der Befehl key).
spare-key-event-one-key =
    Die Schlüsselliste: was die Verschlüsselung von restic als Weg hinein
    annimmt. Zähl sie und überleg, wo jedes Passwort lebt.
spare-key-event-envelope-fails =
    „wrong password or no key found“: Meis Passwort öffnet heute nichts.
    Mit ihrem Umschlag könnte sie die Platte öffnen und stünde dann vor der
    Tür des Repositorys. Diese Tür braucht einen zweiten Schlüssel.
spare-key-event-init =
    restic init legt ein NEUES Repository an: Dieses existiert schon und
    enthält die Backups. Behalte es: Dir fehlt ein Schlüssel, kein
    Repository.
spare-key-event-remove-current =
    restic weigert sich, den Schlüssel zu entfernen, mit dem du gerade mit
    ihm sprichst: Glück gehabt, denn das ist der Schlüssel des nächtlichen
    Jobs.
spare-key-event-nightly-broken =
    Vorsicht: Kein Schlüssel öffnet das Repository mehr mit
    /root/.restic-pass. Heute Nacht scheitert der Job mit „wrong password
    or no key found“. Der nächtliche Schlüssel muss bleiben; Meiner kommt
    zusätzlich dazu (restic key add, nicht passwd). Stell den Schlüssel
    des Jobs wieder her (key add mit dem Inhalt von /root/.restic-pass).
spare-key-event-escrowed =
    Jetzt zwei Schlüssel: der des Jobs (sein Passwort auf kiste) und der
    von Mei (sein Passwort im Passwortmanager und im Umschlag). Beide
    öffnen dieselben Daten: restic verschlüsselt die Daten mit einem
    Hauptschlüssel, und jeder Schlüssel entsperrt nur diesen
    Hauptschlüssel. Prüfe jetzt, dass das Repository in Ordnung ist.
spare-key-event-checked =
    restic check: keine Fehler. Das Repository ist in Ordnung, und es
    öffnet sich mit einem Passwort, das nicht auf kiste lebt.
spare-key-event-written-down =
    Meis Passwort steht jetzt in einer Datei auf kiste (oder auf der
    Platte selbst). Genau diese Falle schaffst du gerade ab: Das Passwort
    muss außerhalb dieser Maschine leben. Lösch diese Datei.
spare-key-event-note =
    Meis Notiz ist weg: Ihr Passwort lebt nur noch im Passwortmanager und
    im Umschlag.
spare-key-event-note-early =
    Du hast Meis Notiz gelöscht, bevor ihr Schlüssel im Repository war:
    Sie hat sie noch einmal geschickt (cat auf die Notiz). Lösch sie,
    sobald der Schlüssel hinzugefügt ist.
spare-key-event-closed =
    Die Platte ist ausgehängt und geschlossen, bereit, am Freitag das Haus
    zu verlassen.
spare-key-event-end =
    Mei: „Mit meinem Umschlag allein öffnet sich also die Platte, und die
    Backups auch? Selbst wenn kiste ein Haufen Asche ist?“ Ja. Fatou:
    „Dann probieren wir es am Samstag wirklich aus.“

    Gut gemacht! Du hast Kapitel 2 von Die Vorratskammer abgeschlossen.
    (Was als Nächstes kommt, wartet auf dich: ssh kiste.)

    WAS PASSIERT IST
    Das Repository war verschlüsselt, aber sein einziger Schlüssel war ein
    Passwort, das auf kiste gespeichert war, der Maschine, die es sichert:
    Wäre kiste gestorben, wären die Backups mitgestorben, unlesbar. Du hast
    gelesen, wie der Job das Repository erreicht (RESTIC_REPOSITORY,
    RESTIC_PASSWORD_FILE), die Schlüssel aufgelistet, einen zweiten
    hinzugefügt, dessen Passwort Mei außerhalb des Servers aufbewahrt
    (restic key add), das Repository geprüft und die Platte geschlossen.

    GUTE PRAXIS
    - Jedes Geheimnis, das eine Wiederherstellung braucht, muss anderswo
      existieren als auf der gesicherten Maschine: die Passphrase der
      Platte UND das Passwort des Repositorys.
    - Ein Schlüssel pro Verwendung: Der Schlüssel des Jobs kann geändert
      oder entfernt werden, ohne den Wiederherstellungsschlüssel zu
      berühren (restic key list, key remove ID).
    - restic key add fügt einen Weg hinein hinzu; key passwd ersetzt den
      aktuellen Schlüssel: Der Job würde seinen eigenen verlieren.
    - sudo setzt die Umgebung zurück: Variablen kommen nach sudo, oder
      nimm -E.
    - restic check nach einer Änderung; check --read-data ab und zu liest
      jedes Pack (langsamer, aber es findet beschädigte Daten).
    - Ein Passwort, das „vorerst“ in einer Datei auf dem Server liegt, ist
      genau die Falle: Lösch die Notizen.

    DOKUMENTATION
    - restic, Schlüssel und Verschlüsselung: https://restic.readthedocs.io/en/stable/070_encryption.html
    - restic, Umgebungsvariablen: https://restic.readthedocs.io/en/stable/040_backup.html#environment-variables
    - restic, ein Repository prüfen: https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency
