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
