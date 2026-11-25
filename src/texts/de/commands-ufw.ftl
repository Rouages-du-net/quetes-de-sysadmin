### ufw (Firewall): seine Meldungen folgen der deutschen Übersetzung von ufw
### (Launchpad). Schlüsselwörter (allow, deny, incoming…) und Namen der
### Aktionen (ALLOW, DENY…) bleiben auf Englisch, wie im echten ufw.

ufw-usage =
    Aufruf: ufw BEFEHL (siehe man ufw)
      enable | disable                 die Firewall ein- oder ausschalten
      reload                           /etc/default/ufw und die Regeln neu einlesen
      default allow|deny|reject        Standardrichtlinie (eingehend)
      allow|deny|reject|limit REGEL    eine Regel hinzufügen (z. B. ufw allow 22/tcp)
      delete REGEL|NUMMER              eine Regel löschen
      status [verbose|numbered]        Status und Regeln
      app list                         Anwendungsprofile
ufw-root = FEHLER: Sie müssen root sein, um dieses Skript auszuführen
ufw-missing = FEHLER: ufw ist auf dieser Maschine nicht installiert
ufw-syntax = FEHLER: Ungültige Syntax
ufw-idle = Status: inaktiv
ufw-status-active = Status: aktiv
ufw-journalisation = Protokollierung: on (low)
# { $incoming }, { $outgoing }: allow, deny oder reject (nicht übersetzt)
ufw-defaults = Standard: { $incoming } (eingehend), { $outgoing } (ausgehend), disabled (weitergeleitet)
ufw-profiles = Neue Profile: skip
# Spaltenköpfe von ufw status
ufw-to = Zu
ufw-action = Aktion
ufw = Von
ufw-everywhere = Überall
ufw-question = Befehl kann bestehende SSH-Verbindungen unterbrechen. Mit dem Vorgang fortfahren (j|n)?
# { $rule }: die Regel, z. B. „allow 22/tcp“
ufw-question-deletion =
    Wird gelöscht:
     { $rule }
    Mit dem Vorgang fortfahren (j|n)?
ufw-abandon = Abgebrochen
ufw-active = Firewall ist beim System-Start aktiv und aktiviert
ufw-already-active = Firewall ist beim System-Start aktiv und aktiviert
ufw-disabled = Firewall gestoppt und beim System-Start deaktiviert
ufw-default-incoming =
    Standardrichtlinie für eingehende Verbindungen in '{ $policy }' geändert
    (Denken Sie daran, Ihre Regeln entsprechend anzupassen)
ufw-default-outgoing =
    Standardrichtlinie für ausgehende Verbindungen in '{ $policy }' geändert
    (Denken Sie daran, Ihre Regeln entsprechend anzupassen)
ufw-rules-updates = Regeln aktualisiert
ufw-existing = Hinzufügen einer bestehenden Regel übersprungen
ufw-rule-deleted = Regel gelöscht
ufw-nonexistent = Nicht existierende Regel konnte nicht gelöscht werden
ufw-number = FEHLER: Regel '{ $number }' konnte nicht gefunden werden
ufw-reloaded = Firewall neu geladen
ufw-reload-skipped = Firewall nicht aktiviert (Neuladen wird übersprungen)
ufw-applications = Verfügbare Anwendungen:
