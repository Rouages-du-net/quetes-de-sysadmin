### El explicador de errores (src/engine/explainer.ts): una explicación corta,
### propuesta bajo la salida de un comando que ha fallado, que quien juega
### puede abrir. Dice qué significa el mensaje y dónde mirar (una página del
### manual, un comando de diagnóstico), nunca la respuesta del capítulo.
###
### El atributo .match de cada explicación lista los mensajes de error a los
### que responde, uno por línea, tal como el juego los muestra en este idioma:
### * vale por cualquier texto, un $ final por el final de la línea. Los
### marcadores ingleses se leen siempre (muchas herramientas responden en
### inglés sea cual sea el idioma): aquí solo se listan los mensajes que el
### juego muestra en español (como con LANG=es_ES.UTF-8), o se omite .match.
### Una línea no puede empezar por [, * o . en Fluent, y hay que evitar las llaves.

explainer-button = ¿Qué significa este error?
explainer-label = El error, explicado:

explainer-sudo-password = sudo te pide tu propia contraseña, la de la cuenta con la que has iniciado sesión, no la de root. No aparece nada mientras la escribes, ni estrellas ni puntos: es normal. Tras tres intentos fallidos, sudo se rinde; vuelve a ejecutar el comando para que te la pida de nuevo.
    .match =
        Lo siento, pruebe otra vez.

explainer-sudoers = sudo sabe quién eres, y su política dice que tu cuenta no puede ejecutar este comando como root en esta máquina: es una regla, no una contraseña equivocada. Las reglas están en /etc/sudoers y en los archivos de /etc/sudoers.d. sudo -l lista lo que puedes ejecutar; man sudoers explica cómo se escribe una regla.

explainer-ssh-denied = El servidor SSH ha respondido, pero no te ha dejado entrar: la cuenta, la clave o la contraseña no encajaban. Las palabras entre paréntesis son los métodos que acepta (publickey, password). ssh -v muestra cada clave que prueba ssh y las respuestas del servidor; en el servidor, el registro de autenticación cuenta su versión de los hechos.

explainer-config-test = La comprobación de la configuración ha encontrado un error y la ha rechazado. Lee la línea marcada [emerg] (o la que va antes de «test failed»): da el archivo y el número de línea, como en archivo:12. El error suele estar en esa línea o justo encima, un punto y coma o una llave de cierre que falta. Si dice Permission denied, es que la propia comprobación necesitaba los permisos de root.

explainer-yaml = No se ha podido leer el archivo YAML. YAML es estricto con la sangría: solo espacios, nunca tabuladores, y los elementos bajo una clave deben quedar exactamente alineados. El mensaje da un número de línea, pero el error real suele estar una o dos líneas más arriba; cat -A muestra los tabuladores como ^I.

explainer-unit-not-found = systemd no conoce ninguna unidad con ese nombre. Comprueba cómo está escrito: es el nombre del archivo de la unidad, que puede ser distinto del del programa (apache2, no httpd, en Debian). systemctl list-unit-files muestra las unidades que conoce; un paquete que no está instalado no trae ninguna unidad.

explainer-unit-failed = systemd ha arrancado el servicio y el programa se ha detenido con un error; la razón no está en este mensaje. systemctl status muestra las últimas líneas del registro del servicio, y journalctl -u con el nombre de la unidad las muestra todas. Lee de abajo arriba: el primer error de verdad suele estar justo encima de las líneas que dicen que la unidad ha fallado.

explainer-db-access-denied = El servidor de base de datos ha respondido y ha rechazado esta cuenta. Una cuenta de MariaDB o MySQL es un nombre de usuario Y la dirección desde la que llega ('app'@'198.51.100.134'): el mismo nombre desde otra dirección es otra cuenta, o ninguna («is not allowed to connect»). «using password: NO» quiere decir que no se envió ninguna contraseña (-p la pide); para root en Debian, sudo mariadb entra por el socket sin ella. «command denied» quiere decir que la cuenta ha entrado pero le falta ese privilegio sobre esa tabla. SELECT user, host, plugin FROM mysql.user y SHOW GRANTS FOR 'usuario'@'máquina' muestran lo que existe.

explainer-db-unreachable = El cliente de base de datos no ha podido llegar a ningún servidor. Por el socket (sin -h, o -h localhost), seguramente el servidor no está en marcha: systemctl status mariadb, y luego journalctl -u mariadb para saber por qué se paró. Por la red (-h una dirección), nada escucha ahí o hay un cortafuegos en medio: en el servidor, ss -tlnp muestra dónde escucha mariadbd (bind-address en su configuración), y las reglas del cortafuegos quién puede llegar al puerto 3306.

explainer-db-too-many = Todos los huecos de conexión del servidor de base de datos están ocupados (max_connections). Antes de subir el límite, mira quién los ocupa: SHOW PROCESSLIST (como root, que conserva un hueco extra) muestra cada conexión, de dónde viene y si está dormida. Muchas conexiones dormidas de una misma aplicación suelen querer decir que la aplicación no las cierra; wait_timeout decide cuánto espera el servidor antes de cerrarlas él mismo.

explainer-ups-unknown = upsd ha respondido, pero no sirve ningún SAI con ese nombre. El nombre de un SAI es su sección en /etc/nut/ups.conf del servidor, escrito NOMBRE@MÁQUINA (localhost por defecto): upsc -l MÁQUINA lista los nombres que conoce ese servidor. En upsmon.conf, una línea MONITOR que nombra un SAI que no existe no vigila nada: upsmon nunca lo verá pasar a batería.

explainer-ups-denied = upsd ha rechazado esta cuenta. Cada cuenta de /etc/nut/upsd.users en el servidor dice lo que puede hacer: instcmds (los comandos instantáneos para upscmd, o ALL), actions = SET (para cambiar variables con upsrw), upsmon primary o secondary (para upsmon). Un nombre de usuario o una contraseña equivocados dan la misma respuesta. upsd vuelve a leer upsd.users cuando se recarga (systemctl reload nut-server).

explainer-ups-driver = upsd conoce este SAI, pero su controlador no está en marcha, o ha perdido el SAI: upsd no tiene datos que dar. En Debian, el controlador es un servicio propio (systemctl status nut-driver@NOMBRE, journalctl -u nut-driver@NOMBRE), arrancado a partir de la sección del SAI en /etc/nut/ups.conf; comprueba también el cable USB.

explainer-db-syntax = El servidor de base de datos no ha podido leer la sentencia SQL. El texto después de «near» es donde dejó de entender: el error está justo antes, a menudo una coma o una comilla que falta, una palabra mal escrita o una sentencia que este servidor no conoce. Una sentencia escrita en la shell entre comillas dobles conserva intactas sus comillas simples: mariadb -e "SELECT … WHERE name = 'x'".

explainer-db-read-only = El servidor de base de datos está en solo lectura (su variable read_only está activada): rechaza las escrituras de las cuentas normales. En una réplica es a propósito: las escrituras van al primario y la réplica las recibe. SELECT @@read_only muestra el ajuste; conéctate al primario para escribir.

explainer-sieve-compile = El script Sieve no se ha podido compilar, así que no puede ejecutarse. El mensaje da la línea del script y solo el primer problema: un comando desconocido suele ser una errata, o una extensión usada sin pedirla al principio (require ["fileinto", "vacation"];); «expected end of command ';'» quiere decir que falta un punto y coma al final de la línea anterior. Corrígelo y vuelve a compilarlo con sievec antes de activar el script.

explainer-dovecot-config = Dovecot no puede leer su configuración: el archivo y la línea están en el mensaje. «Unknown setting» es un ajuste mal escrito (o de otra versión de Dovecot: la 2.4 renombró muchos), «Missing '{"}"}'» una sección que se quedó abierta. Mientras el archivo esté mal, doveadm y doveconf se detienen, y una recarga conserva la configuración antigua. doveconf -n la vuelve a leer una vez corregida.

explainer-mail-unknown-user = El usuario no está en la userdb de Dovecot. Los usuarios de Dovecot son lo que devuelve su userdb (aquí un passwd-file), no las cuentas de la máquina, y el nombre suele ser la dirección entera: usuario@dominio. doveadm user '*' lista los usuarios que conoce Dovecot.

explainer-search-query = doveadm no ha entendido la consulta de búsqueda. Cada clave lleva su valor justo después (mailbox Trash, savedbefore 2031-01-01, larger 5M); una fecha es AAAA-MM-DD o un intervalo como 30d o 2w (no hay unidad de año); OR va entre dos claves, y los paréntesis hay que protegerlos de la shell. man doveadm-search-query lista las claves.

