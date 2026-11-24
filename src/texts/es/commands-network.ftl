### Comandos de red (src/engine/commands/network.ts): ping, dig, traceroute
### y curl responden en inglés, como las herramientas reales; aquí solo
### están los mensajes propios del juego.

dig-usage = Uso: dig nombre (p. ej. dig letters.example)
traceroute-usage = Uso: traceroute máquina
# Diferencia deliberada: el traceroute real sigue hasta 30 saltos.
traceroute-more-person = (… y así hasta 30: ya no responde nadie)

host-usage = Uso: host [-t tipo] nombre [servidor]
named-checkzone-usage = usage: named-checkzone [-djqvD] [-c class] [-o output] zonename filename
rndc-usage = (Aquí: rndc reload [zona], rndc status; mira man rndc)
ip-usage =
    Usage: ip [ OPTIONS ] OBJECT {"{"} COMMAND | help {"}"}
    where  OBJECT := {"{"} address | link | route {"}"}
           OPTIONS := {"{"} -br[ief] | -d[etails] {"}"}

sysctl-usage =
    Usage:
     sysctl [options] [variable[=value] ...]
    Use --help for more information.
# conntrack -E espera eventos para siempre: el juego no lo simula.
conntrack-events = conntrack -E espera para siempre conexiones nuevas: el juego no lo simula. conntrack -L muestra las actuales.
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
# wg set, setconf…: cambiar una interfaz en marcha no se simula.
wg-set-not-simulated = El juego no simula los cambios en una interfaz en marcha: edita /etc/wireguard/wg0.conf y luego wg-quick down wg0 y wg-quick up wg0 (o systemctl restart wg-quick@wg0).
# { $command }: ldapadd, ldapmodify o ldapdelete, sin archivo ni entrada
ldap-nothing-a-do = { $command } espera sus cambios en un archivo LDIF (-f archivo) o por una tubería (cat archivo.ldif | { $command } …): el juego no lee el teclado.
radtest-usage = Usage: radtest [OPTIONS] user passwd radius-server[:port] nas-port-number secret [ppphint] [nasname]
freeradius-usage = Usage: freeradius [-d <raddb>] [-n <name>] [-C] [-X] [-v]
# Después de freeradius -X: el servidor real se queda en primer plano hasta Ctrl+C.
freeradius-x-end = (El servidor esperaría más peticiones hasta Ctrl+C; el juego lo detiene aquí. Para que sirva de verdad: systemctl start freeradius.)

# nft en una máquina gestionada por ufw y fail2ban: el juego solo muestra una vista general.
nft-preview-ufw = (En esta máquina, ufw y fail2ban escriben las reglas del cortafuegos: aquí nft sirve para mirarlas (sudo nft list ruleset, list tables, list table ip filter). Para cambiarlas, pasa por ufw y fail2ban: una regla añadida a mano se sobrescribiría en la siguiente recarga.)

## smbclient, pdbedit (Samba)

smbclient-interactive = smbclient: el juego ejecuta los comandos dados con -c (p. ej. -c "ls"; varios: -c "put foto.jpg; ls"), no una sesión interactiva.
pdbedit-usage = pdbedit: el juego solo lista los usuarios de Samba: pdbedit -L

## gpg (GnuPG)

gpg-usage = gpg: ninguna acción indicada (prueba: gpg --list-keys, gpg -c archivo, gpg --verify archivo.asc; mira man gpg)
