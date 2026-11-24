### Pistas graduadas de El Café de Idiomas (ver src/engine/hints.ts): un
### mensaje por etapa, hint-<capítulo>-<evento>, con .lead (una dirección,
### sin el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — Vecino nuevo

hint-new-neighbour-rocky =
    .lead = Antes de teclear los comandos de Debian, pregúntale a la máquina qué es: un archivo de /etc lo dice, y las notas de Seun también.
    .solution = cat /etc/os-release; cat notas_de_seun.txt
hint-new-neighbour-installed =
    .lead = En la familia Red Hat, el paquete de Apache es httpd, y el gestor de paquetes es dnf (man dnf: search, info, install).
    .solution = dnf search httpd; sudo dnf install httpd (responde y)
hint-new-neighbour-running =
    .lead = Arranca el servicio, y haz que arranque en cada inicio, con un solo comando systemctl.
    .solution = sudo systemctl enable --now httpd; systemctl status httpd
hint-new-neighbour-blocked =
    .lead = Prueba desde donde está la gente: la pizarra. Si tetera rechaza, mira lo que permite la zona de firewalld (man firewall-cmd).
    .solution = ssh pizarra, y luego curl -I http://www.commontongue.example/; en tetera: sudo firewall-cmd --list-all
hint-new-neighbour-runtime-only =
    .lead = Un servicio de firewalld se permite por su nombre (http, https), en la configuración de ejecución y en la permanente.
    .solution = sudo firewall-cmd --add-service=http --add-service=https; sudo firewall-cmd --permanent --add-service=http --add-service=https
hint-new-neighbour-permanent-only =
    .lead = ¿Lo que has permitido está activo ahora, y seguirá ahí después de una recarga? Compara las dos configuraciones.
    .solution = sudo firewall-cmd --list-all; sudo firewall-cmd --permanent --list-all; sudo firewall-cmd --reload
hint-new-neighbour-reached =
    .lead = Comprueba desde la pizarra que httpd responde.
    .solution = ssh pizarra; curl http://www.commontongue.example/ | head
hint-new-neighbour-end =
    .lead = httpd instalado, en marcha y activado; http y https permitidos en ejecución y de forma permanente; SELinux en enforcing; la pizarra recibe una respuesta.
    .solution = systemctl is-enabled httpd; sudo firewall-cmd --permanent --list-services; sudo firewall-cmd --list-services; getenforce

## Capítulo 2 — Permiso denegado, pero…

hint-wrong-label-test-page =
    .lead = Pregunta tú al sitio, y luego lee el registro de errores de httpd: ¿qué archivo, y qué error?
    .solution = curl -I http://localhost/; sudo tail /var/log/httpd/error_log
hint-wrong-label-error-log =
    .lead = Los permisos Unix están bien. Compara las etiquetas SELinux de los archivos del sitio con las de /var/www/html (man ls: -Z).
    .solution = ls -lZ /srv/site; ls -Zd /var/www/html; ps -eZ | grep httpd
hint-wrong-label-labels =
    .lead = ¿Quién lo rechazó, y qué exactamente? El registro de auditoría guarda las denegaciones de SELinux (man ausearch).
    .solution = sudo ausearch -m avc -ts recent
hint-wrong-label-avc =
    .lead = Pregunta por qué: audit2why explica una denegación. Si bash no lo conoce, encuentra su paquete con dnf.
    .solution = sudo ausearch -m avc -ts recent | audit2why
hint-wrong-label-tools-missing =
    .lead = ¿Qué paquete tiene el comando semanage? dnf puede buscar archivos (man dnf: provides).
    .solution = dnf provides semanage; sudo dnf install policycoreutils-python-utils
hint-wrong-label-tools =
    .lead = ¿Qué etiqueta da la política a /srv/site, y a /var/www? semanage lista los contextos de archivo.
    .solution = sudo semanage fcontext -l | grep -E '^/srv|^/var/www'
hint-wrong-label-rule =
    .lead = Enseña a la política que /srv/site y todo lo que contiene es contenido web (man semanage-fcontext), y luego aplícalo a los archivos.
    .solution = sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"; sudo restorecon -Rv /srv/site
hint-wrong-label-relabelled =
    .lead = ¿El reetiquetado ha deshecho lo que pusiste a mano? Lo que lo sobrevive es una regla en la política.
    .solution = ls -Z /srv/site; sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"; sudo restorecon -Rv /srv/site
hint-wrong-label-end =
    .lead = SELinux en enforcing; el sitio y su hoja de estilos servidos a la pizarra; etiquetas según la política (restorecon -Rnv no cambia nada); ni 777, ni módulo, ni booleano de carpetas personales.
    .solution = getenforce; restorecon -Rnv /srv/site; sudo semanage fcontext -l -C; ssh pizarra y luego curl http://www.commontongue.example/css/style.css

## Capítulo 3 — Un puerto y un booleano

hint-port-and-boolean-down =
    .lead = ¿Por qué no arranca httpd? El estado de su unidad y su diario lo dicen.
    .solution = systemctl status httpd; sudo journalctl -u httpd | tail
hint-port-and-boolean-bind-avc =
    .lead = Nada más escucha en el 8010 (ss -tlnp): busca la denegación de SELinux, y luego los puertos que la política deja usar a httpd.
    .solution = sudo ausearch -m avc -c httpd; sudo semanage port -l | grep http_port_t
hint-port-and-boolean-port =
    .lead = Dale al 8010 el tipo de un puerto web (man semanage-port), y luego vuelve a arrancar httpd.
    .solution = sudo semanage port -a -t http_port_t -p tcp 8010; sudo systemctl restart httpd
hint-port-and-boolean-up =
    .lead = Prueba las dos cosas nuevas: la página de inscripción por su nombre, los turnos desde la red del café.
    .solution = curl -H 'Host: signup.commontongue.example' http://localhost/; ssh pizarra y luego curl http://tetera:8010/
hint-port-and-boolean-proxy-503 =
    .lead = La aplicación responde en su propio puerto; httpd no llega a ella. Busca la denegación.
    .solution = curl http://127.0.0.1:8086/; sudo ausearch -m avc -ts recent | audit2why
hint-port-and-boolean-connect-avc =
    .lead = Un booleano deja a httpd conectarse a otros puertos (getsebool -a | grep httpd); ponlo de forma que sobreviva a un reinicio.
    .solution = sudo setsebool -P httpd_can_network_connect on
hint-port-and-boolean-boolean =
    .lead = Ahora los turnos: solo la red del café (198.51.100.0/24) debería llegar al puerto 8010 (man firewall-cmd: reglas enriquecidas), en ejecución y de forma permanente.
    .solution = sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="198.51.100.0/24" port port="8010" protocol="tcp" accept'; sudo firewall-cmd --reload
hint-port-and-boolean-rota-office =
    .lead = ¿Está la regla en las dos configuraciones, y nada abre el 8010 a todo el mundo?
    .solution = sudo firewall-cmd --list-rich-rules; sudo firewall-cmd --permanent --list-all
hint-port-and-boolean-end =
    .lead = httpd en marcha y activado; el sitio y la inscripción para todo el mundo, los turnos solo para el café; httpd_can_network_connect con -P; ni nis_enabled, ni módulo; SELinux en enforcing.
    .solution = getsebool httpd_can_network_connect nis_enabled; sudo semanage boolean -l -C; sudo semodule -l | grep httpd; sudo firewall-cmd --permanent --list-all
