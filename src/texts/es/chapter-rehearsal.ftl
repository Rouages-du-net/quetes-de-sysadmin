### Historia «La Flota», capítulo 3 «El ensayo»: --check, --diff, --limit
### y los handlers. Los comandos, los módulos, las rutas y la salida de
### Ansible no se traducen; los nombres de tareas y de handlers sí.

chapter-rehearsal = El ensayo
    .summary = Desactivar las contraseñas SSH en tres servidores sin quedarse fuera: ensayar (--check --diff), un centro primero (--limit), y un handler que recarga sshd.

## Archivos

rehearsal-site-yml =
    # El playbook de los centros de barrio
    - name: Los centros de barrio
      hosts: centres
      become: true
      tasks:
        - name: htop para el voluntariado
          apt:
            name: htop
            state: present

        - name: El mensaje de bienvenida
          copy:
            content: "Centro de barrio. Servidor gestionado por Ansible, no modificar a mano.\n"
            dest: /etc/motd

        - name: La carpeta compartida
          file:
            path: /srv/shared
            state: directory
            mode: "0755"

rehearsal-ssh-yml =
    # Se acabaron las contraseñas para SSH en los centros (Théo)
    - name: SSH sin contraseña
      hosts: centres
      become: true
      tasks:
        - name: Ninguna contraseña para SSH
          lineinfile:
            path: /etc/ssh/sshd_config
            regexp: '^#?PasswordAuthentication'
            line: PasswordAuthentication no
          notify: Recargar ssh

      handlers:
        - name: recargar ssh
          service:
            name: ssh
            state: reloaded

rehearsal-note-theo =
    ¡Hola!

    Los centros todavía aceptan contraseñas para SSH: ya no las usamos
    (Ansible pasa por las claves), y los bots que prueban contraseñas, esos
    sí que no se privan. He escrito ~/ansible/ssh.yml para cortar eso en
    todas partes.

    Pero es el tipo de cambio que nos puede dejar fuera. Así que lo hacemos
    como en el teatro:
    1. el ensayo: ansible-playbook ssh.yml --check --diff (no cambia nada,
       Ansible muestra lo que haría);
    2. un centro primero: --limit north, y comprobamos que todavía podemos
       conectarnos;
    3. luego los tres.

    Al final, sshd tiene que haber recargado de verdad su configuración en
    cada centro (sudo sshd -T | grep passwordauth, en un centro), y volver a
    ejecutar el playbook no debe cambiar nada.

    Théo

## Eventos

rehearsal-event-rehearsal =
    El ensayo: con --check, Ansible mira cada host y dice lo que cambiaría,
    sin cambiar nada; --diff muestra las líneas afectadas. Es el momento de
    leer con atención, y de encontrar los errores antes de que cuesten
    algo.
rehearsal-event-handler =
    «The requested handler 'Recargar ssh' was not found»: la tarea notifica
    «Recargar ssh», pero el handler se llama «recargar ssh». Ansible compara
    los nombres exactamente, mayúsculas incluidas. Corrige uno u otro en
    ssh.yml.
rehearsal-event-canary =
    Un solo centro ha recibido el cambio (--limit). Antes de seguir,
    comprueba que todavía puedes conectarte con la clave: ansible north -m
    ping (o ssh deploy@north). Si algo se rompe, solo se rompe en un sitio.
rehearsal-event-not-reload =
    En al menos un centro, sshd_config dice PasswordAuthentication no, pero
    sshd sigue funcionando con la configuración antigua: el handler no ha
    recargado el servicio. Y volver a ejecutar el playbook no cambiará eso:
    la línea ya está, la tarea dice «ok», ya no notifica. Tienes que recargar
    ssh tú, en los centros afectados (el módulo service, con ansible).
rehearsal-event-end =
    En los tres centros, sshd rechaza ahora las contraseñas, y volver a
    ejecutar el playbook no cambia nada. Théo: «Y nadie se ha quedado
    fuera».

    ¡Bien hecho! Has terminado el capítulo «El ensayo» y la historia
    «La Flota».

    QUÉ HA PASADO
    --check ejecuta el playbook sin cambiar nada, --diff muestra las
    diferencias: el ensayo encontró el error del handler antes de que
    hiciera daño. --limit aplica primero el cambio a un solo host. Un
    handler solo se ejecuta al final del play, y solo si una tarea que lo
    notifica ha cambiado algo: es lo que recarga sshd una vez, en el momento
    adecuado, y no en cada ejecución.

    BUENA PRÁCTICA
    - --check --diff antes de cualquier cambio arriesgado, luego --limit en
      un host, y luego todos.
    - Los nombres de notify y de handlers tienen que ser idénticos.
    - Un handler notificado pero no ejecutado (un error más adelante en el
      play) no se ejecutará después: --force-handlers lo ejecuta a pesar del
      fallo; si no, recarga el servicio a mano.
    - Para SSH: comprueba que todavía puedes conectarte antes de cerrar la
      sesión abierta.

    DOCUMENTACIÓN
    - El modo check: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html
    - Los handlers: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html
    - lineinfile: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/lineinfile_module.html
