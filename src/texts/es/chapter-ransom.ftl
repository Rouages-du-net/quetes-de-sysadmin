### Historia «La Ludoteca», capítulo 1 «El rescate»: ransomware,
### detenerlo, encontrar una copia desconectada y restaurar. Los comandos,
### las rutas y los mensajes de ps, mount, restic y crontab no se traducen.
### Las direcciones y el monedero son ficticios.

chapter-ransom = El rescate
    .summary = Lunes por la mañana, todos los archivos de la ludoteca están cifrados: detener el ataque, entender por qué la copia del NAS no sirve, y restaurar desde el disco desconectado.

## Archivos

ransom-message-berenice =
    Un mensaje de Bérénice, presidenta de la ludoteca:

    «¡Desastre! Esta mañana no se abre ni un solo archivo de la carpeta
    compartida (/srv/compartido): todos terminan en .locked, y un mensaje
    pide dinero. No vamos a pagar.

    Tenemos una copia de todo en el NAS, cada noche (/mnt/nas). Y Malo hace
    una copia de seguridad cada domingo en el disco USB del cajón, que
    luego desconecta (esta mañana está conectado al servidor, pero no
    montado). La contraseña de esa copia está en la caja fuerte:
      peon-caballo-torre-27

    Te lo dejo en tus manos. Para sudo: dados-2027.»
ransom-note =
    SUS ARCHIVOS ESTÁN CIFRADOS.
    Para recuperarlos, envíe 0,5 bitcoin a la dirección
    bc1q-example-fictitious-address en un plazo de 72 horas.
    Pasado ese plazo, sus archivos se perderán.
ransom-crontab-root = Copia de la carpeta compartida en el NAS, cada noche a las 2:30
# La opción con la que se ejecuta el cifrador, y la etiqueta del disco USB de copias.
ransom-option-quiet = --silencioso
ransom-usb-label = COPIA
ransom-inventory =
    juego;ejemplares;estado
    serpientes y escaleras;3;bueno
    parchís;2;bueno
    damas;4;falta una pieza
    mikado;2;bueno
    dominó;5;bueno
    memory de animales;2;bueno
ransom-schedule =
    Horario de junio
    Miércoles 14:00 - 18:00: dos voluntarios
    Sábado 10:00 - 12:00: un voluntario y el taller de reglas de juego
    Sábado 14:00 - 18:00: tres voluntarios (fiesta del juego el día 26)
ransom-shows =
    FIESTA DEL JUEGO — sábado 26 de junio, plaza del mercado
    Juegos de madera, torneo de damas, rincón para peques.
    Gratis, abierta a todo el mundo.
ransom-rules-goose =
    El juego de la oca
    Cada jugador tira dos dados y avanza otras tantas casillas.
    Una oca: vuelve a avanzar lo mismo. El pozo: espera a que otro
    jugador venga a liberarte. Quien llega primero a la casilla 63
    gana (hay que caer en ella justo).
ransom-rules-horses =
    Parchís
    Hace falta un 5 para sacar una ficha de casa. Se da la vuelta al
    tablero y luego se sube por el pasillo hasta la meta. Sacar un 6 da
    otra tirada.
ransom-rules-ladies =
    Damas
    Las fichas avanzan en diagonal, hacia delante. Se captura saltando por
    encima de una ficha contraria; capturar es obligatorio. Una ficha que
    llega a la última fila se convierte en dama.

## Eventos

ransom-event-extent =
    Todo está cifrado, y una petición de rescate espera en cada carpeta.
    No se paga: nada garantiza que se recupere algo, y financia el
    próximo ataque. Antes de restaurar nada, hay que saber si el ataque ha
    terminado: ¿sigue funcionando algún programa (ps aux)? Y el diario de
    anoche (journalctl) quizá te diga cómo entró.
ransom-event-encryptor-seen =
    Un programa escondido en /home/recepcion/.cache, que funciona con la
    cuenta recepcion y se come toda la CPU: es el cifrador. Hay que
    detenerlo (pertenece a otra cuenta: man kill, y sudo). Luego busca lo
    que podría volver a lanzarlo.
ransom-event-nas =
    En el NAS también, todo está .locked: anoche a las 2:30, la copia
    automática (rsync --delete, en el crontab de root) copió fielmente los
    archivos cifrados, y borró los buenos. Una copia sincronizada, siempre
    conectada, no es una copia de seguridad: también copia los daños.
    Queda el disco del cajón (lsblk).
ransom-event-reencrypted =
    Algunos archivos restaurados acaban de cifrarse a su vez: el cifrador
    sigue funcionando. No se apaga un incendio volviendo a meter los
    muebles en la casa: primero hay que detenerlo, y luego restaurar.
ransom-event-key-too-early =
    Cuidado: el disco de copias está conectado mientras el cifrador sigue
    funcionando. Esta vez no tiene permiso para escribir en él (sus
    archivos pertenecen a root), pero con otra cuenta, la última copia
    también podría haber caído. Detén primero el ataque, y monta una copia
    en solo lectura (mount -o ro).
# El cifrador relanzado por el crontab de la cuenta recepcion
ransom-return =
    ¡El cifrador ha vuelto (ps aux)! Algo lo vuelve a lanzar a intervalos
    regulares. ¿Dónde se guardan las tareas programadas de una cuenta?
    (man crontab)
ransom-event-restored =
    Los seis archivos han vuelto, en su versión del domingo por la noche:
    lo que cambió desde entonces (casi nada, esta vez) se ha perdido.
    Ahora limpia los archivos .locked y las notas de rescate, y vuelve a
    desconectar el disco de copias.
ransom-event-end =
    La carpeta compartida está limpia, el ataque detenido, la cuenta
    culpable bloqueada, y la copia otra vez desconectada. Bérénice: «Y ni
    un céntimo pagado. Malo tenía razón al desconectar ese disco cada
    domingo».

    ¡Bien hecho! Has terminado el capítulo 1 de La Ludoteca. (Te espera lo
    siguiente: ssh ludoteca.)

    QUÉ HA PASADO
    La contraseña de la cuenta recepcion fue adivinada (journalctl: tres
    fallos y luego una conexión, a las 3 de la madrugada). Un programa
    cifró todo lo que esa cuenta podía modificar, y se instaló en su
    crontab para volver. La copia nocturna al NAS, siempre conectada,
    copió los daños. Solo sobrevivió la copia desconectada.

    BUENA PRÁCTICA
    - No pagues; denuncia el ataque (en España, INCIBE: línea 017).
    - Primero detén el ataque: el proceso, lo que lo relanza (crontab,
      servicios), la cuenta usada (bloqueada, contraseña cambiada).
    - Solo entonces restaura, desde una copia montada en solo lectura;
      comprueba; y vuelve a desconectarla.
    - La regla 3-2-1: al menos una copia desconectada o inmutable. Una
      sincronización (rsync --delete) no es una copia de seguridad.
    - Contraseñas largas, nada de conexiones SSH con contraseña desde
      internet, y fail2ban.

    DOCUMENTACIÓN
    - Guía de la ANSSI (en francés): https://cyber.gouv.fr/publications/attaques-par-rancongiciels-tous-concernes
    - Guía de la CISA (en inglés): https://www.cisa.gov/stopransomware/ransomware-guide
    - Restaurar con restic: https://restic.readthedocs.io/en/stable/050_restore.html
    - mount: https://man7.org/linux/man-pages/man8/mount.8.html
