### Geschichte „Der Fotoclub“, Kapitel 2 „Wem gehören die Dateien?“: NFS
### überträgt Nummern (uid, gid), root_squash, usermod -u, chown.
### Konfiguration, Pfade und die Ausgaben der Werkzeuge werden nicht
### übersetzt.

chapter-nfs-owners = Wem gehören die Dateien?
    .summary = Sams Scans, vom Rechner in der Dunkelkammer kopiert, gehören auf dem NAS Nora, und Sam kann seine eigenen Alben nicht mehr ändern. Finde heraus, warum, und behebe es dauerhaft.

## Dateien

nfs-owners-message-margot =
    Von:     Margot
    An:      dich
    Betreff: Sams Scans gehören Nora??

    Hallo,

    Seit letzter Woche scannt Sam seine Filme auf dem Rechner in der
    Dunkelkammer und kopiert sie nach /mnt/photos/2028-film-scans. Aber auf
    dem NAS sagt ls -l, dass sie Nora gehören! Nora ist ratlos, Sam ist
    wütend.

    Und es ist noch schlimmer: Vom Rechner in der Dunkelkammer aus kann Sam
    seine eigenen Fotos in 2028-outings nicht mehr nachbearbeiten. Er hat
    es mit sudo versucht und trotzdem „Keine Berechtigung“ bekommen.

    Sam ist noch auf dem Rechner in der Dunkelkammer angemeldet und
    bearbeitet (darktable). Gleiches sudo-Passwort: verschluss-2028.

    Margot

## Ereignisse

nfs-owners-event-numbers =
    Über NFS (sec=sys) kennt der Server keine Namen: Der Client schickt
    Nummern (uid, gid), und jede Maschine zeigt sie mit ihren eigenen
    Namen. Sam ist 1001 auf dem Rechner in der Dunkelkammer, 1002 auf dem
    NAS; und 1001 ist auf dem NAS Nora. Vergleich: id sam auf jeder
    Maschine (oder ls -n, das die Nummern zeigt).
nfs-owners-event-squash =
    sudo hilft nicht: Mit root_squash (der Standard) wird root auf einem
    Client auf dem NAS zu nobody (65534), und nobody darf hier nicht
    schreiben. Das ist ein Schutz: nie no_root_squash dafür. Der Ausweg
    ist, dass Sam überall Sam ist.
nfs-owners-event-no-root-squash =
    no_root_squash gibt root auf dem Rechner in der Dunkelkammer jedes
    Recht auf die Fotos des NAS: Jede Person, die auf einem Client root ist
    (oder einen Laptop mit dieser Adresse ansteckt), könnte alles löschen
    oder ändern. Stell root_squash wieder her, und gib Sam stattdessen auf
    beiden Maschinen dieselbe uid.
nfs-owners-event-busy =
    usermod ändert die uid eines Kontos nicht, das in Benutzung ist: Sam
    ist auf dem Rechner in der Dunkelkammer angemeldet (ps -u sam). Bitte
    ihn, zu speichern und sich abzumelden, oder beende seine Sitzung selbst
    (pkill -u sam), und versuch es dann noch einmal.
nfs-owners-event-taken =
    1001 gehört auf dem NAS Nora: Sams uid auf dem NAS zu ändern, würde
    kollidieren. Das NAS hat die meisten Dateien und die meisten Konten;
    richte den Rechner in der Dunkelkammer danach aus (dort ist Sam 1002).
nfs-owners-event-uid =
    Sam hat jetzt auf beiden Maschinen dieselbe Nummer: Vom Rechner in der
    Dunkelkammer aus gehören ihm seine Alben wieder. Was bleibt: die schon
    kopierten Scans, die auf dem NAS 1001 tragen: Noras Nummer, und die
    ihrer Gruppe. Gib sie Sam und dem Club zurück, auf dem NAS (man chown:
    -R, besitzer:gruppe).
nfs-owners-event-end =
    Sam ist überall 1002, seine Scans gehören ihm, und er kann seine Alben
    vom Rechner in der Dunkelkammer aus nachbearbeiten. root bleibt
    gestutzt. Margot: „Nora und Sam sind wieder befreundet. Ich führe eine
    Liste der uids, versprochen.“

    Gut gemacht! Du hast das Kapitel „Wem gehören die Dateien?“ abgeschlossen.

    WAS PASSIERT IST
    Sams Konto wurde auf dem Rechner in der Dunkelkammer als erstes
    angelegt (1001), nach Noras auf dem NAS (ebenfalls 1001). NFS mit
    sec=sys überträgt nur Nummern: Für das NAS ist 1001 Nora, egal, wie
    der Client sie nennt.

    ÜBERALL DIESELBEN NUMMERN
    - id sam auf jeder Maschine, ls -n, um die Nummern zu sehen.
    - usermod -u 1002 sam (das Konto darf nicht in Benutzung sein; die
      Dateien des Home-Verzeichnisses folgen; groupmod -g für die Gruppe),
      dann chown auf dem Server für das, was mit den falschen Nummern
      geschrieben wurde.
    - Für viele Maschinen: ein Verzeichnisdienst (LDAP, siehe „Der
      Verzeichnisdienst“), damit jede Maschine dieselben uids hat, oder
      NFSv4 mit Kerberos und idmapd (Namen statt Nummern).

    GUTE PRAXIS
    - root_squash behalten; no_root_squash nur für eine Maschine, der du
      völlig vertraust, für einen genauen Zweck (ein Backup-Server,
      plattenlose Clients).
    - Die uids vor dem ersten Konto auf jeder Maschine planen.

    DOKUMENTATION
    - exports(5), User ID Mapping: https://man7.org/linux/man-pages/man5/exports.5.html
    - usermod(8): https://man7.org/linux/man-pages/man8/usermod.8.html
