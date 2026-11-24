### Pistas graduales de «Las Ondas» (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta).

## Capítulo 1 — La fecha de caducidad

hint-expiry-date-expired =
    .lead = Mira el certificado que presenta de verdad la intranet, y sus fechas (man openssl: s_client, x509).
    .solution = openssl s_client -connect intranet.airwaves.internal:443 </dev/null | openssl x509 -noout -dates
hint-expiry-date-cn-only =
    .lead = ¿Qué nombres cubre el certificado? Léelo entero, en claro.
    .solution = openssl x509 -in /etc/nginx/ssl/intranet.crt -noout -text
hint-expiry-date-readme =
    .lead = La autoridad vive en /srv/ca: Kwame dejó allí notas y una política.
    .solution = cat /srv/ca/README.txt /srv/ca/POLICY.txt
hint-expiry-date-key-open =
    .lead = ¿Quién puede leer la clave privada de la autoridad? Mira los permisos de /srv/ca/private.
    .solution = ls -l /srv/ca/private
hint-expiry-date-key-closed =
    .lead = La clave de una CA solo la puede leer root (man chmod).
    .solution = sudo chmod 600 /srv/ca/private/ca.key; sudo chmod 700 /srv/ca/private
hint-expiry-date-renewed =
    .lead = Una solicitud para la clave de la intranet, luego la raíz la firma para un año con los dos nombres en subjectAltName (-extfile, o -addext con -copy_extensions copy); instálala donde mira nginx, comprueba, recarga.
    .solution = openssl req -new -key CLAVE -subj /CN=intranet.airwaves.internal -out intranet.csr; printf 'subjectAltName = DNS:intranet.airwaves.internal, DNS:board.airwaves.internal\n' > san.ext; sudo openssl x509 -req -in intranet.csr -CA /srv/ca/ca.crt -CAkey /srv/ca/private/ca.key -days 365 -extfile san.ext -out intranet.crt; luego cópialo en /etc/nginx/ssl/intranet.crt, sudo nginx -t, sudo systemctl reload nginx
hint-expiry-date-end =
    .lead = Comprueba como un cliente que confía en nuestra raíz: los dos nombres, con curl y el certificado de la autoridad.
    .solution = curl --cacert /srv/ca/ca.crt https://board.airwaves.internal/

## Capítulo 2 — La cadena de confianza

hint-chain-of-trust-red =
    .lead = Lee el registro de la monitorización, y luego prueba tú su petición.
    .solution = tail /var/log/check-sites.log; curl https://archive.airwaves.internal/
hint-chain-of-trust-mast-trusts =
    .lead = Debian confía en las autoridades que instala update-ca-certificates: el certificado de la raíz (nunca su clave) va en /usr/local/share/ca-certificates, en un archivo .crt (man update-ca-certificates).
    .solution = sudo cp /srv/ca/ca.crt /usr/local/share/ca-certificates/airwaves-root.crt; sudo update-ca-certificates
hint-chain-of-trust-still-red =
    .lead = Vuelve a ejecutar la monitorización, o haz curl al archivo: ¿qué envía el servidor? Compara con la intranet.
    .solution = sudo /usr/local/bin/check-sites; tail -n 3 /var/log/check-sites.log
hint-chain-of-trust-chain =
    .lead = El servidor debe enviar su certificado seguido del intermedio (el certificado de la CA emisora), en un solo archivo para ssl_certificate.
    .solution = openssl s_client -connect archive.airwaves.internal:443 -showcerts </dev/null; sudo sh -c 'cat /etc/nginx/ssl/archive.crt /srv/ca/issuing/issuing.crt > /etc/nginx/ssl/archive-chain.crt', apunta ssl_certificate a él, sudo nginx -t, sudo systemctl reload nginx
hint-chain-of-trust-booth =
    .lead = booth también necesita el certificado de la raíz, instalado de la misma manera: cópialo allí por ssh (man scp).
    .solution = scp /srv/ca/ca.crt booth:; ssh booth; sudo cp ca.crt /usr/local/share/ca-certificates/airwaves-root.crt; sudo update-ca-certificates
hint-chain-of-trust-end =
    .lead = Desde booth y desde mast, los dos sitios deben responder sin -k.
    .solution = curl https://archive.airwaves.internal/ (en booth y en mast)

## Capítulo 3 — El portátil robado

hint-stolen-laptop-thief =
    .lead = ¿Quién se ha estado conectando al portal? nginx escribe cada petición en su registro de accesos.
    .solution = sudo tail -n 20 /var/log/nginx/access.log
hint-stolen-laptop-revoked =
    .lead = Revocar es trabajo de la autoridad, en su base de datos: openssl ca, con la configuración de la CA emisora y el certificado del portátil de Lindiwe (index.txt da su número de serie).
    .solution = sudo openssl ca -config /srv/ca/issuing/openssl.cnf -revoke /srv/ca/issuing/newcerts/1003.pem -crl_reason keyCompromise
hint-stolen-laptop-crl =
    .lead = Los servidores no leen la base de datos: leen una lista de revocación, que escribe la autoridad (man openssl: ca -gencrl).
    .solution = sudo openssl ca -config /srv/ca/issuing/openssl.cnf -gencrl -out /srv/ca/issuing/crl/issuing.crl
hint-stolen-laptop-refused =
    .lead = Da las CRL a nginx con ssl_crl en el bloque server de contrib; comprueba toda la cadena, así que la CRL de la raíz va en el mismo archivo. Luego comprueba y recarga.
    .solution = sudo sh -c 'cat /srv/ca/issuing/crl/issuing.crl /srv/ca/crl/root.crl > /etc/nginx/ssl/airwaves-crl.pem'; añade ssl_crl /etc/nginx/ssl/airwaves-crl.pem; a /etc/nginx/sites-enabled/contrib; sudo nginx -t; sudo systemctl reload nginx
hint-stolen-laptop-watch =
    .lead = Un script que recorre cada certificado emitido (/srv/ca/issued, /srv/ca/issuing/newcerts) y usa el código de salida de openssl x509 -checkend para señalar solo los que caducan en menos de 30 días; ejecútalo cada día desde cron (o un temporizador).
    .solution = un script: for c in /srv/ca/issued/*.crt /srv/ca/issuing/newcerts/*.pem; do openssl x509 -in "$c" -noout -checkend 2592000 >/dev/null || echo "caduca en menos de 30 días: $c"; done; luego sudo crontab -e: 17 7 * * * /usr/local/bin/cert-expiry
hint-stolen-laptop-end =
    .lead = Ejecuta la vigilancia a mano una vez: debe nombrar el certificado del servidor de streaming.
    .solution = sudo /usr/local/bin/cert-expiry
