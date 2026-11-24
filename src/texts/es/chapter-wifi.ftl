### Historia «La Colmena», capítulo «El wifi de las oficinas»: 802.1X con
### FreeRADIUS y el directorio LDAP. Los comandos, los nombres de archivo y
### los nombres de atributos RADIUS no se traducen.

chapter-wifi = El wifi de las oficinas
    .summary = Se acabó la contraseña wifi compartida: cada persona se conecta con su cuenta del directorio, y el servidor RADIUS pone a cada cual en su VLAN.

## Archivos

wifi-email-malik =
    De:       Malik
    Para:     tú
    Asunto:   El wifi de las oficinas

    La contraseña del wifi de las oficinas lleva tres años en un pósit, y
    Camille todavía se la sabe. El electricista ha instalado un punto de
    acceso «empresa» (WPA2-Enterprise, 802.1X): cada persona se conecta con
    su propia cuenta del directorio, y el punto de acceso la pone en la
    VLAN que le dice el servidor RADIUS. Sus ajustes están en
    punto-oficinas.txt.

    El servidor RADIUS es FreeRADIUS, ya instalado en el router
    (/etc/freeradius/3.0, man freeradius). Lo que queremos:
    - los miembros del grupo «oficinas» (Malik, Inès, Sami): VLAN 10;
    - las demás cuentas del directorio (Léo, del café): VLAN 20;
    - las cuentas borradas (Camille): fuera.

    Para probar sin el punto de acceso: radtest (man radtest). Y el
    registro del servidor: journalctl -u freeradius.

    Para sudo: abeja-2027

# { $secret }: el secreto compartido del punto de acceso; { $address }: su dirección
wifi-bound =
    PUNTO DE ACCESO WIFI «OFICINAS» — ajustes (el electricista, febrero de 2028)

    Dirección del punto      : { $address } (VLAN 30, equipos)
    Red wifi (SSID)          : LaColmena-Oficinas
    Seguridad                : WPA2-Enterprise (802.1X), EAP-TTLS / PAP
    Servidor RADIUS          : 10.10.30.1, puerto 1812 (UDP)
    Secreto compartido       : { $secret }
    VLAN dinámica            : sí (atributo Tunnel-Private-Group-Id)
    Puerto del switch        : 22, trunk: VLAN 10, 20, 30

## Eventos

wifi-event-filter =
    El punto de acceso envía sus peticiones al router (UDP 1812)… y la
    cadena input las descarta: nada las deja entrar desde la VLAN de
    equipos. El registro de freeradius se queda en silencio: ni siquiera
    las recibe.
wifi-event-not-reread =
    La configuración ha cambiado en el disco, pero freeradius sigue
    funcionando con la antigua: solo vuelve a leer sus archivos al
    arrancar (sudo freeradius -XC para comprobar, y luego systemctl
    restart freeradius).
wifi-event-unknown =
    Las peticiones llegan, pero freeradius no responde (journalctl -u
    freeradius): el punto de acceso no es un cliente que conozca, o su
    secreto compartido es incorrecto. Cada punto de acceso se declara en
    clients.conf, con su dirección y el mismo secreto que en sus ajustes.
wifi-event-without-ldap =
    freeradius responde… no, a todo el mundo: no conoce ninguna
    contraseña («No known good password»). Las cuentas están en el
    directorio, pero el módulo ldap no está activado: los módulos activos
    son enlaces en mods-enabled, que apuntan a mods-available.
wifi-event-anonymous =
    El módulo ldap sí encuentra las cuentas… pero no sus contraseñas: se
    conecta de forma anónima, y el directorio solo muestra userPassword a
    las cuentas autorizadas a verlo. El módulo necesita una identidad
    (identity, password). Y su base (base_dn) debe ser la de La Colmena.
wifi-event-groups =
    Malik entra, pero no recibe la VLAN 10: Ldap-Group no lo encuentra en
    ningún grupo. Por defecto, el módulo ldap busca el atributo memberOf
    en la entrada de la persona… que este directorio no tiene: sus grupos
    posixGroup enumeran sus miembros en memberUid. El módulo puede buscar
    de otra manera (membership_filter).
wifi-event-order =
    Malik recibe la VLAN 20, como Léo. En el archivo users, gana la
    primera entrada que coincide: si la entrada para todo el mundo va
    antes que la del grupo oficinas, nadie llega nunca a la segunda.
wifi-event-in-place =
    El wifi de las oficinas funciona… ahora mismo. ¿Y en el próximo
    arranque? La regla del cortafuegos debe estar en /etc/nftables.conf
    (freeradius, por su parte, vuelve a leer sus archivos).
wifi-event-end =
    Malik, Inès y Sami entran en la VLAN de las oficinas con su propia
    cuenta, Léo en la del café, y Camille se queda fuera: bastaba con
    borrar su cuenta. Malik despega el pósit.

    ¡Bien hecho! Has terminado el capítulo «El wifi de las oficinas», y la
    historia de La Colmena.

    QUÉ HA PASADO
    Con 802.1X, el punto de acceso no decide nada: pregunta al servidor
    RADIUS (Access-Request), que comprueba la cuenta (aquí, en el
    directorio LDAP) y responde sí o no, con atributos: Tunnel-Type =
    VLAN, Tunnel-Medium-Type = IEEE-802 y Tunnel-Private-Group-Id = 10
    ponen a la persona en la VLAN 10. El punto de acceso debe estar
    declarado (clients.conf) y compartir un secreto con el servidor.

    BUENA PRÁCTICA
    - Una cuenta por persona: una marcha se resuelve borrando una cuenta,
      no cambiando la contraseña de todo el mundo.
    - Para leer el directorio, una cuenta de servicio dedicada, de solo
      lectura, mejor que el administrador (y los permisos de slapd a
      juego).
    - freeradius -XC antes de reiniciar, freeradius -X (servicio parado)
      para entender un rechazo, radtest para probar.

    DOCUMENTACIÓN
    - El módulo ldap: https://wiki.freeradius.org/modules/Rlm_ldap
    - El archivo users: https://wiki.freeradius.org/config/Users
    - VLAN por RADIUS (RFC 3580): https://www.rfc-editor.org/rfc/rfc3580
