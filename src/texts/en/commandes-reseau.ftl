### Network commands (src/engine/commands/network.ts): ping, dig,
### traceroute and curl answer in English, like the real tools; only
### the game's own messages are here.

dig-usage = Usage: dig name (e.g. dig letters.example)
traceroute-usage = Usage: traceroute host
# Deliberate difference: the real traceroute goes on up to 30 hops.
traceroute-plus-personne = (… and so on up to 30: nobody answers any more)

host-usage = Usage: host [-t type] name [server]
named-checkzone-usage = usage: named-checkzone [-djqvD] [-c class] [-o output] zonename filename
rndc-usage = (Here: rndc reload [zone], rndc status; see man rndc)
ip-usage =
    Usage: ip [ OPTIONS ] OBJECT {"{"} COMMAND | help {"}"}
    where  OBJECT := {"{"} address | link | route {"}"}
           OPTIONS := {"{"} -br[ief] | -d[etails] {"}"}

sysctl-usage =
    Usage:
     sysctl [options] [variable[=value] ...]
    Use --help for more information.
# conntrack -E waits for events forever: the game does not simulate it.
conntrack-evenements = conntrack -E waits forever for new connections: the game does not simulate it. conntrack -L shows the current ones.
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
# wg set, setconf…: changing a running interface is not simulated.
wg-set-non-simule = The game does not simulate changes to a running interface: edit /etc/wireguard/wg0.conf, then wg-quick down wg0 and wg-quick up wg0 (or systemctl restart wg-quick@wg0).
# { $commande }: ldapadd, ldapmodify or ldapdelete, with no file or input
ldap-rien-a-faire = { $commande } expects its changes in an LDIF file (-f file) or through a pipe (cat file.ldif | { $commande } …): the game does not read the keyboard.
radtest-usage = Usage: radtest [OPTIONS] user passwd radius-server[:port] nas-port-number secret [ppphint] [nasname]
freeradius-usage = Usage: freeradius [-d <raddb>] [-n <name>] [-C] [-X] [-v]
# After freeradius -X: the real server stays in the foreground until Ctrl+C.
freeradius-x-fin = (The server would wait for more requests until Ctrl+C; the game stops it here. To make it actually serve: systemctl start freeradius.)

# nft on a machine managed by ufw and fail2ban: the game only shows an overview.
nft-apercu-ufw = (On this machine, ufw and fail2ban write the firewall rules: here, nft is for looking at them (sudo nft list ruleset, list tables, list table ip filter). To change them, go through ufw and fail2ban: a rule added by hand would be overwritten at the next reload.)
