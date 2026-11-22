### What the chapters of "The Blood Drive" share: the game's own messages
### about keepalived, HAProxy, socat and tcpdump. Commands, options, paths
### and outputs are not translated.

keepalived-usage = Usage: keepalived [-t] [-f FILE] [-v] (the game's keepalived: man keepalived)
keepalived-not-by-hand = keepalived runs as a service here: systemctl start, stop or reload keepalived. To check a configuration: keepalived -t (man keepalived).
haproxy-usage = Usage: haproxy -c -f /etc/haproxy/haproxy.cfg [-q] | haproxy -v | haproxy -vv (the game's haproxy: man haproxy)
haproxy-not-by-hand = HAProxy runs as a service here: systemctl start, stop or reload haproxy. To check a configuration: haproxy -c -f /etc/haproxy/haproxy.cfg.
socat-only-stdio = The game's socat joins its standard input and output (STDIO, or -) to a UNIX socket: echo "show stat" | sudo socat stdio /run/haproxy/admin.sock
tcpdump-usage = Usage: tcpdump [-envv] [-c count] [-i interface] [expression] (man tcpdump)
tcpdump-stopped = (The game stops the capture after ten seconds, as if you had pressed Ctrl-C; -c COUNT stops it after COUNT packets.)
