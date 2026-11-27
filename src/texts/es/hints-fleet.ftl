### Pistas graduadas de la historia «La Flota»: una dirección, y luego casi
### la respuesta, para cada paso (ver hints.ts).

## Capítulo 1 — El inventario

hint-inventory-key-host =
    .lead = Ansible lee su configuración desde la carpeta actual (cd ~/ansible). Luego pasa por ssh sin hacer nunca una pregunta: cada centro tiene que estar ya en ~/.ssh/known_hosts.
    .solution = cd ~/ansible, y luego para cada centro: ssh deploy@north, yes, exit (lo mismo para south y east); y luego ansible centres -m ping
hint-inventory-account =
    .lead = Ansible se conecta con la cuenta remote_user de ansible.cfg. ¿Qué cuenta tiene tu clave en los centros? (mira el correo de Théo, y man ansible)
    .solution = En ~/ansible/ansible.cfg: remote_user = deploy
hint-inventory-missing =
    .lead = ansible-inventory --graph muestra los hosts del grupo centres. Falta uno.
    .solution = Añade east en [centres] en ~/ansible/inventory.ini, y luego ansible centres -m ping

## Capítulo 2 — El playbook

hint-playbook-failure =
    .lead = Ejecuta el playbook (ansible-playbook site.yml) y lee la tarea que falla: el comando hace lo mismo cada vez.
    .solution = ansible-playbook site.yml: mkdir falla en north, la carpeta ya existe; y echo >> vuelve a añadir la línea.
hint-playbook-modules =
    .lead = Sustituye las tareas shell y command por módulos que describen un estado: ansible-doc copy (o lineinfile), ansible-doc file.
    .solution = En site.yml: copy con content (la línea del mensaje) y dest: /etc/motd; file con path: /srv/shared y state: directory.
hint-playbook-second =
    .lead = Un playbook idempotente se comprueba volviéndolo a ejecutar: la segunda ejecución no debe cambiar nada.
    .solution = ansible-playbook site.yml una primera vez (changed), y luego una segunda: changed=0 en todas partes en el PLAY RECAP.

## Capítulo 3 — El ensayo

hint-rehearsal-rehearsal =
    .lead = Antes de cambiar nada: man ansible-playbook, las opciones que ejecutan sin cambiar nada y que muestran las diferencias.
    .solution = ansible-playbook ssh.yml --check --diff
hint-rehearsal-handler =
    .lead = Lee el error: el nombre notificado y el nombre del handler tienen que ser exactamente iguales.
    .solution = En ssh.yml: notify: recargar ssh (el nombre del handler, en minúsculas).
hint-rehearsal-canary =
    .lead = Un centro primero: la opción --limit. Luego comprueba que todavía puedes conectarte a él.
    .solution = ansible-playbook ssh.yml --limit north, y luego ansible north -m ping
hint-rehearsal-end =
    .lead = El orden cuenta: primero --check, luego un centro, luego los demás. Cada centro tiene que haber recargado sshd (sshd -T en un centro). Donde la línea ya está, el handler no volverá a notificarse: recarga ssh tú. Luego vuelve a ejecutar el playbook para comprobar changed=0.
    .solution = ansible centres -b -m service -a "name=ssh state=reloaded" si hace falta, ansible-playbook ssh.yml, y luego otra vez ansible-playbook ssh.yml (changed=0).
