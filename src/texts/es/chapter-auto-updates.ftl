### Historia «La Cooperativa», capítulo 6 «Las actualizaciones
### automáticas»: unattended-upgrades. Los comandos, las rutas, las claves
### de configuración de apt y los nombres de paquetes no se traducen.

chapter-auto-updates = Las actualizaciones automáticas
    .summary = Ya hay nuevas actualizaciones de seguridad: activar unattended-upgrades, recibir el informe, reiniciar de noche, y dejar nodejs en paz.

## Archivos

auto-updates-email-awa =
    De:       Awa
    Para:     tú
    Asunto:   ¿Más actualizaciones?

    ¡Gracias otra vez por la última vez! Pero acabo de leer que ya hay
    nuevos fallos en openssl y en el kernel. No podemos llamarte cada
    semana…

    Marc me dijo que había instalado las «actualizaciones automáticas»
    (unattended-upgrades) hace un año. Al parecer, nunca se ha instalado
    nada solo. ¿Puedes echar un vistazo? Lo que querríamos:
      - que las actualizaciones de seguridad se instalen solas, cada día;
      - que se nos avise: un correo a root basta, Lina lo lee;
      - si hace falta un reinicio, que se haga solo, pero con la
        cooperativa cerrada (abrimos de 7:00 a 20:00);
      - sobre todo, no toques nodejs: Lina dice que la caja solo
        funciona con la versión 20, y Marc añadió el repositorio de la
        versión 22 «para ir preparándose».

    La configuración está en /etc/apt/apt.conf.d (man apt.conf, man
    unattended-upgrade). Para comprobarlo sin esperar a mañana por la
    mañana, el servicio que hace el trabajo cada mañana se puede lanzar
    a mano.

## Eventos

auto-updates-event-syntax =
    apt ya no entiende su configuración («E: Syntax error»): lo rechaza
    TODO, actualizaciones automáticas incluidas. Lo más frecuente: un «;»
    olvidado al final de una línea, o una llave. apt-config dump da el
    archivo y la línea.
auto-updates-event-nothing =
    El servicio apt-daily-upgrade se ha ejecutado… y no ha hecho nada.
    Lanza apt.systemd.daily, que lee APT::Periodic::Unattended-Upgrade: a
    «0» (que es el caso en 20auto-upgrades), se detiene enseguida. Por
    eso nunca se ha instalado nada. (apt-config dump APT::Periodic muestra
    lo que ha entendido apt.)
auto-updates-event-nodejs =
    Ay: nodejs acaba de pasar a la versión 22. La caja sigue funcionando
    (con el programa antiguo en memoria), pero no volverá a arrancar:
    exige Node.js 20. Un patrón demasiado amplio en Origins-Pattern deja
    pasar repositorios de terceros, que nadie ha probado con la caja.
    Para volver atrás, reinicia el capítulo desde el menú; y deja nodejs
    fuera (no permitas su origen, o usa Package-Blacklist).
auto-updates-event-in-day =
    La máquina acaba de reiniciarse, en plena tarde: Automatic-Reboot está
    activado, pero sin hora, unattended-upgrades reinicia enseguida
    («now»). Dos minutos sin caja, una cola en el mostrador. Hace falta
    una hora en la que la cooperativa esté cerrada:
    Automatic-Reboot-Time.
auto-updates-event-without-report =
    Las actualizaciones se han instalado, pero nadie se enterará nunca:
    sin Unattended-Upgrade::Mail, no se envía ningún informe.
auto-updates-event-end =
    Las actualizaciones de seguridad se instalan solas cada mañana, el
    informe va a root, la máquina se reiniciará esta noche por el kernel
    nuevo, y nodejs sigue en la versión 20. Lina: «¡He recibido el
    correo! Dice que hará falta un reinicio, y que se hará solo esta
    noche».

    ¡Bien hecho! Has terminado el capítulo «Las actualizaciones
    automáticas».

    QUÉ HA PASADO
    unattended-upgrades estaba instalado, pero apagado: 20auto-upgrades
    decía «0». Cada mañana, el temporizador apt-daily-upgrade lanzaba el
    servicio, que leía ese «0» y se detenía. Una vez activado, instala lo
    que permite 50unattended-upgrades: los orígenes de Debian y sus
    actualizaciones de seguridad, no el repositorio de NodeSource.

    BUENA PRÁCTICA
    - Actualizaciones de seguridad automáticas en todos los servidores;
      los repositorios de terceros y las versiones mayores, a mano,
      después de una prueba.
    - Un informe por correo (Mail), y un reinicio programado cuando nadie
      usa la máquina (Automatic-Reboot-Time).
    - Comprueba sin esperar: unattended-upgrade --dry-run --debug,
      apt-config dump, y el registro de /var/log/unattended-upgrades.
    - Un informe que deja de llegar es una alerta: hay que leerlo.

    DOCUMENTACIÓN
    - UnattendedUpgrades (wiki de Debian): https://wiki.debian.org/UnattendedUpgrades
    - unattended-upgrade(8): https://manpages.debian.org/trixie/unattended-upgrades/unattended-upgrade.8.en.html
    - apt.conf(5): https://manpages.debian.org/trixie/apt/apt.conf.5.en.html
