### Pistas graduales de «El Bote Salvavidas» (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el
### comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — Buzón lleno

hint-mailbox-full-bounces =
    .lead = ¿Qué pasó con los últimos mensajes enviados a Saoirse? Postfix y Dovecot escriben cada entrega en el registro del correo.
    .solution = sudo grep saoirse /var/log/mail.log | tail
hint-mailbox-full-quota-get =
    .lead = ¿Cuánto usa de su cuota? doveadm tiene un comando para la cuota de un usuario (man doveadm).
    .solution = sudo doveadm quota get -u saoirse@lifeboat.example
hint-mailbox-full-trash =
    .lead = ¿Cuál de sus carpetas ocupa el sitio? Pide a doveadm el tamaño de cada buzón, o mide su Maildir.
    .solution = sudo doveadm mailbox status -u saoirse@lifeboat.example "messages vsize" "*" (o sudo du -sh /var/vmail/lifeboat.example/saoirse/Maildir/.[A-Z]*)
hint-mailbox-full-expunged =
    .lead = Elimina los mensajes antiguos de su Papelera a través de Dovecot, con una consulta de búsqueda sobre su fecha (man doveadm, man doveadm-search-query); prueba antes la consulta con doveadm search.
    .solution = sudo doveadm expunge -u saoirse@lifeboat.example mailbox Trash savedbefore 2031-01-01
hint-mailbox-full-raised =
    .lead = Dale a Saoirse, y solo a ella, los 2 GB que acordó la junta: la userdb de Dovecot puede llevar ajustes por usuario.
    .solution = sudo nano /etc/dovecot/users: añade userdb_quota_storage_size=2G al final de la línea de Saoirse; comprueba con sudo doveadm quota get -u saoirse@lifeboat.example
hint-mailbox-full-delivered =
    .lead = En cuanto hay sitio, el siguiente mensaje para ella se guarda: mira el registro.
    .solution = sudo tail -n 5 /var/log/mail.log (busca «stored mail into mailbox 'INBOX'»)
hint-mailbox-full-warning =
    .lead = 90-quota.conf tiene un ejemplo de aviso de cuota, comentado, y el servicio que ejecuta ya existe. Actívalo, comprueba, recarga Dovecot.
    .solution = sudo nano /etc/dovecot/conf.d/90-quota.conf (quita el comentario del bloque quota_warning warn-90), luego sudo doveconf -n | grep -A5 quota_warning y sudo doveadm reload
hint-mailbox-full-end =
    .lead = Compruébalo todo: su cuota, la Papelera, la cuenta (doveadm quota recalc si se quitaron archivos a mano), el aviso en la configuración en marcha.
    .solution = sudo doveadm quota get -u saoirse@lifeboat.example; sudo doveadm quota recalc -u saoirse@lifeboat.example; sudo doveadm reload

## Capítulo 2 — Marea de spam

hint-spam-tide-scores =
    .lead = ¿Cómo puntúa rspamd estos mensajes? Su registro tiene una línea por mensaje, y rspamc puede analizar uno guardado (man rspamc).
    .solution = sudo tail -n 3 /var/log/rspamd/rspamd.log; o sudo rspamc symbols sobre un archivo del INBOX de Leilani (/var/vmail/lifeboat.example/leilani/Maildir/cur/…)
hint-spam-tide-thresholds =
    .lead = Mira los umbrales de las acciones que cambió Yerlan, devuélvelos a los valores por defecto de rspamd, comprueba la configuración y recarga rspamd.
    .solution = sudo nano /etc/rspamd/local.d/actions.conf (reject = 15; add_header = 6; greylist = 4;), sudo rspamadm configtest, sudo systemctl reload rspamd
hint-spam-tide-bulletin-junk =
    .lead = ¿Por qué el boletín supera add_header? Lee sus símbolos, y mira cuáles vienen de la plataforma por la que se envía.
    .solution = sudo grep coastwatch /var/log/rspamd/rspamd.log | tail -n 1