explainer-refused = La máquina ha respondido, pero nada ha aceptado la conexión en ese puerto: ningún programa escucha ahí, o un cortafuegos la rechaza activamente. En el servidor, ss -tlnp lista los puertos donde escuchan los programas, y systemctl status dice si el servicio está en marcha. Comprueba también la dirección y el puerto que has usado.

explainer-timed-out = No ha vuelto ninguna respuesta antes de que la herramienta se rindiera. Seguramente los paquetes se perdieron por el camino, a menudo por un cortafuegos que los descarta en lugar de rechazarlos, o la máquina está apagada, o la dirección es incorrecta. Compáralo con «Connection refused», que quiere decir que la máquina sí respondió.

explainer-no-route = Tu máquina no ha encontrado ninguna manera de llegar a esa dirección: ninguna ruta lleva hasta allí, o un router o el cortafuegos del otro lado ha respondido que es inalcanzable. ip route muestra adónde envía tu máquina sus paquetes; comprueba también la propia dirección.

explainer-resolve = No se ha podido convertir el nombre en una dirección: es un problema de DNS (o de /etc/hosts), no un problema del propio servidor. Comprueba primero cómo está escrito; luego dig o host muestran lo que responde el DNS para ese nombre, y /etc/resolv.conf a qué servidor pregunta tu máquina.

explainer-address-in-use = El programa quería escuchar en un puerto que otro programa ya ocupa: solo un programa a la vez puede escuchar en una dirección y un puerto. ss -tlnp muestra qué programa lo tiene. Dos servicios configurados en el mismo puerto, o una copia antigua todavía en marcha, son las causas habituales.

explainer-read-only = Este sistema de archivos está montado en solo lectura: nadie puede escribir en él, ni siquiera root, sean cuales sean los permisos. mount o findmnt muestran la opción ro. A veces el sistema vuelve a montar un disco en solo lectura por sí solo tras errores graves, así que conviene leer antes dmesg y el journal.
    .match =
        Sistema de ficheros de sólo lectura

explainer-no-space = El almacenamiento que contiene este archivo está lleno, o no le queda ningún inodo (uno por archivo). df -h muestra el espacio libre de cada sistema de archivos y df -i sus inodos; du ayuda a encontrar lo que ocupa sitio. Un archivo borrado que un programa sigue teniendo abierto conserva su espacio hasta que el programa lo cierra (lsof).
    .match =
        No queda espacio en el dispositivo

explainer-syntax = La shell no ha podido leer la línea, así que no se ha ejecutado nada: un carácter que significa algo para ella está en un sitio donde no encaja (un |, un ;, un paréntesis, una palabra como then o done), o una comilla o un bloque se han quedado abiertos. Mira el elemento que nombra el mensaje y comprueba que cada comilla esté cerrada. man bash, sección SHELL GRAMMAR, da las reglas.
    .match =
        error de sintaxis cerca del elemento inesperado
        error de sintaxis: no se esperaba el final del fichero

explainer-ps-not-recognized = PowerShell (o cmd.exe) no ha encontrado ningún cmdlet, función ni programa con ese nombre. Comprueba cómo está escrito: los cmdlets se llaman Verbo-Nombre, como Get-Service, y un script de la carpeta actual se ejecuta con .\ delante de su nombre. Get-Command lista los comandos que conoce esta máquina; algunos vienen de un módulo que solo tienen ciertas máquinas.

explainer-not-found = La shell no ha encontrado ningún programa con ese nombre. Comprueba cómo está escrito y las mayúsculas (ls, no LS). Puede que el programa no esté instalado en esta máquina, o que todavía no esté abierto en este capítulo: ayuda lista los comandos que tienes, y man -k busca en el manual por palabra clave.
    .match =
        orden no encontrada
        todavía no tienes este comando

explainer-access-denied = Windows ha rechazado el acceso: tu cuenta no tiene permiso sobre ese archivo, carpeta, clave o servicio. En un recurso compartido se aplican a la vez los permisos del recurso y los permisos NTFS, y gana el más estricto. Get-Acl (o icacls) muestra quién puede hacer qué, y whoami /groups los grupos que aporta tu cuenta.

explainer-permission = El sistema se ha negado: a tu cuenta le falta el permiso que esto necesita sobre ese archivo o carpeta (r para leer, w para escribir, x para entrar en una carpeta o ejecutar un programa). ls -l muestra el propietario, el grupo y los permisos de cada uno y de los demás, y cada carpeta del camino tiene que dejarte pasar. Algunos archivos pertenecen a root a propósito: lee los permisos antes de recurrir a sudo.
    .match =
        Permiso denegado
        permiso denegado

