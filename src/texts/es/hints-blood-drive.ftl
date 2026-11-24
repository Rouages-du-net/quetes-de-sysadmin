### Pistas graduales de «La Donación de Sangre» (ver src/engine/hints.ts):
### un mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin
### el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — La conmutación que no ocurrió

hint-no-failover-haproxy-dead =
    .lead = El sitio está caído: ¿funciona el servicio del balanceador en lb1? Pregúntale a systemd.
    .solution = systemctl status haproxy (y journalctl -u haproxy)
hint-no-failover-vip-on-lb1 =
    .lead = ¿Qué balanceador tiene la dirección del sitio, 192.0.2.108? Mira las interfaces de lb1.
    .solution = ip a (la dirección está en eth0, «secondary»)
hint-no-failover-no-tracking =
    .lead = ¿Qué vigila keepalived en lb1? Lee su configuración, y busca una comprobación de haproxy (man keepalived.conf).
    .solution = cat /etc/keepalived/keepalived.conf
hint-no-failover-tracking =
    .lead = Añade un vrrp_script que compruebe que haproxy funciona (con un peso que deje a lb1 por debajo de lb2, o 0), síguelo en la vrrp_instance, comprueba el archivo y recarga keepalived.
    .solution = sudo nano /etc/keepalived/keepalived.conf: vrrp_script chk_haproxy con script "/usr/bin/killall -0 haproxy", interval 2, weight -20, y track_script con chk_haproxy en VI_1; sudo keepalived -t; sudo systemctl reload keepalived
hint-no-failover-failed-over =
    .lead = Con haproxy muerto en lb1, la comprobación falla y la dirección debería moverse: mira el diario de keepalived y las interfaces de los dos nodos. Si no se mueve, ¿tiene lb2 permiso para quedársela (nopreempt)?
    .solution = sudo journalctl -u keepalived; ip a; ssh lb2 e ip a; curl -s http://donate.lindenvale.example/
hint-no-failover-haproxy-back =
    .lead = Vuelve a poner haproxy en marcha en lb1 (systemd se rindió tras demasiados fallos).
    .solution = sudo systemctl restart haproxy (o sudo systemctl reset-failed haproxy, luego start)
hint-no-failover-lb2-tracked =
    .lead = Una conmutación tiene que funcionar en los dos sentidos: lb2 tiene que vigilar su propio haproxy de la misma forma.
    .solution = ssh lb2; el mismo vrrp_script y el mismo track_script en su keepalived.conf; sudo keepalived -t; sudo systemctl reload keepalived
hint-no-failover-end =
    .lead = Demuéstralo: para haproxy en el maestro, mira cómo se mueve la dirección y el sitio sigue respondiendo, y luego vuelve a arrancarlo.
    .solution = sudo systemctl stop haproxy; sleep 10; ip a; curl -s http://donate.lindenvale.example/; sudo systemctl start haproxy

## Capítulo 2 — El servidor enfermo

hint-sick-server-errors =
    .lead = ¿Qué servidor responde los errores? El registro de HAProxy dice qué servidor atendió cada petición; o pregunta al sitio varias veces.
    .solution = sudo tail /var/log/haproxy.log (o curl -si http://donate.lindenvale.example/ unas cuantas veces: x-served-by)
hint-sick-server-no-check =
    .lead = Pregunta a HAProxy, por su socket de ejecución, cómo ve a sus servidores (el mensaje de Teodor, man socat).
    .solution = echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | cut -d, -f1,2,18,37
hint-sick-server-http-check =
    .lead = Da a los servidores una comprobación que pregunte por HTTP a la página /health de la aplicación y espere 200 (man haproxy; check, option httpchk, http-check expect), comprueba el archivo, recarga.
    .solution = en backend be_booking: option httpchk GET /health, http-check expect status 200, y check en cada línea server; sudo haproxy -c -f /etc/haproxy/haproxy.cfg; sudo systemctl reload haproxy
hint-sick-server-lb2-synced =
    .lead = lb2 tiene que comprobar de la misma forma, por si se queda con la dirección.
    .solution = ssh lb2; los mismos cambios en /etc/haproxy/haproxy.cfg; sudo haproxy -c -f /etc/haproxy/haproxy.cfg; sudo systemctl reload haproxy
hint-sick-server-drained =
    .lead = Saca web2 del grupo en el maestro sin editar el archivo: la API de ejecución puede cambiar el estado de un servidor (drain).
    .solution = echo "set server be_booking/web2 state drain" | sudo socat stdio /run/haproxy/admin.sock
hint-sick-server-tech-working =
    .lead = El técnico espera a que a web2 no le quede ninguna sesión: mira su scur en show stat.
    .solution = echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | grep web2 | cut -d, -f2,5,18
hint-sick-server-tech-done =
    .lead = Espera a que el técnico termine (más o menos un minuto): sleep, y mira el registro de HAProxy.
    .solution = sleep 30; sudo tail /var/log/haproxy.log
hint-sick-server-end =
    .lead = web2 está reparado: vuelve a ponerlo en el grupo con la API de ejecución.
    .solution = echo "set server be_booking/web2 state ready" | sudo socat stdio /run/haproxy/admin.sock

## Capítulo 3 — Cerebro dividido

hint-split-brain-two-masters =
    .lead = ¿Quién tiene 192.0.2.108? Mira en los dos balanceadores.
    .solution = ip a; ssh lb2 e ip a
hint-split-brain-lower-priority =
    .lead = Pregunta a keepalived en lb1 qué oye.
    .solution = sudo journalctl -u keepalived -n 30
hint-split-brain-on-the-wire =
    .lead = ¿Recibe lb2 los anuncios de lb1? Captura VRRP en la eth0 de lb2 (man tcpdump).
    .solution = en lb2: sudo tcpdump -i eth0 -c 10 vrrp
hint-split-brain-ruleset =
    .lead = Los anuncios llegan a la tarjeta pero no a keepalived: mira el cortafuegos de lb2.
    .solution = en lb2: sudo nft list ruleset
hint-split-brain-single-master =
    .lead = Deja entrar VRRP (protocolo IP 112, hacia 224.0.0.18) en la cadena input de lb2 (man nft).
    .solution = en lb2: sudo nft add rule inet filter input ip protocol vrrp accept
hint-split-brain-persisted =
    .lead = Una regla añadida con nft desaparece en el próximo arranque: escríbela en /etc/nftables.conf, compruébala y cárgala.
    .solution = en lb2: sudo nano /etc/nftables.conf (ip protocol vrrp accept en la cadena input); sudo nft -c -f /etc/nftables.conf; sudo systemctl restart nftables
hint-split-brain-clash =
    .lead = ¿Quién más habla VRRP en este enlace? Captura en lb1, o lee el diario de keepalived buscando paquetes «bogus».
    .solution = sudo tcpdump -i eth0 -c 10 vrrp; sudo journalctl -u keepalived | grep bogus
hint-split-brain-vrid =
    .lead = Saca a tu pareja del virtual_router_id de los routers, con el mismo valor nuevo en los dos nodos (o usa unicast_peer en los dos), y recarga keepalived en los dos.
    .solution = virtual_router_id 61 en /etc/keepalived/keepalived.conf en lb1 y en lb2; sudo keepalived -t; sudo systemctl reload keepalived (en los dos)
hint-split-brain-end =
    .lead = Comprueba que un nodo tiene la dirección y el otro está en BACKUP, y que el sitio responde siempre.
    .solution = ip a en los dos; sudo journalctl -u keepalived -n 5; curl -s http://donate.lindenvale.example/
