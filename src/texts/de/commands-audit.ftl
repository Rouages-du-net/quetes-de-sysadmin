### Audit-Befehle (src/engine/commands/nmap.ts und lynis.ts): nmap und
### lynis antworten auf Englisch, wie die echten Werkzeuge; nur die eigenen
### Meldungen des Spiels stehen hier.

nmap-none-target = WARNING: No targets were specified, so 0 hosts scanned.
lynis-without-root = Lynis braucht root, um die ganze Konfiguration zu lesen (versuch: sudo lynis audit system).
lynis-usage = Aufruf: lynis audit system  (siehe man lynis)
lynis-audit-target = Lynis kann hier nur „audit system“ prüfen (erhalten: „audit { $target }“).
lynis-command-unknown = lynis: „{ $command }“ ist kein Befehl, den dieses Spiel kennt (siehe man lynis).