explainer-not-permitted = La operación en sí no está permitida para tu cuenta, sean cuales sean los permisos: solo el propietario de un archivo (o root) puede cambiar sus permisos o su propietario, y solo root puede enviar una señal a los procesos de otra cuenta. Incluso root recibe este mensaje con un archivo inmutable: lsattr muestra el indicador i. man chmod, man kill y man chattr explican cada caso.
    .match =
        Operación no permitida

explainer-not-directory = Una parte de la ruta que has dado es un archivo, no una carpeta: dentro no puede haber nada, y cd no puede entrar. ls -l los distingue: la línea de una carpeta empieza por d. Comprueba la ruta parte por parte.
    .match =
        No es un directorio
        no es un directorio

explainer-is-directory = El comando esperaba un archivo y ha recibido una carpeta. ls muestra lo que contiene una carpeta; cat, nano y una redirección (>) solo funcionan con archivos. Borrar o copiar una carpeta entera necesita una opción: mira man rm y man cp.
    .match =
        Es un directorio
        es un directorio

explainer-no-such-file = No existe nada en esa ruta, tal como está escrita. Una ruta que no empieza por / es relativa: parte de la carpeta actual, que muestra pwd; una que empieza por / parte de la raíz. Los nombres distinguen mayúsculas y minúsculas (Notas no es notas), y Tab solo completa un nombre que existe: una buena prueba.
    .match =
        No existe el fichero o el directorio

## El ajuste, junto a Consejos y Guardado automático.
display-explainer = Ayuda con los errores
display-explainer-title = Proponer una explicación corta bajo los mensajes de error habituales

explainer-s3-date = El almacén de objetos ha rechazado la petición por su fecha. Cada petición S3 va firmada con la fecha y la hora de la máquina que la envía: Amazon S3 rechaza una que se aleje más de 15 minutos de su propio reloj (RequestTimeTooSkewed), Garage una fechada más de 24 horas antes de su reloj («Date is too old»); una URL prefirmada se rechaza cuando ha pasado su X-Amz-Expires. El problema no es el servidor: date y timedatectl muestran el reloj de esta máquina y si NTP lo mantiene en hora.

explainer-s3-region = La petición se firmó para otra región distinta de la del almacén. La región forma parte de la firma (su ámbito: fecha/región/s3/aws4_request), así que una región equivocada invalida la firma aunque la clave sea la correcta. El mensaje nombra el ámbito que esperaba el servidor: pon esa región en la configuración del cliente (region en ~/.aws/config o rclone.conf, o --region).

explainer-s3-access-denied = El almacén de objetos conoce la clave (o ha rechazado una petición sin clave) y no la deja hacer esto. «Operation is not allowed for this key» quiere decir que a la clave le falta el permiso sobre ese bucket (read para listar y leer, write para depositar y borrar, owner para los ajustes del bucket); «No such key», un ID de clave que no conoce; «Invalid signature», un secreto equivocado; «anonymous access», una petición enviada sin clave. Con Garage, sudo garage bucket info BUCKET muestra los permisos de cada clave; aws configure list muestra qué clave usa el cliente.

explainer-s3-no-bucket = Ningún bucket tiene ese nombre en este almacén. Comprueba cómo está escrito (los nombres de bucket van en minúsculas), y que el cliente hable con el endpoint correcto (--endpoint-url, endpoint_url en ~/.aws/config, endpoint en rclone.conf): otro almacén tiene otros buckets. aws s3 ls lista los buckets que puede usar esta clave; con Garage, sudo garage bucket list los lista todos.

explainer-s3-credentials = La herramienta de línea de comandos de AWS no ha encontrado ninguna clave con la que firmar. Busca en la línea de comandos (--profile), en el entorno (AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY, AWS_PROFILE), y luego en ~/.aws/credentials y ~/.aws/config, en la carpeta personal del usuario que la ejecuta: con sudo es la de root, no la tuya. aws configure list muestra lo que ha encontrado, y dónde.

explainer-garage-layout = Garage no ha aplicado el cambio de layout. Un layout se cambia en dos pasos: los cambios se preparan (garage layout assign, remove) y luego se aplican con garage layout apply --version N, siendo N la versión siguiente que muestra garage layout show, para que nadie aplique un layout que no ha leído. Un layout también debe conservar al menos tantos nodos con capacidad como el factor de replicación.

