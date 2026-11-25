### Netzwerkbefehle (src/engine/commands/network.ts): ping, dig,
### traceroute und curl antworten auf Englisch, wie die echten Werkzeuge;
### nur die eigenen Meldungen des Spiels stehen hier.

dig-usage = Aufruf: dig name (z. B. dig letters.example)
traceroute-usage = Aufruf: traceroute host
# Bewusster Unterschied: Das echte traceroute geht bis zu 30 Hops weiter.
traceroute-more-person = (… und so weiter bis 30: Niemand antwortet mehr)

host-usage = Aufruf: host [-t typ] name [server]
named-checkzone-usage = usage: named-checkzone [-djqvD] [-c class] [-o output] zonename filename
rndc-usage = (Hier: rndc reload [zone], rndc status; siehe man rndc)
ip-usage =
    Usage: ip [ OPTIONS ] OBJECT {"{"} COMMAND | help {"}"}
    where  OBJECT := {"{"} address | link | route {"}"}
           OPTIONS := {"{"} -br[ief] | -d[etails] {"}"}

sysctl-usage =
    Aufruf:
     sysctl [Optionen] [Variable[=Wert] ...]
    Mit --help erhalten Sie weitere Informationen.
# conntrack -E wartet ewig auf Ereignisse: Das Spiel simuliert es nicht.
conntrack-events = conntrack -E wartet ewig auf neue Verbindungen: Das Spiel simuliert das nicht. conntrack -L zeigt die aktuellen.
wg-usage =
    Usage: wg <cmd> [<args>]

    Available subcommands:
      show: Shows the current configuration and device information
      showconf: Shows the current configuration of a given WireGuard interface, for use with `setconf'
      genkey: Generates a new private key and writes it to stdout
      genpsk: Generates a new preshared key and writes it to stdout
      pubkey: Reads a private key from stdin and writes a public key to stdout
    You may pass `--help' to any of these subcommands to view usage.
wg-quick-usage = Usage: wg-quick [ up | down | save | strip ] [ CONFIG_FILE | INTERFACE ]
# wg set, setconf…: Änderungen an einer laufenden Schnittstelle werden nicht simuliert.
wg-set-not-simulated = Das Spiel simuliert keine Änderungen an einer laufenden Schnittstelle: Bearbeite /etc/wireguard/wg0.conf, dann wg-quick down wg0 und wg-quick up wg0 (oder systemctl restart wg-quick@wg0).
# { $command }: ldapadd, ldapmodify oder ldapdelete, ohne Datei oder Eingabe
ldap-nothing-a-do = { $command } erwartet seine Änderungen in einer LDIF-Datei (-f datei) oder über eine Pipe (cat datei.ldif | { $command } …): Das Spiel liest nicht von der Tastatur.
radtest-usage = Usage: radtest [OPTIONS] user passwd radius-server[:port] nas-port-number secret [ppphint] [nasname]
freeradius-usage = Usage: freeradius [-d <raddb>] [-n <name>] [-C] [-X] [-v]
# Nach freeradius -X: Der echte Server bleibt bis Strg+C im Vordergrund.
freeradius-x-end = (Der Server würde bis Strg+C auf weitere Anfragen warten; das Spiel stoppt ihn hier. Damit er wirklich Anfragen bedient: systemctl start freeradius.)

# nft auf einer Maschine, die ufw und fail2ban verwalten: Das Spiel zeigt nur eine Übersicht.
nft-preview-ufw = (Auf dieser Maschine schreiben ufw und fail2ban die Firewall-Regeln: Hier dient nft dazu, sie anzusehen (sudo nft list ruleset, list tables, list table ip filter). Um sie zu ändern, geh über ufw und fail2ban: Eine von Hand hinzugefügte Regel würde beim nächsten Neuladen überschrieben.)

## smbclient, pdbedit (Samba)

smbclient-interactive = smbclient: Das Spiel führt die mit -c angegebenen Befehle aus (z. B. -c "ls"; mehrere: -c "put foto.jpg; ls"), keine interaktive Sitzung.
pdbedit-usage = pdbedit: Das Spiel listet nur die Samba-Benutzer: pdbedit -L

## gpg (GnuPG)

gpg-usage = gpg: keine Aktion angegeben (versuch: gpg --list-keys, gpg -c datei, gpg --verify datei.asc; siehe man gpg)
