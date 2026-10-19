### Commandes réseau (src/moteur/commandes/reseau.ts) : ping, dig,
### traceroute et curl répondent en anglais, comme les vrais outils ; seuls
### les messages propres au jeu sont ici.

dig-usage = Usage : dig nom (ex. : dig lettres.example)
traceroute-usage = Usage : traceroute machine
# Écart volontaire : le vrai traceroute continue jusqu'à 30 sauts.
traceroute-plus-personne = (… et ainsi de suite jusqu’à 30 : plus personne ne répond)

host-usage = Usage: host [-t type] nom [serveur]
named-checkzone-usage = usage: named-checkzone [-djqvD] [-c class] [-o output] zonename filename
rndc-usage = (Ici : rndc reload [zone], rndc status ; voir man rndc)
ip-usage =
    Usage: ip [ OPTIONS ] OBJECT {"{"} COMMAND | help {"}"}
    where  OBJECT := {"{"} address | link | route {"}"}
           OPTIONS := {"{"} -br[ief] | -d[etails] {"}"}

sysctl-usage =
    Usage:
     sysctl [options] [variable[=value] ...]
    Use --help for more information.
# conntrack -E attend des événements sans fin : le jeu ne le simule pas.
conntrack-evenements = conntrack -E attend sans fin les nouveaux échanges : le jeu ne le simule pas. conntrack -L montre ceux du moment.
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
# wg set, setconf… : changer une interface en marche n'est pas simulé.
wg-set-non-simule = Le jeu ne simule pas les changements d'une interface en marche : modifie /etc/wireguard/wg0.conf, puis wg-quick down wg0 et wg-quick up wg0 (ou systemctl restart wg-quick@wg0).
# { $commande } : ldapadd, ldapmodify ou ldapdelete, sans fichier ni entrée
ldap-rien-a-faire = { $commande } attend ses changements dans un fichier LDIF (-f fichier) ou par un tube (cat fichier.ldif | { $commande } …) : le jeu ne lit pas le clavier.
radtest-usage = Usage: radtest [OPTIONS] user passwd radius-server[:port] nas-port-number secret [ppphint] [nasname]
freeradius-usage = Usage: freeradius [-d <raddb>] [-n <name>] [-C] [-X] [-v]
# Après freeradius -X : le vrai serveur reste au premier plan jusqu'à Ctrl+C.
freeradius-x-fin = (Le serveur attendrait d'autres demandes jusqu'à Ctrl+C ; le jeu l'arrête ici. Pour qu'il serve vraiment : systemctl start freeradius.)