explainer-firewalld-auth = firewall-cmd puede leer la configuración de firewalld con cualquier cuenta, pero cambiarla necesita root: por ssh, ningún agente polkit puede pedir una contraseña. Ejecuta el comando con sudo.

explainer-firewalld-not-running = El demonio firewalld no está en marcha, así que firewall-cmd no tiene con quién hablar (y nada filtra). systemctl status firewalld dice por qué; systemctl enable --now firewalld lo arranca y lo mantiene al arrancar la máquina.

explainer-dnf-root = Instalar o quitar paquetes cambia el sistema: dnf necesita root. Vuelve a ejecutarlo con sudo (search, info y list funcionan sin él).

explainer-httpd-bind = httpd no ha podido abrir un socket. Con (98) Address already in use, otro programa escucha en ese puerto (ss -tlnp). Con (13) Permission denied y nada más ahí, en un sistema con SELinux, httpd_t solo puede escuchar en los puertos de tipo http_port_t: busca un AVC (ausearch -m avc), y dale ese tipo al puerto con semanage port -a -t http_port_t -p tcp PUERTO. Mientras falle un socket, httpd no arranca en absoluto.

explainer-selinux-denied = «Permission denied» aunque los permisos Unix lo permiten: en un sistema con SELinux, el núcleo puede rechazar lo que la etiqueta del archivo no permite al dominio del programa. Compara las etiquetas (ls -Z, ps -Z), lee las denegaciones (sudo ausearch -m avc -ts recent | audit2why), y corrige la etiqueta en la política (semanage fcontext, y luego restorecon) en lugar de apagar SELinux.

explainer-tofu-lock = OpenTofu no ha podido bloquear el estado: otra ejecución tiene el bloqueo, y OpenTofu no espera a nadie. Lock Info dice quién lo tomó, para qué operación y cuándo. Con un estado local (terraform.tfstate), el bloqueo pertenece a ese proceso: mira si sigue en marcha (ps), y déjalo terminar o detenlo; tofu force-unlock solo sirve para estados remotos, y -lock=false arriesga que dos ejecuciones escriban el estado a la vez.

explainer-tofu-init = Este directorio de trabajo no está inicializado, o ya no corresponde a su configuración: el proveedor que necesita no está instalado ni registrado en .terraform.lock.hcl. tofu init instala los proveedores y escribe el archivo de bloqueo; tras cambiar una restricción de versión, tofu init -upgrade.

explainer-tofu-variable = Una variable está declarada (un bloque variable) pero nada le da valor: ni valor por defecto, ni archivo .tfvars, ni -var. Un valor dado con -var solo dura lo que dura el comando; los archivos terraform.tfvars y *.auto.tfvars se leen cada vez, igual que las variables de entorno TF_VAR_nombre.

explainer-tofu-argument = La configuración no corresponde al esquema del proveedor: un argumento que no conoce (a menudo una errata, y OpenTofu propone entonces el nombre correcto), un argumento obligatorio que falta, o un bloque mal colocado. El mensaje da el archivo y la línea; tofu validate lo comprueba todo sin tocar nada, y la documentación del proveedor lista los argumentos de cada recurso.

explainer-bao-sealed = OpenBao está sellado: guarda sus datos cifrados y no puede leerlos hasta reconstruir su clave raíz con suficientes fragmentos de clave. bao status muestra el umbral y el progreso; cada persona que tiene un fragmento da el suyo con bao operator unseal. Un servidor siempre arranca sellado, tras reiniciar la máquina o el servicio (salvo con desellado automático).

explainer-bao-preflight = Los comandos bao kv preguntan primero qué motor KV está montado en esa ruta, y esa petición necesita un token cuyas políticas concedan algo bajo el punto de montaje. Comprueba qué token se usa (bao token lookup, BAO_TOKEN, ~/.vault-token) y sus políticas.

explainer-bao-denied = OpenBao rechazó la petición: el token usado no tiene ninguna política que conceda esa capacidad en esa ruta, o el token ya no es válido (revocado, caducado). bao token lookup muestra el token y sus políticas; bao token capabilities RUTA muestra lo que puede hacer ahí. Con un motor KV versión 2, las políticas deben nombrar la ruta de la API (secret/data/..., secret/metadata/...), no la que acepta bao kv.
