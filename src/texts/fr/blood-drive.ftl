### Ce que partagent les chapitres de « La Collecte » : les messages du jeu
### à propos de keepalived, HAProxy, socat et tcpdump. Les commandes, options,
### chemins et sorties ne sont pas traduits.

keepalived-usage = Usage : keepalived [-t] [-f FICHIER] [-v] (le keepalived du jeu : man keepalived)
keepalived-not-by-hand = keepalived tourne ici comme service : systemctl start, stop ou reload keepalived. Pour vérifier une configuration : keepalived -t (man keepalived).
haproxy-usage = Usage : haproxy -c -f /etc/haproxy/haproxy.cfg [-q] | haproxy -v | haproxy -vv (le haproxy du jeu : man haproxy)
haproxy-not-by-hand = HAProxy tourne ici comme service : systemctl start, stop ou reload haproxy. Pour vérifier une configuration : haproxy -c -f /etc/haproxy/haproxy.cfg.
socat-only-stdio = Le socat du jeu relie son entrée et sa sortie standard (STDIO, ou -) à une socket UNIX : echo "show stat" | sudo socat stdio /run/haproxy/admin.sock
tcpdump-usage = Usage : tcpdump [-envv] [-c nombre] [-i interface] [expression] (man tcpdump)
tcpdump-stopped = (Le jeu arrête la capture au bout de dix secondes, comme si vous aviez appuyé sur Ctrl-C ; -c NOMBRE l'arrête après NOMBRE paquets.)
