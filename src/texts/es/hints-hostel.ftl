### Pistas graduales de El Albergue (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin el comando
### exacto) y .solution (casi la respuesta).

## Capítulo 1 — Sellado

hint-sealed-status =
    .lead = Pregunta al propio OpenBao en qué estado está, antes de tocar nada (man bao).
    .solution = bao status
hint-sealed-first-share =
    .lead = Un servidor sellado espera sus fragmentos de clave, un comando por fragmento. ¿Dónde está tu propio fragmento?
    .solution = bao operator unseal, y pega en la solicitud el fragmento de /media/memoria/unseal-share-3.txt
hint-sealed-unsealed =
    .lead = Hacen falta tres fragmentos distintos. ¿De cuáles de los cuatro que has recibido te puedes fiar?
    .solution = bao operator unseal con el fragmento de Hiroko, luego con el de Nnamdi (no el borroso de Desta); bao status: Sealed false
hint-sealed-restarted =
    .lead = La caja fuerte está abierta, pero ¿funciona el sitio de reservas? Pregunta a systemd y lee su registro.
    .solution = systemctl status bunks; journalctl -u bunks; sudo systemctl restart bunks
hint-sealed-checked =
    .lead = Comprueba que Bunks responde de verdad (las notas de Ruslan mencionan una página de salud en el puerto 8080).
    .solution = curl http://127.0.0.1:8080/health
hint-sealed-end =
    .lead = Comprueba cada parte: la caja fuerte desellada, Bunks funcionando, su página de salud respondiendo.
    .solution = bao status; systemctl status bunks; curl http://127.0.0.1:8080/health

## Capítulo 2 — Necesidad de saber

hint-need-to-know-policy =
    .lead = Escribe las reglas de Bunks en un archivo HCL: qué rutas, qué capacidades. Ojo con la ruta de API real de un secreto KV versión 2 (notas de Ruslan, man bao).
    .solution = un archivo bunks.hcl con path "secret/data/bunks/*" y capabilities = ["read"], y luego bao policy write bunks bunks.hcl
hint-need-to-know-token =
    .lead = Crea un token que solo lleve esa política, con tu propio token admin (no con el token root).
    .solution = bao token create -policy=bunks -display-name=bunks -ttl=768h
hint-need-to-know-switched =
    .lead = Comprueba lo que puede hacer el token nuevo, y dáselo a Bunks: ¿dónde lee Bunks su token, y cuándo?
    .solution = bao token capabilities TOKEN secret/data/bunks/db; sudo nano /etc/bunks/bunks.env (BAO_TOKEN=el token nuevo); sudo systemctl restart bunks
hint-need-to-know-checked =
    .lead = ¿Responde Bunks con su token nuevo?
    .solution = curl http://127.0.0.1:8080/health
hint-need-to-know-root-revoked =
    .lead = El token root del init sigue siendo válido. Un token lo puede revocar quien tenga permiso (man bao: token revoke).
    .solution = bao token revoke seguido del valor antiguo de BAO_TOKEN (el token root)
hint-need-to-know-end =
    .lead = Comprueba cada parte: el token de Bunks y lo que puede hacer, el token root desaparecido, la página de salud.
    .solution = bao token capabilities TOKEN secret/data/treasurer/bank (deny); bao token lookup sobre el token root (bad token); curl http://127.0.0.1:8080/health

## Capítulo 3 — Token filtrado

hint-leaked-token-identified =
    .lead = Empieza por el token del mensaje del foro: pregunta a OpenBao qué es (man bao: token lookup).
    .solution = bao token lookup seguido del token de mensaje_del_foro.txt
hint-leaked-token-traced =
    .lead = Cada petición está en el registro de auditoría, pero los tokens aparecen como HMAC. OpenBao puede calcular por ti el HMAC de un valor; o busca las peticiones que no venían de 127.0.0.1.
    .solution = bao write sys/audit-hash/file input=TOKEN, y luego sudo grep ese hash /var/log/openbao/audit.log (o sudo jq sobre remote_address)
hint-leaked-token-revoked =
    .lead = El token tiene que dejar de funcionar ya, antes que nada.
    .solution = bao token revoke seguido del token filtrado
hint-leaked-token-rotated =
    .lead = El registro muestra qué secreto se leyó. Dale su valor nuevo sin perder su otro campo (man bao: kv patch).
    .solution = bao kv patch secret/bunks/payments api_key= seguido de la clave nueva del mensaje de Desta
hint-leaked-token-switched =
    .lead = Bunks necesita un token nuevo, con su política, y debe reiniciarse para leerlo, junto con la clave nueva.
    .solution = bao token create -policy=bunks -display-name=bunks; sudo nano /etc/bunks/bunks.env; sudo systemctl restart bunks
hint-leaked-token-end =
    .lead = Comprueba cada parte: el token filtrado rechazado, la clave nueva en su sitio, el secreto de la base intacto, Bunks sano.
    .solution = bao token lookup TOKEN_FILTRADO (bad token); bao kv get secret/bunks/payments; curl http://127.0.0.1:8080/health
