### Historia «La Flota», capítulo 2 «El playbook»: la idempotencia. Los
### comandos, los módulos, las rutas y la salida de Ansible no se traducen;
### los nombres de las tareas y el texto del mensaje de bienvenida sí.

chapter-playbook = El playbook
    .summary = Un playbook que duplica una línea y falla la segunda vez: reescribirlo con los módulos adecuados, para que una segunda ejecución no cambie nada.

## Archivos

playbook-line-motd = Centro de barrio. Servidor gestionado por Ansible, no modificar a mano.

playbook-site-yml =
    # El playbook de los centros de barrio (Lucie)
    - name: Los centros de barrio
      hosts: centres
      become: true
      tasks:
        - name: htop para el voluntariado
          apt:
            name: htop
            state: present

        - name: El mensaje de bienvenida
          shell: echo "Centro de barrio. Servidor gestionado por Ansible, no modificar a mano." >> /etc/motd

        - name: La carpeta compartida
          command: mkdir /srv/shared

playbook-message-theo =
    ¡Hola!

    Lucie, que nos ayuda los miércoles, escribió nuestro primer playbook:
    ~/ansible/site.yml. Lo ejecutó dos veces en north para probarlo
    (ansible-playbook site.yml --limit north), y la segunda vez falló. No
    entiendo por qué: ¡no había cambiado nada entre medias!

    Lo que queremos en los tres centros:
    - htop instalado;
    - el mensaje de bienvenida (/etc/motd) diciendo, una sola vez, que el
      servidor lo gestiona Ansible;
    - una carpeta /srv/shared.

    Y sobre todo: poder volver a ejecutar el playbook tantas veces como
    queramos sin romper nada. Ansible lo llama idempotencia.

    Théo

## Eventos

playbook-event-failure =
    Una tarea ha fallado: mkdir se niega a crear /srv/shared, que ya existe.
    El módulo command ejecuta el comando cada vez, sin saber si sigue
    siendo útil. Los módulos de Ansible, en cambio, describen un estado:
    «esta carpeta existe» (ansible-doc file), y solo hacen algo si hace
    falta.
playbook-event-duplicate =
    El mensaje de bienvenida tiene la línea dos veces: shell: echo … >>
    añade una línea en cada ejecución. Para describir «el archivo contiene
    esta línea una vez», hay módulos: copy (todo el contenido del archivo) o
    lineinfile (una línea). ansible-doc copy, ansible-doc lineinfile.
playbook-event-modules =
    site.yml ya no usa ni shell ni command: cada tarea describe un estado, y
    Ansible comprueba antes de actuar.
playbook-event-second =
    El playbook ha pasado en todas partes. Pero un playbook idempotente se
    comprueba… volviéndolo a ejecutar: la segunda vez, no debe cambiar nada
    (changed=0 en el PLAY RECAP).
playbook-event-end =
    Segunda ejecución: ok en todas partes, changed=0, failed=0. Los tres
    centros están en el mismo estado, y el playbook puede ejecutarse cada
    día sin estropear nada. Théo: «Lucie se va a alegrar, casi lo tenía
    todo bien».

    ¡Bien hecho! Has terminado el capítulo «El playbook».

    QUÉ HA PASADO
    Un playbook es una lista de tareas, cada una aplicada a cada host del
    grupo. command y shell ejecutan un comando cada vez: echo >> añade una
    línea más, mkdir falla cuando la carpeta existe. Los módulos (apt, copy,
    lineinfile, file…) describen el estado deseado: miran primero, y solo
    cambian lo que hay que cambiar (changed); si no, dicen ok.

    BUENA PRÁCTICA
    - Un módulo en lugar de un comando siempre que exista uno (ansible-doc
      -l para la lista).
    - Ejecuta un playbook dos veces: la segunda tiene que decir changed=0.
    - copy gestiona el archivo entero, lineinfile una línea: elige según si
      otros escriben también en el archivo.
    - Si un comando es inevitable: creates= (no volver a ejecutarlo si
      existe un archivo) o changed_when.

    DOCUMENTACIÓN
    - Los playbooks: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html
    - La idempotencia: https://docs.ansible.com/ansible/latest/reference_appendices/glossary.html#term-Idempotency
    - Los módulos integrados: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/index.html
