### Historia «La Flota», capítulo 1 «El inventario»: ¿alcanza Ansible los
### tres centros de barrio? Los comandos, las rutas y la salida de Ansible no
### se traducen.

chapter-inventory = El inventario
    .summary = Tres servidores que gestionar a la vez: un inventario de Ansible, las claves de los hosts, la cuenta correcta, y luego ansible -m ping.

## Archivos

inventory-email-theo =
    De:      Théo
    Para:    tú
    Asunto:  Los tres centros de barrio

    ¡Hola, y bienvenida o bienvenido!

    Cada uno de los tres centros de barrio tiene su pequeño servidor:
    north, south y east (north.centres.internal, etc.). Hasta ahora
    entrábamos en cada uno para hacerlo todo tres veces, y han acabado por
    no parecerse. Nos pasamos a Ansible: desde esta máquina, un solo comando
    para los tres.

    En cada centro, la cuenta deploy tiene tu clave ssh (~/.ssh/id_ed25519)
    y puede usar sudo sin contraseña.

    Empecé en ~/ansible: un ansible.cfg y un inventario. No me dio tiempo a
    terminar ni a probarlo. La primera prueba es:
    ansible centres -m ping
    Tiene que responder «pong» para los tres.

    La contraseña de sudo en esta máquina: barrios-2027.

    Théo

## Eventos

inventory-event-without-config =
    «No inventory was parsed»: Ansible no ha encontrado ni ansible.cfg ni
    inventario. Busca ansible.cfg en la carpeta en la que estás, luego
    ~/.ansible.cfg, y luego /etc/ansible/ansible.cfg. La configuración de
    Théo está en ~/ansible: ve allí (cd ~/ansible).
inventory-event-key-host =
    «Host key verification failed»: Ansible pasa por ssh, pero nunca
    pregunta «Are you sure you want to continue connecting?». Una máquina
    cuya clave de host no está en ~/.ssh/known_hosts se rechaza. Conéctate
    una vez a cada una (ssh deploy@north, comprueba la huella, yes, y luego
    exit): la clave queda registrada, y Ansible pasará.
inventory-event-account =
    «theo@…: Permission denied»: Ansible se conecta con la cuenta
    remote_user de ansible.cfg, theo, que no existe en los centros. La
    cuenta que tiene tu clave es deploy (o ansible_user en el inventario, o
    -u deploy para un solo comando).
inventory-event-missing =
    Todo el inventario responde «pong»… pero el inventario solo conoce a
    dos. Théo hablaba de tres centros de barrio: ansible-inventory --graph
    muestra lo que ha leído Ansible.
inventory-event-end =
    north, south y east responden «pong»: Ansible alcanza a los tres, con la
    cuenta correcta y las claves de host comprobadas. Théo: «¡Un comando
    para tres servidores, ya está!».

    ¡Bien hecho! Has terminado el capítulo «El inventario».

    QUÉ HA PASADO
    Ansible no instala nada en los servidores: se conecta por ssh, con una
    cuenta y una clave, y ejecuta allí pequeños programas (los módulos). El
    inventario dice qué máquinas gestiona, ordenadas en grupos ([centres]);
    ansible.cfg, leído desde la carpeta actual, dice dónde está el
    inventario y con qué cuenta conectarse. ping no hace un ping de red:
    comprueba que Ansible puede conectarse y ejecutar un módulo.

    BUENA PRÁCTICA
    - Comprueba las claves de host (known_hosts) en lugar de desactivar la
      comprobación (host_key_checking = False): es lo que te protege de una
      máquina que se hace pasar por otra.
    - Una cuenta dedicada (deploy), con una clave, y sudo para lo que
      necesita root (become).
    - ansible-inventory --graph para ver lo que Ansible ha entendido del
      inventario.

    DOCUMENTACIÓN
    - El inventario: https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html
    - Las conexiones: https://docs.ansible.com/ansible/latest/inventory_guide/connection_details.html
    - El módulo ping: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/ping_module.html