hint-spam-tide-whitelist =
    .lead = Confía en la dirección From: propia del boletín, nada más amplio: una regla multimap de tipo from (cuidado: remitente SMTP por defecto) o una regla settings (from_mime), en local.d.
    .solution = local.d/multimap.conf: WHITELIST_COASTWATCH {"{"} type = "from"; extract_from = "mime"; map = "/etc/rspamd/local.d/coastwatch.map"; score = -6.0; {"}"}, con news@coastwatch.example en el mapa; rspamadm configtest; systemctl reload rspamd
hint-spam-tide-bayes =
    .lead = Bayes necesita suficientes ejemplos de las dos clases: Leilani ya clasificó spam en Junk, y guardó sus reservas en Archive.
    .solution = sudo rspamc learn_spam /var/vmail/lifeboat.example/leilani/Maildir/.Junk/cur/ y sudo rspamc learn_ham /var/vmail/lifeboat.example/leilani/Maildir/.Archive/cur/; luego rspamc stat
hint-spam-tide-caught =
    .lead = Comprueba con mensajes nuevos: ¿el phishing, las facturas y los premios están ahora marcados como spam? El registro muestra la acción de cada uno nuevo.
    .solution = sudo tail -n 4 /var/log/rspamd/rspamd.log (busca add header); sudo rspamc stat
hint-spam-tide-end =
    .lead = Todo a la vez: el milter en main.cf, umbrales sensatos, Bayes entrenado, el boletín sin ninguna acción, nada en lista blanca que el spam pueda usar.
    .solution = postconf smtpd_milters; sudo rspamadm configdump actions multimap; sudo rspamc stat

## Capítulo 3 — La oficina de clasificación

hint-sorting-office-read-old =
    .lead = Yerlan mencionó un script antiguo de Aziz: mira sus scripts Sieve.
    .solution = sudo doveadm sieve list -u aziz@lifeboat.example; sudo cat /var/vmail/lifeboat.example/aziz/sieve/holiday.sieve
hint-sorting-office-folder =
    .lead = Escribe para Leilani un script que archive los mensajes para bookings@ en Bookings (fileinto, :create), compruébalo, y haz que sea su script activo.
    .solution = require ["fileinto", "mailbox", "envelope"]; if envelope :is "to" "bookings@lifeboat.example" {"{"} fileinto :create "Bookings"; {"}"} — sudo doveadm sieve put -a -u leilani@lifeboat.example clasificar < clasificar.sieve
hint-sorting-office-sorted-live =
    .lead = Espera a la siguiente reserva y mira qué hizo LMTP con ella.
    .solution = sudo grep -E "Bookings|bookings@" /var/log/mail.log | tail
hint-sorting-office-vacation =
    .lead = Una respuesta de ausencia es la extensión vacation (RFC 5230): escribe para Aziz un script que la use, pruébalo con los ejemplos (sieve-test), actívalo.
    .solution = require ["vacation"]; vacation :days 7 :subject "Fuera hasta el 24 de noviembre" "Estoy fuera hasta el 24 de noviembre; para cualquier urgencia, escribe a marisol@lifeboat.example."; — luego sudo sieve-test ausencia.sieve ejemplo-lista.eml y doveadm sieve put -a
hint-sorting-office-alias =
    .lead = Un mensaje a treasurer@ no recibe respuesta: vacation solo responde al correo dirigido a la persona. Dale su otra dirección.
    .solution = vacation :days 7 :addresses ["treasurer@lifeboat.example"] :subject "…" "…";
hint-sorting-office-replied-live =
    .lead = Espera un mensaje de verdad para Aziz y busca la respuesta en el registro.
    .solution = sudo grep "vacation response" /var/log/mail.log | tail
hint-sorting-office-end =
    .lead = Los dos scripts activos, cada uno probado, cada uno visto trabajando con correo de verdad.
    .solution = sudo doveadm sieve list -u leilani@lifeboat.example; sudo doveadm sieve list -u aziz@lifeboat.example; sudo tail /var/log/mail.log
