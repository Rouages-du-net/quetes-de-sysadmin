### Pistas graduales de El Paquete Perdido (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el
### comando exacto) y .solution (casi la respuesta). Los nombres de archivo,
### como en names.ftl.

## Capítulo 1 — El Paquete Perdido

hint-lost-packet-box =
    .lead = Prueba paso a paso, de lo más cercano a lo más lejano (el cuaderno.txt de Kofi). Lo más cercano es el router: un comando envía un pequeño mensaje y espera a que vuelva.
    .solution = ping 192.168.1.1 (el router; 0% packet loss: la red local funciona).
hint-lost-packet-internet =
    .lead = El router responde. Un paso más allá: un servidor de internet, por su dirección IP (el cuaderno da una).
    .solution = ping 9.9.9.9 (el servidor DNS público de Quad9).
hint-lost-packet-name =
    .lead = Internet responde por dirección. ¿Y por nombre? Prueba el sitio mismo, por su nombre.
    .solution = ping letters.example
hint-lost-packet-dns-silent =
    .lead = El nombre no se convierte en dirección: ese es el trabajo del DNS. Un comando pregunta directamente al servidor DNS (man dig).
    .solution = dig letters.example (luego cat /etc/resolv.conf: ¿a qué servidor DNS pregunta el ordenador?).
hint-lost-packet-dns-other =
    .lead = El servidor DNS configurado no responde. ¿Existe de verdad el nombre? dig puede preguntar a otro servidor distinto del de /etc/resolv.conf (man dig, la @).
    .solution = dig @9.9.9.9 letters.example
hint-lost-packet-dns-repaired =
    .lead = /etc/resolv.conf apunta al router antiguo, que ya no existe. Pon en su lugar, en la línea nameserver, un servidor DNS que hayas visto responder con dig @… . /etc pertenece a root: edita el archivo con sudo nano (la contraseña está en la nota de Kofi).
    .solution = sudo nano /etc/resolv.conf (contraseña: hormiguero), luego escribe nameserver 192.168.1.1 (el router nuevo; 9.9.9.9 también sirve), Ctrl+O para guardar, Ctrl+X para salir.
hint-lost-packet-ping-lost =
    .lead = El DNS está arreglado: vuelve a intentar llegar al sitio por su nombre.
    .solution = ping letters.example
hint-lost-packet-route =
    .lead = El nombre se traduce, pero el ping se pierde. ¿Dónde se detienen los paquetes? Un comando muestra su camino, router a router.
    .solution = traceroute letters.example
hint-lost-packet-curl =
    .lead = Muchos servidores ignoran el ping a propósito. La única prueba real: pedir la página misma, por HTTPS (el cuaderno, paso 5).
    .solution = curl -I https://letters.example (HTTP/2 200: el sitio responde).
