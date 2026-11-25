### What the chapters of "The Blood Drive" share: the game's own messages
### about keepalived, HAProxy, socat and tcpdump. Commands, options, paths
### and outputs are not translated.

keepalived-usage = Aufruf: keepalived [-t] [-f DATEI] [-v] (das keepalived des Spiels: man keepalived)
keepalived-not-by-hand = keepalived läuft hier als Dienst: systemctl start, stop oder reload keepalived. Um eine Konfiguration zu prüfen: keepalived -t (man keepalived).
haproxy-usage = Aufruf: haproxy -c -f /etc/haproxy/haproxy.cfg [-q] | haproxy -v | haproxy -vv (das haproxy des Spiels: man haproxy)
haproxy-not-by-hand = HAProxy läuft hier als Dienst: systemctl start, stop oder reload haproxy. Um eine Konfiguration zu prüfen: haproxy -c -f /etc/haproxy/haproxy.cfg.
socat-only-stdio = Das socat des Spiels verbindet seine Standardein- und -ausgabe (STDIO, oder -) mit einem UNIX-Socket: echo "show stat" | sudo socat stdio /run/haproxy/admin.sock
tcpdump-usage = Aufruf: tcpdump [-envv] [-c anzahl] [-i schnittstelle] [ausdruck] (man tcpdump)
tcpdump-stopped = (Das Spiel stoppt die Aufzeichnung nach zehn Sekunden, als hättest du Strg-C gedrückt; -c ANZAHL stoppt sie nach ANZAHL Paketen.)
