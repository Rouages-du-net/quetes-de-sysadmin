### Geschichte „Die Nachbarschaftsbriefe“, Kapitel 7 „Der Port“: SSH auf
### einen anderen Port verlegen, ohne sich auszusperren (sshd, ufw,
### ~/.ssh/config, das fail2ban-Jail). Befehle, Pfade, Optionen und
### Log-Zeilen werden nicht übersetzt.

chapter-port = Der Port
    .summary = Roboter überschwemmen das SSH-Log: SSH auf Port 2222 verlegen, ohne sich auszusperren und ohne fail2ban zu vergessen.

## Dateien

# { $port }: der neue SSH-Port
port-email-kofi =
    Von:     Kofi
    An:      dich
    Betreff: Der SSH-Port

    Rania hat sich das SSH-Log angesehen (journalctl -u ssh): jede Nacht
    Hunderte „Invalid user“, immer auf Port 22. fail2ban sperrt einige,
    aber andere kommen nach, und in diesem Log sieht man nichts Nützliches
    mehr.

    Sie schlägt vor, SSH auf Port { $port } zu verlegen: „Das schützt vor
    nichts (das tun unsere Schlüssel und fail2ban), aber die meisten
    Roboter klopfen nur an die 22. Das Log wird wieder lesbar.“

    Gut, aber ich erinnere mich an die Firewall: Wir hätten uns fast
    ausgesperrt. Diesmal gibt es mehrere Türen zu öffnen, bevor man eine
    schließt:
      - der SSH-Server selbst (man sshd_config, Port);
      - die Firewall (sudo ufw status);
      - dein Rechner, der wissen muss, wo er anklopfen soll (man ssh_config);
      - und fail2ban: Überwacht sein Jail sshd den richtigen Port?

    Rania fügt hinzu: „ufw ist nur eine Fassade. Die echten Regeln, die
    des Kernels, liest man mit sudo nft list ruleset. Ein Blick lohnt sich.“

## Ereignisse

port-event-locked-out =
    ACHTUNG: sshd lauscht auf keinem Port mehr, den die Firewall
    durchlässt. Deine Sitzung hält (weder sshd noch ufw kappen bestehende
    Verbindungen), aber die nächste Verbindung wird scheitern. Repariere es,
    BEVOR du dich trennst: Stell den alten Port wieder her, oder öffne den
    neuen in ufw.
# { $port }: der neue Port
port-event-two-ports =
    Gut gespielt: sshd lauscht auf beiden Ports, 22 und { $port }, und die
    Firewall lässt { $port } durch. Das ist das sichere Manöver: Die alte
    Tür bleibt offen, während du die neue ausprobierst. Teste sie von
    deinem Rechner aus, in einer anderen Verbindung, bevor du etwas
    schließt. (sudo nft list ruleset zeigt die Regel, die ufw gerade
    geschrieben hat, in der Kette ufw-user-input.)
# { $port }: der neue Port
port-event-attempt =
    Da bist du, verbunden über Port { $port }. Die neue Tür funktioniert:
    Du kannst jetzt die alte schließen, in sshd und in der Firewall.
port-event-default =
    fail2ban hat jail.local neu geladen, aber sein Jail sshd behält noch
    Port 22. Ein „port = 2222“ unter [DEFAULT] gilt nur für die Jails, die
    nichts über ihren Port sagen; aber das [sshd] in jail.conf sagt
    „port = ssh“, und ein Wert im eigenen Abschnitt eines Jails gewinnt
    immer gegen [DEFAULT], egal in welcher Datei (man jail.conf). Die
    Einstellung gehört in einen Abschnitt [sshd] von jail.local.
port-event-sentinel =
    SSH lauscht jetzt nur noch auf 2222… aber das Jail sshd von fail2ban
    sperrt noch auf dem Port „ssh“, also 22 (port = ssh, in jail.conf).
    Eine gesperrte Adresse könnte es auf 2222 weiter versuchen.
    sudo nft list ruleset zeigt es: In der Tabelle f2b-table weist die
    Regel gesperrte Adressen nur bei „tcp dport {"{"} 22 {"}"}“ ab.
port-event-end =
    SSH lauscht jetzt nur noch auf Port 2222, die Firewall lässt nur ihn
    durch, fail2ban überwacht ihn, und dein Rechner weiß, wo er anklopfen
    soll. Am nächsten Tag Rania: „Drei Versuche letzte Nacht statt
    vierhundert. Das Log ist wieder lesbar.“

    Gut gemacht! Du hast das Kapitel „Der Port“ abgeschlossen.

    WAS PASSIERT IST
    Den SSH-Port zu ändern macht den Server nicht sicherer: Ein Portscan
    findet ihn in Sekunden, und es sind die Schlüssel, die Konfiguration
    von sshd und fail2ban, die ihn schützen. Aber die Roboter, die nur an
    die 22 klopfen, verschwinden aus dem Log, und echte Alarme werden
    wieder sichtbar. Das Risiko ist allerdings real: Schließt du einen
    Port zu früh, stehst du draußen.

    GUTE PRAXIS
    - Erst öffnen, dann schließen: sshd auf beiden Ports, ufw erlaubt den
      neuen, von einer anderen Verbindung aus testen, dann den alten schließen.
    - Alles, was den Port erwähnt, zieht mit: Firewall, fail2ban (der Port
      des Jails, in einem Abschnitt [sshd]), ~/.ssh/config auf den
      Arbeitsrechnern, Monitoring-Werkzeuge.
    - ufw und fail2ban schreiben nftables-Regeln: sudo nft list ruleset
      zeigt, was der Kernel wirklich anwendet.
    - Unter Ubuntu 22.10 und neuer startet SSH über einen systemd-Socket
      (ssh.socket): nach dem Ändern des Ports systemctl daemon-reload,
      dann systemctl restart ssh.socket.

    DOKUMENTATION
    - sshd_config, Port: https://man.openbsd.org/sshd_config#Port
    - ssh_config, Port: https://man.openbsd.org/ssh_config#Port
    - jail.conf (fail2ban): https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
