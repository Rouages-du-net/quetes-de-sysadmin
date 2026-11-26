### sudo -l und visudo: die Meldungen von sudo (plugins/sudoers) aus seiner
### deutschen Übersetzung (Translation Project). { $file }, { $account } und
### { $host } sind technische Bezeichner.

visudo-usage = Aufruf: visudo [-chqsV] [[-f] sudoers ]
visudo-permission = visudo: { $file } kann nicht geöffnet werden: Keine Berechtigung
visudo-missing = visudo: { $file } kann nicht geöffnet werden: Datei oder Verzeichnis nicht gefunden
visudo-analysis-succeeded = { $file }: Syntax OK
visudo-and-now = Was nun?
visudo-options =
    Optionen sind:
      sudoers-Datei (e)rneut bearbeiten
      (x) Beenden ohne die sudoers-Datei zu speichern
      (Q) Beenden und Änderungen in der sudoers-Datei speichern (GEFAHR!)
sudoers-error-syntax = Syntaxfehler
sudoers-error-path = Ein vollständiger Pfadname wird erwartet
sudo-sources-invalid = sudo: Keine gültigen sudoers-Quellen gefunden, wird beendet
# { $defaults }: die Defaults-Optionen; { $rules }: eine Regel pro Zeile, schon eingerückt
sudo =
    Passende Defaults-Einträge für { $account } auf { $host }:
        { $defaults }

    Der Benutzer { $account } darf die folgenden Befehle auf { $host } ausführen:
    { $rules }
sudo-none = Der Benutzer { $account } darf sudo auf { $host } nicht ausführen.
# { $user }: wer spielt; { $command }: der Pfad der Shell; { $account }: root oder das Konto von sudo -u; { $host }: die Maschine
sudo-not-allowed = Sorry, der Benutzer { $user } darf „{ $command }“ als { $account } auf { $host } nicht ausführen.
su-password = Passwort:
