### Pistas graduadas de la historia «Correo No Deseado»: una dirección, y
### luego casi la respuesta, para cada paso (ver hints.ts).

## Capítulo 1 — El cartero

hint-postman-differs =
    .lead = El correo que no ha salido espera en la cola de Postfix: mailq la muestra, con la respuesta del otro servidor. /var/log/mail.log cuenta cada intento.
    .solution = mailq (o postqueue -p), y luego grep deferred /var/log/mail.log: mailbox.example responde 451, «neither SPF nor DKIM passed».
hint-postman-old =
    .lead = SPF es un registro TXT del dominio, que empieza por v=spf1 (man dig). ¿A quién autoriza a enviar?
    .solution = dig TXT gardens.example: «v=spf1 include:_spf.old-hosting.example -all», el SPF del antiguo proveedor.
hint-postman-spf =
    .lead = El SPF está en la zona de gardens.example, en este servidor (/etc/bind/zones). Tiene que autorizar esta máquina (mx, a o ip4:203.0.113.30). Para que el secundario del registro lo copie, el serial tiene que subir.
    .solution = sudo nano /etc/bind/zones/db.gardens.example: sustituye el include por mx («v=spf1 mx -all») y sube el serial; sudo named-checkzone gardens.example /etc/bind/zones/db.gardens.example, sudo rndc reload, y luego dig TXT gardens.example @ns2.registry.example
hint-postman-end =
    .lead = El SPF es correcto, pero Postfix solo vuelve a intentarlo al cabo de unos minutos. man postqueue.
    .solution = sudo postqueue -f, y luego mailq: «Mail queue is empty».

## Capítulo 2 — La firma

hint-signature-check =
    .lead = Envía un correo al verificador (mira el mensaje de Nour), y luego lee su respuesta con mail.
    .solution = echo test | mail -s test check-auth@verifier.example, y luego mail (o cat /var/mail/tu_cuenta): «DKIM check: none».
hint-signature-key =
    .lead = Primero necesitas un par de claves, en /etc/dkimkeys: man opendkim-genkey (el dominio, el selector, la carpeta).
    .solution = sudo -u opendkim opendkim-genkey -d gardens.example -s mail -D /etc/dkimkeys (o con sudo a secas, y luego sudo chown opendkim:opendkim /etc/dkimkeys/mail.private)
hint-signature-opendkim =
    .lead = /etc/opendkim.conf tiene líneas comentadas para el dominio, el selector y la clave. opendkim tiene que poder leer la clave; journalctl -u opendkim dice por qué no arranca.
    .solution = En /etc/opendkim.conf: Domain gardens.example, Selector mail, KeyFile /etc/dkimkeys/mail.private, y Socket inet:8891@localhost; sudo systemctl restart opendkim
hint-signature-milter =
    .lead = Postfix tiene que pasarle el correo a opendkim: los parámetros smtpd_milters y non_smtpd_milters (man postconf). El correo enviado desde la máquina pasa por non_smtpd_milters, y Postfix funciona en un chroot.
    .solution = sudo postconf -e "smtpd_milters = inet:localhost:8891" 'non_smtpd_milters = $smtpd_milters' "milter_default_action = accept", y luego sudo systemctl reload postfix
hint-signature-end =
    .lead = La firma solo se puede comprobar con la clave pública, publicada en la zona (el archivo .txt de opendkim-genkey). Y el serial.
    .solution = Añade el contenido de /etc/dkimkeys/mail.txt a /etc/bind/zones/db.gardens.example, sube el serial, sudo rndc reload; sudo opendkim-testkey -d gardens.example -s mail -vvv, y luego un correo al verificador.

## Capítulo 3 — La política

hint-policy-report =
    .lead = Los informes de informes_dmarc están en XML: cada «record» dice quién envió (source_ip), cuántos, y qué dieron SPF, DKIM y DMARC. Busca las direcciones que no son 203.0.113.30.
    .solution = grep source_ip informes_dmarc/*.xml, y luego less sobre el informe: 198.51.100.77 (newsmail.example) pasa SPF y DKIM para su propio dominio, no para gardens.example.
hint-policy-aligned =
    .lead = El boletín tiene que firmarse con d=gardens.example: carta_newsmail.txt dice cómo delegar un selector. Cuidado con el punto final, y con el serial.
    .solution = Añade «nm1._domainkey IN CNAME nm1.dkim.newsmail.example.» a la zona, sube el serial, sudo rndc reload; dig TXT nm1._domainkey.gardens.example @ns2.registry.example
hint-policy-end =
    .lead = Ahora que el boletín está alineado, se puede endurecer la política: la etiqueta p= del registro _dmarc (conserva rua=).
    .solution = En la zona: _dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@gardens.example", serial, sudo rndc reload; dig TXT _dmarc.gardens.example @ns2.registry.example
